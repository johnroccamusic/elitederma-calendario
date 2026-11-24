-- TEST DI SISTEMA (24/11/2026, chiesto dal titolare).
--
-- «Creiamo una funzione di test in cui mandiamo tutte le verifiche da
-- fare per testare l'app in base a tutti i malfunzionamenti che hai
-- trovato nel tempo, in modo che se un giorno vogliamo ripassare tutto
-- abbiamo un sistema che si basa su vecchi bug e sulla loro
-- risoluzione.»
--
-- PERCHE' NON BASTAVANO LE 1.532 PROVE DEL BANCO, ed e' la ragione per
-- cui questa funzione sta nel DATABASE e non in `prove/`. Il guasto
-- dello stesso giorno — lo shop che non scaricava il magazzino da
-- ventiquattro giorni — nessuna prova poteva vederlo: il codice nel repo
-- era giusto, l'indice parziale stava nel database, e il danno nasceva
-- soltanto in produzione, dove nessuna prova arriva (e non deve: una
-- prova che parla col database vero non e' una prova).
--
-- Quindi i controlli sono DUE FAMIGLIE, e vanno tenute distinte:
--   * qui dentro, quello che si vede solo guardando lo STATO VIVO: dati,
--     vincoli, permessi, cron, quanto tempo e' passato dall'ultima volta
--     che una catena ha funzionato;
--   * in `prove/test-di-sistema.test.js`, le guardie che rileggono il
--     CODICE e le migrazioni — fra cui quella che oggi e' mancata: un
--     `onConflict` che punta a un indice parziale.
--
-- COME SI LEGGE. Una riga per controllo, con dentro il guasto da cui
-- nasce e la sua data: non e' decorazione, e' la sola cosa che permette,
-- fra un anno, di capire perche' quel numero va guardato. Tre esiti:
--   ok      — va bene
--   guarda  — non e' un guasto, ma qualcuno deve dargli un'occhiata
--   rotto   — questo e' il guasto di allora che e' tornato
--
-- NON CORREGGE NIENTE, e non e' una dimenticanza: un controllo che
-- aggiusta da se' e' il modo di non sapere piu' cosa era rotto. Dice
-- cosa guardare e dove.

create or replace function public.test_di_sistema()
returns table (
  area text,
  controllo text,
  esito text,
  misura text,
  atteso text,
  nato_da text,
  cosa_fare text
)
language plpgsql
stable
set search_path = public, extensions, pg_temp
as $$
declare
  n numeric; s text; t timestamptz;
begin
  -- ========================= SHOP E MAGAZZINO =========================

  -- 1. LO SCARICO DELLO SHOP SCRIVE ANCORA? (24/11/2026)
  return query
  with ultimo_mov as (select max(ts) as q from movimenti_magazzino where origine='ordine_online'),
       ultimo_ord as (select max(data_ordine) as q from vendite_shop where origine='woocommerce' and stato in ('completed','processing'))
  select 'Shop', 'Lo shop scala il magazzino',
         case when (select q from ultimo_ord) is null then 'ok'
              when (select q from ultimo_mov) is null then 'rotto'
              when (select q from ultimo_ord) - (select q from ultimo_mov) > interval '3 days' then 'rotto'
              when (select q from ultimo_ord) - (select q from ultimo_mov) > interval '18 hours' then 'guarda'
              else 'ok' end,
         'ultimo scarico ' || coalesce(to_char((select q from ultimo_mov) at time zone 'Europe/Rome', 'DD/MM HH24:MI'), 'MAI')
           || ', ultimo ordine pagato ' || coalesce(to_char((select q from ultimo_ord) at time zone 'Europe/Rome', 'DD/MM HH24:MI'), '—'),
         'lo scarico non deve restare indietro di piu'' di qualche ora',
         '24/11/2026: dal 31/10 nessun ordine scriveva il suo movimento (64 ordini, zero righe). `ON CONFLICT` su un indice PARZIALE: 42P10, e il codice si fermava a un console.error',
         'Guarda «scarichi non riusciti» in Logistica e i log di woo-webhook. Il recupero si fa UNA volta sola, scalando solo gli ordini successivi all''ultimo inventario di ogni prodotto';

  -- 2. LA SINCRONIZZAZIONE DEGLI ORDINI GIRA? (2/11/2026)
  --
  -- L'ALIAS NON E' PIGNOLERIA: la colonna di ritorno si chiama «esito»
  -- come quella di `sync_shop_esiti`, e senza qualificarla Postgres non sa
  -- a quale delle due ci si riferisce — rifiuta la funzione con 42702 al
  -- primo giro. Trovato eseguendola, non scrivendola.
  select max(e.ts) into t from sync_shop_esiti e where e.esito = 'ok';
  return query select 'Shop', 'La sincronizzazione degli ordini gira',
         case when t is null then 'rotto'
              when now() - t > interval '70 minutes' then 'rotto'
              when now() - t > interval '40 minutes' then 'guarda'
              else 'ok' end,
         'ultimo giro riuscito ' || coalesce(to_char(t at time zone 'Europe/Rome', 'DD/MM HH24:MI'), 'MAI'),
         'un giro riuscito ogni quarto d''ora',
         '1-2/11/2026: gli ordini del sito si sono fermati per un giorno e mezzo e nessuno lo sapeva — pg_cron scriveva «succeeded» perche'' aveva spedito la richiesta, non perche'' fosse andata bene',
         'Premi «Recupera ordini mancanti» in Vendite shop e guarda sync_shop_esiti: l''errore e'' scritto la''';

  -- 3. RIGHE DELLO SHOP SENZA NUMERO O SENZA DATA (1/11/2026)
  select count(*) into n from vendite_shop
   where origine='woocommerce' and (woo_order_id is null or data_ordine is null);
  return query select 'Shop', 'Nessun ordine del sito senza numero o data',
    case when n = 0 then 'ok' else 'rotto' end, n::text, 'zero',
    '1/11/2026: una riga vuota ha azzerato il cursore della sincronizzazione (in Postgres il decrescente mette i NULL per primi) e ogni giro rileggeva tutto lo storico fino a esaurire le risorse',
    'Cancella la riga vuota: il vincolo vendite_shop_woocommerce_vuole_numero_e_data dovrebbe impedirla, se e'' passata va capito da dove';

  -- 4. ORDINI PAGATI SENZA STATO (18/11/2026)
  select count(*) into n from vendite_shop where origine='woocommerce' and coalesce(stato,'') = '';
  return query select 'Shop', 'Ogni ordine del sito porta uno stato',
    case when n = 0 then 'ok' else 'rotto' end, n::text, 'zero',
    '18/11/2026: 717.712 euro di ordini annullati o falliti erano contati come fatturato. Adesso conta solo chi e'' pagato — ma un ordine SENZA stato sparirebbe dai conti in silenzio, che e'' lo stesso guasto all''incontrario',
    'Guarda quegli ordini sul sito e riallineali con «Recupera ordini mancanti»';

  -- 5. GIACENZE NEGATIVE
  select count(*) into n from prodotti_shop where coalesce(quantita,0) < 0;
  return query select 'Magazzino', 'Nessuna giacenza sotto zero',
    case when n = 0 then 'ok' else 'rotto' end, n::text, 'zero',
    'regola di sempre: la giacenza si porta a zero e i pezzi mancanti si contano, non si scende sotto',
    'Conta quei prodotti allo scaffale e usa «Verificato» in Gestione magazzino';

  -- 6. IL CONTO DEL MAGAZZINO TORNA? (19/10/2026)
  select count(*) into n from magazzino_scostamenti;
  return query select 'Magazzino', 'Il registro e la giacenza coincidono',
    case when n = 0 then 'ok' when n <= 15 then 'guarda' else 'rotto' end, n::text || ' prodotti', 'zero',
    '19/10/2026: il controllo notturno ricostruisce la giacenza dai movimenti. Uno scostamento vuol dire UNA cosa: qualcuno ha scritto quel numero senza passare da muoviStock',
    'In Gestione magazzino, «I conti non tornano»: si chiudono uno a uno contando lo scaffale col tasto «Verificato»';

  -- 7. SCARICHI NON RIUSCITI DA SISTEMARE (20/11/2026)
  select count(*) into n from scarichi_non_riusciti where risolto_il is null;
  return query select 'Magazzino', 'Nessuno scarico rimasto a terra',
    case when n = 0 then 'ok' when n <= 3 then 'guarda' else 'rotto' end, n::text, 'zero',
    'un pacco che parte mentre la giacenza non scende: prima finiva in un console.error, cioe'' in un messaggio a nessuno',
    'Logistica li mostra in cima agli ordini: si contano i pezzi e si sistema il prodotto in anagrafica';

  -- 8. LO SCARTO COL SITO (19/10/2026)
  select count(*) into n from magazzino_scarti_shop where coalesce(differenza,0) <> 0;
  return query select 'Shop', 'Le giacenze coincidono con quelle del sito',
    case when n = 0 then 'ok' when n <= 5 then 'guarda' else 'rotto' end, n::text || ' prodotti', 'zero',
    '19/10/2026: il termometro notturno confronta noi e WooCommerce. Non corregge: la direzione giusta non la sa un programma',
    'Premi «Aggiorna lo shop» in Gestione magazzino: quello che resta dopo un riallineamento e'' quello che il riallineamento NON sa sistemare';

  -- 9. BUNDLE DENTRO AI KIT SENZA DISTINTA (6/11/2026)
  select count(*) into n from (
    select distinct p.id from corsi_kit_prodotti ckp
      join prodotti_shop p on p.id = ckp.prodotto_id
     where p.tipo_prodotto = 'bundle'
       and not exists (select 1 from bundle_componenti bc where bc.bundle_id = p.id)) z;
  return query select 'Magazzino', 'Ogni kit-dentro-un-kit ha la sua distinta',
    case when n = 0 then 'ok' else 'rotto' end, n::text, 'zero',
    '6/11/2026: il box degli anellini bloccava la preparazione dei kit («ci sono 0 pezzi»), perche'' un bundle virtuale non ha giacenza propria. Un bundle aperto a vuoto farebbe partire il pacco senza quei pezzi',
    'Scrivi la distinta di quel prodotto, oppure togli il bundle dal contenuto del kit';

  -- ========================== CASSA E VENDITE =========================

  -- 10. UNA CARTA SENZA PROVA DEL PAGAMENTO (23/10/2026)
  select count(*) into n from vendite_shop v
   where v.origine = 'pos' and v.metodo_pagamento = 'pos'
     and v.pagamento_codice is not null
     and not exists (select 1 from pagamenti_pos p
                      where p.codice = v.pagamento_codice and p.pagato_il is not null);
  return query select 'Cassa', 'Ogni vendita col QR ha il suo incasso',
    case when n = 0 then 'ok' else 'rotto' end, n::text, 'zero',
    '19/10/2026: 117,13 euro mai incassati e il pacco partito il giorno dopo. Dal 23/10 il database pretende la prova del pagamento per una carta',
    'Guarda quella vendita: o il pagamento e'' arrivato e non e'' stato scritto, o la vendita non andava registrata';

  -- 11. IL CODICE DI UN INCASSO SU UNA VENDITA CHE NON E' A CARTA (9/11/2026)
  select count(*) into n from vendite_shop
   where pagamento_codice is not null
     and coalesce(metodo_pagamento,'') not in ('pos','misto');
  return query select 'Cassa', 'Nessun codice di incasso su contanti o omaggi',
    case when n = 0 then 'ok' when n = 1 then 'guarda' else 'rotto' end, n::text, 'zero (una sola riga nota: POS-1794149866157 dell''8/11)',
    '9/11/2026: il QR di un pagamento restava nello stato del POS dopo la vendita, e tre secondi dopo finiva su uno scontrino in CONTANTI. Da li'' il recupero automatico credeva quel pagamento gia'' registrato, e la vendita vera (274,61 euro, merce da spedire) non e'' mai nata',
    'Togli il codice da quella vendita e controlla se esiste la vendita vera di quel pagamento';

  -- 12. CONTABILITA' AGGIUNTIVE APERTE (11-12/11/2026)
  select count(*) into n from corsi_date_buste where depositata_il is null;
  return query select 'Cassa', 'Nessuna contabilita'' aggiuntiva dimenticata',
    case when n = 0 then 'ok' when n <= 3 then 'guarda' else 'rotto' end, n::text, 'zero o poche, e recenti',
    '11-12/11/2026: fra «la busta e'' partita» e «i soldi sono in cassa» passano dei giorni, e in mezzo le vendite della master in aula aprivano un''appendice. Una appendice aperta e'' contante che non e'' nel cassetto',
    'Riepilogo amministrativo: si chiudono con «Deposita in cassa»';

  -- 13. IMPEGNI ANNULLATI CON UNA QUOTA ANCORA DOVUTA (23/11/2026)
  select count(*) into n from impegno
   where stato = 'annullato' and coalesce(importo_coperto,0) = 0 and chiave_origine like 'cash_%';
  return query select 'Cassa', 'Nessun impegno annullato che nasconde una quota',
    case when n = 0 then 'ok' when n <= 4 then 'guarda' else 'rotto' end, n::text, 'solo quelli davvero non piu'' dovuti',
    '23/11/2026: la quota venditore di Simona (50 euro) era in nessuno dei due posti — nel Riepilogo risultava «in scadenzario», e nello scadenzario non c''era. `impegniPerChiave` costruiva la mappa senza guardare lo stato',
    'Apri il Riepilogo di quelle classi: se la quota e'' tornata dovuta, il tasto «Scad.» la fa rinascere';

  -- ========================== CAMPAGNE E MAIL =========================

  -- 14. GLI STATI CHE IL CODICE SCRIVE SONO AMMESSI DAL VINCOLO (24/11/2026)
  select pg_get_constraintdef(oid) into s from pg_constraint
   where conrelid = 'crm_campagne_destinatari'::regclass and conname = 'crm_campagne_destinatari_stato_check';
  return query select 'Campagne', 'Gli stati dei destinatari sono tutti ammessi',
    case when s is null then 'rotto'
         when s like '%in_spedizione%' and s like '%rimbalzata%' and s like '%segnalata%'
              and s like '%consegnata%' and s like '%aperta%' and s like '%fallita%' then 'ok'
         else 'rotto' end,
    coalesce(s, 'vincolo assente'),
    'il CHECK deve contenere tutti gli otto stati, «in_spedizione» compreso',
    '24/11/2026: nessuna campagna poteva partire dal 31/10. Il lotto marca le righe «in_spedizione», che il CHECK non ammetteva: 23514 e la pagina diceva solo «Edge Function returned a non-2xx status code». 52.883 righe in coda e zero campagne inviate',
    'Allarga il CHECK con una migrazione: ogni stato che il codice scrive deve stare dentro';

  -- 15. DESTINATARI APPESI IN SPEDIZIONE (31/10/2026)
  select count(*) into n from crm_campagne_destinatari
   where stato = 'in_spedizione' and ultimo_evento_il < now() - interval '30 minutes';
  return query select 'Campagne', 'Nessun destinatario appeso a meta'' invio',
    case when n = 0 then 'ok' else 'guarda' end, n::text, 'zero (dopo 15 minuti tornano in coda da soli)',
    '31/10/2026: il lotto si PRENDE le righe con for update skip locked, e quelle ferme da un quarto d''ora tornano in coda. Se restano appese piu'' a lungo, qualcosa ha interrotto l''invio in un modo che la riserva non copre',
    'Riapri la campagna da «Campagne»: riprende da dove era, e quelli gia'' spediti non si rispediscono';

  -- 16. RIMBALZI DA GUARDARE (24/11/2026)
  -- un rimbalzo guardato lo dice la SUA riga: la correzione le riscrive
  -- `ultimo_evento` con «corretto in …», e quella e' la traccia
  select count(*) into n from crm_campagne_destinatari d
   where d.stato in ('rimbalzata','segnalata')
     and coalesce(d.ultimo_evento, '') not like 'corretto in %';
  return query select 'Campagne', 'I rimbalzi sono stati guardati',
    case when n = 0 then 'ok' when n <= 25 then 'guarda' else 'rotto' end, n::text, 'zero, o guardati uno per uno',
    '24/11/2026: dei venti rimbalzi della prima campagna, tre erano un tasto sbagliato («libero.ti», «gmail.con») e quelle persone non hanno ricevuto niente per una lettera',
    'Apri la campagna: il riquadro «Indirizzi rimbalzati» propone la correzione dove e'' evidente';

  -- 17. IL TRACCIAMENTO DELLE APERTURE (30/10/2026)
  select count(*) into n from email_inviate where aperta_il is not null;
  return query select 'Mail', 'Le aperture arrivano dal fornitore',
    case when n > 0 then 'ok' else 'guarda' end, n::text || ' mail risultano aperte', 'piu'' di zero',
    '30/10/2026: su Resend il tracciamento di aperture e clic era spento sul dominio, quindi lo stato «aperta» non arrivava mai e la colonna sembrava un difetto dell''app',
    'Resend -> Domains -> elitederma.net: Open Tracking acceso. Ma ricorda che «aperta» e'' un''immagine scaricata, non una prova di lettura';

  -- ======================= PERMESSI E SICUREZZA =======================

  -- 18. POLICY APERTE A CHI NON HA FATTO ACCESSO (18/10/2026)
  select count(*) into n from pg_policies
   where schemaname = 'public' and 'anon' = any(roles)
     and tablename not in ('consensi_modelle');
  return query select 'Sicurezza', 'Nessuna tabella aperta ad anon',
    case when n = 0 then 'ok' else 'rotto' end, n::text || ' policy', 'zero (tranne l''INSERT di consensi_modelle, voluto)',
    '18/10/2026: 133 policy su 149 erano «for all to anon using (true)». Con la chiave pubblicabile, che sta nel bundle, si leggevano E si riscrivevano anagrafiche, pagamenti, movimenti di banca e le password in chiaro',
    'Guarda quelle policy: o si chiudono a authenticated, o va scritto qui perche'' sono una deroga';

  -- 19. FUNZIONI RISERVATE ESEGUIBILI DA FUORI (31/10/2026)
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('recesso_registra','modulo_riaperto','controlla_saldi_magazzino',
                       'recupera_vendite_qr_in_ritardo','riprova_vendite_pos_in_attesa',
                       'fic_avvia_sync','registra_vendita_pos','registra_vendita_da_pagamento',
                       'analisi_esegui','crm_campagna_prendi_lotto')
     and has_function_privilege('anon', p.oid, 'execute');
  return query select 'Sicurezza', 'Le funzioni di servizio non sono eseguibili da anon',
    case when n = 0 then 'ok' else 'rotto' end, n::text, 'zero',
    '31/10/2026: `recesso_registra` e `modulo_riaperto` avevano EXECUTE ad anon pur essendo dichiarate riservate — con il gettone del recesso si sciogleva un contratto senza ricevuta. La lezione: i grant di default di Supabase danno EXECUTE ad anon, e la migrazione che lo dichiara NON basta, va letto proacl sul database vivo',
    'Revoca l''execute ad anon su quelle funzioni con una migrazione';

  -- 20. VINCOLI RIMASTI NON CONVALIDATI
  select count(*) into n from pg_constraint
   where connamespace = 'public'::regnamespace and contype = 'c' and not convalidated;
  return query select 'Database', 'Nessun vincolo lasciato a meta''',
    case when n = 0 then 'ok' when n <= 2 then 'guarda' else 'rotto' end, n::text, 'zero, o dichiarati',
    'un vincolo NOT VALID non guarda le righe che c''erano prima: e'' voluto quando serve poter correggere il passato (es. il codice di incasso dell''8/11), ma lasciato li'' per mesi e'' una protezione che nessuno ha finito di accendere',
    'Quando le righe vecchie sono sistemate: alter table ... validate constraint ...';

  -- ============================ LAVORI NOTTURNI =======================

  -- 21. I LAVORI NOTTURNI SONO ACCESI
  select count(*) into n from cron.job where active;
  return query select 'Cron', 'I lavori notturni sono accesi',
    case when n >= 14 then 'ok' when n >= 10 then 'guarda' else 'rotto' end, n::text || ' attivi', 'almeno 14',
    'da loro dipendono il controllo del magazzino (05:15), il riallineamento del sito (05:30), il termometro (05:45), la sincronizzazione degli ordini (ogni quarto d''ora) e la vigilanza che la guarda da fuori',
    'Guarda cron.job: uno spento non lo dice nessuno';

  -- 22. QUALCHE LAVORO NOTTURNO FALLISCE DA GIORNI
  select count(*) into n from (
    select j.jobname, max(r.end_time) as ultimo_ok
      from cron.job j
      left join cron.job_run_details r on r.jobid = j.jobid and r.status = 'succeeded'
     where j.active
     group by j.jobname
    having max(r.end_time) is null or max(r.end_time) < now() - interval '3 days') z;
  return query select 'Cron', 'Ogni lavoro notturno e'' riuscito di recente',
    case when n = 0 then 'ok' when n <= 2 then 'guarda' else 'rotto' end, n::text || ' fermi da oltre tre giorni', 'zero',
    '2/11/2026: pg_cron scrive «succeeded» appena ha SPEDITO la richiesta, non quando e'' andata bene — per questo l''esito vero di ogni giro si guarda nelle tabelle dell''app, non solo qui',
    'Guarda cron.job_run_details per quel lavoro, e l''esito che il lavoro stesso scrive (sync_shop_esiti, magazzino_scostamenti...)';

  return;
end;
$$;

comment on function public.test_di_sistema() is
  'Test di sistema: ripassa i guasti trovati nel tempo e dice se qualcuno e'' tornato. Non corregge niente, dice cosa guardare.';

revoke all on function public.test_di_sistema() from public, anon;
grant execute on function public.test_di_sistema() to authenticated;

-- ROLLBACK
--   drop function if exists public.test_di_sistema();
-- Nessun dato toccato: questa funzione legge e basta.
