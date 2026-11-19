// IL CONTRATTO DI COLLABORAZIONE DELLA MASTER.
//
// TRASCRITTO, NON RISCRITTO, e nemmeno battuto a mano: il testo arriva
// da `Contratto_Elitederma_completo.pdf` (21 pagine, versione sintetica
// del 14 novembre 2026) letto con pdfjs e ricomposto in paragrafi dalle
// coordinate delle righe. Sono clausole contrattuali: un «quasi uguale»
// qui vorrebbe dire far firmare una cosa diversa da quella consegnata.
// Chi lo corregge lo corregge di proposito, non per sbaglio.
//
// IL SOLO SPAZIO IN BIANCO DEL CORPO era l'art. 9.6 — «entro il giorno
// [___] del mese successivo», il giorno in cui si pagano le dodici rate
// del patto di non concorrenza. Deciso dal titolare: il GIORNO 5.
//
// GLI ALTRI SPAZI IN BIANCO NON SONO TESTO, SONO DATI, e per questo non
// stanno qui dentro: l'epigrafe del/della Master (nome, codice fiscale,
// nascita, residenza, P. IVA, PEC, email) la compone `epigrafeMaster` dai
// dati che lei scrive nel modulo, e «Luogo e data» dal suo comune di
// residenza e dal giorno in cui firma. Lasciarli come trattini e farli
// riempire a penna su un PDF vorrebbe dire un contratto che si firma
// senza sapere chi lo firma.
//
// DOVE VIVE DAVVERO. Come il regolamento del modulo di iscrizione
// (vedi `src/iscrizione/contenuto.js` e la nota in testa a `testi.js`),
// questo testo sta ANCHE nel database, in `master_contratti_testi`, ed e'
// da li' che il server compone la copia congelata alla firma. Il codice
// resta la rete per far VEDERE la pagina se la query fallisce, e il testo
// di partenza a cui «Rimetti com'era» torna. Le due copie nascono
// identiche: la migrazione che carica le righe e' generata da questo file.
//
// LA FORMA E' LA STESSA DEL REGOLAMENTO: blocchi `{ titolo, punti[] }`,
// un paragrafo per voce. Le voci che cominciano per «• » sono elenchi e
// chi disegna le rientra; tutto il resto e' un capoverso. Una forma sola
// per i due contratti vuol dire un solo modo di stamparli e di
// correggerli.

export const INTESTAZIONE = {
  titolo: "CONTRATTO DI COLLABORAZIONE PROFESSIONALE AUTONOMA",
  sottotitolo: "Master / Docente – ELITEDERMA",
  versione: "Versione sintetica – 14 novembre 2026",
};

// LE PARTI. Quella dell'Accademia e' testo e sta qui; quella del/della
// Master e' un modello con i suoi dati dentro — `epigrafeMaster` ci
// mette i valori veri, e quello che manca resta nei trattini del
// cartaceo, perche' un dato che non c'e' si deve vedere che non c'e'.
export const PARTI = {
  etichettaAccademia: "Tra",
  accademia: "Elitederma S.r.l., con sede legale in Roma, Via Terni 90/A, 00182, C.F. e P. IVA 16179891003, PEC elitedermasrl.pec@legalmail.it, in persona del legale rappresentante pro tempore, di seguito «Accademia» o «Elitederma»;",
  etichettaMaster: "e",
  epigrafeModello: "[Nome e cognome], C.F. [________________], nato/a a [________________] il [__/__/____], residente in [________________], Via [________________] n. [___], CAP [_____], P. IVA [________________], PEC [________________], email [________________], di seguito «il/la Master».",
};

export const PREMESSE = {
  titolo: "PREMESSE",
  punti: [
    "A) Elitederma S.r.l. organizza e commercializza attività formative professionali nell'estetica avanzata, nella dermopigmentazione e nelle discipline correlate. Il marchio «Elitederma» è di titolarità esclusiva di Gian Luca Rocca, persona fisica e amministratore della Società, che ne consente l'uso alla Società senza trasferirne la proprietà.",
    "B) Nei corsi l'Accademia impiega programmi, materiali, protocolli e informazioni tecnico-commerciali che, se non pubblici e dotati dei requisiti di legge, costituiscono suo patrimonio riservato. Restano salvi i saperi professionali di dominio pubblico e le tecniche preesistenti del/della Master.",
    "C) Le parti instaurano un rapporto di prestazione d'opera professionale autonoma ai sensi degli artt. 2222 e seguenti del Codice civile.",
    "D) Il «Manifesto Elitederma», versione 13 del 14/11/2026, è consegnato al/alla Master e allegato sub A. Esprime valori, missione e stile dell'Accademia e non contiene obblighi ulteriori rispetto al presente contratto (art. 23.2).",
    "E) Riservatezza, esclusiva e non concorrenza proteggono interessi commerciali e organizzativi specifici dell'Accademia, senza impedire al/alla Master l'esercizio della professione nei limiti qui consentiti.",
    "F) Dalla data di efficacia il contratto sostituisce i precedenti accordi di pari oggetto, salvi i diritti già maturati, le obbligazioni già eseguite e le pattuizioni che le parti indichino per iscritto come ancora efficaci. Le prestazioni anteriori restano regolate dagli accordi del tempo; nessuna penale o restrizione qui prevista opera per fatti anteriori alla sottoscrizione.",
    "Le premesse e gli allegati sono parte integrante del contratto.",
  ],
};

