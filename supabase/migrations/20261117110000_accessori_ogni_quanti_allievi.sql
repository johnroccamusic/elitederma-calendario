-- «1 pezzo ogni N allievi» sugli accessori didattica del corso
-- (17/11/2026, chiesto dal titolare: «1 specchio ogni 4 allievi; se ci
-- sono 5 allievi, al quinto saranno 2 specchi da inviare»).
--
-- corsi_kit_prodotti.quantita resta quello che e': i pezzi. La colonna
-- nuova dice se quei pezzi sono per corso (vuota, com'e' stato finora per
-- tutte le righe) o per ogni gruppo di N allievi. Il conto lo fa l'app
-- (quantitaAccessorio in src/rientri/composizione.ts):
--   quantita * ceil(allievi / ogni_allievi)
-- Nessuna riga esistente cambia: nascono tutte vuote.

alter table public.corsi_kit_prodotti
  add column if not exists ogni_allievi integer;

alter table public.corsi_kit_prodotti
  drop constraint if exists corsi_kit_prodotti_ogni_allievi_positivo;
alter table public.corsi_kit_prodotti
  add constraint corsi_kit_prodotti_ogni_allievi_positivo
  check (ogni_allievi is null or ogni_allievi > 0);

comment on column public.corsi_kit_prodotti.ogni_allievi is
  'Accessori didattica: quantita vale per ogni gruppo di N allievi (gruppo iniziato = intero). Null = quantita fissa per corso.';

-- rollback:
--   alter table public.corsi_kit_prodotti drop constraint if exists corsi_kit_prodotti_ogni_allievi_positivo;
--   alter table public.corsi_kit_prodotti drop column if exists ogni_allievi;
