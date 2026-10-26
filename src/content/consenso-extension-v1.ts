// src/content/consenso-extension-v1.ts
//
// Il consenso informato per le EXTENSION CIGLIA, dal testo fornito dal
// titolare il 26/10/2026. Sesto modello. Codice «extension», QR suo,
// collegato ai corsi EXTENSION BASE ed EXTENSION VOL.
//
// APPROVATO DAL TITOLARE IL 26/10/2026: il testo e' il suo, trascritto;
// le condizioni economiche le ha dettate lui (vedi sotto).
//
// COSA E' STATO TRASFORMATO, E PERCHE'.
//
// Il cartaceo ha tre caselle per le foto — solo occhio senza volto per
// uso didattico interno; anche con volto per sito e social; nessuna. Qui
// sono DUE caselle facoltative indipendenti: «immagini» (con volto, sito
// e social) e «immagini_senza_volto» (solo la zona dell'occhio, uso
// interno). Nessuna spunta = non acconsente. Si tengono separate perche'
// sono due consensi diversi, e la prima e' la stessa chiave degli altri
// modelli: cosi' l'archivio la legge come legge le altre.
//
// «Patch test: eseguito il … con esito … oppure rinuncia» e' un campo
// obbligatorio: o si scrive data ed esito, o si scrive che si rinuncia.
// Una riga vuota sul cartaceo si lascia vuota; qui si deve dire.
//
// Le dichiarazioni del punto 4 sono le quattro caselle obbligatorie
// degli altri modelli (trattamento, maggiore eta' e veridicita', dati
// di salute, informativa); i punti 2, 3, 5 e 6 restano nel testo.
//
// CONDIZIONI ECONOMICHE, dettate dal titolare il 26/10/2026: il
// trattamento in aula e' gratuito, nessun contributo; non sono incluse
// le successive sedute di mantenimento — che si chiamano cosi', non
// «ritocchi». Il cartaceo aveva caselle a penna su questi due punti;
// nel digitale c'e' la frase decisa. Corretto prima di qualunque firma.
//
// L'anamnesi usa le chiavi gia' in giro dove la condizione e' la stessa
// (`allergie`, `patologie_oculari`, `lenti_contatto`, `medicine`,
// `gravidanza_allattamento`): una stessa condizione si chiama allo
// stesso modo in tutti i moduli, e una prova lo controlla.

