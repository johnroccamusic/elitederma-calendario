// Le letture e le scritture della gestione eventi, tutte qui.
//
// Un evento non e' un corso: non ha iscritti, quote, kit da consegnare
// ne' una busta da chiudere. Vive nella sua tabella, e queste funzioni
// sono l'unico punto da cui si tocca.
import { supabase } from "../supabase.js";

export const STATI_EVENTO = [
  { v: "programmato", l: "Programmato" },
  { v: "concluso", l: "Concluso" },
  { v: "annullato", l: "Annullato" },
];

export async function leggiEventi() {
  const { data, error } = await supabase.from("eventi").select("*").order("data_inizio", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function creaEvento(campi) {
  const { data, error } = await supabase.from("eventi").insert(campi).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function salvaEvento(id, campi) {
  const { error } = await supabase.from("eventi")
    .update({ ...campi, aggiornato_il: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminaEvento(id) {
  // le righe figlie se ne vanno da sole (on delete cascade)
  const { error } = await supabase.from("eventi").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- le quattro liste attaccate a un evento -------------------------------

export async function leggiRighe(tabella, eventoId, ordinaPer = "ordine") {
  const { data, error } = await supabase.from(tabella).select("*").eq("evento_id", eventoId).order(ordinaPer);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function aggiungiRiga(tabella, campi) {
  const { data, error } = await supabase.from(tabella).insert(campi).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function salvaRiga(tabella, id, campi) {
  const { error } = await supabase.from(tabella).update(campi).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminaRiga(tabella, id) {
  const { error } = await supabase.from(tabella).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- hotel: gruppi e stanze ------------------------------------------------

export async function leggiHotelEvento(eventoId) {
  const { data: gruppi, error } = await supabase.from("eventi_hotel_gruppi")
    .select("*").eq("evento_id", eventoId).order("ordine");
  if (error) throw new Error(error.message);
  const ids = (gruppi || []).map((g) => g.id);
  if (ids.length === 0) return { gruppi: [], stanze: [] };
  const { data: stanze, error: e2 } = await supabase.from("eventi_hotel_stanze")
    .select("*").in("gruppo_id", ids).order("ordine");
  if (e2) throw new Error(e2.message);
  return { gruppi: gruppi || [], stanze: stanze || [] };
}

// --- come si legge una data --------------------------------------------------

export function periodoEvento(evento) {
  const da = evento?.data_inizio;
  const a = evento?.data_fine || evento?.data_inizio;
  if (!da) return "data da definire";
  const f = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  if (!a || a === da) return f(da);
  // stesso mese: "3–6 ottobre 2026", altrimenti le due date per esteso
  const [ay, am] = da.split("-"); const [by, bm] = a.split("-");
  if (ay === by && am === bm) {
    const giorno = (d) => Number(d.split("-")[2]);
    const mese = new Date(`${a}T12:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    return `${giorno(da)}–${giorno(a)} ${mese}`;
  }
  return `${f(da)} → ${f(a)}`;
}

export function quantiGiorni(evento) {
  if (!evento?.data_inizio) return 0;
  const a = new Date(`${evento.data_inizio}T12:00:00`);
  const b = new Date(`${evento.data_fine || evento.data_inizio}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

// Quanto di quel materiale e' stato venduto al POS all'evento.
//
// Serve a chiudere il conto della consegna: quello che e' partito meno
// quello che e' tornato deve fare quello che si e' venduto. Se non
// torna, o manca qualcosa o qualcuno ha dimenticato di segnarlo.
// Quello che e' USCITO dalla scatola dell'evento: venduto e omaggiato,
// separati. Un pezzo regalato non porta ricavo ma non e' nemmeno
// tornato a casa: contarlo solo nel venduto faceva risultare "mancante"
// tutto cio' che si regala in fiera, che e' esattamente quello che in
// fiera si fa. Il conto della consegna deve pareggiare sulla SOMMA.
export async function usciteAllEvento(eventoId) {
  const { data, error } = await supabase
    .from("vendite_shop").select("prodotti, tipo_movimento")
    .eq("evento_id", eventoId);
  if (error) throw new Error(error.message);
  const venduto = {}, omaggiato = {};
  (data || []).forEach((v) => {
    const dove = v.tipo_movimento === "omaggio" ? omaggiato : venduto;
    (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((r) => {
      if (!r.prodotto_id) return;
      dove[r.prodotto_id] = (dove[r.prodotto_id] || 0) + (Number(r.quantita) || 0);
    });
  });
  return { venduto, omaggiato };
}

// --- il magazzino visto da un evento ---------------------------------------

// Quanti pezzi sono gia' impegnati altrove, e quindi non si possono
// promettere a questo evento:
//   - quelli dentro un carrello sospeso del POS. La giacenza li ha
//     ancora (sono in scatola), ma sono di qualcuno: il banco non li
//     rivende e il sito non li dichiara;
//   - quelli che un ALTRO evento in programma ha messo in elenco. Il
//     materiale di una fiera non esce dal magazzino (vedi sotto): e'
//     impegnato finche' l'evento e' in programma, poi torna libero.
//
// I pezzi in attesa di spedizione NON entrano in questo conto. Una
// vendita al banco scarica il magazzino nell'istante in cui si incassa,
// spedizione o no: dalla giacenza sono gia' usciti, e toglierli di nuovo
// qui li conterebbe due volte.
export async function impegniMagazzino() {
  const [sospesi, materiali, eventi] = await Promise.all([
    supabase.from("impostazioni_layout_tabelle").select("valore").eq("chiave", "pos_carrelliSospesi").maybeSingle(),
    supabase.from("eventi_materiali").select("evento_id, prodotto_id, quantita, quantita_scaricata, quantita_ricaricata").not("prodotto_id", "is", null),
    supabase.from("eventi").select("id, stato"),
  ]);

  const carrelli = {};
  const lista = Array.isArray(sospesi.data?.valore) ? sospesi.data.valore : [];
  lista.forEach((c) => (c?.carrello || []).forEach((r) => {
    const q = Number(r?.quantita) || 0;
    if (r?.prodottoId && q > 0) carrelli[r.prodottoId] = (carrelli[r.prodottoId] || 0) + q;
  }));

  // un evento annullato non impegna niente, e uno concluso ha il suo
  // materiale di nuovo sullo scaffale: impegnano solo quelli in programma.
  // Quello che per la regola vecchia fosse ancora fuori dalle giacenze
  // (scaricato e non ricaricato) non si impegna di nuovo: non c'e' gia'
  const vivi = new Set((eventi.data || []).filter((e) => e.stato === "programmato").map((e) => e.id));
  const perEvento = {};
  (materiali.data || []).forEach((r) => {
    if (!vivi.has(r.evento_id)) return;
    const ancoraFuori = Math.max(0, (Number(r.quantita_scaricata) || 0) - (Number(r.quantita_ricaricata) || 0));
    const resta = Math.max(0, (Number(r.quantita) || 0) - ancoraFuori);
    if (resta <= 0) return;
    const dentro = (perEvento[r.evento_id] = perEvento[r.evento_id] || {});
    dentro[r.prodotto_id] = (dentro[r.prodotto_id] || 0) + resta;
  });

  return { carrelli, perEvento };
}

// Un prodotto che una giacenza propria ce l'ha davvero: un bundle
// virtuale non ne ha (si scarica dai suoi pezzi) e una voce libera —
// roll-up, brochure — non e' nemmeno a catalogo.
export function tieneGiacenza(p) {
  return !!p && p.giacenza_propria !== false && p.conta_magazzino !== false;
}

// --- quando il materiale parte, e quando torna ------------------------------
//
// Il materiale di una fiera NON esce dal magazzino (regola del titolare,
// 30/10/2026): e' come se una parte del magazzino si spostasse
// all'evento. Resta in giacenza, resta impegnato finche' l'evento e' in
// programma — cosi' nessun altro lo promette — e scende SOLO quando si
// vende, col POS, sul posto: e' la vendita che scarica, come sempre.
//
// Dal 08/10 al 30/10/2026 la regola era l'opposta ("Partito" scaricava,
// "Rimetti in magazzino" ricaricava): quantita_scaricata e
// quantita_ricaricata restano come storico di quel periodo e non si
// scrivono piu'. Il giorno del cambio nessuna riga le aveva diverse da
// zero, quindi non c'era niente da rimettere in pari.

// "Partito": quello che era da portare diventa partito. E' contabilita'
// della scatola — serve al conto del rientro — e non tocca le giacenze.
// Le righe che hanno gia' un numero scritto a mano in "Partito" lo
// tengono: non si sovrascrive una correzione di chi c'era.
export async function segnaPartito({ righe, onAvanzamento }) {
  let segnate = 0;
  let fatte = 0;
  for (const r of righe || []) {
    const obiettivo = r.quantita_portata == null ? (Number(r.quantita) || 0) : (Number(r.quantita_portata) || 0);
    const comera = r.quantita_portata == null ? null : Number(r.quantita_portata);
    if (comera !== obiettivo) {
      await salvaRiga("eventi_materiali", r.id, { quantita_portata: obiettivo });
      segnate += 1;
    }
    onAvanzamento?.(++fatte, (righe || []).length);
  }
  return { segnate };
}

// Quanti pezzi devono tornare: partiti meno quelli usciti dalla scatola
// al POS, venduti e omaggiati — un pezzo regalato non porta ricavo ma
// non e' nemmeno tornato a casa. Se "Partito" non e' stato segnato vale
// quello che era da portare, che e' il meglio che si sa.
export function rientroAtteso(riga, uscite) {
  const portata = riga.quantita_portata == null ? (Number(riga.quantita) || 0) : (Number(riga.quantita_portata) || 0);
  const venduti = riga.prodotto_id ? (Number(uscite?.venduto?.[riga.prodotto_id]) || 0) : 0;
  const omaggiati = riga.prodotto_id ? (Number(uscite?.omaggiato?.[riga.prodotto_id]) || 0) : 0;
  const usciti = venduti + omaggiati;
  return {
    portata, venduti, omaggiati, usciti,
    attesi: Math.max(0, Math.round((portata - usciti) * 100) / 100),
    // il POS ne ha registrati piu' di quanti ne risultino partiti: o
    // "Partito" e' scritto basso, o si e' venduto roba non in elenco
    inEccesso: Math.max(0, Math.round((usciti - portata) * 100) / 100),
  };
}

// La spunta del rientro: chi scarica lo scatolone conta i pezzi e
// conferma che ne sono tornati quanti dovevano. E' una verifica sulle
// quantita', non un movimento — il magazzino non si muove.
export async function segnaRientroVerificato(rigaId, verificato) {
  await salvaRiga("eventi_materiali", rigaId, { rientro_verificato_il: verificato ? new Date().toISOString() : null });
}

// --- le categorie dei prodotti, per raggruppare l'elenco --------------------

// Un prodotto puo' stare in piu' categorie; per metterlo in UNA riga di
// elenco ne serve una sola, e dev'essere la CATEGORIA MADRE.
//
// I colori stanno nelle loro sottocategorie — Corrective, Eyebrows,
// Lips, Eyeliner, Trico, Kit pigmenti — che sono tutte figlie di "TUTTI
// I PIGMENTI". Raggruppando per la piu' specifica finivano sparsi in sei
// gruppi da quattro righe l'uno invece di stare insieme, che e' il modo
// in cui si prepara uno scatolone: i pigmenti con i pigmenti. Stesso
// discorso per Aghi Universali sotto Aghi e per le quattro figlie di
// Lash Extension.
//
// Si risale fino alla radice. Quando un prodotto ha due radici diverse
// si sceglie la prima per `ordine` e poi per nome: una regola qualunque
// va bene purche' sia sempre la stessa, o lo stesso prodotto salterebbe
// di gruppo a ogni apertura.
export async function leggiCategoriePrincipali() {
  const [cat, coll] = await Promise.all([
    supabase.from("categorie_prodotti").select("id, nome, ordine, categoria_padre_id"),
    supabase.from("prodotti_categorie").select("prodotto_id, categoria_id"),
  ]);
  const categorie = cat.data || [];
  const perId = new Map(categorie.map((c) => [c.id, c]));
  // la radice della catena. Il giro ha un tetto: una categoria che
  // finisse per essere padre di se' stessa bloccherebbe la pagina
  const radiceDi = (c) => {
    let cur = c;
    for (let i = 0; i < 10 && cur?.categoria_padre_id; i++) {
      const su = perId.get(cur.categoria_padre_id);
      if (!su || su.id === cur.id) break;
      cur = su;
    }
    return cur;
  };
  const peso = (c) => [c.ordine ?? 9999, String(c.nome || "")];
  const principale = {};
  (coll.data || []).forEach((r) => {
    const c = perId.get(r.categoria_id);
    if (!c) return;
    const radice = radiceDi(c);
    const gia = principale[r.prodotto_id];
    if (!gia) { principale[r.prodotto_id] = radice; return; }
    const a = peso(radice), b = peso(gia);
    if (a[0] !== b[0] ? a[0] < b[0] : a[1].localeCompare(b[1]) < 0) principale[r.prodotto_id] = radice;
  });
  return { categorie, principale };
}

// La prima foto di ogni prodotto, per metterla in testa alla riga come
// nei listini. Si prende quella con l'ordine piu' basso — la stessa che
// il magazzino mostra in miniatura — e se non ce n'e' nessuna resta il
// foto_url scritto sull'anagrafica.
export async function leggiImmaginiProdotti() {
  const { data } = await supabase.from("prodotti_immagini").select("prodotto_id, url, ordine");
  const per = {};
  [...(data || [])].sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
    .forEach((im) => { if (!per[im.prodotto_id]) per[im.prodotto_id] = im.url; });
  return per;
}

// --- i documenti organizzativi ---------------------------------------------
//
// Le certificazioni, il regolamento della fiera, le planimetrie, i
// permessi. Il secchio `eventi-documenti` e' PRIVATO: niente
// `getPublicUrl`, si chiede un link a scadenza che vale solo per chi ha
// una sessione. «Pubblico» e' un'impostazione del secchio — chi conosce
// l'indirizzo di un file lo scarica, policy o non policy — e qui dentro
// finiscono certificazioni aziendali e contratti di fiera.

export async function leggiDocumentiEvento(eventoId) {
  const { data, error } = await supabase.from("eventi_documenti")
    .select("*").eq("evento_id", eventoId)
    .order("ordine").order("caricato_il");
  if (error) throw new Error(error.message);
  return data || [];
}

// LA SCHEDA NASCE DAL TITOLO, il file arriva dopo. Come in Stampe
// packaging: si preme «Aggiungi documento», si scrive cos'e', e dentro
// la scheda si carica il file e si scrivono le note. Quindi una riga
// puo' esistere senza file, e un file si puo' sostituire.
export async function creaDocumentoEvento(eventoId, { chi = "" } = {}) {
  const quante = (await leggiDocumentiEvento(eventoId)).length;
  const { data, error } = await supabase.from("eventi_documenti").insert({
    evento_id: eventoId, nome: "", ordine: quante, caricato_da: chi || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function caricaFileDocumento(doc, file) {
  if (!file) throw new Error("Nessun file scelto.");
  // il nome del file non finisce nel percorso: ci finiscono caratteri di
  // ogni specie — spazi, accenti, parentesi — e un percorso storto si
  // scopre il giorno che il file non si riapre. Il nome vero sta nella
  // riga, che e' anche quello che si legge e si puo' correggere.
  const estensione = (file.name?.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
  const percorso = `${doc.evento_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${estensione ? "." + estensione : ""}`;
  const { error } = await supabase.storage.from("eventi-documenti")
    .upload(percorso, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(`Non riesco a caricare il file: ${error.message}`);
  const { data, error: erroreRiga } = await supabase.from("eventi_documenti").update({
    percorso, tipo: file.type || null, dimensione: file.size || null,
    nome_file: file.name || null,
    // un titolo vuoto prende il nome del file: meglio di «Documento senza nome»
    ...(doc.nome?.trim() ? {} : { nome: file.name || "Documento" }),
  }).eq("id", doc.id).select().single();
  if (erroreRiga) {
    // la riga non si e' aggiornata: il file caricato non lo ritroverebbe
    // nessuno, e resterebbe a occupare spazio senza che niente lo nomini
    await supabase.storage.from("eventi-documenti").remove([percorso]);
    throw new Error(`Caricato, ma non registrato: ${erroreRiga.message}`);
  }
  // il file di prima, se c'era, se ne va: e' stato sostituito
  if (doc.percorso && doc.percorso !== percorso) await supabase.storage.from("eventi-documenti").remove([doc.percorso]);
  return data;
}

// Il file si cancella INSIEME alla riga, e il file per primo: al
// contrario, se la seconda cancellazione fallisse resterebbe una riga
// che punta al vuoto — e aprendola si vedrebbe un errore invece di
// capire che il documento non c'e' piu'.
export async function eliminaDocumentoEvento(doc) {
  if (doc?.percorso) await supabase.storage.from("eventi-documenti").remove([doc.percorso]);
  const { error } = await supabase.from("eventi_documenti").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
}

export async function linkDocumentoEvento(percorso, secondi = 3600) {
  const { data, error } = await supabase.storage.from("eventi-documenti")
    .createSignedUrl(percorso, secondi);
  if (error) throw new Error(error.message);
  const indirizzo = data?.signedUrl || "";
  // NON BASTA CHE SIA UNA STRINGA. Il client costruisce il link
  // incollando la propria base a quello che gli torna: se la risposta
  // non ha la forma attesa esce «.../storage/v1undefined», che e' una
  // stringa piena e un indirizzo che non esiste. Aperta in una scheda
  // nuova da' una pagina di errore del browser, e sembra rotto il
  // documento invece della risposta. Trovato dal banco di prova.
  if (!indirizzo.includes("/object/sign/") || indirizzo.includes("undefined")) {
    throw new Error("il link firmato non è arrivato");
  }
  return indirizzo;
}

// --- il dettaglio delle vendite al banco -----------------------------------

export async function leggiVenditeEvento(eventoId) {
  const { data, error } = await supabase.from("vendite_shop")
    .select("id, numero_ordine, data_ordine, totale, totale_imponibile, metodo_pagamento, tipo_movimento, operatore_nome, cliente_nome, prodotti")
    .eq("evento_id", eventoId)
    .order("data_ordine");
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Cosa si è venduto, prodotto per prodotto.
 *
 * SI RAGGRUPPA PER `prodotto_id`, MAI PER NOME. Il nome sulla riga è
 * quello che il prodotto aveva il giorno della vendita: se nel frattempo
 * è stato rinominato, raggruppare per nome spezza la sua storia in due
 * righe che sembrano due prodotti. Il nome da mostrare si rilegge
 * dall'anagrafica di adesso, e quello della riga resta solo come
 * ripiego per i pezzi venduti a mano, che un id non ce l'hanno.
 *
 * GLI OMAGGI NON SONO INCASSO, ma sono pezzi usciti dalla scatola: si
 * contano a parte, in una colonna loro. In fiera si regala, e un
 * regalato contato come venduto gonfia il ricavo; non contato affatto fa
 * sparire materiale che non è tornato a casa.
 */
export function prodottiPiuVenduti(vendite, prodottiPerId = {}) {
  const per = new Map();
  (vendite || []).forEach((v) => {
    const omaggio = v.tipo_movimento === "omaggio";
    (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((r) => {
      const chiave = r.prodotto_id || `nome:${(r.nome || "").trim().toLowerCase()}`;
      if (!chiave || chiave === "nome:") return;
      if (!per.has(chiave)) {
        per.set(chiave, {
          chiave,
          prodottoId: r.prodotto_id || null,
          // il nome di adesso se il prodotto esiste ancora, quello
          // scritto sulla riga se è stato cancellato o venduto a mano
          nome: prodottiPerId[r.prodotto_id]?.nome || r.nome || "— senza nome —",
          pezzi: 0, omaggiati: 0, incasso: 0, vendite: 0,
        });
      }
      const voce = per.get(chiave);
      const quanti = Number(r.quantita) || 0;
      if (omaggio) voce.omaggiati += quanti;
      else {
        voce.pezzi += quanti;
        voce.incasso += Number(r.totale_riga) || 0;
        voce.vendite += 1;
      }
    });
  });
  return [...per.values()]
    .map((v) => ({ ...v, incasso: Math.round(v.incasso * 100) / 100 }))
    // per pezzi, e a parità per incasso: due righe da 10 pezzi si
    // distinguono da quale ha portato più soldi
    .sort((a, b) => (b.pezzi - a.pezzi) || (b.incasso - a.incasso) || a.nome.localeCompare(b.nome));
}

/**
 * I totali della fiera. In euro incassati, non in imponibile: qui la
 * domanda è «quanto è entrato nella cassa», non «quanto vale a
 * bilancio» — di quello si occupa il Conto.
 */
export function totaliVendite(vendite) {
  let incassato = 0, quante = 0, omaggi = 0, pezzi = 0, pezziOmaggio = 0;
  const perMetodo = new Map();
  (vendite || []).forEach((v) => {
    const righe = Array.isArray(v.prodotti) ? v.prodotti : [];
    const quanti = righe.reduce((s, r) => s + (Number(r.quantita) || 0), 0);
    if (v.tipo_movimento === "omaggio") { omaggi += 1; pezziOmaggio += quanti; return; }
    quante += 1;
    pezzi += quanti;
    incassato += Number(v.totale) || 0;
    const m = v.metodo_pagamento || "—";
    perMetodo.set(m, Math.round(((perMetodo.get(m) || 0) + (Number(v.totale) || 0)) * 100) / 100);
  });
  return {
    quante, omaggi, pezzi, pezziOmaggio,
    incassato: Math.round(incassato * 100) / 100,
    // lo scontrino medio: su una fiera dice più del totale, perché
    // distingue «tanta gente che compra poco» da «pochi che comprano»
    medio: quante ? Math.round((incassato / quante) * 100) / 100 : 0,
    perMetodo: [...perMetodo.entries()].sort((a, b) => b[1] - a[1]),
  };
}
