-- VIA LA RIGA VUOTA CHE HA FERMATO GLI ORDINI DEL SITO, e il vincolo
-- diventa valido anche per quelle gia' scritte.
--
-- La riga e' nata l'1/11/2026 alle 10:01:33 UTC: origine 'woocommerce' e
-- nient'altro - nessun numero d'ordine, nessuna data, nessun cliente,
-- nessun importo. Non e' una vendita, e' un guscio. Ha azzerato il
-- cursore della sincronizzazione (in Postgres l'ordine decrescente mette
-- i NULL per primi), e per un giorno e mezzo ogni giro ha riletto tutto
-- lo storico fino a morire per WORKER_RESOURCE_LIMIT.
--
-- Verificato prima di cancellarla, il 2/11/2026: nessuna delle sette
-- tabelle con una chiave esterna verso vendite_shop la nomina
-- (pagamenti_pos, prelievi_kit_riserva, righe_preparate_spedizione,
-- scarichi_non_riusciti, spedizioni_pos, spedizioni_pos_non_riuscite,
-- vendite_shop.vendita_collegata_id: zero righe ognuna), e il suo id non
-- compare ne' in vendite_cestino ne' nei riferimenti dei movimenti di
-- magazzino.
--
-- PER RIMETTERLA COM'ERA (va prima tolto il vincolo, che da qui in avanti
-- la rifiuterebbe):
--   alter table public.vendite_shop drop constraint vendite_shop_woocommerce_vuole_numero_e_data;
--   insert into public.vendite_shop
--     (id, origine, prodotti, simulazione, ts_ricevuto, da_preparare, sconto_fiera,
--      tipo_movimento, fattura_manuale, richiede_fattura, prelevato_dai_kit, provvigione_pezzi)
--   values
--     ('1c17c4c9-179a-4406-873a-39132ca9f19c', 'woocommerce', '[]'::jsonb, false,
--      '2026-11-01T10:01:33.018539+00:00', false, false, 'vendita', false, false, false, 0);
-- (tutte le altre colonne erano nulle)

delete from public.vendite_shop where id = '1c17c4c9-179a-4406-873a-39132ca9f19c';

-- Il vincolo era NOT VALID apposta: valeva per le righe nuove e lasciava
-- stare quella che c'era gia'. Tolta quella, si convalida - cosi' Postgres
-- garantisce che in archivio non ce ne siano altre, non solo che non ne
-- nascano.
alter table public.vendite_shop validate constraint vendite_shop_woocommerce_vuole_numero_e_data;
