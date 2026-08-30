-- Le impostazioni di impaginazione che il programmatore sistema
-- trascinando: larghezze delle colonne, nomi delle colonne, divisione fra
-- due riquadri. Prima vivevano nel localStorage del suo browser, quindi
-- nessun altro le vedeva; qui stanno in un posto solo e valgono per tutti.
create table if not exists public.impostazioni_layout_tabelle (
  chiave text primary key,
  valore jsonb not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now()
);

alter table public.impostazioni_layout_tabelle enable row level security;
drop policy if exists "accesso interno layout tabelle" on public.impostazioni_layout_tabelle;
create policy "accesso interno layout tabelle"
  on public.impostazioni_layout_tabelle
  for all to anon, authenticated
  using (true) with check (true);
