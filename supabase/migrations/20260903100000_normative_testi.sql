-- I testi delle Normative. Vivono sul database e non nel codice perche'
-- le regole cambiano, e a cambiarle e' chi le scrive: in modalita'
-- programmatore si clicca sul testo, lo si riscrive, e la versione nuova
-- la vedono tutti. Il testo di partenza (quello pubblicato su
-- elitederma.it/torna-al-corso) lo scrive l'app la prima volta che la
-- pagina viene aperta.
create table if not exists normative_testi (
  chiave text primary key,
  titolo text,
  blocchi jsonb not null default '[]'::jsonb,
  aggiornato_il timestamptz not null default now()
);

alter table normative_testi enable row level security;
drop policy if exists "accesso interno normative_testi" on normative_testi;
create policy "accesso interno normative_testi" on normative_testi
  for all to anon, authenticated using (true) with check (true);
