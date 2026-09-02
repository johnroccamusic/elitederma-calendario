-- I riordini in corso: fra "l'Advisor dice di ordinare" e "la merce e'
-- arrivata" passavano giorni in cui l'avviso restava identico, e nessuno
-- sapeva se qualcuno avesse gia' ordinato. Da qui in poi lo si dichiara:
-- il prodotto esce dalla lista "Da ordinare adesso" e passa in "In attesa
-- di ricezione", dove resta finche' non lo si segna ricevuto.
create table if not exists riordini_in_corso (
  id uuid primary key default gen_random_uuid(),
  prodotto_id uuid not null references prodotti_shop(id) on delete cascade,
  fornitore_id uuid references fornitori(id) on delete set null,
  quantita integer not null default 0,
  data_ordine date not null default current_date,
  -- ordinato | ricevuto | annullato: i ricevuti restano come storico di
  -- quanto ci mette davvero un fornitore a consegnare
  stato text not null default 'ordinato',
  data_ricezione date,
  quantita_ricevuta integer,
  nota text,
  creato_da text,
  ts timestamptz not null default now()
);

-- un solo ordine aperto per prodotto: due righe "ordinato" sullo stesso
-- articolo vorrebbero dire due ordini, e non e' quello che succede
create unique index if not exists riordini_in_corso_un_solo_aperto
  on riordini_in_corso (prodotto_id) where stato = 'ordinato';

create index if not exists riordini_in_corso_stato on riordini_in_corso (stato, data_ordine);

alter table riordini_in_corso enable row level security;
drop policy if exists "accesso interno riordini_in_corso" on riordini_in_corso;
create policy "accesso interno riordini_in_corso" on riordini_in_corso
  for all to anon, authenticated using (true) with check (true);
