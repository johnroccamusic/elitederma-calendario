-- FASE 2, PRIMO PEZZO: il gettone e la lettura.
-- APPLICATA il 16/10/2026 via MCP.
--
-- Il modulo che riceve l'allieva si apre con ?modulo=<gettone>. Il
-- gettone nomina QUELLA iscrizione e nient'altro: 32 byte generati nel
-- database, come token_master sulle classi.
--
-- PERCHE' UNA FUNZIONE E NON LE TABELLE. La pagina dei consensi modella
-- scrive dritta sulle tabelle con la chiave anonima, perche' le policy
-- sono ancora aperte. Su `iscritti` non si puo' fare: li' dentro ci sono
-- anagrafiche, residenze, pagamenti e allegati di tutti gli allievi, e
-- una pagina pubblica che le tocca vuol dire che chiunque abbia la
-- chiave del bundle le legge tutte. Qui si fa come per la pagina master:
-- una funzione `security definer` che prende il gettone, trova la riga
-- e torna SOLO i campi che quella pagina disegna, solo di quella
-- iscrizione.
--
-- Provata il 16/10/2026: 258 iscritti, 258 gettoni distinti, nessuno
-- senza. Gettone inventato -> null, gettone nullo -> null. Su una
-- iscrizione vera: 42 campi accesi, 16 gia' scritti dal venditore
-- (bloccati) e 26 da riempire, di cui 12 obbligatori.

alter table public.iscritti
  add column if not exists token_modulo text;

update public.iscritti
   set token_modulo = encode(gen_random_bytes(32), 'hex')
 where token_modulo is null;

alter table public.iscritti
  alter column token_modulo set default encode(gen_random_bytes(32), 'hex');

create unique index if not exists iscritti_token_modulo_unico
  on public.iscritti (token_modulo);

comment on column public.iscritti.token_modulo is
  'Nomina questa iscrizione nel link ?modulo=. 32 byte nati nel database.';

-- I CINQUE CAMPI CHE COMPILA LEI, e che nella scheda del venditore non
-- esistono: il documento e il codice fiscale. Erano gia' dichiarati fra
-- le spunte in Setting, ma non avevano dove finire.
-- `doc_fronte`/`doc_retro` tengono il PERCORSO nel bucket privato, non
-- il file: un documento d'identita' non sta in un secchio pubblico.
alter table public.iscritti add column if not exists doc_tipo       text;
alter table public.iscritti add column if not exists doc_numero     text;
alter table public.iscritti add column if not exists codice_fiscale text;
alter table public.iscritti add column if not exists doc_fronte     text;
alter table public.iscritti add column if not exists doc_retro      text;
alter table public.iscritti add column if not exists firma_path     text;

comment on column public.iscritti.doc_fronte is
  'Percorso nel bucket privato moduli-iscrizione. Mai un indirizzo pubblico.';
comment on column public.iscritti.firma_path is
  'Percorso della firma nel bucket privato. Senza firma il modulo non vale.';

-- LA LETTURA. Un gettone sbagliato non torna "niente di male": torna
-- NULL, e la pagina dice che il link non vale. Non si distingue fra
-- "non esiste" e "scaduto" nella risposta, per non trasformare la
-- funzione in un modo di indovinare gettoni.
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
  campi    jsonb := '[]'::jsonb;
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
    'campi',    campi
  );
end;
$function$;

revoke all on function public.modulo_vista(text) from public;
grant execute on function public.modulo_vista(text) to anon, authenticated, service_role;
