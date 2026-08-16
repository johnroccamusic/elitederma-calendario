-- ---------------------------------------------------------
-- Riepilogo amministrativo di una classe: ogni spesa può avere una
-- quota pagata in contanti (percentuale sull'imponibile, oppure un
-- importo diretto se la percentuale resta vuota). Serve a scorporare
-- questa parte dal contante incassato al corso (nuovo indicatore
-- "Cash netto", separato dal KPI "Contanti" esistente che non cambia).
-- ---------------------------------------------------------
alter table public.spese add column if not exists percentuale_pagata_cash numeric;
alter table public.spese add column if not exists importo_pagato_cash numeric;

notify pgrst, 'reload schema';
