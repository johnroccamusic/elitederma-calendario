-- I quattro campi della nascita sul modulo dell'allieva.
--
-- Perche' finiscono sul modulo e non solo nella scheda: il codice
-- fiscale glielo si chiedeva e basta, e 11 dei 253 in archivio hanno la
-- lettera di controllo sbagliata — copiati a mano, con un errore che
-- nessuno ha visto. Da data e luogo di nascita il codice si calcola.
--
-- `comune_nascita` e' obbligatorio, `stato_nascita` no: chi e' nata
-- all'estero scegliere lo Stato e la casella del comune si spegne. Un
-- campo spento non si pretende, o il modulo non si potrebbe spedire.
insert into public.modulo_iscrizione_campi (chiave, incluso, obbligatorio) values
  ('sesso',          true, true),
  ('data_nascita',   true, true),
  ('comune_nascita', true, true),
  ('stato_nascita',  true, false)
on conflict (chiave) do nothing;

-- E la lista bianca di `modulo_salva`: quello che non e' nominato la'
-- dentro non si scrive, anche se arriva nel payload. Quattro nomi in
-- piu', e il cast sul tipo della colonna.

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
    'fattura_prov','fattura_cap','fattura_piva','fattura_cod_dest','fattura_pec','doc_tipo','doc_numero',
    'sesso','data_nascita','comune_nascita','stato_nascita'];
  accese text[]; k text; nuovo text; attuale text; scritte int := 0; stato_dopo text;
  tipo_colonna text;
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
    -- Il cast: `data_nascita` e' una `date`, e il ciclo passa tutto
    -- come testo. Il tipo si legge dalla colonna stessa invece di
    -- scriverlo qui, o il giorno che una colonna cambia tipo questa
    -- funzione si rompe in silenzio.
    select a.atttypid::regtype::text into tipo_colonna
      from pg_attribute a where a.attrelid = 'public.iscritti'::regclass and a.attname = k;
    execute format('update public.iscritti set %I = cast($1 as %s) where id = $2', k, tipo_colonna)
      using nuovo, i.id;
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

revoke all on function public.modulo_salva(text, jsonb, text, text, text, jsonb, jsonb) from public;
grant execute on function public.modulo_salva(text, jsonb, text, text, text, jsonb, jsonb) to anon, authenticated;
