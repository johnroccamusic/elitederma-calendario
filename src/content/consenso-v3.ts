// src/content/consenso-v3.ts
//
// La v3 nasce il 19/10/2026 e cambia SOLO le dichiarazioni da spuntare.
// Il testo e l'anamnesi sono quelli della v2, parola per parola.
//
// Perche' una versione nuova per delle caselle. Perche' le caselle SONO
// cio' che si firma. Fino alla v2 ce n'era una sola, e diceva tre cose
// insieme: «ho letto e compreso, le informazioni che ho dato sul mio
// stato di salute sono vere, e acconsento al trattamento». Chi la
// spuntava aderiva a tre consensi distinti con un gesto solo, e nessuno
// poteva piu' dire a quale. Mancava inoltre quello che in questo modulo
// pesa di piu': l'art. 9, il consenso esplicito al trattamento dei dati
// relativi alla SALUTE — proprio quelli che il questionario raccoglie.
//
// La v2 resta qui accanto, viva e intatta: diciannove consensi sono
// stati firmati sotto quel testo, e devono continuare a poter dire cosa
// dicevano. Questo file e' una copia e non un `{...consensoV2}` apposta:
// una versione e' un'istantanea, e un'istantanea che si muove quando
// qualcuno tocca l'originale non serve a niente.

