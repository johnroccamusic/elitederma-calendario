-- VENDITA FIERA: un'iscrizione chiusa al banco di un evento (8/11/2026).
--
-- Chiesto dal titolare con la fiera di Napoli aperta: «nel modulo
-- iscrizione in cima metti un flag che si chiama vendita fiera e quelle
-- vendite le mostri in una nuova sezione in fiera di napoli in gestione
-- eventi in cui elenchi i corsi che stiamo chiudendo in fiera».
--
-- PERCHE' UNA COLONNA CHE DICE *QUALE* FIERA, E NON UN BOOLEANO.
-- La sezione sta dentro la scheda di UN evento. Con un «vendita_fiera»
-- vero/falso, la scheda della Fiera di Catania mostrerebbe le
-- iscrizioni di Napoli e di ogni fiera futura, e nessuno potrebbe piu'
-- dire quale fiera ha chiuso quei corsi — e' lo stesso guasto dei sette
-- consensi col QR generico, che non sapevano a quale corso
-- appartenessero. Il gesto resta un flag; quello che si scrive e' la
-- fiera.
--
-- Una colonna sola, e non due dichiarazioni (un booleano + l'id): due
-- dichiarazioni della stessa cosa un giorno si contraddicono. Non nulla
-- = e' una vendita fiera, e dice di quale.
--
-- `on delete set null`: cancellata la fiera, l'iscrizione resta — non e'
-- l'iscrizione a dipendere dall'evento.
alter table iscritti
  add column if not exists vendita_evento_id uuid references eventi(id) on delete set null;

comment on column iscritti.vendita_evento_id is
  'La fiera/evento al cui banco questa iscrizione e'' stata chiusa. Nulla = iscrizione normale.';

-- si legge sempre «le iscrizioni di QUESTA fiera», mai il contrario
create index if not exists iscritti_vendita_evento_idx
  on iscritti (vendita_evento_id) where vendita_evento_id is not null;

-- ROLLBACK:
--   drop index if exists iscritti_vendita_evento_idx;
--   alter table iscritti drop column if exists vendita_evento_id;
