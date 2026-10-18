-- IL ROLLBACK, scritto insieme alla chiusura e non dopo.
--
-- Il 15/08/2026 la chiusura fu annullata in giornata perche' spense
-- l'app a tutti: quella volta il rollback fu scritto di corsa. Questo
-- sta qui dal primo minuto e rimette le policy ESATTAMENTE com'erano
-- stasera, perche' le rilegge dalla fotografia invece di ricostruirle a
-- memoria.
--
-- NON si applica adesso. Si applica solo se qualcosa si spegne.
--
-- Attenzione: riapre il database alla chiave pubblicabile, cioe' a
-- chiunque. Da usare per tornare a lavorare, non per restarci.
do $$
declare p record; comando text; ruoli text;
begin
  for p in
    select tablename, policyname, cmd, usando, con_controllo, roles
    from public._policy_snapshot_20261018
    where schemaname = 'public' and 'anon' = any(roles)
  loop
    comando := case p.cmd
      when 'ALL' then 'all' when 'SELECT' then 'select' when 'INSERT' then 'insert'
      when 'UPDATE' then 'update' when 'DELETE' then 'delete' else lower(p.cmd) end;
    ruoli := array_to_string(p.roles, ', ');
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for %s to %s%s%s',
      p.policyname, p.tablename, comando, ruoli,
      case when p.usando is not null then ' using (' || p.usando || ')' else '' end,
      case when p.con_controllo is not null then ' with check (' || p.con_controllo || ')' else '' end);
  end loop;
end $$;