export const ARTICOLI = [
  {
    titolo: "Art. 1 – Definizioni",
    punti: [
      "Nel contratto i termini che seguono hanno il significato qui indicato.",
      "• «Master»: il/la professionista che sottoscrive il contratto, indicato/a anche come Docente. Il termine vale per professionisti e professioniste; dove aggettivi, participi e pronomi compaiono al solo maschile, ciò avviene per semplicità di lettura.",
      "• «Concorrente» e «direttamente concorrente»: il soggetto che offre, e l'attività formativa che costituisce, formazione direttamente sovrapponibile per contenuti e destinatari a quella concretamente commercializzata da Elitederma.",
      "• «Prodotti Elitederma»: prodotti, pigmenti, colori, dermografi, aghi, consumabili, strumenti e accessori commercializzati da Elitederma, compresi quelli a marchio di terzi che Elitederma abbia selezionato per la rivendita, i kit didattici o l'impiego nei corsi, finché dura la selezione. Questi ultimi possono essere presentati come selezionati o distribuiti da Elitederma, senza attribuirle la titolarità del marchio o la produzione; la selezione non si estende ad altri prodotti dello stesso marchio né a collaborazioni o sponsorizzazioni autonome.",
      "• «Canali ufficiali»: gruppi, accademie online, chat, piattaforme didattiche e ogni altro canale istituzionale dell'Accademia.",
      "• «Profili professionali»: profili social, siti web e canali che il/la Master utilizza per la propria attività professionale; sono esclusi i profili strettamente personali.",
      "• «Lavoro»: il contenuto (post, reel, carosello o video) che mostra un trattamento eseguito dal/dalla Master.",
      "• «Supporto post-corso»: l'assistenza didattica agli allievi dopo il corso (art. 5); «Supporto residuo»: quello che prosegue dopo la cessazione del rapporto (art. 17).",
      "• «Autorizzazione»: il consenso scritto e preventivo di Elitederma. Il silenzio non vale assenso.",
    ],
  },
  {
    titolo: "Art. 2 – Oggetto e natura del rapporto",
    punti: [
      "2.1. Oggetto. Il/la Master esegue, dopo l'accettazione dei singoli incarichi, attività di docenza nei corsi organizzati da Elitederma. Per ciascun incarico le parti concordano per iscritto, anche via email, corso, sede, date, giornate ed esigenze tecniche essenziali. Non è garantito un numero minimo di incarichi né è dovuta una presenza continuativa presso le sedi dell'Accademia.",
      "2.2. Autonomia. Il rapporto è di lavoro autonomo professionale. Il/la Master organizza in autonomia la propria attività, può svolgere altre prestazioni lecite nei limiti del contratto e non è sottoposto a potere gerarchico o disciplinare. Sede, calendario e sequenza didattica dei corsi rispondono alle esigenze del servizio concordato e non costituiscono un orario di lavoro; le concrete modalità del rapporto restano coerenti con la sua natura autonoma.",
      "2.3. Posizione professionale. Il/la Master opera con propria posizione fiscale e previdenziale, emette regolare documento fiscale e garantisce il possesso delle abilitazioni richieste per le prestazioni eseguite.",
      "2.4. Prestazione personale. Il/la Master esegue personalmente l'incarico accettato; ogni sostituzione richiede il preventivo consenso dell'Accademia.",
      "2.5. Assicurazione e responsabilità. Il/la Master mantiene attiva, per la durata del rapporto e del Supporto residuo, una polizza di responsabilità civile professionale adeguata alle attività svolte, comprese dimostrazioni e trattamenti su modelle e allievi, e ne fornisce copia su richiesta. Risponde dei danni cagionati a terzi per dolo o colpa nell'esecuzione delle prestazioni e tiene indenne l'Accademia dalle relative pretese, nei limiti in cui il danno gli sia imputabile; restano a carico dell'Accademia le responsabilità relative a locali, attrezzature e prodotti da essa forniti.",
    ],
  },
  {
    titolo: "Art. 3 – Svolgimento dei corsi",
    punti: [
      "3.1. Condotta. Durante i corsi e le iniziative Elitederma il/la Master mantiene un comportamento rispettoso, disponibile e professionale, un linguaggio corretto e un abbigliamento elegante o casual-elegante, adeguato all'immagine dell'Accademia e nei limiti della ragionevolezza. Sono vietate condotte discriminatorie, offensive, irriverenti o idonee a compromettere la sicurezza, la dignità delle persone o il corretto svolgimento del corso. In aula è indicato con il titolo «Master».",
      "3.2. Programma. Il/la Master rispetta gli obiettivi formativi, il programma e i protocolli ufficiali, le procedure igienico-sanitarie, le prescrizioni di sicurezza e le tempistiche del corso concordato, senza introdurre contenuti non previsti. Salvo diverso accordo per il singolo incarico, il programma standard della giornata va dalle 9:30 alle 18:00, con pause alle 11:30 (20 minuti), alle 13:30 (un'ora) e alle 16:30 (20 minuti); il termine non è anticipabile.",
      "3.3. Allestimento e apertura. Il/la Master partecipa con gli assistenti all'allestimento della sala, delle postazioni e dei kit, quando possibile il giorno precedente l'inizio del corso; verifica la presenza di materiali, consensi informati delle modelle e diplomi e segnala ai responsabili ogni carenza. In apertura presenta il team, la storia e la filosofia Elitederma, il funzionamento del kit e le regole d'aula, compreso il divieto di uso dei cellulari fuori dai momenti dedicati, e invita gli allievi a seguire le pagine ufficiali e a taggare l'Accademia nei contenuti del corso.",
      "3.4. Prodotti in aula. Nei corsi, nelle dimostrazioni e nei contenuti realizzati per Elitederma il/la Master utilizza e mostra soltanto Prodotti Elitederma, salve esigenze di sicurezza, disponibilità o specificità tecnica del trattamento, e non propone né compara prodotti di altri marchi. Il logo è usato sui materiali ufficiali secondo le linee guida ricevute.",
      "3.5. Presentazione di prodotti e corsi. Rientra nell'incarico presentare agli allievi, a ogni corso e nei momenti dedicati (dimostrazioni, fine giornata, consegna degli attestati), i Prodotti Elitederma e gli ulteriori corsi Elitederma, in modo corretto, non aggressivo e non ingannevole e con affermazioni verificabili. Il/la Master non è soggetto a obiettivi di vendita né a obblighi di risultato commerciale. Ordini e prenotazioni seguono le procedure e le politiche di prezzo dell'Accademia.",
      "3.6. Divieto verso gli allievi. Nei rapporti con gli allievi Elitederma, in aula, nel Supporto post-corso e in ogni altra occasione connessa agli incarichi, il/la Master non propone, non consiglia e non suggerisce, neppure in modo informale, prodotti, marchi, corsi o servizi concorrenti con quelli di Elitederma. Restano salve le indicazioni dovute per ragioni di sicurezza o di legge e quelle relative a categorie non presenti nell'offerta Elitederma.",
      "3.7. Chiusura e report. Le foto di gruppo e di consegna degli attestati si realizzano al termine dell'ultima giornata; il/la Master pubblica la foto di gruppo sui propri Profili professionali taggando l'Accademia, invita gli allievi a lasciare una recensione e trasmette all'Accademia, entro 48 ore dalla chiusura, il report di fine corso (presenze effettive, andamento della classe, problemi organizzativi o tecnici, osservazioni sull'apprendimento e suggerimenti).",
    ],
  },
  {
    titolo: "Art. 4 – Formazione, aggiornamento ed eventi",
    punti: [
      "4.1. Requisito. L'affidamento dei corsi di una disciplina presuppone che il/la Master abbia completato la formazione ufficiale Elitederma prevista per quella disciplina, la mantenga aggiornata e abbia superato la verifica di preparazione richiesta prima di assumere il ruolo didattico.",
      "4.2. Aggiornamenti. Riunioni e aggiornamenti necessari alla qualità o alla sicurezza dei corsi sono programmati in anticipo e concordati con il/la Master. Quando sono imposti come requisito indispensabile per gli incarichi Elitederma, il costo della formazione organizzata dall'Accademia resta a suo carico, salvo diverso accordo specifico lecito.",
      "4.3. Percorsi avanzati. I percorsi avanzati facoltativi, anche con formatori esterni, possono essere offerti con costo ripartito al 50% tra Accademia e Master, purché programma, prezzo e quota siano comunicati e accettati per iscritto prima dell'iscrizione. Se il/la Master non aderisce, l'Accademia può non affidargli i corsi per i quali quella formazione è requisito, senza altre conseguenze. Ogni trattenuta sul compenso richiede un'autorizzazione scritta specifica, con importo e piano di compensazione, salvo quanto previsto all'art. 4.4.",
      "4.4. Restituzione dei costi di formazione. Se il/la Master recede o comunica disdetta, oppure il contratto è risolto per suo inadempimento ai sensi dell'art. 19, entro sei mesi dalla conclusione di un corso di formazione o aggiornamento il cui costo sia stato sostenuto in tutto o in parte dall'Accademia, restituisce a Elitederma la quota da questa sostenuta, nei limiti dei costi documentati (formatori esterni, iscrizioni e trasferte) il cui importo gli sia stato comunicato per iscritto prima della partecipazione. La restituzione avviene entro trenta giorni dalla cessazione e può essere compensata con i compensi ancora dovuti, valendo la presente clausola come autorizzazione alla trattenuta. Nulla è dovuto se la cessazione dipende dal recesso, dalla disdetta o da un inadempimento di Elitederma.",
      "4.5. Eventi ufficiali. La partecipazione agli eventi ufficiali dell'Accademia è concordata tenendo conto della disponibilità del/della Master. Quando l'Accademia ne richiede la presenza con un ruolo operativo, compenso e rimborsi sono definiti prima per iscritto (artt. 12.6 e 13).",
      "4.6. Nuovi corsi proposti dal/dalla Master. Il/la Master può proporre l'inserimento in programmazione di tecniche o metodologie proprie. Se la proposta è approvata, ambito della licenza, materiali da predisporre e condizioni economiche sono regolati per iscritto ai sensi degli artt. 11.4 e 12; l'Accademia cura l'uniformazione grafica e lo sviluppo commerciale del corso.",
    ],
  },
  {
    titolo: "Art. 5 – Supporto post-corso",
    punti: [
      "5.1. Canali e durata. Il/la Master gestisce le comunicazioni formative con gli allievi dei propri corsi attraverso i Canali ufficiali, senza trasferire sistematicamente il supporto su chat private non autorizzate. Il Supporto post-corso è compreso nel compenso delle giornate di docenza e dura per il periodo comunicato all'allievo, comunque non oltre otto mesi dalla conclusione del corso, salvo diverso accordo scritto.",
      "5.2. Standard. Il/la Master mantiene un ruolo proattivo, attivandosi di propria iniziativa, e fornisce correzioni e riscontri tecnici completi e utili, corredati di esempi, di norma entro un giorno lavorativo dalla richiesta, ovvero entro il primo giorno lavorativo successivo per le richieste pervenute nei fine settimana e nei festivi, compatibilmente con impedimenti giustificati comunicati all'Accademia.",
      "5.3. Continuità formativa. Il/la Master promuove la continuità dell'apprendimento e può suggerire esercitazioni assistite o percorsi Elitederma, senza obbligo di risultato commerciale. Le carenze circostanziate e non occasionali sono gestite ai sensi dell'art. 20.",
    ],
  },
  {
    titolo: "Art. 6 – Qualifica, prodotti e Profili professionali",
    punti: [
      "6.1. Qualifica. Per tutta la durata del rapporto il/la Master indica in modo chiaramente visibile la qualifica di «Master Elitederma» o «Docente Elitederma» nelle biografie dei Profili professionali, sui siti e sugli altri canali pertinenti, e non la omette, rimuove o rende poco visibile senza Autorizzazione. Nelle comunicazioni sulle attività svolte per l'Accademia rende riconoscibile l'appartenenza a Elitederma, senza presentarle come iniziative personali o di terzi.",
      "6.2. Contenuti su Elitederma. La promozione dei corsi e l'uso di grafiche, loghi e locandine dell'Accademia rispettano le linee guida del brand (identità visiva, uso del marchio, grafica, colori, tipografia e tono). I contenuti promozionali realizzati dal/dalla Master sulle attività Elitederma sono sottoposti prima della pubblicazione al reparto competente, che si esprime in tempi ragionevoli; quelli non conformi o non approvati sono modificati o rimossi su richiesta. Non è richiesta approvazione per le comunicazioni personali estranee all'Accademia. Sui canali e nei gruppi il/la Master mantiene toni professionali, evitando denigrazioni e polemiche pubbliche; critiche e disaccordi si portano alla Direzione attraverso i canali interni.",
      "6.3. Uso prevalente in cabina. Il/la Master presenta agli allievi i Prodotti Elitederma come affidabili sulla base della propria esperienza diretta. A tal fine, e perché l'insegnamento si fondi su una conoscenza pratica e continuativa del comportamento di strumenti, pigmenti e colori, per la durata del rapporto li utilizza in modo prevalente e continuativo nella propria attività quotidiana in cabina, per le categorie presenti nel catalogo Elitederma. Resta consentito l'impiego non prevalente di prodotti di altri marchi a fini di prova, confronto e aggiornamento, e il/la Master condivide con l'Accademia, su richiesta, le osservazioni tecniche così maturate. Resta libero l'impiego di prodotti di categorie non presenti a catalogo o imposto da esigenze di sicurezza, da prescrizioni di legge o dalla documentata indisponibilità del prodotto Elitederma.",
      "6.4. Esclusiva nei contenuti. Sui Profili professionali e negli shooting il/la Master mostra e promuove esclusivamente Prodotti Elitederma, senza mostrare, citare o promuovere prodotti di altri marchi delle medesime categorie. I Lavori realizzati con prodotti di altri marchi non sono pubblicati sui Profili professionali. Resta fermo il divieto di confusione o di utilizzo indebito del marchio.",
      "6.5. Identificazione dei Lavori. Nei Lavori pubblicati sui Profili professionali il/la Master rende riconoscibili l'appartenenza all'Accademia e i prodotti utilizzati: a) con il tag o la menzione del profilo ufficiale Elitederma; b) con l'indicazione, nella didascalia o sull'immagine, dei Prodotti Elitederma utilizzati; c) con il logo Elitederma quando la grafica lo consente. Almeno un Lavoro ogni quattro pubblicati riporta entrambe le indicazioni di cui alle lettere a) e b). Il rispetto del presente comma fa presumere l'uso prevalente di cui all'art. 6.3.",
      "6.6. Verifica e omissione sistematica. Il Profilo professionale deve restare, nel suo complesso, riconoscibile come quello di un/una Master Elitederma; la verifica avviene sui contenuti pubblicati. Costituisce omissione sistematica la pubblicazione di quattro Lavori consecutivi, nell'arco di almeno quindici giorni, nessuno dei quali riporti entrambe le indicazioni di cui all'art. 6.5, lettere a) e b). In tal caso Elitederma la contesta per iscritto, documentandola, e può sospendere con effetto immediato l'assegnazione di nuovi incarichi fino alla regolarizzazione; il/la Master integra i contenuti contestati entro dieci giorni dal ricevimento. La mancata regolarizzazione nel termine, oppure una nuova omissione sistematica nei dodici mesi successivi alla contestazione, legittima Elitederma ad avvalersi dell'art. 19.1, lettera n).",
    ],
  },
  {
    titolo: "Art. 7 – Attività esterne",
    punti: [
      "7.1. Corsi non concorrenti. Il/la Master può partecipare liberamente a corsi, master e aggiornamenti di soggetti non concorrenti e documentarlo pubblicamente, senza discuterne o promuoverli in aula o con gli allievi.",
      "7.2. Corsi concorrenti come allievo. Il/la Master può frequentare a titolo personale e in forma riservata corsi di soggetti concorrenti, senza pubblicizzare, condividere o autorizzare contenuti che rendano pubblica la partecipazione. Prima dell'inizio del corso informa per iscritto l'organizzatore della propria opposizione alla pubblicazione, conservando prova della comunicazione; se un contenuto è diffuso da terzi, ne chiede per iscritto la rimozione e informa Elitederma, in entrambi i casi entro 48 ore da quando ne ha avuto conoscenza. La diffusione gli è imputabile solo se autorizzata, volontariamente agevolata o conseguente all'omissione di tali cautele; in mancanza della prova scritta delle due comunicazioni, si presume imputabile, salva prova contraria.",
      "7.3. Eventi, gare e manifestazioni. È consentito partecipare a eventi professionali, gare, congressi e manifestazioni, anche promossi da concorrenti, come invitato, concorrente, giudice o relatore. Il/la Master si identifica in modo visibile quale Master Elitederma in presentazioni, biografie, locandine e contenuti social relativi all'evento, taggando l'Accademia, e precisa, se partecipa a titolo personale, di non rappresentare la Società. Utilizza, espone e pubblicizza esclusivamente Prodotti Elitederma e materiali approvati, comunica prima tali condizioni all'organizzatore e adotta misure ragionevoli per evitare associazioni promozionali a concorrenti; la mera presenza del marchio dell'organizzatore non costituisce promozione. Se le condizioni dell'organizzatore sono incompatibili o l'evento impone prodotti concorrenti, occorre l'Autorizzazione prima di confermare la partecipazione. Restano inderogabili le prescrizioni di sicurezza e di legge. La presente facoltà non copre lezioni o corsi direttamente concorrenti erogati sotto la denominazione di evento.",
      "7.4. Promozione di concorrenti. Senza Autorizzazione sono vietati l'invito all'acquisto o all'iscrizione a corsi concorrenti, la pubblicità dei relativi prodotti e servizi e l'assunzione di ruoli di testimonial, ambassador, promotore o rappresentante commerciale di soggetti concorrenti. Richiede Autorizzazione anche la promozione di iniziative formative di terzi direttamente concorrenti, o in concreto conflitto di interessi con un corso Elitederma programmato, e, nei trenta giorni che precedono un corso Elitederma affidato al/alla Master, la pubblicità di eventi formativi di terzi rivolti al medesimo pubblico, anche se non direttamente concorrenti per contenuti. Fuori da tali casi la semplice coincidenza delle date non costituisce concorrenza, e la mera documentazione del ruolo svolto in un evento ammesso dall'art. 7.3 non è violazione.",
      "7.5. Canali ufficiali. Senza Autorizzazione è vietato utilizzare i Canali ufficiali per invitare, sollecitare, promuovere, raccogliere adesioni o organizzare la partecipazione di allievi, docenti o collaboratori a eventi, corsi o iniziative estranei a quelli della Società, anche se gratuiti, non commerciali o non concorrenti, del/della Master o di terzi. Il divieto comprende la diffusione di link, locandine e moduli di iscrizione, anche per interposta persona. Restano consentite le comunicazioni strettamente necessarie al Supporto post-corso.",
      "7.6. Eventi propri. Il/la Master che intenda organizzare, coorganizzare o promuovere eventi rivolti al settore in cui opera Elitederma ne informa per iscritto la Società prima dell'annuncio pubblico, indicando organizzatore, programma, date, destinatari, sponsor e modalità di promozione. Per le attività lecite e non concorrenti l'informativa non è una richiesta di autorizzazione. Nei materiali dell'evento indica l'effettivo organizzatore e dichiara in modo visibile che l'iniziativa è indipendente e non organizzata, patrocinata o garantita da Elitederma, distinguendo la propria qualifica dal ruolo di organizzatore; non utilizza logo, materiali, Canali ufficiali, database o contatti riservati della Società e non ostacola gli incarichi accettati né la promozione delle iniziative Elitederma. Il/la Master non sollecita gli allievi Elitederma a partecipare all'evento né avvalendosi del proprio ruolo di Master né attraverso i Canali ufficiali: il divieto vale in aula durante i corsi, nelle chat con gli allievi, ufficiali o private, nelle accademie online e nel Supporto post-corso, nonché per i messaggi e i contatti diretti agli allievi conosciuti in ragione degli incarichi e per l'uso dei loro recapiti. Il divieto opera anche se l'evento è gratuito o non concorrente, salvo che la partecipazione degli allievi sia regolata da un accordo commerciale scritto con Elitederma, che ne definisce modalità, comunicazione ed eventuali compensi (art. 7.8). Restano consentite la pubblicità dell'evento rivolta indistintamente al pubblico sui Profili professionali e la libera scelta degli allievi di partecipare di propria iniziativa. In presenza di un concreto rischio di confusione le parti cooperano per le misure correttive; il/la Master rettifica le comunicazioni ingannevoli a lui imputabili e chiede la correzione di quelle di terzi.",
      "7.7. Rappresentanza. Il/la Master non si presenta, non negozia e non assume impegni in nome o per conto di Elitederma, né lascia intendere che proprie iniziative siano organizzate, patrocinate o garantite dalla Società, senza un mandato scritto specifico. La qualifica di cui all'art. 6.1 non conferisce poteri di rappresentanza.",
      "7.8. Procedura di autorizzazione. La richiesta di Autorizzazione indica natura, finalità, organizzatore, destinatari, durata e modalità dell'iniziativa e l'eventuale impiego dei Canali ufficiali o del nome Elitederma. La Società può concederla o negarla e fissarne modalità, limiti, condizioni di comunicazione ed eventuali compensi; l'Autorizzazione opera dopo l'accettazione scritta delle condizioni e ogni modifica sostanziale ne richiede una nuova. Le attività esterne non devono essere incompatibili con gli incarichi accettati né integrare concorrenza sleale o attività vietate dagli artt. 8 e 9.",
      "7.9. Fatti di terzi. Fuori dai casi dell'art. 7.2, la diffusione di contenuti da parte di terzi è imputabile al/alla Master soltanto se autorizzata, consapevolmente agevolata o conseguente all'omissione delle ragionevoli cautele e azioni correttive esigibili.",
    ],
  },
  {
    titolo: "Art. 8 – Esclusiva e non concorrenza durante il rapporto",
    punti: [
      "8.1. Divieto. Durante la collaborazione il/la Master non organizza, eroga, vende o promuove, per sé o per terzi, corsi, masterclass, lezioni individuali o servizi di formazione direttamente concorrenti, né svolge per accademie concorrenti docenza o consulenza finalizzata all'erogazione dei medesimi corsi, salvo Autorizzazione.",
      "8.2. Attività consentite. Restano consentite le prestazioni alla propria clientela (trattamenti estetici, PMU e attività operative non didattiche), le collaborazioni non formative e la formazione in settori non concorrenti, purché senza divulgazione di informazioni riservate, promozione di concorrenti o confusione con il marchio.",
      "8.3. Richieste di corsi individuali. Le richieste di corsi individuali relative all'offerta Elitederma, ricevute dal/dalla Master in ragione del proprio ruolo, sono inoltrate ai referenti Elitederma, che ne gestiscono le condizioni commerciali; il/la Master non le acquisisce privatamente, per sé o per concorrenti.",
      "8.4. Rimedi. La violazione intenzionale degli artt. 8.1 e 8.3 legittima Elitederma ad avvalersi dell'art. 19, oltre a quanto previsto dall'art. 18.",
    ],
  },
  {
    titolo: "Art. 9 – Patto di non concorrenza dopo la cessazione (art. 2596 c.c.)",
    punti: [
      "9.1. Finalità. Il patto tutela il patrimonio riservato, gli investimenti didattici e l'avviamento dell'Accademia nelle discipline in cui il/la Master abbia operato o ricevuto formazione riservata documentabile. Non vieta in via generale l'esercizio della professione. È redatto per iscritto ed è autonomamente accettato dalle parti.",
      "9.2. Attività vietate. Per dodici mesi dalla cessazione effettiva del rapporto, per qualsiasi causa, il/la Master non organizza, eroga, dirige o promuove, personalmente o tramite terzi, corsi o percorsi di formazione direttamente concorrenti nelle specifiche discipline in cui abbia effettivamente tenuto corsi per l'Accademia o ricevuto una formazione interna riservata e documentabile. Il divieto comprende la docenza e la collaborazione formativa sostanziale presso accademie concorrenti, non le collaborazioni estranee alla formazione vietata.",
      "9.3. Territorio. Il patto opera nel territorio della Repubblica Italiana e per la formazione online commercializzata verso destinatari residenti o operanti in Italia. Non è vietata in quanto tale un'attività estera non rivolta al mercato italiano.",
      "9.4. Esclusioni. Restano consentiti: (i) i trattamenti sulla propria clientela e ogni attività professionale non didattica; (ii) la formazione in discipline diverse da quelle dell'art. 9.2; (iii) la frequenza di corsi come allievo; (iv) la partecipazione a manifestazioni come concorrente, giudice o relatore, purché non si risolva nell'erogazione o promozione di corsi concorrenti; (v) l'uso delle competenze generali e delle conoscenze legittimamente acquisite che non siano informazioni riservate ai sensi dell'art. 11.",
      "9.5. Corrispettivo. Per i dodici mesi del patto Elitederma corrisponde un importo mensile lordo complessivo, indipendente da incarichi successivi e dovuto anche a chi abbia svolto solo affiancamento o formazione interna riservata, determinato sul numero di corsi distinti svolti nei dodici mesi precedenti la cessazione (un corso di più giornate vale uno):",
      "• Scaglione A, da 0 a 6 corsi: € 150,00 al mese, per complessivi € 1.800,00;",
      "• Scaglione B, da 7 a 12 corsi: € 200,00 al mese, per complessivi € 2.400,00;",
      "• Scaglione C, oltre 12 corsi: € 250,00 al mese, per complessivi € 3.000,00.",
      "Se il rapporto è durato meno di dodici mesi, il numero dei corsi è rapportato a dodici mesi ai soli fini dello scaglione; per il solo affiancamento si applica lo scaglione A. Le somme sono complessive e includono quanto addebitabile per il trattamento fiscale e previdenziale applicabile, ferme le norme inderogabili.",
      "9.6. Pagamento. Il corrispettivo è pagato in dodici rate mensili, entro il giorno 5 del mese successivo a quello di maturazione, con bonifico e previa ricezione della documentazione fiscale richiesta. Il mutamento del regime fiscale del/della Master non modifica l'importo; le parti cooperano per il corretto adempimento fiscale.",
      "9.7. Violazione. In caso di violazione accertata giudizialmente o riconosciuta per iscritto, Elitederma può chiedere la restituzione dei corrispettivi riferibili al periodo della violazione, oltre alle penali dell'art. 18. La sola contestazione non sospende le rate, in assenza dei presupposti di legge o di accordo scritto.",
    ],
  },
  {
    titolo: "Art. 10 – Patrimonio commerciale, sollecitazione e storno",
    punti: [
      "10.1. Patrimonio dell'Accademia. Archivi degli allievi, database, liste di contatti, gruppi didattici, accademie online, informazioni commerciali e dati sulle iscrizioni costituiscono patrimonio informativo, commerciale e organizzativo della Società, frutto di suoi investimenti. L'accesso è consentito solo per gli incarichi affidati e non attribuisce alcun diritto di sfruttamento autonomo.",
      "10.2. Divieto di appropriazione. Durante il rapporto e dopo la cessazione il/la Master non acquisisce indebitamente, copia, esporta, conserva, riproduce, trasferisce, ricostruisce sistematicamente o utilizza senza autorizzazione tali risorse e le informazioni riservate degli allievi per finalità estranee agli incarichi, direttamente o tramite collaboratori, intermediari, società, associazioni o piattaforme. Il divieto è autonomo dal patto di non concorrenza e dal divieto di sollecitazione: la loro scadenza non attribuisce alcun diritto di sfruttamento, e la tutela permane per tutto il periodo consentito dalle norme su dati personali, riservatezza, segreti commerciali, proprietà intellettuale e concorrenza sleale.",
      "10.3. Sollecitazione degli allievi. Durante il rapporto e per i dodici mesi successivi alla cessazione il/la Master non sollecita attivamente e in modo mirato gli allievi Elitederma conosciuti in ragione degli incarichi per indirizzarli verso corsi, eventi, programmi formativi o iniziative commerciali, propri o di terzi, direttamente concorrenti.",
      "10.4. Storno. Per lo stesso periodo il/la Master non sollecita intenzionalmente docenti, dipendenti o collaboratori Elitederma a interrompere i rapporti in essere per aderire a iniziative formative direttamente concorrenti. Sono escluse le candidature spontanee e i contatti non finalizzati allo storno.",
      "10.5. Elusione. Gli obblighi del presente articolo non possono essere elusi tramite terzi, familiari, collaboratori, società, organizzatori di eventi o altri intermediari che agiscano per conto del/della Master o con la sua consapevole collaborazione.",
      "10.6. Libertà professionale. Restano consentiti i rapporti personali e professionali instaurati in autonomia, le comunicazioni non commerciali e la pubblicità rivolta indistintamente al pubblico, purché senza sfruttamento delle informazioni aziendali o concorrenza sleale. Resta impregiudicata la libertà degli allievi di scegliere i propri percorsi.",
      "10.7. Rimedi. La violazione comprovata comporta, ove ne ricorrano i presupposti, le penali degli artt. 18.2 e 18.3, oltre al diritto di Elitederma alla cessazione della condotta, alla restituzione o cancellazione dei dati e al maggior danno documentato, senza duplicazione per il medesimo fatto.",
    ],
  },
  {
    titolo: "Art. 11 – Riservatezza e proprietà intellettuale",
    punti: [
      "11.1. Informazioni riservate. Il/la Master mantiene riservate e utilizza solo per l'esecuzione del contratto le informazioni aziendali non pubbliche conosciute in ragione della collaborazione, quali database e dati commerciali, listini non pubblici, strategie, protocolli e documenti interni, materiali non divulgati, credenziali, procedure e informazioni tecniche tutelabili.",
      "11.2. Esclusioni. La riservatezza non riguarda le informazioni divenute pubbliche senza violazione, le conoscenze professionali generali, quelle già legittimamente note al/alla Master o da lui sviluppate senza uso di materiale riservato, né quanto debba essere comunicato per legge.",
      "11.3. Materiali dell'Accademia. Dispense, slide, documenti, fotografie, video e altri contenuti consegnati dall'Accademia appartengono al rispettivo titolare dei diritti. Il/la Master riceve la sola autorizzazione d'uso necessaria ai corsi e non li riproduce, distribuisce, condivide o sfrutta al di fuori del contratto. La titolarità e l'uso del marchio sono regolati dall'art. 14.",
      "11.4. Tecniche preesistenti del/della Master. Tecniche, contenuti e materiali di cui il/la Master dimostri la titolarità o disponibilità anteriore alla collaborazione restano suoi, salvo cessione scritta. Se sono inseriti in corsi Elitederma, le parti concordano per iscritto ambito della licenza ed eventuale compenso, ferma la tariffa dell'art. 12.1.",
      "11.5. Contenuti realizzati su incarico. Salvo diverso accordo scritto e ferme le tecniche preesistenti, i diritti di utilizzazione economica su videolezioni, registrazioni, dispense e materiali didattici realizzati dal/dalla Master su incarico di Elitederma per i corsi, le accademie online o i canali dell'Accademia sono ceduti a Elitederma S.r.l., senza limiti di tempo e di territorio, a fronte dei compensi pattuiti per l'incarico. L'Accademia può utilizzarli per finalità didattiche anche dopo la cessazione; resta fermo il diritto del/della Master di essere riconosciuto autore.",
      "11.6. Immagine del/della Master. Il/la Master autorizza Elitederma, ai sensi dell'art. 10 c.c. e degli artt. 96 e 97 della legge n. 633/1941, a utilizzare gratuitamente nome, immagine e voce ripresi nelle attività dell'Accademia per documentare e promuovere corsi e iniziative Elitederma, per la durata del rapporto. Dopo la cessazione l'Accademia non li utilizza in nuove campagne promozionali; può mantenere i contenuti didattici dell'art. 11.5 e quelli già pubblicati di carattere storico o documentale, rimuovendo su richiesta scritta, entro trenta giorni, quelli che presentino il/la Master come collaboratore attuale. Restano fermi i diritti previsti dalla normativa sui dati personali.",
      "11.7. Durata. Gli obblighi di riservatezza permangono per cinque anni dalla cessazione; le informazioni che integrano segreti commerciali restano protette finché conservano tale natura. Resta autonomo il divieto dell'art. 10.2.",
    ],
  },
  {
    titolo: "Art. 12 – Compensi",
    punti: [
      "12.1. Tariffe. Il compenso è pattuito per ciascuna giornata di docenza effettivamente svolta, secondo i seguenti importi fissi onnicomprensivi:",
      "• € 300,00 al giorno per corsi collettivi fino a 3 partecipanti;",
      "• € 350,00 al giorno per corsi collettivi con 4 o 5 partecipanti;",
      "• € 400,00 al giorno per corsi collettivi con oltre 5 partecipanti;",
      "• € 400,00 al giorno per corsi individuali nella formula Elitederma Exclusive;",
      "• € 250,00 al giorno, in deroga alla tariffa di € 400,00, per i corsi individuali Elitederma Exclusive nella formula a prezzo ridotto scelta dal cliente, quando il/la Master si proponga volontariamente e accetti per iscritto di svolgere il singolo incarico a tale tariffa;",
      "• € 500,00 al giorno per corsi che impieghino una tecnica di titolarità del/della Master, identificata e autorizzata per iscritto ai sensi dell'art. 11.4.",
      "12.2. Applicazione. I corsi individuali sono previsti solo nella formula Elitederma Exclusive. Nella formula a prezzo ridotto, che prevede l'assegnazione del corso a un docente non Master, il/la Master può proporsi volontariamente: se l'Accademia accetta, il compenso di quel singolo incarico è di € 250,00 al giorno; proposta e accettazione avvengono per iscritto, anche via email, e non modificano il compenso degli incarichi successivi. Salvo diverso accordo scritto per il singolo incarico, la tariffa di € 500,00 prevale su quella Exclusive. Le tariffe collettive si applicano agli altri corsi, compresi quelli programmati come collettivi ai quali partecipi un solo allievo; lo scaglione è determinato dai partecipanti presenti all'avvio della prima giornata, risultanti dai registri Elitederma, e le assenze successive non lo modificano.",
      "12.3. Importi onnicomprensivi. Gli importi sono il massimo esborso complessivo di Elitederma per la giornata, qualunque sia il regime fiscale del/della Master, e comprendono IVA ove applicabile, rivalse previdenziali, contributi integrativi e imposta di bollo riaddebitata. Il/la Master emette fattura con corretta esposizione delle voci, senza maggiorare il totale. Le ritenute di legge sono operate da Elitederma e versate all'Erario, senza costituire somme aggiuntive.",
      "12.4. Pagamento. Il compenso è pagato con bonifico entro trenta giorni dall'ultima tra la conclusione del corso e la ricezione di regolare fattura. Ne sono esclusi soltanto i rimborsi dell'art. 13.",
      "12.5. Attività comprese. Il compenso giornaliero comprende la preparazione del corso, la partecipazione all'allestimento (anche nel giorno precedente, quando possibile), il report di fine corso e il Supporto post-corso: per tali attività non è dovuto alcun compenso aggiuntivo. Le eventuali spese di trasferta restano regolate dall'art. 13.",
      "12.6. Altre prestazioni. Giornate aggiuntive, mezze giornate, dimostrazioni autonome e incarichi diversi dalla normale docenza sono concordati prima per iscritto quanto a durata e compenso; in mancanza non si presumono remunerabili.",
    ],
  },
  {
    titolo: "Art. 13 – Spese di trasferta",
    punti: [
      "13.1. Le spese di trasferta necessarie per incarichi concordati fuori dalla città di residenza o domicilio professionale del/della Master sono sostenute dall'Accademia o rimborsate se preventivamente autorizzate e documentate. Di norma Elitederma prenota viaggi e alloggio; località, struttura e massimale dell'alloggio, che rispetta adeguati standard di igiene, sicurezza e comfort, sono confermati per iscritto prima della prenotazione.",
      "13.2. I pasti nelle giornate di corso e di trasferta sono rimborsati fino a € 30,00 al giorno, salvo autorizzazione scritta a un importo superiore. I viaggi in treno sono in seconda classe, salva la scelta di una classe superiore a spese del/della Master.",
      "13.3. L'uso dell'auto privata è consentito, con modalità e rimborsi concordati prima, quando necessario o più conveniente; pedaggi e parcheggi sono rimborsati su documentazione. Taxi e NCC sono rimborsati solo se giustificati e autorizzati. Viaggi aerei, bagagli aggiuntivi e spese straordinarie richiedono autorizzazione preventiva. Restano a carico del/della Master le sanzioni stradali e le spese personali non pertinenti all'incarico.",
    ],
  },
  {
    titolo: "Art. 14 – Marchio",
    punti: [
      "14.1. Titolarità e uso della Società. Il marchio «Elitederma» è di esclusiva titolarità di Gian Luca Rocca. Elitederma S.r.l. lo utilizza con il consenso del titolare, nei limiti del titolo da questi riconosciuto, e assicura che tale titolo consenta l'impiego operativo del marchio da parte dei docenti per le attività svolte per suo conto. Il contratto non costituisce né sostituisce l'accordo tra il titolare e la Società e non attribuisce a quest'ultima la proprietà del marchio; la dicitura «Elitederma Academy» non implica una distinta registrazione.",
      "14.2. Autorizzazione al/alla Master. Per la durata della collaborazione Elitederma consente al/alla Master l'uso strettamente funzionale del marchio nei corsi e nei materiali approvati, per indicare la qualifica di cui all'art. 6.1 e, come previsto dall'art. 6.5, per logo, tag e menzione sui Lavori realizzati con Prodotti Elitederma. La facoltà è personale, non trasferibile e non costituisce cessione o licenza autonoma. Sono vietati registrazione, appropriazione, alterazione e abbinamento ingannevole del marchio a corsi, servizi o prodotti estranei all'Accademia.",
      "14.3. Cessazione. Alla cessazione termina ogni facoltà di impiego promozionale del marchio e di presentarsi come Master Elitederma in attività future, salvi gli usi tecnicamente necessari al Supporto residuo e la descrizione veritiera dell'esperienza pregressa, senza confusione sull'esistenza di un rapporto attuale. Il divieto dell'art. 7.7 permane dopo la cessazione.",
      "14.4. Tutela del titolare. Le obbligazioni del/della Master verso la Società non pregiudicano i diritti e le azioni spettanti per legge a Gian Luca Rocca quale titolare. La Società tutela i propri interessi contrattuali e commerciali nei limiti del proprio titolo d'uso.",
    ],
  },
  {
    titolo: "Art. 15 – Durata, rinnovo e recesso",
    punti: [
      "15.1. Durata. Il contratto decorre dalla data della sua sottoscrizione da parte di entrambe le parti e dura dodici mesi da tale data. Si rinnova per ulteriori periodi di dodici mesi alle stesse condizioni, salvo disdetta scritta comunicata con PEC o raccomandata A/R almeno trenta giorni prima della scadenza.",
      "15.2. Recesso. Ciascuna parte può recedere in qualsiasi momento con PEC o raccomandata A/R e preavviso di almeno trenta giorni; la durata annuale ha funzione di programmazione e non limita tale facoltà. Durante il preavviso le parti gestiscono in buona fede gli incarichi già confermati. Il mancato preavviso dà luogo al risarcimento del solo danno effettivo e documentato.",
      "15.3. Sopravvivenza. La cessazione lascia fermi gli obblighi destinati a sopravvivere, in particolare quelli degli artt. 4.4, 7.7, 9, 10, 11, 14, 17, 18, 21 e 22, secondo la durata e l'oggetto di ciascuno.",
    ],
  },
  {
    titolo: "Art. 16 – Programmazione, rinvio e annullamento dei corsi",
    punti: [
      "16.1. Facoltà dell'Accademia. L'Accademia può confermare un corso anche con meno di quattro iscritti, applicando le tariffe dell'art. 12; se la soglia non è raggiunta ha facoltà, non obbligo, di annullare o riprogrammare la data. Ove possibile l'annullamento o il rinvio è comunicato con almeno trenta giorni di preavviso; se le condizioni emergono dopo, la comunicazione avviene senza ritardo e le parti cooperano per ridurre il disagio e definire le date sostitutive.",
      "16.2. Effetti. Per le giornate non svolte non matura il compenso; restano rimborsabili le spese di trasferta non recuperabili, se autorizzate, documentate e sostenute prima della comunicazione. Ulteriori indennizzi per cancellazioni ravvicinate sono concordati alla conferma dell'incarico. Restano ferme le conseguenze di legge per inadempimento imputabile o forza maggiore.",
      "16.3. Indisponibilità del/della Master. Il/la Master che, dopo l'accettazione, non possa eseguire un incarico ne informa per iscritto l'Accademia senza ritardo e, salvo impedimento grave e documentato (malattia, infortunio, forza maggiore), con almeno trenta giorni di preavviso rispetto alla prima giornata. Le parti cooperano per una data sostitutiva o un sostituto ai sensi dell'art. 2.4. In caso di rinuncia ingiustificata o senza il preavviso dovuto, il/la Master risponde dei soli danni effettivi e documentati, quali spese non recuperabili, costi di sostituzione e rimborsi dovuti agli allievi.",
    ],
  },
  {
    titolo: "Art. 17 – Cessazione e Supporto residuo",
    punti: [
      "17.1. Obblighi alla cessazione. Alla cessazione il/la Master: a) restituisce materiali, dispositivi e documenti dell'Accademia; b) restituisce o cancella, secondo le istruzioni lecite ricevute e salvi gli obblighi di conservazione di legge, archivi, copie, esportazioni e dati degli allievi non necessari al Supporto residuo, attestandolo per iscritto su richiesta; c) cessa l'uso del marchio e della qualifica per nuove attività promozionali, potendo descrivere in modo veritiero l'esperienza pregressa come «già Master Elitederma»; d) aggiorna entro cinque giorni lavorativi biografie e profili che possano rappresentare il rapporto come ancora in corso.",
      "17.2. Supporto residuo. La cessazione, per qualsiasi causa, non estingue gli obblighi di assistenza, tutoraggio e supporto didattico verso gli allievi dei corsi tenuti dal/dalla Master. Il supporto prosegue sui Canali ufficiali fino alla scadenza prevista per ciascun corso e comunque non oltre otto mesi dalla sua conclusione, con gli stessi standard di diligenza, qualità, puntualità e tempi di risposta dell'art. 5 e senza ulteriori compensi, salvo impossibilità sopravvenuta non imputabile o diverso accordo scritto.",
      "17.3. Divieti durante il Supporto residuo. Per la sua durata il/la Master non assume incarichi concretamente incompatibili con l'assistenza dovuta e, nell'ambito di questa, non: a) utilizza prodotti o materiali didattici non approvati, salve le esigenze dell'art. 3.4, né promuove prodotti e servizi concorrenti; b) usa i gruppi didattici o i rapporti con gli allievi per promuovere attività formative proprie o di terzi; c) indirizza commercialmente gli allievi verso accademie, corsi, aziende, marchi o fornitori concorrenti; d) usa informazioni, contatti, materiali o risorse Elitederma per finalità estranee al supporto. Si applicano gli artt. 7.5, 7.7 e 7.8.",
      "17.4. Profili professionali. Fino alla scadenza del Supporto residuo, o alla data del subentro di cui all'art. 17.6, il/la Master non menziona, mostra o associa pubblicamente sui Profili professionali marchi, prodotti o corsi concorrenti con quelli di Elitederma e non partecipa ad attività promozionali che possano generare confusione con il brand. Resta libero l'impiego di tali prodotti in cabina; il presente articolo non introduce un divieto generale di esercizio della professione.",
      "17.5. Comunicazione della cessazione. Entro cinque giorni lavorativi dalla cessazione effettiva il/la Master comunica sui Profili professionali, in modo chiaro, veritiero e professionale e senza obbligo di indicarne le ragioni, che la collaborazione è cessata, precisando se il Supporto residuo prosegue per gli allievi già affidati. Il testo è concordato con Elitederma, che risponde entro due giorni lavorativi dalla proposta; in mancanza, il/la Master può pubblicare una comunicazione neutra.",
      "17.6. Referente sostitutivo. Elitederma individua in via esclusiva il referente che subentra, in tutto o in parte, anche d'urgenza. Il/la Master collabora al passaggio delle informazioni necessarie, nei limiti della normativa sui dati personali, e comunica sui Profili professionali e agli allievi interessati il nominativo del referente e le modalità di accesso al supporto, entro cinque giorni lavorativi dalla comunicazione scritta della designazione. Il subentro libera il/la Master dagli obblighi di assistenza soltanto per gli allievi e dalla data indicati per iscritto da Elitederma, ferma la responsabilità per gli inadempimenti precedenti.",
    ],
  },
  {
    titolo: "Art. 18 – Clausole penali",
    punti: [
      "18.1. Concorrenza. Per ciascuna distinta iniziativa formativa direttamente concorrente organizzata, erogata o promossa in violazione comprovata degli artt. 8 o 9 è dovuta una penale di € 25.000,00. La stessa iniziativa non è conteggiata più volte in base al numero di lezioni, pubblicazioni, messaggi o partecipanti. Sono escluse le partecipazioni consentite dall'art. 7.3 e le attività consentite dagli artt. 8.2 e",
      "9.4.",
      "18.2. Sollecitazione e storno. Per ciascuna persona oggetto di un'effettiva e comprovata condotta vietata dagli artt. 10.3 o 10.4 è dovuta una penale di € 2.500,00. Contatti ripetuti verso la stessa persona nell'ambito di un'unica iniziativa non generano penali multiple.",
      "18.3. Riservatezza e archivi. Per ciascuna distinta e grave violazione comprovata dell'art. 11, consistente nella divulgazione a concorrenti o nell'uso commerciale non autorizzato di materiali protetti o di segreti commerciali, oppure dell'art. 10.2, consistente nell'appropriazione indebita o nel grave sfruttamento commerciale degli archivi aziendali, è dovuta una penale di € 20.000,00. Non è sanzionato l'uso di capacità professionali generali o di tecniche proprie del/della Master.",
      "18.4. Supporto residuo e comunicazioni. Per gli inadempimenti imputabili e comprovati dell'art. 17 sono dovute le seguenti penali:",
      "• € 5.000,00 per abbandono ingiustificato, grave riduzione o interruzione definitiva dell'assistenza (art. 17.2);",
      "• € 5.000,00 per violazione grave degli artt. 17.3 o 17.4;",
      "• € 2.500,00 per omissione della comunicazione di cessazione (art. 17.5);",
      "• € 2.500,00 per omissione della comunicazione del referente sostitutivo o grave mancato passaggio di consegne (art. 17.6).",
      "L'Accademia contesta per iscritto i fatti specifici e concede cinque giorni lavorativi dal ricevimento per osservazioni e, se la violazione è sanabile, per rimediare, salvo un termine maggiore ragionevolmente necessario; per le violazioni non sanabili resta il diritto alle osservazioni.",
      "18.5. Reputazione commerciale. Durante il rapporto e dopo la cessazione è dovuta una penale di € 8.000,00 esclusivamente per la diffusione dolosa e comprovata a terzi di affermazioni fattuali consapevolmente false e gravemente lesive della reputazione commerciale di Elitederma, ferma la libertà di critica veritiera e lecita.",
      "18.6. Regole comuni. Le penali sono pattuite ai sensi degli artt. 1382 e seguenti c.c., fermo il potere di riduzione dell'art. 1384 c.c. Resta salvo il maggior danno effettivamente provato, compresi i costi di sostituzione, riorganizzazione didattica, gestione dei reclami, rimborsi agli allievi e i danni commerciali o reputazionali riconducibili all'inadempimento. Le penali si cumulano solo per inadempimenti autonomi e distinti: il medesimo fatto non genera duplicazioni. Il pagamento non autorizza a proseguire la condotta vietata e restano esercitabili le azioni cautelari e inibitorie. Nessuna penale è dovuta per il solo esercizio del recesso.",
    ],
  },
  {
    titolo: "Art. 19 – Clausola risolutiva espressa",
    punti: [
      "19.1. Casi. Ai sensi dell'art. 1456 c.c. Elitederma può dichiarare risolto il contratto nei seguenti casi:",
      "• a) organizzazione, erogazione o promozione intenzionale e non autorizzata di attività didattiche direttamente concorrenti (art. 8.1);",
      "• b) acquisizione privata e intenzionale di richieste formative ricevute in ragione dell'incarico (art. 8.3);",
      "• c) assunzione non autorizzata di incarichi promozionali o pubblicitari a favore di concorrenti (art. 7.4);",
      "• d) divulgazione intenzionale a terzi o uso commerciale non autorizzato di informazioni riservate e materiali protetti (art. 11);",
      "• e) uso abusivo del marchio Elitederma per promuovere corsi o prodotti concorrenti (art. 14);",
      "• f) promozione commerciale intenzionale di prodotti, marchi o corsi concorrenti nell'ambito di un corso Elitederma (artt. 3.4 e 3.6);",
      "• g) uso intenzionale dei Canali ufficiali o del ruolo di Master per sollecitare gli allievi a eventi o iniziative esterne senza accordo con Elitederma (artt. 7.5 e 7.6), quando la condotta sia grave per diffusione, finalità commerciale o reiterazione;",
      "• h) assunzione intenzionale e non autorizzata di impegni o falsa rappresentazione di un mandato della Società (art. 7.7);",
      "• i) appropriazione, esportazione o sfruttamento non autorizzato di archivi, database e contatti degli allievi (art. 10.2);",
      "• l) sollecitazione intenzionale di allievi verso iniziative direttamente concorrenti o storno di docenti e collaboratori (artt. 10.3 e 10.4);",
      "• m) violazione grave e intenzionale degli obblighi in materia di dati personali (art. 21.3);",
      "• n) omissione sistematica dell'identificazione dei Lavori, quanto all'appartenenza all'Accademia o ai prodotti utilizzati, non regolarizzata nel termine o reiterata nei dodici mesi (art. 6.6).",
      "19.2. Modalità. La risoluzione si verifica quando Elitederma comunica al/alla Master, con PEC o raccomandata A/R, di volersi avvalere della clausola, indicando i fatti contestati e l'obbligazione violata. Restano salvi i compensi per le prestazioni già eseguite e gli altri rimedi. Le violazioni dell'art. 9 successive alla cessazione sono regolate dagli artt. 9.7 e 18.",
    ],
  },
  {
    titolo: "Art. 20 – Contestazioni di inadempimento",
    punti: [
      "20.1. Contestazione. Per le inadempienze non comprese nell'art. 19, quali le violazioni degli artt. 3, 5, 6 e 7 che non integrino i casi ivi previsti, Elitederma può inviare via email o PEC una contestazione scritta di inadempimento, con descrizione specifica dei fatti, data e obbligo interessato. Restano salvi i danni provati e le penali, ove ne ricorrano i presupposti.",
      "20.2. Osservazioni e rimedio. Il/la Master può presentare osservazioni entro cinque giorni lavorativi dal ricevimento; se la violazione è rimediabile, la Direzione indica un termine ragionevole per correggerla. Non si computano le contestazioni generiche, duplicate per il medesimo episodio o ritirate.",
      "20.3. Reiterazione. Se in dodici mesi sono notificate tre contestazioni valide per episodi distinti e oggettivamente documentati, Elitederma può recedere ai sensi dell'art. 15.2 o, ricorrendone i presupposti, esercitare gli ordinari rimedi per inadempimento. La terza contestazione non produce da sola la cessazione. I corsi non ancora svolti possono essere riassegnati, nel rispetto delle prestazioni già maturate.",
      "20.4. Dopo la cessazione. Gli inadempimenti relativi al Supporto residuo sono regolati dagli artt. 17 e",
      "18.4.",
    ],
  },
  {
    titolo: "Art. 21 – Dati personali",
    punti: [
      "21.1. Le parti rispettano il Regolamento (UE) 2016/679, il D.Lgs. 196/2003 e la normativa applicabile. I dati di allievi, modelle e clienti sono trattati solo per finalità connesse agli incarichi e secondo le istruzioni legittime dell'Accademia.",
      "21.2. Elitederma verifica e formalizza il ruolo privacy del/della Master, quale persona autorizzata al trattamento oppure responsabile ai sensi dell'art. 28 GDPR quando necessario. La presente clausola non sostituisce le designazioni e le informative di legge.",
      "21.3. Il/la Master non esporta dati dagli strumenti Elitederma per finalità proprie, non li conserva su dispositivi personali senza autorizzazione, non li comunica a concorrenti e non pubblica fotografie o video di allievi, modelle o trattamenti senza le basi giuridiche e le autorizzazioni necessarie. Segnala tempestivamente all'Accademia ogni incidente di sicurezza.",
      "21.4. Alla cessazione i dati sono restituiti, cancellati o conservati nei soli limiti di legge, secondo l'art.",
      "17.1. Durante il Supporto residuo Elitederma mantiene i soli accessi necessari e li revoca al suo termine o al subentro. I dati aziendali non possono essere riutilizzati per finalità commerciali autonome per il solo decorso dei termini di non concorrenza o di non sollecitazione.",
    ],
  },
  {
    titolo: "Art. 22 – Legge applicabile e foro",
    punti: [
      "22.1. Il contratto è regolato dalla legge italiana.",
      "22.2. Per le controversie relative a validità, interpretazione, esecuzione e cessazione del contratto è competente in via esclusiva il Foro di Roma, salve le competenze inderogabili di legge, comprese quelle applicabili in caso di diversa qualificazione del rapporto.",
    ],
  },
  {
    titolo: "Art. 23 – Disposizioni finali",
    punti: [
      "23.1. Per quanto non previsto si applicano il Codice civile e le disposizioni inderogabili pertinenti alla concreta natura del rapporto.",
      "23.2. Manifesto e linee guida. Il Manifesto allegato sub A esprime valori e stile dell'Accademia e orienta l'interpretazione degli standard di condotta; non istituisce obblighi, divieti o sanzioni, e in caso di contrasto prevale il contratto. Le linee guida operative e di brand comunicate per iscritto dall'Accademia (checklist di allestimento, linee grafiche, procedure) integrano gli standard tecnici e organizzativi del contratto, ma non possono istituire penali, divieti di concorrenza od obblighi economici, né modificare compensi, durata o cause di cessazione.",
      "23.3. Modifiche e integrazioni sono valide solo se concordate per iscritto. Le comunicazioni di servizio possono avvenire via email ai recapiti indicati in epigrafe; recesso, disdetta e dichiarazione di risoluzione seguono le forme previste nei rispettivi articoli.",
      "23.4. La nullità o inefficacia di una clausola non si estende alle altre, quando il contratto possa conservare utilmente effetto. Le parti sostituiscono in buona fede la previsione inefficace con una clausola lecita che persegua per quanto possibile la stessa finalità.",
      "23.5. Il/la Master dichiara di avere ricevuto, prima della firma, copia del contratto e dell'Allegato A, potendo chiederne chiarimenti.",
    ],
  },
];

