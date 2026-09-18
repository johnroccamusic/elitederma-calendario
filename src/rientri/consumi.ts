// Quanto si consuma davvero ai corsi.
//
// La metrica portante e' il consumo PER ALLIEVO, non quello grezzo: e'
// ovvio che un corso da otto consumi piu' di uno da uno, e confrontare i
// numeri assoluti dice solo quanto era grande la classe. Diviso per gli
// allievi, invece, due corsi diversi diventano confrontabili — ed e' li'
// che si vede se qualcosa non torna.
//
// Serve a due cose. E' un controllo: sugli sfusi non c'e' modo di sapere
// se da un singolo corso manca qualcosa, solo la media storica lo rivela.
// Ma soprattutto e' una diagnosi: se una master consuma sistematicamente
// di piu', o spreca o insegna diversamente, e vale la pena capirlo.
//
// Regola di fondo, la stessa dell'Advisor: quando i dati non bastano,
// qui si TACE. Una media su un corso solo non e' una media, e detta con
// sicurezza fa piu' danni del silenzio.

import { supabase } from "../supabase.js";

/** Sotto questa soglia non si dice niente: un corso non fa una media. */
export const CORSI_MINIMI_PER_MEDIA = 3;

export interface ConsumoEdizione {
  corsoDataId: string;
  corsoId: string | null;
  masterId: string | null;
  prodottoId: string;
  allievi: number;
  consumato: number;
  /** la metrica che rende confrontabili classi di dimensioni diverse */
  perAllievo: number;
  chiusoIl: string | null;
}

export interface MediaProdotto {
  corsoId: string | null;
  prodottoId: string;
  edizioni: number;
  media: number;
  /** quanto ballano i corsi attorno alla media */
  deviazione: number;
  totaleAllievi: number;
}

export interface ScostamentoMaster {
  masterId: string | null;
  edizioni: number;
  /** media degli scostamenti percentuali rispetto al proprio tipo di corso */
  scostamentoPct: number;
  prodottiConfrontati: number;
}

export interface CorsoAnomalo {
  corsoDataId: string;
  corsoId: string | null;
  masterId: string | null;
  prodottoId: string;
  perAllievo: number;
  media: number;
  scostamentoPct: number;
}

export interface AnalisiConsumi {
  edizioni: ConsumoEdizione[];
  medie: MediaProdotto[];
  master: ScostamentoMaster[];
  anomali: CorsoAnomalo[];
  /** quante edizioni chiuse ci sono in tutto: sotto la soglia si dice e basta */
  edizioniChiuse: number;
}

function deviazioneStandard(valori: number[], media: number): number {
  if (valori.length < 2) return 0;
  const somma = valori.reduce((s, v) => s + (v - media) ** 2, 0);
  return Math.sqrt(somma / (valori.length - 1));
}

/**
 * Legge tutti gli inventari chiusi e ne ricava le tre viste.
 *
 * Il consumo lo si prende da rientro_righe, dove e' stato CONGELATO alla
 * chiusura: non si ricalcola adesso, perche' altrimenti correggere oggi
 * una spedizione di tre mesi fa cambierebbe di nascosto una statistica
 * gia' letta.
 */
