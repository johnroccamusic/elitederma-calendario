-- recesso_registra e modulo_riaperto non sono per il browser (31/10/2026).
--
-- La migrazione del recesso (20261017170000) e il commento di
-- supabase/functions/modulo-recesso diceva "eseguibile SOLO da
-- service_role": sul database vivo invece anon e authenticated avevano
-- EXECUTE (i grant di default di Supabase su public). Chi aveva il gettone
-- del recesso poteva chiamare la funzione con la chiave pubblicabile e
-- sciogliere il contratto SENZA ricevuta all'allieva e SENZA gli avvisi a
-- PEC e amministrazione, che partono dalla edge function; e la funzione
-- gli restituiva anche email, tutor ed email dell'amministrazione.
--
-- L'unico chiamante e' modulo-recesso, con la service role. Tolto il
-- resto. modulo_riaperto era un oracolo ("questa iscrizione e' riaperta?")
-- chiamabile da anon con il solo uuid: la usano solo modulo_vista e
-- modulo_salva, che sono security definer e non ne hanno bisogno.
revoke execute on function public.recesso_registra(text, text, text, text) from public, anon, authenticated;
grant execute on function public.recesso_registra(text, text, text, text) to service_role;
revoke execute on function public.modulo_riaperto(uuid) from public, anon, authenticated;
grant execute on function public.modulo_riaperto(uuid) to service_role;
