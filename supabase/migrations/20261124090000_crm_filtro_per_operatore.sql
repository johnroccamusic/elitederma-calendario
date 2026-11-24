-- IL FILTRO PER OPERATORE (24/11/2026).
--
-- Il titolare: «se un operatore esce, siamo in grado di fare una mailing
-- list a tutti i clienti di quell'operatore … selezionare la lista anche
-- per lead trattati, chiusi, non risposti da un determinato operatore».
--
-- «Trattato da» c'era gia', ma guardava `crm_contatti.trattato_da`, cioe'
-- l'operatore dell'ULTIMA richiesta: chi aveva scritto a Katia nel 2024 e
-- poi a Olga nel 2025 risultava solo di Olga, e la mailing list «i clienti
-- di Katia» lo perdeva. Adesso guarda TUTTE le richieste della persona.
--
-- E accanto c'e' l'esito di quel lead CON QUELL'OPERATORE
-- (`esito_operatore`), letto dalla stessa richiesta — non dal contatto,
-- che porta solo la qualifica di oggi:
--
--   chiusi         qualifica CLIENTI, o un'opportunita' CLOSED_WON
--   non_chiusi     tutto il resto
--   da_richiamare  qualifica CONTATTI_DA_RICHIAMARE
--   scartati       qualifica CONTATTI_SCARTATI
--
-- In Vetta un campo «non ha risposto» NON esiste (verificato su tutti i
-- campi della persona: categoria, gestione chiamata, qualita' contatto):
-- il piu' vicino e' «da richiamare». L'esito vale solo con un operatore
-- scelto: «chiusi» senza dire da chi e' gia' il filtro Qualifica.
--
-- Sta qui, nell'unica WHERE: vale insieme per l'elenco, il totale e i
-- destinatari che una campagna congela.
--
-- Rollback: rieseguire crm_contatti_filtrati da
-- 20261117150000_la_mailing_list_dei_clienti_shop.sql.

create or replace function public.crm_contatti_filtrati(filtri jsonb default '{}'::jsonb)
 returns setof crm_contatti
 language plpgsql
 stable
 set search_path to 'public'
as $function$
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
  f_esito text := nullif(filtri->>'esito_operatore', '');
  f_mestiere text := nullif(filtri->>'mestiere', '');
  f_collegamento text := nullif(filtri->>'collegamento', '');
  f_disiscritti boolean := coalesce((filtri->>'disiscritti')::boolean, false);
  f_da_verificare boolean := coalesce((filtri->>'da_verificare')::boolean, false);
  f_con_email boolean := coalesce((filtri->>'con_email')::boolean, false);
  f_senza_data boolean := coalesce((filtri->>'senza_data')::boolean, false);
  f_cliente_shop boolean := coalesce((filtri->>'cliente_shop')::boolean, false);
  f_non_in_crm boolean := coalesce((filtri->>'non_in_crm')::boolean, false);
  f_acq_dal date := nullif(filtri->>'acquisto_dal', '')::date;
  f_acq_al date := nullif(filtri->>'acquisto_al', '')::date;
  f_reparto text := nullif(filtri->>'reparto', '');
  f_speso_da numeric := nullif(filtri->>'speso_da', '')::numeric;
  con_date boolean := f_anno is not null or f_dal is not null or f_al is not null;
  sulle_richieste boolean := f_anno is not null or f_dal is not null or f_al is not null or f_corso is not null;
  sugli_ordini boolean := f_acq_dal is not null or f_acq_al is not null or f_reparto is not null;
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
      -- l'operatore: una richiesta qualunque della persona, con l'esito
      -- che QUELLA richiesta ha avuto
      and (f_trattato is null or exists (
            select 1 from crm_richieste r
            where r.contatto_id = c.id
              and r.trattato_da = f_trattato
              and (f_esito is null
                   or (f_esito = 'chiusi' and (r.qualifica = 'CLIENTI'
                        or coalesce(r.opportunita, '[]'::jsonb) @> '[{"stato":"CLOSED_WON"}]'::jsonb))
                   or (f_esito = 'non_chiusi' and r.qualifica is distinct from 'CLIENTI'
                        and not coalesce(r.opportunita, '[]'::jsonb) @> '[{"stato":"CLOSED_WON"}]'::jsonb)
                   or (f_esito = 'da_richiamare' and r.qualifica = 'CONTATTI_DA_RICHIAMARE')
                   or (f_esito = 'scartati' and r.qualifica = 'CONTATTI_SCARTATI'))))
      and (f_mestiere is null or c.mestiere = f_mestiere)
      and (f_collegamento is null or c.collegamento = f_collegamento)
      -- i clienti shop
      and (not f_cliente_shop or c.acquisti_shop > 0)
      and (f_speso_da is null or c.speso_shop >= f_speso_da)
      and (not f_non_in_crm or (
            c.vetta_id_principale is null
            and not exists (select 1 from crm_richieste r where r.contatto_id = c.id)))
      and (not sugli_ordini or exists (
            select 1 from vendite_shop_reparti sr
            where sr.email = lower(trim(c.email))
              and (f_reparto is null or sr.reparto = f_reparto)
              and (f_acq_dal is null or (sr.data_ordine at time zone 'Europe/Rome')::date >= f_acq_dal)
              and (f_acq_al is null or (sr.data_ordine at time zone 'Europe/Rome')::date <= f_acq_al)))
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
$function$;
