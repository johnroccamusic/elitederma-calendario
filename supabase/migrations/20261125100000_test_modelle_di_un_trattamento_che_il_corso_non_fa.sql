-- IL TEST DI SISTEMA GUARDA ANCHE LE MODELLE (25/11/2026)
--
-- Nato dalla segnalazione del titolare su PMU BASE ROMA del 30/11:
-- «quando un iscritto ha richiesto una sola modella, nella pagina assegna
-- modelle risultano come "nostra da cercare" anche le modelle per le
-- altre tecniche che lui non ha richiesto». E, subito dopo: «la
-- problematica va nel pacchetto dei test».
--
-- Quel guasto era nella VISTA — la pagina elencava chi e' presente in un
-- giorno invece di chi quel giorno ha chiesto qualcosa — e la guardia che
-- lo tiene chiuso sta nel repo (prove/modelle-non-chieste.test.jsx):
-- qui, nel database, non si vedrebbe, perche' il dato era giusto.
--
-- Misurando quel caso ne e' pero' uscito uno che SI VEDE DAL DATO, e che
-- produce lo stesso sintomo: un posto modella di un trattamento che quel
-- corso NON FA. Un'iscritta al NEEDLING di Milano del 28/03/2027 porta
-- tre posti di PMU — sopracciglia, labbra, eyeliner sfumato — e il
-- needling ha un giorno solo, di needling. Quei tre posti
-- non combaciano con nessun giorno, quindi `giorniDeiPostiModella` li
-- appoggia sul giorno di ripiego: tre modelle da cercare per tecniche
-- che in quell'aula non si faranno.
--
-- E' «guarda», non «rotto»: il posto puo' essere stato scritto apposta
-- (un'allieva che fa due corsi, una tecnica concordata a voce), e
-- correggerlo da qui vorrebbe dire cancellare una richiesta che qualcuno
-- ha fatto. Lo legge una persona.

create or replace function public.test_di_sistema_modelle_fuori_corso()
returns integer
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select count(*)::integer
  from iscritti i
  join corsi_date cd on cd.id = i.corso_data_id
  cross join lateral jsonb_array_elements(coalesce(i.tipi_modelle, '[]'::jsonb)) as p
  where i.richiede_modelle
    and cd.data_fine >= current_date
    and coalesce(trim(p->>'tipo'), '') <> ''
    and exists (
      select 1 from corsi_giorni cg
      where cg.corso_id = cd.corso_id and cg.richiede_modelle_allievi)
    and not exists (
      select 1 from corsi_giorni cg
      where cg.corso_id = cd.corso_id
        and cg.richiede_modelle_allievi
        and upper(trim(cg.tipo_modella_allievi)) = upper(trim(p->>'tipo')));
$$;

comment on function public.test_di_sistema_modelle_fuori_corso() is
  'Quanti posti modella chiedono un trattamento che il loro corso non prevede: finiscono sul giorno di ripiego e si cercano per niente.';

revoke all on function public.test_di_sistema_modelle_fuori_corso() from public, anon;
grant execute on function public.test_di_sistema_modelle_fuori_corso() to authenticated;

-- ROLLBACK
--   drop function if exists public.test_di_sistema_modelle_fuori_corso();
-- Nessun dato toccato: legge e conta.

-- ------------------------------------------------------------------
-- IL CONTROLLO ENTRA NEL REFERTO.
--
-- Si innesta nel testo della funzione VIVA (`pg_get_functiondef`) invece
-- di riscriverne il corpo a mano: cosi' i 22 controlli che ci sono
-- restano identici carattere per carattere, e se il corpo non e' quello
-- atteso non si tocca niente. E' la stessa tecnica del 9/11/2026.
do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'test_di_sistema' and p.pronargs = 0;
  if def is null then
    raise exception 'test_di_sistema non esiste';
  end if;
  if position('test_di_sistema_modelle_fuori_corso' in def) > 0 then
    raise notice 'il controllo delle modelle c''e'' gia''';
    return;
  end if;
  -- si innesta IN FONDO, prima del return: l'ancoraggio sono le due
  -- righe che chiudono la funzione, non un commento — i commenti del
  -- corpo vivo non sono identici a quelli del file della migrazione, e
  -- fidarsi di un commento come punto d'innesto vuol dire una
  -- migrazione che un giorno scrive nel posto sbagliato (questa si e'
  -- fermata da sola al primo giro, ed e' il motivo per cui il controllo
  -- c'e')
  if position(E'\n  return;\nend;' in def) = 0 then
    raise exception 'il corpo di test_di_sistema non e'' quello atteso: non tocco niente';
  end if;
  def := replace(def,
    E'\n  return;\nend;',
    E'\n  -- 23. NESSUNA MODELLA SI CERCA PER UN TRATTAMENTO CHE IL CORSO NON FA\n'
    || E'  n := test_di_sistema_modelle_fuori_corso();\n'
    || E'  return query select ''Modelle'', ''Ogni posto modella appartiene a un trattamento del suo corso'',\n'
    || E'    case when n = 0 then ''ok'' when n <= 3 then ''guarda'' else ''rotto'' end, n::text || '' posti'', ''zero'',\n'
    || E'    ''25/11/2026: su PMU BASE ROMA comparivano «nostra da cercare» modelle per tecniche che l''''allievo non aveva chiesto. Quel guasto era nella pagina ed e'''' chiuso; questo e'''' il suo gemello che si vede dal dato — un posto di un trattamento che quel corso non fa non combacia con nessun giorno, finisce sul giorno di ripiego, e qualcuno cerca una modella per niente (oggi: tre posti PMU su un corso NEEDLING)'',\n'
    || E'    ''Apri Assegna modelle di quella classe: o il posto va corretto nel trattamento giusto, o va tolto. Non si corregge da qui: puo'''' essere una richiesta vera, concordata a voce.'';\n'
    || E'\n  return;\nend;');
  execute def;
end $$;
