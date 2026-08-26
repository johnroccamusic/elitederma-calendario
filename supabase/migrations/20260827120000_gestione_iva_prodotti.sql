-- Gestione IVA in anagrafica prodotto: costo_acquisto e prezzo_vendita
-- restano le stesse colonne di sempre, ma da qui in poi rappresentano
-- sempre il NETTO (IVA esclusa) — il lordo è sempre calcolato, mai
-- scritto a mano (vedi il form). Le due aliquote sono indipendenti
-- perché acquisto e vendita possono avere percentuali diverse.
alter table prodotti_shop
  add column if not exists aliquota_iva_acquisto numeric,
  add column if not exists aliquota_iva_vendita numeric,
  -- true solo dopo un salvataggio esplicito dal form (anche a parità di
  -- aliquota): i prodotti già esistenti, valorizzati automaticamente
  -- dalla migrazione qui sotto, restano false finché non vengono
  -- ripassati in rassegna a mano
  add column if not exists iva_verificata boolean not null default false;

-- aliquota IVA predefinita per i nuovi prodotti (singola riga)
create table if not exists impostazioni_iva (
  id boolean primary key default true check (id),
  aliquota_default numeric not null default 22
);
insert into impostazioni_iva (id, aliquota_default) values (true, 22)
  on conflict (id) do nothing;
alter table impostazioni_iva enable row level security;
create policy "accesso interno impostazioni_iva" on impostazioni_iva for all to anon using (true) with check (true);

-- dati esistenti: confermato dall'utente che sia i prezzi arrivati da
-- WooCommerce sia quelli scritti a mano in magazzino sono SEMPRE stati
-- lordi (è quello che i clienti vedono/hanno pagato). Si ricava il netto
-- all'indietro con l'aliquota di default (22%), mai il contrario: il
-- prezzo lordo pubblicato sullo shop deve restare identico a oggi, non
-- va MAI ricalcolato in su.
update prodotti_shop set
  aliquota_iva_acquisto = 22,
  aliquota_iva_vendita = 22,
  costo_acquisto = case when costo_acquisto is not null then round((costo_acquisto / 1.22)::numeric, 2) else null end,
  prezzo_vendita = case when prezzo_vendita is not null then round((prezzo_vendita / 1.22)::numeric, 2) else null end,
  iva_verificata = false;
