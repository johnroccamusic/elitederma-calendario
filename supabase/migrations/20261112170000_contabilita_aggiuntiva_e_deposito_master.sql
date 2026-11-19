-- LA CONTABILITA' AGGIUNTIVA VALE ANCHE PER IL POS, E IL DEPOSITO DELLA
-- MASTER E' LA BUSTA DELLA CLASSE (12/11/2026)
--
-- Due richieste del titolare nello stesso giro.
--
-- 1) «Verifica che se la busta è stata spedita, nel caso in cui la master
--    riceve un pagamento al corso in contanti o con POS, si apre una
--    contabilità aggiuntiva e non viene intaccata quella che già è stata
--    spedita.»
--
--    Verificato: per i CONTANTI funzionava, per il POS no. Una vendita con
--    carta fatta dopo la chiusura finiva dentro la prima contabilita', e
--    la causa non era una regola sbagliata: alla chiusura si marcava
--    `busta_numero = 1` SOLO sulle vendite in contanti, quindi per il POS
--    una vendita di prima e una di dopo erano indistinguibili. Il «dopo»
--    non era conoscibile.
--
--    Da oggi la chiusura marca TUTTE le vendite della classe. Ma le buste
--    chiuse PRIMA di oggi non hanno quella marcatura, e la' una vendita
--    con carta senza numero non vuol dire «di dopo», vuol dire «non
--    marcata»: leggerla come «di dopo» sposterebbe 3.561 € di vendite di
--    settembre e ottobre fuori dalla prima contabilita' di 15 classi
--    chiuse, riaprendo conti a posto. Per questo esiste la colonna qui
--    sotto: dice se quella chiusura ha marcato tutto, e la regola nuova
--    vale solo dove c'e'.
--
--    Scelta del titolare: «allinea solo le classi aperte non ancora in
--    cassa, la regola vale da adesso in avanti». Misurato: le classi con
--    la busta chiusa e NON ancora depositata in cassa sono ZERO, quindi
--    qui non si aggiorna nessuna riga di vendite_shop. L'archivio non si
--    tocca.
--
-- 2) «Sulla scheda di ciascun corso, nella dashboard della master, se
--    questa master ha incassato dei pagamenti in contanti, ci dovrà essere
--    un riepilogo con scritto "devi depositare euro". Una volta depositato
--    la master preme "Depositato", e si accende un tasto sul riepilogo
--    amministrativo con scritto "ricevuto deposito master euro X"; alla
--    master il tasto diventa "conferma di ricevuta" con vicino la data.»
--
--    Deciso dal titolare: sono gli STESSI soldi della busta di quella
--    classe, non un secondo giro. Quindi la dashboard della master e'
--    l'altro capo della stessa stretta di mano — «Depositato» chiude la
--    busta (busta_spedita_il) e «Ricevuto deposito master» e' il tasto
--    arancione che c'e' gia' (busta_rientrata_il). Un importo solo, un
--    giro solo, nessun doppio conteggio. Serve solo sapere CHI l'ha
--    chiusa, per scrivere il nome giusto sui due tasti.

-- 1) la chiusura ha marcato tutte le vendite, o solo quelle in contanti?
alter table corsi_date
  add column if not exists busta_vendite_marcate boolean not null default false;

-- Nessuna classe in archivio ha una busta chiusa e non ancora in cassa
-- (verificato il 12/11/2026): non c'e' niente da allineare, e il default
-- false e' la verita' su tutte e 41 le buste storiche.

-- 2) chi ha chiuso la busta: la master dalla sua dashboard, oppure
--    nessuno (vuoto) se l'ha chiusa l'amministrazione
alter table corsi_date
  add column if not exists busta_spedita_da_master_id uuid references master(id);

comment on column corsi_date.busta_vendite_marcate is
  'true se la chiusura di questa busta ha marcato con busta_numero = 1 TUTTE le vendite della classe, e non solo quelle in contanti. Solo dove e'' true una vendita non in contanti senza numero vuol dire «arrivata dopo la chiusura», cioe'' materia della contabilita'' aggiuntiva. Sulle buste chiuse prima del 12/11/2026 e'' false, e le loro vendite con carta restano nella prima contabilita'' dove sono sempre state.';
comment on column corsi_date.busta_spedita_da_master_id is
  'La master che ha dichiarato il deposito dalla sua dashboard («Depositato»). Vuoto se la busta l''ha chiusa l''amministrazione dal Riepilogo. Decide solo come si leggono i due tasti: «Ricevuto deposito master X» invece di «Busta in viaggio».';

-- ROLLBACK:
--   alter table corsi_date drop column busta_spedita_da_master_id;
--   alter table corsi_date drop column busta_vendite_marcate;
