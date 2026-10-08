// Il service worker di GENYON: serve SOLO alle notifiche push.
//
// NON mette niente in cache, e non intercetta nessuna richiesta. E' una
// scelta: un service worker che fa cache serve una versione vecchia
// dell'app per giorni, e il giorno che si sbaglia una regola nessuno
// capisce perche' meta' dello staff vede una schermata di tre settimane
// fa. Qui l'unico compito e' ricevere la notifica e aprirla.
//
// skipWaiting + clients.claim: quando questo file cambia, la versione
// nuova prende il posto della vecchia subito, senza aspettare che tutte
// le schede siano chiuse.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  // il corpo arriva come JSON; se per qualunque motivo non lo e', si
  // mostra comunque qualcosa invece di non mostrare niente
  let dati = {};
  try { dati = evento.data ? evento.data.json() : {}; } catch (e) { dati = { testo: evento.data ? evento.data.text() : "" }; }
  const titolo = dati.titolo || "GENYON";
  evento.waitUntil(self.registration.showNotification(titolo, {
    body: dati.testo || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // due notifiche con lo stesso tag si sostituiscono invece di
    // impilarsi: un promemoria aggiornato non deve lasciare in giro
    // quello vecchio
    tag: dati.tag || undefined,
    data: { url: dati.url || "/" },
  }));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || "/";
  evento.waitUntil((async () => {
    const aperte = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // se l'app e' gia' aperta si porta davanti quella, invece di aprire
    // una seconda copia: su iPhone due finestre della stessa app
    // installata sono un rompicapo da chiudere
    for (const c of aperte) {
      if (c.url.indexOf(self.registration.scope) === 0) {
        await c.focus();
        if ("navigate" in c && url !== "/") { try { await c.navigate(url); } catch (e) { /* resta dov'era */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
