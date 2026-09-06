-- Le modelle già inserite non sanno chi le ha trovate: il campo non
-- esisteva. Le quattro che hanno davvero un nome (su 55 posti, gli altri 51
-- sono richieste ancora scoperte) vanno tutte ad Andrea, come deciso.
-- Nessuna di esse è su un corso trico, quindi qui non serve eccezione: se
-- una andrà spostata su John, si cambia dalla tendina.
--
-- Si tocca solo chi ha un nome_modella scritto: un posto vuoto non è una
-- modella reperita e non deve nascere già attribuito a qualcuno.
update public.iscritti i
set tipi_modelle = (
  select jsonb_agg(
    case
      when coalesce(e.valore->>'nome_modella', '') <> ''
        then e.valore || jsonb_build_object(
          'reperita_da_tipo', 'master',
          'reperita_da_id', (select m.id::text from public.master m where m.nome ilike 'ANDREA PAURA' limit 1),
          'reperita_da_nome', 'ANDREA PAURA'
        )
      else e.valore
    end
    order by e.ordine
  )
  from jsonb_array_elements(i.tipi_modelle) with ordinality as e(valore, ordine)
)
where i.tipi_modelle is not null
  and jsonb_array_length(i.tipi_modelle) > 0
  and exists (
    select 1 from jsonb_array_elements(i.tipi_modelle) as x(v)
    where coalesce(x.v->>'nome_modella', '') <> ''
  );
