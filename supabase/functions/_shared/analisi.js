// I DATI CHE L'ASSISTENTE PUO' GUARDARE, e a chi spetta quale.
//
// Sta qui, e non in src/, perche' lo usano due mondi: le edge function
// `analisi-domanda` («Chiedi ai dati», in Statistiche, solo per chi
// amministra) e `assistente-regole` (il tondo con il punto interrogativo,
// per tutti). Il modello scrive una SELECT su queste viste, Postgres la
// esegue, il modello scrive la risposta dai numeri tornati: il modello
// compone e commenta, i numeri li fa il database.
//
// Due controlli sulla stessa regola, e ognuno serve a qualcosa di
// diverso: `controllaSql` qui spiega l'errore IN ITALIANO al modello, che
// lo legge e riprova; `analisi_esegui` nel database lo impedisce. Il
// controllo che conta e' quello del database — una regola che vive solo
// nel prompt non e' una regola.
//
// IL LIMITE PER PERSONA (3/11/2026). Ogni area dichiara con quali
// permessi della home (TASTI_HOME in App.jsx) si apre: `permessi: []`
// vuol dire «chiunque abbia fatto accesso». La edge function ricava
// l'elenco delle viste ammesse e lo passa a `analisi_esegui`, che
// rifiuta tutto il resto. Va detto con precisione cos'e' questo limite:
// decide COSA L'ASSISTENTE MOSTRA, non cosa la sessione potrebbe
// leggere — finche' l'account Supabase e' uno per tutti, i permessi li
// sa solo la pagina e dal browser si leggono comunque le tabelle (vedi
// «UN SOLO ACCOUNT SUPABASE PER TUTTI» nel § 4 di CLAUDE.md). Diventa
// una serratura il giorno che il ruolo passa dal JWT.
//
// NESSUNA VISTA PORTA UN DATO PERSONALE di allievi o clienti: niente
// nomi, residenze, email, telefoni, documenti. Ci sono i nomi dello
// staff (master, assistenti, venditori, operatori del banco), i corsi,
// le citta', i prodotti, i fornitori e le categorie di spesa. Domanda e
// risposta passano da un modello di terze parti: mandargli l'anagrafica
// di un'allieva e' una decisione del titolare, non di chi scrive il
// codice.

const PREAMBOLO = "VISTE DISPONIBILI (solo lettura; le date sono DATE in fuso Europe/Rome; gli importi sono in euro, IVA inclusa dove non detto altrimenti):";

