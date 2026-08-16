-- ---------------------------------------------------------
-- "Associa il gruppo a una categoria di spesa": una sola categoria
-- fissa per l'intero gruppo (tutte le assistenti, tutte le master,
-- tutti gli hotel, tutte le location), non più per singolo record —
-- sostituisce il tentativo precedente (categoria_spesa_id per record,
-- mai popolato). Riga singola, sempre lo stesso id fisso.
-- ---------------------------------------------------------
alter table public.assistente drop column if exists categoria_spesa_id;
alter table public.master drop column if exists categoria_spesa_id;
alter table public.location drop column if exists categoria_spesa_id;
alter table public.hotel drop column if exists categoria_spesa_id;

create table if not exists public.impostazioni_categorie_gruppi (
  id uuid primary key default gen_random_uuid(),
  assistenti_categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null,
  master_categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null,
  hotel_categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null,
  location_categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null,
  ts timestamptz not null default now()
);
alter table public.impostazioni_categorie_gruppi enable row level security;
drop policy if exists "accesso interno impostazioni_categorie_gruppi" on public.impostazioni_categorie_gruppi;
create policy "accesso interno impostazioni_categorie_gruppi" on public.impostazioni_categorie_gruppi for all to anon using (true) with check (true);

insert into public.impostazioni_categorie_gruppi (id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
