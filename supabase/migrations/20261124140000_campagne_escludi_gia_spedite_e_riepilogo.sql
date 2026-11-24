-- «ESCLUDI QUELLE GIA' SPEDITE», E I CONTEGGI DELL'AREA CAMPAGNE.
-- 24/11/2026.
--
-- Il titolare, dopo che la prima campagna si e' fermata al tetto
-- giornaliero di Resend: «nella pagina di invio ci dovrebbe essere un
-- filtro extra che si chiama "escludi quelle gia' spedite", in modo che
-- non mando doppioni se dovessi sospendere e riprendere». E: «ci dovrebbe
-- essere un tasto salva campagna… un'area in cui ci sono le campagne in
-- corso, anche se stoppate, dove posso rientrare e terminare la
-- spedizione se voglio dividere il pubblico a gruppi».
--
-- COSA C'ERA GIA', detto per non costruirlo due volte: **dentro la stessa
-- campagna il doppione era gia' impossibile**. `crm_campagna_prepara`
-- cancella le sole righe `in_coda` e l'inserimento salta le email che in
-- quella campagna ci sono gia' (`where not exists`), contandole come
-- `gia_spediti`; e il lotto prende solo righe `in_coda`. Sospendere e
-- riprendere la STESSA campagna non ha mai potuto rispedire niente.
--
-- IL BUCO ERA FRA CAMPAGNE DIVERSE, ed e' il caso capitato oggi: la
-- campagna delle 11:06 e' morta sul vincolo, quella delle 11:48 e' nata
-- nuova e ha spedito 200 mail. Una terza campagna sullo stesso pubblico
-- avrebbe riscritto a quelle 200, perche' la preparazione esclude
-- disiscritti, da verificare, chi ha rimbalzato e i doppioni di email —
-- ma non chi ha GIA' RICEVUTO.
--
-- Adesso lo fa, se glielo si chiede: la chiave `escludi_gia_spedite` nei
-- filtri della campagna. Tre decisioni:
--
--   * si esclude chi risulta `inviata`, `consegnata` o `aperta` in
--     un'ALTRA campagna. `fallita` no: quella mail non e' arrivata, e
--     trattarla come spedita vorrebbe dire non riprovare mai piu' con
--     quella persona. `rimbalzata` e `segnalata` sono gia' fuori per
--     conto loro, da sempre;
--   * **non e' acceso di default**, ed e' voluto: una campagna nuova, con
--     un testo nuovo, deve poter arrivare a tutti. Accenderlo di suo
--     vorrebbe dire che la seconda mail della storia dell'Accademia
--     salta chiunque abbia ricevuto la prima, in silenzio;
--   * la regola sta QUI e non nel browser, come il resto delle
--     esclusioni: la pagina mostra una spunta, il conto dei destinatari
--     lo fa un posto solo.
--
-- E I CONTEGGI DELL'AREA «CAMPAGNE» ERANO FALSI. Quella pagina leggeva le
-- righe dei destinatari con `.limit(100000)` e le contava nel browser, ma
-- PostgREST ne serve MILLE: su 58.000 righe i numeri di consegnate,
-- aperte, rimbalzate — e quante restano in coda — erano quelli delle
-- prime mille righe, cioe' falsi senza dirlo. E' la regola «PostgREST
-- tronca a mille», pagata un'altra volta. Il conto si fa nel database:
-- `crm_campagne_riepilogo`, una riga per campagna.
--
-- Nessun dato toccato: una funzione riscritta e una vista nuova.
--
-- ROLLBACK:
--   drop view if exists public.crm_campagne_riepilogo;
--   -- e si rimette la versione precedente di crm_campagna_prepara, che e'
--   -- questa meno il blocco marcato «escludi_gia_spedite» e le due voci
--   -- `gia_ricevute` (una in `esclusi`, una nel jsonb di ritorno).

