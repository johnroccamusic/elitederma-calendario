-- 31/10/2026 — Controllo di sicurezza, campagne del CRM.
-- 1. Doppi invii: due chiamate di crm-campagna-invia insieme (doppio clic,
--    due schede) leggevano lo stesso lotto «in_coda» e spedivano le stesse
--    mail due volte. Ora il lotto si PRENDE in modo atomico (skip locked) e
--    le righe passano a «in_spedizione»; quelle rimaste li' piu' di 15 minuti
--    (funzione morta a meta') tornano in coda.
-- 2. Riattiva/Disiscrivi dallo staff agiscono su TUTTE le schede con la
--    stessa email, come crm_disiscrivi: prima Riattiva toglieva il blocco a
--    una scheda sola e l'indirizzo restava bloccato dalle altre.
create or replace function public.crm_campagna_prendi_lotto(p_campagna uuid, p_n integer)
returns setof public.crm_campagne_destinatari
language plpgsql security definer set search_path = public as $$
begin
  update crm_campagne_destinatari
     set stato = 'in_coda'
   where campagna_id = p_campagna and stato = 'in_spedizione'
     and ultimo_evento_il < now() - interval '15 minutes';

  return query
  with scelti as (
    select id from crm_campagne_destinatari
     where campagna_id = p_campagna and stato = 'in_coda'
     order by id limit greatest(1, least(coalesce(p_n, 100), 100))
     for update skip locked
  )
  update crm_campagne_destinatari d
     set stato = 'in_spedizione', ultimo_evento = 'preso in carico', ultimo_evento_il = now()
    from scelti where d.id = scelti.id
  returning d.*;
end $$;
revoke all on function public.crm_campagna_prendi_lotto(uuid, integer) from public, anon, authenticated;
grant execute on function public.crm_campagna_prendi_lotto(uuid, integer) to service_role;

create or replace function public.crm_disiscrizione_staff(p_id uuid, p_riattiva boolean)
returns integer
language plpgsql security definer set search_path = public as $$
declare c crm_contatti%rowtype; n integer;
begin
  if auth.role() is distinct from 'authenticated' then raise exception 'serve avere fatto accesso'; end if;
  select * into c from crm_contatti where id = p_id;
  if not found then return 0; end if;
  if p_riattiva then
    update crm_contatti set disiscritto_il = null, disiscritto_come = null, aggiornato_il = now()
     where id = c.id or (c.email is not null and lower(email) = lower(c.email));
  else
    update crm_contatti set disiscritto_il = coalesce(disiscritto_il, now()), disiscritto_come = coalesce(disiscritto_come, 'staff'), aggiornato_il = now()
     where id = c.id or (c.email is not null and lower(email) = lower(c.email));
  end if;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.crm_disiscrizione_staff(uuid, boolean) from public, anon;
grant execute on function public.crm_disiscrizione_staff(uuid, boolean) to authenticated;
