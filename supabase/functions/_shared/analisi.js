// CHIEDI AI DATI — la parte condivisa fra la edge function e le prove.
//
// Il modello scrive una SELECT; prima di mandarla al database la si
// controlla anche qui, perche' un errore detto in italiano al modello
// («niente tabelle base, solo le viste analisi_*») gli permette di
// riprovare, mentre il database risponde con un'eccezione e basta. Il
// controllo vero resta quello di `analisi_esegui`: questo e' la stessa
// regola, scritta una seconda volta nel posto in cui serve prima.

export const VISTE_ANALISI = [
  "analisi_vendite", "analisi_vendite_righe", "analisi_iscrizioni",
  "analisi_incassi", "analisi_spese", "analisi_edizioni",
];

// il catalogo che il modello legge: cosa c'e' e cosa vuol dire
export const CATALOGO_ANALISI = `
VISTE DISPONIBILI (solo lettura; le date sono DATE in fuso Europe/Rome; gli importi sono in euro, IVA inclusa dove non detto altrimenti):

analisi_vendite — una riga per ordine, banco e shop online.
  colonne: id, numero_ordine, data, anno, mese, canale ('banco'|'shop online'), stato ('completed','processing','on-hold','pending','cancelled','refunded','failed'), tipo_movimento ('vendita','reso','cambio','annullamento','omaggio'), metodo_pagamento ('pos','contanti','buono_amazon', o quello del sito), operatore (nome di chi ha venduto al banco), operatore_tipo ('master','venditore','admin'...), corso (nome del corso della classe in cui e' avvenuta la vendita, null se fuori dai corsi), citta, evento (nome della fiera, se vendita in fiera), totale, imponibile, iva, provvigione_master, codice_coupon.
  REGOLA: per i ricavi veri usare stato in ('completed','processing') and tipo_movimento = 'vendita'.

analisi_vendite_righe — una riga per prodotto venduto (stesse colonne di contesto di analisi_vendite: vendita_id, numero_ordine, data, anno, mese, canale, stato, tipo_movimento, metodo_pagamento, operatore, corso, citta, evento) piu':
  prodotto (nome), sku, categoria (categoria del prodotto, puo' essere null), quantita, totale_riga (incasso della riga), sconto_riga, costo_acquisto (unitario, puo' essere null), margine_stimato (totale_riga - costo*quantita, null se il costo manca), conta_incassi (bool: false = componente o voce di servizio che NON conta come prodotto venduto), tipo_prodotto ('semplice','bundle','componente', null).
  REGOLA: i «prodotti piu' venduti» si contano qui, con la stessa regola su stato e tipo_movimento. Si vende il PACCO, non i pezzi dentro: la vista esclude gia' i componenti dei kit (le righe a 0 € accanto a un kit), quindi un «Kit 3 colori» conta come kit e non come tre pigmenti. Per sapere se un'offerta in pacco funziona si guarda il prodotto pacco (tipo_prodotto = 'bundle'). Salvo richiesta esplicita escludere le righe di servizio come «Spedizione» (prodotto ilike 'spedizione%').
  ATTENZIONE: «1pz», «3 pz», «Box 20 pz» nel NOME del prodotto sono il formato della confezione, non la quantita' venduta: la quantita' e' la colonna quantita.

analisi_iscrizioni — una riga per iscrizione a un corso (NESSUN dato dell'allievo).
  colonne: id, data_iscrizione, anno, mese, corso, citta, data_inizio, data_fine (del corso), master (chi tiene il corso), venditore (chi ha iscritto), stato ('dati_inseriti','modulo_inviato','modulo_ricevuto','confermato'), totale_pattuito (prezzo concordato del corso), quota_venditore, acconto_totale, acconto_pagato (bool), acconto_pagato_il, precorso_totale, precorso_pagato, precorso_pagato_il, saldo_totale, saldo_incassato_il, tipo_offerta, pacchetto_kit, richiede_modelle, numero_modelle, vecchia_iscrizione.

analisi_incassi — tutti i soldi entrati, una riga per incasso: fonte ('vendita prodotti','acconto corso','quota pre corso','saldo corso'), data, canale, metodo, importo, chi (operatore o venditore), corso, citta, evento.
  REGOLA: «ricavi» o «incassi» di un periodo = sum(importo) qui, filtrando per data.

analisi_spese — una riga per spesa: id, data, anno, mese, categoria, sottocategoria, fornitore, descrizione, imponibile, iva_percentuale, totale, stato ('pagata','fatturata'), metodo_pagamento, tipo_ambito, corso, citta, evento, fisso_variabile, ricorrente_occasionale, riducibilita ('alta','media','bassa' o null), essenzialita, controllabilita, natura, includi_analisi_costi (bool).
  REGOLA: per «quali spese si possono tagliare» guardare riducibilita, essenzialita, fisso_variabile e i totali per categoria/fornitore.

analisi_edizioni — una riga per classe (corso + citta' + data): id, corso, citta, data_inizio, data_fine, master, posti_max, iscritti (numero), pattuito (somma dei prezzi concordati), costi_scheda (costi scritti sulla scheda della classe: accademia, master, assistenti, pranzi, hotel, imprevisti, coordinatore).
`.trim();

const VIETATE = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|pg_sleep|pg_catalog|pg_class|pg_roles|information_schema|set|reset|lock|vacuum|analyze|listen|notify)\b/i;

// Torna { ok, sql } oppure { ok: false, errore } — l'errore e' scritto per
// il modello, che lo legge e riprova.
export function controllaSql(testo) {
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
  const base = sql.match(/\b(from|join)\s+(?!analisi_)([a-z_][a-z0-9_]*)\b/gi) || [];
  const sospette = base.map((x) => x.split(/\s+/)[1].toLowerCase())
    .filter((n) => !cte.has(n) && !["lateral", "unnest", "generate_series", "jsonb_array_elements", "jsonb_each"].includes(n));
  if (sospette.length) return { ok: false, errore: `Non esiste «${sospette[0]}»: usare solo le viste analisi_*.` };
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
