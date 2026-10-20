# CLAUDE.md — Gestionale Accademia Elitederma

> Verificato sul codice il 15 agosto 2026 (561 commit, clone completo).
> Tenere aggiornato questo file fa parte del lavoro.

## 1. Che cos'è

App web gestionale **a uso interno** dello staff di un'accademia di formazione
estetica: corsi a calendario → iscrizioni → pagamenti → magazzino e vendite →
contabilità. Nessun utente finale anonimo.

## 2. Stack (verificato)

| Livello | Tecnologia |
|---|---|
| UI | React 18.3, nessun router, nessuna libreria di stato |
| Build | Vite 5.4 |
| Database | Supabase — progetto `Elitederma-Calendario` (`snhvvipszhfllrgemsdu`), eu-west-1, Postgres 17 |
| Storage | 10 bucket Supabase, **tutti pubblici** |
| Backend | 45 edge function Deno in `supabase/functions/` (WooCommerce, Stripe, Fatture in Cloud, email, modulo di iscrizione, WordPress) |
| PDF | pdf-lib + pdfjs-dist, generazione e parsing **lato client** |
| Deploy | Vercel, team `elitederma`, progetto `elitederma-calendario` |
| Stile | inline style, nessun CSS framework |

Dipendenze totali: 6 in produzione. È un progetto volutamente essenziale — non
introdurre librerie nuove senza una ragione forte.

## 3. Struttura reale

```
src/App.jsx              84.395 righe — ancora il grosso dell'applicazione
src/main.jsx             entry point
src/Accesso.jsx          gate Supabase Auth (collegato, vedi § 4)
src/comuni-regioni.js    dati statici
src/ui/                  mattoni condivisi: Button, Field, CampoNumero, colori
src/<modulo>/            fette già uscite dal monolite — consensi, content,
                         email, eventi, file, iscrizione, iscrizioni, magazzino,
                         notifiche, pos, prezzi, punti, recesso, rientri,
                         salvataggi, spese, stampe
prove/                   26 file, 266 prove (Vitest + jsdom), con preparazione e aiuto
eslint.config.js         le regole del controllo
controlla-funzioni.sh    deno check sulle edge function
supabase/functions/      45 edge function + _shared
supabase/migrations/     329 migrazioni versionate
supabase-*.sql           130 script di setup storici, cumulativi e idempotenti
```

`App.jsx` è ancora un monolite, e cresce. Non è una svista da correggere di
slancio: qualunque scomposizione va fatta a fette verificabili, una alla volta —
le cartelle qui sopra sono le fette già staccate.

I 130 file `supabase-*.sql` alla radice sono la storia degli interventi sul
database, non lo stato attuale. **Lo stato attuale è il database**: 152 tabelle,
8 viste, 149 policy distribuite su 145 tabelle.

**Dal 17/10/2026 la RLS è attiva su tutte e 152.** Sette tabelle hanno RLS
*senza* nessuna policy, che con la chiave pubblicabile vuol dire inaccessibili,
e in tutti e sette i casi è voluto: `fic_connessioni`,
`fatture_in_cloud_config`, `fic_documenti_pending` e `fic_sync_log` le tocca
solo `service_role` dalle edge function (l'app non le interroga mai dal
browser — verificato); `movimenti_banca_scartati_20261006`,
`_backup_acconti_pagati_20261011` e `_backup_lunchflow_doppioni_20261013` sono i
tre tavoli di scarto delle pulizie di ottobre, ed erano gli ultimi tre rimasti
*senza* RLS — cioè in lettura e scrittura a chiunque avesse la chiave del
bundle, con dentro movimenti bancari e acconti di allievi. Chiusi con
`20261017181500_rls_sui_tre_backup.sql`. Nessuna vista, funzione o foreign key
dipende da loro, e nel repo li nominano solo le due migrazioni che li hanno
creati: restano in attesa di essere esportati e cancellati.

Le migrazioni nuove vanno in `supabase/migrations/` con timestamp.

Attenzione: lo storico remoto delle migrazioni **non** coincide con la cartella
locale. Non usare `supabase db push` — rieseguirebbe migrazioni già applicate.
Per una migrazione nuova: file in `supabase/migrations/` come traccia, ed
esecuzione mirata (MCP o editor SQL) sul database.

## 4. Sicurezza — stato al 18/10/2026

Verificato interrogando il database e Vercel, non leggendo i file:

- **Le policy sono chiuse. 18/10/2026.** Delle 149 policy di `public`, 133
  erano `for all to anon using (true) with check (true)`: con la chiave
  pubblicabile — che sta nel bundle — si leggevano **e si riscrivevano**
  anagrafiche degli allievi, pagamenti, movimenti di banca, le password in
  chiaro di `venditori` e `utenti_app`. Adesso valgono tutte `to authenticated`.

  **Resta aperta una cosa sola, voluta:** `consensi_modelle` ha un `INSERT`
  per `anon` — la modella che firma col QR scrive il suo consenso e basta.
  Non può rileggere né il proprio né quelli delle altre. Stesso patto dei
  moduli di iscrizione: si carica, non si rilegge.

  **Prima di chiudere è stata spenta la registrazione pubblica** su Supabase
  Auth (`disable_signup: true`, verificato dall'esterno con la sola chiave
  pubblicabile). Senza quel passaggio la chiusura sarebbe stata teatro:
  chiunque si sarebbe creato un account e sarebbe rientrato da
  `authenticated`.

  **Perché stavolta non ha spento l'app**, e il 15/08 sì: allora il cancello
  di `Accesso.jsx` era spento e nessuno aveva una sessione. Dall'08/10 il
  cancello è acceso.

  Verificato dall'esterno subito dopo: `iscritti`, `venditori`, `utenti_app`,
  `movimenti_banca`, `vendite_shop`, `consensi_modelle`, `password_menu` →
  **zero righe**; un `insert` su `iscritti` → **401, violates row-level
  security**. La fotografia delle policy di prima è in
  `_policy_snapshot_20261018`, e il rollback è già scritto in
  `20261018230001_rls_rollback_anon.sql`: rimette tutto com'era leggendo da
  quella fotografia, non a memoria.
