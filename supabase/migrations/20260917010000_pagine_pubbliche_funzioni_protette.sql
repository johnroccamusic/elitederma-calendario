-- Le pagine pubbliche non leggono piu' le tabelle (17/09/2026).
--
-- Perche'. Le due pagine che si aprono senza fare accesso — la ricerca
-- modelle (?modelle=) e i biglietti di viaggio (?biglietti=) — finora
-- leggevano le tabelle con la chiave pubblicabile dell'app. Quella chiave
-- sta dentro il programma scaricabile dal sito, quindi chiunque poteva
-- usarla per leggere TUTTO: nomi, email e telefoni delle allieve, importi
-- pagati, note, e le password in chiaro di utenti e venditori.
--
-- La pagina delle modelle, in particolare, faceva "select *" su iscritti
-- pur disegnando soltanto nome e trattamenti da coprire: si portava in
-- pagina telefono, email, saldi e accordi commerciali di ogni allieva.
--
-- Da qui in poi passano da queste funzioni, che girano con i permessi del
-- database ma restituiscono SOLO i campi che la pagina disegna. E' lo
-- stesso schema gia' usato per la pagina della master (master_vista).
--
-- Cosa NON cambia: nessun link smette di funzionare, l'indirizzo resta
-- identico. Chi ha gia' ricevuto un link continua a usarlo.
--
-- Cosa resta aperto, e si chiude a parte: l'indirizzo della pagina modelle
-- e' indovinabile (corso/citta/data, nessun codice segreto come quello
-- della master). Queste funzioni riducono cosa si vede; per rendere il
-- link non indovinabile serve un token, e quello cambia i link in giro.

create extension if not exists unaccent with schema extensions;

