-- Leggere un segreto dal Vault da dentro una edge function.
--
-- Serve perche' il segreto di firma del webhook di Stripe lo crea
-- Stripe stesso quando si registra l'endpoint: non passa dalle mani di
-- nessuno e non va incollato a mano da nessuna parte. Il posto giusto
-- dove appoggiarlo e' il Vault, non una tabella di public — con le
-- policy attuali una tabella di public la legge chiunque abbia la
-- chiave pubblicabile, e quella sta dentro il bundle.
--
-- L'esecuzione e' revocata a tutti tranne al service_role: la usano
-- solo le funzioni che girano sul server, mai il browser.
create or replace function public.segreto_vault(nome text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = nome limit 1
$$;

revoke all on function public.segreto_vault(text) from public;
revoke all on function public.segreto_vault(text) from anon;
revoke all on function public.segreto_vault(text) from authenticated;
grant execute on function public.segreto_vault(text) to service_role;
