-- APPLICATA il 16/10/2026 via MCP. Sostituisce la prima metà di
-- 20261015231000_email_regole_policy_e_cron.sql, che aspettava di essere
-- eseguita a mano.

-- 1. LA POLICY. Come email_modelli e email_inviate: solo chi ha fatto
--    accesso. Qui si decide cosa parte da solo a nome di Elitederma.
drop policy if exists "staff autenticato email_regole" on public.email_regole;
create policy "staff autenticato email_regole"
  on public.email_regole for all to authenticated
  using (true) with check (true);

-- 2. UN TENTATIVO CHE NON E' ANDATO, e vale la pena ricordarlo.
--    La service role key di questo progetto e' nel vault da quando e'
--    nata la sincronizzazione con Fatture in Cloud (`fic_service_key`:
--    un JWT con role "service_role"). L'idea era copiarla sotto un nome
--    proprio e darla al lavoro notturno, senza farla passare da nessuna
--    chat.
--
--    Non funziona: `email-programmate` confronta il gettone ricevuto con
--    la propria SUPABASE_SERVICE_ROLE_KEY carattere per carattere, e
--    quel JWT e' di prima del passaggio alle chiavi nuove. Provato
--    davvero con net.http_post: 403, "Non autorizzato".
--
--    La copia creata qui e' stata quindi cancellata subito: non si
--    lascia in giro un duplicato di una chiave che scavalca ogni policy
--    se non ha un mestiere. La strada buona e' il gettone della
--    migrazione 20261016133139.
--
--    (Il blocco originale, lasciato come traccia:)
--    do $$ declare chiave text; begin
--      select decrypted_secret into chiave from vault.decrypted_secrets
--        where name = 'fic_service_key' limit 1;
--      perform vault.create_secret(chiave, 'email_cron_service_key', '…');
--    end $$;
--    delete from vault.secrets where name = 'email_cron_service_key';
