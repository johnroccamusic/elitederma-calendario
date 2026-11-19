-- I CONTRATTI DELLE MASTER (16/11/2026).
--
-- Il titolare: «dobbiamo creare una nuova area nella home page che si
-- chiama contratti master. La compilazione del contratto deve avvenire
-- come quella del modulo di iscrizione. Le master troveranno in ciascuna
-- delle loro dashboard una nuova nuvola che si chiama firma del
-- contratto (ad esclusione di Tommaso Giumbini le cui condizioni vanno
-- riscritte).»
--
-- COM'E' FATTO, e perche' ricalca il modulo di iscrizione. Il modulo e'
-- la cosa piu' simile che questo progetto ha: un testo che una persona
-- legge, dei dati che scrive, un documento che allega, una firma col
-- dito e una copia che le torna indietro in PDF. Quindi le regole sono
-- le stesse, e sono quelle che il modulo ha pagato per imparare:
--
--   - il TESTO sta nel database (`master_contratti_testi`) e il SERVER
--     compone da li' la copia congelata: dal browser non si accetta il
--     testo del contratto, o con una sessione si farebbe registrare un
--     contratto alterato (vedi 20261031140000);
--   - SENZA FIRMA non si registra niente, e il controllo sta qui e non
--     nella pagina: un controllo che vive solo nel browser non e' un
--     controllo (vedi 20261022110000);
--   - i FILE devono stare nella cartella di quel contratto, e il
--     percorso non puo' contenere `..` (vedi 20261031120000);
--   - una volta FIRMATO non si riscrive: si riapre con un gesto
--     deliberato che prima ARCHIVIA (vedi 20261022110000, modulo_riapri);
--   - le TRE DICHIARAZIONI sono separate, ognuna con la sua ora: il
--     cartaceo ha tre righe di firma — contratto, approvazione delle
--     clausole degli artt. 1341-1342 c.c., ricevuta dell'Allegato A — e
--     tre atti distinti non si provano con una spunta sola (19/10/2026).
--
-- QUELLO CHE QUI E' DIVERSO, ed e' una semplificazione vera: la master
-- NON arriva da un link pubblico. Entra nel gestionale con la sua
-- password, quindi ha una sessione Supabase e le due funzioni si aprono
-- ad `authenticated` e non ad `anon`; i file vanno in `master-documenti`,
-- che e' gia' privato e gia' chiuso a chi non ha fatto accesso
-- (20261031210000). Resta il limite di sempre, scritto nel CLAUDE.md:
-- con un solo account per tutti, «authenticated» vuol dire «uno dei
-- dispositivi che hanno quella password», non «questa persona». Chi
-- firma lo decide ancora il Gate interno dell'app. Le serrature che
-- queste funzioni fanno rispettare sono quelle che NON dipendono
-- dall'identita': non si firma due volte, non si firma senza firma, non
-- si archivia un testo che non e' il nostro.
--
-- ROLLBACK in fondo al file.

-- ---------------------------------------------------------------------------
-- 1. I DATI DI NASCITA E FISCALI SULLA SCHEDA DELLA MASTER.
--
-- L'epigrafe del contratto li vuole tutti — «nato/a a … il …, residente
-- in …, C.F. …, P. IVA …» — e in anagrafica non c'erano: di 19 master
-- nessuna ha una data di nascita, e dodici non hanno nemmeno la citta'.
-- Non vuol dire che non li abbiano: vuol dire che nessuno li ha mai
-- chiesti. Da qui glieli si chiede una volta, e restano dove tutta
-- l'app li puo' leggere.
--
-- `sesso` serve al codice fiscale e non e' un di piu': il giorno di una
-- donna e' il giorno + 40, e un sesso indovinato produce un codice che
-- PASSA la lettera di controllo ed e' di un'altra persona — il peggiore
-- dei risultati, perche' nessuno lo mette in dubbio (20261020120000).
alter table public.master
  add column if not exists codice_fiscale   text,
  add column if not exists sesso            text,
  add column if not exists data_nascita     date,
  add column if not exists comune_nascita   text,
  add column if not exists stato_nascita    text,
  add column if not exists provincia        text,
  add column if not exists cap              text,
  add column if not exists stato_residenza  text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'master_sesso_valido') then
    alter table public.master add constraint master_sesso_valido check (sesso is null or sesso in ('M','F'));
  end if;
end $$;

