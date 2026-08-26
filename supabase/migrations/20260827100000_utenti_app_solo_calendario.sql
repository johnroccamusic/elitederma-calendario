-- Profilo "kiosk": un account nominale con questo flag entra dritto su
-- Gestione corsi (mai in Home), vede solo il calendario in sola lettura
-- (niente Aggiungi corso/Ultime iscrizioni/Verifica pagamenti, niente
-- apertura di un corso), e non ha i tasti Home/Indietro/Avanti nella
-- barra di navigazione — può solo usare i filtri del calendario.
alter table utenti_app add column if not exists solo_calendario boolean not null default false;
