-- IL MATERIALE PRENOTATO SCALA DAL MAGAZZINO COL PACCO (25/11/2026)
--
-- Deciso dal titolare, testuale: «il materiale prenotato lo mette Raf nel
-- pacco e scala quando esce dal magazzino insieme con la roba dei kit».
-- Era l'unica cosa rimasta in sospeso del lavoro di stamattina su «Altro
-- materiale»: fino a ieri quei pezzi partivano nella scatola e la giacenza
-- restava ferma, e la sezione in logistica lo scriveva in giallo.
--
-- Serve una colonna, e serve per la stessa ragione per cui esiste
-- `scarico_dermografi`: il materiale prenotato non sta in nessuna distinta
-- — lo portano le schede degli iscritti — quindi lo scarico non puo'
-- dedurlo da `scarico_per_kit`. Qui dentro va «di questo prodotto ne ho
-- gia' fatti uscire N per questa edizione», e lo scarico applica sempre e
-- solo la DIFFERENZA: un'allieva che cambia prenotazione restituisce l'uno
-- e prende l'altro, e una risincronizzazione non fa uscire niente due
-- volte.
--
-- Nessun dato da rimettere in pari: al 25/11/2026 l'unica classe con del
-- materiale prenotato (PMU ROMA del 30/11, due pezzi) non ha ancora
-- allestito il pacco, quindi non c'e' nessuno scarico gia' avvenuto da
-- ricostruire ne' nessuno da annullare.
--
-- ROLLBACK (e cosa comporta davvero):
--   alter table public.logistica_kit_edizioni drop column if exists scarico_materiale;
-- Togliere la colonna NON rimette a scaffale la merce gia' uscita: i
-- movimenti restano scritti in movimenti_magazzino con origine
-- 'kit_corso', ed e' giusto cosi' — quei pezzi sono partiti davvero. Si
-- perde solo il registro di quanto era uscito per ogni edizione, quindi
-- un «torna indietro» successivo non saprebbe piu' cosa rimettere dentro.

alter table public.logistica_kit_edizioni
  add column if not exists scarico_materiale jsonb not null default '{}'::jsonb;

comment on column public.logistica_kit_edizioni.scarico_materiale is
  'Materiale prenotato dalle allieve gia'' scaricato dal magazzino per questa edizione: prodotto_id -> quantita''. Lo scarico applica la differenza fra questo e quanto risulta prenotato adesso (iscritti.materiale_prenotato), come scarico_dermografi.';
