-- LA BOLLA DI ACCOMPAGNAMENTO DI UN EVENTO (27/10/2026). Chiesta dal
-- titolare: dalla scheda dell'evento, un tasto che genera il documento di
-- trasporto dei materiali elencati per quell'evento. Chiede prima
-- partenza e destinazione; quello che si e' scritto resta qui, cosi' una
-- ristampa trova gli indirizzi gia' compilati e li si puo' correggere.
alter table eventi add column if not exists bolla jsonb;
comment on column eventi.bolla is 'Bolla di accompagnamento: {numero, partenza, destinazione, vettore, causale, aspetto, colli, generata_il, generata_da}. Il PDF si rigenera dalle righe di eventi_materiali.';