// L'APPROVAZIONE SPECIFICA DELLE CLAUSOLE (artt. 1341 e 1342 c.c.).
//
// E' una SECONDA sottoscrizione, non una ripetizione della prima: sul
// cartaceo ha una firma sua, in fondo all'elenco. Qui ha la sua casella
// e la sua ora, e l'elenco si stampa per intero — senza le sedici voci,
// «approvo specificamente le seguenti clausole:» e' un'approvazione
// specifica di nulla.
export const CLAUSOLE = {
  titolo: "APPROVAZIONE SPECIFICA DELLE CLAUSOLE (artt. 1341 e 1342 c.c.)",
  punti: [
    "Il/la Master, per quanto occorra ai sensi degli artt. 1341 e 1342 c.c. e previa lettura delle disposizioni interessate, approva specificamente le seguenti clausole:",
    "• Art. 3.6, divieto di proporre o consigliare agli allievi prodotti, marchi e corsi concorrenti;",
    "• Art. 4.4, restituzione dei costi di formazione in caso di cessazione entro sei mesi;",
    "• Art. 6, qualifica, uso prevalente dei Prodotti Elitederma, esclusiva nei contenuti professionali, identificazione dei Lavori e omissione sistematica;",
    "• Art. 7, attività esterne, partecipazione riservata a corsi concorrenti, eventi, divieto di promozione di concorrenti, uso dei Canali ufficiali e divieto di sollecitare gli allievi a eventi propri, eventi propri, rappresentanza e autorizzazioni;",
    "• Art. 8, esclusiva e non concorrenza durante il rapporto;",
    "• Art. 9, patto di non concorrenza dopo la cessazione e conseguenze della violazione;",
    "• Art. 10, patrimonio commerciale, divieto di appropriazione, sollecitazione e storno;",
    "• Art. 11, riservatezza, cessione dei contenuti realizzati su incarico e uso dell'immagine;",
    "• Art. 12.5, attività comprese nel compenso senza corrispettivo aggiuntivo;",
    "• Art. 15, rinnovo automatico, recesso e preavviso;",
    "• Art. 16, annullamento e rinvio dei corsi e indisponibilità del/della Master;",
    "• Art. 17, obblighi alla cessazione, Supporto residuo, divieti sui Profili professionali, comunicazione della cessazione e referente sostitutivo;",
    "• Art. 18, clausole penali;",
    "• Art. 19, clausola risolutiva espressa;",
    "• Art. 20, contestazioni di inadempimento e recesso;",
    "• Art. 22.2, foro competente esclusivo.",
  ],
};

