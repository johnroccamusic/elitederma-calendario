-- Nuova sezione CRM "Storico allievi": importazione una tantum dei corsi
-- svolti dal 2022 in poi, recuperati dagli archivi Excel su Google Drive
-- (cartella "GESTIONE CORSI"), mai transitati in "iscritti"/"corsi_date".
-- Tabella di sola consultazione, separata da iscritti/corsi_date: non
-- alimenta commissioni, obiettivi venditore o magazzino.
create table public.storico_allievi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cognome text not null,
  nome_cognome_originale text not null,
  dubbio_nome boolean not null default false,
  motivo_dubbio text,
  citta text not null,
  citta_cartella text,
  citta_disaccordo boolean not null default false,
  corso_id uuid references public.corsi(id),
  sigla_cartella text,
  sigla_interna text,
  fonte_tipo_vincente text,
  data date,
  precisione_data text not null,
  anno_cartella integer,
  file_origine text not null,
  ts timestamptz not null default now()
);

alter table public.storico_allievi enable row level security;

create policy "storico_allievi_staff" on public.storico_allievi
  for all to authenticated using (true) with check (true);
