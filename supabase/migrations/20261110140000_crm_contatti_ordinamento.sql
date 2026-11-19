-- I TITOLI DELLE COLONNE SI PREMONO, E ORDINA IL DATABASE (10/11/2026)
--
-- Il titolare: «devi mettere il titolo delle colonne sull'elenco degli
-- allievi filtrati e non, cliccando il quale si possono ordinare per nome,
-- per ordine alfabetico o per data».
--
-- PERCHE' L'ORDINE STA QUI E NON NEL BROWSER. La lista dei contatti e' UNA
-- pagina di 50 su 23.757: ordinare nel browser le 50 che si vedono vuol
-- dire ordinare un campione che il database ha scelto con un ALTRO ordine
-- — una lista che sembra in ordine e non lo e', cioe' il modo peggiore di
-- sbagliare, perche' nessuno la mette in dubbio.
--
-- L'ORDINE E' UNA LISTA CHIUSA. Il nome della colonna arriva dal browser,
-- quindi non entra mai nella query: entra in un `case` che restituisce una
-- delle cinque espressioni scritte qui. Qualunque altra cosa vale l'ordine
-- naturale. Il verso e' «asc» oppure «desc», niente altro.
--
-- SI ORDINA PER QUELLO CHE SI LEGGE, mai per una colonna nascosta. Tre
-- scelte, e ognuna per lo stesso motivo:
--   - il NOME e' «nome cognome» (poi `nome_originale`, poi l'email), come
--     lo scrive `nomeDi` nella pagina. Ordinare per `cognome` — che e'
--     l'ordine naturale di prima — darebbe un elenco dove la prima parola
--     che si legge non e' in ordine alfabetico: ordinato per il database,
--     disordinato per chi guarda;
--   - DOVE e' comune, o provincia, o regione, o la citta' scritta in
--     Vetta: la stessa scaletta della riga;
--   - la DATA e' quella che la riga mostra: l'ultimo contatto SOLO se la
--     persona ha almeno una richiesta con data certa, altrimenti la data
--     della vendita, altrimenti niente (e la riga dice «data non nota»).
--     Ordinare per `ultimo_contatto_il` metterebbe in fila 16.327 persone
--     secondo il 9 marzo 2026, il giorno del caricamento in blocco da
--     Vetta — una data che la pagina non mostra apposta.
-- Chi non ha niente da mostrare sta in fondo in tutti e due i versi
-- (`nulls last`): un elenco alfabetico che comincia con sei righe senza
-- nome non si legge.
--
-- QUALIFICA NON SI ORDINA, ed e' voluto: a video si legge l'etichetta
-- («Cliente», «Scartato»), nel database il valore di Vetta
-- («CLIENTI», «CONTATTI_SCARTATI»), e i due ordini alfabetici non
-- coincidono. Tradurre le etichette anche qui vorrebbe dire la stessa
-- tabella scritta in due posti, che un giorno si staccano. Per raccogliere
-- i clienti c'e' gia' il filtro Qualifica, che e' lo strumento giusto.
--
-- E IN CODA ALL'ORDINE C'E' SEMPRE L'id. Senza un criterio unico, due
-- righe uguali possono uscire in ordine diverso a due letture diverse: con
-- `limit/offset` la stessa persona compare in due pagine e un'altra in
-- nessuna. Non e' una novita' dell'ordinamento — succedeva anche prima con
-- «cognome, nome» — ma ordinando per qualifica o per numero di richieste
-- i pari sono migliaia, e si vedrebbe.
--
-- La vecchia firma a tre argomenti si cancella invece di restare accanto:
-- due funzioni con lo stesso nome vorrebbero dire due ordini diversi
-- secondo chi chiama. I due nuovi argomenti hanno un default, quindi una
-- chiamata a tre argomenti (il bundle vecchio, finche' non arriva la
-- pubblicazione) continua a funzionare e ordina come ha sempre ordinato.
drop function if exists public.crm_cerca_contatti(jsonb, integer, integer);

create or replace function public.crm_cerca_contatti(
  filtri jsonb default '{}'::jsonb,
  da integer default 0,
  quanti integer default 50,
  ordina text default null,
  verso text default null
)
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
  v_campo text := lower(coalesce(nullif(trim(ordina), ''), ''));
  v_verso text := case when lower(coalesce(verso, '')) = 'asc' then 'asc' else 'desc' end;
  v_ordine text;
begin
  quanti := least(greatest(coalesce(quanti, 50), 1), 500);
  da := greatest(coalesce(da, 0), 0);
  v_ordine := case v_campo
    when 'nome' then format(
      'nullif(lower(coalesce(nullif(concat_ws('' '', b.nome, b.cognome), ''''), b.nome_originale, b.email)), '''') %s nulls last', v_verso)
    when 'dove' then format(
      'nullif(lower(coalesce(nullif(b.comune, ''''), nullif(b.provincia, ''''), nullif(b.regione, ''''), b.citta_originale)), '''') %s nulls last', v_verso)
    when 'richieste' then format('b.numero_richieste %s nulls last', v_verso)
    when 'ultimo_contatto' then format(
      'coalesce(case when exists (select 1 from crm_richieste r where r.contatto_id = b.id and r.data_certa)
                     then b.ultimo_contatto_il end, b.ultima_vendita_il::timestamptz) %s nulls last', v_verso)
    else 'b.ultimo_contatto_il desc nulls last, b.cognome, b.nome'
  end;
  execute format($q$
    with pagina as (
      select (to_jsonb(b) - 'opportunita' - 'telefoni_aggiuntivi' - 'email_aggiuntive')
               || jsonb_build_object(
                    'con_data_certa', exists (select 1 from crm_richieste r where r.contatto_id = b.id and r.data_certa),
                    'ultima_vendita_il', b.ultima_vendita_il) as riga,
             count(*) over () as tot
      from crm_contatti_filtrati($1) b
      order by %s, b.id
      limit $2 offset $3
    )
    select coalesce(jsonb_agg(riga), '[]'::jsonb), coalesce(max(tot), 0) from pagina
  $q$, v_ordine)
  into righe, totale
  using filtri, quanti, da;
  -- chiesta una pagina che non c'e' piu' (i filtri sono cambiati sotto):
  -- il conteggio si rifa' comunque, o la pagina direbbe «0 contatti»
  if totale = 0 and da > 0 then
    select count(*) into totale from crm_contatti c
    where (f_disiscritti and c.disiscritto_il is not null or not f_disiscritti and c.disiscritto_il is null);
  end if;
  return jsonb_build_object('totale', totale, 'righe', righe, 'da', da, 'quanti', quanti,
                            'ordina', nullif(v_campo, ''), 'verso', v_verso);
end;
$$;

revoke all on function public.crm_cerca_contatti(jsonb, integer, integer, text, text) from public, anon;
grant execute on function public.crm_cerca_contatti(jsonb, integer, integer, text, text) to authenticated, service_role;

-- ROLLBACK: drop function public.crm_cerca_contatti(jsonb, integer, integer, text, text);
-- e rieseguire 20261030210000_crm_campagne.sql, che contiene la versione a
-- tre argomenti.
