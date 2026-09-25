-- Le righe di costo aggiunte a mano nel riepilogo del corso.
--
-- Nascevano dal tasto "aggiungi voce di costo" senza nessuna data: qui
-- non si scrivevano e il default della colonna e' NULL. Il riepilogo
-- del corso le mostrava lo stesso — legge per classe_id — ma prima nota
-- e ciclo passivo leggono `data_pagamento || data_documento` e le
-- buttavano fuori. La data pero' c'era, ed era quella del corso:
-- l'ultimo giorno. Qui gliela si scrive addosso.
--
-- E niente IVA. Sono i pagamenti fatti sul posto — il bar, il taxi, il
-- parcheggio, il pranzo — di cui non si chiede la ricevuta. Il 22% che
-- avevano non l'aveva scelto nessuno: era il default della colonna, e
-- ogni volta che si ribatteva l'importo l'imponibile tornava a
-- totale/1,22. Erano 239,68 € di credito IVA che non esiste.
--
-- Il perimetro e' stretto apposta: solo le righe di classe scritte a
-- mano (origine 'manuale', nessuna chiave di scadenziario, nessuna
-- busta). Le spese nate dallo scadenziario, quelle con fattura e le
-- appendici non le tocca.
update spese s
set data_documento = coalesce(s.data_documento, cd.data_fine, cd.data_inizio),
    iva_percentuale = 0,
    imponibile = s.totale
from corsi_date cd
where cd.id = s.classe_id
  and s.tipo_ambito = 'classe'
  and s.origine = 'manuale'
  and s.origine_scadenziario_chiave is null
  and s.busta_numero is null
  and s.data_documento is null
  and s.data_pagamento is null;

-- La riga rimasta senza classe (Rimborso parcheggi, 30 €): una data da
-- cui copiare non ce l'ha, quindi resta fuori da prima nota finche'
-- qualcuno non gliela scrive a mano. L'IVA fantasma pero' va via anche
-- da li'.
update spese s
set iva_percentuale = 0,
    imponibile = s.totale
where s.tipo_ambito = 'classe'
  and s.origine = 'manuale'
  and s.origine_scadenziario_chiave is null
  and s.busta_numero is null
  and s.classe_id is null
  and s.data_documento is null
  and s.data_pagamento is null;
