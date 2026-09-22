-- Stipendi e contributi non sono spese con IVA: sono uscite fiscali o
-- contributive, e l'importo vale per intero. Segnarle con "Importo
-- esente IVA" le faceva sembrare acquisti esenti, che e' un'altra cosa:
-- un acquisto esente resta un acquisto, uno stipendio no.
--
-- Vuoto = spesa normale, con o senza IVA. 'stipendi' e 'contributi'
-- forzano l'esenzione e dicono che natura ha l'uscita.
alter table spese
  add column if not exists natura_fiscale text;

alter table spese
  drop constraint if exists spese_natura_fiscale_valida;
alter table spese
  add constraint spese_natura_fiscale_valida
  check (natura_fiscale is null or natura_fiscale in ('stipendi', 'contributi'));

comment on column spese.natura_fiscale is
  'Vuoto = spesa normale. stipendi/contributi: uscita fiscale o contributiva, sempre senza IVA, l''importo vale per intero.';
