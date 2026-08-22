-- Raccolta punti master (da settembre 2026): schema completo.
--
-- vendite_shop: due colonne per attribuire una vendita a un codice —
-- coupon_id è il collegamento vivo (nullo se il coupon viene cancellato,
-- ON DELETE SET NULL), codice_coupon è la copia testuale immutabile presa
-- al momento della vendita, così il dettaglio per codice sopravvive alla
-- cancellazione del coupon vero.
alter table vendite_shop add column if not exists coupon_id uuid references coupon(id) on delete set null;
alter table vendite_shop add column if not exists codice_coupon text;

-- Registro permanente di tutti i codici mai emessi, in nessuna
-- circostanza cancellato (nemmeno quando il coupon collegato viene
-- eliminato dall'app o da WooCommerce): garantisce che un codice usato in
-- passato non venga mai più riassegnato. Fonte di verità sull'unicità dei
-- codici, non la tabella "coupon" (che perde la riga alla cancellazione).
create table if not exists codici_emessi (
  codice text primary key,
  origine text not null check (origine in ('auto', 'manuale', 'woocommerce')),
  master_id uuid references master(id),
  corsi_date_id uuid references corsi_date(id),
  creato_il timestamptz not null default now()
);

-- Storico della regola base dei punti (punti guadagnati ogni X euro):
-- righe con validità da/a, l'unica con data_fine null è quella corrente.
-- "Ricalcola dall'inizio" svuota questa tabella e ne lascia una sola;
-- "valida solo da qui in avanti" chiude quella aperta e ne apre una nuova
-- da oggi, così il passato non cambia.
create table if not exists punti_master_regola_base (
  id uuid primary key default gen_random_uuid(),
  data_inizio date not null,
  data_fine date,
  punti numeric not null check (punti >= 0),
  euro numeric not null check (euro > 0),
  created_at timestamptz not null default now()
);
create unique index if not exists un_punti_master_regola_base_aperta
  on punti_master_regola_base ((data_fine is null)) where data_fine is null;

-- Periodi di maggior compenso: sostituiscono per intero la regola base
-- nelle loro date (non si sommano). Sovrapposizioni fra periodi e uscita
-- dalla finestra della raccolta sono controllate nel pannello "Gestione
-- premi" prima del salvataggio, non con un vincolo qui.
create table if not exists punti_master_periodi_speciali (
  id uuid primary key default gen_random_uuid(),
  data_inizio date not null,
  data_fine date not null,
  punti numeric not null check (punti >= 0),
  euro numeric not null check (euro > 0),
  created_at timestamptz not null default now()
);

-- Finestra generale della raccolta punti (riga singola, stesso pattern di
-- regole_referral_automatico). Valori di partenza inseriti sotto, da
-- correggere dal pannello "Gestione premi".
create table if not exists punti_master_impostazioni (
  id uuid primary key,
  data_inizio date not null,
  data_fine date not null
);

insert into punti_master_impostazioni (id, data_inizio, data_fine)
values ('00000000-0000-0000-0000-000000000010', '2026-09-01', '2027-08-31')
on conflict (id) do nothing;

insert into punti_master_regola_base (data_inizio, data_fine, punti, euro)
select '2026-09-01', null, 1, 10
where not exists (select 1 from punti_master_regola_base);

-- RLS: stesso schema reale già in uso su vendite_shop/coupon/
-- regole_referral_automatico (policy permissiva per "anon" — non
-- "authenticated": è così che sono davvero configurate le altre tabelle
-- di questo progetto oggi, verificato prima di scrivere questa
-- migrazione, nonostante quanto riportato in CLAUDE.md).
alter table codici_emessi enable row level security;
create policy "accesso interno codici_emessi" on codici_emessi for all to anon using (true) with check (true);

alter table punti_master_regola_base enable row level security;
create policy "accesso interno punti_master_regola_base" on punti_master_regola_base for all to anon using (true) with check (true);

alter table punti_master_periodi_speciali enable row level security;
create policy "accesso interno punti_master_periodi_speciali" on punti_master_periodi_speciali for all to anon using (true) with check (true);

alter table punti_master_impostazioni enable row level security;
create policy "accesso interno punti_master_impostazioni" on punti_master_impostazioni for all to anon using (true) with check (true);

-- Seed del registro codici (una tantum, fatto qui perché non richiede
-- nessuna chiamata esterna a WooCommerce): i codici già usati negli
-- ordini storici (payload_raw.coupon_lines, origine "woocommerce" perché
-- non sappiamo se fossero legati a una master) e i coupon già presenti
-- nella tabella "coupon" (origine "auto", hanno tutti corsi_date_id +
-- master_id). I coupon attualmente vivi SOLO su WooCommerce (mai
-- comparsi in un ordine, es. appena creati e non ancora usati) non sono
-- qui: mancano dati per recuperarli senza una chiamata API, che non
-- appartiene a una migrazione SQL — vedi la nota nel codice della
-- generazione, il conflitto sulla chiave primaria resta comunque la vera
-- difesa se un codice così venisse rigenerato per errore.
insert into codici_emessi (codice, origine, master_id, corsi_date_id)
select distinct lower(cl ->> 'code'), 'woocommerce', null::uuid, null::uuid
from vendite_shop, jsonb_array_elements(coalesce(payload_raw -> 'coupon_lines', '[]'::jsonb)) as cl
where origine = 'woocommerce' and cl ->> 'code' is not null and trim(cl ->> 'code') <> ''
on conflict (codice) do nothing;

insert into codici_emessi (codice, origine, master_id, corsi_date_id)
select lower(codice), 'auto', master_id, corsi_date_id
from coupon
on conflict (codice) do nothing;
