-- 31/10/2026 — stock_muovi: ogni riga puo' portare la sua nota (e il suo
-- riferimento). Serve a fondere in un solo blocco i rientri e gli scarichi di
-- un kit, che hanno note diverse: due blocchi in fila lasciavano una finestra
-- in cui il primo era applicato e il secondo no.
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
  select (e->>'prodotto_id')::uuid, (e->>'delta')::integer, p_origine,
         coalesce(e->>'nota', p_nota), coalesce(e->>'riferimento', p_riferimento), p_utente,
         nullif(e->>'collegato_prodotto_id','')::uuid
    from jsonb_array_elements(p_righe) e where (e->>'delta')::integer <> 0;

  select jsonb_object_agg(id::text, quantita) into nuove from prodotti_shop
   where id in (select (e->>'prodotto_id')::uuid from jsonb_array_elements(p_righe) e);
  return jsonb_build_object('ok', true, 'quantita', coalesce(nuove, '{}'::jsonb));
end;
$$;
revoke all on function public.stock_muovi(jsonb, text, text, text, text) from public, anon;
grant execute on function public.stock_muovi(jsonb, text, text, text, text) to authenticated, service_role;