-- CHI RESTA FUORI, E PERCHE': una colonna, non un nome nel codice.
--
-- Tommaso Giumbini non firma questo contratto — «le cui condizioni vanno
-- riscritte». Scriverlo nel codice vorrebbe dire che per togliere o
-- rimettere qualcuno serve una pubblicazione, e che fra sei mesi nessuno
-- ricorda perche' quel nome fosse li'. Qui l'esclusione e' un dato, si
-- vede in «Contratti master» con il suo motivo, e la si cambia da una
-- riga.
alter table public.master
  add column if not exists contratto_escluso        boolean not null default false,
  add column if not exists contratto_escluso_motivo text;

update public.master
   set contratto_escluso = true,
       contratto_escluso_motivo = 'Condizioni da riscrivere: non firma questa versione del contratto.'
 where id = '77174dfa-46ed-4ee5-9080-8773667077b9'::uuid;

-- ---------------------------------------------------------------------------
-- 2. IL TESTO DEL CONTRATTO, NEL DATABASE.
--
-- Stessa forma di `modulo_iscrizione_testi`: una riga per chiave, il
-- corpo in jsonb, e ogni correzione archivia da sola la versione
-- precedente. Le chiavi sono quattro — `intestazione`, `parti`,
-- `premesse`, `articoli`, `clausole`, `manifesto`, `caselle` — e le
-- carica la migrazione gemella, generata dal file del codice
-- (`supabase/functions/_shared/contratto-master.js`) perche' le due
-- copie nascano identiche parola per parola.
create table if not exists public.master_contratti_testi (
  chiave        text primary key,
  corpo         jsonb not null,
  aggiornato_il timestamptz not null default now(),
  aggiornato_da text
);

create table if not exists public.master_contratti_testi_archivio (
  id            bigserial primary key,
  chiave        text not null,
  corpo         jsonb not null,
  aggiornato_il timestamptz,
  aggiornato_da text,
  archiviato_il timestamptz not null default now(),
  perche        text
);

create or replace function public.master_contratti_testi_archivia()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' or old.corpo is distinct from new.corpo then
    insert into public.master_contratti_testi_archivio (chiave, corpo, aggiornato_il, aggiornato_da, perche)
    values (old.chiave, old.corpo, old.aggiornato_il, old.aggiornato_da,
            case when tg_op = 'DELETE' then 'Riga cancellata' else 'Sostituita da una correzione' end);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.master_contratti_testi_archivia() from public, anon, authenticated;
drop trigger if exists master_contratti_testi_archivia on public.master_contratti_testi;
create trigger master_contratti_testi_archivia before update or delete on public.master_contratti_testi
  for each row execute function public.master_contratti_testi_archivia();

-- ---------------------------------------------------------------------------
-- 3. I CONTRATTI.
create table if not exists public.master_contratti (
  id        uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.master(id) on delete cascade,
  stato     text not null default 'da_firmare',

  -- I DATI CONGELATI, e non una lettura di `master` fatta al momento di
  -- stampare. Quello che l'epigrafe dice e' quello che lei ha dichiarato
  -- quel giorno: se domani cambia residenza, il contratto firmato non si
  -- deve muovere. Il giro verso `master` lo fa `contratto_master_salva`,
  -- in avanti e una volta sola.
  dati jsonb not null default '{}'::jsonb,

  -- il testo com'era, composto dal server
  contratto_firmato jsonb,

  -- le tre dichiarazioni, ognuna con il suo istante
  consenso_contratto_il timestamptz,
  consenso_clausole_il  timestamptz,
  consenso_manifesto_il timestamptz,
  testo_letto_il        timestamptz,

  firma_path text,
  doc_fronte text,
  doc_retro  text,

  luogo_firma text,
  firmato_il  timestamptz,

  pdf_path        text,
  pdf_generato_il timestamptz,
  copia_inviata_il timestamptz,

  creato_il   timestamptz not null default now(),
  riaperto_il timestamptz,
  riaperto_da text,
  riaperto_perche text,

  constraint master_contratti_stato_noto check (stato in ('da_firmare','firmato')),
  -- UN CONTRATTO FIRMATO DEVE AVERE TUTTO QUELLO CHE LO RENDE FIRMATO.
  -- Senza questo, una riga «firmato» senza firma e senza testo sarebbe un
  -- contratto che l'app dichiara sottoscritto e che non prova niente.
  constraint master_contratti_firmato_completo check (
    stato <> 'firmato' or (
      firma_path is not null and firmato_il is not null and contratto_firmato is not null
      and consenso_contratto_il is not null and consenso_clausole_il is not null
      and consenso_manifesto_il is not null
    )
  )
);

-- UN SOLO CONTRATTO APERTO PER MASTER. Due righe «da firmare» sulla
-- stessa persona vorrebbero dire due nuvole, due testi e nessuno che sa
-- quale ha firmato.
create unique index if not exists master_contratti_uno_da_firmare
  on public.master_contratti (master_id) where stato = 'da_firmare';
