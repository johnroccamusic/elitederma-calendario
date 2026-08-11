-- Modalità "Stile": tavolozza dei colori condivisi dell'app (blu scuro,
-- oro, crema, bordo crema, grigio testi secondari), modificabile con la
-- ruota cromatica dalla barra in alto. Tabella "append-only": ogni
-- pubblicazione inserisce una nuova riga invece di sovrascrivere quella
-- corrente, così restano visibili anche le versioni pubblicate in passato
-- (per poterle ripristinare). Il tema "attivo" è sempre la riga più
-- recente per pubblicato_il.
create table if not exists public.tema_colori_versioni (
  id uuid primary key default gen_random_uuid(),
  colori jsonb not null,
  etichetta text,
  pubblicato_il timestamptz not null default now()
);
alter table public.tema_colori_versioni enable row level security;
drop policy if exists "tema_colori_versioni_all" on public.tema_colori_versioni;
create policy "tema_colori_versioni_all" on public.tema_colori_versioni for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
