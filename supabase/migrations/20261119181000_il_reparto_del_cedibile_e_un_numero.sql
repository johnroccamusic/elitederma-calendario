-- ---------------------------------------------------------
-- Il reparto del cedibile e' un NUMERO, non un nome (19/11/2026)
--
-- Gemella di 20261119180000. `coupon_cedibili()` restituiva il nome del
-- reparto; la quota per reparto del codice di acquisto delle master si
-- cerca invece con il NUMERO (`quotaMasterDi`, e in
-- `listino_master_quota` le chiavi sono 1..12 e 99).
--
-- Col nome ogni prodotto sarebbe ricaduto sulla quota GENERALE (30%)
-- invece che su quella del suo reparto (45-64%), su tutti i reparti e
-- senza nessun errore: una master avrebbe pagato di piu' e nessuno
-- avrebbe saputo perche'. Preso guardando il dato prima di pubblicare.
-- ---------------------------------------------------------

drop function if exists public.coupon_cedibili();

create or replace function public.coupon_cedibili()
returns table (prodotto_id uuid, cedibile_pct numeric, cedibile_eur numeric, blocco_ordine integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id,
         sconto_max_pct,
         round(pubblico_netto * sconto_max_pct / 100.0, 2),
         blocco_ordine
    from public.v_listino_rivenditori
   where sconto_max_pct is not null and pubblico_netto > 0;
$$;

comment on function public.coupon_cedibili() is
  'Quanto si puo cedere su ogni prodotto, per i due meccanismi che lo cedono: il codice di acquisto delle master (una quota per reparto, cercata per blocco_ordine) e il coupon sopra la soglia (una frazione del tetto). Percentuale, euro netti per pezzo e numero del reparto. NIENTE costi: al banco ci sta una master.';

revoke all on function public.coupon_cedibili() from public;
grant execute on function public.coupon_cedibili() to authenticated;

-- ---------------------------------------------------------
-- ROLLBACK: la versione di 20261119180000, che restituisce tre colonne
-- (prodotto_id, cedibile_pct) e non il reparto. ATTENZIONE: il codice
-- dell'app legge `blocco_ordine`, quindi tornando indietro la quota per
-- reparto delle master ricade su quella generale.
-- ---------------------------------------------------------