export const AREE_DATI = [
  {
    vista: "analisi_calendario",
    titolo: "Calendario delle classi",
    // il calendario in app lo vedono tutti, anche il profilo di sola
    // lettura: qui non c'e' una cifra di denaro
    permessi: [],
    catalogo: `analisi_calendario — una riga per CLASSE (corso + citta' + data). E' la vista delle domande «che corso c'e' a novembre a Bari», «chi tiene il PMU di Milano», «quanti posti restano».
  colonne: id, corso, categoria, citta, sede (nome della sede), indirizzo, data_inizio, data_fine, giorni, quando ('in programma'|'in corso'|'concluso'), master, altre_master (se la classe ha piu' di una master), assistenti, posti_max, iscritti, iscritti_confermati, posti_liberi, sede_confermata, sede_occasionale, hotel.
  REGOLE: «che corso c'e'» al futuro vuol dire quando <> 'concluso' (o data_inizio >= current_date); «chi tiene il corso» e' master, piu' altre_master se c'e'. Le citta' sono scritte in maiuscolo (ROMA, BARI): confrontarle con ilike. I posti li decide la classe, non la capienza della sede. Non ci sono i nomi delle allieve: di loro c'e' solo quante sono.`,
  },
  {
    vista: "analisi_corsi",
    titolo: "Catalogo dei corsi",
    permessi: [],
    catalogo: `analisi_corsi — una riga per CORSO del catalogo (non per classe).
  colonne: id, nome, categoria, posti_max, prevede_dermografo, giorni_programma, pacchetti_kit (quanti kit si possono scegliere), kit_disponibili (i loro nomi), classi_in_tutto, classi_in_programma, prossima_classe (data), consenso_modella (il codice del modulo di consenso che vale per quel corso).
  ATTENZIONE, e' importante: IL PREZZO DI UN CORSO NON ESISTE in questi dati. Non c'e' nessun listino dei corsi: il prezzo sta nelle locandine della pagina «Prezzi corsi» e, iscritta per iscritta, nel pattuito della sua iscrizione (analisi_iscrizioni, se chi chiede la puo' vedere). Se qualcuno chiede quanto costa un corso, dire dove si guarda — mai stimare una cifra.`,
  },
  {
    vista: "analisi_kit",
    titolo: "Kit dei corsi",
    permessi: ["gestionedate", "magazzinoshop", "logisticaprodotti", "assegnazionekit", "dashboardmaster"],
    catalogo: `analisi_kit — una riga per PACCHETTO KIT di un corso (quelli fra cui l'allieva sceglie).
  colonne: id, kit (nome), corso, dermografo_a_parte, prodotti (quanti articoli diversi), pezzi (quantita' totale).
  Il kit del corso non si vende a parte: e' compreso nel corso, e qui non ha un prezzo di vendita. «QUANTO COSTA IL KIT X» si risponde da **analisi_kit_costi**, che da' il costo del materiale per ogni kit (se chi chiede la puo' vedere) — non serve comporre niente a mano. Se invece si parla di un KIT CHE LO SHOP VENDE come prodotto suo, il prezzo e' in analisi_prodotti.`,
  },
  {
    vista: "analisi_kit_prodotti",
    titolo: "Cosa c'è dentro i kit",
    permessi: ["gestionedate", "magazzinoshop", "logisticaprodotti", "assegnazionekit", "dashboardmaster"],
    catalogo: `analisi_kit_prodotti — una riga per ARTICOLO dentro un kit di corso: id, kit (null se l'articolo non sta in un pacchetto), corso, tipo ('kit' = contenuto del pacchetto, 'accessorio' = accessorio della didattica che parte comunque con la classe), prodotto, sku, quantita.
  Per il COSTO di un kit non serve sommare qui: c'e' analisi_kit_costi, che lo da' gia' fatto e con lo stesso conto che l'app mostra in «Costo dei kit».`,
  },
  {
    vista: "analisi_kit_costi",
    titolo: "Quanto costa il materiale di ogni kit",
    // e' un costo, quindi la vedono le stesse aree che vedono i costi; piu'
    // «gestionedate», perche' nel Bilancio del corso quel numero c'e' gia'
    permessi: ["magazzinoshop", "erp", "statistiche", "gestionedate"],
    catalogo: `analisi_kit_costi — quanto costa il MATERIALE di ogni pacchetto kit. E' la risposta diretta a «quanto costa il kit X», e da' lo stesso numero che l'app mostra in Gestione magazzino → «Costo dei kit» e nel Bilancio del corso.
  colonne: id, kit (nome), corso, articoli (quanti articoli diversi), pezzi (quantita' totale), costo_materiale (somma dei costi d'acquisto netti), costo_materiale_ivato, articoli_senza_costo, senza_costo (i nomi di quegli articoli).
  REGOLA: un articolo senza costo d'acquisto in anagrafica NON vale zero — e' fuori dal totale, e va DETTO nella risposta («il totale non comprende X, che non ha un costo scritto»). Sommare zeri farebbe sembrare il kit piu' economico di quello che e'.
  I kit di un corso si chiamano come li chiama chi vende (KIT BASE, KIT PRO, KIT ELITE Completo…): confrontarli con ilike, e se chi chiede nomina il corso filtrare su corso.`,
  },
  {
    vista: "analisi_prodotti",
    titolo: "Catalogo dello shop (prezzi e disponibilità)",
    // chi vende al banco, chi spedisce e chi gestisce il magazzino: i
    // prezzi di vendita li devono sapere. I costi no, stanno a parte
    permessi: ["magazzinoshop", "pos", "logisticaprodotti", "dashboardmaster", "dashboardvenditori"],
    catalogo: `analisi_prodotti — una riga per PRODOTTO dello shop, con prezzo e disponibilita'. Niente costi e niente margini: quelli sono in analisi_prodotti_costi.
  colonne: id, nome, sku, categoria, prezzo (quello che paga il cliente, IVA inclusa), prezzo_netto, iva_percentuale, giacenza, disponibilita, scorta_minima, soglia_riordino, attivo, stato, tipo_prodotto ('semplice'|'bundle'|'componente'), unita_misura, pezzi_per_confezione, backorder_attivo, backorder_messaggio, sul_sito (e' pubblicato sullo shop online), escludi_vendita_diretta, solo_offline, punti_prodotto, provvigione_master_pct.
  REGOLA SULLA DISPONIBILITA': per dire se una cosa c'e' usare **disponibilita**, non giacenza. Su un bundle (un kit composto, un espositore) la colonna giacenza vale zero e non vuol dire niente: quello che si puo' vendere sono i pezzi che si riescono a comporre dai componenti, ed e' quello che disponibilita calcola. Detto al contrario: rispondere «esaurito» guardando giacenza su un bundle e' sbagliato.
  I nomi dei prodotti dicono il formato della confezione («1pz», «3 pz», «Box 20 pz»): e' il formato, non la quantita' in magazzino.`,
  },
  {
    vista: "analisi_prodotti_costi",
    titolo: "Costi e margini dei prodotti",
    permessi: ["magazzinoshop", "erp", "statistiche"],
    catalogo: `analisi_prodotti_costi — costi d'acquisto e margini, prodotto per prodotto: id, nome, sku, categoria, fornitore, costo_acquisto (unitario, netto; puo' essere null), prezzo (IVA inclusa), prezzo_netto, margine_netto (prezzo_netto - costo_acquisto), margine_pct, giacenza, valore_giacenza, lead_time_giorni, lotto_minimo_ordine, quantita_riordino.
  REGOLA: dove costo_acquisto e' null il margine non si sa, e va DETTO invece di contarlo zero — un costo mancante fatto passare per zero fa sembrare tutto piu' redditizio di quello che e'.`,
  },
  {
    vista: "analisi_vendite",
    titolo: "Vendite, una riga per ordine",
    permessi: ["magazzinoshop", "erp", "statistiche"],
    catalogo: `analisi_vendite — una riga per ordine, banco e shop online.
  colonne: id, numero_ordine, data, anno, mese, canale ('banco'|'shop online'), stato ('completed','processing','on-hold','pending','cancelled','refunded','failed'), tipo_movimento ('vendita','reso','cambio','annullamento','omaggio'), metodo_pagamento ('pos','contanti','buono_amazon', o quello del sito), operatore (nome di chi ha venduto al banco), operatore_tipo ('master','venditore','admin'...), corso (nome del corso della classe in cui e' avvenuta la vendita, null se fuori dai corsi), citta, evento (nome della fiera, se vendita in fiera), totale, imponibile, iva, provvigione_master, codice_coupon.
  REGOLA: per i ricavi veri usare stato in ('completed','processing') and tipo_movimento = 'vendita'.`,
  },
  {
    vista: "analisi_vendite_righe",
    titolo: "Vendite, una riga per prodotto venduto",
    permessi: ["magazzinoshop", "erp", "statistiche"],
    catalogo: `analisi_vendite_righe — una riga per prodotto venduto (stesse colonne di contesto di analisi_vendite: vendita_id, numero_ordine, data, anno, mese, canale, stato, tipo_movimento, metodo_pagamento, operatore, corso, citta, evento) piu':
  prodotto (nome), sku, categoria (categoria del prodotto, puo' essere null), quantita, totale_riga (incasso della riga), sconto_riga, costo_acquisto (unitario, puo' essere null), margine_stimato (totale_riga - costo*quantita, null se il costo manca), conta_incassi (bool: false = componente o voce di servizio che NON conta come prodotto venduto), tipo_prodotto ('semplice','bundle','componente', null).
  REGOLA: i «prodotti piu' venduti» si contano qui, con la stessa regola su stato e tipo_movimento. Si vende il PACCO, non i pezzi dentro: la vista esclude gia' i componenti dei kit (le righe a 0 € accanto a un kit), quindi un «Kit 3 colori» conta come kit e non come tre pigmenti. Per sapere se un'offerta in pacco funziona si guarda il prodotto pacco (tipo_prodotto = 'bundle'). Salvo richiesta esplicita escludere le righe di servizio come «Spedizione» (prodotto ilike 'spedizione%').
  ATTENZIONE: «1pz», «3 pz», «Box 20 pz» nel NOME del prodotto sono il formato della confezione, non la quantita' venduta: la quantita' e' la colonna quantita.`,
  },
  {
    vista: "analisi_iscrizioni",
    titolo: "Iscrizioni ai corsi",
    permessi: ["erp", "statistiche", "crmallievi"],
    catalogo: `analisi_iscrizioni — una riga per iscrizione a un corso (NESSUN dato dell'allievo).
  colonne: id, data_iscrizione, anno, mese, corso, citta, data_inizio, data_fine (del corso), master (chi tiene il corso), venditore (chi ha iscritto), stato ('dati_inseriti','modulo_inviato','modulo_ricevuto','confermato'), totale_pattuito (prezzo concordato del corso), quota_venditore, acconto_totale, acconto_pagato (bool), acconto_pagato_il, precorso_totale, precorso_pagato, precorso_pagato_il, saldo_totale, saldo_incassato_il, tipo_offerta, pacchetto_kit, richiede_modelle, numero_modelle, vecchia_iscrizione.`,
  },
  {
    vista: "analisi_incassi",
    titolo: "Incassi",
    permessi: ["erp", "statistiche"],
    catalogo: `analisi_incassi — tutti i soldi entrati, una riga per incasso: fonte ('vendita prodotti','acconto corso','quota pre corso','saldo corso'), data, canale, metodo, importo, chi (operatore o venditore), corso, citta, evento.
  REGOLA: «ricavi» o «incassi» di un periodo = sum(importo) qui, filtrando per data.`,
  },
  {
    vista: "analisi_spese",
    titolo: "Spese",
    permessi: ["erp", "statistiche"],
    catalogo: `analisi_spese — una riga per spesa: id, data, anno, mese, categoria, sottocategoria, fornitore, descrizione, imponibile, iva_percentuale, totale, stato ('pagata','fatturata'), metodo_pagamento, tipo_ambito, corso, citta, evento, fisso_variabile, ricorrente_occasionale, riducibilita ('alta','media','bassa' o null), essenzialita, controllabilita, natura, includi_analisi_costi (bool).
  REGOLA: per «quali spese si possono tagliare» guardare riducibilita, essenzialita, fisso_variabile e i totali per categoria/fornitore.`,
  },
  {
    vista: "analisi_edizioni",
    titolo: "Conti delle classi",
    // chi gestisce i corsi vede pattuito e costi nella scheda della
    // classe: qui non c'e' niente di nuovo per lui
    permessi: ["erp", "statistiche", "gestionedate"],
    catalogo: `analisi_edizioni — una riga per classe (corso + citta' + data), con i soldi: id, corso, citta, data_inizio, data_fine, master, posti_max, iscritti (numero), pattuito (somma dei prezzi concordati), costi_scheda (costi scritti sulla scheda della classe: accademia, master, assistenti, pranzi, hotel, imprevisti, coordinatore).
  Per il calendario (posti liberi, assistenti, sede) usare analisi_calendario, che e' piu' completa e non ha i soldi.`,
  },
  {
    vista: "analisi_copertura",
    titolo: "Da quando ci sono i dati",
    // non contiene nessun importo e nessun nome: solo fonti, due date e
    // un conteggio. La vede chiunque sia entrato, perche' serve a
    // chiunque faccia una domanda su un periodo
    permessi: [],
    catalogo: `analisi_copertura — da quando esistono i dati, fonte per fonte. Misurata sul dato stesso a ogni lettura, non scritta a mano.
  colonne: fonte, viste (quali viste copre), dal, al, righe.
  A COSA SERVE: le fonti NON cominciano insieme, e la differenza e' di anni. Prima di rispondere su un periodo si guarda qui se quel periodo esiste per la fonte che serve. Le date di questa vista sono anche nel riquadro «DA QUANDO CI SONO I DATI» qui sotto: quello basta nella maggior parte dei casi, e questa vista si interroga quando serve il dettaglio o qualcuno chiede esplicitamente da quando ci sono i dati.`,
  },
];

