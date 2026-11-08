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
| Storage | 22 bucket Supabase, dieci privati (`moduli-iscrizione`, `consensi-documenti`, `slide-corsi`, `eventi-documenti`, `progetti-allegati`, `allegati-iscritti`, `master-documenti`, `venditori-documenti`, `leve-assistenti-documenti`, `spese-allegati`) |
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
  | `?biglietti=` | **tolta il 31/10/2026** |
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
chiunque abbia fatto accesso, tranne il profilo kiosk. **Dal 3/11/2026
risponde anche su come funziona l'app e sui dati delle aree che quella
persona vede**: vedi «L'assistente risponde anche sull'app e sui dati»
più avanti. La edge function
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

- **Campagne CRM: quattro difetti chiusi** (31/10/2026, migrazione
  `20261031180000`, funzioni `crm-campagna-invia` ed `email-eventi`
  ripubblicate). (1) **Doppi invii**: il lotto si prende con
  `crm_campagna_prendi_lotto` (`for update skip locked`, righe in
  `in_spedizione`; quelle ferme da 15 minuti tornano in coda) e il batch
  porta una `Idempotency-Key` di Resend; la pagina aspetta se un'altra
  chiamata sta spedendo (`attesa`). (2) **429 e 5xx di Resend non segnano
  piu' `fallita`**: le righe tornano in coda, la funzione risponde
  `temporaneo` con `riprova_tra` e la pagina riprova (cinque volte di fila,
  poi si ferma e si riprende da Campagne). Solo i rifiuti definitivi (4xx)
  segnano `fallita`. (3) **Riattiva/Disiscrivi dallo staff agiscono per
  email** (`crm_disiscrizione_staff`), come la disiscrizione dal link, e
  riattivare chi si era disiscritto da solo chiede una conferma che lo dice.
  (4) **La pagina `?disiscrizione=` non disiscrive piu' all'apertura**:
  serve il tasto «Sì, disiscrivimi», perche' antivirus e programmi di posta
  aprono i link da soli; il tasto «Disiscriviti» di Gmail/Mail (POST a
  `crm-disiscrivi`) non cambia. Inoltre `email-eventi` fa avanzare lo stato
  di un destinatario solo in avanti (inviata < consegnata < aperta <
  rimbalzata < segnalata): un avviso in ritardo non lo riporta indietro.

