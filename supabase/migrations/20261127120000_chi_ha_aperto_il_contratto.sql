-- CHI HA APERTO IL TESTO DEL CONTRATTO, ANCHE SENZA FIRMARE (27/11/2026).
--
-- Il titolare: «nella sezione contratti master mi metti un segnalatore
-- per vedere almeno chi abbia aperto il testo magari senza firmare
-- perche' non so chi ha posto attenzione o meno al contratto».
--
-- QUELLO CHE SI SAPEVA PRIMA, E PERCHE' NON BASTAVA. La pagina di firma
-- obbliga ad aprire e richiudere il contratto e l'Allegato A prima di
-- firmare (16/11/2026), ma quelle due spunte vivevano SOLO nello stato
-- del browser: chiusa la pagina senza firmare, non restava niente —
-- ne' che il testo fosse stato aperto, ne' che la pagina fosse stata
-- aperta. `testo_letto_il` esisteva come colonna e la scriveva soltanto
-- `contratto_master_salva`, cioe' si riempiva nello stesso istante
-- della firma: diceva «ha letto» solo di chi aveva gia' firmato, che e'
-- l'unico caso in cui non serve saperlo.
--
-- E L'ELENCO DICEVA UNA COSA FALSA. «Contratti master» scriveva «Ha
-- cominciato a compilarlo» per ogni riga `da_firmare` esistente. Ma
-- quella riga nasceva da se': la pagina salvava la bozza al montaggio
-- con i dati PRECOMPILATI dall'anagrafica, senza che nessuno avesse
-- battuto un tasto. Misurato prima di toccare niente: dodici righe su
-- dodici, tutte nate la sera del 25/11/2026 fra le 18:17 e le 20:39,
-- con da uno a sei campi dentro — e nessuna di quelle persone aveva
-- scritto niente. Una sola ha firmato (18:52).
--
-- COSA SI REGISTRA ADESSO, in tre gradini che sono tre cose diverse:
--
--   1. ha aperto la PAGINA        -> `pagina_aperta_il`, `_vista_il`, `_aperture`
--   2. ha aperto e richiuso il TESTO -> `testo_letto_il`, `_ultimo_il`, `_aperture`, `_secondi`
--      (e l'Allegato A a parte: sono due documenti, come le tre
--      dichiarazioni sono tre — 19/10/2026)
--   3. ha SCRITTO qualcosa di suo -> `dati_scritti_il`
--
-- I SECONDI RISPONDONO ALLA SUA DOMANDA, e vanno letti per quello che
-- sono: quanto il testo e' stato tenuto aperto, sommato su tutte le
-- volte. Non dimostrano che sia stato letto — niente lo dimostra, ed e'
-- scritto da sempre accanto a questa regola — ma un contratto di
-- ventitre' articoli richiuso dopo quattro secondi dice qualcosa, e
-- oggi non lo diceva a nessuno.
--
-- NON SI SCRIVE NIENTE SU UN CONTRATTO FIRMATO. Una firma e' chiusa:
-- riaprire quel testo per rileggerselo non deve muovere una data su una
-- riga sottoscritta.
--
-- ROLLBACK in fondo.

-- ---------------------------------------------------------------------------
-- 1. LE COLONNE.
alter table public.master_contratti
  add column if not exists pagina_aperta_il          timestamptz,
  add column if not exists pagina_vista_il           timestamptz,
  add column if not exists pagina_aperture           integer not null default 0,
  add column if not exists testo_letto_ultimo_il     timestamptz,
  add column if not exists testo_aperture            integer not null default 0,
  add column if not exists testo_secondi             integer not null default 0,
  add column if not exists manifesto_letto_il        timestamptz,
  add column if not exists manifesto_letto_ultimo_il timestamptz,
  add column if not exists manifesto_aperture        integer not null default 0,
  add column if not exists manifesto_secondi         integer not null default 0,
  add column if not exists dati_scritti_il           timestamptz;

-- IL BACKFILL E' UN FATTO MISURATO, NON UNA STIMA. Fino a oggi la riga
-- di un contratto nasceva in un modo solo: la pagina di firma che si
-- apriva e salvava la bozza coi dati precompilati. Quindi `creato_il` E'
-- il momento in cui quella master ha aperto la pagina, e scriverlo non
-- inventa niente. Le aperture contano 1 perche' una la conosciamo; da
-- adesso le conta la funzione.
update public.master_contratti
   set pagina_aperta_il = creato_il,
       pagina_vista_il  = coalesce(pagina_vista_il, creato_il),
       pagina_aperture  = greatest(pagina_aperture, 1)
 where pagina_aperta_il is null;

-- Chi ha FIRMATO ha per forza aperto e richiuso l'Allegato A: la pagina
-- non lascia firmare altrimenti, e la sua dichiarazione porta l'ora.
update public.master_contratti
   set manifesto_letto_il = consenso_manifesto_il
 where stato = 'firmato' and manifesto_letto_il is null and consenso_manifesto_il is not null;

-- ---------------------------------------------------------------------------
-- 2. CHI REGISTRA: una funzione sola per i tre eventi.
--
-- Perche' passa da qui e non da un `update` del browser: la tabella e'
-- aperta a chi ha una sessione, ma queste colonne dicono «questa persona
-- ha letto», e un contatore che si incrementa da fuori non si potrebbe
-- piu' leggere. Qui dentro stanno le serrature che valgono comunque: non
-- si tocca un contratto firmato, non si registra per chi e' escluso, non
-- si registra a firma chiusa.
--
-- LA PORTA VALE ANCHE QUI, come per la bozza e per la firma: a firma
-- chiusa la pagina non si apre, quindi non c'e' nessuna lettura da
-- scrivere, e accettarla vorrebbe dire righe di lettura su una pagina
-- che nessuno poteva vedere.
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
  -- Oltre il tetto si conta il tetto, che e' comunque «l'ha tenuto
  -- aperto a lungo».
  v_sec integer := least(greatest(coalesce(p_secondi, 0), 0), 3600);
  ora timestamptz := now();