- **Le sette rotte pubbliche, e come sopravvivono alla chiusura.** Sei non
  toccano più le tabelle: passano da funzioni `security definer`, che girano
  coi permessi del proprietario e ignorano le policy. Tutte hanno `execute`
  concesso ad `anon` e revocato a `public`.

  | Rotta | Come parla col database |
  |---|---|
  | `?master=` | `master_vista`, `master_segna_incassato` |
  | `?modelle=` | `modelle_vista`, `modelle_leggi_trattamenti`, `modelle_salva_trattamenti` |
  | `?biglietti=` | `biglietti_vista` |
  | `?ricevuta=` | `ricevuta_pos` |
  | `?modulo=` | `modulo_vista`, `modulo_salva` + caricamento su `moduli-iscrizione` |
  | `?recesso=` | `recesso_vista` + edge function `modulo-recesso` |
  | `?consenso=` | **scrive dritto in `consensi_modelle`** (INSERT per `anon`) + caricamento su `consensi-documenti` |

  **I modelli di consenso sono cinque, dal 19/10/2026** (`src/content/consensi.ts`):

  | Codice | Copre | Corsi |
  |---|---|---|
  | `pmu-micro` | trucco permanente **del viso** | 13 |
  | `needling` | microneedling | 1 |
  | `laminazione` | laminazione ciglia (e IKE) | 5 |
  | `trico` | tricopigmentazione | 2 |
  | `areola` | dermopigmentazione dell'areola | 1 |

  Trico e areola si sono staccati dal PMU perché quel modulo si intitolava
  «trattamento di trucco permanente», e né il cuoio capelluto né un'areola
  sono un trucco. Ma il motivo vero non era l'intestazione: era il
  **questionario**. Il PMU non chiedeva le dermatiti del capo né la caduta in
  fase attiva; e soprattutto non chiedeva **mastectomia, radioterapia,
  linfonodi ascellari** — e l'areola si pigmenta spesso proprio dopo una
  mastectomia, su cute operata o irradiata. Ogni modulo dice anche la cosa che
  gli altri non direbbero: il trico che **non fa ricrescere i capelli**,
  l'areola che serve il **nulla osta del medico** e che si tratta di una
  **zona intima**, con il diritto di farsi accompagnare e di interrompere.

  `consenso-trico-v1.ts` e `consenso-areola-v1.ts` sono gli unici **non
  trascritti da un cartaceo**: li ho scritti partendo dal corpo neutro del PMU,
  e sono segnati in testa al file come **da far validare** — quello dell'areola
  con più insistenza, perché le soglie temporali che contiene (dodici mesi
  dall'intervento) sono prassi corrente, non norma.

  Una stessa condizione deve chiamarsi allo stesso modo in tutti i moduli: la
  chiave `diabete` non può essere «Diabete» in un modello e «Diabete mellito»
  in un altro, o contare quante modelle l'hanno dichiarato vorrà dire conoscere
  quattro nomi per la stessa cosa. Dove la chiave è condivisa **comanda il
  PMU**, che è quello congelato da 26 firme; una prova nel banco confronta
  tutti i modelli a due a due e ha già trovato quattro derive il giorno in cui
  è stata scritta. Ognuno ha codice — che *è* il QR —, testo e
  anamnesi propri; `consensi_corsi` dice a quali corsi vale ognuno, e da lì
  il QR compare nella scheda della classe.

  **Un corso sta su un consenso solo** (19/10/2026). Nella scheda di una
  classe compaiono i consensi del suo corso: due consensi sullo stesso corso
  vorrebbero dire due QR accanto, inquadrati in aula a caso — cioè una modella
  trattata a microneedling che firma il modulo del trucco permanente. La
  tendina mostra i corsi già presi *spenti, col nome di chi se li è presi*
  (farli sparire manda a cercarli), e `collegaConsensoACorso` li rifiuta
  comunque: la tendina è comodità, la funzione è la serratura.

  Due regole nate con il secondo modello: **la versione del testo porta
  dentro il nome del modello** (`needling-v1`, non `v1`), e
  `contenutoDaVersione` vuole anche il codice. Senza, un consenso needling
  salvato come `v1` avrebbe pescato il testo PMU, e l'archivio avrebbe
  mostrato accanto a quella firma le domande del trucco permanente. Un
  modello nuovo si aggiunge con **due** righe: una in `CONSENSI` e una in
  `VERSIONI`, che tiene ogni versione mai uscita insieme al modello a cui
  apparteneva — da lì una firma vecchia risale al foglio che le stava
  davanti, e non si cancella una riga nemmeno quando il testo viene
  sostituito. Le prove in `prove/consensi-modelli.test.jsx` controllano che
  codici e versioni restino unici e che nessun modello resti senza la sua
  versione registrata.

  **Le dichiarazioni da spuntare sono separate** (19/10/2026). Ce n'era una
  sola e diceva tre cose insieme — «ho letto e compreso, le informazioni sul
  mio stato di salute sono vere, e acconsento al trattamento» — quindi non si
  poteva dire a quale dei tre consensi la persona avesse aderito; e mancava
  del tutto l'**art. 9**, il consenso esplicito ai dati sulla **salute**, che
  è poi quello che il questionario raccoglie. Ora ogni modello dichiara le sue
  `caselle`: quattro obbligatorie (trattamento, maggiore età e veridicità,
  dati di salute, informativa privacy) e una facoltativa (foto e video),
  staccata dalle altre perché un consenso ottenuto per inerzia non è un
  consenso. Ognuna si salva con il suo istante in `consensi_modelle.consensi`;
  i due booleani di prima restano scritti, perché 26 consensi già raccolti
  parlano solo quella lingua.

  Cambiare quei testi **cambia ciò che si firma**: per questo il PMU è passato
  alla **v3** — stesso testo e stessa anamnesi della v2, parola per parola,
  solo le caselle separate — e la v2 resta viva accanto per le 19 firme già
  raccolte. `consenso-v3.ts` è una copia e non uno spread di `consensoV2`:
  un'istantanea che si muove quando qualcuno tocca l'originale non serve a
  niente.

  **Il testo va aperto e richiuso prima di firmare** (19/10/2026), su tutti
  e tre i consensi e sul modulo di iscrizione. La tendina è chiusa di suo: si
  poteva scorrere fino in fondo, spuntare «ho letto e compreso» e firmare
  senza averla mai aperta — su un documento che esiste proprio per dire che
  la persona ha capito a cosa si sottopone. Si segna alla **chiusura** e non
  all'apertura: aperto e lasciato aperto vuol dire che ci si è scorsi
  attraverso. Prima di allora spunte spente e, al posto della lavagna per
  firmare, un riquadro che dice perché. Sopra al tasto c'è un avviso
  **ATTENZIONE** in rosso, che resta anche dopo la lettura.

  **Se c'è una domanda, c'è dove scrivere. Sempre.** Il campo libero del
  questionario compariva solo su alcune domande e solo dopo aver premuto SÌ:
  sotto «Si è sottoposta a interventi chirurgici al seno» si leggeva «Quale
  intervento e in che mese e anno» e poi due bottoni, senza nessuna casella —
  una richiesta senza posto in cui rispondere. Ora la nota c'è su **ogni**
  domanda, da subito, e vale anche per chi risponde NO ma ha qualcosa da
  aggiungere. Dove la risposta esatta serve (`specifica`), quella richiesta fa
  da suggerimento **dentro** la casella invece di stare sopra i bottoni.

  **Una domanda la cui risposta si conosce prima di farla non è una domanda.**
  «Si è sottoposta a interventi al seno?» su un consenso per l'areola ha
  sempre risposta sì. È diventata un campo obbligatorio — *quale intervento e
  quando* — perché quella data è ciò da cui dipende se il trattamento si può
  fare. Un modello può dichiarare `campiExtra`, salvati in
  `consensi_modelle.campi_extra`.

  **Le righe da riempire a penna diventano campi.** Il cartaceo del
  microneedling ha tre righe vuote per il nome di chi opera («incarico
  ______ di eseguire su di me»): nella prima trasposizione erano diventate
  una formula generica e il nome spariva. Ora il modello può dichiarare
  `esecutore` e il modulo chiede **Chi esegue il trattamento**, salvato in
  `consensi_modelle.esecutore` e mostrato nell'archivio come pastiglia,
  senza dover aprire la scheda. Oggi lo chiede solo il needling, perché è
  l'unico cartaceo che ha quelle righe.

  **Gli elenchi di condizioni dei cartacei diventano l'anamnesi**, anche
  quando sul foglio sono dichiarazioni al negativo («di non soffrire di
  patologie oculari» → «Soffre di patologie oculari?»). Una dichiarazione al
  negativo si firma in blocco e una condizione presente passa sotto silenzio;
  una domanda vuole una risposta sua, e un «sì» finisce nel riquadro che la
  master legge prima di toccare la modella.

  La versione precedente di questo file diceva che modelle e biglietti
  «non sono ancora collegati»: non è più vero dal 18/10/2026.
- **`Accesso.jsx` ORA è collegato. Verificato il 08/10/2026.** In
  `main.jsx` la costante `CANCELLO_ACCESO` è `true`, e l'app rende
  `<Accesso />` con `<App />` dentro: chi entra fa un vero accesso
  Supabase e **ha una sessione**. La versione precedente di questo file
  diceva il contrario — era vero fino a metà settembre, non più.

  Due cose restano però come prima, e sono quelle che contano:
  **le policy non sono state chiuse** (vedi il punto qui sopra: 132 delle
  136 policy di `public` valgono ancora per `anon`), quindi la sessione
  c'è ma non protegge niente; e **il ruolo e l'identità dentro l'app li
  decide ancora il Gate interno** di `App.jsx`, con la password
  confrontata lato client su `venditori`/`utenti_app`/`password_menu` —
  è da lì che esce `utenteLoggato.masterId`, non dal JWT.

  Ordine di quello che manca: dare un account a chiunque debba entrare →
  verificare che nessuno resti fuori → chiudere le policy a
  `authenticated`. Le tre rotte pubbliche (`master`, `modelle`,
  `biglietti`) restano la deroga.
- **`VITE_ACCESS_CODE` e `VITE_ADMIN_CODE` finiscono nel bundle pubblico.** In
  Vite tutto ciò che inizia con `VITE_` è visibile. `ADMIN_CODE` ha anche un
  fallback in chiaro nel sorgente (`"ED26"`). Da eliminare quando i ruoli
  passeranno al JWT.
- **UN SOLO ACCOUNT SUPABASE PER TUTTI. È il prossimo passo di sicurezza.**
  Scoperto il 18/10/2026 guardando `auth.users`: le utenze sono tre, e una
  sola è in uso — `commerciale.elitederma@gmail.com`, con **58 sessioni
  aperte da 26 dispositivi diversi** e 2.507 rinnovi di accesso. Le colonne
  `email_accesso` su `utenti_app`, `venditori`, `master` e `assistente`
  esistono ma sono **vuote: zero su 52 persone**.

  Cosa comporta, e perché viene prima di tutto il resto:

  - la chiusura delle policy è **un cancello, non un'identità**:
    «authenticated» vuol dire «uno dei 26 dispositivi che hanno quella
    password», non «questa persona»;
  - **i permessi per ruolo sono impossibili** finché è così, perché nel JWT
    non c'è niente da cui dedurre se chi scrive è un venditore, una master o
    l'amministratore;
  - **non si revoca una persona sola**: cambiare quella password lascia
    fuori tutti e 26 insieme;
  - **niente è attribuibile**: chi ha modificato quell'iscrizione o
    cancellato quella spesa è sempre «commerciale.elitederma».

  L'impianto per rimediare c'è già e non è mai stato usato: le colonne
  `email_accesso`, la edge function `crea-accesso`, il tasto «Crea accesso».
  L'ordine obbligato è: un'utenza a testa → verificare che nessuno resti
  fuori → ruolo e identità dal JWT invece che dal Gate interno di App.jsx →
  solo allora le policy per ruolo.

- **Password in chiaro** nelle colonne `venditori.password` e `utenti_app.password`.
  Dal 18/10/2026 non sono più leggibili da chiunque abbia la chiave del bundle,
  ma restano leggibili **da chiunque abbia una sessione**, cioè da tutto lo
  staff. È il primo dei prossimi passi. Esisteva PBKDF2 via edge function
  `venditori-login`, poi abbandonato. Da ripristinare.
- **Lo storage: 18 secchi pubblici, non 10.** `allegati-iscritti`,
  `master-documenti`, `venditori-documenti`, `spese-allegati`,
  `leve-assistenti-documenti` e altri. «Pubblico» è un'impostazione del secchio:
  chi conosce l'indirizzo di un file lo scarica, policy o non policy.

  **Dal 18/10/2026 però da fuori non si scrive più.** Diciassette policy
  `for all to anon` sono passate a `authenticated`: si potevano sostituire
  loghi, locandine, allegati delle spese e documenti dei venditori. Restano ad
  `anon` due sole policy, tutte e due di solo INSERT, e sono le due pagine
  pubbliche che caricano un file: `moduli-iscrizione` e `consensi-documenti`.
  A `consensi-documenti` è stata tolta la lettura: i documenti d'identità delle
  modelle non si rileggono da fuori.

  **Resta da fare la lettura**: i secchi sono ancora pubblici, e chiuderli
  richiede di sostituire `getPublicUrl` con `createSignedUrl` in 14 punti
  dell'app. È il prossimo passo di questo capitolo.
- **Fatto bene**: le credenziali WooCommerce stanno in variabili d'ambiente delle
  edge function (`WC_CONSUMER_KEY`, `WC_WEBHOOK_SECRET`…), e `woo-webhook` verifica
  la firma HMAC. È il pattern da estendere a Stripe, WhatsApp ed email.
- **Email (dal 15/10/2026).** Invio tramite Resend con la edge function
  `invia-email`, mittente `notifiche@elitederma.net`, risposte a
  `notifiche@elitederma.it`. Dominio separato perché elitederma.it sta su Jimdo,
  che non permette i record DNS di Resend; elitederma.net è su GoDaddy e
  verificato. La chiave è il secret `RESEND_API_KEY`. La funzione accetta solo
  una sessione valida o la service role key: la chiave pubblicabile, che è nel
  bundle, non basta. Massimo 20 destinatari per invio; le campagne agli ex
  allievi avranno una funzione propria (disiscrizione, lotti, registro).

  Il testo delle mail sta in **`email_modelli`** (una riga per `chiave`, la
  prima è `conferma_iscrizione`), scritto da Setting → Modelli email. I
  segnaposti fra graffe li sostituisce `componiMailConferma` in App.jsx; se la
  riga manca o è stata svuotata vale il testo scritto nel codice, che resta lì
  apposta. È la **prima tabella con una sola policy `to authenticated`** e non
  `anon`: da qui si decide cosa esce a nome di Elitederma, e la chiave
  pubblicabile è nel bundle. Funziona perché il cancello di `Accesso.jsx` è
  acceso — se un giorno lo si spegnesse, questa tabella diventerebbe illeggibile
  e le mail tornerebbero al testo del codice senza dire niente a nessuno.

  **La copia firmata, allegata alla conferma (18/10/2026).** Quando
  l'allieva manda il modulo, la conferma di ricezione le arriva con
  allegato il **PDF di quello che ha sottoscritto**: dati, il testo del
  regolamento *com'era quel giorno* (da `iscritti.contratto_firmato`,
  congelato alla firma e mai riscritto — `coalesce` in `modulo_salva`),
  le dichiarazioni con la loro ora e l'elenco delle clausole degli
  artt. 1341-1342 c.c., la firma e il documento d'identità. Lo costruisce
  `_shared/modulo-pdf.ts` e lo archivia in `moduli-iscrizione` accanto
  agli originali (`iscritti.modulo_pdf_path`).

  Il formato di ciò che l'allieva carica **si legge dai primi byte**, non
  dal nome: chi compila da PC allega una scansione **in PDF**, che viene
  trapiantata pagina per pagina; una foto da telefono viene ridotta a
  1100 px e riscritta in JPEG — due foto da 11 MB diventano un PDF di
  118 KB. Quello che non si apre non ferma la conferma, ma finisce in
  `scartate` e si vede: per un allegato scartato in silenzio nessuno si
  accorgerebbe di una mail partita senza il documento.

  **Il timbro della società in fondo alla copia (19/10/2026).** La copia che
  l'allieva riceve portava una firma sola, la sua. Ora porta anche timbro e
  firma di Elitederma, con «ricevuto e accettato»: il file sta nel secchio
  **privato** `moduli-iscrizione/_azienda/`, e il percorso in
  `intestazione_societa.timbro_path`.

  **Il file si ritaglia sulla finestra visibile, e non è un dettaglio.** Il
  timbro fornito è una pagina A4 intera (595×842) con sopra un CropBox di
  162×107: aprendolo si vede solo il timbro, ma sotto c'è il foglio da cui è
  stato ricavato — un preventivo, con gli importi. `embedPdf` prende la pagina
  intera e **ignora il ritaglio**: al primo provino in fondo al contratto è
  comparso «Totale Formazione € 2.750,00» rimpicciolito. Si usa `embedPage`
  con il riquadro letto dal CropBox del file stesso. Vale per qualunque PDF
  si innesti: quello che si vede aprendolo non è detto sia tutto quello che
  contiene.

  **La ricevuta: com'è adesso, e cosa si è perso per strada.** Resend
  richiama `email-eventi` (firma Svix verificata, `RESEND_WEBHOOK_SECRET`)
  e scrive consegna, apertura e rimbalzo su `email_inviate`: quello resta,
  ed è quello che dice il postino.

  La conferma dell'allieva invece è cambiata il **19/10/2026, su
  richiesta esplicita**. C'era un tasto in fondo alla mail
  (`email-presa-visione`, che registra solo sul POST perché gli antispam
  aprono i link da soli); è stato **tolto** e sostituito dalle
  intestazioni standard di conferma di lettura — `Disposition-Notification-To`,
  `Return-Receipt-To`, `X-Confirm-Reading-To` — che `invia-email` aggiunge
  quando chi chiama passa `ricevuta: true`.

  Va scritto cosa comporta, perché non è un pareggio: il tasto funzionava
  su **ogni** programma di posta e finiva in `confermata_il`, leggibile
  dal fascicolo. Le intestazioni **Mail di iPhone e di Mac non le
  implementa affatto**, Gmail le ignora sugli account normali (solo
  Workspace, se l'amministratore l'accende), dove compaiono il
  destinatario può rifiutare, e la ricevuta torna come una **mail a
  `notifiche@elitederma.it`**: non entra nel registro e non compare nella
  scheda. In pratica, per chi legge da iPhone, non arriva niente.

  La funzione `email-presa-visione` e le colonne `token_conferma` /
  `confermata_il` restano in piedi e funzionanti, non raggiunte da nessun
  link: rimettere il tasto è una riga in `componiMailRicezione`.

  Tutto questo si guarda dalla tessera **Modulo ricevuto** della fascia
  di stato, che da oggi si preme (`src/iscrizioni/Fascicolo.jsx`) — ma
  solo da quella tappa in poi, perché prima la cartella è vuota. Da lì
  si rigenera anche la copia per le iscrizioni più vecchie, con
  `{ soloPdf: true }`, che scrive il documento senza far ripartire
  nessuna mail.

  **Il codice fiscale lo calcola l'app (20/10/2026).** La scheda e il
  modulo chiedono **sesso, data e luogo di nascita** (`iscritti.sesso`,
  `data_nascita`, `comune_nascita`, `stato_nascita` — vuoto = Italia) e
  il codice lo scrive `calcolaCodiceFiscale` in
  `src/iscrizione/codice-fiscale.js`. Lo si chiedeva e basta, e **11 dei
  253 in archivio avevano la lettera di controllo sbagliata**: copiati a
  mano, con un errore che nessuno ha visto.

  Tre regole, ognuna nata da un modo di sbagliare. **Sesso mancante =
  niente calcolo**, perche' il giorno di una donna e' il giorno + 40 e un
  sesso indovinato produce un codice che *passa la lettera di controllo*
  ed e' di un'altra persona — il peggiore dei risultati, perche' nessuno
  lo mette in dubbio. **Si rifa' solo il codice che abbiamo scritto noi**:
  quello che la casella contiene se non l'ha toccato nessuno e' nostro e
  segue i dati che lo generano, mentre uno scritto, incollato o corretto
  a mano non si tocca — esiste l'omocodia e un calcolo non puo' saperla.
  Cancellato a mano resta cancellato. **Un codice che contraddice la data
  scritta sopra si segnala**, non si corregge.

  La regola di prima era «si scrive solo se la casella e' vuota», e
  produceva il caso peggiore: **il calendario del telefono parte da
  oggi**, quindi chi apriva il campo e lo chiudeva si portava il codice
  calcolato sulla data di oggi, congelato li', e sotto l'avviso che non
  torna — l'app generava un codice e poi dava torto a se stessa. Per lo
  stesso motivo una data **di quest'anno o nel futuro** adesso si dice,
  e sotto i 18 anni anche.

  **Il comune di nascita si sceglie da un elenco** (`CampoComune.jsx`).
  Era testo libero, e `codiceCatastale` vuole il nome ufficiale parola
  per parola: chi scriveva «REGGIO CALABRIA» — cioe' chiunque, perche'
  il «di» non lo dice nessuno — non otteneva nessun codice e nessun
  motivo. Ora `cercaComuni` cerca come si scrive (ogni parola e' l'inizio
  di una parola del nome, le paroline di mezzo non vanno sapute) e
  propone il comune con la sua provincia accanto, che serve a
  distinguere i quattro Paterno. Un comune fuori elenco lo dice sotto la
  casella. Niente rete: l'elenco ISTAT sta gia' nel bundle.

  Il codice fiscale *contiene* data, sesso e comune, quindi le 253 schede
  che ne avevano uno non avevano niente da chiedere a nessuno:
  `20261020120000_nascita_dal_codice_fiscale.sql` ne ha letti **242**, e
  tutti e 242 ricostruiscono esattamente le nove cifre centrali del loro
  codice. I 17 che restano — 7 senza codice, 10 col codice malfatto —
  vanno letti dal documento. I comuni e i 232 Stati esteri (codici `Z`)
  stanno in `src/comuni-regioni.js`, generato da `genera-comuni.mjs`:
  non si aggiungono a mano.

  **Il link del modulo vale una volta sola (19/10/2026).** `modulo_salva`
  si fermava solo davanti a un'iscrizione già *confermata*, ma fra «il
  modulo è arrivato» e «l'iscrizione è confermata» passa l'acconto: in
  mezzo chi riapriva la mail poteva rifirmare e rispedire, e la seconda
  spedizione **riscriveva** `firma_path`, `doc_fronte` e `doc_retro`
  (quelli arrivano pieni, il `coalesce` non li protegge) mentre
  `contratto_firmato` e `modulo_ricevuto_il` restavano della prima. Il
  PDF archiviato avrebbe mostrato una firma e nel secchio ce ne sarebbe
  stata un'altra.

  Adesso la serratura è `modulo_ricevuto_il`, su tutti e due i lati:
  `modulo_vista` non apre la pagina e restituisce `motivo`
  (`confermato` | `gia_inviato`) perché le due cose meritano due frasi
  diverse, `modulo_salva` rifiuta, la tessera di invio della fascia non
  si preme più e `eseguiInvio` ricontrolla sulla riga riletta. Se serve
  far rifare un modulo **oggi non c'è modo**: va aggiunto un gesto
  apposta, deliberato.

  **Il regolamento va aperto e richiuso prima di firmare.** Non dimostra
  che sia stato letto — niente lo dimostra — ma toglie il caso in cui si
  scorre, si spunta «ho letto» e si firma senza sapere che esiste. Fino
  ad allora dichiarazioni spente e, al posto della lavagna della firma,
  un riquadro che dice perché.

  **La bozza resta sul telefono di chi compila.** Il modulo si apre quasi
  sempre dentro la finestra interna dell'app di posta, e quella finestra
  si chiude da sola: basta aprire la fotocamera per allegare il documento
  e cambiare idea. Risposte e spunte vanno in `localStorage`
  (`modulo-bozza-<token>`), si ripristinano all'apertura con un avviso, e
  si cancellano appena il modulo parte. Le foto no: un file non si mette
  da parte.

  **Il campo del documento non si apre più da codice.** Era un input
  nascosto (1×1, `pointer-events: none`) aperto con `.click()`: su iPhone
  funzionava una volta sola, e chi entrava in fotocamera e tornava
  indietro non riusciva più ad allegare niente — unica via d'uscita,
  chiudere la pagina e rifare il modulo da capo. Ora il tasto **è** il
  campo, dentro una `label`: il tocco arriva all'input senza passare da
  JavaScript, che è l'unica forma che iOS accetta sempre.

  **E un invio fallito non cancella più il modulo.** `errore` (non sono
  riuscito ad aprire) ed `erroreInvio` (non sono riuscito a spedire)
  erano la stessa variabile, e il controllo sul primo esce *prima* di
  disegnare il modulo: un rifiuto in fase di invio sostituiva l'intera
  pagina con «Qualcosa non ha funzionato», portandosi via tutto quello
  che era stato scritto e firmato.

  **Registro e invii automatici (15/10/2026).** Ogni invio lascia una riga in
  `email_inviate`, anche quando fallisce. Un indice unico *parziale*
  (`chiave_modello + iscritto_id`, solo `automatica and esito = 'ok'`) impedisce
  a una mail automatica di partire due volte, lasciando però che il tasto a mano
  rimandi quante volte serve. `email_regole` dice *quando* parte cosa
  (`scarto_giorni` negativo = prima dell'evento) e **nasce sempre spenta**. Il
  lavoro notturno è la edge function `email-programmate`, che con
  `{ "prova": true }` dice solo cosa partirebbe senza mandare niente — è il
  pulsante «Guarda cosa partirebbe oggi». La composizione sta in
  `supabase/functions/_shared/email.js`, importata **sia** da App.jsx **sia** da
  Deno: due copie vorrebbero dire che l'anteprima mostra una mail e l'allieva ne
  riceve un'altra.

  **Il cron è acceso dal 16/10/2026** (`email-programmate-giornaliero`, `0 6 * * *`),
  e la policy di `email_regole` è `to authenticated`. Ma **non parte niente**:
  l'unica regola che esiste (`dettagli_organizzativi`, −3 giorni dall'inizio
  corso) è spenta, e il giro di prova risponde «Nessuna regola accesa.»

  Come si autentica il cron, e perché non con la service role key: la funzione
  confronta il gettone ricevuto con la propria `SUPABASE_SERVICE_ROLE_KEY`
  carattere per carattere, e il JWT `service_role` che il vault ha da agosto
  (`fic_service_key`) è di prima del passaggio alle chiavi nuove — provato, 403.
  Mettere dentro quella giusta voleva dire far passare da una chat o da un file
  una credenziale che scavalca ogni policy. Quindi il cron manda **due** header:
  `Authorization: Bearer <JWT anon>`, che serve solo a passare il cancello
  `verify_jwt` di Supabase, e `x-cron-token`, un gettone di 32 byte **nato dentro
  Postgres** (`gen_random_bytes`) e mai uscito dal database, che la funzione fa
  verificare a `public.email_cron_ok` — `security definer`, eseguibile solo da
  `service_role`, così la chiave pubblicabile del bundle non lo può usare come
  oracolo. Verificato: gettone giusto 200, inventato 403, assente 403.
  Per rigenerarlo: cancellare la riga `email_cron_token` dal vault e rieseguire
  `20261016133139_email_cron_gettone.sql`.

  Gli altri cinque lavori notturni del progetto si limitano a mandare un JWT del
  progetto e si fidano del cancello: le loro funzioni non controllano nient'altro.
  Per una che spedisce posta a nome nostro non bastava.
