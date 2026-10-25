// IL MODULO DI ISCRIZIONE.
//
// Il regolamento e' quello REVISIONATO del 17/10/2026, consegnato gia'
// corretto: undici punti al posto dei nove di prima. Il Punto 9 e' la
// nuova informativa privacy (art. 13 GDPR), il Punto 10 il consenso
// facoltativo su immagini e video, il Punto 11 foro e legge applicabile.
// Prima veniva dal modulo in rete su elitederma.eu/modulo-iscrizione-corsi.
//
// IL PUNTO 9 DAL 25/10/2026 DICE ANCHE LA LETTURA AUTOMATICA DEL
// DOCUMENTO (lettere b, c, d, e, e-bis, f): fotografia del documento e
// firma fra i dati trattati, la verifica dell'identita' come finalita',
// il confronto automatico riesaminato da una persona (art. 22), il
// fornitore Anthropic negli Stati Uniti con le clausole standard (art.
// 46). E' l'unica parte NON trascritta da un cartaceo: l'ho scritta io,
// e la approva il titolare, che e' l'unico responsabile della privacy e
// dei contratti (non c'e' un consulente, 25/10/2026). Si legge e si
// corregge da Setting -> Modulo di iscrizione -> Il contratto. Chi ha
// firmato prima ha firmato il testo di prima (contratto_firmato).
// IL TESTO E' TRASCRITTO, NON RISCRITTO. Regolamento, informativa e
// consensi sono stati presi parola per parola dall'HTML della pagina e
// non riassunti: sono clausole contrattuali e un "quasi uguale" qui
// vorrebbe dire firmare una cosa diversa da quella che si e' letta. Se
// vanno cambiati, si cambiano di proposito — non per sbaglio.
//
// E' diviso in SEZIONI perche' tutto di fila e' un muro: undici punti di
// regolamento piu' trenta campi non si leggono. Ognuna si apre e si
// chiude da sola, come sull'originale.
//
// Qui dentro c'e' solo il contenuto. Chi lo disegna sta in
// ModuloIscrizione.jsx; nessuno scrive e nessuno legge dal database.

export const INTRO = {
  "titolo": "MODULO ISCRIZIONE AL CORSO ELITEDERMA E REGOLAMENTO DI PARTECIPAZIONE",
  "sottotitolo": "LEGGERE CON ATTENZIONE IL REGOLAMENTO E COMPILARE TUTTI I DATI RICHIESTI APPROVANDO TUTTI I PUNTI"
};

// i 22 corsi come sono scritti oggi nella tendina del sito
export const CORSI = [
  "Corso Microblading BASIC",
  "Corso Microblading PRO",
  "Corso Perfezionamento Microblading",
  "Corso Trucco Permanente Senza Dermografo",
  "Corso Trucco Permanente Con Dermografo",
  "Corso Trucco Permanente Individuale",
  "Corso Trucco Permanente Parziale",
  "Corso Tricopigmentazione",
  "Corso Tricopigmentazione Senza Dermografo",
  "Corso Avanzato Pmu Elite Advanced",
  "Corso Laminazione",
  "Corso Extension",
  "Corso Bio Tattoo Henné",
  "Corso Total Needling",
  "Corso Total Needling Senza Dermografo",
  "Corso Avanzato Laminazione IKE",
  "Corso Colori e Correzioni",
  "Masterclass Evolution Strokes",
  "Corso Areolart",
  "Corso Extension Volume",
  "Master Avanzato",
  "Gemme Dentali"
];

