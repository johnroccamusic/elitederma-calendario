-- ---------------------------------------------------------
-- Scadenza pagamento sulla spesa vera: quando una fattura arriva
-- (Amministrazione → Quadro impegni → "Registra fattura"), la spesa nasce
-- già con la sua scadenza — è quello che la fa comparire subito in
-- Scadenziario Passivo → Da pagare, anche a corso non concluso.
-- ---------------------------------------------------------
alter table public.spese add column if not exists scadenza_pagamento date;

notify pgrst, 'reload schema';
