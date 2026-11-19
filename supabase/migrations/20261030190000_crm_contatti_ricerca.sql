-- La lista contatti del CRM (Fase 4, 30/10/2026).
--
-- 23.757 contatti non si caricano nel browser: la pagina chiede UNA pagina
-- alla volta a `crm_cerca_contatti`, che filtra sul database e torna le
-- righe con il totale. I filtri di periodo (anno, dal/al) e di corso
-- lavorano sulle RICHIESTE, non sul contatto: "chi ha chiesto Microblading
-- nel 2025" e' chi ha almeno una richiesta cosi', anche se poi ne ha fatte
-- altre. Le due funzioni girano coi permessi di chi chiama (security
-- invoker): passano dalle policy `to authenticated` delle due tabelle.
--
-- La disiscrizione sta sul contatto, non in una tabella a parte (deciso dal
-- titolare il 30/10/2026): chi si disiscrive resta in archivio con la data,
-- esce di default dalle liste e sempre dalle campagne. Il blocco vale per
-- email: se la stessa persona rientra con una richiesta nuova, o con un
-- re-import, l'indirizzo e' gia' segnato.
alter table public.crm_contatti
  add column if not exists disiscritto_il timestamptz,
  add column if not exists disiscritto_come text,
  add column if not exists token_disiscrizione text unique default encode(gen_random_bytes(18), 'hex');

comment on column public.crm_contatti.disiscritto_il is 'Quando ha chiesto di non ricevere piu'' mail. Resta in archivio: fuori dalle liste di default e da ogni campagna.';
comment on column public.crm_contatti.disiscritto_come is 'Come: link nella mail, tasto del programma di posta (List-Unsubscribe), a mano dallo staff.';
comment on column public.crm_contatti.token_disiscrizione is 'Il gettone del link di disiscrizione personale, nato col contatto.';

update public.crm_contatti set token_disiscrizione = encode(gen_random_bytes(18), 'hex') where token_disiscrizione is null;

create index if not exists crm_contatti_disiscritto on public.crm_contatti (disiscritto_il) where disiscritto_il is not null;
create index if not exists crm_richieste_contatto_data on public.crm_richieste (contatto_id, richiesta_il);
create index if not exists crm_contatti_regione on public.crm_contatti (regione);
create index if not exists crm_contatti_provincia on public.crm_contatti (provincia);
create index if not exists crm_contatti_qualifica on public.crm_contatti (qualifica);
create index if not exists crm_contatti_trattato_da on public.crm_contatti (trattato_da);

-- i valori fra cui scegliere nei filtri, con quanti contatti hanno ognuno
create or replace function public.crm_filtri_valori()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'regioni', (select coalesce(jsonb_agg(jsonb_build_object('valore', regione, 'quanti', n) order by regione), '[]'::jsonb)
                from (select regione, count(*) n from crm_contatti where regione is not null group by regione) x),
    'province', (select coalesce(jsonb_agg(jsonb_build_object('valore', provincia, 'regione', regione, 'quanti', n) order by provincia), '[]'::jsonb)
                 from (select provincia, min(regione) regione, count(*) n from crm_contatti where provincia is not null group by provincia) x),
    'comuni', (select coalesce(jsonb_agg(jsonb_build_object('valore', comune, 'provincia', provincia, 'quanti', n) order by comune), '[]'::jsonb)
               from (select comune, min(provincia) provincia, count(*) n from crm_contatti where comune is not null group by comune) x),
    'qualifiche', (select coalesce(jsonb_agg(jsonb_build_object('valore', qualifica, 'quanti', n) order by n desc), '[]'::jsonb)
                   from (select qualifica, count(*) n from crm_contatti where qualifica is not null group by qualifica) x),
    'stati', (select coalesce(jsonb_agg(jsonb_build_object('valore', stato_trattativa, 'quanti', n) order by n desc), '[]'::jsonb)
              from (select stato_trattativa, count(*) n from crm_contatti group by stato_trattativa) x),
    'trattati_da', (select coalesce(jsonb_agg(jsonb_build_object('valore', trattato_da, 'quanti', n) order by n desc), '[]'::jsonb)
                    from (select trattato_da, count(*) n from crm_contatti where trattato_da is not null group by trattato_da) x),
    'mestieri', (select coalesce(jsonb_agg(jsonb_build_object('valore', mestiere, 'quanti', n) order by n desc), '[]'::jsonb)
                 from (select mestiere, count(*) n from crm_contatti where mestiere is not null group by mestiere) x),
    'corsi', (select coalesce(jsonb_agg(jsonb_build_object('valore', corso, 'quanti', n) order by n desc), '[]'::jsonb)
              from (select corso, count(distinct contatto_id) n from crm_richieste, unnest(corsi) corso group by corso) x),
    'anni', (select coalesce(jsonb_agg(jsonb_build_object('valore', anno, 'quanti', n) order by anno desc), '[]'::jsonb)
             from (select extract(year from richiesta_il at time zone 'Europe/Rome')::int anno, count(distinct contatto_id) n from crm_richieste where richiesta_il is not null group by 1) x),
    'totale', (select count(*) from crm_contatti),
    'disiscritti', (select count(*) from crm_contatti where disiscritto_il is not null)
  );
