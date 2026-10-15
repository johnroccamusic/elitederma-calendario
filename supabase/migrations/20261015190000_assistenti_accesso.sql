-- L'ACCESSO DELLE ASSISTENTI.
--
-- Le assistenti hanno anagrafica, compensi e assegnazioni, ma non possono
-- entrare: `assistente` non ha password ne' permessi. Qui prende le
-- stesse tre colonne della master — password, permessi, email_accesso —
-- perche' il cancello d'ingresso sa gia' leggere quella forma: confronta
-- il codice digitato contro master, venditori e utenti nominali, e
-- l'assistente diventa il quarto della fila.
--
-- `master_id`: CHI E' GIA' MASTER NON PRENDE UNA SECONDA PORTA.
--
-- Tre delle otto — Andrea Paura, Debora Fumagalli, Patrizia Savi — sono
-- master e la password ce l'hanno. Entrano da li', e le edizioni dove
-- fanno le assistenti compaiono nella dashboard che hanno gia'.
--
-- Il legame e' un id, non il nome. Oggi "ANDREA PAURA" combacia nei due
-- elenchi, ma basta che qualcuno corregga un cognome e il collegamento
-- si spezza in silenzio: e' lo stesso errore gia' pagato altrove
-- (raggruppare per nome invece che per id).
alter table assistente
  add column if not exists password text,
  add column if not exists permessi jsonb,
  add column if not exists email_accesso text,
  add column if not exists master_id uuid references master(id) on delete set null;

-- Le tre che oggi sono la stessa persona, collegate una volta.
-- Da qui in poi il collegamento si fa dalla pagina, a mano: questo
-- confronto per nome vale solo adesso, che i nomi combaciano.
update assistente a set master_id = m.id
from master m
where a.master_id is null
  and upper(trim(m.nome)) = upper(trim(a.nome));

create index if not exists assistente_master on assistente (master_id);
