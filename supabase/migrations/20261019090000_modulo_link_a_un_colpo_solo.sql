-- IL LINK DEL MODULO VALE UNA VOLTA SOLA.
--
-- Prima `modulo_salva` si fermava solo davanti a un'iscrizione gia'
-- "confermata". Ma fra "il modulo e' arrivato" e "l'iscrizione e'
-- confermata" passa l'acconto, e in mezzo il link restava buono: chi
-- riapriva la mail poteva rifirmare e rispedire.
--
-- Non era un fastidio, era un guasto. La seconda spedizione riscriveva
-- `firma_path`, `doc_fronte` e `doc_retro` — quelli NON sono protetti da
-- coalesce, perche' arrivano pieni — mentre `contratto_firmato` e
-- `modulo_ricevuto_il` restavano quelli della prima. Il PDF archiviato
-- avrebbe continuato a mostrare la firma del primo invio, e nel secchio
-- ce ne sarebbe stata un'altra. Un documento che deve fare da prova non
-- puo' avere due versioni di cui una invisibile.
--
-- Da adesso la serratura e' la data di ricezione, su tutti e due i lati:
-- la pagina non si apre, e se qualcuno ci arriva lo stesso la funzione
-- rifiuta. `modulo_vista` restituisce anche `motivo`
-- ('confermato' | 'gia_inviato'): "gia' confermata" e "gia' spedito"
-- sono due cose diverse e meritano due frasi diverse davanti a chi apre
-- il link.

