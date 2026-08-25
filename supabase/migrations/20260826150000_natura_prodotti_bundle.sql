-- Natura del prodotto (magazzino): distingue prodotti semplici, bundle
-- (es. kit colore venduto come unico prodotto ma composto da altri),
-- componenti (fanno parte di un bundle, hanno giacenza propria) e
-- varianti (es. taglie di una maglietta — la "vetrina" è un prodotto
-- padre senza giacenza/incassi propri). Default flat: ogni prodotto
-- esistente e ogni nuovo prodotto nasce "semplice" come se il concetto
-- di bundle/variante non esistesse — i casi speciali si smarcano a mano,
-- uno alla volta, da "Modifica prodotto".
-- niente "soglia_riordino": è lo stesso concetto di scorta_minima, già
-- esistente e già usata per "sotto scorta" — riusata anche per
-- componenti/varianti invece di duplicarla
alter table prodotti_shop
  add column if not exists tipo_prodotto text not null default 'semplice',
  add column if not exists conta_magazzino boolean not null default true,
  add column if not exists conta_incassi boolean not null default true,
  add column if not exists giacenza_propria boolean not null default true,
  add column if not exists prodotto_padre_id uuid references prodotti_shop(id) on delete set null;

alter table prodotti_shop drop constraint if exists prodotti_shop_tipo_prodotto_check;
alter table prodotti_shop add constraint prodotti_shop_tipo_prodotto_check
  check (tipo_prodotto in ('semplice', 'bundle', 'componente', 'variante'));

create index if not exists idx_prodotti_shop_padre on prodotti_shop(prodotto_padre_id) where prodotto_padre_id is not null;

-- popola esplicitamente l'esistente sul default flat (ridondante coi
-- default della alter table qui sopra, esplicito per chiarezza e per
-- coprire eventuali righe già presenti con valori diversi da null)
update prodotti_shop set
  tipo_prodotto = 'semplice',
  conta_magazzino = true,
  conta_incassi = true,
  giacenza_propria = true,
  prodotto_padre_id = null
where tipo_prodotto is distinct from 'semplice'
   or conta_magazzino is distinct from true
   or conta_incassi is distinct from true
   or giacenza_propria is distinct from true
   or prodotto_padre_id is not null;

-- distinta base dei bundle: quali componenti e quante unità servono per
-- comporne uno. prezzo_vendita/costo_unitario dei bundle restano sulle
-- colonne già esistenti di prodotti_shop (prezzo_vendita, costo_acquisto
-- — quest'ultimo per i bundle è calcolato in app dalla distinta base, non
-- scritto qui).
create table if not exists bundle_componenti (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references prodotti_shop(id) on delete cascade,
  componente_id uuid not null references prodotti_shop(id) on delete restrict,
  quantita_per_bundle numeric not null check (quantita_per_bundle > 0),
  created_at timestamptz not null default now(),
  unique (bundle_id, componente_id)
);
create index if not exists idx_bundle_componenti_bundle on bundle_componenti(bundle_id);
create index if not exists idx_bundle_componenti_componente on bundle_componenti(componente_id);

alter table bundle_componenti enable row level security;
drop policy if exists "accesso interno bundle_componenti" on bundle_componenti;
create policy "accesso interno bundle_componenti" on bundle_componenti for all to anon
  using (true) with check (true);
