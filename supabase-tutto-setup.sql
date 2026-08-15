-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Setup completo (tutte le migrazioni)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
--
-- E scritto per essere sicuro da eseguire in qualunque momento: ogni
-- pezzo controlla prima se esiste gia (tabelle, colonne, policy, bucket)
-- e se si lo salta, quindi puoi lanciarlo anche se il tuo database ha
-- gia alcune di queste modifiche - non duplica ne rompe nulla.
--
-- Nota: alcune colonne di "iscritti" e di "corsi_date" (i dettagli di
-- vendita/pagamento dell'iscritto, le date come "data_inizio"/"data_fine")
-- sono state aggiunte in passato direttamente dal pannello Supabase,
-- senza passare da un file .sql: qui sono comunque incluse dove note con
-- certezza, cosi il file resta utilizzabile anche per ricreare il
-- database da zero, non solo per aggiornare quello attuale.
-- =========================================================


-- ---------------------------------------------------------
-- 1) Base: corsi, location, corsi_date, iscritti
-- ---------------------------------------------------------
create table if not exists public.corsi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  colore text not null unique,
  posti_max int not null default 10,
  ts timestamptz not null default now()
);

create table if not exists public.location (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ts timestamptz not null default now()
);

create table if not exists public.corsi_date (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi(id) on delete cascade,
  location_id uuid not null references public.location(id) on delete cascade,
  data date not null,
  posti_max int,
  ts timestamptz not null default now()
);

create table if not exists public.iscritti (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  nome text not null,
  cognome text not null,
  note text,
  ts timestamptz not null default now()
);

alter table public.corsi enable row level security;
alter table public.location enable row level security;
alter table public.corsi_date enable row level security;
alter table public.iscritti enable row level security;

drop policy if exists "accesso interno corsi" on public.corsi;
create policy "accesso interno corsi" on public.corsi for all to anon using (true) with check (true);
drop policy if exists "accesso interno location" on public.location;
create policy "accesso interno location" on public.location for all to anon using (true) with check (true);
drop policy if exists "accesso interno corsi_date" on public.corsi_date;
create policy "accesso interno corsi_date" on public.corsi_date for all to anon using (true) with check (true);
drop policy if exists "accesso interno iscritti" on public.iscritti;
create policy "accesso interno iscritti" on public.iscritti for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- 2) Master + assegnazione a una data
-- ---------------------------------------------------------
create table if not exists public.master (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.master enable row level security;
drop policy if exists "accesso interno master" on public.master;
create policy "accesso interno master" on public.master for all to anon using (true) with check (true);

alter table public.corsi_date add column if not exists master_id uuid references public.master(id) on delete set null;


-- ---------------------------------------------------------
-- 3) Hotel, Assistente, Leva
-- ---------------------------------------------------------
create table if not exists public.hotel (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.hotel enable row level security;
drop policy if exists "accesso interno hotel" on public.hotel;
create policy "accesso interno hotel" on public.hotel for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.hotel to anon, authenticated;

create table if not exists public.assistente (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.assistente enable row level security;
drop policy if exists "accesso interno assistente" on public.assistente;
create policy "accesso interno assistente" on public.assistente for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.assistente to anon, authenticated;

create table if not exists public.leva (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.leva enable row level security;
drop policy if exists "accesso interno leva" on public.leva;
create policy "accesso interno leva" on public.leva for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.leva to anon, authenticated;


-- ---------------------------------------------------------
-- 4) Campi "Assegnazione Master" su corsi_date
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists sede_confermata boolean not null default false;
alter table public.corsi_date add column if not exists note text;
alter table public.corsi_date add column if not exists assistente_id uuid references public.assistente(id) on delete set null;
alter table public.corsi_date add column if not exists leva_id uuid references public.leva(id) on delete set null;
alter table public.corsi_date add column if not exists alloggio_id uuid references public.hotel(id) on delete set null;
alter table public.corsi_date add column if not exists viaggio_prenotato boolean not null default false;
alter table public.corsi_date add column if not exists viaggio_file text[];
alter table public.corsi_date add column if not exists note_viaggio text;


-- ---------------------------------------------------------
-- 5) Piu assistenti e piu leve per data (elenchi, non un solo id)
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists assistente_ids uuid[] not null default '{}';
alter table public.corsi_date add column if not exists leva_ids uuid[] not null default '{}';

update public.corsi_date set assistente_ids = array[assistente_id]
  where assistente_id is not null and assistente_ids = '{}';
update public.corsi_date set leva_ids = array[leva_id]
  where leva_id is not null and leva_ids = '{}';


-- ---------------------------------------------------------
-- 5b) Date con inizio/fine (corsi di piu giorni) + campi vendita/pagamento
-- di un iscritto (modulo completo di iscrizione)
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists data_inizio date;
alter table public.corsi_date add column if not exists data_fine date;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'corsi_date' and column_name = 'data'
  ) then
    update public.corsi_date set data_inizio = data, data_fine = data
      where data_inizio is null and data is not null;
  end if;
end $$;

alter table public.iscritti add column if not exists tutor text;
alter table public.iscritti add column if not exists telefono text;
alter table public.iscritti add column if not exists acconto_imponibile numeric;
alter table public.iscritti add column if not exists acconto_totale numeric;
alter table public.iscritti add column if not exists acconto_metodo text;
alter table public.iscritti add column if not exists acconto_interessi numeric;
alter table public.iscritti add column if not exists precorso_imponibile numeric;
alter table public.iscritti add column if not exists precorso_totale numeric;
alter table public.iscritti add column if not exists precorso_metodo text;
alter table public.iscritti add column if not exists precorso_interessi numeric;
alter table public.iscritti add column if not exists saldo_imponibile numeric;
alter table public.iscritti add column if not exists saldo_totale numeric;
alter table public.iscritti add column if not exists saldo_metodo text;
alter table public.iscritti add column if not exists accordi_commerciali text;
alter table public.iscritti add column if not exists richiede_modelle boolean;
alter table public.iscritti add column if not exists numero_modelle int;
alter table public.iscritti add column if not exists prezzo_speciale_modelle numeric;
alter table public.iscritti add column if not exists pacchetto_kit text;
alter table public.iscritti add column if not exists taglia_divisa text;
alter table public.iscritti add column if not exists totale_pattuito numeric;
alter table public.iscritti add column if not exists quota_venditore numeric;
alter table public.iscritti add column if not exists file_iscrizione text;
alter table public.iscritti add column if not exists file_screen_acconto text;
alter table public.iscritti add column if not exists file_screen_recap text;

-- bucket per i file caricati sulla scheda iscritto (modulo/screen)
insert into storage.buckets (id, name, public)
values ('allegati-iscritti', 'allegati-iscritti', true)
on conflict (id) do nothing;
drop policy if exists "accesso interno allegati-iscritti" on storage.objects;
create policy "accesso interno allegati-iscritti" on storage.objects for all to anon
  using (bucket_id = 'allegati-iscritti') with check (bucket_id = 'allegati-iscritti');


-- ---------------------------------------------------------
-- 6) Quota speciale iscritto (sostituisce la quota venditore del 7%)
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists quota_speciale numeric;


-- ---------------------------------------------------------
-- 7) Stampa diplomi: template per corso, font globali, posizione globale
-- ---------------------------------------------------------
alter table public.corsi add column if not exists diploma_template_path text;

create table if not exists public.font_diplomi (
  id uuid primary key default gen_random_uuid(),
  font_allievo_path text,
  font_data_path text,
  font_firma_path text,
  diploma_riferimento_path text,
  nome_pos_x numeric not null default 50,
  nome_pos_y numeric not null default 50,
  nome_font_size int not null default 24,
  nome_colore text not null default '#000000',
  nome_allineamento text not null default 'center',
  data_pos_x numeric not null default 50,
  data_pos_y numeric not null default 65,
  data_font_size int not null default 16,
  data_colore text not null default '#000000',
  data_allineamento text not null default 'center',
  firma_pos_x numeric not null default 50,
  firma_pos_y numeric not null default 80,
  firma_font_size int not null default 16,
  firma_colore text not null default '#000000',
  firma_allineamento text not null default 'center',
  ts timestamptz not null default now()
);
alter table public.font_diplomi enable row level security;
drop policy if exists "accesso interno font_diplomi" on public.font_diplomi;
create policy "accesso interno font_diplomi" on public.font_diplomi for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('diploma-templates', 'diploma-templates', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('diploma-fonts', 'diploma-fonts', true)
on conflict (id) do nothing;

drop policy if exists "accesso interno diploma-templates" on storage.objects;
create policy "accesso interno diploma-templates" on storage.objects for all to anon
  using (bucket_id = 'diploma-templates') with check (bucket_id = 'diploma-templates');

drop policy if exists "accesso interno diploma-fonts" on storage.objects;
create policy "accesso interno diploma-fonts" on storage.objects for all to anon
  using (bucket_id = 'diploma-fonts') with check (bucket_id = 'diploma-fonts');


-- ---------------------------------------------------------
-- 8) Eccezioni diplomi: diplomi alternativi assegnabili al singolo
-- iscritto (template e/o data diversi da quelli normali del corso)
-- ---------------------------------------------------------
create table if not exists public.diploma_eccezioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  file_path text not null,
  ts timestamptz not null default now()
);
alter table public.diploma_eccezioni enable row level security;
drop policy if exists "accesso interno diploma_eccezioni" on public.diploma_eccezioni;
create policy "accesso interno diploma_eccezioni" on public.diploma_eccezioni for all to anon using (true) with check (true);

alter table public.iscritti add column if not exists diploma_eccezione_id uuid references public.diploma_eccezioni(id) on delete set null;
alter table public.iscritti add column if not exists diploma_eccezione_data date;


