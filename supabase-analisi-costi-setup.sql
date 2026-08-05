-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Analisi costi di gestione" (ricostruzione completa)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: ogni CREATE usa "if not exists", i seed
-- usano "on conflict do nothing", la migrazione dati è idempotente
-- (rinomina la vecchia tabella una sola volta, poi non trova più righe da spostare).
-- =========================================================


-- ---------------------------------------------------------
-- Catalogo categorie / sotto-categorie (sostituisce l'elenco fisso in
-- App.jsx: ora amministrabile dal "Catalogo delle categorie")
-- ---------------------------------------------------------
create table if not exists public.costi_categorie (
  id text primary key,
  nome text not null,
  ordine integer not null default 0,
  attiva boolean not null default true,
  includi_analisi_costi boolean not null default true,
  attributi_predefiniti jsonb not null default '{}',
  ts timestamptz not null default now()
);
alter table public.costi_categorie enable row level security;
drop policy if exists "accesso interno costi_categorie" on public.costi_categorie;
create policy "accesso interno costi_categorie" on public.costi_categorie for all to anon using (true) with check (true);

create table if not exists public.costi_sottocategorie (
  id text primary key,
  categoria_id text not null references public.costi_categorie(id) on delete cascade,
  nome text not null,
  ordine integer not null default 0,
  attiva boolean not null default true,
  includi_analisi_costi boolean not null default true,
  -- "automatico" = valore calcolato da un campo già tracciato altrove
  -- (Riepilogo amministrativo su corsi_date, quota_venditore su iscritti),
  -- non inseribile a mano; "campo_automatico" è il nome del campo
  -- corsi_date sorgente (null per le sotto-voci manuali o per i casi
  -- speciali gestiti a codice, es. commissioni venditori)
  automatico boolean not null default false,
  campo_automatico text,
  ts timestamptz not null default now()
);
alter table public.costi_sottocategorie enable row level security;
drop policy if exists "accesso interno costi_sottocategorie" on public.costi_sottocategorie;
create policy "accesso interno costi_sottocategorie" on public.costi_sottocategorie for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- Nuovi ambiti: "Evento o fiera" e "Fornitore"
-- ---------------------------------------------------------
create table if not exists public.eventi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_inizio date,
  data_fine date,
  location_id uuid references public.location(id) on delete set null,
  ts timestamptz not null default now()
);
alter table public.eventi enable row level security;
drop policy if exists "accesso interno eventi" on public.eventi;
create policy "accesso interno eventi" on public.eventi for all to anon using (true) with check (true);

