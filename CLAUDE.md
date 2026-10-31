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
| Storage | 22 bucket Supabase, quattro privati (`moduli-iscrizione`, `consensi-documenti`, `slide-corsi`, `eventi-documenti`) |
| Backend | 49 edge function Deno in `supabase/functions/` (WooCommerce, Stripe, Fatture in Cloud, email, modulo di iscrizione, WordPress) |
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
prove/                   67 file, 448 prove (Vitest + jsdom), con preparazione e aiuto
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

  **I modelli di consenso sono sei, dal 26/10/2026** (`src/content/consensi.ts`):

  | Codice | Copre | Corsi |
  |---|---|---|
  | `pmu-micro` | trucco permanente **del viso** | 13 |
  | `needling` | microneedling | 1 |
  | `laminazione` | laminazione ciglia (e IKE) | 5 |
  | `trico` | tricopigmentazione | 2 |
  | `areola` | dermopigmentazione dell'areola | 1 |
  | `extension` | extension ciglia | 2 (EXTENSION BASE, EXTENSION VOL) |

  **Extension ciglia (26/10/2026)** è trascritto dal testo del titolare:
  adesivo al cianoacrilato, occhi chiusi per due-tre ore, rischi e
  controindicazioni suoi. Tre cose da sapere: il **patch test** è un campo
  obbligatorio (data ed esito, oppure la rinuncia scritta); chi opera si
  scrive (`esecutore`); le foto sono **due caselle facoltative
  indipendenti**, `immagini` (con volto, sito e social) e
  `immagini_senza_volto` (solo l'occhio, uso interno), perché il cartaceo
  aveva tre opzioni e sono due consensi diversi. Le condizioni economiche
  del cartaceo erano caselle a penna: il titolare le ha dettate il
  26/10/2026 — **gratuito, nessun contributo; non incluse le successive
  sedute di mantenimento** (non «ritocchi»). Corretto sul posto, nessuna
  firma ancora raccolta.

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
  e **il titolare li ha letti per intero e approvati il 25/10/2026**, insieme
  al Punto 9 dell'informativa. Una sola correzione sua: la soglia dell'areola
  è **sei mesi** dall'intervento e dalla radioterapia, non i dodici che avevo
  scritto io. Nessuna modella aveva ancora firmato l'areola, quindi il testo è
  stato corretto sul posto senza una v2. **Non c'è un consulente**: il
  titolare è l'unico responsabile della privacy e dei contratti, e li firma
  lui.

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

  **Quattro mail a un indirizzo inesistente (22/10/2026).** Un modulo è
  partito quattro volte verso `elitederma@europe.con` — `.con` invece di
  `.com` — ed è rimbalzato tutte e quattro, in mezzo secondo ogni volta.
  Resend accettava (la forma è valida), il registro diceva `esito: ok`,
  la fascia diceva «Modulo inviato» in verde. Il rimbalzo *era* scritto,
  in `email_inviate.rimbalzata_il`, e il fascicolo lo mostrava — ma il
  fascicolo si apriva solo da «Modulo ricevuto» in poi, cioè dalla tappa
  che non arriverà mai proprio perché la mail è rimbalzata. **Era
  registrato in un posto raggiungibile solo se il guasto non fosse
  successo.** Quattro difese, una per anello:

  - **Prima**: `src/iscrizione/email.js` (`avvisoEmail`, da `avvisoCampo`)
    segnala le code che *non esistono* e i fornitori scritti storti. Solo
    quelli: `.co`, `.cm`, `.ir`, `.lt` sembrano sviste e sono code vere, e
    una casella che dà torto a un indirizzo buono non la legge più nessuno.
  - **Dopo**: `iscritti.modulo_mail_rimbalzata_il`, scritta da
    `email-eventi`, azzerata dal primo invio riuscito. La fascia tiene il
    pallino rosso e dice «Non arrivata».
  - **Il rinvio si ferma** se l'indirizzo è *ancora* quello che ha
    rimbalzato (confronto col destinatario vero dell'ultimo rimbalzo).
    Corretto anche di una lettera, riparte.
  - **Il fascicolo si apre da «Modulo inviato» in poi**: dentro ci sono il
    registro delle mail e il link, cioè quello che si cerca quando il
    modulo non torna.

  **Quello che nessun controllo può prendere** è un indirizzo ben formato
  e sbagliato (`maria` per `mario`): lì non rimbalza niente e la mail
  arriva a qualcun altro. L'unico segnale è che il modulo non torna, e
  **oggi un modulo consegnato e mai tornato resta invisibile per sempre**
  — manca l'elenco di chi aspetta da troppo.

  **Riaprire un modulo già arrivato (22/10/2026).** La serratura è
  `modulo_ricevuto_il`; il gesto per toglierla sta nel fascicolo e chiama
  `modulo_riapri`, che **prima archivia** in `moduli_riaperture` firma,
  documenti, contratto, PDF, data e stato, e solo dopo sblocca — così il
  guasto del 19/10 (seconda spedizione che sovrascriveva) non può
  tornare. Il tasto è spento finché la copia firmata non è stata
  generata, `contratto_firmato` torna vuoto apposta (si firma il testo di
  adesso), e la mail **non riparte da sola**.

  **Senza firma non si spedisce (22/10/2026).** `modulo_salva` non
  controllava niente: accettava un modulo senza firma, segnava
  `modulo_ricevuto_il` e faceva partire la conferma col PDF — un
  contratto non sottoscritto, archiviato. La pagina teneva già spento il
  tasto, ma **un controllo che vive solo nel browser non è un controllo**.

  **Il link si può ripassare a mano (22/10/2026)**, dal fascicolo, con la
  traccia in `moduli_link_copiati`: chi l'ha preso e quando. Serve quando
  la mail è consegnata ma non arriva (posta indesiderata). **Non** segna
  il modulo come inviato — era il peccato di `segnaInviatoAMano` — e
  sparisce quando il modulo è tornato.

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

- **In Home ci si entra tutti (21/10/2026).** Chi entrava con la sola password
  venditore atterrava dritto sulla Dashboard venditori. Aveva senso quando le
  password erano poche e i permessi non esistevano; adesso la Home mostra le
  aree che spettano a quella persona, e saltarla vuol dire non sapere di
  averle. Premendo «Dashboard venditori» la dashboard resta **bloccata sui
  propri dati** (`apriLoginVenditore` riconosce `utenteLoggato.venditoreId`), e
  `operatoreCorrente` sa chi opera anche senza `venditoreLoggato`. Resta un
  solo salto, voluto: il profilo *kiosk* (Gestione utenti → Solo calendario),
  che ha Home/Indietro/Avanti nascosti e in Home resterebbe intrappolato.

Regola operativa: dati di allievi (nome, residenza, email, pagamenti) sono materia
GDPR. Ogni modifica che li tocca passa da una verifica delle policy prima del merge.

### Regolamenti e l'assistente flottante (25/10/2026)

Le decisioni prese nel tempo — prezzi, sconti, procedure, cosa fare
quando — vivevano nelle chat. Ora stanno in **Regolamenti**, tessera in
Home con la sua casella nei permessi (`regolamenti` in `TASTI_HOME`;
programmatore e amministratore la vedono comunque). Chi amministra
**scrive** le schede (`src/regole/PaginaRegolamenti.jsx`, tabella
`regolamenti`: titolo, argomento, testo, `visibile_a`, `decisa_il`,
`attivo`); gli altri le leggono. **Nasce vuota, per scelta del titolare**:
la riempie lui, scheda per scheda.

L'**icona flottante** in basso a destra (`AssistenteRegole.jsx`) c'è per
chiunque abbia fatto accesso, tranne il profilo kiosk. La edge function
`assistente-regole` (Haiku, `getUser` obbligatorio: senza sessione 401,
verificato) passa al modello **solo** le schede attive visibili a quel
ruolo e la domanda — niente dati di allievi né di vendite — e gli impone di
rispondere **solo** con quello che c'è scritto, citando le schede. Se
nessuna risponde lo dice e segna `senza_risposta`: quelle domande finiscono
in `regolamenti_domande` e compaiono in fondo alla pagina per chi scrive,
con un «Fatto» quando la scheda è stata scritta. È da lì che le FAQ si
costruiscono dalle domande vere. Il registro lo scrive solo la funzione;
l'app lo legge e cancella. Prove in `prove/regolamenti.test.jsx`.

**Due registri, dal 25/10/2026 sera.** Il titolare ha chiesto «un po' più
di intelligenza, non solo una cosa macchinosa»: l'assistente (ora Sonnet)
risponde **dalle regole** quando una scheda copre la domanda, e quando non
c'è **ragiona** col venditore sul caso — domande di chiarimento, come lo
gestirebbe, i rischi — dicendo sempre che è un ragionamento e che prima di
agire va sentito chi amministra. L'etichetta nel pannello lo distingue
(«Un ragionamento, non una regola scritta», bordo blu; dalle regole, bordo
oro). La cronologia va al modello come veri turni. `senza_risposta` resta
vero per ogni domanda di regola non coperta, anche se ha ragionato: è così
che l'elenco delle regole mancanti continua a riempirsi.

**Le disposizioni dette in dialogo diventano schede** (25/10/2026 sera).
Quando chi amministra dà una disposizione all'assistente («da oggi in aula
lo sconto è il 10% con carta»), la funzione rimanda `proposta_regola`:
titolo, argomento, testo scritto come regola, per chi vale, e la scheda
esistente che contraddice (`sostituisce`). Il pannello la mostra
modificabile con «Salva come regola»; a voce basta «sì» / «salva». Niente
si scrive da solo: la decide il titolare, l'assistente la mette in bella.
Salvata, la scheda sostituita si **spegne**, non si cancella. In fondo a
Regolamenti, accanto a «Fatto», c'è il **cestino** per le domande di prova.

**E si parla con l'assistente** (`src/regole/voce.js`, 25/10/2026 sera):
il microfono nel pannello apre una conversazione a mani libere come quella
dell'app di Claude — ascolta, manda la frase, **legge la risposta** con la
voce italiana di sistema, torna in ascolto; un tocco mentre parla lo
interrompe, il tasto la chiude. Il modello legge e scrive testo: la voce
sono le due cose che il browser sa già fare (Web Speech API e
`speechSynthesis`), zero fornitori e zero voce verso terzi. Il limite è lo
stesso del tasto «Detta»: su iPhone il riconoscimento del browser è
capriccioso. Per la qualità della voce di Claude su iPhone servirebbe una
trascrizione esterna (Whisper, Deepgram): fornitore in più, costo, privacy —
**decisione del titolare, non presa**.

**La voce naturale** (25/10/2026 sera, chiesta dal titolare: «non mi
interessa poter scegliere la voce ma solo la voce naturale»). Il telefono
non ce l'ha: la edge function `leggi-voce` manda il **testo** della
risposta a OpenAI (`gpt-4o-mini-tts`, voce «nova», secret
`OPENAI_API_KEY`) e restituisce l'audio, che il pannello suona
(`leggiNaturale` in `voce.js`). Esce solo il testo, mai la voce di chi
parla. **Senza chiave la funzione risponde 503 e si torna alla voce del
telefono**: la conversazione non si ferma per una voce. La tendina di
scelta della voce è stata tolta; resta l'ordinamento che preferisce le
voci italiane migliorate per il ripiego. La chiave la crea il titolare su
platform.openai.com e la mette nei secret di Supabase, mai in chat.

**Le regole si dettano** (`src/regole/Dettatura.jsx`): un microfono accanto
al testo, con il riconoscimento vocale **del browser** (Web Speech API,
`it-IT`): niente server, niente costi, e dove il browser non lo ha il tasto
non compare. La frase si **accoda** al testo quando il browser la dà per
definitiva, così si detta, ci si ferma, si corregge a mano e si riprende.

**E si sistemano** («✨ Sistema il testo», edge function `sistema-testo`,
Haiku, `getUser`): corregge ortografia e punteggiatura e rende la frase
chiara **senza cambiare cifre, percentuali, date e senso** — se un passaggio
è ambiguo lo lascia e lo dice nelle note. La proposta compare sotto, e si
sceglie «Usa questo testo» o «Tieni il mio»: niente si sostituisce da solo,
sono regole che altri applicheranno alla lettera.

**E hanno «↶ Indietro» e «↷ Avanti»**: ogni cambiamento del testo — battuto,
dettato, sistemato — entra in una pila, e i tasti battuti di seguito entro
un secondo contano come un passo solo. Nato perché una cancellazione
sbagliata in un testo dettato per dieci minuti non si rifà a voce.

### Il metodo di pagamento si corregge, ma non su Stripe (27/10/2026)

In Vendite al banco la colonna **Incasso** è una tendina (POS, Contanti,
Buono Amazon) con conferma dentro la riga: il totale non si tocca, si
sposta solo la ripartizione imponibile/IVA. C'era già; da oggi è **solo
di chi amministra** (programmatore, amministratore): le master vedono il
metodo scritto e la rettifica la fa l'ufficio. E su una vendita
**incassata con Stripe** la tendina non c'è per nessuno: i soldi sono sul
conto, e rietichettarla «contanti» la toglierebbe dalle fatture da
emettere e la metterebbe in una busta che non li ha mai visti. Lo vieta
anche il database (`vendite_shop_metodo_non_si_cambia_se_stripe`, che
guarda `pagamenti_pos.pagato_il` per vendita o per codice; provato sulla
vendita di Lia: rifiutato).

**E sistema la busta** (stesso giorno, chiesto dal titolare: «aggiorna pure i
contanti che uno si aspetta in busta»). Fatture da emettere, provvigioni e
prima nota leggono il metodo dal vivo; la busta della classe no, perché il
suo importo si congela quando rientra in cassa. Quindi da contanti a carta
la vendita **esce dalla busta** con la stessa logica della cancellazione
(`sganciaDallaBusta`, condivisa): busta in cassa → si riapre, o se ha già
appendici il suo importo scende; da carta a contanti **entra nel contante
atteso**, senza numero di busta, e il Riepilogo la mette nella busta aperta
o nell'appendice. La riga lo dice **prima** di confermare.

### Iscrivi allievo: il modulo non si carica più, parte dall'app (29/10/2026)

Tolti dalla scheda dell'allievo l'area «Carica modulo di iscrizione», il
tasto «Leggi dati dal modulo» e le due funzioni che li servivano; dalla
pagina Iscrizione allievi il vecchio link al modulo del sito
(`elitederma.eu/modulo-iscrizione-corsi`) e, nelle tappe, le frasi «invia
il link» e «carica il modulo compilato». La strada è una: dalla scheda
si preme «Invia il modulo», l'allieva lo firma dal telefono, torna
firmato nella scheda. Il testo di quella pagina vive in `normative_testi`
(`iscrizione_allievi`), che comanda sul testo di partenza nel codice:
corretti tutti e due. Resta, in sola lettura, il link ai moduli cartacei
caricati in passato (`iscritti.file_iscrizione`).

### La quota coordinatore, intestata a una persona (28/10/2026)

Esisteva dal 1° al 14 ottobre come «percentuale del coordinatore» senza
nome (0,25%, poi 0,5%) e si confondeva con la quota venditore: tolta il
14/10. Il titolare l'ha rivoluta, **di qualcuno**: in **Setting → Corsi →
Quota coordinatore** si scelgono la persona (Elena), la percentuale sul
pattuito di ogni iscrizione e da quale data di inizio corso vale; si
salva in `impostazioni_layout_tabelle` (`quota_coordinatore`), con un
tasto e non da sola. In **Commissioni sui corsi** — anche nella Dashboard
venditori, dov'è la scheda che Elena legge — compare in cima una scheda
sua, separata, con **solo mese e quota**: i mesi passati con il loro
importo, il mese in corso come «Maturato al 28 ottobre 2026: …» (cresce
con le iscrizioni), **nessun mese futuro**. Chi la prende vede quanto le
spetta, non da quante iscrizioni né su quale pattuito. L'**analisi**
(iscrizioni, pattuito, totale, calcolata sui valori scritti nei campi,
anche prima di salvare) sta dentro Setting → Quota coordinatore. Il calcolo è
`quotaCoordinatorePerMese`, vivo (non congelato), e **non è un costo
della classe**. Impostato il 28/10/2026: Elena, 0,5%, corsi dal
01/10/2026. Prove in `prove/quota-coordinatore.test.jsx`.

### La cassa contanti si legge un mese alla volta (28/10/2026)

Deciso dal titolare: chi usa la cassa non deve leggere «quanto è entrato
e uscito in tutto». La sezione «Come si compone» — buste, vendite,
versamenti, prelievi e spese sommati dall'apertura in poi — è sostituita
da **«Il mese»**: frecce per scegliere il mese (dall'apertura a oggi), il
**riporto dal mese precedente** (o il saldo all'apertura nel primo mese),
i parziali di quel mese e il **saldo a fine mese**. Lo storico mostra solo
i movimenti del mese scelto. Il **saldo in cassa** in cima resta: è il
cassetto, e chi preleva deve saperlo. Ogni flusso ha la sua data: le buste
quella del rientro, le vendite quella dell'ordine, le spese quella del
pagamento. Prove in `prove/cassa-contanti-per-mese.test.jsx`.

### L'alloggio provvisorio in Operativo corsi (28/10/2026)

Da «Gestisci» della colonna Hotel, anche su un corso già stabilito, la
scheda ha due strade come la creazione corso: **Registrato** (la tendina
degli hotel) e **Provvisorio / occasionale**, una scheda completa — nome,
via e civico, città, telefono, chi chiedere, tariffe a notte cash e con
fattura, note. Salvando nasce una riga di `hotel` marcata `solo_edizione`
(come fa `creaDataCorso`), la riga del corso la aggancia con `alloggio_id`,
e notti, pattuito e scadenze funzionano come per un hotel qualunque; le
tariffe scritte lì valgono anche per quel soggiorno. Se la riga del corso
non si scrive, l'hotel appena nato si cancella. Il primo giro di
stamattina era un testo libero (`alloggio_provvisorio`): il titolare ha
chiesto «tutti i dati come nella creazione corso», e le due colonne sono
state tolte prima di qualunque uso. Prove in
`prove/alloggio-occasionale-da-gestisci.test.jsx`.

### Il POS si apre anche a un'assistente (28/10/2026)

Martina Tora, assistente, premeva la tessera POS in Home e vedeva «una
sfilza di errori e zero apertura». Dal 15/10 il POS leggeva
`corsiDateDocentiPos` — le assegnazioni per capire di quali classi è
assistente chi vende — **350 righe prima di dichiararlo**: `Cannot access
before initialization`. Solo il ramo dell'assistente lo legge, per le
master non si vedeva, e la build non se ne accorge perché è un ordine di
righe. Il giro delle sezioni non lo prendeva: il suo profilo «assistente»
non aveva `assistenteId`, quindi entrava come utente generico. Ora la
dichiarazione sta prima dell'uso e `prove/pos-si-apre-per-assistente.test.jsx`
monta l'app con un'assistente vera e preme la tessera. Nei log questo guasto
**non lascia traccia**: muore nel telefono prima di qualunque richiesta.
L'unica cosa che si vedeva era un 400 della Dashboard master (punti chiesti
con l'id «ass:»), corretto lo stesso giorno.

### Il cestino delle vendite (26/10/2026)

**Il 26/10 alle 11:18 tre vendite incassate di Elia Cito** (PMU Napoli,
8-9/10, contanti, 763,02 € in tutto) sono sparite da Vendite al banco con
il cestino: nessuna copia, e l'app non registrava chi aveva premuto (era
Stefano, detto dal titolare). L'unica
traccia era il magazzino, dove i pezzi erano rientrati con la nota
«Vendita cancellata». Deciso dal titolare: **una vendita non si cancella,
si mette nel cestino**, da cui si ripristina per sei mesi.

Com'è fatto: `vendita_cestina(id, chi)` copia la riga intera di
`vendite_shop` in **`vendite_cestino`** (con spedizione, righe preparate
e movimenti collegati, in jsonb) e cancella, nella stessa transazione;
`vendita_ripristina(id)` rimette tutto com'era. Lo stock resta affare
dell'app: lo rimette `eliminaVendita` prima di cestinare, e lo riscarica
`CestinoVendite` dopo il ripristino, con `muoviStock` e la nota
«ripristinata dal cestino». Il tasto **Cestino (N)** sta in cima a Vendite
al banco e Vendite shop. Un cron (`vendite-cestino-svuota`, 04:20) cancella
quello che ha più di sei mesi. Le tre vendite di Elia sono state
**ricostruite dai rientri di magazzino e messe nel cestino** con il motivo
scritto: i prezzi riga per riga sono ripartiti dal listino in proporzione
al totale, che è quello vero. Il titolare le ripristina se servono.

### Progetti: allegati e l'area «Progetti Ruh» (26/10/2026)

Ogni progetto ha in fondo alla scheda gli **allegati**: uno o più file
insieme (bozze, preventivi, grafiche), tabella `progetti_allegati`, secchio
**privato** `progetti-allegati`, aperti con link firmato di un'ora
(`src/progetti/AllegatiProgetto.jsx`). Stesse tre regole dei documenti
evento: il tasto è il campo file in una `label`, la finestra si apre nel
gesto, un file la cui riga non si scrive viene tolto. Un file che fallisce
non ferma gli altri: si dice quale.

**«Progetti Ruh»**, accanto a «Storico progetti», è la stessa pagina con un
filtro acceso: i soli progetti con Ruh fra gli incaricati (riconosciuta dal
nome, non dall'id). Lì si fa tutto come nell'area principale, e «Aggiungi
progetto» crea il progetto già assegnato a Ruh: nasce in una lista e si
vede in tutte e due, perché la lista è una.

### Chiedi ai dati (25/10/2026)

In cima a **Statistiche**, solo per programmatore e amministratore, una
barra dove si scrive una domanda in italiano — «i 10 prodotti più venduti
a maggio», «quale master vende di più», «ricavi da settembre a oggi»,
«quale spesa possiamo abbassare» — e si riceve la risposta coi numeri.
Sotto ogni risposta ci sono **I numeri** (le righe) e **Come l'ho
calcolato** (la query): chi legge controlla, e un conto che non si può
controllare non è un conto. Componente `src/statistiche/ChiediAiDati.jsx`.

**Il modello compone e commenta; i numeri li fa Postgres.** La edge
function `analisi-domanda` fa due passi: Claude (`claude-sonnet-5-5`,
chiave nel secret `ANTHROPIC_API_KEY`, mai in una `VITE_*`) traduce la
domanda in **una** SELECT sulle sei viste `analisi_*` (vendite, righe,
iscrizioni, incassi, spese, edizioni — catalogo in
`_shared/analisi.js`); la SELECT passa da `controllaSql` e poi da
`analisi_esegui`, una `security definer` eseguibile **solo da
`service_role`** che accetta solo quelle viste, una sola istruzione,
niente scritture, 8 secondi, 300 righe; se Postgres rifiuta, l'errore
torna al modello che riprova una volta. Poi il modello scrive la
risposta **dalle righe restituite**, con l'ordine di non inventare
cifre. Le viste **non contengono dati degli allievi**: nomi, residenze,
email non arrivano al modello (artt. 5 e 22 GDPR: aggregati, nessuna
decisione automatizzata). Ogni domanda lascia una riga in
`analisi_domande` (domanda, query, quante righe, token): niente righe.

**Si vende il pacco, non i pezzi dentro (25/10/2026, sera).** Quando il
sito vende un kit scrive la riga del kit col prezzo **e** una riga per ogni
pezzo contenuto, a 0 €: la pelle da 3 diventa «3 pz» più «1pz» ×6 a zero,
un kit di pigmenti diventa il kit più i tre pigmenti a zero. L'assistente
dava «Pelle sintetica 1pz, 26 pezzi» come più venduto di settembre: era
il componente, e il titolare ha chiesto come avrebbe mai saputo se
l'offerta da tre funziona. La vista `analisi_vendite_righe` ora esclude i
prodotti con `conta_incassi = false` e **ogni riga a 0 € in un ordine che
contiene un pacco** (se non è lei il pacco). Le righe a 0 € in ordini
senza pacco restano: sono omaggi e sconti al 100%, e la pagina Analisi
dell'app li conta come pezzi usciti. È una regola nella vista, non nel
prompt: una regola che il modello deve ricordare non è una regola.

**`verify_jwt` non basta.** Al primo giro la funzione ha risposto alla
sola chiave pubblicabile del bundle, che è un JWT valido (`anon`). Ora
chiede `auth.getUser` sul gettone ricevuto: senza una sessione, 401.
Il ruolo resta deciso dalla pagina, finché l'account è uno per tutti.
Le prove in `prove/analisi-sql.test.js` e `prove/chiedi-ai-dati.test.jsx`.

### Dettaglio vendite di un evento (22/10/2026)

Accanto al **Conto** — che dice se la fiera è andata in pari, in
imponibile — c'è **Dettaglio vendite**, che dice cosa è passato dal
banco: incassato, scontrino medio, come hanno pagato, la classifica dei
più venduti e ogni scontrino con le sue righe (si aprono premendo).
Vale anche per le fiere passate, che hanno già la loro linguetta
nell'elenco.

Qui si ragiona in **euro incassati**, non in imponibile: la domanda è
«quanto è entrato in cassa». Tre regole dentro `prodottiPiuVenduti` e
`totaliVendite`:

- **si raggruppa per `prodotto_id`, mai per nome** — sulla riga c'è il
  nome del giorno della vendita, e per nome un prodotto rinominato
  diventa due righe che sembrano due prodotti. Il nome da mostrare si
  rilegge dall'anagrafica; quello della riga resta come ripiego per i
  pezzi venduti a mano, che un id non ce l'hanno;
- **gli omaggi non sono incasso ma sono pezzi usciti**, contati in una
  colonna loro: in fiera si regala, e contarli come venduti gonfia il
  ricavo mentre non contarli fa sparire materiale;
- **lo scontrino medio sta accanto al totale**, perché distingue «tanta
  gente che compra poco» da «pochi che comprano tanto» — due fiere
  diverse da rifare in due modi diversi.

Le prove girano sulle **righe vere** della fiera di Tirana
(`prove/tirana-righe.json`, 13 scontrini, 798,18 €) e controllano che
la somma della classifica faccia **esattamente** il totale degli
scontrini: se non tornasse, i due riquadri direbbero due cose diverse
sulla stessa fiera.

### I documenti organizzativi degli eventi (22/10/2026)

Ogni evento ha la sua sezione **Documenti**: certificazioni, regolamento
della fiera, planimetrie, permessi, assicurazione — la roba che serve
averla sottomano il giorno che qualcuno la chiede in loco, e che fino a
oggi stava nelle chat di chi l'aveva ricevuta. Tabella
`eventi_documenti`, secchio **privato** `eventi-documenti`. Sono **schede chiuse**
come Stampe packaging: «Aggiungi documento» crea la scheda col titolo da
scrivere, e dentro si carica (o sostituisce) il file, si scrivono le note, si
elimina. Una riga può esistere senza file (`percorso` nullable).

**Privato, ed è il punto:** dei 22 secchi solo quattro lo sono. Si legge
con `createSignedUrl` (un'ora), come `moduli-iscrizione` — qui dentro
finiscono certificazioni aziendali e contratti di fiera, e «pubblico»
vuol dire che chi conosce l'indirizzo scarica, policy o non policy.

Tre cose imparate altrove e riapplicate qui: il tasto per caricare **è**
il campo file dentro una `label` (su iPhone un input aperto con
`.click()` funziona una volta sola); la finestra per aprire il documento
si apre **dentro il gesto**, vuota, e solo dopo si riempie; e se la riga
non si scrive il file caricato viene rimosso, invece di restare orfano.

Il controllo sul link firmato non si accontenta di una stringa piena: il
client incolla la propria base a quello che gli torna, e con una
risposta storta esce `.../storage/v1undefined` — una stringa vera e un
indirizzo che non esiste, che aperto sembra un documento rotto invece di
una risposta sbagliata. L'ha trovato il banco di prova.

### L'ordine sa se il link è stato pagato (23/10/2026)

La cliente di POS-1792423132290 aveva pagato col link alle 16:37 e il
dettaglio ordine proponeva ancora «Genera un link»: il pagamento stava
su `pagamenti_pos`, legato per `vendita_id`, e la scheda non lo guardava.
Ora `ModaleDettaglioOrdine` legge le richieste della vendita (per
`vendita_id` o per `pagamento_codice`): pagata → riquadro verde
**Pagamento ricevuto** con ora, importo e codice al posto del tasto; in
attesa e non scaduta → si rimostra *quel* link invece di generarne un
secondo. E `stripe-webhook` (v11) scrive `vendite_shop.pagamento_codice`
quando paga una richiesta con `vendita_id`, se la vendita non ne ha già
uno: da lì Fatture da emettere la toglie dalle «senza codice». Modal:
spazio in fondo da 96 a 170 px su telefono, perché col dock aperto le
ultime righe finivano sotto — ma **come elemento vuoto dopo la scheda,
non come padding**: Safari ignora il padding in fondo a un contenitore
flex che scorre, e i 96 px non erano mai esistiti sul telefono. Finché la
finestra è aperta il body è chiuso (`overflow: hidden`, rimesso com'era
alla chiusura) e l'overlay ha `overscroll-behavior: contain`: arrivati in
fondo il dito non scorre più la pagina dietro.

### Il documento si legge da solo (25/10/2026)

Gli allievi scrivono dati sbagliati; il documento che allegano dice il
vero. Appena la foto del **fronte** è pronta nel modulo, la pagina la
manda alla edge function **`leggi-documento`** (`--no-verify-jwt`, porta
= `token_modulo` di un'iscrizione non ancora tornata; secret
`ANTHROPIC_API_KEY`; modello `claude-haiku-5-5`), che restituisce i soli
dati anagrafici in JSON e li salva in `iscritti.documento_letto`
(`{fronte:{…}, retro:{…}}`, con modello, ora e token usati; **mai la
foto**). `src/iscrizione/documento.js` confronta letto e modulo
(maiuscole, accenti, province e formati di data non contano);
`LetturaDocumento.jsx` lo mostra all'allieva riga per riga — «Usa i dati
del documento» scrive solo nei campi che può toccare, quelli del venditore
si segnalano — e `DocumentoLetto` (App.jsx) lo mostra al venditore in
cima alla scheda e alla fotografia, con «N dati non tornano — da
verificare». **Niente decide niente** (art. 22): si può spedire anche con
differenze, e corregge una persona. Se il lettore è giù, il modulo si
manda lo stesso. L'informativa che lo copre è il Punto 9 (lettere d,
e, e-bis). Prove: `documento-confronto`, `lettura-documento`.

**Il ritaglio è facoltativo, e lo fa il lettore** (stesso giorno). Scelta
o scattata la foto, la si rimpicciolisce e comprime da sola (1600 px,
JPEG) e la lettura parte subito; il modello restituisce anche `riquadro`
(dov'è il documento, in frazioni) e `rotazione`, e la pagina ritaglia e
raddrizza da sola — la foto ritagliata porta `giaLetta` e non si rilegge.
Giudica anche la foto: `qualita` «illeggibile» (buio, sfocata, tagliata,
non è un documento) **ferma il modulo** e chiede di rifarla dicendo i
`problemi` — l'unico caso in cui la lettura ferma qualcosa; «scarsa»
avvisa e lascia andare. Al modello è detto di non indovinare: meglio
`null`. **Il tipo di documento si confronta per primo**: dichiarato
«Passaporto» e caricata una patente → contestazione in rosso («Hai
indicato…, ma la foto sembra una patente»), e «Usa i dati» corregge
`doc_tipo` con il valore di `TIPI_DOCUMENTO`; `tipoDocumentoCanonico`
riduce a un nome solo i modi in cui un tipo può essere scritto.

### La taglia della divisa la sceglie l'allieva (29/10/2026)

I venditori segnalavano che le allieve «non possono selezionare la
taglia» nel modulo. Due regole giuste messe insieme: la scheda
obbligava il venditore a scegliere una taglia prima di salvare, e
`modulo_campo_bloccato` blocca al primo invio ogni campo già pieno.
Risultato: una «M» tirata a indovinare per poter salvare, che l'allieva
trovava bloccata fra i «Dati organizzativi» in sola lettura. Ora
`taglia_divisa` è come `tipo_cliente`: **non si blocca mai** e
`modulo_salva` la riscrive con quello che manda lei (solo valori di
`TAGLIE`, in `src/iscrizione/campi-scheda.js`). Nel modulo ha il suo
riquadro «La tua divisa», tendina precompilata se il venditore aveva
scritto qualcosa; la scheda non la pretende più per salvare. **Ed è
obbligatoria per spedire** (deciso dal titolare lo stesso giorno): la
pagina la elenca in «Manca ancora» e `modulo_salva` rifiuta con
`senza_taglia` se non arriva né dalle risposte né dalla scheda.
Migrazione `20261029100000_taglia_la_sceglie_l_allieva.sql`, prova in
`prove/modulo-iscrizione.test.jsx`.

### Il materiale di un evento resta in magazzino (30/10/2026)

Terza versione della regola, e stavolta è una decisione del titolare,
testuale: «i prodotti impegnati negli eventi non devono essere scalati
nel magazzino, è come se si spostasse una parte del magazzino
all'evento; verranno scalati solo una volta venduti». Fino al 08/10 il
materiale restava in giacenza senza essere impegnato; dal 08/10 al 30/10
«Partito» scaricava e «Rimetti in magazzino» ricaricava. Da oggi:

- quello che è in elenco **resta in giacenza e non è impegnato in
  niente** (precisato dal titolare lo stesso giorno: «tutti lo possono
  vendere»): il banco, lo shop e la fiera lo vendono tutti dalla stessa
  giacenza. `impegniMagazzino` conta solo i carrelli sospesi. L'Advisor
  (`simulaScorte`) tiene le fiere in fila con le edizioni, ma come
  **informazione**: «ti avvisa quanto materiale ci vuole a fare l'evento
  e quanti prodotti servono per i corsi nel caso in cui i prodotti
  vengono portati via dal magazzino, ma nessun impegno». I dipendenti
  devono capire da lì se le quantità bastano per corsi ed evento;
- **scende solo quando qualcuno lo vende**: alla fiera col POS (tendina
  «Sei a un evento?»), o altrove. È la vendita che scarica, come sempre;
- **«Partito»** scrive `quantita_portata` dove non c'è già un numero a
  mano e **non muove niente**; «Rimetti in magazzino» non esiste più;
- al rientro **non si scrive un numero, si conta**: la riga dice
  «Venduti all'evento N (di cui M in omaggio), ne riporti in magazzino P»
  e chi apre lo scatolone **spunta** (`rientro_verificato_il`). Solo
  verifica sulle quantità. Se il POS ne ha registrati più dei partiti la
  riga lo dice in rosso. La chiusura dell'evento chiede la spunta su ogni
  riga partita (`problemiDiChiusura`), e il conto valorizza a costo
  quello che il POS ha registrato.

`quantita_scaricata`, `quantita_ricaricata`, `quantita_rientrata` restano
come **storico del periodo 08/10–30/10** e non si scrivono più; il
giorno del cambio nessuna riga le aveva diverse da zero (Catania 17
righe, Napoli 152), quindi niente da rimettere in pari. Migrazione
`20261030150000_materiale_evento_resta_in_magazzino.sql`, prove in
`prove/materiale-evento-resta-in-magazzino.test.jsx`.

### CRM Contatti: tutti quelli che hanno scritto, importati da Vetta (30/10/2026)

Vetta (il CRM commerciale, su base Twenty) aveva 23.847 persone: clienti,
scartati, da richiamare. Ora stanno in Genion, **una persona molte
richieste**: `crm_contatti` (23.757, i doppioni per email o telefono uniti)
e `crm_richieste` (23.847, una per record Vetta, con data, corsi, canale,
form, chi l'ha trattata e la qualifica di quel momento). Il contatto tiene
`corsi_interesse` come unione, `primo_contatto_il`/`ultimo_contatto_il`,
la qualifica e lo stato trattativa (`venduto` / `in_trattativa` /
`nessuna`, dalle opportunità), il luogo normalizzato sul comune ISTAT
accanto a quello scritto, il collegamento allo Storico allievi o a un
iscritto (`certo` / `dubbio` / `nessuno`, con la nota del perché) e i flag
`da_verificare` (nome vuoto, nome di attività, nome senza lettere, senza
email né telefono, omonimi non uniti) e `nome_nota` («solo il nome, senza
cognome»: informazione, non motivo di verifica, deciso dal titolare).

**Lo script** è `scripts/importa-vetta.mjs` (REST di Vetta con
`VETTA_API_KEY`; con una chiave `sb_secret_` di Supabase va messa solo in
`apikey`, mai in Authorization), con `scripts/vetta-normalizza.mjs` per
nomi, telefoni, comuni, corsi canonici. È idempotente per `vetta_id`. Le
826 opportunità che in Vetta non puntano a nessuna persona si agganciano
per nome solo se una persona sola porta quel nome con nome e cognome (un
nome solo basta solo se è già CLIENTI): 605 agganciate, 100 ambigue, 118
senza nessuno. Riepilogo e dubbi in `.importa-vetta/`, fuori da git.

**In Vetta non esiste un consenso al marketing** (verificato su tutti i
campi). Il titolare ha deciso: si scrive a tutti, il consenso è quello
raccolto sul sito, e ogni mail porta il link per disiscriversi. **Chi si
disiscrive resta in archivio** con `disiscritto_il` e `disiscritto_come`:
di default è fuori dalle liste (filtro «Disiscritti» per vederli), dalle
campagne è fuori sempre. Il blocco vale per email, così un re-import o una
richiesta nuova non lo riportano dentro.

**La pagina** è `src/crm/PaginaContatti.jsx`, tessera «Contatti» nel CRM.
Non carica la tabella: chiede una pagina da 50 a `crm_cerca_contatti`
(filtri in jsonb, totale vero) e i valori dei filtri a
`crm_filtri_valori`, entrambe `security invoker` per `authenticated`.
Periodo (anno o dal/al) e corso filtrano **sulle richieste**; regione,
provincia, comune, qualifica, stato, trattato da, mestiere, Genion sul
contatto. La scheda aperta legge le richieste e mostra la cronologia
(«03/2024 Microblading · 05/2025 Laminazione»), le opportunità e il tasto
per segnare un disiscritto a mano. Prove in `prove/crm-contatti.test.jsx`.
**La data della richiesta non è sempre vera.** 16.327 record su 23.847
sono nati in Vetta il 9 marzo 2026, il giorno del caricamento in blocco:
`crm_richieste.data_certa = false`. La pagina scrive «data non nota», il
filtro Anno ignora quelle date e guarda anche le vendite (2022–2026),
la spunta «Data non nota» isola chi non ha nessuna data vera.

**Componi mail** (`src/crm/ComponiMail.jsx`, stesso giorno). Dalla lista
filtrata nasce una `crm_campagne` (filtri, oggetto, HTML, stato bozza →
pronta → in_invio → inviata); l'editor è un `contentEditable` senza
librerie; l'anteprima usa `componiCampagna` di `_shared/email.js`, **la
stessa funzione del server**, con il piede fisso (chi siamo, perché
ricevi questa mail, link di disiscrizione). «Prepara i destinatari» è
`crm_campagna_prepara`: li congela in `crm_campagne_destinatari` (un
indirizzo una mail, mai disiscritti, mai da verificare, mai un indirizzo
già rimbalzato) e dice quanti restano fuori e perché. La lista e le
campagne usano la stessa `crm_contatti_filtrati`: due copie della WHERE
darebbero due conteggi diversi. L'invio è la edge function
`crm-campagna-invia`: cento mail a chiamata con l'API batch di Resend,
una a testa, con `List-Unsubscribe` e `List-Unsubscribe-Post` (il tasto
«Disiscriviti» di Gmail e Mail); la pagina richiama finché la coda è
vuota, e se si chiude a metà da «Campagne» si riprende. «Mandami una
prova» spedisce a un indirizzo solo con valori finti. Il webhook
`email-eventi` annota consegna, apertura, rimbalzo e segnalazione spam
sul destinatario; chi segnala spam viene disiscritto con il motivo.

**Chi ha aperto.** Su Resend il tracciamento di aperture e clic sul
dominio `elitederma.net` era spento: acceso il 30/10/2026 sera, deciso dal
titolare. Da lì il webhook segna «aperta» sul destinatario; nella campagna
il pannello «Destinatari, uno per uno» li elenca per stato (in coda,
spedita, consegnata, aperta, rimbalzata, segnalata, non riuscita) con
ricerca per nome, e la scheda del contatto mostra le mail di campagna
ricevute con lo stato. Va detto a chi legge: «aperta» è un'immagine
scaricata dal programma di posta, Mail di iPhone la scarica per tutti e
Gmail solo se mostra le immagini; è una tendenza, non una prova di lettura.
Il tracciamento dei clic riscrive i link facendoli passare da Resend.

**La disiscrizione** è `crm_disiscrivi(token)`, security definer
eseguibile da `anon`: scrive `disiscritto_il` su tutte le schede con
quell'email. Due ingressi: la rotta pubblica `?disiscrizione=<gettone>`
(`src/crm/PaginaDisiscrizione.jsx`, disiscrive appena si apre) e la edge
function pubblica `crm-disiscrivi` (POST = one-click dal programma di
posta, GET = rimanda alla pagina). Prove in `prove/crm-campagna.test.jsx`.

### La raccolta del materiale, a tutta pagina (30/10/2026)

In Logistica → Spedizioni corsi, in alto a destra nella scheda di
allestimento di un'edizione, c'è **«Prepara»**: apre a tutta pagina la
lista di **tutto** quello che serve a quell'edizione, prodotto per
prodotto, con le quantità già sommate («7 Aghi 1RL», «3 Dermografo
Horus»), perché chi prepara passa fra gli scaffali una volta sola prima
di comporre le scatole. La lista la compone `listaRaccoltaMateriale`
dalla stessa fotografia del pacco di `componiSpedizione`: le distinte
dei kit per iscritti e di riserva, i dermografi comprati a parte e di
riserva (quelli dentro un kit stanno già nella sua distinta), gli
accessori didattica, gli extra, la merce da vendere, le consulenze. Un
prodotto che arriva da più strade ha una riga sola e dice da dove.

Si spunta col dito o col mouse: la riga diventa verde e la spunta si
salva in `logistica_kit_edizioni.checklist` (chiave → chi e quando), così
si riprende da dove si era e un altro turno vede cosa è già stato preso.
L'ordine delle righe non cambia mentre si spunta. È una lista di
raccolta, non un movimento: il magazzino scende come prima, a «Materiale
preparato». Prove in `prove/raccolta-materiale.test.jsx`.

### Il controllo di sicurezza del 31/10/2026, e cosa ha chiuso

Advisor di Supabase, policy, funzioni pubbliche e quattro revisioni del
codice (CRM, modulo pubblico, POS e logistica, contabilità ed eventi).
**Fatto, una correzione alla volta:**

- **Viste aperte agli anonimi.** `v_consensi_allievi` dava a chiunque
  avesse la chiave pubblicabile 273 righe con nome, cognome ed email;
  `v_prezzi_listini` costi e margini; `v_punti_master(_righe)` i punti di
  ogni master. Ora `security_invoker` e niente SELECT ad `anon`, anche
  sulle altre quattro viste del gruppo. Dall'esterno 401.
- **`recesso_registra` e `modulo_riaperto` solo `service_role`.** Il
  commento di `modulo-recesso` lo prometteva, ma sul database vivo `anon`
  aveva EXECUTE: con il gettone del recesso si scioglieva il contratto
  senza ricevuta né avvisi. **Lezione: i grant di default di Supabase su
  `public` danno EXECUTE ad `anon`; una funzione riservata va revocata
  esplicitamente, e la migrazione che lo dichiara non basta, va letto
  `pg_proc.proacl` sul database vivo.**
- **`modulo-ricevuto`: `prova` e `soloPdf` solo con sessione di staff.**
  Con il gettone del modulo la prova restituiva la mail intera, link di
  recesso compreso, cioè il gettone di un altro diritto.
- **`modulo_salva`**: i file devono stare nella cartella del gettone e non
  contenere `..` (prima si poteva indicare il documento di un'altra
  iscrizione); i documenti obbligatori si controllano anche sul server.
  **Il contratto firmato lo compone il server** (31/10/2026, richiesta del
  titolare): vedi il paragrafo qui sotto.
- La pagina del modulo chiudeva su **qualunque** `motivo` del rifiuto
  («Iscrizione già confermata» al posto del modulo, anche per una taglia
  mancante): ora chiudono solo `gia_inviato` e `confermato`.

- **Funzioni di servizio chiuse agli anonimi** (31/10/2026, migrazione
  `20261031150000`). Lette le definizioni: `recupera_vendite_qr_in_ritardo`
  e `riprova_vendite_pos_in_attesa` *registravano vendite*,
  `controlla_saldi_magazzino` scriveva saldi, `fic_avvia_sync` e
  `sincronizza_*` chiamavano le edge function con la chiave di servizio del
  vault. Le usa solo pg_cron (come postgres): revocate a `public`, `anon` e
  `authenticated`. `registra_vendita_pos`, `registra_vendita_da_pagamento`,
  `apri_confezione`, `aggiorna_quote_coordinatore`, `identita_da_accesso`:
  via `anon`, restano a `authenticated` (le usa l'app).

- **Upload anonimi con un tetto** (31/10/2026, migrazione `20261031160000`).
  `consensi-documenti` non aveva limiti: ora 5 MB e solo immagini, e un
  anonimo scrive solo in `<uuid>/(fronte|retro|firma).(jpg|png|webp)`.
  `moduli-iscrizione` aveva peso e tipi ma non il percorso: ora l'anonimo
  scrive solo in `<gettone>/<nome>-<n>.<est>` di un modulo **non ancora
  tornato** (`modulo_cartella_valida`, security definer). Lo staff resta
  libero (carica anche in `_azienda/` e i PDF). Provato in transazione
  annullata: gettone falso, `..` e nomi storti rifiutati; i percorsi veri passano.

- **`leggi-documento` ha un tetto** (31/10/2026): 8 tentativi all'ora e 25 in
  tutto per modulo, contati prima di chiamare il modello (chiave `limite` in
  `iscritti.documento_letto`); oltre, 429 e il modulo si invia comunque.
- **`modulo_vista` serve solo le chiavi di un elenco** (31/10/2026, migrazione
  `20261031170000`). Leggeva da `iscritti` la colonna nominata da ogni riga di
  `modulo_iscrizione_campi`: da Setting si poteva accendere `quota_venditore`,
  `quota_speciale`, `accordi_commerciali` o `note` e finivano nel JSON
  dell'allieva. Ora quelle quattro (e qualunque chiave fuori elenco) si
  saltano anche se la riga e' accesa. **Una chiave nuova del modulo va
  aggiunta all'elenco `consentiti` della funzione**, altrimenti non compare.
  Impronta del risultato su 273 moduli identica prima e dopo.

**Ancora aperto**, in ordine: lo stock dal browser (scarichi a metà e non
atomici), vendite annullate ancora contate in busta/cassa/eventi, quota
venditore dopo «Disponi pagamenti», campagne (doppi invii, rifiuti
temporanei), 18 secchi pubblici.

### Il testo del contratto sta nel database, e il server lo congela (31/10/2026)

`modulo_iscrizione_testi` era vuota: regolamento, caselle dei consensi e
intestazione vivevano solo nel codice (`src/iscrizione/contenuto.js`) e
`modulo_salva` archiviava come «contratto firmato» il testo che mandava il
browser, quindi con un gettone si poteva far registrare un regolamento
alterato. Ora le tre righe (`intro`, `regolamento`, `consensi`) sono nel
database, **identiche al codice parola per parola** (impronte md5 dei
valori uguali nei due posti, verificate), e `modulo_salva` compone
`iscritti.contratto_firmato` da lì: dal browser prende solo l'elenco delle
caselle che l'allieva ha visto (l'avvio immediato compare solo a ridosso
del corso). Il contratto salvato dice `origine: 'server'` e
`uguale_a_quello_mostrato`, che è falso se il testo è stato corretto o
alterato mentre lei compilava. Se una riga mancasse si ricade sul testo
del client (`origine: 'client'`): meglio un modulo firmato che bloccato.

**Resta modificabile da app a piacimento**, come prima: Setting → Modulo
di iscrizione → Il contratto scrive in quella tabella e il prossimo modulo
firmato congela il testo nuovo; chi ha già firmato tiene il suo (`coalesce`).
Ogni correzione archivia da sola la versione precedente in
`modulo_iscrizione_testi_archivio` (trigger `modulo_testi_archivia`). **«Rimetti
com'era» non cancella più la riga: la riscrive con il testo di partenza**,
altrimenti il server non avrebbe l'originale. Le righe con `aggiornato_da`
che inizia per «testo di partenza» si leggono come «mai corretto». Il codice
resta come rete per far vedere la pagina se la query fallisce, ma non è più
quello che si firma. Prove in `prove/testi-contratto.test.js`.

### Il cash rinviato segue il Riepilogo (30/10/2026)

Udine, LAMINAZIONE BASE del 28/10: lo Scadenzario passivo mostrava per
Angelica Burelli **300 € a bonifico più 150 € «Costo Master»**, e nessuno
sapeva da dove venissero i 150. Erano un **impegno** scritto da «Disponi
pagamenti» alle 9:27 di quel giorno, quando il compenso era ancora diviso
a metà di default (150 bonifico, 150 cash) e la busta non copriva il
cash; poi il bonifico è stato portato a 300 e il cash a 0, ma l'impegno
è rimasto aperto con la cifra del giorno del rinvio. E il Riepilogo non
lo mostrava fra gli «Impegni senza riga» perché l'impegno teneva viva
la propria chiave (`cashRinviato`).

Due correzioni, nessuna cancellazione automatica (un impegno è un debito
scritto: sparire da solo è peggio che restare):

- `calcolaVociScadenziario` restituisce anche **`cashRicalcolati`**,
  quanto vale oggi la parte in contanti di ogni voce (anche per
  venditore). `vociCashRinviate` usa quella cifra finché l'impegno non è
  coperto nemmeno in parte: se oggi è zero la riga resta, **vale 0 €**,
  dice «non è più dovuto» e non si può pagare; se è cambiata lo dice.
- Nel Riepilogo della classe una riga con la quota in contanti a zero
  **non tiene più vivo il suo impegno**: compare fra «Impegni senza
  riga», con il tasto per toglierlo.

Prove in `prove/cash-rinviato-segue-il-riepilogo.test.js`.

### Il modulo riaperto si ricompila (24/10/2026)

Riaperto il modulo, l'allieva non riusciva a correggere la data di
nascita: `modulo_vista` marcava **bloccato** ogni campo già pieno in
scheda e `modulo_salva` non riscriveva un campo già pieno — due regole
giuste al *primo* invio (proteggono quello che ha scritto il venditore),
ma dopo il primo invio la scheda è piena di quello che ha scritto **lei**.
Ora `modulo_riaperto(iscritto)` (riga in `moduli_riaperture` e modulo non
ancora tornato) sblocca i campi dell'allieva, precompilati, e `modulo_salva`
sovrascrive con quello che manda; i campi del corso restano fissi. La
pagina lo dice in testa («Il modulo è stato riaperto…»). Verificato sul
link di Elena Petrone: `riaperto = true`, data di nascita sbloccata.

### Modelle e note si cambiano a contratto firmato, e la firma si ricomincia (24/10/2026)

L'allieva firma senza modelle e due giorni dopo le vuole. La scheda
confermata è chiusa (prezzo e pacchetto si toccano solo col codice) e il
venditore vede la **fotografia** dell'iscrizione, non la scheda: ma
`richiede_modelle`, `numero_modelle`, `prezzo_speciale_modelle` e `note`
le deve poter cambiare da solo. `PannelloRifirma` (App.jsx) sta in fondo
alla fotografia del venditore e dentro la scheda in sola lettura, fuori
dai `fieldset disabled` (lì dentro un campo non si riaccende): scrive
**solo** quelle quattro colonne con un update mirato. Se il modulo era
già tornato firmato, chiede se riaprirlo — `modulo_riapri` archivia
firma, documenti, contratto, PDF e stato in `moduli_riaperture`, poi
azzera e riporta a `modulo_inviato` — e apre il dialogo di rinvio della
mail. **«Ricomincia procedura di firma» sta IN ALTO** (il titolare: «prima
entri, resetti, poi scrivi ovunque e rispedisci»), per chiunque e per
qualunque motivo (resta scritto). Dopo il reset lo stato torna a
`modulo_inviato` e **la scheda si riapre tutta, anche i dati in alto**:
dalla fotografia si passa alla scheda in modifica, e il venditore vede la
fotografia solo a modulo ricevuto o iscrizione confermata. La mail si
rimanda dopo, dalla fascia di stato, quando la scheda è a posto. Prove in
`prove/modelle-e-note-a-contratto-firmato.test.jsx`.

### La bolla di accompagnamento di un evento (27/10/2026)

Nella testata della scheda di un evento c'è **«Bolla di accompagnamento»**:
apre un pannello con partenza (la sede della società), destinazione (il
luogo dell'evento), vettore, causale, colli e aspetto, tutti correggibili;
«Genera la bolla» salva quei dati in `eventi.bolla` (jsonb, con numero
`DDT aaaa-mm-gg/XYZ` e date) e scarica il **PDF** fatto nel browser con
pdf-lib (`src/eventi/bolla.js`): mittente, destinatario, causale, vettore,
l'elenco dei materiali di `eventi_materiali` con quantità maggiore di
zero, colli e aspetto, tre firme. Alla ristampa il tasto diventa
«Ristampa la bolla», gli indirizzi tornano com'erano salvati e si possono
cambiare; il numero resta lo stesso. Si salva **prima** di generare: se il
PDF non uscisse, la ristampa trova comunque gli indirizzi. Prove in
`prove/bolla-evento.test.jsx` (il PDF viene generato davvero, in jsdom).

### Il civico sta dentro la via (23/10/2026)

Gli indirizzi letti dai moduli cartacei sono una riga sola («Via monte
pasubio 8a»): su **255 iscritti con una via, 244 non hanno il civico a
parte** e in 208 il numero sta in fondo alla via; 12 hanno la città
sporca («, BELLARIA-IGEA MARINA, RN, ITALIA»). Il banco il civico lo
pretende per spedire, quindi scegliendo l'allieva dall'elenco la
spedizione risultava «senza dati». `src/iscrizione/indirizzo-pezzi.js`
(`separaCivico`, `pulisciCitta`) lo stacca al volo quando la casella è
vuota; **l'archivio non è stato corretto** — è una scelta del titolare.

### Una vendita con carta vuole la prova del pagamento (23/10/2026)

Il 19/10 una master ha chiuso un carrello con «Carta» mentre il QR non
era mai nato (Stripe aveva rifiutato la richiesta). Il banco ha
**svuotato il carrello e scaricato il magazzino prima di scrivere**,
`registra_vendita_pos` ha rifiutato la riga per una colonna NOT NULL
nuova (`fattura_manuale`, aggiunta il 18/10), la vendita è finita nella
coda dei ritentativi, e alle 16:16 il ritentativo l'ha registrata e ha
creato l'ordine di spedizione: **117,13 € mai incassati, pacco partito
il giorno dopo** (POS-1792423132290, Lia Patania). Nessuno dei tre
pezzi chiedeva «ma i soldi sono arrivati?».

Da oggi lo chiede il **database**, che nessuna strada aggira: una
vendita `metodo_pagamento = 'pos'` si registra solo se porta un
`pagamento_codice` che in `pagamenti_pos` risulta **pagato**, oppure se
è marcata `terminale_fisico` — il POS esterno dell'amministrazione, che
il banco scrive solo quando chi amministra ha scelto «POS esterno».
Altrimenti `PAGAMENTO_NON_PROVATO`. Il ritentativo, davanti a quel
rifiuto, **si ferma** (`arreso`), scrive un avviso
`vendita_senza_pagamento` e lascia decidere una persona dall'Advisor.
Il banco non arriva nemmeno lì: con la carta e senza pagamento il tasto
«Incassa vendita» è spento, con scritto perché. E **il carrello salvato
non si toglie più prima che la vendita sia scritta**.

Contanti e buoni non cambiano: lì l'incasso lo constata chi sta al
banco.

**E la prova la scrive solo il server (23/10/2026, stesso giorno).** Il
guardiano leggeva `pagato_il` da una tabella scrivibile da chiunque abbia
la sessione dell'app (policy `to authenticated`, tutto permesso): nessun
tasto lo fa, ma dalla console del browser si poteva scrivere «pagato» su
una richiesta e il database ci avrebbe creduto. Ora un trigger su
`pagamenti_pos` (`pagamenti_pos_solo_il_server_dice_pagato`) lascia alla
sessione — anon o authenticated, secondo `auth.role()`, che resta tale
anche dentro una RPC security definer — solo `cliente`, `note_fattura`,
`vendita_id`, `aggiornato_il` e `stato` nel solo passo in_attesa →
annullato; niente insert, niente delete. `pagato_il`, `importo`,
`codice` e il resto li scrivono le edge function con la service role, le
migrazioni e il cron. E il guardiano ha imparato due cose: **un
pagamento vale per una vendita** (stesso codice su un altro numero
d'ordine → rifiutato) e **per quell'importo** (tolleranza un centesimo;
sulle 10 vendite col QR in archivio coincidono tutte). Provati tutti e
quindici i rami in una transazione annullata.

Restano dichiarazioni, non prove: **contanti**, **buono Amazon** e **POS
esterno** (solo chi amministra).

**Il buono Amazon si verifica in logistica (23/10/2026, deciso dal
titolare).** L'ordine pagato con buono arriva in Ordini in arrivo con il
tasto **«In attesa di verifica pagamento»**; chi lo preme dichiara di
aver controllato il buono, compare «Pagamento verificato da X il …», e
solo allora «Spedita» si accende. La verifica sta sulla **vendita**
(`vendite_shop.pagamento_verificato_il` / `_da`), non sul pacco: è il
pagamento che si verifica. La serratura è il trigger
`spedizioni_pos_spedito_vuole_pagamento_verificato`: senza verifica il
passaggio a `spedito` è rifiutato da qualunque pagina. Le quattro
spedizioni con buono già uscite restano com'erano. Prove in
`prove/buono-amazon-si-verifica-in-logistica.test.jsx`. L'omaggio è incasso zero dichiarato:
amministratori e chi ha «può fare omaggi» — oggi GianLuca Rocca,
Raffaele Villanno, Stefano Di Napoli. Il flag `terminale_fisico` il
database lo accetta da chiunque, perché con un account Supabase per
tutti nel JWT non c'è il ruolo: è l'altra faccia del punto «UN SOLO
ACCOUNT» del § 4.

### «Assegnazione kit»: senza pacchetto vuol dire senza pacchetto (22/10/2026)

Fino a oggi in quell'elenco finiva anche chi il pacchetto ce l'aveva, se
al pacchetto mancava il **modello di diploma**: il titolo diceva «senza
pacchetto», la scheda mostrava il pacchetto, e si salvava tre volte
cercando l'errore nel posto sbagliato (Gaetana Dicasola, «Kit Individuale
Soprac. + ike»). Deciso dal titolare: il diploma si carica prima del
corso, in Tipologie di kit, e non è un motivo per stare lì. Restano i
casi veri — nessun pacchetto, nome scritto ma non collegato, nome che
non è un pacchetto del corso, pacchetto collegato che non esiste più — e
la tessera in home conta con la stessa regola.

### «Assegnazione kit» è una casella come le altre (22/10/2026)

Era «provvisoria, senza permesso»: la tessera compariva a chiunque finché
qualcuno era senza pacchetto — quindi anche sulla home delle master, a
cui non spetta, e in Password Master non c'era nessuna casella per
toglierla. Ora `assegnazionekit` sta in `TASTI_HOME`: la vede chi
amministra (programmatore, amministratore) o chi ha la casella accesa, e
sempre solo finché c'è qualcuno senza pacchetto.

### Una master che vende è un flag, non una seconda riga (22/10/2026)

`master.e_venditore`, acceso da *Password Master* accanto a «Venditore
collegato». La master entra con la **sua** password e i **suoi**
permessi; il flag di suo le apre la Dashboard venditori, bloccata su di
lei; e compare fra i venditori — tendina tutor, Dashboard venditori,
commissioni — **senza** comparire in Gestione venditori, che si occupa
solo della tabella.

**Com'è fatto, e dove non mettere le mani:** in `Gestionale` lo stato
della tabella si chiama `venditoriTabella`; `venditori` — il nome che
quasi trecento punti leggono — è un `useMemo` che somma la tabella e le
master flaggate, presentate come venditori con il loro id di master
(`da_master: true`). Niente doppioni: chi ha già una riga in `venditori`
(per `venditore_id` o per nome) resta quella riga, che è la sua storia.
Nel Gate: `e_venditore` senza riga collegata → `venditoreId = master.id`.

**Le dieci che stanno in tutte e due le liste non si toccano**, per
scelta del titolare: Andrea Paura, Angelica Burelli, Elia Cito, Giulia
Tamasi, Marianna Silvestri, Martina Mei, Maurè Acosta, Patrizia Savi,
Stefania Sanna, Tommaso Giumbini. Il «venditore collegato» e
l'allineamento delle password restano per loro. Nessuna vendita o
incasso punta a quelle righe per id; i legami sono per nome
(`iscritti.tutor`, acconti) — e Andrea in `tutor` è «ANDREA», come
master «ANDREA PAURA».

### La capienza della sede segnala, non chiude (21/10/2026)

`postiMaxEffettivi(cd, corso)` torna `cd.posti_max ?? corso.posti_max` e **non
prende più la sede**: il parametro è sparito dalla firma, così nessuno può
rimettercela per sbaglio. Teneva il *minore* fra i due con un `Math.min`, e la
sede chiudeva l'iscrizione per conto suo — LAMINAZIONE BASE a UDINE era
«Completo» con **due iscritti su un corso da dieci**, e non si riapriva nemmeno
alzando i posti dell'edizione. In `location` ci sono **sedi doppie per la
stessa città con capienze diverse** (ROMA 4 e 12, MILANO 3 e 12, NAPOLI 2 e 10,
UDINE 2 e 10): una classe attaccata al gemello piccolo si chiudeva da sola.
L'aula piena la dice `avvisoSedePiena`, come avviso, nella scheda della classe.
Le righe doppie **non sono state unite**: va deciso quali tenere.

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

**Pubblicare pianta le schede rimaste aperte (22/10/2026).** L'app è divisa in
pezzi caricati a richiesta, e ognuno ha il nome col codice del contenuto
(`index-BxhQZihE.js`): a ogni pubblicazione quel codice cambia e il file di
prima **sparisce dal server** — verificato, un nome della build precedente
risponde 404. Una scheda aperta tiene il file d'avvio vecchio, chiede un pezzo
che non c'è più, e resta sulla scritta di attesa per sempre. È il caso peggiore
per l'app intera, perché `Accesso.jsx` carica `App.jsx` proprio così: un file
d'avvio vecchio non apre più niente. `src/pezzo.js` sostituisce `lazy` in tutti
e 16 i punti e trasforma il fallimento in una ricarica (una ogni 30 secondi, e
l'errore si rilancia sempre).

**Per la diagnosi:** davanti a «non funziona niente» in una pagina, prima di
cercare nel codice chiedere **da quanto la scheda è aperta** e far provare un
ricarico forzato. Montare la pagina in jsdom serve a escluderla, ma non vede
questo guasto: vive nel browser di chi guarda.

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

**Le prove (dal 18/10/2026).** Stanno in `prove/`, 43 file e 368 controlli. Montano i
componenti **veri** in jsdom e li toccano — premono il tasto del regolamento,
scrivono un codice fiscale corto, cliccano «Emetti la fattura» e guardano cosa
parte. Questo progetto non si rompe in compilazione: si rompe al montaggio e al
clic. Nessuna prova parla col database: `prove/preparazione.js` sostituisce
`fetch` prima di ognuna.

Non aggiungere altri strumenti di iniziativa (formattatori, librerie di
componenti, framework di stili): su un file da 84.000 righe un riformattone
cancella la storia di `git blame`, che è l'unico modo per capire perché un
calcolo è scritto così.

**Il banco visivo (23/10/2026): quello che jsdom non vede.** Le prove in
`prove/` montano i componenti ma **non fanno il layout**: «la scheda
sborda a destra di 46 px» o «il padding in fondo Safari lo ignora» non
li prende nessuna di loro, e il 23/10 il titolare ha fatto da tester per
quattro pubblicazioni di fila. `prove/banco/` monta la **Modal vera** in
un browser vero (Chromium headless, iPhone da 390 px) e la misura:
larghezza della scheda, scorrimento orizzontale, spazio sotto l'ultima
riga, pagina sotto bloccata. Si lancia a mano,
`PLAYWRIGHT_DIR=<cartella> sh prove/banco/finestra.sh`, e Playwright
**non sta nel progetto**: vive in una cartella a parte (istruzioni in
testa allo script), così `package.json` resta a 6 dipendenze. Prima di
toccare Modal, overlay, dock o qualunque cosa che si vede solo sul
telefono: **lanciarlo prima, non dopo**. Sulla versione guasta ha
misurato 26 px di sbordo e 46 px di scorrimento laterale; su quella
corretta 20 px di margine per lato, zero orizzontale, 170 px in fondo.

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