-- ---------------------------------------------------------
-- 9) Stampa Segnaposto: font, foglio A4 di stampa, posizione dei 7 posti
-- ---------------------------------------------------------
create table if not exists public.segnaposti_config (
  id uuid primary key default gen_random_uuid(),
  font_path text,
  riferimento_path text,
  font_size int not null default 20,
  colore text not null default '#000000',
  limite_pos_x numeric not null default 85,
  slot1_pos_x numeric not null default 50, slot1_pos_y numeric not null default 12.5,
  slot2_pos_x numeric not null default 50, slot2_pos_y numeric not null default 25,
  slot3_pos_x numeric not null default 50, slot3_pos_y numeric not null default 37.5,
  slot4_pos_x numeric not null default 50, slot4_pos_y numeric not null default 50,
  slot5_pos_x numeric not null default 50, slot5_pos_y numeric not null default 62.5,
  slot6_pos_x numeric not null default 50, slot6_pos_y numeric not null default 75,
  slot7_pos_x numeric not null default 50, slot7_pos_y numeric not null default 87.5,
  ts timestamptz not null default now()
);
alter table public.segnaposti_config enable row level security;
drop policy if exists "accesso interno segnaposti_config" on public.segnaposti_config;
create policy "accesso interno segnaposti_config" on public.segnaposti_config for all to anon using (true) with check (true);
alter table public.segnaposti_config add column if not exists limite_pos_x numeric not null default 85;


-- ---------------------------------------------------------
-- 10) Master: "diploma gia' firmato" (niente firma automatica in stampa)
-- ---------------------------------------------------------
alter table public.master add column if not exists diploma_gia_firmato boolean not null default false;


-- ---------------------------------------------------------
-- 11) Linee di limite testo: nome allievo (diploma) e segnaposti
-- ---------------------------------------------------------
alter table public.font_diplomi add column if not exists nome_limite_sx numeric not null default 20;
alter table public.font_diplomi add column if not exists nome_limite_dx numeric not null default 80;
alter table public.segnaposti_config add column if not exists limite_sx_pos_x numeric not null default 30;
alter table public.segnaposti_config add column if not exists limite_dx_pos_x numeric not null default 70;


-- ---------------------------------------------------------
-- 12) "Ristampa solo questo": stampa diplomi solo per gli iscritti flaggati
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists ristampa_diploma boolean not null default false;


-- ---------------------------------------------------------
-- 13) "Vecchia iscrizione": non conta nelle statistiche/iscrizioni di oggi
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists vecchia_iscrizione boolean not null default false;


-- ---------------------------------------------------------
-- 14) "Riepilogo amministrativo": costi della classe (Contabilità classe)
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists costo_accademia numeric;
alter table public.corsi_date add column if not exists costo_master numeric;
alter table public.corsi_date add column if not exists costo_assistenti numeric;
alter table public.corsi_date add column if not exists costo_pranzi numeric;
alter table public.corsi_date add column if not exists costo_hotel numeric;
alter table public.corsi_date add column if not exists costi_extra jsonb not null default '[]';


-- ---------------------------------------------------------
-- 15) "Setting loghi" + "Generazione loghi"
-- ---------------------------------------------------------
create table if not exists public.loghi_impostazioni (
  id uuid primary key default gen_random_uuid(),
  font_nome_path text,
  font_numero_path text,
  prossimo_numero integer not null default 1,
  ts timestamptz not null default now()
);
alter table public.loghi_impostazioni enable row level security;
drop policy if exists "accesso interno loghi_impostazioni" on public.loghi_impostazioni;
create policy "accesso interno loghi_impostazioni" on public.loghi_impostazioni for all to anon using (true) with check (true);

create table if not exists public.loghi_categorie (
  chiave text primary key,
  etichetta text not null,
  richiede_bianco boolean not null default true,
  logo_nero_path text,
  logo_bianco_path text,
  nome_pos_x numeric not null default 50,
  nome_pos_y numeric not null default 40,
  nome_font_size integer not null default 60,
  nome_colore text not null default '#ffffff',
  numero_pos_x numeric not null default 50,
  numero_pos_y numeric not null default 60,
  numero_font_size integer not null default 36,
  numero_colore text not null default '#ffffff'
);
alter table public.loghi_categorie enable row level security;
drop policy if exists "accesso interno loghi_categorie" on public.loghi_categorie;
create policy "accesso interno loghi_categorie" on public.loghi_categorie for all to anon using (true) with check (true);

insert into public.loghi_categorie (chiave, etichetta, richiede_bianco) values
  ('microblading_artist', 'Microblading — Artist', true),
  ('microblading_expert', 'Microblading — Expert', true),
  ('pmu_artist', 'PMU — Artist', true),
  ('pmu_expert', 'PMU — Expert', true),
  ('laminazione_artist', 'Laminazione — Artist', true),
  ('laminazione_expert', 'Laminazione — Expert', true),
  ('extension_artist', 'Extension — Artist', true),
  ('extension_expert', 'Extension — Expert', true),
  ('master_assistant', 'Master Assistant', true),
  ('master', 'Master', false)
on conflict (chiave) do nothing;

insert into storage.buckets (id, name, public)
values ('loghi-immagini', 'loghi-immagini', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('loghi-fonts', 'loghi-fonts', true)
on conflict (id) do nothing;

drop policy if exists "accesso interno loghi-immagini" on storage.objects;
create policy "accesso interno loghi-immagini" on storage.objects for all to anon
  using (bucket_id = 'loghi-immagini') with check (bucket_id = 'loghi-immagini');

drop policy if exists "accesso interno loghi-fonts" on storage.objects;
create policy "accesso interno loghi-fonts" on storage.objects for all to anon
  using (bucket_id = 'loghi-fonts') with check (bucket_id = 'loghi-fonts');


-- ---------------------------------------------------------
-- 16) "Assegna modelle": trattamento + mattina/pomeriggio per ogni modella
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists tipi_modelle jsonb not null default '[]';


-- ---------------------------------------------------------
-- 17) "Richiede fattura": dati di fatturazione dell'iscritto
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists richiede_fattura boolean not null default false;
alter table public.iscritti add column if not exists fattura_ditta text;
alter table public.iscritti add column if not exists fattura_indirizzo text;
alter table public.iscritti add column if not exists fattura_civico text;
alter table public.iscritti add column if not exists fattura_citta text;
alter table public.iscritti add column if not exists fattura_prov text;
alter table public.iscritti add column if not exists fattura_cap text;
alter table public.iscritti add column if not exists fattura_piva text;
alter table public.iscritti add column if not exists fattura_cod_dest text;
alter table public.iscritti add column if not exists fattura_pec text;


-- ---------------------------------------------------------
-- 18) "Setting loghi": calibrazione indipendente per logo nero e
-- logo bianco, colore testo automatico (nero su logo nero, bianco su
-- logo bianco) e limiti sx/dx per il nome allieva
-- ---------------------------------------------------------
alter table public.loghi_categorie drop column if exists nome_colore;
alter table public.loghi_categorie drop column if exists numero_colore;
alter table public.loghi_categorie drop column if exists nome_pos_x;
alter table public.loghi_categorie drop column if exists nome_pos_y;
alter table public.loghi_categorie drop column if exists nome_font_size;
alter table public.loghi_categorie drop column if exists numero_pos_x;
alter table public.loghi_categorie drop column if exists numero_pos_y;
alter table public.loghi_categorie drop column if exists numero_font_size;

alter table public.loghi_categorie add column if not exists nero_nome_pos_y numeric not null default 40;
alter table public.loghi_categorie add column if not exists nero_nome_font_size integer not null default 60;
alter table public.loghi_categorie add column if not exists nero_nome_limite_sx numeric not null default 10;
alter table public.loghi_categorie add column if not exists nero_nome_limite_dx numeric not null default 90;
alter table public.loghi_categorie add column if not exists nero_numero_pos_x numeric not null default 50;
alter table public.loghi_categorie add column if not exists nero_numero_pos_y numeric not null default 60;
alter table public.loghi_categorie add column if not exists nero_numero_font_size integer not null default 36;

alter table public.loghi_categorie add column if not exists bianco_nome_pos_y numeric not null default 40;
alter table public.loghi_categorie add column if not exists bianco_nome_font_size integer not null default 60;
alter table public.loghi_categorie add column if not exists bianco_nome_limite_sx numeric not null default 10;
alter table public.loghi_categorie add column if not exists bianco_nome_limite_dx numeric not null default 90;
alter table public.loghi_categorie add column if not exists bianco_numero_pos_x numeric not null default 50;
alter table public.loghi_categorie add column if not exists bianco_numero_pos_y numeric not null default 60;
alter table public.loghi_categorie add column if not exists bianco_numero_font_size integer not null default 36;


-- ---------------------------------------------------------
-- 19) "Viaggio ass.": affianca "viaggio_prenotato"/"viaggio_file"
-- (ora "Viaggio master") con un secondo set per il viaggio dell'assistente
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists viaggio_assistente_prenotato boolean not null default false;
alter table public.corsi_date add column if not exists viaggio_assistente_file text[];


-- ---------------------------------------------------------
-- 20) "Costi operativi": voci di costo manuali (categorie 1-6, 8-9), con
-- imponibile/IVA/totale separati e aliquota IVA scelta riga per riga
-- ---------------------------------------------------------
create table if not exists public.costi_operativi_voci (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  sottovoce text not null,
  descrizione text,
  location_id uuid references public.location(id) on delete set null,
  imponibile numeric not null default 0,
  iva_percentuale numeric not null default 22,
  totale numeric not null default 0,
  data date not null default current_date,
  ts timestamptz not null default now()
);
alter table public.costi_operativi_voci enable row level security;
drop policy if exists "accesso interno costi_operativi_voci" on public.costi_operativi_voci;
create policy "accesso interno costi_operativi_voci" on public.costi_operativi_voci for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- 21) "Nuova operazione" (Uscita): metodo di pagamento dell'uscita
-- ---------------------------------------------------------
alter table public.costi_operativi_voci add column if not exists metodo_pagamento text;


-- ---------------------------------------------------------
-- 22) Ristrutturazione categorie "Costi operativi": "Logistica" (ora
-- "Corrieri e spedizioni") perde "Lavori edili", spostata sotto la
-- nuova categoria "Spese Accademia centrale" > "Lavori"
-- ---------------------------------------------------------
update public.costi_operativi_voci
set categoria = 'accademia_centrale', sottovoce = 'lavori'
where categoria = 'logistica' and sottovoce = 'lavori_edili';