export const VISTE_ANALISI = AREE_DATI.map((a) => a.vista);

// il catalogo di un elenco di viste: solo quelle, nell'ordine di AREE_DATI
//
// `copertura` sono le righe di analisi_copertura, lette dal database
// dalla edge function. Quando ci sono, il catalogo finisce col riquadro
// che dice da quando esiste ogni fonte e con la regola di dichiarare il
// periodo. Quando non ci sono (il database non ha risposto) il catalogo
// resta quello di prima: meglio una risposta senza l'avvertenza che
// nessuna risposta.
/** @param {string[]} viste @param {{fonte:string,dal:string,al:string,righe:number}[]|null} [copertura] @returns {string} */
export function catalogoPer(viste, copertura = null) {
  const dentro = new Set(viste || []);
  const pezzi = AREE_DATI.filter((a) => dentro.has(a.vista)).map((a) => a.catalogo);
  if (!pezzi.length) return "";
  const coda = bloccoCopertura(copertura);
  return `${PREAMBOLO}\n\n${pezzi.join("\n\n")}${coda ? `\n\n${coda}` : ""}`;
}

/**
 * IL RIQUADRO CHE OBBLIGA A DICHIARARE IL PERIODO (4/11/2026).
 *
 * Nasce da una risposta vera: «quanti pigmenti da luglio?» -> «900 e
 * passa». Il conto era giusto ma era quello di gennaio-novembre, e il
 * periodo non era detto da nessuna parte. Una cifra plausibile col
 * periodo sbagliato non la mette in dubbio nessuno: per questo
 * dichiarare il periodo non e' una cortesia, e' parte della risposta.
 *
 * Le date non si scrivono qui: arrivano misurate da analisi_copertura,
 * cosi' il giorno che si importa lo storico del banco il riquadro cambia
 * da se'.
 *
 * @param {{fonte:string,dal:string,al:string,righe:number}[]|null} righe
 * @returns {string}
 */
