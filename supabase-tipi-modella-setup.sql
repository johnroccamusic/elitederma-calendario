-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Tipi di modella" (catalogo + per corso)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists"/"on conflict".
-- =========================================================

-- catalogo generale dei tipi di modella (gestito da "Definisci tipi di
-- modelle" in Impostazioni), usato come opzioni nel selettore "tipo"
-- quando un allievo richiede una modella
create table if not exists public.tipi_modella (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ts timestamptz not null default now()
);
alter table public.tipi_modella enable row level security;
drop policy if exists "accesso interno tipi_modella" on public.tipi_modella;
create policy "accesso interno tipi_modella" on public.tipi_modella for all to anon using (true) with check (true);

-- valori già in uso finora (erano hardcoded nel codice): portati nel
-- database così restano disponibili subito dopo la migrazione
insert into public.tipi_modella (nome) values
  ('MICROBLADING'), ('SOPRACCIGLIA OMBRETTO'), ('LABBRA'), ('EYELINER'),
  ('PELO CON DERMOGRAFO'), ('TRICO'), ('AREOLA'), ('LAMINAZIONE'), ('EXTENSION'), ('NEEDLING')
on conflict (nome) do nothing;

-- quali tipi di modella sono selezionabili per un dato corso-tipo (in
-- "Definisci corsi"): se un corso non ha nessuna riga qui, tutti i tipi
-- restano selezionabili (nessuna restrizione configurata)
create table if not exists public.corsi_tipi_modella (
  corso_id uuid not null references public.corsi(id) on delete cascade,
  tipo_modella_id uuid not null references public.tipi_modella(id) on delete cascade,
  primary key (corso_id, tipo_modella_id)
);
alter table public.corsi_tipi_modella enable row level security;
drop policy if exists "accesso interno corsi_tipi_modella" on public.corsi_tipi_modella;
create policy "accesso interno corsi_tipi_modella" on public.corsi_tipi_modella for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
