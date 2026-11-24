-- «IN SPEDIZIONE» NON ERA FRA GLI STATI AMMESSI, E NESSUNA CAMPAGNA POTEVA PARTIRE.
-- 24/11/2026.
--
-- Il titolare, provando a spedire la prima campagna vera: «la prova ha
-- funzionato ma l'invio massivo no: Edge Function returned a non-2xx
-- status code».
--
-- IL DIFETTO ERA UNA RIGA SOLA, e non stava nella funzione d'invio.
-- Il 31/10/2026 (`20261031180000`) il lotto ha smesso di essere letto e ha
-- iniziato a essere PRESO: `crm_campagna_prendi_lotto` marca le cento righe
-- `in_spedizione` con `for update skip locked`, ed e' quello che impedisce
-- i doppi invii. Ma il CHECK di `crm_campagne_destinatari.stato`, nato il
-- 30/10 con sette stati, non e' stato allargato: quello stato nuovo il
-- database lo rifiutava.
--
-- Quindi ogni invio moriva al primo gesto, con un 23514 che PostgREST
-- restituiva come errore della RPC e che la funzione girava in un 500 —
-- cioe' il «non-2xx» che si leggeva in pagina. La prova funzionava perche'
-- non passa da li': manda una mail sola e non tocca i destinatari.
--
-- MISURATO PRIMA DI TOCCARE NIENTE: in archivio ci sono 52.883 righe di
-- destinatari e sono TUTTE `in_coda`; nessuna campagna risulta `inviata`.
-- Non e' una cosa rotta oggi: dal 31/10/2026 una campagna non e' mai
-- potuta partire, e non lo si e' saputo perche' nessuno aveva ancora
-- premuto «Spedisci» su una lista vera.
--
-- Il vincolo si rifa' con TUTTI gli stati, compreso quello nuovo. Nessuna
-- riga da riparare (il nuovo elenco contiene il vecchio), e il vincolo si
-- convalida subito: non c'e' niente che non lo rispetti.
--
-- ROLLBACK (rimette il CHECK di prima — e con esso l'impossibilita' di
-- spedire, quindi va fatto solo insieme al ritorno della funzione d'invio
-- vecchia):
--   alter table public.crm_campagne_destinatari
--     drop constraint crm_campagne_destinatari_stato_check;
--   alter table public.crm_campagne_destinatari
--     add constraint crm_campagne_destinatari_stato_check
--     check (stato in ('in_coda', 'inviata', 'fallita', 'consegnata', 'aperta', 'rimbalzata', 'segnalata'));

alter table public.crm_campagne_destinatari
  drop constraint if exists crm_campagne_destinatari_stato_check;

alter table public.crm_campagne_destinatari
  add constraint crm_campagne_destinatari_stato_check
  check (stato in ('in_coda', 'in_spedizione', 'inviata', 'fallita',
                   'consegnata', 'aperta', 'rimbalzata', 'segnalata'));

comment on column public.crm_campagne_destinatari.stato is
  'in_coda -> in_spedizione (presa in carico da un lotto, torna in coda dopo 15 minuti) -> inviata | fallita; poi il webhook di Resend scrive consegnata, aperta, rimbalzata, segnalata.';
