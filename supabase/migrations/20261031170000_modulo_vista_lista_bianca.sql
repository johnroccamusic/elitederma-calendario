-- 31/10/2026 — Controllo di sicurezza: modulo_vista leggeva da `iscritti` la
-- colonna NOMINATA da ogni riga di modulo_iscrizione_campi (format %I), senza
-- nessun elenco di cosa e' lecito. Oggi le righe accese sono innocue, ma
-- Setting -> Modulo di iscrizione permette di accendere anche
-- `quota_venditore`, `quota_speciale`, `accordi_commerciali` e `note`: con un
-- tocco la provvigione del venditore e gli accordi interni sarebbero finiti
-- nel JSON mostrato all'allieva (e a chiunque abbia il suo gettone).
-- Ora la funzione serve SOLO le chiavi di questo elenco; le altre si saltano
-- anche se la riga e' accesa. Nessun cambiamento oggi: nessuna delle quattro
-- esclusa e' accesa.
create or replace function public.modulo_vista(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
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
  riaperto  boolean := false;
  consentiti constant text[] := array[
    'acconto_imponibile','acconto_metodo','acconto_pagato','acconto_pagato_il','acconto_totale',
    'cap_residenza','citta_residenza','civico_residenza','codice_fiscale','cognome','comune_nascita',
    'corso_citta','corso_data_fine','corso_data_inizio','corso_indirizzo','corso_master','corso_nome',
    'data_nascita','dermografo','doc_fronte','doc_numero','doc_retro','doc_tipo','email',
    'fattura_cap','fattura_citta','fattura_civico','fattura_cod_dest','fattura_ditta','fattura_indirizzo',
    'fattura_pec','fattura_piva','fattura_prov','giorni_presenza','indirizzo_residenza','interno_residenza',
    'nome','numero_modelle','pacchetto_kit','precorso_imponibile','precorso_metodo','precorso_pagato',
    'precorso_pagato_il','precorso_totale','prezzo_speciale_modelle','prov_residenza','richiede_modelle',
    'saldo_imponibile','saldo_metodo','saldo_totale','sesso','stato_nascita','stato_residenza',
    'taglia_divisa','telefono','tipo_cliente','tipo_offerta','totale_con_interessi','totale_pattuito',
    'totale_senza_iva','tutor'];
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

  riaperto := public.modulo_riaperto(i.id);

  for r in
    select c.chiave, coalesce(c.obbligatorio, true) as obbligatorio
      from public.modulo_iscrizione_campi c
     where coalesce(c.incluso, true)
       and c.chiave = any(consentiti)
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
      'bloccato', public.modulo_campo_bloccato(r.chiave, valore, riaperto and r.chiave not like 'corso_%'),
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
    'riaperto', riaperto,
    'nome', btrim(coalesce(i.nome,'') || ' ' || coalesce(i.cognome,'')),
    'corso', jsonb_build_object('nome', corso.nome, 'inizio', cd.data_inizio, 'fine', cd.data_fine,
               'citta', coalesce(cd.citta, sede.citta), 'indirizzo', coalesce(cd.indirizzo, sede.indirizzo),
               'sede', sede.nome),
    'campi', campi, 'contratto', contratto);
end;
$function$;