- **Il testo del contratto si corregge dall'app (16/10/2026).** Regolamento,
  informativa privacy e consensi stanno in `src/iscrizione/contenuto.js`,
  trascritti parola per parola dal modulo del sito. Da Setting → Modulo di
  iscrizione → **Il contratto** si leggono per intero e si correggono; la
  correzione va in **`modulo_iscrizione_testi`** (`chiave`, `corpo` jsonb), che è
  la seconda tabella con una sola policy `to authenticated`.

  Come `email_modelli`: **riga mancante = vale il testo del codice**. La tabella
  nasce vuota apposta, e «Rimetti com'era» cancella la riga invece di riscrivere
  il testo. Quello che una persona firma non può dipendere dal fatto che una
  select sia andata a buon fine.

  Qui niente si salva da solo: sono clausole contrattuali, e una parola cambiata
  uscendo da un campo è una cosa di cui nessuno si accorge. Si entra in
  correzione, si scrive, si preme Salva.

  **Attenzione a cosa cambia davvero.** Oggi `contenuto.js` lo legge solo questa
  pagina: il modulo che l'allieva riceve **non esiste ancora** (è la Fase 2).
  Correggere il testo adesso prepara quel modulo, non cambia niente di ciò che
  gira oggi.
- **`.env` non è mai stato committato**, `.gitignore` corretto, nessuna chiave nella
  storia git. Il repository è però **pubblico** su GitHub.
