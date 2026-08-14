-- ---------------------------------------------------------
-- Target Venditori: oltre a incasso/prodotto/combinato (vendita
-- prodotti, silo separato), ora un target può anche riguardare i corsi
-- venduti (iscrizioni chiuse dal venditore, per valore di
-- "totale_pattuito" nel periodo del target):
--   'corsi_denaro' — soglia_incasso è un importo in euro
--   'corsi_punti'  — soglia_incasso è un numero di punti, dove
--                    1 punto = 100€ di valore di corso venduto
--                    (es. un corso da 590€ vale 5,9 punti)
-- Questi due tipi si possono assegnare solo ai venditori (i master non
-- vendono corsi), quindi non serve nessuna nuova colonna: bastano i due
-- nuovi valori ammessi in tipo_target — la colonna soglia_incasso resta
-- l'unica soglia numerica, letta in euro o in punti secondo il tipo.
-- ---------------------------------------------------------
alter table public.target_vendite_prodotti drop constraint if exists target_vendite_prodotti_tipo_target_check;
alter table public.target_vendite_prodotti add constraint target_vendite_prodotti_tipo_target_check
  check (tipo_target in ('incasso','prodotto','combinato','corsi_denaro','corsi_punti'));

notify pgrst, 'reload schema';
