-- Correzione di una nota, non della struttura.
--
-- Quando ho creato `movimenti_banca` davo per scontato che il file della
-- banca non portasse un identificativo di riga affidabile, e l'impronta
-- la calcolavo da conto + data + importo + descrizione + progressivo.
--
-- L'estratto OFX della Banca Popolare del Lazio invece un identificativo
-- ce l'ha (il FITID), ed e' stabile: scaricando due volte lo stesso
-- periodo, luglio e agosto 2026, tutti e 311 i movimenti sono tornati con
-- lo stesso identificativo e la stessa riga. Quindi l'impronta ora e'
-- `<conto>:<identificativo>` — un dato della banca, non una supposizione
-- nostra.
--
-- Il calcolo vecchio resta come riserva per i caricamenti fatti col solo
-- CSV, che l'identificativo non ce l'ha.
comment on column public.movimenti_banca.impronta is
  'Di norma <conto>:<FITID>, l''identificativo che la banca assegna al movimento nell''OFX: verificato stabile fra scarichi diversi, quindi ricaricare un periodo gia'' caricato non crea doppioni. Se manca l''OFX si ripiega su conto + data + importo + descrizione + progressivo.';