create or replace function public.crm_campagna_prepara(p_campagna uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  camp crm_campagne%rowtype;
  n_tot integer := 0; n_senza_email integer := 0; n_disiscritti integer := 0; n_da_verificare integer := 0;
  n_doppioni integer := 0; n_rimbalzate integer := 0; n_inseriti integer := 0; n_gia_spediti integer := 0;
  n_gia_ricevute integer := 0;
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
  select count(*) into n_disiscritti from _cand x
    where x.disiscritto_il is not null or exists (select 1 from crm_contatti d where lower(d.email) = x.email_k and d.disiscritto_il is not null);
  delete from _cand x where x.disiscritto_il is not null or exists (select 1 from crm_contatti d where lower(d.email) = x.email_k and d.disiscritto_il is not null);
  select count(*) into n_da_verificare from _cand where da_verificare;
  delete from _cand where da_verificare;
  select count(*) into n_rimbalzate from _cand x
    where exists (select 1 from crm_campagne_destinatari d where lower(d.email) = x.email_k and d.stato in ('rimbalzata', 'segnalata'));
  delete from _cand x where exists (select 1 from crm_campagne_destinatari d where lower(d.email) = x.email_k and d.stato in ('rimbalzata', 'segnalata'));

  -- escludi_gia_spedite: chi ha gia' ricevuto una mail di un'ALTRA
  -- campagna. Serve a dividere il pubblico a gruppi senza riscrivere a
  -- chi e' gia' stato servito; dentro la stessa campagna il doppione era
  -- gia' impossibile (vedi il `where not exists` dell'insert qui sotto).
  if coalesce((camp.filtri->>'escludi_gia_spedite')::boolean, false) then
    select count(*) into n_gia_ricevute from _cand x
      where exists (select 1 from crm_campagne_destinatari d
                     where lower(d.email) = x.email_k and d.campagna_id <> p_campagna
                       and d.stato in ('inviata', 'consegnata', 'aperta'));
    delete from _cand x
      where exists (select 1 from crm_campagne_destinatari d
                     where lower(d.email) = x.email_k and d.campagna_id <> p_campagna
                       and d.stato in ('inviata', 'consegnata', 'aperta'));
  end if;

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
                                 'da_verificare', n_da_verificare, 'rimbalzate_prima', n_rimbalzate, 'doppioni_email', n_doppioni,
                                 'gia_ricevute', n_gia_ricevute),
    aggiornata_il = now()
  where id = p_campagna;

  return jsonb_build_object('inseriti', n_inseriti, 'gia_spediti', n_gia_spediti, 'contatti_filtrati', n_tot,
                            'senza_email', n_senza_email, 'disiscritti', n_disiscritti, 'da_verificare', n_da_verificare,
                            'rimbalzate_prima', n_rimbalzate, 'doppioni_email', n_doppioni, 'gia_ricevute', n_gia_ricevute);
end;
$function$;

-- IL RIEPILOGO DI OGNI CAMPAGNA, CONTATO DAL DATABASE.
-- `security_invoker` come le altre viste chiuse il 31/10: gira coi
-- permessi di chi legge, quindi serve una sessione.
create or replace view public.crm_campagne_riepilogo
with (security_invoker = true) as
select c.id as campagna_id,
       count(d.id) filter (where d.stato = 'in_coda')       as in_coda,
       count(d.id) filter (where d.stato = 'in_spedizione') as in_spedizione,
       count(d.id) filter (where d.stato = 'inviata')       as inviate,
       count(d.id) filter (where d.stato = 'consegnata')    as consegnate,
       count(d.id) filter (where d.stato = 'aperta')        as aperte,
       count(d.id) filter (where d.stato = 'rimbalzata')    as rimbalzate,
       count(d.id) filter (where d.stato = 'segnalata')     as segnalate,
       count(d.id) filter (where d.stato = 'fallita')       as fallite,
       count(d.id)                                          as destinatari
  from crm_campagne c
  left join crm_campagne_destinatari d on d.campagna_id = c.id
 group by c.id;

revoke all on public.crm_campagne_riepilogo from public, anon;
grant select on public.crm_campagne_riepilogo to authenticated;

comment on view public.crm_campagne_riepilogo is
  'Quante mail di ogni campagna sono in coda, spedite, consegnate, aperte, rimbalzate. Il conto si fa qui: leggendo le righe dal browser PostgREST ne serve mille e i numeri uscivano falsi.';
