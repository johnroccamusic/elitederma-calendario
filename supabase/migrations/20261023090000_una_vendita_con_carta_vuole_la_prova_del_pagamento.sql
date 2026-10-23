-- UNA VENDITA CON CARTA VUOLE LA PROVA DEL PAGAMENTO (23/10/2026).
--
-- Il 19/10/2026 una master ha chiuso un carrello con «Carta» senza che
-- il QR fosse mai nato (la richiesta a Stripe era fallita). Il banco ha
-- svuotato il carrello e scaricato il magazzino, `registra_vendita_pos`
-- ha rifiutato la riga per una colonna NOT NULL nuova, la vendita e'
-- finita nella coda dei ritentativi, e alle 16:16 il ritentativo l'ha
-- registrata e ha creato l'ordine di spedizione — «pos», 117,13 €,
-- nessun pagamento. Il pacco e' partito il giorno dopo.
--
-- Nessuno dei tre pezzi chiedeva «ma i soldi sono arrivati?». Da oggi lo
-- chiede il database, che e' l'unico posto che nessuna strada aggira:
--
--   una vendita con metodo_pagamento = 'pos' si registra SOLO se
--     a) porta un pagamento_codice che in pagamenti_pos risulta pagato
--        (il QR / il link di Stripe), oppure
--     b) e' marcata terminale_fisico = true: l'amministrazione ha battuto
--        sul terminale e ha visto lo scontrino. Il banco lo scrive solo
--        quando chi amministra ha scelto «POS esterno».
--
-- Il ritentativo automatico, davanti a questo rifiuto, NON riprova e non
-- si arrende in silenzio: parcheggia la riga (arreso = true, col motivo)
-- cosi' la vede una persona nell'Advisor e decide lei. Una vendita in
-- contanti o con buono continua a registrarsi come prima: li' l'incasso
-- lo constata chi sta al banco.

create or replace function public.registra_vendita_pos(p_vendita jsonb, p_spedizione jsonb default null)
 returns jsonb
 language plpgsql
as $function$
declare
  v vendite_shop;
  s spedizioni_pos;
  gia_presente vendite_shop;
  base_v jsonb := jsonb_build_object('id', gen_random_uuid(), 'ts_ricevuto', now());
  base_s jsonb := jsonb_build_object('id', gen_random_uuid(), 'ts', now());
  num text := p_vendita->>'numero_ordine';
  -- le variabili NON si chiamano come le colonne che interrogano:
  -- `codice` contro `pagamenti_pos.codice` e' «column reference is
  -- ambiguous», e la funzione esplode anche sulla vendita giusta. Trovato
  -- provando il ramo «codice inesistente» subito dopo averla applicata.
  v_metodo text := p_vendita->>'metodo_pagamento';
  v_codice text := nullif(btrim(coalesce(p_vendita->>'pagamento_codice', '')), '');
  v_terminale boolean := coalesce((p_vendita->>'terminale_fisico')::boolean, false);
  v_pagato timestamptz;
  v_trovato boolean;
begin
  if p_vendita is null or jsonb_typeof(p_vendita) <> 'object' then
    raise exception 'Serve il corpo della vendita';
  end if;

  -- LA PROVA DEL PAGAMENTO, prima di tutto il resto
  if v_metodo = 'pos' and coalesce(p_vendita->>'tipo_movimento', 'vendita') = 'vendita' and not v_terminale then
    if v_codice is null then
      raise exception 'PAGAMENTO_NON_PROVATO: vendita con carta senza un pagamento col QR collegato. Si registra solo a pagamento ricevuto, o dal POS esterno dell''amministrazione.';
    end if;
    select true, pp.pagato_il into v_trovato, v_pagato from pagamenti_pos pp where pp.codice = v_codice;
    if not found then
      raise exception 'PAGAMENTO_NON_PROVATO: il codice % non corrisponde a nessuna richiesta di pagamento.', v_codice;
    end if;
    if v_pagato is null then
      raise exception 'PAGAMENTO_NON_PROVATO: il pagamento % non risulta ancora incassato su Stripe.', v_codice;
    end if;
  end if;

  if num is not null then
    select * into gia_presente from vendite_shop where numero_ordine = num;
  end if;

  if gia_presente.id is not null then
    v := gia_presente;
    if p_spedizione is not null and jsonb_typeof(p_spedizione) = 'object'
       and not exists (select 1 from spedizioni_pos where vendita_id = v.id) then
      insert into spedizioni_pos
      select * from jsonb_populate_record(null::spedizioni_pos,
        public.completa_not_null('public.spedizioni_pos'::regclass,
          base_s || p_spedizione || jsonb_build_object('vendita_id', v.id)))
      returning * into s;
    else
      select * into s from spedizioni_pos where vendita_id = v.id limit 1;
    end if;
    return jsonb_build_object('vendita_id', v.id, 'numero_ordine', v.numero_ordine,
                              'spedizione_id', s.id, 'gia_presente', true);
  end if;

  -- `terminale_fisico` non e' una colonna: si toglie prima di scrivere
  insert into vendite_shop
  select * from jsonb_populate_record(null::vendite_shop,
    public.completa_not_null('public.vendite_shop'::regclass, base_v || (p_vendita - 'terminale_fisico')))
  returning * into v;

  if p_spedizione is not null and jsonb_typeof(p_spedizione) = 'object' then
    insert into spedizioni_pos
    select * from jsonb_populate_record(null::spedizioni_pos,
      public.completa_not_null('public.spedizioni_pos'::regclass,
        base_s || p_spedizione || jsonb_build_object('vendita_id', v.id)))
    returning * into s;
  end if;

  return jsonb_build_object('vendita_id', v.id, 'numero_ordine', v.numero_ordine,
                            'spedizione_id', s.id, 'gia_presente', false);
