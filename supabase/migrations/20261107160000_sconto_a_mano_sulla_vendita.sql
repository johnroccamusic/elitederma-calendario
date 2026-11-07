-- LA CIFRA IN PIU' SCRITTA A MANO, REGISTRATA (7/11/2026)
--
-- Il titolare: «e' meglio che scrivo una cifra io da scontare. Ad
-- esempio, se vedo che il prezzo fa 7,56 e voglio fare 6,90, scrivo a
-- mano meno 60 euro, che ne so». Serve ad arrotondare il totale, si
-- somma a quello che sta valendo (anche allo sconto fiera) e la scrive
-- solo il programmatore.
--
-- PERCHE' UNA COLONNA. Senza, in archivio resterebbe solo un totale piu'
-- basso di quello che le tabelle dicono: le righe della vendita
-- porterebbero lo sconto riproporzionato e nessuno saprebbe che un
-- pezzo di quello sconto non viene da nessuna tabella, ma da una
-- decisione presa al banco. Chi ha battuto la vendita e' gia' scritto
-- (`operatore_*`); questo dice QUANTO ha tolto di suo.
--
-- Non e' obbligatoria e nasce nulla: su ogni vendita fatta finora, e su
-- tutte quelle in cui nessuno scrive niente, resta nulla.
--
-- Nota tecnica, per chi legge: `registra_vendita_pos` costruisce la riga
-- con `jsonb_populate_record`, che IGNORA le chiavi che non sono colonne.
-- Quindi senza questa migrazione il numero non avrebbe fatto fallire la
-- vendita: si sarebbe perso in silenzio, che e' peggio.

alter table public.vendite_shop
  add column if not exists sconto_a_mano_eur numeric;

comment on column public.vendite_shop.sconto_a_mano_eur is
  'Gli euro tolti A MANO in piu'' su questo carrello, oltre allo sconto delle tabelle (codici, fasce, sconto fiera): la casella «In piu'' €» del POS, che solo il programmatore vede. Serve ad arrivare a una cifra tonda. Nullo se nessuno ha scritto niente.';

-- ROLLBACK
-- alter table public.vendite_shop drop column if exists sconto_a_mano_eur;
