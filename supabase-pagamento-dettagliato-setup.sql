-- "Aggiungi Pagamento" (Le tue iscrizioni) ora chiede anche data pagamento
-- e un importo strutturato (imponibile/IVA/totale + metodo), oltre a nota e
-- file: "importo" e "metodo" riusano le colonne già esistenti (rimaste
-- nullable dalla precedente semplificazione a solo nota), "imponibile" e
-- "data_pagamento" sono nuove.
alter table public.acconti_da_verificare add column if not exists imponibile numeric;
alter table public.acconti_da_verificare add column if not exists data_pagamento date;

notify pgrst, 'reload schema';
