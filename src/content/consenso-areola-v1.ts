// src/content/consenso-areola-v1.ts
//
// Il consenso informato per la DERMOPIGMENTAZIONE DELL'AREOLA,
// 19/10/2026. Quinto modello.
//
// ATTENZIONE, DA FAR VALIDARE — PIU' DEGLI ALTRI.
//
// Come quello della tricopigmentazione, questo non nasce da un cartaceo
// fornito: l'ho scritto io. Ma qui la posta e' piu' alta, e va detto
// chiaro perche'.
//
// L'areola si pigmenta spesso DOPO UNA MASTECTOMIA. Chi si siede per
// questo trattamento puo' essere una persona in un percorso oncologico,
// su una cute operata, irradiata, con cicatrici e sensibilita' alterata,
// e magari con i linfonodi ascellari asportati. Nessuna di queste cose
// la chiedeva il questionario del trucco permanente, e nessuna si puo'
// scoprire mentre si e' gia' cominciato.
//
// Per questo il modulo pretende tre cose che gli altri non pretendono:
// che le cicatrici siano guarite, che sia passato abbastanza tempo
// dall'intervento o dalla fine delle terapie, e che ci sia un nulla osta
// scritto del medico che l'ha in cura. Non sono formalita': su una cute
// irradiata il pigmento si comporta in modo imprevedibile, e dal lato di
// un'ascella svuotata un trauma cutaneo ha un rischio suo.
//
// PRIMA DI USARLO IN AULA va letto da chi segue la parte legale e da chi
// insegna il corso. Le soglie temporali che ho scritto (dodici mesi) sono
// la prassi che si legge in giro, non una norma: vanno confermate o
// corrette da chi risponde di quello che c'e' scritto.
//
// E' UNA ZONA INTIMA, e il modulo lo dice. Chi firma deve sapere che
// potra' farsi accompagnare, che la zona resta scoperta per il tempo
// necessario e basta, e — se acconsente alle foto — che quelle immagini
// riguardano il seno.

