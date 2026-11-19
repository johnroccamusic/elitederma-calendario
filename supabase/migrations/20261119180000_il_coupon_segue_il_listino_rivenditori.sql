-- ---------------------------------------------------------
-- Sopra il 10% comanda il listino rivenditori (19/11/2026)
--
-- Il titolare: «quando faccio un coupon che genera uno sconto del 20%,
-- deve seguire cmq i listini dei rivenditori con il 20% di sconto,
-- ovvero il tetto e' 20 ma non tutto ha 20... da oggi non sara' piu'
-- possibile creare sconti liberi di qualsiasi percentuale perche' sopra
-- al 10% subentreranno i calcoli che fanno i listini attuali dei
-- rivenditori». E, sulla legge da seguire: «il riferimento, la legge
-- deve essere il listino rivenditori».
--
-- LA REGOLA, scelta da lui fra le due possibili (19/11/2026):
--
--   frazione      = valore_coupon / tetto_sconto        (30 / 50 = 0,6)
--   sconto_prodotto_pct = cedibile_del_prodotto x frazione
--
-- cioe' la PROPORZIONE, non il minimo fra i due: un coupon al 30% vale
-- tre quinti di quello che ogni prodotto puo' cedere. Su Arizona
-- (cedibile 50%) fa 30%; sul Kit laminazione ciglia (14,7%) fa 8,82%;
-- su N2 Fixa (0%) fa zero. E' la stessa forma del codice di acquisto
-- delle master, che cede una quota del cedibile da settembre.
--
-- Qui dentro ci sono tre cose, e nessuna muove un importo oggi.
-- ---------------------------------------------------------

-- 1) LA SOGLIA, come dato e non come numero nel codice (sua richiesta:
--    «10%, e si cambia dalla pagina»). Sotto, lo sconto resta libero
--    come oggi; da qui in su comanda il listino.
insert into public.rivenditori_parametri (chiave, numero, descrizione)
values (
  'soglia_sconto_libero_pct', 10,
  'Sotto questa percentuale un coupon sconta libero, come prima. Da qui in su lo sconto di ogni prodotto lo decide il listino rivenditori, in proporzione al tetto.'
)
on conflict (chiave) do nothing;

-- 2) UN COSTO CHE NON C'E' NON VALE IL TETTO PIENO: VALE ZERO.
--
--    Era il punto 6 della specifica rivenditori, rimasto aperto dal
--    18/11: un costo mancante o a zero veniva letto come «non lo so» e
--    dava il tetto intero (50%) — il massimo sconto possibile sul
--    prodotto di cui non si sa quanto si guadagna. E' cosi' che l'«Ago 5
--    Magnum» sarebbe finito in un listino Distributor a 14,35 euro.
--
--    Da adesso nessuno sconto, deciso dal titolare il 19/11/2026. Si
--    corregge ADESSO perche' e' il momento in cui non costa niente:
--    misurato, i prodotti senza costo nel listino sono ZERO su 195.
create or replace function public.listino_cedibile(
  p_netto numeric, p_costo numeric, p_ricarico_pct numeric, p_tetto_pct numeric
) returns numeric
language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_netto is null or p_netto <= 0 then null
    -- costo sconosciuto: niente da cedere. Prima: round(p_tetto_pct/100.0, 3)
    when p_costo is null or p_costo <= 0 then 0::numeric
    else greatest(0::numeric, least(
      round(p_tetto_pct / 100.0, 3),
      trunc((1 - p_costo * (1 + p_ricarico_pct / 100.0) / p_netto) * 1000) / 1000
    ))
  end;
$$;

comment on function public.listino_cedibile(numeric, numeric, numeric, numeric) is
  'Quanto sconto si puo scendere su un prodotto senza andare sotto costo x (1 + ricarico), col tetto come massimo. Un costo mancante o a zero vale ZERO cedibile, non il tetto: non si concede il massimo su un prodotto di cui non si sa il margine (deciso il 19/11/2026).';

-- 3) LA FORZATURA. Sua richiesta, con l'esempio: «se un giorno decido di
--    mettere il 30% sui prodotti di laminazione per sbarazzarmene e
--    quindi venderli sotto prezzo, tu mi devi segnalare che io non ho
--    quel margine e io ti devo confermare la forzatura».
--
--    Forzato = il coupon torna a scontare PIATTO, anche sotto costo. Il
--    motivo e' OBBLIGATORIO e lo pretende il database: un prezzo sotto
--    costo senza il perche' accanto, fra sei mesi, si legge come un
--    difetto dell'app invece che come una decisione.
alter table public.coupon
  add column if not exists forzato boolean not null default false,
  add column if not exists forzato_motivo text,
  add column if not exists forzato_da text,
  add column if not exists forzato_il timestamptz;

comment on column public.coupon.forzato is
  'Vero quando lo sconto e'' stato forzato piatto contro il listino rivenditori: il coupon applica la sua percentuale anche dove il margine non la regge. Il motivo e'' obbligatorio.';

alter table public.coupon drop constraint if exists coupon_forzatura_col_motivo;
alter table public.coupon add constraint coupon_forzatura_col_motivo
  check (
    forzato = false
    or (forzato_motivo is not null and btrim(forzato_motivo) <> '' and forzato_il is not null)
  );

-- 4) I CEDIBILI PER IL BANCO, SENZA I COSTI.
--
--    ATTENZIONE: questa versione restituisce due colonne. La gemella
--    20261119181000 la rifa' subito dopo con cedibile_eur e
--    blocco_ordine, perche' serve anche al codice di acquisto delle
--    master — che cede una quota del cedibile per reparto, e il reparto
--    si cerca per NUMERO. Lo stato attuale e' quella.
--
--    Al POS serve una cosa sola: quanto puo' cedere ogni prodotto. La
--    view del listino porta anche costi e margini, e al banco ci sta una
--    master: questa funzione restituisce l'id e la percentuale, e basta.
--    Stessa ragione per cui `listino_rivenditori_export` non restituisce
--    costi (§ Listini rivenditori).
create or replace function public.coupon_cedibili()
returns table (prodotto_id uuid, cedibile_pct numeric)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id, sconto_max_pct from public.v_listino_rivenditori where sconto_max_pct is not null;
$$;

revoke all on function public.coupon_cedibili() from public;
grant execute on function public.coupon_cedibili() to authenticated;

-- ---------------------------------------------------------
-- ROLLBACK
--   drop function if exists public.coupon_cedibili();
--   alter table public.coupon drop constraint if exists coupon_forzatura_col_motivo;
--   alter table public.coupon drop column if exists forzato_il, drop column if exists forzato_da,
--                             drop column if exists forzato_motivo, drop column if exists forzato;
--   delete from public.rivenditori_parametri where chiave = 'soglia_sconto_libero_pct';
--   -- e listino_cedibile torna a dare il tetto su un costo mancante:
--   --   when p_costo is null or p_costo <= 0 then round(p_tetto_pct / 100.0, 3)
-- ATTENZIONE: tornando indietro, i coupon forzati perdono il motivo per
-- cui qualcuno li aveva forzati.
-- ---------------------------------------------------------
