-- Chi reperisce le modelle, e quanto vale.
--
-- "gestione_modelle" dice chi compare nella tendina accanto al trattamento;
-- "quota_reperimento" quanto vale una modella trovata da quella persona.
-- Sono due cose diverse di proposito: John compare in elenco perché anche
-- lui inserisce modelle, ma la sua quota è zero e non genera costo. Con un
-- flag solo avremmo dovuto scrivere il suo nome nel codice come eccezione.
--
-- L'importo sta sulla persona e non nel programma: se domani la quota passa
-- a 35, o se una seconda persona vale un'altra cifra, si cambia da
-- interfaccia.
alter table public.master
  add column if not exists gestione_modelle boolean not null default false,
  add column if not exists quota_reperimento numeric not null default 0;

alter table public.venditori
  add column if not exists gestione_modelle boolean not null default false,
  add column if not exists quota_reperimento numeric not null default 0;

alter table public.utenti_app
  add column if not exists gestione_modelle boolean not null default false,
  add column if not exists quota_reperimento numeric not null default 0;

update public.master set gestione_modelle = true, quota_reperimento = 30 where nome ilike 'ANDREA PAURA';
update public.venditori set gestione_modelle = true, quota_reperimento = 30 where nome ilike 'ANDREA';
update public.utenti_app set gestione_modelle = true, quota_reperimento = 0 where chiave_sistema = '__programmatore';