-- ---------------------------------------------------------
-- 23) Rimborsi standard in "Riepilogo amministrativo": Rimborso cene e
-- colazioni, Rimborso taxi, Rimborso parcheggi (in detrazione dal cash
-- del corso come gli altri costi fissi della classe). "Vitto insegnanti
-- e personale" diventa "Vitto Docenti e personale al corso", automatica
-- (Costo pranzi + Rimborso cene e colazioni), non più manuale
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists rimborso_cene_colazioni numeric;
alter table public.corsi_date add column if not exists rimborso_taxi numeric;
alter table public.corsi_date add column if not exists rimborso_parcheggi numeric;

update public.costi_operativi_voci
set sottovoce = 'altre_spese_vitto'
where categoria = 'vitto' and sottovoce = 'vitto_personale';


-- ---------------------------------------------------------
-- 24) Costo coordinatore, split di "Rimborso cene e colazioni" in due
-- campi distinti, e "Trasferte" divisa in "Costo viaggi"/"Costo alloggi"
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists costo_coordinatore numeric;
alter table public.corsi_date add column if not exists rimborso_cene numeric;
alter table public.corsi_date add column if not exists rimborso_colazioni_spesa numeric;

update public.corsi_date set rimborso_cene = rimborso_cene_colazioni where rimborso_cene_colazioni is not null;
alter table public.corsi_date drop column if exists rimborso_cene_colazioni;

update public.costi_operativi_voci
set categoria = 'alloggi'
where categoria = 'trasferte' and sottovoce = 'alloggio';

update public.costi_operativi_voci
set categoria = 'viaggi'
where categoria = 'trasferte' and sottovoce in ('viaggio_master', 'autostrada_carburante', 'trasporti_extra');

update public.costi_operativi_voci
set categoria = 'viaggi', sottovoce = 'altre_spese_viaggi'
where categoria = 'trasferte' and sottovoce = 'altre_spese_trasferte';

update public.corsi_date
set costi_extra = (
  select jsonb_agg(
    case when elem->>'categoria' = 'trasferte' then jsonb_set(elem, '{categoria}', '"viaggi"') else elem end
  )
  from jsonb_array_elements(costi_extra) elem
)
where costi_extra @> '[{"categoria": "trasferte"}]';

-- ---------------------------------------------------------
-- 25) Nuovo modulo "Analisi costi di gestione": ricostruzione relazionale
-- completa dei costi operativi (20 categorie, ~150 sotto-categorie, spese
-- con stato economico/finanziario, attribuzione multi-ambito, budget,
-- soglie di allerta). Rinomina costi_operativi_voci in
-- costi_operativi_voci_deprecata (non distruttivo) e ne migra i dati.
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 26) "+ Nuova operazione" > "Entrata": registra incassi occasionali non
-- legati a un'iscrizione (es. vendita di un prodotto in accademia).
-- Confluiscono nel KPI "Ricavi totali" della dashboard ERP.
-- ---------------------------------------------------------
-- incassi occasionali non legati a un'iscrizione (es. vendita di un
-- prodotto in accademia a un cliente occasionale, pagato in contanti):
-- confluiscono nei "Ricavi totali" della dashboard ERP, sull'imponibile,
-- con lo stesso criterio "al netto di IVA" usato per i ricavi corsi
create table if not exists public.entrate_manuali (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  sede_id uuid references public.location(id) on delete set null,
  descrizione text,
  imponibile numeric not null default 0,
  iva_percentuale numeric not null default 22,
  totale numeric not null default 0,
  metodo_pagamento text,
  ts timestamptz not null default now()
);
alter table public.entrate_manuali enable row level security;
drop policy if exists "accesso interno entrate_manuali" on public.entrate_manuali;
create policy "accesso interno entrate_manuali" on public.entrate_manuali for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 27) Riepilogo amministrativo: i 10 costi fissi della classe (Costo
-- Master, Rimborso cene...) diventano spese vere in "spese" invece di
-- numeri nudi su corsi_date. Migra i valori già presenti (non
-- distruttivo: le colonne di corsi_date restano, solo non più lette).
-- ---------------------------------------------------------
-- I 10 costi fissi del pannello "Riepilogo amministrativo" (Costo
-- Master, Costo pranzi, Rimborso cene...) finora vivevano solo come
-- numeri nudi in colonne dedicate di corsi_date. Ora ogni casella apre
-- il form "Nuova spesa" completo (fornitore, metodo di pagamento,
-- allegato...): il valore diventa una spesa vera in "spese", collegata
-- alla classe (tipo_ambito='classe'), così compare anche nel drill-down
-- di "Analisi costi di gestione". Le colonne di corsi_date NON vengono
-- toccate né cancellate (restano come archivio storico): questo script
-- si limita a copiarne il valore, una sola volta, dentro "spese".

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'personale_accademia', 'personale_accademia__costo_coordinatore', 'classe', cd.id, cd.costo_coordinatore, 0, cd.costo_coordinatore, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_coordinatore is not null and cd.costo_coordinatore <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'personale_accademia__costo_coordinatore');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'docenti_corsi', 'docenti_corsi__compensi_master', 'classe', cd.id, cd.costo_master, 0, cd.costo_master, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_master is not null and cd.costo_master <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'docenti_corsi__compensi_master');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'docenti_corsi', 'docenti_corsi__compensi_assistenti', 'classe', cd.id, cd.costo_assistenti, 0, cd.costo_assistenti, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_assistenti is not null and cd.costo_assistenti <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'docenti_corsi__compensi_assistenti');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'vitto_corsi', 'vitto_corsi__costo_pranzi', 'classe', cd.id, cd.costo_pranzi, 0, cd.costo_pranzi, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_pranzi is not null and cd.costo_pranzi <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'vitto_corsi__costo_pranzi');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'vitto_corsi', 'vitto_corsi__rimborso_cene', 'classe', cd.id, cd.rimborso_cene, 0, cd.rimborso_cene, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.rimborso_cene is not null and cd.rimborso_cene <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'vitto_corsi__rimborso_cene');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'vitto_corsi', 'vitto_corsi__rimborso_colazioni', 'classe', cd.id, cd.rimborso_colazioni_spesa, 0, cd.rimborso_colazioni_spesa, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.rimborso_colazioni_spesa is not null and cd.rimborso_colazioni_spesa <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'vitto_corsi__rimborso_colazioni');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'alloggi_corsi', 'alloggi_corsi__hotel', 'classe', cd.id, cd.costo_hotel, 0, cd.costo_hotel, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_hotel is not null and cd.costo_hotel <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'alloggi_corsi__hotel');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'viaggi_corsi', 'viaggi_corsi__taxi_trasporti_locali', 'classe', cd.id, cd.rimborso_taxi, 0, cd.rimborso_taxi, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.rimborso_taxi is not null and cd.rimborso_taxi <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'viaggi_corsi__taxi_trasporti_locali');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'viaggi_corsi', 'viaggi_corsi__rimborso_parcheggi', 'classe', cd.id, cd.rimborso_parcheggi, 0, cd.rimborso_parcheggi, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.rimborso_parcheggi is not null and cd.rimborso_parcheggi <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'viaggi_corsi__rimborso_parcheggi');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'affitto_aule_esterne', 'affitto_aule_esterne__quota_accademia', 'classe', cd.id, cd.costo_accademia, 0, cd.costo_accademia, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_accademia is not null and cd.costo_accademia <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'affitto_aule_esterne__quota_accademia');

-- campo_automatico non serve più (i valori ora sono spese vere, non
-- sintetizzate da corsi_date): lo svuoto per chiarezza, "automatico"
-- resta true così queste sotto-voci restano escluse dal "+" generico
-- (si aggiungono solo dalla casella dedicata nel Riepilogo amministrativo)
update public.costi_sottocategorie set campo_automatico = null where campo_automatico is not null;

-- ---------------------------------------------------------
-- 28) Integrazione WooCommerce: tabella "vendite_shop" popolata dalle
-- Edge Function "woo-webhook" (tempo reale) e "woo-import-storico"
-- (una tantum) — vedi supabase/functions/ nel repository.
-- ---------------------------------------------------------
-- una riga per ogni ordine WooCommerce, tenuta aggiornata dalla Edge
-- Function "woo-webhook" (nuovo ordine/aggiornamento stato) e popolata
-- una tantum dalla Edge Function "woo-import-storico" per gli ordini
-- già esistenti prima di attivare il webhook
create table if not exists public.vendite_shop (
  id uuid primary key default gen_random_uuid(),
  woo_order_id integer not null unique,
  numero_ordine text,
  data_ordine timestamptz,
  stato text,
  cliente_nome text,
  cliente_email text,
  totale numeric,
  totale_imponibile numeric,
  totale_iva numeric,
  prodotti jsonb not null default '[]',
  payload_raw jsonb,
  ts_ricevuto timestamptz not null default now()
);
alter table public.vendite_shop enable row level security;
drop policy if exists "accesso interno vendite_shop" on public.vendite_shop;
create policy "accesso interno vendite_shop" on public.vendite_shop for all to anon using (true) with check (true);

create index if not exists vendite_shop_data_ordine_idx on public.vendite_shop (data_ordine desc);
create index if not exists vendite_shop_stato_idx on public.vendite_shop (stato);

