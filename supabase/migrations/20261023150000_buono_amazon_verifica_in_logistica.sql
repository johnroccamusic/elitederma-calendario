-- IL BUONO AMAZON SI VERIFICA IN LOGISTICA (23/10/2026).
--
-- Al banco «Buono Amazon» e' una dichiarazione come il contante: nessuno
-- controlla che il codice esista, che sia stato riscattato, che copra il
-- carrello — e lo puo' scegliere chiunque usi il POS. Ma a differenza del
-- contante il pacco poi PARTE: quattro spedizioni con buono sono gia'
-- uscite senza che nessuno le abbia riguardate.
--
-- Deciso dal titolare: l'ordine pagato con buono compare in logistica con
-- il tasto «In attesa di verifica pagamento»; chi lo preme dichiara di
-- aver controllato il buono, il tasto diventa «Verificato» e solo allora
-- si spedisce. La verifica sta sulla VENDITA (non sul pacco), con chi e
-- quando: e' il pagamento che si verifica, e lo si rilegge anche da
-- incassi e fatture.
--
-- Il trigger e' la serratura: una spedizione di un ordine con buono non
-- verificato non passa a «spedito», da nessuna pagina. Un controllo che
-- vive solo nel browser non e' un controllo (19/10, 22/10, 23/10).

alter table public.vendite_shop
  add column if not exists pagamento_verificato_il timestamptz,
  add column if not exists pagamento_verificato_da text;

comment on column public.vendite_shop.pagamento_verificato_il is
  'Buono Amazon: quando qualcuno in logistica ha verificato il buono. Finche'' e'' null il pacco non parte.';
comment on column public.vendite_shop.pagamento_verificato_da is
  'Chi ha verificato il buono (nome di chi era collegato).';

create or replace function public.spedizioni_pos_spedito_vuole_pagamento_verificato()
 returns trigger
 language plpgsql
 set search_path = public
as $function$
declare
  v_metodo text;
  v_verificato timestamptz;
  v_numero text;
begin
  if new.stato = 'spedito' and old.stato is distinct from 'spedito' and new.vendita_id is not null then
    select metodo_pagamento, pagamento_verificato_il, numero_ordine
      into v_metodo, v_verificato, v_numero
      from vendite_shop where id = new.vendita_id;
    if v_metodo = 'buono_amazon' and v_verificato is null then
      raise exception 'PAGAMENTO_DA_VERIFICARE: l''ordine % e'' pagato con buono Amazon e il buono non e'' ancora stato verificato. Prima la verifica, poi la spedizione.',
        coalesce(v_numero, new.vendita_id::text);
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists spedizioni_pos_spedito_vuole_pagamento_verificato on public.spedizioni_pos;
create trigger spedizioni_pos_spedito_vuole_pagamento_verificato
  before update of stato on public.spedizioni_pos
  for each row execute function public.spedizioni_pos_spedito_vuole_pagamento_verificato();

comment on trigger spedizioni_pos_spedito_vuole_pagamento_verificato on public.spedizioni_pos is
  'Un ordine pagato con buono Amazon si spedisce solo dopo che qualcuno ha verificato il buono (vendite_shop.pagamento_verificato_il).';
