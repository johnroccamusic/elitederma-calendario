-- ---------------------------------------------------------
-- Le fatture ricevute si allineano da sole, mattina e primo pomeriggio.
--
-- La sincronizzazione con Fatture in Cloud era gia' automatica, ma solo a
-- meta': i cron "fic-sync-mattina" e "fic-sync-pomeriggio" chiamavano
-- l'edge function fic-sync, cioe' la pipeline dei documenti ricevuti che
-- riempie fic_documenti (note di credito). Le fatture d'acquisto del
-- Registro documenti fornitore passano da un'altra funzione,
-- fic-sync-documenti, che riempie fatture_ricevute_fic e
-- documento_fornitore — e quella non e' mai stata messa in nessun cron.
-- Era l'unico pezzo rimasto a mano: il tasto "Sincronizza da Fatture in
-- Cloud" andava premuto da qualcuno, e se nessuno lo premeva le fatture
-- semplicemente non entravano.
--
-- Da qui in avanti, alle 07:00 e alle 14:30 (ora di Roma), partono
-- entrambe. Tutti i giorni, senza che nessuno debba cliccare.
--
-- Le due funzioni sono idempotenti: fic-sync-documenti fa upsert su
-- fic_id e fic-sync lavora in modo incrementale, quindi rieseguirle non
-- duplica niente.
--
-- Il cron gira ogni mezz'ora e la funzione decide se e' il momento: pg_cron
-- ragiona in UTC, e i due job vecchi erano fissati alle 05:00 e 13:00 UTC —
-- d'estate 07:00 e 15:00 a Roma, d'inverno 06:00 e 14:00. Chiedendo a
-- Postgres che ore sono a Roma gli orari restano quelli anche quando
-- cambia l'ora legale. Stesso schema gia' usato da sincronizza_shop_orario.
--
-- Le credenziali si leggono dal vault, dove gia' stanno per fic_avvia_sync:
-- non si scrivono dentro il codice.
-- ---------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.sincronizza_fatture_orario()
returns void
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  ora_roma text := to_char(now() at time zone 'Europe/Rome', 'HH24:MI');
  indirizzo text;
  chiave text;
begin
  if ora_roma not in ('07:00', '14:30') then
    return;
  end if;

  select decrypted_secret into indirizzo from vault.decrypted_secrets where name = 'fic_project_url' limit 1;
  select decrypted_secret into chiave from vault.decrypted_secrets where name = 'fic_service_key' limit 1;
  if indirizzo is null or chiave is null then
    raise warning 'sincronizza_fatture_orario: credenziali non trovate nel vault, sincronizzazione saltata';
    return;
  end if;

  -- le fatture d'acquisto ricevute: Registro documenti fornitore
  perform net.http_post(
    url := indirizzo || '/functions/v1/fic-sync-documenti',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave),
    body := '{}'::jsonb,
    timeout_milliseconds := 600000
  );

  -- e i documenti ricevuti dell'altra pipeline: note di credito
  perform net.http_post(
    url := indirizzo || '/functions/v1/fic-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave),
    body := jsonb_build_object('modo', 'incrementale'),
    timeout_milliseconds := 600000
  );
end;
$$;

-- i due job vecchi sono sostituiti da questo, che copre anche fic-sync:
-- lasciarli acceso vorrebbe dire sincronizzare quattro volte invece di due
select cron.unschedule('fic-sync-mattina')
 where exists (select 1 from cron.job where jobname = 'fic-sync-mattina');
select cron.unschedule('fic-sync-pomeriggio')
 where exists (select 1 from cron.job where jobname = 'fic-sync-pomeriggio');

select cron.unschedule('sincronizza-fatture')
 where exists (select 1 from cron.job where jobname = 'sincronizza-fatture');
select cron.schedule('sincronizza-fatture', '0,30 * * * *', 'select public.sincronizza_fatture_orario()');

notify pgrst, 'reload schema';
