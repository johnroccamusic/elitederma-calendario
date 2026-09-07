-- Con le tariffe per giorno della settimana, "notti x prezzo" non e' piu'
-- il conto giusto: un soggiorno da mercoledi' a domenica attraversa tre
-- fasce diverse, e moltiplicare per la tariffa del check-in sbaglia di
-- decine di euro.
--
-- Il totale si somma quindi notte per notte, e si conserva per tutti e due
-- i modi di pagare: cosi' spostare bonifico/cash dal riepilogo resta un
-- cambio di casella e non un conto da rifare a mano con dati che li' non
-- ci sono.
alter table public.corsi_date
  add column if not exists pattuito_periodo_cash numeric,
  add column if not exists pattuito_periodo_bonifico numeric;

alter table public.corsi_date_docenti
  add column if not exists pattuito_periodo_cash numeric,
  add column if not exists pattuito_periodo_bonifico numeric;

comment on column public.corsi_date.pattuito_periodo_cash is
  'Totale del soggiorno pagando in contanti, sommato notte per notte sul listino della stanza.';
comment on column public.corsi_date.pattuito_periodo_bonifico is
  'Come pattuito_periodo_cash, ma con la tariffa a fattura.';
