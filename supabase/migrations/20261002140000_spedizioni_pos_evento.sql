-- La colonna che mancava, e che da sei giorni impediva al POS di creare
-- gli ordini di spedizione.
--
-- Il 26/09/2026 il banco ha imparato a legare una vendita a un evento, e
-- `evento_id` e' finito sia nei dati della vendita sia in quelli della
-- spedizione. Su vendite_shop la colonna c'era; su spedizioni_pos no.
--
-- PostgREST rifiuta l'intera scrittura quando il payload nomina una
-- colonna che non esiste — anche se vale null. Quindi NON e' fallita solo
-- la spedizione di un evento: e' fallita OGNI spedizione del POS, sempre,
-- indipendentemente dall'evento. L'ultima creata e' del 23 settembre.
--
-- La vendita invece passava, perche' viene scritta prima e su un'altra
-- tabella: l'operatore vedeva "vendita registrata, ma l'ordine di
-- spedizione non e' stato creato", il magazzino non riceveva niente, e
-- l'indirizzo appena digitato spariva con il modulo.
alter table spedizioni_pos add column if not exists evento_id uuid references eventi(id) on delete set null;

create index if not exists spedizioni_pos_evento_idx on spedizioni_pos(evento_id) where evento_id is not null;

comment on column spedizioni_pos.evento_id is
  'Evento a cui appartiene la spedizione, quando la vendita e'' stata fatta a una fiera (02/10/2026).';