-- lo stesso slug che calcola l'app (slugify in App.jsx): accenti tolti,
-- minuscolo, tutto cio' che non e' lettera o cifra diventa un trattino,
-- trattini di testa e coda via. Va tenuto identico, o i link non tornano
create or replace function public.slug_link(p_testo text)
returns text
language sql
immutable
set search_path to 'public', 'extensions'
as $$
  select trim(both '-' from regexp_replace(
    lower(extensions.unaccent(coalesce(p_testo, ''))),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- la classe a cui punta un link pubblico. Due strade: lo slug
-- (corso/citta/gg-mm-aaaa) da fuori, o l'id quando la stessa pagina viene
-- aperta da dentro l'app, dove l'edizione si conosce gia'
create or replace function public.classe_da_link(p_slug text, p_corso_data_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_parti text[];
  v_data  date;
  v_id    uuid;
begin
  if p_corso_data_id is not null then
    select id into v_id from public.corsi_date where id = p_corso_data_id;
    return v_id;
  end if;
  if p_slug is null then return null; end if;

  v_parti := string_to_array(p_slug, '/');
  if coalesce(array_length(v_parti, 1), 0) < 3 then return null; end if;

  begin
    v_data := to_date(v_parti[3], 'DD-MM-YYYY');
  exception when others then
    return null;
  end;

  select cd.id into v_id
    from public.corsi_date cd
    join public.corsi c    on c.id = cd.corso_id
    join public.location l on l.id = cd.location_id
   where public.slug_link(c.nome) = v_parti[1]
     and public.slug_link(l.nome) = v_parti[2]
     and cd.data_inizio = v_data
   limit 1;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Pagina pubblica "ricerca modelle"
-- ---------------------------------------------------------------------
-- Di ogni allieva escono solo i campi che la pagina disegna davvero:
-- nome, cognome, giorni di presenza, kit, taglia e l'elenco dei
-- trattamenti. Niente telefono, email, note, importi, file.
create or replace function public.modelle_vista(p_slug text default null, p_corso_data_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_cd public.corsi_date%rowtype;
begin
  select * into v_cd from public.corsi_date
   where id = public.classe_da_link(p_slug, p_corso_data_id);
  if not found then return null; end if;

  return jsonb_build_object(
    'cd', jsonb_build_object(
      'id', v_cd.id,
      'data_inizio', v_cd.data_inizio,
      'data_fine', v_cd.data_fine,
      'corso_id', v_cd.corso_id,
      'location_id', v_cd.location_id,
      'master_id', v_cd.master_id
    ),
    'corso', (select jsonb_build_object('id', c.id, 'nome', c.nome)
                from public.corsi c where c.id = v_cd.corso_id),
    'loc', (select jsonb_build_object('id', l.id, 'nome', l.nome)
              from public.location l where l.id = v_cd.location_id),
    'masterNome', (select m.nome from public.master m where m.id = v_cd.master_id),
    'iscritti', coalesce((
      select jsonb_agg(riga order by riga->>'ts')
        from (
          select jsonb_build_object(
            'id', i.id,
            'ts', i.ts,
            'nome', i.nome,
            'cognome', i.cognome,
            'giorni_presenza', i.giorni_presenza,
            'pacchetto_kit', i.pacchetto_kit,
            'taglia_divisa', i.taglia_divisa,
            'richiede_modelle', i.richiede_modelle,
            'tipi_modelle', i.tipi_modelle
          ) as riga
            from public.iscritti i
           where i.corso_data_id = v_cd.id
        ) righe
    ), '[]'::jsonb),
    -- chi puo' firmare il reperimento: solo id, nome e quota, da tre
    -- anagrafiche diverse. Le password che stanno su venditori e
    -- utenti_app non escono di qui
    'reperitori', coalesce((
      select jsonb_agg(r order by r->>'nome')
        from (
          select jsonb_build_object('id', m.id, 'nome', m.nome, 'venditore_id', m.venditore_id,
                                    'quota_reperimento', m.quota_reperimento, 'fonte', 'master') as r
            from public.master m where m.gestione_modelle = true
          union all
          select jsonb_build_object('id', v.id, 'nome', v.nome, 'venditore_id', null,
                                    'quota_reperimento', v.quota_reperimento, 'fonte', 'venditore')
            from public.venditori v where v.gestione_modelle = true
          union all
          select jsonb_build_object('id', u.id, 'nome', u.nome, 'venditore_id', u.venditore_id,
                                    'quota_reperimento', u.quota_reperimento, 'fonte', 'utente')
            from public.utenti_app u where u.gestione_modelle = true
        ) tutti
    ), '[]'::jsonb)
  );
end;
$$;

-- L'unica scrittura che la pagina pubblica puo' fare: l'elenco dei
-- trattamenti di UNA allieva, e solo se quella allieva appartiene davvero
-- alla classe del link. Prima si poteva riscrivere la riga di chiunque.
create or replace function public.modelle_salva_trattamenti(
  p_iscritto uuid,
  p_elenco   jsonb,
  p_slug     text default null,
  p_corso_data_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_classe uuid;
begin
  if p_iscritto is null or p_elenco is null or jsonb_typeof(p_elenco) <> 'array' then
    return false;
  end if;
  v_classe := public.classe_da_link(p_slug, p_corso_data_id);
  if v_classe is null then return false; end if;

  update public.iscritti
     set tipi_modelle = p_elenco
   where id = p_iscritto
     and corso_data_id = v_classe;

  return found;
end;
$$;

-- Rilettura dei trattamenti di una allieva prima di riscriverli: la
-- pagina resta aperta per ore sul telefono di chi cerca, e quello che ha
-- in memoria puo' essere vecchio
create or replace function public.modelle_leggi_trattamenti(
  p_iscritto uuid,
  p_slug     text default null,
  p_corso_data_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_classe uuid;
  v_elenco jsonb;
begin
  v_classe := public.classe_da_link(p_slug, p_corso_data_id);
  if v_classe is null then return null; end if;
  select tipi_modelle into v_elenco from public.iscritti
   where id = p_iscritto and corso_data_id = v_classe;
  return coalesce(v_elenco, '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- Pagina pubblica "biglietti di viaggio"
-- ---------------------------------------------------------------------
-- Lo slug della data qui e' diverso: "11ott2026" oppure "11-12ott2026"
-- (vedi leggiSlugData in App.jsx). Escono solo le date e i file dei
-- biglietti: della sede non esce ne' IBAN ne' partita IVA.
create or replace function public.biglietti_vista(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_parti  text[];
  v_mesi   text[] := array['gen','feb','mar','apr','mag','giu','lug','ago','sett','ott','nov','dic'];
  v_m      text[];
  v_giorno int;
  v_mese   int;
  v_anno   int;
  v_cd     public.corsi_date%rowtype;
begin
  if p_slug is null then return null; end if;
  v_parti := string_to_array(p_slug, '/');
  if coalesce(array_length(v_parti, 1), 0) < 3 then return null; end if;

  -- "11ott2026" / "11-12ott2026" / "11ott-12nov2026"
  v_m := regexp_match(v_parti[3], '^([0-9]{1,2})(?:-[0-9]{1,2})?(gen|feb|mar|apr|mag|giu|lug|ago|sett|ott|nov|dic)([0-9]{4})$');
  if v_m is null then
    v_m := regexp_match(v_parti[3], '^([0-9]{1,2})(gen|feb|mar|apr|mag|giu|lug|ago|sett|ott|nov|dic)-[0-9]{1,2}(?:gen|feb|mar|apr|mag|giu|lug|ago|sett|ott|nov|dic)([0-9]{4})$');
  end if;
  if v_m is null then return null; end if;

  v_giorno := v_m[1]::int;
  v_mese   := array_position(v_mesi, v_m[2]);
  v_anno   := v_m[3]::int;
  if v_mese is null then return null; end if;

  select cd.* into v_cd
    from public.corsi_date cd
    join public.corsi c    on c.id = cd.corso_id
    join public.location l on l.id = cd.location_id
   where public.slug_link(c.nome) = v_parti[1]
     and public.slug_link(l.nome) = v_parti[2]
     and cd.data_inizio = make_date(v_anno, v_mese, v_giorno)
   limit 1;
  if not found then return null; end if;

  return jsonb_build_object(
    'cd', jsonb_build_object(
      'data_inizio', v_cd.data_inizio,
      'data_fine', v_cd.data_fine,
      'viaggio_file', v_cd.viaggio_file,
      'viaggio_assistente_file', v_cd.viaggio_assistente_file
    ),
    'corso', (select jsonb_build_object('nome', c.nome) from public.corsi c where c.id = v_cd.corso_id),
    'loc', (select jsonb_build_object('nome', l.nome) from public.location l where l.id = v_cd.location_id)
  );
end;
$$;

-- Chi puo' chiamarle: le pagine pubbliche non hanno un account, quindi
-- servono ad anon. Si revoca a "public" (che comprende ogni ruolo futuro)
-- e si concede solo ai due che servono, come per master_vista.
revoke all on function public.slug_link(text) from public;
revoke all on function public.classe_da_link(text, uuid) from public;
revoke all on function public.modelle_vista(text, uuid) from public;
revoke all on function public.modelle_salva_trattamenti(uuid, jsonb, text, uuid) from public;
revoke all on function public.modelle_leggi_trattamenti(uuid, text, uuid) from public;
revoke all on function public.biglietti_vista(text) from public;

grant execute on function public.modelle_vista(text, uuid) to anon, authenticated;
grant execute on function public.modelle_salva_trattamenti(uuid, jsonb, text, uuid) to anon, authenticated;
grant execute on function public.modelle_leggi_trattamenti(uuid, text, uuid) to anon, authenticated;
grant execute on function public.biglietti_vista(text) to anon, authenticated;