create table if not exists public.fornitori (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.fornitori enable row level security;
drop policy if exists "accesso interno fornitori" on public.fornitori;
create policy "accesso interno fornitori" on public.fornitori for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- Registro spese (sostituisce costi_operativi_voci per le spese non
-- legate a una singola classe)
-- ---------------------------------------------------------
create table if not exists public.spese (
  id uuid primary key default gen_random_uuid(),
  descrizione text,
  categoria_id text references public.costi_categorie(id) on delete set null,
  sottocategoria_id text references public.costi_sottocategorie(id) on delete set null,
  fornitore_id uuid references public.fornitori(id) on delete set null,
  numero_documento text,
  data_documento date,
  data_pagamento date,
  competenza_da date,
  competenza_a date,

  -- ambito principale (percorso rapido per il caso comune di una spesa
  -- con un solo ambito): usato quando non esistono righe in
  -- spese_attribuzioni per questa spesa. Se invece la spesa è ripartita
  -- su più ambiti, sono le righe di spese_attribuzioni ad avere
  -- l'ultima parola, non questi campi
  -- generale | struttura_centrale | sede | corso | classe | evento
  tipo_ambito text not null default 'generale',
  sede_id uuid references public.location(id) on delete set null,
  corso_id uuid references public.corsi(id) on delete set null,
  classe_id uuid references public.corsi_date(id) on delete set null,
  evento_id uuid references public.eventi(id) on delete set null,
  imponibile numeric not null default 0,
  iva_percentuale numeric not null default 22,
  totale numeric not null default 0,
  allegato_path text,
  note text,

  -- preventivata | impegnata | fatturata | pagata | parzialmente_pagata | scaduta | annullata
  stato text not null default 'pagata',

  diretto_indiretto text,
  fisso_variabile text,
  ricorrente_occasionale text,
  natura text,
  bene_durevole boolean not null default false,
  controllabilita text,
  riducibilita text,
  essenzialita text,
  -- automatico | manuale | importato
  origine text not null default 'manuale',
  includi_analisi_costi boolean not null default true,
  -- nessuna | mensile | bimestrale | trimestrale | semestrale | annuale | personalizzata
  ricorrenza text not null default 'nessuna',

  budget_previsto numeric,
  soglia_allerta_personalizzata numeric,
  responsabile_costo text,

  -- specifici della categoria "Commissioni di pagamento e dilazione"
  piattaforma_pagamento text,
  numero_transazioni integer,
  incassato_tramite_piattaforma numeric,
  percentuale_commissione_effettiva numeric,

  metodo_pagamento text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.spese enable row level security;
drop policy if exists "accesso interno spese" on public.spese;
create policy "accesso interno spese" on public.spese for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- Ripartizione di una spesa su più ambiti (percentuali che devono
-- sommare 100%, controllo fatto lato client)
-- ---------------------------------------------------------
create table if not exists public.spese_attribuzioni (
  id uuid primary key default gen_random_uuid(),
  spesa_id uuid not null references public.spese(id) on delete cascade,
  -- generale | struttura_centrale | sede | corso | classe | evento
  tipo_ambito text not null,
  sede_id uuid references public.location(id) on delete set null,
  corso_id uuid references public.corsi(id) on delete set null,
  classe_id uuid references public.corsi_date(id) on delete set null,
  evento_id uuid references public.eventi(id) on delete set null,
  percentuale numeric not null default 100,
  importo numeric not null default 0,
  ts timestamptz not null default now()
);
alter table public.spese_attribuzioni enable row level security;
drop policy if exists "accesso interno spese_attribuzioni" on public.spese_attribuzioni;
create policy "accesso interno spese_attribuzioni" on public.spese_attribuzioni for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- Budget per categoria/mese/sede/corso
-- ---------------------------------------------------------
create table if not exists public.costi_budget (
  id uuid primary key default gen_random_uuid(),
  anno integer not null,
  mese integer,
  categoria_id text references public.costi_categorie(id) on delete cascade,
  sottocategoria_id text references public.costi_sottocategorie(id) on delete cascade,
  sede_id uuid references public.location(id) on delete cascade,
  corso_id uuid references public.corsi(id) on delete cascade,
  importo_budget numeric not null default 0,
  ts timestamptz not null default now()
);
alter table public.costi_budget enable row level security;
drop policy if exists "accesso interno costi_budget" on public.costi_budget;
create policy "accesso interno costi_budget" on public.costi_budget for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- Soglie di allerta configurabili
-- ---------------------------------------------------------
create table if not exists public.costi_soglie_allerta (
  id uuid primary key default gen_random_uuid(),
  tipo_indicatore text not null,
  categoria_id text references public.costi_categorie(id) on delete cascade,
  soglia numeric not null,
  operatore text not null default '>',
  attiva boolean not null default true,
  ts timestamptz not null default now()
);
alter table public.costi_soglie_allerta enable row level security;
drop policy if exists "accesso interno costi_soglie_allerta" on public.costi_soglie_allerta;
create policy "accesso interno costi_soglie_allerta" on public.costi_soglie_allerta for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- Storage per gli allegati delle spese (fattura/ricevuta)
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public) values ('spese-allegati', 'spese-allegati', true) on conflict (id) do nothing;
drop policy if exists "accesso interno spese-allegati" on storage.objects;
create policy "accesso interno spese-allegati" on storage.objects for all to anon
  using (bucket_id = 'spese-allegati') with check (bucket_id = 'spese-allegati');


-- ---------------------------------------------------------
-- Seed: le 20 categorie definitive + "Versamenti e adempimenti" (sezione
-- a parte, esclusa dai KPI dei costi operativi)
-- ---------------------------------------------------------
insert into public.costi_categorie (id, nome, ordine, attributi_predefiniti) values
  ('personale_accademia', 'Personale dell''Accademia', 1, '{"ambito":"generale","diretto_indiretto":"indiretto","fisso_variabile":"fisso","ricorrente_occasionale":"ricorrente"}'),
  ('docenti_corsi', 'Docenti e personale dei corsi', 2, '{"ambito":"classe","diretto_indiretto":"diretto","fisso_variabile":"variabile"}'),
  ('oneri_contributivi', 'Oneri contributivi e assicurativi', 3, '{"ambito":"generale","controllabilita":"non_controllabile","ricorrente_occasionale":"ricorrente"}'),
  ('commerciale', 'Commerciale', 4, '{"fisso_variabile":"variabile"}'),
  ('commissioni_pagamento', 'Commissioni di pagamento e dilazione', 5, '{"fisso_variabile":"variabile","ricorrente_occasionale":"ricorrente"}'),
  ('pubblicita_acquisizione', 'Pubblicità e acquisizione clienti', 6, '{"fisso_variabile":"variabile","ricorrente_occasionale":"ricorrente","controllabilita":"controllabile"}'),
  ('omaggi_promozionali', 'Omaggi e materiali promozionali', 7, '{"fisso_variabile":"variabile"}'),
  ('agenzie_consulenti', 'Agenzie, consulenti e professionisti', 8, '{"fisso_variabile":"variabile","ricorrente_occasionale":"occasionale"}'),
  ('viaggi_corsi', 'Viaggi e trasferimenti per i corsi', 9, '{"ambito":"classe","diretto_indiretto":"diretto","fisso_variabile":"variabile"}'),
  ('alloggi_corsi', 'Alloggi per i corsi', 10, '{"ambito":"classe","diretto_indiretto":"diretto","fisso_variabile":"variabile"}'),
  ('vitto_corsi', 'Vitto e ospitalità dei corsi', 11, '{"ambito":"classe","diretto_indiretto":"diretto","fisso_variabile":"variabile"}'),
  ('affitto_aule_esterne', 'Affitto aule e strutture esterne', 12, '{"ambito":"classe","diretto_indiretto":"diretto","fisso_variabile":"variabile"}'),
  ('materiali_didattici_corsi', 'Materiali didattici e consumabili dei corsi', 13, '{"diretto_indiretto":"diretto","fisso_variabile":"variabile"}'),
  ('attrezzature_corsi', 'Attrezzature e dotazioni dei corsi', 14, '{"natura":"investimento","ricorrente_occasionale":"occasionale","bene_durevole":true}'),
  ('allestimento_immagine_sale', 'Allestimento e immagine delle sale', 15, '{"natura":"investimento","ricorrente_occasionale":"occasionale","riducibilita":"bassa"}'),
  ('prodotti_vendita', 'Prodotti destinati alla vendita', 16, '{"fisso_variabile":"variabile"}'),
  ('packaging_etichette', 'Packaging ed etichette', 17, '{"fisso_variabile":"variabile"}'),
  ('corrieri_spedizioni', 'Corrieri e spedizioni', 18, '{"fisso_variabile":"variabile"}'),
  ('struttura_centrale', 'Struttura centrale', 19, '{"ambito":"struttura_centrale","diretto_indiretto":"indiretto"}'),
  ('fiere_eventi', 'Fiere ed eventi', 20, '{"ambito":"evento"}'),
  ('versamenti_adempimenti', 'Versamenti e adempimenti', 21, '{}')
on conflict (id) do nothing;

update public.costi_categorie set includi_analisi_costi = false where id = 'versamenti_adempimenti';


-- ---------------------------------------------------------
-- Seed: le sotto-voci di ogni categoria (le colonne automatico/
-- campo_automatico collegano le sotto-voci ai campi già esistenti su
-- corsi_date, compilati dal pannello "Riepilogo amministrativo")
-- ---------------------------------------------------------
insert into public.costi_sottocategorie (id, categoria_id, nome, ordine, automatico, campo_automatico) values
  -- 1) Personale dell'Accademia
  ('personale_accademia__costo_coordinatore', 'personale_accademia', 'Costo coordinatore', 1, true, 'costo_coordinatore'),
  ('personale_accademia__stipendi_personale', 'personale_accademia', 'Stipendi del personale', 2, false, null),
  ('personale_accademia__compensi_amministratori', 'personale_accademia', 'Compensi amministratori', 3, false, null),
  ('personale_accademia__formazione_personale', 'personale_accademia', 'Formazione del personale', 4, false, null),
  ('personale_accademia__altre_spese', 'personale_accademia', 'Altre spese per il personale', 5, false, null),

  -- 2) Docenti e personale dei corsi
  ('docenti_corsi__compensi_master', 'docenti_corsi', 'Compensi Master', 1, true, 'costo_master'),
  ('docenti_corsi__compensi_assistenti', 'docenti_corsi', 'Compensi assistenti', 2, true, 'costo_assistenti'),
  ('docenti_corsi__altri_compensi_docenti', 'docenti_corsi', 'Altri compensi docenti', 3, false, null),
  ('docenti_corsi__formazione_docenti', 'docenti_corsi', 'Formazione e aggiornamento docenti', 4, false, null),
  ('docenti_corsi__altre_spese', 'docenti_corsi', 'Altre spese per docenti e assistenti', 5, false, null),

  -- 3) Oneri contributivi e assicurativi
  ('oneri_contributivi__inps_azienda', 'oneri_contributivi', 'Contributi INPS a carico dell''azienda', 1, false, null),
  ('oneri_contributivi__contributi_collaboratori', 'oneri_contributivi', 'Contributi per collaboratori a carico dell''azienda', 2, false, null),
  ('oneri_contributivi__contributi_amministratori', 'oneri_contributivi', 'Contributi per amministratori a carico dell''azienda', 3, false, null),
  ('oneri_contributivi__inail', 'oneri_contributivi', 'Premi e contributi INAIL', 4, false, null),
  ('oneri_contributivi__fondi_categoria', 'oneri_contributivi', 'Fondi obbligatori e contributi di categoria', 5, false, null),
  ('oneri_contributivi__tfr', 'oneri_contributivi', 'Accantonamento TFR', 6, false, null),
  ('oneri_contributivi__altri_oneri', 'oneri_contributivi', 'Altri contributi e oneri obbligatori a carico dell''azienda', 7, false, null),

  -- 4) Commerciale
  ('commerciale__commissioni_venditori', 'commerciale', 'Commissioni venditori', 1, true, null),
  ('commerciale__premi_incentivi', 'commerciale', 'Premi e incentivi commerciali', 2, false, null),
  ('commerciale__altre_spese', 'commerciale', 'Altre spese commerciali', 3, false, null),

  -- 5) Commissioni di pagamento e dilazione
  ('commissioni_pagamento__stripe', 'commissioni_pagamento', 'Commissioni Stripe', 1, false, null),
  ('commissioni_pagamento__apppago', 'commissioni_pagamento', 'Commissioni AppPago', 2, false, null),
  ('commissioni_pagamento__scalapay', 'commissioni_pagamento', 'Commissioni Scalapay', 3, false, null),
  ('commissioni_pagamento__paypal', 'commissioni_pagamento', 'Commissioni PayPal', 4, false, null),
  ('commissioni_pagamento__pos', 'commissioni_pagamento', 'Commissioni POS e carte di credito', 5, false, null),
  ('commissioni_pagamento__rateali', 'commissioni_pagamento', 'Commissioni per pagamenti rateali', 6, false, null),
  ('commissioni_pagamento__finanziamenti', 'commissioni_pagamento', 'Commissioni per finanziamenti', 7, false, null),
  ('commissioni_pagamento__canoni_piattaforme', 'commissioni_pagamento', 'Canoni delle piattaforme di pagamento', 8, false, null),
  ('commissioni_pagamento__storni_rimborsi', 'commissioni_pagamento', 'Costi per storni, rimborsi e contestazioni', 9, false, null),
  ('commissioni_pagamento__altre', 'commissioni_pagamento', 'Altre commissioni di pagamento e incasso', 10, false, null),

  -- 6) Pubblicità e acquisizione clienti
  ('pubblicita_acquisizione__meta', 'pubblicita_acquisizione', 'Campagne Meta', 1, false, null),
  ('pubblicita_acquisizione__google', 'pubblicita_acquisizione', 'Campagne Google', 2, false, null),
  ('pubblicita_acquisizione__altra_online', 'pubblicita_acquisizione', 'Altra pubblicità online', 3, false, null),
  ('pubblicita_acquisizione__offline', 'pubblicita_acquisizione', 'Pubblicità offline', 4, false, null),
  ('pubblicita_acquisizione__sponsorizzazioni', 'pubblicita_acquisizione', 'Sponsorizzazioni', 5, false, null),
  ('pubblicita_acquisizione__portali_servizi', 'pubblicita_acquisizione', 'Portali e servizi pubblicitari', 6, false, null),
  ('pubblicita_acquisizione__produzione_contenuti', 'pubblicita_acquisizione', 'Produzione di contenuti pubblicitari', 7, false, null),
  ('pubblicita_acquisizione__altre_spese', 'pubblicita_acquisizione', 'Altre spese pubblicitarie', 8, false, null),

  -- 7) Omaggi e materiali promozionali
  ('omaggi_promozionali__gadget_regalati', 'omaggi_promozionali', 'Gadget promozionali regalati', 1, false, null),
  ('omaggi_promozionali__shopper_omaggio', 'omaggi_promozionali', 'Shopper e buste omaggio', 2, false, null),
  ('omaggi_promozionali__campioni_prodotti', 'omaggi_promozionali', 'Campioni e prodotti regalati', 3, false, null),
  ('omaggi_promozionali__premi_omaggi_allievi', 'omaggi_promozionali', 'Premi e omaggi agli allievi', 4, false, null),
  ('omaggi_promozionali__materiale_distribuito', 'omaggi_promozionali', 'Materiale promozionale distribuito', 5, false, null),
  ('omaggi_promozionali__altri_omaggi', 'omaggi_promozionali', 'Altri omaggi promozionali', 6, false, null),

  -- 8) Agenzie, consulenti e professionisti
  ('agenzie_consulenti__comunicazione', 'agenzie_consulenti', 'Agenzie di comunicazione', 1, false, null),
  ('agenzie_consulenti__consulenti_aziendali', 'agenzie_consulenti', 'Consulenti aziendali', 2, false, null),
  ('agenzie_consulenti__commercialista', 'agenzie_consulenti', 'Commercialista e consulente del lavoro', 3, false, null),
  ('agenzie_consulenti__avvocati', 'agenzie_consulenti', 'Avvocati e consulenti legali', 4, false, null),
  ('agenzie_consulenti__professionisti_esterni', 'agenzie_consulenti', 'Professionisti e società esterne', 5, false, null),
  ('agenzie_consulenti__altri_servizi', 'agenzie_consulenti', 'Altri servizi professionali', 6, false, null),

  -- 9) Viaggi e trasferimenti per i corsi
  ('viaggi_corsi__master_docenti', 'viaggi_corsi', 'Viaggi Master e docenti', 1, false, null),
  ('viaggi_corsi__treni_voli', 'viaggi_corsi', 'Treni e voli', 2, false, null),
  ('viaggi_corsi__autostrada_pedaggi', 'viaggi_corsi', 'Autostrada e pedaggi', 3, false, null),
  ('viaggi_corsi__carburante', 'viaggi_corsi', 'Carburante', 4, false, null),
  ('viaggi_corsi__rimborso_parcheggi', 'viaggi_corsi', 'Rimborso parcheggi', 5, true, 'rimborso_parcheggi'),
  ('viaggi_corsi__taxi_trasporti_locali', 'viaggi_corsi', 'Taxi e trasporti locali', 6, true, 'rimborso_taxi'),
  ('viaggi_corsi__noleggio_veicoli', 'viaggi_corsi', 'Noleggio veicoli', 7, false, null),
  ('viaggi_corsi__altre_spese', 'viaggi_corsi', 'Altre spese di viaggio e trasferimento', 8, false, null),

  -- 10) Alloggi per i corsi
  ('alloggi_corsi__hotel', 'alloggi_corsi', 'Hotel', 1, true, 'costo_hotel'),
  ('alloggi_corsi__case_appartamenti', 'alloggi_corsi', 'Case e appartamenti', 2, false, null),
  ('alloggi_corsi__altre_spese', 'alloggi_corsi', 'Altre spese di alloggio', 3, false, null),

  -- 11) Vitto e ospitalità dei corsi
  ('vitto_corsi__rimborso_colazioni', 'vitto_corsi', 'Rimborso spese per colazioni', 1, true, 'rimborso_colazioni_spesa'),
  ('vitto_corsi__costo_pranzi', 'vitto_corsi', 'Costo pranzi', 2, true, 'costo_pranzi'),
  ('vitto_corsi__rimborso_cene', 'vitto_corsi', 'Rimborso cene', 3, true, 'rimborso_cene'),
  ('vitto_corsi__caffe_bevande_snack', 'vitto_corsi', 'Caffè, bevande e snack per la classe', 4, false, null),
  ('vitto_corsi__catering', 'vitto_corsi', 'Catering', 5, false, null),
  ('vitto_corsi__altre_spese', 'vitto_corsi', 'Altre spese di vitto e ospitalità', 6, false, null),

  -- 12) Affitto aule e strutture esterne
  ('affitto_aule_esterne__aule_sedi', 'affitto_aule_esterne', 'Affitto aule e sedi', 1, false, null),
  ('affitto_aule_esterne__quota_accademia', 'affitto_aule_esterne', 'Quota accademia o struttura ospitante', 2, true, 'costo_accademia'),
  ('affitto_aule_esterne__pulizia_strutture', 'affitto_aule_esterne', 'Pulizia delle strutture utilizzate', 3, false, null),
  ('affitto_aule_esterne__altre_spese', 'affitto_aule_esterne', 'Altre spese per sedi esterne', 4, false, null),

  -- 13) Materiali didattici e consumabili dei corsi
  ('materiali_didattici_corsi__materiali_consumo', 'materiali_didattici_corsi', 'Materiali di consumo', 1, false, null),
  ('materiali_didattici_corsi__materiali_esercitazioni', 'materiali_didattici_corsi', 'Materiali per esercitazioni', 2, false, null),
  ('materiali_didattici_corsi__teli_protezioni', 'materiali_didattici_corsi', 'Teli e protezioni monouso', 3, false, null),
  ('materiali_didattici_corsi__materiali_allievi', 'materiali_didattici_corsi', 'Materiali didattici per gli allievi', 4, false, null),
  ('materiali_didattici_corsi__diplomi_attestati', 'materiali_didattici_corsi', 'Diplomi e attestati', 5, false, null),
  ('materiali_didattici_corsi__fotocopie_dispense', 'materiali_didattici_corsi', 'Fotocopie e dispense', 6, false, null),
  ('materiali_didattici_corsi__libri_quaderni', 'materiali_didattici_corsi', 'Libri e quaderni', 7, false, null),
  ('materiali_didattici_corsi__cancelleria', 'materiali_didattici_corsi', 'Cancelleria per i corsi', 8, false, null),
  ('materiali_didattici_corsi__altri_materiali', 'materiali_didattici_corsi', 'Altri materiali didattici e consumabili', 9, false, null),

  -- 14) Attrezzature e dotazioni dei corsi
  ('attrezzature_corsi__lettini', 'attrezzature_corsi', 'Lettini', 1, false, null),
  ('attrezzature_corsi__lampade', 'attrezzature_corsi', 'Lampade', 2, false, null),
  ('attrezzature_corsi__carrellini', 'attrezzature_corsi', 'Carrellini', 3, false, null),
  ('attrezzature_corsi__sgabelli_sedute', 'attrezzature_corsi', 'Sgabelli e sedute operative', 4, false, null),
  ('attrezzature_corsi__teli_riutilizzabili', 'attrezzature_corsi', 'Teli coprilettino riutilizzabili', 5, false, null),
  ('attrezzature_corsi__attrezzature_tecniche', 'attrezzature_corsi', 'Attrezzature tecniche', 6, false, null),
  ('attrezzature_corsi__altre', 'attrezzature_corsi', 'Altre attrezzature e dotazioni', 7, false, null),

  -- 15) Allestimento e immagine delle sale
  ('allestimento_immagine_sale__rollup_banner', 'allestimento_immagine_sale', 'Roll-up e banner', 1, false, null),
  ('allestimento_immagine_sale__pannelli_insegne', 'allestimento_immagine_sale', 'Pannelli e insegne', 2, false, null),
  ('allestimento_immagine_sale__grafiche_decorative', 'allestimento_immagine_sale', 'Grafiche decorative', 3, false, null),
  ('allestimento_immagine_sale__espositori', 'allestimento_immagine_sale', 'Espositori', 4, false, null),
  ('allestimento_immagine_sale__elementi_coordinati', 'allestimento_immagine_sale', 'Elementi coordinati Elitederma', 5, false, null),
  ('allestimento_immagine_sale__altri_materiali', 'allestimento_immagine_sale', 'Altri materiali per l''allestimento delle sale', 6, false, null),

  -- 16) Prodotti destinati alla vendita
  ('prodotti_vendita__acquistati_rivendita', 'prodotti_vendita', 'Prodotti acquistati per la rivendita', 1, false, null),
  ('prodotti_vendita__kit_allievi', 'prodotti_vendita', 'Kit destinati agli allievi', 2, false, null),
  ('prodotti_vendita__materiali_vendita', 'prodotti_vendita', 'Materiali destinati alla vendita', 3, false, null),
  ('prodotti_vendita__gadget_vendita', 'prodotti_vendita', 'Gadget destinati alla vendita', 4, false, null),
  ('prodotti_vendita__altri_prodotti', 'prodotti_vendita', 'Altri prodotti da rivendere', 5, false, null),

  -- 17) Packaging ed etichette
  ('packaging_etichette__produzione_packaging', 'packaging_etichette', 'Produzione packaging', 1, false, null),
  ('packaging_etichette__buste_shopper', 'packaging_etichette', 'Buste e shopper', 2, false, null),
  ('packaging_etichette__scatole_confezioni', 'packaging_etichette', 'Scatole e confezioni', 3, false, null),
  ('packaging_etichette__etichette', 'packaging_etichette', 'Etichette', 4, false, null),
  ('packaging_etichette__materiali_protettivi', 'packaging_etichette', 'Materiali protettivi', 5, false, null),
  ('packaging_etichette__altri_materiali', 'packaging_etichette', 'Altri materiali per il confezionamento', 6, false, null),

  -- 18) Corrieri e spedizioni
  ('corrieri_spedizioni__spedizioni_clienti', 'corrieri_spedizioni', 'Spedizioni ai clienti', 1, false, null),
  ('corrieri_spedizioni__spedizioni_sedi', 'corrieri_spedizioni', 'Spedizioni alle sedi', 2, false, null),
  ('corrieri_spedizioni__trasporto_prodotti', 'corrieri_spedizioni', 'Trasporto di prodotti e materiali', 3, false, null),
  ('corrieri_spedizioni__supplementi_assicurazioni', 'corrieri_spedizioni', 'Supplementi e assicurazioni sulle spedizioni', 4, false, null),
  ('corrieri_spedizioni__altre_spese', 'corrieri_spedizioni', 'Altre spese di corriere', 5, false, null),

  -- 19) Struttura centrale — Immobile e gestione della struttura
  ('struttura_centrale__affitto_sede', 'struttura_centrale', 'Affitto della sede centrale', 1, false, null),
  ('struttura_centrale__condominio', 'struttura_centrale', 'Condominio', 2, false, null),
  ('struttura_centrale__pulizie', 'struttura_centrale', 'Pulizie', 3, false, null),
  ('struttura_centrale__manutenzione_ordinaria', 'struttura_centrale', 'Manutenzione ordinaria', 4, false, null),
  ('struttura_centrale__lavori_ristrutturazioni', 'struttura_centrale', 'Lavori e ristrutturazioni', 5, false, null),
  ('struttura_centrale__mobilio', 'struttura_centrale', 'Mobilio', 6, false, null),
  ('struttura_centrale__attrezzature_sede', 'struttura_centrale', 'Attrezzature della sede centrale', 7, false, null),
  ('struttura_centrale__altre_spese_struttura', 'struttura_centrale', 'Altre spese della struttura centrale', 8, false, null),
  -- 19) Struttura centrale — Utenze e servizi
  ('struttura_centrale__energia_elettrica', 'struttura_centrale', 'Energia elettrica', 9, false, null),
  ('struttura_centrale__gas', 'struttura_centrale', 'Gas', 10, false, null),
  ('struttura_centrale__acqua', 'struttura_centrale', 'Acqua', 11, false, null),
  ('struttura_centrale__tari', 'struttura_centrale', 'TARI', 12, false, null),
  ('struttura_centrale__telefono', 'struttura_centrale', 'Telefono', 13, false, null),
  ('struttura_centrale__connessione_internet', 'struttura_centrale', 'Connessione Internet', 14, false, null),
  ('struttura_centrale__canone_rai', 'struttura_centrale', 'Canone RAI', 15, false, null),
  ('struttura_centrale__altre_utenze', 'struttura_centrale', 'Altre utenze', 16, false, null),

  -- 20) Fiere ed eventi
  ('fiere_eventi__quote_partecipazione', 'fiere_eventi', 'Quote di partecipazione', 1, false, null),
  ('fiere_eventi__affitto_allestimento_stand', 'fiere_eventi', 'Affitto e allestimento stand', 2, false, null),
  ('fiere_eventi__viaggi_trasferimenti', 'fiere_eventi', 'Viaggi e trasferimenti', 3, false, null),
  ('fiere_eventi__alloggi', 'fiere_eventi', 'Alloggi', 4, false, null),
  ('fiere_eventi__vitto', 'fiere_eventi', 'Vitto', 5, false, null),
  ('fiere_eventi__spedizione_prodotti', 'fiere_eventi', 'Spedizione prodotti', 6, false, null),
  ('fiere_eventi__personalizzazioni_gadget', 'fiere_eventi', 'Personalizzazioni e gadget', 7, false, null),
  ('fiere_eventi__materiali_promozionali', 'fiere_eventi', 'Materiali promozionali dell''evento', 8, false, null),
  ('fiere_eventi__altri_costi', 'fiere_eventi', 'Altri costi di fiere ed eventi', 9, false, null),

  -- 21) Versamenti e adempimenti (esclusa dai KPI dei costi operativi)
  ('versamenti_adempimenti__contributi_trattenuti', 'versamenti_adempimenti', 'Contributi trattenuti al lavoratore', 1, false, null),
  ('versamenti_adempimenti__irpef_dipendenti', 'versamenti_adempimenti', 'IRPEF trattenuta ai dipendenti', 2, false, null),
  ('versamenti_adempimenti__ritenute_acconto', 'versamenti_adempimenti', 'Ritenute d''acconto dei professionisti', 3, false, null),
  ('versamenti_adempimenti__iva_da_versare', 'versamenti_adempimenti', 'IVA da versare', 4, false, null),
  ('versamenti_adempimenti__altre_somme_stato', 'versamenti_adempimenti', 'Altre somme riscosse o trattenute per conto dello Stato', 5, false, null)
