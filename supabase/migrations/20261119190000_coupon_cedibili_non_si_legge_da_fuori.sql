-- ---------------------------------------------------------
-- `coupon_cedibili()` si leggeva con la chiave del bundle (19/11/2026)
--
-- Trovato dal controllo di fine giornata, ed e' un difetto mio di oggi.
-- La funzione era eseguibile da `anon`: con la sola chiave pubblicabile
-- — che sta nel bundle servito a tutti — si leggeva quanto sconto si
-- puo' cedere su ognuno dei 195 prodotti. Non i costi, ma la leva
-- commerciale: il margine disponibile prodotto per prodotto.
--
-- PERCHE' LA REVOCA DELLA MIGRAZIONE 20261119180000 NON BASTAVA, ed e'
-- la trappola gia' scritta nel § del controllo del 31/10: i grant di
-- default di Supabase su `public` danno EXECUTE ad `anon`
-- DIRETTAMENTE, non tramite PUBLIC. `revoke all ... from public` non li
-- tocca. Va revocato per nome.
--
-- E va rifatto DOPO OGNI `drop function`: il create che segue si
-- riprende i grant di default. E' per questo che era tornato — la
-- gemella 20261119181000 ha fatto drop e create per cambiare il tipo di
-- ritorno.
--
-- La regola che resta: una funzione riservata non e' riservata perche'
-- la migrazione lo dichiara. Si rilegge `pg_proc.proacl` sul database
-- vivo, e si prova da fuori con la chiave pubblicabile.
-- Provato dopo: 401, «permission denied for function coupon_cedibili».
-- ---------------------------------------------------------

revoke all on function public.coupon_cedibili() from anon;
revoke all on function public.coupon_cedibili() from public;
grant execute on function public.coupon_cedibili() to authenticated;

-- ---------------------------------------------------------
-- IL CONTROLLO, da rifare a ogni drop/create di questa funzione:
--
--   select proname, proacl::text from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname = 'coupon_cedibili';
--
-- Non deve comparire `anon=X`.
-- ---------------------------------------------------------
