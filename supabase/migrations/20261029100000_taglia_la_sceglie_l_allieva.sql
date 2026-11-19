-- LA TAGLIA DELLA DIVISA LA SCEGLIE L'ALLIEVA (29/10/2026).
--
-- Segnalato dai venditori: «quando mandiamo il modulo, le allieve non
-- possono selezionare la taglia». Succedeva per due regole giuste
-- messe insieme: la scheda obbligava il venditore a scegliere una
-- taglia prima di salvare (quindi il campo arrivava sempre pieno), e
-- `modulo_campo_bloccato` dice che un campo pieno al primo invio e' del
-- venditore e non si tocca. Risultato: il venditore tirava a indovinare
-- una «M» per poter salvare, e l'allieva se la trovava bloccata.
--
-- La taglia e' una cosa che sa solo lei, come Privato/Azienda: non si
-- blocca mai, e `modulo_salva` la riscrive con quello che manda, anche
-- al primo invio. L'elenco ammesso e' quello della scheda.

create or replace function public.modulo_campo_bloccato(p_chiave text, p_valore text, p_riaperto boolean)
returns boolean
language sql
immutable
as $$
  select case
    when p_riaperto then false
    -- cose che sa solo lei: non si bloccano nemmeno se il venditore ha
    -- scritto qualcosa
    when p_chiave in ('tipo_cliente', 'taglia_divisa') then false
    else (p_valore is not null and btrim(p_valore) <> '')
  end;
$$;

