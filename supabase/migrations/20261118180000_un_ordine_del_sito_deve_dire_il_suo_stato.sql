-- UN ORDINE DEL SITO DEVE DIRE IL SUO STATO. 18/11/2026.
--
-- NON ANCORA APPLICATA: modifica di schema su produzione, va approvata.
--
-- Da oggi `venditaIncassata` conta un ordine WooCommerce solo se e'
-- `completed` o `processing`: e' la correzione dei 717.712,18 € mai
-- entrati che venivano contati come fatturato. Il rovescio della
-- medaglia e' che una riga senza stato, o con uno stato che non
-- conosciamo, sparirebbe dai conti IN SILENZIO — lo stesso guasto
-- all'incontrario, e altrettanto invisibile. Senza questo vincolo la
-- regola vive solo nel codice che legge, e un giorno un'importazione
-- scrivera' una riga muta.
--
-- Oggi non capita: tutte e 4.292 le righe del sito portano uno dei sette
-- stati di WooCommerce, nessuna e' vuota e nessuna ne ha uno
-- sconosciuto (misurato il 18/11/2026 prima di scrivere il vincolo).
-- Quindi si puo' pretendere, e si convalida subito senza riscrivere
-- niente. `checkout-draft` e `trash` non sono in archivio ma esistono in
-- WooCommerce: stanno nell'elenco perche' il vincolo serve a fermare il
-- VUOTO, non a litigare con il sito.
--
-- Al banco non vale: li' si registra solo quello che si e' incassato, e
-- una vendita del POS senza stato continua a contare (stessa regola in
-- `venditaIncassata`, src/App.jsx).
--
-- ROLLBACK:
--   alter table vendite_shop drop constraint vendite_shop_woocommerce_vuole_uno_stato;
alter table vendite_shop
  add constraint vendite_shop_woocommerce_vuole_uno_stato
  check (
    origine <> 'woocommerce'
    or stato in ('completed','processing','on-hold','pending','cancelled','refunded','failed','checkout-draft','trash')
  ) not valid;

alter table vendite_shop validate constraint vendite_shop_woocommerce_vuole_uno_stato;
