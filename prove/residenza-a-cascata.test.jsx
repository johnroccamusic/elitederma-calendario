// LA RESIDENZA A CASCATA.
//
// Il gesto vero: si scende per gradini e ognuno apre il successivo. Qui
// non si controlla che il codice esista, si clicca — perche' il guasto
// da cui si viene e' una tendina che restava spenta e nascondeva una
// residenza che c'era.
import { describe, it, expect } from "vitest";
import React, { useState } from "react";
import { AreaAnagrafica } from "../src/iscrizione/AreeAnagrafiche.jsx";
import { AREA_ALLIEVO } from "../src/iscrizione/disposizione.js";
import { capDiComune } from "../src/comuni-regioni.js";
import { monta, scegli, voci, scegliCercando, scegliVoce, proposteDi, campoDi } from "./aiuto.js";

// La scheda vera tiene i valori e li riscrive: senza questo la cascata
// non si muove e si proverebbe una fotografia, non un gesto.
function Scheda({ iniziali = {} }) {
  const [valori, setValori] = useState(iniziali);
  return (
    <AreaAnagrafica
      area={AREA_ALLIEVO}
      valori={valori}
      scrivi={(chiave, v) => setValori((p) => ({ ...p, [chiave]: v }))}
    />
  );
}
const apri = (iniziali) => monta(<Scheda iniziali={iniziali} />);

describe("la residenza si scende per gradini", () => {
  it("su una scheda vuota solo la regione si puo' scegliere", async () => {
    const p = await apri({});
    expect(p.tendina("regione_residenza").disabled).toBe(false);
    expect(p.tendina("prov_residenza").disabled).toBe(true);
    expect(p.tendina("citta_residenza").disabled).toBe(true);
    expect(p.tendina("cap_residenza").disabled).toBe(true);
    expect(p.testo()).toMatch(/prima la regione/);
    expect(p.testo()).toMatch(/prima la provincia/);
    expect(p.testo()).toMatch(/prima il comune/);
  });

  it("la regione apre le sue province, e solo quelle", async () => {
    const p = await apri({});
    await scegli(p.tendina("regione_residenza"), "Sicilia");
    const prov = p.tendina("prov_residenza");
    expect(prov.disabled).toBe(false);
    expect(voci(prov)).toEqual(["AG", "CL", "CT", "EN", "ME", "PA", "RG", "SR", "TP"]);
    expect(voci(prov)).not.toContain("RM");
  });

  it("la provincia apre i suoi comuni, e il comune scrive il CAP da se'", async () => {
    const p = await apri({});
    await scegli(p.tendina("regione_residenza"), "Sicilia");
    await scegli(p.tendina("prov_residenza"), "CT");
    // 58 comuni: sopra le venti voci si cerca invece di scorrere
    expect(campoDi(p, "citta_residenza").disabled).toBe(false);
    expect(await proposteDi(p, "citta_residenza", "patern")).toContain("Paternò");
    await scegliVoce(p, "citta_residenza", "Paternò");
    // un comune con un CAP solo non si fa scegliere: si scrive
    expect(campoDi(p, "cap_residenza").value).toBe("95047");
  });

  it("a Roma il CAP si scegle fra gli ottantadue, non si indovina", async () => {
    const p = await apri({});
    await scegli(p.tendina("regione_residenza"), "Lazio");
    await scegli(p.tendina("prov_residenza"), "RM");
    await scegliVoce(p, "citta_residenza", "Roma");
    // ottantadue CAP non si scorrono: si scrivono le prime cifre
    expect(campoDi(p, "cap_residenza").disabled).toBe(false);
    expect(campoDi(p, "cap_residenza").value).toBe("");
    expect(capDiComune("RM", "Roma").length).toBe(82);
    await scegliVoce(p, "cap_residenza", "00166");
    expect(campoDi(p, "cap_residenza").value).toBe("00166");
  });

  it("cambiare regione non lascia in piedi la provincia di prima", async () => {
    const p = await apri({});
    await scegli(p.tendina("regione_residenza"), "Sicilia");
    await scegli(p.tendina("prov_residenza"), "CT");
    await scegliVoce(p, "citta_residenza", "Paternò");
    await scegli(p.tendina("regione_residenza"), "Piemonte");
    expect(p.tendina("prov_residenza").value).toBe("");
    expect(campoDi(p, "citta_residenza").value).toBe("");
    expect(campoDi(p, "cap_residenza").value).toBe("");
  });
});

describe("le schede che esistono gia'", () => {
  it("una residenza senza provincia si vede comunque, e la provincia si ricava", async () => {
    const p = await apri({ citta_residenza: "SORSO" });
    expect(p.tendina("prov_residenza").value).toBe("SS");
    expect(campoDi(p, "citta_residenza").value).toBe("Sorso");
    expect(p.tendina("regione_residenza").value).toBe("Sardegna");
  });

  it("scritta in maiuscolo con l'accento mangiato si riconosce lo stesso", async () => {
    const p = await apri({ citta_residenza: "PATERNO", cap_residenza: "95047", prov_residenza: "CT" });
    expect(campoDi(p, "citta_residenza").value).toBe("Paternò");
  });

  it("un valore che nell'elenco non c'e' non si perde: resta, marcato", async () => {
    const p = await apri({ citta_residenza: "VIA CHIARI 29", prov_residenza: "BS" });
    expect(campoDi(p, "citta_residenza").value).toMatch(/VIA CHIARI 29/);
  });
});

