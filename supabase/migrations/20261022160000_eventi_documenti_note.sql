-- Cosa e' il documento e una nota, scritte PRIMA di caricarlo
-- (22/10/2026). Finora il nome arrivava dal file — «WhatsApp Image
-- 2026-10-22 at 11.04.jpeg» — e si correggeva dopo; una nota non
-- c'era proprio.
alter table eventi_documenti add column if not exists note text;
comment on column eventi_documenti.note is 'Nota libera di chi ha caricato il documento: a cosa serve, scadenze, a chi va mostrato.';
