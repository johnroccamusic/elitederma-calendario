// src/content/consenso-laminazione-v1.ts
//
// Il consenso informato per la LAMINAZIONE CIGLIA, dal modulo fornito il
// 19/10/2026. Terzo modello dopo PMU/Micro e needling.
//
// LA VERSIONE SI CHIAMA "laminazione-v1" E NON "v1": vedi la nota in
// `consensi.ts`. Il nome della versione porta dentro il modello, cosi'
// una firma non puo' finire sotto il testo di un altro documento.
//
// COSA E' STATO TRASFORMATO, E PERCHE'.
//
// Il PUNTO 4 del cartaceo e' un elenco di dichiarazioni al NEGATIVO: «di
// non soffrire di patologie oculari», «di non avere allergie note». Qui
// sono diventate domande al POSITIVO con risposta obbligatoria — «Soffre
// di patologie oculari?» — e il motivo non e' stilistico.
//
// Una dichiarazione al negativo si firma in blocco: si accetta tutto
// insieme senza rileggere, e una condizione che c'era passa sotto
// silenzio senza che nessuno l'abbia mai nominata. Una domanda vuole una
// risposta sua, e un "sì" si vede: finisce nel riquadro che la master
// legge prima di toccare la modella, e quello e' il momento in cui
// serve. Il senso del documento non cambia: chi risponde "no" a tutte ha
// dichiarato esattamente quello che firmava prima.
//
// Il resto del PUNTO 4 — maggiore età, buono stato di salute, e la
// consapevolezza che una condizione taciuta solleva la scuola — resta
// nel testo, perche' li' e' una dichiarazione e non una domanda.
//
// FOTO E VIDEO: il cartaceo non ne parla, e nel TESTO infatti non c'e'
// niente che io abbia inventato. La casella facoltativa fra quelle da
// spuntare invece c'e', ed e' la stessa degli altri consensi: il modulo
// la mostra comunque, e una spunta senza una frase che dica a cosa serve
// e' peggio della frase.

