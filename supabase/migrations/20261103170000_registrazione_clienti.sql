-- REGISTRAZIONE CLIENTI (3/11/2026), chiesta dal titolare: una tessera in
-- Home per chiunque, dove chi vende registra un cliente — nome, cognome,
-- luogo, email, telefono — e un secondo elenco dove si consultano tutti.
--
-- CHI E' "GIA' REGISTRATO", ED E' LA REGOLA CHE CONTA. Parole del
-- titolare: «in caso di omonimia l'utente va considerato già registrato se
-- tutto corrisponde, anche la mail e il numero di telefono, perché se
-- abbiamo un utente con lo stesso nome ma numero di telefono e mail sono
-- diversi, per noi è un secondo utente». Quindi l'identita' e'
-- nome + cognome + email + telefono, e NON il solo nome.
--
-- La citta' resta fuori dall'identita' di proposito: chi trasloca non
-- diventa un secondo cliente.
--
-- E la regola sta QUI, in un indice unico, non nel browser: il controllo
-- che la pagina fa prima di salvare serve a dire «utente già registrato»
-- con la riga davanti, ma due venditori che premono Salva nello stesso
-- istante li ferma solo il database.

create table if not exists public.clienti_registrati (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cognome text not null,
  citta text,
  provincia text,
  cap text,
  regione text,
  email text,
  -- sempre in forma +39xxxxxxxxx: il prefisso lo impone la pagina, qui si
  -- archivia quello che e' stato scritto
  telefono text,
  note text,
  registrato_da text,
  registrato_il timestamptz not null default now()
);

-- L'IDENTITA', normalizzata allo stesso modo in cui la normalizza la
-- pagina (src/clienti/dati.js): spazi ripuliti, maiuscole indifferenti,
-- del telefono contano le sole cifre. Due normalizzazioni diverse
-- vorrebbero dire una pagina che dice «già registrato» su una riga che il
-- database accetta, o il contrario.
create unique index if not exists clienti_registrati_identita
  on public.clienti_registrati (
    (lower(regexp_replace(trim(nome), '\s+', ' ', 'g'))),
    (lower(regexp_replace(trim(cognome), '\s+', ' ', 'g'))),
    (lower(coalesce(trim(email), ''))),
    (regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'))
  );

-- per l'elenco, che si legge dal piu' recente
create index if not exists clienti_registrati_quando on public.clienti_registrati (registrato_il desc);

alter table public.clienti_registrati enable row level security;

drop policy if exists "clienti registrati: accesso staff" on public.clienti_registrati;
create policy "clienti registrati: accesso staff" on public.clienti_registrati
  for all to authenticated using (true) with check (true);

-- LA TESSERA NASCE ACCESA PER TUTTI, come chiesto: «me lo devi dare già
-- attivo negli utenti, a tutti gli utenti, quindi a tutte le master e a
-- chiunque altro». Resta un permesso vero — la casella c'e' in Gestione
-- utenti, Password master, Password venditori e Password assistenti —
-- cosi' un giorno si puo' togliere a qualcuno; ma oggi ce l'hanno tutti.
-- `permessi` e' jsonb (un elenco di stringhe), non text[]: l'operatore
-- giusto e' `?`, che su un array jsonb cerca fra gli elementi.
update public.utenti_app
   set permessi = coalesce(permessi, '[]'::jsonb) || '["registrazioneclienti"]'::jsonb
 where not coalesce(permessi, '[]'::jsonb) ? 'registrazioneclienti';

update public.master
   set permessi = coalesce(permessi, '[]'::jsonb) || '["registrazioneclienti"]'::jsonb
 where not coalesce(permessi, '[]'::jsonb) ? 'registrazioneclienti';

update public.venditori
   set permessi = coalesce(permessi, '[]'::jsonb) || '["registrazioneclienti"]'::jsonb
 where not coalesce(permessi, '[]'::jsonb) ? 'registrazioneclienti';

update public.assistente
   set permessi = coalesce(permessi, '[]'::jsonb) || '["registrazioneclienti"]'::jsonb
 where not coalesce(permessi, '[]'::jsonb) ? 'registrazioneclienti';
