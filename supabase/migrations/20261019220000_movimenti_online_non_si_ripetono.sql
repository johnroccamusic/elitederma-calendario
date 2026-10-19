-- UN MOVIMENTO DA ORDINE ONLINE NON SI APPLICA DUE VOLTE.
--
-- WooCommerce rimanda i webhook: stesso ordine, stesso stato, due o tre
-- volte. A fermare il doppio scarico, finora, era il confronto fra lo
-- stato di prima e quello di adesso dentro `woo-webhook`. E' una
-- protezione vera, ma vive dentro un `if`: basta toccare quella riga e
-- sparisce senza che nessuno se ne accorga, e il modo in cui lo si
-- scopre e' una giacenza sbagliata settimane dopo.
--
-- Adesso ogni movimento da ordine online porta un riferimento
-- (`woo:<ordine>:<scarico|ripristino>:<prodotto>`) e il vincolo lo fa
-- rispettare il database, che non si distrae. La direzione sta DENTRO il
-- riferimento: lo stesso ordine scarica quando diventa vivo e ripristina
-- quando viene annullato, e sono due fatti diversi.
--
-- PERCHE' SOLO `ordine_online`. Perche' e' l'unico che arriva da fuori e
-- si puo' ripetere da solo. I movimenti di `kit_corso` hanno gia' 137
-- coppie ripetute su 1018, e sono legittime: lo stesso prodotto puo'
-- uscire due volte per lo stesso corso. Un vincolo generale non sarebbe
-- entrato, e forzarlo avrebbe voluto dire cancellare storia vera.
--
-- I 392 movimenti online gia' in archivio non hanno riferimento e
-- restano come sono: NULL non si scontra con niente, quindi il vincolo
-- nasce senza dover riscrivere il passato.
create unique index if not exists movimenti_online_una_volta_sola_idx
  on public.movimenti_magazzino (prodotto_id, riferimento)
  where origine = 'ordine_online' and riferimento is not null;
