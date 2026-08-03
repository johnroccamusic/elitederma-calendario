-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Setting loghi" + "Generazione loghi"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- tabella singleton: i 2 font condivisi usati per scrivere nome e codice
-- sui loghi, e il contatore progressivo globale (unico per tutti i loghi,
-- indipendente da master/corso/tipo)
create table if not exists public.loghi_impostazioni (
  id uuid primary key default gen_random_uuid(),
  font_nome_path text,
  font_numero_path text,
  prossimo_numero integer not null default 1,
  ts timestamptz not null default now()
);
alter table public.loghi_impostazioni enable row level security;
drop policy if exists "accesso interno loghi_impostazioni" on public.loghi_impostazioni;
create policy "accesso interno loghi_impostazioni" on public.loghi_impostazioni for all to anon using (true) with check (true);

-- 10 righe fisse: 4 corsi x (Artist/Expert) + Master Assistant + Master.
-- ognuna con il proprio logo nero/bianco e la posizione (in %) di nome e
-- codice progressivo calibrata sopra quel logo
create table if not exists public.loghi_categorie (
  chiave text primary key,
  etichetta text not null,
  richiede_bianco boolean not null default true,
  logo_nero_path text,
  logo_bianco_path text,
  nome_pos_x numeric not null default 50,
  nome_pos_y numeric not null default 40,
  nome_font_size integer not null default 60,
  nome_colore text not null default '#ffffff',
  numero_pos_x numeric not null default 50,
  numero_pos_y numeric not null default 60,
  numero_font_size integer not null default 36,
  numero_colore text not null default '#ffffff'
);
alter table public.loghi_categorie enable row level security;
drop policy if exists "accesso interno loghi_categorie" on public.loghi_categorie;
create policy "accesso interno loghi_categorie" on public.loghi_categorie for all to anon using (true) with check (true);

insert into public.loghi_categorie (chiave, etichetta, richiede_bianco) values
  ('microblading_artist', 'Microblading — Artist', true),
  ('microblading_expert', 'Microblading — Expert', true),
  ('pmu_artist', 'PMU — Artist', true),
  ('pmu_expert', 'PMU — Expert', true),
  ('laminazione_artist', 'Laminazione — Artist', true),
  ('laminazione_expert', 'Laminazione — Expert', true),
  ('extension_artist', 'Extension — Artist', true),
  ('extension_expert', 'Extension — Expert', true),
  ('master_assistant', 'Master Assistant', true),
  ('master', 'Master', false)
on conflict (chiave) do nothing;

insert into storage.buckets (id, name, public)
values ('loghi-immagini', 'loghi-immagini', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('loghi-fonts', 'loghi-fonts', true)
on conflict (id) do nothing;

drop policy if exists "accesso interno loghi-immagini" on storage.objects;
create policy "accesso interno loghi-immagini" on storage.objects for all to anon
  using (bucket_id = 'loghi-immagini') with check (bucket_id = 'loghi-immagini');

drop policy if exists "accesso interno loghi-fonts" on storage.objects;
create policy "accesso interno loghi-fonts" on storage.objects for all to anon
  using (bucket_id = 'loghi-fonts') with check (bucket_id = 'loghi-fonts');

notify pgrst, 'reload schema';