-- ---------------------------------------------------------
-- 29) Magazzino prodotti WooCommerce: categorie_prodotti (gerarchia),
-- prodotti_shop (costo_acquisto/scorta_minima gestiti solo dall'app),
-- prodotti_categorie. Popolate da Edge Function woo-sync-catalogo
-- (lettura) e aggiornate in scrittura da woo-aggiorna-scorte.
-- ---------------------------------------------------------
-- categorie prodotto, con gerarchia (una categoria può avere sotto-categorie)
create table if not exists public.categorie_prodotti (
  id uuid primary key default gen_random_uuid(),
  woo_category_id integer not null unique,
  nome text not null,
  categoria_padre_id uuid references public.categorie_prodotti(id) on delete set null,
  ts_sync timestamptz not null default now()
);
alter table public.categorie_prodotti enable row level security;
drop policy if exists "accesso interno categorie_prodotti" on public.categorie_prodotti;
create policy "accesso interno categorie_prodotti" on public.categorie_prodotti for all to anon using (true) with check (true);

-- prodotti dello shop. costo_acquisto e scorta_minima sono dati propri
-- dell'app (mai scritti da WooCommerce): la Edge Function di sync non
-- li tocca mai in aggiornamento
create table if not exists public.prodotti_shop (
  id uuid primary key default gen_random_uuid(),
  woo_product_id integer not null unique,
  nome text not null,
  sku text,
  prezzo_vendita numeric,
  giacenza integer,
  scorta_minima integer,
  costo_acquisto numeric,
  attivo boolean not null default true,
  ts_sync timestamptz not null default now()
);
alter table public.prodotti_shop enable row level security;
drop policy if exists "accesso interno prodotti_shop" on public.prodotti_shop;
create policy "accesso interno prodotti_shop" on public.prodotti_shop for all to anon using (true) with check (true);

-- un prodotto può appartenere a più categorie (come su WooCommerce)
create table if not exists public.prodotti_categorie (
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  categoria_id uuid not null references public.categorie_prodotti(id) on delete cascade,
  primary key (prodotto_id, categoria_id)
);
alter table public.prodotti_categorie enable row level security;
drop policy if exists "accesso interno prodotti_categorie" on public.prodotti_categorie;
create policy "accesso interno prodotti_categorie" on public.prodotti_categorie for all to anon using (true) with check (true);

create index if not exists prodotti_shop_attivo_idx on public.prodotti_shop (attivo);
create index if not exists prodotti_categorie_categoria_idx on public.prodotti_categorie (categoria_id);

-- ---------------------------------------------------------
-- 30) Gestione Shop: descrizione/immagine/ordine di categorie e
-- prodotti, galleria immagini prodotto (prodotti_immagini). Scritte
-- dalle Edge Function woo-gestisci-categoria/woo-gestisci-prodotto e
-- tenute aggiornate anche da woo-sync-catalogo.
-- ---------------------------------------------------------
alter table public.categorie_prodotti add column if not exists descrizione text;
alter table public.categorie_prodotti add column if not exists immagine_url text;
alter table public.categorie_prodotti add column if not exists ordine integer not null default 0;

alter table public.prodotti_shop add column if not exists descrizione text;
alter table public.prodotti_shop add column if not exists descrizione_breve text;
alter table public.prodotti_shop add column if not exists stato text not null default 'publish';

create table if not exists public.prodotti_immagini (
  id uuid primary key default gen_random_uuid(),
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  woo_image_id integer,
  url text not null,
  ordine integer not null default 0,
  ts_sync timestamptz not null default now()
);
alter table public.prodotti_immagini enable row level security;
drop policy if exists "accesso interno prodotti_immagini" on public.prodotti_immagini;
create policy "accesso interno prodotti_immagini" on public.prodotti_immagini for all to anon using (true) with check (true);

create index if not exists prodotti_immagini_prodotto_ordine_idx on public.prodotti_immagini (prodotto_id, ordine);

-- storage per le immagini caricate da "Gestione Shop" (poi passate a
-- WooCommerce come URL: WooCommerce le scarica nella sua media library)
insert into storage.buckets (id, name, public) values ('shop-immagini', 'shop-immagini', true) on conflict (id) do nothing;
drop policy if exists "accesso interno shop-immagini" on storage.objects;
create policy "accesso interno shop-immagini" on storage.objects for all to anon
  using (bucket_id = 'shop-immagini') with check (bucket_id = 'shop-immagini');

-- ---------------------------------------------------------
-- 31) Gestione modelle per giorno: corsi_giorni (template dei giorni di
-- un corso-tipo: quali richiedono la Modella del Master e/o modelle
-- Allievi, con quale trattamento), corsi_date.modelle_master (dati reali
-- della Modella del Master per una specifica edizione).
-- ---------------------------------------------------------
create table if not exists public.corsi_giorni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi(id) on delete cascade,
  numero_giorno integer not null,
  richiede_modella_master boolean not null default false,
  mattina_master boolean not null default false,
  pomeriggio_master boolean not null default false,
  richiede_modelle_allievi boolean not null default false,
  tipo_modella text,
  unique (corso_id, numero_giorno)
);
alter table public.corsi_giorni enable row level security;
drop policy if exists "accesso interno corsi_giorni" on public.corsi_giorni;
create policy "accesso interno corsi_giorni" on public.corsi_giorni for all to anon using (true) with check (true);

alter table public.corsi_date add column if not exists modelle_master jsonb not null default '[]';

-- ---------------------------------------------------------
-- 32) "Categoria" sui corsi-tipo: etichetta libera (PMU, Microblading,
-- Extension...) mostrata sulla card del corso in "Definisci corsi".
-- ---------------------------------------------------------
alter table public.corsi add column if not exists categoria text;

-- ---------------------------------------------------------
-- 33) Tipi di modella: catalogo generale (gestito da "Definisci tipi di
-- modelle") + quali sono selezionabili per ciascun corso-tipo. Nessuna
-- riga in corsi_tipi_modella per un corso = nessuna restrizione, tutti
-- i tipi restano selezionabili per quel corso.
-- ---------------------------------------------------------
create table if not exists public.tipi_modella (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ts timestamptz not null default now()
);
alter table public.tipi_modella enable row level security;
drop policy if exists "accesso interno tipi_modella" on public.tipi_modella;
create policy "accesso interno tipi_modella" on public.tipi_modella for all to anon using (true) with check (true);

insert into public.tipi_modella (nome) values
  ('MICROBLADING'), ('SOPRACCIGLIA OMBRETTO'), ('LABBRA'), ('EYELINER'),
  ('PELO CON DERMOGRAFO'), ('TRICO'), ('AREOLA'), ('LAMINAZIONE'), ('EXTENSION'), ('NEEDLING')
on conflict (nome) do nothing;

create table if not exists public.corsi_tipi_modella (
  corso_id uuid not null references public.corsi(id) on delete cascade,
  tipo_modella_id uuid not null references public.tipi_modella(id) on delete cascade,
  primary key (corso_id, tipo_modella_id)
);
alter table public.corsi_tipi_modella enable row level security;
drop policy if exists "accesso interno corsi_tipi_modella" on public.corsi_tipi_modella;
create policy "accesso interno corsi_tipi_modella" on public.corsi_tipi_modella for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 34) Separa turno/trattamento di Modella del Master e Modella Allievi
-- in corsi_giorni: "tipo_modella" (condiviso) diventa tipo_modella_master
-- + nuovo tipo_modella_allievi indipendente, con turno proprio.
-- ---------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'corsi_giorni' and column_name = 'tipo_modella'
  ) then
    alter table public.corsi_giorni rename column tipo_modella to tipo_modella_master;
  end if;
end $$;

alter table public.corsi_giorni add column if not exists tipo_modella_master text;
alter table public.corsi_giorni add column if not exists mattina_allievi boolean not null default false;
alter table public.corsi_giorni add column if not exists pomeriggio_allievi boolean not null default false;
alter table public.corsi_giorni add column if not exists tipo_modella_allievi text;

-- ---------------------------------------------------------
-- 35) Pagamenti extra (pulsante "+") e semaforo pagato/da pagare per
-- Quota acconto e Quota pre corso.
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists acconto_pagato boolean not null default false;
alter table public.iscritti add column if not exists precorso_pagato boolean not null default false;
alter table public.iscritti add column if not exists acconto_extra jsonb not null default '[]';
alter table public.iscritti add column if not exists precorso_extra jsonb not null default '[]';

-- ---------------------------------------------------------
-- 36) Venditori (tutor): elenco gestibile da "Definisci venditori"
-- (Impostazioni > Team), selezionabile in fase di iscrizione.
-- ---------------------------------------------------------
create table if not exists public.venditori (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.venditori enable row level security;
drop policy if exists "accesso interno venditori" on public.venditori;
create policy "accesso interno venditori" on public.venditori for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 37) Password venditori (per un futuro login): mai in chiaro, solo
-- hash+salt scritti dalla Edge Function "venditori-imposta-password".
-- L'app non seleziona mai queste colonne nel caricamento dati generale.
-- ---------------------------------------------------------
alter table public.venditori add column if not exists password_hash text;
alter table public.venditori add column if not exists password_salt text;

-- ---------------------------------------------------------
-- 38) Password per voce di menù (rotellina in home): una riga per ogni
-- voce protetta (gestionedate, erp, generazioneloghi, gestionemodelle,
-- statistiche, impostazioni). Password in chiaro, stesso livello di
-- sicurezza già in uso per ADMIN_CODE; se vuota resta valido il codice
-- amministratore generale.
-- ---------------------------------------------------------
create table if not exists public.password_menu (
  vista text primary key,
  password text not null default ''
);
alter table public.password_menu enable row level security;
drop policy if exists "password_menu_all" on public.password_menu;
create policy "password_menu_all" on public.password_menu for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 39) Cellulare venditori, per la futura integrazione messaggi WhatsApp.
-- ---------------------------------------------------------
alter table public.venditori add column if not exists telefono text;