export async function analizzaConsumi(sogliaAnomaliaPct = 30): Promise<AnalisiConsumi> {
  const { data: rientri } = await supabase
    .from("rientri").select("id, spedizione_id, stato, chiuso_ts").eq("stato", "chiuso");
  const vuota: AnalisiConsumi = { edizioni: [], medie: [], master: [], anomali: [], edizioniChiuse: 0 };
  if (!rientri || rientri.length === 0) return vuota;

  const [{ data: spedizioni }, { data: righeRientro }] = await Promise.all([
    supabase.from("spedizioni_corso").select("id, corso_data_id, master_id, n_allievi_previsti")
      .in("id", rientri.map((r) => r.spedizione_id)),
    supabase.from("rientro_righe").select("*").in("rientro_id", rientri.map((r) => r.id)),
  ]);
  const idRighe = [...new Set((righeRientro || []).map((r) => r.spedizione_riga_id))];
  const { data: righeSped } = idRighe.length
    ? await supabase.from("spedizione_righe").select("id, prodotto_id, tipo").in("id", idRighe)
    : { data: [] as any[] };

  const spedById = Object.fromEntries((spedizioni || []).map((s) => [s.id, s]));
  const rientroById = Object.fromEntries(rientri.map((r) => [r.id, r]));
  const rigaSpedById = Object.fromEntries((righeSped || []).map((r) => [r.id, r]));

  // servono corso_id e master dell'edizione
  const idEdizioni = [...new Set((spedizioni || []).map((s) => s.corso_data_id))];
  const { data: edizioni } = idEdizioni.length
    ? await supabase.from("corsi_date").select("id, corso_id, master_id").in("id", idEdizioni)
    : { data: [] as any[] };
  const edizioneById = Object.fromEntries((edizioni || []).map((e) => [e.id, e]));

  const consumi: ConsumoEdizione[] = [];
  (righeRientro || []).forEach((r) => {
    const consumato = r.quantita_consumata_calcolata || 0;
    if (consumato <= 0) return;
    const rientro = rientroById[r.rientro_id];
    const sped = rientro ? spedById[rientro.spedizione_id] : null;
    const rigaSped = rigaSpedById[r.spedizione_riga_id];
    if (!sped || !rigaSped?.prodotto_id) return;
    const allievi = sped.n_allievi_previsti || 0;
    // senza sapere quanti allievi c'erano il consumo per allievo non si
    // puo' calcolare, e inventarlo sarebbe peggio che lasciarlo fuori
    if (allievi <= 0) return;
    const ed = edizioneById[sped.corso_data_id] || {};
    consumi.push({
      corsoDataId: sped.corso_data_id,
      corsoId: ed.corso_id || null,
      masterId: ed.master_id || sped.master_id || null,
      prodottoId: rigaSped.prodotto_id,
      allievi,
      consumato,
      perAllievo: Math.round((consumato / allievi) * 100) / 100,
      chiusoIl: rientro?.chiuso_ts || null,
    });
  });

  // medie per tipo di corso e prodotto
  const gruppi: Record<string, ConsumoEdizione[]> = {};
  consumi.forEach((c) => {
    const k = `${c.corsoId || "?"}|${c.prodottoId}`;
    (gruppi[k] || (gruppi[k] = [])).push(c);
  });
  const medie: MediaProdotto[] = Object.values(gruppi).map((righe) => {
    const valori = righe.map((r) => r.perAllievo);
    const media = valori.reduce((s, v) => s + v, 0) / valori.length;
    return {
      corsoId: righe[0].corsoId,
      prodottoId: righe[0].prodottoId,
      edizioni: righe.length,
      media: Math.round(media * 100) / 100,
      deviazione: Math.round(deviazioneStandard(valori, media) * 100) / 100,
      totaleAllievi: righe.reduce((s, r) => s + r.allievi, 0),
    };
  }).sort((a, b) => b.edizioni - a.edizioni);

  const mediaDi = (corsoId: string | null, prodottoId: string) =>
    medie.find((m) => m.corsoId === corsoId && m.prodottoId === prodottoId) || null;

  // corsi anomali: solo dove una media esiste davvero
  const anomali: CorsoAnomalo[] = [];
  consumi.forEach((c) => {
    const m = mediaDi(c.corsoId, c.prodottoId);
    if (!m || m.edizioni < CORSI_MINIMI_PER_MEDIA || m.media <= 0) return;
    const scostamento = ((c.perAllievo - m.media) / m.media) * 100;
    if (Math.abs(scostamento) >= sogliaAnomaliaPct) {
      anomali.push({
        corsoDataId: c.corsoDataId, corsoId: c.corsoId, masterId: c.masterId,
        prodottoId: c.prodottoId, perAllievo: c.perAllievo, media: m.media,
        scostamentoPct: Math.round(scostamento),
      });
    }
  });
  anomali.sort((a, b) => Math.abs(b.scostamentoPct) - Math.abs(a.scostamentoPct));

  // classifica master: lo scostamento medio rispetto al PROPRIO tipo di
  // corso, non a una media generale — una master che tiene solo corsi
  // lunghi consumerebbe sempre "troppo" contro una media di tutti
  const perMaster: Record<string, { scostamenti: number[]; edizioni: Set<string> }> = {};
  consumi.forEach((c) => {
    const m = mediaDi(c.corsoId, c.prodottoId);
    if (!m || m.edizioni < CORSI_MINIMI_PER_MEDIA || m.media <= 0) return;
    const k = c.masterId || "?";
    const v = perMaster[k] || (perMaster[k] = { scostamenti: [], edizioni: new Set() });
    v.scostamenti.push(((c.perAllievo - m.media) / m.media) * 100);
    v.edizioni.add(c.corsoDataId);
  });
  const master: ScostamentoMaster[] = Object.entries(perMaster).map(([masterId, v]) => ({
    masterId: masterId === "?" ? null : masterId,
    edizioni: v.edizioni.size,
    scostamentoPct: Math.round(v.scostamenti.reduce((s, x) => s + x, 0) / v.scostamenti.length),
    prodottiConfrontati: v.scostamenti.length,
  })).sort((a, b) => b.scostamentoPct - a.scostamentoPct);

  return {
    edizioni: consumi,
    medie,
    master,
    anomali,
    edizioniChiuse: new Set(consumi.map((c) => c.corsoDataId)).size,
  };
}

/**
 * Quanto si consuma davvero di un prodotto, per allievo, rispetto a
 * quanto ne prevede la composizione dei kit.
 *
 * L'Advisor calcola il fabbisogno dalla distinta: tot pezzi per kit per
 * allievo. Questo dice se la realta' si discosta — e di quanto — ma solo
 * quando ci sono abbastanza corsi chiusi per dirlo. Sotto la soglia
 * restituisce null, e chi lo usa non mostra niente: e' la stessa regola
 * dell'Advisor, meglio il silenzio di una previsione inventata.
 */
export function consumoRealePerAllievo(
  analisi: AnalisiConsumi,
  prodottoId: string,
  corsoId: string | null = null,
): { media: number; edizioni: number } | null {
  const righe = analisi.medie.filter(
    (m) => m.prodottoId === prodottoId && (corsoId == null || m.corsoId === corsoId),
  );
  if (righe.length === 0) return null;
  const edizioni = righe.reduce((n, r) => n + r.edizioni, 0);
  if (edizioni < CORSI_MINIMI_PER_MEDIA) return null;
  // media pesata sulle edizioni: un tipo di corso con dieci edizioni
  // conta piu' di uno con tre
  const media = righe.reduce((s, r) => s + r.media * r.edizioni, 0) / edizioni;
  return { media: Math.round(media * 100) / 100, edizioni };
}
