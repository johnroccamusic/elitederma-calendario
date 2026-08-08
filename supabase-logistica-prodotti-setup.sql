-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Logistica prodotti (kit corsi)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Template kit per corso-tipo (vale per tutte le edizioni di quel
-- corso, come corsi_giorni): quali prodotti del magazzino (prodotti_shop)
-- compongono il kit ("tipo"='kit', con quantità per singolo kit) e quali
-- sono "altri accessori" ("tipo"='accessorio', senza quantità fissa: la
-- quantità inviata la scrive chi prepara la spedizione, edizione per
-- edizione).
create table if not exists public.corsi_kit_prodotti (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi(id) on delete cascade,
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  tipo text not null default 'kit', -- 'kit' oppure 'accessorio'
  quantita integer not null default 1, -- rilevante solo per tipo='kit'
  ts timestamptz not null default now(),
  unique (corso_id, prodotto_id, tipo)
);
alter table public.corsi_kit_prodotti enable row level security;
drop policy if exists "corsi_kit_prodotti_all" on public.corsi_kit_prodotti;
create policy "corsi_kit_prodotti_all" on public.corsi_kit_prodotti for all to anon using (true) with check (true);

-- Stato operativo per singola edizione (corsi_date): fase di
-- preparazione/spedizione, numero di kit da preparare (per iscritti +
-- riserva), checklist di preparazione, quantità di ciascun accessorio
-- effettivamente inviata, ed eventuale scarico già effettuato dal
-- magazzino (con il dettaglio di cosa è stato scaricato, per poterlo
-- annullare senza ricalcoli).
create table if not exists public.logistica_kit_edizioni (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade unique,
  fase text not null default 'da_preparare',
  kit_per_iscritti integer,
  kit_di_riserva integer,
  checklist jsonb not null default '{}',
  accessori_quantita jsonb not null default '{}',
  magazzino_scaricato boolean not null default false,
  scarico_dettaglio jsonb not null default '{}',
  ts timestamptz not null default now()
);
alter table public.logistica_kit_edizioni enable row level security;
drop policy if exists "logistica_kit_edizioni_all" on public.logistica_kit_edizioni;
create policy "logistica_kit_edizioni_all" on public.logistica_kit_edizioni for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
