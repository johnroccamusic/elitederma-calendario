-- Applicata via MCP il 06/10/2026.
--
-- "Non considerare nell'Advisor": un prodotto che sta a zero e ci resta
-- per scelta — il lettino, il camice, l'espositore — non e' una cosa da
-- ordinare, e in mezzo agli avvisi e' solo rumore che fa smettere di
-- leggerli. La spunta lo toglie dagli avvisi di scorta finche' resta
-- accesa, e si accende da due posti: dalla scheda del prodotto e dalla
-- riga stessa dell'Advisor, che e' dove uno se ne accorge.
alter table prodotti_shop
  add column if not exists escludi_da_advisor boolean not null default false;

comment on column prodotti_shop.escludi_da_advisor is
  'Toglie il prodotto dagli avvisi di scorta dell''Advisor. Non lo toglie dai prodotti che bloccano un corso: quelli hanno una data.';
