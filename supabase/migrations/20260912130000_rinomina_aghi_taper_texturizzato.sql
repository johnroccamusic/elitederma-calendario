-- Aghi: nel NOME la misura passa subito dopo il tipo, le sigle restano
-- ("Ago 1RL LT - 0,25 - Box 20 pz" -> "Ago 1RL 0,25 LT - Box 20 pz");
-- nella DESCRIZIONE BREVE va la forma per esteso
-- ("Ago 1RL 0,25 Long taper Texturizzato - Box 20 pz"); ai texturizzati
-- anche la nuova descrizione completa. Dodici prodotti decisi per id.
--
-- Nove stanno anche su WooCommerce: per quelli passare PRIMA dallo script
-- rinomina-aghi-woo.sh, che scrive sul sito e in locale insieme. Questo
-- SQL serve per i tre "ago singolo" che vivono solo nel gestionale; sugli
-- altri nove riscrive gli stessi valori. Idempotente.
with nuovi(id, nome, breve, texturizzato) as (values
  ('87cdface-ccf2-4ad0-b644-f05db7e1ba79'::uuid, 'Ago 1RL 0,25 LT - Box 20 pz', '<p>Ago 1RL 0,25 Long taper - Box 20 pz</p>', false),
  ('0fd61d06-e8c2-4353-b83a-9d11f0ab11a9', 'Ago 1RL 0,25 LT-T - Box 20 pz', '<p>Ago 1RL 0,25 Long taper Texturizzato - Box 20 pz</p>', true),
  ('07602688-2ddf-4889-a783-c62ce9da63af', 'Ago 1RL 0,30 LT-T - Box 20 pz', '<p>Ago 1RL 0,30 Long taper Texturizzato - Box 20 pz</p>', true),
  ('1f004145-80d0-4611-8b69-af01ba8f9626', 'Ago 1RL 0,30 MT - Box 20 pz', '<p>Ago 1RL 0,30 Medium taper - Box 20 pz</p>', false),
  ('1dbcc680-685c-4dfc-a8f2-65798642ebc4', 'Ago 1RL 0,30 MT - ago singolo', '<p>Ago 1RL 0,30 Medium taper - ago singolo</p>', false),
  ('2594d212-3281-4137-bc40-84d85ce8d3ea', 'Ago 1RL 0,25 MT-T - Box 20 pz', '<p>Ago 1RL 0,25 Medium taper Texturizzato - Box 20 pz</p>', true),
  ('cfef8c41-15da-43f7-a099-0e218eefc1f3', 'Ago 1RL 0,30 MT-T - Box 20 pz', '<p>Ago 1RL 0,30 Medium taper Texturizzato - Box 20 pz</p>', true),
  ('e6379f20-8ead-4186-80d2-4bc0782a2a34', 'Ago 3RL 0,25 LT - Box 20 pz', '<p>Ago 3RL 0,25 Long taper - Box 20 pz</p>', false),
  ('79d37ed3-68ff-4425-ae4e-96e5439109ec', 'Ago 3RL 0,25 LT - ago singolo', '<p>Ago 3RL 0,25 Long taper - ago singolo</p>', false),
  ('04f77096-b0be-44cd-91b3-e93f75c4effa', 'Ago 3RL 0,30 LT-T - Box 20 pz', '<p>Ago 3RL 0,30 Long taper Texturizzato - Box 20 pz</p>', true),
  ('e9dd4d10-479c-4676-a319-a28a5bcaaece', 'Ago 7 Magnum 0,35 LT-T - ago singolo', '<p>Ago 7 Magnum 0,35 Long taper Texturizzato - ago singolo</p>', true),
  ('73f3e55c-2817-4ecf-b1dc-94e46efa9669', 'Ago 7 Magnum 0,35 LT-T - Box 20 pz', '<p>Ago 7 Magnum 0,35 Long taper Texturizzato - Box 20 pz</p>', true)
)
update prodotti_shop p
set nome = n.nome,
    descrizione_breve = n.breve,
    descrizione = case when n.texturizzato
      then '<p>Ago da dermopigmentazione ad alte performance texturizzato. La texturizzazione è una particolare lavorazione della superficie dell''ago che consente allo stesso di trattenere e veicolare in modo più efficiente il pigmento nella pelle.</p>'
      else p.descrizione end
from nuovi n
where p.id = n.id;
