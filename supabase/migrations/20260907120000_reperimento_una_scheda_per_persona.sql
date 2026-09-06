-- Andrea ha due schede: master "ANDREA PAURA" e venditore "ANDREA". Con il
-- flag su tutte e due comparirebbe due volte nella tendina "Reperita da", e
-- con due nomi diversi — chi inserisce non saprebbe quale scegliere, e le
-- attribuzioni finirebbero divise fra due id per la stessa persona.
--
-- Si tiene la scheda master: e' quella gia' scritta sulle modelle esistenti
-- (vedi 20260907001000). Il flag si rimette da interfaccia se serve.
update public.venditori set gestione_modelle = false where nome ilike 'ANDREA';
