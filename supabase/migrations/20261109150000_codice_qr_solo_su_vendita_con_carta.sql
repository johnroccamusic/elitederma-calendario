-- IL CODICE DEL QR SOLO SU UNA VENDITA CON LA CARTA (9/11/2026)
--
-- L'8/11 alle 14:57:43 una cliente ha pagato col QR 274,61 €. Tre
-- secondi dopo il banco ha registrato un ALTRO carrello — 103,31 € in
-- CONTANTI, prodotti diversi, consegnato in aula — e quella vendita si
-- e' portata dietro il codice del pagamento appena riuscito, perche' lo
-- stato del QR sopravviveva alla vendita precedente.
--
-- Il danno peggiore non e' la riga storta: e' che il pagamento
-- risultava gia' legato a una vendita, quindi `recupera_vendite_qr_in_ritardo`
-- non ha mai registrato la vendita VERA — in logistica non e' comparso
-- niente da spedire, mentre alla cliente i soldi erano stati presi.
--
-- L'app e' stata corretta in due punti (il QR si azzera col carrello, e
-- `codiceIncassoDaRegistrare` scrive il codice solo dove puo' esistere),
-- ma una regola che vive solo nel browser non e' una regola.
--
-- NOT VALID: le righe gia' in archivio non si toccano. Ce n'e' UNA che
-- non la rispetta — POS-1794149866157, quella dell'8/11 — e va
-- sistemata a mano, come decide il titolare: convalidare il vincolo
-- adesso vorrebbe dire rifiutare quella riga, cioe' impedire di
-- correggerla.
--
-- Rollback:
--   alter table public.vendite_shop drop constraint vendite_shop_codice_solo_con_carta;
alter table public.vendite_shop
  add constraint vendite_shop_codice_solo_con_carta
  check (
    pagamento_codice is null
    or origine is distinct from 'pos'
    or metodo_pagamento in ('pos', 'misto')
  ) not valid;
