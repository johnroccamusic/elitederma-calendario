// IMPORTA I CONTATTI DA VETTA (30/10/2026).
//
// Legge tutte le persone, le opportunita' e i membri del workspace «Elite
// Derma» dall'API REST di Vetta, unisce i record della stessa persona in
// un contatto solo, tiene ogni record come richiesta, riconosce il luogo,
// collega chi si puo' allo Storico allievi e agli iscritti, e scrive su
// Supabase in `crm_contatti` e `crm_richieste`.
//
// Si lancia a mano, con le chiavi nell'ambiente e MAI in un file:
//
//   VETTA_API_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/importa-vetta.mjs
//
// Opzioni:
//   --prova           legge solo le prime 300 persone e non scrive niente
//   --solo-lettura    scarica tutto in .importa-vetta/ e non scrive su Supabase
//   --da-dump         non chiama Vetta: usa i file gia' in .importa-vetta/
//                     (e' la strada di ripiego quando la chiave non apre il REST:
//                     i file li si prepara leggendo da MCP)
//
// Rilanciabile: le richieste si riconoscono per `vetta_id`, i contatti per
// il record Vetta piu' vecchio della persona. Niente viene cancellato.
//
// GDPR: i dump in .importa-vetta/ contengono nomi, email e telefoni e
// stanno fuori da git (.gitignore). Il riepilogo stampato non contiene
// dati di persone: solo numeri e id.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  luogoRichiesta, separaNome, emailPulita, telefonoPulito, mestiereDa, corsiCanonici, corsoCanonico,
  leggiDatiAggiuntivi, nomeAgenteDaEmail, chiave,
} from "./vetta-normalizza.mjs";

const ARG = new Set(process.argv.slice(2));
const PROVA = ARG.has("--prova");
const SOLO_LETTURA = ARG.has("--solo-lettura") || PROVA;
const DA_DUMP = ARG.has("--da-dump");
const CARTELLA = path.resolve(".importa-vetta");
fs.mkdirSync(CARTELLA, { recursive: true });

const VETTA_BASE = process.env.VETTA_API_URL || "https://api.usedalil.ai/rest";
const VETTA_KEY = process.env.VETTA_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://snhvvipszhfllrgemsdu.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

// ---------------------------------------------------------------- Vetta

