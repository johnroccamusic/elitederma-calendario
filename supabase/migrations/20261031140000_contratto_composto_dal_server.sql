-- Il contratto firmato lo compone il server (31/10/2026).
--
-- Prima: modulo_salva archiviava come "contratto sottoscritto" il testo che il
-- browser gli mandava. Con il gettone si poteva far registrare un regolamento
-- alterato, e il PDF della conferma lo avrebbe riprodotto. Ora i testi sono nel
-- database (migrazione 20261031130000) e qui si prendono da li': dal client si
-- accetta solo l'elenco delle caselle che l'allieva ha visto.
--
-- Resta modificabile da app a piacimento: Setting → Modulo di iscrizione → Il
-- contratto scrive in modulo_iscrizione_testi, e il prossimo modulo firmato
-- congela il testo nuovo. Ogni correzione archivia la versione precedente
-- (trigger qui sotto), cosi' una firma vecchia risale sempre al testo che aveva
-- davanti; e la copia firmata di chi ha gia' firmato non si riscrive mai
-- (coalesce su contratto_firmato).
create or replace function public.modulo_testi_archivia()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' or old.corpo is distinct from new.corpo then
    insert into public.modulo_iscrizione_testi_archivio (chiave, corpo, aggiornato_il, aggiornato_da, archiviato_il, perche)
    values (old.chiave, old.corpo, old.aggiornato_il, old.aggiornato_da, now(),
            case when tg_op = 'DELETE' then 'Riga cancellata da Setting' else 'Sostituita da una correzione in Setting' end);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.modulo_testi_archivia() from public, anon, authenticated;
drop trigger if exists modulo_testi_archivia on public.modulo_iscrizione_testi;
create trigger modulo_testi_archivia before update or delete on public.modulo_iscrizione_testi
  for each row execute function public.modulo_testi_archivia();

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
  t_reg jsonb;
  t_con jsonb;
  mostrate text[];
  contratto_srv jsonb;
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

  -- IL CONTRATTO LO COMPONE IL SERVER, dai testi che stanno nel database.
  -- Del browser si prende solo QUALI caselle l'allieva si e' vista davanti
  -- (l'avvio immediato compare solo a ridosso del corso): il testo del
  -- regolamento, delle clausole e dell'informativa e' quello di
  -- modulo_iscrizione_testi, corretto da Setting → Il contratto. Se l'allieva
  -- aveva in pagina una versione diversa (qualcuno ha corretto il testo
  -- mentre compilava) lo dice `uguale_a_quello_mostrato`. Se una riga dei
  -- testi mancasse, si ricade sul testo mandato dal client, e lo dice
  -- `origine`: meglio un modulo firmato che un modulo bloccato.
  mostrate := array(select c ->> 'chiave' from jsonb_array_elements(coalesce(p_contratto -> 'consensi', '[]'::jsonb)) c);
  if not (mostrate @> array['regolamento','clausole','privacy']) then
    return jsonb_build_object('ok', false,
      'errore', 'Il testo del contratto non è arrivato: ricarica la pagina e riprova.',
      'motivo', 'senza_contratto');
  end if;
  select corpo into t_reg from public.modulo_iscrizione_testi where chiave = 'regolamento';
  select corpo into t_con from public.modulo_iscrizione_testi where chiave = 'consensi';
  if t_reg is not null and t_con is not null and jsonb_typeof(t_con -> 'caselle') = 'array' then
    contratto_srv := jsonb_build_object(
      'regolamento', t_reg,
      'consensi', coalesce((select jsonb_agg(x.c order by x.ord)
                              from jsonb_array_elements(t_con -> 'caselle') with ordinality as x(c, ord)
                             where x.c ->> 'chiave' = any (mostrate)), '[]'::jsonb),
      'informativa', jsonb_build_object('etichetta', t_con -> 'informativaEtichetta', 'rimando', t_con -> 'informativaRimando'),
      'firmato_il', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'origine', 'server',
      'uguale_a_quello_mostrato', (p_contratto -> 'regolamento') = t_reg);
  else
    contratto_srv := p_contratto || jsonb_build_object('origine', 'client');
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
    contratto_firmato = coalesce(contratto_firmato, contratto_srv),
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
