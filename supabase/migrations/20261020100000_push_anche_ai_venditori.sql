-- 20/10/2026. Le notifiche push ora arrivano anche ai venditori.
--
-- Prima la tabella aveva `master_id` e nient'altro, e dall'app
-- l'interruttore stava solo nell'area master: un venditore non aveva
-- modo di accenderle. Tre dispositivi su due master, zero venditori.
--
-- Serve da quando l'arrivo di un modulo di iscrizione manda una
-- notifica a chi ha venduto («X ha inviato il suo modulo di iscrizione,
-- accedi per verificare»): chi ha chiuso l'iscrizione e' l'unico che sa
-- se quei dati sono quelli giusti, e finche' non guarda l'iscrizione
-- resta ferma.
--
-- Colonna NUOVA e nullabile, non un rinomina: le righe delle master
-- restano come sono e una riga porta l'uno o l'altro. `on delete set
-- null` perche' un venditore che esce dall'anagrafica non deve essere
-- trattenuto dal suo telefono: resta una riga orfana e spenta, che si
-- vede.
--
-- IL LEGAME ISCRITTA -> VENDITORE E' IL NOME, e va saputo: sta in
-- `iscritti.tutor`, scelto da una tendina, ed e' cosi' che accoppia
-- tutta l'app (vedi `chiusure` in PaginaDashboardVenditori). Non e' una
-- chiave. Misurato il giorno dell'innesto: 17 nomi su 19 trovano il
-- loro venditore, due no — «MAURE» e «MAURÉ», dove in anagrafica c'e'
-- «MAURE' ACOSTA» — e sono due iscritte su corsi futuri che non
-- avviserebbero nessuno. Non si allineano di iniziativa: lo stesso
-- nome decide anche chiusure e commissioni.
alter table push_iscrizioni
  add column if not exists venditore_id uuid references venditori(id) on delete set null;

create index if not exists push_iscrizioni_venditore_idx
  on push_iscrizioni (venditore_id) where attiva;

comment on column push_iscrizioni.venditore_id is
  'Il venditore a cui appartiene questo dispositivo. Alternativa a master_id: una riga ha l''uno o l''altro. Dal 20/10/2026.';