end;
$function$;

-- Il ritentativo: davanti a PAGAMENTO_NON_PROVATO si ferma e lo dice.
create or replace function public.riprova_vendite_pos_in_attesa()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  esito jsonb;
  quante integer := 0;
  attesa interval;
begin
  for r in
    select * from spedizioni_pos_non_riuscite
    where risolto_il is null and arreso = false
      and coalesce(prossimo_tentativo, now()) <= now()
    order by tentato_il
    limit 50
  loop
    begin
      if r.vendita_dati is not null then
        esito := registra_vendita_pos(
          r.vendita_dati,
          case when r.dati is not null and r.dati <> '{}'::jsonb then r.dati else null end);
        update spedizioni_pos_non_riuscite
           set risolto_il = now(),
               vendita_id = (esito->>'vendita_id')::uuid,
               spedizione_id = nullif(esito->>'spedizione_id','')::uuid,
               tentativi = r.tentativi + 1
         where id = r.id;
      else
        if exists (select 1 from spedizioni_pos where vendita_id = r.vendita_id) then
          update spedizioni_pos_non_riuscite set risolto_il = now(), tentativi = r.tentativi + 1 where id = r.id;
        else
          insert into spedizioni_pos
          select * from jsonb_populate_record(null::spedizioni_pos,
            jsonb_build_object('id', gen_random_uuid(), 'prodotti', '[]'::jsonb, 'stato', 'da_spedire',
                               'ts', now(), 'richiede_fattura', false, 'simulazione', false)
            || coalesce(r.dati, '{}'::jsonb)
            || jsonb_build_object('vendita_id', r.vendita_id))
          returning id into esito;
          update spedizioni_pos_non_riuscite set risolto_il = now(), tentativi = r.tentativi + 1 where id = r.id;
        end if;
      end if;
      quante := quante + 1;
    exception when others then
      if sqlerrm like 'PAGAMENTO_NON_PROVATO:%' then
        -- non e' un guasto che passa riprovando: e' una vendita che non
        -- va scritta finche' una persona non dice che i soldi ci sono
        update spedizioni_pos_non_riuscite
           set tentativi = r.tentativi + 1, errore = sqlerrm, arreso = true
         where id = r.id;
        insert into avvisi_magazzino (tipo, messaggio, numero_ordine, operatore)
        select 'vendita_senza_pagamento',
               format('Vendita %s (%s €, %s) FERMATA: %s Non viene registrata e non parte nessun pacco finche'' non la registri a mano dall''Advisor, dopo aver verificato l''incasso.',
                      coalesce(r.vendita_dati->>'numero_ordine', '?'), coalesce(r.vendita_dati->>'totale', '?'),
                      coalesce(r.vendita_dati->>'operatore_nome', '?'), sqlerrm),
               r.vendita_dati->>'numero_ordine', r.vendita_dati->>'operatore_nome'
         where not exists (select 1 from avvisi_magazzino a where a.tipo = 'vendita_senza_pagamento'
                             and a.numero_ordine = r.vendita_dati->>'numero_ordine' and a.risolto_il is null);
      else
        attesa := case r.tentativi
                    when 0 then interval '1 minute'
                    when 1 then interval '2 minutes'
                    when 2 then interval '5 minutes'
                    when 3 then interval '15 minutes'
                    else interval '60 minutes' end;
        update spedizioni_pos_non_riuscite
           set tentativi = r.tentativi + 1,
               prossimo_tentativo = now() + attesa,
               errore = sqlerrm,
               arreso = (r.tentativi + 1 >= 6)
         where id = r.id;
      end if;
    end;
  end loop;
  return quante;
end;
$function$;
