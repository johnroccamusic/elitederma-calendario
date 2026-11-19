-- LE CAMPAGNE DEL CRM (Fase 4, 30/10/2026): «Componi mail» dalla lista
-- contatti filtrata, invio a lotti con Resend, disiscrizione.
--
-- Una campagna nasce in bozza dai filtri della lista; «Prepara i
-- destinatari» li congela in crm_campagne_destinatari (una riga a persona,
-- un'email sola per indirizzo, mai i disiscritti, mai chi e' da verificare,
-- mai un indirizzo che ha gia' rimbalzato); la edge function
-- crm-campagna-invia li spedisce 100 alla volta e segna ognuno. Il
-- webhook di Resend (email-eventi) annota consegna, apertura, rimbalzo.
--
-- La disiscrizione e' una funzione security definer che chiunque puo'
-- chiamare col gettone personale del contatto: scrive disiscritto_il su
-- TUTTI i contatti con quell'email, perche' il blocco vale per indirizzo.

create table if not exists public.crm_campagne (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  oggetto text not null default '',
  corpo_html text not null default '',
  filtri jsonb not null default '{}'::jsonb,
  riassunto_filtri text,
  stato text not null default 'bozza' check (stato in ('bozza', 'pronta', 'in_invio', 'inviata', 'annullata')),
  totale_destinatari integer not null default 0,
  inviate integer not null default 0,
  fallite integer not null default 0,
  esclusi jsonb not null default '{}'::jsonb,
  prova_inviata_a text,
  prova_inviata_il timestamptz,
  creata_da text,
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now(),
  inviata_il timestamptz
);
comment on table public.crm_campagne is 'Le mail di massa ai contatti del CRM: filtri, testo, stato e conteggi.';

create table if not exists public.crm_campagne_destinatari (
  id uuid primary key default gen_random_uuid(),
  campagna_id uuid not null references public.crm_campagne(id) on delete cascade,
  contatto_id uuid references public.crm_contatti(id) on delete set null,
  email text not null,
  nome text,
  valori jsonb not null default '{}'::jsonb,
  token_disiscrizione text,
  stato text not null default 'in_coda' check (stato in ('in_coda', 'inviata', 'fallita', 'consegnata', 'aperta', 'rimbalzata', 'segnalata')),
  resend_id text,
  errore text,
  inviata_il timestamptz,
  ultimo_evento text,
  ultimo_evento_il timestamptz,
  unique (campagna_id, email)
);
create index if not exists crm_campagne_destinatari_stato on public.crm_campagne_destinatari (campagna_id, stato);
create index if not exists crm_campagne_destinatari_resend on public.crm_campagne_destinatari (resend_id) where resend_id is not null;
create index if not exists crm_campagne_destinatari_email on public.crm_campagne_destinatari (lower(email));

alter table public.crm_campagne enable row level security;
alter table public.crm_campagne_destinatari enable row level security;
drop policy if exists crm_campagne_staff on public.crm_campagne;
create policy crm_campagne_staff on public.crm_campagne for all to authenticated using (true) with check (true);
drop policy if exists crm_campagne_destinatari_staff on public.crm_campagne_destinatari;
create policy crm_campagne_destinatari_staff on public.crm_campagne_destinatari for all to authenticated using (true) with check (true);

-- I CONTATTI CHE PASSANO I FILTRI: una funzione sola, usata dalla lista
-- (crm_cerca_contatti) e dalle campagne (crm_campagna_prepara). Due copie
-- della stessa WHERE vorrebbero dire una lista che mostra 1.200 persone e
-- una campagna che ne prende 1.180 senza che nessuno capisca perche'.
create or replace function public.crm_contatti_filtrati(filtri jsonb default '{}'::jsonb)
returns setof public.crm_contatti
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  f_cerca text := nullif(trim(filtri->>'cerca'), '');
  f_anno int := nullif(filtri->>'anno', '')::int;
  f_dal date := nullif(filtri->>'dal', '')::date;
  f_al date := nullif(filtri->>'al', '')::date;
  f_corso text := nullif(filtri->>'corso', '');
  f_regione text := nullif(filtri->>'regione', '');
  f_provincia text := nullif(filtri->>'provincia', '');
  f_comune text := nullif(filtri->>'comune', '');
  f_qualifica text := nullif(filtri->>'qualifica', '');
  f_stato text := nullif(filtri->>'stato', '');
  f_trattato text := nullif(filtri->>'trattato_da', '');
  f_mestiere text := nullif(filtri->>'mestiere', '');
  f_collegamento text := nullif(filtri->>'collegamento', '');
  f_disiscritti boolean := coalesce((filtri->>'disiscritti')::boolean, false);
  f_da_verificare boolean := coalesce((filtri->>'da_verificare')::boolean, false);
  f_con_email boolean := coalesce((filtri->>'con_email')::boolean, false);
  f_senza_data boolean := coalesce((filtri->>'senza_data')::boolean, false);
  con_date boolean := f_anno is not null or f_dal is not null or f_al is not null;
  sulle_richieste boolean := f_anno is not null or f_dal is not null or f_al is not null or f_corso is not null;
begin
  return query
    select c.*
    from crm_contatti c
    where (f_disiscritti and c.disiscritto_il is not null or not f_disiscritti and c.disiscritto_il is null)
      and (not f_da_verificare or c.da_verificare)
      and (not f_con_email or c.email is not null)
      and (f_regione is null or c.regione = f_regione)
      and (f_provincia is null or c.provincia = f_provincia)
      and (f_comune is null or c.comune = f_comune)
      and (f_qualifica is null or c.qualifica = f_qualifica)
      and (f_stato is null or c.stato_trattativa = f_stato)
      and (f_trattato is null or c.trattato_da = f_trattato)
      and (f_mestiere is null or c.mestiere = f_mestiere)
      and (f_collegamento is null or c.collegamento = f_collegamento)
      and (f_cerca is null or
           concat_ws(' ', c.nome, c.cognome, c.nome_originale, c.email, c.telefono, c.comune) ilike '%' || f_cerca || '%')
      and (not f_senza_data or (
            not exists (select 1 from crm_richieste r where r.contatto_id = c.id and r.data_certa)
            and not exists (select 1 from jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}')))
      and (not sulle_richieste
           or exists (
            select 1 from crm_richieste r
            where r.contatto_id = c.id
              and (not con_date or r.data_certa)
              and (f_anno is null or extract(year from r.richiesta_il at time zone 'Europe/Rome')::int = f_anno)
              and (f_dal is null or (r.richiesta_il at time zone 'Europe/Rome')::date >= f_dal)
              and (f_al is null or (r.richiesta_il at time zone 'Europe/Rome')::date <= f_al)
              and (f_corso is null or f_corso = any(r.corsi)))
           or (con_date and exists (
            select 1 from jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o
            where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}'
              and (f_anno is null or extract(year from (o->>'chiusa_il')::date)::int = f_anno)
              and (f_dal is null or (o->>'chiusa_il')::date >= f_dal)
              and (f_al is null or (o->>'chiusa_il')::date <= f_al)
              and (f_corso is null or o->>'corso' = f_corso))));
end;
$$;

create or replace function public.crm_cerca_contatti(filtri jsonb default '{}'::jsonb, da integer default 0, quanti integer default 50)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  righe jsonb;
  totale integer := 0;
  f_disiscritti boolean := coalesce((filtri->>'disiscritti')::boolean, false);
begin
  quanti := least(greatest(coalesce(quanti, 50), 1), 500);
  da := greatest(coalesce(da, 0), 0);
  with pagina as (
    select (to_jsonb(b) - 'opportunita' - 'telefoni_aggiuntivi' - 'email_aggiuntive')
             || jsonb_build_object(
                  'con_data_certa', exists (select 1 from crm_richieste r where r.contatto_id = b.id and r.data_certa),
                  'ultima_vendita_il', b.ultima_vendita_il) as riga,
           count(*) over () as tot
    from crm_contatti_filtrati(filtri) b
    order by b.ultimo_contatto_il desc nulls last, b.cognome, b.nome
    limit quanti offset da
  )
  select coalesce(jsonb_agg(riga), '[]'::jsonb), coalesce(max(tot), 0) into righe, totale from pagina;
  if totale = 0 and da > 0 then
    select count(*) into totale from crm_contatti c
    where (f_disiscritti and c.disiscritto_il is not null or not f_disiscritti and c.disiscritto_il is null);
  end if;
  return jsonb_build_object('totale', totale, 'righe', righe, 'da', da, 'quanti', quanti);
end;
$$;

-- I DESTINATARI DI UNA CAMPAGNA, congelati dai suoi filtri. Si rifanno
-- ogni volta che si preme «Prepara» finche' la campagna non e' partita:
-- quelli gia' spediti non si toccano mai.
create or replace function public.crm_campagna_prepara(p_campagna uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  camp crm_campagne%rowtype;
  n_tot integer := 0; n_senza_email integer := 0; n_disiscritti integer := 0; n_da_verificare integer := 0;
  n_doppioni integer := 0; n_rimbalzate integer := 0; n_inseriti integer := 0; n_gia_spediti integer := 0;
begin
  select * into camp from crm_campagne where id = p_campagna;
  if not found then raise exception 'campagna non trovata'; end if;
  if camp.stato in ('inviata', 'annullata') then raise exception 'la campagna è già %', camp.stato; end if;

  delete from crm_campagne_destinatari where campagna_id = p_campagna and stato = 'in_coda';
  select count(*) into n_gia_spediti from crm_campagne_destinatari where campagna_id = p_campagna;

  create temp table _cand on commit drop as
    select c.id, c.email, lower(c.email) as email_k, c.nome, c.cognome, c.nome_originale, c.comune, c.provincia, c.regione,
           c.corsi_interesse, c.token_disiscrizione, c.disiscritto_il, c.da_verificare, c.ultimo_contatto_il
    from crm_contatti_filtrati(camp.filtri) c;
  select count(*) into n_tot from _cand;
  select count(*) into n_senza_email from _cand where email is null or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  delete from _cand where email is null or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  -- il blocco della disiscrizione vale per indirizzo, non per riga
  select count(*) into n_disiscritti from _cand x
    where x.disiscritto_il is not null or exists (select 1 from crm_contatti d where lower(d.email) = x.email_k and d.disiscritto_il is not null);
  delete from _cand x where x.disiscritto_il is not null or exists (select 1 from crm_contatti d where lower(d.email) = x.email_k and d.disiscritto_il is not null);
  select count(*) into n_da_verificare from _cand where da_verificare;
  delete from _cand where da_verificare;
  select count(*) into n_rimbalzate from _cand x
    where exists (select 1 from crm_campagne_destinatari d where lower(d.email) = x.email_k and d.stato in ('rimbalzata', 'segnalata'));
  delete from _cand x where exists (select 1 from crm_campagne_destinatari d where lower(d.email) = x.email_k and d.stato in ('rimbalzata', 'segnalata'));
  -- un indirizzo, una mail: resta il contatto piu' recente
  delete from _cand x using _cand y
    where x.email_k = y.email_k and x.id <> y.id
      and (coalesce(x.ultimo_contatto_il, '1970-01-01') < coalesce(y.ultimo_contatto_il, '1970-01-01')
           or (coalesce(x.ultimo_contatto_il, '1970-01-01') = coalesce(y.ultimo_contatto_il, '1970-01-01') and x.id > y.id));
  get diagnostics n_doppioni = row_count;

  insert into crm_campagne_destinatari (campagna_id, contatto_id, email, nome, valori, token_disiscrizione)
  select p_campagna, x.id, x.email,
         coalesce(nullif(trim(coalesce(x.nome, '') || ' ' || coalesce(x.cognome, '')), ''), x.nome_originale),
         jsonb_build_object('nome', coalesce(nullif(x.nome, ''), ''), 'cognome', coalesce(x.cognome, ''),
                            'comune', coalesce(x.comune, ''), 'provincia', coalesce(x.provincia, ''), 'regione', coalesce(x.regione, ''),
                            'corso', coalesce(array_to_string(x.corsi_interesse, ', '), '')),
         x.token_disiscrizione
  from _cand x
  where not exists (select 1 from crm_campagne_destinatari d where d.campagna_id = p_campagna and lower(d.email) = x.email_k);
  get diagnostics n_inseriti = row_count;

  update crm_campagne set
    totale_destinatari = (select count(*) from crm_campagne_destinatari where campagna_id = p_campagna),
    stato = case when stato = 'bozza' then 'pronta' else stato end,
    esclusi = jsonb_build_object('contatti_filtrati', n_tot, 'senza_email', n_senza_email, 'disiscritti', n_disiscritti,
                                 'da_verificare', n_da_verificare, 'rimbalzate_prima', n_rimbalzate, 'doppioni_email', n_doppioni),
    aggiornata_il = now()
  where id = p_campagna;

  return jsonb_build_object('inseriti', n_inseriti, 'gia_spediti', n_gia_spediti, 'contatti_filtrati', n_tot,
                            'senza_email', n_senza_email, 'disiscritti', n_disiscritti, 'da_verificare', n_da_verificare,
                            'rimbalzate_prima', n_rimbalzate, 'doppioni_email', n_doppioni);
end;
$$;

-- LA DISISCRIZIONE, dal link personale. Chiunque la puo' chiamare con il
-- gettone: non rivela nulla oltre a un nome di battesimo, e scrive solo
-- la data. Vale per tutte le schede con quell'indirizzo.
create or replace function public.crm_disiscrivi(p_token text, p_come text default 'link')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c crm_contatti%rowtype;
  gia boolean;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('ok', false, 'errore', 'link non valido'); end if;
  select * into c from crm_contatti where token_disiscrizione = p_token;
  if not found then return jsonb_build_object('ok', false, 'errore', 'link non valido'); end if;
  gia := c.disiscritto_il is not null;
  update crm_contatti set disiscritto_il = coalesce(disiscritto_il, now()), disiscritto_come = coalesce(disiscritto_come, p_come), aggiornato_il = now()
  where id = c.id or (c.email is not null and lower(email) = lower(c.email));
  return jsonb_build_object('ok', true, 'gia', gia, 'nome', coalesce(nullif(c.nome, ''), ''),
                            'email', regexp_replace(coalesce(c.email, ''), '^(.).*(@.*)$', '\1…\2'));
end;
$$;

revoke all on function public.crm_contatti_filtrati(jsonb) from public, anon;
revoke all on function public.crm_campagna_prepara(uuid) from public, anon;
revoke all on function public.crm_disiscrivi(text, text) from public;
grant execute on function public.crm_contatti_filtrati(jsonb) to authenticated, service_role;
grant execute on function public.crm_campagna_prepara(uuid) to authenticated, service_role;
grant execute on function public.crm_disiscrivi(text, text) to anon, authenticated, service_role;
