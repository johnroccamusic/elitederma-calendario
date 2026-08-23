-- Ordine dei tasti (Home e le pagine a tasti "Amministrazione"/"Gestione
-- magazzino e shop"/"Statistiche"), riordinabile trascinando solo da
-- ruoloUtente "programmatore" — stesso principio già in uso per
-- impostazioni_layout_iscrizioni, una riga per pagina invece che una sola.
--
-- "ordine" è un array; ogni elemento è la chiave di un tasto (stringa) o,
-- solo nella pagina "home", una cartella:
--   { "tipo": "cartella", "id": "...", "nome": "...", "tasti": ["chiave1", ...] }
-- Nessuna riga finché nessuno riordina nulla: il client usa un ordine di
-- default finché la riga per quella pagina non esiste ancora.
create table if not exists impostazioni_layout_tasti (
  pagina text primary key,
  ordine jsonb not null default '[]'::jsonb
);

alter table impostazioni_layout_tasti enable row level security;
create policy "accesso interno impostazioni_layout_tasti" on impostazioni_layout_tasti for all to anon using (true) with check (true);
