-- Collegamento "stessa persona" tra un account nominale (utenti_app) e un
-- venditore, stesso meccanismo già esistente su master.venditore_id: chi
-- entra con questa password nominale e apre "Area venditori" atterra
-- direttamente sulla propria scheda venditore invece che sul selettore.
alter table utenti_app add column if not exists venditore_id uuid references venditori(id) on delete set null;
