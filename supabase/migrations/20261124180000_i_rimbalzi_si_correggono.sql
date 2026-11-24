-- I RIMBALZI SI GUARDANO E SI CORREGGONO (24/11/2026)
--
-- Il titolare, dopo la prima campagna vera: «quando faccio delle mailing
-- e mi rimbalza degli indirizzi, mi devi poter creare delle liste per cui
-- clicco sui 20 indirizzi rimbalzati e vedo se sono recuperabili, del tipo
-- Gmail, se fossero scritti in un modo inappropriato. A sinistra
-- l'indirizzo rimbalzato, a destra un campo pulito dove posso mettere la
-- correzione, e alla fine un tasto rinvia la mail agli indirizzi corretti».
--
-- I venti rimbalzi di oggi sono tre famiglie diverse, ed e' il motivo per
-- cui serviva guardarli uno per uno invece di contarli:
--   * errori di battitura veri (una coda «.ti» per «.it», un «.con» per
--     «.com»): si correggono, e la mail arriva;
--   * indirizzi messi per riempire una casella obbligatoria («no@…»,
--     un nome di battesimo su gmail): non si correggono, non esistono —
--     quella persona ha un telefono, non una mail;
--   * indirizzi di forma giusta che rimbalzano (casella piena o chiusa):
--     non c'e' niente da correggere.
-- L'app propone la correzione solo per la prima famiglia. Sulle altre due
-- non indovina: dice che non c'e' una correzione evidente.
--
-- PERCHE' LA RIGA RIMBALZATA NON SI RISCRIVE, ed e' la decisione di fondo.
-- Nasce una riga NUOVA con l'indirizzo corretto e quella vecchia resta
-- dov'e'. Non e' prudenza: `crm_campagna_prepara` tiene fuori dalle
-- campagne future chi ha una riga `rimbalzata` CONFRONTANDO L'EMAIL, e
-- quella riga e' l'unica cosa che impedisce di riscrivere all'indirizzo
-- morto. Sovrascrivendola si perderebbe il blocco insieme alla storia; e
-- siccome il confronto e' per email, l'indirizzo corretto — che non ha
-- mai rimbalzato — rientra da se'.
--
-- E IL CONTATTO SI CORREGGE, altrimenti la campagna di domani ripete lo
-- stesso errore: la correzione vale per questo invio e per tutti i
-- prossimi. Ma si scrive SOLO se il contatto porta ancora l'indirizzo che
-- ha rimbalzato: uno cambiato a mano nel frattempo non si tocca — e' la
-- stessa regola del codice fiscale, si rifa' solo quello che abbiamo
-- scritto noi.
--
-- QUELLO CHE IL DATABASE RIFIUTA, e ognuno e' un modo di rimandare una
-- mail nel vuoto: la stessa email che ha appena rimbalzato, un indirizzo
-- che ha rimbalzato in un'altra campagna, uno che si e' disiscritto, uno
-- gia' fra i destinatari di questa campagna, e qualunque cosa che non
-- abbia la forma di un indirizzo. Non si ferma tutto il giro: la riga
-- rifiutata torna col suo perche' e le altre passano.