export const consensoExtensionV1 = {
  versione: "extension-v1",
  titolo: "CONSENSO INFORMATO MODELLA",
  sottotitolo:
    "TRATTAMENTO DI EXTENSION CIGLIA DURANTE CORSO DI FORMAZIONE",

  trattamenti: [
    "Extension ciglia – applicazione una a una",
    "Extension ciglia – volume (a ventaglio)",
    "Refill",
    "Rimozione",
    "Altro",
  ],

  // sul cartaceo: «Allieva/o operatore: ______»
  esecutore: {
    etichetta: "Chi esegue il trattamento",
    aiuto: "Nome e cognome dell'allieva/o che opera",
    obbligatorio: true,
  },

  campiExtra: [
    {
      chiave: "patch_test",
      etichetta: "Patch test",
      aiuto: "Data ed esito (negativo o positivo), oppure scriva «rinuncio consapevolmente al patch test»",
      obbligatorio: true,
      multilinea: false,
    },
  ],

  caselle: [
    {
      chiave: "trattamento",
      tipo: "obbligatoria",
      etichetta: "Consenso al trattamento",
      testo: "Acconsento a sottopormi al trattamento di extension ciglia descritto in questo modulo, eseguito durante un corso di formazione Elitederma Srl da un'allieva/o in formazione, non ancora qualificata/o, sotto la supervisione diretta del docente. Dichiaro di aver ricevuto spiegazioni chiare, anche a voce, sul trattamento, sui rischi e sulle cure successive, di aver potuto fare domande ottenendo risposte soddisfacenti, e di sapere che posso interrompere il trattamento in qualsiasi momento e che il docente può sospenderlo per motivi tecnici o di sicurezza. Mi impegno a seguire le istruzioni post-trattamento ricevute.",
    },
    {
      chiave: "salute_veritiera",
      tipo: "obbligatoria",
      etichetta: "Maggiore età e stato di salute",
      testo: "Dichiaro di essere maggiorenne e in grado di comprendere quanto riportato in questo modulo, e di aver risposto in modo veritiero e completo al questionario sulle condizioni di salute, senza tacere condizioni rilevanti. Sono consapevole che un'informazione omessa o non veritiera può espormi a rischi che nessuno è in grado di prevenire.",
    },
    {
      chiave: "dati_salute",
      tipo: "obbligatoria",
      etichetta: "Dati relativi alla salute (art. 9 GDPR)",
      testo: "Acconsento espressamente al trattamento dei miei dati relativi alla salute, raccolti con il questionario di questo modulo, per la sola valutazione dell'idoneità al trattamento e per gli obblighi documentali connessi al corso. È necessario per eseguire il trattamento.",
    },
    {
      chiave: "informativa_privacy",
      tipo: "obbligatoria",
      etichetta: "Informativa privacy",
      testo: "Dichiaro di aver letto l'informativa sul trattamento dei dati personali riportata in questo modulo e di essere stata informata dei miei diritti di accesso, rettifica, cancellazione, limitazione, portabilità, opposizione, revoca del consenso e reclamo al Garante. Per l'esercizio dei diritti o la revoca del consenso posso scrivere a elitedermasrl.pec@legalmail.it.",
    },
    {
      chiave: "immagini_senza_volto",
      tipo: "facoltativa",
      etichetta: "Foto e video senza volto, uso interno",
      testo: "Acconsento a foto e video del solo occhio e della zona perioculare, senza volto riconoscibile, per uso didattico interno a Elitederma Srl. Il consenso è gratuito e revocabile in ogni momento scrivendo a elitedermasrl.pec@legalmail.it; la revoca vale per il futuro.",
    },
    {
      chiave: "immagini",
      tipo: "facoltativa",
      etichetta: "Foto e video anche con volto, sito e social",
      testo: "Acconsento a foto e video, anche con volto riconoscibile, realizzati prima, durante e dopo il trattamento, per uso didattico e per la pubblicazione sul sito e sui canali social di Elitederma Srl (art. 10 c.c., artt. 96-97 L. 633/1941). Il consenso è gratuito, non condiziona il trattamento ed è revocabile in ogni momento scrivendo a elitedermasrl.pec@legalmail.it; la revoca vale per il futuro e non obbliga a rimuovere contenuti già stampati.",
    },
  ],

  anamnesi: [
    { chiave: "allergie", domanda: "Allergie", specifica: true, aiuto: "Cianoacrilato, colle, lattice, cosmetici, cerotti: a cosa" },
    {
      chiave: "reazioni_extension_laminazione",
      domanda: "Ha avuto reazioni a precedenti extension o laminazioni",
      specifica: true,
      aiuto: "Quale reazione e quando",
    },
    {
      chiave: "patologie_oculari",
      domanda: "Soffre di patologie oculari",
      specifica: true,
      aiuto: "Congiuntivite, blefarite, orzaiolo o altre infezioni oculari in corso",
    },
    {
      chiave: "interventi_occhi_6_mesi",
      domanda: "Si è sottoposta a interventi agli occhi o alle palpebre negli ultimi 6 mesi",
      specifica: true,
      aiuto: "Quale intervento e quando",
    },
    { chiave: "lenti_contatto", domanda: "Porta lenti a contatto", aiuto: "Se sì, vanno tolte prima del trattamento" },
    {
      chiave: "tiroide_alopecia_ciglia",
      domanda: "Soffre di patologie della tiroide, alopecia o caduta delle ciglia",
      specifica: true,
    },
    { chiave: "medicine", domanda: "Assume regolarmente medicine", specifica: true, aiuto: "Chemioterapia, colliri, farmaci per il glaucoma: quali" },
    { chiave: "gravidanza_allattamento", domanda: "È in gravidanza o allattamento" },
    {
      chiave: "claustrofobia",
      domanda: "Soffre di claustrofobia o ha difficoltà a stare sdraiata a occhi chiusi per 2-3 ore",
      specifica: true,
    },
    {
      chiave: "asma_vapori",
      domanda: "Soffre di asma o di sensibilità respiratoria a vapori e odori",
      specifica: true,
    },
  ],

  testo: `CHE COS'È IL TRATTAMENTO

Il trattamento consiste nell'applicazione di ciglia artificiali (extension) sulle ciglia naturali, una per una o a ventaglio, con un adesivo cosmetico a base di cianoacrilato. Le ciglia inferiori vengono isolate con patch in idrogel o nastro; gli occhi restano chiusi per tutta la durata (circa 2-3 ore).

IL TRATTAMENTO SI SVOLGE DURANTE UN CORSO DI FORMAZIONE

Il trattamento è eseguito da un'allieva/o in formazione, non ancora qualificata/o, sotto la supervisione diretta del docente Elitederma, che può intervenire, correggere o interrompere la lavorazione in qualsiasi momento. Per questo i tempi possono essere più lunghi e il risultato estetico può non corrispondere a quello di un operatore esperto.

CONDIZIONI ECONOMICHE

Il trattamento eseguito in aula è gratuito: non è previsto alcun contributo. Non sono incluse le successive sedute di mantenimento.

DURATA DEL RISULTATO

Le extension cadono con il ciclo naturale delle ciglia (indicativamente 3-5 settimane). La rimozione va fatta solo da un professionista con apposito remover, mai strappandole.

RISCHI E CONTROINDICAZIONI

Possibili effetti indesiderati, di norma lievi e temporanei: arrossamento o lacrimazione degli occhi; irritazione da vapori dell'adesivo; gonfiore palpebrale; reazione allergica o dermatite da contatto al cianoacrilato o ai patch (anche in chi non ha mai avuto reazioni, e anche dopo applicazioni precedenti senza problemi); congiuntivite o infezione in caso di scarsa igiene post-trattamento; indebolimento o perdita delle ciglia naturali se le extension sono troppo pesanti o rimosse in modo scorretto.

In caso di bruciore intenso, gonfiore marcato, dolore o disturbi della vista la modella deve rivolgersi subito a un medico e avvisare Elitederma.

Il patch test, quando eseguito, serve a verificare in anticipo la reazione all'adesivo: la modella indica in questo modulo la data e l'esito del patch test, oppure dichiara di rinunciarvi consapevolmente.

DICHIARAZIONE SULLO STATO DI SALUTE

L'operatore e il docente devono essere informati dello stato di salute della modella: è la condizione che permette di valutare se il trattamento si può eseguire in sicurezza.

La sottoscritta ha risposto al questionario riportato in questo modulo e dichiara, sotto la propria responsabilità, che tutte le risposte sono complete e veritiere e di non aver taciuto condizioni rilevanti. Se porta lenti a contatto, dichiara di averle tolte prima del trattamento.

Qualora siano presenti condizioni che possano rendere il trattamento non consigliabile, ELITEDERMA e il docente potranno decidere di non procedere.

ISTRUZIONI POST-TRATTAMENTO, CHE MI IMPEGNO A SEGUIRE

• Per le prime 24-48 ore non bagno le ciglia ed evito vapore, sauna e piscina.
• Non uso struccanti oleosi, mascara waterproof o piegaciglia.
• Pulisco le ciglia ogni giorno con un detergente specifico oil-free e le pettino con lo scovolino.
• Non strofino gli occhi e non tiro né strappo le extension.
• Evito di dormire a faccia in giù sul cuscino.
• Per refill o rimozione mi rivolgo solo a un professionista.

INFORMATIVA PRIVACY (ARTT. 13 E 9 GDPR)

Titolare del trattamento è Elitederma Srl, Via Terni 90/A, 00182 Roma, P.IVA 16179891003; contatto per la privacy: elitedermasrl.pec@legalmail.it.

I dati anagrafici sono trattati per gestire il trattamento e documentare il consenso (base giuridica: il contratto e il legittimo interesse alla tutela in caso di contestazioni). I dati sulla salute raccolti con il questionario sono trattati solo con il consenso esplicito espresso nella casella dedicata di questo modulo.

La copia del documento d'identità è conservata per 12 mesi; il presente modulo per 10 anni (termine di prescrizione ordinaria). I dati non sono diffusi e sono accessibili solo al personale autorizzato e ai fornitori tecnici nominati responsabili del trattamento.

La modella può chiedere l'accesso, la rettifica, la cancellazione, la limitazione e la portabilità dei dati, opporsi al trattamento, revocare il consenso senza pregiudicare la liceità del trattamento già effettuato, e proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it), scrivendo a elitedermasrl.pec@legalmail.it.`,
} as const;