export function bloccoCopertura(righe) {
  const utili = (righe || []).filter((r) => r && r.fonte && r.dal);
  if (!utili.length) return "";
  const elenco = utili
    .map((r) => `  - ${r.fonte}: dal ${r.dal} al ${r.al}${r.righe != null ? ` (${r.righe} righe)` : ""}`)
    .join("\n");
  return `DA QUANDO CI SONO I DATI (misurato adesso, non a memoria):
${elenco}

REGOLE SUL PERIODO, e sono obbligatorie:
  1. DICHIARA SEMPRE il periodo su cui hai contato, con le date, anche quando nessuno te l'ha chiesto: «dal 1 luglio al 4 novembre». Una cifra senza il suo periodo e' una cifra che non si puo' controllare.
  2. SE IL PERIODO CHIESTO COMINCIA PRIMA dei dati di quella fonte, dillo e di' da quando hai potuto contare. Esempio: «da gennaio» sulle vendite al banco non esiste — il banco comincia dalla data qui sopra.
  3. NON CONFRONTARE due periodi se la fonte non copre entrambi allo stesso modo: lo shop online ha anni che il banco non ha, e un confronto fra un canale e sette sembra un calo o una crescita e non lo e'.
  4. DI' COSA RESTA FUORI quando conta: i pigmenti dati dentro ai kit dei corsi non sono una vendita e non stanno nelle vendite; una domanda su «quanti ne sono usciti» e una su «quanti ne abbiamo venduti» hanno due risposte diverse, e va detto quale si sta dando.`;
}

