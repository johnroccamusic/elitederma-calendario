// L'IMPORT DA VETTA: le funzioni pure provate sui casi veri trovati nel
// CRM il 30/10/2026 — citta' in inglese, «italia» al posto della citta',
// omonimi in due province, nomi di attivita' al posto delle persone.
import { describe, it, expect } from "vitest";
import { riconosciComune, luogoRichiesta, separaNome, telefonoPulito, emailPulita, corsiCanonici, leggiDatiAggiuntivi, siglaProvincia, nomeRegione, nomeAgenteDaEmail, mestiereDa } from "../scripts/vetta-normalizza.mjs";

describe("il luogo", () => {
  it("riconosce le città scritte in inglese", () => {
    expect(riconosciComune("Naples").comune).toBe("Napoli");
    expect(riconosciComune("Turin")).toMatchObject({ comune: "Torino", provincia: "TO", regione: "Piemonte" });
  });
  it("«italia» non è una città: vuoto e segnalato", () => {
    const r = riconosciComune("italia");
    expect(r.comune).toBe(""); expect(r.dubbio).toBe(true);
  });
  it("un omonimo in due province resta vuoto senza la provincia, si risolve con", () => {
    // San Teodoro esiste in Sardegna (SS) e in Sicilia (ME)
    expect(riconosciComune("San Teodoro").dubbio).toBe(true);
    expect(riconosciComune("San Teodoro", "SASSARI")).toMatchObject({ comune: "San Teodoro", provincia: "SS" });
    // e con una provincia che non c'entra (in Vetta c'era «MODENA») resta vuoto
    expect(riconosciComune("San Teodoro", "MODENA").dubbio).toBe(true);
  });
  it("la provincia fra parentesi disambigua e la provincia Vetta scritta male si segnala", () => {
    expect(riconosciComune("Camaiore (LU)")).toMatchObject({ comune: "Camaiore", provincia: "LU" });
    const r = riconosciComune("Imola", "RAVENNA");
    expect(r).toMatchObject({ comune: "Imola", provincia: "BO" }); expect(r.nota).toContain("RA");
  });
  it("«Reggio Emilia» trova Reggio nell'Emilia", () => {
    expect(riconosciComune("Reggio Emilia").comune).toBe("Reggio nell'Emilia");
  });
  it("senza città valgono provincia e regione di Vetta", () => {
    expect(luogoRichiesta({ city: "", provincia: "FORLI_CESENA", regione: "" })).toMatchObject({ provincia: "FC", regione: "Emilia-Romagna", fonte: "vetta" });
    expect(luogoRichiesta({ city: "", provincia: "", regione: "FRIULI_VENEZIA_GIULIA" }).regione).toBe("Friuli-Venezia Giulia");
    expect(siglaProvincia("REGGIO_CALABRIA")).toBe("RC");
    expect(siglaProvincia("MONZA_BRIANZA")).toBe("MB");
    expect(nomeRegione("EMILIA_ROMAGNA")).toBe("Emilia-Romagna");
  });
});

describe("il nome", () => {
  it("separa nome e cognome scritti tutti nel nome", () => {
    expect(separaNome("Pamela Forte", "")).toMatchObject({ nome: "Pamela", cognome: "Forte", motivo: "" });
    expect(separaNome("Laura ", "ReA")).toMatchObject({ nome: "Laura", cognome: "ReA" });
  });
  it("segnala vuoti, attività e nomi soli", () => {
    expect(separaNome("", "").motivo).toBe("nome vuoto");
    expect(separaNome("Centro estetico e solarium", "").motivo).toContain("attività");
    expect(separaNome("Roxy Bar", "").motivo).toContain("attività");
    expect(separaNome("Penelope", "").motivo).toContain("solo il nome");
  });
});

describe("recapiti, corsi, mestieri", () => {
  it("telefono con prefisso e email in minuscolo", () => {
    expect(telefonoPulito("342 123 7696", "+39")).toBe("393421237696");
    expect(telefonoPulito("+39 3421237696")).toBe("393421237696");
    expect(emailPulita(" Razzano.M@Libero.it ")).toBe("razzano.m@libero.it");
    expect(emailPulita("adireggio@gnail")).toBe("");
  });
  it("i corsi di Vetta e di Genion finiscono sulle stesse etichette", () => {
    expect(corsiCanonici(["MICROBLADING_MICROSHADING", "TRICO_PIGMENTAZIONE", "LAMINAZIONE_CIGLIA_E_SOPRACCIGLIA"])).toEqual(["Microblading", "Tricopigmentazione", "Laminazione"]);
    expect(corsiCanonici(["PMU BASE", "LAMIN IND SOPRA+IKE", "NEEDLING", "AREOLART", "HENNE INDIVI"])).toEqual(["PMU", "Laminazione", "Microneedling", "Areola", "Hennè"]);
    expect(corsiCanonici(["DERMOPIGMENTAZIONE_COMPLETO", "ALTRO"])).toEqual(["PMU", "Altro"]);
  });
  it("legge i vecchi form dal testo HTML", () => {
    const d = leggiDatiAggiuntivi("<br><b>Settore: </b>Estetista<br><b>Corso scelto: </b>Corso Microblading Base, Corso trucco permanente con dermografo Base<br><b>Preferenza giorno: </b>Lunedì<br><b>Preferenza ora: </b>13.30-14.00");
    expect(d).toMatchObject({ settore: "Estetista", giorno: "Lunedì", ora: "13.30-14.00" });
    expect(d.corsi).toEqual(["Microblading", "PMU"]);
    expect(leggiDatiAggiuntivi("<br><b>Form di origine: </b>Corso di Laminazione RM+MI")).toMatchObject({ form: "Corso di Laminazione RM+MI", corsi: ["Laminazione"] });
    expect(leggiDatiAggiuntivi("Corso PMU + Micro").corsi).toEqual(["PMU", "Microblading"]);
  });
  it("mestieri e agenti storici", () => {
    expect(mestiereDa("LASH_MAKER")).toBe("lash maker");
    expect(mestiereDa("TEST_OPTION")).toBe("");
    expect(nomeAgenteDaEmail("gabrieleelitedermaacademy@gmail.com")).toBe("Gabriele");
    expect(nomeAgenteDaEmail("pinco.pallo7@gmail.com")).toBe("Pinco Pallo");
  });
});
