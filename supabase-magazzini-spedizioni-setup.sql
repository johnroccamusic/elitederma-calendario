-- ---------------------------------------------------------
-- Inventario Post Corso — fase 4: vista magazzini locali (§9) e
-- spedizioni a domicilio dal POS (§10).
--
-- spedizioni_pos: quando una master/venditore vende dal POS un
-- prodotto che non ha fisicamente con sé al corso, la vendita resta
-- comunque una vendita normale (vendite_shop) ma genera anche un
-- ordine di spedizione a domicilio per l'allievo, visibile allo staff
-- (Raf) in una coda dedicata. vendita_id lega l'ordine alla vendita
-- che lo ha generato; iscritto_id è opzionale (chi vende potrebbe non
-- aver selezionato un iscritto specifico).
-- ---------------------------------------------------------
create table if not exists public.spedizioni_pos (
  id uuid primary key default gen_random_uuid(),
  vendita_id uuid references public.vendite_shop(id) on delete set null,
  corso_data_id uuid references public.corsi_date(id) on delete set null,
  iscritto_id uuid references public.iscritti(id) on delete set null,
  destinatario_nome text not null,
  indirizzo text,
  cap text,
  citta text,
  prodotti jsonb not null default '[]',
  stato text not null default 'da_spedire' check (stato in ('da_spedire', 'spedito')),
  ts timestamptz not null default now(),
  spedito_il timestamptz
);
alter table public.spedizioni_pos enable row level security;
drop policy if exists "accesso interno spedizioni_pos" on public.spedizioni_pos;
create policy "accesso interno spedizioni_pos" on public.spedizioni_pos for all to anon using (true) with check (true);
create index if not exists spedizioni_pos_stato_idx on public.spedizioni_pos (stato);

notify pgrst, 'reload schema';
