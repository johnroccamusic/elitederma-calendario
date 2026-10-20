// Le notifiche push: tutto quello che succede nel browser sta qui.
//
// Il giro, in ordine: si registra il service worker (public/sw.js), si
// chiede il permesso, il browser restituisce un "endpoint" con due
// chiavi, e quello si salva in push_iscrizioni legato alla master. Da
// quel momento la edge function "invia-notifica-push" puo' scrivergli.
//
// SU IPHONE FUNZIONA SOLO DALLA SCHERMATA HOME. Non e' una nostra
// scelta: Safari non da' le notifiche a una pagina web normale, solo a
// una web app aggiunta alla Home e aperta dalla sua icona. Per questo
// `statoNotifiche` dice anche se l'app e' installata: senza, una master
// darebbe il permesso e non riceverebbe mai niente, senza capire
// perche'.
import { supabase } from "../supabase.js";

export const CHIAVE_VAPID_PUBBLICA = "push_vapidPublicKey";

function daBase64Url(testo) {
  const riempito = (testo + "=".repeat((4 - (testo.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const grezzo = window.atob(riempito);
  const byte = new Uint8Array(grezzo.length);
  for (let i = 0; i < grezzo.length; i++) byte[i] = grezzo.charCodeAt(i);
  return byte;
}

export function pushSupportate() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

// "installata": l'app e' aperta dalla sua icona e non dentro il
// browser. iOS lo dice con navigator.standalone, gli altri con la media
// query del manifesto.
export function appInstallata() {
  if (typeof window === "undefined") return false;
  if (window.navigator.standalone === true) return true;
  try { return window.matchMedia("(display-mode: standalone)").matches; } catch (e) { return false; }
}

export function suIPhone() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
}

let registrazione = null;
export async function registraServiceWorker() {
  if (!pushSupportate()) return null;
  if (registrazione) return registrazione;
  try {
    registrazione = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return registrazione;
  } catch (e) {
    registrazione = null;
    return null;
  }
}

// Com'e' messo QUESTO dispositivo. Quattro domande separate, perche' le
// risposte portano a tre rimedi diversi: installa l'app, dai il
// permesso, premi il tasto.
export async function statoNotifiche() {
  const base = { supportate: pushSupportate(), installata: appInstallata(), iPhone: suIPhone(), permesso: "default", iscritta: false };
  if (!base.supportate) return base;
  base.permesso = window.Notification.permission;
  const reg = await registraServiceWorker();
  if (!reg) return base;
  try {
    const sot = await reg.pushManager.getSubscription();
    base.iscritta = !!sot;
  } catch (e) { /* niente iscrizione leggibile: resta false */ }
  return base;
}

function nomeDispositivo() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Altro";
}

// Accende le notifiche su questo dispositivo. Torna { ok, errore }: chi
// chiama mostra l'errore com'e' scritto, senza interpretarlo.
export async function attivaNotifiche({ masterId = null, venditoreId = null, utente = null } = {}) {
  if (!pushSupportate()) return { ok: false, errore: "Questo browser non sa ricevere notifiche." };
  if (suIPhone() && !appInstallata()) {
    return { ok: false, errore: "Su iPhone le notifiche arrivano solo all'app aggiunta alla schermata Home: aprila dalla sua icona e riprova." };
  }
  const { data: riga } = await supabase.from("impostazioni_layout_tabelle").select("valore").eq("chiave", CHIAVE_VAPID_PUBBLICA).maybeSingle();
  const chiave = typeof riga?.valore === "string" ? riga.valore : null;
  if (!chiave) return { ok: false, errore: "Manca la chiave pubblica delle notifiche: va rimessa in impostazioni_layout_tabelle." };

  const permesso = await window.Notification.requestPermission();
  if (permesso !== "granted") {
    return { ok: false, errore: permesso === "denied"
      ? "Il permesso è stato negato. Si riapre dalle impostazioni del telefono, alla voce Notifiche di GENYON."
      : "Permesso non dato." };
  }
  const reg = await registraServiceWorker();
  if (!reg) return { ok: false, errore: "Non riesco a registrare il service worker." };

  let sottoscrizione = await reg.pushManager.getSubscription();
  if (!sottoscrizione) {
    try {
      sottoscrizione = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: daBase64Url(chiave) });
    } catch (e) { return { ok: false, errore: "Il browser ha rifiutato l'iscrizione: " + (e?.message || e) }; }
  }
  const j = sottoscrizione.toJSON();
  if (!j?.keys?.p256dh || !j?.keys?.auth) return { ok: false, errore: "Iscrizione senza chiavi: il browser non l'ha completata." };

  // upsert sull'endpoint: riattivare dallo stesso telefono aggiorna la
  // riga, non ne crea una seconda
  const iscrizione = {
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    master_id: masterId || null,
    // una riga porta l'uno o l'altro: il dispositivo e' di una master
    // oppure di un venditore, mai di entrambi
    venditore_id: venditoreId || null,
    utente: utente || null,
    dispositivo: nomeDispositivo(),
    attiva: true,
    ultimo_errore: null,
  };
  let { error } = await supabase.from("push_iscrizioni").upsert(iscrizione, { onConflict: "endpoint" });

  // SE `venditore_id` NON LO CONOSCE, SI RIPROVA SENZA.
  //
  // PostgREST butta TUTTA la scrittura quando si nomina una colonna che
  // non trova, anche col valore a null — e la sua cache dello schema
  // resta indietro per qualche minuto dopo un `alter table`. Aggiungendo
  // quel campo il 20/10/2026 ho reso l'iscrizione di QUALUNQUE
  // dispositivo dipendente da lui: le master, che funzionavano, hanno
  // smesso di poter accendere le notifiche.
  //
  // E' lo stesso guasto che fermo' le spedizioni POS per sei giorni per
  // una colonna mancante. Qui il ripiego e' semplice: si riprova senza
  // il campo nuovo, cosi' il telefono si iscrive comunque. Perde il
  // legame col venditore — e lo dice, invece di far finta.
  if (error && /venditore_id/i.test(error.message || "")) {
    const { venditore_id: _nonConosciuto, ...senzaVenditore } = iscrizione;
    const secondo = await supabase.from("push_iscrizioni").upsert(senzaVenditore, { onConflict: "endpoint" });
    if (!secondo.error) {
      return venditoreId
        ? { ok: true, avviso: "Notifiche attive, ma il collegamento col venditore non è stato salvato: ricarica la pagina e ripremi fra un minuto." }
        : { ok: true };
    }
    error = secondo.error;
  }
  if (error) return { ok: false, errore: "Iscrizione non salvata: " + error.message };
  return { ok: true };
}

export async function disattivaNotifiche() {
  const reg = await registraServiceWorker();
  if (!reg) return { ok: true };
  const sot = await reg.pushManager.getSubscription();
  if (!sot) return { ok: true };
  const endpoint = sot.endpoint;
  try { await sot.unsubscribe(); } catch (e) { /* il browser l'ha gia' persa */ }
  // la riga si spegne, non si cancella: resta scritto che quel telefono
  // c'era
  await supabase.from("push_iscrizioni").update({ attiva: false }).eq("endpoint", endpoint);
  return { ok: true };
}
