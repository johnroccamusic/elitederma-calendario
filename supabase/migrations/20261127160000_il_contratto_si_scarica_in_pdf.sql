-- IL CONTRATTO SI SCARICA IN PDF, E LO SCARICO LASCIA UNA TRACCIA
-- (27/11/2026).
--
-- Il titolare: «le maestre che devono firmare il contratto mi hanno
-- chiesto un tasto che generi un PDF per la lettura del testo. Quindi
-- nella loro area, vicino a dove c'e' scritto apri, puoi anche mettere
-- un tasto che fa il PDF».
--
-- IL TASTO E' UNA COSA DEL BROWSER e non ha bisogno del database: il
-- PDF lo compone pdf-lib nella pagina, come il listino e la bolla. Qui
-- si aggiunge una cosa sola, e la ragione e' il lavoro di stamattina.
--
-- PERCHE' LO SCARICO VA SCRITTO. Da stamattina «Contratti master» dice
-- a che punto e' ognuna col contratto, e il gradino piu' importante e'
-- «ha aperto E RICHIUSO il testo». Una master che si scarica il PDF e
-- se lo legge sul computer — che e' esattamente quello che le maestre
-- hanno chiesto di poter fare — nella pagina il testo non lo apre: in
-- elenco risulterebbe fra quelle che «non l'hanno mai aperto», cioe' il
-- segnalatore direbbe il contrario del vero PROPRIO DI CHI CI HA MESSO
-- PIU' CURA. Senza questa riga il tasto nuovo rompe la misura di ieri.
--
-- IL GRADINO NON CAMBIA, ed e' voluto. I cinque gradini dicono dove
-- quella persona si e' fermata DENTRO LA PAGINA, e sono esclusivi:
-- aggiungerne un sesto vorrebbe dire rifare tutti i conteggi per una
-- cosa che si legge meglio come una riga accanto («si e' portato via il
-- testo in PDF, due volte»). Chi scarica e non apre resta «aperto, non
-- letto» — che e' vero — e la riga sotto dice il resto.
--
-- ROLLBACK in fondo.

-- ---------------------------------------------------------------------------
-- 1. LE COLONNE. La prima volta e l'ultima volta sono due cose diverse:
--    «l'ha scaricato il giorno dopo la mail» e «l'ha riscaricato ieri»
--    si richiamano in due modi diversi.
alter table public.master_contratti
  add column if not exists pdf_scaricato_il        timestamptz,
  add column if not exists pdf_scaricato_ultimo_il timestamptz,
  add column if not exists pdf_scaricati           integer not null default 0;

-- NESSUN BACKFILL, e non e' una dimenticanza: prima di oggi quel tasto
-- non esisteva, quindi nessuno puo' aver scaricato niente. Una data
-- messa qui «per coerenza» sarebbe un fatto inventato.

-- ---------------------------------------------------------------------------
-- 2. LA FUNZIONE: lo stesso corpo di `20261127120000`, con un evento in
--    piu'. Si riscrive per intero invece di innestare una riga perche'
--    una funzione viva si sostituisce leggendola, non rattoppandola a
--    tentoni (la lezione del 25/11: i commenti non sono un ancoraggio).
create or replace function public.contratto_master_segna_lettura(
  p_master_id uuid,
  p_evento text,
  p_secondi integer default 0)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.master_contratti%rowtype;
  -- IL TETTO SUI SECONDI. Il browser manda quanto il riquadro e' stato
  -- aperto, e una scheda lasciata aperta tutta la notte direbbe «sette
  -- ore di lettura»: un numero falso che nessuno metterebbe in dubbio.
  v_sec integer := least(greatest(coalesce(p_secondi, 0), 0), 3600);
  ora timestamptz := now();
