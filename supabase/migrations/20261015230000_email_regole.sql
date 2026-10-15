-- LE REGOLE DEGLI INVII AUTOMATICI.
--
-- "Quale testo" e "quando parte" sono due cose diverse, e il modello non
-- deve sapere la seconda. Qui sta la seconda: a quale evento ci si
-- aggancia, con quanti giorni di scarto, a chi, e se la regola e' accesa.
--
-- SCARTO_GIORNI si conta RISPETTO ALL'EVENTO: negativo = prima.
--   -3 su `inizio_corso`  = tre giorni prima che il corso cominci
--    0 su `fine_corso`    = il giorno in cui finisce
--   +7 su `fine_corso`    = una settimana dopo
-- Il lavoro notturno cerca le classi la cui data dell'evento e'
-- `oggi - scarto_giorni` (con -3 diventa oggi + 3: i corsi che
-- cominciano fra tre giorni).
create table if not exists public.email_regole (
  id uuid primary key default gen_random_uuid(),
  chiave_modello text not null,
  evento text not null check (evento in ('inizio_corso', 'fine_corso')),
  scarto_giorni int not null,
  destinatari text not null default 'iscritti_classe'
    check (destinatari in ('iscritti_classe')),
  -- SPENTA DI NASCITA, e non e' una svista. Una regola che si accendesse
  -- da sola comincerebbe a scrivere ad allieve vere la notte stessa in cui
  -- viene creata, prima che qualcuno abbia riletto il testo. Si accende a
  -- mano, dopo aver mandato una prova a se stessi.
  attiva boolean not null default false,
  nota text,
  ultima_esecuzione timestamptz,
  creata_il timestamptz not null default now()
);

alter table public.email_regole enable row level security;
drop policy if exists "staff autenticato email_regole" on public.email_regole;
create policy "staff autenticato email_regole"
  on public.email_regole for all to authenticated
  using (true) with check (true);

-- La prima regola: i dettagli organizzativi, tre giorni prima. E' quella
-- che la conferma iscrizione gia' promette ("qualche giorno prima del
-- corso riceverai gli ultimi dettagli organizzativi") e che finora non
-- mandava nessuno. Nasce spenta e col modello ancora da scrivere.
insert into public.email_regole (chiave_modello, evento, scarto_giorni, nota)
select 'dettagli_organizzativi', 'inizio_corso', -3,
       'Promessa nella mail di conferma. Scrivere il testo in Modelli email, mandarsi una prova, poi accendere.'
where not exists (select 1 from public.email_regole where chiave_modello = 'dettagli_organizzativi');
