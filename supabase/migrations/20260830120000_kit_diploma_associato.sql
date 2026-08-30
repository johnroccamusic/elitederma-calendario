-- ---------------------------------------------------------
-- Il diploma di un pacchetto.
--
-- Finora il modello del diploma stava sul corso (corsi.diploma_template_path):
-- uno per corso, uguale per tutti gli allievi. Ma nella stessa edizione
-- convivono pacchetti diversi — chi ha fatto solo sopracciglia e chi ha fatto
-- anche le labbra — e il foglio che si stampa non e' lo stesso.
--
-- Da qui il diploma si associa al PACCHETTO: il file sta nel bucket
-- "diploma-templates" (lo stesso dei corsi), qui se ne tiene il percorso e il
-- nome originale, quello che si rilegge in pagina ("Diploma associato: ...").
-- Nullable: un pacchetto senza diploma proprio continua a usare quello del
-- corso, come prima.
-- ---------------------------------------------------------

alter table public.kit_definizioni
  add column if not exists diploma_path text,
  add column if not exists diploma_nome text;

comment on column public.kit_definizioni.diploma_path is
  'percorso nel bucket diploma-templates del modello di diploma di questo pacchetto';
comment on column public.kit_definizioni.diploma_nome is
  'nome del file come lo ha caricato lo staff, mostrato in "Diploma associato:"';
