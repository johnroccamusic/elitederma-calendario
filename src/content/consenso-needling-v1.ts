// src/content/consenso-needling-v1.ts
//
// Il consenso informato per il MICRONEEDLING, dal modulo cartaceo
// fornito il 19/10/2026. E' il secondo modello dopo quello PMU/Micro, e
// il primo che dimostra che `CONSENSI` e' davvero un elenco: codice suo,
// QR suo, testo suo, anamnesi sua.
//
// LA VERSIONE SI CHIAMA "needling-v1" E NON "v1".
//
// Finche' il modello era uno solo, la versione poteva essere un numero:
// "v1", "v2". Da adesso non piu'. Un consenso needling salvato con
// versione "v1" sarebbe andato a pescare il testo PMU v1, e l'archivio
// avrebbe mostrato accanto alla firma le domande sbagliate — quelle del
// trucco permanente su una modella trattata a microneedling. Il nome
// della versione porta dentro di se' il modello, cosi' non si puo'
// confondere nemmeno per sbaglio.
//
// COSA E' STATO TRASFORMATO, E PERCHE'.
//
// Il cartaceo elenca sotto "Indica una o più delle seguenti condizioni"
// diciannove voci da barrare a penna. Qui sono diventate le domande
// dell'anamnesi: stesse voci, stesso ordine, stesse parole — ma con una
// risposta sì/no obbligatoria per ognuna invece di una casella che si
// puo' saltare senza che nessuno se ne accorga. Su un foglio di carta
// una riga non barrata e' ambigua; qui "no" vuol dire no, e "senza
// risposta" non lascia inviare.
//
// COSA NON C'E', ed e' voluto: il registro delle dieci sedute con numero
// di lotto e scadenza del materiale (pagina 3 del cartaceo). Quello non
// e' un consenso, e' un diario di trattamenti ripetuti, e qui si
// raccoglie una firma per volta. Se serve va pensato a parte.

