-- ---------------------------------------------------------
-- Nota di credito → la fattura che rettifica, scritta nero su bianco.
--
-- Finora il legame esisteva solo di rimbalzo, dentro il campo "note" delle
-- righe di riconciliazione ("Rettifica da nota di credito su fattura N").
-- Bastava finché una nota di credito poteva agganciarsi solo a fatture GIÀ
-- riconciliate: quelle righe c'erano sempre. Da ora una nota di credito può
-- rettificare anche una fattura ancora in coda — non ci sono impegni da
-- stornare e quindi nemmeno righe di riconciliazione, e senza questa colonna
-- del collegamento non resterebbe traccia.
--
-- Nullable: le note di credito riconciliate prima di oggi restano com'erano.
-- ---------------------------------------------------------

alter table public.documento_fornitore
  add column if not exists documento_rettificato_id uuid references public.documento_fornitore(id) on delete set null;

create index if not exists idx_documento_fornitore_rettificato
  on public.documento_fornitore (documento_rettificato_id)
  where documento_rettificato_id is not null;
