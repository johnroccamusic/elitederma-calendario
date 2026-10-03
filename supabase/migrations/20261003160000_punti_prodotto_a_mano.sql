-- I punti di un prodotto, scritti a mano.
--
-- Erano calcolati (prezzo netto per lo sconto massimo per due). La
-- formula va bene in media ma non su ogni riga: ci sono prodotti che si
-- vogliono spingere e prodotti su cui i punti non si vogliono dare, e
-- nessuna formula lo sa. Da qui in avanti il numero lo decide chi guarda
-- il listino, e la casella e' vuota finche' qualcuno non ci scrive.
--
-- Niente default e nessun calcolo di scorta: un punto scritto e' una
-- scelta, una casella vuota e' una scelta non ancora fatta. Mostrare un
-- numero calcolato dove non c'e' una decisione e' il modo piu' rapido per
-- non accorgersi che manca.
alter table prodotti_shop
  add column if not exists punti_prodotto numeric;

comment on column prodotti_shop.punti_prodotto is
  'Punti del prodotto, scritti a mano dal listino privato. Nessun calcolo automatico: vuota = non ancora decisa.';

-- la view la espone cosi' com'e', senza toccarla: punti_prodotto in fondo,
-- dove create or replace permette di aggiungere colonne
-- (il corpo completo e' quello della migrazione 20261003120000, con in piu'
--  la sottoquery punti_scritti nel CTE `amano` e la colonna in coda)