export const consensoNeedlingV1 = {
  versione: "needling-v1",
  titolo: "CONSENSO INFORMATO MICRONEEDLING",
  sottotitolo:
    "TRATTAMENTO DI MICRONEEDLING DURANTE CORSO DI FORMAZIONE",

  // Il cartaceo nomina un solo trattamento: "Si esegue trattamento di
  // microneedling con dermografo". La tendina resta percorribile — e'
  // obbligatoria nel modulo — e "Altro" copre il caso in cui in aula si
  // faccia qualcosa di diverso da quello previsto.
  trattamenti: [
    "Microneedling con dermografo",
    "Altro",
  ],

  // LE RIGHE DA RIEMPIRE A MANO DEL CARTACEO.
  //
  // «Incarico ______ di eseguire su di me», «a regola d'arte da parte di
  // ______», «dell'attività svolta da ______»: sul foglio sono tre righe
  // vuote, e la prima versione di questo file le aveva sostituite con una
  // formula generica. Il nome di chi opera spariva — e un consenso che
  // non dice chi ha fatto cosa su quella persona risponde a metà della
  // domanda per cui esiste.
  esecutore: {
    etichetta: "Chi esegue il trattamento",
    aiuto: "Nome e cognome dell'allieva/o che opera",
    obbligatorio: true,
  },

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
      testo: "Acconsento a sottopormi al trattamento di microneedling con dermografo descritto in questo modulo, eseguito durante un corso di formazione Elitederma Srl da un'allieva/o in formazione sotto la supervisione del docente. Dichiaro di aver compreso la natura didattica dell'attività, i possibili rischi e i limiti del risultato.",
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

  // Le diciannove condizioni del cartaceo, nello stesso ordine.
  //
  // Quattro domande hanno la formulazione del modulo PMU e non quella
  // secca del foglio ("Diabete mellito" invece di "diabete"): quando due
  // moduli chiedono LA STESSA cosa devono chiamarla allo stesso modo,
  // o il giorno in cui si vorra' sapere quante modelle hanno dichiarato
  // il diabete bisognera' conoscere quattro nomi per la stessa cosa. Il
  // PMU e' quello congelato — ventisei firme — quindi comanda lui. C'e'
  // una prova nel banco che controlla che non divergano.
  // `chiave` e' quello che finisce nel database e non si tocca piu': se
  // un giorno la domanda si riscrive, cambia `domanda`, mai `chiave`.
  // `specifica` accende il campo libero sul sì solo dove la risposta
  // secca non basta a decidere se si puo' procedere.
  anamnesi: [
    { chiave: "infezioni", domanda: "Infezioni, sistemiche o localizzate", specifica: true, aiuto: "Quali e dove" },
    { chiave: "farmaci_quotidiani", domanda: "Assunzione quotidiana di farmaci", specifica: true, aiuto: "Quali" },
    { chiave: "diabete", domanda: "Diabete mellito" },
    { chiave: "fumo", domanda: "Fumo" },
    { chiave: "alcool", domanda: "Alcool" },
    { chiave: "acne_attiva", domanda: "Acne in fase attiva" },
    { chiave: "eczema", domanda: "Eczema" },
    { chiave: "psoriasi", domanda: "Psoriasi" },
    { chiave: "dermatite", domanda: "Dermatite" },
    { chiave: "herpes", domanda: "È o è stata predisposta all'herpes" },
    { chiave: "ictus_ischemia", domanda: "Ictus o ischemia" },
    { chiave: "emiparesi_facciale", domanda: "Emiparesi facciale" },
    {
      chiave: "medicina_estetica",
      domanda: "Trattamenti di medicina estetica nei 20 giorni prima o dopo",
      specifica: true,
      aiuto: "Tossina botulinica, filler con acido ialuronico e simili: quale e quando",
    },
    { chiave: "vaccinazioni", domanda: "Vaccinazioni nei 20 giorni prima o dopo", specifica: true, aiuto: "Quale e quando" },
    { chiave: "cheloidi", domanda: "Cheloidi o problemi di cicatrizzazione", specifica: true },
    { chiave: "gravidanza_allattamento", domanda: "È in gravidanza o allattamento" },
    {
      chiave: "immunitario",
      domanda: "Sistema immunitario fragile o compromesso da condizioni cliniche croniche",
      specifica: true,
    },
    { chiave: "coagulazione_lenta", domanda: "Coagulazione lenta" },
    { chiave: "oncologiche_5_anni", domanda: "Cure oncologiche negli ultimi 5 anni", specifica: true },
  ],

  testo: `COME SI SVOLGE IL TRATTAMENTO

Si esegue trattamento di microneedling con dermografo. Il trattamento si svolge nel seguente modo:

• foto/video delle condizioni della pelle del cliente;
• consulenza e compilazione del consenso informato;
• detersione della pelle con massaggio;
• asepsi della cute;
• trattamento di microneedling;
• applicazione crema/maschera specifica finale;
• foto/video delle condizioni della pelle del cliente;
• consegna (sms, whatsapp, mail, memorandum scritto) delle istruzioni di cura domiciliare nei giorni successivi al trattamento;
• consulenza skincare sul protocollo domiciliare più adatto alla stagione, tipologia di pelle ed inestetismo da trattare, da utilizzare dopo il trattamento del professionista, per mantenere e prolungare i risultati.

Il professionista esegue la procedura nell'assoluto rispetto delle norme igienico-sanitarie. Il materiale utilizzato è sterile e monouso. Il materiale sterile viene aperto di fronte al cliente che si sottopone al trattamento.

In caso di pregresse patologie o qualsiasi alterazione dell'integrità cutanea, assunzioni di farmaci, allergie o intolleranze, è necessaria l'autorizzazione di un medico per effettuare il trattamento.

IL TRATTAMENTO SI SVOLGE DURANTE UN CORSO DI FORMAZIONE

Il trattamento viene eseguito durante un corso di formazione ELITEDERMA e può essere effettuato, in tutto o in parte, da un'allieva/o sotto la supervisione del docente.

Il nome di chi esegue il trattamento è indicato in questo modulo, alla voce «Chi esegue il trattamento», e forma parte integrante del presente consenso.

CHE COSA SUCCEDE DOPO

Subito dopo il trattamento, la pelle può apparire arrossata ed è possibile avvertire una sensazione rinvigorente di turgore, pizzicore, calore, come se la pelle fosse in trazione. Queste reazioni sono temporanee e di solito si risolvono entro 24-48 ore.

La pelle può esfoliarsi nei giorni successivi: è fondamentale seguire quindi il protocollo domiciliare indicato dal professionista che esegue il trattamento.

LE ISTRUZIONI CHE MI IMPEGNO A SEGUIRE

• Subito dopo il trattamento evito qualunque tipologia di cosmetico e make up per almeno 24 ore.
• Disinfetto eventuali occhiali da vista/sole e il telefono cellulare.
• Utilizzo una federa per il cuscino pulita ed un asciugamano nuovo solo per il viso.
• Non mi tocco il viso con le mani sporche.
• Evito l'esposizione alla luce diretta del sole per almeno 48 ore, e in generale per 7 giorni. Sauna, bagno turco, bagni in mare e piscina sono da evitare nelle 48 ore successive al trattamento.
• A partire dal secondo giorno applico la crema con protezione solare (SPF 30 o 50) sia in estate sia in inverno. Posso usare prodotti di make up solo dopo 24 ore.

Seguirò le indicazioni sopra indicate e sono consapevole che la procedura potrebbe richiedere applicazioni multiple, oltre quelle preventivate in fase di consultazione, avendo questo tipo di trattamento carattere estremamente soggettivo.

DICHIARAZIONE SULLO STATO DI SALUTE

Dichiaro di aver riferito in fede e con completezza tutto ciò che attiene al mio attuale stato di salute, e che le risposte date al questionario riportato in questo modulo sono complete e veritiere.

Nel caso di trattamento post patologia allego al presente consenso lo specifico format compilato e il permesso di operare redatto dal medico.

Sono consapevole che un'informazione omessa o non veritiera può espormi a rischi che nessuno è in grado di prevenire. Qualora siano presenti condizioni che possano rendere il trattamento non consigliabile, ELITEDERMA e il docente potranno decidere di non procedere.

DICHIARAZIONI

• Ho ricevuto e compreso le istruzioni pre e post procedura.
• Il mio corpo è unico: il professionista non può prevedere come la mia pelle reagirà alla procedura.
• Accetto di seguire tutte le istruzioni post intervento concernenti la cura del mio trattamento di microneedling, procedura che mi è stata spiegata e della quale ho ricevuto un memorandum.
• Confermo che mi atterrò alle indicazioni spiegatemi ed alle richieste dell'operatore (ad esempio: esposizione solare, lampade abbronzanti, saune, terme, applicazione di make up… etc.).
• Sono consapevole che se, nonostante tutte le procedure corrette nell'effettuare il trattamento a regola d'arte da parte della persona indicata in questo modulo come esecutrice, sotto la supervisione del docente, il risultato del mio trattamento non dovesse essere soddisfacente a causa di problematiche imputabili alle caratteristiche della mia pelle, non mi verrà restituita alcuna somma da me versata come pagamento della prestazione professionale.

ACCETTAZIONE

In pieno possesso delle mie facoltà mentali esonero da tutte le responsabilità ed incarico ELITEDERMA e la persona indicata in questo modulo come esecutrice del trattamento, che opera sotto la supervisione del docente, di eseguire su di me — secondo quanto concordato e precedentemente evidenziato — il trattamento di microneedling.

INFORMATIVA PRIVACY

Ai sensi del D. Lgs. 30/06/2003 n. 196 (Codice della Privacy), del Regolamento Generale sulla protezione dei Dati — Regolamento Europeo n. 2016/679 (GDPR) e del D. Lgs. 10/08/2018 n. 101, acconsento al trattamento dei miei dati per il solo uso interno e per uso didattico, scientifico e dimostrativo.

UTILIZZO FOTO E VIDEO — FACOLTATIVO

Acconsento all'acquisizione di foto-ritratti della mia persona precedenti e successivi al trattamento, e autorizzo la pubblicazione di eventuali foto/video del lavoro eseguito, per la documentazione dell'attività svolta da ELITEDERMA e dalla persona indicata in questo modulo come esecutrice, e per finalità didattiche, informative e promozionali.`,
} as const;
