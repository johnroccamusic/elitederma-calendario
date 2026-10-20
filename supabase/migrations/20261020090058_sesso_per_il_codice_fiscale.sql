-- Il sesso serve a UNA cosa sola: il giorno di nascita nel codice
-- fiscale di una donna e' il giorno + 40. Senza, il codice non si
-- calcola; e sbagliarlo produce un codice che passa la lettera di
-- controllo ed e' di un'altra persona. Quindi si chiede, non si
-- indovina dal nome.
--
-- Nessun default: "F" scritto di nascita vorrebbe dire 260 schede che
-- dichiarano un dato che nessuno ha dato.
alter table public.iscritti add column if not exists sesso text;

comment on column public.iscritti.sesso is
  'F o M, come sul documento. Serve al calcolo del codice fiscale (giorno + 40 per le donne).';
