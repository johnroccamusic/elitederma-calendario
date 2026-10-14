-- A QUALI CORSI VALE UN CONSENSO.
--
-- Fino a oggi c'era un consenso solo ("Consenso PMU e Micro") e la scheda
-- della classe mostrava quello, sempre, perche' era il primo dell'elenco.
-- Con il secondo — laminazione, extension — la scheda avrebbe continuato
-- a mostrare il primo, cioe' quello sbagliato, senza dirlo a nessuno.
--
-- Qui si scrive quale consenso vale per quale corso. Una riga per coppia:
-- un consenso puo' valere per piu' corsi (PMU base, PMU avanzato, micro)
-- e un corso puo' averne piu' d'uno.
--
-- `modello_codice` e' il codice del consenso in src/content/consensi.ts,
-- non una chiave esterna: i consensi vivono nel codice, versionati col
-- loro testo, e non in una tabella. Se un giorno un codice sparisse dal
-- file, la riga qui resterebbe orfana e innocua — la scheda corso legge
-- l'elenco del codice e ignora quello che non trova.
create table if not exists consensi_corsi (
  id uuid primary key default gen_random_uuid(),
  modello_codice text not null,
  corso_id uuid not null references corsi(id) on delete cascade,
  creato_il timestamptz not null default now(),
  unique (modello_codice, corso_id)
);

alter table consensi_corsi enable row level security;

-- Non c'e' niente di personale qui dentro: e' una tabella di
-- impostazioni. La scheda della classe la legge per sapere quale codice
-- mostrare, quindi la lettura serve a chiunque usi il gestionale.
drop policy if exists "accesso interno consensi_corsi" on consensi_corsi;
create policy "accesso interno consensi_corsi" on consensi_corsi
  for all to anon, authenticated using (true) with check (true);

create index if not exists consensi_corsi_corso on consensi_corsi (corso_id);
