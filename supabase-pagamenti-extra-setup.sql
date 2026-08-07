-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Pagamenti extra + semaforo pagato/da pagare
-- (Quota acconto / Quota pre corso)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- semaforo pagato/da pagare sulla riga principale di acconto/pre corso
alter table public.iscritti add column if not exists acconto_pagato boolean not null default false;
alter table public.iscritti add column if not exists precorso_pagato boolean not null default false;

-- pagamenti aggiuntivi (pulsante "+"): un array, una voce per ogni
-- pagamento extra oltre al primo, ciascuna con lo stesso schema della
-- riga principale (imponibile/totale/metodo/interessi/pagato)
alter table public.iscritti add column if not exists acconto_extra jsonb not null default '[]';
alter table public.iscritti add column if not exists precorso_extra jsonb not null default '[]';

notify pgrst, 'reload schema';
