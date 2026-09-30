-- Le impostazioni dei testi sul diploma sono UNA cosa sola, non un elenco.
--
-- Il 31/07/2026 ne sono nate due a undici secondi di distanza: il
-- salvataggio inseriva quando non aveva ancora in mano l'id della riga,
-- e due salvataggi vicini ne hanno create due. Da li' il caricamento —
-- che chiedeva "una riga qualsiasi" — ne leggeva ora l'una ora l'altra,
-- e i limiti della firma sparivano e tornavano da soli.
--
-- Questo indice non lascia piu' che succeda: un secondo inserimento
-- viene rifiutato dal database, non dalla buona volonta' di chi scrive
-- il codice.
create unique index if not exists font_diplomi_riga_unica on font_diplomi ((true));

comment on index font_diplomi_riga_unica is
  'Una riga sola: queste sono le impostazioni dei diplomi, non un elenco. Vedi il doppione del 31/07/2026.';
