-- IL RIMBALZO DELLA MAIL DEL MODULO, SULLA SCHEDA DELL'ALLIEVA.
--
-- Il 22/10/2026 un modulo e' partito verso «elitederma@europe.con» — .con
-- invece di .com — ed e' rimbalzato mezzo secondo dopo. Resend l'aveva
-- accettato, quindi il registro diceva «esito: ok»; il rimbalzo e'
-- arrivato subito dopo dal webhook ed e' finito in
-- `email_inviate.rimbalzata_il`, dove non lo guarda nessuno.
--
-- La fascia di stato, intanto, diceva «Modulo inviato» — ed era vero: era
-- partito. Ma non era arrivato, e chi aveva iscritto la persona e' rimasto
-- ad aspettare un modulo che non poteva tornare.
--
-- Il fascicolo mostrerebbe il rimbalzo, ma e' irraggiungibile: si apre
-- dalla tappa «Modulo ricevuto» in poi, e quella tappa non arrivera' mai
-- proprio perche' la mail e' rimbalzata.
--
-- Quindi il fatto va sulla riga dell'iscritta, dove la fascia lo legge
-- senza aprire niente. Lo scrive `email-eventi` quando il rimbalzo
-- riguarda un «invio_modulo», e lo cancella il primo invio riuscito dopo.
alter table iscritti
  add column if not exists modulo_mail_rimbalzata_il timestamptz;

comment on column iscritti.modulo_mail_rimbalzata_il is
  'Quando la mail del modulo e'' rimbalzata (indirizzo inesistente o rifiutato). Scritta da email-eventi, azzerata dal primo invio riuscito successivo. Null = nessun rimbalzo noto.';
