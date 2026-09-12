-- Aghi: la misura subito dopo il tipo, le sigle per esteso.
--
--   "Ago 1RL LT - 0,25 - Box 20 pz"  ->  "Ago 1RL 0,25 Long taper - Box 20 pz"
--   LT = Long taper, MT = Medium taper, il suffisso -T = Texturizzato.
--
-- Ai texturizzati si riscrive anche la descrizione completa. I nomi sono
-- decisi uno a uno per id, non con una regola: sono dodici prodotti e una
-- regex sbagliata su un catalogo pubblicato costa piu' di dodici righe.
--
-- ATTENZIONE: dieci di questi prodotti stanno anche su WooCommerce. Questo
-- script tocca solo il gestionale. Perche' il sito riceva il nuovo nome
-- bisogna poi aprire la scheda di ciascuno e premere Salva (l'app manda a
-- WooCommerce nome e descrizione). Fino ad allora NON lanciare
-- "Sincronizza catalogo da WooCommerce": riporterebbe i nomi vecchi.
--
-- Idempotente: rieseguito riscrive gli stessi valori.
with nuovi(id, nome, texturizzato) as (values
  ('87cdface-ccf2-4ad0-b644-f05db7e1ba79'::uuid, 'Ago 1RL 0,25 Long taper - Box 20 pz', false),
  ('0fd61d06-e8c2-4353-b83a-9d11f0ab11a9', 'Ago 1RL 0,25 Long taper Texturizzato - Box 20 pz', true),
  ('07602688-2ddf-4889-a783-c62ce9da63af', 'Ago 1RL 0,30 Long taper Texturizzato - Box 20 pz', true),
  ('1f004145-80d0-4611-8b69-af01ba8f9626', 'Ago 1RL 0,30 Medium taper - Box 20 pz', false),
  ('1dbcc680-685c-4dfc-a8f2-65798642ebc4', 'Ago 1RL 0,30 Medium taper - ago singolo', false),
  ('2594d212-3281-4137-bc40-84d85ce8d3ea', 'Ago 1RL 0,25 Medium taper Texturizzato - Box 20 pz', true),
  ('cfef8c41-15da-43f7-a099-0e218eefc1f3', 'Ago 1RL 0,30 Medium taper Texturizzato - Box 20 pz', true),
  ('e6379f20-8ead-4186-80d2-4bc0782a2a34', 'Ago 3RL 0,25 Long taper - Box 20 pz', false),
  ('79d37ed3-68ff-4425-ae4e-96e5439109ec', 'Ago 3RL 0,25 Long taper - ago singolo', false),
  ('04f77096-b0be-44cd-91b3-e93f75c4effa', 'Ago 3RL 0,30 Long taper Texturizzato - Box 20 pz', true),
  ('e9dd4d10-479c-4676-a319-a28a5bcaaece', 'Ago 7 Magnum 0,35 Long taper Texturizzato - ago singolo', true),
  ('73f3e55c-2817-4ecf-b1dc-94e46efa9669', 'Ago 7 Magnum 0,35 Long taper Texturizzato - Box 20 pz', true)
)
update prodotti_shop p
set nome = n.nome,
    descrizione = case when n.texturizzato
      then '<p>Ago da dermopigmentazione ad alte performance texturizzato. La texturizzazione è una particolare lavorazione della superficie dell''ago che consente allo stesso di trattenere e veicolare in modo più efficiente il pigmento nella pelle.</p>'
      else p.descrizione end
from nuovi n
where p.id = n.id;
