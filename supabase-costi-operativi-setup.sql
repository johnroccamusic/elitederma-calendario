-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Costi operativi"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- voci di costo inserite a mano (categorie 1-6, 8-9): ogni riga ha
-- imponibile/IVA/totale separati, con aliquota IVA scelta riga per riga
-- (a differenza dei pagamenti degli iscritti, qui non è fissa al 22%)
create table if not exists public.costi_operativi_voci (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  sottovoce text not null,
  descrizione text,
  location_id uuid references public.location(id) on delete set null,
  imponibile numeric not null default 0,
  iva_percentuale numeric not null default 22,
  totale numeric not null default 0,
  data date not null default current_date,
  ts timestamptz not null default now()
);
alter table public.costi_operativi_voci enable row level security;
drop policy if exists "accesso interno costi_operativi_voci" on public.costi_operativi_voci;
create policy "accesso interno costi_operativi_voci" on public.costi_operativi_voci for all to anon using (true) with check (true);

-- le voci extra del "Riepilogo amministrativo" (corsi_date.costi_extra,
-- jsonb) ora portano anche una "categoria" (una delle 10 di cui sopra),
-- scelta dalla tendina prima di creare il campo: nessuna migrazione
-- richiesta, è solo una chiave in più dentro agli oggetti già presenti
-- nell'array jsonb esistente

notify pgrst, 'reload schema';
