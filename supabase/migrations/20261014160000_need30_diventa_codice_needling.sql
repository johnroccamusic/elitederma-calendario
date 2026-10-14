-- need30 DIVENTA UN CODICE DI NEEDLING COME GLI ALTRI.
--
-- Com'era: ambito "categorie" (la sola categoria Needling di
-- WooCommerce), regola "semplice", 30% letto sul NETTO. Nel POS la
-- restrizione di categoria non veniva guardata, quindi quel 30% sul netto
-- — il 24,59% sul prezzo esposto — finiva su tutto il carrello: un
-- dermografo Horus da 491,80 € scontato di 120 €.
--
-- Com'e' ora. La regola che serve esiste gia' ed e' quella dei codici
-- d'aula di needling: le fasce per margine su tutto il catalogo, piu'
-- l'ECCEZIONE del reparto Needling, dove comanda lo scaglione di spesa
-- (30% sul netto). Le due non si sommano mai.
--
-- Sullo stesso carrello di prima: dermografo 10%, Medical soap 7%,
-- Emulsione Levigante 24,59% — 55,48 € invece di 128,39 €.
--
-- `valore` e `valore_woo` diventano 7,46 come sugli altri codici
-- needling: e' il ripiego che il sito applica se il frammento delle fasce
-- fosse disattivato. Prima era 30: con il frammento spento avrebbe fatto
-- il 30% a tutto il catalogo.
--
-- `categorie_ids` si svuota: la categoria non serve piu' a restringere il
-- codice, serve all'eccezione del reparto, che la legge dall'anagrafica
-- nostra e non dal coupon.
--
-- ATTENZIONE: il coupon vive anche su WooCommerce (woo_coupon_id 10445).
-- Dopo questa migrazione va riallineato dal pannello — "Applica ai codici
-- needling esistenti" in Gestione punti — o sul sito continuera' a fare
-- quello di prima.
update coupon set
  ambito = 'tutto',
  categorie_ids = '{}',
  tipo_regola_sconto = 'fasce',
  serie_regole = 'needling',
  base_sconto = 'lordo',
  valore = 7.46,
  valore_woo = 7.46
where codice = 'need30';
