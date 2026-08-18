-- ---------------------------------------------------------
-- Anagrafiche (nuova pagina in Amministrazione): unifica fornitori,
-- master, assistenti, hotel/location e venditori in un'unica lista.
-- Master/assistente/hotel hanno già telefono/email (appendice dati
-- fiscali); fornitori no — mancavano del tutto, servono per mostrare/
-- modificare i contatti anche dei fornitori "puri" (senza un ruolo
-- master/assistente/hotel/venditore).
--
-- Additivo puro: due colonne nullable, nessuna riga esistente toccata.
-- ---------------------------------------------------------

alter table public.fornitori
  add column if not exists telefono text,
  add column if not exists email text;

notify pgrst, 'reload schema';
