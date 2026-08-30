-- ---------------------------------------------------------
-- Chiusura corso — le tabelle del flusso.
--
-- Il principio: la master non conta il rientro, dichiara i consumi; il
-- rientro lo calcola l'app. Ogni numero che le compare è già calcolato —
-- lei conferma, o dichiara uno scostamento scegliendo un motivo da un
-- elenco chiuso. Mai testo libero: quello che si ottiene chiedendo di
-- descrivere a parole è un dato inutilizzabile.
--
-- Il corso NON si chiude quando la master conferma: si chiude quando Raf
-- riceve il pacco e registra il ricevuto effettivo. Per questo ogni riga
-- della bolla porta tre numeri distinti — atteso (calcolato), dichiarato
-- (la master, solo se corregge), ricevuto (Raf) — e nessuno dei tre
-- sovrascrive gli altri: è la differenza fra loro il dato che serve.
-- ---------------------------------------------------------

create table if not exists public.chiusura_corso (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null unique references public.corsi_date(id) on delete cascade,
  -- aperta → confermata_master → ricevuta (chiusa) | scostamento (aperta su Raf)
  stato text not null default 'aperta',
  master_id uuid references public.master(id) on delete set null,
  confermata_ts timestamptz,
  confermata_da text,
  ricevuta_ts timestamptz,
  ricevuta_da text,
  ts timestamptz not null default now()
);

-- Blocco 1: gli allievi. Nasce tutto spuntato "kit consegnato" — la master
-- toglie solo la spunta a chi non l'ha ricevuto (assenti, ritirati)
create table if not exists public.chiusura_corso_consegne (
  id uuid primary key default gen_random_uuid(),
  chiusura_id uuid not null references public.chiusura_corso(id) on delete cascade,
  iscritto_id uuid not null references public.iscritti(id) on delete cascade,
  kit_consegnato boolean not null default true,
  -- null quando quell'allievo non aveva nessun dermografo da ricevere
  dermografo_consegnato boolean,
  unique (chiusura_id, iscritto_id)
);

-- Blocco 3: i dermografi, uno per uno e mai aggregati — sono gli oggetti
-- più costosi che escono dal magazzino. Senza matricola (non esiste in
-- anagrafica) si distinguono per modello + progressivo dentro l'edizione
create table if not exists public.chiusura_corso_dermografi (
  id uuid primary key default gen_random_uuid(),
  chiusura_id uuid not null references public.chiusura_corso(id) on delete cascade,
  modello text not null,
  indice integer not null,
  esito text,   -- consegnato | rientra — nessun default che li faccia sparire dalla vista
  iscritto_id uuid references public.iscritti(id) on delete set null,
  unique (chiusura_id, modello, indice)
);

-- Blocco 4b: pezzi presi dai kit in aula per sostituire un difettoso.
-- Qui non c'è una vendita a registrarlo, quindi serve una riga esplicita
create table if not exists public.chiusura_corso_prelievi (
  id uuid primary key default gen_random_uuid(),
  chiusura_id uuid not null references public.chiusura_corso(id) on delete cascade,
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  quantita integer not null default 1,
  -- true: torna indietro anche il pezzo rotto, in giacenza separata.
  -- false: il pezzo è perso, ed è uno scarto dichiarato dalla master
  guasto_riconsegnato boolean not null default false,
  iscritto_id uuid references public.iscritti(id) on delete set null,
  dichiarato_da text,
  ts timestamptz not null default now()
);

-- La bolla: una riga per cosa deve tornare indietro
create table if not exists public.chiusura_corso_righe (
  id uuid primary key default gen_random_uuid(),
  chiusura_id uuid not null references public.chiusura_corso(id) on delete cascade,
  tipo text not null,   -- kit | prodotto | dermografo | reso_difettoso
  kit_id uuid references public.kit_definizioni(id) on delete set null,
  prodotto_id uuid references public.prodotti_shop(id) on delete set null,
  modello_dermografo text,
  atteso integer not null default 0,
  dichiarato integer,   -- valorizzato solo se la master corregge l'atteso
  motivo text,          -- da elenco chiuso, mai scritto a mano
  ricevuto integer,     -- lo scrive Raf al ricevimento
  ts timestamptz not null default now()
);

-- I pezzi difettosi tornati indietro: giacenza separata, non tornano
-- disponibili né per i kit né per lo shop. Dopo qualche mese questa
-- tabella dice quali prodotti si rompono davvero e con che frequenza
create table if not exists public.resi_difettosi (
  id uuid primary key default gen_random_uuid(),
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  quantita integer not null default 1,
  corso_data_id uuid references public.corsi_date(id) on delete set null,
  iscritto_id uuid references public.iscritti(id) on delete set null,
  stato text not null default 'in_giacenza',   -- in_giacenza | reso_fornitore | smaltito
  nota text,
  ts timestamptz not null default now()
);

create index if not exists idx_chiusura_corso_data on public.chiusura_corso (corso_data_id);
create index if not exists idx_chiusura_consegne on public.chiusura_corso_consegne (chiusura_id);
create index if not exists idx_chiusura_dermografi on public.chiusura_corso_dermografi (chiusura_id);
create index if not exists idx_chiusura_prelievi on public.chiusura_corso_prelievi (chiusura_id);
create index if not exists idx_chiusura_righe on public.chiusura_corso_righe (chiusura_id);
create index if not exists idx_resi_difettosi_prodotto on public.resi_difettosi (prodotto_id);

-- RLS come tutte le altre tabelle dell'app: l'app si collega con la chiave
-- anonima, una policy "to authenticated" qui rifiuterebbe ogni scrittura
do $$
declare t text;
begin
  foreach t in array array['chiusura_corso','chiusura_corso_consegne','chiusura_corso_dermografi','chiusura_corso_prelievi','chiusura_corso_righe','resi_difettosi'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "accesso interno %s" on public.%I', t, t);
    execute format('create policy "accesso interno %s" on public.%I for all to anon, authenticated using (true) with check (true)', t, t);
  end loop;
end $$;
