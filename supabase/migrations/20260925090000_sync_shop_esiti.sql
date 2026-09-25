-- Il diario della sincronizzazione con WooCommerce.
--
-- Serviva perche' finora non c'era: il cron chiama l'edge function con
-- net.http_post, che e' asincrona, quindi pg_cron segna "succeeded"
-- appena ha spedito la richiesta — anche quando la funzione dall'altra
-- parte risponde 500. La risposta vera finisce in net._http_response,
-- che si svuota da sola dopo poche ore.
--
-- Risultato: la sincronizzazione e' rimasta ferma per settimane
-- ("ordiniImportati: 0, pagina: 1") senza che da nessuna parte si
-- vedesse niente, finche' non l'hanno detto i clienti. Da qui in avanti
-- ogni giro lascia una riga, e l'app la guarda.
create table if not exists sync_shop_esiti (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  esito text not null,                      -- ok | parziale | errore
  ordini_importati integer not null default 0,
  ordini_riallineati integer not null default 0,
  pagine integer,
  completato boolean,
  dopo_data text,
  scartati jsonb not null default '[]'::jsonb,
  errori jsonb not null default '[]'::jsonb
);

create index if not exists sync_shop_esiti_ts on sync_shop_esiti (ts desc);

alter table sync_shop_esiti enable row level security;
drop policy if exists sync_shop_esiti_tutti on sync_shop_esiti;
create policy sync_shop_esiti_tutti on sync_shop_esiti for all to anon, authenticated using (true) with check (true);
