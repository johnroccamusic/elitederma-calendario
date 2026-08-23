-- "Corso parziale": giorni/turni del corso in cui l'iscritta è
-- fisicamente presente. NULL/vuoto = presente tutti i giorni (comportamento
-- di sempre, nessuna rottura per chi non attiva mai questo flag) — solo
-- quando il venditore spunta "Corso parziale" nella scheda si valorizza,
-- un elemento per ogni giorno del corso: { numero_giorno, mattina, pomeriggio }.
-- Usato da Assegna Modelle per non elencare un'iscritta come "da trovare"
-- in un giorno in cui non è nemmeno presente.
alter table iscritti add column if not exists giorni_presenza jsonb;
