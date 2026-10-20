// I due gesti che ogni prova fa: montare e cliccare.
import React from "react";
import { createRoot } from "react-dom/client";
// `act` da "react" e non da "react-dom/test-utils": la seconda e'
// deprecata e stampa un avviso a ogni prova, che in venti prove diventa
// rumore in cui si perde quello che conta.
import { act } from "react";

export async function monta(elemento) {
  const nodo = document.createElement("div");
  document.body.appendChild(nodo);
  const radice = createRoot(nodo);
  await act(async () => { radice.render(elemento); });
  await attendi();
  return {
    nodo,
    testo: () => nodo.textContent || "",
    tasto: (etichetta) => [...nodo.querySelectorAll("button")]
      .find((b) => (b.textContent || "").includes(etichetta)),
    campi: () => [...nodo.querySelectorAll("input")],
    tendine: () => [...nodo.querySelectorAll("select")],
    // la tendina di un campo, per la sua chiave: l'etichetta si traduce
    // e la posizione si sposta, la chiave no
    tendina: (chiave) => nodo.querySelector(`select[data-campo="${chiave}"]`),
    smonta: () => act(async () => { radice.unmount(); }),
  };
}

// React 18 disegna dopo: senza questa attesa si guarda la pagina mentre e'
// ancora vuota, e la prova fallisce per un motivo che non c'entra.
export async function attendi(ms = 60) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}

export async function clicca(elemento) {
  await act(async () => {
    elemento?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  await attendi();
}

export async function scrivi(campo, valore) {
  // il setter giusto dipende dall'elemento: quello di HTMLInputElement
  // su una <textarea> lancia "called on an object that is not a valid
  // instance", e la prova sembra rotta per un motivo che non c'entra
  const prototipo = campo?.tagName === "TEXTAREA"
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototipo, "value").set;
  await act(async () => {
    setter.call(campo, valore);
    campo.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await attendi();
}

export async function scegli(tendina, valore) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
  await act(async () => {
    setter.call(tendina, valore);
    tendina.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await attendi();
}

// Le voci di una tendina, senza la prima che e' il "— scegli —"
export function voci(tendina) {
  return [...(tendina?.options || [])].slice(1).map((o) => o.value);
}

// Premere col dito/mouse SENZA rilasciare. Serve per le tendine dei
// suggerimenti: ascoltano `mousedown` e non `click`, perche' il blur
// della casella arriva prima del clic e chiuderebbe l'elenco mentre il
// dito e' ancora a mezz'aria.
export async function premi(elemento) {
  await act(async () => {
    elemento?.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
  });
  await attendi();
}
