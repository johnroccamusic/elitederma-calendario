-- ---------------------------------------------------------
-- `vendite_shop_reparti` era rimasta SECURITY DEFINER (19/11/2026)
--
-- Trovato dall'Advisor nel controllo di fine giornata, livello ERROR.
-- Una vista SECURITY DEFINER legge con i permessi e la RLS di CHI L'HA
-- CREATA, non di chi interroga. Il 31/10/2026 tutte le viste del
-- progetto sono passate a `security_invoker`; questa e' stata rifatta il
-- 18/11 — il lavoro sugli ordini non pagati — e ha perso l'opzione per
-- strada.
--
-- Da fuori non si leggeva comunque, perche' non ha nessun grant ad
-- `anon` (provato con la chiave pubblicabile: 401). Quindi non c'era una
-- falla aperta: c'era una vista che non rispettava la regola delle altre
-- otto, ed e' il modo in cui una falla nasce il giorno che qualcuno le
-- concede una lettura.
--
-- Chi la legge continua a leggerla: `crm_contatti_filtrati` gira come
-- chi chiama (`authenticated`, che su `vendite_shop` ha accesso) e
-- `crm_sincronizza_clienti_shop` e' security definer, quindi gira come
-- il proprietario. Misurato prima e dopo, identico: 5.302 righe nella
-- vista e 1.756 contatti dal filtro `cliente_shop`.
-- ---------------------------------------------------------

alter view public.vendite_shop_reparti set (security_invoker = true);

-- ROLLBACK
--   alter view public.vendite_shop_reparti reset (security_invoker);
