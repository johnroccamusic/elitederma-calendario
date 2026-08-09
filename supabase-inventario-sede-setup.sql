-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Inventario di sede (dichiarato dalla master)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Cosa è già presente in una sede (prodotti da magazzino o attrezzature),
-- come dichiarato dalla master l'ultima volta che c'è stata: una riga per
-- ogni (location, tipo, riferimento) — "riferimento" è l'id del prodotto
-- (prodotti_shop) se tipo='prodotto', oppure la chiave della sottocategoria
-- di costo (costi_sottocategorie, gruppo "attrezzature_corsi") se
-- tipo='attrezzatura'. Ridichiarare sovrascrive la riga precedente (upsert
-- su location_id+tipo+riferimento), così resta sempre solo l'ultimo valore.
create table if not exists public.inventario_sede (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location(id) on delete cascade,
  tipo text not null,
  riferimento text not null,
  quantita integer not null default 0,
  corso_data_id uuid references public.corsi_date(id) on delete set null,
  master_id uuid references public.master(id) on delete set null,
  ts timestamptz not null default now()
);
alter table public.inventario_sede drop constraint if exists inventario_sede_location_id_tipo_riferimento_key;
alter table public.inventario_sede add constraint inventario_sede_location_id_tipo_riferimento_key unique (location_id, tipo, riferimento);
alter table public.inventario_sede enable row level security;
drop policy if exists "inventario_sede_all" on public.inventario_sede;
create policy "inventario_sede_all" on public.inventario_sede for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
