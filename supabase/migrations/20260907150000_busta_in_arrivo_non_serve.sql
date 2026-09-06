-- Il passo intermedio non serviva. Se il corso e' chiuso la busta e' per
-- forza in viaggio: comparire nella lista "Contabilita' di ritorno" lo dice
-- gia', e chiedere di spuntarlo a mano era far confermare una cosa nota.
-- Resta il solo passo che conta, "Ok, busta in cassa", che scrive
-- busta_rientrata_il.
--
-- La colonna non si cancella: un DROP su produzione non si fa per
-- risparmiare un booleano, e nessuno la scrive piu'. Se un giorno servira'
-- di nuovo distinguere "partita" da "ancora da spedire", e' gia' qui.
comment on column public.corsi_date.busta_in_arrivo is
  'NON PIÙ USATA dal 7 settembre 2026: il passo "in arrivo" è stato tolto, un corso chiuso implica già la busta in viaggio. Resta la sola busta_rientrata_il.';