// il catalogo intero: lo usa «Chiedi ai dati», che e' per chi amministra
export const CATALOGO_ANALISI = catalogoPer(VISTE_ANALISI);

/**
 * Le viste che spettano a chi ha fatto accesso.
 *
 * @param {{ ruolo?: string, permessi?: string[] }} [chi]
 * @returns {string[]}
 *
 * `ruolo` e `permessi` arrivano dalla pagina, che e' l'unica a saperli
 * finche' l'account Supabase e' uno per tutti. Chi amministra vede tutto;
 * gli altri vedono le aree che si aprono con uno dei loro permessi, piu'
 * quelle aperte a chiunque sia entrato (`permessi: []`).
 */
export function vistePermesse({ ruolo = "tutti", permessi = [] } = {}) {
  const miei = new Set((permessi || []).map(String));
  const amministra = ruolo === "amministrazione";
  return AREE_DATI
    .filter((a) => amministra || a.permessi.length === 0 || a.permessi.some((p) => miei.has(p)))
    .map((a) => a.vista);
}

const VIETATE = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|pg_sleep|pg_catalog|pg_class|pg_roles|information_schema|set|reset|lock|vacuum|analyze|listen|notify)\b/i;

// Torna { ok, sql } oppure { ok: false, errore } — l'errore e' scritto per
// il modello, che lo legge e riprova. Con `viste` si controlla anche che
// nomini solo le aree che spettano a chi ha chiesto: il rifiuto buono e'
// quello del database, ma detto qui il modello puo' ripiegare su un'area
// che ha, invece di tornare indietro a mani vuote.
/**
 * @param {string} testo
 * @param {string[] | null} [viste]
 * @returns {{ ok: boolean, sql?: string, errore?: string }}
 */
