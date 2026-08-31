-- ---------------------------------------------------------
-- Il cestino di una data archiviata non cancellava niente.
--
-- Postgres rifiutava la cancellazione: tre tabelle puntano a corsi_date
-- senza dire cosa fare quando la riga sparisce (ON DELETE NO ACTION), e
-- basta una di quelle righe per bloccare tutto. Le tre sono coupon,
-- codici_emessi e segnalazioni_magazzino — e il coupon referral di
-- un'edizione oggi si crea da solo, quindi quasi ogni corso ne ha uno: il
-- cestino era di fatto sempre bloccato. Il messaggio d'errore che arrivava
-- era quello grezzo del database, e non diceva niente a nessuno.
--
-- Cosa deve succedere, tabella per tabella:
--
--   coupon                  CASCADE. Il codice referral di un'edizione non
--                           ha vita propria: se l'edizione sparisce deve
--                           sparire anche lui. Lasciarlo orfano sarebbe
--                           peggio che cancellarlo — un coupon senza
--                           edizione vale come referral personale della
--                           master, quindi continuerebbe ad attribuirle
--                           vendite per sempre. Le vendite che l'hanno
--                           usato non perdono niente: vendite_shop tiene
--                           anche il codice scritto per esteso.
--
--   codici_emessi           SET NULL. E' lo storico dei codici consegnati:
--                           il fatto che siano stati emessi resta vero
--                           anche senza piu' l'edizione che li ha generati.
--
--   segnalazioni_magazzino  SET NULL. Una segnalazione ("lo sgabello e'
--                           rotto") appartiene alla sede, non al corso
--                           durante il quale qualcuno l'ha notata.
-- ---------------------------------------------------------

alter table public.coupon
  drop constraint if exists coupon_corsi_date_id_fkey,
  add constraint coupon_corsi_date_id_fkey
    foreign key (corsi_date_id) references public.corsi_date(id) on delete cascade;

alter table public.codici_emessi
  drop constraint if exists codici_emessi_corsi_date_id_fkey,
  add constraint codici_emessi_corsi_date_id_fkey
    foreign key (corsi_date_id) references public.corsi_date(id) on delete set null;

alter table public.segnalazioni_magazzino
  drop constraint if exists segnalazioni_magazzino_corso_data_id_fkey,
  add constraint segnalazioni_magazzino_corso_data_id_fkey
    foreign key (corso_data_id) references public.corsi_date(id) on delete set null;
