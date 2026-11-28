-- CHI HA LIQUIDATO IL MESE (28/11/2026).
--
-- Trovato guardando la pagina delle commissioni dopo l'allarme sulla
-- quota coordinatore: i tasti «Liquida» e «Riapri» non avevano NESSUN
-- controllo — li poteva premere qualunque venditore che aprisse quella
-- linguetta, e sono quattordici — e la riga che nasceva non diceva chi
-- avesse premuto.
--
-- Liquidare non e' una spunta: congela un importo e dichiara che quel
-- mese e' stato pagato. Dal 28/11 i due tasti sono di chi amministra
-- (programmatore o amministratore) e la riga porta il nome di chi li
-- ha premuti, che lo storico mostra accanto alla data.
--
-- Deciso dal titolare, messo davanti alle tre strade: «Solo chi
-- amministra, e si firma».
--
-- In archivio la tabella e' VUOTA (zero righe, misurato prima di
-- toccare): nessuno l'ha mai premuto, quindi non c'e' nessuna riga
-- vecchia da attribuire a qualcuno — e una firma messa «per coerenza»
-- su una liquidazione che non e' mai avvenuta sarebbe un fatto
-- inventato.

alter table commissioni_corsi_liquidazioni
  add column if not exists liquidato_da text;

comment on column commissioni_corsi_liquidazioni.liquidato_da is
  'Chi ha premuto «Liquida»: il nome dell''operatore collegato. Nullo sulle righe nate prima del 28/11/2026, che in archivio non ci sono.';

-- ROLLBACK (si perde la traccia di chi ha liquidato; il cancello sul
-- ruolo resta, perche' vive nel codice)
--
-- alter table commissioni_corsi_liquidazioni drop column if exists liquidato_da;
