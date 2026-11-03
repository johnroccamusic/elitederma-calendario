-- L'ASSISTENTE RISPONDE ANCHE SUI DATI DELL'APP (3/11/2026).
--
-- Chiesto dal titolare: il tondo con il punto interrogativo non deve
-- rispondere solo sui regolamenti, ma anche su come funziona l'app e su
-- cosa c'e' dentro — «che corso c'e' a novembre a Bari», «qual e' la
-- master del corso di PMU», «quanto costa il kit di laminazione» —
-- «pero' solo limitatamente alle funzioni che ciascun utente vede».
--
-- COME SI TIENE IL LIMITE. Il motore e' quello di «Chiedi ai dati»: il
-- modello scrive UNA select sulle viste `analisi_*`, Postgres la esegue,
-- il modello scrive la risposta dai numeri tornati. La novita' e' che
-- `analisi_esegui` adesso accetta anche L'ELENCO DELLE VISTE AMMESSE per
-- quella domanda: la edge function lo ricava dai permessi di chi ha fatto
-- accesso (il catalogo sta in `_shared/analisi.js`), e il database rifiuta
-- qualunque altra vista anche se il modello la nominasse. Una regola che
-- vive solo nel prompt non e' una regola: il modello la puo' dimenticare,
-- il database no.
--
-- QUELLO CHE NON ENTRA, ed e' una scelta: nessuna vista porta un dato
-- personale di allievi o clienti (nome, residenza, email, telefono,
-- documento). Le domande sulle persone restano all'app, dove ci sono le
-- schede. Il motivo non e' solo il GDPR: la domanda e la risposta passano
-- da un modello di terze parti, e mandargli l'anagrafica di un'allieva e'
-- una decisione che spetta al titolare, non a chi scrive il codice.
--
-- 1. IL CALENDARIO DELLE CLASSI. Nessun dato di denaro: corso, dove,
--    quando, chi la tiene, quanti posti restano. E' la vista che risponde
--    alla domanda piu' frequente di tutte («che corso c'e' a… »), e la
--    puo' leggere chiunque sia entrato: il calendario in app lo vedono
--    tutti, anche il profilo di sola lettura.
create or replace view public.analisi_calendario as
select cd.id,
  c.nome as corso, c.categoria,
  coalesce(cd.citta, l.citta, l.nome) as citta,
  l.nome as sede, coalesce(cd.indirizzo, l.indirizzo) as indirizzo,
  cd.data_inizio, cd.data_fine,
  (cd.data_fine - cd.data_inizio + 1) as giorni,
  -- «che corso c'e' a novembre» vuol dire «che corso ci sara'»: il
  -- modello deve poter distinguere senza fare conti sulle date
  case when cd.data_inizio > current_date then 'in programma'
       when coalesce(cd.data_fine, cd.data_inizio) >= current_date then 'in corso'
       else 'concluso' end as quando,
  m.nome as master,
  -- una classe puo' avere piu' di una master (corsi_date_docenti) e piu'
  -- di un'assistente: chiesto «chi tiene il corso», vanno dette tutte
  (select string_agg(m2.nome, ', ' order by d.ordine nulls last, m2.nome)
     from public.corsi_date_docenti d
     join public.master m2 on m2.id = d.persona_id
    where d.corso_data_id = cd.id and d.tipo = 'master') as altre_master,
  (select string_agg(a.nome, ', ' order by a.nome) from public.assistente a
    where a.id = cd.assistente_id or a.id = any (coalesce(cd.assistente_ids, '{}'::uuid[]))) as assistenti,
  coalesce(cd.posti_max, c.posti_max) as posti_max,
  (select count(*) from public.iscritti i where i.corso_data_id = cd.id) as iscritti,
  (select count(*) from public.iscritti i where i.corso_data_id = cd.id and i.stato = 'confermato') as iscritti_confermati,
  -- i posti li decide l'edizione, non la sede (la capienza della sede e'
  -- solo un avviso: vedi `postiMaxEffettivi` in App.jsx, 21/10/2026)
  greatest(coalesce(cd.posti_max, c.posti_max, 0)
    - (select count(*) from public.iscritti i where i.corso_data_id = cd.id), 0) as posti_liberi,
  coalesce(cd.sede_confermata, false) as sede_confermata,
  coalesce(cd.sede_occasionale, false) as sede_occasionale,
  h.nome as hotel