- **L'SSO di Vercel risulta attivo nelle impostazioni ma non blocca.** L'API dice
  `ssoProtection: enabled`, `deploymentType: all_except_custom_domains`. Provato
  davvero, il 5 settembre 2026, con una `curl` senza cookie né sessione:

  ```
  GET https://elitederma-calendario.vercel.app/  ->  200, index.html vero
  GET /assets/index-CZlCCs46.js                  ->  200, 2,2 MB
  ```

  Dentro quel bundle c'è la chiave pubblicabile del progetto Supabase
  (`sb_publishable_…`). Chiunque conosca l'indirizzo la scarica in due comandi.

  **Messo insieme al punto sulle policy, questo significa che oggi chiunque su
  internet può leggere e scrivere l'intero database** — anagrafiche, pagamenti,
  allegati degli allievi. Non è un rischio teorico: la chiave è pubblica e le
  policy dicono `to anon using (true) with check (true)`.

  La versione precedente di questo file dava l'SSO come "l'unica barriera". Non
  è una barriera: non c'è. Chiudere le policy non è più un passo di igiene, è
  la cosa che manca.

Regola operativa: dati di allievi (nome, residenza, email, pagamenti) sono materia
GDPR. Ogni modifica che li tocca passa da una verifica delle policy prima del merge.

