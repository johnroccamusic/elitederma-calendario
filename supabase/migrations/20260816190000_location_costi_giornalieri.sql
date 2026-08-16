-- ---------------------------------------------------------
-- Costo giornaliero di una sede, in due varianti a seconda del
-- metodo di pagamento (Cash / Bonifico). Assegnazione Master sceglie
-- quale delle due si applica a una specifica edizione
-- (corsi_date.tipo_pagamento_location): il Riepilogo amministrativo
-- della classe calcola da lì il costo location (costo giornaliero ×
-- giorni del corso), sola lettura, come Quota master/assistenti.
-- ---------------------------------------------------------
alter table public.location add column if not exists costo_giornaliero_cash numeric;
alter table public.location add column if not exists costo_giornaliero_bonifico numeric;
alter table public.corsi_date add column if not exists tipo_pagamento_location text;

notify pgrst, 'reload schema';
