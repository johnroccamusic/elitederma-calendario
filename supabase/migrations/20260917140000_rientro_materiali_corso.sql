-- ============================================================
-- MODULO "RIENTRO MATERIALI CORSO" — fase 1: lo schema
-- ============================================================
--
-- Il principio del modulo: la scheda di rientro non si compila a fine
-- corso, si compila DURANTE il corso e basta. Ogni pezzo che esce da un
-- kit di riserva lascia una traccia nel momento in cui esce — la vendita
-- al POS la lascia da sola, la sostituzione la lascia la master con tre
-- tap — e a fine corso la master trova una scheda gia' piena da
-- confermare, non un foglio bianco da riempire.
--
-- Da qui la forma delle tabelle: il centro non e' il rientro, e'
-- prelievi_kit_riserva. Tutto il resto o lo alimenta o lo legge.
--
-- Migration puramente additiva: otto tabelle nuove e tre colonne nuove
-- nullable su vendite_shop. Niente drop, niente alter su colonne
-- esistenti, nessun dato toccato.
--
-- Nomi adattati alle convenzioni del progetto, come chiesto dalla spec:
--   edizione_corso_id -> corso_data_id  (l'edizione e' corsi_date)
--   allievo_id        -> iscritto_id    (l'allievo e' iscritti)
--   kit_tipo_id       -> kit_id         (il tipo di kit e' kit_definizioni)
--   created_by/_at    -> creata_da / *_ts / ts
--
-- Le policy ricalcano quelle in vigore su tutte le altre tabelle
-- (anon + authenticated): oggi nessun utente dell'app ha una sessione
-- Supabase, sono tutti anon. Chiudere qui a 'authenticated' renderebbe
-- il modulo invisibile a chiunque. Si stringe quando si stringe per
-- tutti, non prima.


-- ------------------------------------------------------------
-- 1. LA SPEDIZIONE — testata di cosa parte verso un'edizione
-- ------------------------------------------------------------
create table if not exists spedizioni_corso (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references corsi_date(id) on delete cascade,
  master_id uuid references master(id),
  data_spedizione date,
  stato text not null default 'bozza'
    check (stato in ('bozza', 'spedita', 'in_rientro', 'chiusa', 'chiusa_con_anomalie')),
  -- quanti allievi c'erano quando il pacco e' partito. E' una fotografia,
  -- non una lettura: serve all'analisi dei consumi, dove il consumo per
  -- allievo e' l'unica metrica che rende confrontabili classi di
  -- dimensioni diverse. Se domani un'iscritta si ritira, il consumo per
  -- allievo di quel corso non deve cambiare a posteriori.
  n_allievi_previsti integer,
  creata_da text,
  chiusa_ts timestamptz,
  ts timestamptz not null default now()
);
create index if not exists idx_spedizioni_corso_edizione on spedizioni_corso(corso_data_id);
comment on table spedizioni_corso is
  'Testata della spedizione di materiali verso un''edizione di corso. n_allievi_previsti e'' uno snapshot alla partenza, non si ricalcola.';

alter table spedizioni_corso enable row level security;
drop policy if exists "accesso interno spedizioni_corso" on spedizioni_corso;
create policy "accesso interno spedizioni_corso" on spedizioni_corso
  for all to anon, authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 2. COSA E' PARTITO — una riga per elemento spedito
-- ------------------------------------------------------------
-- Quattro tipologie, quattro logiche di chiusura diverse:
--   kit_allievo  1 per iscritto, si chiude con un tap consegnato/no
--   kit_riserva  kit interi extra, apribili: tre destini possibili
--   sfuso        prodotti a quantita' (dischetti, cotton fioc)
--   dermografo   beni di valore senza matricola, si contano a quantita'
create table if not exists spedizione_righe (
  id uuid primary key default gen_random_uuid(),
  spedizione_id uuid not null references spedizioni_corso(id) on delete cascade,
  tipo text not null check (tipo in ('kit_allievo', 'kit_riserva', 'sfuso', 'dermografo')),
  kit_id uuid references kit_definizioni(id),
  prodotto_id uuid references prodotti_shop(id),
  quantita_spedita integer not null default 0,
  ts timestamptz not null default now(),
  -- un kit e' identificato da kit_id, un prodotto da prodotto_id: una
  -- riga senza ne' l'uno ne' l'altro non dice cosa e' partito
  constraint riga_ha_un_riferimento check (kit_id is not null or prodotto_id is not null)
);
create index if not exists idx_spedizione_righe_spedizione on spedizione_righe(spedizione_id);
comment on table spedizione_righe is
  'Cosa e'' partito, riga per riga. Il riferimento e'' kit_id per i kit, prodotto_id per sfusi e dermografi.';

alter table spedizione_righe enable row level security;
drop policy if exists "accesso interno spedizione_righe" on spedizione_righe;
create policy "accesso interno spedizione_righe" on spedizione_righe
  for all to anon, authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 3. I KIT DI RISERVA, UNO PER UNO
-- ------------------------------------------------------------
-- Se partono 4 kit di riserva qui ci sono 4 righe, non una riga con
-- quantita' 4. E' questo che permette di rispondere alla domanda "il kit
-- riserva #2 che fine ha fatto?", che a quantita' aggregata non si puo'
-- nemmeno formulare.
create table if not exists kit_riserva_istanze (
  id uuid primary key default gen_random_uuid(),
  spedizione_id uuid not null references spedizioni_corso(id) on delete cascade,
  kit_id uuid not null references kit_definizioni(id),
  progressivo integer not null,
  stato text not null default 'sigillato'
    check (stato in ('sigillato', 'aperto', 'consegnato_intero', 'rientrato_chiuso')),
  -- valorizzato solo quando il kit e' stato dato intero a un'iscritta
  -- non prevista: negli altri tre stati resta vuoto
  iscritto_id uuid references iscritti(id),
  ts timestamptz not null default now(),
  unique (spedizione_id, kit_id, progressivo)
);
create index if not exists idx_kit_riserva_istanze_spedizione on kit_riserva_istanze(spedizione_id);
comment on table kit_riserva_istanze is
  'Ogni kit di riserva spedito e'' una riga a se'', numerata. Lo stato "aperto" lo mette anche la vendita al POS, non solo la scheda di rientro.';

alter table kit_riserva_istanze enable row level security;
drop policy if exists "accesso interno kit_riserva_istanze" on kit_riserva_istanze;
create policy "accesso interno kit_riserva_istanze" on kit_riserva_istanze
  for all to anon, authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 4. COSA C'ERA DENTRO — la foto, non la distinta
-- ------------------------------------------------------------
-- Questa NON e' un riferimento dinamico a corsi_kit_prodotti: e' una
-- copia del contenuto scattata alla partenza. La distinta di un kit
-- cambia nel tempo — si sostituisce un pigmento, si toglie un
-- accessorio — e se al rientro rileggessimo la distinta di oggi
-- scopriremmo che nel pacco di tre mesi fa c'era una cosa che allora non
-- c'era. La foto non cambia mai.
create table if not exists kit_riserva_componenti (
  id uuid primary key default gen_random_uuid(),
  kit_riserva_id uuid not null references kit_riserva_istanze(id) on delete cascade,
  prodotto_id uuid not null references prodotti_shop(id),
  quantita_iniziale integer not null default 0,
  quantita_prelevata integer not null default 0,
  ts timestamptz not null default now(),
  unique (kit_riserva_id, prodotto_id)
);
create index if not exists idx_kit_riserva_componenti_kit on kit_riserva_componenti(kit_riserva_id);
comment on column kit_riserva_componenti.quantita_prelevata is
  'Quanti pezzi sono gia'' usciti da questo kit. quantita_iniziale - quantita_prelevata e'' cio'' che il POS guarda per decidere se chiedere la provenienza.';

alter table kit_riserva_componenti enable row level security;
drop policy if exists "accesso interno kit_riserva_componenti" on kit_riserva_componenti;
create policy "accesso interno kit_riserva_componenti" on kit_riserva_componenti
  for all to anon, authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 5. LE SOSTITUZIONI — registrate quando avvengono
-- ------------------------------------------------------------
-- Si compila col pezzo rotto in mano, non a fine corso quando non si
-- ricorda piu' niente. Oltre a precompilare la scheda di rientro
-- costruisce lo storico dei difetti per prodotto, che oggi non esiste.
create table if not exists sostituzioni (
  id uuid primary key default gen_random_uuid(),
  spedizione_id uuid not null references spedizioni_corso(id) on delete cascade,
  kit_riserva_id uuid references kit_riserva_istanze(id),
  iscritto_id uuid references iscritti(id),
  -- cosa e' stato preso dal kit di riserva
  prodotto_prelevato_id uuid not null references prodotti_shop(id),
  -- cosa era difettoso o mancante nel kit dell'allieva
  prodotto_sostituito_id uuid references prodotti_shop(id),
  motivo text not null check (motivo in ('danneggiato', 'mancante', 'non_funzionante', 'altro')),
  nota text,
  foto_url text,
  -- il pezzo difettoso di norma torna indietro: se non torna (perso,
  -- buttato in aula) il magazzino non deve aspettarselo
  difettoso_rientra boolean not null default true,
  ts timestamptz not null default now()
);
create index if not exists idx_sostituzioni_spedizione on sostituzioni(spedizione_id);
create index if not exists idx_sostituzioni_prodotto_sostituito on sostituzioni(prodotto_sostituito_id);

alter table sostituzioni enable row level security;
drop policy if exists "accesso interno sostituzioni" on sostituzioni;
create policy "accesso interno sostituzioni" on sostituzioni
  for all to anon, authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 6. I PRELIEVI — la tabella centrale
-- ------------------------------------------------------------
-- Ogni pezzo che esce da un kit di riserva genera una riga qui, col suo
-- motivo e con l'atto che l'ha generato. E' il libro mastro del modulo:
-- la scheda di rientro non e' altro che questa tabella, letta e
-- confermata.
create table if not exists prelievi_kit_riserva (
  id uuid primary key default gen_random_uuid(),
  kit_riserva_id uuid not null references kit_riserva_istanze(id) on delete cascade,
  prodotto_id uuid not null references prodotti_shop(id),
  quantita integer not null default 1,
  motivo text not null check (motivo in ('vendita', 'sostituzione')),
  vendita_id uuid references vendite_shop(id),
  sostituzione_id uuid references sostituzioni(id),
  origine text not null check (origine in ('pos_automatico', 'quadro_sostituzioni', 'dichiarato_al_rientro')),
  ts timestamptz not null default now(),

  -- Una sostituzione senza la sua riga in sostituzioni non e'
  -- ricostruibile: chi ha sostituito cosa, e perche', sta solo li'.
  constraint prelievo_sostituzione_tracciata
    check (motivo <> 'sostituzione' or sostituzione_id is not null),

  -- Sulle vendite il vincolo e' piu' lasco di quanto chieda la spec, e
  -- di proposito. La spec dice "motivo = vendita implica vendita_id NOT
  -- NULL", ma il paragrafo sulla riconciliazione descrive esattamente il
  -- caso opposto: "dichiarate 3 vendite, trovate 2 operazioni POS". Quella
  -- terza vendita dichiarata al rientro e senza riscontro al POS E' la
  -- discrepanza da segnalare, e col vincolo stretto non si potrebbe
  -- nemmeno scriverla. Quindi: la vendita nata dal POS deve portare il
  -- suo id — li' il dato c'e' sempre — mentre quella dichiarata a mano
  -- puo' non averlo, ed e' precisamente cio' che accende l'anomalia.
  constraint prelievo_vendita_da_pos_tracciata
    check (origine <> 'pos_automatico' or motivo <> 'vendita' or vendita_id is not null)
);
create index if not exists idx_prelievi_kit_riserva_kit on prelievi_kit_riserva(kit_riserva_id);
create index if not exists idx_prelievi_kit_riserva_vendita on prelievi_kit_riserva(vendita_id);

alter table prelievi_kit_riserva enable row level security;
drop policy if exists "accesso interno prelievi_kit_riserva" on prelievi_kit_riserva;
create policy "accesso interno prelievi_kit_riserva" on prelievi_kit_riserva
  for all to anon, authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 7. LA SCHEDA DI RIENTRO
-- ------------------------------------------------------------
-- Una sola per spedizione. Si chiude SEMPRE: se i conti non tornano si
-- alza ha_anomalie e l'avviso arriva a chi riceve il pacco. L'unica
-- eccezione e' la quadratura dei dermografi, che blocca.
create table if not exists rientri (
  id uuid primary key default gen_random_uuid(),
  spedizione_id uuid not null unique references spedizioni_corso(id) on delete cascade,
  master_id uuid references master(id),
  stato text not null default 'aperto' check (stato in ('aperto', 'chiuso')),
  chiuso_ts timestamptz,
  ha_anomalie boolean not null default false,
  note_anomalie jsonb not null default '[]'::jsonb,
  ts timestamptz not null default now()
);
comment on column rientri.note_anomalie is
  'Elenco delle discrepanze trovate alla chiusura, in JSON. Non blocca la chiusura: e'' materiale per chi verifica il pacco allo scaffale.';

alter table rientri enable row level security;
drop policy if exists "accesso interno rientri" on rientri;
create policy "accesso interno rientri" on rientri
  for all to anon, authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 8. LE RIGHE DELLA SCHEDA — la dichiarazione della master
-- ------------------------------------------------------------
create table if not exists rientro_righe (
  id uuid primary key default gen_random_uuid(),
  rientro_id uuid not null references rientri(id) on delete cascade,
  spedizione_riga_id uuid not null references spedizione_righe(id) on delete cascade,
  tipo text not null check (tipo in ('kit_allievo', 'kit_riserva', 'sfuso', 'dermografo')),
  quantita_rientrata integer not null default 0,
  quantita_venduta integer not null default 0,
  quantita_guasta integer not null default 0,
  quantita_consegnata integer not null default 0,
  -- derivata: spedito - rientrata - venduta - guasta - consegnata.
  -- Sta in colonna e non in un campo calcolato perche' il "spedito" vive
  -- su un'altra tabella, e perche' il consumo va congelato al momento
  -- della chiusura: e' il dato su cui poggia l'analisi dei consumi, e
  -- non deve cambiare se domani si corregge la riga di spedizione.
  quantita_consumata_calcolata integer,
  ts timestamptz not null default now(),
  unique (rientro_id, spedizione_riga_id)
);
create index if not exists idx_rientro_righe_rientro on rientro_righe(rientro_id);

alter table rientro_righe enable row level security;
drop policy if exists "accesso interno rientro_righe" on rientro_righe;
create policy "accesso interno rientro_righe" on rientro_righe
  for all to anon, authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 9. LA PROVENIENZA SULLE VENDITE
-- ------------------------------------------------------------
-- Tre colonne nuove, tutte nullable: le 4.133 vendite gia' registrate
-- restano esattamente come sono.
--
-- Il problema che risolvono: se il kit di riserva contiene un pigmento
-- rosso e la master ne vende uno, nessuno puo' sapere a posteriori se il
-- pezzo e' uscito dal kit che ha in aula o va spedito dal magazzino
-- centrale. Chiederlo al momento della vendita costa un tap; ricostruirlo
-- dopo non si puo' fare per niente.
alter table vendite_shop add column if not exists provenienza text;
alter table vendite_shop add column if not exists kit_riserva_id uuid references kit_riserva_istanze(id);
alter table vendite_shop add column if not exists spedizione_id uuid references spedizioni_corso(id);

comment on column vendite_shop.provenienza is
  'kit_riserva | magazzino_centrale. Valorizzata solo quando la domanda e'' stata posta, cioe'' quando il prodotto era davvero disponibile in un kit di riserva in aula: sul 95% delle vendite resta vuota e nessuno vede nessuna domanda.';
