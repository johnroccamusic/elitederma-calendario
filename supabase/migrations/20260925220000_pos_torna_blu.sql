-- Il tasto "POS Vendita diretta" torna al blu di sempre.
--
-- Era stato dipinto di nero. Togliere la voce e' meglio che scriverci
-- sopra il blu: cosi' il tasto non ha piu' un colore suo e segue
-- quello che si sceglie in "Aspetto dell'app", come tutti gli altri.
-- Se un domani il blu cambia, cambia anche lui.
update impostazioni_layout_tabelle
set valore = valore - 'tasto|home|pos|disco',
    aggiornato_il = now()
where chiave = 'stile_colori_oggetti';
