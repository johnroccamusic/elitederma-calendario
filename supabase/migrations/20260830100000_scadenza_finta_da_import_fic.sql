-- ---------------------------------------------------------
-- Le scadenze che non erano scadenze: il giorno in cui FIC ha importato.
--
-- Fatture in Cloud non lascia mai una spesa senza scadenza. Quando l'XML del
-- fornitore non porta termini di pagamento, all'importazione crea una rata
-- unica con termini "0 giorni" e ci scrive come scadenza IL GIORNO IN CUI HA
-- IMPORTATO IL DOCUMENTO. La fattura Helen Eyes n. 642-2026 del 7 luglio
-- "scadeva" il 24 agosto solo perché il 24 agosto FIC ne ha ingoiato l'XML.
--
-- Su 56 fatture da luglio 2026 in avanti, 36 avevano quella data. Riportarle
-- in documento_fornitore significava generare, alla riconciliazione,
-- scadenze passive già scadute il giorno stesso.
--
-- Qui si azzerano quelle riconoscibili con certezza: la scadenza coincide
-- con il giorno di importazione in FIC E non ci sono termini di pagamento
-- veri (nessuna rata, o una sola rata a "0 giorni"). Restano intatti i
-- documenti già riconciliati — quelli hanno già le loro scadenze passive
-- generate, e riscriverne la previsione a posteriori non aggiusta niente.
--
-- Da qui in avanti ci pensa la sincronizzazione (fic-sync-documenti,
-- scadenzaPrevistaVera): la data la mette l'operatore quando riconcilia.
-- ---------------------------------------------------------

update public.documento_fornitore d
   set data_scadenza_prevista = null
  from public.fatture_ricevute_fic f
 where f.fic_id = d.fic_id
   and d.data_scadenza_prevista is not null
   and d.stato <> 'riconciliato'
   and (f.payload_raw->>'next_due_date') = substring(f.payload_raw->>'created_at' from 1 for 10)
   and coalesce(jsonb_array_length(f.payload_raw->'payments_list'), 0) <= 1
   and coalesce((f.payload_raw->'payments_list'->0->'payment_terms'->>'days')::int, 0) = 0;
