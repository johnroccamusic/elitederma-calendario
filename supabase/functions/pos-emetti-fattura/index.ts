// Edge Function "pos-emetti-fattura"
// Il passo che chiude il giro: dall'app qualcuno ha guardato i dati che
// la cliente ha scritto, li ha confermati, e la fattura parte.
//
// Perche' non parte da sola nel webhook: una fattura emessa non si
// annulla, si fa una nota di credito. Un codice destinatario sbagliato
// battuto su un telefono diventa un documento da correggere con un
// altro documento. Qui invece c'e' un paio d'occhi in mezzo.
//
// E' idempotente: una richiesta gia' fatturata non ne emette una
// seconda, risponde con quella che c'e' gia'.
//
// Variabili d'ambiente: FIC_CLIENT_ID, FIC_CLIENT_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { leggiConnessione, tokenValido, idAliquota, emettiFattura, contiSaldo, metodiPagamento } from "../_shared/fic.ts";
import { righeFattura } from "../_shared/righe-fattura.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const risposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALIQUOTA = 22;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  let corpo: any;
  try { corpo = await req.json(); } catch { return risposta({ errore: "Corpo non valido." }, 400); }

  // DUE STRADE PER ARRIVARE QUI, e sono due incassi diversi.
  //
  //   `codice`    un pagamento col QR di Stripe: vive in `pagamenti_pos`
  //   `venditaId` una vendita pagata col terminale al banco, che in
  //               `pagamenti_pos` non c'e' mai stata
  //
  // Da qui in giu' il lavoro e' lo stesso — stessi controlli, stesso
  // documento, stesso conto — e cambia solo dove si scrive l'esito.
  // Scritte due funzioni separate, un giorno una delle due avrebbe
  // smesso di chiedere il conto di saldo o di mandare il metodo giusto.
  const codice = String(corpo?.codice || "").toUpperCase();
  const venditaId = String(corpo?.venditaId || "").trim();
  if (!codice && !venditaId) return risposta({ errore: "Manca il codice del pagamento o la vendita." }, 400);

  const daBanco = !codice;
  let pag: any = null;
  let venditaAlBanco: any = null;

  if (daBanco) {
    const { data: v } = await sb.from("vendite_shop").select("*").eq("id", venditaId).maybeSingle();
    if (!v) return risposta({ errore: "Vendita non trovata." }, 404);
    if (v.fattura_numero) return risposta({ gia: true, fatturaId: v.fattura_fic_id, numero: v.fattura_numero });
    // CONTANTI E BUONO AMAZON NON SI FATTURANO DA QUI. Deciso dal
    // titolare il 18/10/2026: in quella lista entrano solo gli incassi a
    // carta. Il controllo sta anche qui e non solo nel filtro della
    // pagina, perche' una regola che vive in un `.filter()` del browser
    // non e' una regola.
    const metodo = String(v.metodo_pagamento || "").toLowerCase();
    if (metodo !== "pos") {
      return risposta({ errore: `Questa vendita e' stata incassata con "${v.metodo_pagamento || "metodo sconosciuto"}": da qui si fatturano solo gli incassi a carta.` }, 409);
    }
    if (String(v.tipo_movimento || "") === "annullamento" || String(v.tipo_movimento || "") === "omaggio") {
      return risposta({ errore: "Un omaggio o un annullamento non si fattura." }, 409);
    }
    venditaAlBanco = v;
    // la stessa forma che ha un pagamento Stripe, cosi' il resto della
    // funzione non deve sapere da dove arriva
    pag = {
      id: v.id,
      codice: v.numero_ordine,
      importo: v.totale,
      pagato_il: v.data_ordine,
      cliente_fattura_id: v.cliente_fattura_id,
      vendita_id: v.id,
      righe: (Array.isArray(v.prodotti) ? v.prodotti : []).map((r: any) => ({
        nome: r.nome,
        quantita: r.quantita,
        // sulla vendita al banco il prezzo gia' scontato della riga si
        // chiama `totale_riga`: e' quello che la cliente ha pagato
        prezzo: Number(r.totale_riga ?? 0) / Math.max(1, Number(r.quantita) || 1),
      })),
      cliente: {},
    };
    // i dati di fatturazione: l'anagrafica collegata alla vendita, e
    // sopra quella quello che e' stato corretto adesso nella scheda
    if (v.cliente_fattura_id) {
      const { data: anagrafica } = await sb.from("clienti_fattura").select("*").eq("id", v.cliente_fattura_id).maybeSingle();
      if (anagrafica) pag.cliente = { ...anagrafica };
    }
    if (!pag.cliente.ditta && !pag.cliente.nome && v.cliente_nome) {
      const pezzi = String(v.cliente_nome).trim().split(/\s+/);
      pag.cliente.nome = pezzi.slice(0, -1).join(" ") || pezzi[0];
      pag.cliente.cognome = pezzi.length > 1 ? pezzi[pezzi.length - 1] : "";
    }
  } else {
    const { data: p } = await sb.from("pagamenti_pos").select("*").eq("codice", codice).maybeSingle();
    if (!p) return risposta({ errore: "Pagamento non trovato." }, 404);
    if (p.stato === "fatturato") {
      return risposta({ gia: true, fatturaId: p.fattura_fic_id, numero: p.fattura_numero });
    }
    if (p.stato !== "da_verificare") {
      return risposta({ errore: `Questo pagamento e' in stato "${p.stato}": si fattura solo quello che e' stato incassato.` }, 409);
    }
    pag = p;
  }

  // i dati corretti a mano dall'app vincono su quelli arrivati da
  // Stripe: e' tutto il senso della verifica
  const cliente = { ...(pag.cliente || {}), ...(corpo?.cliente || {}) };
  if (!cliente.codice_fiscale && !cliente.piva) {
    return risposta({ errore: "Senza codice fiscale ne' partita IVA la fattura elettronica non parte." }, 400);
  }

  // Il calcolo delle righe sta in `_shared/righe-fattura.js`, dove il
  // banco di prova puo' arrivarci: tre emissioni rifiutate di fila le ha
  // pagate il titolare premendo il tasto, e un conto sui soldi che si
  // puo' provare solo in produzione non e' un conto.
  const documento = righeFattura(pag.righe, pag.importo, ALIQUOTA);
  const righe = documento.righe;
  if (righe.length === 0) return risposta({ errore: "Il pagamento non ha righe da fatturare." }, 400);

  // COME E' STATA INCASSATA, presa dai dati e non scritta a mano.
  //
  // Al banco "Carta" si incassa in due modi: il terminale fisico, o il
  // QR che la cliente inquadra col telefono e paga con Stripe. Per la
  // vendita e per l'IVA restano la stessa cosa, ma sulla fattura no: chi
  // la legge deve sapere da dove sono arrivati i soldi, e a fine mese
  // chi riconcilia Stripe cerca proprio quelle.
  //
  // Lo sa solo il sistema: il venditore preme un tasto e non trascrive
  // niente. Il segno e' `pagamento_codice` sulla vendita, valorizzato
  // solo quando il pagamento nasce da un QR.
  const { data: vendita } = venditaAlBanco
    ? { data: venditaAlBanco }
    : pag.vendita_id
      ? await sb.from("vendite_shop").select("metodo_pagamento, pagamento_codice").eq("id", pag.vendita_id).maybeSingle()
      : { data: null };
  const daQr = !daBanco && !!(pag.stripe_payment_intent || pag.stripe_session_id || vendita?.pagamento_codice);
  const metodoVendita = String(vendita?.metodo_pagamento || "").toLowerCase();
  const nomeMetodo = daQr
    ? "Carta di credito (Stripe)"
    : metodoVendita === "contanti"
      ? "Contanti"
      : metodoVendita === "buono_amazon"
        ? "Buono Amazon"
        : "POS / Bancomat";
  // La ModalitaPagamento che lo SdI pretende nel file elettronico. Non
  // ha niente a che vedere col metodo censito in Fatture in Cloud: quello
  // e' per i conti di casa ed e' facoltativo, questa e' obbligatoria.
  // Qui si fatturano solo incassi a carta — col QR o col terminale —
  // quindi MP08; il contante resta mappato perche' il giorno in cui
  // entrera' da questa porta non deve fermarsi di nuovo.
  const codiceEiPagamento = metodoVendita === "contanti" ? "MP01" : "MP08";

  try {
    const conn = await leggiConnessione(sb);
    const token = await tokenValido(sb, conn);
    const aliquotaId = await idAliquota(token, conn.company_id, ALIQUOTA);

    // IL CONTO DI SALDO: dove risultano entrati i soldi.
    //
    // Non si chiede a nessuno. Le fatture di Elitederma finiscono sempre
    // sullo stesso conto — la banca — e anche quello che incassa Stripe
    // arriva li' con un versamento: una tendina da compilare per una
    // cosa che non cambia mai e' una domanda inutile messa davanti a chi
    // ha fretta.
    //
    // Si sceglie da soli, in quest'ordine: il conto eventualmente
    // forzato fra le impostazioni (chiave `fic_conto_saldo`, che non ha
    // piu' una schermata ma resta la via per imporre un conto diverso);
    // se i conti dell'azienda sono uno solo, quello; altrimenti si
    // guarda COME e' stata incassata — un pagamento Stripe cerca un
    // conto che si chiami Stripe, tutti gli altri la banca. Solo se non
    // somiglia niente a niente ci si ferma e si chiede, elencandoli:
    // scrivere un incasso sul conto sbagliato e' un errore che si scopre
    // a fine trimestre, quando non si riconcilia piu' niente.
    const conti = await contiSaldo(token, conn.company_id);
    const { data: scelta } = await sb.from("impostazioni_layout_tabelle")
      .select("valore").eq("chiave", "fic_conto_saldo").maybeSingle();
    const idScelto = Number(scelta?.valore?.id ?? scelta?.valore ?? 0) || null;
    const somiglia = (regola: RegExp) => conti.find((c) => regola.test(c.nome));
    // "Il conto si chiama Conto BP Lazio": cercare "banca" o "popolare"
    // non bastava, perche' nessuno scrive per esteso il nome della
    // propria banca. Quindi si ragiona al contrario — si scartano i
    // conti che una fattura incassata a carta non puo' avere, cioe' la
    // cassa contanti — e se ne resta uno solo, e' quello.
    const nonContanti = conti.filter((c) => !/contant|cassa|cash/i.test(c.nome));
    const conto = (idScelto && conti.find((c) => c.id === idScelto))
      || (conti.length === 1 ? conti[0] : null)
      || (daQr ? somiglia(/stripe|paypal/i) : null)
      || (nonContanti.length === 1 ? nonContanti[0] : null)
      || somiglia(/banca|popolare|bank|bp |c\/c|conto corrente/i)
      || null;
    if (!conto) {
      const elenco = conti.map((c) => `${c.nome} (id ${c.id})`).join(", ") || "nessuno";
      return risposta({
        errore: `Non riesco a capire su quale conto far risultare l'incasso. I conti di Fatture in Cloud sono: ${elenco}. `
          + "Dimmi quale e lo scrivo fra le impostazioni, cosi' non lo chiede piu'.",
        conti,
      }, 409);
    }
    // LA DATA DEL DOCUMENTO e' quella dell'incasso, non quella di oggi:
    // una fattura datata al giorno in cui qualcuno si e' ricordato di
    // emetterla racconta una cosa che non e' successa.
    const dataIso = new Date(pag.pagato_il || Date.now()).toISOString().slice(0, 10);

    // Il metodo si manda per id se quel metodo e' gia' censito
    // sull'azienda; se non c'e', il campo resta fuori — vedi il commento
    // in _shared/fic.ts: meglio una fattura senza quella riga che una
    // fattura rifiutata.
    const metodi = await metodiPagamento(token, conn.company_id);
    const metodoFic = metodi.find((m) => m.nome.toLowerCase() === nomeMetodo.toLowerCase())
      || (daQr ? metodi.find((m) => /stripe|carta/i.test(m.nome)) : null)
      || (metodoVendita === "contanti" ? metodi.find((m) => /contant/i.test(m.nome)) : null)
      || (!daQr && metodoVendita === "pos" ? metodi.find((m) => /pos|bancomat/i.test(m.nome)) : null)
      || null;

    const fattura = await emettiFattura(token, conn.company_id, {
      cliente, righe, aliquotaId, dataIso,
      // IL PAGAMENTO SCRITTO SOPRA E' IL TOTALE DEL DOCUMENTO, non quello
      // che e' entrato in cassa. Quasi sempre coincidono; quando no — un
      // totale su sei non esiste, vedi `righe-fattura.js` — e' questo che
      // Fatture in Cloud confronta, ed e' questo che deve tornare. Lo
      // scarto e' al massimo un centesimo.
      importoPagato: documento.totale,
      metodo: nomeMetodo,
      metodoId: metodoFic?.id || null,
      codiceEiPagamento,
      contoSaldoId: conto.id,
    });

    if (daBanco) {
      await sb.from("vendite_shop").update({
        fattura_fic_id: fattura.id,
        fattura_numero: fattura.numero,
        fattura_emessa_il: new Date().toISOString(),
        fattura_errore: null,
        richiede_fattura: true,
      }).eq("id", pag.id);
    } else {
      await sb.from("pagamenti_pos").update({
        stato: "fatturato",
        cliente,
        fattura_fic_id: fattura.id,
        fattura_numero: fattura.numero,
        fattura_emessa_il: new Date().toISOString(),
        fattura_errore: null,
        verificato_il: new Date().toISOString(),
        verificato_da: corpo?.verificatoDa || null,
        aggiornato_il: new Date().toISOString(),
      }).eq("id", pag.id);
    }

    if (pag.cliente_fattura_id) {
      await sb.from("clienti_fattura").update({ ...cliente, aggiornato_il: new Date().toISOString() }).eq("id", pag.cliente_fattura_id);
    }

    return risposta({ fatturaId: fattura.id, numero: fattura.numero });
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    // l'errore resta scritto sulla richiesta: chi riprova domani deve
    // sapere cos'era andato storto, non ricominciare al buio
    if (daBanco) await sb.from("vendite_shop").update({ fattura_errore: messaggio }).eq("id", pag.id);
    else await sb.from("pagamenti_pos").update({ fattura_errore: messaggio, aggiornato_il: new Date().toISOString() }).eq("id", pag.id);
    return risposta({ errore: messaggio }, 502);
  }
});
