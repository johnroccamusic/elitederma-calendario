-- 18/10/2026 — La fattura si chiede PRIMA, non si subisce dopo.
--
-- Fino a oggi la pagina di pagamento di Stripe chiedeva a chiunque
-- inquadrasse il QR l'indirizzo completo, il codice fiscale (campo
-- obbligatorio) e la partita IVA. Anche a chi comprava un pennello da
-- dieci euro: gente ferma alla cassa a scrivere dati per un documento
-- che non le serviva. Ed e' il motivo per cui "Fatture da emettere" si
-- riempiva da sola — i dati c'erano per forza, non perche' qualcuno li
-- avesse chiesti.
--
-- Da adesso il venditore, premendo "Copia il link" o "Mostra il QR",
-- risponde a una domanda sola: "Il cliente ha bisogno di fattura?".
-- Solo il si' fa chiedere i dati a Stripe, e solo quell'incasso finisce
-- fra le fatture da emettere.
alter table public.pagamenti_pos
  add column if not exists richiede_fattura boolean not null default false;

-- Lo storico: tutti i pagamenti vecchi avevano i dati per forza. Si
-- segnano come "richiesta" solo quelli che un codice fiscale o una
-- partita IVA ce l'hanno davvero.
update public.pagamenti_pos
set richiede_fattura = true
where coalesce(cliente->>'codice_fiscale', '') <> ''
   or coalesce(cliente->>'piva', '') <> '';
