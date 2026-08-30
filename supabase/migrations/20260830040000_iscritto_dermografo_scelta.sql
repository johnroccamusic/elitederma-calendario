-- La risposta alla domanda "l'allievo acquista il dermografo a parte?":
-- no | ha_il_suo | tekna | horus.
--
-- Resta distinta da iscritti.dermografo, che continua a dire solo quale
-- pezzo deve uscire dal magazzino (tekna/horus/nessuno) ed è quello che
-- leggono Advisor e logistica: "no" e "ha il suo" sono due risposte
-- diverse per il commerciale, ma per il magazzino sono la stessa cosa.
alter table public.iscritti
  add column if not exists dermografo_scelta text;

comment on column public.iscritti.dermografo_scelta is
  'no | ha_il_suo | tekna | horus — risposta alla domanda sul dermografo acquistato a parte.';
