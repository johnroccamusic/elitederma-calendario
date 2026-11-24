// IL TREND MENSILE STA NELLA CASSETTA DELLE IMPOSTAZIONI, come le altre
// scelte di lavoro: una riga chiave/valore, niente tabella nuova. Si
// definisce una volta e vale per ogni calcolo, anche quello di domani.
//
// NASCE PIENA (tutti i mesi al 100%) ed è voluto: finché nessuno la
// tocca, la stima è quella che sarebbe senza la tabella. Una tabella che
// nascesse con delle percentuali indovinate da me cambierebbe i numeri
// senza che nessuno l'abbia deciso.
import { supabase } from "../supabase.js";
import { TREND_PIENO } from "./consumi-previsti.js";

export const CHIAVE_TREND = "consumi_trend_mensile";

export async function leggiTrend() {
  const { data, error } = await supabase.from("impostazioni_layout_tabelle")
    .select("valore").eq("chiave", CHIAVE_TREND).maybeSingle();
  if (error || !data?.valore) return { trend: { ...TREND_PIENO }, scritto: false };
  const letto = {};
  for (let m = 1; m <= 12; m += 1) {
    const v = Number(data.valore?.[m] ?? data.valore?.[String(m)]);
    letto[m] = Number.isFinite(v) && v > 0 ? v : 100;
  }
  return { trend: letto, scritto: true, aggiornatoIl: data.valore?.aggiornato_il || null };
}

export async function salvaTrend(trend, chi = "") {
  const valore = { aggiornato_il: new Date().toISOString(), aggiornato_da: chi || "non registrato" };
  for (let m = 1; m <= 12; m += 1) valore[m] = Number(trend?.[m]) || 100;
  const { error } = await supabase.from("impostazioni_layout_tabelle")
    .upsert({ chiave: CHIAVE_TREND, valore, aggiornato_il: new Date().toISOString() }, { onConflict: "chiave" });
  if (error) throw error;
}
