-- ---------------------------------------------------------
-- POS Vendite Prodotti — fase 1: attribuzione della vendita a chi è
-- loggato (master/venditore/utente operativo) e predisposizione per i
-- movimenti di Reso/Annullamento/Cambio (fase successiva, colonne già
-- qui per evitare una seconda migrazione a breve).
--
-- operatore_tipo/operatore_id/operatore_nome: chi ha generato la
-- vendita (non chi esegue eventuali resi/cambi in seguito — vedi
-- vendita_collegata_id). tipo_movimento distingue la vendita originale
-- dagli storni futuri; vendita_collegata_id lega uno storno alla
-- vendita che rettifica.
-- ---------------------------------------------------------
alter table public.vendite_shop add column if not exists operatore_tipo text;
alter table public.vendite_shop add column if not exists operatore_id uuid;
alter table public.vendite_shop add column if not exists operatore_nome text;
alter table public.vendite_shop add column if not exists tipo_movimento text not null default 'vendita';
alter table public.vendite_shop add column if not exists vendita_collegata_id uuid references public.vendite_shop(id) on delete set null;

create index if not exists vendite_shop_operatore_idx on public.vendite_shop (operatore_tipo, operatore_id);

-- ---------------------------------------------------------
-- Target Master / Target Venditori: obiettivi individuali (incasso,
-- quantità di prodotto, o entrambi insieme) su un periodo definito,
-- assegnati solo dall'admin da Impostazioni. Solo segnalazione
-- dell'avanzamento — nessun calcolo/erogazione del premio a sistema.
-- ---------------------------------------------------------
create table if not exists public.target_vendite_prodotti (
  id uuid primary key default gen_random_uuid(),
  soggetto_tipo text not null check (soggetto_tipo in ('master','venditore')),
  soggetto_id uuid not null,
  tipo_target text not null check (tipo_target in ('incasso','prodotto','combinato')),
  soglia_incasso numeric,
  prodotti_obiettivo jsonb not null default '[]',
  data_inizio date not null,
  data_fine date not null,
  ts timestamptz not null default now()
);
alter table public.target_vendite_prodotti enable row level security;
drop policy if exists "accesso interno target_vendite_prodotti" on public.target_vendite_prodotti;
create policy "accesso interno target_vendite_prodotti" on public.target_vendite_prodotti for all to anon using (true) with check (true);

create index if not exists target_vendite_prodotti_soggetto_idx on public.target_vendite_prodotti (soggetto_tipo, soggetto_id);

notify pgrst, 'reload schema';
