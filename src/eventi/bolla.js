// LA BOLLA DI ACCOMPAGNAMENTO (documento di trasporto) dei materiali di
// un evento, 27/10/2026. Si genera nel browser con pdf-lib, come il
// listino: un foglio A4 con mittente, destinatario, causale, vettore,
// l'elenco dei prodotti con le quantita', colli e aspetto, e le tre
// firme in fondo. I numeri non li inventa: le righe sono quelle di
// eventi_materiali, e gli indirizzi quelli scritti nel pannello.
import { supabase } from "../supabase.js";

let _pdfLib = null;
async function caricaPdfLib() {
  if (!_pdfLib) {
    const m = await import("pdf-lib");
    _pdfLib = { PDFDocument: m.PDFDocument, StandardFonts: m.StandardFonts, rgb: m.rgb };
  }
  return _pdfLib;
}

// «DDT 2026-10-27/EL7» — data e tre lettere: leggibile al telefono, e
// diverso da un altro dello stesso giorno. Resta sull'evento: una
// ristampa porta lo stesso numero, non ne inventa uno nuovo.
export function numeroBolla(oggi = new Date()) {
  const d = oggi.toISOString().slice(0, 10);
  const lettere = Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 3).toUpperCase();
  return `DDT ${d}/${lettere}`;
}

export async function datiSocieta() {
  try {
    const { data } = await supabase.from("intestazione_societa").select("nome, indirizzo, indirizzo_2").maybeSingle();
    return data || null;
  } catch { return null; }
}

// la bolla di partenza per un evento: quello che c'e' gia' sull'evento,
// altrimenti la sede della societa' come partenza e il luogo dell'evento
// come destinazione
export function bollaIniziale(evento, societa) {
  const b = evento?.bolla || {};
  const partenza = b.partenza || [societa?.nome, societa?.indirizzo].filter(Boolean).join("\n");
  const destinazione = b.destinazione || [evento?.nome_luogo, evento?.indirizzo, evento?.citta].filter(Boolean).join("\n");
  return {
    numero: b.numero || "",
    partenza, destinazione,
    vettore: b.vettore || "Mittente (mezzo proprio)",
    causale: b.causale || `Trasferimento merce per esposizione e vendita in fiera — ${evento?.nome || ""}`.trim(),
    aspetto: b.aspetto || "Scatole",
    colli: b.colli || "",
  };
}

function righeTesto(testo) {
  return String(testo || "").split("\n").map((r) => r.trim()).filter(Boolean);
}