begin
  if p_master_id is null or p_evento is null then
    return jsonb_build_object('ok', false, 'errore', 'Manca la master o l''evento.');
  end if;
  if p_evento not in ('pagina', 'contratto', 'manifesto') then
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
    -- UNA FIRMA NON SI TOCCA. Chi rilegge il proprio contratto firmato
    -- non deve muovere nessuna data su una riga sottoscritta.
    if exists (select 1 from public.master_contratti where master_id = p_master_id and stato = 'firmato') then
      return jsonb_build_object('ok', true, 'motivo', 'gia_firmato');
    end if;
    -- LA RIGA NASCE QUI, ed e' il punto: prima nasceva dalla bozza coi
    -- dati precompilati, e sembrava che qualcuno avesse compilato.
    --
    -- L'inserimento si protegge con l'eccezione e non con un ON
    -- CONFLICT: l'indice che impedisce due contratti aperti sulla stessa
    -- master e' PARZIALE (`where stato = 'da_firmare'`), ed e' la
    -- famiglia di trappole che il 24/11/2026 ha tenuto lo shop senza
    -- scaricare il magazzino per ventiquattro giorni. Due aperture nello
    -- stesso istante non sono un errore: sono una ripetizione, e la
    -- risposta giusta e' rileggere la riga che c'e'.
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
  else
    update public.master_contratti set
      manifesto_letto_il        = coalesce(manifesto_letto_il, ora),
      manifesto_letto_ultimo_il = ora,
      manifesto_aperture        = manifesto_aperture + 1,
      manifesto_secondi         = manifesto_secondi + v_sec,
      pagina_vista_il           = ora
     where id = c.id and stato = 'da_firmare';
  end if;

  return jsonb_build_object('ok', true, 'id', c.id, 'secondi', v_sec);
end;
$function$;

revoke all on function public.contratto_master_segna_lettura(uuid, text, integer) from public, anon;
grant execute on function public.contratto_master_segna_lettura(uuid, text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. LA BOZZA DICE QUANDO HA SCRITTO DAVVERO.
--
-- Identica a quella del 16/11 tranne una cosa: `dati_scritti_il` si
-- scrive SOLO SE i dati che arrivano sono diversi da quelli gia' in
-- riga. Una bozza identica a quella che c'e' non e' una scrittura, ed e'
-- esattamente quello che mandava la pagina al montaggio: i precompilati
-- dell'anagrafica, battuti da nessuno.
--
-- All'inserimento la data NON si scrive, per la stessa ragione: la riga
-- di una master che apre la pagina la crea ora `segna_lettura`, e se
-- nasce da qui dentro ci sono i precompilati, non una sua scrittura.
create or replace function public.contratto_master_bozza(p_master_id uuid, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare c public.master_contratti%rowtype;
begin
  if p_master_id is null or p_dati is null or jsonb_typeof(p_dati) <> 'object' then
    return jsonb_build_object('ok', false, 'errore', 'Niente da salvare.');
  end if;
  if not public.contratti_master_firma_aperta() then
    return jsonb_build_object('ok', false, 'motivo', 'chiusa',
      'errore', 'La firma del contratto non è ancora aperta: l''Accademia avviserà quando si può firmare.');
  end if;
  if exists (select 1 from public.master where id = p_master_id and contratto_escluso) then
    return jsonb_build_object('ok', false, 'motivo', 'escluso', 'errore', 'Per questa master il contratto non è ancora pronto.');
  end if;
  select * into c from public.master_contratti where master_id = p_master_id and stato = 'da_firmare' limit 1;
  if not found then
    if exists (select 1 from public.master_contratti where master_id = p_master_id and stato = 'firmato') then
      return jsonb_build_object('ok', false, 'motivo', 'gia_firmato', 'errore', 'Il contratto è già firmato.');
    end if;
    insert into public.master_contratti (master_id, dati) values (p_master_id, p_dati) returning * into c;
    return jsonb_build_object('ok', true, 'id', c.id);
  end if;
  update public.master_contratti set
    dati = p_dati,
    dati_scritti_il = case when p_dati is distinct from c.dati
                           then coalesce(dati_scritti_il, now())
                           else dati_scritti_il end
   where id = c.id and stato = 'da_firmare';
  return jsonb_build_object('ok', true, 'id', c.id);
end;
$function$;

revoke all on function public.contratto_master_bozza(uuid, jsonb) from public, anon;
grant execute on function public.contratto_master_bozza(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK
--
--   -- la bozza torna quella del 16/11/2026 (senza `dati_scritti_il`):
--   -- la si rilegge da 20261116120000, sezione 6, e da 20261116200000,
--   -- che le ha aggiunto il controllo della porta.
--   drop function if exists public.contratto_master_segna_lettura(uuid, text, integer);
--   alter table public.master_contratti
--     drop column if exists pagina_aperta_il, drop column if exists pagina_vista_il,
--     drop column if exists pagina_aperture,
--     drop column if exists testo_letto_ultimo_il, drop column if exists testo_aperture,
--     drop column if exists testo_secondi,
--     drop column if exists manifesto_letto_il, drop column if exists manifesto_letto_ultimo_il,
--     drop column if exists manifesto_aperture, drop column if exists manifesto_secondi,
--     drop column if exists dati_scritti_il;
--
-- Tornando indietro si perde la traccia di chi ha aperto e letto il
-- testo senza firmare, che e' la sola cosa che dice se qualcuno ci ha
-- messo attenzione. I contratti firmati non si toccano.
