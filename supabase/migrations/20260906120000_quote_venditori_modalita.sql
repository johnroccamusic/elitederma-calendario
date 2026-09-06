-- Come viene pagata la quota di UN venditore su UNA classe.
--
-- Prima lo split stava su corsi_date.quota_venditore_bonifico/cash: una
-- coppia sola per tutta la classe. Ma la quota è la somma di più persone,
-- e ognuna può chiedere di essere pagata a modo suo.
--
-- Il legame con il venditore è il nome del tutor in maiuscolo, la stessa
-- chiave con cui la scheda raggruppa il dettaglio (iscritti.tutor): non
-- esiste un venditore_id su iscritti, e inventarne uno qui vorrebbe dire
-- avere due modi diversi di dire la stessa cosa.
--
-- Chi non ha una riga qui viene pagato in contanti: il default è cash, e
-- resta implicito, così "non è stato deciso" e "si è deciso cash" restano
-- distinguibili.
create table if not exists public.quote_venditori_split (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date (id) on delete cascade,
  venditore text not null,
  modalita text not null check (modalita in ('B', 'C', '1/2')),
  aggiornato_il timestamptz not null default now(),
  unique (corso_data_id, venditore)
);

create index if not exists quote_venditori_split_classe_idx
  on public.quote_venditori_split (corso_data_id);

alter table public.quote_venditori_split enable row level security;

drop policy if exists "staff autenticato quote_venditori_split" on public.quote_venditori_split;
create policy "staff autenticato quote_venditori_split"
  on public.quote_venditori_split
  for all to authenticated
  using (true) with check (true);

comment on table public.quote_venditori_split is
  'Modalita di pagamento della quota di un venditore su una classe (B bonifico, C contanti, 1/2 meta). Senza riga: contanti.';
