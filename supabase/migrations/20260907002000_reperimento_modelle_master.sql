-- Le "modelle del master" sono un elenco a parte (corsi_date.modelle_master),
-- non stanno fra quelle degli allievi: per questo la prima attribuzione non
-- le aveva toccate. Anche loro contano — una modella del master trovata da
-- qualcuno vale come le altre — quindi vanno segnate, altrimenti quando la
-- tendina esisterà resteranno senza autore per sempre.
--
-- Quella con un nome scritto è Simone Zecchin sul TRICO BASE del 6/9, e va
-- a John: la quota di John è zero, quindi non genera costo. È l'eccezione di
-- cui si parlava, e si scrive come dato — non come regola nel programma.
update public.corsi_date cd
set modelle_master = (
  select jsonb_agg(
    case
      when coalesce(e.valore->>'nome_modella', '') <> ''
        then e.valore || jsonb_build_object(
          'reperita_da_tipo', 'utente',
          'reperita_da_id', (select u.id::text from public.utenti_app u where u.chiave_sistema = '__programmatore' limit 1),
          'reperita_da_nome', (select u.nome from public.utenti_app u where u.chiave_sistema = '__programmatore' limit 1)
        )
      else e.valore
    end
    order by e.ordine
  )
  from jsonb_array_elements(cd.modelle_master) with ordinality as e(valore, ordine)
)
where cd.modelle_master is not null
  and jsonb_array_length(cd.modelle_master) > 0
  and exists (
    select 1 from jsonb_array_elements(cd.modelle_master) as x(v)
    where coalesce(x.v->>'nome_modella', '') <> ''
  );
