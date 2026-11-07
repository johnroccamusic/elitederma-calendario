-- IL PAGAMENTO SPLITTATO: una vendita, due incassi. 7/11/2026.
--
-- Il titolare, dalla fiera: «sotto al totale due tasti, in unica soluzione
-- o splittato. Se scrivi splittato ti dà due caselle: nella prima quanto
-- paga in contanti, e sotto l'importo rimanente con lo sconto aggiornato
-- per la parte residua con POS fisico o Stripe».
--
-- Perché due colonne e non due vendite (deciso dal titolare fra le due
-- strade): lo scontrino è uno, il numero d'ordine è uno, il magazzino si
-- scarica una volta. Spezzarla in due righe vorrebbe dire spezzare anche
-- le righe dei prodotti — mezzo pigmento su una vendita e mezzo sull'altra
-- — e in archivio due scontrini per un acquisto solo.
--
-- `metodo_pagamento = 'misto'` dice che i soldi sono entrati da due parti,
-- e QUANTO da ognuna lo dicono queste due colonne. Senza di loro resterebbe
-- un totale e nessun modo di sapere quanto è finito nel cassetto e quanto
-- sul conto: la busta della classe, la cassa contanti e le fatture da
-- emettere leggerebbero il numero sbagliato.
alter table vendite_shop
  add column if not exists incasso_contanti_eur numeric,
  add column if not exists incasso_carta_eur numeric;

comment on column vendite_shop.incasso_contanti_eur is
  'Quanti euro di questa vendita sono entrati in contanti. Valorizzata solo con metodo_pagamento = ''misto''; la parte in contanti non genera IVA, come ogni incasso in contanti senza fattura.';
comment on column vendite_shop.incasso_carta_eur is
  'Quanti euro di questa vendita sono entrati con la carta (Stripe o terminale). Valorizzata solo con metodo_pagamento = ''misto''; è su questa parte che si calcola l''IVA, ed è questa cifra che il pagamento col QR deve corrispondere.';

-- UNA VENDITA MISTA DEVE DIRE I DUE IMPORTI. Un'app che se li dimenticasse
-- (una chiave sbagliata nel payload, e `jsonb_populate_record` le ignora in
-- silenzio) scriverebbe una vendita 'misto' senza nessuno dei due: totale
-- giusto, e zero in tutte e due le casse.
-- Le righe negative (reso, annullamento, cambio) possono averli nulli:
-- ereditano il metodo dalla vendita originale e li portano in proporzione
-- quando l'app li conosce.
alter table vendite_shop drop constraint if exists vendite_shop_misto_ha_i_due_incassi;
alter table vendite_shop add constraint vendite_shop_misto_ha_i_due_incassi check (
  metodo_pagamento is distinct from 'misto'
  or coalesce(tipo_movimento, 'vendita') <> 'vendita'
  or (incasso_contanti_eur is not null and incasso_carta_eur is not null)
);

-- E I DUE IMPORTI DEVONO FARE IL TOTALE. È l'invariante che tiene insieme
-- l'archivio: se un giorno si staccano, il totale dice una cosa e le due
-- casse un'altra, e nessuno sa quale credere. Un centesimo e mezzo di
-- tolleranza per gli arrotondamenti delle righe negative in proporzione.
alter table vendite_shop drop constraint if exists vendite_shop_incassi_sommano_il_totale;
alter table vendite_shop add constraint vendite_shop_incassi_sommano_il_totale check (
  (incasso_contanti_eur is null and incasso_carta_eur is null)
  or abs(coalesce(incasso_contanti_eur, 0) + coalesce(incasso_carta_eur, 0) - coalesce(totale, 0)) <= 0.015
);

-- LA PROVA DEL PAGAMENTO VALE ANCHE SULLA PARTE A CARTA.
--
-- Il guardiano del 23/10/2026 pretende, per una vendita con la carta, un
-- pagamento col QR davvero incassato oppure il segno del terminale. Su una
-- vendita mista la carta è una PARTE: senza questa modifica lo splittato
-- diventerebbe la strada per registrare una carta non provata — basta
-- scrivere un euro di contanti.
--
-- E il pagamento deve corrispondere alla PARTE A CARTA, non al totale: è
-- quello che il QR chiede, ed è quello che Stripe incassa.
create or replace function public.registra_vendita_pos(p_vendita jsonb, p_spedizione jsonb default null::jsonb)
 returns jsonb
 language plpgsql
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v vendite_shop;
  s spedizioni_pos;
  gia_presente vendite_shop;
  base_v jsonb := jsonb_build_object('id', gen_random_uuid(), 'ts_ricevuto', now());
  base_s jsonb := jsonb_build_object('id', gen_random_uuid(), 'ts', now());
  num text := p_vendita->>'numero_ordine';
  v_metodo text := p_vendita->>'metodo_pagamento';
  v_codice text := nullif(btrim(coalesce(p_vendita->>'pagamento_codice', '')), '');
  v_terminale boolean := coalesce((p_vendita->>'terminale_fisico')::boolean, false);
  v_pagato timestamptz;
  v_trovato boolean;
  v_importo numeric;
  v_altra text;
  -- quanto di questa vendita si incassa con la carta: su una vendita
  -- normale è il totale, su una mista la sola parte a carta
  v_da_provare numeric := case
    when v_metodo = 'misto' then coalesce((p_vendita->>'incasso_carta_eur')::numeric, 0)
    else coalesce((p_vendita->>'totale')::numeric, 0)
  end;
begin
  if p_vendita is null or jsonb_typeof(p_vendita) <> 'object' then
    raise exception 'Serve il corpo della vendita';
  end if;

  -- LA PROVA DEL PAGAMENTO, prima di tutto il resto
  if v_metodo in ('pos', 'misto') and coalesce(p_vendita->>'tipo_movimento', 'vendita') = 'vendita'
     and not v_terminale and v_da_provare > 0.004 then
    if v_codice is null then
      raise exception 'PAGAMENTO_NON_PROVATO: vendita con carta senza un pagamento col QR collegato. Si registra solo a pagamento ricevuto, o dal POS fisico.';
    end if;
    select true, pp.pagato_il, pp.importo into v_trovato, v_pagato, v_importo from pagamenti_pos pp where pp.codice = v_codice;
    if not found then
      raise exception 'PAGAMENTO_NON_PROVATO: il codice % non corrisponde a nessuna richiesta di pagamento.', v_codice;
    end if;
    if v_pagato is null then
      raise exception 'PAGAMENTO_NON_PROVATO: il pagamento % non risulta ancora incassato su Stripe.', v_codice;
    end if;
    -- Un pagamento vale per UNA vendita.
    select vs.numero_ordine into v_altra from vendite_shop vs
     where vs.pagamento_codice = v_codice and (num is null or vs.numero_ordine <> num)
     limit 1;
    if v_altra is not null then
      raise exception 'PAGAMENTO_NON_PROVATO: il pagamento % e'' gia'' stato usato per la vendita %.', v_codice, v_altra;
    end if;
    -- E vale per QUELL'importo: su una vendita mista, per la parte a carta.
    if abs(v_da_provare - coalesce(v_importo, 0)) > 0.01 then
      raise exception 'PAGAMENTO_NON_PROVATO: il pagamento % e'' di % €, con la carta si incassano % €.', v_codice, v_importo, v_da_provare;
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

revoke execute on function public.registra_vendita_pos(jsonb, jsonb) from anon;
grant execute on function public.registra_vendita_pos(jsonb, jsonb) to authenticated;
