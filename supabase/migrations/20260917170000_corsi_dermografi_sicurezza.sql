-- Se il corso prevede la spedizione di dermografi extra "di sicurezza":
-- quelli che nessun allievo ha comprato ma che partono lo stesso, per
-- sostituire un pezzo che si guasta in aula.
--
-- Dove non servono, le righe non compaiono proprio nella scheda di
-- logistica: sono i pezzi piu' costosi del pacco e su un corso di
-- laminazione non c'entrano niente, quindi chiedere quanti mandarne e'
-- solo rumore.
--
-- Non e' prevede_dermografo, che c'era gia' e dice un'altra cosa: se gli
-- ALLIEVI di quel corso comprano un dermografo. Oggi le due liste
-- coincidono, ma restano due domande diverse: un corso potrebbe mandare
-- riserve senza che nessun allievo compri niente, o il contrario.
alter table corsi add column if not exists prevede_dermografi_sicurezza boolean default false;
comment on column corsi.prevede_dermografi_sicurezza is
  'Il corso manda dermografi di riserva. Diverso da prevede_dermografo, che dice se gli allievi ne comprano uno.';

-- I quattordici corsi indicati dal committente il 17/09/2026. Tutti gli
-- altri restano a NO e la scheda di logistica resta piu' pulita.
update corsi set prevede_dermografi_sicurezza = true
where nome in (
  'PMU BASE','PMU BASE INDIV','ELITE PMU ADV','EVOLUTION STROKES','COLORI',
  'TRICO BASE','TRICO INDIVIDUALE','NEEDLING','SEXYLINE VELVET',
  'SEXYLINE VELVET INDIVIDUALE','AIR STROKE','AIRSTROKES INDIVIDUALE','NUDE LINER',
  'AREOLART'
);
update corsi set prevede_dermografi_sicurezza = false where prevede_dermografi_sicurezza is null;
