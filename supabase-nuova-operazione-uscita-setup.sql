-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Nuova operazione" (Uscita)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- il metodo di pagamento dell'uscita (Sito/Bonifico/Pos/Contanti/Cash no
-- iva/Rate), inserito dal nuovo form "+ Nuova operazione" nella dashboard
-- ERP, con lo stesso meccanismo IVA già usato per acconto/pre corso/saldo
-- degli iscritti (scegliendo "Cash no iva" l'aliquota si azzera)
alter table public.costi_operativi_voci add column if not exists metodo_pagamento text;

notify pgrst, 'reload schema';
