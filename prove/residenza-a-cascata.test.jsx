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
import { monta, scegli, voci } from "./aiuto.js";

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
    const com = p.tendina("citta_residenza");
    expect(com.disabled).toBe(false);
    expect(voci(com)).toContain("Paternò");
    await scegli(com, "Paternò");
    // un comune con un CAP solo non si fa scegliere: si scrive
    expect(p.tendina("cap_residenza").value).toBe("95047");
  });

  it("a Roma il CAP si scegle fra gli ottantadue, non si indovina", async () => {
    const p = await apri({});
    await scegli(p.tendina("regione_residenza"), "Lazio");
    await scegli(p.tendina("prov_residenza"), "RM");
    await scegli(p.tendina("citta_residenza"), "Roma");
    const cap = p.tendina("cap_residenza");
    expect(cap.disabled).toBe(false);
    expect(cap.value).toBe("");
    expect(voci(cap).length).toBe(82);
    await scegli(cap, "00166");
    expect(p.tendina("cap_residenza").value).toBe("00166");
  });

  it("cambiare regione non lascia in piedi la provincia di prima", async () => {
    const p = await apri({});
    await scegli(p.tendina("regione_residenza"), "Sicilia");
    await scegli(p.tendina("prov_residenza"), "CT");
    await scegli(p.tendina("citta_residenza"), "Paternò");
    await scegli(p.tendina("regione_residenza"), "Piemonte");
    expect(p.tendina("prov_residenza").value).toBe("");
    expect(p.tendina("citta_residenza").value).toBe("");
    expect(p.tendina("cap_residenza").value).toBe("");
  });
});

describe("le schede che esistono gia'", () => {
  it("una residenza senza provincia si vede comunque, e la provincia si ricava", async () => {
    const p = await apri({ citta_residenza: "SORSO" });
    expect(p.tendina("prov_residenza").value).toBe("SS");
    expect(p.tendina("citta_residenza").value).toBe("Sorso");
    expect(p.tendina("regione_residenza").value).toBe("Sardegna");
  });

  it("scritta in maiuscolo con l'accento mangiato si riconosce lo stesso", async () => {
    const p = await apri({ citta_residenza: "PATERNO", cap_residenza: "95047", prov_residenza: "CT" });
    expect(p.tendina("citta_residenza").value).toBe("Paternò");
  });

  it("un valore che nell'elenco non c'e' non si perde: resta, marcato", async () => {
    const p = await apri({ citta_residenza: "VIA CHIARI 29", prov_residenza: "BS" });
    expect(p.tendina("citta_residenza").value).toBe("VIA CHIARI 29");
    expect(p.testo()).toMatch(/fuori elenco/);
  });
});

describe("chi non vive in Italia", () => {
  it("«Altro stato» spegne la cascata e apre la scrittura libera", async () => {
    const p = await apri({});
    await scegli(p.tendina("stato_residenza"), "ALTRO");
    // la regione italiana non c'e' piu': non vuol dire niente a Sion
    expect(p.tendina("regione_residenza")).toBe(null);
    expect(p.tendina("citta_residenza")).toBe(null);
    expect(p.tendina("cap_residenza")).toBe(null);
    // e comune, CAP e nome dello stato si scrivono
    expect(p.campi().length).toBeGreaterThan(0);
  });

  it("una residenza estera gia' in archivio apre da se' in scrittura libera", async () => {
    const p = await apri({ stato_residenza: "SVIZZERA", citta_residenza: "SION", cap_residenza: "1950" });
    expect(p.tendina("citta_residenza")).toBe(null);
    const valori = p.campi().map((i) => i.value);
    expect(valori).toContain("SION");
    expect(valori).toContain("1950");
    expect(valori).toContain("SVIZZERA");
  });
});
