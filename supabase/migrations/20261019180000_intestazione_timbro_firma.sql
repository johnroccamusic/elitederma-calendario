-- IL TIMBRO E LA FIRMA DELLA SOCIETA'.
--
-- Fino a oggi la copia che l'allieva riceve porta una firma sola: la
-- sua. E' un contratto sottoscritto da una parte e basta — valido, ma
-- monco da guardare: chi lo riapre fra un anno non ci trova scritto da
-- nessuna parte che Elitederma l'ha accettato, ne' in che giorno.
--
-- Il file sta nel secchio PRIVATO `moduli-iscrizione`, sotto
-- `_azienda/`, e non in `intestazione-societa` che e' pubblico:
-- un'immagine di firma raggiungibile da chiunque conosca l'indirizzo e'
-- esattamente la cosa da non fare.
--
-- Perche' una colonna e non un percorso scritto nel codice: il timbro
-- cambia quando cambia la ragione sociale o chi firma, e deve potersi
-- sostituire caricando un file nuovo.
alter table public.intestazione_societa
  add column if not exists timbro_path text;

comment on column public.intestazione_societa.timbro_path is
  'Timbro e firma della societa'', nel secchio privato moduli-iscrizione. Finisce in fondo alla copia firmata del modulo.';

update public.intestazione_societa
   set timbro_path = '_azienda/timbro-firma.pdf'
 where timbro_path is null;
