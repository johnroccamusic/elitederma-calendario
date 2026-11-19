-- UN ORDINE CHE NON E' STATO PAGATO NON E' UN INCASSO. 18/11/2026.
--
-- Trovato guardando «Clienti shop»: in cima alla classifica c'erano otto
-- persone con 45.000, 41.020, 29.565 € di «speso» e ZERO euro pagati.
-- Una sola aveva quindici ordini da 3.000 € — tutti `cancelled` o
-- `failed`, cioe' tentativi di comprare un corso che non sono mai andati
-- a buon fine. WooCommerce quegli ordini li conserva come ordini veri, e
-- nessuna delle letture guardava `stato`.
--
-- Misurato prima di toccare niente, su tutto l'archivio dello shop:
--
--   completed   3.564 ordini   646.706,45 €   <- gli unici incassati
--   cancelled     469 ordini   507.710,51 €
--   failed        156 ordini    91.588,97 €
--   on-hold        34 ordini    87.797,40 €
--   pending        20 ordini    23.656,00 €
--   refunded       49 ordini     6.959,30 €   <- entrati e restituiti
--
-- 710.752,88 € mai entrati, sommati a 646.706,45 € veri.
--
-- Qui si correggono i due punti che stanno nel database; gli altri
-- quattro stanno in App.jsx (elenco clienti, classifica prodotti,
-- statistiche globali e statistiche per canale).
--
-- LA REGOLA: di WooCommerce contano `completed` e `processing` — il
-- secondo oggi in archivio non c'e', ma e' lo stato normale di un
-- ordine pagato e non ancora evaso, e il giorno che compare deve
-- contare da se'. `refunded` sta fuori: quei soldi sono tornati
-- indietro.
--
-- ROLLBACK: in fondo al file.

-- 1. I REPARTI COMPRATI. Alimenta `crm_contatti.reparti_acquistati`,
--    cioe' il filtro «ha comprato roba di quel reparto» delle campagne:
--    un carrello abbandonato non dice niente su cosa quella persona
--    compra davvero.
create or replace view vendite_shop_reparti as
 SELECT DISTINCT v.id AS vendita_id,
    lower(TRIM(BOTH FROM v.cliente_email)) AS email,
    v.data_ordine,
    COALESCE(pr.reparto, 'Senza categoria'::text) AS reparto
   FROM vendite_shop v
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(v.prodotti, '[]'::jsonb)) riga(value)
     LEFT JOIN LATERAL ( SELECT p.id
           FROM prodotti_shop p
          WHERE p.woo_product_id = NULLIF(riga.value ->> 'woo_product_id'::text, ''::text)::integer
         LIMIT 1) per_id ON true
     LEFT JOIN LATERAL ( SELECT p.id
           FROM prodotti_shop p
          WHERE per_id.id IS NULL AND lower(TRIM(BOTH FROM p.nome)) = lower(TRIM(BOTH FROM riga.value ->> 'nome'::text))
         LIMIT 1) per_nome ON true
     LEFT JOIN prodotti_reparto pr ON pr.prodotto_id = COALESCE(per_id.id, per_nome.id)
  WHERE v.origine = 'woocommerce'::text
    AND v.stato in ('completed', 'processing')
    AND v.cliente_email IS NOT NULL AND TRIM(BOTH FROM v.cliente_email) <> ''::text;

-- 2. IL RIASSUNTO DEI CLIENTI SHOP sulla riga del contatto. `speso_shop`
--    e' quello su cui filtra «ha speso almeno tanto» quando si scelgono
--    i destinatari di una campagna: con dentro i tentativi falliti
--    selezionava gente che non ha mai pagato un euro.
--    Cambia una riga sola di questa funzione — la WHERE della CTE
--    `ordini` — e tutto il resto resta com'era.
create or replace function crm_sincronizza_clienti_shop()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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
      -- SOLO GLI ORDINI INCASSATI (18/11/2026). Vedi la testa del file.
      and v.stato in ('completed', 'processing')
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
  -- Da oggi vale anche per chi aveva SOLO ordini mai pagati: il suo
  -- riassunto torna a zero, e la riga resta — e' un contatto, non una
  -- vendita.
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
$$;

-- ROLLBACK (rimette a contare anche gli ordini mai pagati):
--   togliere `and v.stato in ('completed','processing')` dalla vista
--   `vendite_shop_reparti` e dalla CTE `ordini` della funzione, poi
--   rieseguire `select crm_sincronizza_clienti_shop();`.
--   Nessuna riga viene cancellata da questa migrazione: cambiano solo
--   i riassunti, che si rifanno da soli a ogni giro.
