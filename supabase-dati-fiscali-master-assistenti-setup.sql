-- ---------------------------------------------------------
-- Dati fiscali su master e assistenti: la stessa "appendice" già presente
-- sulla scheda hotel (indirizzo, partita IVA, codice destinatario, PEC,
-- IBAN) — l'assistente non aveva ancora nemmeno l'IBAN, il master aveva
-- già l'IBAN ma non il resto. Compilazione manuale, nessun valore di
-- default.
-- ---------------------------------------------------------
alter table public.master add column if not exists indirizzo text;
alter table public.master add column if not exists civico text;
alter table public.master add column if not exists citta text;
alter table public.master add column if not exists partita_iva text;
alter table public.master add column if not exists codice_destinatario text;
alter table public.master add column if not exists pec text;

alter table public.assistente add column if not exists indirizzo text;
alter table public.assistente add column if not exists civico text;
alter table public.assistente add column if not exists citta text;
alter table public.assistente add column if not exists partita_iva text;
alter table public.assistente add column if not exists codice_destinatario text;
alter table public.assistente add column if not exists pec text;
alter table public.assistente add column if not exists iban text;

notify pgrst, 'reload schema';