begin
  if p_master_id is null or p_evento is null then
    return jsonb_build_object('ok', false, 'errore', 'Manca la master o l''evento.');
  end if;
  if p_evento not in ('pagina', 'contratto', 'manifesto', 'pdf') then
    return jsonb_build_object('ok', false, 'errore', 'Evento sconosciuto: ' || p_evento);
  end if;
  if not public.contratti_master_firma_aperta() then
    return jsonb_build_object('ok', false, 'motivo', 'chiusa',
      'errore', 'La firma del contratto non è aperta.');
  end if;
  if exists (select 1 from public.master where id = p_master_id and contratto_escluso) then
    return jsonb_build_object('ok', false, 'motivo', 'escluso',
      'errore', 'Per questa master il contratto non è ancora pronto.');
  end if;
  if not exists (select 1 from public.master where id = p_master_id) then
    return jsonb_build_object('ok', false, 'errore', 'Questa master non esiste.');
  end if;

  select * into c from public.master_contratti
   where master_id = p_master_id and stato = 'da_firmare' limit 1;
  if not found then
    -- UNA FIRMA NON SI TOCCA. Chi rilegge (o riscarica) il proprio
    -- contratto firmato non deve muovere nessuna data su una riga
    -- sottoscritta.
    if exists (select 1 from public.master_contratti where master_id = p_master_id and stato = 'firmato') then
      return jsonb_build_object('ok', true, 'motivo', 'gia_firmato');
    end if;
    -- L'inserimento si protegge con l'eccezione e non con un ON
    -- CONFLICT: l'indice che impedisce due contratti aperti sulla stessa
    -- master e' PARZIALE (`where stato = 'da_firmare'`), ed e' la
    -- trappola del 24/11/2026 che ha tenuto lo shop senza scaricare il
    -- magazzino per ventiquattro giorni.
    begin
      insert into public.master_contratti (master_id) values (p_master_id);
    exception when unique_violation then
      null;
    end;
    select * into c from public.master_contratti
     where master_id = p_master_id and stato = 'da_firmare' limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'errore', 'Non è stato possibile aprire il contratto.');
    end if;
  end if;

  if p_evento = 'pagina' then
    update public.master_contratti set
      pagina_aperta_il = coalesce(pagina_aperta_il, ora),
      pagina_vista_il  = ora,
      pagina_aperture  = pagina_aperture + 1
     where id = c.id and stato = 'da_firmare';
  elsif p_evento = 'contratto' then
    update public.master_contratti set
      testo_letto_il        = coalesce(testo_letto_il, ora),
      testo_letto_ultimo_il = ora,
      testo_aperture        = testo_aperture + 1,
      testo_secondi         = testo_secondi + v_sec,
      pagina_vista_il       = ora
     where id = c.id and stato = 'da_firmare';
  elsif p_evento = 'manifesto' then
    update public.master_contratti set
      manifesto_letto_il        = coalesce(manifesto_letto_il, ora),
      manifesto_letto_ultimo_il = ora,
      manifesto_aperture        = manifesto_aperture + 1,
      manifesto_secondi         = manifesto_secondi + v_sec,
      pagina_vista_il           = ora
     where id = c.id and stato = 'da_firmare';
  else
    -- IL PDF NON HA SECONDI, e non e' un'omissione: quanto tempo quel
    -- foglio sia stato tenuto davanti agli occhi, fuori dalla pagina,
    -- non lo sa nessuno. Scrivere uno zero fra i secondi del testo
    -- abbasserebbe una media che non c'entra niente.
    update public.master_contratti set
      pdf_scaricato_il        = coalesce(pdf_scaricato_il, ora),
      pdf_scaricato_ultimo_il = ora,
      pdf_scaricati           = pdf_scaricati + 1,
      pagina_vista_il         = ora
     where id = c.id and stato = 'da_firmare';
  end if;

  return jsonb_build_object('ok', true, 'id', c.id, 'secondi', v_sec);
end;
$function$;

revoke all on function public.contratto_master_segna_lettura(uuid, text, integer) from public, anon;
grant execute on function public.contratto_master_segna_lettura(uuid, text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK
--
--   -- la funzione torna quella di 20261127120000 (tre eventi): si
--   -- rilegge da quel file, sezione 2.
--   alter table public.master_contratti
--     drop column if exists pdf_scaricato_il,
--     drop column if exists pdf_scaricato_ultimo_il,
--     drop column if exists pdf_scaricati;
--
-- Tornando indietro il tasto del PDF continua a funzionare — il foglio
-- lo compone il browser — ma lo scarico non lascia piu' traccia, e in
-- elenco una master che ha letto il contratto in PDF torna a comparire
-- fra quelle che non l'hanno mai aperto.
