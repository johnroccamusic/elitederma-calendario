-- LISTINI RIVENDITORI — il programma a livelli, il motore dei prezzi, la
-- qualifica e il regolamento.  18/11/2026.
--
-- Richiesta del titolare (specifica scritta): cinque livelli di sconto,
-- i prezzi ricavati dal costo d'acquisto con un ricarico minimo, la
-- qualifica su cicli di dodici mesi, un regolamento da consegnare.
--
-- TRE DECISIONI DI FONDO, scritte qui perché il codice non le dice.
--
-- 1. LA SCALA NUOVA NON SOSTITUISCE `v_prezzi_listini.sconto_max_pct`.
--    Quello sconto non serve solo al listino: decide i PUNTI delle master
--    (netto x sconto% x 2) e la loro PROVVIGIONE (sconto%/3). Rifarlo con
--    la formula nuova avrebbe spostato i punti di tutte le master senza
--    che nessuno lo chieda. Quindi questa è una scala che si AFFIANCA, e
--    `v_prezzi_listini` non è stata toccata di una riga.
--
-- 2. IL COSTO DEI BUNDLE ARRIVA DALLA DISTINTA, non da
--    `prodotti_shop.costo_acquisto` — che su un kit è vuoto. Per questo la
--    vista del listino si appoggia a `v_prezzi_listini`, che quella somma
--    la fa già: scriverla di nuovo qui vorrebbe dire due costi diversi
--    sullo stesso kit (Kit laminazione ciglia: colonna vuota, distinta
--    98,34).
--
-- 3. L'IVA È QUELLA DEL PRODOTTO, non 1,22 fisso. La specifica dice
--    «netto = pubblico / 1,22», ma due prodotti in archivio sono a IVA 0
--    (Consulenza Bianca e Consulenza Rossa): dividerli per 1,22 direbbe
--    114,75 invece di 140,00, venticinque euro di errore su una riga che
--    nessuno metterebbe in dubbio. Si usa `aliquota_iva` di ciascuno, e
--    sui 202 prodotti al 22% il risultato è identico.
--
-- Rollback in fondo al file.

-- ---------------------------------------------------------------------
-- 1. I PARAMETRI, modificabili dall'admin e non scritti nel codice
-- ---------------------------------------------------------------------
create table if not exists public.rivenditori_parametri (
  chiave        text primary key,
  numero        numeric not null,
  descrizione   text not null,
  aggiornato_il timestamptz not null default now(),
  aggiornato_da text
);

insert into public.rivenditori_parametri (chiave, numero, descrizione) values
  ('ricarico_minimo_pct', 30, 'Ricarico minimo sul costo d''acquisto: il prezzo non scende mai sotto costo x (1 + questo).'),
  ('tetto_sconto_pct',    50, 'Lo sconto massimo cedibile non supera questa percentuale: è lo sconto del livello più alto.'),
  ('master_base_pct',     10, 'Lo sconto di base di una master.'),
  ('master_promo_pct',    20, 'Lo sconto di una master che rispetta i criteri di promozione, verificati a trimestre.')
on conflict (chiave) do nothing;

-- ---------------------------------------------------------------------
-- 2. I LIVELLI
-- ---------------------------------------------------------------------
-- `frazione` è la fetta di sconto cedibile che quel livello si prende:
-- 1/5 Partner … 5/5 Distributor. Lo sconto NOMINALE (10/20/30/40/50) non
-- si scrive: è `frazione x tetto_sconto_pct`, e scriverlo accanto
-- vorrebbe dire due numeri che un giorno si contraddicono — si cambia il
-- tetto e le intestazioni continuerebbero a promettere il 50%.
--
-- `riassortimento_minimo_eur` fa due mestieri, e non è un risparmio: è il
-- minimo d'ordine del livello ED è la tabella dei riassortimenti della
-- specifica. Un ordine da 450 € prende il tetto del livello più alto il
-- cui minimo ci sta dentro — Premium, 40% — e infatti la riga «400-499,99»
-- della tabella dice 10/20/30/40/40. Tutte e sei le fasce tornano da
-- questi cinque numeri, quindi una tabella in più sarebbe la stessa
-- regola scritta due volte.
create table if not exists public.rivenditori_livelli (
  id                        serial primary key,
  codice                    text not null unique,
  nome                      text not null,
  ordine                    integer not null unique,
  frazione                  numeric not null check (frazione > 0 and frazione <= 1),
  ingresso_eur              numeric not null,
  ingresso_cumulabile       boolean not null default false,
  mantenimento_eur          numeric not null,
  riassortimento_minimo_eur numeric not null,
  attivo                    boolean not null default true,
  note                      text,
  aggiornato_il             timestamptz not null default now(),
  aggiornato_da             text
);

