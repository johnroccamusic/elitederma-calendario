-- I MODELLI DELLE MAIL CHE PARTONO DA GENYON.
--
-- Una riga per tipo di messaggio, riconosciuta dalla `chiave` (che non
-- cambia mai: e' lei a legare il modello al codice che lo usa, anche
-- dopo che il testo e' stato riscritto dieci volte). Il primo e'
-- "conferma_iscrizione".
--
-- Dentro `testo` ci sono i segnaposti fra graffe — {nome}, {corso},
-- {date}, {citta}, {sede}, {indirizzo}, {dettagli} — che l'app sostituisce
-- al momento dell'invio. Chi scrive il testo non deve sapere altro.
--
-- Niente versioni ne' storico: questo non e' il consenso informato, dove
-- una firma deve poter dire sotto quale testo e' stata data. Qui conta
-- solo il testo di adesso. Restano `aggiornato_il` e `aggiornato_da` per
-- sapere chi ha toccato cosa.
create table if not exists public.email_modelli (
  id uuid primary key default gen_random_uuid(),
  chiave text not null unique,
  oggetto text,
  testo text,
  aggiornato_il timestamptz not null default now(),
  aggiornato_da text
);

alter table public.email_modelli enable row level security;

-- SOLO CHI HA FATTO ACCESSO. Non `anon`, a differenza di quasi tutte le
-- altre tabelle di questo database: da qui si decide il testo di una mail
-- che esce a nome di Elitederma, e la chiave pubblicabile sta nel bundle
-- scaricabile da chiunque. Una riscrittura di questo testo da fuori
-- diventerebbe una nostra mail con dentro le parole di un altro.
drop policy if exists "staff autenticato email_modelli" on public.email_modelli;
create policy "staff autenticato email_modelli"
  on public.email_modelli for all to authenticated
  using (true) with check (true);