export const consensoLaminazioneV1 = {
  versione: "laminazione-v1",
  titolo: "CONSENSO INFORMATO",
  sottotitolo:
    "Relativo al trattamento di Laminazione Ciglia eseguito durante corso formativo Elitederma Srl",

  trattamenti: [
    "Laminazione ciglia",
    "Altro",
  ],

  // LE CASELLE CHE RENDONO VALIDO IL CONSENSO.
  //
  // Una spunta sola che diceva "ho letto e compreso, le informazioni
  // sulla mia salute sono vere, e acconsento al trattamento" teneva
  // insieme tre consensi distinti: non si poteva dire a quale la persona
  // avesse davvero aderito. Qui sono separate, come vuole il GDPR, e ce
  // n'e' una che prima mancava del tutto — l'art. 9 sui dati relativi
  // alla SALUTE, che e' proprio quello che il questionario raccoglie.
  //
  // `chiave` finisce nel database e non si tocca piu'. Cambiare questi
  // testi vuol dire cambiare cio' che si firma: versione nuova accanto
  // alla vecchia, come per il resto del documento.
  caselle: [
    {
      chiave: "trattamento",
      tipo: "obbligatoria",
      etichetta: "Consenso al trattamento",
      testo: "Acconsento a sottopormi al trattamento di laminazione ciglia descritto in questo modulo, eseguito durante un corso di formazione Elitederma Srl da un'allieva/o in formazione sotto la supervisione del docente. Dichiaro di aver compreso la natura didattica dell'attività, i possibili rischi e i limiti del risultato.",
    },
    {
      chiave: "salute_veritiera",
      tipo: "obbligatoria",
      etichetta: "Maggiore età e stato di salute",
      testo: "Dichiaro di essere maggiorenne e che le informazioni che ho fornito sul mio stato di salute sono complete e veritiere. Sono consapevole che un'informazione omessa o non veritiera può espormi a rischi che nessuno è in grado di prevenire.",
    },
    {
      chiave: "dati_salute",
      tipo: "obbligatoria",
      etichetta: "Dati relativi alla salute (art. 9 GDPR)",
      testo: "Acconsento espressamente al trattamento dei miei dati relativi alla salute, raccolti con il questionario di questo modulo, per la sola valutazione dell'idoneità al trattamento e per gli obblighi documentali connessi al corso.",
    },
    {
      chiave: "informativa_privacy",
      tipo: "obbligatoria",
      etichetta: "Informativa privacy",
      testo: "Dichiaro di aver letto l'informativa sul trattamento dei dati personali riportata in questo modulo e di essere stata informata dei miei diritti di accesso, rettifica, cancellazione, limitazione, opposizione e revoca del consenso. Per l'esercizio dei diritti o la revoca del consenso posso scrivere a elitedermasrl.pec@legalmail.it.",
    },
    {
      chiave: "immagini",
      tipo: "facoltativa",
      etichetta: "Foto e video",
      testo: "Autorizzo Elitederma Srl all'acquisizione e all'utilizzo gratuito di fotografie e video che mi ritraggono, realizzati prima, durante e dopo il trattamento, per finalità didattiche, informative e promozionali.",
    },
  ],

  // Il PUNTO 4 del cartaceo, voltato in domande. `chiave` e' quello che
  // finisce nel database e non si tocca piu'.
  anamnesi: [
    {
      chiave: "patologie_oculari",
      domanda: "Soffre di patologie oculari",
      specifica: true,
      aiuto: "Congiuntiviti, blefariti, orzaioli, cheratiti, ecc.",
    },
    {
      chiave: "allergie_cosmetiche",
      domanda: "Ha allergie note a tinture, collagene, cheratina, siliconi o conservanti cosmetici",
      specifica: true,
      aiuto: "A cosa",
    },
    {
      chiave: "cure_oftalmiche",
      domanda: "È sottoposta a cure farmacologiche oftalmiche, terapie antibiotiche o cortisoniche",
      specifica: true,
      aiuto: "Quali",
    },
    {
      chiave: "lenti_contatto",
      domanda: "Porta lenti a contatto",
      aiuto: "Se sì, vanno tolte prima di cominciare",
    },
    { chiave: "gravidanza_allattamento", domanda: "È in gravidanza o allattamento" },
  ],

  testo: `PUNTO 1 — CHI FIRMA

Il presente documento ha lo scopo di consentire alla modella una piena comprensione della natura, delle modalità e dei potenziali rischi connessi al trattamento di laminazione ciglia, eseguito durante un corso di formazione professionale tenuto da Elitederma Srl.

La modella è invitata a leggere con attenzione il presente consenso, richiedere eventuali chiarimenti al personale docente o assistente presente, e sottoscrivere solo dopo aver compreso e accettato integralmente quanto riportato.

PUNTO 2 — DESCRIZIONE DEL TRATTAMENTO

Il trattamento di laminazione ciglia è una procedura estetica non invasiva volta a curvare, nutrire e rinforzare le ciglia naturali mediante l'applicazione sequenziale di prodotti cosmetici specifici (soluzioni a base di cheratina, collagene e nutrienti).

Il trattamento viene eseguito a scopo didattico, da un'allieva in formazione sotto supervisione diretta di docenti qualificati.

È importante comprendere che, trattandosi di esercitazione pratica, l'esecuzione può richiedere tempi più lunghi e non garantisce un risultato perfettamente uniforme o equivalente a un trattamento eseguito da un operatore esperto.

PUNTO 3 — AVVERTENZE, IGIENE E RESPONSABILITÀ

La modella dichiara di aver compreso che:

• dovrà attenersi scrupolosamente alle istruzioni fornite dal personale docente e dagli assistenti di Elitederma Srl, prima, durante e dopo il trattamento;

• dovrà mantenere comportamenti igienici corretti, evitare di toccare le ciglia o la zona perioculare con mani non pulite e seguire tutte le indicazioni post-trattamento fornite;

• in caso di mancato rispetto delle regole igieniche, delle precauzioni di sicurezza o delle indicazioni fornite, Elitederma Srl, i docenti e le allieve non potranno essere ritenuti responsabili di eventuali irritazioni, arrossamenti, gonfiori o altri disturbi cutanei o oculari;

• eventuali fenomeni lievi e transitori (come arrossamento o pizzicore) possono verificarsi a causa della sensibilità individuale ai prodotti cosmetici utilizzati;

• in presenza di bruciore, prurito intenso o lacrimazione, è necessario informare immediatamente l'assistente o il docente responsabile e attuare comportamenti che consentono al personale di intervenire, senza sottrarsi alla loro assistenza.

PUNTO 4 — CONDIZIONI DI SALUTE

La modella dichiara sotto la propria responsabilità di essere maggiorenne e in buono stato di salute generale, e di aver risposto in modo completo e veritiero al questionario sulle condizioni di salute riportato in questo modulo.

Se porta lenti a contatto, dichiara di averle rimosse prima del trattamento. Se è in gravidanza o allattamento, dichiara di accettare comunque di sottoporsi volontariamente al trattamento, consapevole delle condizioni.

La modella è stata informata che la mancata dichiarazione di eventuali condizioni mediche o allergiche solleva Elitederma Srl, i docenti e le allieve da ogni responsabilità in merito a eventuali reazioni o effetti indesiderati.

PUNTO 5 — NATURA FORMATIVA DEL TRATTAMENTO

La modella è consapevole che il trattamento viene eseguito da un'allieva in formazione nell'ambito di un corso professionale supervisionato. Pertanto:

• accetta che il risultato estetico possa variare rispetto agli standard professionali;

• accetta che la durata, la curvatura o la resa finale delle ciglia possano non essere uniformi;

• dichiara di essere stata informata della natura didattica dell'attività e di accettarne consapevolmente i limiti e i possibili esiti.

La modella solleva Elitederma Srl, i suoi docenti, assistenti e l'allieva esecutrice da ogni responsabilità civile e penale per eventuali risultati non conformi alle aspettative o effetti collaterali temporanei.

PUNTO 6 — PRIVACY

Ai sensi del Regolamento (UE) 2016/679 (GDPR) e del D.Lgs. 196/2003, la modella è informata che i dati personali forniti saranno trattati da Elitederma Srl, con sede in Via Terni 90/A — 00182 Roma, P.IVA 16179891003, in qualità di Titolare del trattamento.

I dati saranno utilizzati esclusivamente per finalità amministrative, organizzative e documentali legate al corso, nonché per adempiere ad obblighi di legge o regolamentari.

Il trattamento avverrà con strumenti manuali e digitali nel rispetto delle misure di sicurezza previste dagli artt. 5 e 32 del GDPR.

I dati potranno essere comunicati solo a personale interno o a consulenti incaricati, mai diffusi o trasferiti all'estero.

Saranno conservati per il tempo strettamente necessario alle finalità sopra indicate e comunque non oltre 10 anni, salvo diversa disposizione normativa.

Con la firma del presente consenso informato, la modella autorizza l'uso dei propri dati personali per le finalità indicate, restando inteso che potrà in ogni momento esercitare i diritti di accesso, rettifica, cancellazione, limitazione e opposizione, nonché revocare il consenso senza pregiudicare la liceità del trattamento già effettuato.

Per l'esercizio dei diritti o la revoca del consenso è possibile scrivere a: elitedermasrl.pec@legalmail.it`,
} as const;
