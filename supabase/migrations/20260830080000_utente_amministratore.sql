-- Un account nominale può essere amministratore: fino a ieri il grado
-- "amministratore" lo dava solo la password condivisa, quindi chi entrava
-- con il proprio nome — anche avendo tutti i permessi — restava un utente
-- normale e trovava le schede iscritto in sola lettura.
--
-- Il grado vale sopra ogni altra cosa: se un account è anche venditore o
-- master, resta comunque amministratore.
alter table public.utenti_app
  add column if not exists amministratore boolean not null default false;

comment on column public.utenti_app.amministratore is
  'Account nominale con grado amministratore: entra come tale anche se collegato a un venditore o a una master.';

update public.utenti_app set amministratore = true where nome = 'Elena' and chiave_sistema is null;
