-- La scheda nasce dal titolo, il file arriva dopo (22/10/2026). Come le
-- schede di Stampe packaging: si preme «Aggiungi documento», si scrive
-- cos'e', e dentro si carica il file e si scrivono le note. Quindi una
-- riga puo' esistere senza file.
alter table eventi_documenti alter column percorso drop not null;
