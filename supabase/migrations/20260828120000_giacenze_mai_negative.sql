-- ---------------------------------------------------------
-- Il magazzino fisico non può andare sotto zero, mai.
--
-- Fino ad oggi la regola stava solo nel client, e non in tutti i punti:
-- una vendita al banco o un cambio che scaricava i componenti di un
-- bundle scriveva la sottrazione così com'era, negativi compresi (17
-- prodotti, -170 pezzi complessivi, azzerati il 28/08/2026 e tracciati
-- in movimenti_magazzino con origine='rettifica_negativi').
--
-- Ora la cascata di scarico (magazzino → shop online fino alla scorta
-- minima) è unica per POS, cambi e kit dei corsi, e questo vincolo la
-- rende una garanzia invece di una convenzione: qualunque strada provi
-- a scrivere un valore negativo riceve un errore, non una giacenza
-- falsa. Vale solo su giacenza_magazzino, che è un dato dell'app; su
-- "giacenza" (lo shop online) la fonte di verità resta WooCommerce, che
-- può legittimamente scendere sotto zero se un giorno si attivassero
-- gli ordini in backorder.
--
-- Prima di applicarla, la verifica deve dare 0:
--   select count(*) from public.prodotti_shop where giacenza_magazzino < 0;
-- ---------------------------------------------------------

alter table public.prodotti_shop
  drop constraint if exists prodotti_shop_giacenza_magazzino_non_negativa;

alter table public.prodotti_shop
  add constraint prodotti_shop_giacenza_magazzino_non_negativa
  check (giacenza_magazzino is null or giacenza_magazzino >= 0);

notify pgrst, 'reload schema';
