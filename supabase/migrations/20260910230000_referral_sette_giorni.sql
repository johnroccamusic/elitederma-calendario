-- Il coupon di un corso dura sette giorni dopo l'ultimo giorno, non
-- quattordici.
--
-- La regola vive in tabella e non nel codice perche' e' una decisione
-- commerciale, non tecnica: la cambia chi decide gli sconti, senza
-- aspettare una pubblicazione. La funzione `genera-referral-automatico`
-- la rilegge a ogni giro, quindi il primo coupon nato dopo questa riga ha
-- gia' la scadenza nuova.
--
-- I coupon gia' emessi NON vengono toccati: sono codici che qualcuno ha
-- gia' dettato a un'allieva con una scadenza detta a voce, e accorciarla
-- dopo vorrebbe dire togliere qualcosa a chi ce l'ha in mano. Restano
-- validi come sono nati; si spengono da soli.
update public.regole_referral_automatico
set giorni_validita_dopo_corso = 7, aggiornato_ts = now();
