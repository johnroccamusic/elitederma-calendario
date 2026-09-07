-- Il tasto "Progetti in corso" restava "Non attivo" per tutti: il permesso
-- e' nuovo, e le righe utente una volta salvate tengono la lista scritta
-- nel database — non riprendono piu' i valori di default, dove il tasto
-- nuovo invece c'era.
--
-- Si concede a chi ha gia' il quadro completo dell'app (sedici permessi o
-- piu'): Programmatore, Amministratore, Elena e Stefano. Agli altri lo si
-- da' a mano da Password menu' -> Gestione utenti, dove ora c'e' la sua
-- colonna.
update public.utenti_app
set permessi = permessi || '["progettiincorso"]'::jsonb
where permessi::text not like '%progettiincorso%'
  and jsonb_array_length(permessi) >= 16;
