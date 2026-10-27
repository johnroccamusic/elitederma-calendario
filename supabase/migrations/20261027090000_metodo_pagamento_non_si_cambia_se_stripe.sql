-- IL METODO DI PAGAMENTO SI CORREGGE, MA NON SU UN INCASSO STRIPE
-- (27/10/2026). Il titolare: le master a volte battono POS invece di
-- contanti o viceversa, e chi amministra deve poter rettificare dalla
-- pagina Vendite al banco, lasciando l'incasso com'e'. Pero' una vendita
-- incassata davvero con Stripe non si puo' far diventare «contanti»: i
-- soldi sono arrivati sul conto, e cambiare l'etichetta la toglierebbe
-- dalle fatture da emettere e la metterebbe in una busta di contanti che
-- non ha mai visto. La pagina lo impedisce; qui lo impedisce il database,
-- perche' un controllo che vive solo nel browser non e' un controllo.
create or replace function public.vendite_shop_metodo_non_si_cambia_se_stripe()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.metodo_pagamento is distinct from old.metodo_pagamento
     and old.metodo_pagamento = 'pos'
     and exists (
       select 1 from pagamenti_pos pp
       where pp.pagato_il is not null
         and (pp.vendita_id = old.id or (old.pagamento_codice is not null and pp.codice = old.pagamento_codice))
     ) then
    raise exception 'INCASSO_STRIPE: la vendita % e'' stata incassata con Stripe e il metodo di pagamento non si puo'' cambiare.', old.numero_ordine;
  end if;
  return new;
end $$;
drop trigger if exists vendite_shop_metodo_non_si_cambia_se_stripe on public.vendite_shop;
create trigger vendite_shop_metodo_non_si_cambia_se_stripe
  before update of metodo_pagamento on public.vendite_shop
  for each row execute function public.vendite_shop_metodo_non_si_cambia_se_stripe();
