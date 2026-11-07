// COME FUNZIONA L'APP, area per area: quello che l'assistente puo'
// raccontare a chi chiede «dove si fa…», «come faccio a…», «a cosa serve
// questa pagina».
//
// Chiesto dal titolare il 3/11/2026: l'assistente non deve rispondere
// solo sui regolamenti, ma anche sulle funzionalita' dell'app — e «solo
// limitatamente alle funzioni che ciascun utente vede». Ogni voce porta
// la chiave del suo tasto della home (TASTI_HOME in App.jsx): a chi non
// ha quel permesso la voce non viene nemmeno mostrata al modello, cosi'
// non puo' spiegare una pagina che quella persona non trovera' mai.
//
// UNA REGOLA SU COSA SI SCRIVE QUI: si dice DOVE si fa una cosa e QUALE
// gesto la fa. Mai una cifra — non un prezzo, non una percentuale, non
// una soglia. Le cifre le decide il titolare e vivono in due posti soli:
// le schede di «Regolamenti» (che l'assistente cita) e i dati (che
// l'assistente interroga). Una cifra scritta qui invecchierebbe senza che
// nessuno se ne accorga, e sarebbe creduta perche' detta dall'app.
//
// Sta in _shared/ perche' e' materiale della edge function; non la legge
// il browser, ma il posto giusto per cambiarla e' questo file, con il
// codice, non il prompt.

export const GUIDA_GENERALE = `COM'E' FATTA L'APP (vale per tutti).
- Si entra con una password dalla schermata d'accesso: quella password dice chi sei (amministratore, master, assistente, venditore, o un utente nominale dell'ufficio) e quali aree ti spettano. Le tessere della Home che non ti spettano sono spente: non e' un guasto.
- Dalla Home si entra in ogni area. In alto ci sono Home / Indietro / Avanti, e in basso (al centro da computer, in fondo da telefono) c'e' il dock con i preferiti: una tessera si mette nei preferiti dal dock stesso, premendo uno slot vuoto.
- Il tondo con il punto interrogativo — questo, che stai usando — c'e' in tutte le pagine: risponde sui regolamenti, su come funziona l'app e sui dati delle aree che ti spettano. Si puo' anche parlare, con il microfono dentro il pannello.
- Se in una pagina «non funziona piu' niente» e prima funzionava, la prima cosa da provare e' RICARICARE la pagina: quando l'app viene pubblicata aggiornata, una scheda rimasta aperta da ore cerca pezzi che non ci sono piu'. Succede, e si risolve cosi'.
- Da iPhone conviene installare l'app dalla schermata Home (Condividi → Aggiungi alla schermata Home): le notifiche push arrivano solo all'app installata.`;

