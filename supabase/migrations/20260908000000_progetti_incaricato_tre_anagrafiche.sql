-- Il permesso "Progetti in corso" si da' su tutte e tre le anagrafiche —
-- utenti dell'app, master e venditori — perche' sono tre elenchi di
-- password diversi nella stessa pagina. La tendina "Assegnato a" invece
-- guardava solo gli utenti dell'app: una master abilitata (Chiara) non
-- compariva, pur potendo aprire l'area.
--
-- Quindi incaricato_id smette di essere una chiave esterna su utenti_app —
-- non puo' esserlo, sono tre tabelle — e si affianca a incaricato_tipo che
-- dice in quale cercarlo. Stesso schema gia' usato per "reperita da" sulle
-- modelle.
alter table public.progetti drop constraint if exists progetti_incaricato_id_fkey;
alter table public.progetti add column if not exists incaricato_tipo text;

comment on column public.progetti.incaricato_id is
  'Id della persona incaricata. Non è una chiave esterna: può stare in utenti_app, master o venditori.';
comment on column public.progetti.incaricato_tipo is
  'In quale anagrafica cercare incaricato_id: utente, master o venditore.';
