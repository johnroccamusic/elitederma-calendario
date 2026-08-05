-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "+ Nuova operazione" > "Entrata"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists"/"if exists".
-- =========================================================

-- incassi occasionali non legati a un'iscrizione (es. vendita di un
-- prodotto in accademia a un cliente occasionale, pagato in contanti):
-- confluiscono nei "Ricavi totali" della dashboard ERP, sull'imponibile,
-- con lo stesso criterio "al netto di IVA" usato per i ricavi corsi
create table if not exists public.entrate_manuali (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  sede_id uuid references public.location(id) on delete set null,
  descrizione text,
  imponibile numeric not null default 0,
  iva_percentuale numeric not null default 22,
  totale numeric not null default 0,
  metodo_pagamento text,
  ts timestamptz not null default now()
);
alter table public.entrate_manuali enable row level security;
drop policy if exists "accesso interno entrate_manuali" on public.entrate_manuali;
create policy "accesso interno entrate_manuali" on public.entrate_manuali for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