### Il magazzino si controlla da solo (19/10/2026)

Ogni notte alle 05:15 `controlla_saldi_magazzino()` ricostruisce la giacenza di
ogni prodotto — **saldo di partenza + somma dei movimenti** — e la confronta con
quella vera. Chi non torna finisce in `magazzino_scostamenti` e compare in cima
a Gestione magazzino, sopra i segnalatori: sotto scorta ed esaurito sono fatti
normali, questo è il magazzino che contraddice la sua storia.

Uno scostamento significa **una cosa sola**: qualcuno ha scritto quel numero
senza passare da `muoviStock`. Il controllo **non corregge** — correggere da lì
vorrebbe dire scrivere lo stock da un quarto punto, cioè creare il problema che
esiste per trovare.

`magazzino_saldi_base` è **un'assunzione dichiarata**, non un inventario:
nessuno ha contato, si sono prese per buone le giacenze del 19/10. Da lì in poi
ogni scostamento è vero; quello che era già sbagliato prima resta sbagliato
finché non si conta.

**I movimenti da ordine online non si applicano due volte.** Ognuno porta un
riferimento (`woo:<ordine>:<scarico|ripristino>:<prodotto>`) e un indice unico
*parziale* lo fa rispettare. Prima la protezione era il confronto fra stato
vecchio e nuovo dentro `woo-webhook`: vera, ma dentro un `if`. Il vincolo vale
**solo** per `ordine_online`, perché `kit_corso` ha 137 coppie ripetute su 1018
e sono legittime.