$$;

-- una pagina di contatti filtrati, col totale. `filtri` e' un oggetto con
-- chiavi facoltative: cerca, anno, dal, al, corso, regione, provincia,
-- comune, qualifica, stato, trattato_da, mestiere, disiscritti (true =
-- SOLO i disiscritti; altrimenti sono esclusi), da_verificare (true),
-- collegamento ('certo' | 'dubbio' | 'nessuno'), con_email (true).
create or replace function public.crm_cerca_contatti(filtri jsonb default '{}'::jsonb, da integer default 0, quanti integer default 50)
returns jsonb
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
  sulle_richieste boolean := f_anno is not null or f_dal is not null or f_al is not null or f_corso is not null;
  righe jsonb;
  totale integer := 0;
begin
  quanti := least(greatest(coalesce(quanti, 50), 1), 500);
  da := greatest(coalesce(da, 0), 0);
  with base as (
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
      and (not sulle_richieste or exists (
            select 1 from crm_richieste r
            where r.contatto_id = c.id
              and (f_anno is null or extract(year from r.richiesta_il at time zone 'Europe/Rome')::int = f_anno)
              and (f_dal is null or (r.richiesta_il at time zone 'Europe/Rome')::date >= f_dal)
              and (f_al is null or (r.richiesta_il at time zone 'Europe/Rome')::date <= f_al)
              and (f_corso is null or f_corso = any(r.corsi))))
  ), pagina as (
    select to_jsonb(b) - 'opportunita' - 'telefoni_aggiuntivi' - 'email_aggiuntive' as riga, count(*) over () as tot
    from base b
    order by b.ultimo_contatto_il desc nulls last, b.cognome, b.nome
    limit quanti offset da
  )
  select coalesce(jsonb_agg(riga), '[]'::jsonb), coalesce(max(tot), 0) into righe, totale from pagina;
  -- pagina oltre la fine: il totale va contato lo stesso
  if totale = 0 and da > 0 then
    select count(*) into totale from crm_contatti c
    where (f_disiscritti and c.disiscritto_il is not null or not f_disiscritti and c.disiscritto_il is null);
  end if;
  return jsonb_build_object('totale', totale, 'righe', righe, 'da', da, 'quanti', quanti);
end;
$$;

revoke all on function public.crm_filtri_valori() from public, anon;
revoke all on function public.crm_cerca_contatti(jsonb, integer, integer) from public, anon;
grant execute on function public.crm_filtri_valori() to authenticated, service_role;
grant execute on function public.crm_cerca_contatti(jsonb, integer, integer) to authenticated, service_role;
