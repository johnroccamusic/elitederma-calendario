-- Intestazione della societa': il blocco di righe che va in cima ai
-- documenti (nome, le due righe dell'indirizzo, e due righe libere per
-- partita IVA / telefono / email). Una riga sola per tutta l'app, come
-- l'aliquota IVA di default: la chiave booleana con il check impedisce
-- che ne nasca una seconda.
create table if not exists intestazione_societa (
  id boolean primary key default true check (id),
  nome text,
  indirizzo text,
  indirizzo_2 text,
  riga_4 text,
  riga_5 text,
  -- percorso del file dentro il bucket "intestazione-societa": il logo
  -- che va accanto ai dati in cima ai documenti
  logo_path text
);
insert into intestazione_societa (id) values (true) on conflict (id) do nothing;
alter table intestazione_societa enable row level security;
drop policy if exists "accesso interno intestazione_societa" on intestazione_societa;
create policy "accesso interno intestazione_societa" on intestazione_societa for all to anon using (true) with check (true);

-- il logo della societa': un solo file, sostituito ogni volta che se ne
-- carica uno nuovo. Bucket pubblico come gli altri dell'app
insert into storage.buckets (id, name, public) values ('intestazione-societa', 'intestazione-societa', true) on conflict (id) do nothing;
drop policy if exists "accesso interno intestazione-societa" on storage.objects;
create policy "accesso interno intestazione-societa" on storage.objects for all to anon
  using (bucket_id = 'intestazione-societa') with check (bucket_id = 'intestazione-societa');

notify pgrst, 'reload schema';
