// src/content/consenso-v2.ts
//
// La v2 nasce il 14/10/2026 e aggiunge l'ANAMNESI: venti domande chiuse
// sullo stato di salute, al posto del solo riquadro di testo libero che
// c'era nella v1.
//
// Perche' una versione nuova invece di cambiare la v1. Il codice del QR
// resta `pmu-micro` — i fogli gia' stampati continuano a funzionare — ma
// il testo no: chi ha firmato la v1 ha dichiarato altro, e la sua firma
// deve continuare a dire sotto quale testo e' stata data. La v1 resta
// qui accanto, viva, per i consensi gia' raccolti.

export const consensoV2 = {
  versione: "v2",
  titolo: "CONSENSO INFORMATO MODELLA",
  sottotitolo:
    "TRATTAMENTO DI TRUCCO PERMANENTE DURANTE CORSO DI FORMAZIONE",
  trattamenti: [
    "Sopracciglia – Microblading",
    "Sopracciglia – Dermopigmentazione",
    "Labbra",
    "Eyeliner",
    "Tricopigmentazione",
    "Areola",
    "Altro",
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
