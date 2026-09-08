-- Storico dei loghi generati. Serve a una cosa sola ma necessaria: dopo
-- una prova, poter cancellare l'ultimo e restituire il suo numero al
-- contatore. Senza, ogni prova bruciava un progressivo per sempre e i
-- codici degli allievi veri saltavano un numero.
--
-- Si cancella solo l'ultimo, e per un motivo: il contatore e' una fila,
-- non un insieme. Togliendo un numero in mezzo resterebbe un buco che
-- nessuno potrebbe piu' riempire, e il progressivo mentirebbe.
create table if not exists public.loghi_generati (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  codice text not null,
  categoria_chiave text,
  categoria_etichetta text,
  master_nome text,
  allieva_nome text,
  creato_il timestamptz not null default now()
);

create index if not exists loghi_generati_numero_idx on public.loghi_generati (numero desc);

alter table public.loghi_generati enable row level security;
drop policy if exists "staff loghi_generati" on public.loghi_generati;
create policy "staff loghi_generati" on public.loghi_generati
  for all to anon, authenticated using (true) with check (true);

comment on table public.loghi_generati is
  'Storico dei loghi generati: serve a poter cancellare l''ultimo e restituire il suo numero al contatore, quando è stato fatto per prova.';
