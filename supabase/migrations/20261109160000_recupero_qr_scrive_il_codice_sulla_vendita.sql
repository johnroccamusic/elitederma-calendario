-- IL RECUPERO DI UNA VENDITA PAGATA COL QR NON POTEVA RIUSCIRE (9/11/2026)
--
-- Trovato rimettendo in pari l'ordine di Rossella Becarelli (274,61 €
-- pagati l'8/11 e mai comparsi in logistica).
--
-- `registra_vendita_da_pagamento` — la funzione che ricostruisce una
-- vendita dalle righe della richiesta di pagamento, quella che usa il
-- cron `recupera_vendite_qr_in_ritardo` — compone la vendita con
-- `metodo_pagamento = 'pos'` ma SENZA `pagamento_codice`. Dal 23/10/2026
-- `registra_vendita_pos` pretende quel codice per accettare una vendita
-- con la carta, quindi OGNI recupero falliva con PAGAMENTO_NON_PROVATO:
-- la rete di sicurezza c'era e non poteva prendere niente.
--
-- Si aggiunge una sola chiave al payload. La sostituzione avviene sul
-- testo della funzione VIVA (pg_get_functiondef) invece di riscriverne
-- il corpo a mano: cosi' il resto resta identico carattere per
-- carattere, e se il corpo non e' quello atteso non si tocca niente.
--
-- Rollback: rieseguire la stessa cosa togliendo la riga aggiunta, oppure
-- ripubblicare la definizione precedente.
do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registra_vendita_da_pagamento';
  if def is null then
    raise exception 'registra_vendita_da_pagamento non esiste';
  end if;
  if position('''pagamento_codice''' in def) > 0 then
    raise notice 'gia a posto';
    return;
  end if;
  if position(E'''metodo_pagamento'',  ''pos'',' in def) = 0 then
    raise exception 'il corpo della funzione non e'' quello atteso: non tocco niente';
  end if;
  def := replace(def,
    E'''metodo_pagamento'',  ''pos'',',
    E'''metodo_pagamento'',  ''pos'',' || E'\n    -- il codice dell''incasso, SULLA vendita: senza, registra_vendita_pos\n    -- rifiuta una vendita con la carta (PAGAMENTO_NON_PROVATO) e il\n    -- recupero non puo'' riuscire mai\n    ''pagamento_codice'',  pag.codice,');
  execute def;
end $$;
