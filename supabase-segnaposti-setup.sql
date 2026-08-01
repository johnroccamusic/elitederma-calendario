-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Stampa Segnaposto
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Da eseguire UNA SOLA VOLTA (e' comunque scritto per essere sicuro
-- da rieseguire).
-- =========================================================

-- impostazioni GLOBALI di stampa segnaposti: il font, il vero foglio A4
-- di stampa (non solo un riferimento), la dimensione/colore del testo
-- (uguali per tutti i posti) e la posizione di ciascuno dei 7 posti
-- della griglia. Riusa i bucket "diploma-templates"/"diploma-fonts"
-- gia' esistenti, non ne servono di nuovi.
create table if not exists public.segnaposti_config (
  id uuid primary key default gen_random_uuid(),
  font_path text,
  riferimento_path text,
  font_size int not null default 20,
  colore text not null default '#000000',
  slot1_pos_x numeric not null default 50, slot1_pos_y numeric not null default 12.5,
  slot2_pos_x numeric not null default 50, slot2_pos_y numeric not null default 25,
  slot3_pos_x numeric not null default 50, slot3_pos_y numeric not null default 37.5,
  slot4_pos_x numeric not null default 50, slot4_pos_y numeric not null default 50,
  slot5_pos_x numeric not null default 50, slot5_pos_y numeric not null default 62.5,
  slot6_pos_x numeric not null default 50, slot6_pos_y numeric not null default 75,
  slot7_pos_x numeric not null default 50, slot7_pos_y numeric not null default 87.5,
  ts timestamptz not null default now()
);
alter table public.segnaposti_config enable row level security;
drop policy if exists "accesso interno segnaposti_config" on public.segnaposti_config;
create policy "accesso interno segnaposti_config" on public.segnaposti_config for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
