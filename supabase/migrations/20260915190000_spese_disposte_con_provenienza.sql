-- Le spese scritte da "Disponi pagamenti" prima del 15/09/2026 non
-- portavano il nome della classe. Stesso formato di quelle nuove:
-- "Spesa - corso, citta', data"; per la quota venditori il dettaglio
-- venditore per venditore nella nota. Applicata via MCP il 15/09/2026.
update spese s set descrizione = v.descrizione, note = coalesce(v.note, s.note)
from (values
  ('abda512e-8eb2-4606-bf02-b3e1de2348c8'::uuid, 'Quota venditore - Ike, Roma, 11 set 2026', 'Andrea - 60 · Elena - 40 · Katia - 20 · Simona - 20'),
  ('c6884431-4a54-4e61-a53c-53cf0bc2ef68', 'Costo Alloggio — VILLA FIORELLI (RM), per ANDREA PAURA - Laminazione Base, Roma, 12 set 2026', null),
  ('2ced8298-f23c-4531-a8ea-680c99f74a5a', 'Costo Master — ANDREA PAURA - Laminazione Base, Roma, 12 set 2026', null),
  ('6e37cdbf-210a-4045-a7fb-e8d5950e9079', 'Quota venditore - Laminazione Base, Roma, 12 set 2026', 'Katia - 100 · Olga - 100 · Simona - 100'),
  ('3b82c352-4bfd-4e73-8eec-b23c87f31bc8', 'Commissione ricerca modelle - Pmu Base, Roma, 13–18 set 2026', null),
  ('0993cfba-2b0d-46bc-80a6-9fa2e55aff41', 'Costo Assistente — NICOLETA CAPRARU - Pmu Base, Roma, 13–18 set 2026', null),
  ('f7bbc659-1b6c-4d6f-8a27-5c33cbfdca1f', 'Costo Master — MARTINA MEI - Pmu Base, Roma, 13–18 set 2026', null),
  ('e69945ea-8e89-49d7-ac1d-239f025058e5', 'Quota venditore - Pmu Base, Roma, 13–18 set 2026', 'Simona - 675 · Olga - 650 · Katia - 200'),
  ('e2a1ac57-4717-4642-ac62-97d4fd281a70', 'Costo Master — MAURE'' ACOSTA - Sexyline Velvet Individuale, Roma, 14 set 2026', null),
  ('2289ba16-5b74-4709-800e-dcdf70094b43', 'Quota venditore - Sexyline Velvet Individuale, Roma, 14 set 2026', 'Stefano - 100')
) as v(id, descrizione, note)
where s.id = v.id and s.origine = 'automatico' and s.origine_scadenziario_chiave like 'cash\_%';