-- ---------------------------------------------------------
-- 40) Utenti nominali dell'app (rotellina > Gestione utenti): ogni
-- utente ha la propria password e un elenco di "permessi" (le chiavi dei
-- tasti della home che può usare, vedi TASTI_HOME in App.jsx). In home,
-- i tasti non presenti in "permessi" restano disattivati e non
-- cliccabili — niente più richiesta di password al click per loro.
-- "chiave_sistema" identifica le 3 righe di sistema (Utente generico/
-- Amministratore/Programmatore), sempre presenti e non eliminabili.
-- ---------------------------------------------------------
create table if not exists public.utenti_app (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  password text not null,
  permessi jsonb not null default '[]',
  chiave_sistema text unique,
  ts timestamptz not null default now()
);
alter table public.utenti_app add column if not exists chiave_sistema text unique;
alter table public.utenti_app enable row level security;
drop policy if exists "utenti_app_all" on public.utenti_app;
create policy "utenti_app_all" on public.utenti_app for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 41) Logistica prodotti (kit corsi): catalogo kit (kit_definizioni,
-- ciascuno con un corso di default facoltativo), contenuto di ciascun
-- kit (corsi_kit_prodotti, ora agganciato a kit_id) e stato operativo
-- per singola edizione (logistica_kit_edizioni: fase di spedizione, due
-- selezioni di kit indipendenti — principale e speciale — ciascuna con
-- kit per iscritti/riserva e scarico magazzino reattivo, checklist,
-- quantità accessori inviati).
-- ---------------------------------------------------------
create table if not exists public.kit_definizioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  corso_id uuid references public.corsi(id) on delete set null,
  ordine integer not null default 0,
  ts timestamptz not null default now()
);
alter table public.kit_definizioni add column if not exists ordine integer not null default 0;
alter table public.kit_definizioni enable row level security;
drop policy if exists "kit_definizioni_all" on public.kit_definizioni;
create policy "kit_definizioni_all" on public.kit_definizioni for all to anon using (true) with check (true);

create table if not exists public.corsi_kit_prodotti (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid references public.corsi(id) on delete cascade,
  kit_id uuid references public.kit_definizioni(id) on delete cascade,
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  tipo text not null default 'kit',
  quantita integer not null default 1,
  ts timestamptz not null default now()
);
alter table public.corsi_kit_prodotti add column if not exists kit_id uuid references public.kit_definizioni(id) on delete cascade;
alter table public.corsi_kit_prodotti alter column corso_id drop not null;
do $$
declare
  r record;
  nuovo_kit_id uuid;
begin
  for r in select distinct corso_id from public.corsi_kit_prodotti where kit_id is null and corso_id is not null loop
    select id into nuovo_kit_id from public.kit_definizioni where corso_id = r.corso_id limit 1;
    if nuovo_kit_id is null then
      insert into public.kit_definizioni (nome, corso_id)
      select nome, id from public.corsi where id = r.corso_id
      returning id into nuovo_kit_id;
    end if;
    update public.corsi_kit_prodotti set kit_id = nuovo_kit_id where corso_id = r.corso_id and kit_id is null;
  end loop;
end $$;
alter table public.corsi_kit_prodotti drop constraint if exists corsi_kit_prodotti_corso_id_prodotto_id_tipo_key;
drop index if exists corsi_kit_prodotti_corso_id_prodotto_id_tipo_key;
alter table public.corsi_kit_prodotti drop constraint if exists corsi_kit_prodotti_kit_id_prodotto_id_tipo_key;
alter table public.corsi_kit_prodotti add constraint corsi_kit_prodotti_kit_id_prodotto_id_tipo_key unique (kit_id, prodotto_id, tipo);
alter table public.corsi_kit_prodotti enable row level security;
drop policy if exists "corsi_kit_prodotti_all" on public.corsi_kit_prodotti;
create policy "corsi_kit_prodotti_all" on public.corsi_kit_prodotti for all to anon using (true) with check (true);

create table if not exists public.logistica_kit_edizioni (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade unique,
  fase text not null default 'da_preparare',
  kit_id uuid references public.kit_definizioni(id) on delete set null,
  kit_per_iscritti integer,
  kit_di_riserva integer,
  quantita_scaricata_magazzino integer not null default 0,
  kit_speciale_id uuid references public.kit_definizioni(id) on delete set null,
  kit_speciale_per_iscritti integer,
  kit_speciale_di_riserva integer,
  kit_speciale_scaricato integer not null default 0,
  checklist jsonb not null default '{}',
  accessori_quantita jsonb not null default '{}',
  accessori_scaricati jsonb not null default '{}',
  ts timestamptz not null default now()
);
alter table public.logistica_kit_edizioni add column if not exists kit_id uuid references public.kit_definizioni(id) on delete set null;
alter table public.logistica_kit_edizioni add column if not exists kit_speciale_id uuid references public.kit_definizioni(id) on delete set null;
alter table public.logistica_kit_edizioni add column if not exists kit_speciale_per_iscritti integer;
alter table public.logistica_kit_edizioni add column if not exists kit_speciale_di_riserva integer;
alter table public.logistica_kit_edizioni add column if not exists kit_speciale_scaricato integer not null default 0;
alter table public.logistica_kit_edizioni add column if not exists quantita_scaricata_magazzino integer not null default 0;
alter table public.logistica_kit_edizioni add column if not exists accessori_scaricati jsonb not null default '{}';
alter table public.logistica_kit_edizioni enable row level security;
drop policy if exists "logistica_kit_edizioni_all" on public.logistica_kit_edizioni;
create policy "logistica_kit_edizioni_all" on public.logistica_kit_edizioni for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 42) Dashboard master (Password menù > Password Master): la password di
-- ciascuna master vive direttamente sulla riga "master" già esistente,
-- si aggiorna da sola con Setting > Definisci Master.
-- ---------------------------------------------------------
alter table public.master add column if not exists password text;

-- ---------------------------------------------------------
-- 43) Agenda (tasto home "Agenda"): agende create dal Programmatore,
-- assegnabili sia agli utenti nominali sia alle master (permesso
-- "agenda_<id>"). Chi ne ha una sola tra i permessi la trova già aperta,
-- senza scegliere nulla; chi ne ha più di una sceglie tra le proprie.
-- ---------------------------------------------------------
create table if not exists public.agende (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.agende enable row level security;
drop policy if exists "agende_all" on public.agende;
create policy "agende_all" on public.agende for all to anon using (true) with check (true);

create table if not exists public.agenda_voci (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agende(id) on delete cascade,
  data date,
  titolo text not null,
  nota text,
  ts timestamptz not null default now()
);
alter table public.agenda_voci enable row level security;
drop policy if exists "agenda_voci_all" on public.agenda_voci;
create policy "agenda_voci_all" on public.agenda_voci for all to anon using (true) with check (true);

alter table public.master add column if not exists permessi jsonb not null default '[]';

-- ---------------------------------------------------------
-- 44) Inventario di sede: cosa è già presente in una location (prodotti
-- da magazzino o attrezzature), dichiarato dalla master dalla sua
-- Dashboard ("Inventario corso corrente"), visibile in Logistica
-- prodotti quando si prepara il contenuto dei kit per quella sede.
-- ---------------------------------------------------------
create table if not exists public.inventario_sede (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location(id) on delete cascade,
  tipo text not null,
  riferimento text not null,
  quantita integer not null default 0,
  corso_data_id uuid references public.corsi_date(id) on delete set null,
  master_id uuid references public.master(id) on delete set null,
  ts timestamptz not null default now()
);
alter table public.inventario_sede drop constraint if exists inventario_sede_location_id_tipo_riferimento_key;
alter table public.inventario_sede add constraint inventario_sede_location_id_tipo_riferimento_key unique (location_id, tipo, riferimento);
alter table public.inventario_sede enable row level security;
drop policy if exists "inventario_sede_all" on public.inventario_sede;
create policy "inventario_sede_all" on public.inventario_sede for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 45) "Tipo di offerta": campo libero accanto a "Pacchetto/Kit" nella
-- scheda di iscrizione.
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists tipo_offerta text;

-- ---------------------------------------------------------
-- 46) Materiali rispediti dal corso: prodotti "interi" (ripristinabili
-- in magazzino) e "aperti" (mucchio non ripristinabile), dichiarati
-- dalla master su Inventario di sede e processati in Logistica prodotti.
-- ---------------------------------------------------------
alter table public.logistica_kit_edizioni add column if not exists rientro_prodotti_interi jsonb not null default '{}';
alter table public.logistica_kit_edizioni add column if not exists rientro_prodotti_aperti jsonb not null default '{}';
alter table public.logistica_kit_edizioni add column if not exists rientro_interi_processato jsonb not null default '{}';

create table if not exists public.prodotti_aperti_magazzino (
  id uuid primary key default gen_random_uuid(),
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  quantita integer not null default 0,
  ts timestamptz not null default now()
);
alter table public.prodotti_aperti_magazzino drop constraint if exists prodotti_aperti_magazzino_prodotto_id_corso_data_id_key;
alter table public.prodotti_aperti_magazzino add constraint prodotti_aperti_magazzino_prodotto_id_corso_data_id_key unique (prodotto_id, corso_data_id);
alter table public.prodotti_aperti_magazzino enable row level security;
drop policy if exists "prodotti_aperti_magazzino_all" on public.prodotti_aperti_magazzino;
create policy "prodotti_aperti_magazzino_all" on public.prodotti_aperti_magazzino for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 47) "Altri incassi al corso" nel Riepilogo amministrativo: prodotti
-- venduti in più durante il corso, scelti dal magazzino.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists incassi_extra jsonb not null default '[]';

-- ---------------------------------------------------------
-- 48) Agenda: ottava carta di ogni settimana (appunti liberi, non legati
-- a un giorno preciso). Una riga per settimana per agenda.
-- ---------------------------------------------------------
create table if not exists public.agenda_note_settimanali (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agende(id) on delete cascade,
  settimana_inizio date not null,
  testo text,
  ts timestamptz not null default now(),
  unique (agenda_id, settimana_inizio)
);
alter table public.agenda_note_settimanali enable row level security;
drop policy if exists "agenda_note_settimanali_all" on public.agenda_note_settimanali;
create policy "agenda_note_settimanali_all" on public.agenda_note_settimanali for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 49) Agenda: orario dell'evento (facoltativo), per ordinare gli eventi
-- nelle carte e mostrarli nella vista giorno espansa.
-- ---------------------------------------------------------
alter table public.agenda_voci add column if not exists orario time;

