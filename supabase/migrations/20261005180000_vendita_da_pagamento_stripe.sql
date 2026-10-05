-- La vendita di un pagamento col QR nasce sul DATABASE, non su uno schermo.
--
-- COM'ERA. La schermata del POS restava in ascolto e, appena Stripe
-- confermava, registrava la vendita. Funziona finche' quella schermata
-- resta aperta: se la master passa ad altro, se il telefono si blocca, se
-- l'app si ricarica per un aggiornamento, i soldi arrivano e non li
-- raccoglie nessuno. E' successo sette volte in dieci giorni.
--
-- COM'E' ADESSO. Il webhook di Stripe arriva sempre, anche a telefono
-- spento, e chiama questa funzione. Vendita, scarico di magazzino ed
-- eventuale ordine di spedizione si scrivono qui dentro, in una
-- transazione sola: o ci sono tutti o non c'e' niente.
--
-- LO STOCK. In questo progetto c'e' una regola — un solo punto scrive lo
-- stock — e aggirarla ha sempre prodotto doppi scarichi. Qui la regola non
-- si rompe, si sposta: il punto resta uno, ma vive sul database invece che
-- nel browser, perche' e' l'unico posto che c'e' sempre. Le regole sono le
-- stesse del banco:
--   - un bundle senza giacenza propria si apre nei suoi componenti;
--   - nessuna giacenza scende sotto zero;
--   - ogni movimento lascia la sua riga nello storico.
--
-- E QUANDO I PEZZI NON BASTANO? I soldi sono gia' stati incassati: la
-- vendita si registra comunque — negarla sarebbe perdere un incasso vero —
-- si scarica quello che c'e', e quello che manca finisce in
-- scarichi_non_riusciti, dove l'Advisor lo mostra. Meglio un debito
-- scritto in chiaro che una giacenza che mente.
--
-- La spinta su WooCommerce non sta qui: la fa il webhook subito dopo, con
-- woo-riallinea-shop, perche' da plpgsql non si esce su internet.

create or replace function registra_vendita_da_pagamento(
  p_codice text,
  p_prova  boolean default false
) returns jsonb
language plpgsql
as $$
declare
  pag            pagamenti_pos;
  v_prodotti     jsonb := '[]'::jsonb;
  v_imponibile   numeric := 0;
  v_totale       numeric;
  v_vendita      jsonb;
  v_spedizione   jsonb := null;
  v_esito        jsonb;
  v_vendita_id   uuid;
  v_numero       text;
  v_non_trovati  text[] := '{}';
  v_mancanti     jsonb := '[]'::jsonb;
  -- NON si chiama "r": e' anche l'alias di _righe_pagamento qui sotto, e
  -- plpgsql in quel caso preferisce la variabile — che a quel punto non e'
  -- ancora assegnata e manda tutto in errore. Costato un giro.
  v_riga         record;
