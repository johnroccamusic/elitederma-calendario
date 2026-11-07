-- IL POS DI CHI STA AL BANCO PARTE DALLA FIERA (7/11/2026).
--
-- Chiesto dal titolare, sabato mattina, con la fiera di Napoli aperta:
-- «Da oggi fino a lunedi' i POS della vendita al banco di Elia Cito,
-- Andrea Paura, Stefano Di Napoli, Elena Rocca, Maria Stella Quaresima e
-- Olga devono essere impostati di default su vendita legata a un evento,
-- fiera di Napoli. Sconto fiera. Fino a lunedi' ore 20.»
--
-- PERCHE' NON BASTAVA LA TENDINA CHE C'E'. Al banco si parte sempre da
-- «vendita non legata a un evento» e lo sconto fiera nasce spento: e' la
-- stessa regola del corso («NESSUNA PRESELEZIONE DEL CORSO» in App.jsx),
-- scritta perche' una vendita agganciata da sola a una classe porta con
-- se' lo sconto degli allievi senza che nessuno l'abbia chiesto. In
-- fiera pero' la situazione e' rovesciata: per tre giorni *tutte* le
-- vendite di chi sta al banco sono della fiera, e il giro giusto va
-- ripetuto a mano a ogni scontrino. Chi se lo dimentica fa due danni in
-- una volta: la vendita non entra nel conto della fiera (e il materiale
-- partito non torna in pari al rientro) e il cliente paga il prezzo
-- pieno davanti a un banco che lo sconto lo fa.
--
-- PERCHE' NON UN ELENCO DI NOMI NEL CODICE. Sei persone e una scadenza
-- scritte in App.jsx sarebbero una regola che vive nel browser: per
-- spegnerla, o per tenerla accesa un'ora di piu' lunedi' sera, servirebbe
-- una pubblicazione. Qui sta nel database, accanto alla fiera a cui
-- appartiene, e si cambia dalla scheda dell'evento.
--
-- PERCHE' NON TUTTO IL TEAM. Nel team della fiera di Napoli ci sono
-- dieci righe. Il titolare ne ha nominate sei; chiesto chi fossero le
-- altre due con un'anagrafica, ha aggiunto anche quelle — CHIARA
-- COLONNELLI (Presidente) e VALENTINA CALASCIBETTA (Master) — quindi al
-- banco sono in otto. Restano fuori le due righe LIBERE (Miranda
-- Raffaele, Gianluca Rocca): nel team ci sono, ma senza anagrafica non
-- hanno un'identita' nell'app e quindi non hanno un POS.
--
-- La spunta resta pero' per persona e non per evento, e il motivo non
-- cambia: «chi viene alla fiera» e «chi batte gli scontrini» non sono la
-- stessa lista. Una preselezione addosso a chi in quei giorni tiene un
-- corso suo altrove aggancerebbe le vendite della sua aula alla fiera,
-- con lo sconto della fiera sopra.

alter table public.eventi_team
  add column if not exists vende_al_banco boolean not null default false;

comment on column public.eventi_team.vende_al_banco is
  'Questa persona batte gli scontrini al banco della fiera: il suo POS parte con la vendita legata a questo evento, finche'' eventi.pos_banco_fino_al non e'' passato. Vale solo per le righe con persona_id: chi e'' nel team come nome libero non entra nell''app.';

-- La scadenza sta sull'EVENTO e non sulla persona: a una fiera il banco
-- chiude per tutti alla stessa ora, e sei scadenze da tenere allineate
-- sono sei modi di sbagliarne una. Nulla = nessuna preselezione, che e'
-- il comportamento di sempre per tutti gli eventi passati e futuri.
alter table public.eventi
  add column if not exists pos_banco_fino_al timestamptz;
alter table public.eventi
  add column if not exists pos_banco_sconto_fiera boolean not null default false;

comment on column public.eventi.pos_banco_fino_al is
  'Fino a quando il POS di chi vende al banco (eventi_team.vende_al_banco) parte da questo evento. Vuoto = nessuna preselezione. E'' un istante e non una data perche'' il banco chiude a un''ora: la fiera di Napoli ha chiuso lunedi'' alle 20.';
comment on column public.eventi.pos_banco_sconto_fiera is
  'Oltre all''evento, la preselezione accende anche lo sconto fiera (le fasce di Genera Coupon -> Sconti eventi). Separato dalla data perche'' si puo'' voler agganciare le vendite alla fiera senza scontare.';

-- --------------------------------------------------------------------
-- LA FIERA DI NAPOLI (7-9 novembre 2026), come l'ha dettata il titolare.
--
-- Lunedi' 9 novembre alle 20:00 ora italiana e' l'ultimo giorno della
-- fiera: passata quell'ora il POS torna da solo a partire da «vendita
-- non legata a un evento», senza che nessuno debba ricordarsene.
update public.eventi
   set pos_banco_fino_al = timestamptz '2026-11-09 20:00:00 Europe/Rome',
       pos_banco_sconto_fiera = true,
       aggiornato_il = now()
 where id = '48852420-e164-435a-bc41-1db02deb8c0f';   -- Fiera di Napoli

-- Le sei righe, per id e non per nome: in anagrafica la stessa persona ha
-- piu' identita' (ELIA CITO e' master e venditore, ANDREA PAURA e'
-- master, venditore «ANDREA» e assistente) e il nome scritto sulla riga
-- del team e' quello dell'anagrafica da cui e' stata presa.
update public.eventi_team
   set vende_al_banco = true
 where evento_id = '48852420-e164-435a-bc41-1db02deb8c0f'
   and persona_id in (
     'ac910f16-8770-4433-b66d-d54ad90cf1df',   -- ELIA CITO (master)
     'a21bd2e4-2085-4abd-b773-62d08da7e47e',   -- ANDREA (venditore di ANDREA PAURA)
     '47cb18c6-e28d-466a-a412-d3b205acfb53',   -- STEFANO (venditore di Stefano Di Napoli)
     'a99f1c07-c3b6-44e5-98d6-651538f30c74',   -- ELENA (venditore di Elena Rocca)
     '50cae105-915c-4169-829d-b67618170c0c',   -- STELLA QUARESIMA (master)
     '164cb543-8982-4f87-8fd9-1c6bfb631a4a',   -- OLGA (venditore)
     -- aggiunte dal titolare appena gli ho detto chi erano le due del
     -- team che non aveva nominato
     'f72c7fd5-5384-4764-9b45-de0f593a117d',   -- CHIARA COLONNELLI (master)
     'b3af2f8e-3f3f-4893-8063-ebf1cc5e8a65'    -- VALENTINA CALASCIBETTA (master)
   );

-- PER TORNARE INDIETRO (tutta la fiera, senza toccare le colonne):
--   update public.eventi set pos_banco_fino_al = null, pos_banco_sconto_fiera = false
--    where id = '48852420-e164-435a-bc41-1db02deb8c0f';
--   update public.eventi_team set vende_al_banco = false
--    where evento_id = '48852420-e164-435a-bc41-1db02deb8c0f';