// L'ALLEGATO A. Il Manifesto non contiene obblighi (art. 23.2) e lo dice
// da se': si firma PER RICEVUTA, che e' la terza firma del cartaceo.
export const MANIFESTO = {
  titolo: "ALLEGATO A – MANIFESTO ELITEDERMA",
  versione: "(Versione 13 – 14 novembre 2026 – Allegato A al contratto di collaborazione)",
  blocchi: [
    {
      titolo: "Premessa",
      punti: [
        "Questo Manifesto racconta chi è Elitederma: i valori, la missione, la visione e lo stile che uniscono docenti, Master, assistenti e collaboratori. È il riferimento culturale dell'Accademia, ciò in cui crediamo e il modo in cui vogliamo essere riconosciuti.",
        "Il Manifesto non contiene regole, divieti o sanzioni. Gli impegni di ciascuno sono scritti nel rispettivo contratto di collaborazione, che prevale in ogni caso; il Manifesto ne spiega lo spirito.",
        "Dove compaiono, i termini «Master» e «Docente» indicano professionisti e professioniste; le forme al solo maschile sono usate per semplicità di lettura e valgono per entrambi i generi.",
      ],
    },
    {
      titolo: "Cos'è Elitederma",
      punti: [
        "Elitederma è una realtà italiana di riferimento nel settore della dermopigmentazione e dell'estetica professionale avanzata, nata dall'unione tra ricerca, formazione e sviluppo di prodotti innovativi. Fondata nel 2018 da Gian Luca Rocca e Chiara Colonnelli, Elitederma si distingue per la qualità dei propri protocolli didattici e tecnici, per l'attenzione ai dettagli e per la costante ricerca di soluzioni evolute nel campo della formazione e della pratica professionale.",
        "Attraverso i suoi percorsi formativi, i prodotti proprietari e le attività di aggiornamento continuo, Elitederma forma professionisti completi, capaci di unire competenza tecnica, sensibilità estetica e consapevolezza etica. Ogni progetto e ogni collaborazione riflettono una filosofia chiara: qualità, precisione, eleganza e rispetto della persona.",
        "Elitederma integra in un unico ecosistema sinergico la formazione professionale, la produzione di prodotti, dispositivi e accessori dedicati alla dermopigmentazione e all'estetica avanzata, e la ricerca e sviluppo di metodologie proprietarie volte a garantire standard elevati e risultati concreti. Questa sinergia tra didattica, innovazione e produzione rappresenta il cuore dell'identità aziendale e la chiave del suo successo.",
        "In ogni ambito, Elitederma promuove eccellenza, sicurezza e visione moderna della bellezza professionale, fondata su risultati misurabili, ricerca continua e crescita consapevole.",
      ],
    },
    {
      titolo: "La Filosofia Aziendale",
      punti: [
        "La nostra filosofia è chiara e si fonda su cinque principi fondamentali che guidano ogni nostra azione, dentro e fuori l'aula. Sono i valori che definiscono il modo in cui formiamo, comunichiamo e costruiamo ogni giorno il mondo Elitederma.",
      ],
    },
    {
      titolo: "Rispetto",
      punti: [
        "Il rispetto è alla base di ogni relazione. Rispetto reciproco tra allievi, docenti, colleghi e clienti; rispetto dei ruoli, delle regole, degli impegni, dei protocolli e della filosofia aziendale che ci unisce. Solo attraverso il rispetto si costruisce fiducia, autorevolezza e armonia nel lavoro di squadra.",
      ],
    },
    {
      titolo: "Disponibilità",
      punti: [
        "Essere disponibili significa partecipare con spirito di collaborazione e apertura verso l'azienda, i colleghi e gli allievi. La disponibilità è la chiave della crescita comune — umana, professionale e accademica — perché ogni gesto di supporto crea un legame di valore e appartenenza.",
      ],
    },
    {
      titolo: "Professionalità",
      punti: [
        "La professionalità è l'essenza del nostro modo di operare. Mantenere gli impegni, curare ogni dettaglio del proprio lavoro e mantenere un atteggiamento serio, cortese e rispettoso verso clienti e allievi è ciò che distingue un professionista Elitederma. L'eccellenza si riconosce nei comportamenti, prima ancora che nei risultati.",
      ],
    },
    {
      titolo: "Umiltà",
      punti: [
        "L'umiltà è consapevolezza: sapere che possiamo e dobbiamo continuare a migliorare. È la base della crescita personale e collettiva, del reciproco sostegno e dell'apprendimento continuo. Solo chi mantiene lo spirito dell'allievo, anche da docente, può evolversi e ispirare gli altri.",
      ],
    },
    {
      titolo: "Sinergia",
      punti: [
        "La sinergia è la nostra forza. Diamo valore alle opinioni, alle idee e ai contributi di tutti i collaboratori, perché il successo di Elitederma nasce dalla collaborazione, dal confronto e dalla condivisione. Quando le individualità si uniscono verso un obiettivo comune, l'Accademia diventa una vera comunità di crescita e innovazione.",
      ],
    },
    {
      titolo: "La Mission",
      punti: [
        "Elitederma opera come punto di riferimento nazionale nella formazione professionale e nell'innovazione nel campo della dermopigmentazione e dell'estetica avanzata, con l'obiettivo di generare valore, creare opportunità di lavoro e promuovere benessere sociale.",
        "La nostra missione è formare professionisti completi e consapevoli, capaci di unire tecnica, conoscenza e sensibilità estetica per interpretare la bellezza con competenza e responsabilità. Attraverso un modello formativo unico, fondato su protocolli certificati, metodologie scientifiche e strumenti proprietari, accompagniamo ogni allievo in un percorso di crescita verso l'eccellenza e l'autonomia professionale. Elitederma integra in un unico ecosistema la dermopigmentazione, il microneedling, la laminazione ciglia e sopracciglia, la cura della pelle e lo sviluppo di prodotti, pigmenti e tecnologie estetiche che garantiscono sicurezza, performance e risultati di alto livello.",
        "Ogni corso, ogni prodotto e ogni interazione con il brand riflettono la nostra filosofia dell'accoglienza e della competenza condivisa, fondata su empatia, disponibilità e dedizione. Coniughiamo formazione, innovazione e ricerca per ispirare una nuova generazione di professionisti della bellezza etici, preparati e fieri di appartenere al mondo Elitederma.",
      ],
    },
    {
      titolo: "La Vision",
      punti: [
        "La nostra visione è essere riconosciuti come il punto di riferimento in Italia e in Europa nel settore della dermopigmentazione e dell'estetica professionale, un luogo dove formazione, innovazione e prodotto convivono in un unico ecosistema di eccellenza.",
        "Vogliamo costruire un modello di accademia integrata e pionieristica, capace di anticipare le tendenze, elevare gli standard qualitativi del settore e promuovere una vera cultura della bellezza consapevole, fondata su ricerca, sviluppo e competenza reale. Il marchio Elitederma deve rappresentare ovunque un sigillo di garanzia e di fiducia, sinonimo di formazione certificata, docenti di alto profilo, prodotti d'eccellenza e metodologie sicure.",
        "Il nostro obiettivo è creare una comunità internazionale di professionisti e accademie affiliate che condividano la stessa filosofia di precisione, eleganza e responsabilità etica, contribuendo insieme all'evoluzione del settore. Crediamo in un futuro in cui la bellezza non sia solo apparenza, ma competenza, ricerca e benessere autentico. E in questo futuro, Elitederma vuole essere la guida, il modello e l'ispirazione, un punto d'incontro tra scienza, arte e sensibilità estetica che definisce i nuovi confini della professionalità.",
      ],
    },
    {
      titolo: "Creare l'Elitederma Experience",
      punti: [
        "Far vivere una Elitederma Experience agli allievi significa entrare in contatto con la loro parte più autentica, sensibile e aspirazionale. Non si tratta solo di insegnare una tecnica, ma di comprendere le motivazioni più profonde che li hanno portati a scegliere questo percorso e di accompagnarli nella scoperta di sé e del proprio potenziale professionale.",
        "Ogni allievo che entra in aula porta con sé una storia, un sogno, un obiettivo personale. Il compito del/della docente Elitederma è ascoltare, interpretare e valorizzare quelle emozioni, trasformando la formazione in un'esperienza che unisce crescita tecnica, evoluzione personale e fiducia in sé stessi. Creare la vera Elitederma Experience significa saper leggere i bisogni non espressi, riconoscere la sensibilità di chi si affida a noi e infondere sicurezza e ispirazione, costruendo un dialogo umano e professionale autentico. In questo modo nasce un flusso virtuoso tra chi insegna e chi apprende: un legame di stima, energia e motivazione reciproca che continua anche dopo la fine del corso, diventando parte del percorso di vita e di carriera di ogni allievo.",
        "L'esperienza Elitederma non è un semplice momento formativo, ma un viaggio di trasformazione, in cui competenza e sensibilità si fondono per creare professionisti consapevoli e persone migliori. È questo equilibrio tra tecnica, empatia e visione che rende Elitederma non solo un'accademia, ma un luogo in cui il talento trova la sua forma più autentica.",
      ],
    },
    {
      titolo: "Essere Master Elitederma",
      punti: [
        "Chi insegna in Elitederma è ambasciatore e ambasciatrice dell'immagine dell'Accademia: in aula, sui social e in ogni contesto professionale porta con sé la qualità, l'eleganza e la coerenza del marchio. L'intento non è attribuire un titolo, ma riconoscere e far crescere competenze tecniche, comunicative e didattiche che incarnano gli standard Elitederma.",
        "Crediamo che un/una Master possa presentare agli allievi i prodotti Elitederma come affidabili solo se li conosce per esperienza diretta e quotidiana: è questa esperienza, maturata nel tempo, a rendere autentico l'insegnamento e credibile ogni consiglio.",
        "Far parte di Elitederma significa aderire a una realtà strutturata, dinamica e in costante evoluzione, che investe risorse economiche, organizzative e comunicative per garantire la propria credibilità. Per questo chiediamo partecipazione attiva, lealtà e spirito di collaborazione, nella consapevolezza che la crescita individuale e quella collettiva sono inscindibili.",
        "Elitederma riconosce e valorizza solo collaborazioni autentiche, basate sulla condivisione reale dei propri valori, sul rispetto reciproco e sulla volontà concreta di contribuire alla crescita comune, nel segno dell'eccellenza e della professionalità che contraddistinguono il brand.",
      ],
    },
    {
      titolo: "Lo Stile Elitederma",
      punti: [
,
      ],
    },
    {
      titolo: "Immagine e abbigliamento",
      punti: [
        "In ogni occasione professionale, l'abbigliamento del team deve trasmettere cura, eleganza e rispetto per il ruolo ricoperto. Lo stile richiesto è elegante o casual-elegante, sempre in linea con l'immagine raffinata e professionale di Elitederma Academy. È sconsigliato l'uso di jeans, abiti succinti o capi non consoni al contesto formativo. Ogni membro del team è chiamato a rappresentare l'Accademia con buon gusto, sobrietà e, ove possibile, un tocco di eleganza.",
        "Il team, in presenza di allievi o clienti, porta a tutti gli effetti l'immagine dell'Accademia: la sua immagine diventa l'immagine di tutti. Per questo motivo, l'attenzione al proprio aspetto non è solo una scelta personale, ma un segno di rispetto verso l'ambiente accademico e verso gli studenti che guardano a Elitederma come modello di riferimento.",
        "Un abbigliamento curato: valorizza la persona e il suo ruolo professionale; tutela e rafforza l'immagine dell'Accademia; genera rispetto e fiducia negli studenti e nei clienti; ispira e alimenta il sogno di chi intraprende il percorso formativo.",
      ],
    },
    {
      titolo: "Accoglienza",
      punti: [
        "In ogni sede e in ogni contesto in cui Elitederma opera, l'accoglienza deve essere gioviale, cordiale e autentica. Ogni interazione deve trasmettere benevolenza, energia positiva e disponibilità, con l'obiettivo di mettere sempre a proprio agio allievi, ospiti e clienti, riservando loro attenzioni sincere e personalizzate.",
        "Il sorriso è parte integrante della comunicazione Elitederma: rappresenta un segno di benevolenza, apertura e rispetto, capace di creare un clima sereno e di favorire una relazione di fiducia reciproca. Per questo motivo, l'accoglienza riveste per Elitederma un'importanza vitale: è il primo punto di contatto, il momento in cui si costruisce la percezione del brand e la qualità dell'esperienza che seguirà. È in quell'istante che l'allievo, l'ospite o il cliente formano la prima impressione del percorso che stanno per intraprendere e dell'accoglienza del brand che li ospita. Trovare la giusta chiave di comunicazione è quindi fondamentale per instaurare un rapporto empatico e professionale.",
        "Ogni membro del team contribuisce attivamente a questo processo: attraverso attenzione, cortesia e disponibilità, ciascuno diventa parte della prima e più importante promessa del marchio Elitederma — far sentire ogni persona accolta, rispettata e valorizzata.",
      ],
    },
    {
      titolo: "Linguaggio e comportamento",
      punti: [
        "All'interno dell'Accademia dovrà essere sempre utilizzato un linguaggio corretto, educato e professionale, privo di volgarità, espressioni dialettali o termini inappropriati. La comunicazione verbale rappresenta una parte integrante dell'immagine Elitederma: un linguaggio curato valorizza la persona, il ruolo e l'intera Accademia.",
        "I componenti del team e del corpo docenti dovranno mantenere un comportamento rispettoso, equilibrato e misurato, evitando atteggiamenti confidenziali o inopportuni. Sono da escludere tassativamente nomignoli, scherzi, gesti irriverenti, prese in giro, offese o qualunque forma di comportamento che possa compromettere il decoro, la credibilità o l'autorevolezza del contesto formativo.",
      ],
    },
    {
      titolo: "Comunicare insieme",
      punti: [
        "La presenza costante e coerente sui social da parte dei Master rappresenta un elemento fondamentale per rafforzare la visibilità dei corsi e sostenere la fiducia degli allievi. Quando l'attività promozionale dell'Accademia è accompagnata dal supporto reale dei docenti — attraverso la condivisione dei contenuti ufficiali, la pubblicazione di post, stories o testimonianze coerenti con l'immagine Elitederma — il messaggio diventa più autentico, umano e credibile.",
        "Il successo dei corsi programmati nasce dalla sinergia tra la comunicazione istituzionale dell'Accademia e la spinta vitale degli insegnanti stessi, che danno concretezza e forza alla promozione ufficiale con la propria presenza e partecipazione attiva. La voce del/della docente, il suo entusiasmo e la sua capacità di coinvolgere la propria community contribuiscono a creare un flusso comunicativo dinamico, che valorizza il corso, l'allievo e il brand.",
        "La collaborazione tra Accademia e docenti nella comunicazione social è quindi parte integrante del progetto Elitederma: due forze che lavorano in sinergia per un obiettivo comune — garantire la massima riuscita dei corsi, la crescita professionale dei partecipanti e la continua affermazione del marchio come punto di riferimento nel settore della dermopigmentazione e dell'estetica professionale.",
      ],
    },
    {
      titolo: "Crescere insieme",
      punti: [
        "Elitederma Academy valorizza l'iniziativa, la creatività e la competenza dei propri docenti, riconoscendo il loro ruolo attivo non solo nella didattica, ma anche nello sviluppo di nuovi percorsi formativi e tecniche specialistiche. Ogni Master ha la possibilità di proporre all'Accademia l'inserimento, all'interno della programmazione ufficiale, di tecniche personali o metodologie innovative maturate attraverso la propria esperienza professionale.",
        "In questo modo, l'Accademia e i suoi docenti collaborano in sinergia per creare valore, innovazione e nuove opportunità di crescita, condividendo esperienza, know-how e visione sotto un'unica identità: Elitederma.",
      ],
    },
    {
      titolo: "Valore dell'Impegno Reciproco",
      punti: [
        "La collaborazione con Elitederma non è solo un incarico professionale, ma un patto di fiducia reciproca, fondato su trasparenza, coerenza e senso di responsabilità. Chi sceglie di entrare nel progetto, e chi decide di lasciarlo, contribuisce in ogni caso a definire l'immagine e la reputazione del brand. Ogni azione deve quindi essere guidata da correttezza, continuità e rispetto verso gli allievi e verso l'azienda, che rappresentano il cuore e la finalità del progetto Elitederma.",
      ],
    },
  ],
};

