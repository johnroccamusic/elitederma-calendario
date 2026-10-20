-- L'interno esce dal modulo dell'allieva (20/10/2026).
--
-- Era gia' facoltativo, quindi non fermava nessuno: era una casella in
-- piu' da guardare su un modulo che si compila col telefono in mano. Un
-- campo che quasi nessuno riempie e che nessuno aspetta non e' un dato,
-- e' una riga di attrito.
--
-- Resta nella scheda del venditore, dove serve: all'interno si consegna
-- il pacco, e chi prepara una spedizione lo chiede al telefono.
--
-- Si spegne `incluso`, non si cancella la riga: la spunta in
-- Setting -> Modulo di iscrizione resta, e riaccenderlo e' un clic.
update public.modulo_iscrizione_campi
   set incluso = false
 where chiave = 'interno_residenza';