// il regolamento: nove punti, ciascuno con le sue lettere
export const SEZIONI = [
  {
    "chiave": "regolamento",
    "titolo": "Regolamento di partecipazione",
    "tipo": "testo",
    "blocchi": [
        {
          "titolo": "PUNTO 1 – SEDE DEL CORSO",
          "punti": [
            "a) Il corso si svolge presso la sede indicata nel modulo di iscrizione o comunicata da Elitederma Srl, tramite i propri rappresentanti ufficiali, prima dell’inizio del corso.",
            "b) In caso di forza maggiore (ad esempio provvedimenti delle autorità, emergenze sanitarie, eventi di natura politica, amministrativa o sociale) o di comprovate esigenze organizzative, Elitederma Srl può rinviare la data del corso o modificarne la sede, nella stessa città o provincia, informando gli iscritti con un preavviso minimo di 5 giorni di calendario. In tal caso le somme versate restano valide e possono essere utilizzate per lo stesso corso o per un altro corso Elitederma, in data o sede diversa. Non sono dovuti rimborsi per spese di viaggio, alloggio, penali o altri costi sostenuti dall’allievo/a.",
            "c) Se l’allievo/a non può partecipare al corso nella nuova data o nella nuova sede, può chiedere entro 7 giorni dalla comunicazione il rimborso delle somme già versate, che sarà effettuato entro 30 giorni.",
            "d) L’ammissione al corso è subordinata alla valutazione di Elitederma Srl in funzione dell’omogeneità dell’aula, dei prerequisiti richiesti e delle norme vigenti.",
            "e) Elitederma Srl può rifiutare l’iscrizione, anche se già pagata, comunicandolo all’interessato/a entro 5 giorni prima dell’inizio del corso. In tal caso le somme versate sono rimborsate integralmente tramite bonifico. Non sono dovuti ulteriori rimborsi o indennizzi."
          ]
        },
        {
          "titolo": "PUNTO 2 – CONDIZIONI DI PARTECIPAZIONE E PAGAMENTO",
          "punti": [
            "a) L’iscrizione è riservata ai maggiorenni ed è valida solo con il versamento dell’acconto, negli importi e con le modalità indicati nel modulo di iscrizione.",
            "b) Il contratto si considera concluso con la sottoscrizione del modulo di iscrizione online e il versamento dell’acconto. Fanno fede il modulo sottoscritto e la registrazione del pagamento da parte di Elitederma Srl.",
            "c) Il pagamento della quota avviene secondo quanto indicato nel modulo di iscrizione: quota pre corso entro 15 giorni dall’inizio del corso ed eventuale saldo all’arrivo in aula, in contanti nei limiti di legge, con POS, con assegno circolare o con bonifico eseguito almeno 5 giorni prima del corso.",
            "d) Pagamenti parziali, rateali o posticipati sono ammessi solo se concordati con l’amministrazione e approvati per iscritto da Elitederma Srl prima dell’inizio del corso. Modalità e tempi sono indicati nel modulo di iscrizione.",
            "e) Se alla data di inizio del corso la quota dovuta non è stata saldata, Elitederma Srl può negare l’accesso al corso. In tal caso si applicano le regole del Punto 3 sulle somme già versate."
          ]
        },
        {
          "titolo": "PUNTO 3 – RECESSO, RINVII E PENALI",
          "punti": [
            "a) Diritto di recesso. Ai sensi degli artt. 52 e seguenti del D.Lgs. 206/2005 (Codice del Consumo), l'allievo/a che agisce come consumatore può recedere dal contratto entro 14 giorni dalla sua conclusione, senza indicarne il motivo, ottenendo il rimborso integrale delle somme versate entro 14 giorni dalla comunicazione del recesso.",
            "b) Dopo i 14 giorni. Decorso il termine di recesso, le somme versate a titolo di acconto e di quota pre corso non sono rimborsabili, in quanto destinate a coprire le spese organizzative sostenute da Elitederma Srl (aula, docenti, kit, materiali, modelle).",
            "c) Rinvio. L'allievo/a può chiedere, una sola volta, di spostare la partecipazione a un'altra edizione dello stesso corso:",
            "• senza penale, se il rinvio è richiesto più di 30 giorni prima della data di inizio del corso;",
            "• previo pagamento di una penale di € 150, se il rinvio è richiesto nei 30 giorni precedenti la data di inizio del corso, a copertura delle spese già sostenute da Elitederma Srl (aula, viaggi e alloggi di docenti e personale, kit).",
            "Nei 30 giorni precedenti il corso, senza il pagamento della penale lo spostamento non è possibile e l'acconto e le somme versate restano acquisiti da Elitederma Srl. In caso di rinvio, le somme già versate vengono imputate alla nuova edizione, che è soggetta alla disponibilità di posti. Un corso già rinviato non può essere rinviato una seconda volta.",
            "d) Iscrizioni a meno di 15 giorni dal corso. Ai sensi dell'art. 59, lett. a) del Codice del Consumo, per le iscrizioni effettuate nei 15 giorni precedenti l'inizio del corso l'allievo/a, con apposita richiesta espressa nel modulo di iscrizione, chiede che Elitederma Srl avvii immediatamente l'organizzazione (prenotazione dell'aula, docenti, kit, modelle) e prende atto che per questo motivo perde il diritto di recesso. In tali casi le somme versate restano acquisite a copertura delle spese organizzative.",
            "e) Come comunicare. Il recesso può essere esercitato tramite il pulsante «recedi dal contratto qui» presente nella pagina online dell'iscrizione, raggiungibile dal link contenuto nell'e-mail di conferma, oppure con qualsiasi dichiarazione esplicita inviata via PEC a elitedermasrl.pec@legalmail.it. Le richieste di rinvio vanno inviate allo stesso indirizzo PEC.",
            "f) Tempi di rimborso. I rimborsi dovuti per recesso sono effettuati entro 14 giorni dalla comunicazione; gli altri rimborsi previsti dal presente regolamento entro 30 giorni dalla richiesta.",
            "g) Mancata presentazione e assenze. Se l'allievo/a non si presenta al corso, o si assenta in tutto o in parte, non ha diritto ad alcun rimborso, totale o parziale, e l'acconto e le altre somme versate restano acquisiti da Elitederma Srl a copertura delle spese organizzative sostenute. L'allievo/a può tuttavia chiedere, entro 10 giorni dalla data di inizio del corso, il rinvio a un'altra edizione, pagando una penale di € 300: in tal caso le somme versate restano valide per la nuova edizione e si applicano le altre condizioni della lett. c). Decorsi i 10 giorni senza richiesta di rinvio e pagamento della penale, il diritto al rinvio decade e l'acconto e le somme versate si intendono definitivamente persi.",
            "h) Rinunce post-corso. In caso di ritardo, interruzione della frequenza o rinuncia alle esercitazioni post-corso (Web Academy e livelli online) non sono previsti rimborsi totali o parziali. La Web Academy è parte integrante del corso in aula e non è rimborsabile separatamente.",
            "i) Non sono rimborsabili i materiali acquistati autonomamente dall'allievo/a."
          ]
        },
        {
          "titolo": "PUNTO 4 – KIT, MATERIALI E ATTREZZATURE",
          "punti": [
            "a) La didattica è calibrata su prodotti e attrezzature distribuiti o approvati da Elitederma Srl. Elitederma Srl non risponde di problemi derivanti dall’uso di strumenti non distribuiti o non approvati, ad esempio aghi o dermografi portati dall’allievo/a.",
            "b) La quota comprende: attività didattiche, kit didattico, eventuale dermografo e altri prodotti o attrezzature come indicati nel modulo di iscrizione, uso delle attrezzature d’aula (lettino, carrellino, lampada), assistenza dei docenti, attestato finale ed eventuale supporto post-corso.",
            "c) Le attrezzature d’aula sono concesse in comodato d’uso gratuito per la durata del corso e vanno usate con diligenza. Non è consentito l’uso di attrezzature non autorizzate.",
            "d) Il kit ha finalità didattica: consente all’allievo/a di svolgere le esercitazioni previste durante il corso e, se previsto, quelle successive a casa. Le quantità residue possono essere utilizzate dall’allievo/a per la propria attività o per ulteriori esercitazioni. Il kit non costituisce una scorta di prodotti a uso commerciale e non è dovuto alcun reintegro dei prodotti utilizzati, terminati o danneggiati durante le attività. Il valore del kit è parte integrante del prezzo del corso e non è separabile da esso.",
            "e) Dalla consegna l’allievo/a è responsabile del kit e dell’eventuale dermografo. In caso di furto, smarrimento o danni causati dall’allievo/a non sono previsti rimborsi né reintegri. Restano salvi i diritti di garanzia previsti dalla legge per i prodotti difettosi.",
            "f) Il numero di trattamenti realizzabili con il kit è una stima basata su un uso ottimale. Consumi eccedenti o sprechi possono ridurlo e non danno diritto a reintegri gratuiti."
          ]
        },
        {
          "titolo": "PUNTO 5 – PARTECIPAZIONE E FREQUENZA",
          "punti": [
            "a) Per il rilascio dell’attestato di partecipazione è obbligatoria la frequenza di tutte le giornate del corso, comprese le prove pratiche. L’attestato certifica esclusivamente la formazione frequentata e non costituisce abilitazione professionale. L’allievo/a è tenuto/a a informarsi sui requisiti regionali per esercitare la professione (ad esempio diploma di estetista o attestato regionale di tatuaggio e dermopigmentazione).",
            "b) Sono richieste puntualità e partecipazione attiva alle attività teoriche e pratiche. In caso di rinuncia alla pratica su modella, o di pratica solo parziale, Elitederma Srl può non rilasciare l’attestato.",
            "c) L’iscrizione è strettamente personale e non cedibile a terzi. Gli allievi devono attenersi alle istruzioni dei docenti e del personale di Elitederma Srl. Durante le lezioni non è consentito consumare cibi o bevande né utilizzare il telefono cellulare. Foto e video in aula sono consentiti solo con l’autorizzazione dell’organizzazione.",
            "d) Le spese di trasferta, vitto e alloggio sono a carico dell’allievo/a.",
            "e) Una volta iniziato il corso e consegnato il kit didattico non sono possibili rimborsi, sostituzioni o cambi di corso.",
            "f) Elitederma Srl e i docenti possono allontanare dal corso l’allievo/a che, con comportamenti scorretti, offensivi o diffamatori, comprometta il regolare svolgimento delle lezioni o arrechi disturbo a docenti, personale o altri partecipanti. In tal caso non è dovuto alcun rimborso o indennizzo, comprese le spese di viaggio, vitto e alloggio.",
            "g) Tutti i materiali didattici (testi, immagini, metodi, protocolli, video, marchi, loghi e documenti) sono di proprietà esclusiva di Elitederma Srl e tutelati dagli artt. 2575 e seguenti del Codice Civile e dalla Legge 633/1941 sul diritto d’autore. È vietata qualsiasi riproduzione, copia, condivisione o uso non autorizzato, anche parziale. Ogni violazione potrà essere perseguita nelle sedi competenti."
          ]
        },
        {
          "titolo": "PUNTO 6 – MODELLE E MODELLI",
          "punti": [
            "a) Le modelle sono reperite dall’allievo/a a propria cura e spese, salvo il servizio previsto al Punto 7. Devono presentarsi negli orari comunicati dall’organizzazione. Cambi di orario sono ammessi solo se autorizzati almeno 15 giorni prima del corso.",
            "b) Se l’allievo/a non trova una modella, o se la modella non si presenta o non può partecipare per qualsiasi motivo, e di conseguenza l’allievo/a non può svolgere la parte pratica, nessuna responsabilità è attribuibile a Elitederma Srl. L’allievo/a può recuperare la pratica in una sessione successiva, versando un contributo organizzativo di € 180 per ciascuna modella.",
            "c) Le modelle devono essere maggiorenni.",
            "d) Modelle e accompagnatori non possono assistere alle lezioni né sostare in aula.",
            "e) Le modelle devono essere in buona salute e, per microblading e trucco permanente, non devono avere lavori precedenti sulla zona da trattare.",
            "f) Non sono idonee le modelle con: terapie in corso (antibiotici, cortisonici, chemioterapici e simili), febbre o sintomi influenzali, allergie o dermatiti, malattie della pelle o autoimmuni, diabete, gravidanza o allattamento. Eventuali condizioni vanno comunicate tempestivamente all’organizzazione. Ogni modella sottoscrive il proprio modulo di consenso informato prima del trattamento.",
            "g) Tricopigmentazione. Ogni allievo/a reperisce autonomamente il proprio modello o la propria modella; non è possibile incaricare Elitederma Srl della ricerca. Se l’allievo/a non trova un modello, può svolgere la pratica su un modello condiviso messo a disposizione da Elitederma Srl insieme agli altri partecipanti. In tal caso non è dovuto alcun rimborso, totale o parziale, della quota."
          ]
        },
        {
          "titolo": "PUNTO 7 – REPERIMENTO MODELLE A CURA DI ELITEDERMA SRL PER ALLIEVI LONTANI DALLA SEDE DEL CORSO",
          "punti": [
            "a) Solo se l'allievo/a proviene da una città diversa da quella del corso, a più di 50 km di distanza, può chiedere a Elitederma Srl di reperire le modelle per le esercitazioni, al costo di:",
            "- € 60 per modella, se la richiesta arriva più di 7 giorni prima dell'inizio del corso;",
            "- € 100 per modella, se la richiesta arriva nei 7 giorni precedenti l'inizio del corso.",
            "Il servizio non è disponibile per il corso di tricopigmentazione, per il quale vale il Punto 6, lett. g).",
            "b) Il reperimento dipende dalla disponibilità delle modelle e non è garantito. Se Elitederma Srl non riesce a reperire la modella richiesta, il costo del servizio è rimborsato. In nessun caso è dovuto il rimborso della quota del corso.",
            "c) Le modelle sono selezionate in base alla disponibilità: non sono ammesse obiezioni sulle loro caratteristiche estetiche o fisiche.",
            "d) Se, dopo aver richiesto il servizio, l'allievo/a trova una modella per proprio conto, il servizio resta dovuto, a copertura delle spese di ricerca già sostenute.",
            "e) Il servizio si paga la mattina del primo giorno di corso. In mancanza di pagamento le modelle reperite sono disdette e non è dovuto alcun rimborso."
          ]
        },
        {
          "titolo": "PUNTO 8 – RESPONSABILITÀ E SICUREZZA",
          "punti": [
            "a) Elitederma Srl e i docenti forniscono istruzioni, procedure e dimostrazioni per un apprendimento sicuro, igienico e tecnicamente corretto, e assicurano una supervisione costante durante le esercitazioni pratiche.",
            "b) Durante le esercitazioni l’allievo/a è il diretto esecutore dei trattamenti sulle modelle e ne risponde personalmente. Esiti indesiderati dovuti a imperizia, imprudenza, distrazione o mancato rispetto delle indicazioni dei docenti non sono imputabili a Elitederma Srl, ai docenti o ai master incaricati.",
            "c) Se la modella non rispetta le norme di igiene, sicurezza o comportamento indicate dai docenti, eventuali danni o disagi che ne derivano non sono imputabili a Elitederma Srl, ai docenti o ai master.",
            "d) Elitederma Srl non garantisce risultati assoluti e non può prevedere le reazioni individuali delle modelle, comprese intolleranze o condizioni di salute non dichiarate. L’attività pratica è un momento formativo supervisionato e non una prestazione professionale verso terzi.",
            "e) L’allievo/a solleva Elitederma Srl, i docenti e i master dalle responsabilità derivanti dalle proprie azioni, condotte o errori durante le esercitazioni, nei limiti consentiti dalla legge.",
            "f) Le limitazioni di responsabilità previste dal presente regolamento non si applicano in caso di dolo o colpa grave di Elitederma Srl, dei docenti o dei master (art. 1229 c.c.), né ai danni alla persona derivanti da fatti a loro imputabili.",
            "g) Restano fermi gli obblighi di diligenza e prudenza previsti dagli artt. 2043, 2046 e 2050 del Codice Civile: l’allievo/a è personalmente responsabile dell’uso corretto delle tecniche apprese."
          ]
        },
        {
          "titolo": "PUNTO 9 – TRATTAMENTO DEI DATI PERSONALI (ART. 13 REG. UE 2016/679)",
          "punti": [
            "a) Titolare del trattamento è Elitederma S.r.l., con sede legale in Via Terni 90/a, 00182 Roma, P. IVA 16179891003, in persona del legale rappresentante.",
            "b) Dati trattati. Dati anagrafici e di contatto, data e luogo di nascita, codice fiscale, dati di fatturazione, fotografia del documento di identità, firma apposta sul modulo, dati relativi ai pagamenti e alla frequenza del corso.",
            "c) Finalità e base giuridica. I dati sono trattati per:",
            "• organizzare e gestire il corso, l'iscrizione e i pagamenti: base giuridica l'esecuzione del contratto (art. 6, par. 1, lett. b);",
            "• adempiere agli obblighi fiscali e contabili: base giuridica l'obbligo di legge (art. 6, par. 1, lett. c);",
            "• verificare l'identità dell'allievo/a e la correttezza dei dati scritti nel modulo, confrontandoli con il documento di identità, anche tramite lettura automatica del documento: base giuridica l'esecuzione del contratto (art. 6, par. 1, lett. b) e il legittimo interesse a prevenire errori e usi impropri (art. 6, par. 1, lett. f);",
            "• inviare comunicazioni legate al corso e al percorso di studio (materiali didattici, Web Academy e livelli online, aggiornamenti tecnici, supporto post-corso): base giuridica l'esecuzione del contratto (art. 6, par. 1, lett. b); non serve un consenso;",
            "• inviare via e-mail informazioni su corsi, masterclass e prodotti Elitederma analoghi a quelli acquistati: base giuridica il legittimo interesse (art. 6, par. 1, lett. f e art. 130, comma 4 D.Lgs. 196/2003); l'allievo/a può opporsi in ogni momento, anche con il link presente in ogni e-mail;",
            "• inviare, via e-mail, WhatsApp o SMS, anteprime su nuovi corsi e masterclass, novità tecniche, eventi, offerte e vantaggi riservati agli allievi: solo con il consenso facoltativo dell'interessato (art. 6, par. 1, lett. a), revocabile in ogni momento.",
            "Il conferimento dei dati per le prime due finalità è necessario: senza di essi non è possibile iscriversi al corso.",
            "d) Modalità. I dati sono trattati da personale autorizzato, con strumenti cartacei ed elettronici e con misure di sicurezza adeguate (artt. 5 e 32 GDPR). La fotografia del documento di identità può essere letta da un sistema automatico che ne estrae i soli dati anagrafici per confrontarli con quelli scritti nel modulo; il confronto è sempre riesaminato da una persona e non produce alcuna decisione basata unicamente sul trattamento automatizzato (art. 22 GDPR).",
            "e) Destinatari. I dati possono essere comunicati, nella misura necessaria, a docenti e master incaricati, consulenti fiscali e legali, fornitori di servizi tecnici e informatici (hosting, invio di e-mail, pagamenti, lettura automatica dei documenti) nominati responsabili del trattamento, e alle autorità competenti. I dati sono conservati su server situati nell'Unione Europea.",
            "e-bis) Trasferimenti extra-UE. La lettura automatica del documento di identità è svolta tramite Anthropic, PBC, con sede negli Stati Uniti d'America; la fotografia del documento è trasmessa al solo fine dell'estrazione dei dati, non è utilizzata dal fornitore per altri scopi né per addestrare i propri sistemi, e il trasferimento avviene sulla base delle clausole contrattuali standard approvate dalla Commissione Europea (art. 46, par. 2, lett. c GDPR).",
            "f) Conservazione. I dati sono conservati per la durata del rapporto e successivamente per il tempo previsto dagli obblighi di legge (dati contabili: 10 anni). La fotografia del documento di identità e la firma sono conservate, in archivi ad accesso riservato, insieme al contratto sottoscritto e per lo stesso periodo. I dati usati per le comunicazioni promozionali sono conservati fino alla revoca del consenso.",
            "g) Diritti dell'interessato (artt. 15–22 GDPR): accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso, senza pregiudizio per i trattamenti già effettuati. L'interessato può proporre reclamo al Garante per la protezione dei dati personali (art. 77 GDPR). Per esercitare i diritti: elitedermasrl.pec@legalmail.it"
          ]
        },
        {
          "titolo": "PUNTO 10 – IMMAGINI E VIDEO (CONSENSO FACOLTATIVO)",
          "punti": [
            "a) Con il consenso facoltativo espresso nel modulo di iscrizione, l'allievo/a autorizza Elitederma Srl, a titolo gratuito, a pubblicare foto e video in cui compare, realizzati durante il corso, sul sito internet, sui canali social, su materiale stampato e su altri mezzi di comunicazione di Elitederma Srl, per finalità informative e promozionali, ai sensi degli artt. 10 c.c. e 96 e 97 della Legge 633/1941.",
            "b) Il consenso è facoltativo: negarlo non incide in alcun modo sull'iscrizione o sulla partecipazione al corso.",
            "c) Il consenso può essere revocato in qualsiasi momento scrivendo a elitedermasrl.pec@legalmail.it. Dopo la revoca Elitederma Srl non effettua nuove pubblicazioni e rimuove, per quanto tecnicamente possibile, i contenuti già pubblicati sui propri canali.",
            "d) Le immagini sono conservate negli archivi di Elitederma Srl fino alla revoca del consenso."
          ]
        },
        {
          "titolo": "PUNTO 11 – LEGGE APPLICABILE E FORO COMPETENTE",
          "punti": [
            "a) Il presente contratto è regolato dalla legge italiana.",
            "b) Se l’allievo/a è un consumatore, per qualsiasi controversia è competente il foro del luogo di residenza o domicilio dell’allievo/a (art. 66-bis del Codice del Consumo).",
            "c) Se l’allievo/a agisce come professionista o azienda (iscrizione con partita IVA), è competente in via esclusiva il Foro di Roma.",
            "d) Per quanto non previsto dal presente regolamento si applicano le norme del Codice Civile e del Codice del Consumo."
          ]
        }
      ]
  },
  {
    "chiave": "anagrafica",
    "titolo": "Dati personali del corsista",
    "tipo": "campi",
    "campi": [
      {
        "chiave": "tutor",
        "etichetta": "Tutor con cui hai parlato",
        "tipo": "testo",
        "obbligatorio": true
      },
      {
        "chiave": "nome",
        "etichetta": "Nome",
        "tipo": "testo",
        "obbligatorio": true
      },
      {
        "chiave": "cognome",
        "etichetta": "Cognome",
        "tipo": "testo",
        "obbligatorio": true
      },
      {
        "chiave": "telefono",
        "etichetta": "Telefono",
        "tipo": "telefono",
        "obbligatorio": true
      },
      {
        "chiave": "tipo_documento",
        "etichetta": "Tipo Documento",
        "tipo": "tendina",
        "obbligatorio": true,
        "voci": [
          "Carta di identità",
          "Patente",
          "Passaporto"
        ]
      },
      {
        "chiave": "numero_documento",
        "etichetta": "Numero Documento",
        "tipo": "testo",
        "obbligatorio": true
      },
      {
        "chiave": "indirizzo",
        "etichetta": "Indirizzo di residenza",
        "tipo": "testo",
        "obbligatorio": true
      },
      {
        "chiave": "cap",
        "etichetta": "CAP",
        "tipo": "numero",
        "obbligatorio": true
      },
      {
        "chiave": "citta",
        "etichetta": "Città di residenza",
        "tipo": "testo",
        "obbligatorio": true
      },
      {
        "chiave": "doc_fronte",
        "etichetta": "Carica documento Fronte (max 20 mb)",
        "tipo": "file",
        "obbligatorio": true,
        "nota": "Maximum file size: 20 MB"
      },
      {
        "chiave": "doc_retro",
        "etichetta": "Carica documento Retro (max 20 mb)",
        "tipo": "file",
        "obbligatorio": true,
        "nota": "Maximum file size: 20 MB"
      },
      {
        "chiave": "codice_fiscale",
        "etichetta": "Codice Fiscale",
        "tipo": "testo",
        "obbligatorio": true
      },
      {
        "chiave": "email",
        "etichetta": "Email",
        "tipo": "email",
        "obbligatorio": true
      }
    ]
  },
  {
    "chiave": "corso",
    "titolo": "Il corso",
    "tipo": "campi",
    "campi": [
      {
        "chiave": "corso",
        "etichetta": "Tipo di Corso Scelto",
        "tipo": "tendina",
        "obbligatorio": true,
        "voci": [
          "Corso Microblading BASIC",
          "Corso Microblading PRO",
          "Corso Perfezionamento Microblading",
          "Corso Trucco Permanente Senza Dermografo",
          "Corso Trucco Permanente Con Dermografo",
          "Corso Trucco Permanente Individuale",
          "Corso Trucco Permanente Parziale",
          "Corso Tricopigmentazione",
          "Corso Tricopigmentazione Senza Dermografo",
          "Corso Avanzato Pmu Elite Advanced",
          "Corso Laminazione",
          "Corso Extension",
          "Corso Bio Tattoo Henné",
          "Corso Total Needling",
          "Corso Total Needling Senza Dermografo",
          "Corso Avanzato Laminazione IKE",
          "Corso Colori e Correzioni",
          "Masterclass Evolution Strokes",
          "Corso Areolart",
          "Corso Extension Volume",
          "Master Avanzato",
          "Gemme Dentali"
        ]
      },
      {
        "chiave": "data_inizio",
        "etichetta": "Data inizio corso",
        "tipo": "data",
        "obbligatorio": true
      },
      {
        "chiave": "localita",
        "etichetta": "Località del corso",
        "tipo": "testo",
        "obbligatorio": true
      }
    ]
  },
  {
    "chiave": "modelle",
    "titolo": "Modelle",
    "tipo": "campi",
    "campi": [
      {
        "chiave": "modelle",
        "etichetta": "Seleziona una scelta",
        "tipo": "scelta",
        "obbligatorio": true,
        "voci": [
          "Cercherò io le modelle per il corso",
          "Ho chiesto che mi vengano trovate pagando la tariffa di 60 euro a modella"
        ],
        "nota": "Bonifico\nContanti"
      },
      {
        "chiave": "modelle_trico",
        "etichetta": "Seleziona una scelta",
        "tipo": "scelta",
        "obbligatorio": true,
        "voci": [
          "Cercherò io le modelle per il corso"
        ],
        "nota": "Taglia divisa *",
        "soloPer": "Tricopigmentazione"
      }
    ]
  },
  {
    "chiave": "pagamenti",
    "titolo": "Pagamenti",
    "tipo": "campi",
    "campi": [
      {
        "chiave": "data_pagamento",
        "etichetta": "Data di pagamento",
        "tipo": "data",
        "obbligatorio": true
      },
      {
        "chiave": "saldo_con_contanti",
        "etichetta": "Tipo di pagamento del saldo",
        "tipo": "tendina",
        "obbligatorio": true,
        "voci": [
          "Pagamento fino a 4 rate SCALAPAY (contiene iva 22%)",
          "Rateizzazione Appago fino a 24 rate (contiene 22% Iva)",
          "Bonifico anticipato (min 5 gg prima del corso) (contiene 22% Iva)",
          "Contanti"
        ],
        "nota": "Variante mostrata quando il contante è ammesso."
      },
      {
        "chiave": "saldo_senza_contanti",
        "etichetta": "Tipo di pagamento del saldo",
        "tipo": "tendina",
        "obbligatorio": true,
        "voci": [
          "Pagamento fino a 4 rate SCALAPAY (contiene iva 22%)",
          "Rateizzazione Appago fino a 24 rate (contiene 22% Iva)",
          "Bonifico anticipato (min 5 gg prima del corso) (contiene 22% Iva)"
        ],
        "nota": "Variante mostrata quando il contante NON è ammesso."
      },
      {
        "chiave": "acconto_mezzo",
        "etichetta": "Acconto pagato a mezzo",
        "tipo": "scelta",
        "obbligatorio": true,
        "voci": [
          "Bonifico",
          "Contanti",
          "Carta o Bancomat"
        ]
      },
      {
        "chiave": "acconto_euro",
        "etichetta": "Di Euro",
        "tipo": "numero",
        "obbligatorio": true
      },
      {
        "chiave": "taglia",
        "etichetta": "Taglia divisa",
        "tipo": "tendina",
        "obbligatorio": true,
        "voci": [
          "M",
          "L",
          "XL"
        ]
      }
    ],
    "nota": "M L XL"
  },
  {
    "chiave": "consensi",
    "titolo": "Consensi e firma",
    "tipo": "consensi"
  }
];

