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
alter table if exists public.costi_operativi_voci rename to costi_operativi_voci_deprecata;

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

notify pgrst, 'reload schema';
