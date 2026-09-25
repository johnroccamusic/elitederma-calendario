-- Sei corsi hanno la tariffa della sede scritta a zero.
--
-- Non e' una scelta: e' quello che resta quando qualcuno svuota le due
-- caselle di "Gestisci sede" e salva. Zero pero' e' un numero, e il
-- conto lo prendeva sul serio: la sede finiva a costo zero senza che
-- nessuno lo avesse deciso, e da quando c'e' il listino per giorni
-- impediva anche a quello di entrare in gioco (la cifra sul corso vince
-- sempre sul listino).
--
-- Qui tornano vuote: il corso ricade sul listino della sede, o sulla
-- sua tariffa unica, come se nessuno avesse mai scritto niente. Una
-- sede davvero gratis resta un'altra cosa: si chiama "sede centrale" e
-- passa da un'altra strada.
update corsi_date
set costo_giorno_sede_cash = null,
    costo_giorno_sede_bonifico = null
where coalesce(costo_giorno_sede_cash, 0) = 0
  and coalesce(costo_giorno_sede_bonifico, 0) = 0
  and (costo_giorno_sede_cash is not null or costo_giorno_sede_bonifico is not null);