create or replace function public.crm_campagna_correggi_rimbalzi(
  p_campagna uuid,
  p_correzioni jsonb
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  camp crm_campagne%rowtype;
  r record;
  vecchia crm_campagne_destinatari%rowtype;
  trovata boolean;
  nuova text;
  motivo text;
  tok text;
  cont_email text;
  n_corrette integer := 0;
  rifiutate jsonb := '[]'::jsonb;
begin
  select * into camp from crm_campagne where id = p_campagna;
  if not found then raise exception 'campagna non trovata'; end if;
  if camp.stato = 'annullata' then raise exception 'la campagna è annullata: da qui non parte più niente'; end if;

  for r in select (x->>'id')::uuid as id, lower(trim(coalesce(x->>'email', ''))) as email
             from jsonb_array_elements(coalesce(p_correzioni, '[]'::jsonb)) x
  loop
    motivo := null;
    select * into vecchia from crm_campagne_destinatari
      where id = r.id and campagna_id = p_campagna;
    trovata := found;
    nuova := nullif(r.email, '');

    if not trovata then
      motivo := 'questa riga non è di questa campagna';
    elsif vecchia.stato not in ('rimbalzata', 'segnalata') then
      motivo := 'questa riga non è rimbalzata: non c''è niente da correggere';
    elsif nuova is null or nuova !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      motivo := 'non ha la forma di un indirizzo email';
    elsif nuova = lower(vecchia.email) then
      motivo := 'è lo stesso indirizzo che ha rimbalzato';
    elsif exists (select 1 from crm_campagne_destinatari d
                   where lower(d.email) = nuova and d.stato in ('rimbalzata', 'segnalata')) then
      motivo := 'anche questo indirizzo ha già rimbalzato, in questa o in un''altra campagna';
    elsif exists (select 1 from crm_contatti c
                   where lower(c.email) = nuova and c.disiscritto_il is not null) then
      motivo := 'questo indirizzo si è disiscritto: non si scrive più';
    elsif exists (select 1 from crm_campagne_destinatari d
                   where d.campagna_id = p_campagna and lower(d.email) = nuova) then
      motivo := 'questo indirizzo è già fra i destinatari di questa campagna';
    end if;

    if motivo is not null then
      rifiutate := rifiutate || jsonb_build_object(
        'id', r.id, 'email', coalesce(nuova, ''), 'vecchia', coalesce(vecchia.email, ''), 'motivo', motivo);
      continue;
    end if;

    -- il token di disiscrizione e' quello del contatto, come lo prende
    -- `crm_campagna_prepara`; senza contatto si riusa quello della riga
    -- rimbalzata, o la mail partirebbe senza il link per non riceverla piu'
    tok := null; cont_email := null;
    if vecchia.contatto_id is not null then
      select c.token_disiscrizione, lower(c.email) into tok, cont_email
        from crm_contatti c where c.id = vecchia.contatto_id;
    end if;

    insert into crm_campagne_destinatari
      (campagna_id, contatto_id, email, nome, valori, token_disiscrizione, stato, ultimo_evento, ultimo_evento_il)
    values (p_campagna, vecchia.contatto_id, nuova, vecchia.nome, vecchia.valori,
            coalesce(tok, vecchia.token_disiscrizione), 'in_coda',
            'corretto da ' || vecchia.email, now());

    -- la riga rimbalzata resta, e dice dove e' finita
    update crm_campagne_destinatari
       set ultimo_evento = 'corretto in ' || nuova, ultimo_evento_il = now()
     where id = vecchia.id;

    if vecchia.contatto_id is not null and cont_email = lower(vecchia.email) then
      update crm_contatti set email = nuova, aggiornato_il = now()
       where id = vecchia.contatto_id;
    end if;

    n_corrette := n_corrette + 1;
  end loop;

  -- la campagna torna «in invio» se era chiusa: senza, l'invio la rifiuta
  -- e le righe appena create resterebbero in coda per sempre
  if n_corrette > 0 then
    update crm_campagne set
      totale_destinatari = (select count(*) from crm_campagne_destinatari where campagna_id = p_campagna),
      stato = case when stato = 'inviata' then 'in_invio' when stato = 'bozza' then 'pronta' else stato end,
      aggiornata_il = now()
    where id = p_campagna;
  end if;

  return jsonb_build_object(
    'corrette', n_corrette,
    'rifiutate', rifiutate,
    'in_coda', (select count(*) from crm_campagne_destinatari where campagna_id = p_campagna and stato = 'in_coda'));
end;
$$;

comment on function public.crm_campagna_correggi_rimbalzi(uuid, jsonb) is
  'Corregge gli indirizzi rimbalzati di una campagna: una riga nuova in coda per ognuno, la riga rimbalzata resta come traccia e il contatto si allinea. Rifiuta una correzione per volta col motivo.';

revoke all on function public.crm_campagna_correggi_rimbalzi(uuid, jsonb) from public, anon;
grant execute on function public.crm_campagna_correggi_rimbalzi(uuid, jsonb) to authenticated;

-- ROLLBACK
--   drop function if exists public.crm_campagna_correggi_rimbalzi(uuid, jsonb);
-- Tornare indietro non tocca nessun dato: le righe gia' corrette restano
-- dove sono (in coda, o spedite) e gli indirizzi scritti sui contatti
-- restano quelli corretti. Si perde solo il gesto.
