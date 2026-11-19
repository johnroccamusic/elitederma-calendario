-- ---------------------------------------------------------
-- Una fattura a rate ha una spesa per rata (19/11/2026)
--
-- Il titolare, sulla fattura Orthostetica n. 771: «anche se e' pagata
-- devo poterci unire la fattura ricevuta da Fatture in Cloud».
--
-- Quella fattura e' di 1.820,09 e Fatture in Cloud la porta con il suo
-- piano rate dentro (documento_fornitore.rate): 910,05 il 13/11 e
-- 910,04 il 13/12. In app sono due spese, una pagata e una da pagare —
-- ed e' giusto cosi'.
--
-- Ma il legame fattura-spesa stava su UNA colonna della fattura
-- (fatture_ricevute_fic.spesa_id), cioe' una fattura una spesa. Quindi:
-- attaccata la fattura alla prima rata, la seconda non poteva piu'
-- riceverla — il quadro "Associa una fattura" mostra apposta solo le
-- fatture libere, per non staccarla da dove sta. Quella seconda uscita
-- sarebbe rimasta "da associare" per sempre, senza nessun modo di
-- chiuderla.
--
-- IL LEGAME SI SPOSTA SULLA SPESA, che e' la parte "molte": una fattura,
-- tante spese quante sono le rate. Da qui la copertura si CALCOLA —
-- somma dei totali delle spese legate contro il totale della fattura —
-- invece di essere una colonna da tenere aggiornata: una fattura coperta
-- a metà si riconosce da sé, e non c'e' nessun numero che possa
-- contraddire le righe che lo compongono.
--
-- Nessun importo viene toccato: questo legame non muove soldi, dice solo
-- quale documento giustifica un'uscita dal conto.
-- ---------------------------------------------------------

alter table public.spese
  add column if not exists fattura_fic_id uuid references public.fatture_ricevute_fic(id) on delete set null;

comment on column public.spese.fattura_fic_id is
  'La fattura ricevuta da Fatture in Cloud che questa spesa paga, in tutto o per una rata. Piu di una spesa puo puntare alla stessa fattura: la copertura e la somma dei loro totali (coperturaFattura in App.jsx), non una colonna da tenere aggiornata.';

-- l''indice e'' parziale: le spese legate a una fattura sono una
-- minoranza (6 su qualche migliaio al 19/11/2026) e un indice su tutta
-- la tabella sarebbe quasi tutto NULL
create index if not exists spese_fattura_fic_id_idx
  on public.spese(fattura_fic_id) where fattura_fic_id is not null;

-- i legami che c''erano: si travasano, non si rifanno a mano
update public.spese s
   set fattura_fic_id = f.id
  from public.fatture_ricevute_fic f
 where f.spesa_id = s.id
   and s.fattura_fic_id is null;

-- ---------------------------------------------------------
-- fatture_ricevute_fic.spesa_id NON si cancella qui, ed e' voluto: in
-- giro ci sono schede aperte col bundle di prima, che scrivono ancora
-- quella colonna. Si toglie con la migrazione gemella
-- 20261119161000, dopo che la pubblicazione e'' verificata — due
-- dichiarazioni dello stesso fatto un giorno si contraddicono, e questa
-- resta viva per poche ore, non per sempre.
--
-- ROLLBACK
--   drop index if exists public.spese_fattura_fic_id_idx;
--   alter table public.spese drop column if exists fattura_fic_id;
-- (i 6 legami tornano leggibili da fatture_ricevute_fic.spesa_id, che
--  non e'' stata toccata)
-- ---------------------------------------------------------
