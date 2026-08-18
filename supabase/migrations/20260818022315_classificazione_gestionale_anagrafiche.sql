-- ---------------------------------------------------------
-- Classificazione gestionale + Budget e controllo su location, master e
-- assistente: gli stessi campi già presenti sulle spese (PaginaSpesaForm)
-- — Diretto/Indiretto, Fisso/Variabile, Ricorrente/Occasionale, Natura,
-- Controllabilità, Riducibilità, Essenzialità, Origine, Ricorrenza, Bene
-- durevole, Incluso nell'analisi dei costi, Budget previsto, Soglia di
-- allerta personalizzata, Responsabile del costo. Compilazione manuale,
-- solo informativi: non vengono (ancora) riportati in automatico sulle
-- spese generate da queste anagrafiche.
-- ---------------------------------------------------------
alter table public.location add column if not exists diretto_indiretto text;
alter table public.location add column if not exists fisso_variabile text;
alter table public.location add column if not exists ricorrente_occasionale text;
alter table public.location add column if not exists natura text default 'operativo';
alter table public.location add column if not exists controllabilita text;
alter table public.location add column if not exists riducibilita text;
alter table public.location add column if not exists essenzialita text;
alter table public.location add column if not exists origine text default 'manuale';
alter table public.location add column if not exists ricorrenza text default 'nessuna';
alter table public.location add column if not exists bene_durevole boolean not null default false;
alter table public.location add column if not exists includi_analisi_costi boolean not null default true;
alter table public.location add column if not exists budget_previsto numeric;
alter table public.location add column if not exists soglia_allerta_personalizzata numeric;
alter table public.location add column if not exists responsabile_costo text;

alter table public.master add column if not exists diretto_indiretto text;
alter table public.master add column if not exists fisso_variabile text;
alter table public.master add column if not exists ricorrente_occasionale text;
alter table public.master add column if not exists natura text default 'operativo';
alter table public.master add column if not exists controllabilita text;
alter table public.master add column if not exists riducibilita text;
alter table public.master add column if not exists essenzialita text;
alter table public.master add column if not exists origine text default 'manuale';
alter table public.master add column if not exists ricorrenza text default 'nessuna';
alter table public.master add column if not exists bene_durevole boolean not null default false;
alter table public.master add column if not exists includi_analisi_costi boolean not null default true;
alter table public.master add column if not exists budget_previsto numeric;
alter table public.master add column if not exists soglia_allerta_personalizzata numeric;
alter table public.master add column if not exists responsabile_costo text;

alter table public.assistente add column if not exists diretto_indiretto text;
alter table public.assistente add column if not exists fisso_variabile text;
alter table public.assistente add column if not exists ricorrente_occasionale text;
alter table public.assistente add column if not exists natura text default 'operativo';
alter table public.assistente add column if not exists controllabilita text;
alter table public.assistente add column if not exists riducibilita text;
alter table public.assistente add column if not exists essenzialita text;
alter table public.assistente add column if not exists origine text default 'manuale';
alter table public.assistente add column if not exists ricorrenza text default 'nessuna';
alter table public.assistente add column if not exists bene_durevole boolean not null default false;
alter table public.assistente add column if not exists includi_analisi_costi boolean not null default true;
alter table public.assistente add column if not exists budget_previsto numeric;
alter table public.assistente add column if not exists soglia_allerta_personalizzata numeric;
alter table public.assistente add column if not exists responsabile_costo text;

notify pgrst, 'reload schema';
