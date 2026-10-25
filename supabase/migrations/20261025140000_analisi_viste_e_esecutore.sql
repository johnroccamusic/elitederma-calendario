-- CHIEDI AI DATI (25/10/2026): le viste di analisi e chi le interroga.
--
-- In Statistiche si scrive una domanda in italiano («i dieci prodotti piu'
-- venduti a maggio», «quale master vende di piu'», «ricavi da settembre a
-- oggi»); un modello la traduce in una SELECT su QUESTE viste, il
-- database la esegue, e il modello scrive la risposta coi numeri che il
-- database ha restituito. Il modello compone la domanda e commenta la
-- risposta: i numeri li fa Postgres.
--
-- Le viste sono l'unico mondo che il modello vede: niente nomi, email,
-- indirizzi o documenti di allievi e clienti. Ci sono i nomi dello staff
-- (master, venditori, operatori del banco), i corsi, le citta', i
-- prodotti, i fornitori e le categorie di spesa. `analisi_esegui` accetta
-- una sola SELECT, la esegue come ruolo `analisi_lettore` (che legge solo
-- le viste), con un limite di 300 righe e 8 secondi.

-- il ruolo che vede solo le viste
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'analisi_lettore') then
    create role analisi_lettore nologin;
  end if;
end $$;
grant usage on schema public to analisi_lettore;

-- 1. le vendite, una riga per ordine (banco e shop online)
create or replace view public.analisi_vendite as
select v.id, v.numero_ordine,
  (v.data_ordine at time zone 'Europe/Rome')::date as data,
  extract(year from v.data_ordine at time zone 'Europe/Rome')::int as anno,
  extract(month from v.data_ordine at time zone 'Europe/Rome')::int as mese,
  case when v.origine = 'woocommerce' then 'shop online' else 'banco' end as canale,
  v.stato, coalesce(v.tipo_movimento, 'vendita') as tipo_movimento, v.metodo_pagamento,
  v.operatore_nome as operatore, v.operatore_tipo,
  c.nome as corso, coalesce(cd.citta, l.citta, l.nome) as citta, e.nome as evento,
  v.totale, v.totale_imponibile as imponibile, v.totale_iva as iva, v.provvigione_master, v.codice_coupon
from public.vendite_shop v
left join public.corsi_date cd on cd.id = v.corso_data_id
left join public.corsi c on c.id = cd.corso_id
left join public.location l on l.id = cd.location_id
left join public.eventi e on e.id = v.evento_id
where coalesce(v.simulazione, false) = false;

-- 2. le vendite, una riga per prodotto venduto
create or replace view public.analisi_vendite_righe as
select v.id as vendita_id, v.numero_ordine,
  (v.data_ordine at time zone 'Europe/Rome')::date as data,
  extract(year from v.data_ordine at time zone 'Europe/Rome')::int as anno,
  extract(month from v.data_ordine at time zone 'Europe/Rome')::int as mese,
  case when v.origine = 'woocommerce' then 'shop online' else 'banco' end as canale,
  v.stato, coalesce(v.tipo_movimento, 'vendita') as tipo_movimento, v.metodo_pagamento,
  v.operatore_nome as operatore,
  c.nome as corso, coalesce(cd.citta, l.citta, l.nome) as citta, e.nome as evento,
  coalesce(p.nome, r->>'nome') as prodotto, p.sku, cat.nome as categoria,
  coalesce((r->>'quantita')::numeric, 1) as quantita,
  coalesce((r->>'totale_riga')::numeric, (r->>'prezzo_unitario')::numeric * coalesce((r->>'quantita')::numeric, 1), 0) as totale_riga,
  (r->>'sconto_riga')::numeric as sconto_riga,
  p.costo_acquisto,
  case when p.costo_acquisto is not null
       then coalesce((r->>'totale_riga')::numeric, (r->>'prezzo_unitario')::numeric * coalesce((r->>'quantita')::numeric, 1), 0) - p.costo_acquisto * coalesce((r->>'quantita')::numeric, 1)
  end as margine_stimato
