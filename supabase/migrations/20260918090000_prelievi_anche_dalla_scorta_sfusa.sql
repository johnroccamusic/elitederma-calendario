-- Un pezzo si prende anche dalla scorta sfusa, non solo da un kit.
--
-- Il materiale extra spedito al corso — accessori in piu', merce da
-- vendere, dermografi di riserva — non sta dentro nessun kit: fin qui un
-- prelievo da li' non era scrivibile, perche' kit_riserva_id era
-- obbligatorio. Ora la riga dice da dove viene il pezzo: da un kit
-- (kit_riserva_id) oppure da una riga della spedizione (spedizione_riga_id).
--
-- Le tabelle del modulo sono vuote — zero righe — quindi allentare il
-- vincolo non tocca nessun dato.
alter table prelievi_kit_riserva alter column kit_riserva_id drop not null;
alter table prelievi_kit_riserva add column if not exists spedizione_riga_id uuid references spedizione_righe(id) on delete cascade;
alter table prelievi_kit_riserva drop constraint if exists prelievo_ha_una_provenienza;
alter table prelievi_kit_riserva add constraint prelievo_ha_una_provenienza
  check (kit_riserva_id is not null or spedizione_riga_id is not null);
create index if not exists idx_prelievi_kit_riserva_riga on prelievi_kit_riserva(spedizione_riga_id);
comment on column prelievi_kit_riserva.spedizione_riga_id is
  'Da quale riga della spedizione esce il pezzo, quando non viene da un kit di riserva ma dal materiale sfuso partito con il pacco.';

alter table sostituzioni add column if not exists spedizione_riga_id uuid references spedizione_righe(id) on delete cascade;
comment on column sostituzioni.spedizione_riga_id is
  'La riga di spedizione da cui esce il pezzo prelevato, quando non viene da un kit di riserva.';