-- ---------------------------------------------------------
-- 50) Coda di verifica per i pagamenti (acconti/quote pre corso)
-- segnalati dai venditori: il venditore inserisce, lo staff verifica e
-- approva prima che diventi definitivo sulla scheda dell'iscritto.
-- ---------------------------------------------------------
create table if not exists public.acconti_da_verificare (
  id uuid primary key default gen_random_uuid(),
  iscritto_id uuid not null references public.iscritti(id) on delete cascade,
  tipo text not null check (tipo in ('acconto','precorso')),
  importo numeric not null,
  metodo text not null,
  venditore_nome text,
  stato text not null default 'in_attesa' check (stato in ('in_attesa','approvato')),
  ts timestamptz not null default now(),
  approvato_il timestamptz
);
alter table public.acconti_da_verificare enable row level security;
drop policy if exists "acconti_da_verificare_all" on public.acconti_da_verificare;
create policy "acconti_da_verificare_all" on public.acconti_da_verificare for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 51) Verifica acconti: ricevuta del bonifico allegabile dal venditore.
-- ---------------------------------------------------------
alter table public.acconti_da_verificare add column if not exists file_path text;

-- ---------------------------------------------------------
-- 52) Verifica pagamenti: nota a mano invece di importo/metodo
-- strutturati (il venditore ora segnala solo file + nota). "origine"
-- distingue le due sorgenti che finiscono in Verifica Pagamenti:
-- segnalazione manuale del venditore ("manuale", mostrata come "Verifica
-- acconto/saldo") oppure creata in automatico quando nel modulo di
-- iscrizione si sceglie Bonifico come metodo di pagamento
-- ("bonifico_modulo", mostrata come "Verifica bonifico").
-- ---------------------------------------------------------
alter table public.acconti_da_verificare add column if not exists nota text;
alter table public.acconti_da_verificare alter column tipo drop not null;
alter table public.acconti_da_verificare alter column importo drop not null;
alter table public.acconti_da_verificare alter column metodo drop not null;
alter table public.acconti_da_verificare add column if not exists origine text not null default 'manuale' check (origine in ('manuale','bonifico_modulo'));

-- ---------------------------------------------------------
-- 53) Verifica pagamenti: quando nel modulo di iscrizione si sceglie
-- Bonifico come metodo di una quota, il file è obbligatorio e resta
-- anche sull'iscritto stesso oltre che in Verifica Pagamenti. Gli
-- acconti/pre corso aggiuntivi usano una chiave "bonifico_file" dentro
-- ogni riga jsonb, senza bisogno di colonne aggiuntive.
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists acconto_bonifico_file text;
alter table public.iscritti add column if not exists precorso_bonifico_file text;
alter table public.iscritti add column if not exists saldo_bonifico_file text;

-- ---------------------------------------------------------
-- 54) Modalità "Stile": tavolozza dei colori condivisi dell'app,
-- modificabile con la ruota cromatica dalla barra in alto. Tabella
-- "append-only": ogni pubblicazione inserisce una nuova riga invece di
-- sovrascrivere quella corrente, così restano visibili anche le versioni
-- passate (per poterle ripristinare). Il tema attivo è sempre la riga
-- più recente per pubblicato_il.
-- ---------------------------------------------------------
create table if not exists public.tema_colori_versioni (
  id uuid primary key default gen_random_uuid(),
  colori jsonb not null,
  etichetta text,
  pubblicato_il timestamptz not null default now()
);
alter table public.tema_colori_versioni enable row level security;
drop policy if exists "tema_colori_versioni_all" on public.tema_colori_versioni;
create policy "tema_colori_versioni_all" on public.tema_colori_versioni for all to anon using (true) with check (true);

-- ---------------------------------------------------------
-- 55) Verifica pagamenti: il file del bonifico nel modulo di iscrizione ora
-- si può caricare anche mentre la quota è ancora "Da pagare" (facoltativo).
-- La segnalazione a Elena scatta solo quando la quota diventa "Pagato" e ha
-- già un file allegato, non nel momento in cui si carica il file.
-- "bonifico_segnalato" ricorda se è già scattata, per non segnalarla due
-- volte. Gli acconti/pre corso aggiuntivi usano una chiave
-- "bonifico_segnalato" dentro ogni riga jsonb.
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists acconto_bonifico_segnalato boolean not null default false;
alter table public.iscritti add column if not exists precorso_bonifico_segnalato boolean not null default false;

-- ---------------------------------------------------------
-- 56) "Aggiungi Pagamento" (Le tue iscrizioni) chiede anche data pagamento
-- e un importo strutturato (imponibile/IVA/totale + metodo), oltre a nota
-- e file: "importo" e "metodo" riusano le colonne già esistenti,
-- "imponibile" e "data_pagamento" sono nuove.
-- ---------------------------------------------------------
alter table public.acconti_da_verificare add column if not exists imponibile numeric;
alter table public.acconti_da_verificare add column if not exists data_pagamento date;

-- ---------------------------------------------------------
-- 57) "Aggiungi Pagamento" ha anche le caselle di spunta "Acconto"/"Quota
-- pre corso"/"Saldo" (se ne può spuntare più di una) per indicare a cosa
-- si riferisce il pagamento segnalato.
-- ---------------------------------------------------------
alter table public.acconti_da_verificare add column if not exists voci_pagamento text[];

-- ---------------------------------------------------------
-- 58) "Aggiungi Pagamento": sotto la nota si possono associare al
-- pagamento anche altri corsi frequentati dallo stesso allievo, per i
-- pagamenti che coprono più corsi insieme.
-- ---------------------------------------------------------
alter table public.acconti_da_verificare add column if not exists corsi_extra_ids uuid[];

-- ---------------------------------------------------------
-- 59) Un pagamento "Integrazione" può essere contabilizzato in più volte
-- (una quota alla volta, anche da corsi diversi quando è associato a più
-- corsi): "importo_residuo" tiene il totale ancora da contabilizzare —
-- parte dall'importo segnalato e scende a ogni "Contabilizza" parziale; la
-- segnalazione diventa "approvato" solo quando arriva a zero.
-- ---------------------------------------------------------
alter table public.acconti_da_verificare add column if not exists importo_residuo numeric;

-- ---------------------------------------------------------
-- 60) Scheda allievo: scegliendo Bonifico come metodo di una quota già
-- segnata "Pagato" è richiesto il file del bonifico. Solo un
-- amministratore (Contabilità classe sbloccata) vede la casella "Ora non
-- ho il file" per saltare la richiesta e caricarlo più tardi — quota
-- acconto e quota pre corso; gli acconti/pre corso aggiuntivi usano una
-- chiave "bonifico_skip" dentro ogni riga jsonb.
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists acconto_bonifico_skip boolean not null default false;
alter table public.iscritti add column if not exists precorso_bonifico_skip boolean not null default false;

-- ---------------------------------------------------------
-- 61) Ogni venditore può avere accesso limitato alle 3 sezioni della
-- propria Dashboard venditori (Performance di vendita/Iscrivi Allievo/Le
-- tue iscrizioni), assegnato in "Password menù" come già succede per gli
-- utenti (TASTI_HOME) e le master.
-- ---------------------------------------------------------
alter table public.venditori add column if not exists permessi jsonb not null default '[]';

-- ---------------------------------------------------------
-- 62) Password venditori in chiaro, come per gli utenti e le master (non
-- più hash + salt via Edge Function): si scrive e si legge direttamente,
-- niente più funzioni server da pubblicare. Ogni venditore nuovo parte
-- da "0000".
-- ---------------------------------------------------------
alter table public.venditori add column if not exists password text not null default '0000';

-- ---------------------------------------------------------
-- 63) Una master può essere anche un venditore (stessa persona, due
-- profili): il collegamento va scelto esplicitamente da Password menù >
-- Password Master > "Venditore collegato", non dedotto dal caso che le
-- due password coincidano. Entrando con la password della master o con
-- quella del venditore, l'app riconosce entrambi i ruoli e sblocca sia
-- "Dashboard master" sia "Dashboard venditori", ciascuna bloccata sui
-- propri dati.
-- ---------------------------------------------------------
alter table public.master add column if not exists venditore_id uuid references public.venditori(id) on delete set null;

-- ---------------------------------------------------------
-- 64) "Gestione magazzino" diventa gestione TOTALE del magazzino fisico,
-- non più solo dello shop online: ogni prodotto ha ora due giacenze
-- separate, "in magazzino" (fisica, in sede, mai toccata da WooCommerce)
-- e "shop online" (giacenza esistente, resta sincronizzata su
-- WooCommerce come prima). Lo stock totale è la somma delle due.
-- woo_product_id diventa nullable: un prodotto può esistere SOLO
-- localmente (materiali di consumo, arredi, altro non in vendita
-- online, magari senza prezzo) — woo-sync-catalogo non lo tocca mai.
-- ---------------------------------------------------------
alter table public.prodotti_shop alter column woo_product_id drop not null;
alter table public.prodotti_shop add column if not exists giacenza_magazzino integer not null default 0;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 65) POS Vendita diretta: le vendite al banco finiscono nella stessa
-- tabella "vendite_shop" già usata dagli ordini WooCommerce, così
-- compaiono automaticamente nei totali di "Vendite shop" e "Analisi
-- Magazzino" insieme alle vendite online. woo_order_id diventa
-- nullable (una vendita POS non ha un ordine WooCommerce); "origine"
-- distingue le due provenienze; metodo_pagamento e note sono propri
-- della vendita al banco.
-- ---------------------------------------------------------
alter table public.vendite_shop alter column woo_order_id drop not null;
alter table public.vendite_shop add column if not exists origine text not null default 'woocommerce';
alter table public.vendite_shop add column if not exists metodo_pagamento text;
alter table public.vendite_shop add column if not exists note text;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 66) POS Vendite Prodotti — fase 1: attribuzione della vendita a chi è
-- loggato (master/venditore/utente operativo) e predisposizione per i
-- movimenti di Reso/Annullamento/Cambio (fase successiva). Target
-- Master/Venditori: obiettivi individuali (incasso/prodotto/combinato)
-- su un periodo, assegnati solo dall'admin — solo segnalazione, nessun
-- calcolo/erogazione del premio a sistema.
-- ---------------------------------------------------------
alter table public.vendite_shop add column if not exists operatore_tipo text;
alter table public.vendite_shop add column if not exists operatore_id uuid;
alter table public.vendite_shop add column if not exists operatore_nome text;
alter table public.vendite_shop add column if not exists tipo_movimento text not null default 'vendita';
alter table public.vendite_shop add column if not exists vendita_collegata_id uuid references public.vendite_shop(id) on delete set null;

