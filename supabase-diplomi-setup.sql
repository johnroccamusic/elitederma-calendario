-- =========================================================
-- ELITEDERMA CALENDARIO CORSI — Stampa diplomi
-- Incolla TUTTO questo file nell'SQL Editor di Supabase
-- e premi RUN. Da eseguire UNA SOLA VOLTA.
-- =========================================================

-- ogni corso ha il proprio template PDF del diploma
alter table public.corsi add column if not exists diploma_template_path text;

-- impostazioni GLOBALI di stampa diplomi: i 3 font, il diploma di
-- riferimento usato solo per calibrare visivamente la posizione, e la
-- posizione/dimensione/colore/allineamento di nome, città+data e firma —
-- uguali per tutti i corsi, non un'impostazione per singolo corso
create table if not exists public.font_diplomi (
  id uuid primary key default gen_random_uuid(),
  font_allievo_path text,
  font_data_path text,
  font_firma_path text,
  diploma_riferimento_path text,
  nome_pos_x numeric not null default 50,
  nome_pos_y numeric not null default 50,
  nome_font_size int not null default 24,
  nome_colore text not null default '#000000',
  nome_allineamento text not null default 'center',
  data_pos_x numeric not null default 50,
  data_pos_y numeric not null default 65,
  data_font_size int not null default 16,
  data_colore text not null default '#000000',
  data_allineamento text not null default 'center',
  firma_pos_x numeric not null default 50,
  firma_pos_y numeric not null default 80,
  firma_font_size int not null default 16,
  firma_colore text not null default '#000000',
  firma_allineamento text not null default 'center',
  ts timestamptz not null default now()
);

alter table public.font_diplomi enable row level security;
drop policy if exists "accesso interno font_diplomi" on public.font_diplomi;
create policy "accesso interno font_diplomi" on public.font_diplomi for all to anon using (true) with check (true);

-- bucket per i template diploma di ciascun corso + il diploma di riferimento
insert into storage.buckets (id, name, public)
values ('diploma-templates', 'diploma-templates', true)
on conflict (id) do nothing;

-- bucket per i 3 font globali usati nella stampa
insert into storage.buckets (id, name, public)
values ('diploma-fonts', 'diploma-fonts', true)
on conflict (id) do nothing;

drop policy if exists "accesso interno diploma-templates" on storage.objects;
create policy "accesso interno diploma-templates" on storage.objects for all to anon
  using (bucket_id = 'diploma-templates') with check (bucket_id = 'diploma-templates');

drop policy if exists "accesso interno diploma-fonts" on storage.objects;
create policy "accesso interno diploma-fonts" on storage.objects for all to anon
  using (bucket_id = 'diploma-fonts') with check (bucket_id = 'diploma-fonts');

notify pgrst, 'reload schema';