create index if not exists master_contratti_per_master on public.master_contratti (master_id);

-- LA RIAPERTURA ARCHIVIA PRIMA DI SBLOCCARE, come `modulo_riapri`: il
-- guasto del 19/10/2026 — la seconda spedizione che sovrascriveva la
-- prima firma — qui non puo' tornare.
create table if not exists public.master_contratti_riaperture (
  id           bigserial primary key,
  contratto_id uuid not null,
  master_id    uuid not null,
  riga         jsonb not null,
  riaperto_il  timestamptz not null default now(),
  riaperto_da  text,
  perche       text
);

alter table public.master_contratti              enable row level security;
alter table public.master_contratti_testi        enable row level security;
alter table public.master_contratti_testi_archivio enable row level security;
alter table public.master_contratti_riaperture   enable row level security;

drop policy if exists "accesso staff master_contratti" on public.master_contratti;
create policy "accesso staff master_contratti" on public.master_contratti
  for all to authenticated using (true) with check (true);
drop policy if exists "accesso staff master_contratti_testi" on public.master_contratti_testi;
create policy "accesso staff master_contratti_testi" on public.master_contratti_testi
  for all to authenticated using (true) with check (true);
drop policy if exists "lettura staff master_contratti_testi_archivio" on public.master_contratti_testi_archivio;
create policy "lettura staff master_contratti_testi_archivio" on public.master_contratti_testi_archivio
  for select to authenticated using (true);
drop policy if exists "lettura staff master_contratti_riaperture" on public.master_contratti_riaperture;
create policy "lettura staff master_contratti_riaperture" on public.master_contratti_riaperture
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4. LA VISTA: cosa la master si trova davanti.
--
-- Precompilato con quello che di lei la scheda sa gia', e NIENTE E'
-- BLOCCATO. E' la differenza voluta dal modulo di iscrizione, dove il
-- prezzo e il pacchetto li ha scritti il venditore e l'allieva non li
-- deve toccare: qui ogni casella e' un dato suo — il suo codice fiscale,
-- la sua residenza, la sua partita IVA — e l'unica persona che li sa per
-- certo e' lei. Quello che c'e' in anagrafica e' una comodita', non una
-- verita' da difendere.
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

  -- `nullif(btrim(...), '')`: una colonna vuota non e' un valore, e
  -- lasciarla dentro coprirebbe la bozza che la master stava scrivendo
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

