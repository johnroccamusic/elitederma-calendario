-- ---------------------------------------------------------
-- Riparazione dei prezzi gonfiati del 22% (e blocco dell'anello).
--
-- COSA SUCCEDEVA. Da quando l'IVA si gestisce in anagrafica,
-- prodotti_shop.prezzo_vendita è il NETTO e su WooCommerce si pubblica il
-- LORDO (netto × aliquota). Due edge function però riscrivevano in locale
-- il prezzo che WooCommerce restituisce — che è il lordo — dentro quel
-- campo netto:
--   - woo-gestisci-prodotto, a ogni salvataggio della scheda prodotto;
--   - woo-sync-catalogo, a ogni sincronizzazione.
-- Risultato: ogni salvataggio moltiplicava il prezzo per 1,22, e il giro
-- successivo lo rifaceva. Quattro salvataggi = prezzo raddoppiato, anche
-- sul sito.
--
-- COSA FA QUESTA MIGRAZIONE.
-- 1) Un trigger riconosce l'eco (il nuovo valore è esattamente il lordo di
--    quello vecchio, a meno di due centesimi di arrotondamento) e lo
--    scarta, tenendo il netto. Vale per chiunque scriva: le due funzioni
--    non ancora ripubblicate, la sincronizzazione manuale, il cron.
--    Un aumento di prezzo vero passa; solo un rincaro di ESATTAMENTE il
--    22% verrebbe scambiato per un'eco, e in quel caso basta scriverlo in
--    due passaggi.
-- 2) Riporta a netto i prodotti pubblicati mai salvati a mano
--    (iva_verificata = false): per loro il valore era il prezzo giusto del
--    sito finito nel campo sbagliato, quindi basta dividere. Sul sito non
--    cambia niente.
--
-- Restano fuori i prodotti già salvati a mano: quelli hanno fatto uno o
-- più giri dell'anello e sono gonfiati ANCHE sul sito. Si correggono uno
-- per uno, con il prezzo confermato dal titolare.
-- ---------------------------------------------------------

create or replace function public.protezione_prezzo_lordo()
returns trigger
language plpgsql
as $$
declare
  v_aliquota numeric;
  v_lordo_atteso numeric;
begin
  if new.prezzo_vendita is null or old.prezzo_vendita is null then return new; end if;
  if new.prezzo_vendita is not distinct from old.prezzo_vendita then return new; end if;

  v_aliquota := coalesce(new.aliquota_iva_vendita, (select aliquota_default from public.impostazioni_iva where id), 22);
  v_lordo_atteso := round(old.prezzo_vendita * (1 + v_aliquota / 100.0), 2);

  if abs(new.prezzo_vendita - v_lordo_atteso) <= 0.02 then
    raise notice 'Prezzo di "%": scartato il lordo di ritorno (% -> %), tenuto il netto', new.nome, old.prezzo_vendita, new.prezzo_vendita;
    new.prezzo_vendita := old.prezzo_vendita;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protezione_prezzo_lordo on public.prodotti_shop;
create trigger trg_protezione_prezzo_lordo
  before update on public.prodotti_shop
  for each row execute function public.protezione_prezzo_lordo();

update public.prodotti_shop
   set prezzo_vendita = round((prezzo_vendita / (1 + coalesce(aliquota_iva_vendita, 22) / 100.0))::numeric, 2)
 where prezzo_vendita is not null
   and woo_product_id is not null
   and not coalesce(iva_verificata, false);
