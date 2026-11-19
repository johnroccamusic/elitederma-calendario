-- I CONTATTI DEL CRM VETTA DENTRO GENION (30/10/2026).
--
-- Chi ha scritto a Elitederma — tutti, non solo chi ha comprato — sta
-- in Vetta (CRM esterno, workspace «Elite Derma»): 23.844 persone al
-- 30/10/2026. Servono qui per analisi e mailing per zona.
--
-- Due tabelle, per scelta del titolare: UNA PERSONA, MOLTE RICHIESTE.
-- In Vetta la stessa persona compare piu' volte (una riga per ogni form
-- compilato); qui si unisce in un contatto solo, ma ogni richiesta resta
-- scritta in `crm_richieste` con la sua data, i corsi chiesti, il canale,
-- chi l'ha trattata e la qualifica di quel momento. I filtri per corso e
-- per periodo lavorano sulle richieste: «Laminazione nel 2025» trova
-- anche chi nel 2024 aveva chiesto Microblading.
--
-- Il luogo: si tiene SEPARATO quello scritto dal contatto (originale) da
-- quello normalizzato sul comune ISTAT, da cui escono provincia e
-- regione. Dove la citta' non si riconosce («italia», «Rometta» che
-- esiste due volte) comune/provincia/regione restano vuoti e
-- `luogo_dubbio` lo dice. Sul contatto vale la richiesta piu' recente
-- con un luogo riconoscibile.
--
-- Nessun secret qui: la lettura da Vetta la fa `scripts/importa-vetta.mjs`
-- con la chiave API nell'ambiente di chi lo lancia.

create table if not exists public.crm_contatti (
  id uuid primary key default gen_random_uuid(),
  -- il record Vetta piu' vecchio della persona: chiave degli aggiornamenti
  vetta_id_principale uuid not null unique,
  nome text,
  cognome text,
  nome_originale text,
  email text,
  email_aggiuntive text[] not null default '{}',
  telefono text,
  telefono_originale text,
  telefoni_aggiuntivi text[] not null default '{}',
  -- luogo: originale e normalizzato, separati
  citta_originale text,
  provincia_originale text,
  regione_originale text,
  comune text,
  provincia text,
  regione text,
  luogo_fonte text,            -- 'vetta' | 'da_citta' | null
  luogo_dubbio boolean not null default false,
  luogo_nota text,
  -- profilo dichiarato
  settore text[] not null default '{}',
  professione text,
  mestiere text,
  corsi_interesse text[] not null default '{}',
  canale text,
  origine_contatto text,
  -- qualifica e trattativa (dalla richiesta piu' recente; la storia sta nelle richieste)
  qualifica text,
  stato_trattativa text not null default 'nessuna',   -- 'venduto' | 'in_trattativa' | 'nessuna'
  gestione_chiamata text,
  opportunita jsonb not null default '[]',
  ultima_vendita_il date,
  totale_venduto numeric(12,2) not null default 0,
  -- chi l'ha trattato (ultima richiesta)
  trattato_da text,
  trattato_da_email text,
  trattato_da_vetta_id uuid,
  agente_storico_email text,
  -- richieste nel tempo
  numero_richieste integer not null default 1,
  primo_contatto_il timestamptz,
  ultimo_contatto_il timestamptz,
  -- collegamenti con l'archivio di Genion
  storico_allievo_id uuid references public.storico_allievi(id) on delete set null,
  iscritto_id uuid references public.iscritti(id) on delete set null,
  collegamento text not null default 'nessuno',      -- 'certo' | 'dubbio' | 'nessuno'
  collegamento_nota text,
  -- controllo
  da_verificare boolean not null default false,
  da_verificare_motivo text,
  creato_in_vetta_il timestamptz,
  aggiornato_in_vetta_il timestamptz,
  creato_da text,              -- 'form' | 'manuale'
  creato_da_nome text,
  importato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create index if not exists crm_contatti_email_idx on public.crm_contatti (lower(email));
create index if not exists crm_contatti_telefono_idx on public.crm_contatti (telefono);
create index if not exists crm_contatti_regione_idx on public.crm_contatti (regione);
create index if not exists crm_contatti_provincia_idx on public.crm_contatti (provincia);
create index if not exists crm_contatti_comune_idx on public.crm_contatti (comune);
create index if not exists crm_contatti_qualifica_idx on public.crm_contatti (qualifica);
create index if not exists crm_contatti_trattato_da_idx on public.crm_contatti (trattato_da);
create index if not exists crm_contatti_stato_idx on public.crm_contatti (stato_trattativa);
create index if not exists crm_contatti_mestiere_idx on public.crm_contatti (mestiere);
create index if not exists crm_contatti_corsi_idx on public.crm_contatti using gin (corsi_interesse);

create table if not exists public.crm_richieste (
  id uuid primary key default gen_random_uuid(),
  contatto_id uuid not null references public.crm_contatti(id) on delete cascade,
  vetta_id uuid not null unique,
  richiesta_il timestamptz not null,
  corsi text[] not null default '{}',        -- etichette canoniche (Microblading, Laminazione…)
  corsi_vetta text[] not null default '{}',  -- i codici com'erano in Vetta
  canale text,
  form_origine text,
  dati_aggiuntivi text,
  preferenza_giorno text,
  preferenza_ora text,
  trattato_da text,
  trattato_da_email text,
  trattato_da_vetta_id uuid,
  agente_storico_email text,
  qualifica text,
  gestione_chiamata text,
  nome_originale text,
  email text,
  telefono text,
  citta_originale text,
  provincia_originale text,
  regione_originale text,
  comune text,
  provincia text,
  regione text,
  luogo_dubbio boolean not null default false,
  luogo_nota text,
  settore text[] not null default '{}',
  professione text,
  opportunita jsonb not null default '[]',
  vetta_grezzo jsonb,
  creato_da text,
  creato_da_nome text,
  aggiornato_in_vetta_il timestamptz,
  importato_il timestamptz not null default now()
);

create index if not exists crm_richieste_contatto_idx on public.crm_richieste (contatto_id);
create index if not exists crm_richieste_data_idx on public.crm_richieste (richiesta_il);
create index if not exists crm_richieste_corsi_idx on public.crm_richieste using gin (corsi);
create index if not exists crm_richieste_qualifica_idx on public.crm_richieste (qualifica);
create index if not exists crm_richieste_trattato_da_idx on public.crm_richieste (trattato_da);

alter table public.crm_contatti enable row level security;
alter table public.crm_richieste enable row level security;

drop policy if exists crm_contatti_staff on public.crm_contatti;
create policy crm_contatti_staff on public.crm_contatti
  for all to authenticated using (true) with check (true);
drop policy if exists crm_richieste_staff on public.crm_richieste;
create policy crm_richieste_staff on public.crm_richieste
  for all to authenticated using (true) with check (true);