// LE TRE DICHIARAZIONI DA SPUNTARE.
//
// ATTENZIONE: queste tre frasi NON SONO TRASCRITTE dal cartaceo — le ho
// scritte io, e vanno lette e approvate dal titolare prima della prima
// firma vera, come si e' fatto per il consenso del trico e dell'areola.
// Il cartaceo non ha frasi sopra le firme: ha TRE RIGHE DI FIRMA — in
// fondo al contratto, in fondo all'approvazione delle clausole e in
// fondo al Manifesto — e quelle tre righe sono tre atti distinti, non
// uno ripetuto. Trasposte in una pagina, tre atti sono tre caselle con
// la loro ora: con una sola non si potrebbe dire a quale dei tre la
// persona abbia aderito, ed e' la stessa lezione del 19/10/2026 sui
// consensi delle modelle.
//
// La firma col dito e' una, e si stampa su tutte e tre le righe: a
// disegnarla tre volte non si guadagna niente e si perde la pazienza di
// chi firma. Quello che distingue i tre atti e' la spunta e il suo
// istante, non il tratto.
export const CASELLE = [
  {
    chiave: "contratto",
    tipo: "obbligatoria",
    etichetta: "Contratto di collaborazione",
    testo: "Dichiaro di aver letto integralmente e compreso il Contratto di collaborazione professionale autonoma che precede — premesse e articoli da 1 a 23 — e di accettarlo in ogni sua parte. Dichiaro altresì, ai sensi dell'art. 23.5, di averne ricevuto copia prima della firma, insieme all'Allegato A, potendo chiederne chiarimenti.",
  },
  {
    chiave: "clausole",
    tipo: "obbligatoria",
    etichetta: "Approvazione specifica (artt. 1341 e 1342 c.c.)",
    testo: "Il/la Master, per quanto occorra ai sensi degli artt. 1341 e 1342 c.c. e previa lettura delle disposizioni interessate, approva specificamente le seguenti clausole:",
    // l'elenco vero sta in CLAUSOLE.punti: una sola scrittura, perche'
    // due elenchi della stessa cosa un giorno direbbero due cose diverse
    daClausole: true,
  },
  {
    chiave: "manifesto",
    tipo: "obbligatoria",
    etichetta: "Ricevuta dell'Allegato A — Manifesto Elitederma",
    testo: "Dichiaro di aver ricevuto copia del Manifesto Elitederma, versione 13 del 14 novembre 2026, allegato sub A, e di averne preso visione. Prendo atto che esprime valori, missione e stile dell'Accademia e che non istituisce obblighi, divieti o sanzioni ulteriori rispetto al contratto (art. 23.2).",
  },
];