async function vettaGet(percorso, query) {
  const url = new URL(VETTA_BASE.replace(/\/$/, "") + "/" + percorso.replace(/^\//, ""));
  for (const [k, v] of Object.entries(query || {})) if (v != null && v !== "") url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${VETTA_KEY}`, Accept: "application/json" } });
  if (!r.ok) {
    const testo = await r.text().catch(() => "");
    const e = new Error(`Vetta ${r.status} su ${url.pathname}: ${testo.slice(0, 200)}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

// L'API e' alla Twenty: { data: { people: [...] }, pageInfo: { hasNextPage, endCursor }, totalCount }.
// Il limite massimo non e' documentato senza chiave: si prova 200 e si scende a 60.
async function vettaTutti(oggettoPlurale, massimo = Infinity) {
  const tutti = [];
  let cursore = null; let limite = 200;
  for (;;) {
    let r;
    try {
      r = await vettaGet(oggettoPlurale, { limit: limite, starting_after: cursore, depth: 0 });
    } catch (e) {
      if (e.status === 400 && limite > 60) { limite = 60; continue; }
      throw e;
    }
    const lista = r?.data?.[oggettoPlurale] || [];
    tutti.push(...lista);
    if (tutti.length === lista.length) log(`${oggettoPlurale}: ${r.totalCount ?? "?"} in totale`);
    if (tutti.length % 2000 < limite) log(`${oggettoPlurale}: letti ${tutti.length}`);
    if (!r?.pageInfo?.hasNextPage || !lista.length || tutti.length >= massimo) break;
    cursore = r.pageInfo.endCursor;
  }
  return tutti.slice(0, massimo);
}

async function leggiVetta() {
  const file = (n) => path.join(CARTELLA, n);
  if (DA_DUMP) {
    const leggi = (n) => JSON.parse(fs.readFileSync(file(n), "utf8"));
    return { persone: leggi("persone.json"), opportunita: leggi("opportunita.json"), membri: leggi("membri.json") };
  }
  if (!VETTA_KEY) throw new Error("Manca VETTA_API_KEY nell'ambiente.");
  // il primo giro dice subito se la chiave apre il REST
  try { await vettaGet("workspaceMembers", { limit: 1 }); }
  catch (e) {
    if (e.status === 401 || e.status === 403) {
      console.error("La chiave non apre l'API REST di Vetta (" + e.status + "). Ripiego: leggere da MCP, salvare i file in .importa-vetta/ e rilanciare con --da-dump.");
      process.exit(2);
    }
    throw e;
  }
  const membri = (await vettaTutti("workspaceMembers"));
  const persone = await vettaTutti("people", PROVA ? 300 : Infinity);
  const opportunita = PROVA ? [] : await vettaTutti("opportunities");
  fs.writeFileSync(file("persone.json"), JSON.stringify(persone));
  fs.writeFileSync(file("opportunita.json"), JSON.stringify(opportunita));
  fs.writeFileSync(file("membri.json"), JSON.stringify(membri));
  return { persone, opportunita, membri };
}

// ------------------------------------------------------- Vetta -> righe

// «katia» in Vetta, «Katia» qui: e' un nome, non un'utenza
const nomeMembro = (m) => [m?.name?.firstName, m?.name?.lastName].filter(Boolean).join(" ").trim()
  .split(" ").map((p) => (/@/.test(p) ? "" : p.charAt(0).toUpperCase() + p.slice(1))).filter(Boolean).join(" ");

function richiestaDa(p, membriPerId, oppPerPersona) {
  const nome = separaNome(p.name?.firstName, p.name?.lastName);
  const extra = leggiDatiAggiuntivi(p.datiAggiuntivi);
  const settore = Array.isArray(p.settore) ? p.settore : (p.settore ? [p.settore] : []);
  const corsiVetta = Array.isArray(p.corso) ? p.corso : (p.corso ? [p.corso] : []);
  const corsi = [...new Set([...corsiCanonici(corsiVetta), ...extra.corsi])];
  const luogo = luogoRichiesta({ city: p.city, provincia: p.provincia, regione: p.regione });
  const membro = p.ownerId ? membriPerId[p.ownerId] : null;
  const agenteStorico = (p.tempColumnAgentEmail || "").toLowerCase() || "";
  const trattatoDa = membro ? nomeMembro(membro) : (agenteStorico ? nomeAgenteDaEmail(agenteStorico) : "");
  const opp = (oppPerPersona[p.id] || []).map((o) => ({
    vetta_id: o.id, stato: o.stage || null, corso: corsoCanonico((o.corso || [])[0] || o.name) || null,
    corso_vetta: (o.corso || [])[0] || null, importo: o.amount?.amountMicros ? Number(o.amount.amountMicros) / 1e6 : null,
    chiusa_il: o.closeDate ? o.closeDate.slice(0, 10) : null,
  }));
  const mestiereDaTesto = extra.settore ? mestiereDa(extra.settore.split(",")[0].trim().toUpperCase().replace(/ /g, "_")) : "";
  return {
    vetta_id: p.id,
    richiesta_il: p.createdAt,
    corsi, corsi_vetta: corsiVetta,
    canale: p.canale || null,
    form_origine: extra.form || null,
    dati_aggiuntivi: p.datiAggiuntivi || null,
    preferenza_giorno: p.giorno || extra.giorno || null,
    preferenza_ora: p.fasciaOraria || extra.ora || null,
    trattato_da: trattatoDa || null,
    trattato_da_email: membro?.userEmail || null,
    trattato_da_vetta_id: p.ownerId || null,
    agente_storico_email: agenteStorico || null,
    qualifica: p.categoria || null,
    gestione_chiamata: p.gestioneChiamata || null,
    nome_originale: nome.originale || null,
    email: emailPulita(p.emails?.primaryEmail) || null,
    telefono: telefonoPulito(p.phones?.primaryPhoneNumber, p.phones?.primaryPhoneCallingCode) || null,
    citta_originale: p.city || null,
    provincia_originale: p.provincia || null,
    regione_originale: p.regione || null,
    comune: luogo.comune || null, provincia: luogo.provincia || null, regione: luogo.regione || null,
    luogo_dubbio: !!luogo.dubbio, luogo_nota: luogo.nota || null,
    settore, professione: p.professione || null,
    opportunita: opp,
    vetta_grezzo: p,
    creato_da: p.createdBy?.source === "API" ? "form" : "manuale",
    creato_da_nome: (p.createdBy?.name || "").trim() || null,
    aggiornato_in_vetta_il: p.updatedAt || null,
    // appoggio, non salvato
    _nome: nome, _luogo: luogo, _mestieri: [...settore.map(mestiereDa), mestiereDa(p.professione), mestiereDaTesto].filter(Boolean),
    _emailExtra: (p.emails?.additionalEmails || []).map(emailPulita).filter(Boolean),
    _telExtra: (p.phones?.additionalPhones || []).map((t) => telefonoPulito(t?.number || t, t?.callingCode)).filter(Boolean),
    _origine: p.origineContatto || null,
  };
}

// Stessa persona = stesso record, stessa email o stesso telefono (unione
// transitiva). Nome e cognome uguali da soli NON uniscono: si segnala.
function raggruppa(richieste) {
  const padre = new Map();
  const trova = (x) => { while (padre.get(x) !== x) { padre.set(x, padre.get(padre.get(x))); x = padre.get(x); } return x; };
  const unisci = (a, b) => { const ra = trova(a), rb = trova(b); if (ra !== rb) padre.set(ra, rb); };
  for (const r of richieste) padre.set(r.vetta_id, r.vetta_id);
  const perEmail = new Map(); const perTel = new Map();
  for (const r of richieste) {
    for (const e of [r.email, ...r._emailExtra].filter(Boolean)) { if (perEmail.has(e)) unisci(r.vetta_id, perEmail.get(e)); else perEmail.set(e, r.vetta_id); }
    for (const t of [r.telefono, ...r._telExtra].filter(Boolean)) { if (perTel.has(t)) unisci(r.vetta_id, perTel.get(t)); else perTel.set(t, r.vetta_id); }
  }
  const gruppi = new Map();
  for (const r of richieste) { const k = trova(r.vetta_id); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k).push(r); }
  return [...gruppi.values()].map((g) => g.sort((a, b) => a.richiesta_il.localeCompare(b.richiesta_il)));
}

function contattoDa(gruppo) {
  const prima = gruppo[0]; const ultima = gruppo[gruppo.length - 1];
  // il nome: quello con il cognome scritto, altrimenti il piu' recente
  const conCognome = [...gruppo].reverse().find((r) => r._nome.cognome && !r._nome.motivo);
  const nome = (conCognome || ultima)._nome;
  const email = [...gruppo].reverse().map((r) => r.email).find(Boolean) || null;
  const emails = [...new Set(gruppo.flatMap((r) => [r.email, ...r._emailExtra]).filter((e) => e && e !== email))];
  const telefono = [...gruppo].reverse().map((r) => r.telefono).find(Boolean) || null;
  const telefoni = [...new Set(gruppo.flatMap((r) => [r.telefono, ...r._telExtra]).filter((t) => t && t !== telefono))];
  // il luogo: la richiesta piu' recente con un luogo riconoscibile
  const conLuogo = [...gruppo].reverse().find((r) => r.comune || r.provincia || r.regione) || ultima;
  const corsi = []; for (const r of gruppo) for (const c of r.corsi) if (!corsi.includes(c)) corsi.push(c);
  const mestieri = gruppo.flatMap((r) => r._mestieri);
  const mestiere = [...mestieri].reverse().find((m) => m !== "altro") || (mestieri.includes("altro") ? "altro" : null);
  const opp = gruppo.flatMap((r) => r.opportunita);
  const vinte = opp.filter((o) => o.stato === "CLOSED_WON");
  const stato = vinte.length ? "venduto" : (opp.length ? "in_trattativa" : "nessuna");
  const motivi = [...new Set(gruppo.map((r) => r._nome.motivo).filter(Boolean))];
  const daVerificare = [];
  if (nome.motivo) daVerificare.push(nome.motivo);
  if (!email && !telefono) daVerificare.push("senza email né telefono");
  return {
    vetta_id_principale: prima.vetta_id,
    nome: nome.nome || null, cognome: nome.cognome || null, nome_originale: nome.originale || null,
    email, email_aggiuntive: emails, telefono, telefono_originale: ultima.vetta_grezzo?.phones?.primaryPhoneNumber || null, telefoni_aggiuntivi: telefoni,
    citta_originale: conLuogo.citta_originale, provincia_originale: conLuogo.provincia_originale, regione_originale: conLuogo.regione_originale,
    comune: conLuogo.comune, provincia: conLuogo.provincia, regione: conLuogo.regione,
    luogo_fonte: conLuogo._luogo.fonte, luogo_dubbio: conLuogo.luogo_dubbio, luogo_nota: conLuogo.luogo_nota,
    settore: [...new Set(gruppo.flatMap((r) => r.settore))], professione: ultima.professione, mestiere,
    corsi_interesse: corsi, canale: ultima.canale, origine_contatto: ultima._origine,
    qualifica: ultima.qualifica, stato_trattativa: stato, gestione_chiamata: [...gruppo].reverse().map((r) => r.gestione_chiamata).find(Boolean) || null,
    opportunita: opp,
    ultima_vendita_il: vinte.map((o) => o.chiusa_il).filter(Boolean).sort().pop() || null,
    totale_venduto: vinte.reduce((s, o) => s + (o.importo || 0), 0),
    trattato_da: ultima.trattato_da, trattato_da_email: ultima.trattato_da_email, trattato_da_vetta_id: ultima.trattato_da_vetta_id, agente_storico_email: ultima.agente_storico_email,
    numero_richieste: gruppo.length, primo_contatto_il: prima.richiesta_il, ultimo_contatto_il: ultima.richiesta_il,
    da_verificare: daVerificare.length > 0, da_verificare_motivo: daVerificare.join("; ") || null,
    creato_in_vetta_il: prima.richiesta_il, aggiornato_in_vetta_il: gruppo.map((r) => r.aggiornato_in_vetta_il).filter(Boolean).sort().pop() || null,
    creato_da: prima.creato_da, creato_da_nome: prima.creato_da_nome,
    _motiviRichieste: motivi, _gruppo: gruppo,
  };
}

// ------------------------------------------------ collegamenti a Genion

const chiaveNome = (n, c) => chiave(n) + "|" + chiave(c);

async function leggiTutte(sb, tabella, colonne) {
  const righe = []; const passo = 1000;
  for (let da = 0; ; da += passo) {
    const { data, error } = await sb.from(tabella).select(colonne).order("id").range(da, da + passo - 1);
    if (error) throw new Error(`${tabella}: ${error.message}`);
    righe.push(...(data || []));
    if (!data || data.length < passo) break;
  }
  return righe;
}

function collega(contatti, storico, iscritti, corsiPerId, corsiDatePerId) {
  const storicoPerNome = new Map();
  for (const s of storico) {
    const corso = corsoCanonico(corsiPerId[s.corso_id] || "") || null;
    for (const k of [chiaveNome(s.nome, s.cognome), chiaveNome(s.cognome, s.nome)]) {
      if (!storicoPerNome.has(k)) storicoPerNome.set(k, []);
      storicoPerNome.get(k).push({ id: s.id, corso });
    }
  }
  const iscPerEmail = new Map(); const iscPerTel = new Map(); const iscPerNome = new Map();
  for (const i of iscritti) {
    const e = emailPulita(i.email); if (e) iscPerEmail.set(e, i);
    const t = telefonoPulito(i.telefono); if (t) iscPerTel.set(t, i);
    const k = chiaveNome(i.nome, i.cognome); if (!iscPerNome.has(k)) iscPerNome.set(k, []); iscPerNome.get(k).push(i);
  }
  for (const c of contatti) {
    c.storico_allievo_id = null; c.iscritto_id = null; c.collegamento = "nessuno"; c.collegamento_nota = null;
    // iscritti dell'app: email o telefono = certo
    const isc = (c.email && iscPerEmail.get(c.email)) || (c.telefono && iscPerTel.get(c.telefono))
      || c.email_aggiuntive.map((e) => iscPerEmail.get(e)).find(Boolean) || c.telefoni_aggiuntivi.map((t) => iscPerTel.get(t)).find(Boolean);
    if (isc) { c.iscritto_id = isc.id; c.collegamento = "certo"; c.collegamento_nota = "iscritto riconosciuto da email o telefono"; }
    if (!c.cognome) continue;
    // tutte le separazioni possibili del nome originale, piu' quella scelta
    const chiavi = new Set([chiaveNome(c.nome, c.cognome), chiaveNome(c.cognome, c.nome)]);
    const parole = (c.nome_originale || "").split(/\s+/).filter(Boolean);
    for (let k = 1; k < parole.length; k++) { chiavi.add(chiaveNome(parole.slice(0, k).join(" "), parole.slice(k).join(" "))); chiavi.add(chiaveNome(parole.slice(k).join(" "), parole.slice(0, k).join(" "))); }
    if (!isc) {
      const candIsc = [...new Map([...chiavi].flatMap((k) => iscPerNome.get(k) || []).map((i) => [i.id, i])).values()];
      if (candIsc.length === 1) { c.iscritto_id = candIsc[0].id; c.collegamento = c.stato_trattativa === "venduto" ? "certo" : "dubbio"; c.collegamento_nota = "iscritto con lo stesso nome" + (c.stato_trattativa === "venduto" ? "" : ", ma in Vetta non risulta una vendita"); }
      else if (candIsc.length > 1) { c.collegamento = "dubbio"; c.collegamento_nota = `${candIsc.length} iscritti con lo stesso nome`; }
    }
    const cand = [...new Map([...chiavi].flatMap((k) => storicoPerNome.get(k) || []).map((s) => [s.id, s])).values()];
    if (!cand.length) continue;
    const corsiVenduti = c.opportunita.filter((o) => o.stato === "CLOSED_WON").map((o) => o.corso).filter(Boolean);
    const stessoCorsoVenduto = cand.filter((s) => s.corso && corsiVenduti.includes(s.corso));
    const stessoCorsoChiesto = cand.filter((s) => s.corso && c.corsi_interesse.includes(s.corso));
    if (stessoCorsoVenduto.length === 1) { c.storico_allievo_id = stessoCorsoVenduto[0].id; if (c.collegamento !== "certo") c.collegamento = "certo"; c.collegamento_nota = [c.collegamento_nota, "storico: stesso nome e stesso corso venduto"].filter(Boolean).join("; "); }
    else if (cand.length === 1 && (c.stato_trattativa === "venduto" || stessoCorsoChiesto.length === 1)) { c.storico_allievo_id = cand[0].id; if (c.collegamento !== "certo") c.collegamento = "certo"; c.collegamento_nota = [c.collegamento_nota, c.stato_trattativa === "venduto" ? "storico: stesso nome, vendita in Vetta" : "storico: stesso nome e stesso corso richiesto"].filter(Boolean).join("; "); }
    else if (cand.length === 1) { if (c.collegamento === "nessuno") c.collegamento = "dubbio"; c.collegamento_nota = [c.collegamento_nota, `storico: stesso nome (id ${cand[0].id}) ma nessuna vendita in Vetta e corso diverso`].filter(Boolean).join("; "); }
    else { if (c.collegamento === "nessuno") c.collegamento = "dubbio"; c.collegamento_nota = [c.collegamento_nota, `storico: ${cand.length} allievi con lo stesso nome (${cand.map((s) => s.id).join(", ")})`].filter(Boolean).join("; "); }
  }
}

// -------------------------------------------------------------- scrittura

async function scrivi(sb, contatti) {
  const pulisci = (c) => Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith("_")));
  const idPerPrincipale = new Map();
  for (let i = 0; i < contatti.length; i += 500) {
    const lotto = contatti.slice(i, i + 500).map((c) => ({ ...pulisci(c), aggiornato_il: new Date().toISOString() }));
    const { data, error } = await sb.from("crm_contatti").upsert(lotto, { onConflict: "vetta_id_principale" }).select("id, vetta_id_principale");
    if (error) throw new Error("crm_contatti: " + error.message);
    for (const r of data) idPerPrincipale.set(r.vetta_id_principale, r.id);
    log(`contatti scritti: ${Math.min(i + 500, contatti.length)}/${contatti.length}`);
  }
  const richieste = contatti.flatMap((c) => c._gruppo.map((r) => ({ ...pulisci(r), contatto_id: idPerPrincipale.get(c.vetta_id_principale) })));
  for (let i = 0; i < richieste.length; i += 300) {
    const lotto = richieste.slice(i, i + 300);
    const { error } = await sb.from("crm_richieste").upsert(lotto, { onConflict: "vetta_id" });
    if (error) throw new Error("crm_richieste: " + error.message);
    if ((i / 300) % 10 === 0) log(`richieste scritte: ${Math.min(i + 300, richieste.length)}/${richieste.length}`);
  }
  log(`richieste scritte: ${richieste.length}/${richieste.length}`);
}

