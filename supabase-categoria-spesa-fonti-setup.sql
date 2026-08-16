-- ---------------------------------------------------------
-- Ogni "fonte" di costo di un corso (assistente, master, sede,
-- hotel) può essere associata a una sotto-categoria di spesa fissa
-- ("Associa categoria di spesa"): serve a far sì che l'app sappia
-- sempre a quale categoria imputare quel costo, invece di deciderlo
-- caso per caso senza criterio.
-- ---------------------------------------------------------
alter table public.assistente add column if not exists categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null;
alter table public.master add column if not exists categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null;
alter table public.location add column if not exists categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null;
alter table public.hotel add column if not exists categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null;

notify pgrst, 'reload schema';
