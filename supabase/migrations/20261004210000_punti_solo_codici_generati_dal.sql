-- I punti valgono solo per i codici GENERATI dal 1 settembre 2026.
--
-- LA REGOLA, detta da lui il 04/10/2026: contano solo i codici nati da
-- quella data — sia quelli d'aula sia i referral personali. I codici
-- vecchi non maturano punti nemmeno sulle vendite di oggi: il loro
-- storico appartiene a un'altra stagione, e riaprirlo adesso vorrebbe
-- dire pagare due volte quello che e' gia' stato conteggiato altrove.
--
-- La soglia NON e' scritta nella vista: sta in
-- impostazioni_layout_tabelle -> puntiMaster_codiciDal. Una data in un
-- `case when` di una view e' una data che nessuno trova piu' quando
-- servira' cambiarla.
--
-- `coupon.master_dal` resta e scavalca la data di creazione: serve quando
-- un codice gia' esistente viene assegnato a una master in un secondo
-- momento, come e' successo a need30 con Tommaso.
--
-- Oggi questa regola toglie un solo codice, `ccm976` del 31 agosto, che
-- non aveva comunque maturato nulla. Vale per il futuro.
insert into impostazioni_layout_tabelle (chiave, valore)
values ('puntiMaster_codiciDal', '"2026-09-01"'::jsonb)
on conflict (chiave) do nothing;

-- Il corpo della vista e' quello applicato con la migrazione
-- 20261004210000 via MCP: rispetto alla precedente cambia solo la
-- sottoquery che trova la master, che ora chiede anche
--   coalesce(c.master_dal, c.created_at::date) >= (select dal from soglia_codici)
--   and v.data_ordine::date >= coalesce(c.master_dal, c.created_at::date)
-- e il CTE `soglia_codici` che legge l'impostazione.
