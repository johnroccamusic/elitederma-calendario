-- PRIVATO O AZIENDA, al posto della spunta "Richiede fattura".
--
-- La spunta diceva che la fattura serviva, non a chi intestarla. Adesso
-- e' una scelta fra due: `privato` (nessun dato di fatturazione da
-- chiedere) e `azienda` (e allora servono tutti, o la fattura non si
-- emette).
--
-- `richiede_fattura` RESTA e si tiene allineata (azienda = true). La
-- leggono in diciassette punti, compreso lo scorporo dell'IVA sui
-- contanti: toglierla per rifare la stessa cosa con un altro nome
-- avrebbe voluto dire rimettere mano a tutta la contabilita' per un
-- cambio di etichetta.
alter table public.iscritti
  add column if not exists tipo_cliente text not null default 'privato';

alter table public.iscritti drop constraint if exists iscritti_tipo_cliente_check;
alter table public.iscritti add constraint iscritti_tipo_cliente_check
  check (tipo_cliente in ('privato', 'azienda'));

-- Lo storico: chi aveva la spunta diventa azienda (24 su 254).
--   update public.iscritti set tipo_cliente = 'azienda' where richiede_fattura;
