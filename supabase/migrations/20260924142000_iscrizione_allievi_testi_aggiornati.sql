-- Il configuratore non chiede piu' la classe: chiede l'allievo, e la
-- classe se la ricava. Le due righe che spiegavano il vecchio giro
-- dicevano una cosa che sullo schermo non c'e' piu'.
update normative_testi
set blocchi = (
  select jsonb_agg(
    case
      when b->>'id' = 'ia12' then b
        || jsonb_build_object('spiega', 'Scegli l''allievo che hai iscritto: corso, sede, date e kit si compilano da soli. Il testo è quello del suo kit.')
      when b->>'id' = 'ia2' then b
        || jsonb_build_object('testo', 'Il messaggio non è uno solo: ogni kit ha il suo, e si scrive qui sopra in “Definizione messaggi”. Il testo generico qui sotto serve solo ai kit che il loro messaggio non ce l''hanno ancora.')
      else b
    end
    order by i
  )
  from jsonb_array_elements(blocchi) with ordinality t(b, i)
),
aggiornato_il = now()
where chiave = 'iscrizione_allievi';
