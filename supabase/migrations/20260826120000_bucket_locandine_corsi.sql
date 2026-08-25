-- Bucket per le locandine con i prezzi dei corsi (tasto Home "Prezzi
-- corsi", vedi PaginaPrezziCorsi in App.jsx): stesso identico pattern già
-- in uso per gli altri bucket immagini (es. loghi-immagini, master-foto).
-- Nessuna tabella di appoggio: la griglia legge direttamente l'elenco dei
-- file del bucket, il titolo sotto ogni locandina viene dal nome del file.
insert into storage.buckets (id, name, public) values ('locandine-corsi', 'locandine-corsi', true) on conflict (id) do nothing;
drop policy if exists "accesso interno locandine-corsi" on storage.objects;
create policy "accesso interno locandine-corsi" on storage.objects for all to anon
  using (bucket_id = 'locandine-corsi') with check (bucket_id = 'locandine-corsi');
