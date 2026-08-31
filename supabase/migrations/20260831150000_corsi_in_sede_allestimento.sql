-- ---------------------------------------------------------
-- I corsi che si tengono in sede centrale non si spediscono.
--
-- Per un corso a Roma le quattro fasi della spedizione — pacco preparato,
-- bolla applicata, pacco ritirato, consegna verificata — non vogliono dire
-- niente: il materiale attraversa un corridoio, non l'Italia. Restava
-- comunque lì, e per chiudere il giro bisognava fingere di aver spedito e
-- fatto rientrare un pacco che non è mai partito.
--
-- Al loro posto due soli passaggi:
--   allestito_ts        — l'aula è pronta, il materiale è uscito dal
--                         magazzino (ed è qui che lo scarico avviene)
--   inventario_sede_ts  — a corso finito si è contato cosa torna indietro
--   rientro_sede        — prodottoId -> quanti pezzi sono rientrati,
--                         la traccia di quel conteggio
-- ---------------------------------------------------------

alter table public.logistica_kit_edizioni
  add column if not exists allestito_ts timestamptz,
  add column if not exists inventario_sede_ts timestamptz,
  add column if not exists rientro_sede jsonb not null default '{}'::jsonb;

comment on column public.logistica_kit_edizioni.allestito_ts is
  'corso in sede centrale: quando l''aula è stata allestita e il materiale scaricato dal magazzino';
comment on column public.logistica_kit_edizioni.inventario_sede_ts is
  'corso in sede centrale: quando è stato fatto l''inventario di fine corso e i pezzi rimasti sono tornati in magazzino';
comment on column public.logistica_kit_edizioni.rientro_sede is
  'prodottoId -> quantità rientrata in magazzino a fine corso in sede';
