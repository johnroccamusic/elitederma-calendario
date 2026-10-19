// src/content/consenso-trico-v1.ts
//
// Il consenso informato per la TRICOPIGMENTAZIONE, 19/10/2026. Quarto
// modello, e il primo che NON nasce da un cartaceo fornito.
//
// ATTENZIONE, DA FAR VALIDARE. Gli altri tre sono trascrizioni di moduli
// esistenti; questo l'ho scritto io, partendo dal corpo del consenso PMU
// — che e' neutro e vale ovunque si depositi pigmento — e aggiungendo
// cio' che riguarda il cuoio capelluto: come funziona il trattamento,
// cosa non e', le condizioni che lo sconsigliano, e cosa fare nei giorni
// dopo. Prima di usarlo in aula va letto da chi segue la parte legale e
// da chi insegna il corso: le parole di un consenso informato le valida
// qualcuno che risponde di quello che ci sta scritto.
//
// PERCHE' UN MODULO SUO E NON QUELLO DEL PMU.
//
// Perche' il PMU si intitolava "trattamento di trucco permanente", e la
// tricopigmentazione non e' un trucco: si fa sul cuoio capelluto, ha
// controindicazioni sue (dermatiti e psoriasi del capo, caduta in fase
// attiva, trapianti recenti) che il questionario del PMU non chiedeva, e
// soprattutto ha una cosa da dire che negli altri moduli non c'e' —
// che NON fa ricrescere i capelli. Chi si siede per una
// tricopigmentazione a volte spera in quello, e un consenso informato
// serve esattamente a non lasciare quella speranza senza risposta.

