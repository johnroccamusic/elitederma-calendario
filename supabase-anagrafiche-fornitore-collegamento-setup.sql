-- ---------------------------------------------------------
-- Anagrafiche: collegamento esplicito fornitore -> location/hotel.
-- "Associa" scrive già i dati di contatto/fiscali del fornitore sulla
-- sede/hotel esistente, ma l'unione dei soggetti in Anagrafiche
-- (costruisciSoggettiAnagrafiche) funzionava solo per nome esatto: il
-- nome della sede include sempre la città ("Aura Formazione Srl,
-- Pescara"), diverso dal nome puro del fornitore ("Aura Formazione
-- Srl") — le due righe restavano quindi doppioni anche dopo
-- l'associazione.
--
-- Con fornitore_id l'unione non dipende più dal nome: una sede/hotel
-- associata finisce sempre nello stesso soggetto del suo fornitore.
--
-- Additivo puro, nessuna riga toccata.
-- ---------------------------------------------------------

alter table public.location add column if not exists fornitore_id uuid references public.fornitori(id) on delete set null;
alter table public.hotel add column if not exists fornitore_id uuid references public.fornitori(id) on delete set null;

notify pgrst, 'reload schema';
