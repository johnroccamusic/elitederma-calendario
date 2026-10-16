// IL MODULO DI ISCRIZIONE, copiato dal modulo che gira oggi su
// elitederma.eu/modulo-iscrizione-corsi.
//
// IL TESTO E' TRASCRITTO, NON RISCRITTO. Regolamento, informativa e
// consensi sono stati presi parola per parola dall'HTML della pagina e
// non riassunti: sono clausole contrattuali e un "quasi uguale" qui
// vorrebbe dire firmare una cosa diversa da quella che si e' letta. Se
// vanno cambiati, si cambiano di proposito — non per sbaglio.
//
// E' diviso in SEZIONI perche' tutto di fila e' un muro: nove punti di
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
        "titolo": "PUNTO 1 - SEDE DEL CORSO",
        "punti": [
          "a) Il corso si terrà presso la sede che sarà comunicata da Elitederma Srl tramite i propri rappresentanti ufficiali prima dell’inizio.",
          "b) In caso di forza maggiore (es. provvedimenti delle autorità, emergenze sanitarie, motivi politici/amministrativi/sociali o esigenze organizzative), Elitederma Srl potrà rinviare la data o modificare la sede (nella stessa città o provincia), informando gli iscritti con preavviso minimo di 5 giorni di calendario. In tal caso, l’acconto resta valido e potrà essere utilizzato per lo stesso corso o per un altro corso Elitederma, in data/sede diversa. Non saranno dovuti rimborsi dell’acconto, interessi o rimborsi/indennizzi per viaggi, alloggi, penali o altre spese.",
          "c) L’ammissione al corso è subordinata alla valutazione insindacabile di Elitederma Srl in funzione dell’omogeneità dell’aula, dei prerequisiti richiesti e delle norme vigenti.",
          "d) Elitederma Srl può rifiutare l’iscrizione (anche se già pagata) comunicandolo all’interessata entro 5 giorni antecedenti l’inizio; in tal caso, le somme versate saranno rimborsate tramite bonifico. Non saranno dovuti ulteriori rimborsi o indennizzi."
        ]
      },
      {
        "titolo": "PUNTO 2 - CONDIZIONI DI PARTECIPAZIONE E PAGAMENTO",
        "punti": [
          "a) L’iscrizione è riservata a maggiorenni ed è valida solo con il versamento dell’acconto secondo importi e modalità previsti in fase di iscrizione.",
          "b) La ricevuta di pagamento va inviata a Elitederma Srl (e-mail/WhatsApp/consegna a mano). Faranno fede la ricevuta di pagamento e la sottoscrizione del presente contratto generata dal sito.",
          "c) Il saldo della quota va effettuato quando previsto, parte entro 15 giorni dal corso ed eventuale saldo all’arrivo in aula: contanti, assegno circolare o bonifico eseguito almeno 5 giorni prima (con ricevuta).",
          "d) Non sono ammessi pagamenti parziali o dilazionati, salvo diverso accordo preventivamente concordato con l’amministrazione. In tali casi, le modalità e le tempistiche di pagamento verranno definite al momento dell’iscrizione, previa valutazione della fattibilità da parte di Elitederma Srl.",
          "Eventuali pagamenti rateali o posticipati dovranno essere formalizzati esclusivamente prima dell’inizio del corso, con approvazione scritta da parte di Elitederma Srl.",
          "In assenza del saldo completo alla data del corso, l’accesso potrà essere negato senza che ciò comporti diritto a rimborso o compensazione."
        ]
      },
      {
        "titolo": "PUNTO 3 - DISDETTE, RINVII E PENALI",
        "punti": [
          "a) Ai sensi degli articoli 52 e seguenti del D.Lgs. 206/2005 (Codice del Consumo), le quote versate a titolo di acconto, iscrizione parziale o saldo sono rimborsabili solo entro 14 giorni dal pagamento, termine entro il quale è esercitabile il diritto di recesso per i contratti conclusi a distanza. Decorso tale termine, il diritto di rimborso decade e le somme corrisposte diventano non rimborsabili. Resta comunque possibile, a discrezione dell’organizzazione, spostare la data di partecipazione al corso fino a 30 giorni prima dell’inizio con le modalità previste al successivo paragrafo b.",
          "b) In caso di rinvio richiesto entro 30 giorni dalla data del corso è dovuta una penale di €150; senza il pagamento della penale lo spostamento non sarà possibile e l’acconto sarà trattenuto a copertura delle spese organizzative sostenute.",
          "c) Ai sensi dell’articolo 59, lettera a) del D.Lgs. 206/2005 (Codice del Consumo), il diritto di recesso non si applica alle prestazioni di servizi la cui esecuzione sia iniziata o debba iniziare entro il periodo di recesso di 14 giorni, con il consenso espresso del consumatore. Pertanto, per le iscrizioni effettuate nei 15 giorni precedenti la data di inizio del corso, il partecipante accetta espressamente che l’Accademia dia immediato avvio alle procedure organizzative (prenotazione aula, materiale didattico, modella, personale docente, acquisto dei kit, ecc.) e riconosce che, per tale motivo, non potrà esercitare il diritto di recesso né richiedere il rimborso o il rinvio.",
          "In tali casi, le somme versate restano definitivamente acquisite a titolo di copertura delle spese organizzative anticipate.",
          "d) Le comunicazioni ufficiali (recesso/rinvio) devono avvenire esclusivamente via PEC:",
          "📧 [email protected]",
          "e) I rimborsi approvati saranno effettuati da Elitederma Srl entro 30 giorni dalla richiesta valida ovvero via PEC.",
          "f) In caso di assenza dell’allievo/a al corso, ritardi, interruzione della frequenza o rinuncia alle esercitazioni post-corso (Web Academy e livelli online), non sono previsti rimborsi totali o parziali. La Web Academy è parte integrante del corso in aula e non è rimborsabile separatamente.",
          "g) Sono esclusi rimborsi per eventuali materiali acquistati autonomamente dall’allievo/a."
        ]
      },
      {
        "titolo": "PUNTO 4 - KIT MATERIALI E ATTREZZATURE",
        "punti": [
          "a) a) La didattica è calibrata su prodotti/attrezzature consigliati da Elitederma Srl; l’azienda non risponde di problematiche derivanti da strumenti non distribuiti/approvati (es. aghi, dermografi portati dall’allievo/a).",
          "b) La quota comprende: attività didattiche, kit fornito, uso delle attrezzature d’aula (lettino, carrellino, lampada), assistenza docenti, attestato finale, eventuale supporto post-corso e kit/prodotti/attrezzature come scelti in fase di iscrizione.",
          "c) Le attrezzature d’aula sono concesse in comodato d’uso gratuito per la durata del corso e vanno usate con diligenza; non è consentito l’uso di attrezzature non autorizzate.",
          "d) Il kit di prodotti e materiali fornito al corso ha esclusiva finalità didattica ed è destinato a consentire all’allievo/a di svolgere le esercitazioni previste durante il percorso formativo e, se previsto, quelle successive a casa.",
          "Eventuali quantità residue non utilizzate durante il corso potranno essere impiegate dall’allievo/a per la propria attività professionale o per ulteriori esercitazioni personali, fermo restando che tutti i materiali sono forniti in quantità idonee allo svolgimento delle esercitazioni e non costituiscono una scorta di prodotti a uso commerciale. Pertanto, non è dovuto alcun reintegro, sostituzione o fornitura aggiuntiva per i prodotti utilizzati, terminati o danneggiati durante le attività pratiche o teoriche.",
          "L’allievo/a riconosce che il valore del kit costituisce parte integrante e inscindibile del corso di formazione e non possiede un valore autonomo separabile dal costo complessivo del corso.",
          "e) Dal momento della consegna, l’allievo/a è l’unico/a responsabile del kit; in caso di furto/smarrimento o danni alle attrezzature fornite nel kit non è previsto rimborso né reintegro e l’allievo/a risponderà dei danni.",
          "f) Le indicazioni sul numero di trattamenti realizzabili con il kit sono stimate, basate su un uso ottimale. Consumi eccedenti, sprechi o uso in parte durante il corso possono ridurre il numero di trattamenti possibili e non danno diritto a reintegri o sostituzioni gratuite."
        ]
      },
      {
        "titolo": "PUNTO 5 – REGOLAMENTO DI PARTECIPAZIONE E FREQUENZA",
        "punti": [
          "a) La frequenza integrale di tutte le giornate di corso, comprese le eventuali prove pratiche, è obbligatoria per il rilascio dell’attestato di partecipazione.",
          "L’attestato certifica esclusivamente la formazione frequentata e non costituisce abilitazione professionale. L’allievo/a dovrà informarsi in merito ai requisiti regionali necessari per esercitare la professione (es. diploma di estetista o attestato regionale tatuaggio/dermopigmentazione).",
          "b) È richiesta massima puntualità e partecipazione attiva alle attività teoriche e pratiche.",
          "In caso di rinuncia alla pratica o di pratica parziale su modella, Elitederma Srl si riserva la facoltà di non rilasciare l’attestato.",
          "c) L’iscrizione ai corsi è strettamente personale e non cedibile a terzi. Gli allievi dovranno attenersi alle istruzioni e alle direttive impartite dai docenti e dal personale Elitederma Srl. Durante le lezioni è vietato consumare cibi o bevande e utilizzare telefoni cellulari. Riprese fotografiche o video sono consentite solo previa autorizzazione dell’organizzazione.",
          "d) Tutte le spese di trasferta, vitto, alloggio, pranzi e cene sono interamente a carico dell’allievo/a.",
          "e) Una volta avviato il corso e consegnato il kit didattico, non saranno possibili rimborsi, sostituzioni o cambi di corso, indipendentemente dalla motivazione.",
          "f) Elitederma Srl e i docenti si riservano il diritto di allontanare immediatamente dal corso l’allievo/a che, con comportamenti non consoni, scorretti, diffamatori o pregiudizievoli, comprometta il regolare svolgimento dell’attività formativa o arrechi disturbo a docenti, personale incaricato o altri partecipanti.",
          "In tali casi nessun rimborso, indennizzo o compensazione sarà dovuto, nemmeno a titolo di spese di viaggio, vitto, alloggio, penali o interessi.",
          "g) Tutti i materiali didattici, teorici e pratici (testi, immagini, metodi, protocolli, video, marchi, loghi e documenti) sono di proprietà esclusiva di Elitederma Srl e tutelati ai sensi degli artt. 2575 e seguenti del Codice Civile e della Legge 633/1941 sul diritto d’autore. È vietata qualsiasi riproduzione, copia, condivisione o utilizzo non autorizzato, anche parziale.",
          "Chi utilizza tali materiali per scopi formativi o commerciali non autorizzati potrà essere perseguito nelle sedi civili e penali competenti.",
          "h) Ai sensi della normativa vigente sulla tutela dei dati personali (Reg. UE 2016/679), il partecipante autorizza Elitederma Srl a trattare i propri dati per finalità organizzative, amministrative, statistiche e informative, consapevole della possibilità di richiedere in ogni momento la cancellazione o rettifica dei dati scrivendo a:",
          "📧 [email protected]"
        ]
      },
      {
        "titolo": "PUNTO 6 – REGOLAMENTO E REQUISITI MODELLE/I",
        "punti": [
          "a) Le modelle dovranno essere reperite dagli allievi a propria cura e spese e dovranno intervenire al corso in base agli orari comunicati dall’organizzazione. Non sono ammessi spostamenti dell’orario in cui devono intervenire le modelle se non autorizzati 15 giorni prima del corso.",
          "b) Qualora l’allievo/a non riesca a reperire una modella, oppure la modella designata non si presenti o non possa, per qualsiasi motivo, partecipare alle sessioni pratiche, e di conseguenza l’allievo/a non possa svolgere la parte pratica del corso, nessuna responsabilità potrà essere attribuita a Elitederma Srl.",
          "In tali circostanze, l’allievo/a potrà recuperare la parte pratica partecipando a una sessione successiva, previo versamento di un contributo organizzativo pari a €180,00 per ciascuna modella.",
          "In tale eventualità, l’allievo/a avrà la possibilità di partecipare a una sessione successiva per recuperare la pratica, previo versamento di un contributo organizzativo pari a €180,00 per ciascuna modella.",
          "c) Le modelle dovranno essere maggiorenni; se minorenni, occorrerà avere l’autorizzazione di entrambi i genitori (o chi ne fa le veci).",
          "d) Modelle e accompagnatori non possono assistere o sostare in aula.",
          "e) Le modelle devono essere in buona salute; per microblading/PMU non devono avere lavori pregressi sulla zona da trattare.",
          "f) Non sono idonee modelle con: terapie in corso (antibiotici, cortisonici, chemioterapici, ecc.), febbre/sintomi influenzali, allergie/dermatiti, malattie cutanee/autoimmuni, diabete, gravidanza o allattamento. Eventuali condizioni vanno comunicate tempestivamente all’organizzazione.",
          "g) Per quanto riguarda il corso di Tricopigmentazione, ogni allievo/a è tenuto/a a reperire autonomamente il proprio modello/a per lo svolgimento delle esercitazioni pratiche.",
          "Non sarà possibile incaricare Elitederma Srl del reperimento dei modelli. Qualora l’allievo/a non riesca a procurarsi un modello/a, potrà svolgere la pratica su un modello/a condiviso messo a disposizione da Elitederma Srl insieme agli altri partecipanti.",
          "In tale circostanza, nessuna responsabilità potrà essere imputata a Elitederma Srl, né sarà dovuto alcun rimborso, totale o parziale, della quota di partecipazione al corso."
        ]
      },
      {
        "titolo": "PUNTO 7 – REPERIMENTO MODELLE A CURA DI ELITEDERMA SRL PER ALLIEVI LONTANI DALLA SEDE DEL CORSO",
        "punti": [
          "a) Unicamente nel caso in cui l’allievo/a provenga da una città diversa da quella in cui si tiene il corso, con una distanza superiore ai 50 km, potrà richiedere ad Elitederma Srl di reperire le modelle necessarie alle esercitazioni: €60/modello/a se la richiesta avviene entro 7 giorni dal corso; €100/modella se la richiesta avviene nei 7 giorni precedenti il corso.",
          "Tale opzione non è applicabile al corso di tricopigmentazione che in caso di mancanza del modello/a potrà comunque avvalersi del modello/a condiviso messo a disposizione dell’accademia.",
          "b) Il reperimento non garantisce la disponibilità effettiva delle modelle, vista la natura del servizio; in caso di rinuncia/mancata disponibilità non è dovuto alcun rimborso del corso.",
          "c) Non sono ammesse obiezioni su tipologia/estetica/caratteristiche fisiche della modella, poiché la selezione avviene per disponibilità.",
          "d) Se, dopo aver richiesto il servizio, l’allievo/a reperisce una modella per proprio conto, il servizio resta dovuto (a copertura delle spese per sponsorizzazioni, pubblicità e costi di ricerca già sostenuti).",
          "e) Se Elitederma Srl non reperisce la modella richiesta, l'importo del servizio sarà rimborsato.",
          "f) Il pagamento del servizio va effettuato la mattina del primo giorno; in mancanza del pagamento, le modelle reperite saranno disdette e nulla sarà dovuto a titolo di rimborso."
        ]
      },
      {
        "titolo": "PUNTO 8 – RESPONSABILITÀ, SICUREZZA E OBBLIGHI DELL’ALLIEVO/A",
        "punti": [
          "a) Elitederma Srl e i docenti forniscono con la massima attenzione istruzioni, procedure e dimostrazioni volte a garantire un apprendimento sicuro, igienico e tecnicamente corretto.",
          "b) Durante l’esecuzione pratica, ogni gesto tecnico è svolto sotto la diretta responsabilità dell’allievo/a.",
          "Eventuali esiti indesiderati dovuti a imperizia, imprudenza, distrazione o inosservanza delle indicazioni non sono imputabili a Elitederma Srl, ai docenti o ai master incaricati. L’azienda assicura comunque costante supervisione per prevenire o ridurre al minimo tali eventualità.",
          "c) Se la modella non rispetta le norme di igiene, sicurezza o comportamento impartite dai docenti, eventuali danni o disagi a sé stessa o all’allievo/a non potranno in alcun modo essere imputati a Elitederma Srl, ai docenti o ai master.",
          "d) Poiché l’allievo è il diretto esecutore dei trattamenti, la responsabilità del proprio operato rimane personale. L’allievo riconosce di essere il diretto esecutore dei trattamenti svolti sulle modelle e si assume ogni responsabilità per eventuali danni, lesioni o effetti indesiderati derivanti dal proprio operato, esonerando integralmente l’organizzazione e i formatori da qualsiasi obbligo risarcitorio.",
          "e) Il partecipante solleva Elitederma Srl, i docenti e i master designati da ogni responsabilità civile, penale e amministrativa derivante da proprie azioni, condotte o errori durante le esercitazioni pratiche.",
          "f) Elitederma Srl non garantisce risultati assoluti né può prevedere le reazioni individuali delle modelle, comprese eventuali intolleranze, comportamenti imprevedibili, rifiuti o condizioni non dichiarate (patologie, stati di salute, farmaci, ecc.). L’attività pratica costituisce un momento formativo e supervisionato, non una prestazione professionale verso terzi.",
          "g) Restano fermi gli obblighi di diligenza e prudenza previsti dagli artt. 2043, 2046 e 2050 del Codice Civile e dall’art. 43 del Codice Penale; l’allievo/a è personalmente responsabile dell’uso corretto delle tecniche.",
          "h) Con la sottoscrizione del presente regolamento, l’allievo/a dichiara di aver compreso che Elitederma Srl adotta tutte le misure necessarie per assicurare un ambiente sicuro e controllato, ma che la corretta applicazione delle tecniche apprese rimane nella propria sfera di controllo e responsabilità."
        ]
      },
      {
        "titolo": "PUNTO 9 – TRATTAMENTO DEI DATI PERSONALI (ART. 13 REG. UE 2016/679)",
        "punti": [
          "Con la sottoscrizione del presente contratto, l’allievo/a autorizza implicitamente Elitederma Srl al trattamento dei propri dati personali, nel rispetto del GDPR, per finalità connesse a organizzazione, gestione amministrativa/didattica e comunicazioni su corsi/eventi/aggiornamenti (art. 6, par. 1, lett. b–f).",
          "I dati sono trattati da personale autorizzato, con strumenti cartacei ed elettronici, secondo gli artt. 5 e 32 GDPR; possono essere comunicati a soggetti terzi solo se necessari all’erogazione del corso (docenti, collaboratori, consulenti, enti partner, autorità competenti).",
          "Il conferimento è necessario per l’esecuzione del rapporto formativo; eventuali dati appartenenti a categorie particolari (art. 9 GDPR) saranno trattati nella misura strettamente necessaria.",
          "Diritti dell’interessata (artt. 15–22 GDPR): accesso, rettifica, cancellazione, limitazione, portabilità, opposizione, revoca del consenso (senza pregiudizio per i trattamenti già effettuati) e reclamo al Garante (art. 77).",
          "📧 Per esercitare i diritti scrivere a: [email protected]",
          "Dati personali del corsista"
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
  "regolamentoSpunta": "Dichiaro di aver preso visione di quanto specificato nel regolamento composto da 6 punti",
  "immaginiTesto": "Autorizzo inoltre, a titolo gratuito, senza limiti di tempo, anche ai sensi degli artt. 10 e 320 cod.civ. e degli artt. 96 e 97 legge 22.4.1941, n. 633, Legge sul diritto d’autore, alla pubblicazione e/o diffusione in qualsiasi forma delle proprie immagini, scattate e/o riprese in occasione del corso, sul sito internet di Elitederma srl, su carta stampata e/o su qualsiasi altro mezzo di diffusione, nonché autorizza la conservazione delle foto e dei video stessi negli archivi informatici di Elitederma srl e prende atto che la finalità di tali pubblicazioni sono meramente di carattere informativo ed eventualmente promozionale.\nSi applica la nostra dichiarazione sulla Informativa Privacy.",
  "informativaEtichetta": "Informativa per il trattamento dei dati personali *",
  "informativaScelte": [
    "ACCONSENTE",
    "NON ACCONSENTE"
  ],
  "informativaTesto": [
    "I dati personali da Lei conferiti e che La riguardano saranno trattati nel rispetto dell’art. 13 del Regolamento UE 2016/67 (“Codice in materia di protezione dei dati personali”), dei principi di liceità e correttezza, garantendo la sua riservatezza e la protezione dei dati.",
    "I dati saranno utilizzati esclusivamente per lo svolgimento dell’attività della Elitederma S.r.l. con sede in Roma. Il trattamento dei dati raccolti sarà svolto esclusivamente dai soggetti incaricati secondo apposita autorizzazione da parte del titolare dei dati medesimi, in forma manuale/cartacea e mediante strumenti elettronici, ed in forma mista. I dati saranno raccolti e trattati nel pieno rispetto della normativa in materia di tutela dei dati personali.",
    "Finalità del trattamento: I dati personali forniti sono necessari ai fini per cui gli incaricati al trattamento dei dati svolgono funzioni di raccolta ed elaborazione dati per lo svolgimento dell’attività della Elitederma S.r.l.",
    "Diritti dell’interessato: In relazione ai dati oggetto del trattamento di cui alla presente informativa all’interessato è riconosciuto in qualsiasi momento il diritto di:",
    "- Accesso (art. 15 Regolamento UE n. 2016/679);",
    "- Rettifica (art. 16 Regolamento UE n. 2016/679);",
    "- Cancellazione (art. 17 Regolamento UE n. 2016/679);",
    "- Limitazione (art. 18 Regolamento UE n. 2016/679);",
    "- Portabilità, intesa come diritto ad ottenere dal titolare del trattamento i dati in un formato strutturato di uso comune e leggibile da dispositivo automatico per trasmetterli ad un altro titolare del trattamento senza impedimenti (art. 20",
    "Regolamento UE n. 2016/679);",
    "- Opposizione al trattamento (art. 21Regolamento UE n. 2016/679);",
    "- Revoca del consenso al trattamento, senza pregiudizio per la liceità del trattamento basata sul consenso acquisito prima della revoca (art. 7, par. 3 Regolamento UE n. 2016/679);",
    "- Proporre reclamo all’Autorità Garante per la Protezione dei dati personali (art. 51 Regolamento UE n. 2016/679).",
    "Titolare de trattamento è Elitederma S.r.l. con sede legale in Via Terni 90/a – 00182 Roma Partita Iva 16179891003 in nome del suo legale rappresentante Gianluca Rocca cod. fiscale RCCGLC68H03L719U",
    "Autorizzazione/consenso al trattamento ex. Art.23 D. Lgs. 196/03. ai sensi e per gli effetti dell’art. 7 e ss. del Regolamento (UE) 2016/679, con la sottoscrizione del presente modulo al trattamento dei dati personali secondo le modalità e nei limiti di cui all’informativa allegata ivi inclusi quelli considerati come categorie particolari di dati."
  ],
  "firmaEtichetta": "Firma *",
  "notaObbligatori": "*Campi obbligatori",
  "tastoInvio": "Accetto e Invio"
};