from public.vendite_shop v
cross join lateral jsonb_array_elements(coalesce(v.prodotti, '[]'::jsonb)) r
left join public.corsi_date cd on cd.id = v.corso_data_id
left join public.corsi c on c.id = cd.corso_id
left join public.location l on l.id = cd.location_id
left join public.eventi e on e.id = v.evento_id
left join lateral (
  select ps.* from public.prodotti_shop ps
  where (nullif(r->>'prodotto_id', '') is not null and ps.id = (r->>'prodotto_id')::uuid)
     or (nullif(r->>'woo_product_id', '') is not null and ps.woo_product_id = (r->>'woo_product_id')::int)
  limit 1
) p on true
left join lateral (
  select cp.nome from public.prodotti_categorie pc join public.categorie_prodotti cp on cp.id = pc.categoria_id
  where pc.prodotto_id = p.id order by pc.ordine nulls last limit 1
) cat on true
where coalesce(v.simulazione, false) = false;

-- 3. le iscrizioni ai corsi, senza nessun dato dell'allievo
create or replace view public.analisi_iscrizioni as
select i.id,
  (i.ts at time zone 'Europe/Rome')::date as data_iscrizione,
  extract(year from i.ts at time zone 'Europe/Rome')::int as anno,
  extract(month from i.ts at time zone 'Europe/Rome')::int as mese,
  c.nome as corso, coalesce(cd.citta, l.citta, l.nome) as citta, cd.data_inizio, cd.data_fine,
  m.nome as master, i.tutor as venditore,
  i.stato, i.totale_pattuito, i.quota_venditore,
  i.acconto_totale, i.acconto_pagato, i.acconto_pagato_il,
  i.precorso_totale, i.precorso_pagato, i.precorso_pagato_il,
  i.saldo_totale, i.saldo_incassato_il,
  i.tipo_offerta, i.pacchetto_kit, i.richiede_modelle, i.numero_modelle, i.vecchia_iscrizione
from public.iscritti i
left join public.corsi_date cd on cd.id = i.corso_data_id
left join public.corsi c on c.id = cd.corso_id
left join public.location l on l.id = cd.location_id
left join public.master m on m.id = cd.master_id;

-- 4. gli incassi, tutti insieme: prodotti venduti e quote dei corsi
create or replace view public.analisi_incassi as
select 'vendita prodotti'::text as fonte, data, canale, metodo_pagamento as metodo, totale as importo, operatore as chi, corso, citta, evento
  from public.analisi_vendite where stato in ('completed', 'processing') and tipo_movimento = 'vendita'
union all
select 'acconto corso', acconto_pagato_il, 'corso', null, acconto_totale, venditore, corso, citta, null
  from public.analisi_iscrizioni where coalesce(acconto_pagato, false) and acconto_pagato_il is not null and coalesce(acconto_totale, 0) <> 0
union all
select 'quota pre corso', precorso_pagato_il, 'corso', null, precorso_totale, venditore, corso, citta, null
  from public.analisi_iscrizioni where coalesce(precorso_pagato, false) and precorso_pagato_il is not null and coalesce(precorso_totale, 0) <> 0
union all
select 'saldo corso', saldo_incassato_il, 'corso', null, saldo_totale, venditore, corso, citta, null
  from public.analisi_iscrizioni where saldo_incassato_il is not null and coalesce(saldo_totale, 0) <> 0;

-- 5. le spese
create or replace view public.analisi_spese as
select s.id, coalesce(s.data_pagamento, s.data_documento) as data,
  extract(year from coalesce(s.data_pagamento, s.data_documento))::int as anno,
  extract(month from coalesce(s.data_pagamento, s.data_documento))::int as mese,
  cc.nome as categoria, cs.nome as sottocategoria, f.nome as fornitore, s.descrizione,
  s.imponibile, s.iva_percentuale, s.totale, s.stato, s.metodo_pagamento, s.tipo_ambito,
  c.nome as corso, coalesce(cd.citta, l.citta, l.nome) as citta, e.nome as evento,
  s.fisso_variabile, s.ricorrente_occasionale, s.riducibilita, s.essenzialita, s.controllabilita, s.natura,
  coalesce(s.includi_analisi_costi, true) as includi_analisi_costi
from public.spese s
left join public.costi_categorie cc on cc.id = s.categoria_id
left join public.costi_sottocategorie cs on cs.id = s.sottocategoria_id
left join public.fornitori f on f.id = s.fornitore_id
left join public.corsi c on c.id = s.corso_id
left join public.corsi_date cd on cd.id = s.classe_id
left join public.location l on l.id = coalesce(cd.location_id, s.sede_id)
left join public.eventi e on e.id = s.evento_id;