-- ---------------------------------------------------------------------------
-- 5. LA FIRMA.
--
-- L'ELENCO DEI CAMPI OBBLIGATORI STA ANCHE QUI, e la duplicazione e'
-- voluta: in JavaScript vive in `CAMPI` (contratto-master.js) e serve
-- alla pagina per scrivere «Manca ancora: …», qui serve a rifiutare. Due
-- linguaggi, due scritture; perche' non si scostino, una prova del banco
-- legge questo file e quello e pretende che i due elenchi coincidano.
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
    -- nessuno aperto: se ce n'e' uno firmato, si riapre con un gesto
    -- deliberato e non firmando una seconda volta
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

  -- I FILE STANNO NELLA CARTELLA DI QUESTO CONTRATTO E NON ALTROVE.
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
    -- a chi e' nato all'estero il comune italiano non si chiede
    if k = 'comune_nascita' and nullif(btrim(coalesce(p_dati ->> 'stato_nascita', '')), '') is not null then
      continue;
    end if;
    if nullif(btrim(coalesce(p_dati ->> k, '')), '') is null then
      return jsonb_build_object('ok', false, 'motivo', 'dati_incompleti',
        'errore', 'Manca un dato obbligatorio del contratto: ' || k || '.', 'campo', k);
    end if;
  end loop;

  -- IL TESTO CHE SI ARCHIVIA LO COMPONE IL SERVER, dalle righe del
  -- database. Dal browser si prende solo `p_contratto` come RIPIEGO, e
  -- solo se le righe non ci sono: meglio un contratto firmato col testo
  -- del client che un contratto bloccato. Quale delle due strade e' stata
  -- presa lo dice `origine`, e `uguale_a_quello_mostrato` dice se qualcuno
  -- ha corretto il testo mentre lei leggeva.
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

  -- IL GIRO VERSO L'ANAGRAFICA, in avanti e solo su quello che c'e'.
  --
  -- Quello che ha appena sottoscritto e' la dichiarazione piu'
  -- autorevole dei suoi dati che questo archivio possiede: nessuno sa il
  -- suo codice fiscale meglio di lei, e quelle colonne erano vuote
  -- proprio perche' nessuno gliel'aveva chiesto. Un valore vuoto non
  -- scrive niente: non si cancella un dato buono con un campo lasciato
  -- in bianco.
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
-- 6. LA BOZZA.
--
-- Il contratto e' lungo: la master lo apre, comincia a scrivere, chiude.
-- Senza questo, la volta dopo ricomincia da capo. Scrive SOLO `dati` e
-- SOLO su un contratto non ancora firmato: una bozza non puo' toccare
-- una firma.
create or replace function public.contratto_master_bozza(p_master_id uuid, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare c public.master_contratti%rowtype;
begin
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

-- ---------------------------------------------------------------------------
-- 7. RIAPRIRE UN CONTRATTO FIRMATO.
--
-- PRIMA ARCHIVIA, POI SBLOCCA. La riga intera finisce in
-- `master_contratti_riaperture`: firma, documenti, testo congelato,
-- consensi e date. Senza, riaprire vorrebbe dire cancellare una firma, e
-- la seconda non potrebbe piu' essere confrontata con la prima.
--
-- `contratto_firmato` torna vuoto APPOSTA: si rifirma il testo di adesso,
-- non quello di allora.
create or replace function public.contratto_master_riapri(p_id uuid, p_chi text, p_perche text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare c public.master_contratti%rowtype;
begin
  select * into c from public.master_contratti where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'errore', 'Questo contratto non esiste.'); end if;
  if c.stato <> 'firmato' then
    return jsonb_build_object('ok', false, 'errore', 'Questo contratto non è firmato: non c’è niente da riaprire.');
  end if;
  if exists (select 1 from public.master_contratti where master_id = c.master_id and stato = 'da_firmare') then
    return jsonb_build_object('ok', false, 'errore', 'Per questa master c’è già un contratto da firmare.');
  end if;

  insert into public.master_contratti_riaperture (contratto_id, master_id, riga, riaperto_da, perche)
  values (c.id, c.master_id, to_jsonb(c), p_chi, p_perche);

  update public.master_contratti set
    stato = 'da_firmare',
    contratto_firmato = null,
    consenso_contratto_il = null, consenso_clausole_il = null, consenso_manifesto_il = null,
    testo_letto_il = null,
    firma_path = null, doc_fronte = null, doc_retro = null,
    luogo_firma = null, firmato_il = null,
    pdf_path = null, pdf_generato_il = null, copia_inviata_il = null,
    riaperto_il = now(), riaperto_da = p_chi, riaperto_perche = p_perche
  where id = c.id;
  return jsonb_build_object('ok', true);
end;
$function$;

-- I GRANT. Le tre funzioni le usa l'app con una sessione; ad `anon` non
-- servono e non si danno — i grant di default su `public` darebbero
-- EXECUTE ad `anon`, e una funzione riservata va revocata esplicitamente
-- (lezione del 31/10/2026).
revoke all on function public.contratto_master_vista(uuid) from public, anon;
revoke all on function public.contratto_master_salva(uuid, jsonb, text, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.contratto_master_bozza(uuid, jsonb) from public, anon;
revoke all on function public.contratto_master_riapri(uuid, text, text) from public, anon;
grant execute on function public.contratto_master_vista(uuid) to authenticated, service_role;
grant execute on function public.contratto_master_salva(uuid, jsonb, text, text, text, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.contratto_master_bozza(uuid, jsonb) to authenticated, service_role;
grant execute on function public.contratto_master_riapri(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK
--
--   drop function if exists public.contratto_master_riapri(uuid, text, text);
--   drop function if exists public.contratto_master_bozza(uuid, jsonb);
--   drop function if exists public.contratto_master_salva(uuid, jsonb, text, text, text, jsonb, jsonb);
--   drop function if exists public.contratto_master_vista(uuid);
--   drop table if exists public.master_contratti_riaperture;
--   drop table if exists public.master_contratti;
--   drop trigger if exists master_contratti_testi_archivia on public.master_contratti_testi;
--   drop function if exists public.master_contratti_testi_archivia();
--   drop table if exists public.master_contratti_testi_archivio;
--   drop table if exists public.master_contratti_testi;
--   alter table public.master
--     drop column if exists contratto_escluso, drop column if exists contratto_escluso_motivo,
--     drop column if exists codice_fiscale, drop column if exists sesso,
--     drop column if exists data_nascita, drop column if exists comune_nascita,
--     drop column if exists stato_nascita, drop column if exists provincia,
--     drop column if exists cap, drop column if exists stato_residenza;
--
-- Tornando indietro si perdono i contratti firmati e i dati di nascita e
-- fiscali che le master hanno dichiarato: prima si esportano.
