-- IL MODULO RIAPERTO SI RICOMPILA (24/10/2026).
--
-- Olga ha riaperto il modulo di un'allieva (modelle aggiunte dopo la
-- firma) e lei non riusciva a correggere la data di nascita sbagliata.
-- Due serrature la tenevano ferma, tutte e due pensate per il PRIMO
-- invio: `modulo_vista` marca «bloccato» ogni campo che in scheda ha gia'
-- un valore (per proteggere quello che ha scritto il venditore), e
-- `modulo_salva` non riscrive un campo gia' pieno. Ma dopo il primo invio
-- la scheda e' piena di quello che ha scritto LEI: riaperto il modulo,
-- trovava i propri dati blindati, errore compreso.
--
-- Regola nuova: se il modulo e' stato riaperto (c'e' una riga in
-- moduli_riaperture e il modulo non e' ancora tornato), i campi
-- dell'allieva sono precompilati con quello che c'e' e si possono
-- correggere; quello che manda sovrascrive. I campi del corso restano
-- fissi, e la serratura di «gia' inviato» resta quella di sempre.

create or replace function public.modulo_riaperto(p_iscritto_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.moduli_riaperture r where r.iscritto_id = p_iscritto_id)
     and exists (select 1 from public.iscritti i where i.id = p_iscritto_id and i.modulo_ricevuto_il is null);
$$;

create or replace function public.modulo_campo_bloccato(p_chiave text, p_valore text, p_riaperto boolean)
returns boolean
language sql
immutable
as $$
  select case
    when p_riaperto then false
    when p_chiave = 'tipo_cliente' then false
    else (p_valore is not null and btrim(p_valore) <> '')
  end;
$$;

create or replace function public.modulo_vista(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  i         public.iscritti%rowtype;
  cd        public.corsi_date%rowtype;
  corso     public.corsi%rowtype;
  sede      public.location%rowtype;
  campi     jsonb := '[]'::jsonb;
  contratto jsonb := '{}'::jsonb;
  r         record;
  valore    text;
  motivo    text := null;
  riaperto  boolean := false;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select * into i from public.iscritti where token_modulo = p_token;
  if not found then return null; end if;

  select * into cd    from public.corsi_date where id = i.corso_data_id;
  select * into corso from public.corsi      where id = cd.corso_id;
  select * into sede  from public.location   where id = cd.location_id;

  if i.stato = 'confermato' then motivo := 'confermato';
  elsif i.modulo_ricevuto_il is not null then motivo := 'gia_inviato';
  end if;

  riaperto := public.modulo_riaperto(i.id);

  for r in
    select c.chiave, coalesce(c.obbligatorio, true) as obbligatorio
      from public.modulo_iscrizione_campi c
     where coalesce(c.incluso, true)
  loop
    valore := case r.chiave
      when 'corso_nome'        then corso.nome
      when 'corso_data_inizio' then cd.data_inizio::text
      when 'corso_data_fine'   then cd.data_fine::text
      when 'corso_citta'       then coalesce(cd.citta, sede.citta)
      when 'corso_indirizzo'   then coalesce(cd.indirizzo, sede.indirizzo)
      else null
    end;
    if valore is null and r.chiave not like 'corso_%' then
      execute format('select ($1).%I::text', r.chiave) into valore using i;
    end if;
    campi := campi || jsonb_build_object(
      'chiave', r.chiave, 'valore', valore,
      -- i campi del corso restano fissi anche a modulo riaperto
      'bloccato', public.modulo_campo_bloccato(r.chiave, valore, riaperto and r.chiave not like 'corso_%'),
      'obbligatorio', r.obbligatorio);
  end loop;

  select coalesce(jsonb_object_agg(t.chiave, t.corpo), '{}'::jsonb)
    into contratto from public.modulo_iscrizione_testi t;

  return jsonb_build_object(
    'stato', i.stato,
    'scaduto', (motivo is not null),
    'motivo', motivo,
    'ricevuto', (i.modulo_ricevuto_il is not null),
    'ricevuto_il', i.modulo_ricevuto_il,
    'riaperto', riaperto,
    'nome', btrim(coalesce(i.nome,'') || ' ' || coalesce(i.cognome,'')),
    'corso', jsonb_build_object('nome', corso.nome, 'inizio', cd.data_inizio, 'fine', cd.data_fine,
               'citta', coalesce(cd.citta, sede.citta), 'indirizzo', coalesce(cd.indirizzo, sede.indirizzo),
               'sede', sede.nome),
    'campi', campi, 'contratto', contratto);
end;
$function$;

create or replace function public.modulo_salva(p_token text, p_risposte jsonb, p_firma text default null, p_doc_fronte text default null, p_doc_retro text default null, p_consensi jsonb default '{}'::jsonb, p_contratto jsonb default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  i public.iscritti%rowtype;
  consentite text[] := array['nome','cognome','codice_fiscale','indirizzo_residenza','civico_residenza',
    'interno_residenza','cap_residenza','citta_residenza','prov_residenza','stato_residenza','email',
    'telefono','tipo_cliente','fattura_ditta','fattura_indirizzo','fattura_civico','fattura_citta',
    'fattura_prov','fattura_cap','fattura_piva','fattura_cod_dest','fattura_pec','doc_tipo','doc_numero',
    'sesso','data_nascita','comune_nascita','stato_nascita'];
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
  -- la serratura vera: il modulo e' gia' arrivato una volta.
  -- Si toglie solo con `modulo_riapri`, che prima archivia quello che c'e'.
  if i.modulo_ricevuto_il is not null then
    return jsonb_build_object('ok', false,
      'errore', 'Questo modulo è già stato inviato e non si può rimandare.',
      'motivo', 'gia_inviato');
  end if;

  -- LA FIRMA E' LA CONDIZIONE PER SPEDIRE (22/10/2026): un controllo che
  -- vive solo nel browser non e' un controllo.
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

  foreach k in array consentite loop
    if not (k = any (accese)) then continue; end if;
    if p_risposte is null or not (p_risposte ? k) then continue; end if;
    nuovo := btrim(coalesce(p_risposte ->> k, ''));
    if nuovo = '' then continue; end if;
    execute format('select ($1).%I::text', k) into attuale using i;
    -- al primo invio un campo gia' pieno e' del venditore e non si tocca;
    -- a modulo riaperto e' quello che aveva scritto lei, e lo corregge
    if not riaperto and k <> 'tipo_cliente' and attuale is not null and btrim(attuale) <> '' then continue; end if;
    if k = 'tipo_cliente' and nuovo not in ('privato','azienda') then continue; end if;
    if riaperto and attuale is not null and btrim(attuale) = nuovo then continue; end if;
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

revoke all on function public.modulo_riaperto(uuid) from public;
grant execute on function public.modulo_riaperto(uuid) to anon, authenticated;