-- 6. le edizioni dei corsi (una classe = corso + citta' + data)
create or replace view public.analisi_edizioni as
select cd.id, c.nome as corso, coalesce(cd.citta, l.citta, l.nome) as citta, cd.data_inizio, cd.data_fine, m.nome as master, cd.posti_max,
  (select count(*) from public.iscritti i where i.corso_data_id = cd.id) as iscritti,
  (select coalesce(sum(i.totale_pattuito), 0) from public.iscritti i where i.corso_data_id = cd.id) as pattuito,
  coalesce(cd.costo_accademia, 0) + coalesce(cd.costo_master, 0) + coalesce(cd.costo_assistenti, 0) + coalesce(cd.costo_pranzi, 0)
    + coalesce(cd.costo_hotel, 0) + coalesce(cd.costi_imprevisti, 0) + coalesce(cd.costo_coordinatore, 0) as costi_scheda
from public.corsi_date cd
left join public.corsi c on c.id = cd.corso_id
left join public.location l on l.id = cd.location_id
left join public.master m on m.id = cd.master_id;

grant select on public.analisi_vendite, public.analisi_vendite_righe, public.analisi_iscrizioni,
  public.analisi_incassi, public.analisi_spese, public.analisi_edizioni to analisi_lettore;
-- le viste girano coi permessi di chi le possiede: la chiave pubblicabile e
-- la sessione non devono leggerle direttamente, solo tramite la funzione
revoke all on public.analisi_vendite, public.analisi_vendite_righe, public.analisi_iscrizioni,
  public.analisi_incassi, public.analisi_spese, public.analisi_edizioni from anon, authenticated;

-- L'esecutore: una SELECT sola, con la lista bianca dei nomi. Ogni cosa
-- che sta dopo FROM o JOIN deve essere una vista analisi_*, una CTE
-- dichiarata nella stessa query o una funzione di tabella. Il ruolo
-- analisi_lettore resta come documentazione di cio' che e' leggibile, ma
-- la funzione non puo' girare come lui: un `set role` dentro una security
-- definer Postgres non lo permette, e farla appartenere a quel ruolo
-- vorrebbe dire dargli CREATE su public — peggio del male.
create or replace function public.analisi_esegui(p_sql text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pulito text;
  risultato jsonb;
  m text[];
  nome text;
  cte text[] := '{}';
  ammesse text[] := array['lateral','unnest','generate_series','jsonb_array_elements','jsonb_each','jsonb_to_recordset','date_trunc'];
begin
  pulito := btrim(regexp_replace(coalesce(p_sql, ''), ';\s*$', ''));
  if pulito = '' then raise exception 'ANALISI: domanda vuota'; end if;
  if pulito !~* '^\s*(select|with)\M' then raise exception 'ANALISI: si accettano solo SELECT'; end if;
  if position(';' in pulito) > 0 then raise exception 'ANALISI: una sola istruzione'; end if;
  if pulito ~* '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|pg_sleep|pg_catalog|pg_class|pg_roles|pg_user|pg_shadow|pg_stat|information_schema|set|reset|lock|vacuum|analyze|listen|notify|dblink|lo_import|lo_export)\M' then
    raise exception 'ANALISI: istruzione non consentita';
  end if;
  if pulito !~* '\manalisi_' then raise exception 'ANALISI: si interrogano solo le viste analisi_*'; end if;
  for m in select regexp_matches(pulito, '\m([a-z_][a-z0-9_]*)\s+as\s*\(', 'gi') loop
    cte := cte || lower(m[1]);
  end loop;
  for m in select regexp_matches(pulito, '\m(?:from|join)\s+([a-z_][a-z0-9_.]*)', 'gi') loop
    nome := lower(m[1]);
    if nome like 'public.%' then nome := substr(nome, 8); end if;
    if nome like 'analisi\_%' then continue; end if;
    if nome = any (cte) or nome = any (ammesse) then continue; end if;
    raise exception 'ANALISI: «%» non e'' una vista di analisi', nome;
  end loop;
  perform set_config('statement_timeout', '8000', true);
  execute 'select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from (select * from (' || pulito || ') x limit 300) q' into risultato;
  return risultato;
end;
$$;
revoke all on function public.analisi_esegui(text) from public, anon, authenticated;
grant execute on function public.analisi_esegui(text) to service_role;
comment on function public.analisi_esegui(text) is
  'Esegue una SELECT sulle sole viste analisi_* (lista bianca dei nomi dopo FROM/JOIN; 300 righe; 8 s). La chiama solo la edge function analisi-domanda.';
