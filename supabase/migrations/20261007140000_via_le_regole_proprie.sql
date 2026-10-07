-- Applicata via MCP il 07/10/2026.
--
-- Le "regole proprie" di un codice, nate stamattina, sono sbagliate e si
-- rifaranno in un altro modo. Via l'interruttore e le due tabelle che
-- nessuno leggera' piu': restano colonne vuote su una tabella viva, e una
-- colonna vuota che nessuno guarda e' il modo migliore per ritrovarsi fra
-- sei mesi a chiedersi se conta ancora qualcosa.
--
-- Nessuna di queste tre ha mai avuto un valore diverso dal suo default:
-- verificato prima di cancellarle.
alter table coupon
  drop column if exists regole_proprie,
  drop column if exists fasce_sconto_contanti,
  drop column if exists eccezioni_categoria;
