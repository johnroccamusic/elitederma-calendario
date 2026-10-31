-- 31/10/2026 — Passo 1 del lavoro sullo stock dal browser.
-- Prima ogni movimento era: leggi la giacenza nel browser, calcola
-- quantita+delta, riscrivi il numero ASSOLUTO, poi inserisci a parte la riga
-- di storico. Due persone sullo stesso prodotto si perdevano un movimento, un
-- errore fra le due scritture lasciava giacenza e storico in disaccordo, e
-- un'operazione su otto prodotti poteva fermarsi al terzo.
--
-- stock_muovi fa tutto in UNA transazione: blocca i prodotti in ordine fisso
-- (niente deadlock), rifiuta l'intero blocco se anche un solo prodotto
-- scenderebbe sotto zero (e non cambia niente), applica il delta nel database
-- e scrive i movimenti insieme. WooCommerce non si tocca qui: lo riallinea il
-- chiamante dopo il commit (allineaShop) e, in ogni caso, il giro notturno.
--
-- righe: [{ "prodotto_id": uuid, "delta": int, "collegato_prodotto_id"?: uuid }]
-- ritorna: { ok: true, quantita: { <prodotto_id>: <nuova giacenza> } }
--       o  { ok: false, motivo: 'insufficiente'|'non_trovato'|'righe', ... }
create or replace function public.stock_muovi(
  p_righe jsonb, p_origine text, p_nota text default null,
  p_riferimento text default null, p_utente text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
  trovati integer;
  voluti integer;
  mancanti jsonb;
  nuove jsonb;
begin
  if p_origine is null or btrim(p_origine) = '' then
    return jsonb_build_object('ok', false, 'motivo', 'righe', 'errore', 'manca l''origine');
  end if;
  if p_righe is null or jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'righe', 'errore', 'nessuna riga');
  end if;

  select count(distinct (e->>'prodotto_id')::uuid) into voluti
    from jsonb_array_elements(p_righe) e where (e->>'delta')::integer <> 0;
  if voluti = 0 then return jsonb_build_object('ok', true, 'quantita', '{}'::jsonb); end if;

  -- blocco in ordine di id: due operazioni incrociate non si aspettano a vicenda
  select count(*) into trovati from (
    select p.id from prodotti_shop p
     where p.id in (select (e->>'prodotto_id')::uuid from jsonb_array_elements(p_righe) e where (e->>'delta')::integer <> 0)
     order by p.id for update) l;
  if trovati <> voluti then
    return jsonb_build_object('ok', false, 'motivo', 'non_trovato',
      'errore', 'uno o piu'' prodotti non esistono piu''');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'prodotto_id', p.id, 'nome', p.nome, 'disponibili', coalesce(p.quantita, 0), 'richiesti', -s.somma)), '[]'::jsonb)
    into mancanti
    from (select (e->>'prodotto_id')::uuid prodotto_id, sum((e->>'delta')::integer) somma
            from jsonb_array_elements(p_righe) e group by 1) s
    join prodotti_shop p on p.id = s.prodotto_id
   where s.somma < 0 and coalesce(p.quantita, 0) + s.somma < 0;
  if jsonb_array_length(mancanti) > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'insufficiente', 'prodotti', mancanti);
  end if;

  for r in select (e->>'prodotto_id')::uuid prodotto_id, sum((e->>'delta')::integer)::integer somma
             from jsonb_array_elements(p_righe) e group by 1 loop
    update prodotti_shop set quantita = coalesce(quantita, 0) + r.somma where id = r.prodotto_id;
  end loop;

  insert into movimenti_magazzino (prodotto_id, delta, origine, nota, riferimento, utente, collegato_prodotto_id)
  select (e->>'prodotto_id')::uuid, (e->>'delta')::integer, p_origine, p_nota, p_riferimento, p_utente,
         nullif(e->>'collegato_prodotto_id','')::uuid
    from jsonb_array_elements(p_righe) e where (e->>'delta')::integer <> 0;

  select jsonb_object_agg(id::text, quantita) into nuove from prodotti_shop
   where id in (select (e->>'prodotto_id')::uuid from jsonb_array_elements(p_righe) e);
  return jsonb_build_object('ok', true, 'quantita', coalesce(nuove, '{}'::jsonb));
end;
$$;
revoke all on function public.stock_muovi(jsonb, text, text, text, text) from public, anon;
grant execute on function public.stock_muovi(jsonb, text, text, text, text) to authenticated, service_role;
