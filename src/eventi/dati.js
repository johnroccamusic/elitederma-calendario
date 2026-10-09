// Le letture e le scritture della gestione eventi, tutte qui.
//
// Un evento non e' un corso: non ha iscritti, quote, kit da consegnare
// ne' una busta da chiudere. Vive nella sua tabella, e queste funzioni
// sono l'unico punto da cui si tocca.
import { supabase } from "../supabase.js";
import { muoviStock } from "../magazzino/stock.js";

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
//   - quelli che un ALTRO evento ancora da partire ha messo in elenco e
//     non ha ancora scaricato.
//
// I pezzi in attesa di spedizione NON entrano in questo conto. Una
// vendita al banco scarica il magazzino nell'istante in cui si incassa,
// spedizione o no: dalla giacenza sono gia' usciti, e toglierli di nuovo
// qui li conterebbe due volte.
export async function impegniMagazzino() {
  const [sospesi, materiali, eventi] = await Promise.all([
    supabase.from("impostazioni_layout_tabelle").select("valore").eq("chiave", "pos_carrelliSospesi").maybeSingle(),
    supabase.from("eventi_materiali").select("evento_id, prodotto_id, quantita, quantita_scaricata").not("prodotto_id", "is", null),
    supabase.from("eventi").select("id, stato"),
  ]);

  const carrelli = {};
  const lista = Array.isArray(sospesi.data?.valore) ? sospesi.data.valore : [];
  lista.forEach((c) => (c?.carrello || []).forEach((r) => {
    const q = Number(r?.quantita) || 0;
    if (r?.prodottoId && q > 0) carrelli[r.prodottoId] = (carrelli[r.prodottoId] || 0) + q;
  }));

  // un evento annullato non impegna niente, e uno concluso ha gia' chiuso
  // il suo giro col magazzino: impegnano solo quelli ancora in programma
  const vivi = new Set((eventi.data || []).filter((e) => e.stato === "programmato").map((e) => e.id));
  const perEvento = {};
  (materiali.data || []).forEach((r) => {
    if (!vivi.has(r.evento_id)) return;
    const resta = Math.max(0, (Number(r.quantita) || 0) - (Number(r.quantita_scaricata) || 0));
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
// Il delta e' SEMPRE la differenza fra quello che si e' deciso e quello
// che e' gia' uscito (o gia' rientrato), mai il numero scritto nella
// casella. Cosi' premere due volte lo stesso tasto non scarica due
// volte, e correggere una quantita' dopo che il pacco e' partito muove
// soltanto la differenza. E' la stessa lezione dei kit: applicare una
// differenza fidandosi della memoria della scheda produce doppi
// scarichi — qui la memoria sta scritta in colonna.

// "Partito": quello che era da portare diventa partito, ed esce dal
// magazzino. Le righe che hanno gia' un numero scritto a mano nella
// colonna "Partito" lo tengono — si allinea solo il magazzino a quel
// numero, non si sovrascrive una correzione di chi c'era.
export async function segnaPartito({ righe, prodottiPerId, utente = null, nomeEvento = "", onAvanzamento }) {
  const errori = [];
  let mosse = 0;
  let fatte = 0;
  // una riga alla volta, mai in parallelo: muoviStock rilegge la
  // giacenza vera prima di applicare il delta, e due scarichi dello
  // stesso prodotto lanciati insieme leggerebbero lo stesso numero.
  // Con ottanta righe il giro dura, per questo si dice a che punto e'
  for (const r of righe || []) {
    const obiettivo = r.quantita_portata == null ? (Number(r.quantita) || 0) : (Number(r.quantita_portata) || 0);
    const gia = Number(r.quantita_scaricata) || 0;
    const delta = obiettivo - gia;
    const p = r.prodotto_id ? prodottiPerId.get(r.prodotto_id) : null;
    const scarica = tieneGiacenza(p);
    if (scarica && delta !== 0) {
      // delta positivo = altri pezzi escono; negativo = una correzione
      // in meno, e quei pezzi tornano sullo scaffale
      const errore = await muoviStock(p, -delta, {
        origine: "evento_partenza",
        nota: `Materiale partito per ${nomeEvento || "un evento"}`,
        riferimento: r.evento_id, utente,
      });
      if (errore) { errori.push(errore); onAvanzamento?.(++fatte, (righe || []).length); continue; }
      mosse += 1;
    }
    // se non e' cambiato niente non si riscrive: premere "Partito" una
    // seconda volta non deve spostare la data in cui il pacco e' uscito
    const comera = r.quantita_portata == null ? null : Number(r.quantita_portata);
    if (comera !== obiettivo || delta !== 0) {
      const campi = { quantita_portata: obiettivo };
      if (scarica) { campi.quantita_scaricata = obiettivo; campi.scaricato_il = new Date().toISOString(); }
      await salvaRiga("eventi_materiali", r.id, campi);
    }
    onAvanzamento?.(++fatte, (righe || []).length);
  }
  return { mosse, errori };
}

// "Rimetti in magazzino": quello scritto nella colonna "Rientrato"
// torna nelle giacenze. Non si rimette dentro piu' di quanto e' uscito:
// se il numero e' piu' alto, o e' un errore di battitura o sono pezzi
// che non erano partiti da qui, e in tutti e due i casi non si inventa
// magazzino.
export async function segnaRientro({ righe, prodottiPerId, utente = null, nomeEvento = "", onAvanzamento }) {
  const errori = [];
  let mosse = 0;
  const daMuovere = (righe || []).filter((r) => r.quantita_rientrata != null
    && (Number(r.quantita_rientrata) || 0) !== (Number(r.quantita_ricaricata) || 0)).length;
  for (const r of righe || []) {
    if (r.quantita_rientrata == null) continue;
    const p = r.prodotto_id ? prodottiPerId.get(r.prodotto_id) : null;
    if (!tieneGiacenza(p)) continue;
    const rientrata = Number(r.quantita_rientrata) || 0;
    const uscita = Number(r.quantita_scaricata) || 0;
    if (rientrata > uscita) {
      errori.push(`"${p.nome}": rientrati ${rientrata} pz ma ne erano usciti ${uscita}. Correggi il numero prima di rimetterli dentro.`);
      continue;
    }
    const delta = rientrata - (Number(r.quantita_ricaricata) || 0);
    if (delta === 0) continue;
    const errore = await muoviStock(p, delta, {
      origine: "evento_rientro",
      nota: `Materiale rientrato da ${nomeEvento || "un evento"}`,
      riferimento: r.evento_id, utente,
    });
    if (errore) { errori.push(errore); continue; }
    mosse += 1;
    await salvaRiga("eventi_materiali", r.id, { quantita_ricaricata: rientrata, ricaricato_il: new Date().toISOString() });
    onAvanzamento?.(mosse, daMuovere);
  }
  return { mosse, errori };
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
