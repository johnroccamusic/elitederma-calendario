-- IL REGISTRO DELLE MAIL PARTITE.
--
-- Finora non esisteva: premendo due volte "Invia mail di conferma"
-- partivano due mail e non se ne accorgeva nessuno, e alla domanda "alla
-- Bianchi la conferma gliel'abbiamo mandata?" non si poteva rispondere.
--
-- Serve a tre cose: dirlo sulla scheda dell'allieva, impedire che una
-- mail AUTOMATICA parta due volte, e lasciare traccia anche dei
-- fallimenti (un indirizzo sbagliato, Resend che rifiuta) — che sono
-- proprio i casi in cui qualcuno ha bisogno di sapere cos'e' successo.
create table if not exists public.email_inviate (
  id uuid primary key default gen_random_uuid(),
  chiave_modello text not null,
  destinatario text not null,
  -- niente chiavi esterne: se un'iscritta viene cancellata, la traccia
  -- della mail che le e' stata mandata deve restare. E' un registro, non
  -- una relazione.
  iscritto_id uuid,
  corso_data_id uuid,
  oggetto text,
  esito text not null default 'ok',          -- ok | errore
  errore text,
  resend_id text,
  -- chi l'ha fatta partire: l'indirizzo di chi ha premuto, oppure
  -- 'automatico' per quelle mandate da sole
  inviata_da text,
  automatica boolean not null default false,
  inviata_il timestamptz not null default now()
);

create index if not exists email_inviate_per_iscritto
  on public.email_inviate (iscritto_id, chiave_modello);
create index if not exists email_inviate_per_classe
  on public.email_inviate (corso_data_id, chiave_modello);

-- LA REGOLA CHE CONTA, e sta qui e non nel codice.
--
-- Una mail automatica non puo' partire due volte alla stessa persona per
-- lo stesso modello. Il controllo e' un indice: un giro di cron che
-- riparte, due lavori sovrapposti o un errore di logica si schiantano
-- contro il database invece di riempire la casella di un'allieva.
--
-- PARZIALE di proposito: vale solo per `automatica` e solo per gli invii
-- riusciti. Il tasto a mano deve poter rimandare la conferma quante volte
-- serve — capita, e chi preme sa quello che fa. E un tentativo fallito non
-- deve impedire di riprovare.
create unique index if not exists email_inviate_una_sola_automatica
  on public.email_inviate (chiave_modello, iscritto_id)
  where automatica and esito = 'ok';

alter table public.email_inviate enable row level security;

-- Come `email_modelli`: solo chi ha fatto accesso. Qui dentro ci sono gli
-- indirizzi delle allieve e cosa gli e' stato scritto.
drop policy if exists "staff autenticato email_inviate" on public.email_inviate;
create policy "staff autenticato email_inviate"
  on public.email_inviate for all to authenticated
  using (true) with check (true);