**E ogni notte alle 05:30 si misura lo scarto col sito.**
`magazzino-termometro` confronta la nostra giacenza con quella di
WooCommerce prodotto per prodotto e scrive `magazzino_scarti_shop`. Non
corregge: la direzione giusta non la sa un programma — due pezzi in meno sul
sito possono essere un ordine non arrivato o un ammanco, e si rimedia in modi
opposti.

**I bundle si misurano sulla disponibilità componibile**, non su `quantita` —
che su un bundle non vuol dire niente. La formula (`min(floor(giacenza
componente / quantità per bundle))`) è copiata da
`sincronizzaDisponibilitaBundle`: misurare con un conto diverso da quello che
*scrive* il numero vorrebbe dire misurare la differenza fra i propri due conti,
non uno scarto vero. Un bundle **con** giacenza fisica è un prodotto normale e
resta fuori.

**E i pezzi promessi a un carrello sospeso non sono in vendita**: quello che
il sito può vendere è la giacenza *meno* quelli già impegnati al banco. Vale
per i semplici e — dal 19/10/2026 — anche per i bundle.

**Il valore che fa fede è quello dell'app** (deciso il 19/10/2026). Quindi
ogni notte, in quest'ordine: **05:15** controllo del saldo, **05:30**
`woo-riallinea-shop` che spinge sul sito la situazione dell'app, **05:45** il
termometro. L'ordine conta: ciò che resta negli scarti dopo un riallineamento
è ciò che il riallineamento *non ha saputo* sistemare, e solo quello merita di
essere guardato.

