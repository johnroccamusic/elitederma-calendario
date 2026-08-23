-- ---------------------------------------------------------------------------
-- Passaggio delle policy RLS dal ruolo "anon" al ruolo "authenticated".
--
-- PERCHÉ
-- Oggi ogni tabella ha una policy "for all to anon using (true) with check
-- (true)": RLS è abilitata ma non filtra nulla, e la chiave anon (che vive nel
-- bundle JavaScript pubblico) può leggere e scrivere qualunque riga.
-- Dopo questa migrazione le stesse identiche policy valgono solo per le
-- sessioni autenticate con Supabase Auth: la chiave anon da sola non basta più.
--
-- COSA NON CAMBIA
-- La logica delle policy resta "using (true) with check (true)". Nessuna query
-- dell'app va riscritta: cambia soltanto CHI può eseguirla. I permessi per
-- ruolo (venditore vede solo i suoi dati, ecc.) sono un passo successivo.
--
-- PREREQUISITO OBBLIGATORIO
-- Prima di applicare questa migrazione il client deve autenticarsi con
-- Supabase Auth (vedi src/Accesso.jsx). Applicandola senza il gate di login,
-- l'app smette di leggere i dati.
--
-- REVERSIBILE
-- Vedi 20260815120001_rollback_rls_anon.sql per tornare indietro.
-- ---------------------------------------------------------------------------

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
      and 'anon' = any(roles)
    order by schemaname, tablename, policyname
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);

    ddl := format(
      'create policy %I on %I.%I as %s for %s to authenticated',
      p.policyname, p.schemaname, p.tablename,
      case when p.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      lower(p.cmd)
    );

    if p.qual       is not null then ddl := ddl || format(' using (%s)', p.qual); end if;
    if p.with_check is not null then ddl := ddl || format(' with check (%s)', p.with_check); end if;

    execute ddl;
    n := n + 1;
    raise notice 'aggiornata  %.%  ->  %', p.schemaname, p.tablename, p.policyname;
  end loop;

  raise notice '--- policy spostate su authenticated: % ---', n;
end $$;

-- Verifica: entrambe le colonne devono essere a 0.
-- select
--   count(*) filter (where 'anon' = any(roles))   as ancora_su_anon,
--   count(*) filter (where roles = '{public}')    as aperte_a_tutti
-- from pg_policies where schemaname in ('public','storage');
