-- IL SUPERVISORE: i privilegi del programmatore a chi programmatore non e'
-- (7/11/2026)
--
-- Richiesta del titolare: «attiva anche a Chiara Colonnelli le stesse mie
-- funzioni di programmatore e accesso, anche se lei non e' programmatore:
-- deve venire a supervisionare tutte le aree e avere i miei stessi
-- privilegi».
--
-- COM'E' FATTO L'ACCESSO OGGI, perche' spiega la scelta. Il grado non
-- sta su una riga: lo decide QUALE PASSWORD si batte. C'e' una riga di
-- sistema `__programmatore` con la sua password, una `__admin`, e tutti
-- gli altri entrano con la propria (master, venditori, assistenti,
-- utenze d'ufficio) e valgono "user" piu' i permessi scritti.
--
-- Quindi dare a qualcuno «i miei stessi privilegi» aveva due strade:
--
--   1. DARGLI LA PASSWORD DEL PROGRAMMATORE. Due persone dietro la
--      stessa identita': ogni vendita, ogni consenso, ogni modifica
--      risulterebbe del programmatore, e per togliere l'accesso a una
--      si dovrebbe cambiare la password all'altro. Scartata.
--
--   2. UN FLAG SULLA SUA RIGA. Entra con la SUA password, resta SE
--      STESSA — nome, id, attribuzione — e il grado diventa
--      programmatore. Si toglie spegnendo una casella, e quel gesto
--      riguarda lei sola.
--
-- E' la seconda. La colonna si chiama `supervisore` perche' e' la parola
-- che ha usato il titolare, e sta su `master` (Chiara e' una master) e
-- su `utenti_app` (dove un giorno potrebbe servire a un'utenza
-- d'ufficio). Nasce FALSA su tutte le righe: nessuno la ha per
-- distrazione.
--
-- NON le si copiano i permessi a mano. Le tessere della Home che vede
-- restano le sue 18, ma il grado programmatore le apre tutte comunque
-- (`tastoAbilitato` in App.jsx), esattamente come apre ogni vista
-- protetta. Copiare la lista avrebbe voluto dire ricordarsi di
-- aggiungercene una ogni volta che nasce una tessera nuova — e un
-- permesso dimenticato non si vede: si vede una tessera che non c'e'.
-- Spegnendo il flag torna alla sua Home di master, senza altri gesti.
--
-- COSA LE APRE, detto per intero: tutte le aree e ogni vista protetta,
-- i conti e gli incassi, Gestione utenti e i permessi degli altri, il
-- prezzo a mano sul POS e la cifra «In piu' €», le impostazioni dei
-- consensi, e gli strumenti di impaginazione (rinominare le tessere,
-- spostare le sezioni) che valgono PER TUTTI.
--
-- ROLLBACK in coda.

alter table public.master
  add column if not exists supervisore boolean not null default false;
alter table public.utenti_app
  add column if not exists supervisore boolean not null default false;

comment on column public.master.supervisore is
  'Entra col grado «programmatore» pur non essendo la riga di sistema: tutte le aree, tutte le viste protette e i poteri personali del programmatore. Resta se stessa — nome e id suoi — quindi vendite, consensi e modifiche restano attribuiti a lei. Si revoca spegnendola.';
comment on column public.utenti_app.supervisore is
  'Come master.supervisore: grado «programmatore» su un''utenza che non e'' la riga di sistema __programmatore.';

-- CHIARA COLONNELLI, per id e non per nome: l'id l'ho letto dalla sua
-- riga (f72c7fd5…), ed e' lo stesso con cui sta nel team della fiera.
update public.master
   set supervisore = true
 where id = 'f72c7fd5-5384-4764-9b45-de0f593a117d';

-- ROLLBACK
-- update public.master set supervisore = false where id = 'f72c7fd5-5384-4764-9b45-de0f593a117d';
-- alter table public.master drop column if exists supervisore;
-- alter table public.utenti_app drop column if exists supervisore;
