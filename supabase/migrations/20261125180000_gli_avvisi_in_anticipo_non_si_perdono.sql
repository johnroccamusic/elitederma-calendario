-- GLI AVVISI DI RESEND CHE ARRIVANO PRIMA DELLA LORO RIGA (25/11/2026)
--
-- Il titolare, guardando la prima campagna vera: «ma perché su 400 e
-- passa mail ricevute solo 92?».
--
-- MISURATO PRIMA DI TOCCARE NIENTE. Resend, sul 24-25/11: **652 partite,
-- 555 consegnate, 97 rimbalzate**. L'app ne aveva registrate **133
-- consegnate e 43 rimbalzate**: mancavano all'appello circa 420 consegne
-- e 54 rimbalzi, e 301 righe di quella campagna erano ferme a «preso in
-- carico».
--
-- LA CAUSA, in una riga: quando il lotto parte, Resend risponde con
-- cento id e `crm-campagna-invia` li scriveva sulle righe **uno per
-- uno**, cento scritture in fila — due o tre secondi. Resend però
-- consegna (e incassa i rimbalzi) in meno di un secondo, e manda subito
-- l'avviso a `email-eventi`, che cerca la riga **per id di Resend**. In
-- quei secondi la riga quell'id non ce l'ha ancora: nessuna riga
-- trovata, si rispondeva **200**, e l'avviso era perso per sempre —
-- Resend non lo rimanda, perché gli abbiamo detto «ricevuto».
--
-- E a perdersi erano soprattutto i RIMBALZI, che sono i più veloci:
-- Gmail e Libero rifiutano un indirizzo inesistente all'istante, cioè
-- esattamente nella finestra in cui la riga è cieca. Così quegli
-- indirizzi restavano «inviata» e alla campagna dopo venivano riscritti,
-- perché il filtro «chi ha già rimbalzato» non li conosceva.
--
-- QUESTA MIGRAZIONE FA TRE COSE:
--
--  1. `email_eventi_orfani` — un avviso che non trova la sua riga non si
--     butta più: si mette da parte. Un avviso con un id sconosciuto è
--     **in anticipo**, non **di un altro**.
--  2. `crm_campagna_applica_evento` — LA SCALA DEGLI STATI STA QUI, in un
--     posto solo, e la chiamano sia il webhook sia la scrittura degli id.
--     Due copie della stessa scala un giorno direbbero due verità sulla
--     stessa riga.
--  3. `crm_campagna_segna_inviate` — i cento id si scrivono in UNA
--     scrittura invece di cento (la finestra cieca passa da secondi a
--     millisecondi) e, subito dopo, si applicano gli avvisi messi da
--     parte per quegli id. Da lì non si perde più niente.
--
-- ROLLBACK:
--   drop function if exists public.crm_campagna_segna_inviate(jsonb);
--   drop function if exists public.crm_campagna_applica_evento(text, text, timestamptz);
--   drop table if exists public.email_eventi_orfani;
-- Tornando indietro bisogna rimettere anche le due edge function di
-- prima (`crm-campagna-invia`, `email-eventi`), o scriverebbero verso
-- funzioni che non esistono più e la campagna si fermerebbe.

-- 1. GLI AVVISI IN ANTICIPO ------------------------------------------
create table if not exists public.email_eventi_orfani (
  id          uuid primary key default gen_random_uuid(),
  resend_id   text not null,
  tipo        text not null,
  quando      timestamptz not null,
  ricevuto_il timestamptz not null default now(),
  applicato_il timestamptz
);
create index if not exists email_eventi_orfani_resend_idx
  on public.email_eventi_orfani (resend_id) where applicato_il is null;

comment on table public.email_eventi_orfani is
  'Avvisi di Resend arrivati prima che la riga del destinatario avesse il suo resend_id (o per mail che non sono nostre). Si applicano da soli appena la riga esiste: vedi crm_campagna_segna_inviate.';

alter table public.email_eventi_orfani enable row level security;
drop policy if exists "orfani solo staff" on public.email_eventi_orfani;
create policy "orfani solo staff" on public.email_eventi_orfani
  for select to authenticated using (true);