create or replace function public.modulo_salva(
  p_token text, p_risposte jsonb, p_firma text default null::text,
  p_doc_fronte text default null::text, p_doc_retro text default null::text,
  p_consensi jsonb default '{}'::jsonb, p_contratto jsonb default null::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  i public.iscritti%rowtype;
  consentite text[] := array['nome','cognome','codice_fiscale','indirizzo_residenza','civico_residenza',
    'interno_residenza','cap_residenza','citta_residenza','prov_residenza','stato_residenza','email',
    'telefono','tipo_cliente','fattura_ditta','fattura_indirizzo','fattura_civico','fattura_citta',
    'fattura_prov','fattura_cap','fattura_piva','fattura_cod_dest','fattura_pec','doc_tipo','doc_numero'];
  accese text[]; k text; nuovo text; attuale text; scritte int := 0; stato_dopo text;
  spunta boolean;
  avvio boolean := coalesce((p_consensi->>'avvio_immediato')::boolean, false);
  promo boolean := coalesce((p_consensi->>'promozionali')::boolean, false);
  immag boolean := coalesce((p_consensi->>'immagini')::boolean, false);
begin
  if p_token is null or length(p_token) < 12 then
    return jsonb_build_object('ok', false, 'errore', 'Link non valido.');
  end if;
  select * into i from public.iscritti where token_modulo = p_token;
  if not found then return jsonb_build_object('ok', false, 'errore', 'Link non valido.'); end if;
  if i.stato = 'confermato' then
    return jsonb_build_object('ok', false, 'errore', 'Questa iscrizione è già confermata.', 'motivo', 'confermato');
  end if;
  -- la serratura vera: il modulo e' gia' arrivato una volta
  if i.modulo_ricevuto_il is not null then
    return jsonb_build_object('ok', false,
      'errore', 'Questo modulo è già stato inviato e non si può rimandare.',
      'motivo', 'gia_inviato');
  end if;

  foreach k in array array['regolamento','clausole','privacy'] loop
    spunta := coalesce((p_consensi->>k)::boolean, false);
    if not spunta then
      return jsonb_build_object('ok', false, 'errore', 'Mancano le dichiarazioni obbligatorie.');
    end if;
  end loop;

  select coalesce(array_agg(c.chiave), '{}') into accese
    from public.modulo_iscrizione_campi c where coalesce(c.incluso, true);

  foreach k in array consentite loop
    if not (k = any (accese)) then continue; end if;
    if p_risposte is null or not (p_risposte ? k) then continue; end if;
    nuovo := btrim(coalesce(p_risposte ->> k, ''));
    if nuovo = '' then continue; end if;
    execute format('select ($1).%I::text', k) into attuale using i;
    if k <> 'tipo_cliente' and attuale is not null and btrim(attuale) <> '' then continue; end if;
    if k = 'tipo_cliente' and nuovo not in ('privato','azienda') then continue; end if;
    execute format('update public.iscritti set %I = $1 where id = $2', k) using nuovo, i.id;
    scritte := scritte + 1;
  end loop;

  stato_dopo := case when i.acconto_pagato then 'confermato' else 'modulo_ricevuto' end;
  update public.iscritti set
    firma_path = coalesce(p_firma, firma_path),
    doc_fronte = coalesce(p_doc_fronte, doc_fronte),
    doc_retro = coalesce(p_doc_retro, doc_retro),
    contratto_firmato = coalesce(contratto_firmato, p_contratto),
    modulo_ricevuto_il = coalesce(modulo_ricevuto_il, now()),
    modulo_ricevuto_da = 'online',
    stato = stato_dopo,
    consenso_regolamento_il = coalesce(consenso_regolamento_il, now()),
    consenso_clausole_il    = coalesce(consenso_clausole_il, now()),
    consenso_privacy_il     = coalesce(consenso_privacy_il, now()),
    rinuncia_recesso        = avvio,
    rinuncia_recesso_il     = case when avvio then coalesce(rinuncia_recesso_il, now()) else null end,
    consenso_promozionali   = promo,
    consenso_promozionali_il = case when promo then coalesce(consenso_promozionali_il, now()) else null end,
    consenso_immagini       = immag,
    consenso_immagini_il    = case when immag then coalesce(consenso_immagini_il, now()) else null end
  where id = i.id;
  return jsonb_build_object('ok', true, 'scritte', scritte, 'stato', stato_dopo);
end;
$function$;

create or replace function public.modulo_vista(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  i         public.iscritti%rowtype;
  cd        public.corsi_date%rowtype;
  corso     public.corsi%rowtype;
  sede      public.location%rowtype;
  campi     jsonb := '[]'::jsonb;
  contratto jsonb := '{}'::jsonb;
  r         record;
  valore    text;
  motivo    text := null;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select * into i from public.iscritti where token_modulo = p_token;
  if not found then return null; end if;

  select * into cd    from public.corsi_date where id = i.corso_data_id;
  select * into corso from public.corsi      where id = cd.corso_id;
  select * into sede  from public.location   where id = cd.location_id;

  if i.stato = 'confermato' then motivo := 'confermato';
  elsif i.modulo_ricevuto_il is not null then motivo := 'gia_inviato';
  end if;

  for r in
    select c.chiave, coalesce(c.obbligatorio, true) as obbligatorio
      from public.modulo_iscrizione_campi c
     where coalesce(c.incluso, true)
  loop
    valore := case r.chiave
      when 'corso_nome'        then corso.nome
      when 'corso_data_inizio' then cd.data_inizio::text
      when 'corso_data_fine'   then cd.data_fine::text
      when 'corso_citta'       then coalesce(cd.citta, sede.citta)
      when 'corso_indirizzo'   then coalesce(cd.indirizzo, sede.indirizzo)
      else null
    end;
    if valore is null and r.chiave not like 'corso_%' then
      execute format('select ($1).%I::text', r.chiave) into valore using i;
    end if;
    campi := campi || jsonb_build_object(
      'chiave', r.chiave, 'valore', valore,
      'bloccato', public.modulo_campo_bloccato(r.chiave, valore),
      'obbligatorio', r.obbligatorio);
  end loop;

  select coalesce(jsonb_object_agg(t.chiave, t.corpo), '{}'::jsonb)
    into contratto from public.modulo_iscrizione_testi t;

  return jsonb_build_object(
    'stato', i.stato,
    'scaduto', (motivo is not null),
    'motivo', motivo,
    'ricevuto', (i.modulo_ricevuto_il is not null),
    'ricevuto_il', i.modulo_ricevuto_il,
    'nome', btrim(coalesce(i.nome,'') || ' ' || coalesce(i.cognome,'')),
    'corso', jsonb_build_object('nome', corso.nome, 'inizio', cd.data_inizio, 'fine', cd.data_fine,
               'citta', coalesce(cd.citta, sede.citta), 'indirizzo', coalesce(cd.indirizzo, sede.indirizzo),
               'sede', sede.nome),
    'campi', campi, 'contratto', contratto);
end;
$function$;