on conflict (id) do nothing;

update public.costi_sottocategorie set includi_analisi_costi = false where categoria_id = 'versamenti_adempimenti';


-- ---------------------------------------------------------
-- Migrazione dati esistenti da costi_operativi_voci: rinomina la
-- vecchia tabella (non distruttivo) e sposta ogni riga in "spese" con
-- la nuova categoria/sotto-categoria corrispondente
-- ---------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'costi_operativi_voci')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'costi_operativi_voci_deprecata') then
    alter table public.costi_operativi_voci rename to costi_operativi_voci_deprecata;
  end if;
end $$;

insert into public.spese (
  descrizione, categoria_id, sottocategoria_id, imponibile, iva_percentuale, totale,
  data_pagamento, data_documento, metodo_pagamento, origine, stato, created_at,
  tipo_ambito, sede_id
)
select
  v.descrizione,
  case (v.categoria || '::' || v.sottovoce)
    when 'agenzie::pubblicita' then 'pubblicita_acquisizione'
    when 'agenzie::professionisti' then 'agenzie_consulenti'
    when 'agenzie::altre_spese_agenzie' then 'agenzie_consulenti'
    when 'viaggi::viaggio_master' then 'viaggi_corsi'
    when 'viaggi::autostrada_carburante' then 'viaggi_corsi'
    when 'viaggi::trasporti_extra' then 'viaggi_corsi'
    when 'viaggi::altre_spese_viaggi' then 'viaggi_corsi'
    when 'alloggi::alloggio' then 'alloggi_corsi'
    when 'alloggi::altre_spese_alloggi' then 'alloggi_corsi'
    when 'vitto::altre_spese_vitto' then 'vitto_corsi'
    when 'materiali::materiali_consumo' then 'materiali_didattici_corsi'
    when 'materiali::materiali_didattici' then 'materiali_didattici_corsi'
    when 'materiali::cibo_caffe_snack' then 'vitto_corsi'
    when 'materiali::stampa_diplomi_fotocopie' then 'materiali_didattici_corsi'
    when 'materiali::stampa_libri_quaderni_etichette' then 'materiali_didattici_corsi'
    when 'materiali::packaging_buste' then 'packaging_etichette'
    when 'materiali::gadgettistica' then 'omaggi_promozionali'
    when 'materiali::altre_spese_materiali' then 'materiali_didattici_corsi'
    when 'logistica::spedizioni' then 'corrieri_spedizioni'
    when 'logistica::altre_spese_logistica' then 'corrieri_spedizioni'
    when 'sedi::affitto_sedi' then 'affitto_aule_esterne'
    when 'sedi::altre_spese_sedi' then 'affitto_aule_esterne'
    when 'commerciale::altre_spese_commerciale' then 'commerciale'
    when 'eventi::partecipazione' then 'fiere_eventi'
    when 'eventi::alloggio_eventi' then 'fiere_eventi'
    when 'eventi::viaggio_eventi' then 'fiere_eventi'
    when 'eventi::spedizione_eventi' then 'fiere_eventi'
    when 'eventi::personalizzazioni' then 'fiere_eventi'
    when 'eventi::vitto_eventi' then 'fiere_eventi'
    when 'eventi::altri_costi_eventi' then 'fiere_eventi'
    when 'allestimento::rollup' then 'allestimento_immagine_sale'
    when 'allestimento::lettini' then 'attrezzature_corsi'
    when 'allestimento::carrellini' then 'attrezzature_corsi'
    when 'allestimento::teli' then 'attrezzature_corsi'
    when 'allestimento::altro_allestimento' then 'allestimento_immagine_sale'
    when 'accademia_centrale::affitto_sede_centrale' then 'struttura_centrale'
    when 'accademia_centrale::condominio' then 'struttura_centrale'
    when 'accademia_centrale::lavori' then 'struttura_centrale'
    when 'accademia_centrale::mobilio' then 'struttura_centrale'
    when 'accademia_centrale::altre_spese_accademia_centrale' then 'struttura_centrale'
    when 'utenze::luce' then 'struttura_centrale'
    when 'utenze::gas' then 'struttura_centrale'
    when 'utenze::tari' then 'struttura_centrale'
    when 'utenze::rai' then 'struttura_centrale'
    when 'utenze::telefono' then 'struttura_centrale'
    when 'utenze::altre_spese_utenze' then 'struttura_centrale'
    when 'personale_accademia::stipendi_personale' then 'personale_accademia'
    when 'personale_accademia::altre_spese_personale_accademia' then 'personale_accademia'
    when 'docenti_corsi::altre_spese_docenti' then 'docenti_corsi'
    else 'materiali_didattici_corsi' -- rete di sicurezza: nessuna voce dovrebbe cadere qui
  end as categoria_id,
  case (v.categoria || '::' || v.sottovoce)
    when 'agenzie::pubblicita' then 'pubblicita_acquisizione__altra_online'
    when 'agenzie::professionisti' then 'agenzie_consulenti__professionisti_esterni'
    when 'agenzie::altre_spese_agenzie' then 'agenzie_consulenti__altri_servizi'
    when 'viaggi::viaggio_master' then 'viaggi_corsi__master_docenti'
    when 'viaggi::autostrada_carburante' then 'viaggi_corsi__autostrada_pedaggi'
    when 'viaggi::trasporti_extra' then 'viaggi_corsi__taxi_trasporti_locali'
    when 'viaggi::altre_spese_viaggi' then 'viaggi_corsi__altre_spese'
    when 'alloggi::alloggio' then 'alloggi_corsi__case_appartamenti'
    when 'alloggi::altre_spese_alloggi' then 'alloggi_corsi__altre_spese'
    when 'vitto::altre_spese_vitto' then 'vitto_corsi__altre_spese'
    when 'materiali::materiali_consumo' then 'materiali_didattici_corsi__materiali_consumo'
    when 'materiali::materiali_didattici' then 'materiali_didattici_corsi__materiali_allievi'
    when 'materiali::cibo_caffe_snack' then 'vitto_corsi__caffe_bevande_snack'
    when 'materiali::stampa_diplomi_fotocopie' then 'materiali_didattici_corsi__diplomi_attestati'
    when 'materiali::stampa_libri_quaderni_etichette' then 'materiali_didattici_corsi__libri_quaderni'
    when 'materiali::packaging_buste' then 'packaging_etichette__produzione_packaging'
    when 'materiali::gadgettistica' then 'omaggi_promozionali__gadget_regalati'
    when 'materiali::altre_spese_materiali' then 'materiali_didattici_corsi__altri_materiali'
    when 'logistica::spedizioni' then 'corrieri_spedizioni__spedizioni_clienti'
    when 'logistica::altre_spese_logistica' then 'corrieri_spedizioni__altre_spese'
    when 'sedi::affitto_sedi' then 'affitto_aule_esterne__aule_sedi'
    when 'sedi::altre_spese_sedi' then 'affitto_aule_esterne__altre_spese'
    when 'commerciale::altre_spese_commerciale' then 'commerciale__altre_spese'
    when 'eventi::partecipazione' then 'fiere_eventi__quote_partecipazione'
    when 'eventi::alloggio_eventi' then 'fiere_eventi__alloggi'
    when 'eventi::viaggio_eventi' then 'fiere_eventi__viaggi_trasferimenti'
    when 'eventi::spedizione_eventi' then 'fiere_eventi__spedizione_prodotti'
    when 'eventi::personalizzazioni' then 'fiere_eventi__personalizzazioni_gadget'
    when 'eventi::vitto_eventi' then 'fiere_eventi__vitto'
    when 'eventi::altri_costi_eventi' then 'fiere_eventi__altri_costi'
    when 'allestimento::rollup' then 'allestimento_immagine_sale__rollup_banner'
    when 'allestimento::lettini' then 'attrezzature_corsi__lettini'
    when 'allestimento::carrellini' then 'attrezzature_corsi__carrellini'
    when 'allestimento::teli' then 'attrezzature_corsi__teli_riutilizzabili'
    when 'allestimento::altro_allestimento' then 'allestimento_immagine_sale__altri_materiali'
    when 'accademia_centrale::affitto_sede_centrale' then 'struttura_centrale__affitto_sede'
    when 'accademia_centrale::condominio' then 'struttura_centrale__condominio'
    when 'accademia_centrale::lavori' then 'struttura_centrale__lavori_ristrutturazioni'
    when 'accademia_centrale::mobilio' then 'struttura_centrale__mobilio'
    when 'accademia_centrale::altre_spese_accademia_centrale' then 'struttura_centrale__altre_spese_struttura'
    when 'utenze::luce' then 'struttura_centrale__energia_elettrica'
    when 'utenze::gas' then 'struttura_centrale__gas'
    when 'utenze::tari' then 'struttura_centrale__tari'
    when 'utenze::rai' then 'struttura_centrale__canone_rai'
    when 'utenze::telefono' then 'struttura_centrale__telefono'
    when 'utenze::altre_spese_utenze' then 'struttura_centrale__altre_utenze'
    when 'personale_accademia::stipendi_personale' then 'personale_accademia__stipendi_personale'
    when 'personale_accademia::altre_spese_personale_accademia' then 'personale_accademia__altre_spese'
    when 'docenti_corsi::altre_spese_docenti' then 'docenti_corsi__altre_spese'
    else 'materiali_didattici_corsi__altri_materiali'
  end as sottocategoria_id,
  v.imponibile, v.iva_percentuale, v.totale,
  v.data, v.data, v.metodo_pagamento, 'manuale', 'pagata', v.ts,
  case when v.location_id is not null then 'sede' else 'generale' end, v.location_id
from public.costi_operativi_voci_deprecata v
where not exists (
  -- idempotenza: se rieseguito, non duplica righe già migrate
  select 1 from public.spese s where s.origine = 'manuale' and s.data_pagamento = v.data and s.totale = v.totale and s.descrizione is not distinct from v.descrizione
);


notify pgrst, 'reload schema';