**Misurare il numero che scrive chi scrive.** La prima versione del termometro
diceva 33 scarti col peggiore a −983; dopo due correzioni sono **zero** su 161
prodotti. Sbagliava due volte: confrontava `quantita` sui bundle (che su un
bundle non vuol dire niente) e non toglieva i pezzi promessi ai carrelli
sospesi. Ogni volta i numeri sembravano un allarme ed erano un errore di
misura. La regola che ne resta: **non misurare il numero che sembra giusto,
misurare quello che scrive la funzione che lo scrive** — e se non coincidono,
il difetto è nella misura finché non si dimostra il contrario.

Il termometro ha però trovato **un guasto vero**: `woo-riallinea-shop` non
toglieva dalla disponibilità di un bundle i pezzi promessi, perché dava per
scontato che nel carrello ci fossero i *componenti*. Al banco si mette nel
carrello l'espositore, non i dieci pezzi — quindi il sito continuava a offrire
bundle già promessi a qualcuno. Corretto.

La funzione è chiusa dal gettone del cron (lo stesso delle email): senza,
risponde 403. Il cron manda `timeout_milliseconds := 120000`, perché il
limite di 5 secondi di `pg_net` scadeva sempre e il lavoro risultava fallito
anche quando era riuscito.

**`giacenza` e `giacenza_magazzino` sono in dismissione.** Non le legge nessuno
in tutta l'app — la giacenza è `quantita` — ma venivano ancora scritte da due
edge function, e questo è peggio di una colonna morta: sembra viva, e chi apre
la tabella ci ragiona sopra. Dal 19/10 non si scrivono più. **Non sono ancora
state cancellate**: prima si guarda per qualche giorno che nessuno le cerchi.

## 5. Comandi

```bash
npm run dev                  # sviluppo locale
npm run build                # build di produzione
npm run preview              # anteprima della build
npm run lint                 # ESLint: solo errori veri, zero regole di stile
npm test                     # le prove in prove/ (Vitest + jsdom)
sh controlla-funzioni.sh     # tipi delle edge function (Deno), prima di pubblicarle
```

**Prima di ogni push: `npm run lint`, `npm test`, `npm run build`.** Tutti e tre
a zero. Prima di pubblicare una edge function, anche `sh controlla-funzioni.sh`.

**ESLint (dal 18/10/2026).** Configurato stretto in `eslint.config.js`: nessuna
regola di stile — quelle le decide chi scrive — solo le poche che prendono i
guasti veri di questo progetto.

