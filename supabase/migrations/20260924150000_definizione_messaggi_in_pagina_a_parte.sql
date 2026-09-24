-- L'elenco dei kit e' uscito dalla pagina dell'iscrizione: sotto la
-- procedura, cinquantatre kit erano un muro. Dentro resta la porta, e
-- la spiegazione deve dire che si va da un'altra parte.
update normative_testi
set blocchi = (
  select jsonb_agg(
    case when b->>'id' = 'ia14'
      then b || jsonb_build_object('spiega', 'Un messaggio per ogni kit, in una pagina a parte. Finché un kit non ha il suo, chi manda il benvenuto si ritrova in mano il testo generico.')
      else b
    end
    order by i
  )
  from jsonb_array_elements(blocchi) with ordinality t(b, i)
),
aggiornato_il = now()
where chiave = 'iscrizione_allievi';
