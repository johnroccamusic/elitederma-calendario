-- URGENTE, 17/09/2026: acceso il cancello, chi faceva login restava fuori.
--
-- Il perche'. In Postgres una regola scritta "to anon" vale SOLO per il
-- ruolo anon. Appena una persona entra con email e password diventa
-- "authenticated", e quelle regole smettono di riguardarla: il database le
-- risponde "non esiste niente". Su 139 regole, 84 erano scritte cosi'.
--
-- Effetto pratico: dopo il login l'app non riusciva piu' a leggere nemmeno
-- password_menu, quindi il cancello interno rifiutava ogni codice, anche
-- quello giusto. Non era la password sbagliata: era il database che non
-- rispondeva piu'.
--
-- Qui si aggiunge "authenticated" accanto ad "anon" su tutte e 84. Non si
-- apre niente di nuovo: chi ha fatto accesso poteva gia' fare tutto come
-- anonimo. E' anche il passo che mancava prima di poter togliere "anon",
-- che e' la chiusura vera.
do $$
declare
  p   record;
  ddl text;
  n   int := 0;
begin
  for p in
    select schemaname, tablename, policyname, permissive, cmd, qual, with_check
      from pg_policies
     where schemaname in ('public', 'storage')
       and roles = '{anon}'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);

    ddl := format(
      'create policy %I on %I.%I as %s for %s to anon, authenticated',
      p.policyname, p.schemaname, p.tablename,
      case when p.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      lower(p.cmd)
    );
    if p.qual       is not null then ddl := ddl || format(' using (%s)', p.qual); end if;
    if p.with_check is not null then ddl := ddl || format(' with check (%s)', p.with_check); end if;

    execute ddl;
    n := n + 1;
  end loop;
  raise notice 'regole allargate a chi ha fatto accesso: %', n;
end $$;