CREATE OR REPLACE FUNCTION public.modulo_salva(p_token text, p_risposte jsonb, p_firma text DEFAULT NULL::text, p_doc_fronte text DEFAULT NULL::text, p_doc_retro text DEFAULT NULL::text, p_consensi jsonb DEFAULT '{}'::jsonb, p_contratto jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  i public.iscritti%rowtype;
  consentite text[] := array['nome','cognome','codice_fiscale','indirizzo_residenza','civico_residenza',
    'interno_residenza','cap_residenza','citta_residenza','prov_residenza','stato_residenza','email',
    'telefono','tipo_cliente','fattura_ditta','fattura_indirizzo','fattura_civico','fattura_citta',
    'fattura_prov','fattura_cap','fattura_piva','fattura_cod_dest','fattura_pec','doc_tipo','doc_numero',
    'sesso','data_nascita','comune_nascita','stato_nascita','taglia_divisa'];
  -- i campi che sono sempre suoi: si riscrivono anche al primo invio
  sue text[] := array['tipo_cliente','taglia_divisa'];
  taglie text[] := array['NO DIVISA','XS','S','M','L','XL','XXL','XXXL'];
  accese text[]; k text; nuovo text; attuale text; scritte int := 0; stato_dopo text;
  tipo_colonna text;
  spunta boolean;
  riaperto boolean := false;
  avvio boolean := coalesce((p_consensi->>'avvio_immediato')::boolean, false);
  promo boolean := coalesce((p_consensi->>'promozionali')::boolean, false);
  immag boolean := coalesce((p_consensi->>'immagini')::boolean, false);
begin
  if p_token is null or length(p_token) < 12 then
    return jsonb_build_object('ok', false, 'errore', 'Link non valido.');
  end if;
  select * into i from public.iscritti where token_modulo = p_token;
  if not found then return jsonb_build_object('ok', false, 'errore', 'Link non valido.'); end if;
  if i.stato = 'confermato' then
    return jsonb_build_object('ok', false, 'errore', 'Questa iscrizione è già confermata.', 'motivo', 'confermato');
  end if;
  if i.modulo_ricevuto_il is not null then
    return jsonb_build_object('ok', false,
      'errore', 'Questo modulo è già stato inviato e non si può rimandare.',
      'motivo', 'gia_inviato');
  end if;
  if p_firma is null or btrim(p_firma) = '' then
    return jsonb_build_object('ok', false,
      'errore', 'Senza firma il modulo non si può inviare.',
      'motivo', 'senza_firma');
  end if;

  foreach k in array array['regolamento','clausole','privacy'] loop
    spunta := coalesce((p_consensi->>k)::boolean, false);
    if not spunta then
      return jsonb_build_object('ok', false, 'errore', 'Mancano le dichiarazioni obbligatorie.');
    end if;
  end loop;

  riaperto := public.modulo_riaperto(i.id);

  select coalesce(array_agg(c.chiave), '{}') into accese
    from public.modulo_iscrizione_campi c where coalesce(c.incluso, true);

  -- LA TAGLIA E' OBBLIGATORIA (29/10/2026, deciso dal titolare): senza, il
  -- modulo non parte. La pagina lo dice gia', ma un controllo che vive
  -- solo nel browser non e' un controllo. Vale se il campo e' acceso e
  -- segnato obbligatorio in Setting; conta quello che manda lei, e in
  -- ripiego quello gia' in scheda.
  if exists (select 1 from public.modulo_iscrizione_campi c
              where c.chiave = 'taglia_divisa' and coalesce(c.incluso, true) and coalesce(c.obbligatorio, true))
     and not (upper(btrim(coalesce(p_risposte ->> 'taglia_divisa', ''))) = any (taglie))
     and not (upper(btrim(coalesce(i.taglia_divisa, ''))) = any (taglie)) then
    return jsonb_build_object('ok', false,
      'errore', 'Scegli la taglia della divisa prima di inviare il modulo.',
      'motivo', 'senza_taglia');
  end if;

  foreach k in array consentite loop
    if not (k = any (accese)) then continue; end if;
    if p_risposte is null or not (p_risposte ? k) then continue; end if;
    nuovo := btrim(coalesce(p_risposte ->> k, ''));
    if nuovo = '' then continue; end if;
    execute format('select ($1).%I::text', k) into attuale using i;
    -- al primo invio un campo gia' pieno e' del venditore e non si tocca;
    -- a modulo riaperto e' quello che aveva scritto lei, e lo corregge.
    -- Privato/Azienda e la taglia sono sempre sue.
    if not riaperto and not (k = any (sue)) and attuale is not null and btrim(attuale) <> '' then continue; end if;
    if k = 'tipo_cliente' and nuovo not in ('privato','azienda') then continue; end if;
    if k = 'taglia_divisa' then
      nuovo := upper(nuovo);
      if not (nuovo = any (taglie)) then continue; end if;
    end if;
    if attuale is not null and btrim(attuale) = nuovo then continue; end if;
    select a.atttypid::regtype::text into tipo_colonna
      from pg_attribute a where a.attrelid = 'public.iscritti'::regclass and a.attname = k;
    execute format('update public.iscritti set %I = cast($1 as %s) where id = $2', k, tipo_colonna)
      using nuovo, i.id;
    scritte := scritte + 1;
  end loop;

  stato_dopo := case when i.acconto_pagato then 'confermato' else 'modulo_ricevuto' end;
  update public.iscritti set
    firma_path = p_firma,
    doc_fronte = coalesce(p_doc_fronte, doc_fronte),
    doc_retro = coalesce(p_doc_retro, doc_retro),
    contratto_firmato = coalesce(contratto_firmato, p_contratto),
    modulo_ricevuto_il = coalesce(modulo_ricevuto_il, now()),
    modulo_ricevuto_da = 'online',
    stato = stato_dopo,
    consenso_regolamento_il = coalesce(consenso_regolamento_il, now()),
    consenso_clausole_il    = coalesce(consenso_clausole_il, now()),
    consenso_privacy_il     = coalesce(consenso_privacy_il, now()),
    rinuncia_recesso        = avvio,
    rinuncia_recesso_il     = case when avvio then coalesce(rinuncia_recesso_il, now()) else null end,
    consenso_promozionali   = promo,
    consenso_promozionali_il = case when promo then coalesce(consenso_promozionali_il, now()) else null end,
    consenso_immagini       = immag,
    consenso_immagini_il    = case when immag then coalesce(consenso_immagini_il, now()) else null end
  where id = i.id;
  return jsonb_build_object('ok', true, 'scritte', scritte, 'stato', stato_dopo, 'riaperto', riaperto);
end;
$function$;
