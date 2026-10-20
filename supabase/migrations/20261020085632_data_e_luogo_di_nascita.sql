-- Data e luogo di nascita sull'iscritto.
--
-- Servono a una cosa: calcolare il codice fiscale invece di farselo
-- dettare. Il codice glielo si chiedeva e basta, e 11 dei 253 in
-- archivio hanno la lettera di controllo sbagliata — cioe' sono stati
-- copiati a mano con un errore che nessuno ha visto. Da data e luogo il
-- codice si calcola, e un codice calcolato non si sbaglia a trascrivere.
--
-- Tutte e tre nullable: 260 schede esistono gia' senza questi dati, e
-- un NOT NULL le renderebbe impossibili da salvare.
--
-- `stato_nascita` vuoto = nata in Italia, che e' il caso di 201 schede
-- su 242. Non un default 'ITALIA': una colonna piena di un valore che
-- nessuno ha dichiarato non si distingue da una colonna compilata.
alter table public.iscritti add column if not exists data_nascita date;
alter table public.iscritti add column if not exists comune_nascita text;
alter table public.iscritti add column if not exists stato_nascita text;

comment on column public.iscritti.comune_nascita is
  'Comune italiano di nascita, in maiuscolo. Vuoto se nata all''estero: in quel caso vale stato_nascita.';
comment on column public.iscritti.stato_nascita is
  'Stato estero di nascita, col nome dell''elenco in src/comuni-regioni.js. Vuoto = Italia.';
