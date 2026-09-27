// Le icone dei reparti del listino: una per blocco, disegnate qui perché
// quelle dell'app vivono dentro App.jsx e non sono esportate. Tratto
// sottile e un colore solo, come il resto: nel disco crema dell'intestazione
// devono leggersi a 22 pixel, non raccontare una storia.
import React from "react";

const base = (s, c) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" });

export function IcoPigmenti({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-1.6-1.4-1.9-1.4-3 0-.8.7-1.4 1.6-1.4H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" /><circle cx="7.5" cy="11" r="1" fill={c} stroke="none" /><circle cx="11" cy="7.5" r="1" fill={c} stroke="none" /><circle cx="15.5" cy="8.5" r="1" fill={c} stroke="none" /></svg>);
}
export function IcoColle({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M12 3c0 3-4 5.5-4 9a4 4 0 0 0 8 0c0-3.5-4-6-4-9Z" /><path d="M10.5 13.5a1.6 1.6 0 0 0 1.6 1.6" /></svg>);
}
export function IcoDermografi({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M15.5 3.5 20 8l-9.5 9.5-5.2 1.2 1.2-5.2Z" /><path d="m13.5 5.5 5 5" /></svg>);
}
export function IcoAghi({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M4 20 20 4" /><path d="M14.5 4h5.5v5.5" /><path d="m9 13 2 2" /><path d="m11.5 10.5 2 2" /></svg>);
}
export function IcoMicroblading({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M4 18c4-1 6-3 8.5-6.5S17 5 20 4c-.5 3.5-2 6.5-4.5 9.5S8 18.5 4 18Z" /><path d="M4 18c2.8.4 5.2.2 7.2-.6" /></svg>);
}
export function IcoLash({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M2.5 13c3-4 6.2-6 9.5-6s6.5 2 9.5 6" /><path d="M5 15.5 3.5 19M9 17l-.7 3.5M12 17.5V21M15 17l.7 3.5M19 15.5 20.5 19" /></svg>);
}
export function IcoLaminazione({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M4 8c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0" /><path d="M4 13c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0" /><path d="M4 18c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0" /></svg>);
}
export function IcoHenne({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M12 21c4.5-3 7-6.5 7-10a7 7 0 0 0-14 0c0 3.5 2.5 7 7 10Z" /><path d="M12 21V9" /><path d="m12 13 3-2.5M12 16l-3-2.5" /></svg>);
}
export function IcoNeedling({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><circle cx="12" cy="12" r="8" /><path d="M12 7v10M7 12h10" /><circle cx="12" cy="12" r="1.6" fill={c} stroke="none" /></svg>);
}
export function IcoProgettazione({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M4 20 8 19 20 7l-3-3L5 16Z" /><path d="M14.5 6.5 17.5 9.5" /><path d="M4 20h16" /></svg>);
}
export function IcoAccessori({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M5 8h14l-1 12H6Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>);
}
export function IcoWear({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><path d="M9 4 5 6 3.5 10l2.5 1v9h12v-9l2.5-1L19 6l-4-2-3 2Z" /></svg>);
}
export function IcoAltri({ s = 22, c = "currentColor" }) {
  return (<svg {...base(s, c)}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 12h6" /></svg>);
}

export function iconaDelBlocco(n) {
  return { 1: IcoPigmenti, 2: IcoColle, 3: IcoDermografi, 4: IcoAghi, 5: IcoMicroblading,
           6: IcoLash, 7: IcoLaminazione, 8: IcoHenne, 9: IcoNeedling, 10: IcoProgettazione,
           11: IcoAccessori, 12: IcoWear }[n] || IcoAltri;
}
