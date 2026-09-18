-- Un dipendente non e' un fornitore, ma nell'app "Anagrafiche" e' gia'
-- un elenco solo di soggetti con dei ruoli: master, assistente, struttura,
-- fornitore. Mancava il ruolo "dipendente", e senza quello uno stipendio
-- si imputava a una persona registrata come fornitore — che nei conti e'
-- una cosa diversa.
--
-- Colonna nuova con default: nessuna riga esistente cambia comportamento.
-- Si riusa la tabella che c'e' invece di crearne una parallela: le spese
-- puntano gia' a fornitore_id, e una seconda anagrafica avrebbe voluto
-- dire un secondo campo su ogni spesa.
alter table fornitori add column if not exists e_dipendente boolean default false;
comment on column fornitori.e_dipendente is
  'Il soggetto e'' un dipendente dell''accademia, non un fornitore: in Anagrafiche compare sotto "Dipendenti" e non fra i fornitori.';
create index if not exists idx_fornitori_dipendenti on fornitori(e_dipendente) where e_dipendente;
