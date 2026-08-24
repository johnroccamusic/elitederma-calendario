-- Modalità di pagamento dell'assistente (Gestione Assistenti -> Corsi
-- associati): bonifico, cash o metà/metà. Guida anche il default dello
-- split Bonifico/Cash della riga "Costo Assistente" nel Riepilogo
-- Amministrativo dei corsi, finché nessuno la corregge a mano per quella
-- riga (stesso meccanismo del default 1/2 sul Costo Master).
alter table public.assistente
  add column modalita_pagamento text not null default 'cash'
    check (modalita_pagamento in ('bonifico', 'cash', 'meta'));
