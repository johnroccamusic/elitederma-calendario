-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Materiali rispediti dal corso
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- La master dichiara, per la sua edizione, quali dei prodotti spediti al
-- corso tornano indietro: "interi" (ripristinabili in magazzino) e
-- "aperti" (non ripristinabili, finiscono nel mucchio di prodotti aperti).
-- rientro_interi_processato è la stessa baseline "già applicato" usata
-- altrove (accessori_scaricati ecc.): mai riapplicare due volte lo stesso
-- ripristino di magazzino.
alter table public.logistica_kit_edizioni add column if not exists rientro_prodotti_interi jsonb not null default '{}';
alter table public.logistica_kit_edizioni add column if not exists rientro_prodotti_aperti jsonb not null default '{}';
alter table public.logistica_kit_edizioni add column if not exists rientro_interi_processato jsonb not null default '{}';

-- Il "mucchio" di prodotti aperti non ripristinabili: una riga per
-- (prodotto, edizione), così ridichiarare la stessa edizione aggiorna
-- la riga invece di sommarla di nuovo. Il totale per prodotto (mostrato
-- in Logistica prodotti) è la somma su tutte le edizioni.
create table if not exists public.prodotti_aperti_magazzino (
  id uuid primary key default gen_random_uuid(),
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  quantita integer not null default 0,
  ts timestamptz not null default now()
);
alter table public.prodotti_aperti_magazzino drop constraint if exists prodotti_aperti_magazzino_prodotto_id_corso_data_id_key;
alter table public.prodotti_aperti_magazzino add constraint prodotti_aperti_magazzino_prodotto_id_corso_data_id_key unique (prodotto_id, corso_data_id);
alter table public.prodotti_aperti_magazzino enable row level security;
drop policy if exists "prodotti_aperti_magazzino_all" on public.prodotti_aperti_magazzino;
create policy "prodotti_aperti_magazzino_all" on public.prodotti_aperti_magazzino for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
