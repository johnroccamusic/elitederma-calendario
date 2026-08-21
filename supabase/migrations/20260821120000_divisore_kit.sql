-- Linea divisoria trascinabile fra le tipologie di kit di un corso: una
-- riga "kit_definizioni" senza nome/prodotti, riordinabile ed eliminabile
-- come le altre, che compare anche nella tendina "Pacchetto/Kit"
-- dell'iscritto come separatore non selezionabile.
alter table kit_definizioni add column if not exists tipo text not null default 'kit';
