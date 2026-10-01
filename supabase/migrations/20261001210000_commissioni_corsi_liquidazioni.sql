-- Lo storico delle commissioni sui corsi: i mesi gia' liquidati.
--
-- La commissione si calcola viva dalla percentuale di oggi — cambiarla in
-- Impostazioni cambia tutti i mesi all'istante. Va bene finche' nessuno ha
-- pagato: ma un mese gia' liquidato non puo' cambiare importo perche' tre
-- mesi dopo si e' deciso un'altra percentuale.
--
-- Quindi l'importo si congela QUI, nel momento in cui si liquida, e da
-- allora lo storico mostra quello e non lo ricalcola piu'. E' l'unico
-- congelamento che serve, ed e' legato a un fatto — il pagamento — non a
-- una data.
--
-- Chiave il mese, 'YYYY-MM': uno solo per mese, e riaprirlo vuol dire
-- cancellare la riga.
create table if not exists commissioni_corsi_liquidazioni (
  mese          text primary key check (mese ~ '^[0-9]{4}-[0-9]{2}$'),
  importo       numeric not null,
  iscritti      integer,
  edizioni      integer,
  percentuale   numeric,
  note          text,
  liquidato_il  timestamptz not null default now()
);

alter table commissioni_corsi_liquidazioni enable row level security;

-- stessa apertura delle altre tabelle dell'app: il gate e' altrove
-- (vedi CLAUDE.md, sezione sicurezza), non qui
drop policy if exists commissioni_corsi_liquidazioni_tutti on commissioni_corsi_liquidazioni;
create policy commissioni_corsi_liquidazioni_tutti on commissioni_corsi_liquidazioni
  for all to anon, authenticated using (true) with check (true);

comment on table commissioni_corsi_liquidazioni is
  'Mesi di commissioni sui corsi gia'' liquidati. L''importo e'' congelato al momento del pagamento (01/10/2026).';
