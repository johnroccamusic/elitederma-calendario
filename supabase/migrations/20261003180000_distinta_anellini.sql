-- Due righe storte nella distinta degli anellini.
--
-- 1) UN GIRO CHIUSO. "Anellino porta ink 1 Pz" risultava composto da 30
--    "Confezione Anellini Sterili 30 pz", e la Confezione da 30 anellini:
--    novecento anellini dentro un anellino, e un costo che non si poteva
--    risolvere perche' ognuno dei due aspettava l'altro. L'anellino e' un
--    componente che si compra: non ha distinta.
--
-- 2) IL BOX DA 10 NE CONTENEVA UNO. "Box Anellini x i Kit 10 pz" aveva in
--    distinta 1 anellino piu' la scatola. Dieci, come dice il nome.
delete from bundle_componenti bc
using prodotti_shop b, prodotti_shop c
where bc.bundle_id = b.id and bc.componente_id = c.id
  and b.nome = 'Anellino porta ink 1 Pz'
  and c.nome = 'Confezione Anellini Sterili 30 pz';

update bundle_componenti bc set quantita_per_bundle = 10
from prodotti_shop b, prodotti_shop c
where bc.bundle_id = b.id and bc.componente_id = c.id
  and b.nome = 'Box Anellini x i Kit 10 pz'
  and c.nome = 'Anellino porta ink 1 Pz';
