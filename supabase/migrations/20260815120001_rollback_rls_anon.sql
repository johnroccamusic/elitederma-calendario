-- ---------------------------------------------------------------------------
-- ROLLBACK di 20260815120000: riporta le policy da "authenticated" ad "anon".
-- Da eseguire SOLO se qualcosa non funziona e serve rimettere l'app operativa
-- in fretta. Non è un file da applicare in condizioni normali.
-- ---------------------------------------------------------------------------

do $$
declare
  p   record;
  ddl text;
begin
  for p in
    select schemaname, tablename, policyname, permissive, cmd, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and 'authenticated' = any(roles)
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);

    ddl := format(
      'create policy %I on %I.%I as %s for %s to anon',
      p.policyname, p.schemaname, p.tablename,
      case when p.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      lower(p.cmd)
    );
    if p.qual       is not null then ddl := ddl || format(' using (%s)', p.qual); end if;
    if p.with_check is not null then ddl := ddl || format(' with check (%s)', p.with_check); end if;

    execute ddl;
  end loop;
end $$;