begin
  select * into pag from pagamenti_pos where codice = p_codice;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'pagamento non trovato');
  end if;
  if pag.pagato_il is null then
    return jsonb_build_object('ok', false, 'motivo', 'non risulta pagato');
  end if;
  if pag.vendita_id is not null then
    return jsonb_build_object('ok', true, 'gia_presente', true, 'vendita_id', pag.vendita_id);
  end if;

  -- Le righe della richiesta di pagamento. La quantita' sta dentro al nome
  -- ("2 × Ago ..."), non in un campo: quella richiesta nasce da
  -- un'etichetta, non da un carrello.
  create temporary table if not exists _righe_pagamento (
    nome text, qta numeric, totale numeric, prodotto_id uuid,
    iva numeric, tipo text, fisica boolean
  ) on commit drop;
  delete from _righe_pagamento;

  insert into _righe_pagamento (nome, qta, totale)
  select trim(regexp_replace(x.value->>'nome', '^[0-9]+\s*[×x]\s*', '')),
         coalesce(nullif((regexp_match(x.value->>'nome', '^([0-9]+)\s*[×x]\s*'))[1], '')::numeric, 1),
         round(coalesce((x.value->>'prezzo')::numeric, 0), 2)
  from jsonb_array_elements(coalesce(pag.righe, '[]'::jsonb)) x;

  update _righe_pagamento r
     set prodotto_id = p.id,
         iva = coalesce(p.aliquota_iva_vendita, 22),
         tipo = coalesce(p.tipo_prodotto, 'semplice'),
         fisica = coalesce(p.bundle_con_giacenza_fisica, false)
    from prodotti_shop p
   where lower(p.nome) = lower(r.nome);

  -- la spedizione e' un costo, non un prodotto: non si cerca a catalogo
  select array_agg(nome) into v_non_trovati
    from _righe_pagamento
   where prodotto_id is null and lower(nome) <> 'spedizione';
  if coalesce(array_length(v_non_trovati, 1), 0) > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'righe senza prodotto a catalogo', 'righe', v_non_trovati);
  end if;

  select coalesce(jsonb_agg(
           case when lower(nome) = 'spedizione'
                then jsonb_build_object('prodotto_id', null, 'nome', 'Spedizione', 'quantita', 1,
                                        'prezzo_listino', totale, 'sconto_riga', 0, 'sconto_pct', 0,
                                        'totale_riga', totale, 'spedizione', true)
                else jsonb_build_object('prodotto_id', prodotto_id, 'nome', nome, 'quantita', qta,
                                        'prezzo_listino', round(totale / nullif(qta, 0), 2),
                                        'sconto_riga', 0, 'sconto_pct', 0, 'totale_riga', totale)
           end), '[]'::jsonb),
         coalesce(sum(totale / (1 + coalesce(iva, 22) / 100.0)), 0)
    into v_prodotti, v_imponibile
    from _righe_pagamento;

  v_totale := round(coalesce(pag.importo, 0), 2);
  v_imponibile := round(v_imponibile, 2);

  v_vendita := jsonb_build_object(
    'numero_ordine',     'POS-STRIPE-' || pag.codice,
    'data_ordine',       pag.pagato_il,
    'stato',             'completed',
    'totale',            v_totale,
    'totale_imponibile', v_imponibile,
    'totale_iva',        round(v_totale - v_imponibile, 2),
    'prodotti',          v_prodotti,
    'origine',           'pos',
    -- col QR si paga con la carta: per la vendita, per l'IVA e per i punti
    -- e' un incasso POS come quello del terminale
    'metodo_pagamento',  'pos',
    'note',              'Pagamento col QR ' || pag.codice,
    'cliente_nome',      nullif(trim(coalesce(pag.cliente->>'nome','') || ' ' || coalesce(pag.cliente->>'cognome','')), ''),
    'tipo_movimento',    'vendita',
    'operatore_tipo',    pag.operatore_tipo,
    'operatore_id',      pag.operatore_id,
    'operatore_nome',    pag.operatore_nome,
    'corso_data_id',     pag.corso_data_id,
    'cliente_fattura_id', pag.cliente_fattura_id,
    -- la fattura la governa la richiesta di pagamento, non la vendita
    'richiede_fattura',  false
  );

  -- Il pacco, se la spedizione e' stata pagata: l'indirizzo e' quello che
  -- ha scritto l'allieva su Stripe, non uno ribattuto al banco.
  if exists (select 1 from _righe_pagamento where lower(nome) = 'spedizione')
     and coalesce(pag.cliente->>'indirizzo', pag.cliente->>'citta', '') <> '' then
    v_spedizione := jsonb_build_object(
      'corso_data_id',     pag.corso_data_id,
      'destinatario_nome', nullif(trim(coalesce(pag.cliente->>'nome','') || ' ' || coalesce(pag.cliente->>'cognome','')), ''),
      'nome',              pag.cliente->>'nome',
      'cognome',           pag.cliente->>'cognome',
      'indirizzo',         pag.cliente->>'indirizzo',
      'civico',            pag.cliente->>'civico',
      'citta',             pag.cliente->>'citta',
      'cap',               pag.cliente->>'cap',
      'provincia',         upper(left(coalesce(pag.cliente->>'provincia',''), 2)),
      'cellulare',         pag.cliente->>'telefono',
      'richiede_fattura',  false,
      'prodotti',          (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(v_prodotti) x
                             where coalesce((x->>'spedizione')::boolean, false) = false)
    );
  end if;

  -- quanto scendera' dal magazzino: i bundle senza giacenza propria si
  -- aprono nei loro pezzi, come fa righeScarico al banco
  create temporary table if not exists _scarichi (prodotto_id uuid, nome text, serve numeric) on commit drop;
  delete from _scarichi;

  insert into _scarichi (prodotto_id, nome, serve)
  select coalesce(c.id, r.prodotto_id),
         coalesce(c.nome, r.nome),
         sum(case when c.id is null then r.qta else r.qta * bc.quantita_per_bundle end)
    from _righe_pagamento r
    left join bundle_componenti bc
           on r.tipo = 'bundle' and not r.fisica and bc.bundle_id = r.prodotto_id
    left join prodotti_shop c on c.id = bc.componente_id
   where r.prodotto_id is not null
   group by 1, 2;

  if p_prova then
    return jsonb_build_object(
      'ok', true, 'prova', true,
      'numero_ordine', v_vendita->>'numero_ordine',
      'totale', v_totale, 'imponibile', v_imponibile,
      'righe', jsonb_array_length(v_prodotti),
      'con_spedizione', v_spedizione is not null,
      'scarichi', (select coalesce(jsonb_agg(jsonb_build_object(
                     'prodotto', s.nome, 'serve', s.serve,
                     'in_casa', coalesce(p.quantita, 0))), '[]'::jsonb)
                   from _scarichi s join prodotti_shop p on p.id = s.prodotto_id)
    );
  end if;

  select registra_vendita_pos(v_vendita, v_spedizione) into v_esito;
  v_vendita_id := (v_esito->>'vendita_id')::uuid;
  v_numero     := v_esito->>'numero_ordine';

  if coalesce((v_esito->>'gia_presente')::boolean, false) then
    update pagamenti_pos set vendita_id = v_vendita_id, aggiornato_il = now() where id = pag.id;
    return jsonb_build_object('ok', true, 'gia_presente', true, 'vendita_id', v_vendita_id, 'numero_ordine', v_numero);
  end if;

  -- lo scarico, mai sotto zero
  for v_riga in
    select s.prodotto_id, s.nome, s.serve, coalesce(p.quantita, 0) as in_casa
      from _scarichi s join prodotti_shop p on p.id = s.prodotto_id
  loop
    if v_riga.in_casa > 0 then
      update prodotti_shop
         set quantita = quantita - least(v_riga.serve, v_riga.in_casa)
       where id = v_riga.prodotto_id;

      insert into movimenti_magazzino (prodotto_id, delta, origine, nota, riferimento, utente)
      values (v_riga.prodotto_id, -least(v_riga.serve, v_riga.in_casa), 'vendita_pos',
              'Vendita col QR ' || pag.codice, v_numero, pag.operatore_nome);
    end if;

    if v_riga.serve > v_riga.in_casa then
      -- il debito resta scritto: l'Advisor lo mostra, e nessuna giacenza
      -- racconta di avere pezzi che non ci sono
      insert into scarichi_non_riusciti (vendita_id, numero_ordine, nome_riga, quantita, motivo)
      values (v_vendita_id, v_numero, v_riga.nome, v_riga.serve - v_riga.in_casa,
              'Pagamento col QR ' || pag.codice || ': in magazzino ce n''erano ' || v_riga.in_casa || ' su ' || v_riga.serve);
      v_mancanti := v_mancanti || jsonb_build_object('prodotto', v_riga.nome, 'mancanti', v_riga.serve - v_riga.in_casa);
    end if;
  end loop;

  update pagamenti_pos set vendita_id = v_vendita_id, aggiornato_il = now() where id = pag.id;

  return jsonb_build_object(
    'ok', true, 'vendita_id', v_vendita_id, 'numero_ordine', v_numero,
    'con_spedizione', v_spedizione is not null,
    'scarichi', (select count(*) from _scarichi),
    'mancanti', v_mancanti
  );
end;
$$;

comment on function registra_vendita_da_pagamento is
  'Da una richiesta di pagamento col QR gia'' pagata: crea la vendita, scarica il magazzino (bundle aperti nei componenti, mai sotto zero) e, se la spedizione era pagata, l''ordine di spedizione con l''indirizzo scritto dall''allieva. Tutto in una transazione. Con p_prova = true non scrive niente e dice cosa farebbe.';