export const CONSENSI = {
  "regolamentoEtichetta": "Accettazione del Regolamento *",
  "regolamentoSpunta": "Dichiaro di aver preso visione di quanto specificato nel regolamento composto da 11 punti",

  // L'INFORMATIVA NON STA PIU' QUI. Sta nel Punto 9 del regolamento, che
  // e' il testo che l'allieva legge e firma: una sola scrittura, non due
  // che un giorno direbbero cose diverse. Qui resta solo il rimando.
  //
  // Quella di prima e' stata eliminata il 17/10/2026 per tre motivi: era
  // ancora costruita sul consenso ex art. 23 del D.Lgs. 196/03, cioe' su
  // una norma superata dal GDPR; chiedeva un consenso unico per cose
  // diverse, che il GDPR non ammette; e conteneva nome e codice fiscale
  // del legale rappresentante, dato personale di una persona viva dentro
  // un repository pubblico.
  "informativaEtichetta": "Informativa per il trattamento dei dati personali *",
  "informativaRimando": "L'informativa completa è il Punto 9 del regolamento qui sopra.",

  // LE DICHIARAZIONI CHE L'ALLIEVA SPUNTA.
  //
  // Una per riga, nessuna spuntata in partenza, e mai una sola casella
  // per cose diverse: il GDPR non ammette il consenso cumulativo, e le
  // clausole dell'art. 1341 vanno approvate a parte proprio perche' si
  // veda che sono state lette.
  //
  //   tipo "obbligatoria"  senza non si spedisce
  //   tipo "avvio"         compare solo se al corso mancano meno di
  //                        GIORNI_AVVIO_IMMEDIATO giorni (regole-recesso.js),
  //                        e allora e' obbligatoria
  //   tipo "facoltativa"   si puo' lasciare vuota e iscriversi lo stesso
  "caselle": [
    {
      "chiave": "regolamento",
      "tipo": "obbligatoria",
      "etichetta": "Regolamento",
      "testo": "Dichiaro di essere maggiorenne, di aver letto integralmente e compreso il Regolamento di partecipazione ai corsi Elitederma Srl (Punti da 1 a 11) e di accettarlo in ogni sua parte. Prendo atto che l’attestato certifica la sola formazione frequentata e non costituisce abilitazione professionale."
    },
    {
      "chiave": "clausole",
      "tipo": "obbligatoria",
      "etichetta": "Approvazione specifica (artt. 1341 e 1342 c.c.)",
      "testo": "Dichiaro di aver letto attentamente e di approvare specificamente le seguenti clausole del Regolamento:",
      "clausole": [
        "Punto 1, lett. b), d), e): rinvio del corso o cambio di sede; ammissione e rifiuto dell’iscrizione;",
        "Punto 2, lett. e): mancato accesso al corso in assenza del saldo;",
        "Punto 3, lett. b), c), d), g): non rimborsabilità di acconto e quota pre corso dopo il termine di recesso; penale di € 150 per il rinvio; perdita del recesso per iscrizioni a meno di 15 giorni dal corso; nessun rimborso per assenze o rinunce;",
        "Punto 4, lett. a), d), e), f): esclusione di responsabilità per strumenti non forniti; nessun reintegro del kit; responsabilità su kit e dermografo;",
        "Punto 5, lett. b), e), f): mancato rilascio dell’attestato; nessun rimborso dopo l’avvio del corso; allontanamento senza rimborso;",
        "Punto 6, lett. a), b): reperimento delle modelle a carico dell’allievo/a; contributo di € 180 per modella per il recupero della pratica;",
        "Punto 7, lett. b), c), d), e): servizio modelle senza garanzia di disponibilità, dovuto anche se non utilizzato;",
        "Punto 8, lett. b), c), d), e): responsabilità personale dell’allievo/a e limitazioni di responsabilità di Elitederma Srl;",
        "Punto 11, lett. c): foro di Roma per chi si iscrive con partita IVA."
      ]
    },
    {
      "chiave": "privacy",
      "tipo": "obbligatoria",
      "etichetta": "Privacy",
      "testo": "Dichiaro di aver letto l’Informativa sul trattamento dei dati personali (Punto 9)."
    },
    {
      "chiave": "avvio_immediato",
      "tipo": "avvio",
      "etichetta": "Avvio immediato",
      "testo": "Ai sensi dell’art. 59, lett. a) del D.Lgs. 206/2005, chiedo espressamente che Elitederma Srl avvii subito l’organizzazione del corso e prendo atto che per questo motivo perdo il diritto di recesso (Punto 3, lett. d)."
    },
    {
      "chiave": "promozionali",
      "tipo": "facoltativa",
      "etichetta": "Comunicazioni e aggiornamenti",
      "testo": "Desidero restare aggiornato sulle iniziative, le novità e le opportunità riservate della community Elitederma, attraverso i canali di comunicazione di Elitederma Srl, incluso WhatsApp. Potrò revocare il consenso in qualsiasi momento."
    },
    {
      "chiave": "immagini",
      "tipo": "facoltativa",
      "etichetta": "Immagini e video",
      "testo": "Autorizzo Elitederma Srl a pubblicare foto e video in cui compaio, realizzati durante il corso, come previsto al Punto 10."
    }
  ],
  "titoloFacoltative": "Queste puoi lasciarle vuote: l’iscrizione vale lo stesso.",

  "firmaEtichetta": "Firma *",
  "notaObbligatori": "*Campi obbligatori",
  "tastoInvio": "Accetto e Invio"
};

