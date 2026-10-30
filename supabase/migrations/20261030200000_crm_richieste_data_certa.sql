-- La data della richiesta non e' sempre vera (30/10/2026).
--
-- Il titolare apre il filtro «Anno» e trova solo 2026. Il motivo: in Vetta
-- 16.327 record su 23.847 sono nati il 9 marzo 2026, il giorno in cui lo
-- storico e' stato caricato in blocco. La loro `createdAt` e' la data del
-- caricamento, non quella della richiesta, e in Vetta nessun altro campo
-- la conserva (verificato: updatedAt, lastContactedAt, qualifiedAt,
-- unqualifiedAt, primaChiamata sono vuoti o del 2026). Quello che resta
-- di vero e' la data di vendita delle opportunita' (closeDate, 2022-2026).
--
-- Quindi: ogni richiesta dice se la sua data e' certa. Quelle del 9 marzo
-- non lo sono, e il filtro per anno/periodo le ignora, ma guarda ANCHE
-- le vendite: «2024» e' chi ha chiesto nel 2024 (data certa) o ha
-- comprato nel 2024. Chi non ha ne' l'una ne' l'altra sta sotto «Data
-- non nota», e la pagina lo scrive invece di mostrare 09/03/2026 come
-- se fosse il giorno in cui ha scritto.
alter table public.crm_richieste
  add column if not exists data_certa boolean not null default true;
comment on column public.crm_richieste.data_certa is
  'Falso per i record caricati in blocco in Vetta il 09/03/2026: la data e'' quella del caricamento, non della richiesta.';

update public.crm_richieste
set data_certa = false
where (richiesta_il at time zone 'Europe/Rome')::date = date '2026-03-09';

create index if not exists crm_richieste_data_certa on public.crm_richieste (contatto_id) where data_certa;

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
    -- gli anni: quelli delle richieste con data certa e quelli delle vendite
    'anni', (select coalesce(jsonb_agg(jsonb_build_object('valore', anno, 'quanti', n) order by anno desc), '[]'::jsonb)
             from (select anno, count(distinct contatto_id) n from (
                     select extract(year from richiesta_il at time zone 'Europe/Rome')::int anno, contatto_id
                     from crm_richieste where data_certa and richiesta_il is not null
                     union all
                     select extract(year from (o->>'chiusa_il')::date)::int, c.id
                     from crm_contatti c, jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o
                     where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}'
                   ) u group by anno) x),
    'senza_data', (select count(*) from crm_contatti c
                   where not exists (select 1 from crm_richieste r where r.contatto_id = c.id and r.data_certa)
                     and not exists (select 1 from jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}')),
    'totale', (select count(*) from crm_contatti),
    'disiscritti', (select count(*) from crm_contatti where disiscritto_il is not null)
  );
$$;

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
  f_senza_data boolean := coalesce((filtri->>'senza_data')::boolean, false);
  con_date boolean := f_anno is not null or f_dal is not null or f_al is not null;
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
      -- «data non nota»: nessuna richiesta con data certa e nessuna vendita datata
      and (not f_senza_data or (
            not exists (select 1 from crm_richieste r where r.contatto_id = c.id and r.data_certa)
            and not exists (select 1 from jsonb_array_elements(coalesce(c.opportunita, '[]'::jsonb)) o where o->>'chiusa_il' ~ '^\d{4}-\d{2}-\d{2}')))
      -- periodo e corso: una richiesta (con data certa, se si filtra per
      -- data) oppure una vendita in quel periodo per quel corso
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
              and (f_corso is null or o->>'corso' = f_corso))))
  ), pagina as (
    select (to_jsonb(b) - 'opportunita' - 'telefoni_aggiuntivi' - 'email_aggiuntive')
             || jsonb_build_object(
                  'con_data_certa', exists (select 1 from crm_richieste r where r.contatto_id = b.id and r.data_certa),
                  'ultima_vendita_il', b.ultima_vendita_il) as riga,
           count(*) over () as tot
    from base b
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
