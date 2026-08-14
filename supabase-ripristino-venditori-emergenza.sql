-- =========================================================
-- RIPRISTINO D'EMERGENZA — venditori ricostruiti dai nomi visti negli
-- screenshot di questa conversazione. Password di default "0000" e
-- nessun permesso attivo (uguale a un venditore appena creato): vanno
-- reimpostati a mano in Impostazioni > Definisci venditori (password,
-- telefono) e in Password menù > Password venditori (i tasti della home).
--
-- Le vendite/iscrizioni già registrate NON sono state toccate: il campo
-- "Tutor" su ogni iscritto è testo, non un riferimento all'id della riga
-- venditori — ricreando questi nomi ESATTI, "Le tue iscrizioni" e la
-- classifica venditori tornano a funzionare da soli.
-- =========================================================
insert into public.venditori (nome) values
  ('ANDREA'),
  ('ELENA'),
  ('ELIA CITO'),
  ('GIULIA TAMASI'),
  ('KATIA'),
  ('MARIA LAURA'),
  ('MARIANNA SILVESTRI'),
  ('MARIO'),
  ('MARTINA MEI'),
  ('MAURE'' ACOSTA'),
  ('OLGA'),
  ('SIMONA'),
  ('STEFANIA SANNA'),
  ('STEFANO'),
  ('VALENTINA');
