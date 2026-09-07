-- Il listino di un hotel non e' un prezzo per stanza: e' un prezzo per
-- stanza E per giorno della settimana. Lo stesso albergo chiede 80 euro
-- dal lunedi' al mercoledi', 100 dal giovedi' al sabato e 130 la domenica,
-- e finora quei tre numeri non avevano dove stare — se ne poteva scrivere
-- uno solo e gli altri due si perdevano.
--
-- Quindi una riga di hotel_prezzi smette di essere "il prezzo della
-- singola" e diventa "una fascia della singola": ha un nome, i giorni in
-- cui vale e la sua posizione nell'elenco. Piu' righe per la stessa stanza
-- sono ora la norma, non un errore — e infatti non c'era nessun vincolo di
-- unicita' da togliere.
alter table public.hotel_prezzi
  add column if not exists nome text,
  add column if not exists giorni smallint[] not null default '{1,2,3,4,5,6,7}',
  add column if not exists ordine smallint not null default 1;

update public.hotel_prezzi set nome = 'Fascia 1' where nome is null;

comment on column public.hotel_prezzi.giorni is
  'Giorni della settimana in cui vale questa fascia: 1 = lunedì … 7 = domenica.';
comment on column public.hotel_prezzi.ordine is
  'Posizione della fascia dentro la stanza: la prima scritta resta la prima mostrata.';
