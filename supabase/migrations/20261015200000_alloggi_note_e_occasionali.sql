-- LE NOTE DELL'ALLOGGIO, E GLI ALLOGGI DI UNA VOLTA SOLA.
--
-- `hotel` aveva gia' nome, telefono, email, indirizzo, civico, citta' e
-- referente. Mancavano le NOTE: "il parcheggio e' sul retro", "chiedere
-- di Marco", "il check-in chiude alle 22". Sono dell'albergo, non del
-- soggiorno: valgono ogni volta che ci si torna, e si rileggono da
-- Setting -> Gestione Hotel.
--
-- Da non confondere con `corsi_date_docenti.note_viaggio`, che c'e' gia'
-- e dice un'altra cosa: quello che vale per QUELLA persona in QUELLA
-- trasferta ("arriva col treno delle 23"). Quelle restano dove sono.
--
-- `solo_edizione`: come per le sedi. L'albergo preso una volta per un
-- corso individuale non deve comparire nella tendina degli alloggi, ma
-- la riga esiste — regge i costi, e le note si ritrovano.
alter table hotel
  add column if not exists note text,
  add column if not exists solo_edizione boolean not null default false;
