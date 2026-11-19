// IL POS DI CHI STA AL BANCO PARTE DALLA FIERA (7/11/2026).
//
// Richiesta del titolare, sabato mattina, con la fiera di Napoli aperta:
// «Da oggi fino a lunedi' i POS della vendita al banco di [otto persone]
// devono essere impostati di default su vendita legata a un evento,
// fiera di Napoli. Sconto fiera. Fino a lunedi' ore 20.»
//
// Queste prove stanno addosso ai due modi di sbagliare, che costano
// entrambi soldi e in direzioni opposte:
//   - NON preselezionare a chi vende al banco: la vendita resta fuori
//     dal conto della fiera (e il materiale partito non torna in pari)
//     e il cliente paga pieno davanti a un banco che lo sconto lo fa;
//   - preselezionare a chi NON e' al banco: le vendite di un corso suo
//     altrove finiscono nella fiera, con lo sconto della fiera sopra.
//
// I dati sono quelli veri della fiera di Napoli (7-9 novembre 2026),
// identita' comprese: nel team ANDREA PAURA c'e' come VENDITORE «ANDREA»
// mentre nell'app entra come MASTER, ed ELIA CITO il contrario.
import { describe, it, expect } from "vitest";
import { preselezioneBancoEvento } from "../src/App.jsx";

// --- la fiera, com'e' in archivio ----------------------------------------
const LUNEDI_20 = "2026-11-09T19:00:00.000Z";   // lunedi' 9 novembre, ore 20 a Roma
const NAPOLI = {
  id: "ev-napoli", nome: "Fiera di Napoli", citta: "Napoli", stato: "programmato",
  data_inizio: "2026-11-07", data_fine: "2026-11-09",
  pos_banco_fino_al: LUNEDI_20, pos_banco_sconto_fiera: true,
};

// --- le anagrafiche, con i legami veri fra identita' ---------------------
const MASTER = [
  // ANDREA PAURA e' master, ed e' collegato al venditore «ANDREA»
  { id: "m-andrea", nome: "ANDREA PAURA", venditore_id: "v-andrea" },
  // ELIA CITO e' master, ed e' collegato al venditore «ELIA CITO»
  { id: "m-elia", nome: "ELIA CITO", venditore_id: "v-elia" },
  // STELLA QUARESIMA e' master e basta
  { id: "m-stella", nome: "STELLA QUARESIMA", venditore_id: null },
  // una master che non c'entra niente con la fiera
  { id: "m-debora", nome: "DEBORA FUMAGALLI", venditore_id: null },
];
const ASSISTENTE = [
  { id: "a-andrea", nome: "ANDREA PAURA", master_id: "m-andrea" },
  { id: "a-alice", nome: "ALICE SALVITTO", master_id: null },
];
const IDENTITA = { master: MASTER, assistente: ASSISTENTE };

// il team della fiera, come lo scrive la scheda dell'evento
const TEAM = [
  { evento_id: "ev-napoli", persona_tipo: "venditore", persona_id: "v-andrea", nome: "ANDREA", vende_al_banco: true },
  { evento_id: "ev-napoli", persona_tipo: "master", persona_id: "m-elia", nome: "ELIA CITO", vende_al_banco: true },
  { evento_id: "ev-napoli", persona_tipo: "master", persona_id: "m-stella", nome: "STELLA QUARESIMA", vende_al_banco: true },
  { evento_id: "ev-napoli", persona_tipo: "venditore", persona_id: "v-olga", nome: "OLGA", vende_al_banco: true },
  // nel team ma al banco non vende
  { evento_id: "ev-napoli", persona_tipo: "master", persona_id: "m-debora", nome: "DEBORA FUMAGALLI", vende_al_banco: false },
  // alla fiera viene, ma in anagrafica non c'e'
  { evento_id: "ev-napoli", persona_tipo: "libero", persona_id: null, nome: "Miranda Raffaele", vende_al_banco: true },
];

