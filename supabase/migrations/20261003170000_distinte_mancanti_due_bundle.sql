-- Due bundle senza distinta: senza componenti il costo non si ricava, e
-- senza costo non c'e' sconto massimo ne' punti. I componenti erano
-- deducibili con certezza, non indovinati:
--
--  - "Starter Kit 3 Colori Lips Proomix": il bundle "Mix 3 colori Eyebrows
--    & 3 colori Lips" contiene sei pigmenti, e "Starter Kit 3 Colori
--    Eyebrows" ne contiene tre (Arizona, Nairobi, Tokyo). I tre Lips sono
--    quelli che restano: Blush, Dark Cherry, Pink Orange. 3 x 10 = 30 EUR.
--  - "Brush Ciglia Microfibra Elitederma - 15pz": quindici volte il brush
--    singolo, che costa 0,01. 0,15 EUR.
--
-- Entrambi ora si comportano come i loro gemelli gia' configurati: stock
-- proprio sul bundle e distinta per il costo.
insert into bundle_componenti (bundle_id, componente_id, quantita_per_bundle)
select b.id, c.id, q.qta
from (values
  ('Starter Kit 3 Colori Lips Proomix', 'Blush pigmento Proomix', 1),
  ('Starter Kit 3 Colori Lips Proomix', 'Dark Cherry pigmento Proomix', 1),
  ('Starter Kit 3 Colori Lips Proomix', 'Pink Orange pigmento Proomix', 1),
  ('Brush Ciglia Microfibra Elitederma - 15pz', 'Brush Ciglia Microfibra Elitederma', 15)
) as q(bundle, componente, qta)
join prodotti_shop b on b.nome = q.bundle
join prodotti_shop c on c.nome = q.componente
where not exists (select 1 from bundle_componenti x where x.bundle_id = b.id and x.componente_id = c.id);