export const consensoAreolaV1 = {
  versione: "areola-v1",
  titolo: "CONSENSO INFORMATO MODELLA",
  sottotitolo:
    "DERMOPIGMENTAZIONE DELL'AREOLA DURANTE CORSO DI FORMAZIONE",

  // UNA VOCE SOLA, E GIA' SCELTA.
  //
  // C'erano quattro varianti — ricostruzione cromatica, effetto 3D,
  // correzione del colore, copertura di cicatrici — e su un telefono
  // diventavano una tendina lunga quanto lo schermo, da leggere per
  // scegliere una cosa che il corso ha gia' deciso. Il trattamento qui
  // e' uno: come lo si esegue e' materia della lezione, non di una
  // dichiarazione che firma la modella.
  trattamenti: [
    "Dermopigmentazione del complesso areola capezzolo",
    "Altro",
  ],
  trattamentoPredefinito: "Dermopigmentazione del complesso areola capezzolo",

  // LE CASELLE CHE RENDONO VALIDO IL CONSENSO.
  //
  // Le stesse degli altri modelli. Cambiano due testi: quello del
  // trattamento, che nomina il nulla osta del medico quando si opera su
  // una cute gia' operata; e quello delle immagini, che deve dire a
  // chiare lettere di che zona si tratta — un consenso alle foto dato
  // senza sapere che riguardano il seno non e' informato.
  caselle: [
    {
      chiave: "trattamento",
      tipo: "obbligatoria",
      etichetta: "Consenso al trattamento",
      testo: "Acconsento a sottopormi al trattamento di dermopigmentazione dell'areola indicato in questo modulo, eseguito durante un corso di formazione Elitederma Srl da un'allieva/o in formazione sotto la supervisione del docente. Dichiaro di aver compreso la natura didattica dell'attività, i possibili rischi e i limiti del risultato, e che se la zona da trattare è stata operata o irradiata il trattamento può essere eseguito solo a cicatrici guarite e con il nulla osta scritto del medico che mi ha in cura.",
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
      testo: "Acconsento espressamente al trattamento dei miei dati relativi alla salute, compresi quelli che riguardano interventi chirurgici e terapie oncologiche, raccolti con il questionario di questo modulo, per la sola valutazione dell'idoneità al trattamento e per gli obblighi documentali connessi al corso.",
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
      etichetta: "Foto e video di una zona intima",
      testo: "Autorizzo Elitederma Srl all'acquisizione e all'utilizzo gratuito di fotografie e video realizzati prima, durante e dopo il trattamento, per finalità didattiche, informative e promozionali. Sono consapevole che le immagini riguardano il seno, che è una zona intima, e che posso negare questo consenso senza che il trattamento ne risenta in alcun modo.",
    },
  ],

  // L'ANAMNESI: le voci comuni, scritte IDENTICHE agli altri moduli, piu'
  // quelle che riguardano una cute operata. Una stessa condizione deve
  // chiamarsi allo stesso modo ovunque — c'e' una prova nel banco che lo
  // controlla.
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
    { chiave: "medicine", domanda: "Assume regolarmente medicine", specifica: true, aiuto: "Quali" },
    { chiave: "cicatrizzazione", domanda: "Ha problemi di cicatrizzazione delle ferite", specifica: true },
    { chiave: "gravidanza", domanda: "È in stato di gravidanza" },
    { chiave: "allattamento", domanda: "Sta allattando" },
    { chiave: "alcol_droghe", domanda: "Nelle ultime 24 ore ha assunto alcol o droghe" },

    // Da qui in giu' e' quello che riguarda una zona gia' operata, e che
    // nessuno degli altri moduli chiedeva.
    {
      chiave: "interventi_seno",
      domanda: "Si è sottoposta a interventi chirurgici al seno",
      specifica: true,
      aiuto: "Quale intervento e in che mese e anno (mastectomia, ricostruzione, riduzione, aumento, mastopessi)",
    },
    {
      chiave: "oncologiche_5_anni",
      domanda: "Cure oncologiche negli ultimi 5 anni",
      specifica: true,
    },
    {
      chiave: "radio_chemio",
      domanda: "Sta seguendo o ha seguito di recente radioterapia o chemioterapia",
      specifica: true,
      aiuto: "Quale e quando è terminata",
    },
    {
      chiave: "linfonodi_ascellari",
      domanda: "Le sono stati asportati linfonodi ascellari, o soffre di linfedema",
      specifica: true,
      aiuto: "Da che lato",
    },
    {
      chiave: "cicatrici_non_guarite",
      domanda: "Ha cicatrici recenti, croste, arrossamenti o lesioni nella zona da trattare",
      specifica: true,
    },
    {
      chiave: "nulla_osta_medico",
      domanda: "Ha il nulla osta scritto del medico che la ha in cura",
      aiuto: "Serve se la zona è stata operata o irradiata",
    },
  ],

  testo: `CHE COS'È IL TRATTAMENTO

La dermopigmentazione dell'areola consiste nel depositare pigmento negli strati superficiali della cute per ricostruire il colore e il disegno dell'areola e del capezzolo, per correggerne il colore o le asimmetrie, per dare un effetto tridimensionale dove il rilievo non c'è più, o per attenuare il contrasto di una cicatrice.

È un trattamento estetico: non è un intervento medico, non sostituisce alcuna terapia e non interviene sulla condizione clinica che ha reso necessario l'intervento chirurgico eventualmente subito.

IL TRATTAMENTO SI SVOLGE DURANTE UN CORSO DI FORMAZIONE

La sottoscritta dichiara di essere stata informata e di aver compreso che:

• il trattamento viene eseguito durante un corso di formazione ELITEDERMA e può essere effettuato, in tutto o in parte, da un'allieva/o sotto la supervisione del docente;

• il trattamento viene eseguito nel rispetto delle norme igienico-sanitarie previste, con materiale monouso e sterile per le parti a contatto con la cute;

• trattandosi di una sessione didattica, il risultato può richiedere successivi ritocchi o perfezionamenti e può presentare differenze di intensità, uniformità, simmetria o durata rispetto a un normale trattamento professionale;

• il risultato definitivo si costruisce di norma in più sedute, e quelle eventualmente necessarie oltre alla sessione didattica non sono comprese: saranno a pagamento e andranno concordate direttamente con un operatore scelto liberamente dalla modella.

SE LA ZONA È STATA OPERATA O IRRADIATA

Questa è la parte che riguarda chi arriva dopo una mastectomia, una ricostruzione o un altro intervento al seno. La sottoscritta dichiara di essere stata informata che:

• il trattamento si esegue solo su cicatrici completamente guarite, e di norma non prima di dodici mesi dall'intervento o dalla conclusione della radioterapia;

• se la zona è stata operata o irradiata è necessario il nulla osta scritto del medico, del chirurgo o dell'oncologo che la ha in cura, e senza quel documento il trattamento non viene eseguito;

• sulla cute cicatriziale o irradiata il pigmento si fissa in modo meno prevedibile: il colore può risultare più chiaro, disomogeneo o meno duraturo, e possono servire più sedute di quante ne occorrerebbero su una cute integra;

• la sensibilità della zona può essere ridotta o assente, e questo non riduce i rischi: possono verificarsi lesioni che non vengono avvertite;

• in caso di asportazione di linfonodi ascellari o di linfedema, un trauma cutaneo dal lato interessato comporta un rischio specifico, e ELITEDERMA e il docente possono decidere di non procedere;

• qualunque alterazione della zona — arrossamento, gonfiore, secrezione, cambiamento di una cicatrice — va riferita al medico curante prima del trattamento, e non a chi esegue il trattamento.

È UNA ZONA INTIMA

Il trattamento riguarda il seno. La sottoscritta è stata informata che:

• può chiedere di essere accompagnata da una persona di sua fiducia;
• la zona resta scoperta solo per il tempo necessario all'esecuzione;
• sono presenti soltanto le persone coinvolte nella lezione;
• può interrompere il trattamento in qualsiasi momento, senza doverne spiegare il motivo.

CHE COSA PUÒ SUCCEDERE

Dopo il trattamento possono verificarsi rossore, gonfiore, lieve sanguinamento, ecchimosi, crosticine e una sensazione di calore o tensione nella zona trattata. Sono reazioni abituali e si risolvono di norma in pochi giorni.

Possono inoltre verificarsi perdita parziale di pigmento, variazione temporanea o successiva del colore, asimmetrie rispetto al lato non trattato, e più raramente reazioni allergiche, infezioni o cicatrizzazioni anomale.

Il risultato e la durata non possono essere garantiti: dipendono dalle caratteristiche individuali della cute, dalla presenza di tessuto cicatriziale, dal metabolismo, dalla risposta individuale al pigmento e dal rispetto delle indicazioni post trattamento.

LE INDICAZIONI CHE MI IMPEGNO A SEGUIRE

• Non tocco né gratto la zona trattata, e non rimuovo le crosticine.
• Mantengo la zona pulita e asciutta, e uso solo i prodotti indicati.
• Evito reggiseni stretti o con ferretto e indumenti che sfregano, nei primi giorni.
• Evito sudorazione intensa, palestra, sauna, bagno turco, piscina e mare finché la cute non è guarita.
• Evito l'esposizione diretta al sole e le lampade abbronzanti sulla zona trattata.
• Se compaiono dolore, gonfiore che aumenta, pus o febbre, mi rivolgo subito a un medico.

DICHIARAZIONE SULLO STATO DI SALUTE

L'operatore deve essere informato dello stato di salute della modella: è la condizione che permette di valutare se il trattamento si può eseguire in sicurezza.

La sottoscritta ha risposto al questionario riportato in questo modulo e dichiara, sotto la propria responsabilità, che tutte le risposte sono complete e veritiere, di non presentare infezioni, ferite o alterazioni della cute nella zona da trattare, e di aver comunicato ogni intervento, terapia oncologica o trattamento medico che riguardi il seno.

Qualora siano presenti condizioni che possano rendere il trattamento non consigliabile, ELITEDERMA e il docente potranno decidere di non procedere. È una decisione che si prende nell'interesse della modella, e non è discutibile in aula.

INFORMATIVA PRIVACY

Ai sensi del Regolamento (UE) 2016/679 (GDPR) e del D.Lgs. 196/2003, i dati personali forniti sono trattati da Elitederma Srl, con sede in Via Terni 90/A — 00182 Roma, P.IVA 16179891003, in qualità di Titolare del trattamento.

I dati sono utilizzati per finalità amministrative, organizzative e documentali legate al corso e per adempiere a obblighi di legge, con strumenti manuali e digitali e nel rispetto delle misure di sicurezza previste dagli artt. 5 e 32 del GDPR. Possono essere comunicati solo a personale interno o a consulenti incaricati, e non sono diffusi né trasferiti all'estero.

I dati relativi alla salute, compresi quelli che riguardano interventi chirurgici e terapie oncologiche, sono trattati soltanto per valutare se il trattamento si può eseguire in sicurezza, e sono accessibili alle sole persone che devono prendere quella decisione.

Sono conservati per il tempo strettamente necessario alle finalità indicate e comunque non oltre 10 anni, salvo diversa disposizione normativa.

In ogni momento è possibile esercitare i diritti di accesso, rettifica, cancellazione, limitazione e opposizione, nonché revocare il consenso senza pregiudicare la liceità del trattamento già effettuato, scrivendo a elitedermasrl.pec@legalmail.it.`,
} as const;
