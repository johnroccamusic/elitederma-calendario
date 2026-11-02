-- Il 1/11/2026 e' comparsa una riga vuota con origine 'woocommerce' e senza numero ordine ne' data:
-- ha azzerato il cursore della sincronizzazione ordini (vedi woo-import-storico). Da ora il database
-- rifiuta righe woocommerce senza woo_order_id e senza data. NOT VALID: vale per le righe nuove,
-- quella vuota gia' presente non viene toccata (va tolta con conferma esplicita).
alter table public.vendite_shop
  add constraint vendite_shop_woocommerce_vuole_numero_e_data
  check (origine <> 'woocommerce' or (woo_order_id is not null and data_ordine is not null)) not valid;
