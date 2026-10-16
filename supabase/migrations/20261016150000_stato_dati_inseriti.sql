-- "DATI INSERITI": il gradino che mancava, prima di "modulo inviato".
-- APPLICATA il 16/10/2026 via MCP.
--
-- La colonna nasceva a 'modulo_inviato', e quindi ogni iscrizione nuova
-- si presentava con la fascia che diceva "Modulo inviato" dal momento in
-- cui il venditore premeva Salva. Non era vero: il modulo non si puo'
-- ancora mandare — la pagina che l'allieva aprirebbe non esiste — e
-- comunque anche quando esistera' l'invio e' un gesto a parte.
--
-- Serviva un gradino prima, e serve per un motivo pratico: il venditore
-- inserisce quello che sa, e i dati che mancano li completa dopo. In
-- quel mentre la scheda c'e' ma non e' partito niente, e deve dirlo.
--
--   dati_inseriti    la scheda c'e', si sta ancora lavorando
--   modulo_inviato   il modulo e' partito davvero
--   modulo_ricevuto  l'allieva ha compilato e firmato
--   confermato       c'e' anche l'acconto
--
-- NIENTE DA CORREGGERE NELLO STORICO. Controllato prima di toccare: le
-- 254 iscrizioni in tabella sono tutte 'confermato', nessuna era su
-- 'modulo_inviato'. Qui non si aggiorna nessuna riga, si cambia solo
-- cosa vale per le prossime.
--
-- `modulo_inviato_il` e' il gemello di `modulo_ricevuto_il`: ci scrivera'
-- il tasto che manda il modulo, quando ci sara'. Finche' resta vuoto,
-- "inviato" non e' mai vero, e lo stato si deduce dai dati invece che da
-- una spunta che qualcuno deve ricordarsi di mettere.

alter table public.iscritti
  add column if not exists modulo_inviato_il timestamptz;

comment on column public.iscritti.modulo_inviato_il is
  'Quando il modulo e'' stato mandato all''allieva. Vuoto = non e'' mai partito.';

alter table public.iscritti drop constraint if exists iscritti_stato_check;
alter table public.iscritti add constraint iscritti_stato_check
  check (stato = any (array['dati_inseriti', 'modulo_inviato', 'modulo_ricevuto', 'confermato']));

alter table public.iscritti alter column stato set default 'dati_inseriti';
