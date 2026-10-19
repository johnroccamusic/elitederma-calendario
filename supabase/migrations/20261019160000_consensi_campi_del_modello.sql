-- I CAMPI CHE UN SINGOLO CONSENSO CHIEDE IN PIU'.
--
-- Il questionario sa fare una cosa sola: sì o no, piu' un campo libero
-- che compare sul sì. Va bene per «Diabete», non per «quale intervento
-- ha subito e quando» — li' il sì e' scontato (si sta pigmentando
-- un'areola: o c'e' stata una mastectomia o una mastoplastica) e cio'
-- che serve davvero e' la riga che la persona scrive.
--
-- Chiesto come domanda sì/no, quel dato sembrava impossibile da dare:
-- l'aiuto diceva «Quale intervento e in che mese e anno» e sotto
-- c'erano due bottoni, senza nessuna casella in cui scriverlo — la
-- casella arriva solo dopo aver premuto SÌ, e chi guarda non lo sa.
--
-- Da adesso un modello puo' dichiarare campi suoi, e le risposte stanno
-- qui: { "intervento": "mastoplastica additiva, marzo 2024" }. La
-- colonna nasce libera — i consensi gia' raccolti non ne hanno.
alter table public.consensi_modelle
  add column if not exists campi_extra jsonb;

comment on column public.consensi_modelle.campi_extra is
  'Le risposte ai campi che il singolo modello dichiara in piu'' (es. quale intervento al seno e quando).';
