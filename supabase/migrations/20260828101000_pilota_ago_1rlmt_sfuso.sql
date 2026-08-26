-- ---------------------------------------------------------
-- Caso pilota "pacchi sigillati / sfusi": Ago 1RLMT 0,30.
--
-- Cerca in anagrafica il box degli aghi 1RLMT 0,30 (per nome, senza
-- distinzione di maiuscole/spazi), crea il gemello "— singolo" se non
-- esiste già, e collega i due: il box diventa bundle con giacenza fisica
-- da 20 pezzi per confezione. Se il nome non viene trovato o è ambiguo
-- (più prodotti corrispondono) NON fa nulla e lo dice con un NOTICE:
-- in quel caso il collegamento si fa a mano dalla scheda prodotto.
-- Sicura da rieseguire: se il collegamento esiste già, esce subito.
-- ---------------------------------------------------------

do $$
declare
  v_box public.prodotti_shop%rowtype;
  v_quanti integer;
  v_sfuso_id uuid;
begin
  select count(*) into v_quanti
  from public.prodotti_shop
  where nome ilike '%1RLMT%0,30%' and coalesce(attivo, true)
    and tipo_prodotto <> 'componente' and nome not ilike '%singolo%';

  if v_quanti = 0 then
    raise notice 'Pilota aghi: nessun prodotto trovato con nome simile a "1RLMT 0,30" — collega i due prodotti a mano dalla scheda prodotto.';
    return;
  end if;
  if v_quanti > 1 then
    raise notice 'Pilota aghi: % prodotti corrispondono a "1RLMT 0,30" — collega quello giusto a mano dalla scheda prodotto.', v_quanti;
    return;
  end if;

  select * into v_box
  from public.prodotti_shop
  where nome ilike '%1RLMT%0,30%' and coalesce(attivo, true)
    and tipo_prodotto <> 'componente' and nome not ilike '%singolo%';

  if v_box.prodotto_sfuso_id is not null then
    raise notice 'Pilota aghi: "%" ha già un prodotto sfuso collegato, niente da fare.', v_box.nome;
    return;
  end if;

  -- il gemello sfuso: componente con giacenza propria (scaffale sfusi),
  -- mai sullo shop, parte da 0 pezzi — si popola con "Apri confezione"
  insert into public.prodotti_shop
    (nome, tipo_prodotto, conta_magazzino, conta_incassi, giacenza_propria,
     giacenza, giacenza_magazzino, solo_offline, attivo, unita_misura)
  values
    (v_box.nome || ' — singolo', 'componente', true, false, true,
     0, 0, true, true, 'pz')
  returning id into v_sfuso_id;

  update public.prodotti_shop set
    tipo_prodotto = 'bundle',
    bundle_con_giacenza_fisica = true,
    giacenza_propria = true,
    conta_magazzino = true,
    prodotto_sfuso_id = v_sfuso_id,
    pezzi_per_confezione = 20
  where id = v_box.id;

  raise notice 'Pilota aghi: creato "%" e collegato a "%" (20 pezzi per confezione).', v_box.nome || ' — singolo', v_box.nome;
end $$;

notify pgrst, 'reload schema';