insert into public.rivenditori_livelli
  (codice, nome, ordine, frazione, ingresso_eur, ingresso_cumulabile, mantenimento_eur, riassortimento_minimo_eur, note) values
  ('partner',      'Partner',      1, 0.2, 500,  true,  500,  100, 'Ingresso con 500 € di acquisti cumulati, anche su più ordini: lo sconto vale dagli ordini successivi.'),
  ('standard',     'Standard',     2, 0.4, 500,  false, 1000, 150, 'Ingresso con un singolo ordine da 500 €, con lo sconto già applicato a quell''ordine.'),
  ('professional', 'Professional', 3, 0.6, 1000, false, 2500, 250, 'Ingresso con un singolo ordine da 1.000 €.'),
  ('premium',      'Premium',      4, 0.8, 2000, false, 5000, 400, 'Ingresso con un singolo ordine da 2.000 €.'),
  ('distributor',  'Distributor',  5, 1.0, 3000, false, 7500, 500, 'Ingresso con un singolo ordine da 3.000 €.')
on conflict (codice) do nothing;

-- ---------------------------------------------------------------------
-- 3. IL MOTORE DEI PREZZI — una formula, in un posto solo
-- ---------------------------------------------------------------------
-- Sta in SQL e non nel browser per la ragione del punto 6 della
-- specifica: «il listino e l'export per i rivenditori non devono mai
-- ricevere costi e margini dal server». Se il prezzo per livello lo
-- calcolasse la pagina, il costo dovrebbe uscire dal database per forza.
-- Qui esce il prezzo e il costo resta dentro.
create or replace function public.listino_cedibile(
  p_netto numeric, p_costo numeric, p_ricarico_pct numeric, p_tetto_pct numeric)