export const CHIUSURA = {
  luogoData: "Luogo e data:",
  perAccademia: "Per Elitederma S.r.l.",
  perMaster: "Il/la Master",
  firma: "Firma:",
  firmaClausole: "Il/la Master – firma per approvazione specifica",
  firmaManifesto: "Il/la Master – firma per ricevuta dell'Allegato A",
};

// ---------------------------------------------------------------------------
// I DATI CHE LA MASTER SCRIVE, E CHE FINISCONO NELL'EPIGRAFE.
//
// L'elenco esce dall'epigrafe del cartaceo — nome, codice fiscale,
// nascita, residenza, P. IVA, PEC, email — piu' le tre cose che il
// cartaceo non chiedeva e che qui servono: il SESSO e lo STATO di
// nascita, perche' senza di loro il codice fiscale non si calcola (e un
// sesso indovinato produce un codice che passa la lettera di controllo
// ed e' di un'altra persona), e lo STATO di residenza, perche' da li'
// dipende se quella casella si chiama CAP o NPA e se il codice fiscale
// si controlla con il metro italiano (vedi residenza.js).
//
// L'ORDINE E' QUELLO IN CUI SI COMPILA, e i due Stati stanno in cima
// subito dopo il nome: e' la lezione del 7/11/2026 sul modulo di
// iscrizione — una casella di luogo incontrata prima dello Stato si
// riempie col paese sbagliato, e il codice fiscale sotto viene calcolato
// come se fosse italiano.
export const CAMPI = [
  { chiave: "nome_cognome",        etichetta: "Nome e cognome",                           obbligatorio: true },
  { chiave: "stato_nascita",       etichetta: "Stato di nascita",                         obbligatorio: false },
  { chiave: "stato_residenza",     etichetta: "Stato di residenza",                       obbligatorio: false },
  { chiave: "sesso",               etichetta: "Sesso",                                    obbligatorio: true },
  { chiave: "data_nascita",        etichetta: "Data di nascita",                          obbligatorio: true },
  { chiave: "comune_nascita",      etichetta: "Comune di nascita",                        obbligatorio: true },
  { chiave: "codice_fiscale",      etichetta: "Identificativo fiscale personale (TIN)",   obbligatorio: true },
  { chiave: "prov_residenza",      etichetta: "Provincia",                                obbligatorio: false },
  { chiave: "citta_residenza",     etichetta: "Comune di residenza",                      obbligatorio: true },
  { chiave: "cap_residenza",       etichetta: "CAP",                                      obbligatorio: true },
  { chiave: "indirizzo_residenza", etichetta: "Via",                                      obbligatorio: true },
  { chiave: "civico_residenza",    etichetta: "Civico",                                   obbligatorio: true },
  // P. IVA OBBLIGATORIA, ED E' UNA CONSEGUENZA DEL CONTRATTO, NON UNA
  // SCELTA GRAFICA: l'art. 2.3 vuole che il/la Master operi con propria
  // posizione fiscale e l'art. 12.3 che emetta fattura. Senza partita
  // IVA quel contratto non si puo' sottoscrivere per quello che dice.
  // Oggi quattro master in anagrafica non ce l'hanno scritta: non vuol
  // dire che non l'abbiano, vuol dire che nessuno l'ha mai chiesta — e
  // da qui glielo si chiede. Se il titolare decide che qualcuna firma
  // senza, si cambia questo `true` e si dice perche'.
  { chiave: "partita_iva",         etichetta: "Partita IVA",                              obbligatorio: true },
  { chiave: "pec",                 etichetta: "PEC",                                      obbligatorio: false },
  { chiave: "email",               etichetta: "Email",                                    obbligatorio: true },
  { chiave: "telefono",            etichetta: "Telefono",                                 obbligatorio: false },
];

