-- L'ABBINAMENTO FRA LUNCH FLOW E L'ESTRATTO CONTO IMPORTATO A MANO.
--
-- Perche' esiste. Il primo giro di sincronizzazione ha scaricato 522
-- movimenti e 480 di quelli erano gia' nella tabella, importati dal file
-- dell'estratto conto: lo stesso bonifico due volte in prima nota, uno
-- riconciliato e uno no. L'anti-duplicato della funzione guardava solo
-- l'identificativo di Lunch Flow, che le righe da file non hanno.
--
-- Come si riconosce lo stesso movimento. Stesso conto, stesso importo al
-- centesimo, data entro tre giorni. I tre giorni non sono prudenza
-- generica: la banca mostra un'operazione e due giorni dopo la consolida
-- cambiandole la data, e le due fonti leggono momenti diversi.
--
-- Chi vince. La riga che c'era gia'. Si porta dietro la riconciliazione,
-- la nota, lo stato, il collegamento alla spesa: lavoro di una persona.
-- Prende solo `lunchflow_id`, cosi' il giro dopo la riconosce e non
-- riscarica niente. Uno a uno: un gemello preso non si riusa, altrimenti
-- due addebiti uguali dello stesso giorno si schiaccerebbero in uno.

-- Le due fonti chiamano il conto in modo diverso: il file usa il numero
-- di conto (CC0010523827), Lunch Flow l'IBAN intero, che finisce con
-- quello. Si tiene l'etichetta che l'app mostra gia', per non far
-- comparire due conti dove ce n'e' uno.
create or replace function public.lunchflow_etichetta_conto(p_iban text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select m.conto
       from movimenti_banca m
      where m.origine is distinct from 'lunchflow'
        and m.conto is not null
        and length(m.conto) >= 8
        and (p_iban = m.conto or p_iban like '%' || m.conto)
      group by m.conto
      order by count(*) desc
      limit 1),
    p_iban
  );
$$;

create or replace function public.lunchflow_abbina(p_conto text, p_movimenti jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  gemello uuid;
  adottati text[] := '{}';
  gia_note text[] := '{}';
begin
  for r in
    select (m->>'id') as lf_id,
           (m->>'data')::date as d,
           (m->>'importo')::numeric as importo
      from jsonb_array_elements(p_movimenti) m
     order by (m->>'data')::date, (m->>'id')
  loop
    -- lo conosciamo gia': una riga porta questo identificativo
    if exists (select 1 from movimenti_banca where lunchflow_id = r.lf_id) then
      gia_note := gia_note || r.lf_id;
      continue;
    end if;

    select m.id into gemello
      from movimenti_banca m
     where m.origine is distinct from 'lunchflow'
       and m.conto = p_conto
       and m.importo = r.importo
       and abs(m.data_operazione - r.d) <= 3
       and m.lunchflow_id is null
     order by abs(m.data_operazione - r.d), m.id
     limit 1;

    if gemello is not null then
      update movimenti_banca set lunchflow_id = r.lf_id where id = gemello;
      adottati := adottati || r.lf_id;
    end if;
    gemello := null;
  end loop;

  return jsonb_build_object('adottati', to_jsonb(adottati), 'gia_note', to_jsonb(gia_note));
end $$;

revoke execute on function public.lunchflow_abbina(text, jsonb) from public, anon;
revoke execute on function public.lunchflow_etichetta_conto(text) from public, anon;
