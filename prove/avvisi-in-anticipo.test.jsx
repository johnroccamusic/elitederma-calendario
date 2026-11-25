// GLI AVVISI DI RESEND CHE ARRIVANO PRIMA DELLA LORO RIGA (25/11/2026).
//
// Il titolare, guardando la prima campagna vera: «ma perché su 400 e
// passa mail ricevute solo 92?».
//
// MISURATO PRIMA DI TOCCARE NIENTE. Resend, sul 24-25/11: 652 partite,
// 555 consegnate, 97 rimbalzate. L'app ne aveva registrate 133
// consegnate e 43 rimbalzate, e 301 righe di quella campagna erano
// ferme a «preso in carico».
//
// LA CAUSA: Resend risponde al lotto con cento id, e l'invio li
// scriveva sulle righe UNO PER UNO — due o tre secondi. Resend però
// consegna, e incassa i rimbalzi, in meno di un secondo: l'avviso
// arrivava, cercava la riga PER ID, non trovava niente, e si rispondeva
// 200. Da lì l'avviso era perso per sempre, perché a Resend avevamo
// detto «ricevuto». A perdersi erano soprattutto i rimbalzi, che sono i
// più veloci.
//
// QUESTA PROVA NON POTEVA ESSERE UNA PROVA DI PAGINA: il guasto viveva
// fra la funzione d'invio, il webhook e il database. Si rileggono quei
// tre e si pretende che la strada nuova resti quella.
import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";
import { DestinatariCampagna } from "../src/crm/ComponiMail.jsx";

const radice = path.resolve(__dirname, "..");
const leggi = (p) => fs.readFileSync(path.join(radice, p), "utf8");
const migrazione = leggi("supabase/migrations/20261125180000_gli_avvisi_in_anticipo_non_si_perdono.sql");
const invia = leggi("supabase/functions/crm-campagna-invia/index.ts");
const eventi = leggi("supabase/functions/email-eventi/index.ts");
const riallinea = leggi("supabase/functions/crm-campagna-riallinea/index.ts");

describe("un avviso in anticipo non si butta", () => {
  it("il database ha dove metterlo da parte, e sa quando è stato applicato", () => {
    expect(migrazione).toMatch(/create table if not exists public\.email_eventi_orfani/);
    expect(migrazione).toContain("applicato_il");
    // e non si parcheggia quello che non sposterebbe nessuno stato: in
    // una notte di rinvii sarebbero centinaia di righe per nulla
    expect(migrazione).toContain("p_parcheggia and v_nuovo is not null");
  });

  it("il webhook non butta più l'avviso che non trova la sua riga", () => {
    expect(eventi).toContain("crm_campagna_applica_evento");
    // la scala degli stati stava qui dentro: adesso sta nel database, in
    // un posto solo. Due copie direbbero due verità sulla stessa riga
    expect(eventi).not.toContain("const SCALA");
    expect(eventi).not.toMatch(/consegnata:\s*2/);
  });

  it("gli id del lotto si scrivono in UNA scrittura, non in cento", () => {
    expect(invia).toContain("crm_campagna_segna_inviate");
    // la riga di prima: un update per destinatario dentro il ciclo
    expect(invia).not.toMatch(/for \(let i = 0; i < destinatari\.length; i\+\+\)[\s\S]{0,400}\.update\(\{ stato: "inviata"/);
  });

  it("e la stessa scrittura recupera gli avvisi messi da parte", () => {
    expect(migrazione).toMatch(/from email_eventi_orfani o[\s\S]{0,300}applicato_il is null/);
    expect(migrazione).toContain("perform public.crm_campagna_applica_evento");
    expect(invia).toContain("recuperati");
  });

  it("la scala sta in un posto solo e non torna mai indietro", () => {
    expect(migrazione).toContain('"rimbalzata":4');
    expect(migrazione).toMatch(/coalesce\(\(v_scala ->> v_nuovo\)::int, 0\) > coalesce\(\(v_scala ->> d\.stato\)::int, 0\)/);
  });

  it("le due funzioni del database le può chiamare solo il server", () => {
    // sono scritture sugli stati di una campagna: dalla chiave del
    // bundle non si devono poter chiamare
    expect(migrazione).toMatch(/revoke all on function public\.crm_campagna_applica_evento[\s\S]{0,200}from public, anon, authenticated/);
    expect(migrazione).toMatch(/revoke all on function public\.crm_campagna_segna_inviate[\s\S]{0,200}from public, anon, authenticated/);
  });
});

describe("rimettere in pari gli stati chiedendoli a Resend", () => {
  it("la funzione legge e non spedisce", () => {
    expect(riallinea).toContain("https://api.resend.com/emails/");
    expect(riallinea).not.toContain("/emails/batch");
    expect(riallinea).not.toContain('method: "POST"');
    // scrive con la stessa scala di tutti gli altri avvisi, e non
    // parcheggia niente: qui la riga c'è per forza
    expect(riallinea).toContain("crm_campagna_applica_evento");
    expect(riallinea).toContain("p_parcheggia: false");
  });

  it("guarda solo le righe ferme, e dice quante ne restano", () => {
    expect(riallinea).toMatch(/\.eq\("stato", "inviata"\)/);
    expect(riallinea).toContain("minutiFermi");
    expect(riallinea).toContain("restanti");
  });

  it("si ferma se Resend chiede di rallentare", () => {
    expect(riallinea).toContain("r.status === 429");
  });

  it("il tasto c'è, chiede a Resend e lo dice", async () => {
    const chiamate = [];
    rispondiCon({
      "functions/v1/crm-campagna-riallinea": (corpo) => {
        chiamate.push(corpo);
        return { ok: true, guardate: 100, aggiornate: 74, restanti: chiamate.length < 2 ? 50 : 0 };
      },
      "/rest/v1/crm_campagne_destinatari": () => [],
    });
    const p = await monta(<DestinatariCampagna campagnaId="c1" />);
    await clicca(p.tasto("Destinatari, uno per uno"));
    await attendi(150);
    const tasto = p.nodo.querySelector('[data-campo="rimetti-in-pari"]');
    expect(tasto).toBeTruthy();
    await clicca(tasto);
    await attendi(150);
    // ha ripetuto finché non è rimasto niente, e ha detto cosa ha fatto
    expect(chiamate.length).toBe(2);
    expect(chiamate[0].campagnaId).toBe("c1");
    expect(p.testo()).toContain("200 chieste a Resend");
    expect(p.testo()).toContain("148 rimesse in pari");
    await p.smonta();
  });
});
