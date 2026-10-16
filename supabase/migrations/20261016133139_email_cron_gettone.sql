-- IL GETTONE DEL LAVORO NOTTURNO DELLE EMAIL.
-- APPLICATA il 16/10/2026 via MCP.
--
-- Perche' non la service role key. `email-programmate` confronta il
-- gettone che riceve con la propria SUPABASE_SERVICE_ROLE_KEY, carattere
-- per carattere. Quella del vault (`fic_service_key`) e' un JWT di prima
-- del passaggio alle chiavi nuove: provata davvero, la funzione ha
-- risposto 403. L'unico modo per rimetterla dentro sarebbe far passare
-- da qualche parte — una chat, un file — una credenziale che scavalca
-- ogni policy: anagrafiche, pagamenti, allegati degli allievi.
--
-- Qui invece il segreto NASCE nel database e non esce: lo genera
-- gen_random_bytes, lo legge solo il lavoro notturno per spedirlo, e lo
-- verifica solo la funzione qui sotto. Nessuno lo digita, nessuno lo
-- incolla, e se si vuole cambiare basta cancellare la riga del vault e
-- rieseguire questo blocco.
--
-- Le barriere restano due, non una: il cron manda ANCHE il JWT anon
-- nell'header Authorization, quindi il cancello di Supabase
-- (verify_jwt) continua a filtrare tutto quello che non ha una chiave
-- del progetto, e il gettone decide chi puo' far partire delle email.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'email_cron_token') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'email_cron_token',
      'gettone del lavoro notturno email-programmate: nato nel database, non esce di qui');
  end if;
end $$;

-- Il controllo. `security definer` perche' il vault non si legge da
-- fuori, e invoker=service_role non basterebbe comunque.
--
-- Si confrontano le impronte sha256 e non le stringhe: il confronto fra
-- testi si ferma al primo carattere diverso, e su un gettone lungo dà
-- una misura — piccola, ma gratuita da togliere.
create or replace function public.email_cron_ok(gettone text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  atteso text;
begin
  if gettone is null or length(gettone) < 32 then
    return false;
  end if;
  select decrypted_secret into atteso
    from vault.decrypted_secrets where name = 'email_cron_token' limit 1;
  if atteso is null or atteso = '' then
    return false;   -- senza gettone configurato non passa nessuno
  end if;
  return encode(sha256(convert_to(gettone, 'utf8')), 'hex')
       = encode(sha256(convert_to(atteso,  'utf8')), 'hex');
end;
$function$;

-- Lo chiama solo la funzione, col suo client di servizio. Chiunque abbia
-- la chiave pubblicabile (che sta nel bundle) non deve poterlo usare come
-- oracolo per indovinare il gettone.
revoke all on function public.email_cron_ok(text) from public;
revoke all on function public.email_cron_ok(text) from anon;
revoke all on function public.email_cron_ok(text) from authenticated;
grant execute on function public.email_cron_ok(text) to service_role;
