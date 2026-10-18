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
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => {
    setter.call(campo, valore);
    campo.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await attendi();
}
