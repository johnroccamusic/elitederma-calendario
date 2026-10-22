-- Il nome del file com'era sul telefono, accanto al titolo scelto: aiuta
-- a riconoscerlo quando si sostituisce.
alter table eventi_documenti add column if not exists nome_file text;