export const PER_CHIAVE = Object.fromEntries(CAMPI.map((c) => [c.chiave, c]));

const pieno = (v) => v != null && String(v).trim() !== "";
const val = (d, k) => (pieno(d?.[k]) ? String(d[k]).trim() : "");

/** La data come la scrive un contratto: 16 novembre 2026. */
export function giornoLungo(iso) {
  if (!iso) return "";
  try {
    return new Date(String(iso).slice(0, 10) + "T00:00:00")
      .toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric" });
  } catch { return String(iso); }
}

/** gg/mm/aaaa, come nei trattini del cartaceo. */
export function giornoCorto(iso) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso);
}

/**
 * L'EPIGRAFE DEL/DELLA MASTER, composta dai suoi dati.
 *
 * Non e' il modello del cartaceo con i valori incollati dentro: e' la
 * stessa frase riscritta con quello che c'e'. Le voci facoltative che
 * mancano SI SALTANO invece di lasciare i trattini — una riga di
 * trattini in un contratto firmato si legge come un campo che qualcuno
 * ha dimenticato di riempire, e nessuno sa piu' se mancava il dato o la
 * voglia. Quelle obbligatorie non possono mancare: senza, il contratto
 * non si firma (vedi `mancantiPerFirmare`).
 */
export function epigrafeMaster(dati) {
  const d = dati || {};
  const pezzi = [];
  pezzi.push(val(d, "nome_cognome") || "[Nome e cognome]");
  if (pieno(d.codice_fiscale)) pezzi.push("C.F. " + val(d, "codice_fiscale"));
  const dove = [val(d, "comune_nascita"), val(d, "stato_nascita")].filter(Boolean).join(" — ");
  if (dove && pieno(d.data_nascita)) pezzi.push(`nato/a a ${dove} il ${giornoCorto(d.data_nascita)}`);
  else if (dove) pezzi.push(`nato/a a ${dove}`);
  if (pieno(d.citta_residenza)) {
    const prov = pieno(d.prov_residenza) ? ` (${val(d, "prov_residenza")})` : "";
    pezzi.push(`residente in ${val(d, "citta_residenza")}${prov}`);
  }
  if (pieno(d.indirizzo_residenza)) {
    // «Via» NON SI APPICCICA DAVANTI SEMPRE. In archivio la via si
    // scrive come sta sulla busta — «Via monte pasubio», «VLE P
    // TOGLIATTI», «Piazza Dante» — e prefissarla a occhi chiusi fa
    // uscire «Via Via Terni» su un contratto firmato. La parola si mette
    // solo se chi scrive non l'ha gia' messa.
    const via = val(d, "indirizzo_residenza");
    const haIlTipo = /^(via|viale|v\.le|vle|corso|c\.so|piazza|p\.zza|pzza|largo|vico|vicolo|strada|contrada|borgo|salita|lungo|localita|loc\.|frazione|fraz\.|rue|rte|route|str\.|str|chemin|avenue|av\.|place|platz|strasse|weg)\b/i.test(via);
    pezzi.push((haIlTipo ? via : "Via " + via) + (pieno(d.civico_residenza) ? ` n. ${val(d, "civico_residenza")}` : ""));
  }
  if (pieno(d.cap_residenza)) pezzi.push("CAP " + val(d, "cap_residenza"));
  if (pieno(d.stato_residenza)) pezzi.push(val(d, "stato_residenza"));
  if (pieno(d.partita_iva)) pezzi.push("P. IVA " + val(d, "partita_iva"));
  if (pieno(d.pec)) pezzi.push("PEC " + val(d, "pec"));
  if (pieno(d.email)) pezzi.push("email " + val(d, "email"));
  return pezzi.join(", ") + ", di seguito «il/la Master».";
}

