-- ---------------------------------------------------------
-- IBAN su master, location e fornitori: per lo Scadenziario Passivo, che
-- ora elenca ogni fattura da pagare (data del debito, scadenza,
-- fornitore, oggetto, importo IVA inclusa, IBAN) — sia le voci generate
-- da un corso concluso (compenso master, costo alloggio/location) sia le
-- fatture che si importano a mano dai fornitori.
-- ---------------------------------------------------------
alter table public.master add column if not exists iban text;
alter table public.location add column if not exists iban text;
alter table public.fornitori add column if not exists iban text;

notify pgrst, 'reload schema';
