-- LA MAILING LIST DEI CLIENTI SHOP (17/11/2026)
--
-- Il titolare: «dobbiamo attivare la possibilita' di fare mailing list
-- anche per i clienti shop, anche li' ci deve essere la possibilita' di
-- filtrarli e selezionarli comporre una mail come succede per la lista
-- di tutti i contatti importati dal CRM». E, sul come: «metti un filtro
-- che si chiama "solo quelli che non sono in CRM"», e si scrive a
-- «tutti».
--
-- MISURATO PRIMA DI SCRIVERE QUALUNQUE COSA: i clienti shop sono 1.888
-- email distinte su 4.291 ordini WooCommerce dal 15/03/2022. Di quelle,
-- 772 erano GIA' in `crm_contatti` e 1.116 non c'erano. Le 235 vendite
-- al banco non hanno nessuna email (al POS non si chiede) e restano
-- fuori: non c'e' niente da spedire.
--
-- UNA LISTA SOLA, E IL MOTIVO E' LA DISISCRIZIONE. I clienti shop
-- diventano righe di `crm_contatti` invece di una lista a parte, perche'
-- `crm_disiscrivi` scrive `disiscritto_il` su tutte le righe con quella
-- email e `crm_campagna_prepara` esclude per email: con due liste
-- separate, chi si e' disiscritto dalle mail del CRM continuerebbe a
-- ricevere quelle dello shop, e la seconda disiscrizione non avrebbe
-- dove essere scritta. Le 772 in comune non ricevono due copie perche'
-- `crm_campagna_prepara` fa il dedup per email: era gia' scritto.
--
-- E NON SERVE TOCCARE NE' LA PAGINA DELLE CAMPAGNE NE' L'INVIO:
-- `crm_cerca_contatti` e `crm_campagna_prepara` delegano tutto il
-- filtraggio a `crm_contatti_filtrati(filtri)`. I filtri nuovi si
-- aggiungono LA' DENTRO, in un posto solo, e valgono insieme per
-- l'elenco, per il totale e per i destinatari congelati di una
-- campagna. Due copie della WHERE darebbero due conteggi diversi.
--
-- ROLLBACK (in fondo al file).

