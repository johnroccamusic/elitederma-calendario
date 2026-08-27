-- ---------------------------------------------------------
-- Collega i box di aghi ai pezzi sfusi già presenti in anagrafica.
--
-- I gemelli "— singolo" erano già stati creati a mano (solo_offline,
-- fuori dagli incassi, a zero pezzi): qui si limitano a essere collegati
-- al loro box, che diventa "confezione con giacenza fisica". Nessun
-- prodotto nuovo — per questo il pilota 20260828101000, che il gemello
-- lo creava, resta un no-op: esce subito se il box ha già uno sfuso
-- collegato.
--
-- Da qui in poi i due scaffali sono distinti: il box tiene i pacchi
-- sigillati, lo sfuso i pezzi aperti, e si travasa solo con "Apri
-- confezione" (−1 box, +pezzi_per_confezione sfusi).
--
-- "Ago 7 MAGNUM 0.35 LT-T" resta senza pezzi_per_confezione: il nome non
-- dice quanti pezzi contiene la confezione e quel numero moltiplica lo
-- stock, quindi va scritto a mano nella scheda prodotto prima del primo
-- utilizzo (l'app lo chiede e blocca l'apertura finché manca).
--
-- Sicura da rieseguire. Per annullare:
--   update public.prodotti_shop
--      set bundle_con_giacenza_fisica = false, prodotto_sfuso_id = null,
--          pezzi_per_confezione = null
--    where nome in ('Ago 1RLMT - 0,30 - Box 20 pz', 'Ago 3RLLT - 0,25 - Box 20 pz',
--                   'Ago 3 Nano slope Universale - 0,25 - Box 20 pz', 'Ago 7 MAGNUM 0.35 LT-T');
-- ---------------------------------------------------------

do $$
declare
  v record;
  v_box_id uuid;
  v_sfuso_id uuid;
begin
  for v in
    select * from (values
      ('Ago 1RLMT - 0,30 - Box 20 pz',                  'Ago 1rl 0,30 - singolo',     20::integer),
      ('Ago 3RLLT - 0,25 - Box 20 pz',                  'Ago 3rl 0,25 - singolo',     20::integer),
      ('Ago 3 Nano slope Universale - 0,25 - Box 20 pz', 'Ago 3 nano slope - singolo', 20::integer),
      ('Ago 7 MAGNUM 0.35 LT-T',                        'Ago 7 magnum - singolo',     null::integer)
    ) as t(box, sfuso, pezzi)
  loop
    select id into v_box_id from public.prodotti_shop where nome = v.box;
    select id into v_sfuso_id from public.prodotti_shop where nome = v.sfuso;
    if v_box_id is null then
      raise notice 'Box "%" non trovato: collegamento saltato.', v.box;
      continue;
    end if;
    if v_sfuso_id is null then
      raise notice 'Sfuso "%" non trovato: collegamento saltato.', v.sfuso;
      continue;
    end if;

    update public.prodotti_shop set
      bundle_con_giacenza_fisica = true,
      prodotto_sfuso_id = v_sfuso_id,
      pezzi_per_confezione = coalesce(v.pezzi, pezzi_per_confezione),
      giacenza_propria = true,
      conta_magazzino = true
    where id = v_box_id;

    raise notice 'Collegato "%" -> "%".', v.box, v.sfuso;
  end loop;
end $$;

notify pgrst, 'reload schema';
