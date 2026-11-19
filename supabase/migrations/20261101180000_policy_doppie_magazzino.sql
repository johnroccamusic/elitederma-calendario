-- Policy doppie (01/11/2026). Su tre tabelle c'erano due regole identiche
-- («accesso interno» e «accesso staff»): for all to authenticated, using true,
-- with check true. Si tiene «accesso interno» e si toglie «accesso staff»:
-- i permessi restano esattamente quelli di prima.
--
-- Rollback, se mai servisse:
--   create policy "accesso staff impostazioni_magazzino" on public.impostazioni_magazzino for all to authenticated using (true) with check (true);
--   create policy "accesso staff movimenti_magazzino" on public.movimenti_magazzino for all to authenticated using (true) with check (true);
--   create policy "accesso staff snapshot_giacenze" on public.snapshot_giacenze_pre_unificazione for all to authenticated using (true) with check (true);

drop policy "accesso staff impostazioni_magazzino" on public.impostazioni_magazzino;
drop policy "accesso staff movimenti_magazzino" on public.movimenti_magazzino;
drop policy "accesso staff snapshot_giacenze" on public.snapshot_giacenze_pre_unificazione;