export const consensoV3 = {
  versione: "v3",
  titolo: "CONSENSO INFORMATO MODELLA",
  // L'INTESTAZIONE COPRE QUELLO CHE LA TENDINA PROPONE, NON DI PIU'.
  //
  // Diceva "TRATTAMENTO DI TRUCCO PERMANENTE", ma questo consenso vale
  // anche per AREOLART, e un'areola non e' un trucco: un documento
  // intestato cosi' si contraddiceva nel punto che si legge per primo.
  //
  // La tricopigmentazione e l'areola, che pure stavano qui, dal
  // 19/10/2026 hanno un modulo loro (`consenso-trico-v1.ts`,
  // `consenso-areola-v1.ts`) e sono uscite anche dalla tendina:
  // lasciarcele avrebbe permesso di sceglierle sul consenso sbagliato.
  // Quel che resta qui e' il viso: sopracciglia, labbra, eyeliner.
  //
  // Il CORPO del testo invece non e' stato toccato: non nomina mai il
  // viso, le labbra o il trucco — parla di cute, pigmento, simmetria,
  // crosticine e durata, che valgono uguali ovunque si pigmenti.
  sottotitolo:
    "TRUCCO PERMANENTE DEL VISO DURANTE CORSO DI FORMAZIONE",
  trattamenti: [
    "Sopracciglia – Microblading",
    "Sopracciglia – Dermopigmentazione",
    "Labbra",
    "Eyeliner",
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
      testo: "Acconsento a sottopormi al trattamento di trucco permanente indicato in questo modulo alla voce «Il trattamento» — eseguito durante un corso di formazione Elitederma Srl da un'allieva/o in formazione sotto la supervisione del docente. Dichiaro di aver compreso la natura didattica dell'attività, i possibili rischi e i limiti del risultato.",
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

  // L'ANAMNESI.
  //
  // `chiave` e' quello che finisce nel database e NON si tocca piu': se
  // un giorno la domanda si riscrive, cambia `domanda`, mai `chiave`, o
  // i consensi gia' raccolti perdono il riferimento di cosa rispondevano.
  //
  // `specifica` accende il campo libero quando la risposta e' SI. Non c'e'
  // su tutte: su "diabete" o "gravidanza" il si' basta, su "epatite" serve
  // sapere quale tipo e su "allergia" a cosa. Un campo che si apre e non
  // serve a niente insegna a saltarlo, e poi lo si salta anche dove conta.
  anamnesi: [
    { chiave: "emofilia", domanda: "Emofilia", specifica: true },
    { chiave: "diabete", domanda: "Diabete mellito" },
    { chiave: "epatite", domanda: "Epatite", specifica: true, aiuto: "Tipo A, B, C, D, E, F" },
    { chiave: "hiv", domanda: "HIV" },
    { chiave: "malattie_pelle", domanda: "Malattie della pelle", specifica: true },
    { chiave: "eczema", domanda: "Eczema" },
    { chiave: "allergie", domanda: "Allergie", specifica: true, aiuto: "Se sì, a cosa" },
    { chiave: "autoimmuni", domanda: "Malattie autoimmuni", specifica: true },
    { chiave: "herpes", domanda: "È o è stata predisposta all'herpes" },
    { chiave: "infettive", domanda: "Malattie infettive o febbre alta in questo momento", specifica: true },
    { chiave: "epilessia", domanda: "Epilessia" },
    { chiave: "cardiovascolari", domanda: "Problemi cardiovascolari", specifica: true },
    { chiave: "anticoagulanti", domanda: "Assume o ha assunto anticoagulanti", specifica: true, aiuto: "Quali" },
    { chiave: "gravidanza", domanda: "È in stato di gravidanza" },
    { chiave: "medicine", domanda: "Assume regolarmente medicine", specifica: true, aiuto: "Quali" },
    { chiave: "pacemaker", domanda: "Ha un pacemaker" },
    { chiave: "cicatrizzazione", domanda: "Ha problemi di cicatrizzazione delle ferite", specifica: true },
    { chiave: "alcol_droghe", domanda: "Nelle ultime 24 ore ha assunto alcol o droghe" },
    { chiave: "interventi_24h", domanda: "Nelle ultime 24 ore si è sottoposta a terapie o interventi medici", specifica: true },
    { chiave: "tatuaggi_24h", domanda: "Nelle ultime 24 ore ha fatto tatuaggi o piercing", specifica: true },
  ],

  testo: `INFORMAZIONI E CONSENSO AL TRATTAMENTO

La sottoscritta dichiara di essere stata informata e di aver compreso che:

• il trattamento viene eseguito durante un corso di formazione ELITEDERMA e può essere effettuato, in tutto o in parte, da un'allieva/o sotto la supervisione del docente;

• il trattamento viene eseguito nel rispetto delle norme igienico-sanitarie previste, con materiale monouso e sterile per le parti a contatto con la cute;

• trattandosi di una sessione didattica, il risultato può richiedere successivi ritocchi o perfezionamenti e può presentare differenze di intensità, uniformità, simmetria o durata rispetto a un normale trattamento professionale;

• dopo il trattamento possono verificarsi rossore, gonfiore, lieve sanguinamento, ecchimosi, crosticine, perdita parziale di pigmento, variazioni temporanee o successive del colore e, più raramente, reazioni allergiche, infezioni o cicatrizzazioni anomale;

• il risultato e la durata del trattamento non possono essere garantiti, in quanto dipendono anche dalle caratteristiche individuali della pelle, dal metabolismo, dalla risposta individuale al pigmento e dal rispetto delle indicazioni post trattamento;

• eventuali successive sedute di ritocco, rinforzo o perfezionamento non sono comprese nel trattamento effettuato durante il corso, saranno a pagamento e dovranno essere concordate direttamente con un operatore scelto liberamente dalla modella.

DICHIARAZIONE SULLO STATO DI SALUTE

L'operatore deve essere informato dello stato di salute della modella: è la condizione che permette di valutare se il trattamento si può eseguire in sicurezza.

La sottoscritta ha risposto al questionario sullo stato di salute riportato nel modulo e dichiara, sotto la propria responsabilità:

• di essere maggiorenne;

• che tutte le risposte date al questionario sono complete e veritiere;

• di non presentare infezioni, ferite o importanti alterazioni cutanee nella zona da trattare;

• di aver comunicato eventuali interventi chirurgici o trattamenti medico-estetici recenti nella zona interessata;

• di essere consapevole che un'informazione omessa o non veritiera può esporla a rischi che nessuno è in grado di prevenire.

Qualora siano presenti condizioni che possano rendere il trattamento non consigliabile, ELITEDERMA e il docente potranno decidere di non procedere.

ACCETTAZIONE

Dichiaro di aver letto e compreso quanto sopra, di aver avuto la possibilità di ricevere chiarimenti, di aver fornito informazioni complete e veritiere sul mio stato di salute e di essere consapevole della natura didattica del trattamento, dei possibili rischi, delle reazioni e dei limiti del risultato.

Acconsento liberamente all'esecuzione del trattamento sopra indicato durante il corso di formazione ELITEDERMA.

UTILIZZO FOTO E VIDEO — FACOLTATIVO

Autorizzo ELITEDERMA all'utilizzo gratuito di fotografie e/o video realizzati prima, durante e dopo il trattamento per finalità didattiche, informative e promozionali.`,
} as const;
