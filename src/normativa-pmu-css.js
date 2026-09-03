// Il foglio di stile della "Mappa Normativa PMU", identico all'originale
// tranne per una cosa: ogni regola e' racchiusa dentro ".mappa-pmu", e le
// variabili che stavano su :root stanno sul contenitore. Senza questo,
// "body{background:...}" e i colori del tema avrebbero cambiato l'aspetto
// di tutta l'app, non solo di questa pagina.
export const CSS_NORMATIVA_PMU = `
.mappa-pmu{
  --bg:#FAF7F3; --bg2:#F1ECE5; --ink:#221D1A; --ink2:#5C534D; --line:#E2D9CF;
  --est:#8C3B4A; --est-soft:#F6E6E9; --alt:#2F5D62; --alt-soft:#E1EEEF;
  --warn:#9A6A12; --warn-soft:#F8EDD3; --ok:#3F6B3A; --ok-soft:#E4EFE1;
  --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  --body:'Source Sans 3','Segoe UI',system-ui,sans-serif;
  --disp:'Fraunces',Georgia,'Times New Roman',serif;
  background:var(--bg);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.55;
}
.mappa-pmu *{box-sizing:border-box}
.mappa-pmu a{color:inherit;text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px}
.mappa-pmu a:hover{text-decoration-color:currentColor}
.mappa-pmu :focus-visible{outline:2px solid var(--est);outline-offset:2px}
.mappa-pmu .wrap{max-width:1180px;margin:0 auto;padding:0 20px 80px}
.mappa-pmu header.top{padding:48px 0 28px;border-bottom:1px solid var(--line)}
.mappa-pmu .eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}
.mappa-pmu h1{font-family:var(--disp);font-weight:600;font-size:clamp(34px,5vw,54px);line-height:1.05;margin:10px 0 14px;text-wrap:balance;letter-spacing:-.01em}
.mappa-pmu .lede{font-size:19px;max-width:66ch;color:var(--ink2);margin:0 0 20px}
.mappa-pmu .meta{display:flex;flex-wrap:wrap;gap:10px 22px;font-family:var(--mono);font-size:12.5px;color:var(--ink2)}
.mappa-pmu .layout{display:grid;grid-template-columns:1fr;gap:40px;margin-top:32px}
@media(min-width:1040px){.mappa-pmu .layout{grid-template-columns:220px minmax(0,1fr)}}
.mappa-pmu nav.side{display:none}
@media(min-width:1040px){
  .mappa-pmu nav.side{display:block;position:sticky;top:118px;align-self:start;font-size:13.5px;max-height:calc(100vh - 140px);overflow:auto;padding-right:8px}
  .mappa-pmu nav.side .grp{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2);margin:16px 0 6px}
  .mappa-pmu nav.side .grp:first-child{margin-top:0}
  .mappa-pmu nav.side a{display:block;padding:3px 0;text-decoration:none;color:var(--ink)}
  .mappa-pmu nav.side a:hover{color:var(--est)}
}
.mappa-pmu main{min-width:0}
.mappa-pmu h2{font-family:var(--disp);font-weight:600;font-size:30px;line-height:1.15;margin:0 0 6px;text-wrap:balance}
.mappa-pmu h3{font-family:var(--disp);font-weight:600;font-size:21px;margin:0 0 10px;text-wrap:balance}
.mappa-pmu h4{font-size:13px;font-family:var(--mono);letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px;font-weight:500}
.mappa-pmu section.block{padding:36px 0;border-bottom:1px solid var(--line)}
.mappa-pmu p{margin:0 0 12px;max-width:72ch}
.mappa-pmu ul{margin:0 0 12px;padding-left:20px;max-width:72ch}
.mappa-pmu li{margin:0 0 6px}
.mappa-pmu .k{font-family:var(--mono);font-size:13.5px}
.mappa-pmu .legend{display:grid;gap:14px;grid-template-columns:1fr;margin-top:18px}
@media(min-width:720px){.mappa-pmu .legend{grid-template-columns:1fr 1fr}}
.mappa-pmu .fig{padding:16px 18px;border-radius:6px;border:1px solid var(--line);background:var(--bg2)}
.mappa-pmu .fig.est{border-left:4px solid var(--est)}
.mappa-pmu .fig.alt{border-left:4px solid var(--alt)}
.mappa-pmu .fig h4.est{color:var(--est)} .mappa-pmu .fig h4.alt{color:var(--alt)}
.mappa-pmu .fig p{font-size:15px;margin:0}
.mappa-pmu .cards{display:grid;gap:16px;grid-template-columns:1fr;margin-top:18px}
@media(min-width:800px){.mappa-pmu .cards{grid-template-columns:1fr 1fr}}
.mappa-pmu .card{padding:18px 20px;border:1px solid var(--line);border-radius:6px;background:var(--bg2)}
.mappa-pmu .card p,.mappa-pmu .card li{font-size:15px}
.mappa-pmu .card ul{padding-left:18px}
.mappa-pmu .tablewrap{overflow-x:auto;margin-top:18px;border:1px solid var(--line);border-radius:6px}
.mappa-pmu table{border-collapse:collapse;width:100%;min-width:980px;font-size:14px}
.mappa-pmu th,.mappa-pmu td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}
.mappa-pmu th{font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);background:var(--bg2);position:sticky;top:0}
.mappa-pmu tbody tr:last-child td{border-bottom:none}
.mappa-pmu td.reg{font-weight:600;white-space:nowrap}
.mappa-pmu td.hrs{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.mappa-pmu .pill{display:inline-block;font-family:var(--mono);font-size:11px;letter-spacing:.04em;padding:2px 8px;border-radius:999px;white-space:nowrap;line-height:1.6}
.mappa-pmu .pill.est{background:var(--est-soft);color:var(--est)}
.mappa-pmu .pill.alt{background:var(--alt-soft);color:var(--alt)}
.mappa-pmu .pill.warn{background:var(--warn-soft);color:var(--warn)}
.mappa-pmu .pill.ok{background:var(--ok-soft);color:var(--ok)}
.mappa-pmu .region{padding:40px 0;border-bottom:1px solid var(--line);scroll-margin-top:120px}
.mappa-pmu .region .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 16px;margin-bottom:6px}
.mappa-pmu .region .norm{font-family:var(--mono);font-size:13px;color:var(--ink2);margin:0 0 18px;max-width:none}
.mappa-pmu .two{display:grid;gap:18px;grid-template-columns:1fr}
@media(min-width:860px){.mappa-pmu .two{grid-template-columns:1fr 1fr}}
.mappa-pmu .col{padding:18px 20px;border-radius:6px;border:1px solid var(--line);background:var(--bg2)}
.mappa-pmu .col.est{border-top:4px solid var(--est)} .mappa-pmu .col.alt{border-top:4px solid var(--alt)}
.mappa-pmu .col h4.est{color:var(--est)} .mappa-pmu .col h4.alt{color:var(--alt)}
.mappa-pmu .col ul{padding-left:18px;margin:0}
.mappa-pmu .col li{font-size:15px}
.mappa-pmu .col .hours{font-family:var(--disp);font-size:30px;line-height:1;margin:2px 0 10px;font-variant-numeric:tabular-nums}
.mappa-pmu .col .hours small{font-family:var(--mono);font-size:12px;color:var(--ink2);margin-left:6px;letter-spacing:.04em}
.mappa-pmu .notes{margin-top:16px;padding:14px 18px;border-radius:6px;background:var(--warn-soft);border:1px solid transparent}
.mappa-pmu .notes h4{color:var(--warn)}
.mappa-pmu .notes ul{margin:0;padding-left:18px}
.mappa-pmu .notes li{font-size:14.5px}
.mappa-pmu .src{margin-top:14px;font-size:13.5px;color:var(--ink2)}
.mappa-pmu .src h4{margin-bottom:4px}
.mappa-pmu .src a{display:block;padding:2px 0;word-break:break-all;text-decoration-color:var(--line)}
.mappa-pmu .group-title{padding:34px 0 0}
.mappa-pmu .group-title .eyebrow{margin-bottom:6px}
.mappa-pmu .group-title h2{font-size:24px}
.mappa-pmu .check{columns:1;gap:24px}
@media(min-width:760px){.mappa-pmu .check{columns:2}}
.mappa-pmu .check li{break-inside:avoid}
.mappa-pmu footer{padding:36px 0 0;font-size:13.5px;color:var(--ink2);max-width:72ch}
/* Ogni sezione si apre solo quando la si chiede. Tutte aperte insieme
   erano trenta schermate di testo in fila: si trovava qualcosa solo
   scorrendo. Chiuse, la pagina diventa un indice. */
.mappa-pmu section.chiudibile > *:not(.testata-sezione){display:none}
.mappa-pmu .testata-sezione{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;padding:2px 0}
.mappa-pmu .testata-sezione .freccia{font-family:var(--mono);font-size:13px;color:var(--ink2);flex:0 0 auto;transition:transform 120ms ease}
.mappa-pmu section:not(.chiudibile) > .testata-sezione .freccia{transform:rotate(90deg)}
.mappa-pmu .testata-sezione > *{margin-bottom:0}
.mappa-pmu .testata-sezione:hover h2,.mappa-pmu .testata-sezione:hover h3{color:var(--est)}
.mappa-pmu section.region.chiudibile{padding:14px 0}
.mappa-pmu section.block.chiudibile{padding:16px 0}
/* Da telefono l'indice non sta di fianco (non c'e' spazio) e neanche
   sopra tutto steso: e' il menu a tendina dei siti, quadratino con le
   righe in alto a sinistra, si tocca e scende la lista. */
.mappa-pmu .menu-mobile{display:none}
@media(max-width:1039px){
  .mappa-pmu .menu-mobile{display:block;position:sticky;top:6px;z-index:5;margin:0 0 16px}
  .mappa-pmu .tasto-menu{display:inline-flex;align-items:center;gap:10px;font-family:var(--body);font-size:14px;font-weight:600;color:var(--ink);background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:10px 14px;cursor:pointer}
  .mappa-pmu .tasto-menu svg{display:block}
  .mappa-pmu .pannello-menu{display:none;margin-top:8px;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:6px 14px 10px;max-height:62vh;overflow:auto;box-shadow:0 14px 30px rgba(0,0,0,.12)}
  .mappa-pmu .menu-mobile.aperto .pannello-menu{display:block}
  .mappa-pmu .pannello-menu .grp{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2);margin:14px 0 2px}
  .mappa-pmu .pannello-menu .grp:first-child{margin-top:6px}
  .mappa-pmu .pannello-menu a{display:block;padding:9px 0;text-decoration:none;color:var(--ink);font-size:15px;border-bottom:1px solid var(--line)}
  .mappa-pmu .pannello-menu a:last-child{border-bottom:none}
}
`;
