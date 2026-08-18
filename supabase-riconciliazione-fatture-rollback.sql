-- ---------------------------------------------------------------------------
-- ROLLBACK di supabase-riconciliazione-fatture-setup.sql: elimina le 4
-- tabelle della riconciliazione fatture (documento_fornitore, impegno,
-- riconciliazione, scadenza_passiva). Da eseguire SOLO se qualcosa non
-- funziona e serve tornare indietro rapidamente — non è un file da
-- applicare in condizioni normali.
--
-- Cancella anche i dati eventualmente già inseriti in queste tabelle:
-- non tocca nient'altro (fornitori, spese, abbonamenti_contratti, ecc.
-- restano intatti, sono solo referenziati da qui).
--
-- Ordine di drop: prima riconciliazione (dipende dalle altre due via
-- foreign key restrict), poi le altre tre in un colpo solo.
-- ---------------------------------------------------------------------------

drop table if exists public.riconciliazione;
drop table if exists public.scadenza_passiva;
drop table if exists public.impegno;
drop table if exists public.documento_fornitore;

notify pgrst, 'reload schema';
