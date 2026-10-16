-- IL TOTALE PATTUITO: scritto al netto o a prezzo finito.
-- APPLICATA il 16/10/2026 via MCP.
--
-- Il campo si chiama "Totale pattuito (senza IVA)". L'hennè pero' si
-- vende a prezzo finito — "550 e basta" — e il venditore non aveva dove
-- dirlo. Si vede nei dati: fra i 13 iscritti hennè c'e' un 368,85, che
-- e' esattamente 450 / 1,22.
--
-- QUESTO FLAG NON TOCCA NESSUN IMPORTO. Non somma e non detrae IVA:
-- registra come quella cifra e' stata pattuita, e cambia l'etichetta del
-- campo. Il numero salvato resta esattamente quello digitato, e tutto
-- cio' che lo legge — la commissione del 7%, la copertura delle quote,
-- le statistiche — continua a fare quello che faceva prima.
--
-- Convertire al salvataggio sarebbe stato comodo e sbagliato:
-- significherebbe cambiare da solo un importo concordato con una
-- persona. Se e quando andranno convertiti, lo decidera' qualcuno
-- guardando questo flag.
--
-- LO STORICO NON SI TOCCA, e vale da oggi in poi: nessun
-- `totale_pattuito` e' stato modificato, e `totale_pattuito_modo` nasce
-- vuoto su tutte le 258 iscrizioni. Vuoto, su una scheda che esiste
-- gia', si legge "netto": sono tutte state scritte cosi'.

alter table public.corsi
  add column if not exists prezzo_iva_inclusa boolean not null default false;

comment on column public.corsi.prezzo_iva_inclusa is
  'Il prezzo di questo corso si pattuisce a prezzo finito (IVA inclusa). Decide solo da quale flag parte una scheda NUOVA: nessun importo viene convertito.';

update public.corsi set prezzo_iva_inclusa = true
 where nome ilike '%henn%';

alter table public.iscritti
  add column if not exists totale_pattuito_modo text;

alter table public.iscritti drop constraint if exists iscritti_totale_pattuito_modo_check;
alter table public.iscritti add constraint iscritti_totale_pattuito_modo_check
  check (totale_pattuito_modo is null or totale_pattuito_modo in ('netto', 'lordo'));

comment on column public.iscritti.totale_pattuito_modo is
  'Come e'' stato pattuito il totale: netto | lordo. Vuoto = netto (tutte le schede fino al 16/10/2026). Non cambia il valore di totale_pattuito.';
