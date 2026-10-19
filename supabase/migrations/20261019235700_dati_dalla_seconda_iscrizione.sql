-- TRACCIA. 19/10/2026.
--
-- Quattro allieve sono iscritte a DUE corsi, e il modulo di iscrizione
-- sta attaccato a una sola delle due schede: l'altra restava vuota pur
-- essendo la stessa persona.
--
-- La condizione e' strettissima apposta: si copia solo se TUTTE le
-- schede omonime che hanno i dati concordano su **una sola** email e
-- **un solo** indirizzo (`count(distinct) = 1`). Con due omonime
-- diverse non si copia niente — meglio un buco che l'indirizzo di
-- un'altra.
--
-- `_chiave_nome(testo)` normalizza nome+cognome per il confronto:
-- minuscole, accenti tolti, via tutto quello che non e' una lettera.
-- ATTENZIONE all'ordine, che la prima volta mi e' costato un giro: si
-- abbassa PRIMA e si filtra `[^a-z]` DOPO. Al contrario, il filtro si
-- porta via tutte le maiuscole, la chiave esce vuota per ogni riga e
-- quindi combacia con chiunque — il join matchava tutti con tutti e
-- sembrava funzionare.
create or replace function _chiave_nome(t text) returns text language sql immutable as $$
  select regexp_replace(translate(lower(coalesce(t,'')),
     'àáâäãèéêëìíîïòóôöõùúûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z]', '', 'g')
$$;

-- L'update, con `coalesce` che riempie solo il vuoto, non e' riportato
-- per intero: vedi 20261019235500_dati_dai_moduli_pdf.sql per la regola.
-- Risultato: 4 schede completate, senza email da 18 a 14.