export const AREE_GUIDA = [
  {
    chiave: "gestionedate",
    titolo: "Gestione corsi ed eventi",
    testo: `GESTIONE CORSI ED EVENTI — il calendario. Qui si creano e si organizzano le classi: un corso + una sede + una data + la master che la tiene (e le assistenti). Aprendo una classe si vede e si gestisce tutto il suo mondo: le iscritte e i posti, l'alloggio (dal tasto «Gestisci» della colonna Hotel si sceglie un hotel registrato oppure si compila una scheda «Provvisorio / occasionale» con indirizzo, telefono e tariffe), i costi della classe, la busta dei contanti, i QR dei consensi delle modelle, il materiale e i kit.
In fondo alla scheda c'e' il Riepilogo amministrativo, con «Bilancio del corso»: ricavi (tutto il pattuito, anche non ancora incassato), spese (compreso il costo dei kit consegnati) e il risultato, con la pastiglia ATTIVO o PASSIVO. Serve a sapere se una classe e' in pari prima che tutti abbiano pagato.
Da qui si arriva anche a «Prossime contabilita'», l'elenco delle classi da chiudere.
Due cose da sapere: i posti di una classe li decide la classe (o il corso), non la capienza della sede — se la sede e' piu' piccola compare un avviso, non un blocco; e la sede si puo' marcare «confermata» quando e' certa.`,
  },
  {
    chiave: "dashboardvenditori",
    titolo: "Dashboard venditori",
    testo: `DASHBOARD VENDITORI — le vendite, gli obiettivi e i compensi di chi vende. Chi entra con la propria password venditore la trova bloccata sui propri dati: vede le sue iscrizioni, i suoi obiettivi e le sue commissioni, non quelle degli altri. Chi amministra puo' scegliere il venditore.
Dentro c'e' «Commissioni sui corsi»: mese per mese quanto e' maturato, con il mese in corso che cresce man mano che arrivano le iscrizioni. Le percentuali e i minimi non li scrivo io: stanno nelle schede di Regolamenti e in Setting, dove li ha decisi chi amministra.`,
  },
  {
    chiave: "dashboardmaster",
    titolo: "Dashboard master",
    testo: `DASHBOARD MASTER — l'area di chi tiene i corsi: le sue classi, i punti accumulati sulle vendite fatte in aula, i biglietti di viaggio e i documenti, le modelle. Una master entra con la sua password e vede le proprie classi, comprese quelle in cui fa l'assistente. Se la master vende anche, dalla sua Home si apre pure la Dashboard venditori, bloccata su di lei.`,
  },
  {
    chiave: "erp",
    titolo: "Amministrazione",
    testo: `AMMINISTRAZIONE — la parte finanziaria e organizzativa, ed e' l'area piu' grande. Dentro ci sono: le spese (con gli allegati delle fatture), la prima nota, la riconciliazione dei movimenti di banca, «Fatture da emettere» (gli incassi a carta che aspettano la fattura; il contante non entra in quella lista), il collegamento a Fatture in Cloud, la cassa contanti (che si legge un mese alla volta: riporto, movimenti del mese, saldo a fine mese), lo scadenzario attivo e passivo, il catalogo delle categorie di costo, le anagrafiche (fornitori, master, venditori, assistenti, hotel, sedi), le stampe per la tipografia, il budget dei costi e la pagina «Iscrizione allievi» che spiega la procedura.`,
  },
  {
    chiave: "magazzinoshop",
    titolo: "Gestione magazzino e shop",
    testo: `GESTIONE MAGAZZINO E SHOP — i prodotti, le giacenze e lo shop online. Qui si crea e si corregge un prodotto (nome, foto, prezzo, categoria, scorta minima, fornitore, costo d'acquisto), si rettifica una giacenza, si vede chi e' sotto scorta o esaurito, e si guarda «Prodotti usati per i kit», cioe' quanto materiale se ne va nei kit dei corsi.
Ogni modifica che un cliente puo' vedere (prezzo, nome, foto, un prodotto che torna disponibile) viene spinta sul sito e svuota la cache del sito, altrimenti la pagina continuerebbe a far vedere la situazione di prima.
C'e' anche **«Costo dei kit»**: quanto costa il materiale di ogni pacchetto kit, corso per corso, con l'elenco di cosa c'e' dentro e quali articoli non hanno il costo d'acquisto scritto in anagrafica (quelli restano fuori dal totale, e il riquadro lo dice). Da li' si corregge anche il contenuto di un kit, e la correzione si vede subito in Impostazioni e in Logistica.
Ci sono anche: «Vendite shop» con gli ordini che arrivano dal sito e il riquadro che dice com'e' andata l'ultima sincronizzazione (col tasto «Recupera ordini mancanti» se si e' fermata), il cestino delle vendite (una vendita cancellata si recupera per sei mesi), gli scostamenti del magazzino (giacenze che contraddicono la loro storia) e lo scarto con le quantita' del sito.
Sulla disponibilita' c'e' una cosa da sapere: per un kit composto o un espositore la giacenza scritta non vuol dire niente, quello che si puo' vendere e' quanti pezzi si riescono a comporre dai componenti.`,
  },
  {
    chiave: "pos",
    titolo: "POS Vendita diretta",
    testo: `POS — la vendita al banco, con lo scarico automatico dal magazzino. Si cerca il prodotto, si mette nel carrello, si scelgono cliente e metodo di pagamento e si incassa. Il carrello si puo' lasciare sospeso e riprendere dopo (i pezzi sospesi restano impegnati e il sito non li offre piu'). Si puo' dire «Sei a un evento?» per attaccare la vendita a una fiera.
I pagamenti sono quattro tasti allo stesso livello: Stripe (link o QR che il cliente paga dal suo telefono), POS fisico (il terminale, che hanno l'amministrazione e chi vende al banco di una fiera), contanti e buono Amazon. Sotto al totale si scegli anche la modalita': in unica soluzione, oppure splittato - una parte in contanti e il resto con la carta, dove si scrive quanto si riceve in contanti e l'app calcola il resto con lo sconto della carta, che e' una tabella diversa. Lo splittato ce l'hanno per ora il POS del programmatore e quello di Chiara. Con la carta il tasto per incassare si accende solo quando il pagamento risulta davvero arrivato: e' una regola del database, non una cortesia dell'app, e serve perche' e' gia' successo che partisse un pacco mai pagato. L'omaggio lo puo' fare solo chi ne ha il permesso.
Un ordine pagato col buono Amazon non si puo' segnare «spedito» finche' qualcuno in logistica non ha verificato il buono.`,
  },
  {
    chiave: "logisticaprodotti",
    titolo: "Logistica prodotti",
    testo: `LOGISTICA PRODOTTI — i pacchi. «Ordini in arrivo» sono le vendite da preparare e spedire (shop online, banco fuori sede, e a Roma anche quelle da consegnare a mano); si segna la spedizione con corriere e tracciamento.
«Spedizioni corsi» e' l'allestimento del materiale di una classe: i kit delle iscritte, le riserve, i dermografi, gli accessori della didattica, la merce da vendere in aula. Il tasto «Prepara» apre a tutta pagina la lista di raccolta — tutto quello che serve, prodotto per prodotto, con le quantita' gia' sommate — e si spunta riga per riga mentre si gira fra gli scaffali: le spunte restano salvate, cosi' un altro turno vede cosa e' gia' stato preso.
Ci sono anche i rientri del materiale dai corsi e dalle fiere: al rientro non si scrive un numero, si conta e si spunta.`,
  },
  {
    chiave: "compensipremi",
    titolo: "Area compensi e premi",
    testo: `AREA COMPENSI E PREMI — i coupon e i codici sconto, i referral, le provvigioni e i premi, i punti delle master. Qui si emettono i codici per l'aula e si vede chi li ha usati. Le percentuali di ogni serie di codici stanno scritte nelle impostazioni dei codici, non le dico a memoria.`,
  },
  {
    chiave: "generazioneloghi",
    titolo: "Assegna logo",
    testo: `ASSEGNA LOGO — i loghi, i watermark e i materiali ufficiali da personalizzare e scaricare.`,
  },
  {
    chiave: "gestionemodelle",
    titolo: "Gestione modelle",
    testo: `GESTIONE MODELLE — le modelle su cui le allieve si esercitano: disponibilita', assegnazioni ai corsi e i trattamenti fatti. Il consenso lo firma la modella dal proprio telefono inquadrando il QR della classe: ogni tipo di trattamento ha il suo modulo (trucco permanente, microneedling, laminazione, tricopigmentazione, areola, extension ciglia) e un corso sta su un consenso solo. Il consenso firmato, con il questionario di salute, si rilegge dall'archivio: e' quello che la master deve guardare prima di toccare la modella.`,
  },
  {
    chiave: "statistiche",
    titolo: "Statistiche",
    testo: `STATISTICHE — analisi, report e indicatori dell'accademia. In cima, per chi amministra, c'e' «Chiedi ai dati»: si scrive una domanda in italiano e si ottiene la risposta coi numeri, con sotto le righe usate e la query che le ha calcolate, cosi' chi legge puo' controllare.`,
  },
  {
    chiave: "crmallievi",
    titolo: "CRM / Allievi",
    testo: `CRM / ALLIEVI — l'anagrafica di chi ha comprato un corso, con la scheda di ogni iscrizione: dati, pagamenti (acconto, quota pre corso, saldo), kit scelto, modelle, allegati.
Da qui parte il modulo di iscrizione: si preme «Invia il modulo» e l'allieva lo compila e lo firma dal telefono: il modulo non si carica piu' a mano e non si manda un link copiato. La fascia di stato in cima alla scheda dice a che punto e': dati inseriti, modulo inviato, modulo ricevuto, confermato. Quando il modulo torna, la scheda si chiude e per cambiare qualcosa si usa «Ricomincia procedura di firma», in alto nella fotografia dell'iscrizione; modelle e note invece si cambiano sempre.
Nel CRM c'e' anche «Contatti»: tutte le persone che hanno scritto nel tempo, con la loro cronologia di richieste, i filtri per periodo, corso e luogo, e «Componi mail» per scrivere alla lista filtrata (ogni mail porta il link per disiscriversi, e chi si disiscrive resta in archivio ma fuori da ogni invio).`,
  },
  {
    chiave: "storicoallievi",
    titolo: "Storico Allievi",
    testo: `STORICO ALLIEVI — i corsi svolti prima che esistesse il gestionale, recuperati dagli archivi. Si consulta; non e' da qui che si iscrive qualcuno.`,
  },
  {
    chiave: "impostazioni",
    titolo: "Setting",
    testo: `SETTING — le impostazioni. Dentro, fra le altre cose: i modelli delle email che l'app manda (e quando partono da sole), il testo del modulo di iscrizione e del regolamento che l'allieva firma, le impostazioni dei corsi e della quota coordinatore, l'aspetto dell'app (sfondo, nomi dei tasti, colori), la gestione degli utenti con i permessi di ognuno (le caselle delle aree della Home) e le notifiche push.
Due avvertenze: il testo del contratto si corregge da qui e vale dal prossimo modulo firmato — chi ha gia' firmato tiene il suo; e i permessi si rileggono quando la persona ricarica l'app.`,
  },
  {
    chiave: "prezzicorsi",
    titolo: "Prezzi corsi",
    testo: `PREZZI CORSI — le locandine con i prezzi dei corsi, pronte da scaricare e da mandare. E' qui che sta il prezzo di un corso: nei dati dell'app il prezzo di listino di un corso non esiste, esiste il pattuito di ogni singola iscrizione. Quindi a «quanto costa il corso X» si risponde «guarda la locandina in Prezzi corsi», non con una cifra a memoria.`,
  },
  {
    chiave: "normative",
    titolo: "Normative",
    testo: `NORMATIVE — le regole da rispettare e i documenti che le accompagnano: la mappa delle normative del trucco permanente regione per regione, la modulistica e le indicazioni per il rientro al corso.`,
  },
  {
    chiave: "progettiincorso",
    titolo: "Progetti in corso",
    testo: `PROGETTI IN CORSO — cosa c'e' da fare, chi ci sta lavorando e per quando. Ogni progetto ha le sue attivita', la scadenza e gli allegati (bozze, preventivi, grafiche). C'e' anche l'area «Progetti Ruh», che e' la stessa lista filtrata sui progetti affidati a Ruh.`,
  },
  {
    chiave: "gestionieventi",
    titolo: "Gestione eventi",
    testo: `GESTIONE EVENTI — le fiere e gli eventi: le spese, gli incassi, il materiale che si porta e i documenti (certificazioni, regolamento della fiera, planimetrie, permessi).
Sul materiale c'e' una regola precisa: quello che si porta a una fiera NON viene scalato dal magazzino, e' come spostare una parte del magazzino all'evento — scende solo quando viene venduto. Al rientro si conta quello che torna e si spunta riga per riga; la chiusura dell'evento chiede quelle spunte.
C'e' «Bolla di accompagnamento», che genera il documento di trasporto in PDF con l'elenco del materiale, e «Dettaglio vendite», che dice cosa e' passato dal banco: incassato, scontrino medio, come hanno pagato e la classifica dei piu' venduti.`,
  },
  {
    chiave: "assegnazionekit",
    titolo: "Assegnazione kit",
    testo: `ASSEGNAZIONE KIT — l'elenco delle iscritte a cui non e' stato ancora assegnato un pacchetto kit. La tessera compare solo finche' c'e' qualcuno in quella condizione, e sparisce quando la lista si svuota.`,
  },
  {
    chiave: "regolamenti",
    titolo: "Regolamenti",
    testo: `REGOLAMENTI — le decisioni prese: prezzi, sconti, procedure, cosa fare quando. Chi amministra scrive le schede (titolo, argomento, testo, per chi vale, da quando e' decisa); gli altri le leggono. E' la fonte da cui questo assistente risponde quando dice «dalle regole»: se una scheda manca, la domanda resta registrata come domanda senza risposta, ed e' da li' che si capisce quali regole vanno ancora scritte.`,
  },
  {
    chiave: "registrazioneclienti",
    titolo: "Registrazione clienti",
    testo: `REGISTRAZIONE CLIENTI — si registra chi si incontra: nome, cognome, citta', email e telefono. La tessera e' in Home per tutti, master comprese. Due sezioni: «Registra un cliente» per inserirlo e «Clienti registrati» per consultare l'elenco, con la ricerca.

Il luogo NON si scrive, si scegli: si comincia a battere la citta', l'app la suggerisce dall'elenco ISTAT e scegliendola riempie da se' provincia, regione e CAP. Provincia e regione restano in sola lettura, perche' una regione battuta a mano diventa quattro modi di scrivere la stessa cosa e l'elenco per regione non si fa piu'. Dove i CAP sono molti (le grandi citta') la tendina resta da scegliere.

Il telefono e' forzato col prefisso +39, che sta fuori dalla casella e non si tocca; un numero estero da qui oggi non si registra. Email e telefono sono OBBLIGATORI, e il motivo e' la regola del doppione.

CHI E' «GIA' REGISTRATO»: nome + cognome + email + telefono. In caso di omonimia la persona e' la stessa solo se corrisponde tutto, contatti compresi: stesso nome con telefono o mail diversi e' un secondo cliente. La citta' resta fuori di proposito, perche' chi trasloca non diventa un'altra persona. Se si prova a salvare un doppione l'app dice «utente gia' registrato» e mostra quale riga c'e' gia'.

Ogni riga dell'elenco ha due tastini: la matita porta la scheda dentro lo stesso modulo e salvando aggiorna quella riga (non ne crea una nuova), il cestino la cancella dopo una conferma che nomina la persona. Chi ha registrato la riga resta scritto e non si riscrive; una correzione aggiunge chi l'ha fatta e quando. La cancellazione non ha cestino: una riga tolta non si ripesca.`,
  },
  {
    chiave: "modellefiera",
    titolo: "Modelle fiera",
    testo: `MODELLE FIERA — il consenso informato da far compilare alle modelle al banco di una fiera. La tessera la vede chi ha quel permesso: nasce accesa a chi sta al banco della fiera aperta, e si sblocca agli altri a richiesta da Gestione utenti (o Password master / venditori / assistenti).

Come si usa: si controlla che la fiera indicata sia quella giusta (se ce n'e' una sola e' gia' scelta), si preme il TRATTAMENTO che si fa alla modella, e compare il codice da far inquadrare. Il modulo lo compila lei dal suo telefono — dati, documento, questionario di salute, firma col dito — e si puo' anche stampare il codice e appenderlo al banco.

Si scegli un trattamento per volta, e non e' un fastidio di ordine: ogni modulo ha le sue domande sulla salute, e sei codici accanto su un banco vogliono dire una modella trattata a microneedling che firma il modulo del trucco permanente. Il foglio sbagliato sotto una firma giusta non vale niente.

Il consenso firmato da qui resta legato a QUELLA fiera, e si rilegge in fondo alla pagina stessa, con il riepilogo delle risposte sotto ogni nome: e' quello che va guardato prima di toccare la modella. Il tasto «Aggiorna» serve perche' lei firma dal suo telefono e questa pagina non se ne accorge da sola.

Se in questi giorni non c'e' nessuna fiera aperta la pagina lo dice e non mostra nessun codice: un consenso senza la sua fiera, fra un mese, non si sa piu' di quale evento era. In aula invece non si usa questa pagina: il codice della classe sta nella scheda della classe.`,
  },
  {
    chiave: "stampe",
    titolo: "Stampe",
    testo: `STAMPE — l'elenco dei corsi in ordine cronologico con, accanto a ogni classe, due tasti: «Diplomi» e «Nomi». Serve a chi deve solo stampare: da qui non si entra nelle classi, non si modifica e non si cancella niente, e non c'e' la vista a calendario.

Ci sono gli stessi filtri di Gestione corsi — corso, citta', master — la stessa ricerca e le due linguette Programmati e Passati, che qui servono piu' che altrove perche' i diplomi si stampano a corso finito.

«Diplomi» compone il PDF dei diplomi della classe e «Nomi» il foglio dei segnaposti. Il diploma viene SOLO dal pacchetto dell'allieva: se un'allieva non ce l'ha, o il suo pacchetto non ha il modello di diploma, il suo foglio non esce e l'app lo dice allieva per allieva, con il motivo. Da qui non si puo' rimediare: va sistemato da chi amministra, in Tipologie di kit. Se la classe non ha iscritti lo dice e non genera niente.`,
  },
];

/**
 * La guida per chi ha fatto accesso: la parte generale piu' le aree che
 * i suoi permessi gli aprono. Chi amministra le vede tutte.
 *
 * @param {{ ruolo?: string, permessi?: string[] }} [chi]
 * @returns {string}
 */
export function guidaPer({ ruolo = "tutti", permessi = [] } = {}) {
  const miei = new Set((permessi || []).map(String));
  const amministra = ruolo === "amministrazione";
  const aree = AREE_GUIDA.filter((a) => amministra || miei.has(a.chiave));
  return [GUIDA_GENERALE, ...aree.map((a) => a.testo)].join("\n\n");
}
