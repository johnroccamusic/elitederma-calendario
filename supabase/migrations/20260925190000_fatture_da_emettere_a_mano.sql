-- Per ora la fattura la si emette a mano.
--
-- Il collegamento con Fatture in Cloud c'e' gia' ed e' scritto, ma
-- resta spento: prima va chiarita la faccenda delle due tabelle della
-- connessione, e vanno verificati i permessi di scrittura. Finche' non
-- e' chiaro, i dati raccolti sulla pagina di pagamento si fermano in
-- "Fatture da emettere" e li' qualcuno li copia sul gestionale vero.
--
-- Queste colonne servono a segnare che e' stato fatto: numero e data
-- del documento emesso altrove, cosi' la riga smette di chiedere
-- attenzione e resta comunque la traccia di dove e' finita.
alter table pagamenti_pos
  add column if not exists fattura_manuale boolean not null default false,
  add column if not exists note_fattura text;

comment on column pagamenti_pos.fattura_manuale is
  'true = la fattura e'' stata emessa a mano fuori dall''app (numero in fattura_numero). false = emessa dall''app via Fatture in Cloud.';