export async function creaBollaPdf({ evento, righe, bolla, societa, getPdfLib }) {
  const { PDFDocument, StandardFonts, rgb } = await (getPdfLib || caricaPdfLib)();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${bolla.numero || "Bolla"} — ${evento?.nome || ""}`);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);
  const NERO = rgb(0.06, 0.1, 0.2); const GRIGIO = rgb(0.45, 0.47, 0.52); const LINEA = rgb(0.85, 0.83, 0.78);
  const L = 595.28, A = 841.89, M = 42;
  let pagina = pdf.addPage([L, A]);
  let y = A - M;

  const testo = (t, x, yy, { size = 10, font = normale, color = NERO } = {}) => pagina.drawText(String(t ?? ""), { x, y: yy, size, font, color });
  const riga = (yy) => pagina.drawLine({ start: { x: M, y: yy }, end: { x: L - M, y: yy }, thickness: 0.6, color: LINEA });

  // intestazione
  testo((societa?.nome || "Elitederma Srl").toUpperCase(), M, y - 14, { size: 15, font: grassetto });
  testo("DOCUMENTO DI TRASPORTO", L - M - grassetto.widthOfTextAtSize("DOCUMENTO DI TRASPORTO", 13), y - 14, { size: 13, font: grassetto });
  testo("(D.P.R. 472/1996)", L - M - normale.widthOfTextAtSize("(D.P.R. 472/1996)", 9), y - 27, { size: 9, color: GRIGIO });
  y -= 36;
  const dataIt = (d) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "";
  testo(`N. ${bolla.numero || "—"}   ·   Data ${dataIt(String(bolla.generata_il || new Date().toISOString()).slice(0, 10))}`, M, y - 4, { size: 10.5, font: grassetto });
  y -= 16; riga(y); y -= 14;

  // mittente e destinatario, due colonne
  const col = (L - 2 * M - 16) / 2;
  const blocco = (titolo, testoBlocco, x) => {
    testo(titolo, x, y, { size: 8.5, font: grassetto, color: GRIGIO });
    let yy = y - 14;
    for (const r of righeTesto(testoBlocco).slice(0, 6)) { testo(r, x, yy, { size: 10.5 }); yy -= 13; }
    return yy;
  };
  const y1 = blocco("MITTENTE / LUOGO DI PARTENZA", bolla.partenza, M);
  const y2 = blocco("DESTINATARIO / LUOGO DI DESTINAZIONE", bolla.destinazione, M + col + 16);
  y = Math.min(y1, y2) - 6; riga(y); y -= 14;

  testo("CAUSALE DEL TRASPORTO", M, y, { size: 8.5, font: grassetto, color: GRIGIO }); testo(bolla.causale || "—", M, y - 13, { size: 10 });
  y -= 30;
  testo("VETTORE", M, y, { size: 8.5, font: grassetto, color: GRIGIO }); testo(bolla.vettore || "—", M, y - 13, { size: 10 });
  testo("EVENTO", M + col + 16, y, { size: 8.5, font: grassetto, color: GRIGIO });
  testo(`${evento?.nome || ""}${evento?.data_inizio ? ` · ${dataIt(evento.data_inizio)}${evento.data_fine && evento.data_fine !== evento.data_inizio ? ` – ${dataIt(evento.data_fine)}` : ""}` : ""}`, M + col + 16, y - 13, { size: 10 });
  y -= 32; riga(y); y -= 16;

  // la tabella dei beni
  const cX = [M, M + 28, L - M - 110, L - M - 50];
  const intestaTabella = () => {
    testo("N.", cX[0], y, { size: 8.5, font: grassetto, color: GRIGIO });
    testo("DESCRIZIONE DEI BENI", cX[1], y, { size: 8.5, font: grassetto, color: GRIGIO });
    testo("QUANTITÀ", cX[2], y, { size: 8.5, font: grassetto, color: GRIGIO });
    testo("U.M.", cX[3], y, { size: 8.5, font: grassetto, color: GRIGIO });
    y -= 6; riga(y); y -= 13;
  };
  intestaTabella();
  const daPortare = (righe || []).filter((r) => (Number(r.quantita) || 0) > 0);
  let totalePezzi = 0;
  daPortare.forEach((r, i) => {
    if (y < M + 120) {
      pagina = pdf.addPage([L, A]); y = A - M;
      testo(`${bolla.numero || "Bolla"} — segue`, M, y - 10, { size: 9, color: GRIGIO }); y -= 24;
      intestaTabella();
    }
    const q = Number(r.quantita) || 0; totalePezzi += q;
    testo(String(i + 1), cX[0], y, { size: 9.5 });
    const nome = String(r.nome || "—");
    const max = cX[2] - cX[1] - 8;
    let mostrato = nome;
    while (normale.widthOfTextAtSize(mostrato, 9.5) > max && mostrato.length > 4) mostrato = mostrato.slice(0, -2);
    if (mostrato !== nome) mostrato = mostrato.slice(0, -1) + "…";
    testo(mostrato, cX[1], y, { size: 9.5 });
    testo(String(q), cX[2], y, { size: 9.5, font: grassetto });
    testo(r.unita || "pz", cX[3], y, { size: 9.5 });
    y -= 14;
  });
  if (daPortare.length === 0) { testo("Nessun materiale in elenco per questo evento.", cX[1], y, { size: 9.5, color: GRIGIO }); y -= 14; }
  riga(y); y -= 14;
  testo(`Righe: ${daPortare.length}   ·   Pezzi: ${totalePezzi}   ·   Colli: ${bolla.colli || "—"}   ·   Aspetto esteriore: ${bolla.aspetto || "—"}`, M, y, { size: 10, font: grassetto });
  y -= 14;
  testo("Beni non in vendita in questo documento: trasferimento di materiale di proprietà del mittente per esposizione e vendita al banco durante l'evento. Il reso della merce invenduta è registrato nel gestionale.", M, y, { size: 8, color: GRIGIO });

  // le firme, in fondo alla pagina
  const yf = M + 46;
  const terzo = (L - 2 * M) / 3;
  ["Firma del mittente", "Firma del vettore", "Firma del destinatario"].forEach((f, i) => {
    const x = M + i * terzo;
    pagina.drawLine({ start: { x: x + 6, y: yf }, end: { x: x + terzo - 14, y: yf }, thickness: 0.6, color: LINEA });
    testo(f, x + 6, yf - 12, { size: 8.5, color: GRIGIO });
  });
  return pdf.save();
}

export function scaricaPdf(bytes, nomeFile) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