-- 2. LA SCALA, IN UN POSTO SOLO --------------------------------------
--
-- Gli avvisi di Resend arrivano fuori ordine: «consegnata» dopo
-- «aperta» riporterebbe la riga indietro, e un rimbalzo o una
-- segnalazione — che sono definitivi — verrebbero cancellati da un
-- avviso più lento. Lo stato si sposta solo in avanti; `ultimo_evento`
-- si scrive sempre.
--
-- Restituisce la riga toccata (serve a chi chiama per la disiscrizione
-- di chi ci segnala come spam), oppure niente se l'avviso è stato messo
-- da parte.
create or replace function public.crm_campagna_applica_evento(
  p_resend_id text,
  p_tipo text,
  p_quando timestamptz default now(),
  p_parcheggia boolean default true
) returns table (destinatario_id uuid, contatto_id uuid, email text, parcheggiato boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_nuovo text;
  v_scala jsonb := '{"in_coda":0,"in_spedizione":0,"fallita":0,"inviata":1,"consegnata":2,"aperta":3,"rimbalzata":4,"segnalata":5}'::jsonb;
  v_quante int;
begin
  v_nuovo := case p_tipo
    when 'email.delivered'  then 'consegnata'
    when 'email.opened'     then 'aperta'
    when 'email.bounced'    then 'rimbalzata'
    when 'email.complained' then 'segnalata'
    else null end;

  select count(*) into v_quante from crm_campagne_destinatari d where d.resend_id = p_resend_id;

  -- NESSUNA RIGA: l'avviso e' in anticipo (gli id del lotto non sono
  -- ancora scritti) oppure non e' di una campagna. Si mette da parte, e
  -- lo applichera' `crm_campagna_segna_inviate` appena la riga esiste.
  if v_quante = 0 then
    -- si mette da parte SOLO quello che sposterebbe lo stato: un
    -- «differita» o un «click» senza riga non racconta niente che
    -- serva dopo, e in una notte di rinvii sarebbero centinaia di
    -- righe da guardare per nulla
    if p_parcheggia and v_nuovo is not null then
      insert into email_eventi_orfani (resend_id, tipo, quando) values (p_resend_id, p_tipo, p_quando);
      return query select null::uuid, null::uuid, null::text, true;
    else
      return query select null::uuid, null::uuid, null::text, false;
    end if;
    return;
  end if;

  if v_nuovo is not null then
    update crm_campagne_destinatari d
       set stato = v_nuovo
     where d.resend_id = p_resend_id
       and coalesce((v_scala ->> v_nuovo)::int, 0) > coalesce((v_scala ->> d.stato)::int, 0);
  end if;

  return query
    update crm_campagne_destinatari d
       set ultimo_evento = p_tipo, ultimo_evento_il = p_quando
     where d.resend_id = p_resend_id
    returning d.id, d.contatto_id, d.email, false;
end;
$$;

revoke all on function public.crm_campagna_applica_evento(text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.crm_campagna_applica_evento(text, text, timestamptz, boolean) to service_role;

-- 3. GLI ID SI SCRIVONO IN UNA VOLTA SOLA ----------------------------
--
-- `p_righe` e' [{"id": "<riga>", "resend_id": "<id di Resend>"}, ...].
-- Una scrittura sola per tutto il lotto, e subito dopo si applicano gli
-- avvisi arrivati in anticipo per quegli id: e' qui che si chiude il
-- buco. Torna quante righe ha segnato e quanti avvisi ha recuperato,
-- perche' una scrittura che non dice quante righe ha toccato mente.
create or replace function public.crm_campagna_segna_inviate(p_righe jsonb)
returns table (segnate int, recuperati int)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_segnate int := 0;
  v_recuperati int := 0;
  v_evento record;
begin
  with voci as (
    select (x ->> 'id')::uuid as id, x ->> 'resend_id' as resend_id
      from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) x
     where (x ->> 'id') is not null and (x ->> 'resend_id') is not null
  ), scritte as (
    update crm_campagne_destinatari d
       set stato = 'inviata', resend_id = v.resend_id, inviata_il = now(), errore = null
      from voci v
     where d.id = v.id
    returning d.id
  )
  select count(*) into v_segnate from scritte;

  -- GLI AVVISI MESSI DA PARTE, adesso che la riga c'e'. Si applicano in
  -- ordine di arrivo: la scala dentro `crm_campagna_applica_evento`
  -- pensa a non far tornare indietro niente.
  for v_evento in
    select o.id, o.resend_id, o.tipo, o.quando
      from email_eventi_orfani o
      join jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) x
        on x ->> 'resend_id' = o.resend_id
     where o.applicato_il is null
     order by o.quando
  loop
    perform public.crm_campagna_applica_evento(v_evento.resend_id, v_evento.tipo, v_evento.quando, false);
    update email_eventi_orfani set applicato_il = now() where id = v_evento.id;
    v_recuperati := v_recuperati + 1;
  end loop;

  return query select v_segnate, v_recuperati;
end;
$$;

revoke all on function public.crm_campagna_segna_inviate(jsonb) from public, anon, authenticated;
grant execute on function public.crm_campagna_segna_inviate(jsonb) to service_role;
