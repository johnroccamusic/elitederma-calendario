-- "Aggiungi Pagamento" (Le tue iscrizioni) ora ha anche le caselle di
-- spunta "Acconto" / "Quota pre corso" / "Saldo" per indicare a cosa si
-- riferisce il pagamento segnalato (se ne può spuntare più di una).
alter table public.acconti_da_verificare add column if not exists voci_pagamento text[];

notify pgrst, 'reload schema';
