-- "Aggiungi Pagamento": sotto la nota si possono associare al pagamento
-- anche altri corsi frequentati dallo stesso allievo (oltre a quello a cui
-- l'iscrizione appartiene già), per i pagamenti che coprono più corsi
-- insieme.
alter table public.acconti_da_verificare add column if not exists corsi_extra_ids uuid[];

notify pgrst, 'reload schema';
