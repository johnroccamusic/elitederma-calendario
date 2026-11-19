-- 31/10/2026 — Passo 1 dei secchi pubblici.
-- (1) La pagina pubblica dei biglietti (?biglietti=corso/sede/data) e' stata
--     tolta: il link era indovinabile e restituiva i percorsi dei biglietti.
--     Le master li leggono dalla loro Dashboard.
revoke execute on function public.biglietti_vista(text) from public, anon, authenticated;
-- (2) I secchi con documenti e allegati riservati diventano PRIVATI. L'app li
--     apre con link a scadenza (src/file/allegati.js). Le policy `to
--     authenticated` per leggere e scrivere ci sono gia'.
--     Si applica DOPO la pubblicazione del codice che usa i link firmati.
update storage.buckets set public = false
 where id in ('allegati-iscritti', 'master-documenti', 'venditori-documenti', 'leve-assistenti-documenti');
