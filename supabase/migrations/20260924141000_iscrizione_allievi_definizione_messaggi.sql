-- La pagina "Iscrizione allievi" e' scritta a blocchi sul database: il
-- testo di partenza nel codice vale solo alla prima apertura, dopo
-- comanda questa riga. Il blocco nuovo va quindi infilato qui, davanti
-- alla sezione del messaggio di benvenuto, o sull'app non compare.
with elementi as (
  select i, b
  from normative_testi, jsonb_array_elements(blocchi) with ordinality t(b, i)
  where chiave = 'iscrizione_allievi'
),
espanse as (
  select i, 0 as sub, b from elementi where b->>'id' <> 'ia11'
  union all
  select i, 1, jsonb_build_object(
    'id', 'ia13', 'tipo', 'sezione', 'testo', 'Definizione messaggi'
  ) from elementi where b->>'id' = 'ia11'
  union all
  select i, 2, jsonb_build_object(
    'id', 'ia14', 'tipo', 'messaggikit',
    'titolo', 'Definizione messaggi',
    'spiega', 'Un messaggio per ogni kit. Finché un kit non ha il suo, chi manda il benvenuto si ritrova in mano il testo generico.'
  ) from elementi where b->>'id' = 'ia11'
  union all
  select i, 3, b from elementi where b->>'id' = 'ia11'
)
update normative_testi
set blocchi = (select jsonb_agg(b order by i, sub) from espanse),
    aggiornato_il = now()
where chiave = 'iscrizione_allievi'
  and not exists (
    select 1 from jsonb_array_elements(blocchi) x where x->>'tipo' = 'messaggikit'
  );
