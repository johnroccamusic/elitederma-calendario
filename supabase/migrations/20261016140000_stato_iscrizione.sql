-- LO STATO DELL'ISCRIZIONE.
--
-- Tre momenti, in ordine: il venditore precompila e manda il link
-- ("modulo_inviato"), l'allievo lo compila e firma ("modulo_ricevuto"),
-- e quando c'e' anche l'acconto l'iscrizione e' buona ("confermato").
--
-- NON BASTA LO STATO: serve sapere QUANDO il modulo e' arrivato e DA
-- QUALE STRADA. Le strade saranno due — il venditore che carica a mano
-- il modulo firmato su carta, e l'allievo che compila online dal link —
-- e senza questa traccia, fra sei mesi, nessuno saprebbe piu' dire se
-- quella firma e' arrivata dal sito o da una foto su WhatsApp.
alter table public.iscritti
  add column if not exists stato text not null default 'modulo_inviato',
  add column if not exists modulo_ricevuto_il timestamptz,
  add column if not exists modulo_ricevuto_da text;

alter table public.iscritti drop constraint if exists iscritti_stato_check;
alter table public.iscritti add constraint iscritti_stato_check
  check (stato in ('modulo_inviato', 'modulo_ricevuto', 'confermato'));

alter table public.iscritti drop constraint if exists iscritti_modulo_ricevuto_da_check;
alter table public.iscritti add constraint iscritti_modulo_ricevuto_da_check
  check (modulo_ricevuto_da is null or modulo_ricevuto_da in ('manuale', 'online'));

-- Lo storico e' tutto confermato: quelle iscrizioni sono nate prima che
-- questo flusso esistesse, le persone sono in aula o ci sono gia' state.
-- Farle ricalcolare dalla regola nuova le declasserebbe per un modulo
-- che nessuno ha mai dovuto mandare.
--
-- Da eseguire UNA VOLTA SOLA, subito dopo aver aggiunto la colonna:
--   update public.iscritti set stato = 'confermato';
