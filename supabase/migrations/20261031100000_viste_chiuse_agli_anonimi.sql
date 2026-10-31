-- Quattro viste leggibili da chiunque avesse la chiave pubblicabile (31/10/2026).
--
-- Trovato dal controllo di sicurezza: interrogate come utente anonimo,
-- v_consensi_allievi dava 273 righe con nome, cognome, email e consensi
-- degli allievi; v_prezzi_listini 194 righe con costi di acquisto e
-- margini; v_punti_master e v_punti_master_righe i punti e le vendite di
-- ogni master. Erano security definer (giravano coi permessi di chi le ha
-- create, quindi la RLS delle tabelle sotto non contava) e con SELECT
-- concesso ad anon.
--
-- Due difese insieme: niente SELECT ad anon, e security_invoker, cosi' la
-- RLS delle tabelle sotto vale anche per chi le legge da qui. Le usa solo
-- l'app con una sessione (punti master, listini, consensi) e le edge
-- function con la service role, che passa comunque. La rotta pubblica
-- ?master= non le legge: passa da master_vista.
alter view public.v_consensi_allievi set (security_invoker = on);
alter view public.v_prezzi_listini set (security_invoker = on);
alter view public.v_punti_master set (security_invoker = on);
alter view public.v_punti_master_righe set (security_invoker = on);

revoke select on public.v_consensi_allievi from anon;
revoke select on public.v_prezzi_listini from anon;
revoke select on public.v_punti_master from anon;
revoke select on public.v_punti_master_righe from anon;
-- le altre quattro viste di quel gruppo erano gia' security_invoker, ma
-- ad anon il SELECT era concesso lo stesso: stessa chiusura
revoke select on public.v_punti_codici_scoperti from anon;
revoke select on public.v_punti_master_stagioni from anon;
revoke select on public.woo_coupon_con_utilizzi from anon;
revoke select on public.woo_ordini_con_codice from anon;