const SABATO = new Date("2026-11-07T09:30:00.000Z");
const chiedi = (operatore, extra = {}) => preselezioneBancoEvento({
  operatore, eventi: [NAPOLI], team: TEAM, adesso: SABATO, identita: IDENTITA, ...extra,
});

describe("preselezioneBancoEvento", () => {
  it("chi vende al banco parte dalla fiera, con lo sconto fiera", () => {
    const pre = chiedi({ tipo: "venditore", id: "v-olga", nome: "OLGA" });
    expect(pre).toEqual({ eventoId: "ev-napoli", scontoFiera: true, nome: "Fiera di Napoli" });
  });

  it("una master al banco pure", () => {
    expect(chiedi({ tipo: "master", id: "m-stella" })?.eventoId).toBe("ev-napoli");
  });

  // IL CUORE DELLA FACCENDA: la stessa persona entra nell'app con
  // l'identita' della password che ha battuto, e nel team sta con quella
  // dell'anagrafica da cui e' stata presa. Le due non coincidono quasi
  // mai, e una regola scritta su una sola mancherebbe l'altra in
  // silenzio — cioe' proprio al banco, davanti al cliente.
  it("ANDREA PAURA: nel team come VENDITORE, al POS entra come MASTER", () => {
    expect(chiedi({ tipo: "master", id: "m-andrea" })?.eventoId).toBe("ev-napoli");
  });
  it("…e come assistente collegata alla sua master", () => {
    expect(chiedi({ tipo: "assistente", id: "a-andrea" })?.eventoId).toBe("ev-napoli");
  });
  it("ELIA CITO: nel team come MASTER, se entra come venditore lo trova comunque", () => {
    expect(chiedi({ tipo: "venditore", id: "v-elia" })?.eventoId).toBe("ev-napoli");
  });

  it("chi e' nel team ma non vende al banco NON parte dalla fiera", () => {
    expect(chiedi({ tipo: "master", id: "m-debora" })).toBe(null);
  });
  it("chi non c'entra con la fiera nemmeno", () => {
    expect(chiedi({ tipo: "venditore", id: "v-katia" })).toBe(null);
    expect(chiedi({ tipo: "assistente", id: "a-alice" })).toBe(null);
    expect(chiedi(null)).toBe(null);
    expect(chiedi({ tipo: "venditore" })).toBe(null);
  });

  // una riga libera non ha un'identita' nell'app: non esiste nessun POS
  // da far partire da qui, e farla valere «per nome» vorrebbe dire
  // preselezionare la fiera a chiunque si chiami come lei
  it("una riga libera del team non vale per nessuno", () => {
    const soloLibera = TEAM.filter((r) => !r.persona_id);
    expect(preselezioneBancoEvento({
      operatore: { tipo: "venditore", id: "v-olga" }, eventi: [NAPOLI],
      team: soloLibera, adesso: SABATO, identita: IDENTITA,
    })).toBe(null);
  });

  // «Fino a lunedi' ore 20»: alle 20 in punto il banco e' chiuso
  it("lunedi' alle 19:59 parte ancora dalla fiera, alle 20:00 no", () => {
    const olga = { tipo: "venditore", id: "v-olga" };
    expect(chiedi(olga, { adesso: new Date("2026-11-09T18:59:00.000Z") })?.eventoId).toBe("ev-napoli");
    expect(chiedi(olga, { adesso: new Date("2026-11-09T19:00:00.000Z") })).toBe(null);
    expect(chiedi(olga, { adesso: new Date("2026-11-10T08:00:00.000Z") })).toBe(null);
  });

  // e si spegne DA SE': nessuno deve ricordarsi di togliere le spunte
  it("passata l'ora non serve toccare niente: le spunte restano e non valgono", () => {
    const dopo = chiedi({ tipo: "master", id: "m-elia" }, { adesso: new Date("2026-11-30T10:00:00.000Z") });
    expect(dopo).toBe(null);
    expect(TEAM.filter((r) => r.vende_al_banco).length).toBeGreaterThan(0);
  });

  it("senza l'ora scritta non si preseleziona niente (ogni altro evento)", () => {
    const catania = { ...NAPOLI, id: "ev-catania", pos_banco_fino_al: null };
    expect(preselezioneBancoEvento({
      operatore: { tipo: "venditore", id: "v-olga" }, eventi: [catania],
      team: TEAM.map((r) => ({ ...r, evento_id: "ev-catania" })), adesso: SABATO, identita: IDENTITA,
    })).toBe(null);
  });

  // su una fiera chiusa la cassa e' stata tirata: attaccarci una vendita
  // nuova sposterebbe un conto gia' chiuso
  it("una fiera conclusa o annullata non preseleziona, anche con l'ora ancora valida", () => {
    for (const stato of ["concluso", "annullato"]) {
      expect(preselezioneBancoEvento({
        operatore: { tipo: "venditore", id: "v-olga" }, eventi: [{ ...NAPOLI, stato }],
        team: TEAM, adesso: SABATO, identita: IDENTITA,
      })).toBe(null);
    }
  });

  it("l'evento si puo' preselezionare senza lo sconto", () => {
    const senzaSconto = { ...NAPOLI, pos_banco_sconto_fiera: false };
    const pre = preselezioneBancoEvento({
      operatore: { tipo: "venditore", id: "v-olga" }, eventi: [senzaSconto],
      team: TEAM, adesso: SABATO, identita: IDENTITA,
    });
    expect(pre?.eventoId).toBe("ev-napoli");
    expect(pre?.scontoFiera).toBe(false);
  });

  // due fiere aperte sulla stessa persona non capitano, ma la risposta
  // deve essere la stessa a ogni giro: un POS che cambia evento da solo
  // fra due ricaricamenti e' peggio di uno che sbaglia sempre
  it("con due fiere aperte vince quella che chiude prima, sempre la stessa", () => {
    const altra = {
      ...NAPOLI, id: "ev-altra", nome: "Altra fiera",
      pos_banco_fino_al: "2026-11-20T19:00:00.000Z",
    };
    const team = [...TEAM, { evento_id: "ev-altra", persona_tipo: "venditore", persona_id: "v-olga", nome: "OLGA", vende_al_banco: true }];
    const giro = (eventi) => preselezioneBancoEvento({
      operatore: { tipo: "venditore", id: "v-olga" }, eventi, team, adesso: SABATO, identita: IDENTITA,
    })?.eventoId;
    expect(giro([NAPOLI, altra])).toBe("ev-napoli");
    expect(giro([altra, NAPOLI])).toBe("ev-napoli");
  });

  it("una data storta non fa partire niente e non butta giu' il banco", () => {
    expect(preselezioneBancoEvento({
      operatore: { tipo: "venditore", id: "v-olga" }, eventi: [{ ...NAPOLI, pos_banco_fino_al: "lunedì" }],
      team: TEAM, adesso: SABATO, identita: IDENTITA,
    })).toBe(null);
    expect(preselezioneBancoEvento({
      operatore: { tipo: "venditore", id: "v-olga" }, eventi: [NAPOLI],
      team: TEAM, adesso: new Date("niente"), identita: IDENTITA,
    })).toBe(null);
  });

  // senza le anagrafiche il legame fra identita' non si puo' fare, ma
  // l'identita' con cui si e' entrati vale sempre
  it("senza anagrafiche vale almeno l'identita' con cui si e' entrati", () => {
    const pre = preselezioneBancoEvento({
      operatore: { tipo: "master", id: "m-elia" }, eventi: [NAPOLI], team: TEAM, adesso: SABATO,
    });
    expect(pre?.eventoId).toBe("ev-napoli");
  });
});
