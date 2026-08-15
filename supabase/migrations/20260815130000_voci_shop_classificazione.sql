-- ---------------------------------------------------------
-- Classificazione delle voci di vendita dello shop online: i corsi
-- vengono venduti attraverso lo shop come se fossero articoli, e i
-- prodotti eliminati da WooCommerce negli ordini storici hanno
-- product_id = 0 (restano identificabili solo dal nome). Questa
-- tabella è la fonte di verità per distinguere prodotto/corso/escluso
-- per ogni nome di voce d'ordine — editabile dall'app, nessuna regola
-- scritta nel codice oltre a questa precompilazione una tantum.
-- ---------------------------------------------------------
create table if not exists public.voci_shop_classificazione (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null default 'prodotto' check (tipo in ('prodotto', 'corso', 'escluso')),
  note text,
  updated_at timestamptz not null default now()
);
alter table public.voci_shop_classificazione enable row level security;
drop policy if exists "accesso interno voci_shop_classificazione" on public.voci_shop_classificazione;
create policy "accesso interno voci_shop_classificazione" on public.voci_shop_classificazione for all to anon using (true) with check (true);

-- Precompilazione: un nome per ogni voce distinta trovata negli ordini
-- storici (vendite_shop.prodotti, jsonb array), classificata con la
-- regola concordata. Idempotente: "on conflict (nome) do nothing" non
-- tocca le righe già presenti (comprese quelle corrette a mano da John).
insert into public.voci_shop_classificazione (nome, tipo)
select nome, case
  when nome ilike '%corso%' or nome ilike '%saldo%' or nome ilike '%acconto%'
    or nome ilike '%formazione%' or nome ilike '%iscrizione%' or nome ilike '%kit avviamento%' then 'corso'
  when nome ilike 'Pmu parziale' or nome ilike 'Parziale PMU Roma' or nome ilike 'needling individuale' then 'corso'
  else 'prodotto'
end as tipo
from (
  select distinct trim(elem ->> 'nome') as nome
  from public.vendite_shop, jsonb_array_elements(prodotti) as elem
  where elem ->> 'nome' is not null and trim(elem ->> 'nome') <> ''
) voci
on conflict (nome) do nothing;

notify pgrst, 'reload schema';