export const consensoTricoV1 = {
  versione: "trico-v1",
  titolo: "CONSENSO INFORMATO MODELLA",
  sottotitolo:
    "TRATTAMENTO DI TRICOPIGMENTAZIONE DURANTE CORSO DI FORMAZIONE",

  trattamenti: [
    "Tricopigmentazione – effetto rasato",
    "Tricopigmentazione – infoltimento di aree diradate",
    "Tricopigmentazione – copertura di cicatrici",
    "Altro",
  ],

  // LE CASELLE CHE RENDONO VALIDO IL CONSENSO.
  //
  // Le stesse degli altri modelli, con il trattamento nominato per
  // quello che e'. `chiave` finisce nel database e non si tocca piu'.
  caselle: [
    {
      chiave: "trattamento",
      tipo: "obbligatoria",
      etichetta: "Consenso al trattamento",
      testo: "Acconsento a sottopormi al trattamento di tricopigmentazione indicato in questo modulo, eseguito durante un corso di formazione Elitederma Srl da un'allieva/o in formazione sotto la supervisione del docente. Dichiaro di aver compreso la natura didattica dell'attività, i possibili rischi e i limiti del risultato, e che la tricopigmentazione è un trattamento estetico che non cura la caduta dei capelli e non ne favorisce la ricrescita.",
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
      testo: "Dichiaro di aver letto l'informativa sul trattamento dei dati personali riportata in questo modulo e di essere stata informata dei miei diritti di accesso, rettifica, cancellazione, limitazione, opposizione e revoca del consenso.",
    },
    {
      chiave: "immagini",
      tipo: "facoltativa",
      etichetta: "Foto e video",
      testo: "Autorizzo Elitederma Srl all'acquisizione e all'utilizzo gratuito di fotografie e video che mi ritraggono, realizzati prima, durante e dopo il trattamento, per finalità didattiche, informative e promozionali.",
    },
  ],

  // L'ANAMNESI: quella del PMU piu' le voci del cuoio capelluto.
  //
  // Le chiavi comuni sono scritte IDENTICHE a quelle del PMU
  // (`emofilia`, `diabete`, `epatite`…) apposta: una stessa condizione
  // deve chiamarsi allo stesso modo in tutti i moduli, o il giorno in cui
  // si vorra' contare quante modelle hanno dichiarato una cosa bisognera'
  // sapere quattro nomi diversi per la stessa cosa.
  anamnesi: [
    { chiave: "emofilia", domanda: "Emofilia", specifica: true },
    { chiave: "diabete", domanda: "Diabete mellito" },
    { chiave: "epatite", domanda: "Epatite", specifica: true, aiuto: "Tipo A, B, C, D, E, F" },
    { chiave: "hiv", domanda: "HIV" },
    { chiave: "allergie", domanda: "Allergie", specifica: true, aiuto: "Se sì, a cosa" },
    { chiave: "autoimmuni", domanda: "Malattie autoimmuni", specifica: true },
    { chiave: "infettive", domanda: "Malattie infettive o febbre alta in questo momento", specifica: true },
    { chiave: "cardiovascolari", domanda: "Problemi cardiovascolari", specifica: true },
    { chiave: "anticoagulanti", domanda: "Assume o ha assunto anticoagulanti", specifica: true, aiuto: "Quali" },
    { chiave: "gravidanza", domanda: "È in stato di gravidanza" },
    { chiave: "medicine", domanda: "Assume regolarmente medicine", specifica: true, aiuto: "Quali" },
    { chiave: "cicatrizzazione", domanda: "Ha problemi di cicatrizzazione delle ferite", specifica: true },
    { chiave: "alcol_droghe", domanda: "Nelle ultime 24 ore ha assunto alcol o droghe" },

    // Da qui in giu' e' quello che riguarda il capo, e che nel modulo del
    // trucco permanente non si chiedeva.
    {
      chiave: "dermatiti_cuoio",
      domanda: "Ha dermatite, psoriasi, eczema o altre alterazioni del cuoio capelluto",
      specifica: true,
      aiuto: "Quale, e in che zona",
    },
    {
      chiave: "alopecia_attiva",
      domanda: "È in una fase di caduta attiva o non stabilizzata",
      specifica: true,
      aiuto: "Da quanto tempo",
    },
    {
      chiave: "terapie_capelli",
      domanda: "Segue terapie per la caduta dei capelli",
      specifica: true,
      aiuto: "Quali, ad esempio minoxidil o finasteride",
    },
    {
      chiave: "trapianto_cuoio",
      domanda: "Si è sottoposta a trapianto o a interventi chirurgici sul cuoio capelluto",
      specifica: true,
      aiuto: "Quando",
    },
    {
      chiave: "cicatrici_recenti_cuoio",
      domanda: "Ha ferite, cicatrici recenti o lesioni nella zona da trattare",
      specifica: true,
    },
  ],

  testo: `CHE COS'È LA TRICOPIGMENTAZIONE

La tricopigmentazione è un trattamento estetico che consiste nel depositare piccole quantità di pigmento negli strati superficiali della cute del cuoio capelluto, per simulare l'aspetto dei capelli rasati, dare l'impressione di maggiore densità in aree diradate o attenuare il contrasto di una cicatrice.

CHE COSA NON È

La tricopigmentazione non è una terapia: non cura la caduta dei capelli, non ne arresta il decorso e non ne favorisce la ricrescita. È un effetto visivo, e agisce solo sull'aspetto della zona trattata.

Se la caduta è in corso e non si è stabilizzata, l'aspetto dell'area trattata può cambiare col tempo per effetto della caduta stessa, indipendentemente dalla qualità del lavoro eseguito.

IL TRATTAMENTO SI SVOLGE DURANTE UN CORSO DI FORMAZIONE

La sottoscritta dichiara di essere stata informata e di aver compreso che:

• il trattamento viene eseguito durante un corso di formazione ELITEDERMA e può essere effettuato, in tutto o in parte, da un'allieva/o sotto la supervisione del docente;

• il trattamento viene eseguito nel rispetto delle norme igienico-sanitarie previste, con materiale monouso e sterile per le parti a contatto con la cute;

• trattandosi di una sessione didattica, il risultato può richiedere successivi ritocchi o perfezionamenti e può presentare differenze di intensità, uniformità, densità apparente o durata rispetto a un normale trattamento professionale;

• il risultato definitivo si costruisce di norma in più sedute, e quelle eventualmente necessarie oltre alla sessione didattica non sono comprese: saranno a pagamento e andranno concordate direttamente con un operatore scelto liberamente dalla modella.

CHE COSA PUÒ SUCCEDERE

Dopo il trattamento possono verificarsi rossore, gonfiore, lieve sanguinamento, crosticine e una sensazione di calore o tensione nella zona trattata. Sono reazioni abituali e si risolvono di norma in pochi giorni.

Può inoltre verificarsi perdita parziale di pigmento, variazione temporanea o successiva del colore, e più raramente reazioni allergiche, infezioni o cicatrizzazioni anomale.

Il risultato e la durata non possono essere garantiti: dipendono dalle caratteristiche individuali della cute, dal metabolismo, dall'esposizione al sole, dalla risposta individuale al pigmento e dal rispetto delle indicazioni post trattamento.

LE INDICAZIONI CHE MI IMPEGNO A SEGUIRE

• Non tocco né gratto la zona trattata, e non rimuovo le crosticine.
• Evito lavaggi del capo nelle prime 48 ore, e poi uso prodotti delicati senza strofinare.
• Evito sudorazione intensa, palestra, sauna, bagno turco, piscina e mare per i primi giorni.
• Evito l'esposizione diretta al sole e le lampade abbronzanti, e in seguito proteggo la zona: il sole è la causa principale dello sbiadimento.
• Evito cappelli stretti, caschi e cuffie nelle prime ore.
• Se compaiono dolore, gonfiore che aumenta, pus o febbre, avviso subito e mi rivolgo a un medico.

DICHIARAZIONE SULLO STATO DI SALUTE

L'operatore deve essere informato dello stato di salute della modella: è la condizione che permette di valutare se il trattamento si può eseguire in sicurezza.

La sottoscritta ha risposto al questionario riportato in questo modulo e dichiara, sotto la propria responsabilità, che tutte le risposte sono complete e veritiere, di non presentare infezioni, ferite o alterazioni della cute nella zona da trattare, e di aver comunicato eventuali interventi o terapie recenti che riguardano il cuoio capelluto.

Qualora siano presenti condizioni che possano rendere il trattamento non consigliabile, ELITEDERMA e il docente potranno decidere di non procedere.

INFORMATIVA PRIVACY

Ai sensi del Regolamento (UE) 2016/679 (GDPR) e del D.Lgs. 196/2003, i dati personali forniti sono trattati da Elitederma Srl, con sede in Via Terni 90/A — 00182 Roma, P.IVA 16179891003, in qualità di Titolare del trattamento.

I dati sono utilizzati per finalità amministrative, organizzative e documentali legate al corso e per adempiere a obblighi di legge, con strumenti manuali e digitali e nel rispetto delle misure di sicurezza previste dagli artt. 5 e 32 del GDPR. Possono essere comunicati solo a personale interno o a consulenti incaricati, e non sono diffusi né trasferiti all'estero.

Sono conservati per il tempo strettamente necessario alle finalità indicate e comunque non oltre 10 anni, salvo diversa disposizione normativa.

In ogni momento è possibile esercitare i diritti di accesso, rettifica, cancellazione, limitazione e opposizione, nonché revocare il consenso senza pregiudicare la liceità del trattamento già effettuato, scrivendo a elitedermasrl.pec@legalmail.it.`,
} as const;