// ------------------------------------------------------------------ main

async function main() {
  const { persone, opportunita, membri } = await leggiVetta();
  log(`letti: ${persone.length} persone, ${opportunita.length} opportunità, ${membri.length} membri`);
  const membriPerId = Object.fromEntries(membri.map((m) => [m.id, m]));
  const oppPerPersona = {};
  for (const o of opportunita) if (o.pointOfContactId) (oppPerPersona[o.pointOfContactId] ||= []).push(o);

  const richieste = persone.map((p) => richiestaDa(p, membriPerId, oppPerPersona));
  const gruppi = raggruppa(richieste);
  const contatti = gruppi.map(contattoDa);

  // stesso nome e cognome in due contatti non uniti: si segnala, non si unisce
  const perNome = new Map();
  for (const c of contatti) if (c.nome && c.cognome) { const k = chiaveNome(c.nome, c.cognome); (perNome.get(k) || perNome.set(k, []).get(k)).push(c); }
  let omonimi = 0;
  for (const lista of perNome.values()) if (lista.length > 1) for (const c of lista) {
    omonimi++; c.da_verificare = true;
    c.da_verificare_motivo = [c.da_verificare_motivo, `possibile doppione: altri ${lista.length - 1} contatti con lo stesso nome senza email o telefono in comune`].filter(Boolean).join("; ");
  }

  const sb = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } }) : null;
  if (sb) {
    const [storico, iscritti, corsi, corsiDate] = await Promise.all([
      leggiTutte(sb, "storico_allievi", "id, nome, cognome, corso_id"),
      leggiTutte(sb, "iscritti", "id, nome, cognome, email, telefono, corso_data_id"),
      leggiTutte(sb, "corsi", "id, nome"),
      leggiTutte(sb, "corsi_date", "id, corso_id"),
    ]);
    const corsiPerId = Object.fromEntries(corsi.map((c) => [c.id, c.nome]));
    const corsiDatePerId = Object.fromEntries(corsiDate.map((c) => [c.id, c.corso_id]));
    collega(contatti, storico, iscritti, corsiPerId, corsiDatePerId);
  } else {
    log("senza SUPABASE_SERVICE_ROLE_KEY: niente collegamenti e niente scrittura");
  }

  const conta = (f) => contatti.filter(f).length;
  const riepilogo = {
    quando: new Date().toISOString(),
    record_vetta: persone.length, richieste: richieste.length, contatti: contatti.length,
    uniti_in_un_contatto: richieste.length - contatti.length,
    contatti_con_piu_richieste: conta((c) => c.numero_richieste > 1),
    per_qualifica: Object.fromEntries([...new Set(contatti.map((c) => c.qualifica || "(nessuna)"))].map((q) => [q, conta((c) => (c.qualifica || "(nessuna)") === q)])),
    per_stato_trattativa: Object.fromEntries(["venduto", "in_trattativa", "nessuna"].map((s) => [s, conta((c) => c.stato_trattativa === s)])),
    luogo: {
      con_comune: conta((c) => c.comune), solo_provincia: conta((c) => !c.comune && c.provincia), solo_regione: conta((c) => !c.comune && !c.provincia && c.regione),
      senza_luogo: conta((c) => !c.comune && !c.provincia && !c.regione), dubbi: conta((c) => c.luogo_dubbio),
      da_citta: conta((c) => c.luogo_fonte === "da_citta"), da_vetta: conta((c) => c.luogo_fonte === "vetta"),
    },
    mestiere: Object.fromEntries([...new Set(contatti.map((c) => c.mestiere || "(nessuno)"))].map((m) => [m, conta((c) => (c.mestiere || "(nessuno)") === m)])),
    corsi: Object.fromEntries([...new Set(contatti.flatMap((c) => c.corsi_interesse))].map((k) => [k, conta((c) => c.corsi_interesse.includes(k))])),
    da_verificare: conta((c) => c.da_verificare), omonimi_non_uniti: omonimi,
    motivi_verifica: Object.fromEntries([...new Set(contatti.flatMap((c) => (c.da_verificare_motivo || "").split("; ").filter(Boolean)).map((m) => m.replace(/\d+/g, "N")))].map((m) => [m, conta((c) => (c.da_verificare_motivo || "").replace(/\d+/g, "N").includes(m))])),
    collegamenti: Object.fromEntries(["certo", "dubbio", "nessuno"].map((s) => [s, conta((c) => c.collegamento === s)])),
    collegati_storico: conta((c) => c.storico_allievo_id), collegati_iscritti: conta((c) => c.iscritto_id),
    trattato_da: Object.fromEntries([...new Set(contatti.map((c) => c.trattato_da || "(nessuno)"))].map((t) => [t, conta((c) => (c.trattato_da || "(nessuno)") === t)])),
  };
  // le citta' non riconosciute, contate per testo: si guardano e si aggiungono agli esonimi
  const cittaNon = {};
  for (const r of richieste) if (r.luogo_dubbio && r.citta_originale) { const k = r.citta_originale.trim().toLowerCase(); cittaNon[k] = (cittaNon[k] || 0) + 1; }
  riepilogo.citta_non_riconosciute_top = Object.entries(cittaNon).sort((a, b) => b[1] - a[1]).slice(0, 60);
  fs.writeFileSync(path.join(CARTELLA, "riepilogo.json"), JSON.stringify(riepilogo, null, 2));
  // i casi dubbi, con gli id: per chi li deve guardare
  fs.writeFileSync(path.join(CARTELLA, "dubbi.json"), JSON.stringify(contatti.filter((c) => c.collegamento === "dubbio" || c.da_verificare).map((c) => ({ vetta_id: c.vetta_id_principale, nome: c.nome_originale, collegamento: c.collegamento, nota: c.collegamento_nota, da_verificare: c.da_verificare_motivo })), null, 2));
  console.log(JSON.stringify(riepilogo, null, 2));

  if (SOLO_LETTURA || !sb) { log("solo lettura: niente scritto su Supabase"); return; }
  await scrivi(sb, contatti);
  log("fatto");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
