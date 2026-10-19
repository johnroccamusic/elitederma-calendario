-- LO SCARTO FRA L'APP E IL SITO, misurato ogni notte alle 05:30.
--
-- L'app e WooCommerce sono due database su due macchine con una rete in
-- mezzo: divergeranno, prima o poi. Non si puo' impedire. Quello che si
-- puo' fare e' non lasciare che succeda in silenzio.
--
-- Serve anche a una decisione in sospeso: far vivere lo shop sulla
-- giacenza dell'app vorrebbe dire spegnere la gestione dello stock su
-- WooCommerce, e quindi rinunciare alla sua protezione atomica contro
-- l'overselling. Prima di rinunciarci bisogna sapere quanto vale oggi
-- quello scarto — altrimenti e' un'opinione.
--
-- LA PRIMA MISURA, 19/10/2026: su 161 prodotti confrontati, 33 NON
-- coincidono. Il peggiore e' "Confezione Anellini Sterili 30 pz", 983
-- qui e 0 sul sito. Quindi la risposta e' no, non e' zero.
--
-- `differenza` e' sul_sito - qui: positiva vuol dire che il sito crede
-- di averne piu' di noi, ed e' il verso pericoloso perche' continua a
-- vendere.
--
-- Applicato con MCP il 19/10/2026: la tabella qui sotto, la edge
-- function `magazzino-termometro` e il lavoro notturno
-- `termometro-magazzino-shop`. La funzione e' chiusa dal gettone del
-- cron (lo stesso delle email, verificato da `email_cron_ok`): senza,
-- risponde 403. Il cron manda `timeout_milliseconds := 120000`, perche'
-- il limite di 5 secondi di pg_net scadeva sempre e il lavoro risultava
-- fallito anche quando era riuscito.
create table if not exists public.magazzino_scarti_shop (
  prodotto_id    uuid primary key references public.prodotti_shop(id) on delete cascade,
  woo_product_id integer,
  qui            integer not null,
  sul_sito       integer not null,
  differenza     integer not null,
  dal            timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now()
);

comment on table public.magazzino_scarti_shop is
  'Prodotti la cui giacenza sul sito non coincide con quella dell''app. Vuota = i due numeri dicono la stessa cosa.';

alter table public.magazzino_scarti_shop enable row level security;

create policy "scarti shop staff" on public.magazzino_scarti_shop
  for all to authenticated using (true) with check (true);
