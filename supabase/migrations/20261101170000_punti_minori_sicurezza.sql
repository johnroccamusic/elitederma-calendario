-- Punti minori del controllo di sicurezza (01/11/2026).
--
-- 1) search_path fisso sulle 13 funzioni che non lo avevano. Si fissa lo stesso
--    percorso che il database usava gia' (public, extensions) piu' pg_temp in
--    fondo: il comportamento non cambia, ma un oggetto con lo stesso nome in un
--    altro schema non puo' piu' prendere il posto di uno vero. gettone_sicuro
--    usa gen_random_bytes, che sta nello schema extensions.
-- 2) Quattro indici doppi su crm_contatti: si tiene quello con il nome nudo.
-- 3) Due funzioni trigger non erano richiamabili in modo utile, ma anon e
--    authenticated avevano EXECUTE: revocato (un trigger non lo richiede per
--    scattare).

alter function public._cf_controllo(text) set search_path = public, extensions, pg_temp;
alter function public._chiave_nome(text) set search_path = public, extensions, pg_temp;
alter function public.aggiorna_quote_coordinatore(numeric) set search_path = public, extensions, pg_temp;
alter function public.archivio_testi_non_si_tocca() set search_path = public, extensions, pg_temp;
alter function public.completa_not_null(regclass, jsonb) set search_path = public, extensions, pg_temp;
alter function public.gettone_modulo() set search_path = public, extensions, pg_temp;
alter function public.gettone_sicuro() set search_path = public, extensions, pg_temp;
alter function public.modulo_campo_bloccato(text, text, boolean) set search_path = public, extensions, pg_temp;
alter function public.modulo_campo_bloccato(text, text) set search_path = public, extensions, pg_temp;
alter function public.recesso_importo(public.iscritti) set search_path = public, extensions, pg_temp;
alter function public.recesso_non_si_tocca() set search_path = public, extensions, pg_temp;
alter function public.registra_vendita_da_pagamento(text, boolean) set search_path = public, extensions, pg_temp;
alter function public.registra_vendita_pos(jsonb, jsonb) set search_path = public, extensions, pg_temp;
alter function public.stagione_punti(timestamptz) set search_path = public, extensions, pg_temp;

drop index if exists public.crm_contatti_provincia_idx;
drop index if exists public.crm_contatti_qualifica_idx;
drop index if exists public.crm_contatti_regione_idx;
drop index if exists public.crm_contatti_trattato_da_idx;

revoke execute on function public.movimenti_banca_spesa_cancellata() from public, anon, authenticated;
revoke execute on function public.riapri_impegno_se_spesa_cancellata() from public, anon, authenticated;
