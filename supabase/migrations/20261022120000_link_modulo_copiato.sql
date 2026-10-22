-- IL LINK DEL MODULO PASSATO A MANO, E LA SUA TRACCIA.
--
-- Il modulo parte per email, e basta: il "Copia il link" era stato tolto
-- il 20/10/2026 proprio per questo — di una mail resta scritto cos'e'
-- partito e a chi, di un link incollato in chat non resta niente.
--
-- Ma il 22/10/2026 e' successo il caso che mancava: tre mail consegnate
-- a Hotmail e mai aperte, probabilmente finite nella posta indesiderata.
-- La mail e' l'unico canale, e quando quel canale non arriva
-- l'iscrizione si ferma senza che nessuno possa farci niente.
--
-- Quindi il link si puo' ripassare a mano — con la sua traccia, che e'
-- la condizione posta da CLAUDE.md quando `segnaInviatoAMano` e' stata
-- cancellata: «va rifatta insieme alla sua traccia: chi l'ha mandato,
-- dove, e come si dimostra».
--
-- ATTENZIONE A COSA NON FA. Copiare il link NON segna il modulo come
-- inviato. Era esattamente il peccato di `segnaInviatoAMano`: scriveva
-- `modulo_inviato_il` senza che fosse partito niente, e in ufficio
-- risultava spedito qualcosa che nessuno poteva dimostrare. Qui resta
-- scritto solo il fatto vero: qualcuno ha preso il link, quel giorno.
create table if not exists moduli_link_copiati (
  id uuid primary key default gen_random_uuid(),
  iscritto_id uuid not null references iscritti(id) on delete cascade,
  copiato_il timestamptz not null default now(),
  copiato_da text
);

create index if not exists moduli_link_copiati_iscritto
  on moduli_link_copiati (iscritto_id, copiato_il desc);

alter table moduli_link_copiati enable row level security;

drop policy if exists moduli_link_copiati_staff on moduli_link_copiati;
create policy moduli_link_copiati_staff on moduli_link_copiati
  for all to authenticated using (true) with check (true);

comment on table moduli_link_copiati is
  'Chi ha preso il link del modulo per passarlo a mano, e quando. Non segna il modulo come inviato: dice solo che il link e'' uscito da qui.';
