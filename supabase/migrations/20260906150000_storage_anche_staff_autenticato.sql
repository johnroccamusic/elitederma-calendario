-- Da quando l'app passa dal gate di Accesso.jsx, chi la usa entra con
-- Supabase Auth: il suo ruolo è `authenticated`, non `anon`. Tutte le
-- policy dello storage erano scritte `to anon`, e una policy `to anon` non
-- si applica a `authenticated` — sono due ruoli distinti, non uno incluso
-- nell'altro. Risultato: ogni caricamento veniva rifiutato, dalle immagini
-- dei prodotti agli allegati degli iscritti.
--
-- Qui si aggiunge `authenticated` accanto ad `anon`, non si toglie niente.
-- Non allarga nulla: `anon` è già il ruolo più permissivo dei due, e la
-- chiave pubblicabile sta nel bundle. Si restringerà il giorno in cui
-- `anon` verrà tolto — vedi la sezione 4 di CLAUDE.md.
do $$
declare
  p record;
begin
  for p in
    select policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and roles::text = '{anon}'
  loop
    execute format('alter policy %I on storage.objects to anon, authenticated', p.policyname);
  end loop;
end $$;