create index if not exists vendite_shop_operatore_idx on public.vendite_shop (operatore_tipo, operatore_id);

create table if not exists public.target_vendite_prodotti (
  id uuid primary key default gen_random_uuid(),
  soggetto_tipo text not null check (soggetto_tipo in ('master','venditore')),
  soggetto_id uuid not null,
  tipo_target text not null check (tipo_target in ('incasso','prodotto','combinato')),
  soglia_incasso numeric,
  prodotti_obiettivo jsonb not null default '[]',
  data_inizio date not null,
  data_fine date not null,
  ts timestamptz not null default now()
);
alter table public.target_vendite_prodotti enable row level security;
drop policy if exists "accesso interno target_vendite_prodotti" on public.target_vendite_prodotti;
create policy "accesso interno target_vendite_prodotti" on public.target_vendite_prodotti for all to anon using (true) with check (true);

create index if not exists target_vendite_prodotti_soggetto_idx on public.target_vendite_prodotti (soggetto_tipo, soggetto_id);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 67) Inventario Post Corso — fase 1: fondamenta. Vedi
-- supabase-inventario-post-corso-setup.sql per i commenti completi.
-- ---------------------------------------------------------
alter table public.prodotti_shop add column if not exists rientro_obbligatorio_se_aperto boolean not null default false;
alter table public.vendite_shop add column if not exists corso_data_id uuid references public.corsi_date(id) on delete set null;

alter table public.prodotti_aperti_magazzino add column if not exists nota text;
alter table public.prodotti_aperti_magazzino add column if not exists master_id uuid references public.master(id) on delete set null;
alter table public.prodotti_aperti_magazzino add column if not exists stato text not null default 'da_valutare';

create table if not exists public.magazzino_locale_consumabili (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location(id) on delete cascade,
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  quantita integer not null default 1,
  livello integer not null default 5 check (livello between 1 and 5),
  corso_data_id uuid references public.corsi_date(id) on delete set null,
  master_id uuid references public.master(id) on delete set null,
  ts timestamptz not null default now()
);
alter table public.magazzino_locale_consumabili enable row level security;
drop policy if exists "accesso interno magazzino_locale_consumabili" on public.magazzino_locale_consumabili;
create policy "accesso interno magazzino_locale_consumabili" on public.magazzino_locale_consumabili for all to anon using (true) with check (true);
create index if not exists magazzino_locale_consumabili_location_idx on public.magazzino_locale_consumabili (location_id);

create table if not exists public.inventario_ammanchi (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  master_id uuid references public.master(id) on delete set null,
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  quantita integer not null default 1,
  causale text not null,
  nota text,
  foto_path text,
  ts timestamptz not null default now()
);
alter table public.inventario_ammanchi enable row level security;
drop policy if exists "accesso interno inventario_ammanchi" on public.inventario_ammanchi;
create policy "accesso interno inventario_ammanchi" on public.inventario_ammanchi for all to anon using (true) with check (true);
create index if not exists inventario_ammanchi_corso_idx on public.inventario_ammanchi (corso_data_id);

insert into storage.buckets (id, name, public) values ('inventario-foto', 'inventario-foto', true) on conflict (id) do nothing;
drop policy if exists "accesso interno inventario-foto" on storage.objects;
create policy "accesso interno inventario-foto" on storage.objects for all to anon
  using (bucket_id = 'inventario-foto') with check (bucket_id = 'inventario-foto');

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 68) Inventario Post Corso — fase 4: spedizioni a domicilio dal POS.
-- Vedi supabase-magazzini-spedizioni-setup.sql per i commenti completi.
-- ---------------------------------------------------------
create table if not exists public.spedizioni_pos (
  id uuid primary key default gen_random_uuid(),
  vendita_id uuid references public.vendite_shop(id) on delete set null,
  corso_data_id uuid references public.corsi_date(id) on delete set null,
  iscritto_id uuid references public.iscritti(id) on delete set null,
  destinatario_nome text not null,
  indirizzo text,
  cap text,
  citta text,
  prodotti jsonb not null default '[]',
  stato text not null default 'da_spedire' check (stato in ('da_spedire', 'spedito')),
  ts timestamptz not null default now(),
  spedito_il timestamptz
);
alter table public.spedizioni_pos enable row level security;
drop policy if exists "accesso interno spedizioni_pos" on public.spedizioni_pos;
create policy "accesso interno spedizioni_pos" on public.spedizioni_pos for all to anon using (true) with check (true);
create index if not exists spedizioni_pos_stato_idx on public.spedizioni_pos (stato);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 69) Categorie prodotto locali (non solo da WooCommerce) e magazzini
-- distaccati. Vedi supabase-categorie-magazzini-locali-setup.sql per i
-- commenti completi.
-- ---------------------------------------------------------
alter table public.categorie_prodotti alter column woo_category_id drop not null;
alter table public.location add column if not exists magazzino_locale boolean not null default false;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 70) Scheda Master: foto/note/contratto, corsi associati con fasce di
-- compenso per numero di allievi. Vedi supabase-scheda-master-setup.sql
-- per i commenti completi.
-- ---------------------------------------------------------
alter table public.master add column if not exists foto_url text;
alter table public.master add column if not exists note text;
alter table public.master add column if not exists contratto_file_path text;
alter table public.master add column if not exists email text;
alter table public.master add column if not exists telefono text;

create table if not exists public.master_corsi (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.master(id) on delete cascade,
  corso_id uuid not null references public.corsi(id) on delete cascade,
  fasce_compenso jsonb not null default '[]',
  ts timestamptz not null default now(),
  unique (master_id, corso_id)
);
alter table public.master_corsi enable row level security;
drop policy if exists "accesso interno master_corsi" on public.master_corsi;
create policy "accesso interno master_corsi" on public.master_corsi for all to anon using (true) with check (true);
create index if not exists master_corsi_master_idx on public.master_corsi (master_id);

insert into storage.buckets (id, name, public) values ('master-documenti', 'master-documenti', true) on conflict (id) do nothing;
drop policy if exists "accesso interno master-documenti" on storage.objects;
create policy "accesso interno master-documenti" on storage.objects for all to anon
  using (bucket_id = 'master-documenti') with check (bucket_id = 'master-documenti');

insert into storage.buckets (id, name, public) values ('master-foto', 'master-foto', true) on conflict (id) do nothing;
drop policy if exists "accesso interno master-foto" on storage.objects;
create policy "accesso interno master-foto" on storage.objects for all to anon
  using (bucket_id = 'master-foto') with check (bucket_id = 'master-foto');

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 71) Target Venditori: oltre a incasso/prodotto/combinato (vendita
-- prodotti, silo separato), ora un target può anche riguardare i corsi
-- venduti (iscrizioni chiuse dal venditore, per valore di
-- "totale_pattuito" nel periodo del target):
--   'corsi_denaro' — soglia_incasso è un importo in euro
--   'corsi_punti'  — soglia_incasso è un numero di punti, dove
--                    1 punto = 100€ di valore di corso venduto
--                    (es. un corso da 590€ vale 5,9 punti)
-- Questi due tipi si possono assegnare solo ai venditori (i master non
-- vendono corsi), quindi non serve nessuna nuova colonna: bastano i due
-- nuovi valori ammessi in tipo_target — la colonna soglia_incasso resta
-- l'unica soglia numerica, letta in euro o in punti secondo il tipo.
-- ---------------------------------------------------------
alter table public.target_vendite_prodotti drop constraint if exists target_vendite_prodotti_tipo_target_check;
alter table public.target_vendite_prodotti add constraint target_vendite_prodotti_tipo_target_check
  check (tipo_target in ('incasso','prodotto','combinato','corsi_denaro','corsi_punti'));

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 72) CRM / Allievi: iscritti resta invariata (non è un'anagrafica
-- persona, è "una riga per ogni corso comprato", niente email né
-- città/regione di provenienza, e il modulo di iscrizione SchedaData
-- non va toccato). Questa tabella è solo l'ARRICCHIMENTO separato —
-- email, città/regione di provenienza, note — abbinato agli iscritti
-- via una chiave calcolata (non un id: iscritti non ha un id persona
-- stabile), la stessa sia per raggruppare sia per l'upsert quando si
-- compilano questi campi dalla scheda CRM:
--   chiaveAllievo(nome, cognome, telefono) =
--     `${NOME.trim().toUpperCase()}|${COGNOME.trim().toUpperCase()}|${telefono senza spazi/simboli}`
-- ---------------------------------------------------------
create table if not exists public.allievi_crm (
  id uuid primary key default gen_random_uuid(),
  chiave text not null unique,
  email text,
  citta_provenienza text,
  regione_provenienza text,
  note text,
  ts timestamptz not null default now()
);
alter table public.allievi_crm enable row level security;
drop policy if exists "accesso interno allievi_crm" on public.allievi_crm;
create policy "accesso interno allievi_crm" on public.allievi_crm for all to anon using (true) with check (true);

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 73) Residenza allievo (dal modulo di iscrizione): città, indirizzo e
-- CAP di residenza letti dalla pagina 6 del modulo (PDF), più l'email.
-- Usati dal CRM/Allievi per mostrare "Città di res." e calcolare la
-- "Regione di res." dalla città. Il modulo può non contenerli (allievi
-- vecchi): restano NULL finché non si rilegge il PDF (vedi "Recupera
-- residenze dai moduli" in CRM Allievi > Altre azioni).
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists citta_residenza text;
alter table public.iscritti add column if not exists indirizzo_residenza text;
alter table public.iscritti add column if not exists cap_residenza text;
alter table public.iscritti add column if not exists email text;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 74) Contatti per Leve, Assistenti e Venditori (Impostazioni >
-- Definisci Leve / Definisci Assistenti / Gestione venditori): telefono
-- ed email raccolti riga per riga, stesso principio già in uso per il
-- telefono dei venditori.
-- ---------------------------------------------------------
alter table public.leva add column if not exists telefono text;
alter table public.leva add column if not exists email text;
alter table public.assistente add column if not exists telefono text;
alter table public.assistente add column if not exists email text;
alter table public.venditori add column if not exists email text;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 75) Gestione Leve e Gestione Assistenti diventano pagine complete come
-- Gestione Master: foto, note, riepilogo calendario. Le assistenti in
-- più si associano ai corsi con un compenso giornaliero fisso (non a
-- fasce per numero di allievi come le master: qui l'importo non
-- dipende da quanti allievi ci sono al corso).
--
-- Le policy sono "to anon", come tutte le altre di questo file: la
-- migrazione RLS verso "authenticated" (supabase/migrations/) non è
-- ancora stata applicata in produzione, l'app oggi si autentica solo
-- con la chiave anon. "to authenticated" qui bloccherebbe l'app
-- (verificato: causa "row-level security policy" su ogni scrittura).
-- ---------------------------------------------------------
alter table public.leva add column if not exists foto_url text;
alter table public.leva add column if not exists note text;
alter table public.leva add column if not exists documento_file_path text;

