-- COMPOSIZIONE KIT E «IN ATTESA DI RICEZIONE» (15/11/2026)
--
-- Il titolare: «aggiungi la pagina "Composizione kit", che si apre dopo
-- la raccolta del materiale» e «un nuovo pulsante, a destra del flag,
-- "In attesa di ricezione", che colora la riga di arancione […] Finché
-- la lista mancanti di un corso non è vuota, il pulsante "Pacco
-- preparato" di quel corso resta disattivato».
--
-- Due mappe nuove sulla riga dell'edizione, accanto a `checklist` che
-- tiene le spunte della raccolta. Stessa forma: chiave -> { il, da }.
--
--   in_attesa     la riga di raccolta di un prodotto che non c'è ancora:
--                 ordinato, in arrivo. Non è il contrario di «preso»:
--                 è un terzo stato, e per questo non si poteva scrivere
--                 dentro `checklist`, dove qualunque valore vale «preso».
--   kit_composti  il kit le cui buste sono state riempite tutte, segnato
--                 dal tasto verde accanto al titolo del blocco.
--
-- Perché una colonna e non un calcolo: «in attesa» è una cosa che una
-- persona dichiara guardando lo scaffale, non si deduce dalla giacenza —
-- un prodotto può esserci a magazzino e non essere in questa stanza.
--
-- Misurato prima: 50 righe, nessuna con la checklist scritta, 19 ferme
-- su «da_preparare». Quindi il blocco nasce senza bloccare niente: una
-- riga in attesa oggi non esiste.
--
-- ROLLBACK:
--   alter table public.logistica_kit_edizioni
--     drop column if exists in_attesa,
--     drop column if exists kit_composti;
--   (si perde quello che era in attesa e quali kit erano composti)

alter table public.logistica_kit_edizioni
  add column if not exists in_attesa jsonb not null default '{}'::jsonb,
  add column if not exists kit_composti jsonb not null default '{}'::jsonb;

comment on column public.logistica_kit_edizioni.in_attesa is
  'Righe della raccolta materiale in attesa di ricezione (chiave riga -> {il, da}): il prodotto è ordinato e non ancora arrivato. Finché ce n''è una, il pacco non si può dichiarare preparato.';
comment on column public.logistica_kit_edizioni.kit_composti is
  'Kit le cui buste sono state riempite tutte (kit_id -> {il, da}), dal tasto verde della pagina Composizione kit.';