describe("chi non vive in Italia", () => {
  it("«Altro stato» spegne la cascata e apre la scrittura libera", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Altro");
    // la regione italiana non c'e' piu': non vuol dire niente a Sion
    expect(p.tendina("regione_residenza")).toBe(null);
    expect(p.tendina("citta_residenza")).toBe(null);
    expect(p.tendina("cap_residenza")).toBe(null);
    // e comune, CAP e nome dello stato si scrivono
    expect(p.campi().length).toBeGreaterThan(0);
  });

  it("una residenza di uno Stato senza elenco apre da se' in scrittura libera", async () => {
    // Il Belgio non ha elenco: la' le caselle sono quelle di prima.
    const p = await apri({ stato_residenza: "BELGIO", citta_residenza: "LIEGI", cap_residenza: "4000" });
    expect(p.tendina("citta_residenza")).toBe(null);
    const valori = p.campi().map((i) => i.value);
    expect(valori).toContain("LIEGI");
    expect(valori).toContain("4000");
    // lo Stato invece si scegli dalla tendina, non si scrive
    expect(p.casella("stato_residenza").value).toBe("Belgio");
  });

  // LA SVIZZERA NON E' PIU' «ALTRO STATO» (7/11/2026): ha il suo
  // elenco, e una residenza svizzera gia' in archivio apre con la
  // cascata invece che in scrittura libera. La prova di prima diceva
  // il contrario, ed era giusta finche' quell'elenco non c'era.
  it("una residenza svizzera gia' in archivio apre con la sua cascata", async () => {
    const p = await apri({ stato_residenza: "SVIZZERA", citta_residenza: "SION", cap_residenza: "1950" });
    expect(campoDi(p, "citta_residenza").value).toBe("Sion");
    // il cantone si ricava dalla localita', come la provincia dal comune
    expect(campoDi(p, "prov_residenza").value).toMatch(/VS/);
    expect(campoDi(p, "cap_residenza").value).toBe("1950");
  });

});

describe("la disposizione dei gradini", () => {
  // L'AREA SI CHIAMA «Dati anagrafici» E DENTRO HA UN'INTESTAZIONE
  // (7/11/2026, chiesta dal titolare): raccoglie due cose diverse —
  // chi e' quella persona e dove vive — e da «Dati residenza:» in giu'
  // comincia la seconda.
  it("l'area si chiama Dati anagrafici e dentro stacca i dati di residenza", async () => {
    const p = await apri({});
    expect(p.testo()).toMatch(/Dati anagrafici/);
    expect(p.testo()).not.toMatch(/Dati dell'allievo/);
    const testo = p.testo();
    // l'intestazione sta DOPO il campo fiscale e PRIMA dei gradini
    const titolo = testo.indexOf("Dati residenza:");
    expect(titolo).toBeGreaterThan(-1);
    expect(titolo).toBeGreaterThan(testo.indexOf("Identificativo fiscale"));
    expect(titolo).toBeLessThan(testo.indexOf("Regione"));
  });

  it("regione e provincia stanno su una riga sola e non vanno a capo", async () => {
    // jsdom non impagina, quindi non si misura: si guarda la struttura,
    // che e' quella che decide. Due caselle nello stesso contenitore
    // `nowrap` sono una riga; in due contenitori sono due righe.
    //
    // Lo Stato non sta piu' qui: dal 7/11/2026 e' salito in testa
    // all'area, accanto allo Stato di nascita, perche' decide tutto
    // quello che sta sotto — vedi la prova dell'ordine in
    // residenza-svizzera.test.jsx.
    const p = await apri({});
    let riga = p.tendina("regione_residenza");
    while (riga && !riga.contains(p.tendina("prov_residenza"))) riga = riga.parentElement;
    expect(riga).not.toBe(null);
    expect(riga.contains(p.tendina("citta_residenza"))).toBe(false);
    // `aCapo: false` non scrive "nowrap": smette di scrivere "wrap",
    // che in flexbox e' la stessa cosa
    expect(riga.style.flexWrap).not.toBe("wrap");
  });

  it("le caselle di una riga partono tutte dalla stessa altezza", async () => {
    // «opzionale» andava a capo da se' su «Stato» e «Provincia» e non su
    // «Regione», piu' corta: tre etichette alte diverse e tre tendine
    // sfalsate. Adesso «opzionale» sta su una riga sua sempre, e lo
    // spazio riservato all'etichetta e' lo stesso per tutte.
    const p = await apri({});
    const etichette = ["stato_nascita", "stato_residenza", "regione_residenza", "prov_residenza"].map((k) => {
      let n = p.tendina(k) || p.casella(k);
      while (n && !n.previousElementSibling) n = n.parentElement;
      return n?.previousElementSibling;
    });
    expect(etichette.every(Boolean)).toBe(true);
    for (const e of etichette) expect(e.style.minHeight).toBe("28px");
    // e l'«opzionale» e' un blocco suo, non una parola in coda al nome
    const opzionale = [...etichette[1].querySelectorAll("span")]
      .find((x) => x.textContent.trim() === "opzionale");
    expect(opzionale).toBeTruthy();
    expect(opzionale.style.display).toBe("block");
  });
});
