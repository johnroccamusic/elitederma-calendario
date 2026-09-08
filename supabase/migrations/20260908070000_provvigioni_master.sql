-- Provvigioni delle master sulla vendita prodotti.
--
-- La provvigione si prende sul MARGINE (ricavo netto senza IVA e
-- spedizione, meno costo d'acquisto) e mai sul prezzo di vendita: su un
-- prodotto rivenduto a poco piu' di quanto costa non c'e' niente da
-- dividere. Quanto di quel margine va alla master lo dicono le fasce qui
-- sotto: piu' il margine e' alto, piu' se ne cede.
--
-- Due canali separati, perche' sono due lavori diversi: al corso la
-- classe e' gia' li', con il referral la master porta gente da fuori — e
-- infatti il referral e' premiato di piu'.
create table if not exists public.provvigioni_fasce (
  id uuid primary key default gen_random_uuid(),
  canale text not null check (canale in ('corso', 'referral')),
  -- soglie in PERCENTUALE di margine: "da" incluso, "a" escluso.
  -- L'ultima fascia di ogni canale ha margine_a null e vale da li' in su.
  margine_da numeric not null default 0,
  margine_a numeric,
  -- quanto di quel margine va alla master, in percentuale
  percentuale numeric not null check (percentuale >= 0 and percentuale <= 100),
  creato_il timestamptz not null default now()
);

create index if not exists provvigioni_fasce_canale_idx
  on public.provvigioni_fasce (canale, margine_da);

alter table public.provvigioni_fasce enable row level security;

-- NOTA ONESTA sul "solo admin" chiesto a specifica: oggi non e'
-- ottenibile. L'app non fa login su Supabase (main.jsx monta App
-- direttamente) e parla al database come `anon` con la chiave
-- pubblicabile che sta nel bundle: una policy `to authenticated`
-- renderebbe la pagina di Setting inutilizzabile, e una qualunque altra
-- e' leggibile da chiunque abbia la chiave. Vedi la sezione 4 di
-- CLAUDE.md: finche' le 95 policy aperte non vengono chiuse, nessuna
-- tabella di questo progetto e' davvero riservata.
--
-- Quello che invece e' garantito dal codice: la dashboard della master
-- non legge MAI questa tabella. Gli importi che vede sono congelati sulla
-- riga della vendita al momento in cui la vendita avviene, quindi le
-- percentuali non passano da nessuna parte vicino a lei.
drop policy if exists "staff provvigioni_fasce" on public.provvigioni_fasce;
create policy "staff provvigioni_fasce"
  on public.provvigioni_fasce
  for all to anon, authenticated
  using (true) with check (true);

comment on table public.provvigioni_fasce is
  'Fasce di provvigione sulla vendita prodotti: per canale (corso/referral), quanta parte del margine va alla master.';

-- Le fasce di partenza. Si inseriscono una volta sola: da qui in poi le
-- cambia Setting -> Definizione provvigioni, e ricaricare i default
-- sopra a delle modifiche fatte a mano sarebbe il modo piu' rapido di
-- perderle.
insert into public.provvigioni_fasce (canale, margine_da, margine_a, percentuale)
select * from (values
  ('corso',    0,   20,   10),
  ('corso',    20,  35,   15),
  ('corso',    35,  50,   20),
  ('corso',    50,  null, 25),
  ('referral', 0,   20,   15),
  ('referral', 20,  35,   22),
  ('referral', 35,  50,   30),
  ('referral', 50,  null, 35)
) as v(canale, margine_da, margine_a, percentuale)
where not exists (select 1 from public.provvigioni_fasce);

-- La provvigione si congela sulla vendita nel momento in cui la vendita
-- si registra. Cambiare le fasce domani non deve toccare un euro di
-- quello che e' gia' stato maturato: una provvigione e' un compenso, non
-- una formula da rieseguire.
alter table public.vendite_shop
  add column if not exists provvigione_master numeric,
  add column if not exists provvigione_canale text,
  -- i pezzi che da soli non arrivano a un euro: non danno punti, ma
  -- contano a numero per i premi a volume
  add column if not exists provvigione_pezzi integer not null default 0,
  -- il conto riga per riga com'era quel giorno: margine, fascia,
  -- percentuale. Serve a spiegare un importo mesi dopo, quando le fasce
  -- non sono piu' quelle
  add column if not exists provvigione_dettaglio jsonb;

comment on column public.vendite_shop.provvigione_master is
  'Provvigione maturata dalla master su questa vendita, congelata al momento della vendita. Non si ricalcola.';
comment on column public.vendite_shop.provvigione_pezzi is
  'Pezzi la cui provvigione era sotto 1 euro: non danno euro, contano per i premi a volume.';
