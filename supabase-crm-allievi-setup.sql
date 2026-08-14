-- ---------------------------------------------------------
-- CRM / Allievi: tabella iscritti resta invariata (non è
-- un'anagrafica persona, è "una riga per ogni corso comprato", niente
-- email né città/regione di provenienza, e il modulo di iscrizione
-- SchedaData non va toccato). Questa tabella è solo l'ARRICCHIMENTO
-- separato — email, città/regione di provenienza, note — abbinato agli
-- iscritti via una chiave calcolata (non un id: iscritti non ha un id
-- persona stabile), la stessa sia per raggruppare sia per l'upsert
-- quando si compilano questi campi dalla scheda CRM:
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