from public.corsi_date cd
left join public.corsi c on c.id = cd.corso_id
left join public.location l on l.id = cd.location_id
left join public.master m on m.id = cd.master_id
left join public.hotel h on h.id = cd.alloggio_id;

-- 2. IL CATALOGO DEI CORSI. Che corsi esistono, di che categoria, quanti
--    giorni dura il programma, che pacchetti kit prevedono, quando c'e'
--    la prossima classe. Niente prezzi: il prezzo di un corso in questo
--    database NON esiste come listino — sta nelle locandine di «Prezzi
--    corsi» e, per ogni allieva, nel pattuito della sua iscrizione. Dirlo
--    e' meglio che far indovinare una cifra al modello.
create or replace view public.analisi_corsi as
select c.id, c.nome, c.categoria, c.posti_max,
  coalesce(c.prevede_dermografo, false) as prevede_dermografo,
  (select count(*) from public.corsi_giorni g where g.corso_id = c.id) as giorni_programma,
  (select count(*) from public.kit_definizioni k where k.corso_id = c.id and coalesce(k.tipo, 'kit') = 'kit') as pacchetti_kit,
  (select string_agg(k.nome, ' · ' order by k.ordine nulls last, k.nome)
     from public.kit_definizioni k where k.corso_id = c.id and coalesce(k.tipo, 'kit') = 'kit') as kit_disponibili,
  (select count(*) from public.corsi_date cd where cd.corso_id = c.id) as classi_in_tutto,
  (select count(*) from public.corsi_date cd where cd.corso_id = c.id and cd.data_inizio >= current_date) as classi_in_programma,
  (select min(cd.data_inizio) from public.corsi_date cd where cd.corso_id = c.id and cd.data_inizio >= current_date) as prossima_classe,
  (select string_agg(cc.modello_codice, ', ') from public.consensi_corsi cc where cc.corso_id = c.id) as consenso_modella
from public.corsi c;

-- 3. I KIT DEI CORSI: quali pacchetti esistono e cosa c'e' dentro. E' la
--    distinta, non il prezzo: il kit non si vende a parte, e' compreso
--    nel corso. «Quanto costa il kit di laminazione» puo' voler dire due
--    cose diverse — il kit del corso (costo del materiale, che sta in
--    analisi_prodotti_costi) o il kit che lo shop vende come prodotto
--    (analisi_prodotti): le due strade restano separate e il modello
--    chiede quale, invece di rispondere a caso.
create or replace view public.analisi_kit as
select k.id, k.nome as kit, c.nome as corso,
  coalesce(k.dermografo_a_parte, false) as dermografo_a_parte,
  (select count(*) from public.corsi_kit_prodotti p where p.kit_id = k.id) as prodotti,
  (select coalesce(sum(p.quantita), 0) from public.corsi_kit_prodotti p where p.kit_id = k.id) as pezzi
from public.kit_definizioni k
left join public.corsi c on c.id = k.corso_id
where coalesce(k.tipo, 'kit') = 'kit';

-- una riga per prodotto dentro un kit. Le righe con kit_id nullo sono gli
-- accessori della didattica e gli extra del corso: non stanno in nessun
-- pacchetto ma partono comunque con la classe, quindi si vedono qui con
-- kit = null e si dice cosa sono (`tipo`).
create or replace view public.analisi_kit_prodotti as
select p.id, k.nome as kit, c.nome as corso, p.tipo,
  pr.nome as prodotto, pr.sku, p.quantita
from public.corsi_kit_prodotti p
left join public.kit_definizioni k on k.id = p.kit_id
left join public.corsi c on c.id = p.corso_id
left join public.prodotti_shop pr on pr.id = p.prodotto_id;

