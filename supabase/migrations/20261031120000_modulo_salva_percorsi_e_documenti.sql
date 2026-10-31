-- modulo_salva: i controlli che vivevano solo nel browser (31/10/2026).
--
-- Trovati dal controllo di sicurezza. La funzione e' l'unica serratura del
-- modulo pubblico, e si fidava di tre cose scritte dal client:
--
--  1. I PERCORSI DEI FILE. firma_path, doc_fronte e doc_retro erano quelli
--     che arrivavano, senza guardare in che cartella stessero. Con il
--     proprio gettone si poteva indicare il documento d'identita' di
--     un'ALTRA iscrizione: modulo-ricevuto lo scarica con la service role e
--     lo allega alla copia spedita alla propria email. Ora devono stare
--     nella cartella del gettone (`left(token, 16)/…`, la stessa regola con
--     cui li compone PaginaModulo) e non contenere `..`.
--
--  2. I DOCUMENTI OBBLIGATORI. doc_fronte e doc_retro sono campi inclusi e
--     obbligatori in Setting, ma lo controllava solo la pagina: chiamando
--     la funzione a mano si firmava e si archiviava un contratto senza
--     documento. E' lo stesso difetto corretto il 22/10 per la firma. Vale
--     la regola della pagina: serve il nuovo file o quello gia' in scheda.
--
--  3. LA FORMA DEL CONTRATTO. p_contratto arrivava anche NULL o vuoto, e
--     veniva archiviato come "cio' che ha sottoscritto". Qui si pretende
--     almeno che ci sia il regolamento, le caselle e l'informativa.
--     NON si verifica che il testo sia quello giusto: il regolamento di
--     partenza sta nel codice dell'app e la tabella modulo_iscrizione_testi
--     e' vuota, quindi il database non ha un originale con cui confrontarlo.
--     Portarlo qui e' una decisione sul testo legale, e resta aperta.
create or replace function public.modulo_salva(
  p_token text, p_risposte jsonb, p_firma text default null, p_doc_fronte text default null,
  p_doc_retro text default null, p_consensi jsonb default '{}'::jsonb, p_contratto jsonb default null)
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
    'sesso','data_nascita','comune_nascita','stato_nascita','taglia_divisa'];
  sue text[] := array['tipo_cliente','taglia_divisa'];
  taglie text[] := array['NO DIVISA','XS','S','M','L','XL','XXL','XXXL'];
  accese text[]; k text; nuovo text; attuale text; scritte int := 0; stato_dopo text;
  tipo_colonna text;
  spunta boolean;
  riaperto boolean := false;
  prefisso text;
  percorso text;
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

  -- 1. i file stanno nella cartella di questo gettone, e non altrove
  prefisso := left(p_token, 16) || '/';
  foreach percorso in array array[p_firma, p_doc_fronte, p_doc_retro] loop
    if percorso is not null and btrim(percorso) <> ''
       and (left(percorso, length(prefisso)) <> prefisso or position('..' in percorso) > 0) then
      return jsonb_build_object('ok', false,
        'errore', 'Uno dei file non è stato caricato correttamente: riprova ad allegarlo.',
        'motivo', 'percorso_non_valido');
    end if;
  end loop;

  foreach k in array array['regolamento','clausole','privacy'] loop
    spunta := coalesce((p_consensi->>k)::boolean, false);
    if not spunta then
      return jsonb_build_object('ok', false, 'errore', 'Mancano le dichiarazioni obbligatorie.');
    end if;
  end loop;

  -- 3. il contratto che si archivia deve almeno avere la forma di un contratto
  if p_contratto is null or jsonb_typeof(p_contratto) <> 'object'
     or coalesce(length(p_contratto ->> 'regolamento'), 0) < 200
     or not (p_contratto ? 'consensi') or not (p_contratto ? 'informativa') then
    return jsonb_build_object('ok', false,
      'errore', 'Il testo del contratto non è arrivato: ricarica la pagina e riprova.',
      'motivo', 'senza_contratto');
  end if;

  riaperto := public.modulo_riaperto(i.id);

  select coalesce(array_agg(c.chiave), '{}') into accese
    from public.modulo_iscrizione_campi c where coalesce(c.incluso, true);

  if exists (select 1 from public.modulo_iscrizione_campi c
              where c.chiave = 'taglia_divisa' and coalesce(c.incluso, true) and coalesce(c.obbligatorio, true))
     and not (upper(btrim(coalesce(p_risposte ->> 'taglia_divisa', ''))) = any (taglie))
     and not (upper(btrim(coalesce(i.taglia_divisa, ''))) = any (taglie)) then
    return jsonb_build_object('ok', false,
      'errore', 'Scegli la taglia della divisa prima di inviare il modulo.',
      'motivo', 'senza_taglia');
  end if;

  -- 2. i documenti obbligatori: il file nuovo o quello gia' in scheda
  if exists (select 1 from public.modulo_iscrizione_campi c
              where c.chiave = 'doc_fronte' and coalesce(c.incluso, true) and coalesce(c.obbligatorio, true))
     and coalesce(nullif(btrim(p_doc_fronte), ''), nullif(btrim(i.doc_fronte), '')) is null then
    return jsonb_build_object('ok', false,
      'errore', 'Manca la foto del documento (fronte).', 'motivo', 'senza_documento');
  end if;
  if exists (select 1 from public.modulo_iscrizione_campi c
              where c.chiave = 'doc_retro' and coalesce(c.incluso, true) and coalesce(c.obbligatorio, true))
     and coalesce(nullif(btrim(p_doc_retro), ''), nullif(btrim(i.doc_retro), '')) is null then
    return jsonb_build_object('ok', false,
      'errore', 'Manca la foto del documento (retro).', 'motivo', 'senza_documento');
  end if;

  foreach k in array consentite loop
    if not (k = any (accese)) then continue; end if;
    if p_risposte is null or not (p_risposte ? k) then continue; end if;
    nuovo := btrim(coalesce(p_risposte ->> k, ''));
    if nuovo = '' then continue; end if;
    execute format('select ($1).%I::text', k) into attuale using i;
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
