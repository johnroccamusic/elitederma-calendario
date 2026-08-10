-- Coda di verifica per i pagamenti (acconti/quote pre corso) segnalati dai
-- venditori: il venditore inserisce, lo staff verifica e approva prima che
-- diventi definitivo sulla scheda dell'iscritto.
create table if not exists public.acconti_da_verificare (
  id uuid primary key default gen_random_uuid(),
  iscritto_id uuid not null references public.iscritti(id) on delete cascade,
  tipo text not null check (tipo in ('acconto','precorso')),
  importo numeric not null,
  metodo text not null,
  venditore_nome text,
  stato text not null default 'in_attesa' check (stato in ('in_attesa','approvato')),
  ts timestamptz not null default now(),
  approvato_il timestamptz
);
alter table public.acconti_da_verificare enable row level security;
drop policy if exists "acconti_da_verificare_all" on public.acconti_da_verificare;
create policy "acconti_da_verificare_all" on public.acconti_da_verificare for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
