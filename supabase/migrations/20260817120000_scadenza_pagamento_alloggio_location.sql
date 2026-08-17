-- ---------------------------------------------------------
-- Scadenza pagamento per Alloggio e Location: un bonifico prenotato
-- senza ancora una scadenza (fattura non arrivata) è solo un impegno
-- preso, non un pagamento schedulabile — resta nel "Quadro impegni"
-- finché non si compila questa data; da lì passa nello "Scadenziario
-- Passivo" (ex Scadenziario). Il Compenso Master non è toccato: resta
-- come oggi, gated solo dalla fine del corso.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists scadenza_pagamento_alloggio date;
alter table public.corsi_date_docenti add column if not exists scadenza_pagamento_alloggio date;
alter table public.corsi_date add column if not exists scadenza_pagamento_location date;

notify pgrst, 'reload schema';
