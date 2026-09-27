// Il conto di un evento: cosa è entrato, cosa è uscito, cosa resta.
//
// Un evento non ha iscritti, quote, acconti, commissioni master né una
// busta da chiudere: il Riepilogo amministrativo di un corso sono 1595
// righe e quasi tutte parlano di quelle cose. Riusarlo qui avrebbe
// voluto dire passargli finti iscritti e spegnere venti sezioni. Quello
// che si riusa davvero è lo strato sotto — la regola con cui le spese si
// imputano a un ambito — ed è copiata alla lettera da calcolaTotaleSpese
// in App.jsx: se una spesa ha attribuzioni valgono quelle, altrimenti
// vale il suo imponibile.
//
// Si ragiona in IMPONIBILE, non in totale: l'IVA sugli acquisti si
// recupera e non è un costo, quella sulle vendite non è un ricavo. È la
// stessa scelta del resto dell'app.
import { supabase } from "../supabase.js";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Quello che è USCITO dal materiale dell'evento: venduto più omaggiato.
//
// Un pezzo regalato è uscito dalla scatola come uno venduto — non porta
// ricavo, ma non è nemmeno tornato a casa. Contarlo solo nel venduto
// faceva risultare "mancante" tutto ciò che si regala in fiera, che è
// esattamente quello che in fiera si fa.
export function movimentiDaVendite(vendite) {
  const venduto = {}, omaggiato = {};
  (vendite || []).forEach((v) => {
    const dove = v.tipo_movimento === "omaggio" ? omaggiato : venduto;
    (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((r) => {
      if (!r.prodotto_id) return;
      dove[r.prodotto_id] = (dove[r.prodotto_id] || 0) + (Number(r.quantita) || 0);
    });
  });
  return { venduto, omaggiato };
}

// Il costo di un pezzo. Per un bundle sta nella distinta, mai sulla sua
// riga; e se un solo componente non ha costo la somma sarebbe più bassa
// del vero, quindi non si somma affatto — stessa regola del listino.
export function costoDi(prodotto, prodottiPerId, componentiPerBundle) {
  if (!prodotto) return null;
  if ((prodotto.tipo_prodotto || "semplice") !== "bundle") {
    const c = Number(prodotto.costo_acquisto);
    return c > 0 ? c : null;
  }
  const righe = componentiPerBundle[prodotto.id];
  if (!righe || !righe.length) return null;
  let somma = 0;
  for (const riga of righe) {
    const comp = prodottiPerId[riga.componente_id];
    const c = comp ? Number(comp.costo_acquisto) : 0;
    if (!(c > 0)) return null;
    somma += c * (Number(riga.quantita_per_bundle) || 0);
  }
  return somma > 0 ? r2(somma) : null;
}

export async function leggiConto(eventoId) {
  const [vendite, spese, attribuzioni, trasferimenti, gruppi, materiali] = await Promise.all([
    supabase.from("vendite_shop")
      .select("id, numero_ordine, data_ordine, totale, totale_imponibile, totale_iva, metodo_pagamento, tipo_movimento, prodotti")
      .eq("evento_id", eventoId).then(({ data, error }) => { if (error) throw new Error(error.message); return data || []; }),
    supabase.from("spese").select("*").eq("evento_id", eventoId)
      .then(({ data, error }) => { if (error) throw new Error(error.message); return data || []; }),
    supabase.from("spese_attribuzioni").select("*").eq("evento_id", eventoId)
      .then(({ data, error }) => { if (error) throw new Error(error.message); return data || []; }),
    supabase.from("eventi_trasferimenti").select("id, tipo, descrizione, chi, costo").eq("evento_id", eventoId)
      .then(({ data, error }) => { if (error) throw new Error(error.message); return data || []; }),
    supabase.from("eventi_hotel_gruppi").select("id, nome, hotel_nome").eq("evento_id", eventoId)
      .then(({ data, error }) => { if (error) throw new Error(error.message); return data || []; }),
    supabase.from("eventi_materiali").select("*").eq("evento_id", eventoId).order("ordine")
      .then(({ data, error }) => { if (error) throw new Error(error.message); return data || []; }),
  ]);
  // le stanze stanno sotto i gruppi, non sotto l'evento: senza gruppi
  // non c'è niente da chiedere, e una `in` con lista vuota è un errore
  const stanze = gruppi.length
    ? await supabase.from("eventi_hotel_stanze").select("id, gruppo_id, nome, tipo, costo")
        .in("gruppo_id", gruppi.map((g) => g.id))
        .then(({ data, error }) => { if (error) throw new Error(error.message); return data || []; })
    : [];
  // le spese ripartite su più ambiti NON hanno evento_id sulla loro riga:
  // l'evento sta sull'attribuzione. Vanno pescate a parte, o di una fiera
  // pagata metà dalla sede e metà dall'evento qui non si vedrebbe niente
  const idsDaAttribuzioni = [...new Set(attribuzioni.map((a) => a.spesa_id))]
    .filter((id) => !spese.some((s) => s.id === id));
  const speseRipartite = idsDaAttribuzioni.length
    ? await supabase.from("spese").select("*").in("id", idsDaAttribuzioni)
        .then(({ data, error }) => { if (error) throw new Error(error.message); return data || []; })
    : [];
  return { vendite, spese: [...spese, ...speseRipartite], attribuzioni, trasferimenti, gruppi, stanze, materiali };
}

// La quota di una spesa che tocca a questo evento. Stessa regola di
// calcolaTotaleSpese: le attribuzioni, se ci sono, vincono sull'ambito
// scritto sulla riga — altrimenti una spesa ripartita verrebbe contata
// due volte, intera e a quota.
export function quotaEvento(spesa, attribuzioniDellaSpesa, eventoId) {
  if (attribuzioniDellaSpesa && attribuzioniDellaSpesa.length) {
    return r2(attribuzioniDellaSpesa
      .filter((a) => a.evento_id === eventoId)
      .reduce((s, a) => s + (Number(a.importo) || 0), 0));
  }
  if (spesa.tipo_ambito === "evento" && spesa.evento_id === eventoId) return r2(spesa.imponibile);
  return 0;
}

export function calcolaConto(dati, eventoId, { prodottiShop = [], bundleComponenti = [], categorieNome = {} } = {}) {
  const { vendite, spese, attribuzioni, trasferimenti, stanze, materiali } = dati;
  const prodottiPerId = {};
  (prodottiShop || []).forEach((p) => { prodottiPerId[p.id] = p; });
  const componentiPerBundle = {};
  (bundleComponenti || []).forEach((c) => { (componentiPerBundle[c.bundle_id] ||= []).push(c); });

  // ---- entrate: le vendite battute al POS con questo evento addosso
  const reali = vendite.filter((v) => v.tipo_movimento !== "omaggio");
  const omaggi = vendite.filter((v) => v.tipo_movimento === "omaggio");
  const entrate = {
    quante: reali.length,
    lordo: r2(reali.reduce((s, v) => s + (Number(v.totale) || 0), 0)),
    imponibile: r2(reali.reduce((s, v) => s + (Number(v.totale_imponibile) || 0), 0)),
    iva: r2(reali.reduce((s, v) => s + (Number(v.totale_iva) || 0), 0)),
    perMetodo: {},
  };
  reali.forEach((v) => {
    const k = v.metodo_pagamento || "non indicato";
    entrate.perMetodo[k] = r2((entrate.perMetodo[k] || 0) + (Number(v.totale) || 0));
  });
  // Un omaggio non è un ricavo mancato: è merce data via. Qui si scrive
  // quanto valeva a listino, perché è la misura di cosa si è regalato —
  // ma nel risultato NON entra come ricavo. Entra il suo costo, insieme
  // a tutta la merce uscita.
  const omaggiValore = r2(omaggi.reduce((s, v) =>
    s + (Array.isArray(v.prodotti) ? v.prodotti : []).reduce((t, r) =>
      t + (Number(r.prezzo_listino) || 0) * (Number(r.quantita) || 0), 0), 0));

  // ---- uscite: spese imputate, trasferimenti, stanze
  const attribPerSpesa = {};
  (attribuzioni || []).forEach((a) => { (attribPerSpesa[a.spesa_id] ||= []).push(a); });
  const vociSpesa = [];
  spese.forEach((s) => {
    const quota = quotaEvento(s, attribPerSpesa[s.id], eventoId);
    if (quota <= 0) return;
    vociSpesa.push({
      id: s.id,
      descrizione: s.descrizione || "(senza descrizione)",
      categoria: categorieNome[s.categoria_id] || s.categoria_id || "Senza categoria",
      importo: quota,
      parziale: !!(attribPerSpesa[s.id] && attribPerSpesa[s.id].length),
      stato: s.stato,
    });
  });
  const vociTrasferimento = (trasferimenti || [])
    .filter((t) => Number(t.costo) > 0)
    .map((t) => ({ id: t.id, descrizione: [t.tipo, t.descrizione, t.chi].filter(Boolean).join(" · ") || "Trasferimento",
                   categoria: "Trasferimenti", importo: r2(t.costo) }));
  const vociStanza = (stanze || [])
    .filter((st) => Number(st.costo) > 0)
    .map((st) => ({ id: st.id, descrizione: [st.nome, st.tipo].filter(Boolean).join(" · ") || "Stanza",
                    categoria: "Hotel", importo: r2(st.costo) }));
  const uscite = [...vociSpesa, ...vociTrasferimento, ...vociStanza];
  const usciteTotale = r2(uscite.reduce((s, v) => s + v.importo, 0));
  const uscitePerCategoria = {};
  uscite.forEach((v) => { uscitePerCategoria[v.categoria] = r2((uscitePerCategoria[v.categoria] || 0) + v.importo); });

  // ---- merce: quello che è uscito dalla scatola, valorizzato a costo
  const { venduto, omaggiato } = movimentiDaVendite(vendite);
  const righeMerce = (materiali || []).map((m) => {
    const prodotto = m.prodotto_id ? prodottiPerId[m.prodotto_id] : null;
    const portata = m.quantita_portata == null ? null : Number(m.quantita_portata);
    const rientrata = m.quantita_rientrata == null ? null : Number(m.quantita_rientrata);
    const vendutoQta = m.prodotto_id ? (venduto[m.prodotto_id] || 0) : 0;
    const omaggiataQta = m.prodotto_id ? (omaggiato[m.prodotto_id] || 0) : 0;
    const usciteQta = vendutoQta + omaggiataQta;
    // quanto è davvero sparito dalla scatola, se si è contato il rientro
    const consumata = portata != null && rientrata != null ? r2(portata - rientrata) : null;
    // Il quadro: quello che manca all'appello. Positivo = è sparito più
    // di quanto il POS abbia registrato; negativo = il POS ne ha venduti
    // più di quanti ne risultino partiti.
    const scarto = consumata != null ? r2(consumata - usciteQta) : null;
    const costo = costoDi(prodotto, prodottiPerId, componentiPerBundle);
    // si valorizza quello che è uscito davvero se il rientro è stato
    // contato, altrimenti ci si fida di quello che il POS ha registrato
    const qtaDaValorizzare = consumata != null ? consumata : usciteQta;
    return {
      id: m.id, nome: m.nome, prodottoId: m.prodotto_id || null,
      portata, rientrata, venduto: vendutoQta, omaggiata: omaggiataQta,
      consumata, scarto, costo,
      valore: costo != null ? r2(costo * qtaDaValorizzare) : null,
      // la bandiera rossa: c'è merce uscita ma non si sa quanto valga
      senzaCosto: costo == null && qtaDaValorizzare > 0,
    };
  });
  const costoMerce = r2(righeMerce.reduce((s, r) => s + (r.valore || 0), 0));
  const merceSenzaCosto = righeMerce.filter((r) => r.senzaCosto);
  const righeScartate = righeMerce.filter((r) => r.scarto != null && r.scarto !== 0);

  const risultato = r2(entrate.imponibile - usciteTotale - costoMerce);
  return {
    entrate, omaggi: { quanti: omaggi.length, valore: omaggiValore },
    uscite, usciteTotale, uscitePerCategoria,
    merce: righeMerce, costoMerce, merceSenzaCosto, righeScartate,
    risultato,
    // il risultato è attendibile solo se tutta la merce uscita ha un costo
    completo: merceSenzaCosto.length === 0,
  };
}

// Quello che non torna, prima di chiudere. Non blocca — un evento
// finisce quando è finito, non quando i conti sono belli — ma va detto
// PRIMA, perché dopo nessuno riapre una fiera per contare i gadget.
//
// Sta qui e non dentro al componente perché è la sola parte della
// chiusura che si possa sbagliare: così si prova con dati veri invece
// che guardandola.
export function problemiDiChiusura(conto) {
  const rientroNonContato = conto.merce.filter((r) => r.portata != null && r.consumata == null);
  const speseNonPagate = conto.uscite.filter((v) => v.stato && v.stato !== "pagata");
  return [
    ...rientroNonContato.map((r) => `${r.nome}: è partito ma non hai segnato quanto è rientrato.`),
    ...conto.righeScartate.map((r) => r.scarto > 0
      ? `${r.nome}: ${r.scarto} pz spariti, né rientrati né usciti al POS.`
      : `${r.nome}: il POS ne ha registrati ${-r.scarto} più di quanti ne risultino partiti.`),
    ...conto.merceSenzaCosto.map((r) => `${r.nome}: senza costo di acquisto vale zero, e il risultato esce più bello del vero.`),
    ...speseNonPagate.map((v) => `${v.descrizione}: la spesa è ancora "${v.stato}".`),
  ];
}
