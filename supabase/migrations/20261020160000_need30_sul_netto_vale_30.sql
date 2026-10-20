-- `need30` e' 30% sul netto, e al sito va 30 — non 24,59.
--
-- La regola stava gia' scritta sul coupon (`base_sconto = 'netto'`) dal
-- giorno in cui e' stato creato: a leggerla male era il conto. Scontare
-- il 30% dell'imponibile e poi aggiungere l'IVA da' lo stesso totale che
-- scontare il 30% del prezzo finale — l'IVA e' proporzionale — e invece
-- si prendeva il 30% del netto e lo si toglieva dal lordo, cioe' due
-- lati diversi nella stessa operazione. Uscivano 24,59%.
--
-- `valore_woo` portava quella conversione, quindi anche il sito scontava
-- 24,59%. Qui si rimette uguale a `valore`; perche' arrivi davvero sul
-- sito il coupon va ripubblicato su WooCommerce.
--
-- Le vendite gia' registrate non si toccano: sono state battute cosi' e
-- quello e' stato incassato.
update public.coupon
   set valore_woo = valore
 where codice = 'need30' and base_sconto = 'netto';
