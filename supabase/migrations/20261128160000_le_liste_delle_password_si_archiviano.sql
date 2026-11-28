-- LE LISTE DELLE PASSWORD SI ARCHIVIANO (28/11/2026).
--
-- Il titolare: «possiamo mettere vicino alla lista dove sono le password
-- di ogni utente il tasto archivia, che le mette in una lista di
-- archiviati senza cancellarne i dati e almeno pulisco le liste?».
--
-- MISURATO PRIMA DI TOCCARE NIENTE: 22 venditori, 19 master, 8
-- assistenti, 7 utenze — 56 righe, e sui venditori TUTTI E 22 hanno una
-- password che apre l'app. Tre non hanno mai chiuso un'iscrizione
-- (MARIA LAURA, MARIO, VALENTINA) e sette sono fermi da agosto o prima,
-- mentre in cima ce ne sono cinque che lavorano ogni settimana. Non e'
-- una pulizia estetica: sono porte aperte di cui nessuno ricorda il
-- perche'.
--
-- PERCHE' NON SI CANCELLA. Queste righe sono la storia di chi ha
-- venduto, tenuto un corso, firmato un consenso o incassato: `iscritti`
-- le nomina (per NOME, in `tutor`), `corsi_date.master_id` le punta,
-- punti, provvigioni e commissioni le contano. Cancellare una riga
-- vorrebbe dire staccare quelle iscrizioni dal loro venditore. Quindi si
-- mette da parte, e si rimette dentro con un tasto.
--
-- ARCHIVIATO VUOL DIRE CHE LA PORTA SI CHIUDE, deciso dal titolare messo
-- davanti alle due strade: la lista si pulisce E la password non apre
-- piu' niente. L'altra strada — pulire la lista e lasciare la password
-- buona — e' la peggiore delle due: l'accesso resta aperto e quella riga
-- non si vede piu' da nessuna parte, quindi nessuno se ne accorge.
-- Il controllo vive dove vive la password, cioe' nel Gate di App.jsx:
-- con un account Supabase solo per tutto lo staff (vedi § 4 di
-- CLAUDE.md) l'accesso non e' un accesso del database, e una policy non
-- puo' distinguere una persona dall'altra. Non e' una serratura piu'
-- profonda di quella che protegge la password stessa, e va saputo.
--
-- TRE COLONNE E NON UNA. `archiviato_il` dice da quando (una data serve:
-- «da quando questa persona non entra piu'» e' la prima domanda davanti
-- a un accesso che non funziona), `archiviato_da` CHI ha premuto — come
-- `liquidato_da` di stamattina, perche' togliere un accesso e' un atto
-- che deve avere un nome — e `archiviato_motivo` il perche', che fra sei
-- mesi e' l'unica cosa che distingue «ha smesso» da «archiviata per
-- sbaglio».
--
-- Nessun dato si muove: tutte e 56 le righe nascono NON archiviate, e
-- nulla cambia finche' qualcuno non preme il tasto.

alter table utenti_app add column if not exists archiviato_il timestamptz;
alter table utenti_app add column if not exists archiviato_da text;
alter table utenti_app add column if not exists archiviato_motivo text;

alter table master add column if not exists archiviato_il timestamptz;
alter table master add column if not exists archiviato_da text;
alter table master add column if not exists archiviato_motivo text;

alter table venditori add column if not exists archiviato_il timestamptz;
alter table venditori add column if not exists archiviato_da text;
alter table venditori add column if not exists archiviato_motivo text;

alter table assistente add column if not exists archiviato_il timestamptz;
alter table assistente add column if not exists archiviato_da text;
alter table assistente add column if not exists archiviato_motivo text;

comment on column venditori.archiviato_il is
  'Quando questa persona e'' stata messa in archivio: non compare piu'' nelle liste, non si puo'' piu'' scegliere, e la sua password non apre l''app. I suoi dati, le sue iscrizioni e le sue provvigioni restano intatti. Nullo = in servizio.';
comment on column master.archiviato_il is
  'Come venditori.archiviato_il. Le classi, i compensi e i consensi passati restano intatti.';
comment on column assistente.archiviato_il is
  'Come venditori.archiviato_il.';
comment on column utenti_app.archiviato_il is
  'Come venditori.archiviato_il. Le tre righe di sistema (chiave_sistema) non si archiviano: sono identita'' condivise, non persone.';

-- ROLLBACK (si perde chi e'' stato archiviato e il perche'; tornando
-- indietro TUTTE le password archiviate ricominciano ad aprire l'app,
-- perche' il cancello legge queste colonne)
--
-- alter table utenti_app drop column if exists archiviato_il, drop column if exists archiviato_da, drop column if exists archiviato_motivo;
-- alter table master     drop column if exists archiviato_il, drop column if exists archiviato_da, drop column if exists archiviato_motivo;
-- alter table venditori  drop column if exists archiviato_il, drop column if exists archiviato_da, drop column if exists archiviato_motivo;
-- alter table assistente drop column if exists archiviato_il, drop column if exists archiviato_da, drop column if exists archiviato_motivo;
