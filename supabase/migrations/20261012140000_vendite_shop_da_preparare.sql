-- "Ritira adesso": la vendita al banco va in logistica da preparare,
-- nello stesso elenco degli ordini dello shop online. Serve quando la
-- merce non passa di mano li' per li'.
--
-- Fino a oggi ci finivano da sole solo le vendite di una sede centrale.
-- Quella regola resta: questa colonna e' il modo di chiederlo a mano su
-- qualunque altra vendita.
--
-- Applicata il 12/10/2026.
alter table vendite_shop add column if not exists da_preparare boolean not null default false;