-- 4. IL CATALOGO DELLO SHOP, senza costi e senza margini: quello che
--    serve a chi vende al banco o spedisce. `prezzo_vendita` in archivio
--    e' il NETTO a sei decimali (il lordo scritto comanda, il netto lo
--    segue): chi chiede «quanto costa» vuole il lordo, quindi la vista lo
--    calcola come lo calcola l'app.
-- `create or replace` non sa aggiungere una colonna in mezzo a una vista
-- che esiste gia' (42P16): si butta e si rifa'. Nessuna vista e nessuna
-- funzione dipende da questa.
drop view if exists public.analisi_prodotti;
create view public.analisi_prodotti as
select p.id, p.nome, p.sku, cat.nome as categoria,
  round(p.prezzo_vendita * (1 + coalesce(p.aliquota_iva_vendita, 22) / 100.0), 2) as prezzo,
  round(p.prezzo_vendita, 2) as prezzo_netto,
  coalesce(p.aliquota_iva_vendita, 22) as iva_percentuale,
  p.quantita as giacenza,
  -- LA DISPONIBILITA' VERA. Su un bundle (un espositore, un kit composto)
  -- `quantita` non vuol dire niente: quello che si puo' vendere sono i
  -- pezzi che si riescono a comporre dai componenti —
  -- min(floor(giacenza componente / quanti ne vuole il bundle)). E' la
  -- stessa formula di `sincronizzaDisponibilitaBundle` e del termometro
  -- del magazzino. Senza, l'assistente direbbe «esaurito» su tutti i kit
  -- dello shop, che hanno `quantita` a zero e sono in vendita.
  case when coalesce(p.tipo_prodotto, '') = 'bundle' and not coalesce(p.bundle_con_giacenza_fisica, false)
       then (select min(floor(coalesce(co.quantita, 0) / nullif(bc.quantita_per_bundle, 0)))
               from public.bundle_componenti bc
               join public.prodotti_shop co on co.id = bc.componente_id
              where bc.bundle_id = p.id)
       else p.quantita end as disponibilita,
  p.scorta_minima, p.soglia_riordino,
  coalesce(p.attivo, true) as attivo, p.stato, p.tipo_prodotto, p.unita_misura, p.pezzi_per_confezione,
  coalesce(p.backorder_attivo, false) as backorder_attivo, p.backorder_messaggio,
  (p.woo_product_id is not null) as sul_sito,
  coalesce(p.escludi_vendita_diretta, false) as escludi_vendita_diretta,
  coalesce(p.solo_offline, false) as solo_offline,
  p.punti_prodotto, p.provvigione_master_pct
from public.prodotti_shop p
left join lateral (
  select cp.nome from public.prodotti_categorie pc join public.categorie_prodotti cp on cp.id = pc.categoria_id
  where pc.prodotto_id = p.id order by pc.ordine nulls last limit 1
) cat on true;

-- 5. COSTI E MARGINI dei prodotti: la vista che NON spetta a chi sta al
--    banco. La legge chi gestisce il magazzino, perche' in Gestione
--    magazzino quei numeri li vede gia'.
create or replace view public.analisi_prodotti_costi as
select p.id, p.nome, p.sku, cat.nome as categoria, f.nome as fornitore,
  p.costo_acquisto,
  round(p.prezzo_vendita * (1 + coalesce(p.aliquota_iva_vendita, 22) / 100.0), 2) as prezzo,
  round(p.prezzo_vendita, 2) as prezzo_netto,
  case when p.costo_acquisto is not null then round(p.prezzo_vendita - p.costo_acquisto, 2) end as margine_netto,
  case when p.costo_acquisto is not null and p.prezzo_vendita > 0
       then round((p.prezzo_vendita - p.costo_acquisto) / p.prezzo_vendita * 100, 1) end as margine_pct,
  p.quantita as giacenza,
  case when p.costo_acquisto is not null then round(p.costo_acquisto * coalesce(p.quantita, 0), 2) end as valore_giacenza,
  p.lead_time_giorni, p.lotto_minimo_ordine, p.quantita_riordino