-- ---------------------------------------------------------------------
-- 1. LE PROVINCE CON LA LORO REGIONE
--
-- Serve perche' l'ordine WooCommerce porta la sigla (`billing.state` =
-- «RM») e i filtri della pagina lavorano su `regione`/`provincia` con i
-- nomi per esteso. Senza questa tabella un cliente shop resterebbe
-- fuori dal filtro «Lazio» in silenzio — che e' il modo peggiore di
-- sbagliare, perche' l'elenco sembra completo.
--
-- Le righe sono GENERATE da `src/comuni-regioni.js` (l'elenco ISTAT che
-- sta gia' nel bundle) con `node scripts/genera-province-sql.mjs`, non
-- battute a mano; una prova del banco rilegge questo file e pretende
-- che coincidano.
create table if not exists public.province_regioni (
  sigla text primary key,
  provincia text not null,
  regione text not null
);

insert into public.province_regioni (sigla, provincia, regione) values
  ('AG', 'Agrigento', 'Sicilia'),
  ('AL', 'Alessandria', 'Piemonte'),
  ('AN', 'Ancona', 'Marche'),
  ('AR', 'Arezzo', 'Toscana'),
  ('AP', 'Ascoli Piceno', 'Marche'),
  ('AT', 'Asti', 'Piemonte'),
  ('AV', 'Avellino', 'Campania'),
  ('BA', 'Bari', 'Puglia'),
  ('BT', 'Barletta-Andria-Trani', 'Puglia'),
  ('BL', 'Belluno', 'Veneto'),
  ('BN', 'Benevento', 'Campania'),
  ('BG', 'Bergamo', 'Lombardia'),
  ('BI', 'Biella', 'Piemonte'),
  ('BO', 'Bologna', 'Emilia-Romagna'),
  ('BZ', 'Bolzano/Bozen', 'Trentino-Alto Adige/Südtirol'),
  ('BS', 'Brescia', 'Lombardia'),
  ('BR', 'Brindisi', 'Puglia'),
  ('CA', 'Cagliari', 'Sardegna'),
  ('CL', 'Caltanissetta', 'Sicilia'),
  ('CB', 'Campobasso', 'Molise'),
  ('CE', 'Caserta', 'Campania'),
  ('CT', 'Catania', 'Sicilia'),
  ('CZ', 'Catanzaro', 'Calabria'),
  ('CH', 'Chieti', 'Abruzzo'),
  ('CO', 'Como', 'Lombardia'),
  ('CS', 'Cosenza', 'Calabria'),
  ('CR', 'Cremona', 'Lombardia'),
  ('KR', 'Crotone', 'Calabria'),
  ('CN', 'Cuneo', 'Piemonte'),
  ('EN', 'Enna', 'Sicilia'),
  ('FM', 'Fermo', 'Marche'),
  ('FE', 'Ferrara', 'Emilia-Romagna'),
  ('FI', 'Firenze', 'Toscana'),
  ('FG', 'Foggia', 'Puglia'),
  ('FC', 'Forlì-Cesena', 'Emilia-Romagna'),
  ('FR', 'Frosinone', 'Lazio'),
  ('GE', 'Genova', 'Liguria'),
  ('GO', 'Gorizia', 'Friuli-Venezia Giulia'),
  ('GR', 'Grosseto', 'Toscana'),
  ('IM', 'Imperia', 'Liguria'),
  ('IS', 'Isernia', 'Molise'),
  ('AQ', 'L''Aquila', 'Abruzzo'),
  ('SP', 'La Spezia', 'Liguria'),
  ('LT', 'Latina', 'Lazio'),
  ('LE', 'Lecce', 'Puglia'),
  ('LC', 'Lecco', 'Lombardia'),
  ('LI', 'Livorno', 'Toscana'),
  ('LO', 'Lodi', 'Lombardia'),
  ('LU', 'Lucca', 'Toscana'),
  ('MC', 'Macerata', 'Marche'),
  ('MN', 'Mantova', 'Lombardia'),
  ('MS', 'Massa-Carrara', 'Toscana'),
  ('MT', 'Matera', 'Basilicata'),
  ('ME', 'Messina', 'Sicilia'),
  ('MI', 'Milano', 'Lombardia'),
  ('MO', 'Modena', 'Emilia-Romagna'),
  ('MB', 'Monza e della Brianza', 'Lombardia'),
  ('NA', 'Napoli', 'Campania'),
  ('NO', 'Novara', 'Piemonte'),
  ('NU', 'Nuoro', 'Sardegna'),
  ('OR', 'Oristano', 'Sardegna'),
  ('PD', 'Padova', 'Veneto'),
  ('PA', 'Palermo', 'Sicilia'),
  ('PR', 'Parma', 'Emilia-Romagna'),
  ('PV', 'Pavia', 'Lombardia'),
  ('PG', 'Perugia', 'Umbria'),
  ('PU', 'Pesaro e Urbino', 'Marche'),
  ('PE', 'Pescara', 'Abruzzo'),
  ('PC', 'Piacenza', 'Emilia-Romagna'),
  ('PI', 'Pisa', 'Toscana'),
  ('PT', 'Pistoia', 'Toscana'),
  ('PN', 'Pordenone', 'Friuli-Venezia Giulia'),
  ('PZ', 'Potenza', 'Basilicata'),
  ('PO', 'Prato', 'Toscana'),
  ('RG', 'Ragusa', 'Sicilia'),
  ('RA', 'Ravenna', 'Emilia-Romagna'),
  ('RC', 'Reggio Calabria', 'Calabria'),
  ('RE', 'Reggio nell''Emilia', 'Emilia-Romagna'),
  ('RI', 'Rieti', 'Lazio'),
  ('RN', 'Rimini', 'Emilia-Romagna'),
  ('RM', 'Roma', 'Lazio'),
  ('RO', 'Rovigo', 'Veneto'),
  ('SA', 'Salerno', 'Campania'),
  ('SS', 'Sassari', 'Sardegna'),
  ('SV', 'Savona', 'Liguria'),
  ('SI', 'Siena', 'Toscana'),
  ('SR', 'Siracusa', 'Sicilia'),
  ('SO', 'Sondrio', 'Lombardia'),
  ('SU', 'Sud Sardegna', 'Sardegna'),
  ('TA', 'Taranto', 'Puglia'),
  ('TE', 'Teramo', 'Abruzzo'),
  ('TR', 'Terni', 'Umbria'),
  ('TO', 'Torino', 'Piemonte'),
  ('TP', 'Trapani', 'Sicilia'),
  ('TN', 'Trento', 'Trentino-Alto Adige/Südtirol'),
  ('TV', 'Treviso', 'Veneto'),
  ('TS', 'Trieste', 'Friuli-Venezia Giulia'),
  ('UD', 'Udine', 'Friuli-Venezia Giulia'),
  ('AO', 'Valle d''Aosta/Vallée d''Aoste', 'Valle d''Aosta/Vallée d''Aoste'),
  ('VA', 'Varese', 'Lombardia'),
  ('VE', 'Venezia', 'Veneto'),
  ('VB', 'Verbano-Cusio-Ossola', 'Piemonte'),
  ('VC', 'Vercelli', 'Piemonte'),
  ('VR', 'Verona', 'Veneto'),
  ('VV', 'Vibo Valentia', 'Calabria'),
  ('VI', 'Vicenza', 'Veneto'),
  ('VT', 'Viterbo', 'Lazio')
on conflict (sigla) do update
  set provincia = excluded.provincia, regione = excluded.regione;

alter table public.province_regioni enable row level security;
drop policy if exists province_regioni_lettura on public.province_regioni;
create policy province_regioni_lettura on public.province_regioni
  for select to authenticated using (true);
revoke all on public.province_regioni from anon;

-- ---------------------------------------------------------------------
-- 2. IL REPARTO DI UN PRODOTTO, E QUELLO DI UN ORDINE
--
-- «Chi ha comprato laminazione» e' la domanda che si fa a una lista di
-- clienti shop, ed e' l'equivalente del filtro «corso» del CRM. Il
-- reparto e' la CATEGORIA RADICE dell'albero dello shop, con la prima
-- in ordine alfabetico quando un prodotto sta in piu' radici: la stessa
-- regola decisa il 9/11/2026 per le liste dei kit, perche' il reparto
-- e' lo scaffale e deve chiamarsi con le stesse parole in tutta l'app.
--
-- La guardia a otto passi non e' teorica: una categoria che si dichiara
-- figlia di se' stessa girerebbe per sempre.
--
-- MISURATO IL 17/11/2026: 307 prodotti con un reparto, 21 reparti, e i
-- 18 prodotti che stanno in piu' di una radice danno lo stesso
-- vincitore sia qui sia in `repartoPerProdotto` (App.jsx) — confrontati
-- uno per uno prima di scrivere questa vista.
create or replace view public.prodotti_reparto
with (security_invoker = true) as
with recursive salita as (
  select c.id, c.id as nodo, c.categoria_padre_id, 0 as passi
  from public.categorie_prodotti c
  union all
  select s.id, p.id, p.categoria_padre_id, s.passi + 1
  from salita s
  join public.categorie_prodotti p on p.id = s.categoria_padre_id
  where s.passi < 8
),
radice as (
  select distinct on (id) id as categoria_id, nodo as radice_id
  from salita order by id, passi desc
)
select pc.prodotto_id, min(cr.nome) as reparto
from public.prodotti_categorie pc
join radice r on r.categoria_id = pc.categoria_id
join public.categorie_prodotti cr on cr.id = r.radice_id
group by pc.prodotto_id;

-- IL PRODOTTO DI UNA RIGA SI RICONOSCE IN DUE MODI, e serve che siano
-- due. Le righe di un ordine dello shop portano `woo_product_id` e non
-- il nostro `prodotto_id` (regola di sempre sulle righe dello shop),
-- ma MISURATO sulle 12.920 righe in archivio: 7.094 non hanno nemmeno
-- il woo id (sono gli ordini importati dallo storico, con il solo
-- nome) e altre 4.601 ne hanno uno che in anagrafica non c'e' piu'.
-- Per solo id si riconoscevano 1.225 righe su 12.920 — un filtro che
-- sembra sapere e non sa.
--
-- Quindi: prima l'id, poi il NOME esatto (normalizzato), che recupera
-- 4.680 righe e porta i clienti con almeno un reparto riconosciuto da
-- 118 a 1.026 su 1.888. Non contraddice «raggruppa per prodotto, mai
-- per nome»: quella regola vale per i conti delle statistiche, dove un
-- prodotto rinominato diventerebbe due righe; qui il nome e' l'unica
-- cosa che quelle 7.094 righe hanno, e un nome che non combacia piu'
-- non da' un reparto sbagliato, da' «Senza categoria».
--
-- RESTA UN LIMITE DA DIRE IN PAGINA: su 7.015 righe il prodotto non e'
-- piu' a catalogo in nessun modo, quindi il filtro per reparto trova
-- «chi ha comprato quella roba fra quello che si riconosce», non tutti.
-- Un filtro che tace su cio' che non sa fa credere di aver scritto a
-- tutti.
create or replace view public.vendite_shop_reparti
with (security_invoker = true) as
select distinct
  v.id as vendita_id,
  lower(trim(v.cliente_email)) as email,
  v.data_ordine,
  coalesce(pr.reparto, 'Senza categoria') as reparto
from public.vendite_shop v
cross join lateral jsonb_array_elements(coalesce(v.prodotti, '[]'::jsonb)) riga
left join lateral (
  select p.id from public.prodotti_shop p
  where p.woo_product_id = nullif(riga->>'woo_product_id', '')::integer
  limit 1
) per_id on true
left join lateral (
  select p.id from public.prodotti_shop p
  where per_id.id is null
    and lower(trim(p.nome)) = lower(trim(riga->>'nome'))
  limit 1
) per_nome on true
left join public.prodotti_reparto pr on pr.prodotto_id = coalesce(per_id.id, per_nome.id)
where v.origine = 'woocommerce'
  and v.cliente_email is not null and trim(v.cliente_email) <> '';

revoke all on public.prodotti_reparto from anon;
revoke all on public.vendite_shop_reparti from anon;
grant select on public.prodotti_reparto to authenticated;
grant select on public.vendite_shop_reparti to authenticated;

-- l'email del cliente shop si cerca a ogni filtro per periodo o per
-- reparto: senza indice sono 4.291 righe lette ogni volta
create index if not exists vendite_shop_cliente_email_k
  on public.vendite_shop (lower(trim(cliente_email)))
  where origine = 'woocommerce' and cliente_email is not null;

-- ---------------------------------------------------------------------
-- 3. COSA SI SCRIVE SULLA RIGA DEL CONTATTO
--
-- Gli ORDINI NON SI COPIANO: stanno in `vendite_shop` e la scheda li
-- rilegge da la'. Qui va solo il RIASSUNTO, perche' e' quello su cui si
-- filtra — e un dato copiato in due posti un giorno dice due cose.
alter table public.crm_contatti
  add column if not exists fonte_lista text not null default 'vetta',
  add column if not exists acquisti_shop integer not null default 0,
  add column if not exists speso_shop numeric(12,2) not null default 0,
  add column if not exists primo_acquisto_shop_il date,
  add column if not exists ultimo_acquisto_shop_il date,
  add column if not exists reparti_acquistati text[] not null default '{}',
  add column if not exists shop_sincronizzato_il timestamptz;

-- UN CONTATTO PUO' NASCERE FUORI DA VETTA, e finora non poteva:
-- `vetta_id_principale` era NOT NULL, cioe' la tabella dichiarava che
-- ogni persona in lista viene dall'importazione del CRM. Provato sul
-- database vero, il primo cliente shop e' stato rifiutato con un
-- 23502. Il vincolo UNIQUE resta (in Postgres ammette piu' NULL), e
-- l'importatore di Vetta continua a scriverlo sempre: cambia solo che
-- adesso l'assenza vuol dire «questa persona non viene dal CRM» — che
-- e' proprio cio' che il filtro «solo quelli che non sono in CRM»
-- legge. Mettere un id inventato avrebbe voluto dire un puntatore a un
-- record Vetta che non esiste, e il filtro avrebbe risposto il falso.
alter table public.crm_contatti alter column vetta_id_principale drop not null;

-- `fonte_lista` dice DOVE E' NATA la riga, e il default allinea da se'
-- le 23.757 che c'erano: vengono tutte dall'importazione di Vetta.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_contatti_fonte_lista_valida') then
    alter table public.crm_contatti
      add constraint crm_contatti_fonte_lista_valida
      check (fonte_lista in ('vetta', 'shop'));
  end if;
end $$;

create index if not exists crm_contatti_cliente_shop
  on public.crm_contatti (ultimo_acquisto_shop_il desc)
  where acquisti_shop > 0;

-- l'email normalizzata del contatto si cerca a ogni sincronizzazione
create index if not exists crm_contatti_email_k
  on public.crm_contatti (lower(trim(email)))
  where email is not null;

-- ---------------------------------------------------------------------
-- 4. LA SINCRONIZZAZIONE
--
-- Rifa' il riassunto dei clienti shop e crea le righe che mancano.
-- E' IDEMPOTENTE: si puo' rieseguire quante volte si vuole, e lo fa il
-- cron ogni notte.
--
-- Quattro regole, e ognuna e' un modo di sbagliare:
--
-- a) UN DISISCRITTO NON TORNA DENTRO. Se la riga ha `disiscritto_il`,
--    qui non si tocca: e' la stessa regola dell'importazione di Vetta —
--    «il blocco vale per email, cosi' un re-import non lo riporta
--    dentro». Un ordine nuovo di chi si e' disiscritto aggiorna il suo
--    riassunto e NON lo rimette in lista.
-- b) I DATI DI VETTA NON SI RISCRIVONO. Nome, comune, telefono di una
--    riga che esisteva si riempiono SOLO se erano vuoti. Chi ha
--    scritto a mano una correzione nel CRM non se la vede cancellare
--    da un indirizzo di fatturazione.
-- c) `da_verificare` SOLO SENZA NOME, perche' `crm_campagna_prepara`
--    esclude le righe da verificare: marcarle con larghezza vorrebbe
--    dire gente che non ricevera' mai niente senza che si veda.
--    Sugli ordini il nome manca 11 volte su 4.291.
-- d) `numero_richieste = 0` per chi nasce dallo shop. Il default della
--    colonna e' 1, e lascerebbe scritto «una richiesta» addosso a chi
--    non ha mai scritto — e l'ordinamento per richieste direbbe il
--    falso.
--
-- La RAGIONE SOCIALE dell'ordine (438 su 4.291) non si importa: in
-- `crm_contatti` non c'e' una colonna che voglia dire quello, e
-- infilarla in `professione` o in `mestiere` sporcherebbe due filtri
-- con un dato che non e' ne' una professione ne' un mestiere.
create or replace function public.crm_sincronizza_clienti_shop()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_email int := 0; n_creati int := 0; n_aggiornati int := 0; n_disiscritti int := 0;
begin
  create temp table _shop on commit drop as
  with ordini as (
    select lower(trim(v.cliente_email)) as email_k,
           v.id, v.data_ordine, coalesce(v.totale, 0) as totale,
           v.payload_raw->'billing' as bi
    from vendite_shop v
    where v.origine = 'woocommerce'
      and v.cliente_email is not null
      and v.cliente_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  riassunto as (
    select email_k, count(*) as ordini, sum(totale) as speso,
           min(data_ordine)::date as primo, max(data_ordine)::date as ultimo
    from ordini group by email_k
  ),
  -- i dati anagrafici vengono dall'ULTIMO ordine: e' l'indirizzo piu'
  -- recente che quella persona ci ha dato
  ultimo as (
    select distinct on (email_k) email_k, bi
    from ordini order by email_k, data_ordine desc, id
  ),
  reparti as (
    select email, array_agg(distinct reparto order by reparto) as reparti
    from vendite_shop_reparti group by email
  )
  select r.email_k,
         r.ordini, r.speso, r.primo, r.ultimo,
         coalesce(rp.reparti, '{}'::text[]) as reparti,
         nullif(trim(u.bi->>'first_name'), '') as nome,
         nullif(trim(u.bi->>'last_name'), '') as cognome,
         nullif(trim(u.bi->>'phone'), '') as telefono,
         nullif(trim(u.bi->>'city'), '') as citta,
         upper(nullif(trim(u.bi->>'state'), '')) as sigla,
         nullif(trim(u.bi->>'postcode'), '') as cap
  from riassunto r
  join ultimo u on u.email_k = r.email_k
  left join reparti rp on rp.email = r.email_k;

  select count(*) into n_email from _shop;

  -- A QUALE RIGA APPARTIENE OGNI EMAIL: quella principale, oppure una
  -- delle aggiuntive (otto clienti shop stanno solo la' dentro, e senza
  -- questo controllo nascerebbe un doppione di chi e' gia' in lista).
  --
  -- Le email di tutti i contatti si distendono PRIMA in una tabella
  -- sola, con il suo indice, e il legame diventa un confronto per
  -- uguaglianza. La prima versione metteva quell'OR dentro la ON del
  -- join (`= s.email_k or s.email_k = any (select ... unnest(...))`) e
  -- il giro NON FINIVA: per ogni coppia delle 23.757 righe per 1.888
  -- email Postgres apriva una sotto-query. Provato sul database vero,
  -- e' andato in timeout — scritto qui perche' e' la differenza fra
  -- una funzione che gira in un secondo e una che non si puo' usare.
  create temp table _email_contatti on commit drop as
  select c.id as contatto_id, lower(trim(c.email)) as email_k
  from crm_contatti c where nullif(trim(c.email), '') is not null
  union
  select c.id, lower(trim(e))
  from crm_contatti c, unnest(coalesce(c.email_aggiuntive, '{}')) e
  where nullif(trim(e), '') is not null;
  create index on _email_contatti (email_k);

  create temp table _legami on commit drop as
  select distinct s.email_k, ec.contatto_id
  from _shop s join _email_contatti ec on ec.email_k = s.email_k;
  create index on _legami (contatto_id);
  create index on _legami (email_k);

  -- due email dello stesso cliente devono fare UN riassunto, non due
  create temp table _per_contatto on commit drop as
  select l.contatto_id,
         sum(s.ordini)::int as ordini, sum(s.speso) as speso,
         min(s.primo) as primo, max(s.ultimo) as ultimo,
         (select array_agg(distinct rr order by rr)
            from _shop s2
            join _legami l2 on l2.email_k = s2.email_k,
                 unnest(s2.reparti) rr
           where l2.contatto_id = l.contatto_id) as reparti
  from _shop s join _legami l on l.email_k = s.email_k
  group by l.contatto_id;
  create index on _per_contatto (contatto_id);

  -- IL COMUNE NORMALIZZATO NON SI INVENTA. `crm_contatti.comune` tiene
  -- il nome ISTAT (da li' nasce la tendina dei comuni): scriverci la
  -- citta' di fatturazione cosi' com'e' battuta farebbe comparire
  -- «ROMA», «roma» e «Roma» come tre comuni diversi. La citta' grezza
  -- va in `citta_originale`, che e' la colonna fatta per questo, e
  -- PROVINCIA e REGIONE invece si scrivono: quelle vengono dalla sigla,
  -- che e' un dato canonico (`province_regioni`).
  update crm_contatti c set
    acquisti_shop = p.ordini,
    speso_shop = p.speso,
    primo_acquisto_shop_il = p.primo,
    ultimo_acquisto_shop_il = p.ultimo,
    reparti_acquistati = coalesce(p.reparti, '{}'::text[]),
    shop_sincronizzato_il = now(),
    telefono = coalesce(c.telefono, d.telefono),
    citta_originale = coalesce(c.citta_originale, d.citta),
    provincia_originale = coalesce(c.provincia_originale, d.sigla),
    provincia = coalesce(c.provincia, d.provincia),
    regione = coalesce(c.regione, d.regione),
    aggiornato_il = now()
  from _per_contatto p
  left join lateral (
    select s.telefono, s.citta, s.sigla, pr.provincia, pr.regione
    from _shop s
    join _legami l on l.email_k = s.email_k
    left join province_regioni pr on pr.sigla = s.sigla
    where l.contatto_id = p.contatto_id
    order by s.ultimo desc, s.email_k
    limit 1
  ) d on true
  where c.id = p.contatto_id;
  get diagnostics n_aggiornati = row_count;

  -- UN ORDINE CESTINATO NON LASCIA UN RIASSUNTO CHE NON ESISTE PIU'.
  -- Le vendite si cestinano (26/10/2026) e da `vendite_shop` sparisce
  -- la riga: senza questo azzeramento una persona resterebbe «cliente
  -- shop» con una spesa che nessun ordine giustifica, e il filtro la
  -- pescherebbe per sempre. La riga del contatto non si cancella: una
  -- persona non sparisce perche' un ordine e' stato annullato.
  update crm_contatti c set
    acquisti_shop = 0,
    speso_shop = 0,
    primo_acquisto_shop_il = null,
    ultimo_acquisto_shop_il = null,
    reparti_acquistati = '{}'::text[],
    shop_sincronizzato_il = now()
  where c.acquisti_shop > 0
    and not exists (select 1 from _per_contatto p where p.contatto_id = c.id);

  insert into crm_contatti (
    nome, cognome, nome_originale, email, telefono,
    citta_originale, provincia_originale, provincia, regione,
    luogo_fonte, numero_richieste, fonte_lista,
    acquisti_shop, speso_shop, primo_acquisto_shop_il, ultimo_acquisto_shop_il,
    reparti_acquistati, shop_sincronizzato_il,
    da_verificare, da_verificare_motivo, creato_da_nome
  )
  select s.nome, s.cognome,
         nullif(trim(concat_ws(' ', s.nome, s.cognome)), ''),
         s.email_k, s.telefono,
         s.citta, s.sigla,
         pr.provincia, pr.regione,
         case when pr.sigla is null then null else 'fatturazione shop' end,
         0, 'shop',
         s.ordini, s.speso, s.primo, s.ultimo,
         s.reparti, now(),
         s.nome is null and s.cognome is null,
         case when s.nome is null and s.cognome is null then 'ordine dello shop senza nome di fatturazione' end,
         'clienti shop'
  from _shop s
  left join province_regioni pr on pr.sigla = s.sigla
  where not exists (select 1 from _legami l where l.email_k = s.email_k);
  get diagnostics n_creati = row_count;

  select count(*) into n_disiscritti
  from crm_contatti c where c.acquisti_shop > 0 and c.disiscritto_il is not null;

  return jsonb_build_object(
    'email_shop', n_email, 'creati', n_creati, 'aggiornati', n_aggiornati,
    'disiscritti_fra_i_clienti_shop', n_disiscritti, 'quando', now());
end;
$function$;

revoke all on function public.crm_sincronizza_clienti_shop() from public, anon;
grant execute on function public.crm_sincronizza_clienti_shop() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. I FILTRI NUOVI, IN UN POSTO SOLO
--
-- `crm_contatti_filtrati` e' l'unica WHERE della lista: da qui passano
-- l'elenco a pagine, il totale vero e i destinatari che una campagna
-- congela. I filtri aggiunti:
--
--   cliente_shop      ha comprato almeno una volta sullo shop
--   non_in_crm        «solo quelli che non sono in CRM» (parole del
--                     titolare): nessun record importato da Vetta e
--                     nessuna richiesta. E' CALCOLATO e non congelato
--                     alla nascita della riga, cosi' il giorno che quel
--                     cliente scrive e gli nasce una richiesta esce da
--                     se' da questo filtro — che e' la risposta giusta:
--                     da quel momento e' anche in CRM.
--   acquisto_dal/_al  ha comprato IN QUEL PERIODO (si guardano gli
--                     ordini, non il primo/ultimo acquisto: chi ha
--                     comprato a marzo e a dicembre deve comparire
--                     anche cercando giugno-aprile)
--   reparto           ha comprato roba di quel reparto, NELLO STESSO
--                     ordine che rispetta il periodo quando c'e' anche
--                     un periodo. Due condizioni separate direbbero
--                     «ha comprato laminazione una volta nella vita E
--                     qualcosa nel periodo», che non e' la domanda.
--   speso_da          ha speso almeno tanto, in tutto, sullo shop
create or replace function public.crm_contatti_filtrati(filtri jsonb default '{}'::jsonb)
returns setof crm_contatti
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  f_cerca text := nullif(trim(filtri->>'cerca'), '');
  f_anno int := nullif(filtri->>'anno', '')::int;
  f_dal date := nullif(filtri->>'dal', '')::date;
  f_al date := nullif(filtri->>'al', '')::date;
  f_corso text := nullif(filtri->>'corso', '');
  f_regione text := nullif(filtri->>'regione', '');
  f_provincia text := nullif(filtri->>'provincia', '');
  f_comune text := nullif(filtri->>'comune', '');
  f_qualifica text := nullif(filtri->>'qualifica', '');
  f_stato text := nullif(filtri->>'stato', '');
  f_trattato text := nullif(filtri->>'trattato_da', '');
  f_mestiere text := nullif(filtri->>'mestiere', '');
  f_collegamento text := nullif(filtri->>'collegamento', '');
  f_disiscritti boolean := coalesce((filtri->>'disiscritti')::boolean, false);
  f_da_verificare boolean := coalesce((filtri->>'da_verificare')::boolean, false);
  f_con_email boolean := coalesce((filtri->>'con_email')::boolean, false);
  f_senza_data boolean := coalesce((filtri->>'senza_data')::boolean, false);
  f_cliente_shop boolean := coalesce((filtri->>'cliente_shop')::boolean, false);
  f_non_in_crm boolean := coalesce((filtri->>'non_in_crm')::boolean, false);
  f_acq_dal date := nullif(filtri->>'acquisto_dal', '')::date;
  f_acq_al date := nullif(filtri->>'acquisto_al', '')::date;
  f_reparto text := nullif(filtri->>'reparto', '');
  f_speso_da numeric := nullif(filtri->>'speso_da', '')::numeric;
  con_date boolean := f_anno is not null or f_dal is not null or f_al is not null;
  sulle_richieste boolean := f_anno is not null or f_dal is not null or f_al is not null or f_corso is not null;
  sugli_ordini boolean := f_acq_dal is not null or f_acq_al is not null or f_reparto is not null;
begin
  return query
    select c.*
    from crm_contatti c
    where (f_disiscritti and c.disiscritto_il is not null or not f_disiscritti and c.disiscritto_il is null)
      and (not f_da_verificare or c.da_verificare)
      and (not f_con_email or c.email is not null)
      and (f_regione is null or c.regione = f_regione)
      and (f_provincia is null or c.provincia = f_provincia)
      and (f_comune is null or c.comune = f_comune)
      and (f_qualifica is null or c.qualifica = f_qualifica)
      and (f_stato is null or c.stato_trattativa = f_stato)
      and (f_trattato is null or c.trattato_da = f_trattato)
      and (f_mestiere is null or c.mestiere = f_mestiere)
      and (f_collegamento is null or c.collegamento = f_collegamento)
      -- i clienti shop
      and (not f_cliente_shop or c.acquisti_shop > 0)
      and (f_speso_da is null or c.speso_shop >= f_speso_da)
      and (not f_non_in_crm or (
            c.vetta_id_principale is null
            and not exists (select 1 from crm_richieste r where r.contatto_id = c.id)))
      and (not sugli_ordini or exists (
            select 1 from vendite_shop_reparti sr
            where sr.email = lower(trim(c.email))
              and (f_reparto is null or sr.reparto = f_reparto)
              and (f_acq_dal is null or (sr.data_ordine at time zone 'Europe/Rome')::date >= f_acq_dal)
              and (f_acq_al is null or (sr.data_ordine at time zone 'Europe/Rome')::date <= f_acq_al)))
      and (f_cerca is null or
           concat_ws(' ', c.nome, c.cognome, c.nome_originale, c.email, c.telefono, c.comune) ilike '%' || f_cerca || '%')
      and (not f_senza_data or (
            not exists (select 1 from crm_richieste r where r.contatto_id = c.id and r.data_certa)
            and not exists (select 1 from jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}')))
      and (not sulle_richieste
           or exists (
            select 1 from crm_richieste r
            where r.contatto_id = c.id
              and (not con_date or r.data_certa)
              and (f_anno is null or extract(year from r.richiesta_il at time zone 'Europe/Rome')::int = f_anno)
              and (f_dal is null or (r.richiesta_il at time zone 'Europe/Rome')::date >= f_dal)
              and (f_al is null or (r.richiesta_il at time zone 'Europe/Rome')::date <= f_al)
              and (f_corso is null or f_corso = any(r.corsi)))
           or (con_date and exists (
            select 1 from jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o
            where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}'
              and (f_anno is null or extract(year from (o->>'chiusa_il')::date)::int = f_anno)
              and (f_dal is null or (o->>'chiusa_il')::date >= f_dal)
              and (f_al is null or (o->>'chiusa_il')::date <= f_al)
              and (f_corso is null or o->>'corso' = f_corso))));
end;
$function$;

revoke all on function public.crm_contatti_filtrati(jsonb) from public, anon;
grant execute on function public.crm_contatti_filtrati(jsonb) to authenticated, service_role;

-- Le voci che c'erano prima restano SCRITTE UNA VOLTA SOLA, in
-- `crm_filtri_valori_base`: `crm_filtri_valori` ci somma le sue.
-- Ricopiare dieci sotto-select per aggiungerne tre vorrebbe dire due
-- elenchi che un giorno dicono due numeri diversi sullo stesso filtro.
create or replace function public.crm_filtri_valori_base()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'regioni', (select coalesce(jsonb_agg(jsonb_build_object('valore', regione, 'quanti', n) order by regione), '[]'::jsonb)
                from (select regione, count(*) n from crm_contatti where regione is not null group by regione) x),
    'province', (select coalesce(jsonb_agg(jsonb_build_object('valore', provincia, 'regione', regione, 'quanti', n) order by provincia), '[]'::jsonb)
                 from (select provincia, min(regione) regione, count(*) n from crm_contatti where provincia is not null group by provincia) x),
    'comuni', (select coalesce(jsonb_agg(jsonb_build_object('valore', comune, 'provincia', provincia, 'quanti', n) order by comune), '[]'::jsonb)
               from (select comune, min(provincia) provincia, count(*) n from crm_contatti where comune is not null group by comune) x),
    'qualifiche', (select coalesce(jsonb_agg(jsonb_build_object('valore', qualifica, 'quanti', n) order by n desc), '[]'::jsonb)
                   from (select qualifica, count(*) n from crm_contatti where qualifica is not null group by qualifica) x),
    'stati', (select coalesce(jsonb_agg(jsonb_build_object('valore', stato_trattativa, 'quanti', n) order by n desc), '[]'::jsonb)
              from (select stato_trattativa, count(*) n from crm_contatti group by stato_trattativa) x),
    'trattati_da', (select coalesce(jsonb_agg(jsonb_build_object('valore', trattato_da, 'quanti', n) order by n desc), '[]'::jsonb)
                    from (select trattato_da, count(*) n from crm_contatti where trattato_da is not null group by trattato_da) x),
    'mestieri', (select coalesce(jsonb_agg(jsonb_build_object('valore', mestiere, 'quanti', n) order by n desc), '[]'::jsonb)
                 from (select mestiere, count(*) n from crm_contatti where mestiere is not null group by mestiere) x),
    'corsi', (select coalesce(jsonb_agg(jsonb_build_object('valore', corso, 'quanti', n) order by n desc), '[]'::jsonb)
              from (select corso, count(distinct contatto_id) n from crm_richieste, unnest(corsi) corso group by corso) x),
    'anni', (select coalesce(jsonb_agg(jsonb_build_object('valore', anno, 'quanti', n) order by anno desc), '[]'::jsonb)
             from (select anno, count(distinct contatto_id) n from (
                     select extract(year from richiesta_il at time zone 'Europe/Rome')::int anno, contatto_id
                     from crm_richieste where data_certa and richiesta_il is not null
                     union all
                     select extract(year from (o->>'chiusa_il')::date)::int, c.id
                     from crm_contatti c, jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o
                     where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}'
                   ) u group by anno) x),
    'senza_data', (select count(*) from crm_contatti c
                   where not exists (select 1 from crm_richieste r where r.contatto_id = c.id and r.data_certa)
                     and not exists (select 1 from jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}')),
    'totale', (select count(*) from crm_contatti),
    'disiscritti', (select count(*) from crm_contatti where disiscritto_il is not null)
  );
$function$;

revoke all on function public.crm_filtri_valori_base() from public, anon;
grant execute on function public.crm_filtri_valori_base() to authenticated, service_role;

-- I valori delle tendine: tre voci in piu', contate sul riassunto che
-- sta sulla riga del contatto (non sugli ordini) perche' questa
-- funzione la chiama la pagina a ogni apertura.
create or replace function public.crm_filtri_valori()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select public.crm_filtri_valori_base() || jsonb_build_object(
    'reparti', (select coalesce(jsonb_agg(jsonb_build_object('valore', reparto, 'quanti', n) order by n desc), '[]'::jsonb)
                from (select reparto, count(*) n
                      from crm_contatti c, unnest(c.reparti_acquistati) reparto
                      where c.acquisti_shop > 0 group by reparto) x),
    'clienti_shop', (select count(*) from crm_contatti where acquisti_shop > 0),
    'non_in_crm', (select count(*) from crm_contatti c
                   where c.vetta_id_principale is null
                     and not exists (select 1 from crm_richieste r where r.contatto_id = c.id)),
    'shop_sincronizzato_il', (select max(shop_sincronizzato_il) from crm_contatti)
  );
$function$;

revoke all on function public.crm_filtri_valori() from public, anon;
grant execute on function public.crm_filtri_valori() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. OGNI NOTTE, DA SE'
--
-- Gli ordini dello shop entrano ogni quarto d'ora; il riassunto per la
-- lista si rifa' una volta a notte, alle 04:50 — dopo i cestini e prima
-- del controllo saldi. In pagina c'e' anche il tasto per rifarlo
-- adesso, perche' chi ha appena venduto non deve aspettare domani.
select cron.unschedule('crm-clienti-shop') where exists (select 1 from cron.job where jobname = 'crm-clienti-shop');
select cron.schedule('crm-clienti-shop', '50 4 * * *', 'select public.crm_sincronizza_clienti_shop()');

-- ---------------------------------------------------------------------
-- ROLLBACK (da eseguire a mano, in quest'ordine)
--
--   select cron.unschedule('crm-clienti-shop');
--   -- le righe nate dallo shop che non hanno nessuna storia nel CRM:
--   -- si cancellano solo quelle, e solo se nessuna campagna le ha
--   -- toccate (li' dentro c'e' la storia di una mail spedita)
--   delete from public.crm_contatti c
--    where c.fonte_lista = 'shop'
--      and c.vetta_id_principale is null
--      and not exists (select 1 from public.crm_richieste r where r.contatto_id = c.id)
--      and not exists (select 1 from public.crm_campagne_destinatari d where d.contatto_id = c.id);
--   alter table public.crm_contatti
--     drop constraint if exists crm_contatti_fonte_lista_valida,
--     drop column if exists fonte_lista,
--     drop column if exists acquisti_shop,
--     drop column if exists speso_shop,
--     drop column if exists primo_acquisto_shop_il,
--     drop column if exists ultimo_acquisto_shop_il,
--     drop column if exists reparti_acquistati,
--     drop column if exists shop_sincronizzato_il;
--   drop function if exists public.crm_sincronizza_clienti_shop();
--   drop view if exists public.vendite_shop_reparti;
--   drop view if exists public.prodotti_reparto;
--   drop table if exists public.province_regioni;
--   -- e poi si rimettono `crm_contatti_filtrati` e `crm_filtri_valori`
--   -- nella forma precedente, che sta nelle migrazioni del 30/10 e del
--   -- 10/11; `crm_filtri_valori_base` si cancella.
