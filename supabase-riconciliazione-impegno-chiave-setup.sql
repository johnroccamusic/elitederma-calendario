-- ---------------------------------------------------------
-- Motore di match (spec-riconciliazione.md §6): impegno è ancora
-- vuota — Quadro Impegni oggi è calcolato al volo da corsi/hotel/
-- location (calcolaVociScadenziario), mai salvato come righe.
--
-- Per allineare quelle voci virtuali in impegno senza duplicarle ad
-- ogni sincronizzazione serve una chiave stabile su cui fare upsert:
-- stesso principio già in uso su spese.origine_scadenziario_chiave
-- (stessa stringa "<tipo>_<rigaId>", vedi calcolaVociScadenziario in
-- App.jsx), qui replicato su impegno invece che reinventato.
--
-- Additivo puro: una colonna nullable (gli impegni "manuale" non
-- hanno un'origine virtuale da tracciare) con vincolo univoco,
-- nessuna riga esistente toccata (la tabella è vuota).
-- ---------------------------------------------------------

alter table public.impegno
  add column if not exists chiave_origine text;

-- NON parziale: un indice/vincolo unique "pieno" in Postgres tollera
-- comunque più NULL (i NULL non sono mai uguali fra loro), e solo così
-- può essere usato come target di ON CONFLICT dall'upsert di
-- PostgREST — un indice unique parziale (WHERE chiave_origine is not
-- null, il primo tentativo) viene rifiutato da ON CONFLICT
alter table public.impegno add constraint impegno_chiave_origine_key unique (chiave_origine);

notify pgrst, 'reload schema';
