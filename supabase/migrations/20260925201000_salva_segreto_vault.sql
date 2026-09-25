-- Scrivere (o riscrivere) un segreto nel Vault dal server.
-- Stessa cautela di segreto_vault: la puo' chiamare solo il
-- service_role, mai il browser.
create or replace function public.salva_segreto_vault(nome text, valore text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  esistente uuid;
begin
  select id into esistente from vault.secrets where name = nome limit 1;
  if esistente is null then
    perform vault.create_secret(valore, nome, 'scritto dal server');
  else
    perform vault.update_secret(esistente, valore, nome, 'riscritto dal server');
  end if;
end;
$$;

revoke all on function public.salva_segreto_vault(text, text) from public;
revoke all on function public.salva_segreto_vault(text, text) from anon;
revoke all on function public.salva_segreto_vault(text, text) from authenticated;
grant execute on function public.salva_segreto_vault(text, text) to service_role;
