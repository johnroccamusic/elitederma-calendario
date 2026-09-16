-- Sfondi dell'app scelti da Impostazioni -> Aspetto dell'app (16/09/2026):
-- una foto per il computer (16:9) e una per il telefono (verticale),
-- caricate qui e ricordate fra le impostazioni condivise (chiave
-- "sfondo_app"). Bucket pubblico come gli altri dell'app; l'immagine si
-- adatta da sola a qualunque schermo (background-size: cover).
-- Applicata via MCP il 16/09/2026.
insert into storage.buckets (id, name, public) values ('sfondi-app', 'sfondi-app', true) on conflict (id) do nothing;
drop policy if exists "accesso interno sfondi-app" on storage.objects;
create policy "accesso interno sfondi-app" on storage.objects for all to anon, authenticated
  using (bucket_id = 'sfondi-app') with check (bucket_id = 'sfondi-app');