from public.prodotti_shop p
left join public.fornitori f on f.id = p.fornitore_id
left join lateral (
  select cp.nome from public.prodotti_categorie pc join public.categorie_prodotti cp on cp.id = pc.categoria_id
  where pc.prodotto_id = p.id order by pc.ordine nulls last limit 1
) cat on true;

grant select on public.analisi_calendario, public.analisi_corsi, public.analisi_kit,
  public.analisi_kit_prodotti, public.analisi_prodotti, public.analisi_prodotti_costi to analisi_lettore;
-- come le altre: non si leggono dal browser, solo tramite la funzione
revoke all on public.analisi_calendario, public.analisi_corsi, public.analisi_kit,
  public.analisi_kit_prodotti, public.analisi_prodotti, public.analisi_prodotti_costi from anon, authenticated;

-- L'ESECUTORE CON LA LISTA DI CHI CHIEDE. Due firme, non una con il
-- parametro facoltativo: con un default Postgres non saprebbe quale
-- scegliere per la chiamata a un argomento, e «Chiedi ai dati» (che
-- interroga tutto, ed e' solo per chi amministra) continua a chiamarla
-- com'e' sempre stata.
create or replace function public.analisi_esegui(p_sql text, p_viste text[])
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
    if nome = any (cte) or nome = any (ammesse) then continue; end if;
    if nome like 'analisi\_%' then
      -- la lista di chi chiede: vuota o nulla = tutte (il caso di «Chiedi
      -- ai dati»). Il messaggio dice il perche', perche' torna al modello
      -- e lui riprova con quello che ha.
      if p_viste is null or cardinality(p_viste) = 0 or nome = any (p_viste) then continue; end if;
      raise exception 'ANALISI: «%» non e'' fra le aree che questa persona puo'' vedere (puoi usare: %)', nome, array_to_string(p_viste, ', ');
    end if;
    raise exception 'ANALISI: «%» non e'' una vista di analisi', nome;
  end loop;
  perform set_config('statement_timeout', '8000', true);
  execute 'select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from (select * from (' || pulito || ') x limit 300) q' into risultato;
  return risultato;
end;
$$;

-- la firma di sempre delega a quella nuova: «Chiedi ai dati» non cambia
-- di una riga, e non c'e' un secondo controllo da tenere allineato
create or replace function public.analisi_esegui(p_sql text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.analisi_esegui(p_sql, null::text[]);
end;
$$;

revoke all on function public.analisi_esegui(text) from public, anon, authenticated;
revoke all on function public.analisi_esegui(text, text[]) from public, anon, authenticated;
grant execute on function public.analisi_esegui(text) to service_role;
grant execute on function public.analisi_esegui(text, text[]) to service_role;
comment on function public.analisi_esegui(text, text[]) is
  'Esegue una SELECT sulle sole viste analisi_* ammesse per chi chiede (p_viste; vuoto = tutte). 300 righe, 8 s. La chiamano le edge function analisi-domanda e assistente-regole.';

-- IL REGISTRO. `regolamenti_domande` raccoglieva solo le domande di
-- regola: da oggi dice anche con che registro si e' risposto e, per le
-- domande sui dati, la query che ha fatto il conto. Serve a due cose: una
-- risposta presa dai dati non e' una regola che manca (e non deve
-- comparire fra «le domande senza risposta»), e un numero sbagliato si
-- ritrova solo se si sa come e' stato contato.
alter table public.regolamenti_domande
  add column if not exists registro text,
  add column if not exists sql text,
  add column if not exists righe integer,
  add column if not exists aree text[];
comment on column public.regolamenti_domande.registro is
  'regole | ragionamento | misto | conversazione | dati | guida — con che registro ha risposto l''assistente.';
comment on column public.regolamenti_domande.aree is
  'le viste analisi_* che quella persona poteva interrogare quando ha chiesto: dice cosa vedeva, non cosa ha chiesto.';
