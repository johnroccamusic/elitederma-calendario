-- I PUNTI DI UN PRODOTTO NON CAMBIANO CON L'IVA.
--
-- Com'era: in contanti (e col buono Amazon) i punti si leggevano sul
-- LORDO invece che sul netto. Lo stesso dermografo faceva 403,28 punti
-- pagato con carta e 492,00 pagato in contanti — esattamente ×1,22.
-- Il ragionamento era "in contanti l'IVA resta in cassa, quindi il pezzo
-- rende di piu'", ma i punti dicono quanto vale un PRODOTTO, non come e'
-- stato pagato: la differenza fra i canali la fa gia' la percentuale in
-- euro di Gestione punti (15% carta, 20% contanti), e sommandosi le due
-- cose il contante valeva 1,63 volte la carta sullo stesso pezzo.
--
-- Ora si legge sempre il netto. `e_cash` resta e continua a dividere i
-- punti nei due secchi (shop/POS e cash) per la quota in euro: cambia
-- quanti punti fa un pezzo, non a quale canale vanno.
--
-- QUANTO SI SPOSTA (misurato il 15/10/2026, su tutto lo storico):
--   ANDREA PAURA       1009,86 -> 874,16   (-135,70)
--   MARTINA MEI         637,59 -> 570,09    (-67,50)
--   CHIARA COLONNELLI   510,48 -> 452,83    (-57,65)
--   PATRIZIA SAVI       385,97 -> 335,63    (-50,34)
--   ELIA CITO           724,99 -> 691,22    (-33,77)
--   TOMMASO GIUMBINI    903,99 -> 879,82    (-24,17)
-- Le altre quattro non hanno vendite in contanti e non si muovono.
--
-- Le view si riscrivono partendo dalla loro definizione attuale con una
-- sostituzione mirata, invece di ricopiarle a mano: sono lunghe
-- centinaia di righe e un refuso nel ricopiarle sarebbe invisibile. Se
-- il pezzo da sostituire non si trova, la migrazione si ferma.
do $$
declare
  def text;
  vecchio text;
  nuovo text;
begin
  -- 1. i punti del pezzo nel listino: punti_cash smette di moltiplicare per l'IVA
  def := pg_get_viewdef('v_prezzi_listini'::regclass, true);
  vecchio := 'round(p.prezzo_vendita * (1::numeric + p.iva / 100.0) * (p.sconto_pct / 100.0) * 2::numeric, 2)';
  nuovo := 'round(p.prezzo_vendita * (p.sconto_pct / 100.0) * 2::numeric, 2)';
  if position(vecchio in def) = 0 then
    raise exception 'v_prezzi_listini: non trovo la formula di punti_cash, non tocco niente';
  end if;
  execute 'create or replace view v_prezzi_listini as ' || replace(def, vecchio, nuovo);

  -- 2. i punti maturati: si legge sempre il netto
  def := pg_get_viewdef('v_punti_master_righe'::regclass, true);
  vecchio := E'CASE\n            WHEN e_cash THEN lordo_allora\n            ELSE netto_allora\n        END';
  if position(vecchio in def) = 0 then
    raise exception 'v_punti_master_righe: non trovo il CASE su e_cash, non tocco niente';
  end if;
  execute 'create or replace view v_punti_master_righe as ' || replace(def, vecchio, 'netto_allora');
end $$;