export function controllaSql(testo, viste = null) {
  let sql = String(testo || "").trim();
  // il modello a volte incarta in ```sql ... ```
  sql = sql.replace(/^```(?:sql)?\s*/i, "").replace(/\s*```$/, "").trim();
  sql = sql.replace(/;\s*$/, "").trim();
  if (!sql) return { ok: false, errore: "SQL vuoto." };
  if (!/^(select|with)\b/i.test(sql)) return { ok: false, errore: "Si accetta solo una SELECT (o WITH ... SELECT)." };
  if (sql.includes(";")) return { ok: false, errore: "Una sola istruzione, senza punto e virgola." };
  if (VIETATE.test(sql)) return { ok: false, errore: "Istruzione non consentita: solo lettura." };
  if (!/\banalisi_/i.test(sql)) return { ok: false, errore: "Si interrogano solo le viste analisi_* elencate nel catalogo." };
  // una tabella base nominata di fianco alle viste: il database la
  // rifiuterebbe comunque, ma qui si spiega
  // i nomi delle CTE (with mesi as (...)) sono tabelle legittime
  const cte = new Set([...sql.matchAll(/\b([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map((m) => m[1].toLowerCase()));
  const nominate = [...sql.matchAll(/\b(?:from|join)\s+(?:public\.)?([a-z_][a-z0-9_]*)\b/gi)]
    .map((m) => m[1].toLowerCase())
    .filter((n) => !cte.has(n) && !["lateral", "unnest", "generate_series", "jsonb_array_elements", "jsonb_each"].includes(n));
  const sospette = nominate.filter((n) => !n.startsWith("analisi_"));
  if (sospette.length) return { ok: false, errore: `Non esiste «${sospette[0]}»: usare solo le viste analisi_*.` };
  if (Array.isArray(viste) && viste.length) {
    const fuori = nominate.find((n) => !viste.includes(n));
    if (fuori) return { ok: false, errore: `«${fuori}» non è fra le aree che questa persona può vedere. Puoi usare solo: ${viste.join(", ")}.` };
  }
  return { ok: true, sql };
}

// il modello risponde con un JSON {sql, nota} o {risposta}: si estrae in
// modo tollerante (a volte c'e' testo intorno)
export function estraiJson(testo) {
  const t = String(testo || "");
  const a = t.indexOf("{"); const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

/**
 * Le righe di analisi_copertura, lette col client di servizio.
 *
 * Non fa mai fallire la risposta: se il database non risponde torna
 * `null` e il catalogo resta quello di prima. Un assistente che non
 * risponde perche' non ha saputo leggere un'avvertenza sarebbe peggio di
 * un assistente che risponde senza l'avvertenza.
 *
 * @param {any} admin client Supabase con la service role
 * @returns {Promise<{fonte:string,viste:string,dal:string,al:string,righe:number}[]|null>}
 */
export async function leggiCopertura(admin) {
  try {
    const { data, error } = await admin.from("analisi_copertura").select("fonte, viste, dal, al, righe");
    if (error || !Array.isArray(data)) return null;
    // ordinate per data d'inizio: si legge subito quale fonte e' la piu'
    // giovane, che e' quella che limita ogni confronto
    return [...data].sort((a, b) => String(a?.dal || "").localeCompare(String(b?.dal || "")));
  } catch {
    return null;
  }
}
