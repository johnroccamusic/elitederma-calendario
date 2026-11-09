// AL BANCO DELLA FIERA: il POS fisico, e la cifra scritta a mano
// (7/11/2026).
//
// Due richieste dello stesso momento, con la fiera di Napoli aperta:
//
//   «per le persone che sono in fiera gli devi attivare anche il POS
//   fisico, che non è necessariamente carta Stripe»
//
//   «è meglio che scrivo una cifra io da scontare: se vedo che il prezzo
//   fa 7,56 e voglio fare 6,90, scrivo a mano meno 60 euro»
//
// Sono tutti e due soldi, e quello che queste prove difendono è il
// confine: il terminale lo vede chi sta al banco di quella fiera e
// nessun altro; la cifra a mano la scrive il programmatore e nessun
// altro, si SOMMA allo sconto fiera (è l'unica casella che lo fa) e
// quello che si legge sulle righe deve tornare col totale.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaPOS } from "../src/App.jsx";
import { monta, attendi, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const oggi = new Date().toISOString().slice(0, 10);
const fraDueOre = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

// 30,00 netti = 36,60 al pubblico; margine 66,7% → quinta fascia
const PRODOTTO = {
  id: "p1", nome: "Pigmento", prezzo_vendita: 30, costo_acquisto: 10,
  quantita: 10, tipo_prodotto: "semplice", attivo: true, aliquota_iva_vendita: 22,
};
const FIERA = {
  id: "ev1", nome: "Fiera di prova", citta: "Napoli", stato: "programmato",
  data_inizio: oggi, data_fine: oggi, pos_banco_fino_al: fraDueOre, pos_banco_sconto_fiera: true,
};
const serie = (sei) => [0, 1, 2, 3].map(() => sei.map((percentuale, i) => ({ da: i * 16.5, a: (i + 1) * 16.5, percentuale })));
const FASCE = { soglie: [80, 120, 200], gruppi: serie([2, 4, 6, 8, 12, 15]) };
const TEAM = [{ evento_id: "ev1", persona_tipo: "venditore", persona_id: "v-olga", nome: "OLGA", vende_al_banco: true }];

const RISPOSTE = {
  "/auth/v1/user": { id: "u1", email: "x@y.it" },
  "chiave=eq.fasceSconto_eventi_carta": { valore: FASCE },
  "chiave=eq.fasceSconto_eventi_contanti": { valore: FASCE },
  "/eventi_team": TEAM,
  "/eventi": [FIERA],
};

async function banco({ venditore = { id: "v-olga", nome: "OLGA" }, ruolo = "user", eventi } = {}) {
  rispondiCon(eventi ? { ...RISPOSTE, "/eventi": eventi } : RISPOSTE);
  const p = await monta(
    <PaginaPOS
      prodottiShop={[PRODOTTO]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
      venditeShop={[]} corsiDate={[]} corsi={[]} location={[]} iscritti={[]} coupon={[]} bundleComponenti={[]}
      master={[]} assistente={[]} ricarica={() => {}} onBack={() => {}}
      utenteLoggato={{ id: "u1", nome: venditore.nome, venditoreId: venditore.id, permessi: ["pos"] }}
      venditoreLoggato={venditore} targetVenditeProdotti={[]} ruoloUtente={ruolo}
    />
  );
  await attendi(150);
  return p;
}

const pulito = (p) => (p.testo() || "").replace(/\s+/g, " ");
const tessera = (p) => [...p.nodo.querySelectorAll("div")]
  .find((d) => d.style.cursor === "pointer" && (d.textContent || "").includes(PRODOTTO.nome) && /IVA incl\./.test(d.textContent || ""));

describe("il POS fisico al banco della fiera", () => {
  it("chi vende al banco può scegliere il terminale, non solo il QR", async () => {
    const p = await banco();
    const t = pulito(p);
    expect(t).toContain("POS fisico");
    expect(t).toContain("Batti tu sul terminale");
    // QUATTRO TASTI, non due e poi altri due: il terminale sta accanto a
    // Stripe, ai contanti e al buono, non dentro la carta
    expect(t).toContain("Stripe");
    expect(t).toContain("Contanti");
    expect(t).toContain("Buono Amazon");
    expect(t, "la vecchia scelta annidata").not.toContain("Tipo di incasso carta");
    await p.smonta();
  });

  it("ma non si apre su NIENTE: il metodo si scegli ogni volta", async () => {
    // Dal 9/11/2026 (il titolare: «dopo una vendita si resetta ogni tipo
    // di pagamento e l'operatore deve scegliere ogni volta come
    // chiuderla»). Sostituisce il «si apre sul QR» del 7/11: col
    // terminale la vendita si registra senza che nessuno abbia visto i
    // soldi arrivare, ma nemmeno il QR deve essere già acceso — una
    // preselezione sul modo di incassare è la cosa che fa chiudere uno
    // scontrino col metodo del cliente di prima.
    const p = await banco();
    const t = pulito(p);
    expect(t).not.toContain("il QR si accende");
    expect(t).not.toContain("Incassa sul terminale");
    // i quattro tasti ci sono tutti, nessuno scelto
    expect(t).toContain("Stripe");
    expect(t).toContain("POS fisico");
    await p.smonta();
  });

  it("chi NON è al banco di quella fiera il terminale non lo vede", async () => {
    const p = await banco({ venditore: { id: "v-katia", nome: "KATIA" } });
    const t = pulito(p);
    expect(t).not.toContain("POS fisico");
    expect(t).not.toContain("Batti tu sul terminale");
    await p.smonta();
  });

  it("il terminale si scegli con un tocco, non con due", async () => {
    // era il difetto segnalato dal titolare: il tasto c'era ma stava
    // dentro il riquadro della carta, quindi per arrivarci bisognava
    // prima premere «carta» e poi sapere di dover premere ancora
    const p = await banco();
    const tasto = p.tasto("POS fisico");
    expect(tasto).toBeTruthy();
    await clicca(tasto);
    const t = pulito(p);
    expect(t).toContain("Incassa sul terminale");
    // e scegliendo il terminale il QR si toglie di mezzo: non sono due
    // strade aperte insieme
    expect(t).not.toContain("Mostra il QR");
    await p.smonta();
  });

  it("passata l'ora del banco, il terminale si spegne da sé", async () => {
    const p = await banco({ eventi: [{ ...FIERA, pos_banco_fino_al: new Date(Date.now() - 60000).toISOString() }] });
    expect(pulito(p)).not.toContain("POS fisico");
    await p.smonta();
  });
});

describe("il prezzo scritto a mano sulla riga", () => {
  const casellaPrezzo = (p) => p.nodo.querySelector('input[title^="Prezzo di questa riga"]');

  it("è il prezzo finale: lo sconto fiera non si applica sopra", async () => {
    const p = await banco({ ruolo: "programmatore" });
    await clicca(tessera(p));
    await attendi(80);
    // senza toccare niente: 36,60 pieni, 12% di fascia, si pagano 32,21
    expect(pulito(p)).toContain("32,21");

    const campo = casellaPrezzo(p);
    expect(campo, "la casella del prezzo di riga").toBeTruthy();
    await scrivi(campo, "30");
    await attendi(80);

    const t = pulito(p);
    // 30,00 scritti, 30,00 incassati: prima erano 26,40
    expect(t, "si incassa quello che c'è scritto").toContain("Totale da incassare30,00 €");
    expect(t, "e la riga lo dice").toContain("prezzo concordato, non si sconta");
    expect(t).not.toContain("26,40");
    expect(t).not.toContain("−12%");
    await p.smonta();
  });

  it("tornando al listino lo sconto riparte", async () => {
    // il tasto ↺ rimette il prezzo di partenza, e con esso la riga torna
    // a scontarsi: «finale» vale finché quel prezzo è scritto
    const p = await banco({ ruolo: "programmatore" });
    await clicca(tessera(p));
    await scrivi(casellaPrezzo(p), "30");
    await attendi(60);
    const ripristina = [...p.nodo.querySelectorAll("button")]
      .find((b) => (b.title || "").includes("Rimetti il prezzo di listino"));
    expect(ripristina, "il tasto che rimette il listino").toBeTruthy();
    await clicca(ripristina);
    await attendi(80);
    const t = pulito(p);
    expect(t).toContain("32,21");
    expect(t).not.toContain("prezzo concordato");
    await p.smonta();
  });
});

describe("la cifra scritta a mano, in più", () => {
  const casella = (p) => p.nodo.querySelector('input[title^="Una cifra in euro"]');

  it("la scrive il programmatore, e si somma allo sconto fiera", async () => {
    const p = await banco({ ruolo: "programmatore" });
    await clicca(tessera(p));
    await attendi(80);

    // 36,60 pieni, 12% di fascia = 4,39 → si pagano 32,21
    expect(pulito(p)).toContain("32,21");

    const campo = casella(p);
    expect(campo, "la casella «In più €»").toBeTruthy();
    // non è spenta dallo sconto fiera: è l'unica che si somma, ed è il
    // motivo per cui esiste
    expect(campo.disabled).toBeFalsy();
    await scrivi(campo, "0,66");
    await attendi(80);

    const t = pulito(p);
    expect(t, "quello che si incassa").toContain("31,55");
    expect(t, "la cifra a mano, detta per quello che è").toContain("In più a mano − 0,66 €");
    expect(t).toContain("di cui in più, a mano");
    await p.smonta();
  });

  it("le righe del carrello seguono il totale: 31,55 anche sul prodotto", async () => {
    // è il punto in cui due conti potrebbero staccarsi: la riga mostra il
    // prezzo scontato, e se non contasse la cifra a mano direbbe 32,21
    // mentre alla cassa se ne pagano 31,55
    const p = await banco({ ruolo: "programmatore" });
    await clicca(tessera(p));
    await scrivi(casella(p), "0,66");
    await attendi(80);
    const t = pulito(p);
    expect(t).toContain("31,55");
    expect(t).not.toContain("32,21");
    await p.smonta();
  });

  it("non si sconta più di quanto vale il carrello, e lo dice", async () => {
    const p = await banco({ ruolo: "programmatore" });
    await clicca(tessera(p));
    await scrivi(casella(p), "500");
    await attendi(80);
    const t = pulito(p);
    expect(t).toContain("più di così il carrello non si sconta");
    // il totale si ferma a zero e non va sotto: lo sconto è tagliato al
    // subtotale, e il carrello non può valere meno di niente
    expect(t).toContain("Totale da incassare0,00 €");
    expect(t).toContain("Sconto applicato− 36,60 €");
    await p.smonta();
  });

  it("chi non è programmatore quella casella non la vede", async () => {
    const p = await banco({ ruolo: "amministratore" });
    await clicca(tessera(p));
    await attendi(80);
    expect(casella(p)).toBeFalsy();
    expect(pulito(p)).not.toContain("In più");
    await p.smonta();
  });
});
