-- La fotografia dell'iscrizione: com'era la scheda quando il venditore
-- l'ha compilata.
--
-- Serve perché la scheda allievo è un record vivo: quando l'amministrazione
-- corregge una residenza, cambia un kit o sistema un pagamento, il valore
-- di prima viene sovrascritto e non resta da nessuna parte. Il venditore
-- però deve poter rivedere quello che aveva scritto lui, e noi dobbiamo
-- poterlo confrontare con quello che è diventato.
--
-- Si scrive a ogni salvataggio fatto DA UN VENDITORE, e mai a un
-- salvataggio dell'amministrazione: così contiene sempre l'ultima versione
-- lasciata da chi ha venduto, e le nostre correzioni non la toccano.
--
-- È una copia della riga, non un riferimento: deve sopravvivere anche alle
-- modifiche dei campi che fotografa.
alter table public.iscritti
  add column if not exists snapshot_iscrizione jsonb;

comment on column public.iscritti.snapshot_iscrizione is
  'Copia congelata della scheda al momento dell''iscrizione, scritta solo dai salvataggi di un venditore. Le iscrizioni precedenti a questa colonna non ce l''hanno: per loro il riepilogo mostra la scheda attuale.';
