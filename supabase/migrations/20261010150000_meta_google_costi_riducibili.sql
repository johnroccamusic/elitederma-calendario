-- Le campagne Meta e Google sono il costo piu' facile da tagliare che
-- abbiamo: si spegne una campagna e la spesa si ferma il giorno dopo.
-- Erano quasi tutte segnate "riducibilita' bassa" o lasciate vuote, e
-- cosi' il riquadro "costi riducibili" dell'Analisi costi di gestione
-- diceva quasi zero proprio sulla voce che pesa di piu'.
--
-- Si va per FORNITORE, non per descrizione: c'e' una ricarica Speedgo la
-- cui riga di banca nomina "Google Ireland Limited" ma e' un corriere, e
-- per descrizione sarebbe finita qui dentro.
--
-- La categoria non si tocca: tutte e 48 stanno gia' sotto "Spese
-- pubblicitarie e propaganda" con la sotto-voce giusta.
--
-- Applicata il 10/10/2026: 48 righe, 17.907,44 euro.
update spese
   set riducibilita = 'alta',
       updated_at = now()
 where fornitore_id in (
         select id from fornitori
          where nome in ('META', 'GOOGLE', 'Google Ireland Limited')
       )
   and riducibilita is distinct from 'alta';
