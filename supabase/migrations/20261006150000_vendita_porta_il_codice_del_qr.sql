-- Applicata via MCP il 06/10/2026.
--
-- IL BUCO. Il POS, chiusa la vendita pagata col QR, scrive il legame
-- sull'incasso (pagamenti_pos.vendita_id). Se quella scrittura non riesce
-- — un attimo di rete subito dopo la vendita — l'incasso resta scollegato,
-- e cinque minuti dopo recupera_vendite_qr_in_ritardo lo vede "pagato e
-- senza vendita" e ne crea una SECONDA, con un altro numero e un altro
-- scarico di magazzino. La guardia che c'era guardava solo vendita_id:
-- esattamente il campo che non si era scritto.
--
-- LA CHIUSURA. La vendita si porta dietro il codice dell'incasso. Cosi' il
-- recupero non dipende piu' da una scrittura che puo' fallire: prima di
-- creare qualcosa guarda se una vendita con quel codice esiste gia'.
alter table vendite_shop
  add column if not exists pagamento_codice text;

create index if not exists vendite_shop_pagamento_codice_idx
  on vendite_shop (pagamento_codice) where pagamento_codice is not null;

comment on column vendite_shop.pagamento_codice is
  'Il codice della richiesta di pagamento col QR (pagamenti_pos.codice) da cui nasce la vendita. Serve a non registrarla due volte.';

create or replace function recupera_vendite_qr_in_ritardo()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  p          record;
  v_esito    jsonb;
  v_fatte    int := 0;
  v_falliti  jsonb := '[]'::jsonb;
  v_prodotti uuid[];
begin
  for p in
    select pp.codice from pagamenti_pos pp
     where pp.pagato_il is not null
       and pp.vendita_id is null
       and pp.pagato_il < now() - interval '5 minutes'
       -- la seconda guardia: una vendita che gia' nomina questo incasso
       -- esiste, e il legame e' solo quello che non si e' scritto
       and not exists (
         select 1 from vendite_shop v where v.pagamento_codice = pp.codice
       )
     order by pp.pagato_il
     limit 50
  loop
    begin
      select registra_vendita_da_pagamento(p.codice) into v_esito;
      if coalesce((v_esito->>'ok')::boolean, false) then
        v_fatte := v_fatte + 1;
        -- WooCommerce deve sapere che quei pezzi sono usciti: da qui si
        -- chiama l'edge function che riallinea solo i prodotti toccati.
        select array_agg(distinct m.prodotto_id) into v_prodotti
          from movimenti_magazzino m
         where m.riferimento = v_esito->>'numero_ordine' and m.origine = 'vendita_pos';
        if coalesce(array_length(v_prodotti, 1), 0) > 0 then
          perform net.http_post(
            url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/woo-riallinea-shop',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer sb_publishable_iTZrQc7ZmQfKuVMBnfk7LQ_s_SbnxGZ'),
            body := jsonb_build_object('prodottiIds', to_jsonb(v_prodotti))
          );
        end if;
      else
        v_falliti := v_falliti || jsonb_build_object('codice', p.codice, 'motivo', v_esito->>'motivo');
      end if;
    exception when others then
      v_falliti := v_falliti || jsonb_build_object('codice', p.codice, 'errore', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('recuperate', v_fatte, 'falliti', v_falliti);
end;
$function$;

-- Le vendite col QR gia' registrate: si recupera il codice dall'incasso a
-- cui sono legate, cosi' anche lo storico ha la sua difesa.
update vendite_shop v
   set pagamento_codice = pp.codice
  from pagamenti_pos pp
 where pp.vendita_id = v.id
   and v.pagamento_codice is null;