- **Lo stock si muove nel database, tutto o niente** (31/10/2026, migrazioni
  `20261031190000` e `20261031200000`). `stock_muovi(righe, origine, nota,
  riferimento, utente)` blocca i prodotti in ordine di id, rifiuta l'INTERO
  blocco se uno solo scenderebbe sotto zero (nessuna scrittura), applica
  `quantita + delta` nel database e scrive i movimenti nella stessa
  transazione (nota e riferimento possono stare anche sulla singola riga).
  `muoviStockInBlocco` (in `stock.js`) la chiama e riallinea WooCommerce
  DOPO il commit (prima si scriveva sul sito e poi nel database: deciso dal
  titolare che fa fede l'app); `muoviStock` e' il caso di un prodotto solo.
  Convertiti a un blocco: cancellazione vendita (se poi `vendita_cestina`
  fallisce i pezzi si ritolgono), ripristino dal cestino (il magazzino prima,
  la vendita poi; se la vendita non torna si rimette), scarico kit
  (rientri e scarichi insieme), rientro del kit, ripristino dichiarato dalla
  master, inventario di fine corso e suo annullo, rientro dei bundle. **Il
  database non ha il tetto della soglia di riordino**: quella resta un
  controllo dell'app (`preparaScarichi`). Prove in `prove/stock-in-blocco.test.js`
  e `prove/cestino-vendite.test.jsx`.

- **Resi, annullamenti e cambi si compensano** (31/10/2026). La riga
  negativa che li registra (`tipo_movimento` reso / annullamento / cambio)
  ora EREDITA dalla vendita originale corso, evento, metodo di pagamento e
  `richiede_fattura` (`datiEreditatiDallaVendita`). Prima restava senza, e
  busta, cassa, conto eventi e IVA continuavano a contare la vendita
  annullata. **Regola del titolare: i soldi di una busta gia' chiusa non si
  toccano e la contabilita' non si riapre.** Se l'originale sta gia' in una
  busta chiusa (`busta_numero` valorizzato, contanti, con corso) la riga
  negativa porta `busta_numero = FUORI_BUSTA` (0): non entra in nessuna busta
  ne' appendice e la Cassa contanti la conta come uscita («Resi e
  annullamenti rimborsati in contanti») nel giorno in cui si fa. Con la busta
  ancora aperta (o la vendita nell'appendice aperta) le due righe si
  compensano dentro la busta. Statisticamente, conto eventi, vendite del
  corso e IVA trimestrale la contano sempre. «Fatture da emettere» non
  prende resi e cambi e salta le vendite annullate; la prima nota mostra le
  righe negative. Il cambio conta come differenza. Non c'e' ancora nulla in
  produzione: oggi nessun reso, annullo o cambio in archivio. Prove in
  `prove/storni-vendite.test.js` e `prove/cassa-contanti-per-mese.test.jsx`.

- **Quota venditore nello Scadenzario passivo: una voce per persona**
  (31/10/2026). La parte a bonifico non e' piu' una voce di classe («Quota
  venditore — Katia, Gina») ma una per venditore, «Quota venditore — Katia»,
  con la sua cifra e la chiave `venditore_<classe>_<NOME>`; una spesa
  salvata con la vecchia chiave `venditore_<classe>` vale per tutti (in
  archivio non ce n'era nessuna). **Decisione del titolare sul resto:** la
  quota venditore non cambia dopo «Disponi pagamenti», perche' la classe si
  chiude prima del corso e nessuna quota viene aggiunta o scende dopo —
  quindi il «pagato per classe» di Disponi (una spesa aggregata con i nomi
  nella nota) non e' un difetto da correggere. Prove in
  `prove/quota-venditore-nello-scadenziario.test.js`.

- **Allegati riservati: link a scadenza e secchi privati** (31/10/2026,
  migrazione `20261031210000`). `allegati-iscritti` (moduli cartacei,
  schermate di bonifici e acconti, biglietti di viaggio), `master-documenti`,
  `venditori-documenti` e `leve-assistenti-documenti` sono ora PRIVATI.
  `AllegatoLink` e `scaricaBytesStorage` non costruiscono piu' un indirizzo
  pubblico: `src/file/allegati.js` (`apriAllegato`, `urlAllegato`,
  `scaricaBytes`) chiede un link che vale un'ora e apre la finestra subito,
  nel gesto. Un secchio nuovo con dati riservati si aggiunge a
  `BUCKET_RISERVATI`. **La pagina pubblica dei biglietti
  (`?biglietti=corso/sede/data`) e' stata TOLTA**: il link era indovinabile
  (nome del corso, della sede e data) e restituiva i percorsi dei biglietti;
  le master li leggono dalla Dashboard (`biglietti_vista` revocata a tutti).
  **Restano pubblici**, perche' senza dati personali: shop-immagini,
  locandine-corsi, loghi-*, diploma-*, intestazione-societa, sfondi-app,
  stampe-packaging, master-foto, venditori-foto, leve-assistenti-foto.
  **Anche `spese-allegati`** (78 fatture dei fornitori) e' privato: le nuove
  spese salvano il percorso, le 66 righe vecchie tengono l'URL pubblico intero
  e `percorsoDaValore` lo legge lo stesso (dati non toccati). Prove in
  `prove/allegati-riservati.test.jsx`.

- **Punti minori chiusi** (01/11/2026, migrazione `20261101170000`).
  `search_path` fisso (`public, extensions, pg_temp`) sulle 13 funzioni che non
  lo avevano (`gettone_sicuro` usa `gen_random_bytes`, che sta in `extensions`);
  quattro indici doppi di `crm_contatti` tolti (restano quelli col nome nudo; la
  vecchia migrazione del 30/10 li ricreerebbe con `if not exists`, quindi non
  rieseguirla); revocato EXECUTE ad `anon` e `authenticated` sulle due funzioni
  trigger `movimenti_banca_spesa_cancellata` e `riapri_impegno_se_spesa_cancellata`.
  Le 12 policy doppie (tre tabelle del magazzino con «accesso interno» e
  «accesso staff» identiche) sono state fuse in una (`20261101180000`, rollback
  scritto nel file).
  **Restano, voluti o da decidere:** 128 chiavi esterne senza indice, `pg_net` in
  `public` (spostarlo puo' rompere i cron), password compromesse spente in Auth
  (impostazione del pannello Supabase).

**Ancora aperto**: nulla di questo elenco (restano i punti minori: `search_path` su 14 funzioni, indici su chiavi esterne, indici duplicati su `crm_contatti`).

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
esterno** — chi amministra e, dal 7/11/2026, chi sta al banco di una
fiera (vedi «Il POS fisico al banco»).

E una cosa da sapere per chi controlla: **`terminale_fisico` non si
salva**. `registra_vendita_pos` lo legge per decidere se accettare la
vendita e poi lo **toglie** dal corpo (`p_vendita - 'terminale_fisico'`);
in `vendite_shop` quella colonna non esiste. Quindi una vendita incassata
sul terminale si riconosce per assenza: `metodo_pagamento = 'pos'` e
`pagamento_codice` nullo — che è l'unico modo in cui una carta può stare
in archivio senza un pagamento provato.

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

### Gli ordini del sito si sono fermati, e adesso c'è un sorvegliante (2/11/2026)

Dall'**1/11/2026 alle 10:01 UTC** gli ordini dello shop non entravano più
in app, e non se n'è accorto nessuno per un giorno e mezzo. La catena, che
vale la pena leggere per intero perché ogni anello ha insegnato una cosa:

1. in `vendite_shop` è comparsa **una riga con `origine = 'woocommerce'` e
   nient'altro** — nessun numero d'ordine, nessuna data, `payload_raw`
   nullo, quindi non veniva dal sito. **Chi l'ha scritta non è accertato**;
2. il cursore della sincronizzazione cercava l'ultimo ordine con
   `order by data_ordine desc limit 1`, e **in Postgres il decrescente
   mette i NULL per primi**: «l'ultimo ordine» è diventato `null`;
3. senza cursore `woo-import-storico` chiedeva a WooCommerce **lo storico
   intero** (14 pagine, 1.300 ordini col loro JSON) più tutti i 57 ordini
   aperti in un colpo: usciva con **546 WORKER_RESOURCE_LIMIT**, uccisa a
   metà;
4. e il cron diceva `succeeded`, perché `net.http_post` è asincrona:
   spedisce la richiesta e non aspetta la risposta.

**Le difese, una per anello.** Il database rifiuta righe `woocommerce`
senza numero e senza data (`vendite_shop_woocommerce_vuole_numero_e_data`,
convalidato su 4.248 righe); il cursore salta comunque le righe senza
numero e senza data; senza cursore si guardano **30 giorni** e non tutto
lo storico (il passato lontano si chiede con `{"dopo": "..."}`); ogni
chiamata a WooCommerce ha **25 secondi** e il giro un budget di **110**;
gli ordini aperti si riallineano **quindici a caso per giro** invece di
tutti; quello che non riesce finisce in `sync_shop_esiti` invece di non
lasciare traccia; e il cron passa **da un'ora a un quarto d'ora**, così un
giro fallito costa quindici minuti. La riga vuota è stata cancellata con
la sua copia nel commento di `20261102190000`.

**Il sorvegliante (`sync-shop-vigilanza`), e perché sta fuori.** Un
controllo dentro la cosa controllata non vede il caso in cui la cosa
controllata muore: quel giorno la funzione non arrivava a scrivere il
proprio esito, e non sarebbe arrivata a mandare un avviso su se stessa.
Quindi un cron a parte (`vigila_sync_shop`, ai minuti 8/23/38/53) chiama
una edge function che guarda **il silenzio** da fuori — non «l'ultimo giro
è andato male», ma «da quanto non ne arriva uno riuscito». Si autentica col
gettone nato in Postgres, come il lavoro notturno delle email (gettone
sbagliato: 403, provato).

Manda **notifica push e mail**: guasto nuovo subito, guasto che dura di
nuovo ogni sei ore (un avviso ripetuto ogni quarto d'ora è un avviso che
si spegne), e un messaggio solo al rientro. La soglia — **70 minuti** senza
un giro riuscito, oppure **due giri falliti di fila** — e il testo
dell'avviso stanno in **`_shared/sync-vigilanza.js`**, condiviso fra il
browser e Deno come `email.js`: due copie vorrebbero dire riquadro verde e
telefono che squilla. Il semaforo in app diventa rosso al **primo** giro
fallito e la notifica aspetta il secondo, e non è un'incoerenza: davanti
alla pagina c'è una persona che può premere «Recupera ordini mancanti»
adesso.

Destinatari in **`sync_shop_vigilanza`** (una riga sola, si cambia da
Vendite shop): mail a `commerciale.elitederma@gmail.com`, notifica a chi
amministra, scelti dal titolare. I telefoni si nominano **per utente** e
non per endpoint, che cambia a ogni reinstallazione. **Oggi non
corrisponde nessun dispositivo**, perché l'iPhone di GianLuca Rocca ha la
riga delle push spenta (`attiva = false`): va riaccesa da Notifiche push,
e finché non lo è arriva solo la mail — la pagina lo scrive in rosso
invece di far credere il contrario. C'è «Mandami una prova» per verificare
la catena fino al telefono.

E la vigilanza scrive `ultimo_controllo_il` a ogni giro, anche quando non
avvisa, e l'app lo mostra: **un sorvegliante morto, senza, è
indistinguibile da tutto a posto** — che è lo stesso guasto, un piano più
in su. Prove in `prove/vigilanza-sync-shop.test.js`.

**Resta da capire**: a volte la sincronizzazione viene invocata **due
volte nello stesso minuto** (17:00, 18:00 e 16:01 del 2/11), a pochi
millisecondi di distanza. Il cron è uno e scatta una volta, quindi è un
rinvio del runtime: non duplica dati, perché l'importazione è idempotente,
è lavoro doppio.

### «Leggi tutto» al posto del tasto per comprare (2/11/2026)

Il titolare: «N2 Fixa è presente sul sito e ordinabile ma ai clienti
appare "Leggi di più" e tutti pensano che è esaurito e non lo comprano».

**«Leggi tutto» vuol dire una cosa sola**: WooCommerce non considera quel
prodotto acquistabile — niente prezzo, oppure esaurito, oppure un tipo che
non si compra direttamente (`grouped`). Il prezzo c'era, quindi era la
disponibilità.

Com'è andata. Il **31/10 alle 02:00** due ordini online hanno preso gli
ultimi due pezzi: giacenza a zero, «Leggi tutto», ed era giusto. Il **2/11
alle 18:02** una rettifica in Gestione magazzino ha rimesso 6 pezzi e
l'app li ha spinti sul sito. Alle **23:06** il cliente leggeva ancora
«Leggi tutto»: **il dato era giusto da cinque ore, la pagina no**. La
griglia di `/product-category/laminazione/` veniva da Breeze + Cloudflare,
che tengono una copia fino a 30 giorni.

**La regola che ne esce**: un giro mirato di `woo-riallinea-shop` (quello
che parte dopo ogni movimento di magazzino) svuotava **solo le pagine dei
prodotti toccati**. Giusto per un prezzo o per un numero che scende da 6 a
5; sbagliato quando un prodotto **attraversa lo zero**, perché lì cambiano
anche le **griglie** — shop, categorie, correlati, pagina iniziale — e a
quelle la pulizia mirata non arriva. Ora, prima di scrivere, un giro
mirato chiede al sito com'era (`stock_status`, `stock_quantity`) e se anche
un solo prodotto passa lo zero in un verso o nell'altro svuota tutto il
sito; se il sito non risponde svuota tutto lo stesso, che costa di più e
non sbaglia. Stessa regola in `woo-aggiorna-prodotto`, che per il «prima»
usa la giacenza che aveva in archivio.

**Era già successo, ed è la parte che insegna di più.** A settembre la
stessa pagina `/laminazione/` aveva lo stesso sintomo; la correzione di
allora — la PURGE regex su Varnish — è finita **solo nel ramo "svuota
tutto"** dello snippet `wordpress/elitederma-svuota-cache.php`, e il ramo
mirato è rimasto quello di prima. Una correzione messa su una sola delle
due strade che portano allo stesso posto non è una correzione.

Trovato strada facendo: **«Kit laminazione combo» era componibile (1
pezzo) e il sito lo dava esaurito** — rimesso in vendita dallo stesso
giro, che è anche la prova del ramo nuovo. Restano fuori, e **correttamente**:
`Mascara Kerafill Espositore 10pz` (ne servono 10, ce ne sono 7),
`Ring Lamp 14` e `Camice` (zero in app), e `T-Shirt EliteDerma`, che è
`grouped` — la vetrina delle taglie, non si compra da sé.

`ispeziona-prodotto` ora risponde anche con `acquistabile`, `stock_status`,
`stock_quantity`, `backorders`, tipo e stato: senza, perché un prodotto non
sia comprabile non si vede da fuori e si va a tentativi.

**E da qui in avanti: quello che un cliente può vedere svuota tutto**
(deciso dal titolare la sera stessa). Il salvataggio di un prodotto
(`woo-gestisci-prodotto`) svuotava tutto solo per stato e categorie, e per
prezzo, nome e foto si limitava alle pagine del prodotto — «quelli vivono
sulla scheda e sugli archivi, che il purge mirato copre già». Quella frase
era sbagliata, ed è costata un cliente che non comprava. Ora quel
salvataggio svuota sempre tutto, e `woo-aggiorna-prodotto` fa lo stesso
quando cambia il **prezzo** (che sta scritto sotto ogni riquadro delle
griglie) oltre che quando la disponibilità attraversa lo zero. Resta
mirata la sola quantità che non tocca lo zero: quel numero nelle griglie
non compare.

`woo-allinea-margini` **non** svuota, ed è voluto: scrive solo campi
nascosti (`_ed_margine_pct`, `_ed_cedibile_eur`, `_ed_blocco`) che servono
al calcolo delle fasce nel carrello, e nelle pagine in cache non si vede
niente di loro.

**Il conto di questa scelta, misurato il 2/11/2026**: una pagina di
categoria servita dalla cache impiega **0,11 s**, costruita da PHP **2,2 s**.
Svuotare tutto costa quei due secondi al primo visitatore di ogni pagina,
una volta sola. Mostrare un prezzo o una disponibilità falsi costa un
cliente. Non è uno scambio alla pari.

**Quello che resta, e non si risolve da qui**: su ogni pagina del sito
arriva `cache-control: s-maxage=2592000`, trenta giorni, perfino sul
carrello che WordPress dichiara `no-store` — la mette l'infrastruttura di
Cloudways, non WordPress, ed è il motivo per cui lo snippet
`elitederma-cache-breve-prodotti.php` (scritto apposta per accorciarla)
**non fa effetto**. Si corregge solo dal pannello Cloudways, a cui il
titolare **non ha accesso**: l'account è di chi ha montato il sito. Finché
è così, il sito vive di svuotamenti; e, cache a parte, un negozio il cui
server è in mano a un terzo è un rischio suo. La buona notizia del
2/11/2026 è che lo svuotamento **arriva fino a Cloudflare**
(`cloudflare_attivo: true`, `costanti_cdn: true`, passo `cloudflare:sì`):
la documentazione precedente diceva il contrario, e non è più vero.

### Il bilancio di una classe, kit compresi (2/11/2026)

In cima alla sezione **Costi** del riepilogo di una classe c'è **«Bilancio
del corso»**: ricavi, spese, guadagno e la pastiglia **ATTIVO / PASSIVO**.
Serve a sapere se una classe è in pari **prima** che tutti abbiano pagato —
il riquadro «Incassi» conta solo quello che è entrato, quindi fino alla
fine del corso ogni classe sembra in perdita.

- **Ricavi**: tutto il pattuito di ogni iscritta — acconto, pre corso,
  saldo, rate extra, modelle — **anche non incassato**, più altri incassi e
  vendite al corso. Al netto dell'IVA con gli imponibili **già scritti**
  sulle schede: non si scorpora niente di nuovo. Dove l'imponibile non c'è
  quella quota vale zero (oggi 25 acconti su 268), ed è la stessa
  convenzione del riquadro «Incassi», non una regola nuova.
- **Spese**: tutto quello che la classe costa, pagato o da pagare;
  compensi, quote e righe automatiche restano all'importo registrato.

**E i kit** (aggiunti il 2/11/2026, segnalati dal titolare): il materiale
consegnato all'allieva è merce comprata, ed è un costo del corso — ma non
ha una riga in `spese`, perché si è comprata prima, a magazzino. Senza, una
classe risultava più ricca di quanto fosse. Lo conta
`costoKitDellaClasse`, che per i pezzi chiama **`quantitaInviataPerProdotto`,
la stessa funzione di «Prodotti usati per i kit»** in Gestione magazzino:
due conti diversi sullo stesso materiale darebbero due numeri, e quello
sbagliato sarebbe sempre quello che si guarda. Si usa il **costo netto
d'acquisto**, e il riquadro dice quanto pesa.

**Un prodotto senza costo d'acquisto resta fuori dal totale e viene
nominato in rosso**, invece di valere zero: sommare zeri farebbe sembrare
la classe più redditizia di quello che è — lo stesso errore che «Costo dei
kit» aveva già imparato a non fare. Oggi riguarda tre prodotti: *Box
Anellini x i Kit 10 pz* (in 13 kit), *Aftercare post trattamento vit A+D
25pz* (12 kit), *Strisce colori* (2 kit).

Il numero è lo stesso aprendo la classe dal calendario o da «Prossime
contabilità»: i tre elenchi (`kitDefinizioni`, `corsiKitProdotti`,
`logisticaKitEdizioni`) arrivano al pannello da tutte e due le strade.
Prove in `prove/bilancio-del-corso.test.js`.

### L'assistente risponde anche sull'app e sui dati (3/11/2026)

Il titolare: «il tasto dell'intelligenza artificiale, oltre a rispondere
sui regolamenti, deve rispondere anche sulle funzionalita' e sui dati
dell'app, pero' solo limitatamente alle funzioni che ciascun utente
vede». I registri del tondo con il punto interrogativo diventano
**quattro**, e la risposta dice sempre quale sta usando (bordo e
etichetta): **dalle regole** (le schede di `regolamenti`, oro), **come
funziona l'app** (navy), **dai dati dell'app, adesso** (verde, con «I
numeri» e «Come l'ho calcolato» da aprire sotto), **un ragionamento**
(azzurro, e dichiara di non essere una regola).

**Sui dati non risponde a memoria**: usa il motore di «Chiedi ai dati» —
il modello scrive UNA select, Postgres la esegue, il modello scrive la
risposta dalle righe tornate. Quindi «che corso c'e' a novembre a Bari»,
«chi tiene il PMU di Milano», «quanti posti restano», «quanto costa il
kit laminazione», «cosa c'e' dentro il kit» hanno una risposta vera e
controllabile, non plausibile.

**Sei viste nuove** (`20261103100000`), nessuna con dati personali di
allievi: `analisi_calendario` (classi, master, assistenti, posti liberi,
sede: nessuna cifra di denaro), `analisi_corsi`, `analisi_kit`,
`analisi_kit_prodotti`, `analisi_prodotti` (prezzi e disponibilita'),
`analisi_prodotti_costi` (costi e margini, a parte). Due avvertenze sono
scritte **dentro il catalogo**, perche' sono i due punti su cui
l'assistente sbaglierebbe da solo: il **prezzo di un corso non esiste nei
dati** (sta nelle locandine di «Prezzi corsi» e, iscritta per iscritta,
nel pattuito), e su un **bundle** si guarda `disponibilita` e non
`giacenza` — altrimenti direbbe «esaurito» su tutti i kit dello shop, che
hanno giacenza zero e sono in vendita.

**Come si tiene il limite per persona.** Ogni area dichiara con quali
permessi della Home si apre (`AREE_DATI` in `_shared/analisi.js`,
`AREE_GUIDA` in `_shared/guida-app.js`): `permessi: []` vuol dire
«chiunque sia entrato» — il calendario e il catalogo dei corsi, che in app
li vede chiunque. La pagina manda i permessi, la edge function ricava
l'elenco delle viste ammesse e lo passa a **`analisi_esegui(p_sql,
p_viste)`**, che rifiuta qualunque altra vista anche se il modello la
nominasse. La firma a un argomento resta e delega a quella nuova: «Chiedi
ai dati» non cambia di una riga.

**Cos'e' e cos'non e' questo limite, detto con precisione**: decide COSA
L'ASSISTENTE MOSTRA, non cosa la sessione potrebbe leggere. Finche'
l'account Supabase e' uno per tutti i permessi li sa solo la pagina, e dal
browser le tabelle si leggono comunque (vedi «UN SOLO ACCOUNT SUPABASE PER
TUTTI» nel § 4): diventa una serratura il giorno che il ruolo passa dal
JWT. Quello che invece **e' una serratura gia' oggi** e' il motore: al
database arriva una sola SELECT su viste di sola lettura, 300 righe, 8
secondi, qualunque cosa chieda il modello.

**Nessun dato personale, ed e' una decisione, non una dimenticanza.** Non
ci sono nomi, email, telefoni o residenze di allieve, clienti o modelle.
Alla domanda «chi e' iscritta al corso di…» l'assistente risponde quante
sono e dove si leggono i nomi. Il motivo non e' solo il GDPR: domanda e
risposta passano da un modello di terze parti, e mandargli l'anagrafica di
un'allieva e' una decisione del titolare — da prendere, non da dare per
presa.

**La guida alle funzioni dice dove si fa una cosa, mai quanto costa.**
Nessuna cifra: ne' prezzi, ne' percentuali, ne' soglie. Le cifre vivono in
due posti soli, e in tutti e due le ha messe qualcuno che le ha decise: le
schede di «Regolamenti» e i dati. Una percentuale scritta nella guida
invecchierebbe senza che nessuno se ne accorga, e verrebbe creduta perche'
detta dall'app. Una prova del banco la impedisce (cerca `€`, `%`, «euro»,
«per cento» nella guida intera), e altre due controllano che ogni area
della guida sia un tasto vero della Home **e che nessun tasto resti senza
guida** — una chiave scritta male e' un'area che nessuno vedra' mai.

**Una domanda sui dati non e' una regola che manca.** La decisione di cosa
finisce fra «le domande senza risposta» in fondo a Regolamenti e' uscita
dalla edge function e sta in `_shared/assistente.js` (`senzaRisposta`),
dove il banco la prova: ci finisce solo una domanda **di regola** che
nessuna scheda copriva. Un dato, una spiegazione dell'app, una chiacchiera
e una disposizione che sta diventando scheda no — un elenco che si riempie
di roba che non c'entra nessuno lo guarda piu'.

Il registro delle domande (`regolamenti_domande`) tiene adesso anche
`registro`, `sql`, `righe` e `aree`: `aree` dice **cosa quella persona
poteva vedere** quando ha chiesto, non cosa ha chiesto.

### E lo stesso giorno è diventato un agente (3/11/2026, pomeriggio)

Il titolare, provandolo: «perché non ragiona come un modello Claude un po'
sveglio e deduttivo?». Aveva ragione, e **la colpa non era del modello**.

Il giro era «una domanda → UNA query → la risposta», e il difetto sta in
una riga: **un risultato vuoto non è un errore.** Se la query falliva
l'errore gli tornava indietro e correggeva; se tornava *vuota* doveva
rispondere da quel vuoto. Nessuna seconda mossa, nessun «strano, fammi
guardare quali kit esistono».

È successo davvero, e si legge nel registro delle domande: il 3/11 alle
**9:41** il modello aveva scritto **da solo la query giusta** sul costo
dei kit — kit, articoli, pezzi, somma dei costi, quanti senza costo — il
database ha risposto **zero righe**, e lui ha detto l'unica cosa che
poteva: «per PMU Base non ho trovato nessun kit». Il buco era in
`analisi_kit_prodotti`: il corso lo leggeva da `corsi_kit_prodotti.corso_id`,
valorizzato **solo sulle righe degli accessori**, mentre per il contenuto
dei kit sta sulla definizione del kit. Corso nullo su **957 righe su
1565**, e «il kit di PMU BASE» tornava 34 righe invece di 270.

**La lezione, che vale oltre questo caso:** quando l'assistente «non
ragiona», prima di riscrivere il prompt si guarda **la query che ha
scritto** e si esegue a mano. Qui la query era giusta.

**Com'è adesso.** Il modello ha uno strumento (`interroga_dati`) e lo può
usare fino a cinque volte: vede le righe e decide se bastano. Tre cose le
impone il codice, non il prompt:

- **zero righe tornano con l'avviso** «non concludere: guarda prima cosa
  esiste» (`esitoInterrogazione` in `_shared/assistente.js`) — è il passo
  che prima non poteva fare;
- l'errore torna scritto in italiano, così corregge la query;
- oltre cinque interrogazioni si chiude e si risponde con quello che si ha:
  un assistente che pensa per un minuto non serve a chi è al banco.

Più il **ragionamento esteso** (1.600 token: corto, perché la risposta
spesso si ascolta in piedi) e la **cache del prompt** — guida, catalogo e
schede sono identici a ogni domanda, e ripagarli ogni volta era tempo di
attesa e soldi.

Due regole del prompt nate dalle risposte vere: **deduci invece di
chiedere** («quanto costa il kit di PMU base, quello completo Elite» vuol
dire *KIT ELITE Completo* del corso *PMU BASE*: si va a cercarlo, non si
chiede quale kit intenda) e **i nomi li scrive chi vende, non chi
programma** (sempre `ilike`, su pezzi di parola).

**Il registro «dati» lo decide quello che ha fatto**, non quello che
dichiara di aver fatto (`registroFinale`): se ha interrogato, ha risposto
dai dati. «Come l'ho calcolato» mostra **tutti** i passi, anche quelli a
vuoto: è così che si vede dove ha cercato e cosa non ha trovato.

**«Quanto costa il kit X» ha una vista sua** (`analisi_kit_costi`), con lo
stesso conto di «Costo dei kit» in Gestione magazzino: un articolo senza
costo d'acquisto resta fuori dal totale, si conta e **si nomina**. Si
potrebbe comporre unendo due aree, ma sono due permessi diversi e il
conto andrebbe rifatto a ogni domanda.

### La voce parte dalla prima frase (3/11/2026)

Sempre il titolare: «è ancora lento nell'acquisizione dell'audio». Due
attese, entrambe tolte:

- **la lettura**: prima si mandava la risposta *intera* alla sintesi e si
  aspettava tutto l'audio prima di aprire bocca. Ora `spezzaPerVoce` la
  taglia in frasi — il primo pezzo corto di proposito — e mentre un pezzo
  suona si sta già scaricando il successivo. Il tempo prima della prima
  parola non dipende più dalla lunghezza della risposta. Se la sintesi
  esterna manca al primo pezzo si ripiega sulla voce del telefono; se si
  rompe a metà, il resto lo legge il telefono — meglio una voce diversa
  che una frase mangiata.
- **l'ascolto**: si aspettava che il browser dichiarasse la frase
  «definitiva», e su iPhone quel momento arriva quando vuole lui. Ora il
  riconoscimento resta aperto e **il silenzio lo misuriamo noi**: 900 ms
  senza parole nuove e la frase parte.

Resta una leva non tirata, ed è la più grossa: **la risposta in
streaming** dal server, per iniziare a parlare prima che il modello abbia
finito di scrivere. Vuol dire SSE dalla edge function fino al browser, ed
è un lavoro a parte.

Prove in `prove/assistente-sui-dati.test.js` (36).

### Il materiale dell'evento: la spunta a sinistra, e una casella in meno (3/11/2026)

In Gestione eventi → scheda dell'evento → **Materiali**, la spunta del
rientro (`rientro_verificato_il`) era in fondo alla riga, 16 px e
attaccata alla frase che dice quanti pezzi devono tornare. Chi gira fra
gli scaffali con lo scatolone in mano cerca **un quadrato da toccare**,
non una riga da leggere: ora è il primo elemento della riga, a sinistra
della foto, 40×40 di area premibile con la casella da 24, verde quando è
spuntata. La frase resta sotto, allineata alla foto: la spunta si tocca,
il conto si legge.

E le caselle numeriche sono **una sola**, «Da portare». «Partito» era il
posto per scrivere a mano una quantità uscita diversa da quella da
portare — mai usata, mentre il tasto «Partito» in cima fa la stessa cosa
per tutte le righe insieme. Il dato (`quantita_portata`) resta e lo
scrive quel tasto; **cambia che non si corregge più riga per riga**: se
dalla sede esce una quantità diversa, va corretto il «Da portare» prima
di premere Partito. Due frasi che mandavano a quella casella sono state
riscritte.

### La banca si interroga indietro nel tempo, guardando prima (3/11/2026)

Il titolare: «collegandoti al servizio che gestisce la connessione con la
banca, risali a tutti i bonifici a MT.DERM fino a oggi». Non si poteva: il
collegamento Lunch Flow è nato il **13/10/2026**, il primo giro ha preso
novanta giorni e `lunchflow-sync` sapeva chiedere solo «dall'ultimo
movimento meno cinque giorni» oppure «novanta giorni». Sotto il
**30/07/2026** l'estratto conto in app non esiste, e metà anno non aveva
dati su cui rispondere.

Ora la funzione accetta il periodo, e sa **guardare senza scrivere**:

```
{ dal: "2026-01-01" }                          lo chiede e lo importa
{ dal: "2026-01-01", prova: true }             lo chiede e NON scrive
{ dal: "...", prova: true, cerca: "mt.derm" }  e dice quali righe, col totale
```

La prova viene prima perché **la risposta non è garantita**: un consenso
PSD2 spesso si ferma a novanta giorni, quindi la prima cosa da sapere è
se la banca quella storia ce l'ha. In prova non si scrive niente — né
movimenti, né saldo, né l'ora dell'ultimo giro, nemmeno in caso di
errore. Il periodo lungo si chiede **un mese alla volta** e ogni mese
torna col suo conto: non sappiamo se l'aggregatore tronchi una risposta
troppo grande, e una risposta troncata in silenzio è peggio di un errore.

In Riconciliazione banca, accanto a «Aggiorna ora», c'è **«Risali nel
tempo»**: la data, un filtro facoltativo sulla controparte, «Guarda cosa
c'è». Il tasto che importa **compare solo dopo la risposta** e passa da
una conferma che dice cosa entra in prima nota — mesi di movimenti sono
una decisione, non l'effetto collaterale di una domanda.

**Pubblicata il 4/11/2026** (versione 15; fino a quel momento in
produzione c'era ancora quella del 13/10, che `prova` non la leggeva —
cioè il tasto «Guarda cosa c'è» avrebbe **scritto**. Una funzione non
pubblicata non è un ramo che non si usa: è un tasto che fa un'altra
cosa).

**E la domanda ha una risposta, misurata lo stesso giorno in prova.**
Verso MT.DERM è uscito **un solo bonifico: 2.175,00 €** il 24/09/2026
(più 1,00 € di commissione), «Invoices RO 5003, RO 5004», riconciliato
con la spesa «Acquisto pigmenti vecchia fattura»; e 94,50 € il
07/10/2026, ma via PayPal.

**Da gennaio a luglio non si può sapere, e adesso è un fatto e non
un'ipotesi**: interrogata mese per mese, la banca ha risposto **zero
righe** per tutti e sette i mesi, e 93/195/205/17 da agosto a novembre.
Il consenso PSD2 non arriva sotto **agosto 2026**. In app l'estratto
conto copre dal 01/07/2026 (645 righe dal file, 128 da Lunch Flow),
quindi tutto quello che la banca possiede è già dentro e non c'è niente
da importare. Per gennaio–giugno le strade sono fuori dall'app: il
portale della banca, o le fatture passive di MT.DERM su Fatture in
Cloud. Che qualcosa prima ci sia lo suggerisce il bonifico stesso, che
si chiama «vecchia fattura» e ne salda due insieme.

### Le statistiche di canale si filtrano per categoria (3/11/2026)

Chiesto dal titolare per **Statistiche Vendite al Banco** e **Statistiche
Vendite Shop Online** (`PaginaStatisticheVenditeCanale`, una pagina per
tutti e due i canali). La tendina sta accanto alla barra del periodo —
sono le due domande che si fanno insieme, «come è andata la laminazione a
ottobre» — e rispecchia l'albero dello shop, coi figli rientrati.

**La regola che decide i numeri:** una categoria non è una proprietà
dell'ordine, è una proprietà delle **righe** — in uno scontrino ci sono un
kit di laminazione e un pigmento. Quindi scegliendo un reparto non si
filtrano gli ordini continuando a sommarne il totale (sarebbe «il
fatturato degli ordini che contengono laminazione», un altro numero che
sembra lo stesso): si tengono **le sole righe di quel reparto**, e
incasso, pezzi e classifica sono quelli. La spedizione resta fuori,
«Vendite» conta gli ordini con almeno una riga dentro, e una riga che è
solo una parte dell'ordine lo dice («parte dell'ordine»). **Senza filtro
non cambia niente**: l'incasso resta il totale dell'ordine, com'era.

Le categorie si leggono **con i padri** (`collegamentiConPadri`): chi
sceglie un reparto si aspetta dentro le sue sottocategorie. La riga si
riporta al prodotto con `prodottoDellaRiga` e **mai per nome**. C'è anche
«Righe senza categoria (e non a catalogo)», che al banco è dove finiscono
gli acconti e i saldi dei corsi battuti a mano.

Le tre tabelle (`prodotti_shop`, `categorie_prodotti`,
`prodotti_categorie`) sono state aggiunte alle due viste nella mappa di
`App.jsx`: senza, la tendina sarebbe vuota e non lo direbbe nessuno.
Prove in `prove/statistiche-filtro-categoria.test.jsx`, che montano l'app
vera, navigano fino alle due pagine e controllano i numeri sotto filtro.

### Registrazione clienti, in Home per tutti (3/11/2026)

Chiesta dal titolare: una tessera in Home **visibile da tutti**, master
comprese, dove chi incontra un cliente lo registra. Due sezioni in una
pagina (`src/clienti/RegistrazioneClienti.jsx`): **Registra un cliente** e
**Clienti registrati**, l'elenco di tutti, con ricerca.

**Il permesso nasce acceso per tutti, e resta un permesso vero.**
`registrazioneclienti` è in `TASTI_HOME` — quindi ha la sua casella in
Gestione utenti, Password master, Password venditori e Password
assistenti — e la migrazione `20261103170000` l'ha scritta nei permessi di
**tutte le 53 righe** esistenti (7 utenti, 17 master, 21 venditori, 8
assistenti). Un utente creato domani la trova dentro da sé, perché il
tasto «Genera nuovo utente» ora parte da **`PERMESSI_DI_PARTENZA`** invece
che da una lista vuota: una tessera «di tutti» che non entra nei default
sarebbe «di tutti tranne chi arriva dopo», e nessuno se ne accorgerebbe.
Una tessera sempre visibile a prescindere dalla casella sarebbe stata più
breve da scrivere, ma la casella avrebbe mentito.

**Il luogo non si scrive, si scegli.** La città si cerca scrivendola — lo
stesso meccanismo del comune di nascita in Iscrizione allievi
(`cercaComuni` sull'elenco ISTAT che l'app si porta già dietro, nessuna
rete) — e scelta dal suggerimento riempie da sé **provincia, regione e
CAP**. Provincia e regione sono in sola lettura: una regione battuta a mano
diventa «Puglia», «puglia», «PUGLIA» e «Apulia», e l'elenco dei clienti
per regione non si fa più. Dove i CAP sono molti (Roma ne ha 82) resta la
tendina, perché quello non lo può sapere nessuno al posto di chi registra.
`CampoComune` ha preso un `onScegli` facoltativo che restituisce la
proposta intera — `{ nome, sigla }` — perché la sigla della provincia la
sa solo l'elenco; chi non lo passa non cambia comportamento.

**Il telefono è forzato col +39**: il prefisso sta fuori dalla casella e
non si tocca, e in archivio finisce sempre nella stessa forma
(`telefonoIta`: «347 123 4567», «+39 3471234567» e «0039 347-1234567»
diventano `+393471234567`; lo zero davanti a un cellulare si toglie). Un
numero estero oggi da qui non si registra: è una decisione da prendere,
non un campo da allargare di nascosto.

**Chi è «già registrato», che è la regola vera.** Parole del titolare: «in
caso di omonimia l'utente va considerato già registrato se tutto
corrisponde, anche la mail e il numero di telefono, perché se abbiamo un
utente con lo stesso nome ma numero di telefono e mail sono diversi, per
noi è un secondo utente». Quindi l'identità è **nome + cognome + email +
telefono**, e la città ne resta fuori di proposito: chi trasloca non
diventa un secondo cliente. Per questo email e telefono sono
**obbligatori** — sono loro a distinguere due omonimi, e senza di essi la
seconda persona con lo stesso nome verrebbe respinta come doppione.

La regola sta in un **indice unico** sulla tabella (normalizzato:
maiuscole indifferenti, spazi ripuliti, del telefono contano le sole
cifre), non nel browser. Il controllo che la pagina fa prima di salvare
serve a mostrare **quale** riga è già in archivio — «utente già
registrato» senza dire chi lascia il dubbio — ma due venditori che premono
Salva nello stesso istante li ferma solo il database, e il 23505 torna
come lo stesso messaggio. Provato in transazione annullata: la stessa
persona scritta in un altro modo rifiutata, l'omonimo con contatti diversi
accettato.

`chiaveIdentita` e l'indice **devono normalizzare allo stesso modo**, e
qui il banco di prova ha trovato un difetto vero: la chiave della pagina
confrontava le cifre grezze, quindi «333 111 2223» appena battuto e
«+393331112223» in archivio sembravano due persone — la pagina non vedeva
il doppione e lo fermava solo il database, dando il messaggio giusto per
il motivo sbagliato. Ora il telefono passa prima dal `+39`.

**La matita e il cestino** (stesso giorno, chiesti subito dopo). Ogni riga
dell'elenco ha due tastini da 44×44 a destra: **modifica** porta la riga
dentro lo stesso modulo — un modulo gemello vorrebbe dire due posti dove
cambiare una regola — e salvando **aggiorna quella scheda**, non ne crea
una nuova; **cancella** chiede conferma **col nome davanti** e la toglie.

Tre dettagli che sono il punto: la scheda in correzione è esclusa dal
controllo del doppione (`giaRegistrato(..., esclusoId)`), altrimenti si
rifiuterebbe da sola — «utente già registrato» sarebbe lei; il `+39` si
toglie dal valore che si vede, o rientrerebbe due volte; e **chi ha
registrato la riga non si riscrive**, è la storia di quella riga —
la correzione aggiunge `modificato_il` / `modificato_da` (migrazione
`20261103180000`) e l'elenco lo mostra accanto.

**E dal 4/11/2026 la cancellazione ha il suo cestino** (migrazione
`20261104110000`), chiesto dal titolare. Prima cancellava e basta — era
scritto nella pagina, «non si recupera», ed era la stessa forma del
guasto del 26/10 sulle vendite di Elia Cito: nessuna copia e nessun nome
di chi aveva premuto. Ora `cliente_cestina(id, chi)` copia la riga in
**`clienti_cestino`** e la cancella **nella stessa transazione**, e
`cliente_ripristina(id)` la rimette com'era; un cron alle 04:25 svuota
quello che ha più di sei mesi, come il cestino delle vendite alle 04:20.

Tre cose decise lì dentro, e ognuna per un motivo:

- **la copia è la riga intera in jsonb**, non colonna per colonna: il
  giorno che `clienti_registrati` prende una colonna nuova, una copia a
  colonne la perderebbe in silenzio, e un ripristino che restituisce una
  scheda incompleta è peggio di nessun ripristino. Accanto restano nome,
  cognome, email e telefono in chiaro, perché il cestino si deve poter
  leggere senza aprire il jsonb;
- **il ripristino può essere rifiutato, ed è giusto**: se nel frattempo
  la stessa persona è stata registrata di nuovo, l'indice unico
  sull'identità non lo lascia passare. La funzione traduce quel rifiuto
  in una frase che dice cosa fare, e la pagina mostra **quella** invece
  di una traduzione propria. Provato in transazione annullata: cestina,
  ripristina, ripristino rifiutato dopo una nuova registrazione, e
  cestinare una riga che non esiste;
- **la linguetta «Cestino (N)» compare solo se c'è qualcosa dentro**, e
  il conteggio si chiede sugli **id nel corpo** della risposta e non con
  `head: true`. Con `head` il numero arriva in un'intestazione HTTP
  (`Content-Range`): dove quella non c'è il numero resta sconosciuto e
  la linguetta non compare — cioè proprio quando il cestino è pieno.

La conferma col nome davanti resta: un cestino non è una scusa per far
cancellare le cose con leggerezza.

Prove in `prove/registrazione-clienti.test.jsx` (18): le regole una per
una, e la pagina montata per davvero — si scrive la città, si preme il
suggerimento, si controlla che provincia/regione/CAP si siano riempiti, si
salva, si rilegge il doppione, si cambia il telefono e la seconda persona
entra; poi la matita (la riga torna nel modulo, il telefono senza prefisso
doppio, l'update sull'id giusto) e il cestino, con la conferma annullata
che non cancella niente.

### «Stampe»: l'elenco dei corsi per chi deve solo stampare (3/11/2026)

Chiesta dal titolare per **Raffaele**: una tessera in Home con la lista
dei corsi **in ordine cronologico** e, accanto a ogni nome, **Diplomi** e
**Nomi**. Niente altro — non si entra nelle classi, non si modifica, non
si cancella, non c'è il calendario. È la stessa lista di Gestione corsi
con gli stessi filtri (corso, città, master), la stessa ricerca e le due
tab Programmati/Passati, che qui servono più che altrove: i diplomi si
stampano a corso finito.

**Com'è fatta, e cosa NON è stata duplicata.** La pagina è `GestioneDate`
in `soloLettura` — la modalità che esisteva già per il profilo kiosk — con
un solo pezzo nuovo: `azioniRiga(cd)`, una prop facoltativa che arriva
fino a `DateRaggruppatePerCitta` e mette i tasti del chiamante accanto a
ogni riga. Chi non la passa non cambia di niente.

**I due PDF li compone un solo posto.** `generaPdfDiplomi` e
`generaPdfSegnaposti` sono usciti da dentro `SchedaData` e stanno a
livello di modulo: li chiamano sia la scheda della classe sia «Stampe».
Non aprono finestre e non scaricano niente — tornano i byte, l'elenco di
chi è rimasto fuori e un `esito` che dice cosa è successo; a parlare ci
pensa chi chiama, che sa dov'è l'utente. Due copie avrebbero voluto dire
due diplomi diversi dallo stesso archivio, e il giorno in cui qualcuno
sposta il nome di mezzo centimetro in un posto solo non se ne accorge
nessuno finché il foglio non è in mano all'allieva. Le regole delicate
non si sono toccate: il diploma viene **solo** dal pacchetto, e il motivo
per cui non esce si dice allieva per allieva.

**Il permesso è `stampe` e ce l'ha solo lui** (migrazione
`20261103190000`: la riga `utenti_app` «Raffaele Villanno», la sua riga
`venditori`, e il profilo Programmatore che serve a verificarla).
**Nessun bypass per chi amministra**, a differenza di Regolamenti: chi
amministra entra nelle classi e stampa da lì, questa pagina esiste per
chi non ci deve entrare.

**Due cose trovate dal banco di prova, e vale la pena ricordarle.** La
prima è la trappola di questo file: i nuovi `useState` erano accanto alla
funzione che li usa, cioè **dopo i return anticipati del gate**, e la
pagina moriva con «Rendered more hooks than during the previous render» —
ora stanno con gli altri stati, in cima. La seconda: in `soloLettura` la
riga riceveva `onApriData={() => {}}`, quindi mostrava la freccina e il
dito del mouse **per non fare niente**; adesso riceve `undefined` e non
finge (vale anche per il profilo kiosk).

Prove in `prove/stampe.test.jsx` (7): la tessera solo col permesso, i due
tasti su ogni riga, l'assenza di matita/cestino/calendario/barra di
Gestione corsi, la riga che premuta non apre la classe, i filtri e la
ricerca uguali, e i due messaggi che spiegano perché un diploma non esce
(«non ha nessun pacchetto») o che la classe è vuota — senza generare
nessun PDF.

### Il bundle eredita il back order dai suoi pezzi (4/11/2026)

Il titolare: «nonostante con il mascara abbia attivato il backorders, il
relativo bundle del mascara da 10 pezzi, non leggendo disponibili i pezzi
necessari per comporsi, mi risulta sempre indisponibile». Aveva ragione, e
il caso era esatto: **Mascara Kerafill 1pz**, 7 pezzi in casa e back order
acceso, quindi ordinabile a scorte zero; **Espositore 10pz**, bundle
virtuale, 7 ÷ 10 = **zero componibili** → sul sito indisponibile. Il pezzo
singolo si ordinava, l'espositore no, senza nessuna ragione perché
fossero diversi: il conto della disponibilità guardava solo le giacenze,
e per lui un componente a back order era un componente che non c'è.

**La regola, decisa dal titolare: il bundle lo eredita.** Se ogni
componente che lo blocca — quello che finisce prima, cioè quello che
decide il minimo — è a sua volta ordinabile a scorte zero, il bundle va
sul sito come ordinabile, con la frase del pezzo singolo (o la sua, se
qualcuno l'ha scritta sull'espositore). Si accende e si spegne da sé
seguendo i componenti: nessuna casella da ricordare su ogni bundle.

**I limitanti, non tutti.** Un componente che ne ha cinquanta non blocca
niente, e pretendere il back order anche da lui terrebbe fermo
l'espositore per colpa di un pezzo che abbonda. Ma **basta uno** che
manca e non si riordina perché il bundle resti chiuso: prometterlo
vorrebbe dire prendere un ordine che non si può evadere.

**E la disponibilità resta il numero vero.** Non si gonfia la quantità
per far comparire il tasto: al sito va **zero** — quanti espositori si
compongono davvero — e il back order di WooCommerce fa il resto («su
ordinazione», e si compra). Dichiarare due espositori che non esistono
vorrebbe dire prometterli a chi paga.

**La regola sta in `_shared/bundle.js`, e il perché è il punto.** Il
conto dei bundle vive in **due** posti: `sincronizzaDisponibilitaBundle`
(`_shared/woo.ts`), che gira quando un ordine **online** muove i
componenti, e `woo-riallinea-shop`, che gira ogni notte e dopo ogni
movimento di magazzino — cioè dopo le vendite **al banco**. Una regola
scritta in uno dei due sarebbe giusta per metà delle vendite, e nessuno
saprebbe quale metà. (Le altre due copie della formula, nella scheda
prodotto e al POS, rispondono a un'altra domanda — «quanti se ne
compongono adesso» — e restano come sono: quel numero non cambia.)

In `woo-riallinea-shop` questo è l'unico caso in cui si scrive sul sito
qualcosa oltre alla quantità, e non contraddice la regola scritta lì
sopra: su un prodotto normale il back order è **una scelta di chi apre la
scheda** e resta sua, su un bundle virtuale è un **valore calcolato**,
come la quantità accanto. Il flag viene riscritto anche in locale
(`prodotti_shop.backorder_attivo`), dopo la conferma del sito e prodotto
per prodotto: se restasse spento in app mentre il sito vende a scorte
zero, la scheda mentirebbe a chi la apre.

Prove in `prove/bundle-backorder.test.js` (18), sui numeri veri del
mascara e sui casi che la farebbero sbagliare.

**Pubblicata e verificata lo stesso giorno**, su quattro funzioni — i due
moduli condivisi stanno dentro il pacchetto di ognuna, quindi
`woo-riallinea-shop`, `woo-webhook`, `woo-import-storico` e
`assistente-regole` sono state ripubblicate insieme. **Erano tre, non
uno:** il giro in prova ha trovato da riaprire anche **Kit laminazione
essential** e **Excellentia Siero ricrescita Ciglia — Espositore 10pz**,
fermi per lo stesso motivo e senza che nessuno lo sapesse. Dopo il
riallineamento, sul sito tutti e tre risultano `onbackorder`,
`backorders: notify`, quantità **0** e acquistabili.

### L'assistente dichiara il periodo, e le date se le misura (4/11/2026)

Nasce dalla risposta che Chiara si è sentita dare: «quanti pigmenti da
luglio?» → «900 e passa». Il conto era giusto, il **periodo** no — 936
boccette è gennaio-novembre, da luglio sono 274 — e il periodo non era
scritto da nessuna parte. **Un conto giusto sul periodo sbagliato è il
modo peggiore di sbagliare, perché sembra giusto** e nessuno lo mette in
dubbio.

Sotto, misurato, c'era di peggio: **le fonti non cominciano insieme.**

| Fonte | I dati cominciano |
|---|---|
| Shop online, incassi di prodotti | 15/03/2022 |
| Acconti dei corsi | 30/08/2025 |
| Spese | 02/07/2026 |
| Iscrizioni | 29/07/2026 |
| Classi in calendario | 08/08/2026 |
| Vendite al banco | 05/09/2026 |
| Pre corso e saldi | 16/09/2026 |

Quattro anni e mezzo fra la più vecchia e la più giovane. «Com'è andato
maggio» dà una risposta che **sembra** completa e contiene solo lo shop;
confrontare il 2024 col 2026 vuol dire confrontare un canale con sette.

**La vista `analisi_copertura`** (migrazione `20261104100000`) misura
quelle date **sul dato stesso a ogni lettura** — 61 ms — e il catalogo
che il modello legge finisce col riquadro «DA QUANDO CI SONO I DATI» più
quattro regole obbligatorie: dichiara sempre il periodo con le date
anche se nessuno l'ha chiesto; se il periodo chiesto comincia prima dei
dati di quella fonte, dillo; non confrontare due periodi che la fonte
non copre allo stesso modo; di' cosa resta fuori (i pigmenti dati dentro
ai kit dei corsi non sono una vendita, e «quanti ne sono usciti» e
«quanti ne abbiamo venduti» sono due domande diverse).

**Le date NON stanno nel prompt, e una prova lo impedisce.** Scritte a
mano invecchierebbero senza che nessuno se ne accorga: il giorno che si
importa lo storico del banco resterebbero quelle di oggi, e l'assistente
direbbe una cosa falsa con l'aria di saperla. Se il database non
risponde il catalogo resta quello di prima — meglio una risposta senza
l'avvertenza che nessuna risposta.

Vale per **entrambi** i registri, l'assistente flottante e «Chiedi ai
dati», perché il catalogo è uno: per questo `analisi-domanda` costruisce
il suo prompt a ogni domanda invece di tenerlo in una costante di
modulo. `analisi_copertura` è anche interrogabile, con `permessi: []`,
perché non contiene nessun importo e nessun nome: solo fonti, due date e
un conteggio. Prove in `prove/assistente-sui-dati.test.js` (46).

### Lo svuotamento di Varnish non funziona, e si sa perché (4/11/2026)

Verificando gli espositori è venuto fuori il guasto che sta **sotto** a
tre casi già visti. Sull'espositore del mascara: WooCommerce e la Store
API dicono «su ordinazione, acquistabile»; la **pagina servita a un
cliente** diceva ancora **«Esaurito», senza tasto per comprare**, ed era
la copia generata alle 01:21 — prima del riallineamento. La stessa
pagina chiesta con un parametro qualsiasi in coda (che aggira la cache)
rispondeva **«Disponibile su ordinazione»** col tasto. Quindi: dato
giusto, pagina vecchia.

Uno svuotamento completo lanciato a mano risponde `ok` ma non cambia
niente, e nei passi che restituisce c'è il colpevole:

```
passi: [..., "varnish:regex:400", "varnish:200 pagine", "cloudflare:si", ...]
```

**La PURGE «a tappeto» su Varnish torna 400.** L'ipotesi, da verificare
appena si tocca lo snippet: `wordpress/elitederma-svuota-cache.php`
manda quella richiesta a `home_url('/')`, cioè all'indirizzo
**pubblico** del sito — esce su internet, passa da **Cloudflare**, che
non sa cosa sia una PURGE e risponde 400. Varnish, che sta sul server,
non la vede nemmeno. Va mandata al server stesso (`127.0.0.1`) con
l'intestazione `Host` del dominio, che è quello che fa il ripiego
pagina-per-pagina — l'unico passo che non fallisce, e che però copre
solo 200 indirizzi e non prende tutto.

Cloudflare si svuota (`cloudflare_attivo: true`, `cloudflare:si`), ma
non basta: la copia vecchia è **all'origine**. È il motivo per cui le
pagine «si sistemano da sole» dopo qualche ora — scadono, non vengono
svuotate.

**Cosa spiega**: le descrizioni e le foto del microblading corrette il
3/11 e invisibili per sei ore; «N2 Fixa» del 2/11 con «Leggi tutto» per
cinque ore; gli espositori di oggi. Tre sintomi, una causa.

**Perché non è ancora corretto**: lo snippet vive in Code Snippets su
WordPress, dove da qui non si scrive — le chiavi WooCommerce sanno
toccare prodotti e ordini, non codice. La correzione va importata a
mano (il `.json`, non incollata: su uno snippet lungo l'editor rovina il
testo). Per renderlo autonomo servirebbe una password per applicazioni
di un amministratore, cioè la facoltà di **eseguire PHP** sul negozio:
decisione del titolare, non presa.

### Gli sconti della fiera si copiano anche dalle master (4/11/2026)

Il titolare, guardando «Sconto agli eventi, al banco della fiera»: «in
questa area dobbiamo mettere anche il pulsante di copia dagli sconti
master». C'era solo **Copia da corsi**; ora ce n'è uno per fonte, su
tutte e due le serie (carta e contanti).

**Non è un doppione, ed è il motivo per cui ne servono due.** Il codice
d'aula è lo sconto che la scuola fa ai **suoi allievi**; il referral
personale è quello che una master fa a un **cliente qualunque** — e al
banco di una fiera il cliente è proprio quello. Quale delle due tabelle
somigli di più alla fiera lo sa chi la fa, non chi programma.

Tre cose decise lì dentro:

- **Si copia qui e basta.** Premere il tasto scrive solo l'impostazione
  degli eventi: nessun coupon da riallineare, nessuna riga di base da
  riscrivere — quelle servono ai codici, e una fiera un codice non ce
  l'ha. Le **soglie di spesa viaggiano con la tabella**, o la fascia
  copiata finirebbe su un carrello diverso da quello di là.
- **Da una tabella tutta a zero non si copia** (`serieScontoConPercentuali`).
  Qui `serieScontoScritta` sarebbe la domanda sbagliata: la serie delle
  master **nasce già fatta, con sei zeri** (`FASCE_SCONTO_DEFAULT`),
  quindi «esiste» sempre. Un tasto acceso lì sopra prometterebbe di
  ricopiare una tabella e invece azzererebbe lo sconto della fiera, in
  silenzio e con un gesto solo. Niente da copiare = niente tasto.
- **Una serie senza codici mai scritta mostra la tabella vuota**, non
  «Caricamento regole…». Per una serie *con* codici quel null vuol dire
  «la regola non è ancora arrivata» e si aspetta; per gli eventi una
  regola non esiste proprio, quindi vuol dire «mai scritta». Prima si
  restava su quella frase per sempre, e con essa **sparivano i tasti
  Copia da…**: erano invisibili esattamente la prima volta, che è
  l'unica volta in cui servono.

`SchedaFasceCodiceAula` non ha più una fonte sola (`copiaDa` /
`onCopiaCarta` / `onCopiaContanti`) ma un **elenco** `fontiCopia` di
`{ nome, carta, contanti }`; una funzione mancante vuol dire «di là non
c'è niente da copiare» e il tasto non compare. La serie needling passa
la sua unica fonte da quel nuovo elenco. Prove in
`prove/sconti-eventi-copia.test.jsx` (2): il pannello montato per
davvero, i quattro tasti premuti uno per uno, e il controllo che le due
fonti scrivano **numeri diversi** — se copiassero la stessa tabella,
averne due sarebbe peggio che averne uno, perché sembrerebbe una scelta
e non lo sarebbe.

### Il kit apre il bundle prima di guardare le giacenze (6/11/2026)

Il titolare: «l'app non mi fa andare avanti nel confezionamento dei kit
perché dice che mancano i box kit da 10 anellini. I box sono formati
dagli anellini singoli, e di anellini singoli ce ne sono migliaia».
Aveva ragione, e il caso era esatto: **«Box Anellini x i Kit 10 pz»** è
un bundle virtuale (10 anellini + 1 astuccio), con 3.000 anellini e 110
astucci in magazzino, e la preparazione si fermava con «ci sono 0 pezzi,
non posso scaricarne 8». Quello zero era la giacenza **del bundle**, che
di suo non esiste.

**Il difetto era l'ORDINE di due controlli giusti.** Lo scarico dei kit
chiedeva prima «questo prodotto conta a magazzino?» e solo dopo apriva il
bundle nei suoi pezzi. Su un bundle virtuale `conta_magazzino = false` è
giusto — è una ricetta, non una scatola sullo scaffale — e lo faceva
scartare **prima** dell'apertura. Peggio: scartato di lì, finiva nel ramo
dei rientri, che prendeva «delta positivo **oppure** non conta a
magazzino» e quindi raccoglieva anche un delta **negativo**. Al database
arrivava «togli 8 pezzi» su un prodotto che una giacenza non ce l'ha, e
`stock_muovi` lo rifiutava in blocco: giustamente, ed è l'unico motivo per
cui il guasto si è fatto sentire.

**Perché il blocco è stata la fortuna.** Lo stesso difetto, su un bundle
che in quella casella un numero ce l'aveva, non bloccava niente e
scriveva una cifra falsa. **«Aftercare post trattamento vit A+D 25pz»**
(bundle virtuale da 25 bustine, `quantita` 2) se l'è vista scalare
**tredici volte dall'8 settembre al 27 ottobre, in tutto 184**, mentre le
657 bustine vere non sono mai uscite dal magazzino. Il tasto funzionava,
quindi nessuno ha controllato. Stesso giro su «Vassoi minitray monouso 25
pezzi», sette movimenti dal 1° settembre. Quei
movimenti restano in archivio: **le giacenze storiche non sono state
corrette**, perché su un bundle virtuale quel numero non vuol dire niente
e perché cosa sia davvero uscito dagli scaffali lo sa solo chi conta.

**Com'è adesso**: `movimentiKitDaDelta` (in App.jsx, accanto a
`righeScarico`) prende la mappa «prodotto → di quanto si muove» e
restituisce scarichi e rientri **dopo** aver aperto i bundle. Tre cose
decise lì dentro:

- **prima si apre, poi si filtra.** Dopo l'apertura restano solo prodotti
  veri, e `conta_magazzino = false` torna a voler dire quello che dice in
  tutto il resto dell'app: niente giacenza, niente movimento — in
  **nessuno dei due versi**. Il «Microscopio», che ha `1` in quella
  casella col flag spento, prima scendeva a zero e al kit dopo avrebbe
  bloccato la preparazione come il box degli anellini.
- **la stessa porta la usano anche i rientri**, tutti e due
  (`ripristinaMagazzinoDaScaricoInterno` e `ripristinaKitRientro`, che
  prende la lista dichiarata dalla master). Correggere solo lo scarico
  sarebbe stato peggio di non correggere niente: usciti i componenti e
  rientrato il bundle, il magazzino si sbilanciava a ogni giro, e nel
  verso che fa comodo — più pezzi di quelli che ci sono.
- **i versi si sommano dopo l'apertura**, perché lo stesso componente può
  arrivare da due bundle diversi, uno che esce e uno che rientra: due
  righe sullo stesso prodotto sarebbero due conti separati, ognuno
  convinto di essere solo.

**E un bundle aperto a vuoto si nomina** (distinta vuota, o componenti
fuori anagrafica): niente righe, nessun movimento, e il pacco partirebbe
senza quei pezzi con il tasto che dice di sì. È il modo in cui questo
guasto tornerebbe, quindi lo scarico si ferma e dice quale. Oggi non
capita: i soli due bundle dentro ai kit sono questi due, e la distinta ce
l'hanno.

Il POS questo difetto non l'ha mai avuto: `righeScarico` lì sta davanti a
tutto. Prove in `prove/kit-con-bundle-si-apre.test.js` (9), sui numeri
veri degli anellini.

**Un pacco sigillato e una ricetta si somigliano e sono opposti**
(6/11/2026, deciso dal titolare guardando i due numeri rimasti). Il
titolare: «Copriclip sono pacchi da 125 pezzi dalla fabbrica che poi noi
apriamo per fare il pezzo singolo, quindi è giusto che abbia giacenza
propria». **«Copri clip box da 125 pz»** era registrato come bundle
virtuale, cioè come una ricetta che non esiste sullo scaffale: al sito
andava `floor(24.004 / 125) = 192` disponibili mentre i pacchi chiusi
sono **199**, e quel 199 non lo leggeva nessuno. Rimesso nella forma che
hanno già i 18 pacchi veri — aghi, lame, cuffie, microbrush: `semplice`,
`bundle_con_giacenza_fisica`, `prodotto_sfuso_id` verso «Copri clip 1pz»,
125 pezzi per confezione, **nessuna riga di distinta** (lì il legame coi
pezzi passa da «Apri confezione», non da `bundle_componenti`, e tenere
tutte e due le dichiarazioni vuol dire che un giorno si contraddicono).
Migrazione `20261106120000`, col rollback scritto dentro.

Il costo è stato **scritto**, 1,25: finché era virtuale glielo calcolava
`conCostoDeiBundle` dalla distinta (125 × 0,01), e da `semplice` quel
calcolo non lo tocca più — senza, un prodotto che si vende davvero
sarebbe rimasto «senza costo di acquisto», cioè senza margine, senza
fascia di sconto e senza punti alla master. È lo stesso numero di prima,
non una stima.

**«Confezione Anellini Sterili 30 pz» invece è giusta così** (bundle di
30 anellini più bustina e adesivo, confermato dal titolare). Si porta
dietro **983 in `quantita`**, che su un bundle virtuale non legge nessuno
— né il sito, che la disponibilità la calcola dai componenti, né
Gestione magazzino, che su `conta_magazzino = false` quel campo non lo
mostra. Resta scritto qui perché è una trappola per chi apre la tabella
(ha ingannato me): azzerarlo è un movimento di rettifica, e quel gesto lo
decide il titolare, non chi legge.

**Il «Microscopio»** è un accessorio didattica di COLORI E CORREZIONI, un
pezzo solo, non in vendita: `conta_magazzino` spento è giusto e resta
così. Prima scendeva a zero al primo corso e dal secondo in poi avrebbe
bloccato la preparazione come il box degli anellini; adesso semplicemente
non si muove. Accendere quella casella vorrebbe dire sapere che il
microscopio è in aula e non a magazzino — e bloccare un secondo corso che
lo chiede nelle stesse date: è un'informazione vera, ma è una scelta sua.

### «Aggiorna lo shop»: la risposta persa non è un lavoro fallito (6/11/2026)

Il titolare preme «Aggiorna lo shop» in Gestione magazzino e legge **«Non
riuscito: Failed to send a request to the Edge Function»**. Misurato lo
stesso giorno da riga di comando, il giro **non fallisce**: risponde in
**23 secondi**, scrive **182 giacenze**, svuota tutta la cache del sito.
Il tempo si spende quasi tutto in WooCommerce — due blocchi da cento
prodotti, circa dieci secondi l'uno; lo svuotamento completo della cache
ne costa 3,3 (misurato tre volte). La prova a vuoto, che legge e basta,
risponde in 0,8.

Quindi **non era il riallineamento a fallire, era il viaggio di ritorno
della risposta**. `FunctionsFetchError` vuol dire «il `fetch` non ha mai
avuto una risposta da leggere»: non è un 500, non è un rifiuto, non c'è
nessun codice di stato. Ventitré secondi sono tanti per un telefono che
deve tenere aperta una connessione — basta lo schermo che si spegne, un
cambio di app, il passaggio dal wi-fi ai dati. Escluse per prova la CORS
(preflight e risposta portano `access-control-allow-origin: *`, anche sul
401) e la cache del sito (3,3 secondi, costanti).

**«Non riuscito» su un lavoro riuscito è peggio di un tasto che non
risponde**: manda a cercare un guasto che non c'è, e intanto il sito è
già aggiornato. Ora `esitoRiallineaShop` (in App.jsx, fuori dal
componente per poterla provare) distingue i tre casi — andata bene, il
sito ha rifiutato, la risposta non è tornata — e sull'ultimo dice quello
che si sa davvero: che il comando era partito, che quasi sempre il sito è
stato scritto lo stesso, e che ripremere non fa danni (il riallineamento
riscrive gli stessi numeri, non li somma). E si rilegge `prodotti_shop`
**anche** quando la risposta si perde: il giro può aver scritto stato e
back order dei bundle, e la pagina deve mostrare quello che c'è adesso.
Prove in `prove/riallinea-shop-risposta-persa.test.js` (6).

**Resta da decidere, e vale la pena saperlo:** ogni giro completo si
chiude con `ok: false` per un prodotto solo, **«Kit henne business (id
672): ID non valido»**. In app è `attivo = false` con `stato = 'publish'`,
quindi il riallineamento prova a metterlo in privato sul sito a ogni
giro; su WooCommerce il prodotto 672 **non esiste più** (404, verificato).
È un puntatore morto che continuerà a segnare rosso per sempre. Due
strade, tutte e due da decidere: togliergli il `woo_product_id` in
anagrafica, oppure insegnare alla funzione che un 404 mentre si nasconde
un prodotto **è il risultato voluto** — di là non c'è più — e scrivere
`private` in locale. La seconda è la correzione vera e vuole una
pubblicazione.

### L'hennè si paga a totale, comunque lo si paghi (6/11/2026)

Era in sospeso dal 16/10/2026. Il titolare ha dettato la regola: «Costa
un tot e non è importante se lo paghi con iva o cash senza iva. Devi il
totale pattuito. Qualsiasi somma pagata con qualsiasi sistema somma per
raggiungere il totale.»

Nella scheda del corso ci sono **due interruttori vicini che parlano
tutti e due di IVA**, ed è per questo che si confondono:

- **«Come si pattuisce il prezzo»** (`corsi.prezzo_iva_inclusa`) decide
  solo da quale forma parte una scheda **nuova**, netto o già lordo. Non
  converte e non tocca nessun importo.
- **«Verifica sul totale pagato»** (`corsi.saldo_su_totale_pagato`)
  decide quanto «Restano da pagare» toglie dal pattuito per ogni quota
  incassata: l'**imponibile** (spento) o il **totale davvero incassato**
  (acceso). Questo i soldi li tocca: è la cifra che si chiede a una
  persona.

Confrontati tutti i corsi: **uno solo** aveva i due in contraddizione, e
era **HENNE INDIVI** — pattuito lordo, residuo calcolato sull'imponibile.
Acceso con `20261106180000`, rollback scritto dentro; `HENNE` era già a
posto. Nessun importo è stato convertito o riscritto.

Non si era ancora visto perché su quel corso c'è **una sola iscrizione**,
saldata «Cash no iva», dove imponibile e totale coincidono. Sarebbe
uscito alla prima persona che paga con un metodo che l'IVA ce l'ha: 550
pattuiti, 550 incassati, e la scheda avrebbe continuato a chiederne
**99,18** che nessuno deve. **Un residuo sbagliato non lo mette in dubbio
nessuno**: è scritto dall'app, davanti a chi incassa.

Con l'interruttore acceso il conto è quello dettato dal titolare:
`quantoTogliere` prende il `totale` di ogni quota segnata pagata —
acconto, pre corso e le righe aggiunte con «+» — qualunque sia il metodo.

**E dallo stesso giorno la regola la può dire anche la singola scheda.**
Richiesta del titolare: nei «Dati di vendita» dell'iscrizione, accanto a
«netto senza IVA» e «finale IVA inclusa», c'è un **terzo modo — «verifica
sul totale»** (`iscritti.totale_pattuito_modo = 'totale'`). Prima quella
regola stava solo sul corso, quindi per applicarla a una persona sola
bisognava cambiare l'impostazione di tutto il corso.

Tre cose decise lì dentro:

- **La scheda può solo accendere la regola, mai spegnerla**
  (`siVerificaSulTotale`, fuori dal componente per poterla provare). Se
  bastasse scegliere «netto» su una scheda di un corso che si paga a
  totale, le due iscrizioni già salvate come `lordo` e le **189 senza
  niente** cambierebbero di colpo il residuo che mostrano — soldi diversi
  chiesti alle stesse persone, senza che nessuno abbia toccato quelle
  schede. **Il corso resta il pavimento.**
- **Una scheda nuova su un corso che si verifica sul totale parte già da
  lì**: è la regola scritta di quel corso, e farla riscrivere a mano ogni
  volta vuol dire che prima o poi qualcuno se ne dimentica. I soldi non
  cambiano — quel corso sottraeva già il totale incassato; cambia che
  adesso la scheda lo dice invece di lasciarlo implicito.
- **Serve una migrazione per quello che sembra un bottone in più**
  (`20261106190000`): la colonna ha un CHECK che ammetteva due soli
  valori, e senza allargarlo PostgREST avrebbe rifiutato **l'intera**
  scrittura della scheda, non il solo campo — lo stesso guasto del 18/10
  sulle spedizioni POS. Nessuna riga toccata.

Gli altri due modi restano quello che erano: solo la lettura del numero,
che in archivio ci va **digitato e non convertito**. Prove in
`prove/verifica-sul-totale-pagato.test.js` (5), compresi i 550
dell'hennè, che devono fare residuo **zero** e non 99,18.

### Permessi e grado si rileggono all'apertura (7/11/2026)

Due segnalazioni nella stessa ora, dalla fiera, con la stessa causa:
«Olga non vede più i prezzi dei corsi» (il permesso ce l'aveva, dato
dopo che era entrata) e «Chiara non può ancora fare gli omaggi» (il
grado di supervisore acceso mentre lei era dentro — e l'omaggio **è** un
privilegio del grado, `puoScontare`, non una casella personale).

Permessi e grado erano fotografati all'accesso e messi da parte per
tutta la sessione. Esisteva già una rilettura all'apertura, ma **solo
per le utenze d'ufficio**, e il commento diceva che per master e
venditori «non c'è niente da rileggere»: non era vero — i permessi
stanno sulla loro riga esattamente come sulle altre. Ora si rilegge da
**tutte e quattro le porte** (master, venditore, assistente, utenza),
così basta ricaricare la pagina.

**E il conto dei permessi è uscito dal Gate** (`permessiDiAccesso`).
Stava scritto là dentro quattro volte, una per ramo, e fuori non si
poteva rifare — ed è proprio il motivo per cui la rilettura copriva solo
un caso su quattro. Ricostruirlo a mano nella rilettura avrebbe voluto
dire due liste che un giorno si staccano, e quel giorno qualcuno perde
una tessera che ha: i permessi si ereditano in tutte e due le direzioni
(una master col venditore collegato ha i suoi e i suoi; un venditore
collegato a una master eredita i suoi, `dashboardmaster` compreso se lei
ce l'ha).

Tre cose decise lì dentro:

- **`data` deve essere UNA riga con il suo id.** Una finta del banco di
  prova che non filtra restituisce un elenco, e fidarsi di quello
  vorrebbe dire azzerare i permessi di chi sta usando l'app. C'è una
  prova che lo impedisce.
- **Il grado non si abbassa da qui.** `supervisore` vale programmatore e
  `amministratore` vale amministratore, ma chi è entrato con la password
  di sistema resta quello che è: una rilettura non può declassare chi sta
  lavorando.
- **Il grado si scrive anche nella sessione**, o a ogni ricarica si
  ripartirebbe da quello vecchio e la Home lampeggerebbe.

Prove in `prove/supervisore.test.jsx` (7): il grado dato mentre la
persona è dentro vale al ricarico; una casella nuova su un venditore
compare al ricarico (il caso di Olga) e il suo grado **non** si alza da
sé; e se il database non risponde con una riga sola, i permessi non si
toccano.

### Il supervisore: i privilegi del programmatore a chi non lo è (7/11/2026)

Il titolare: «attiva anche a Chiara Colonnelli le stesse mie funzioni di
programmatore e accesso, anche se lei non è programmatore: deve venire a
supervisionare tutte le aree e avere i miei stessi privilegi».

**Il grado, qui, non sta su una riga: lo decide quale password si batte.**
C'è una riga di sistema `__programmatore` con la sua password, una
`__admin`, e tutti gli altri entrano con la propria e valgono «user» più
i permessi scritti. Quindi dare a qualcuno i privilegi del programmatore
aveva due strade, e la prima è stata scartata:

- **dargli la password del programmatore**: due persone dietro la stessa
  identità. Ogni vendita, ogni consenso, ogni modifica risulterebbe del
  programmatore, e per togliere l'accesso a una si dovrebbe cambiare la
  password all'altro;
- **una casella sulla sua riga** (`master.supervisore`, e
  `utenti_app.supervisore` per il giorno in cui servisse a un'utenza
  d'ufficio). Entra con la **sua** password, resta **sé stessa** — nome,
  id, attribuzione — e il grado diventa programmatore. Si revoca
  spegnendo la casella, e quel gesto riguarda lei sola. Migrazione
  `20261107170000`, accesa su Chiara **per id**.

**E il grado adesso apre anche le tessere.** `apriViewProtetta` e
`puoAprireVista` aprivano già al programmatore qualunque vista: era solo
la Home a restare indietro, perché le tessere si leggevano dai permessi
scritti sulla riga. Funzionava per un motivo che non è una regola — la
riga `__programmatore` le ha elencate tutte a mano — e si rompeva a ogni
tessera nuova: `modellefiera` è esistita per mezza giornata senza che
quella riga la conoscesse. Ora `tastoAbilitato` risponde sì al
programmatore. **Non** le sono stati copiati i permessi a mano: copiare
una lista vuol dire ricordarsi di aggiornarla per sempre, e un permesso
dimenticato non si vede — si vede una tessera che non c'è.

**Cosa le apre, detto per intero**: tutte le aree e ogni vista protetta,
i conti e gli incassi, Gestione utenti e i permessi degli altri, il
prezzo a mano sul POS e la cifra «In più €», le impostazioni dei
consensi, e gli strumenti di impaginazione — rinominare le tessere,
spostare le sezioni — che valgono **per tutti**.

Prove in `prove/supervisore.test.jsx` (4): entra col suo codice e il
grado è programmatore mentre nome e id restano i suoi; vede tessere che
le sue caselle non le darebbero; una master senza la casella resta una
master; e la colonna si legge davvero dal database — nel Gate le colonne
si elencano una per una, e `puo_omaggi` era già stato dimenticato una
volta.

### «Non vede più i prezzi dei corsi»: i permessi si leggono all'accesso (7/11/2026)

Il titolare, dalla fiera: «Olga non vede più i prezzi dei corsi. I
venditori tutti le devono vedere». Misurato prima di toccare, e sono
venute fuori **tre** cose diverse.

**Il permesso ce l'aveva già.** `prezzicorsi` era sulla sua riga. Lo
avevano 18 venditori su 21: i tre senza — Alice Salvitto, Angelica
Burelli, Tommaso Giumbini — hanno una casella sola in tutto, quindi non
gliel'ha tolto nessuno, non l'hanno mai avuta. Adesso ce l'hanno tutti e
21 (migrazione `20261107180000`).

**Allora perché non la vedeva: i permessi si leggevano UNA VOLTA,
all'accesso**, e restavano scritti nella sessione del browser
(`sessionStorage.edc_utente`). Una casella data dopo che la persona è
entrata non compariva finché non usciva e rientrava — e nessuno pensa di
doverlo fare. **Risolto lo stesso giorno**, dopo che lo stesso difetto è
costato una seconda segnalazione nella stessa ora («Chiara non può
ancora fare gli omaggi»: il grado di supervisore acceso mentre lei era
dentro): vedi «Permessi e grado si rileggono all'apertura» qui sotto.

**E la cosa più grave, trovata di fianco: Olga non poteva aprire il
POS.** Le quattro master del banco (Chiara, Elia, Stella, Valentina)
hanno `pos`; le quattro righe **venditore** del banco — Andrea, Elena,
Olga, Stefano — no. Non si era visto perché entrando con la password
venditore si eredita anche i permessi della master collegata, e Andrea la
ha; Elena e Stefano entrano da un'utenza d'ufficio. **Olga non ha
nessun'altra identità**: con la sua password la tessera POS non c'era —
cioè la persona per cui il giorno prima si era scritta la preselezione
del banco non poteva aprire il banco. Acceso sulle quattro righe
venditore, ricavate dal team della fiera e non da una lista di nomi.

È la stessa lezione del giorno prima, da un'altra parte: **la tessera
segue la password che si batte**, e la stessa persona ha due o tre
identità. Un permesso dato all'identità sbagliata è un permesso che non
c'è.

### Il POS fisico al banco, e la cifra scritta a mano (7/11/2026)

Due richieste dello stesso momento, con la fiera di Napoli aperta.

**«Anche il POS fisico, che non è necessariamente carta Stripe».** La
scelta fra «POS fisico» e «Stripe» esisteva solo per chi
amministra, perché il terminale sta in amministrazione. Ma a una fiera il
terminale lo si porta al banco, e senza quella scelta chi vende aveva una
strada sola — il QR — che davanti a una cliente che porge la carta non è
una strada. Ora la vede anche **chi ha la preselezione del banco**: non
una lista di nomi, ma chi il database dice che vende al banco di quella
fiera (`eventi_team.vende_al_banco`) e finché l'ora del banco non è
passata. Si accende e si spegne con la fiera, da sé.

**Resta una dichiarazione, non una prova**, e per questo non diventa la
scelta di partenza: col terminale la vendita si registra senza che
nessuno abbia visto i soldi arrivare — il database la accetta solo perché
quel segno c'è (`terminale_fisico`), e resta scritto sulla vendita. Il
banco si apre sul QR, che è l'unica carta che si prova, e si passa al
terminale quando lo si usa.

**E dal 7/11/2026 sera sono QUATTRO TASTI, non due e poi altri due.** Il
titolare, dalla fiera: «non è necessario selezionare prima pagamento con
carta e poi il tasto Stripe o POS esterno. Ci vogliono 4 tasti separati, 2
sopra e 2 sotto: sopra «Stripe» e «POS fisico», sotto «Contanti» e
«Buono Amazon».» Era la seconda segnalazione sullo stesso tasto in
mezza giornata — «non vedo il tasto POS fisico» — e la prima volta la
risposta era stata sbagliata: il tasto c'era, ma **stava dentro il
riquadro che si apre scegliendo la carta**, cioè dietro a un gesto che
non fa chi non sa che dietro c'è qualcosa. Una scelta annidata la trova
solo chi già sa che esiste.

Ora i quattro stanno in una griglia 2×2 (`gridTemplateColumns: "1fr 1fr"`)
e ognuno si preme una volta sola. **Dove il terminale non c'è il tasto non
c'è**, e gli altri tre scorrono a riempire la griglia: un tasto che non
si può premere è un dubbio, non una scelta. Due cose da sapere:

- **Stripe e POS fisico restano tutti e due «POS»** per la vendita, per
  l'IVA e per i punti: `metodoPagamento` resta `pos` e `modoIncassoPos`
  dice quale dei due. Sono due tasti perché al banco sono due gesti
  diversi, non due metodi di pagamento — e cambia una cosa sola, che il
  QR il pagamento lo **prova** e il terminale lo **dichiara**.
- **Il carrello sospeso adesso porta anche QUALE carta** (`modoIncassoPos`
  nella fotografia). Prima non serviva, perché era un dettaglio dentro
  «carta»; da quando è un tasto, un carrello ripreso che tornasse sul QR
  farebbe ricominciare da capo un incasso già battuto sul terminale. Si
  ripristina **solo a chi il terminale ce l'ha**: ripreso dall'ufficio,
  un carrello della fiera mostrerebbe quattro tasti e nessuno scelto, e
  manderebbe `terminale_fisico` su una vendita che nessuno ha battuto.

Il nome a video è **«POS fisico»** — quello che dice il titolare — e con
esso i due messaggi del QR fallito. Dentro, `terminale_fisico` e
`modoIncassoPos === "esterno"` non sono stati rinominati: li guarda il
database, e un rinominare cosmetico su una serratura non si fa.

**«È meglio che scrivo una cifra io da scontare: se vedo che il prezzo fa
7,56 e voglio fare 6,90, scrivo a mano meno 60 euro».** Serve ad
arrotondare il totale, e per questo è una casella **a parte** — «In più
€», nel riquadro degli sconti, solo per il programmatore — e non lo
«Sconto vendita» che c'era già: quello è *alternativo* allo sconto fiera
e ai codici (uno o l'altro, mai sommati, e con la fiera accesa è spento).
Questa invece **si somma** a quello che sta valendo, che è esattamente
la cosa che le altre caselle hanno il divieto di fare. Appena si scrive
la cifra, accanto compare quanto si incassa: cercare una cifra tonda
contando a mente davanti al cliente è il modo di sbagliarla.

Tre cose decise lì dentro:

- **Il tetto al subtotale resta.** Un carrello non si sconta più di
  quanto vale: oltre, il totale si ferma a zero e la riga lo dice.
- **Resta scritta sulla vendita** (`vendite_shop.sconto_a_mano_eur`,
  migrazione `20261107160000`). Senza, in archivio resterebbe solo un
  totale più basso di quello che le tabelle dicono, e nessuno saprebbe
  che un pezzo di quello sconto non viene da nessuna tabella ma da una
  decisione presa al banco. Chi ha battuto è già scritto; questo dice
  quanto ha tolto di suo. Nota tecnica: `registra_vendita_pos` costruisce
  la riga con `jsonb_populate_record`, che **ignora** le chiavi che non
  sono colonne — senza la migrazione il numero non avrebbe fatto fallire
  niente, si sarebbe perso in silenzio.
- **Le percentuali attribuite non la contano.** Le frasi «Codice valido:
  −x%», «Fasce degli eventi: x% su questo carrello», «Sconto del corso
  applicato: −x%» dicono quanto ha fatto *quella* cosa, e ora leggono
  `percentualeDaTabelle` (sconto **meno** la cifra a mano). Sommandoci gli
  euro tolti da una persona, una fascia del 12% comparirebbe come 13,8 e
  un codice al 30% come 34: vero sul carrello, falso sul cartellino — lo
  stesso guasto del «−4,81%» su un carrello che ne riceveva 8,55. Le
  righe del carrello invece la contano, perché lì il numero è quello che
  la cliente paga: con 0,66 a mano la riga passa da 32,21 a 31,55 e il
  totale torna.

La cifra **si azzera a ogni vendita nuova** (un arrotondamento che resta
acceso si ripete sullo scontrino dopo, e nessuno lo vede) e **sta nella
fotografia del carrello sospeso**, come lo sconto fiera: ripreso il
carrello, il totale concordato col cliente deve essere ancora quello.

**E il prezzo scritto a mano su una riga è il prezzo FINALE** (deciso lo
stesso giorno: «il prezzo che posso correggere è anche il prezzo finale,
quello dopo un eventuale sconto»). Prima quella cifra era il nuovo *punto
di partenza* e lo sconto si applicava sopra: scritto 30,00, con il 12%
della fiera si incassavano 26,40 — e chi aveva concordato trenta euro al
banco ne incassava ventisei senza averlo deciso. Misurato, c'era di
peggio: la fascia si scegli sul margine dell'**anagrafica** (listino meno
costo), non sul prezzo scritto, quindi la percentuale non si abbassava
mai. Su un pigmento che costa 10, scritto 13,00, la cliente pagava 11,44
— **9,38 netti, sotto costo**, e niente lo diceva.

Ora una riga con un prezzo concordato esce dallo sconto delle tabelle e
lo dice («prezzo concordato, non si sconta»); il resto del carrello
continua a scontarsi, e il tasto ↺ rimette il listino e con esso lo
sconto. Si riconosce da `prezzoListino`, che la correzione scrive sulla
riga, e sulla vendita resta `prezzo_corretto_a_mano`.

**La terza copia dello stesso conto, e come si è fatta sentire.** Il
totale del carrello lo calcolavano tre funzioni «di carrello»
(`scontoAFasceCarrello`, `scontoCouponCarrello`,
`scontoAcquistoMasterCarrello`) con la stessa formula che
`scontiPerRigaCarrello` applica riga per riga. Finché le due dicevano lo
stesso numero non si vedeva; appena una riga ha smesso di scontarsi, il
totale ha continuato a scontarla e **il riproporzionamento le ha
ributtato addosso la differenza** — cioè il prezzo «finale» tornava a non
essere finale. L'ha preso il banco di prova al primo giro, non l'uso.
Adesso **il totale è la somma delle righe**: `scontiPerRigaCarrello` con
`scontoApplicato: null` restituisce il conto naturale, e da lì esce il
totale. Le tre funzioni restano, usate una riga alla volta.

E i centesimi di resto dell'arrotondamento **non vanno su una riga
concordata**: vanno sull'ultima riga che può prenderseli. Se sono
concordate tutte restano sull'ultima, perché l'alternativa è che le righe
non sommino quello che si incassa — e un totale che non torna con le sue
righe è peggio.

**La quarta copia, e una che resta.** `contoCarrello` — l'elenco dei
carrelli sospesi, e il dettaglio che chi amministra legge mentre chiude
il carrello di un altro — rifà il conto per conto suo: lì la riga col
prezzo concordato è stata allineata, altrimenti mostrava uno sconto che
quella riga non prenderà. **Resta però fuori la cifra «In più €»**: un
carrello sospeso la porta nella sua fotografia, ma quella tabella non la
conosce, quindi per quel carrello mostra un totale più alto di quello che
si incasserà. È informativa e non registra niente, ma va saputo — e va
sistemato.

**Controllate le vendite al banco in archivio** (7/11/2026): le righe
sommano il totale su tutte, comprese le sette della fiera di oggi.
L'unico scarto è POS-1793740596726 del 3/11 — righe per 382,01 e totale
348,12 — ed è giusto: era un **acquisto personale** di una master che ha
speso 33,89 di provvigioni maturate. La merce vale 382,01, in cassa sono
entrati 348,12, il resto l'hanno pagato le provvigioni. Il riquadro dei
conti ha la sua riga «Provvigioni usate» apposta; sulla vendita però quel
numero **non è scritto**, e si ricava solo dalla differenza: è una cosa
da sapere quando si controlla un totale.

Prove in `prove/pos-fiera-terminale-e-sconto-a-mano.test.jsx` (11): il
terminale c'è per chi sta al banco e non per gli altri, si spegne passata
l'ora, il banco si apre sul QR, **si scegli con un tocco e non con due**
(e quel tocco toglie di mezzo il QR); la cifra a mano la vede solo il
programmatore, si somma allo sconto fiera, trascina le righe del
carrello e non sfonda il subtotale. In
`prove/pos-incasso-carta.test.jsx` c'è anche il guardiano della forma
vecchia: «Tipo di incasso carta» non deve ricomparire.

### Il pagamento splittato: contanti più carta, con due sconti (7/11/2026)

Il titolare, dalla fiera: «sotto al totale ci devono essere due tasti,
modalità di pagamento in unica soluzione o splittato. Se scrivi splittato
ti dà due caselle: nella prima ci scrivi quanto paga in contanti, e in
quella sotto, in base a quanto hai scritto, viene riportato l'importo
rimanente con lo sconto aggiornato per la parte residua con POS fisico o
Stripe.» E, subito dopo: «per ora questa funzionalità la aggiorni solo
sul POS programmatore e sul POS Chiara.»

**Perché non è una sottrazione, ed è tutto il punto.** In contanti e a
carta lo sconto non è lo stesso: alla fiera di Napoli le due serie dicono
**4/6/10/13/14/15% la carta** e **6/8/12/14/16/20% il contante**, secondo
il margine del prodotto. Quindi un carrello pagato metà e metà non ha un
prezzo solo da spezzare: ha due prezzi, e bisogna decidere quale vale su
quale parte. Sui tre conti possibili ha scelto il titolare:

> **Il contante compra merce.** I 40 € in contanti comprano 50 € di merce
> allo sconto dei contanti; i 50 € di merce che restano si pagano a carta
> con lo sconto della carta. Su 100 € di merce (80 tutto contanti, 85
> tutto carta) si incassano **82,50**.

Le due prove che è il conto giusto, e sono anche due prove del banco:
dando **tutto** in contanti si torna esattamente al totale «tutto
contanti», dando **zero** a quello «tutto carta». Nessun salto, e nessun
vantaggio inventato in mezzo. Gli altri due conti li ha scartati: scontare
tutto come contanti vorrebbe dire che un euro in contanti vale come darli
tutti; scontare tutto come carta vorrebbe dire che pagare in contanti non
serve a niente.

**Il conto sta in `contoSplittato`, e le righe in
`scontiPerRigaSplittati`.** Ogni riga prende la sua fetta di sconto
contanti e la sua fetta di sconto carta, nella stessa proporzione in cui
il carrello è stato pagato: così la somma delle righe fa lo sconto del
totale senza che nessuno debba fidarsi, e il **margine per prodotto**
resta vero nelle statistiche. Il riproporzionamento dei centesimi è
uscito da `scontiPerRigaCarrello` (`riproporzionaSconti`) ed è lo stesso
per tutti e due i conti: due copie si staccherebbero il giorno che una
impara qualcosa, e le righe smetterebbero di sommare quello che si
incassa. Per la stessa ragione le **tabelle** sono una funzione del metodo
(`fasceDelPagamento(inContanti)`) e non due costanti: lo stesso conto
letto due volte.

**In archivio è una vendita sola con due importi** (deciso dal titolare
fra le due strade). `metodo_pagamento = 'misto'`, più
`incasso_contanti_eur` e `incasso_carta_eur` (migrazione
`20261107200000`). Lo scontrino è uno, il numero d'ordine è uno, il
magazzino si scarica una volta; spezzarla in due vendite avrebbe voluto
dire spezzare le righe dei prodotti — mezzo pigmento su una e mezzo
sull'altra — e due scontrini per un acquisto solo.

Due vincoli nel database, perché qui una bugia non si vedrebbe:
**una vendita mista deve portare i due importi** (una chiave sbagliata nel
payload e `jsonb_populate_record` la ignora in silenzio: resterebbero zero
in tutte e due le casse) e **i due importi devono fare il totale**. E la
**prova del pagamento** vale adesso anche sulla parte a carta: senza,
lo splittato sarebbe diventato la strada per registrare una carta non
provata — bastava scrivere un euro di contanti. Il pagamento col QR deve
corrispondere al **resto**, non al totale, ed è il resto che il QR chiede.
Provati in transazione annullata tutti e sette i casi: misto senza prova
rifiutato, misto sul terminale registrato, somma sbagliata rifiutata,
misto senza i due importi rifiutato, misto con la carta a zero registrato,
e le vendite normali a carta e in contanti esattamente come prima.

**Chi legge quei due numeri.** `incassoContantiDi(v)` e
`incassoCartaDi(v)` (più `incassaContanti(metodo)`) stanno in un posto
solo, e su ogni vendita che non è mista tornano **esattamente** il numero
che l'app leggeva prima: è il modo di insegnare lo splittato alla
contabilità senza rimettere mano a 4.398 vendite in archivio. Da lì
passano la busta della classe (ci entra la parte in contanti, e la vendita
prende il suo numero di busta), le appendici, la cassa contanti, le
vendite del corso divise per cassa, l'avviso prima di cestinare, lo
sgancio dalla busta, e il «come hanno pagato» del conto evento e del
Dettaglio vendite — dove una vendita mista si **divide fra le due voci**,
perché «misto» non è un modo di pagare.

**I punti di una vendita mista si contano come carta**, ed è voluto: la
vista `v_punti_master_righe` decide `e_cash` con
`metodo_pagamento in ('contanti','buono_amazon')`, quindi «misto» per lei
è carta — e il POS mostra lo stesso numero. La master prende qualche punto
in meno di quanti le darebbe la fetta in contanti; vale la regola di
sempre, **la vista comanda**, e due conti diversi sugli stessi punti
sarebbero peggio. Il riquadro dei totali e la dashboard dicono la stessa
cifra.

**E in splittato le due righe del «netto scontato» non si mostrano**: con
un codice sul netto quei due pezzi facevano la riga «Imponibile», che in
una vendita mista si calcola in un altro modo — due numeri veri che
insieme direbbero una cosa falsa.

**L'IVA sta solo sulla parte a carta.** Il contante senza fattura non
genera imposta: è la convenzione di tutta l'app, non una regola nuova.
Quindi su una vendita mista l'imponibile è il contante per intero più il
netto del resto; scorporarla su tutto dichiarerebbe un'imposta che nessuno
verserà.

**Dove lo splittato NON si può fare, e non è una dimenticanza:** con la
**fattura** (una fattura si emette su un incasso solo, e cosa ci va dentro
di una vendita mista è una decisione, non un calcolo), con l'**omaggio**
(non incassa niente) e con l'**acquisto personale** (lì una parte la
pagano le provvigioni maturate e i soldi in gioco sono tre). Al posto del
tasto spento c'è la ragione scritta. E una vendita mista **non si
rietichetta** dalla colonna Incasso di Vendite al banco, come una pagata
con Stripe: i due importi resterebbero a dire un'altra cosa.

**Chi ce l'ha:** `ruoloUtente === "programmatore"`, che vuol dire il
titolare e **Chiara** — il grado di supervisore la porta a programmatore,
quindi non è servito nessun permesso nuovo. La cifra in contanti **si
azzera a ogni vendita nuova** (un contante rimasto scritto finirebbe sulla
cliente dopo) e **sta nella fotografia del carrello sospeso**: ripreso il
carrello, al cliente si chiede lo stesso resto che gli era stato detto.

Prove in `prove/pagamento-splittato.test.jsx` (16): il conto e i suoi due
estremi, il tetto, la cifra a mano che si toglie dal resto, le righe che
sommano **esattamente** lo sconto del carrello con percentuali in mezzo
alle due, le due casse in archivio (compreso un reso che esce da tutte e
due in proporzione), e il gesto col POS vero montato — i due tasti solo al
programmatore, le due caselle, il resto che compare, il QR che chiede
21,73 invece di 32,21, e il contante che copre tutto.

### «Non vedo più i prezzi corso»: era una cartella (7/11/2026, sera)

Terza volta nello stesso giorno che torna la stessa frase, e le prime due
risposte — giuste entrambe — non erano **la** risposta:

1. al mattino «Olga non vede più i prezzi dei corsi» → il permesso ce
   l'aveva; `prezzicorsi` è stato acceso su tutti e 21 i venditori
   (`20261107180000`);
2. subito dopo → i permessi si leggevano una volta sola, all'accesso: una
   casella data a chi è già dentro non compariva. Corretto («Permessi e
   grado si rileggono all'apertura»);
3. la sera, ancora. **E il motivo era in Home**: `prezzicorsi` non è una
   tessera di primo livello, sta **dentro la cartella «Storico allievi»**
   (`impostazioni_layout_tasti`, pagina `home`, creata il 2/10/2026) con
   `crmallievi` e `storicoallievi`. Chi vende al banco — Olga, Andrea,
   Stefano, Elena, Elia — ha il permesso **solo** di quella: in Home
   vedevano una cartella chiamata «Storico allievi» che conteneva una cosa
   sola, i prezzi dei corsi. Nessuno la apre cercando un prezzo.

**La regola che ne resta: una tessera dentro una cartella il cui nome dice
un'altra cosa è una tessera che non esiste.** La cartella funzionava come
scritto — si nasconde solo se dentro non ha niente di visibile, e mostra il
conto delle tessere visibili — quindi non c'era nessun difetto da trovare
nel codice, e cercarlo lì è costato due diagnosi. Quando qualcuno dice «non
vedo più X» e il permesso c'è, **si guarda l'ordine dei tasti di quella
pagina prima del codice**: `impostazioni_layout_tasti` può averlo infilato
in una cartella, e la cartella la vede diversa ogni persona, perché dentro
ci resta solo quello a cui ha diritto.

Deciso dal titolare la sera stessa: `prezzicorsi` **tirata fuori in Home**,
subito dopo la cartella, che resta con CRM e Storico allievi. È un dato
(nessuna pubblicazione), e si vede al ricarico della pagina.

### I carrelli sospesi sparivano, e nessuno poteva saperlo (7/11/2026, sera)

Dalla fiera, col banco aperto: «stanno sparendo i carrelli memorizzati, tra
cui uno molto importante di Ingrid che superava i 1200 euro». Vero, e la
causa non era una cancellazione.

**Com'è fatta quella lista, che è l'origine di tutto.** I carrelli sospesi
non hanno una tabella: stanno tutti dentro **una riga** di
`impostazioni_layout_tabelle` (chiave `pos_carrelliSospesi`), riscritta per
intero a ogni salvataggio da qualunque dispositivo. Per questo esiste la
fusione (`LISTE_DA_FONDERE`): prima di scrivere si rilegge il database e si
uniscono le due liste per id, così nessuno cancella il carrello di un
altro. Due difetti la scavalcavano, e si sommavano:

- **una rilettura fallita cancellava i carrelli degli altri.** Era scritta
  `try { const { data } = await … } catch { … }`, ma **il client di Supabase
  non lancia niente** quando una richiesta va storta: restituisce
  `{ data: null, error }`. Quindi il `catch` non è mai scattato, e un errore
  di lettura — la rete di una fiera, un 401, il server che tossisce —
  arrivava alla fusione come «di là non c'è niente»: si scriveva la copia di
  quel dispositivo, e i carrelli salvati dagli altri telefoni sparivano.
  Ora una lettura che non riesce **ferma la scrittura** e la rimette in coda
  (`riprovaInvioCondiviso`, cinque tentativi a passo crescente): meglio un
  carrello che arriva al server in ritardo che quelli degli altri cancellati
  subito;
- **«salvato» si diceva prima di saperlo.** Il messaggio compariva
  all'istante, la scrittura partiva 600 ms dopo e, se non riusciva, finiva in
  un `console.warn`. Al banco si svuotava il carrello fidandosi di quella
  riga, e il carrello viveva **solo su quel telefono**: alla prima ricarica
  della pagina non c'era più — e il 7/11 ce ne sono state tre, una per
  pubblicazione. Ora `sorvegliaSalvataggioSospeso` aspetta l'esito, dice
  «è salvato su QUESTO dispositivo ma non è arrivato al server, non
  ricaricare la pagina», e quando la riprova riesce lo dice anche: un avviso
  rosso che resta acceso dopo che il problema è passato si impara a ignorare.

E la rilettura automatica non si prende più indietro la copia locale
**mentre una scrittura di quella copia è in viaggio** (`LAYOUT_INVII`
accanto a `LAYOUT_TIMER`): la risposta del database è vecchia per
definizione, e sovrascrivere vorrebbe dire cancellare dal telefono l'unica
copia che esiste.

**Perché non si è potuto ripescare quello di Ingrid.** Quella riga non ha
mai avuto storico, e un carrello sospeso **non muove il magazzino** (i pezzi
sono promessi, non scaricati): nessuna riga cancellata, nessun movimento,
nessun log. Non restava niente da cui risalire — l'unica copia era nel
telefono di chi l'aveva salvato, e si distrugge appena l'app torna in
primo piano e rilegge il database. Da oggi c'è
**`carrelli_sospesi_storico`** (migrazione `20261107213000`, trigger su
`impostazioni_layout_tabelle`): ogni versione della lista, con quanti
carrelli aveva prima e dopo e **gli id spariti** in una colonna sua. Si
archivia solo quella chiave — le altre sono impaginazioni, e perderne una
non costa niente. Il trigger nomina `old` **solo dentro un ramo che gira
per forza su un UPDATE**: su un INSERT quella variabile non è assegnata e
nominarla farebbe fallire la scrittura, cioè rifiutare una chiave nuova di
quella tabella per colpa di un archivio.

**Resta da fare, e va deciso:** i carrelli sospesi meritano una tabella
propria, una riga per carrello. Finché sono un unico JSON riscritto per
intero, ogni salvataggio è l'occasione di cancellare il lavoro di un altro
— adesso ci sono tre difese e uno storico, ma la forma è quella sbagliata.
E nell'app non c'è ancora un posto da cui **ripescare** un carrello dallo
storico: oggi si fa con una query.

Prove in `prove/carrelli-sospesi-non-si-perdono.test.js` (8): la fusione
tiene il carrello di un altro telefono, toglie solo quello che questo
dispositivo ha davvero buttato, e la lettura fallita **non scrive niente** —
era esattamente così che sparivano.

### Si iscrive anche chi vive in Svizzera (7/11/2026, sera)

Il titolare: «estendi la possibilità di iscrivere clienti dalla
Svizzera, quindi il modulo di iscrizione deve recuperare anche città,
province e cap svizzeri, e anche lo Stato deve essere selezionabile».

**Com'era.** La cascata della residenza — stato → regione → provincia →
comune → CAP — valeva per l'Italia e basta. Fuori Italia si premeva
«Altro stato» e si tornava a **tre caselle di scrittura libera**, cioè
esattamente la cosa da cui quella cascata esisteva per scappare: dai
moduli a mano libera erano arrivati «Vollw» per Volla, «Rome» e il CAP
«148» senza lo zero davanti. Chi vive a Sion rientrava lì.

**Gli elenchi stanno per Stato, e la cascata è una sola.** Il pezzo
nuovo è `src/iscrizione/residenza.js`: `elencoResidenza(stato)`
restituisce chi fornisce regioni, province, comuni e codici postali di
quel paese, e i due posti che scendono per gradini — la scheda del
venditore (`AreeAnagrafiche.jsx`) e il modulo dell'allieva
(`PaginaModulo.jsx`) — non sanno di che paese stiano disegnando. Un
`if (svizzera)` avrebbe voluto dire due rami per paese in due file, e
il giorno della Francia sei rami con la certezza che uno si dimentica.

**I dati svizzeri** sono in `src/comuni-svizzera.js`: **26 cantoni e
4.141 località con i loro NPA**, 85 KB nel bundle come i 7.904 comuni
italiani — la residenza si compila senza chiamate di rete, anche col
telefono senza campo. Si rigenera con
`node genera-comuni-svizzera.mjs`, che interroga **OpenPLZ API**
(openplzapi.org), la quale pubblica l'«Amtliches
Ortschaftenverzeichnis» di swisstopo. Non si legge swisstopo
direttamente perché il suo file ufficiale è uno zip, e Node non apre
uno zip senza una dipendenza.

Tre cose decise lì dentro, e ognuna per un motivo:

- **sopra il cantone non c'è niente.** In Italia la regione serve a
  tagliare 107 province in gruppi scorribili; i cantoni sono ventisei e
  stanno in una tendina sola. Quindi l'elenco dichiara `conRegione`, e
  in Svizzera la casella «Regione» dice «—» invece di chiedere una cosa
  che non esiste;
- **le etichette dicono il vero**: Cantone, Località e **NPA**, che è il
  nome del codice postale svizzero ed è quello scritto sulla busta.
  Valgono anche sulle righe bloccate del modulo, o un cantone
  comparirebbe sotto l'etichetta «Provincia». Le frasi delle tendine
  stanno **scritte** e non composte dall'etichetta: «— scegli l'NPA —»
  non si ricava senza indovinare un articolo, e un articolo indovinato
  si vede;
- **i nomi dei cantoni restano quelli della fonte**, bilingui dove lo
  sono («Valais / Wallis», «Graubünden / Grigioni / Grischun»), con la
  sigla accanto. «Svitto» e «Sciaffusa» sono italiano corretto e non li
  riconosce nessuno, e sulla busta c'è scritto l'altro: tradurli
  vorrebbe dire inventare un dato che la fonte non ha.

**Lo Stato ADESSO SI SCEGLIE, in tutti e due i posti.** Nella scheda
erano due voci — Italia e «Altro stato» — e il nome del paese si
batteva a mano: «SVIZERA» e «Svizzera» sono due paesi diversi per
chiunque debba contare. Ora la tendina porta Italia e Svizzera (quelle
con l'elenco), poi gli altri 230 Stati della lista ISTAT — la stessa
dello stato di nascita — e in coda «Altro stato», che apre la scrittura
libera **solo** per quello che in quella lista non c'è. Il modulo usa
la stessa lista e **la stessa scrittura in maiuscolo**: prima scriveva
«Svizzera» e la scheda «SVIZZERA», cioè due forme della stessa cosa in
archivio. Nel modulo la voce «Altro stato» non c'è, perché di là non
esiste una casella accanto in cui scrivere il nome, e una voce che apre
il vuoto è peggio di una voce che manca. Uno Stato che in archivio c'è
e nella lista non c'è **resta in coda marcato**: una tendina che mostra
il vuoto si spedisce senza accorgersene.

**E nel modulo l'allieva scegli anche il cantone.** Di qua la provincia
era una casella libera e la cascata partiva dal comune già scritto dal
venditore; per una svizzera che compila da zero non ci sarebbe stato
modo di arrivare alla propria località. Ora **dove sopra la provincia
non c'è niente** quella casella diventa una tendina — i ventisei
cantoni — e da lì scendono località e NPA. In Italia resta com'era: 107
province senza il gradino della regione sarebbero un elenco da scorrere
a vuoto, e quella casella la riempie quasi sempre il venditore.

**Cambiare paese cancella la sigla e il codice postale, non la città.**
Una sigla italiana sotto un indirizzo svizzero non vuol dire niente, e
un NPA sotto un indirizzo italiano nemmeno; un nome di città invece è
un nome, e se di là non esiste si vede marcato «fuori elenco» invece di
sparire senza dirlo. E **si guarda l'elenco, non il nome dello Stato**:
253 schede su 260 hanno la residenza italiana e lo Stato mai scritto,
quindi la casella vuota vale Italia — se passare dal vuoto a «Italia»
contasse come un cambio di paese, chi non ha fatto altro che dichiarare
l'ovvio cancellerebbe la residenza di quella persona.

**Un normalizzatore solo.** `normalizzaNome` era scritto due volte,
identico, in `AreeAnagrafiche.jsx` e in `comuni-regioni.js`: adesso è
uno (`normalizzaLuogo`, esportato di là e riesportato di qua). Due idee
di «stesso nome» un giorno si staccano, e quel giorno un comune che in
archivio c'è non si riconosce più nell'elenco.

**E LO STATO E' LA PRIMA CASELLA DI LUOGO CHE SI INCONTRA** (7/11/2026,
provando a iscrivere un allievo: «la selezione dello stato deve essere
la prima cosa che trovi in lista, altrimenti, trovando per prima la riga
della città, il risultato sarà sempre sbagliato»). Era una regola
mancante in due punti, e in entrambi il danno era lo stesso: chi compila
riempie dall'alto in basso, e una casella di luogo incontrata prima
dello Stato si riempie col paese sbagliato.

- nella **nascita** il «Comune» stava prima dello «Stato»: lo si cercava
  nell'elenco italiano — dove il paese di chi è nato a Sion non c'è — e
  solo dopo si trovava lo Stato. Che, scelto estero, **cancella il
  comune appena scritto**, perché un comune italiano sotto una nascita
  svizzera non vuol dire niente. Ora lo Stato viene prima e la casella
  del comune si spegne da sé — e il codice fiscale, che da quel comune
  si calcola, non nasce più da un dato da rifare;
- nella **residenza** la «Via» stava sopra lo Stato: si scriveva la via,
  il suggerimento portava con sé comune, provincia e CAP presi
  dall'elenco italiano **e scriveva «ITALIA» nello Stato**, e solo dopo
  si arrivava alla tendina. Per un allievo svizzero il risultato era
  sbagliato prima di cominciare. Ora la cascata è intera e in ordine —
  Stato → Regione/Cantone → Provincia → Comune/Località → CAP/NPA — e
  **la via viene per ultima**: l'indirizzo si legge dall'alto in basso
  come si scrive su una busta, e non si perde il «un tocco invece di
  cinque», perché la proposta riempie ancora quello che è vuoto e con il
  comune già scelto la ricerca si restringe a lui.

L'ordine è una riga di `disposizione.js`, quindi vale **insieme** nella
scheda del venditore, nel modulo dell'allieva e in Impostazioni → Modulo
di iscrizione. Una prova lo blocca confrontando la posizione delle
caselle nella pagina: senza, il giorno che qualcuno rimette la città
davanti non se ne accorge nessuno finché non arriva un altro allievo
straniero.

**UN ELENCO LUNGO SI CERCA, NON SI SCORRE** (7/11/2026, provandola:
«metti la barra di ricerca dove posso scrivere almeno qualche lettera,
per non farmi scorrere tutta la lista»). Gli Stati sono 232 e stavano in
una tendina sola: sul telefono, per arrivare al Portogallo si scorreva
fino in fondo. `CampoCerca.jsx` e' la stessa casella del comune di
nascita con una differenza che e' tutta: **li' quello che si scrive e'
il valore, qui e' solo un filtro**. L'elenco resta CHIUSO — finche' non
si tocca una voce non si e' scelto niente, e «SVIZERA» battuto a mano
non diventa un paese. Si cerca come si scrive (ogni parola e' l'inizio
di una parola del nome: «arab sa» trova Arabia Saudita), si mostrano
dodici voci e **si dice che ce ne sono altre** — dodici righe su
duecentotrentadue sembrano l'elenco intero, e chi non trova il suo paese
crede che non ci sia. Vale per lo Stato di residenza e per quello di
nascita, nella scheda e nel modulo.

**«Identificativo fiscale personale (TIN)»** (7/11/2026, dicitura
dettata dal titolare). Da quando si iscrive anche chi vive in Svizzera,
«Codice fiscale» era il nome di una cosa sola fra le tante che quella
casella puo' contenere. Ma la dicitura da sola sarebbe stata una
bugia: sotto c'erano i **sedici caratteri obbligati**, il filtro che
tiene solo lettere e numeri — e quindi mangia i punti dell'AHV svizzero,
che si scrive `756.1234.5678.97` — l'avviso «mancano quattro caratteri»
addosso a chi aveva scritto il numero giusto, e il **calcolo automatico**
che avrebbe proposto un codice italiano a una svizzera. Ora tutte e
quattro quelle regole valgono **solo per chi risiede in Italia**
(`campoFiscale` in residenza.js, un posto solo per scheda e modulo);
fuori si scrive quello che c'e' sul documento e nessuno lo corregge.
L'avviso dei sedici caratteri nomina «il codice fiscale» e non
l'etichetta intera (`nomeAvviso`): esce solo per chi risiede in Italia,
dove quella cosa si chiama cosi'.

**E I PUNTI DELL'AVS LI METTE LA CASELLA** (8/11/2026, chiesto dal
titolare provando l'inserimento: «mentre scrivi non appaiono i punti
automaticamente, che sarebbe perfetto»). Si battono le sole cifre e
`756.1234.5678.97` si compone da se', cifra dopo cifra; sul telefono
esce il tastierino numerico.

**Quel numero non si puo' CALCOLARE, e non e' una mancanza**: dal 1°
luglio 2008 l'AVS e' *non significativo* — `756` (la Svizzera) + nove
cifre **estratte a caso** + una cifra di controllo EAN-13 — e dentro non
c'e' niente della persona, apposta, perche' il vecchio numero conteneva
data di nascita e sesso. Il codice fiscale italiano si calcola perche'
*contiene* nome, sesso, data e comune; l'AVS lo assegna la Centrale di
compensazione e si copia dalla tessera. L'unica automazione possibile su
di lui e' il **controllo** della cifra finale, che prenderebbe una cifra
invertita o saltata: offerta al titolare, **non ancora chiesta**.

La formattazione sta in `formattaFiscale(testo, campo)` (residenza.js),
che e' l'unico posto in cui si decide cosa fa quella casella mentre si
scrive: la chiamano sia la scheda del venditore sia il modulo
dell'allieva, perche' due copie vorrebbero dire un numero accettato di
qua e rifiutato di la', sullo stesso documento. Il paese viaggia col
campo (`paeseFiscale`, scritto da `campoFiscale`). Due regole, e sono
tutte e due protezioni: **se c'e' una lettera non si tocca niente** (un
italiano che vive a Lugano in quella casella ci scrive il suo codice
fiscale, e levargli le lettere per fare spazio ai punti sarebbe, al
contrario, il guasto da cui veniamo) e **si raggruppa solo cio' che sta
diventando un AVS**, cioe' le cifre che cominciano per 756. Un punto non
si appiccica mai in coda a un gruppo finito: con «756.» gia' scritto il
tasto cancella toglierebbe il punto, la formattazione lo rimetterebbe, e
la casella sembrerebbe inchiodata. Prove in
`prove/residenza-svizzera.test.jsx`, dove si batte una cifra alla volta.

**I DUE STATI SUBITO DOPO IL NOME** (7/11/2026, dettato dal titolare
dopo averlo provato davvero: «l'ordine deve essere nome, cognome, stato
di nascita, stato di residenza, poi i dati della nascita e tutto il
resto»). Il primo giro li aveva messi in mezzo, e **non bastava**: il
titolare ha visto il guasto compilando — «il codice fiscale sotto
continuava a essere calcolato come quello dell'Italia».

**Perche' succedeva, ed e' il punto.** La casella vuota dello Stato vale
Italia, ed e' giusto che valga Italia: 253 schede su 260 sono italiane e
quello Stato non l'ha mai scritto nessuno. Ma vuol dire che mentre si
scrivono nome, sesso, data e comune di nascita il codice fiscale
italiano **e' gia' stato calcolato e scritto**; si sceglieva la Svizzera
dopo, e quel codice restava li'. Scritto dall'app, davanti a chi
incassa, e nessuno lo mette in dubbio — e' la stessa famiglia di guasti
del «conto giusto sul periodo sbagliato».

Due correzioni, perche' una sola non bastava:

- **l'ordine toglie l'occasione**: i due Stati si incontrano subito dopo
  il nome, prima di qualunque dato che da loro dipenda;
- **e il codice che abbiamo scritto NOI se ne va col paese**: scelto uno
  Stato senza elenco, la casella fiscale si svuota se dentro c'e'
  esattamente quello che avevamo proposto noi. Quello che ha scritto una
  persona **non si tocca**, come sempre.

L'ordine dei «Dati dell'allievo» adesso e':

```
nome e cognome → STATO di nascita, STATO di residenza
→ sesso, data di nascita, comune di nascita
→ identificativo fiscale (TIN)
→ regione, provincia → comune e CAP
→ via e civico → email → tutor e cellulare
```

**UN ELENCO LUNGO SI CERCA, OVUNQUE** (8/11/2026). La casella che si
cerca non vale più solo per gli Stati: `Tendina` la usa da sé **oltre le
venti voci** (`QUANTE_SI_SCORRONO` in AreeAnagrafiche, e la stessa
soglia nel modulo). Venti perché le regioni italiane sono venti e si
scorrono benissimo, e le province di una regione non arrivano a dodici;
sopra no — i comuni di Torino sono 312, le località del Vallese 303, i
CAP di Roma 82, e sul telefono una tendina così è un rullo che gira. La
soglia sta in **un posto solo**, quindi vale anche per le tendine che
nasceranno domani.

**E si cerca anche per sigla.** `normalizzaLuogo` butta via quello che
sta fra parentesi — serve per i nomi dei comuni — e così «Valais /
Wallis (VS)» perdeva proprio la sigla, che è quella che uno scrive: il
**valore** della voce entra nel testo da cercare. Trovato dal banco di
prova, non dall'uso.

**E LA COPIA FIRMATA DICE LE STESSE PAROLE** (`_shared/modulo-pdf.ts`).
Il PDF che l'allieva riceve allegato alla conferma scriveva ancora «Dati
dell'allievo/a» e «Codice fiscale» mentre la schermata diceva «Dati
anagrafici» e «Identificativo fiscale personale (TIN)». Non e' una
differenza di stile: chiamare «codice fiscale» un AHV svizzero e' dire
una cosa falsa dentro un documento che una persona sottoscrive. Allineato
— e **va pubblicata `modulo-ricevuto`**, che e' la funzione che compone
quel PDF: finche' non lo e', ogni copia nuova esce con le parole vecchie.
I PDF gia' archiviati non si toccano e non si devono toccare: sono la
fotografia di quello che quella persona ha firmato quel giorno.

**L'area si chiama «Dati anagrafici»** e non piu' «Dati dell'allievo», e
dentro ha un'intestazione sua: **«Dati residenza:»**, subito dopo il
campo fiscale. Raccoglie due cose diverse — chi e' quella persona e dove
vive — e da li' in giu' comincia la seconda. Un'intestazione e' una riga
della disposizione con un `titolo` e **`campi: []`**, che non e' una
svista: tutto quello che legge quelle righe le scorre con `r.campi`, e
una riga senza quella lista farebbe cadere la pagina invece di saltare
l'intestazione. Nel modulo dell'allieva si disegna **solo se almeno uno
dei campi che le stanno sotto e' davvero arrivato** (`dipendeDa`): li'
le caselle sono quelle che Impostazioni ha acceso, e un'intestazione
sopra il nulla e' peggio di un'intestazione che manca.

Il campo fiscale sta **subito sotto la data di nascita**, dove chi
compila se lo aspetta, e puo' starci perche' sopra di lui ci sono gia'
tutte e due le cose che devono essere decise prima: i dati da cui si
calcola, nella riga appena sopra, e lo Stato di residenza che decide con
quale metro si misura, due righe piu' su. L'ordine qui non e' un gusto,
e' la lista di quello che deve essere gia' stato deciso.

I due si chiamano per esteso — «Stato di nascita» e «Stato di residenza»
— perche' affiancati, uno dei due chiamato solo «Stato» non si sa di che
cosa sia lo stato. Due prove bloccano tutto questo: l'ordine,
confrontando la posizione vera delle caselle nella pagina, e il codice
italiano che se ne va quando il paese cambia.

**E una cosa che il banco di prova ha misurato, e che spiega l'ordine
meglio di qualunque ragionamento:** finche' la scheda e' italiana quella
casella fa rispettare la *forma* del codice italiano — sei lettere, poi
le cifre, poi il mese — quindi un AHV svizzero scritto li' dentro
**non sopravvive alla battitura**. Non e' un difetto del filtro: e' il
motivo per cui lo Stato va scelto per primo.

**LA VIA SI CERCA ANCHE IN SVIZZERA** (8/11/2026). Le vie svizzere
stanno su OpenStreetMap come le italiane: mancava solo **dire a quale
paese chiederle**. L'elenco della residenza dichiara il suo codice
(`paese: "IT"` / `"CH"`), l'app lo passa a `cerca-indirizzo`, e la
funzione lo usa al posto dell'«IT» che era scritto a mano. Chi non lo
manda cerca in Italia, come ha sempre fatto. Il paese entra anche nella
memoria corta della funzione: senza, la stessa via cercata prima in
Italia e poi in Svizzera avrebbe risposto con la risposta di prima. Col
comune già scelto il paese si controlla **solo se Photon lo dice** —
scartare le righe senza `countrycode` toglierebbe risultati buoni che
oggi arrivano. Dove un elenco non c'è (gli altri 230 Stati) **non si
cerca**: la proposta porterebbe un comune e un codice postale che
nessuno sa risolvere. E `riempiDaVia` risolve la proposta contro
l'elenco del paese scelto, quindi da una via svizzera escono il cantone
e l'NPA invece di una sigla italiana.

**Quello che NON copre, e va saputo:** la **fatturazione** a un cliente
estero non è stata toccata — lì «Provincia» e codice destinatario
vogliono una decisione sulla fattura, non un elenco.

Prove in `prove/residenza-svizzera.test.jsx` (16): l'elenco (ventisei
cantoni, Sion 1950, Lugano 6900, Zurigo con molti NPA, il Belgio che
elenco non ha) e il gesto, col pannello e col modulo montati per
davvero — si scegli la Svizzera, il cantone si apre **subito**, la
località scrive l'NPA da sé, a Zurigo l'NPA si scegli, le etichette
dicono Cantone e NPA, e dichiarare «Italia» su una scheda italiana non
cancella niente. In `prove/residenza-a-cascata.test.jsx` la prova che
diceva «una residenza svizzera apre in scrittura libera» adesso dice
il contrario: era giusta finché quell'elenco non c'era.

### «Modelle fiera»: il consenso al banco, legato alla fiera (7/11/2026)

Il titolare, con la fiera di Napoli aperta: «a quelli in fiera nella home
page devi mettere un tasto con i consensi informati da poter far
compilare alle modelle in fiera. Il tasto si chiama Modelle fiera e lo
posso sbloccare io agli utenti a richiesta. Per adesso lo attivo di
default a tutti quelli in fiera.»

**Perché non bastava quello che c'era.** Un consenso si firma inquadrando
un QR, e i QR erano di due specie: quello della scheda di una **classe**,
che porta con sé l'edizione, e quello **generico**, che non porta niente.
In fiera una classe non c'è, quindi restava solo il generico — cioè
esattamente il guasto di ottobre scritto in `QrConsensi.jsx`: sette
consensi che non sapevano a quale corso appartenessero, mentre giravano
due PMU BASE con le stesse date, e nessuno dei due poteva più
rivendicarli. In fiera sarebbe peggio: le modelle sono molte, di nessuna
classe, e se una domani contesta un trattamento quel foglio va ritrovato.

Quindi il QR del banco porta la fiera (`?consenso=<codice>&evento=<id>`) e
la scrive in **`consensi_modelle.evento_id`** (migrazione
`20261107150000`). `salvaConsenso` non prende più «la classe» come terzo
argomento ma **a chi appartiene** (`{ corsoDataId, eventoId }`): mai tutti
e due, perché una firma appartiene a un posto solo. Niente dei due vuol
dire «codice generico», e si ritrova solo nell'archivio generale.

**Un trattamento per volta, e non sei QR in fila.** In aula i codici sono
quelli del corso, e un corso sta su un consenso solo; al banco i modelli
sono tutti e sei. Sei codici accanto su un tavolo vogliono dire una
modella trattata a microneedling che firma il modulo del trucco
permanente — e le domande sulla salute non sono le stesse. Si preme prima
il trattamento, poi compare il suo codice, da solo. Si può stampare e
appendere al banco.

**Senza una fiera aperta la pagina non mostra niente**, e lo dice: un
consenso senza la sua fiera, fra un mese, non si sa più di quale evento
era. La fiera è già scelta quando ce n'è una sola, altrimenti si scegli
da una tendina. In fondo alla pagina ci sono le modelle che hanno già
firmato **a quella fiera**, col riepilogo dei «sì» sotto ogni nome — è
quello che si guarda prima di toccarla — e un tasto «Aggiorna», perché
lei firma dal suo telefono e la pagina non se ne accorge da sola.

**Il permesso è una casella vera** (`modellefiera` in `TASTI_HOME`), e si
sblocca a richiesta da Gestione utenti / Password master / venditori /
assistenti. **Non** sta in `PERMESSI_DI_PARTENZA`: un utente nuovo non la
trova dentro da sé — è l'opposto di `registrazioneclienti`, e lo ha detto
il titolare («lo posso sbloccare io agli utenti a richiesta»). Nessun
bypass per chi amministra.

**Acceso adesso a chi sta al banco, per id e su tutte le identità.** La
migrazione non nomina nessuno: ricava le righe da
`eventi_team.vende_al_banco` — la stessa spunta che decide da dove parte
il POS — e risale ai legami (`master.venditore_id`,
`utenti_app.venditore_id`, `assistente.master_id`). Sono **14 righe per
otto persone**, più il profilo Programmatore che serve a verificarla:
ANDREA PAURA nel team è il venditore «ANDREA», entra come master e ha
anche una riga assistente; ELIA CITO il contrario. Accendere il permesso
su una sola identità vuol dire una tessera che c'è o non c'è secondo la
password battuta, e nessuno capirebbe perché.

Prove in `prove/modelle-fiera.test.jsx` (13): dove finisce scritta
l'appartenenza (fiera, classe, o niente col codice generico), che i
consensi di una fiera si chiedano per la loro colonna, la pagina montata
per davvero — una fiera sola già scelta, nessun codice prima del
trattamento, il codice che porta `&evento=` e non `&edizione=`, due fiere
fra cui scegliere, nessuna fiera aperta — e la tessera in Home, che c'è
solo per chi ha la casella.

### Quanto sconto ha preso QUESTO prodotto (7/11/2026)

Le ragazze al banco della fiera di Napoli: «per ogni prodotto vogliono
vedere quale percentuale il programma ha calcolato con lo sconto fiera,
perché la cliente glielo chiede. Quando battono gli aghi vogliono vedere
sugli aghi che percentuale è stata fatta, poi sul pigmento quella del
colore». E il motivo: «calcola il prezzo intero e poi applica la
percentuale tutta insieme nel carrello, così non si capisce qual è il
prezzo intero e qual è il prezzo scontato di ciascuna riga».

**La percentuale di riga c'era già, e nessuna l'ha mai vista.** Era
scritta in fondo al NOME del prodotto, dentro un riquadro con
`white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`:
cioè un riquadro che taglia quello che non ci sta, e quello che non ci
sta è sempre l'ultima cosa — proprio lo sconto. Su un telefono, con i
nomi che hanno i prodotti qui («Excellentia Siero ricrescita Ciglia —
Espositore 10pz»), l'ellissi se lo mangiava per primo. **Una cosa
aggiunta in fondo a un riquadro che taglia non esiste**, e non lo dice
nessun errore: il numero era calcolato giusto e disegnato fuori dallo
schermo. Adesso sta sulla riga del prezzo, che manda a capo invece di
tagliare, e una prova controlla che il riquadro del nome non contenga
percentuali.

**Cosa si legge adesso**, sulla riga di ogni prodotto del carrello:
`36,60 € → 32,21 € −12% · 2 pz 64,42 €` — il prezzo pieno barrato,
quello scontato, la percentuale di quella riga, e con più di un pezzo
quanto fa la riga intera.

**Il prezzo del pezzo si ricava DALLA RIGA**, non il contrario: totale
della riga diviso i pezzi. Scontare il pezzo e moltiplicarlo
incasserebbe un centesimo in più di quello che la vendita registra — tre
pigmenti fanno 96,62 €, che su tre pezzi non è divisibile (32,2066…), e
32,21 × 3 fa 96,63. Per questo con più di un pezzo si scrive «al pezzo»
e accanto il totale della riga: il pezzo è arrotondato, il conto che fa
fede è quello della riga, e i due numeri si leggono per quello che sono
invece di sembrare l'uno il triplo dell'altro.

**Una riga che non prende niente lo dice** («Su questo nessuno sconto:
prezzo pieno»), ma solo quando una regola di sconto sta valendo sul
carrello. È il caso che al banco si chiede per primo: la cliente ha
visto lo sconto sul pigmento e lo chiede anche sull'altro. Succede quando
del prodotto non risulta il costo di acquisto — senza margine non c'è
niente da cedere. Il riquadro dei totali li elencava già, ma lontano da
lì.

**E il conto di riga adesso è uno solo** (`scontiPerRigaCarrello`).
Erano **due copie della stessa formula** a quattrocento righe di
distanza: una per il carrello che si guarda, una per la vendita che si
registra. Finché quel numero lo leggeva solo chi vende era una
duplicazione; **da quando lo legge la cliente davanti al banco, due
copie vogliono dire un prezzo detto e un prezzo incassato che possono
non coincidere.** Dentro c'è anche il riproporzionamento — se la somma
delle righe non fa lo sconto del totale, per i centesimi o per il tetto
al subtotale, si riproporziona e la differenza va sull'ultima riga — che
prima faceva solo la vendita: era l'unico punto in cui i due numeri si
staccavano davvero.

**Un difetto trovato strada facendo, e sono margini.** Col codice di
acquisto di una master lo sconto è in euro per pezzo (il cedibile), e per
riga non lo calcolava nessuno: le righe venivano tutte zero e il
riproporzionamento buttava **l'intera differenza sull'ultima riga del
carrello**. Il totale era giusto — quello che la master pagava non
cambia — ma `sconto_riga`, `sconto_pct` e `totale_riga` attribuivano
tutto a un prodotto solo, e con essi il margine per prodotto nelle
statistiche. Ora ogni riga porta il suo.

**E la ricevuta dice lo stesso numero.** Le righe che la cliente vede
quando paga — pagina di Stripe, QR, ricevuta — spalmavano lo sconto in
proporzione al lordo, con **un solo fattore per tutte**: il totale
tornava, ma un pigmento scontato del 12% e un pezzo senza margine
scontato dello 0% comparivano ridotti della stessa media. Finché al
banco non si diceva niente di riga era invisibile; da quando la riga
dice «36,60 → 32,21 −12%», la ricevuta direbbe un terzo numero. Ora
quelle righe nascono da `scontiPerRigaCarrello` come tutto il resto
(`righeDaPagare`), e il fattore resta solo per i due casi in cui il
totale non è la somma delle righe: le provvigioni scalate e l'omaggio.
In una vendita normale vale esattamente 1.

Prove in `prove/sconto-di-riga-al-banco.test.jsx` (17): la regola —
margini diversi danno percentuali diverse sulla stessa vendita, la somma
delle righe fa **esattamente** lo sconto del carrello, lo sconto più
grande del carrello non sfonda le righe, l'omaggio, il codice della
master — e il gesto, col POS vero montato: si batte il prodotto e si
legge la riga, compresa quella con due pezzi.

### Il POS di chi sta al banco parte dalla fiera (7/11/2026)

Il titolare, sabato mattina con la fiera di Napoli aperta: «Da oggi fino a
lunedì i POS della vendita al banco di Elia Cito, Andrea Paura, Stefano
Di Napoli, Elena Rocca, Maria Stella Quaresima e Olga devono essere
impostati di default su vendita legata a un evento, fiera di Napoli.
Sconto fiera. Fino a lunedì ore 20.»

**Perché la regola normale qui è rovesciata.** Al banco si parte sempre
da «vendita non legata a un evento» e lo sconto fiera nasce spento: è la
stessa regola del corso («NESSUNA PRESELEZIONE DEL CORSO»), scritta
perché una vendita agganciata da sola a una classe si porta addosso lo
sconto degli allievi senza che nessuno l'abbia chiesto. Per i tre giorni
di una fiera però **tutte** le vendite di chi sta a quel banco sono di
quella fiera, e il giro giusto va ripetuto a mano a ogni scontrino. Chi
se lo dimentica fa due danni insieme: la vendita resta fuori dal conto
della fiera — e il materiale partito non torna in pari al rientro — e il
cliente paga pieno davanti a un banco che lo sconto lo fa.

**Dove vive, e perché non in App.jsx.** Sei nomi e una scadenza scritti
nel codice sarebbero una regola che vive nel browser: per spegnerla, o
per tenerla accesa un'ora in più lunedì sera, servirebbe una
pubblicazione. Sta accanto alla fiera a cui appartiene
(`20261107100000_pos_parte_dalla_fiera.sql`): `eventi_team.vende_al_banco`
dice **chi**, `eventi.pos_banco_fino_al` **fino a quando** e
`eventi.pos_banco_sconto_fiera` se parte anche lo sconto. Si cambia da
Gestione eventi → scheda della fiera → Team, dal riquadro **«Il banco
della fiera»**: la spunta verde a sinistra di ogni nome, l'ora, e
«Spegni». Senza l'ora scritta non si preseleziona niente — che è il
comportamento di sempre per ogni altro evento, passato e futuro.

**«Chi viene alla fiera» e «chi batte gli scontrini» non sono la stessa
lista.** Per questo la spunta è per persona e non per evento: una
preselezione addosso a chi in quei giorni tiene un corso suo altrove
aggancerebbe alla fiera le vendite della sua aula, con lo sconto della
fiera sopra. Nel team di Napoli c'erano dieci righe; il titolare ne ha
nominate sei, e messo davanti ai nomi delle altre due con un'anagrafica
(CHIARA COLONNELLI, VALENTINA CALASCIBETTA) ha aggiunto anche quelle:
**otto**. Le due righe **libere** (Miranda Raffaele, Gianluca Rocca)
restano fuori per forza — senza anagrafica non hanno un'identità
nell'app, quindi non hanno un POS.

**La parte che si sbaglia senza accorgersene: le identità.**
`operatoreCorrente` restituisce **una** identità, quella della password
battuta; in anagrafica la stessa persona ne ha due o tre, e nel team sta
con quella dell'elenco da cui è stata presa. ANDREA PAURA nel team è il
**venditore** «ANDREA» e nell'app entra come **master**; ELIA CITO il
contrario. Una regola scritta su una sola identità li mancherebbe in
silenzio, cioè al banco, davanti al cliente.
`identitaDellaPersona` le unisce **per id** — `master.venditore_id`,
`assistente.master_id` — e **mai per nome**: «ANDREA» e «ANDREA PAURA»
sono la stessa persona e due stringhe diverse, e questa lezione il
progetto l'ha già pagata con la notifica del modulo al venditore.

**Resta una partenza, non un obbligo**, e si dice: sopra la tendina
compare «Sei fra chi vende al banco di *Fiera di Napoli*… se questa
vendita non è della fiera, cambia qui sopra». Una preselezione muta su
dove va la vendita e su quanto paga il cliente è il modo di non
guardarla più, e di non accorgersi il giorno in cui è sbagliata. La
scelta di chi vende vince sempre e non torna indietro (`bancoDeciso`),
anche quando è «nessun evento». E **si spegne da sé**: passata l'ora il
POS riparte da «nessun evento» senza che nessuno debba togliere le
spunte. Quell'ora decide da dove il banco **parte**, non taglia un
carrello aperto a metà.

**E la spedizione parte spenta** (7/11/2026, chiesto il giorno stesso:
«togli la spedizione di default dai POS settati in fiera a Napoli»). Al
banco la merce esce dallo scatolone ed entra nella borsa della cliente:
con il carrello ancora vuoto si leggeva «Totale da incassare 6,90 €», e
su uno scontrino di fiera sono soldi chiesti per un servizio che non
c'è. La spedizione nasce accesa per decisione del titolare del 23/10
(«meglio che le toglie la master piuttosto che le dimentica»), che a un
corso è giusta: quella decisione **non è stata ribaltata per tutti** —
si spegne sul solo POS che parte da una fiera, dove la consegna a mano
non è l'eccezione ma la regola. Resta una partenza e non un divieto: chi
vuole il pacco a casa riaccende la spunta. Una prova controlla le due
facce — spenta al banco, accesa per chi al banco non c'è.

**Da sapere, e da decidere**: oggi la spedizione è accesa **solo sul
primo carrello** dopo l'apertura del POS. Dal secondo in poi
`nuovaVendita` la spegne, e si riaccende scegliendo un corso o
un'allieva. Quindi il «accesa di default» del 23/10 vale in pratica per
una vendita sola a sessione. Non è stato toccato: è una decisione del
titolare, e va ridetta, non indovinata.

**Un buco trovato strada facendo, e sono soldi.** La fotografia di un
carrello sospeso salvava `scontoFiera` ma **non la fiera**: ripreso dopo
un ricaricamento della pagina, `eventoPosId` era vuoto, e lo sconto
fiera senza evento non è «disponibile» — spariva in silenzio insieme
alla sua spunta, che si vede solo con un evento scelto. Il cliente
pagava pieno. Ora `eventoPosId` sta nella fotografia; un carrello
salvato prima non ce l'ha e si riprende con la fiera che la
preselezione ha già messo.

Prove in `prove/pos-parte-dalla-fiera.test.js` (16, la regola: le
identità doppie, le righe libere, lunedì alle 19:59 sì e alle 20:00 no,
la fiera conclusa, due fiere aperte) e
`prove/pos-parte-dalla-fiera-al-banco.test.jsx` (3, il gesto: il POS
vero montato, la tendina già sulla fiera, la spunta accesa, e chi non è
al banco che si apre come sempre).

### Due buchi trovati dal banco di prova, non dall'uso (4/11/2026)

Entrambi erano in produzione da ieri, e li ha trovati `npm test` — che
ieri non è stato lanciato dopo le ultime aggiunte. Vale come promemoria:
le tre verifiche prima del push non sono una formalità.

- **Le tessere nuove non avevano la guida.** `registrazioneclienti` e
  `stampe` erano in `TASTI_HOME` ma non in `AREE_GUIDA`, quindi
  l'assistente non sapeva spiegarle: alla domanda «come registro un
  cliente» non avrebbe avuto niente da dire. La prova che controlla che
  **nessun tasto resti senza guida** esiste proprio per questo, ed era
  rossa. Aggiunte le due schede (senza cifre: quella regola vale anche
  qui, e c'è una prova che la fa rispettare).
- **La prova della conversazione a voce era rimasta al patto vecchio.**
  Dal 3/11 la frase si consegna dopo **900 ms di silenzio** e non appena
  il browser la dichiara definitiva; la prova aspettava 120 ms e se ne
  andava prima che la domanda fosse partita, poi dava la colpa alla
  lettura. Ora aspetta il silenzio — e prima controlla che il silenzio
  serva davvero, altrimenti allungare l'attesa nasconderebbe un ritorno
  alla consegna immediata. La lettura si verifica sui pezzi **riuniti**,
  perché la voce legge a frasi e quante frasi stiano in un pezzo dipende
  da una soglia che può cambiare.

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

**Un push non garantisce una pubblicazione (4/11/2026).** Il commit
`cd55723` («Gli sconti della fiera si copiano anche dalle master») era su
GitHub dalle 10:56, e alle 20:45 il sito serviva ancora `8937c43`, di
un'ora prima: il collegamento GitHub -> Vercel non ha preso quel commit,
e non ha lasciato nemmeno una build fallita. Il titolare cercava un tasto
che nel codice c'era e online no.

Come si riconosce, perche' da fuori sembra un difetto della pagina: si
confronta `git ls-remote origin main` con lo sha dell'ultima
pubblicazione in produzione, e nel dubbio si scarica il bundle servito e
ci si cerca dentro una frase nuova (qui bastava «referral personale delle
master»: assente). Un tasto che manca a video e c'e' nel sorgente e'
quasi sempre una delle due cose, e vanno escluse in quest'ordine: la
pubblicazione che non e' partita, e la scheda aperta da ore (il punto qui
sotto).

Quindi: **dopo un push che deve arrivare a qualcuno, si controlla che lo
sha pubblicato sia il proprio.** La ripartenza si fa dal pannello Vercel
(Redeploy) o con un commit nuovo, che fa ripartire il collegamento.

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