**Dal 19/10/2026 guarda anche `supabase/functions/**/*.js`.** Prima
`supabase/functions/**` era ignorato in blocco: per i `.ts` va bene, li
controlla `deno check`, ma i `.js` di `_shared/` non li guardava **nessuno dei
due**, perché `deno check` non segnala una funzione inesistente in un file
JavaScript. È costato un 500 in produzione: togliendo da `email.js` un blocco
se n'è andata anche `bloccoRecesso`, che gli stava attaccato, e la conferma di
ricezione ha smesso di partire. `no-undef` lo prende in un secondo.

**Dal 19/10/2026 passano tutte e 44.** Le quattro che restavano rosse erano
due cose diverse. `crea-accesso` e `venditori-login` avevano errori di tipo veri
ma innocui a runtime (un `.message` su quello che un `catch` consegna, che non è
per forza un `Error`; un `Uint8Array` che per i tipi potrebbe poggiare su
memoria condivisa e che le funzioni di crittografia non accettano): corretti e
ripubblicati, il comportamento non cambia di una virgola.

**Il 19/10/2026 sono state cancellate le tre funzioni `temp-`** rimaste
pubblicate da agosto (`temp-check-webhooks`, `temp-seed-codici-woo`,
`temp-test-bundle-webhook`): erano già svuotate — rispondevano solo `410` — e
non le nominava nessuno, né nel repo né altrove. Adesso **44 pubblicate = 44 nel
repository**, nessuna orfana da nessuna delle due parti: è una cosa che vale la
pena ricontrollare ogni tanto, perché una funzione dimenticata online è una
porta aperta di cui nessuno ricorda il perché.

`fic-sync` e `invia-notifica-push` invece **non avevano niente che non andasse**:
importano pacchetti npm che su Supabase risolve la pubblicazione e che in locale
Deno non trovava. Ora `controlla-funzioni.sh` gira dentro `.controllo-deno/`
(esclusa da git), con `nodeModulesDir: auto`, così Deno se li scarica da solo e
il suo `node_modules` **non si mescola a quello di Vite** — due gestori nella
stessa cartella è un guaio che si paga più tardi.

Perché valeva la pena: un comando che risponde «4 da sistemare» a ogni giro
smette di essere letto, e il giorno in cui quei quattro diventano cinque nessuno
se ne accorge. Al primo giro ha trovato un
`nonRisoltiPerEtichetta` che non è mai esistito (schermata bianca in attesa del
giorno in cui il magazzino fosse andato a posto) e due `opacity` scritte nello
stesso stile. Gli avvisi che restano sono quasi tutti `no-unused-vars`: si
guardano, non fermano niente.

**Le prove (dal 18/10/2026).** Stanno in `prove/`, 26 file e 266 controlli. Montano i
componenti **veri** in jsdom e li toccano — premono il tasto del regolamento,
scrivono un codice fiscale corto, cliccano «Emetti la fattura» e guardano cosa
parte. Questo progetto non si rompe in compilazione: si rompe al montaggio e al
clic. Nessuna prova parla col database: `prove/preparazione.js` sostituisce
`fetch` prima di ognuna.

Non aggiungere altri strumenti di iniziativa (formattatori, librerie di
componenti, framework di stili): su un file da 84.000 righe un riformattone
cancella la storia di `git blame`, che è l'unico modo per capire perché un
calcolo è scritto così.

**Le edge function invece un controllo ce l'hanno, dal 18/10/2026.**
`supabase functions deploy` impacchetta e basta: non guarda i tipi e non si
accorge di una variabile che non esiste. È così che è finita in produzione una
funzione con dentro `dataIso is not defined`, scoperta dal titolare premendo il
tasto per emettere una fattura vera. `sh controlla-funzioni.sh` passa
`deno check` su tutte (o su una sola, se la si nomina) e va lanciato **prima**
di `supabase functions deploy`. Deno sta in `~/.deno/bin/deno`.

## 6. Convenzioni

- Italiano ovunque: nomi di variabili, funzioni, commenti, tabelle e colonne.
- Tabelle e colonne in `snake_case`, al plurale (`iscritti`, `corsi_date`).
- Commenti discorsivi che spiegano *perché*, non *cosa*. Mantenere questo registro.
- Date in UTC nel database, formattazione `it-IT` e fuso `Europe/Rome` solo in UI.
- Importi: verificare caso per caso prima di toccare calcoli di acconti, saldi,
  commissioni o inventario.

## 7. Cosa non fare mai

- Migrazioni, `UPDATE` o `DELETE` sul database di produzione senza conferma esplicita.
- Modificare la logica di commissioni, acconti/saldi o inventario senza mostrare
  prima il diff e l'impatto sui dati storici.
- Mettere segreti in variabili `VITE_*`: finiscono nel bundle pubblico.
- Spostare la generazione dei PDF lato server: è client-side per scelta.
  **Un'eccezione, dichiarata:** il modulo di iscrizione firmato
  (`supabase/functions/_shared/modulo-pdf.ts`). Quel PDF deve partire
  *allegato* a una mail che manda il server; se lo facesse il telefono
  basterebbe che la pagina si chiuda un istante prima e la conferma
  uscirebbe senza allegato, cioè senza la cosa per cui esiste.
- Riformattare o "sistemare" file non toccati dal task in corso.
- Aggiungere dipendenze per problemi che il codice esistente già risolve.

## 8. Come lavoriamo

- Modifiche strutturali: proposta breve → conferma → esecuzione.
- Database: sempre migrazione versionata in `supabase/migrations/`, mai modifiche
  a mano dalla dashboard.
- Su denaro, permessi o dati personali: chiedere, non indovinare.

## 9. Glossario

| Termine | Significato |
|---|---|
| **Master** | Formatrice che tiene il corso; ha obiettivi e commissioni proprie. |
| **Edizione** | Istanza concreta di un corso: sede + data + master. |
| **Leva** | Gruppo/turno di allievi associato a un corso. |
| **Kit corso** | Insieme di prodotti a magazzino consegnato all'allievo. |
| **Punti** | Unità alternativa all'euro per gli obiettivi di vendita. |
| **Origine vendita** | POS (diretta) vs WooCommerce (shop online). |
| **Modella** | Persona su cui gli allievi esercitano durante il corso. |
