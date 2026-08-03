-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Setting loghi": calibrazione
-- indipendente per logo nero e logo bianco, colore testo automatico
-- (nero su logo nero, bianco su logo bianco) e limiti sx/dx per il
-- nome allieva.
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- il colore del testo non si sceglie più a mano: è sempre nero sul
-- logo nero e bianco sul logo bianco, quindi le colonne colore non
-- servono più
alter table public.loghi_categorie drop column if exists nome_colore;
alter table public.loghi_categorie drop column if exists numero_colore;

-- la posizione/dimensione di nome e codice ora è calibrata
-- separatamente per il logo nero e per il logo bianco (i 2 file
-- possono avere una grafica leggermente diversa), quindi le vecchie
-- colonne condivise vengono sostituite da 2 set prefissati
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

notify pgrst, 'reload schema';