returns numeric
language sql immutable
set search_path = public, pg_temp
as $$
  -- Il costo che manca vale TETTO, non zero: è la regola scritta nella
  -- specifica («se il costo manca -> 50% e segnalazione "Costo
  -- mancante"»). Zero avrebbe fatto sparire dal listino i prodotti di cui
  -- non sappiamo il costo, invece di nominarli.
  select case
    when p_netto is null or p_netto <= 0 then null
    when p_costo is null or p_costo <= 0 then round(p_tetto_pct / 100.0, 3)
    else greatest(0::numeric, least(
      round(p_tetto_pct / 100.0, 3),
      -- SI TRONCA, non si arrotonda, e il motivo è una regola del
      -- titolare: «il prezzo non deve MAI scendere sotto costo x (1 +
      -- ricarico)». Arrotondando per eccesso al terzo decimale lo sconto
      -- cresce di mezzo millesimo e quel pavimento si sfonda. Troncando,
      -- lo sconto può solo essere più piccolo del dovuto. (Resta mezzo
      -- centesimo di gioco nell'arrotondamento del prezzo: su una cifra
      -- che si fattura non si può fare di meglio.)
      trunc((1 - p_costo * (1 + p_ricarico_pct / 100.0) / p_netto) * 1000) / 1000
    ))
  end;
$$;

create or replace function public.listino_prezzo_livello(
  p_netto numeric, p_cedibile numeric, p_frazione numeric)
returns numeric
language sql immutable
set search_path = public, pg_temp
as $$
  select case when p_netto is null or p_cedibile is null or p_frazione is null then null
    else round(p_netto * (1 - p_cedibile * p_frazione), 2) end;
$$;

-- La vista dell'admin: qui i costi e i margini CI SONO, ed è l'unico
-- posto in cui ci sono.
create or replace view public.v_listino_rivenditori
with (security_invoker = true) as
with par as (
  select
    coalesce((select numero from rivenditori_parametri where chiave = 'ricarico_minimo_pct'), 30) as ricarico_pct,
    coalesce((select numero from rivenditori_parametri where chiave = 'tetto_sconto_pct'), 50)    as tetto_pct
), base as (
  select
    vl.id, vl.nome, vl.tipo, vl.blocco, vl.blocco_ordine, vl.foto_url, vl.sullo_shop,
    vl.pubblico_lordo, vl.pubblico_netto, vl.aliquota_iva,
    vl.costo_acquisto as costo, vl.componenti_distinta, vl.componenti_senza_costo,
    par.ricarico_pct, par.tetto_pct,
    listino_cedibile(vl.pubblico_netto, vl.costo_acquisto, par.ricarico_pct, par.tetto_pct) as cedibile
  from v_prezzi_listini vl cross join par
), conto as (
  select b.*,
    (select jsonb_object_agg(l.codice, listino_prezzo_livello(b.pubblico_netto, b.cedibile, l.frazione))
       from rivenditori_livelli l where l.attivo) as prezzi,
    (select jsonb_object_agg(l.codice, round(b.cedibile * l.frazione * 100, 1))
       from rivenditori_livelli l where l.attivo) as sconti_pct,
    listino_prezzo_livello(b.pubblico_netto, b.cedibile,
      (select max(l.frazione) from rivenditori_livelli l where l.attivo)) as prezzo_minimo
  from base b
)
select
  id, nome, tipo, blocco, blocco_ordine, foto_url, sullo_shop,
  pubblico_lordo, pubblico_netto, aliquota_iva,
  costo, componenti_distinta, componenti_senza_costo,
  ricarico_pct, tetto_pct,
  round(cedibile * 100, 1) as sconto_max_pct,
  prezzi, sconti_pct,
  prezzo_minimo as prezzo_distributor,
  case when costo is not null and prezzo_minimo > 0
    then round((prezzo_minimo - costo) / prezzo_minimo * 100, 1) end as margine_distributor_pct,
  case when costo is not null then round(prezzo_minimo - costo, 2) end as margine_distributor_eur,
  -- Le tre note della specifica, nell'ordine in cui si escludono.
  case
    when costo is null then 'costo_mancante'
    when cedibile <= 0 then 'nessuno_sconto'
    when cedibile < tetto_pct / 100.0 then 'ridotto'
    else 'pieno'
  end as nota
from conto;

comment on view public.v_listino_rivenditori is
  'Listino rivenditori per chi amministra: prezzi per livello PIÙ costo, margine e sconto cedibile. Per l''export si usa listino_rivenditori_export(), che quei tre campi non li restituisce.';

-- L'EXPORT. È una funzione `security definer` e non una vista, ed è la
-- differenza che la specifica chiede: legge i costi DENTRO di sé (coi
-- permessi del proprietario) e restituisce solo quello che un rivenditore
-- può leggere. Il giorno in cui i rivenditori avranno un ruolo loro basta
-- concedere l'execute su questa e niente altro: il costo non è nascosto
-- dall'interfaccia, non esce.
--
-- Quello che NON torna: costo, margine in euro, margine in percentuale.
-- `sconto_max_pct` invece torna, ed è voluto: sul listino è la colonna
-- «Sconto max sul prodotto» che la specifica chiede, cioè lo sconto del
-- Distributor — un dato commerciale, non il costo.
create or replace function public.listino_rivenditori_export()
returns table (
  id uuid, nome text, blocco text, blocco_ordine integer,
  pubblico_lordo numeric, pubblico_netto numeric, aliquota_iva numeric,
  prezzi jsonb, sconti_pct jsonb, sconto_max_pct numeric, sullo_shop boolean
)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select id, nome, blocco, blocco_ordine,
         pubblico_lordo, pubblico_netto, aliquota_iva,
         prezzi, sconti_pct, sconto_max_pct, sullo_shop
  from public.v_listino_rivenditori;
$$;

-- ---------------------------------------------------------------------
-- 4. IL REGISTRO DELLE MODIFICHE (punto 6 della specifica)
-- ---------------------------------------------------------------------
-- Lo scrive un TRIGGER e non la pagina, e questa è la differenza fra un
-- registro e una buona intenzione: il prezzo di un prodotto si cambia
-- anche dalla scheda in Gestione magazzino, dall'elenco a righe e dal
-- sito. Un registro scritto dalla pagina del listino avrebbe raccontato
-- solo le modifiche fatte dal listino.
--
-- Il nome di chi ha premuto arriva da `app.operatore`, che la funzione
-- `listino_scrivi_prezzo` imposta per la durata della transazione. Una
-- scrittura che arriva da un'altra strada resta registrata comunque, con
-- scritto che il nome non c'è: meglio una riga senza nome che nessuna
-- riga.
create table if not exists public.rivenditori_modifiche (
  id            bigserial primary key,
  quando        timestamptz not null default now(),
  chi           text,
  ambito        text not null check (ambito in ('prezzo', 'costo', 'parametro', 'livello')),
  riferimento   text not null,
  campo         text not null,
  valore_prima  text,
  valore_dopo   text
);
create index if not exists rivenditori_modifiche_quando on public.rivenditori_modifiche (quando desc);
create index if not exists rivenditori_modifiche_riferimento on public.rivenditori_modifiche (ambito, riferimento);

create or replace function public.rivenditori_traccia_modifica()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_chi text := nullif(current_setting('app.operatore', true), '');
begin
  if tg_table_name = 'prodotti_shop' then
    if new.prezzo_vendita is distinct from old.prezzo_vendita then
      insert into rivenditori_modifiche (chi, ambito, riferimento, campo, valore_prima, valore_dopo)
      values (coalesce(v_chi, 'non registrato'), 'prezzo', new.nome, 'prezzo_netto',
              old.prezzo_vendita::text, new.prezzo_vendita::text);
    end if;
    if new.costo_acquisto is distinct from old.costo_acquisto then
      insert into rivenditori_modifiche (chi, ambito, riferimento, campo, valore_prima, valore_dopo)
      values (coalesce(v_chi, 'non registrato'), 'costo', new.nome, 'costo_acquisto',
              old.costo_acquisto::text, new.costo_acquisto::text);
    end if;
  elsif tg_table_name = 'rivenditori_parametri' then
    if new.numero is distinct from old.numero then
      insert into rivenditori_modifiche (chi, ambito, riferimento, campo, valore_prima, valore_dopo)
      values (coalesce(new.aggiornato_da, v_chi, 'non registrato'), 'parametro', new.chiave, 'numero',
              old.numero::text, new.numero::text);
    end if;
  elsif tg_table_name = 'rivenditori_livelli' then
    -- un livello ha sei numeri che contano: si registra quello cambiato,
    -- uno per riga, perché «ha cambiato il livello Premium» non dice cosa
    insert into rivenditori_modifiche (chi, ambito, riferimento, campo, valore_prima, valore_dopo)
    select coalesce(new.aggiornato_da, v_chi, 'non registrato'), 'livello', new.codice, c.campo, c.prima, c.dopo
    from (values
      ('frazione', old.frazione::text, new.frazione::text),
      ('ingresso_eur', old.ingresso_eur::text, new.ingresso_eur::text),
      ('mantenimento_eur', old.mantenimento_eur::text, new.mantenimento_eur::text),
      ('riassortimento_minimo_eur', old.riassortimento_minimo_eur::text, new.riassortimento_minimo_eur::text),
      ('attivo', old.attivo::text, new.attivo::text),
      ('nome', old.nome, new.nome)
    ) as c(campo, prima, dopo)
    where c.prima is distinct from c.dopo;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_rivenditori_traccia_prezzi on public.prodotti_shop;
create trigger trg_rivenditori_traccia_prezzi
  after update of prezzo_vendita, costo_acquisto on public.prodotti_shop
  for each row execute function public.rivenditori_traccia_modifica();

drop trigger if exists trg_rivenditori_traccia_parametri on public.rivenditori_parametri;
create trigger trg_rivenditori_traccia_parametri
  after update on public.rivenditori_parametri
  for each row execute function public.rivenditori_traccia_modifica();

drop trigger if exists trg_rivenditori_traccia_livelli on public.rivenditori_livelli;
create trigger trg_rivenditori_traccia_livelli
  after update on public.rivenditori_livelli
  for each row execute function public.rivenditori_traccia_modifica();

-- La porta del listino per correggere prezzo pubblico e costo.
--
-- Scrive il NETTO, non il lordo: in questo progetto il lordo è quello che
-- si scrive e il netto lo segue a sei decimali (deciso il 26/09/2026,
-- altrimenti un prezzo su cinque torna a 39,89 invece di 39,90). Il
-- conto netto<-lordo lo fa la pagina, che è dove lo fanno già la scheda
-- prodotto e l'elenco a righe; qui arriva il netto.
--
-- Il nome di chi scrive serve al registro, e per quello si usa
-- `set_local`: dura questa transazione e non sporca la sessione.
create or replace function public.listino_scrivi_prezzo(
  p_prodotto_id uuid, p_prezzo_netto numeric, p_costo numeric, p_chi text,
  p_scrivi_prezzo boolean default true, p_scrivi_costo boolean default true)
returns void
language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.operatore', coalesce(p_chi, ''), true);
  if p_scrivi_prezzo and p_scrivi_costo then
    update prodotti_shop set prezzo_vendita = p_prezzo_netto, costo_acquisto = p_costo where id = p_prodotto_id;
  elsif p_scrivi_prezzo then
    update prodotti_shop set prezzo_vendita = p_prezzo_netto where id = p_prodotto_id;
  elsif p_scrivi_costo then
    update prodotti_shop set costo_acquisto = p_costo where id = p_prodotto_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. I RIVENDITORI, i loro acquisti, le verifiche delle master
-- ---------------------------------------------------------------------
-- Un rivenditore è una persona o una ditta che compra per rivendere.
-- Prima di oggi in archivio non esisteva: nessuna tabella, e nessun
-- ordine marcato come «di un rivenditore». Per questo l'elenco si cura a
-- mano e gli acquisti validi si scrivono qui — a mano o agganciando una
-- vendita — invece di essere indovinati dagli ordini dello shop.
-- `contatto_id` lega la scheda alla persona che è già in CRM, così il
-- nome non viene scritto due volte.
create table if not exists public.rivenditori (
  id                serial primary key,
  nome              text not null,
  contatto_id       uuid references public.crm_contatti(id) on delete set null,
  email             text,
  telefono          text,
  partita_iva       text,
  livello_id        integer references public.rivenditori_livelli(id) on delete set null,
  inizio_ciclo      date,
  master            boolean not null default false,
  master_sconto_pct numeric,
  ambassador        boolean not null default false,
  ambassador_note   text,
  note              text,
  attivo            boolean not null default true,
  creato_il         timestamptz not null default now(),
  creato_da         text
);
create index if not exists rivenditori_livello on public.rivenditori (livello_id);
create index if not exists rivenditori_contatto on public.rivenditori (contatto_id);

-- Gli acquisti validi: IVA esclusa, al netto degli sconti, spedizione
-- esclusa (punto 1 della specifica). Un reso è una riga NEGATIVA, non una
-- riga cancellata: «resi e note di credito riducono il volume», e un
-- volume che scende senza lasciare traccia non si spiega a nessuno.
create table if not exists public.rivenditori_ordini (
  id             bigserial primary key,
  rivenditore_id integer not null references public.rivenditori(id) on delete cascade,
  data           date not null,
  importo_netto  numeric not null,
  origine        text not null default 'manuale' check (origine in ('manuale', 'shop', 'banco')),
  vendita_id     uuid references public.vendite_shop(id) on delete set null,
  nota           text,
  creato_il      timestamptz not null default now(),
  creato_da      text
);
create index if not exists rivenditori_ordini_chi on public.rivenditori_ordini (rivenditore_id, data);

-- La verifica trimestrale delle master: la fa una persona, non un conto.
-- I criteri (tag della pagina, due post al mese, prodotti usati in aula)
-- non stanno in nessun dato che abbiamo.
create table if not exists public.rivenditori_verifiche (
  id             bigserial primary key,
  rivenditore_id integer not null references public.rivenditori(id) on delete cascade,
  periodo_dal    date not null,
  periodo_al     date not null,
  esito          text not null check (esito in ('rispettato', 'non_rispettato')),
  note           text,
  quando         timestamptz not null default now(),
  chi            text
);
create index if not exists rivenditori_verifiche_chi on public.rivenditori_verifiche (rivenditore_id, periodo_al desc);

-- ---------------------------------------------------------------------
-- 6. IL REGOLAMENTO, con lo storico delle versioni
-- ---------------------------------------------------------------------
-- Il corpo è jsonb e non testo: il regolamento ha un'intestazione, degli
-- articoli e le clausole da approvare per iscritto, e tenerlo come un
-- blocco di testo vorrebbe dire ritagliarlo a mano ogni volta che si
-- compone il PDF. Una versione non si cancella e non si riscrive: se
-- qualcuno l'ha firmata, quel testo deve restare leggibile.
create table if not exists public.rivenditori_regolamento (
  id            serial primary key,
  versione      text not null unique,
  in_vigore_dal date not null,
  corpo         jsonb not null,
  attivo        boolean not null default false,
  creato_il     timestamptz not null default now(),
  creato_da     text
);
create unique index if not exists rivenditori_regolamento_uno_attivo
  on public.rivenditori_regolamento (attivo) where attivo;

-- ---------------------------------------------------------------------
-- 7. PERMESSI
-- ---------------------------------------------------------------------
-- Come ogni tabella nuova dal 18/10/2026: RLS accesa, una policy sola per
-- `authenticated`, niente per `anon`.
--
-- QUELLO CHE QUESTE POLICY NON FANNO, e va detto perché la specifica
-- chiedeva di più: «solo gli admin» oggi non è esprimibile. L'account
-- Supabase è UNO per tutto lo staff (vedi § 4 del CLAUDE.md), quindi nel
-- gettone non c'è niente da cui dedurre se chi legge amministra. Una
-- policy che dicesse «solo admin» sarebbe teatro. Quello che è vero già
-- oggi è che `listino_rivenditori_export()` i costi non li restituisce, e
-- che il giorno in cui i ruoli passeranno dal JWT questa è la sola
-- funzione da concedere a un rivenditore.
do $$
declare t text;
begin
  foreach t in array array['rivenditori_parametri','rivenditori_livelli','rivenditori_modifiche',
                           'rivenditori','rivenditori_ordini','rivenditori_verifiche','rivenditori_regolamento']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_staff', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant usage, select on sequence public.rivenditori_id_seq to authenticated;
grant usage, select on sequence public.rivenditori_livelli_id_seq to authenticated;
grant usage, select on sequence public.rivenditori_ordini_id_seq to authenticated;
grant usage, select on sequence public.rivenditori_verifiche_id_seq to authenticated;
grant usage, select on sequence public.rivenditori_regolamento_id_seq to authenticated;
grant usage, select on sequence public.rivenditori_modifiche_id_seq to authenticated;

revoke all on public.v_listino_rivenditori from anon;
grant select on public.v_listino_rivenditori to authenticated;

revoke all on function public.listino_rivenditori_export() from public, anon;
grant execute on function public.listino_rivenditori_export() to authenticated;
revoke all on function public.listino_scrivi_prezzo(uuid, numeric, numeric, text, boolean, boolean) from public, anon;
grant execute on function public.listino_scrivi_prezzo(uuid, numeric, numeric, text, boolean, boolean) to authenticated;
revoke all on function public.listino_cedibile(numeric, numeric, numeric, numeric) from anon;
revoke all on function public.listino_prezzo_livello(numeric, numeric, numeric) from anon;
revoke all on function public.rivenditori_traccia_modifica() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- ROLLBACK (da eseguire a mano, in quest'ordine)
-- ---------------------------------------------------------------------
-- drop trigger if exists trg_rivenditori_traccia_prezzi on public.prodotti_shop;
-- drop trigger if exists trg_rivenditori_traccia_parametri on public.rivenditori_parametri;
-- drop trigger if exists trg_rivenditori_traccia_livelli on public.rivenditori_livelli;
-- drop function if exists public.rivenditori_traccia_modifica();
-- drop function if exists public.listino_scrivi_prezzo(uuid, numeric, numeric, text, boolean, boolean);
-- drop function if exists public.listino_rivenditori_export();
-- drop view if exists public.v_listino_rivenditori;
-- drop function if exists public.listino_prezzo_livello(numeric, numeric, numeric);
-- drop function if exists public.listino_cedibile(numeric, numeric, numeric, numeric);
-- drop table if exists public.rivenditori_verifiche;
-- drop table if exists public.rivenditori_ordini;
-- drop table if exists public.rivenditori;           -- ATTENZIONE: porta via l'anagrafica dei rivenditori
-- drop table if exists public.rivenditori_regolamento; -- ATTENZIONE: porta via le versioni del regolamento firmate
-- drop table if exists public.rivenditori_modifiche;   -- ATTENZIONE: porta via il registro delle modifiche
-- drop table if exists public.rivenditori_livelli;
-- drop table if exists public.rivenditori_parametri;
-- `v_prezzi_listini`, `prodotti_shop` e i punti delle master non sono
-- stati toccati: tornando indietro il listino di oggi è esattamente
-- quello di prima.
