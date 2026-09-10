-- I movimenti del conto corrente, come li manda la banca.
--
-- Solo lettura: qui dentro non si ordina niente e non si paga niente. E'
-- l'estratto conto che entra in casa, e da li' diventa prima nota.
--
-- Tre scelte che vale la pena spiegare, perche' sono quelle che decidono
-- se questa tabella reggera' fra un anno.
--
-- 1. L'importo e' UNO, con il segno: negativo se e' uscito, positivo se e'
--    entrato. Due colonne "dare" e "avere" sembrano piu' contabili, ma poi
--    ogni somma deve ricordarsi di sottrarre l'una dall'altra, e prima o
--    poi qualcuna se ne dimentica.
--
-- 2. `impronta` e' l'antidoto al doppio caricamento. Lo stesso mese
--    scaricato due volte non deve entrare due volte, e il file della banca
--    non porta un identificativo di riga affidabile: l'impronta si calcola
--    da conto + data + importo + descrizione, ed e' unica. Due movimenti
--    identici nello stesso giorno esistono davvero (due prelievi uguali):
--    per quelli c'e' `progressivo`, che li distingue.
--
-- 3. Il collegamento con la contabilita' e' generico — `collegato_tipo` +
--    `collegato_id` — invece di una colonna per ogni tabella. Un movimento
--    puo' essere una spesa, l'incasso di un allievo, un giroconto o niente
--    di tutto questo, e l'elenco crescera': meglio un paio di campi che
--    dieci chiavi esterne quasi sempre vuote.
create table if not exists public.movimenti_banca (
  id uuid primary key default gen_random_uuid(),
  conto text not null default 'BPL',
  data_operazione date not null,
  data_valuta date,
  importo numeric not null,
  descrizione text not null default '',
  causale text,
  -- il saldo dopo il movimento, se la banca lo scrive: serve a controllare
  -- che non manchi una riga in mezzo
  saldo numeric,
  progressivo integer not null default 0,
  impronta text not null,
  -- nuovo | riconciliato | ignorato. "ignorato" e' per i giroconti e per
  -- quello che in prima nota non deve entrare: sparisce dalla coda senza
  -- essere cancellato, cosi' il prossimo import non lo ripropone
  stato text not null default 'nuovo',
  collegato_tipo text,
  collegato_id uuid,
  nota text,
  file_origine text,
  importato_il timestamptz not null default now(),
  constraint movimenti_banca_impronta_unica unique (impronta)
);

create index if not exists movimenti_banca_data_idx on public.movimenti_banca (data_operazione desc);
create index if not exists movimenti_banca_stato_idx on public.movimenti_banca (stato);

alter table public.movimenti_banca enable row level security;
drop policy if exists "accesso interno movimenti_banca" on public.movimenti_banca;
create policy "accesso interno movimenti_banca"
  on public.movimenti_banca for all to anon, authenticated
  using (true) with check (true);

comment on table public.movimenti_banca is
  'Estratto conto importato dalla banca, in sola lettura: da qui i movimenti diventano prima nota e si riconciliano con spese e incassi.';
comment on column public.movimenti_banca.impronta is
  'conto + data + importo + descrizione + progressivo: impedisce che lo stesso movimento entri due volte se si ricarica lo stesso periodo.';
