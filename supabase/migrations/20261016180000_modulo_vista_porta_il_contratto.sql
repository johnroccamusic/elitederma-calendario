-- IL CONTRATTO DEVE ARRIVARE ANCHE A LEI.
-- APPLICATA il 16/10/2026 via MCP.
--
-- `modulo_iscrizione_testi` ha una policy `to authenticated`: giusto,
-- perche' li' si decide cosa firma una persona. Ma l'allieva apre il
-- modulo senza account, quindi con la chiave anonima quella tabella non
-- la legge: le correzioni fatte in Setting > Il contratto non le
-- arriverebbero mai, e lei firmerebbe la versione scritta nel codice
-- mentre in ufficio si legge quella corretta. Due testi diversi con lo
-- stesso nome e' esattamente il guasto da evitare.
--
-- La funzione e' `security definer`, quindi la tabella la legge: il
-- testo viaggia insieme al resto. Se una riga non c'e', torna null e
-- comanda il testo del codice — lo stesso patto di sempre.
--
-- Il corpo completo di modulo_vista sta in
-- 20261016170000_modulo_allieva_gettone_e_vista.sql; qui cambia solo
-- l'aggiunta di `contratto` in fondo all'oggetto che torna.

create or replace function public.modulo_vista(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  i        public.iscritti%rowtype;
  cd       public.corsi_date%rowtype;
  corso    public.corsi%rowtype;
  sede     public.location%rowtype;
  campi     jsonb := '[]'::jsonb;
  contratto jsonb := '{}'::jsonb;
  r        record;
  valore   text;
begin
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;

  select * into i from public.iscritti where token_modulo = p_token;
  if not found then
    return null;
  end if;

  select * into cd    from public.corsi_date where id = i.corso_data_id;
  select * into corso from public.corsi      where id = cd.corso_id;
  select * into sede  from public.location   where id = cd.location_id;

  -- I campi: solo quelli accesi in Setting. Per ognuno si dice cosa c'e'
  -- gia' scritto e se e' BLOCCATO, cioe' se l'ha scritto il venditore.
  -- Quello che e' bloccato lei lo legge e basta: il prezzo e il pacchetto
  -- devono arrivare in fondo come sono partiti.
  for r in
    select c.chiave, coalesce(c.incluso, true) as incluso, coalesce(c.obbligatorio, true) as obbligatorio
      from public.modulo_iscrizione_campi c
     where coalesce(c.incluso, true)
     order by c.chiave
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
      'chiave',       r.chiave,
      'valore',       valore,
      'bloccato',     (valore is not null and btrim(valore) <> ''),
      'obbligatorio', r.obbligatorio
    );
  end loop;

  -- il testo corretto dall'ufficio; chiave mancante = comanda il codice
  select coalesce(jsonb_object_agg(t.chiave, t.corpo), '{}'::jsonb)
    into contratto
    from public.modulo_iscrizione_testi t;

  return jsonb_build_object(
    'stato',    i.stato,
    'scaduto',  (i.stato = 'confermato'),
    'ricevuto', (i.modulo_ricevuto_il is not null),
    'nome',     btrim(coalesce(i.nome,'') || ' ' || coalesce(i.cognome,'')),
    'corso',    jsonb_build_object(
                  'nome',       corso.nome,
                  'inizio',     cd.data_inizio,
                  'fine',       cd.data_fine,
                  'citta',      coalesce(cd.citta, sede.citta),
                  'indirizzo',  coalesce(cd.indirizzo, sede.indirizzo),
                  'sede',       sede.nome),
    'campi',     campi,
    'contratto', contratto
  );
end;
$function$;

revoke all on function public.modulo_vista(text) from public;
grant execute on function public.modulo_vista(text) to anon, authenticated, service_role;
