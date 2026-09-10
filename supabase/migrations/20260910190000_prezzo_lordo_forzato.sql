-- Il prezzo al pubblico deciso a mano.
--
-- C'era una regola automatica che portava al decimo i lordi che cadevano a
-- un centesimo: 32,70 + 22% fa 39,894, arrotondato 39,89, e a scaffale un
-- prezzo che finisce per nove centesimi si legge come un errore di conto.
-- La regola faceva la cosa giusta sui pigmenti e la cosa sbagliata su
-- tutto il resto — un centesimo aggiunto da solo a un prodotto che non lo
-- chiedeva e' un prezzo che nessuno ha deciso.
--
-- Meglio una casella: se e' valorizzata, quel numero e' il prezzo al
-- pubblico ovunque (elenchi, POS, sito) e l'IVA diventa la differenza
-- rispetto al netto. Vuota, si torna a netto piu' IVA.
alter table public.prodotti_shop
  add column if not exists prezzo_lordo_forzato numeric;

comment on column public.prodotti_shop.prezzo_lordo_forzato is
  'Prezzo al pubblico deciso a mano: se valorizzato vince sul calcolo netto+IVA, e l''IVA diventa la differenza. Vuoto = prezzo calcolato.';
