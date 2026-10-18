-- 18/10/2026 — Lo sconto della fiera, segnato sulla vendita.
--
-- `evento_id` diceva gia' che una vendita e' stata fatta a una fiera.
-- Non diceva se a quel carrello e' stato fatto lo sconto: al banco lo
-- accende chi vende, carrello per carrello, quindi due vendite dello
-- stesso evento possono essere una scontata e una no. Senza questa
-- colonna, "quanto ci e' costata la fiera in sconti" si potrebbe solo
-- stimare confrontando i prezzi di listino riga per riga.
--
-- Vale false per tutto lo storico, ed e' giusto: prima del 18/10/2026
-- lo sconto a fasce senza codice non esisteva.
alter table public.vendite_shop
  add column if not exists sconto_fiera boolean not null default false;

comment on column public.vendite_shop.sconto_fiera is
  'true se al banco e'' stato acceso lo sconto fiera: le fasce dei corsi applicate a un evento, senza codice. Le tabelle sono le stesse dei corsi (impostazioni fasceSconto_corsi_carta / _contanti).';
