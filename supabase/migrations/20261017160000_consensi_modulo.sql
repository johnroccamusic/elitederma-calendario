-- LE DICHIARAZIONI DEL MODULO, e dove restano scritte.
--
-- Sei caselle, ognuna separata e nessuna spuntata in partenza. Tre sono
-- obbligatorie e senza quelle il modulo non si spedisce; una compare
-- solo se mancano meno di 15 giorni al corso; due sono facoltative e
-- lasciarle vuote non impedisce niente.
--
-- PERCHE' OGNUNA HA LA SUA DATA. Un consenso facoltativo vale finche'
-- non viene revocato, e per sapere su cosa si sta mandando una
-- promozione o si sta pubblicando una foto non basta un si'/no: serve
-- sapere QUANDO e' stato dato. Senza la data, il giorno in cui qualcuno
-- contesta non c'e' niente da mostrare.
--
-- Le tre obbligatorie hanno solo la data, non il booleano: se il modulo
-- e' stato spedito sono state date per forza, e un "false" li' dentro
-- vorrebbe dire che il modulo e' passato senza — cosa che la funzione
-- qui sotto rifiuta.
--
-- `rinuncia_recesso` e' la casella dell'art. 59, lett. a): e' la stessa
-- che la pagina di recesso dovra' guardare per sapere se il tasto si
-- mostra o no.
alter table public.iscritti
  add column if not exists consenso_regolamento_il   timestamptz,
  add column if not exists consenso_clausole_il      timestamptz,
  add column if not exists consenso_privacy_il       timestamptz,
  add column if not exists rinuncia_recesso          boolean not null default false,
  add column if not exists rinuncia_recesso_il       timestamptz,
  add column if not exists consenso_promozionali     boolean not null default false,
  add column if not exists consenso_promozionali_il  timestamptz,
  add column if not exists consenso_immagini         boolean not null default false,
  add column if not exists consenso_immagini_il      timestamptz;

comment on column public.iscritti.consenso_clausole_il is
  'Approvazione specifica delle clausole ex artt. 1341 e 1342 c.c.';
comment on column public.iscritti.rinuncia_recesso is
  'Art. 59 lett. a) D.Lgs. 206/2005: avvio immediato chiesto dall''allievo, quindi niente recesso.';

-- a chi si puo' scrivere una promozione, e di chi si possono pubblicare
-- le foto: due domande che si faranno spesso, scritte una volta sola
create or replace view public.v_consensi_allievi as
select i.id, i.nome, i.cognome, i.email, i.corso_data_id,
       i.consenso_promozionali, i.consenso_promozionali_il,
       i.consenso_immagini, i.consenso_immagini_il,
       i.rinuncia_recesso, i.rinuncia_recesso_il,
       i.consenso_regolamento_il, i.consenso_clausole_il, i.consenso_privacy_il
  from public.iscritti i;

-- `modulo_salva` prende un sesto parametro, `p_consensi`, e rifiuta il
-- modulo se le tre dichiarazioni obbligatorie non ci sono. Il corpo
-- completo e' stato applicato via MCP il 17/10/2026
-- (modulo_salva_con_consensi), insieme alla cancellazione della versione
-- a cinque parametri: lasciandola, PostgREST avrebbe continuato a
-- scegliere quella per le chiamate vecchie, e i consensi sarebbero
-- spariti senza un errore.
