-- ---------------------------------------------------------
-- Advisor (PARTE 2) — i dati per rispondere a "se ordino oggi, arriva
-- in tempo?".
--
-- Tutti i campi nuovi nascono VUOTI di proposito, nessun valore
-- predefinito nascosto: finché il tempo di consegna di un prodotto non
-- è scritto a mano, l'Advisor non calcola nessuna data su quel prodotto
-- e lo dichiara "non configurato". Un lead time inventato non produce
-- silenzio, produce una data sbagliata detta con sicurezza — che è
-- peggio di non dire niente.
--
-- La scorta minima NON è qui: esiste già (prodotti_shop.scorta_minima),
-- è una sola in tutta l'app e resta quella, modificabile sia dalla lista
-- prodotti sia dalla scheda prodotto.
-- ---------------------------------------------------------

alter table public.prodotti_shop
  add column if not exists lead_time_giorni integer,
  add column if not exists giorni_sicurezza integer,
  add column if not exists fornitore_id uuid references public.fornitori(id) on delete set null,
  add column if not exists lotto_minimo_ordine integer;

-- giorni e lotti non possono essere negativi; zero invece è lecito
-- (un prodotto ritirato di persona ha davvero lead time 0)
alter table public.prodotti_shop
  drop constraint if exists prodotti_shop_giorni_riordino_non_negativi;
alter table public.prodotti_shop
  add constraint prodotti_shop_giorni_riordino_non_negativi check (
    (lead_time_giorni is null or lead_time_giorni >= 0) and
    (giorni_sicurezza is null or giorni_sicurezza >= 0) and
    (lotto_minimo_ordine is null or lotto_minimo_ordine >= 0)
  );

create index if not exists idx_prodotti_shop_fornitore on public.prodotti_shop(fornitore_id);

-- I due parametri che valgono per tutto il magazzino, non per il singolo
-- prodotto. Riga unica come impostazioni_iva: "id boolean primary key
-- check (id)" rende impossibile avere due configurazioni in conflitto.
-- Entrambi nascono NULL: finché non sono impostati l'Advisor non calcola
-- date limite d'ordine, segnala solo le scorte sotto soglia.
create table if not exists public.impostazioni_magazzino (
  id boolean primary key default true check (id),
  giorni_sicurezza_default integer check (giorni_sicurezza_default is null or giorni_sicurezza_default >= 0),
  orizzonte_copertura_giorni integer check (orizzonte_copertura_giorni is null or orizzonte_copertura_giorni >= 0)
);
insert into public.impostazioni_magazzino (id) values (true) on conflict (id) do nothing;

alter table public.impostazioni_magazzino enable row level security;
drop policy if exists "accesso interno impostazioni_magazzino" on public.impostazioni_magazzino;
create policy "accesso interno impostazioni_magazzino" on public.impostazioni_magazzino for all to anon
  using (true) with check (true);
drop policy if exists "accesso staff impostazioni_magazzino" on public.impostazioni_magazzino;
create policy "accesso staff impostazioni_magazzino" on public.impostazioni_magazzino for all to authenticated
  using (true) with check (true);

notify pgrst, 'reload schema';
