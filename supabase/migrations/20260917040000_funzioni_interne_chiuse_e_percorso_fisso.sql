-- Due rifiniture emerse dal pannello Sicurezza (17/09/2026).
--
-- 1) slug_link e classe_da_link sono aiutanti interni, chiamati SOLO dalle
--    funzioni delle pagine pubbliche. Restavano pero' richiamabili da fuori
--    perche' Supabase concede l'esecuzione ad anon e authenticated su ogni
--    funzione nuova del catalogo public: il "revoke from public" non basta.
--    Chiuderle non rompe niente: modelle_vista e biglietti_vista girano con
--    i permessi del proprietario, quindi le chiamano lo stesso.
revoke execute on function public.slug_link(text) from anon, authenticated;
revoke execute on function public.classe_da_link(text, uuid) from anon, authenticated;

-- 2) Sette funzioni non avevano il percorso di ricerca fissato. Senza, chi
--    puo' creare oggetti nel database puo' far eseguire loro codice proprio
--    mettendo una tabella o una funzione con lo stesso nome in uno schema
--    che viene letto prima. Oggi, con le regole aperte a chiunque, non e'
--    un'ipotesi di scuola. Fissarlo non cambia cosa fanno.
alter function public.apri_confezione(uuid, integer) set search_path to 'public';
alter function public.fic_avvia_sync(text) set search_path to 'public';
alter function public.iscritti_date_pagamenti() set search_path to 'public';
alter function public.ponte_unificazione_stock() set search_path to 'public';
alter function public.protezione_prezzi_automatismi() set search_path to 'public';
alter function public.protezione_prezzo_lordo() set search_path to 'public';
alter function public.protezione_scadenza_prevista() set search_path to 'public';
