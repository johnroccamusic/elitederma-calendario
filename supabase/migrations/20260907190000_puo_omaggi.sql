-- L'omaggio sul POS era riservato ad amministratore e programmatore, con
-- lo sconto libero: sono tutti e due modi di decidere quanto entra in
-- cassa. Ma le due cose non pesano uguale — l'omaggio e' tracciato,
-- obbliga a scrivere il perche' e si vede in "Omaggi", lo sconto libero e'
-- una cifra scritta al momento.
--
-- Quindi l'omaggio si puo' concedere a chi serve senza dargli il grado di
-- amministratore, che sbloccherebbe schede iscritto, contabilita' e
-- riepilogo amministrativo. Acceso su Raffaele.
alter table public.utenti_app
  add column if not exists puo_omaggi boolean not null default false;

comment on column public.utenti_app.puo_omaggi is
  'Può spuntare "Omaggio" sul POS senza essere amministratore. Non dà lo sconto libero: quello resta ad amministratore e programmatore.';

update public.utenti_app set puo_omaggi = true where nome ilike 'raffaele';
