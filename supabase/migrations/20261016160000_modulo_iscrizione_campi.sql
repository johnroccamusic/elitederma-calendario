-- COSA FINISCE SUL MODULO MANDATO ALL'ALLIEVA, e cosa arriva gia' scritto.
--
-- Il modulo non si compila da zero: il venditore ha gia' riempito la
-- scheda in Genyon, e quello che sa lo porta con se'. Qui si decide, un
-- campo alla volta, se quel campo esce sul modulo (`incluso`) e da quale
-- colonna della scheda prende il valore (`precompilato_da`).
--
-- NON C'E' L'ELENCO DEI CAMPI, solo le scelte. I campi veri stanno in
-- src/iscrizione/contenuto.js, trascritti dal modulo del sito: quello e'
-- il testo del contratto e sta nel codice, versionato, dove si vede chi
-- l'ha cambiato. Qui dentro ci sono le spunte, che sono un'altra cosa e
-- le tocca chi lavora, non chi programma. La `chiave` lega le due parti
-- e non cambia mai.
create table if not exists public.modulo_iscrizione_campi (
  chiave text primary key,
  incluso boolean not null default true,
  -- la colonna della scheda da cui si prende il valore, scritta come
  -- "tabella.colonna". Vuoto = lo compila l'allieva (documento, codice
  -- fiscale, firma: cose che il venditore non ha).
  precompilato_da text,
  aggiornato_il timestamptz not null default now(),
  aggiornato_da text
);

alter table public.modulo_iscrizione_campi enable row level security;

-- Solo chi ha fatto accesso: da qui si decide cosa viene chiesto a una
-- persona in un modulo che poi firma.
drop policy if exists "staff autenticato modulo_iscrizione_campi" on public.modulo_iscrizione_campi;
create policy "staff autenticato modulo_iscrizione_campi"
  on public.modulo_iscrizione_campi for all to authenticated
  using (true) with check (true);

-- Le scelte di partenza (una riga per campo di src/iscrizione/contenuto.js)
-- sono state inserite al momento della creazione: tutti i campi inclusi,
-- 18 dei 24 precompilati dalla scheda, 6 lasciati all'allieva — documento
-- fronte e retro, tipo e numero del documento, codice fiscale e la scelta
-- modelle della tricopigmentazione.

-- 16/10/2026: `obbligatorio`. Un campo sul modulo che il venditore ha
-- lasciato vuoto tocca all'allieva, e senza di lui il modulo non parte.
-- Ma non tutti i vuoti si possono riempire — l'interno non ce l'hanno
-- tutti, la PEC serve solo a chi fattura — e se "vuoto" bastasse a
-- renderli obbligatori chi abita in una villetta non riuscirebbe a
-- spedire e non capirebbe perche'. Quindi lo si decide campo per campo.
alter table public.modulo_iscrizione_campi
  add column if not exists obbligatorio boolean not null default true;
