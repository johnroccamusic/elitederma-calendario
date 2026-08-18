-- ---------------------------------------------------------
-- Riconciliazione fatture passive — sezioni 4 (Modello dati) e 5
-- (Stati e transizioni) di desktop/docs/spec-riconciliazione.md.
-- Solo schema: nessuna UI, nessun motore di match (§6), nessuna
-- transazione di conferma (§8) — quelli sono passi successivi.
--
-- Le "transizioni vietate" e gli "invarianti" della spec vanno
-- comunque applicati a livello di servizio quando scriveremo il
-- codice che usa queste tabelle (§5 "Transizioni vietate", §10):
-- qui sono garantiti solo i due casi esprimibili come vincolo di
-- schema — vedi commenti puntuali sotto — tutto il resto resta da
-- implementare quando costruiremo il motore/le API.
--
-- Rollback separato: supabase-riconciliazione-fatture-rollback.sql
-- (elimina le 4 tabelle, da usare solo se qualcosa va storto).
-- ---------------------------------------------------------

-- 4.1 documento_fornitore — la fattura ricevuta, importata da Fatture
-- in Cloud (o altra fonte in futuro). fic_id è bigint (non "string"
-- come nella spec astratta) per combaciare col vero id numerico di
-- Fatture in Cloud, già usato così in fatture_ricevute_fic. unique su
-- fic_id: è l'anti-duplicato del criterio di accettazione "reimportando
-- lo stesso documento non si crea un duplicato" (§9, §11).
create table if not exists public.documento_fornitore (
  id uuid primary key default gen_random_uuid(),
  fornitore_id uuid not null references public.fornitori(id),
  fic_id bigint unique,
  tipo text not null default 'fattura' check (tipo in ('fattura', 'nota_credito', 'autofattura')),
  numero text,
  data_documento date,
  imponibile numeric(12,2),
  iva numeric(12,2),
  totale numeric(12,2),
  termini_pagamento text,
  data_scadenza_prevista date,
  rate jsonb, -- se il documento prevede più rate
  stato text not null default 'importato' check (stato in ('importato', 'da_riconciliare', 'riconciliato', 'senza_impegno', 'scartato')),
  xml_url text,
  pdf_url text,
  righe jsonb, -- descrizione + importo di ogni riga: usate dal motore di match (§6.1 "Origine")
  -- derivato: somma di riconciliazione.importo_allocato per questo
  -- documento — mantenuto dal servizio di riconciliazione (§8), non
  -- da un trigger: qui è solo la colonna che lo ospita
  importo_allocato numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documento_fornitore_fornitore_id_idx on public.documento_fornitore(fornitore_id);
-- composita, non singola su stato: la query reale è sempre "documenti
-- in stato X ordinati/filtrati per data" (coda di riconciliazione, §7.1)
create index if not exists documento_fornitore_stato_data_idx on public.documento_fornitore(stato, data_documento);

-- 4.2 impegno — spesa prevista, non ancora fatturata. origine_id è
-- volutamente senza foreign key: cosa referenzia dipende da
-- origine_tipo (un corso, una sede, una campagna marketing, o niente
-- se "manuale") — è un riferimento polimorfico, non a una tabella
-- fissa. "categoria" della spec è qui categoria_id, sulla stessa
-- tassonomia già usata da Prima nota cassa (costi_sottocategorie).
create table if not exists public.impegno (
  id uuid primary key default gen_random_uuid(),
  fornitore_id uuid references public.fornitori(id) on delete set null, -- nullable: può essere previsto senza sapere ancora il fornitore
  descrizione text,
  origine_tipo text check (origine_tipo in ('corso', 'struttura', 'marketing', 'manuale')),
  origine_id uuid, -- riferimento polimorfico, vedi commento sopra
  categoria_id text references public.costi_sottocategorie(id) on delete set null,
  importo_previsto numeric(12,2),
  -- derivati dalle riconciliazioni collegate — mantenuti dal servizio
  -- di riconciliazione (§8), non da un trigger
  importo_coperto numeric(12,2) not null default 0,
  importo_effettivo numeric(12,2) not null default 0,
  data_prevista date,
  stato text not null default 'aperto' check (stato in ('aperto', 'parzialmente_coperto', 'coperto', 'chiuso', 'annullato')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists impegno_fornitore_id_idx on public.impegno(fornitore_id);
-- composita: è la query del motore di match (§6, "tutti gli impegni
-- aperti o parzialmente coperti di questo fornitore, ordinati/filtrati
-- per data prevista")
create index if not exists impegno_stato_fornitore_data_idx on public.impegno(stato, fornitore_id, data_prevista);
create index if not exists impegno_origine_idx on public.impegno(origine_tipo, origine_id);

-- 4.3 riconciliazione — tabella ponte molti-a-molti fra documenti e
-- impegni (una fattura può coprire più impegni; un impegno può essere
-- coperto da più fatture, es. acconto e saldo). importo_allocato può
-- essere negativo per le note di credito (§9 "Nota di credito") — per
-- lo stesso motivo NIENTE unique su (documento_id, impegno_id): la
-- stessa coppia può avere più righe (es. una originale e una nota di
-- credito che la rettifica).
-- ON DELETE RESTRICT su entrambe le foreign key: impedisce già a
-- livello di database di cancellare un documento o un impegno mentre
-- esistono riconciliazioni collegate, coerente con le due "transizioni
-- vietate" della spec (§5) — un vincolo di schema in più, non
-- sostituisce i controlli applicativi che restano da scrivere.
create table if not exists public.riconciliazione (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documento_fornitore(id) on delete restrict,
  impegno_id uuid not null references public.impegno(id) on delete restrict,
  importo_allocato numeric(12,2) not null,
  creata_da text, -- "chi": audit richiesto da §8 punto 7
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists riconciliazione_documento_id_idx on public.riconciliazione(documento_id);
create index if not exists riconciliazione_impegno_id_idx on public.riconciliazione(impegno_id);

-- 4.4 scadenza_passiva — l'obbligo di pagare, generato dal documento
-- (mai dall'impegno, vedi §3 "Punto critico"). contratto_id
-- referenzia abbonamenti_contratti, già la tabella dei "Contratti
-- ricorrenti" di questo gestionale. movimento_id referenzia spese,
-- che è già il libro di prima nota di questo gestionale (solo
-- movimenti "pagata").
create table if not exists public.scadenza_passiva (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references public.documento_fornitore(id) on delete set null,
  contratto_id uuid references public.abbonamenti_contratti(id) on delete set null,
  data_scadenza date,
  importo numeric(12,2),
  stato text not null default 'da_pagare' check (stato in ('da_pagare', 'pagata', 'annullata')),
  movimento_id uuid references public.spese(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scadenza_passiva_origine_richiesta check (documento_id is not null or contratto_id is not null)
);
create index if not exists scadenza_passiva_documento_id_idx on public.scadenza_passiva(documento_id);
create index if not exists scadenza_passiva_contratto_id_idx on public.scadenza_passiva(contratto_id);
create index if not exists scadenza_passiva_stato_idx on public.scadenza_passiva(stato);
-- composita: è la query reale dello scadenziario passivo, "cosa scade
-- e in che stato, ordinato per data"
create index if not exists scadenza_passiva_data_stato_idx on public.scadenza_passiva(data_scadenza, stato);

-- RLS: stessa policy "for all to anon" già in uso su tutte le altre
-- tabelle dell'area contabilità di questo database (spese, fornitori,
-- abbonamenti_contratti, ecc.) — non è la tabella dei token OAuth di
-- Fatture in Cloud, qui non c'è ragione di trattarla diversamente.
alter table public.documento_fornitore enable row level security;
alter table public.impegno enable row level security;
alter table public.riconciliazione enable row level security;
alter table public.scadenza_passiva enable row level security;

drop policy if exists "accesso interno documento_fornitore" on public.documento_fornitore;
create policy "accesso interno documento_fornitore" on public.documento_fornitore for all to anon using (true) with check (true);
drop policy if exists "accesso interno impegno" on public.impegno;
create policy "accesso interno impegno" on public.impegno for all to anon using (true) with check (true);
drop policy if exists "accesso interno riconciliazione" on public.riconciliazione;
create policy "accesso interno riconciliazione" on public.riconciliazione for all to anon using (true) with check (true);
drop policy if exists "accesso interno scadenza_passiva" on public.scadenza_passiva;
create policy "accesso interno scadenza_passiva" on public.scadenza_passiva for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
