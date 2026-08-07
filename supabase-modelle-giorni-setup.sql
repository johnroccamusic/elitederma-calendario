-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Gestione modelle per giorno"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- template dei giorni di un corso-tipo (es. "PMU BASE"): quanti giorni,
-- quali richiedono una Modella del Master (per la demo) e/o modelle degli
-- Allievi, con quale trattamento. Vale per tutte le edizioni di quel
-- corso (corsi_date) — non è legato a una singola data.
create table if not exists public.corsi_giorni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi(id) on delete cascade,
  numero_giorno integer not null,
  richiede_modella_master boolean not null default false,
  mattina_master boolean not null default false,
  pomeriggio_master boolean not null default false,
  richiede_modelle_allievi boolean not null default false,
  tipo_modella text,
  unique (corso_id, numero_giorno)
);
alter table public.corsi_giorni enable row level security;
drop policy if exists "accesso interno corsi_giorni" on public.corsi_giorni;
create policy "accesso interno corsi_giorni" on public.corsi_giorni for all to anon using (true) with check (true);

-- dati reali (nome/telefono/turno) della Modella del Master per una
-- specifica edizione del corso, un elemento per giorno che la richiede:
-- { numero_giorno, mattina, pomeriggio, nome_modella, telefono_modella }
alter table public.corsi_date add column if not exists modelle_master jsonb not null default '[]';

notify pgrst, 'reload schema';
