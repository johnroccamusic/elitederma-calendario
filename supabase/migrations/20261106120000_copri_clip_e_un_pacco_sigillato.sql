-- IL COPRI CLIP E' UN PACCO SIGILLATO, NON UNA RICETTA (6/11/2026).
--
-- Parole del titolare: «Copriclip sono pacchi da 125 pezzi dalla fabbrica
-- che poi noi apriamo per fare il pezzo singolo. Quindi e' giusto che
-- abbia giacenza propria».
--
-- In anagrafica era l'opposto: `tipo_prodotto = 'bundle'` con
-- `bundle_con_giacenza_fisica` spento, cioe' un BUNDLE VIRTUALE — una
-- ricetta che non esiste sullo scaffale e si compone al bisogno dai pezzi.
-- Le due cose si somigliano e sono opposte, e in app si vedeva: al sito
-- andava `floor(24.004 / 125) = 192` disponibili, mentre i pacchi chiusi a
-- magazzino sono **199**; e la sua giacenza (199) non la leggeva nessuno,
-- perche' su un bundle virtuale quel numero non vuol dire niente.
--
-- La forma giusta ce l'hanno gia' 18 prodotti — gli aghi, le lame, le
-- cuffie, i microbrush — ed e' quella che qui si copia:
--   tipo_prodotto           = 'semplice'   (un prodotto normale col suo stock)
--   bundle_con_giacenza_fisica = true      (e' una scatola vera, chiusa)
--   conta_magazzino         = true         (199 pacchi sono 199 pacchi)
--   prodotto_sfuso_id       -> «Copri clip 1pz»
--   pezzi_per_confezione    = 125
-- e NESSUNA riga di distinta: in questo impianto il legame coi pezzi non
-- passa da `bundle_componenti`, passa da `prodotto_sfuso_id` + l'azione
-- «Apri confezione», che e' un gesto fisico che qualcuno compie davvero.
-- Tutti e 18 i pacchi sigillati hanno zero righe di distinta: tenerne una
-- qui vorrebbe dire dichiarare due volte la stessa cosa in due modi che
-- un giorno si contraddicono.
--
-- IL COSTO VA SCRITTO, e non e' una cifra inventata. Finche' era un bundle
-- virtuale il costo glielo calcolava `conCostoDeiBundle` dalla distinta:
-- 125 x 0,01 = 1,25. Da `semplice` quel calcolo non lo tocca piu'
-- (`conCostoDeiBundle` guarda solo i bundle virtuali), quindi senza questa
-- riga il pacco resterebbe «senza costo di acquisto»: niente margine,
-- niente fascia di sconto, niente punti alla master su un prodotto che si
-- vende davvero (woo 625, 6,56 netto). Si scrive 1,25 perche' e'
-- esattamente il numero che l'app usa oggi: il margine non cambia di un
-- centesimo. Se il prezzo vero di fattura e' un altro, si corregge dalla
-- scheda del prodotto.
--
-- LA GIACENZA NON SI TOCCA: i 199 pacchi restano 199, e non c'e' nessun
-- movimento da scrivere. Cambia solo cosa l'app capisce di quel numero.

update public.prodotti_shop set
  tipo_prodotto = 'semplice',
  bundle_con_giacenza_fisica = true,
  conta_magazzino = true,
  prodotto_sfuso_id = '55e6a140-c6c2-4a7f-a49e-d33cc31e1ab5', -- Copri clip 1pz
  pezzi_per_confezione = 125,
  costo_acquisto = 1.25
where id = 'f3f56809-643b-41f4-ac7d-b08455e86eee';            -- Copri clip box da 125 pz

delete from public.bundle_componenti
 where bundle_id = 'f3f56809-643b-41f4-ac7d-b08455e86eee';

-- Per tornare indietro, se servisse:
--   update public.prodotti_shop set tipo_prodotto = 'bundle',
--     bundle_con_giacenza_fisica = false, conta_magazzino = false,
--     prodotto_sfuso_id = null, pezzi_per_confezione = null, costo_acquisto = null
--    where id = 'f3f56809-643b-41f4-ac7d-b08455e86eee';
--   insert into public.bundle_componenti (bundle_id, componente_id, quantita_per_bundle)
--   values ('f3f56809-643b-41f4-ac7d-b08455e86eee', '55e6a140-c6c2-4a7f-a49e-d33cc31e1ab5', 125);
--
-- Dopo questa migrazione il sito va riallineato (Gestione magazzino →
-- «Aggiorna lo shop», oppure il giro delle 05:30): la disponibilita'
-- pubblicata passa da 192 a 199, che e' il numero vero.