alter table public.assistente add column if not exists foto_url text;
alter table public.assistente add column if not exists note text;
alter table public.assistente add column if not exists documento_file_path text;

create table if not exists public.assistente_corsi (
  id uuid primary key default gen_random_uuid(),
  assistente_id uuid not null references public.assistente(id) on delete cascade,
  corso_id uuid not null references public.corsi(id) on delete cascade,
  compenso_giornaliero numeric,
  ts timestamptz not null default now(),
  unique (assistente_id, corso_id)
);
alter table public.assistente_corsi enable row level security;
drop policy if exists "accesso interno assistente_corsi" on public.assistente_corsi;
create policy "accesso interno assistente_corsi" on public.assistente_corsi for all to anon using (true) with check (true);
create index if not exists assistente_corsi_assistente_idx on public.assistente_corsi (assistente_id);

insert into storage.buckets (id, name, public) values ('leve-assistenti-foto', 'leve-assistenti-foto', true) on conflict (id) do nothing;
drop policy if exists "accesso interno leve-assistenti-foto" on storage.objects;
create policy "accesso interno leve-assistenti-foto" on storage.objects for all to anon
  using (bucket_id = 'leve-assistenti-foto') with check (bucket_id = 'leve-assistenti-foto');

insert into storage.buckets (id, name, public) values ('leve-assistenti-documenti', 'leve-assistenti-documenti', true) on conflict (id) do nothing;
drop policy if exists "accesso interno leve-assistenti-documenti" on storage.objects;
create policy "accesso interno leve-assistenti-documenti" on storage.objects for all to anon
  using (bucket_id = 'leve-assistenti-documenti') with check (bucket_id = 'leve-assistenti-documenti');

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 76) "Assistenze" in Gestione Leve/Assistenti: il numero mostrato è
-- edizioni reali (da corsi_date leva_ids/assistente_ids, contate a
-- runtime) + questa correzione manuale, per le assistenze fatte prima
-- che il calendario attuale esistesse (nessuna data reale collegata).
-- I pulsanti +/- incrementano/decrementano questo numero di 1 alla
-- volta, mai sotto zero.
-- ---------------------------------------------------------
alter table public.leva add column if not exists assistenze_extra integer not null default 0;
alter table public.assistente add column if not exists assistenze_extra integer not null default 0;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 77) Assegnazione Master: da campi condivisi (un solo stato di viaggio
-- per il master, uno condiviso per tutti gli assistenti, un solo
-- alloggio per l'intera edizione) a una riga per persona — master,
-- assistente o leva — ciascuna con i propri biglietti di viaggio e il
-- proprio hotel.
--
-- La riga "principale" (la prima master) resta sui campi già esistenti
-- di corsi_date (master_id, note, viaggio_prenotato, viaggio_file,
-- alloggio_id, note_viaggio): nessuna migrazione necessaria lì, e la
-- Dashboard Master continua a leggerli senza modifiche. Questa tabella
-- copre solo le persone "extra": altre master, assistenti, leve.
-- ---------------------------------------------------------
create table if not exists public.corsi_date_docenti (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  tipo text not null check (tipo in ('master','assistente','leva')),
  persona_id uuid,
  viaggio_prenotato boolean not null default false,
  viaggio_file text[] not null default '{}',
  alloggio_id uuid references public.hotel(id) on delete set null,
  ordine integer not null default 0,
  ts timestamptz not null default now(),
  unique (corso_data_id, tipo, persona_id)
);
alter table public.corsi_date_docenti enable row level security;
drop policy if exists "accesso interno corsi_date_docenti" on public.corsi_date_docenti;
create policy "accesso interno corsi_date_docenti" on public.corsi_date_docenti for all to anon using (true) with check (true);
create index if not exists corsi_date_docenti_corso_data_idx on public.corsi_date_docenti (corso_data_id);

-- Migrazione dei dati esistenti: gli elenchi assistente_ids/leva_ids
-- diventano righe proprie. Lo stato di viaggio condiviso degli
-- assistenti (viaggio_assistente_*) viene copiato su ciascuna riga
-- assistente migrata, come miglior approssimazione dei dati passati —
-- le leve non avevano nessun campo di viaggio, restano a false/vuoto.
-- Idempotente: "on conflict do nothing" sulla unique qui sopra, sicura
-- da rieseguire.
insert into public.corsi_date_docenti (corso_data_id, tipo, persona_id, viaggio_prenotato, viaggio_file)
select cd.id, 'assistente', unnest(cd.assistente_ids), coalesce(cd.viaggio_assistente_prenotato, false), coalesce(cd.viaggio_assistente_file, '{}')
from public.corsi_date cd
where cd.assistente_ids is not null and array_length(cd.assistente_ids, 1) > 0
on conflict (corso_data_id, tipo, persona_id) do nothing;

insert into public.corsi_date_docenti (corso_data_id, tipo, persona_id)
select cd.id, 'leva', unnest(cd.leva_ids)
from public.corsi_date cd
where cd.leva_ids is not null and array_length(cd.leva_ids, 1) > 0
on conflict (corso_data_id, tipo, persona_id) do nothing;

-- Le colonne vecchie (assistente_ids, leva_ids, viaggio_assistente_prenotato,
-- viaggio_assistente_file) NON vengono droppate: restano in tabella,
-- inutilizzate, per sicurezza e reversibilità.

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 78) Assegnazione Master: il pallino di viaggio diventa a tre stati
-- (si/no/non_occorre — verde/rosso/grigio, il grigio per chi non deve
-- viaggiare) invece del semplice booleano prenotato/non prenotato.
-- Backfill dal booleano esistente, idempotente (tocca solo le righe
-- ancora al valore di default 'no', non sovrascrive modifiche manuali
-- già fatte dopo l'aggiunta della colonna).
--
-- Le righe extra di tipo master/assistente (non le leve) guadagnano
-- anche Note e Note viaggio proprie, come sulla riga principale.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists viaggio_stato text not null default 'no' check (viaggio_stato in ('si', 'no', 'non_occorre'));
update public.corsi_date set viaggio_stato = case when viaggio_prenotato then 'si' else 'no' end where viaggio_stato = 'no';

alter table public.corsi_date_docenti add column if not exists viaggio_stato text not null default 'no' check (viaggio_stato in ('si', 'no', 'non_occorre'));
update public.corsi_date_docenti set viaggio_stato = case when viaggio_prenotato then 'si' else 'no' end where viaggio_stato = 'no';

alter table public.corsi_date_docenti add column if not exists note text;
alter table public.corsi_date_docenti add column if not exists note_viaggio text;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 79) Assegnazione Master: colonna "Avvisata" (flag verde) tra Master e
-- Note — per ricordarsi di aver avvisato quella persona (master,
-- assistente o leva) del corso, su ogni riga.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists avvisata boolean not null default false;
alter table public.corsi_date_docenti add column if not exists avvisata boolean not null default false;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 80) Classificazione delle voci di vendita dello shop online: i corsi
-- vengono venduti attraverso lo shop come se fossero articoli, e i
-- prodotti eliminati da WooCommerce negli ordini storici hanno
-- product_id = 0 (restano identificabili solo dal nome). Questa
-- tabella è la fonte di verità per distinguere prodotto/corso/escluso
-- per ogni nome di voce d'ordine — editabile dall'app, nessuna regola
-- scritta nel codice oltre a questa precompilazione una tantum.
-- ---------------------------------------------------------
create table if not exists public.voci_shop_classificazione (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null default 'prodotto' check (tipo in ('prodotto', 'corso', 'escluso')),
  note text,
  updated_at timestamptz not null default now()
);
alter table public.voci_shop_classificazione enable row level security;
drop policy if exists "accesso interno voci_shop_classificazione" on public.voci_shop_classificazione;
create policy "accesso interno voci_shop_classificazione" on public.voci_shop_classificazione for all to anon using (true) with check (true);

-- Precompilazione: un nome per ogni voce distinta trovata negli ordini
-- storici (vendite_shop.prodotti, jsonb array), classificata con la
-- regola concordata. Idempotente: "on conflict (nome) do nothing" non
-- tocca le righe già presenti (comprese quelle corrette a mano da John).
insert into public.voci_shop_classificazione (nome, tipo)
select nome, case
  when nome ilike '%corso%' or nome ilike '%saldo%' or nome ilike '%acconto%'
    or nome ilike '%formazione%' or nome ilike '%iscrizione%' or nome ilike '%kit avviamento%' then 'corso'
  when nome ilike 'Pmu parziale' or nome ilike 'Parziale PMU Roma' or nome ilike 'needling individuale' then 'corso'
  else 'prodotto'
end as tipo
from (
  select distinct trim(elem ->> 'nome') as nome
  from public.vendite_shop, jsonb_array_elements(prodotti) as elem
  where elem ->> 'nome' is not null and trim(elem ->> 'nome') <> ''
) voci
on conflict (nome) do nothing;

notify pgrst, 'reload schema';
