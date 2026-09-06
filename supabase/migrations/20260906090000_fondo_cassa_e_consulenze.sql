-- Due casse che prima non esistevano da nessuna parte.
--
-- "Fondo cassa": il contante dell'accademia, con i suoi movimenti. Il saldo
-- non si scrive: si somma. Un saldo memorizzato e dei movimenti che lo
-- alimentano sono due verità che prima o poi divergono, e quando divergono
-- non si sa più quale delle due credere.
--
-- "Cassa consulenze": gli incassi delle consulenze, che sono ricavi di un
-- tipo suo e finora non avevano un posto dove stare.

create table if not exists public.fondo_cassa_movimenti (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  tipo text not null check (tipo in ('entrata', 'uscita')),
  importo numeric not null check (importo >= 0),
  causale text,
  note text,
  creato_il timestamptz not null default now()
);

create index if not exists fondo_cassa_movimenti_data_idx
  on public.fondo_cassa_movimenti (data desc, creato_il desc);

create table if not exists public.consulenze_incassi (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  cliente text,
  importo numeric not null check (importo >= 0),
  metodo text,
  note text,
  creato_il timestamptz not null default now()
);

create index if not exists consulenze_incassi_data_idx
  on public.consulenze_incassi (data desc, creato_il desc);

-- Le due tabelle nascono riservate allo staff autenticato, non aperte ad
-- `anon` come le altre 95 policy del progetto. Non è una svista: l'app
-- passa dal login di Accesso.jsx, quindi qui `authenticated` basta e
-- avanza — e sono due tabelle in meno da mettere in sicurezza quando si
-- affronterà il resto. Vedi la sezione 4 di CLAUDE.md.
alter table public.fondo_cassa_movimenti enable row level security;
alter table public.consulenze_incassi enable row level security;

drop policy if exists "staff autenticato fondo_cassa_movimenti" on public.fondo_cassa_movimenti;
create policy "staff autenticato fondo_cassa_movimenti"
  on public.fondo_cassa_movimenti
  for all to authenticated
  using (true) with check (true);

drop policy if exists "staff autenticato consulenze_incassi" on public.consulenze_incassi;
create policy "staff autenticato consulenze_incassi"
  on public.consulenze_incassi
  for all to authenticated
  using (true) with check (true);

comment on table public.fondo_cassa_movimenti is
  'Movimenti del fondo cassa: il saldo si ricava sommandoli, non è memorizzato.';
comment on table public.consulenze_incassi is
  'Incassi delle consulenze: data, cliente, importo, metodo.';
