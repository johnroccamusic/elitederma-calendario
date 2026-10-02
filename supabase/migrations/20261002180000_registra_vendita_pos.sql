-- Una vendita al banco si scrive TUTTA INSIEME, o non si scrive.
--
-- Prima erano due chiamate dal browser: scrivi la vendita, prenditi il suo
-- id, scrivi la spedizione. Finche' funzionano non si vede la differenza;
-- il giorno in cui la seconda fallisce resta la prima — incasso contato,
-- magazzino scaricato, niente da spedire. E' successo per sei giorni di
-- fila dal 26/09 al 02/10/2026.
--
-- Qui dentro le due scritture stanno in una transazione sola: una funzione
-- plpgsql o arriva in fondo o non lascia niente. Non c'e' una terza
-- possibilita'.
--
-- LE DUE TABELLE RESTANO DUE, ed e' giusto: la maggior parte delle vendite
-- al banco non spedisce niente, e una spedizione ha una vita sua — gli
-- stati, le righe preparate, la data di partenza. A essere una cosa sola
-- non sono i dati: e' la scrittura.
--
-- I PREDEFINITI VANNO MESSI A MANO. jsonb_populate_record parte da una
-- riga tutta NULL e riempie solo le chiavi presenti: le colonne con un
-- default ma NOT NULL (prodotti, ts_ricevuto, origine, tipo_movimento,
-- simulazione...) arriverebbero a NULL e l'inserimento fallirebbe. Si
-- mettono SOTTO al payload, cosi' quello che arriva dal modulo vince.
create or replace function registra_vendita_pos(p_vendita jsonb, p_spedizione jsonb default null)
returns jsonb
language plpgsql
as $$
declare
  v vendite_shop;
  s spedizioni_pos;
  base_v jsonb := jsonb_build_object(
    'id', gen_random_uuid(),
    'prodotti', '[]'::jsonb,
    'ts_ricevuto', now(),
    'origine', 'woocommerce',
    'tipo_movimento', 'vendita',
    'prelevato_dai_kit', false,
    'simulazione', false,
    'richiede_fattura', false,
    'provvigione_pezzi', 0
  );
  base_s jsonb := jsonb_build_object(
    'id', gen_random_uuid(),
    'prodotti', '[]'::jsonb,
    'stato', 'da_spedire',
    'ts', now(),
    'richiede_fattura', false,
    'simulazione', false
  );
begin
  if p_vendita is null or jsonb_typeof(p_vendita) <> 'object' then
    raise exception 'Serve il corpo della vendita';
  end if;

  insert into vendite_shop
  select * from jsonb_populate_record(null::vendite_shop, base_v || p_vendita)
  returning * into v;

  if p_spedizione is not null and jsonb_typeof(p_spedizione) = 'object' then
    insert into spedizioni_pos
    select * from jsonb_populate_record(
      null::spedizioni_pos,
      base_s || p_spedizione || jsonb_build_object('vendita_id', v.id)
    )
    returning * into s;
  end if;

  return jsonb_build_object(
    'vendita_id', v.id,
    'numero_ordine', v.numero_ordine,
    'spedizione_id', s.id
  );
end;
$$;

comment on function registra_vendita_pos(jsonb, jsonb) is
  'Scrive una vendita al banco e il suo ordine di spedizione in una transazione sola: o tutte e due o nessuna (02/10/2026).';
