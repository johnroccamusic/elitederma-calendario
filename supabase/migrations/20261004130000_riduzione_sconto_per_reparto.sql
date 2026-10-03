-- La riduzione dello sconto massimo, reparto per reparto.
--
-- Il calcolo dice quanto si POTREBBE cedere dividendo il guadagno a meta'
-- col rivenditore. Su un reparto si puo' voler cedere meno — per
-- margine, per politica, perche' quella linea la si vuole tenere alta — e
-- questa tabella e' il posto dove dirlo: punti percentuali da togliere a
-- tutti i prodotti di quel reparto. Nove su un 29,5% fanno 20,5%.
--
-- Sta nel database e non nella pagina perche' lo stesso sconto decide il
-- prezzo rivenditore, la quota master e i punti: tenerlo in un posto solo
-- e' l'unico modo perche' le tre cose non si allontanino.
--
-- IL PAVIMENTO DEL 5% vale sul calcolo, non sulla scelta. Serve a non
-- lasciare un rivenditore senza margine per colpa dell'arrotondamento,
-- non a impedire una decisione: se si tolgono nove punti, nove si
-- tolgono, anche sotto il cinque.
create table if not exists listino_riduzioni_blocco (
  blocco_ordine integer primary key,
  punti numeric not null default 0 check (punti >= 0 and punti <= 50),
  nota text,
  updated_at timestamptz not null default now()
);

alter table listino_riduzioni_blocco enable row level security;
drop policy if exists "accesso interno listino_riduzioni_blocco" on listino_riduzioni_blocco;
create policy "accesso interno listino_riduzioni_blocco" on listino_riduzioni_blocco
  for all to anon, authenticated using (true) with check (true);

-- Nella view: `riduzione_reparto` nel CTE `calcolato`, sottratta dopo il
-- pavimento nel CTE `prezzi`, ed esposta in coda. Corpo completo nella
-- migrazione 20261004110000.
