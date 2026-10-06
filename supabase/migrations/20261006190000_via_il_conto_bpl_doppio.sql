-- Applicata via MCP il 06/10/2026, su richiesta esplicita.
--
-- Il conto "BPL" non esiste: era il nome di ripiego che l'app si dava
-- quando leggeva il solo CSV, che il numero di conto non ce l'ha. Cosi'
-- lo stesso estratto, caricato un file per volta, e' entrato due volte:
-- 563 righe sul conto vero e 120 su un conto fantasma, 118 delle quali
-- gemelle esatte delle prime.
--
-- Qui si tolgono le 120. Nell'ordine: una copia di sicurezza, il poco
-- lavoro che stava solo sulla copia sbagliata spostato sulla gemella, le
-- gemelle cancellate, e le due righe che gemella non ce l'hanno portate
-- sul conto vero — perche' sono movimenti veri di quel conto.

-- 1. La copia di sicurezza, prima di toccare qualunque cosa.
create table if not exists movimenti_banca_scartati_20261006 as
  select * from movimenti_banca where conto = 'BPL';

-- 2. Il collegamento a una spesa VERA che sta solo sulla copia BPL passa
--    alla gemella. Sono due righe ("Commissione bonifico disposto online
--    BPLAZIO"): la gemella ha un collegamento che punta a una spesa
--    cancellata, quindi non si perde niente a sovrascriverlo.
update movimenti_banca c
   set stato = b.stato,
       collegato_tipo = b.collegato_tipo,
       collegato_id = b.collegato_id,
       nota = coalesce(c.nota, b.nota)
  from movimenti_banca b
 where b.conto = 'BPL' and c.conto <> 'BPL'
   and c.data_operazione = b.data_operazione
   and c.importo = b.importo
   and c.progressivo = b.progressivo
   and exists (select 1 from spese s where s.id = b.collegato_id)
   and not exists (select 1 from spese s where s.id = c.collegato_id);

-- 3. Via le gemelle.
delete from movimenti_banca b
 where b.conto = 'BPL'
   and exists (
     select 1 from movimenti_banca c
      where c.conto <> 'BPL'
        and c.data_operazione = b.data_operazione
        and c.importo = b.importo
        and c.progressivo = b.progressivo);

-- 4. Le due rimaste sono movimenti veri che sul conto vero non c'erano:
--    passano li', con l'impronta rifatta.
update movimenti_banca b
   set conto = v.conto,
       impronta = v.conto || '|' || b.data_operazione::text || '|' || b.importo::text || '|' || b.progressivo::text
  from (select conto from movimenti_banca where conto <> 'BPL' order by data_operazione desc limit 1) v
 where b.conto = 'BPL';
