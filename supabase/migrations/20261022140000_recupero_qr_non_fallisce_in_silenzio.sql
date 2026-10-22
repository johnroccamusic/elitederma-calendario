-- UN RECUPERO CHE FALLISCE NON PUO' FALLIRE IN SILENZIO (22/10/2026).
--
-- `recupera_vendite_qr_in_ritardo` gira ogni cinque minuti e torna un
-- jsonb con dentro `falliti`. Il cron la chiama con un `select` e butta
-- via quel risultato: nessuno lo legge, mai.
--
-- Cosi' e' andata il 22/10. Una vendita al banco non pagata, il link
-- rimandato dal dettaglio ordine, la cliente paga — e il pagamento resta
-- senza vendita. Il recupero prova a crearne una NUOVA dalle righe della
-- richiesta, ma li' dentro c'e' una riga sola che si chiama «Ordine
-- POS-1792489505013»: a catalogo non esiste, e la funzione risponde
-- «righe senza prodotto a catalogo». Ha risposto cosi' ogni cinque
-- minuti per ore, e l'unica cosa che si vedeva era l'Advisor che
-- continuava a dire «incasso rimasto indietro» senza dire perche'.
--
-- Adesso il motivo finisce in `avvisi_magazzino`, dove l'Advisor lo
-- legge: una riga per codice, che non si ripete a ogni giro.
--
-- (La causa a monte e' chiusa a parte: `stripe-crea-pagamento` scrive
-- `pagamenti_pos.vendita_id` quando il link riscuote un ordine gia'
-- fatto, cosi' il recupero non ha niente da creare e salta la riga.)
create or replace function public.recupera_vendite_qr_in_ritardo()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  p          record;
  v_esito    jsonb;
  v_fatte    int := 0;
  v_sospese  int := 0;
  v_falliti  jsonb := '[]'::jsonb;
  v_prodotti uuid[];
  v_gemella  record;
  v_motivo   text;
begin
  for p in
    select pp.codice, pp.importo, pp.pagato_il from pagamenti_pos pp
     where pp.pagato_il is not null
       and pp.vendita_id is null
       and pp.pagato_il < now() - interval '5 minutes'
       and not exists (
         select 1 from vendite_shop v where v.pagamento_codice = pp.codice
       )
     order by pp.pagato_il
     limit 50
  loop
    select v.id, v.numero_ordine, v.data_ordine, v.operatore_nome
      into v_gemella
      from vendite_shop v
     where v.origine = 'pos'
       and v.pagamento_codice is null
       and coalesce(v.tipo_movimento,'vendita') = 'vendita'
       and v.totale = p.importo
       and v.data_ordine between p.pagato_il - interval '15 minutes'
                             and p.pagato_il + interval '15 minutes'
     order by abs(extract(epoch from (v.data_ordine - p.pagato_il)))
     limit 1;

    if found then
      v_sospese := v_sospese + 1;
      insert into avvisi_magazzino (tipo, messaggio, numero_ordine, operatore, vendita_id)
      select 'qr_forse_gia_registrato',
             format('Incasso QR %s di %s € pagato il %s: NON registrato perche'' esiste gia'' la vendita al banco %s dello stesso importo, a %s secondi di distanza. Se sono la stessa cosa, collegala; se sono due vendite diverse, registrala a mano.',
                    p.codice, p.importo, to_char(p.pagato_il at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI'),
                    v_gemella.numero_ordine,
                    abs(extract(epoch from (v_gemella.data_ordine - p.pagato_il)))::int),
             v_gemella.numero_ordine, v_gemella.operatore_nome, v_gemella.id
       where not exists (
         select 1 from avvisi_magazzino a
          where a.tipo = 'qr_forse_gia_registrato'
            and a.messaggio like '%' || p.codice || '%'
            and a.risolto_il is null
       );
      continue;
    end if;

    v_motivo := null;
    begin
      select registra_vendita_da_pagamento(p.codice) into v_esito;
      if coalesce((v_esito->>'ok')::boolean, false) then
        v_fatte := v_fatte + 1;
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
        v_motivo := coalesce(v_esito->>'motivo', 'motivo non detto');
        if v_esito ? 'righe' then
          v_motivo := v_motivo || ' (' || coalesce(v_esito->>'righe', '') || ')';
        end if;
        v_falliti := v_falliti || jsonb_build_object('codice', p.codice, 'motivo', v_motivo);
      end if;
    exception when others then
      v_motivo := sqlerrm;
      v_falliti := v_falliti || jsonb_build_object('codice', p.codice, 'errore', v_motivo);
    end;

    -- IL MOTIVO SI SCRIVE DOVE QUALCUNO LO LEGGE. Finiva solo nel jsonb
    -- di ritorno, e il cron lo butta via: per ore l'unica cosa visibile
    -- era «incasso rimasto indietro», senza il perche'.
    --
    -- Una riga per codice: il recupero riprova ogni cinque minuti, e un
    -- avviso ripetuto trecento volte al giorno non lo legge piu' nessuno.
    if v_motivo is not null then
      insert into avvisi_magazzino (tipo, messaggio, numero_ordine, operatore)
      select 'qr_recupero_fallito',
             format('Incasso QR %s di %s € pagato il %s: la vendita NON si riesce a registrare da sola — %s. Finche'' resta cosi'' il recupero riprova ogni cinque minuti e fallisce ogni volta: va registrata a mano dall''Advisor, o collegata alla vendita a cui appartiene.',
                    p.codice, p.importo,
                    to_char(p.pagato_il at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI'),
                    v_motivo),
             null, null
       where not exists (
         select 1 from avvisi_magazzino a
          where a.tipo = 'qr_recupero_fallito'
            and a.messaggio like '%' || p.codice || '%'
            and a.risolto_il is null
       );
    end if;
  end loop;

  return jsonb_build_object('recuperate', v_fatte, 'sospese_per_doppione', v_sospese, 'falliti', v_falliti);
end;
$function$;

-- Il caso che ha fatto scoprire tutto, ricucito a mano il 22/10/2026:
-- l'incasso AADTJZ collegato alla vendita POS-1792489505013, e la
-- vendita a lui. Qui per memoria, non per rieseguirlo: i `where`
-- lasciano stare quello che e' gia' collegato.
update pagamenti_pos p
   set vendita_id = v.id, aggiornato_il = now()
  from vendite_shop v
 where p.codice = 'AADTJZ' and v.numero_ordine = 'POS-1792489505013' and p.vendita_id is null;
update vendite_shop
   set pagamento_codice = 'AADTJZ'
 where numero_ordine = 'POS-1792489505013' and pagamento_codice is null;
