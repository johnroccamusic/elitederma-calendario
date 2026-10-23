-- SOLO IL WEBHOOK DICE «PAGATO» (23/10/2026).
--
-- Ieri il database ha cominciato a chiedere la prova del pagamento: una
-- vendita con carta si registra solo se il suo codice in `pagamenti_pos`
-- porta un `pagato_il`. Ma `pagato_il` stava in una tabella scrivibile
-- da chiunque abbia la sessione dell'app (policy `to authenticated`,
-- tutto permesso): nessun tasto lo fa, pero' dalla console del browser
-- si poteva scrivere «pagato» su una richiesta e il guardiano ci avrebbe
-- creduto. Una prova che chiunque puo' fabbricare non e' una prova.
--
-- Da oggi `pagato_il`, `stato`, `importo`, `codice` e il resto li scrive
-- solo il server: le edge function con la service role (stripe-webhook,
-- stripe-crea-pagamento, pos-emetti-fattura), le migrazioni, il cron.
-- Dalla sessione dell'app — anon o authenticated — si puo' toccare
-- soltanto quello che l'app tocca davvero: `cliente` e `note_fattura`
-- (i dati per la fattura), `vendita_id` (il legame con la vendita),
-- `aggiornato_il`, e `stato` nel solo passaggio in_attesa → annullato
-- (il tasto «annulla» sotto il QR). Niente insert, niente delete.
--
-- Il ruolo lo dice `auth.role()`, cioe' il JWT della richiesta: resta
-- 'authenticated' anche dentro una funzione security definer chiamata
-- dall'app, quindi nemmeno una RPC puo' fare da scorciatoia. Le due RPC
-- che toccano questa tabella (registra_vendita_da_pagamento,
-- recupera_vendite_qr_in_ritardo) scrivono solo `vendita_id`: passano.
--
-- E il guardiano di ieri impara due cose: un pagamento vale per UNA
-- vendita (lo stesso codice su un altro numero d'ordine e' rifiutato) e
-- vale per QUELL'importo (un QR da 10 € non chiude un carrello da 500).

create or replace function public.pagamenti_pos_solo_il_server_dice_pagato()
 returns trigger
 language plpgsql
 set search_path = public
as $function$
declare
  ruolo text := auth.role();
  toccate text[];
begin
  -- service_role (le edge function), postgres (migrazioni, cron) e in
  -- generale chi non arriva da PostgREST con un JWT di sessione: passano.
  if ruolo is distinct from 'anon' and ruolo is distinct from 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    raise exception 'PAGAMENTO_PROTETTO: una richiesta di pagamento la crea solo il server (stripe-crea-pagamento).';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'PAGAMENTO_PROTETTO: un pagamento non si cancella dall''app.';
  end if;

  -- UPDATE: tutto cio' che e' cambiato fuori dalle colonne concesse
  select coalesce(array_agg(k order by k), '{}')
    into toccate
    from jsonb_object_keys(to_jsonb(new)) k
   where to_jsonb(new)->k is distinct from to_jsonb(old)->k
     and k not in ('cliente', 'note_fattura', 'vendita_id', 'aggiornato_il', 'stato');
  if cardinality(toccate) > 0 then
    raise exception 'PAGAMENTO_PROTETTO: dall''app non si scrive % su un pagamento: lo fa solo il server.', array_to_string(toccate, ', ');
  end if;

  if new.stato is distinct from old.stato
     and not (old.stato = 'in_attesa' and new.stato = 'annullato') then
    raise exception 'PAGAMENTO_PROTETTO: dall''app un pagamento passa solo da in_attesa ad annullato (era %, chiesto %).', old.stato, new.stato;
  end if;

  return new;
end;
$function$;

drop trigger if exists pagamenti_pos_solo_il_server_dice_pagato on public.pagamenti_pos;
create trigger pagamenti_pos_solo_il_server_dice_pagato
  before insert or update or delete on public.pagamenti_pos
  for each row execute function public.pagamenti_pos_solo_il_server_dice_pagato();

comment on trigger pagamenti_pos_solo_il_server_dice_pagato on public.pagamenti_pos is
  'Dalla sessione dell''app si toccano solo cliente, note_fattura, vendita_id, aggiornato_il e stato (in_attesa → annullato). pagato_il e il resto li scrive solo il server.';

-- Il guardiano di ieri, con il codice non riusabile e l'importo che deve
-- tornare. Il corpo e' quello di 20261023090000 piu' i due controlli.

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
  -- l'importo pagato e l'eventuale altra vendita che ha gia' usato il codice
  v_importo numeric;
  v_altra text;
begin
  if p_vendita is null or jsonb_typeof(p_vendita) <> 'object' then
    raise exception 'Serve il corpo della vendita';
  end if;

  -- LA PROVA DEL PAGAMENTO, prima di tutto il resto
  if v_metodo = 'pos' and coalesce(p_vendita->>'tipo_movimento', 'vendita') = 'vendita' and not v_terminale then
    if v_codice is null then
      raise exception 'PAGAMENTO_NON_PROVATO: vendita con carta senza un pagamento col QR collegato. Si registra solo a pagamento ricevuto, o dal POS esterno dell''amministrazione.';
    end if;
    select true, pp.pagato_il, pp.importo into v_trovato, v_pagato, v_importo from pagamenti_pos pp where pp.codice = v_codice;
    if not found then
      raise exception 'PAGAMENTO_NON_PROVATO: il codice % non corrisponde a nessuna richiesta di pagamento.', v_codice;
    end if;
    if v_pagato is null then
      raise exception 'PAGAMENTO_NON_PROVATO: il pagamento % non risulta ancora incassato su Stripe.', v_codice;
    end if;
    -- Un pagamento vale per UNA vendita. Lo stesso codice su un altro
    -- numero d'ordine e' un QR pagato una volta e speso due.
    select vs.numero_ordine into v_altra from vendite_shop vs
     where vs.pagamento_codice = v_codice and (num is null or vs.numero_ordine <> num)
     limit 1;
    if v_altra is not null then
      raise exception 'PAGAMENTO_NON_PROVATO: il pagamento % e'' gia'' stato usato per la vendita %.', v_codice, v_altra;
    end if;
    -- E vale per QUELL'importo: un QR da 10 € non chiude un carrello da 500.
    -- Sulle 10 vendite col QR in archivio totale e importo coincidono al
    -- centesimo, quindi la tolleranza di un centesimo non taglia niente.
    if abs(coalesce((p_vendita->>'totale')::numeric, 0) - coalesce(v_importo, 0)) > 0.01 then
      raise exception 'PAGAMENTO_NON_PROVATO: il pagamento % e'' di % €, la vendita e'' di % €.', v_codice, v_importo, p_vendita->>'totale';
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
