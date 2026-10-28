-- L'ALLOGGIO PROVVISORIO IN OPERATIVO CORSI (28/10/2026). Al primo giro era
-- un testo libero su corsi_date e corsi_date_docenti; il titolare ha
-- chiesto «una scheda completa con nome, indirizzo, prezzo, telefono, come
-- quando creo l'alloggio provvisorio nella creazione corso». Quindi e' la
-- stessa cosa della creazione corso: una riga di `hotel` marcata
-- solo_edizione, con tutti i suoi dati, collegata via alloggio_id. Le due
-- colonne di testo, mai usate, se ne vanno.
alter table corsi_date add column if not exists alloggio_provvisorio text;
alter table corsi_date_docenti add column if not exists alloggio_provvisorio text;
alter table corsi_date drop column if exists alloggio_provvisorio;
alter table corsi_date_docenti drop column if exists alloggio_provvisorio;
