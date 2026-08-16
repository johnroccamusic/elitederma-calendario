-- ---------------------------------------------------------
-- Regime fiscale del master (Gestione Master → scheda master → tab
-- "Regime fiscale"): determina come leggere il compenso impostato
-- nelle fasce (tab "Compensi"). "forfettario"/"occasionale" sono
-- esenti IVA — il compenso in fascia È l'imponibile. "ordinario" è
-- inteso IVA inclusa — l'imponibile si scorpora al 22% solo in
-- visualizzazione, il valore salvato in fasce_compenso non cambia.
-- ---------------------------------------------------------
alter table public.master add column if not exists regime_fiscale text;

notify pgrst, 'reload schema';
