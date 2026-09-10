-- A.C.M. — Accesso Contabilita' Master.
--
-- Il tasto "Contabilita' Classe" nella dashboard della master compariva da
-- solo il giorno prima del corso, e restava li'. Ma quella pagina mostra
-- quanto ha pagato ogni allievo: e' l'ufficio a decidere quando la master
-- puo' vederla, edizione per edizione — non il calendario.
--
-- Questo interruttore lo accende. Si spegne da solo alla fine del corso:
-- non serve un lavoro notturno che passi a chiudere gli interruttori
-- rimasti aperti, basta non considerarlo piu' valido dopo data_fine. Un
-- permesso che scade da se' non si dimentica acceso.
alter table public.corsi_date
  add column if not exists acm_attivo boolean not null default false;

comment on column public.corsi_date.acm_attivo is
  'A.C.M. — accesso della master alla contabilita'' di questa classe. Vale solo fino a data_fine compresa: dopo, il tasto sparisce da solo anche se il valore e'' rimasto true.';
