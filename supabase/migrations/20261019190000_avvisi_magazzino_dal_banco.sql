-- GLI AVVISI DI MAGAZZINO CHE NASCONO AL BANCO.
--
-- Quando una vendita al banco lascia qualcosa in sospeso — il magazzino
-- che non si scarica del tutto, la vendita che non si registra — l'app
-- lo diceva con una finestra a chi stava vendendo. Che quasi sempre e'
-- una master.
--
-- Due cose sbagliate insieme. La prima: a una master del magazzino non
-- importa niente, non ha accesso all'Advisor e non puo' sistemare
-- nessuna giacenza — le si chiedeva di fare una cosa che non puo' fare,
-- davanti a un cliente. La seconda, piu' seria: quell'avviso viveva
-- dentro una finestra. Premuto "ok", non restava da nessuna parte. Se la
-- master non lo riferiva, l'amministrazione non lo sapeva mai — ed e'
-- esattamente cosi' che il 19/10/2026 sei vendite sono rimaste fuori
-- dallo storico senza che nessuno se ne accorgesse per ore.
--
-- Da qui in poi l'avviso si scrive. Chi vende vede una riga che dice
-- soltanto che se ne occupa qualcun altro; chi amministra lo trova in
-- Shop e magazzino, e lo chiude quando l'ha sistemato.
create table if not exists public.avvisi_magazzino (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,
  messaggio     text not null,
  prodotti      jsonb,
  vendita_id    uuid,
  numero_ordine text,
  operatore     text,
  creato_il     timestamptz not null default now(),
  risolto_il    timestamptz,
  risolto_da    text
);

comment on table public.avvisi_magazzino is
  'Cose rimaste in sospeso al banco che deve vedere l''amministrazione, non chi vende.';

create index if not exists avvisi_magazzino_aperti_idx
  on public.avvisi_magazzino (creato_il desc) where risolto_il is null;

alter table public.avvisi_magazzino enable row level security;

create policy "avvisi magazzino staff" on public.avvisi_magazzino
  for all to authenticated using (true) with check (true);
