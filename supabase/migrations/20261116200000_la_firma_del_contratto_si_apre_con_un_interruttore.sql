-- LA FIRMA DEL CONTRATTO SI APRE CON UN INTERRUTTORE (16/11/2026, sera).
--
-- Il titolare, poche ore dopo la consegna: «blocca per il momento
-- l'accesso alle master alla firma del contratto».
--
-- PERCHE' NON SI SPEGNE MASTER PER MASTER. La strada corta sarebbe
-- accendere `master.contratto_escluso` su tutte e diciannove. Non si fa,
-- e per un motivo preciso: quella colonna vuol dire «questa persona, per
-- un motivo suo, non firma questa versione» — oggi vale per Tommaso
-- Giumbini, «condizioni da riscrivere». Riempirla di diciannove righe
-- identiche vorrebbe dire perdere la sola che aveva un significato, e il
-- giorno della riapertura nessuno saprebbe piu' quale esclusione era
-- vera. Sono due cose diverse: una e' una decisione su una persona,
-- questa e' una porta chiusa per tutti.
--
-- L'INTERRUTTORE E' UN DATO, non una riga di codice: vive in
-- `impostazioni_layout_tabelle` sotto la chiave
-- `contratti_master_firma_aperta`, con dentro chi l'ha mosso e quando.
-- Si apre e si chiude da «Contratti master» senza pubblicare niente, che
-- e' esattamente quello che serve a un «per il momento».
--
-- E NON VIVE SOLO NEL BROWSER. La nuvola nella dashboard sparisce, ma la
-- serratura sta qui: `contratto_master_salva` e `contratto_master_bozza`
-- rifiutano con `motivo = 'chiusa'`. Senza questo, chiudere la porta
-- sarebbe nascondere un tasto — e chi avesse la pagina aperta da prima,
-- o un indirizzo, firmerebbe comunque.
--
-- ASSENZA = CHIUSA, ed e' la parte che conta. Se la riga mancasse, o
-- avesse dentro qualcosa che non si capisce, la firma e' CHIUSA. Una
-- porta che si apre perche' un'impostazione non e' stata trovata e' una
-- porta che non e' mai stata chiusa.
--
-- ROLLBACK in fondo al file.

create or replace function public.contratti_master_firma_aperta()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select (i.valore -> 'aperta') = 'true'::jsonb
       from public.impostazioni_layout_tabelle i
      where i.chiave = 'contratti_master_firma_aperta'),
    false);
$function$;
revoke all on function public.contratti_master_firma_aperta() from public, anon;
grant execute on function public.contratti_master_firma_aperta() to authenticated, service_role;

-- La riga nasce CHIUSA, e si scrive invece di lasciarla mancare: una
-- porta chiusa per assenza di un dato non si distingue da una porta a cui
-- nessuno ha mai pensato.
insert into public.impostazioni_layout_tabelle (chiave, valore, aggiornato_il)
values ('contratti_master_firma_aperta',
        jsonb_build_object('aperta', false, 'cambiato_il', now(), 'cambiato_da', 'chiusa alla consegna, in attesa del titolare'),
        now())
on conflict (chiave) do nothing;

