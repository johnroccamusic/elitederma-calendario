-- "Google play apps" stava fra le campagne Google solo perche' il
-- fornitore e' Google: e' l'acquisto di un'app, un canone, non
-- pubblicita'. Finche' restava li' gonfiava la spesa pubblicitaria di
-- una voce che con l'acquisizione clienti non c'entra niente.
--
-- Applicata il 10/10/2026: 1 riga, 21,30 euro.
update spese
   set categoria_id = 'servizi_internet_abbonamenti_e_licenze',
       sottocategoria_id = 'servizi_internet_abbonamenti_e_licenze__canoni_servizi_digitali',
       updated_at = now()
 where descrizione ilike 'Google play apps'
   and categoria_id = 'pubblicita_acquisizione';
