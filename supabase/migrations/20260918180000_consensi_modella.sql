-- Il consenso informato della modella, raccolto dal suo telefono.
--
-- La modella inquadra un codice, compila, fotografa il documento, firma
-- col dito e invia. Non entra nell'app e non ha un account: la pagina e'
-- pubblica come quella della ricerca modelle, e come quella scrive
-- passando da una funzione security definer invece che dalla tabella.
--
-- Quello che si conserva qui e' materia delicata per tre motivi diversi:
-- c'e' un documento d'identita', ci sono dichiarazioni sullo stato di
-- salute, e c'e' una firma. Vale la regola del CLAUDE.md: ogni modifica
-- che tocca questa tabella passa da una verifica delle policy.

create table if not exists consensi_modelle (
  id uuid primary key default gen_random_uuid(),

  -- la classe durante la quale avviene il trattamento: e' il codice
  -- inquadrato a dire quale
  corso_data_id uuid references corsi_date(id) on delete set null,

  -- SOTTO QUALE TESTO ha firmato. Il giorno che il consenso cambia
  -- nasce una v2 e questa riga continua a dire "v1", altrimenti fra due
  -- anni non si saprebbe piu' cosa ha letto
  versione_testo text not null default 'v1',

  nome text not null,
  cognome text not null,
  data_nascita date,
  luogo_nascita text,
  residenza text,
  telefono text,
  email text,

  documento_tipo text,
  documento_numero text,

  trattamento text,
  -- "Altro" nell'elenco dei trattamenti: qui cosa
  trattamento_altro text,

  -- allergie, terapie, interventi recenti: il testo del consenso le
  -- dichiara "comunicate", e questo e' il posto dove le comunica
  note_salute text,

  -- i due consensi sono SEPARATI, e vanno tenuti separati: senza il
  -- primo non si tratta, il secondo e' facoltativo e riguarda foto e
  -- video. Metterli insieme sarebbe estorcere il secondo col primo
  consenso_trattamento boolean not null default false,
  consenso_foto_video boolean not null default false,

  -- file nel bucket privato consensi-documenti
  firma_path text,
  documento_fronte_path text,
  documento_retro_path text,

  ts timestamptz not null default now()
);

create index if not exists idx_consensi_modelle_classe on consensi_modelle (corso_data_id);
create index if not exists idx_consensi_modelle_ts on consensi_modelle (ts desc);

alter table consensi_modelle enable row level security;

-- la convenzione attuale del progetto: tutti sono anon, e chiudere a
-- "authenticated" spegnerebbe l'app come il 15/08 (vedi CLAUDE.md §4).
-- Questa policy va stretta insieme alle altre 95 il giorno che si
-- collega Accesso.jsx, non prima e non da sola
drop policy if exists consensi_modelle_tutti on consensi_modelle;
create policy consensi_modelle_tutti on consensi_modelle
  for all to anon, authenticated using (true) with check (true);

-- Il bucket dei documenti: PRIVATO, unico fra gli undici.
--
-- Gli altri dieci sono pubblici e ci si convive: un logo o la foto di un
-- prodotto in giro non fa danno. La foto di una carta d'identita' si'.
-- Privato vuol dire che nessun indirizzo diretto la serve: si passa da
-- un URL firmato, che scade.
insert into storage.buckets (id, name, public)
values ('consensi-documenti', 'consensi-documenti', false)
on conflict (id) do update set public = false;

-- caricare puo' chiunque: chi carica e' la modella, che un account non
-- ce l'ha e non lo avra' mai
drop policy if exists consensi_documenti_carica on storage.objects;
create policy consensi_documenti_carica on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'consensi-documenti');

-- leggere serve per firmare l'URL con cui lo staff guarda il documento
-- nell'archivio. Oggi vale quanto la riga qui sopra, perche' lo staff e'
-- anon come tutti: e' l'ultimo pezzo che si chiude quando si collega il
-- login, non uno in piu' da ricordarsi
drop policy if exists consensi_documenti_leggi on storage.objects;
create policy consensi_documenti_leggi on storage.objects
  for select to anon, authenticated using (bucket_id = 'consensi-documenti');

-- cancellare no: un consenso firmato non si ritocca, e un file che
-- sparisce lascia una riga che dice "firmato" senza piu' la firma
