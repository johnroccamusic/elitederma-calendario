-- ---------------------------------------------------------
-- "Abbonamenti e contratti": nuovo tab di Contabilità, dopo Scadenziario
-- Attivo. Registro delle spese ricorrenti e identiche nei mesi
-- successivi (canoni SaaS, servizi a contratto) — stesso form di "Nuova
-- spesa" con in più i dati anagrafici del fornitore e una data di
-- inizio/fine.
--
-- L'importo NON è una colonna di abbonamenti_contratti: vive a parte in
-- abbonamenti_importi, una "tranche" per periodo di validità. Quando
-- l'importo cambia non si sovrascrive: si chiude la tranche attiva
-- (valido_fino = giorno prima della nuova data) e se ne apre una nuova
-- da lì in avanti, con una nota automatica che ricorda il vecchio
-- importo. Così un importo passato non cambia mai retroattivamente.
-- ---------------------------------------------------------

-- appendice fornitore: dati già utili di per sé (non solo per gli
-- abbonamenti), sullo stesso fornitore condiviso già usato dalle spese
alter table public.fornitori add column if not exists sito_web text;
alter table public.fornitori add column if not exists dati_account text;
alter table public.fornitori add column if not exists indirizzo text;
alter table public.fornitori add column if not exists citta text;
alter table public.fornitori add column if not exists cap text;

create table if not exists public.abbonamenti_contratti (
  id uuid primary key default gen_random_uuid(),
  fornitore_id uuid references public.fornitori(id) on delete set null,
  descrizione text,
  categoria_id text references public.costi_categorie(id) on delete set null,
  sottocategoria_id text references public.costi_sottocategorie(id) on delete set null,
  periodicita text, -- giornaliera | settimanale | mensile | annuale
  data_inizio date not null,
  data_fine date, -- null = nessuna scadenza (infinito)
  metodo_pagamento text,
  allegato_path text,
  note text,
  tipo_ambito text,
  sede_id uuid references public.location(id) on delete set null,
  corso_id uuid references public.corsi(id) on delete set null,
  classe_id uuid references public.corsi_date(id) on delete set null,
  evento_id uuid references public.eventi(id) on delete set null,
  -- stessa Classificazione gestionale + Budget e controllo di spese/location/master/assistente/hotel
  diretto_indiretto text,
  fisso_variabile text,
  ricorrente_occasionale text,
  natura text default 'operativo',
  controllabilita text,
  riducibilita text,
  essenzialita text,
  origine text default 'manuale',
  ricorrenza text default 'nessuna',
  bene_durevole boolean not null default false,
  includi_analisi_costi boolean not null default true,
  budget_previsto numeric,
  soglia_allerta_personalizzata numeric,
  responsabile_costo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.abbonamenti_importi (
  id uuid primary key default gen_random_uuid(),
  abbonamento_id uuid not null references public.abbonamenti_contratti(id) on delete cascade,
  imponibile numeric not null,
  iva_percentuale numeric not null default 22,
  totale numeric not null,
  valido_da date not null,
  valido_fino date, -- null = tranche attiva oggi
  nota text, -- autogenerata quando una tranche ne chiude un'altra: "Importo precedente valido fino al ... : € ..."
  ts timestamptz not null default now()
);
create index if not exists abbonamenti_importi_abbonamento_id_idx on public.abbonamenti_importi(abbonamento_id);

-- ripartizione su più ambiti, stesso schema di spese_attribuzioni
create table if not exists public.abbonamenti_attribuzioni (
  id uuid primary key default gen_random_uuid(),
  abbonamento_id uuid not null references public.abbonamenti_contratti(id) on delete cascade,
  tipo_ambito text,
  sede_id uuid references public.location(id) on delete set null,
  corso_id uuid references public.corsi(id) on delete set null,
  classe_id uuid references public.corsi_date(id) on delete set null,
  evento_id uuid references public.eventi(id) on delete set null,
  percentuale numeric,
  ts timestamptz not null default now()
);
create index if not exists abbonamenti_attribuzioni_abbonamento_id_idx on public.abbonamenti_attribuzioni(abbonamento_id);

alter table public.abbonamenti_contratti enable row level security;
alter table public.abbonamenti_importi enable row level security;
alter table public.abbonamenti_attribuzioni enable row level security;

-- stessa policy "for all to anon" di tutte le altre tabelle oggi in
-- produzione (vedi nota nel messaggio di fine lavoro: la migrazione che
-- doveva restringerle a "authenticated" risulta rollbackata sul
-- database live, nonostante quanto riportato in CLAUDE.md)
drop policy if exists "accesso interno abbonamenti_contratti" on public.abbonamenti_contratti;
create policy "accesso interno abbonamenti_contratti" on public.abbonamenti_contratti for all to anon using (true) with check (true);
drop policy if exists "accesso interno abbonamenti_importi" on public.abbonamenti_importi;
create policy "accesso interno abbonamenti_importi" on public.abbonamenti_importi for all to anon using (true) with check (true);
drop policy if exists "accesso interno abbonamenti_attribuzioni" on public.abbonamenti_attribuzioni;
create policy "accesso interno abbonamenti_attribuzioni" on public.abbonamenti_attribuzioni for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