/**
 * «Luogo e data», che sul cartaceo era una riga da riempire a penna.
 *
 * IL LUOGO E' IL SUO COMUNE DI RESIDENZA e la DATA E' IL GIORNO IN CUI
 * FIRMA — cosi' ha chiesto il titolare: «la data farà fede quella della
 * compilazione». Quando il comune non c'e' si scrive solo la data, non
 * un luogo inventato: dire che un contratto e' stato firmato in un posto
 * in cui nessuno era e' peggio che non dirlo.
 */
export function luogoEData(dati, quando) {
  const luogo = val(dati || {}, "citta_residenza");
  const data = giornoLungo(quando || new Date().toISOString());
  return [luogo, data].filter(Boolean).join(", ");
}

/**
 * I BLOCCHI DA LEGGERE, in ordine, come sul cartaceo.
 *
 * Chi chiama passa i testi (dal database o dal codice) e i dati di chi
 * firma: l'epigrafe entra nel primo blocco, perche' la prima cosa che si
 * legge in un contratto e' chi lo sta firmando. Lo usano la pagina che
 * la master ha davanti E il PDF della copia firmata: due elenchi
 * vorrebbero dire una copia che non corrisponde a quello che si e'
 * letto.
 */
export function blocchiContratto(testi, dati) {
  const t = testi || {};
  const parti = t.parti || PARTI;
  const premesse = t.premesse || PREMESSE;
  const articoli = t.articoli || ARTICOLI;
  return [
    {
      titolo: "Le parti",
      punti: [
        parti.etichettaAccademia,
        parti.accademia,
        parti.etichettaMaster,
        epigrafeMaster(dati),
      ],
    },
    { titolo: premesse.titolo, punti: premesse.punti },
    ...articoli,
  ];
}

/**
 * COSA MANCA PER POTER FIRMARE.
 *
 * Una funzione sola, usata dalla pagina per scrivere «Manca ancora: …» e
 * dal database per rifiutare. Qui e' comodita', la serratura e'
 * `contratto_master_salva`: un controllo che vive solo nel browser non e'
 * un controllo.
 */
export function mancantiPerFirmare({ dati = {}, spunte = {}, firma = null, docFronte = null, docRetro = null, letto = false } = {}) {
  const manca = [];
  const fuoriItalia = pieno(dati.stato_nascita);
  for (const c of CAMPI) {
    if (!c.obbligatorio) continue;
    // a chi e' nato all'estero il comune italiano non si chiede: la
    // casella e' spenta, e pretenderla vorrebbe dire un contratto che
    // non si puo' firmare
    if (c.chiave === "comune_nascita" && fuoriItalia) continue;
    if (!pieno(dati[c.chiave])) manca.push(c.etichetta);
  }
  if (!letto) manca.push("Aprire il contratto e richiuderlo");
  if (!docFronte) manca.push("Foto del documento — fronte");
  if (!docRetro) manca.push("Foto del documento — retro");
  for (const c of CASELLE) {
    if (c.tipo !== "facoltativa" && !spunte[c.chiave]) manca.push(c.etichetta);
  }
  if (!firma) manca.push("La firma");
  return manca;
}

/**
 * LE SEDICI VOCI DELL'APPROVAZIONE SPECIFICA, senza la frase che le
 * introduce.
 *
 * In `CLAUSOLE.punti` il primo capoverso e' «…approva specificamente le
 * seguenti clausole:» ed e' lo stesso testo della casella da spuntare:
 * stamparlo due volte di fila, una come frase e una come primo punto
 * dell'elenco, si legge come un errore. Le voci sono quelle che
 * cominciano col pallino, e il pallino si toglie perche' chi disegna
 * l'elenco lo rimette da se'.
 */
export function vociClausole(clausole) {
  return ((clausole || CLAUSOLE).punti || [])
    .filter((p) => String(p).trim().startsWith("•"))
    .map((p) => String(p).replace(/^\s*•\s*/, "").trim());
}

/**
 * LE TRE CASELLE PRONTE DA DISEGNARE: quella delle clausole si porta
 * dietro l'elenco, perche' senza le sedici voci «approvo specificamente
 * le seguenti clausole:» e' un'approvazione specifica di nulla.
 */
export function casellePronte(testi) {
  const t = testi || {};
  const caselle = t.caselle || CASELLE;
  const clausole = t.clausole || CLAUSOLE;
  return caselle.map((c) => (c.daClausole ? { ...c, clausole: vociClausole(clausole) } : c));
}
