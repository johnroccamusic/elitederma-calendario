-- La percentuale di sicurezza dei punti, prodotto per prodotto (16/09/2026).
-- Finora era una sola per tutti (impostazione puntiMaster_schema, 10%).
-- Da Dettaglio prodotti si puo' scrivere una percentuale diversa accanto
-- a ogni prodotto: vuota = vale quella generale. La leggono tutti i conti
-- dei punti (puntiProdotto), cosi' dashboard, POS e Gestione punti dicono
-- la stessa cosa della tabella. Applicata via MCP il 16/09/2026.
alter table prodotti_shop add column if not exists sicurezza_punti_pct numeric;
