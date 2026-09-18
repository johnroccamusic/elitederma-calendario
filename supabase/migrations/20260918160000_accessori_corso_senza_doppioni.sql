-- I doppioni lasciati dalla lettura troncata, e il modo perche' non
-- tornino.
--
-- PostgREST tronca ogni risposta a 1000 righe, in silenzio.
-- corsi_kit_prodotti ne aveva 1298: le righe piu' recenti non
-- arrivavano all'app, quindi "carica lista da un altro corso" sembrava
-- non fare niente. Ogni clic scriveva davvero, e il controllo
-- anti-doppione — che guarda la lista in memoria — non poteva scattare
-- su una lista vuota. Su COLORI sono sei liste sovrapposte.
--
-- Il codice e' gia' corretto (leggiTutte in src/supabase.js). Qui si
-- toglie lo sporco che quel bug ha prodotto, e si mette un vincolo che
-- rende impossibile rifarlo: se un domani una lettura tornera' di nuovo
-- corta, l'inserimento fallira' invece di duplicare in silenzio.
--
-- Righe cancellate: 152 (151 su COLORI, 1 su EXTEN VOL IND). Erano
-- copie esatte, tutte quantita = 1: non si perde nessuna informazione,
-- resta la piu' vecchia di ogni prodotto.

delete from corsi_kit_prodotti ckp
where ckp.tipo = 'accessorio'
  and ckp.kit_id is null
  and exists (
    select 1 from corsi_kit_prodotti piu_vecchia
    where piu_vecchia.tipo = 'accessorio'
      and piu_vecchia.kit_id is null
      and piu_vecchia.corso_id is not distinct from ckp.corso_id
      and piu_vecchia.prodotto_id = ckp.prodotto_id
      and (piu_vecchia.ts, piu_vecchia.id) < (ckp.ts, ckp.id)
  );

-- un accessorio didattico e' una riga sola per corso, con una quantita:
-- due righe sullo stesso prodotto non hanno mai voluto dire niente
create unique index if not exists corsi_kit_prodotti_accessorio_unico
  on corsi_kit_prodotti (corso_id, prodotto_id)
  where tipo = 'accessorio' and kit_id is null;
