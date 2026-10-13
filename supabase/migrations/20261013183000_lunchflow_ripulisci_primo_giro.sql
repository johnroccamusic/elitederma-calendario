-- LA PULIZIA DEL PRIMO GIRO DI LUNCH FLOW. Una volta sola.
--
-- Il primo giro (13/10/2026, 18:08) ha scritto 522 movimenti senza sapere
-- che la quasi totalita' era gia' in tabella, importata dal file
-- dell'estratto conto. Qui ognuno cerca il suo gemello fra quelle righe
-- (stesso conto, stesso importo, data entro tre giorni): il gemello
-- prende `lunchflow_id` e la copia di Lunch Flow se ne va.
--
-- Vince la riga che c'era: si porta dietro riconciliazione, nota, stato e
-- collegamento alla spesa. Uno a uno, cosi' due addebiti uguali dello
-- stesso giorno non si schiacciano in uno.
--
-- Prima di partire, le 522 righe sono tutte in
-- _backup_lunchflow_doppioni_20261013. E si potrebbero comunque
-- riscaricare: l'identificativo di Lunch Flow e' stabile.
--
-- ORDINE OBBLIGATO: prima si cancella la copia, poi si timbra il gemello.
-- C'e' un indice unico su `lunchflow_id`, e finche' la copia lo tiene il
-- timbro viene rifiutato.
--
-- Non si puo' usare lunchflow_abbina(): quella, prima di cercare,
-- controlla che nessuna riga porti gia' quell'identificativo — giusto per
-- i giri normali, ma qui le righe che lo portano sono quelle da togliere.

begin;

do $$
declare
  r record;
  gemello uuid;
  adottati int := 0;
begin
  for r in
    select id, data_operazione, importo, lunchflow_id
      from movimenti_banca where origine = 'lunchflow'
     order by data_operazione, id
  loop
    select m.id into gemello
      from movimenti_banca m
     where m.origine is distinct from 'lunchflow'
       and m.conto = 'CC0010523827'
       and m.importo = r.importo
       and abs(m.data_operazione - r.data_operazione) <= 3
       and m.lunchflow_id is null
     order by abs(m.data_operazione - r.data_operazione), m.id
     limit 1;

    if gemello is not null then
      delete from movimenti_banca where id = r.id;
      update movimenti_banca set lunchflow_id = r.lunchflow_id where id = gemello;
      adottati := adottati + 1;
    end if;
    gemello := null;
  end loop;
  raise notice 'doppioni assorbiti: %', adottati;
end $$;

-- Le superstiti prendono l'etichetta che il pannello mostra gia': il file
-- chiama il conto col numero, Lunch Flow manda l'IBAN intero che finisce
-- con quello. Due nomi vorrebbero dire due conti nei filtri.
update movimenti_banca set conto = 'CC0010523827'
 where origine = 'lunchflow' and conto <> 'CC0010523827';

commit;

-- Il controllo, da leggere subito dopo.
select
 (select count(*) from movimenti_banca where origine = 'lunchflow')                        as lunchflow_restate,
 (select count(*) from movimenti_banca where origine = 'file' and lunchflow_id is not null) as file_abbinate,
 (select count(*) from movimenti_banca)                                                     as totale_prima_nota,
 (select count(*) from _backup_lunchflow_doppioni_20261013)                                 as al_sicuro;
