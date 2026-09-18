-- I corsi gia' partiti prima che il modulo esistesse.
--
-- La spedizione del modulo nasce quando in Logistica si preme "pacco
-- preparato". Per i corsi preparati PRIMA del modulo quel gesto e' gia'
-- avvenuto, quindi la spedizione non nascera' mai: la master di un corso
-- in aula oggi non trova il tasto dell'inventario, e il POS non sa che in
-- quell'aula c'e' della merce.
--
-- La fotografia del pacco pero' c'e' — logistica_kit_edizioni.spedizione_snapshot,
-- scattata dal vecchio flusso — e contiene esattamente quello che serve.
-- Questo recupero la legge e costruisce la spedizione del modulo: righe,
-- kit di riserva numerati uno per uno, e la foto del loro contenuto.
--
-- Si limita alle edizioni ancora nella finestra dell'inventario (fino a
-- una settimana dopo la fine): piu' indietro di cosi' il pacco e' gia'
-- rientrato e ricostruirlo adesso non servirebbe a nessuno.
--
-- Idempotente: salta le edizioni che una spedizione ce l'hanno gia'.
-- Non tocca logistica_kit_edizioni, che resta di sola lettura.
do $$
declare
  ed record;
  v_sped uuid;
  kit record;
  n int;
  v_istanza uuid;
begin
  for ed in
    select cd.id as corso_data_id, cd.master_id, lk.spedizione_snapshot as foto,
           coalesce(lk.spedizione_snapshot_ts::date, cd.data_inizio) as data_sped
    from corsi_date cd
    join logistica_kit_edizioni lk on lk.corso_data_id = cd.id
    where lk.spedizione_snapshot is not null
      and cd.data_fine >= current_date - 7
      and not exists (select 1 from spedizioni_corso s where s.corso_data_id = cd.id)
  loop
    insert into spedizioni_corso (corso_data_id, master_id, data_spedizione, stato, n_allievi_previsti, creata_da)
    values (
      ed.corso_data_id, ed.master_id, ed.data_sped, 'spedita',
      coalesce(jsonb_array_length(ed.foto -> 'iscritti'), 0),
      'recupero automatico'
    )
    returning id into v_sped;

    -- i kit: quelli degli allievi e quelli di riserva
    insert into spedizione_righe (spedizione_id, tipo, kit_id, quantita_spedita)
    select v_sped, 'kit_allievo', k.key::uuid, (k.value ->> 'per_iscritti')::int
    from jsonb_each(coalesce(ed.foto -> 'kit', '{}'::jsonb)) k
    where coalesce((k.value ->> 'per_iscritti')::int, 0) > 0;

    insert into spedizione_righe (spedizione_id, tipo, kit_id, quantita_spedita)
    select v_sped, 'kit_riserva', k.key::uuid, (k.value ->> 'riserva')::int
    from jsonb_each(coalesce(ed.foto -> 'kit', '{}'::jsonb)) k
    where coalesce((k.value ->> 'riserva')::int, 0) > 0;

    -- accessori didattica e merce da vendere: per il rientro sono la
    -- stessa cosa, roba sfusa da contare
    insert into spedizione_righe (spedizione_id, tipo, prodotto_id, quantita_spedita)
    select v_sped, 'sfuso', a.prodotto_id, sum(a.q)
    from (
      select key::uuid as prodotto_id, (value #>> '{}')::numeric::int as q
      from jsonb_each(coalesce(ed.foto -> 'accessori', '{}'::jsonb))
      union all
      select key::uuid, (value #>> '{}')::numeric::int
      from jsonb_each(coalesce(ed.foto -> 'merce_vendita', '{}'::jsonb))
    ) a
    where a.q > 0
      and exists (select 1 from prodotti_shop p where p.id = a.prodotto_id)
    group by a.prodotto_id;

    -- i dermografi di riserva: per modello, che a catalogo puo' non esserci
    insert into spedizione_righe (spedizione_id, tipo, modello, quantita_spedita)
    select v_sped, 'dermografo', d.key, (d.value #>> '{}')::numeric::int
    from jsonb_each(coalesce(ed.foto #> '{dermografi,riserva}', '{}'::jsonb)) d
    where coalesce((d.value #>> '{}')::numeric::int, 0) > 0;

    -- ogni kit di riserva diventa un'istanza numerata, con la foto del
    -- contenuto copiata dalla distinta
    for kit in
      select k.key::uuid as kit_id, (k.value ->> 'riserva')::int as quanti
      from jsonb_each(coalesce(ed.foto -> 'kit', '{}'::jsonb)) k
      where coalesce((k.value ->> 'riserva')::int, 0) > 0
    loop
      for n in 1..kit.quanti loop
        insert into kit_riserva_istanze (spedizione_id, kit_id, progressivo)
        values (v_sped, kit.kit_id, n)
        returning id into v_istanza;

        insert into kit_riserva_componenti (kit_riserva_id, prodotto_id, quantita_iniziale)
        select v_istanza, ck.prodotto_id, sum(ck.quantita)
        from corsi_kit_prodotti ck
        where ck.kit_id = kit.kit_id and ck.tipo = 'kit'
        group by ck.prodotto_id;
      end loop;
    end loop;
  end loop;
end $$;
