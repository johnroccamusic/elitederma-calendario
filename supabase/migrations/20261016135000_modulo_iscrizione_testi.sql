-- IL TESTO DEL CONTRATTO CHE L'ALLIEVA FIRMA.
-- APPLICATA il 16/10/2026 via MCP.
--
-- Regolamento, informativa privacy e consensi stanno in
-- src/iscrizione/contenuto.js, trascritti parola per parola dal modulo
-- che girava sul sito. Da qui in avanti si possono correggere dall'app,
-- da Setting > Modulo di iscrizione > Il contratto.
--
-- PERCHE' IL CODICE RESTA. Una riga che manca non e' un buco: vale
-- quello che dice contenuto.js, esattamente come fa `email_modelli` col
-- testo delle mail. Cosi' se la tabella e' vuota, illeggibile o qualcuno
-- cancella una riga per sbaglio, il modulo continua a mostrare il testo
-- giusto invece di presentarsi vuoto. Quello che si firma non puo'
-- dipendere dal fatto che una select sia andata a buon fine.
--
-- PERCHE' jsonb E NON text. I tre pezzi non hanno la stessa forma:
-- l'intestazione sono due righe, il regolamento e' una lista di punti
-- ciascuno coi suoi capoversi, i consensi sono una decina di etichette.
-- Tenere la forma originale vuol dire che chi legge il modulo non si
-- accorge di niente e chi corregge vede i punti separati, non un muro.
--
-- SOLO CHI HA FATTO ACCESSO. Come email_modelli: qui si decide cosa
-- firma una persona. La chiave pubblicabile sta nel bundle, e un testo
-- contrattuale riscrivibile da chiunque non e' un rischio teorico.
create table if not exists public.modulo_iscrizione_testi (
  chiave        text primary key,
  corpo         jsonb not null,
  aggiornato_da text,
  aggiornato_il timestamptz not null default now()
);

comment on table public.modulo_iscrizione_testi is
  'Regolamento, privacy e consensi del modulo di iscrizione. Riga mancante = vale il testo di src/iscrizione/contenuto.js.';
comment on column public.modulo_iscrizione_testi.chiave is
  'intro | regolamento | consensi';

alter table public.modulo_iscrizione_testi enable row level security;

drop policy if exists "staff autenticato modulo_iscrizione_testi" on public.modulo_iscrizione_testi;
create policy "staff autenticato modulo_iscrizione_testi"
  on public.modulo_iscrizione_testi for all to authenticated
  using (true) with check (true);

-- La tabella NASCE VUOTA di proposito: finche' nessuno corregge niente,
-- comanda il testo trascritto nel codice. La prima riga la scrive il
-- primo salvataggio dalla pagina.
--
-- Provata il 16/10/2026 con una riga 'intro' scritta e cancellata
-- subito, per chiave e per autore: la tabella e' tornata vuota.
