-- GLI ALLEGATI DI UN PROGETTO (26/10/2026). Chiesto dal titolare: in
-- Progetti in corso, su ogni progetto, uno o piu' file. Stessa forma dei
-- documenti organizzativi degli eventi: una riga per file, il file nel
-- secchio PRIVATO progetti-allegati, letto con createSignedUrl.
create table if not exists progetti_allegati (
  id uuid primary key default gen_random_uuid(),
  progetto_id uuid not null references progetti(id) on delete cascade,
  nome text not null,
  percorso text not null,
  tipo text,
  dimensione bigint,
  caricato_il timestamptz not null default now(),
  caricato_da text
);
create index if not exists progetti_allegati_progetto on progetti_allegati (progetto_id, caricato_il);
alter table progetti_allegati enable row level security;
drop policy if exists progetti_allegati_staff on progetti_allegati;
create policy progetti_allegati_staff on progetti_allegati for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('progetti-allegati', 'progetti-allegati', false) on conflict (id) do nothing;
drop policy if exists progetti_allegati_carica on storage.objects;
create policy progetti_allegati_carica on storage.objects for insert to authenticated with check (bucket_id = 'progetti-allegati');
drop policy if exists progetti_allegati_leggi on storage.objects;
create policy progetti_allegati_leggi on storage.objects for select to authenticated using (bucket_id = 'progetti-allegati');
drop policy if exists progetti_allegati_cancella on storage.objects;
create policy progetti_allegati_cancella on storage.objects for delete to authenticated using (bucket_id = 'progetti-allegati');