-- ---------------------------------------------------------------------------
-- LE DUE FUNZIONI CHE SCRIVONO, con il controllo in testa.
--
-- Il controllo sta PRIMA di tutto il resto, anche prima di guardare se
-- la master esiste: con la porta chiusa non c'e' niente da sapere su
-- nessuno.
create or replace function public.contratto_master_bozza(p_master_id uuid, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare c public.master_contratti%rowtype;
begin
  if not public.contratti_master_firma_aperta() then
    return jsonb_build_object('ok', false, 'motivo', 'chiusa',
      'errore', 'La firma del contratto non è ancora aperta.');
  end if;
  if p_master_id is null or p_dati is null or jsonb_typeof(p_dati) <> 'object' then
    return jsonb_build_object('ok', false, 'errore', 'Niente da salvare.');
  end if;
  if exists (select 1 from public.master where id = p_master_id and contratto_escluso) then
    return jsonb_build_object('ok', false, 'motivo', 'escluso', 'errore', 'Per questa master il contratto non è ancora pronto.');
  end if;
  select * into c from public.master_contratti where master_id = p_master_id and stato = 'da_firmare' limit 1;
  if not found then
    if exists (select 1 from public.master_contratti where master_id = p_master_id and stato = 'firmato') then
      return jsonb_build_object('ok', false, 'motivo', 'gia_firmato', 'errore', 'Il contratto è già firmato.');
    end if;
    insert into public.master_contratti (master_id, dati) values (p_master_id, p_dati) returning * into c;
    return jsonb_build_object('ok', true, 'id', c.id);
  end if;
  update public.master_contratti set dati = p_dati where id = c.id and stato = 'da_firmare';
  return jsonb_build_object('ok', true, 'id', c.id);
end;
$function$;

-- `contratto_master_salva`: identica a quella del 16/11 mattina, con in
-- testa il controllo della porta. Il resto non si tocca.
create or replace function public.contratto_master_salva(
  p_master_id uuid,
  p_dati jsonb,
  p_firma text,
  p_doc_fronte text default null,
  p_doc_retro text default null,
  p_spunte jsonb default '{}'::jsonb,
  p_contratto jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.master%rowtype;
  c public.master_contratti%rowtype;
  -- deve coincidere con i `obbligatorio: true` di CAMPI
  obbligatori constant text[] := array[
    'nome_cognome','sesso','data_nascita','comune_nascita','codice_fiscale',
    'citta_residenza','cap_residenza','indirizzo_residenza','civico_residenza',
    'partita_iva','email'];
  k text;
  prefisso text;
  percorso text;
  spunta boolean;
  t_cont jsonb; t_cla jsonb; t_man jsonb; t_cas jsonb; t_par jsonb; t_pre jsonb; t_int jsonb;
  congelato jsonb;
  ora timestamptz := now();
begin
  -- LA PORTA, PRIMA DI TUTTO.
  if not public.contratti_master_firma_aperta() then
    return jsonb_build_object('ok', false, 'motivo', 'chiusa',
      'errore', 'La firma del contratto non è ancora aperta: l’Accademia avviserà quando si può firmare.');
  end if;
  if p_master_id is null then
    return jsonb_build_object('ok', false, 'errore', 'Manca la master.');
  end if;
  select * into m from public.master where id = p_master_id;
  if not found then
    return jsonb_build_object('ok', false, 'errore', 'Questa master non esiste.');
  end if;
  if m.contratto_escluso then
    return jsonb_build_object('ok', false, 'motivo', 'escluso',
      'errore', coalesce(m.contratto_escluso_motivo, 'Per questa master il contratto non è ancora pronto.'));
  end if;

  select * into c from public.master_contratti
   where master_id = p_master_id and stato = 'da_firmare' limit 1;
  if not found then
    if exists (select 1 from public.master_contratti where master_id = p_master_id and stato = 'firmato') then
      return jsonb_build_object('ok', false, 'motivo', 'gia_firmato',
        'errore', 'Questo contratto risulta già firmato e non si può rifirmare.');
    end if;
    insert into public.master_contratti (master_id) values (p_master_id) returning * into c;
  end if;

  if p_firma is null or btrim(p_firma) = '' then
    return jsonb_build_object('ok', false, 'motivo', 'senza_firma',
      'errore', 'Senza firma il contratto non si può registrare.');
  end if;

  prefisso := 'contratti/' || p_master_id::text || '/';
  foreach percorso in array array[p_firma, p_doc_fronte, p_doc_retro] loop
    if percorso is not null and btrim(percorso) <> ''
       and (left(percorso, length(prefisso)) <> prefisso or position('..' in percorso) > 0) then
      return jsonb_build_object('ok', false, 'motivo', 'percorso_non_valido',
        'errore', 'Uno dei file non è stato caricato correttamente: riprova ad allegarlo.');
    end if;
  end loop;

  if coalesce(nullif(btrim(coalesce(p_doc_fronte, '')), ''), nullif(btrim(coalesce(c.doc_fronte, '')), '')) is null then
    return jsonb_build_object('ok', false, 'motivo', 'senza_documento',
      'errore', 'Manca la foto del documento (fronte).');
  end if;
  if coalesce(nullif(btrim(coalesce(p_doc_retro, '')), ''), nullif(btrim(coalesce(c.doc_retro, '')), '')) is null then
    return jsonb_build_object('ok', false, 'motivo', 'senza_documento',
      'errore', 'Manca la foto del documento (retro).');
  end if;

  foreach k in array array['contratto','clausole','manifesto'] loop
    spunta := coalesce((p_spunte ->> k)::boolean, false);
    if not spunta then
      return jsonb_build_object('ok', false, 'motivo', 'senza_dichiarazioni',
        'errore', 'Mancano le dichiarazioni obbligatorie.');
    end if;
  end loop;

  foreach k in array obbligatori loop
    if k = 'comune_nascita' and nullif(btrim(coalesce(p_dati ->> 'stato_nascita', '')), '') is not null then
      continue;
    end if;
    if nullif(btrim(coalesce(p_dati ->> k, '')), '') is null then
      return jsonb_build_object('ok', false, 'motivo', 'dati_incompleti',
        'errore', 'Manca un dato obbligatorio del contratto: ' || k || '.', 'campo', k);
    end if;
  end loop;

  select corpo into t_int from public.master_contratti_testi where chiave = 'intestazione';
  select corpo into t_par from public.master_contratti_testi where chiave = 'parti';
  select corpo into t_pre from public.master_contratti_testi where chiave = 'premesse';
  select corpo into t_cont from public.master_contratti_testi where chiave = 'articoli';
  select corpo into t_cla from public.master_contratti_testi where chiave = 'clausole';
  select corpo into t_man from public.master_contratti_testi where chiave = 'manifesto';
  select corpo into t_cas from public.master_contratti_testi where chiave = 'caselle';

  if t_cont is not null and t_cla is not null and t_man is not null and t_cas is not null then
    congelato := jsonb_build_object(
      'intestazione', t_int, 'parti', t_par, 'premesse', t_pre,
      'articoli', t_cont, 'clausole', t_cla, 'manifesto', t_man, 'caselle', t_cas,
      'firmato_il', to_char(ora at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'origine', 'server',
      'uguale_a_quello_mostrato', (p_contratto -> 'articoli') = t_cont);
  elsif p_contratto is not null and jsonb_typeof(p_contratto) = 'object'
        and jsonb_typeof(p_contratto -> 'articoli') = 'array' then
    congelato := p_contratto || jsonb_build_object('origine', 'client',
      'firmato_il', to_char(ora at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  else
    return jsonb_build_object('ok', false, 'motivo', 'senza_contratto',
      'errore', 'Il testo del contratto non è arrivato: ricarica la pagina e riprova.');
  end if;

  update public.master_contratti set
    stato = 'firmato',
    dati = coalesce(p_dati, '{}'::jsonb),
    contratto_firmato = congelato,
    consenso_contratto_il = coalesce(consenso_contratto_il, ora),
    consenso_clausole_il  = coalesce(consenso_clausole_il, ora),
    consenso_manifesto_il = coalesce(consenso_manifesto_il, ora),
    testo_letto_il = coalesce(testo_letto_il, ora),
    firma_path = p_firma,
    doc_fronte = coalesce(nullif(btrim(coalesce(p_doc_fronte, '')), ''), doc_fronte),
    doc_retro  = coalesce(nullif(btrim(coalesce(p_doc_retro, '')), ''), doc_retro),
    luogo_firma = nullif(btrim(coalesce(p_dati ->> 'citta_residenza', '')), ''),
    firmato_il = coalesce(firmato_il, ora)
  where id = c.id;

  update public.master set
    codice_fiscale  = coalesce(nullif(btrim(coalesce(p_dati ->> 'codice_fiscale', '')), ''), codice_fiscale),
    sesso           = coalesce(nullif(btrim(coalesce(p_dati ->> 'sesso', '')), ''), sesso),
    data_nascita    = coalesce(nullif(btrim(coalesce(p_dati ->> 'data_nascita', '')), '')::date, data_nascita),
    comune_nascita  = coalesce(nullif(btrim(coalesce(p_dati ->> 'comune_nascita', '')), ''), comune_nascita),
    stato_nascita   = coalesce(nullif(btrim(coalesce(p_dati ->> 'stato_nascita', '')), ''), stato_nascita),
    provincia       = coalesce(nullif(btrim(coalesce(p_dati ->> 'prov_residenza', '')), ''), provincia),
    citta           = coalesce(nullif(btrim(coalesce(p_dati ->> 'citta_residenza', '')), ''), citta),
    cap             = coalesce(nullif(btrim(coalesce(p_dati ->> 'cap_residenza', '')), ''), cap),
    indirizzo       = coalesce(nullif(btrim(coalesce(p_dati ->> 'indirizzo_residenza', '')), ''), indirizzo),
    civico          = coalesce(nullif(btrim(coalesce(p_dati ->> 'civico_residenza', '')), ''), civico),
    stato_residenza = coalesce(nullif(btrim(coalesce(p_dati ->> 'stato_residenza', '')), ''), stato_residenza),
    partita_iva     = coalesce(nullif(btrim(coalesce(p_dati ->> 'partita_iva', '')), ''), partita_iva),
    pec             = coalesce(nullif(btrim(coalesce(p_dati ->> 'pec', '')), ''), pec),
    email           = coalesce(nullif(btrim(coalesce(p_dati ->> 'email', '')), ''), email),
    telefono        = coalesce(nullif(btrim(coalesce(p_dati ->> 'telefono', '')), ''), telefono)
  where id = p_master_id;

  return jsonb_build_object('ok', true, 'id', c.id, 'firmato_il', ora);
end;
$function$;

-- ---------------------------------------------------------------------------
-- LA VISTA DICE SE LA PORTA E' APERTA.
--
-- Serve a far scrivere alla pagina «la firma non e' ancora aperta»
-- invece di presentare un modulo che il database rifiuterebbe. Una
-- pagina che lascia compilare e firmare e poi dice no e' peggio di una
-- pagina che lo dice subito.
create or replace function public.contratto_master_vista(p_master_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m      public.master%rowtype;
  c      public.master_contratti%rowtype;
  testi  jsonb;
  base   jsonb;
  firmato jsonb;
begin
  if p_master_id is null then return null; end if;
  select * into m from public.master where id = p_master_id;
  if not found then return null; end if;

  select * into c from public.master_contratti
   where master_id = p_master_id and stato = 'da_firmare' limit 1;

  select to_jsonb(f) into firmato from public.master_contratti f
   where f.master_id = p_master_id and f.stato = 'firmato'
   order by f.firmato_il desc nulls last limit 1;

  select coalesce(jsonb_object_agg(t.chiave, t.corpo), '{}'::jsonb) into testi
    from public.master_contratti_testi t;

  base := jsonb_strip_nulls(jsonb_build_object(
    'nome_cognome',        nullif(btrim(coalesce(m.nome, '')), ''),
    'codice_fiscale',      nullif(btrim(coalesce(m.codice_fiscale, '')), ''),
    'sesso',               nullif(btrim(coalesce(m.sesso, '')), ''),
    'data_nascita',        m.data_nascita::text,
    'comune_nascita',      nullif(btrim(coalesce(m.comune_nascita, '')), ''),
    'stato_nascita',       nullif(btrim(coalesce(m.stato_nascita, '')), ''),
    'prov_residenza',      nullif(btrim(coalesce(m.provincia, '')), ''),
    'citta_residenza',     nullif(btrim(coalesce(m.citta, '')), ''),
    'cap_residenza',       nullif(btrim(coalesce(m.cap, '')), ''),
    'indirizzo_residenza', nullif(btrim(coalesce(m.indirizzo, '')), ''),
    'civico_residenza',    nullif(btrim(coalesce(m.civico, '')), ''),
    'stato_residenza',     nullif(btrim(coalesce(m.stato_residenza, '')), ''),
    'partita_iva',         nullif(btrim(coalesce(m.partita_iva, '')), ''),
    'pec',                 nullif(btrim(coalesce(m.pec, '')), ''),
    'email',               nullif(btrim(coalesce(m.email, '')), ''),
    'telefono',            nullif(btrim(coalesce(m.telefono, '')), '')));

  return jsonb_build_object(
    'aperta', public.contratti_master_firma_aperta(),
    'master', jsonb_build_object(
      'id', m.id, 'nome', m.nome,
      'escluso', m.contratto_escluso,
      'escluso_motivo', m.contratto_escluso_motivo),
    'contratto', case when c.id is null then null else to_jsonb(c) end,
    'firmato', firmato,
    'dati', base || coalesce(c.dati, '{}'::jsonb),
    'testi', testi);
end;
$function$;

revoke all on function public.contratto_master_vista(uuid) from public, anon;
revoke all on function public.contratto_master_salva(uuid, jsonb, text, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.contratto_master_bozza(uuid, jsonb) from public, anon;
grant execute on function public.contratto_master_vista(uuid) to authenticated, service_role;
grant execute on function public.contratto_master_salva(uuid, jsonb, text, text, text, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.contratto_master_bozza(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK
--
-- Tornare indietro vuol dire RIAPRIRE la firma a tutte: non e' una
-- pulizia, e' una decisione. Per riaprirla si usa l'interruttore in
-- «Contratti master», non questo.
--
--   update public.impostazioni_layout_tabelle
--      set valore = jsonb_set(valore, '{aperta}', 'true'::jsonb), aggiornato_il = now()
--    where chiave = 'contratti_master_firma_aperta';
--
-- E per togliere del tutto l'interruttore (la firma torna sempre aperta,
-- com'era la mattina del 16/11): rieseguire le tre funzioni della
-- migrazione 20261116120000 e poi
--   drop function if exists public.contratti_master_firma_aperta();
--   delete from public.impostazioni_layout_tabelle where chiave = 'contratti_master_firma_aperta';
