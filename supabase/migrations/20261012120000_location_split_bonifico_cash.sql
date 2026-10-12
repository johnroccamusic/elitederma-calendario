-- La sala poteva solo essere "tutta a bonifico" o "tutta in contanti":
-- il modo lo decideva pagamento_sede e l'importo seguiva la tariffa.
-- Non c'era posto dove scrivere "200 a bonifico e 100 in contanti",
-- cosa che per il Compenso Master si fa da sempre.
--
-- Due colonne, come quelle che gia' esistono per master
-- (quota_bonifico/quota_cash) e venditore. Restano NULL finche' nessuno
-- divide la spesa a mano: in quel caso comanda pagamento_sede, come
-- prima. Nessuna riga cambia di valore applicando questa migrazione.
--
-- Applicata il 12/10/2026.
alter table corsi_date add column if not exists location_bonifico numeric;
alter table corsi_date add column if not exists location_cash numeric;
