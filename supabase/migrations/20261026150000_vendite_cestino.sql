-- IL CESTINO DELLE VENDITE (26/10/2026). Stamattina alle 11:18 tre
-- vendite incassate di Elia Cito (PMU Napoli, 8-9/10) sono sparite con il
-- cestino di Vendite al banco: nessuna copia, nessun nome di chi l'ha
-- premuto. Deciso dal titolare: una vendita non si cancella, si mette nel
-- cestino, da cui si ripristina per sei mesi; poi il cestino si svuota.
create table if not exists vendite_cestino (
  id uuid primary key,                      -- lo stesso id della vendita
  numero_ordine text,
  data_ordine timestamptz,
  operatore_nome text,
  totale numeric,
  metodo_pagamento text,
  origine text,
  riga jsonb not null,                      -- la riga intera di vendite_shop
  collegate jsonb not null default '[]',    -- resi/annullamenti collegati
  spedizioni jsonb not null default '[]',   -- spedizioni_pos con le righe preparate
  cestinata_il timestamptz not null default now(),
  cestinata_da text,
  motivo text
);
create index if not exists vendite_cestino_quando on vendite_cestino (cestinata_il);
alter table vendite_cestino enable row level security;
drop policy if exists vendite_cestino_interno on vendite_cestino;
create policy vendite_cestino_interno on vendite_cestino for select to authenticated using (true);

-- Mette nel cestino e cancella, nella stessa transazione: o tutto o
-- niente. Lo stock lo rimette l'app PRIMA di chiamare (muoviStock e'
-- l'unico punto che scrive la giacenza).
create or replace function public.vendita_cestina(p_id uuid, p_chi text default null, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v vendite_shop;
  v_collegate jsonb;
  v_sped jsonb;
begin
  select * into v from vendite_shop where id = p_id;
  if not found then raise exception 'Vendita % non trovata', p_id; end if;
  select coalesce(jsonb_agg(to_jsonb(c)), '[]') into v_collegate from vendite_shop c where c.vendita_collegata_id = p_id;
  select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('righe_preparate',
           (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from righe_preparate_spedizione r where r.spedizione_pos_id = s.id))), '[]')
    into v_sped from spedizioni_pos s where s.vendita_id = p_id;
  insert into vendite_cestino (id, numero_ordine, data_ordine, operatore_nome, totale, metodo_pagamento, origine, riga, collegate, spedizioni, cestinata_da, motivo)
  values (v.id, v.numero_ordine, v.data_ordine, v.operatore_nome, v.totale, v.metodo_pagamento, v.origine, to_jsonb(v), v_collegate, v_sped, p_chi, p_motivo);
  delete from righe_preparate_spedizione where spedizione_pos_id in (select id from spedizioni_pos where vendita_id = p_id);
  delete from spedizioni_pos where vendita_id = p_id;
  delete from vendite_shop where vendita_collegata_id = p_id;
  delete from vendite_shop where id = p_id;
  return jsonb_build_object('id', v.id, 'numero_ordine', v.numero_ordine);
end $$;

-- Ripristina dal cestino: rimette la vendita, i movimenti collegati e le
-- spedizioni com'erano, e toglie la riga dal cestino. Lo scarico del
-- magazzino lo rifa' l'app DOPO, con muoviStock.
create or replace function public.vendita_ripristina(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c vendite_cestino;
  s jsonb;
  r jsonb;
begin
  select * into c from vendite_cestino where id = p_id;
  if not found then raise exception 'Vendita % non e'' nel cestino', p_id; end if;
  if exists (select 1 from vendite_shop where id = p_id) then raise exception 'La vendita % esiste gia''', p_id; end if;
  insert into vendite_shop select * from jsonb_populate_record(null::vendite_shop, c.riga);
  for r in select * from jsonb_array_elements(c.collegate) loop
    insert into vendite_shop select * from jsonb_populate_record(null::vendite_shop, r) on conflict (id) do nothing;
  end loop;
  for s in select * from jsonb_array_elements(c.spedizioni) loop
    insert into spedizioni_pos select * from jsonb_populate_record(null::spedizioni_pos, s - 'righe_preparate') on conflict (id) do nothing;
    for r in select * from jsonb_array_elements(coalesce(s->'righe_preparate', '[]')) loop
      insert into righe_preparate_spedizione select * from jsonb_populate_record(null::righe_preparate_spedizione, r) on conflict (id) do nothing;
    end loop;
  end loop;
  delete from vendite_cestino where id = p_id;
  return c.riga;
end $$;

revoke all on function public.vendita_cestina(uuid, text, text) from public, anon;
grant execute on function public.vendita_cestina(uuid, text, text) to authenticated, service_role;
revoke all on function public.vendita_ripristina(uuid) from public, anon;
grant execute on function public.vendita_ripristina(uuid) to authenticated, service_role;

-- dopo sei mesi il cestino si svuota da solo, ogni notte
select cron.unschedule('vendite-cestino-svuota') where exists (select 1 from cron.job where jobname = 'vendite-cestino-svuota');
select cron.schedule('vendite-cestino-svuota', '20 4 * * *', $$delete from public.vendite_cestino where cestinata_il < now() - interval '6 months'$$);
