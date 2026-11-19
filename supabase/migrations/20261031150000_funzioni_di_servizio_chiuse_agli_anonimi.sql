-- 31/10/2026 — Controllo di sicurezza: funzioni di servizio chiamabili con la
-- sola chiave pubblicabile. Lette le definizioni sul database vivo:
--  * recupera_vendite_qr_in_ritardo e riprova_vendite_pos_in_attesa
--    REGISTRANO vendite (security definer), controlla_saldi_magazzino scrive
--    saldi e scostamenti, fic_avvia_sync e sincronizza_* chiamano le edge
--    function con la chiave di servizio presa dal vault.
--  Le chiama solo pg_cron (come postgres): nessuna pagina dell'app le usa.
revoke execute on function public.recupera_vendite_qr_in_ritardo() from public, anon, authenticated;
revoke execute on function public.riprova_vendite_pos_in_attesa() from public, anon, authenticated;
revoke execute on function public.controlla_saldi_magazzino() from public, anon, authenticated;
revoke execute on function public.fic_avvia_sync(text) from public, anon, authenticated;
revoke execute on function public.sincronizza_banca_giornaliera() from public, anon, authenticated;
revoke execute on function public.sincronizza_fatture_orario() from public, anon, authenticated;
revoke execute on function public.sincronizza_shop_orario() from public, anon, authenticated;
-- Usate dall'app ma solo da chi ha fatto accesso: via ad anon, restano ad authenticated.
revoke execute on function public.registra_vendita_pos(jsonb, jsonb) from public, anon;
revoke execute on function public.registra_vendita_da_pagamento(text, boolean) from public, anon;
revoke execute on function public.apri_confezione(uuid, integer) from public, anon;
revoke execute on function public.aggiorna_quote_coordinatore(numeric) from public, anon;
revoke execute on function public.identita_da_accesso() from public, anon;
