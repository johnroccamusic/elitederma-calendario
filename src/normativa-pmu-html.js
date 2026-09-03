// Il testo della "Mappa Normativa PMU", ripreso parola per parola dal
// documento originale: quadro nazionale, tabella di sintesi, adempimenti
// comuni e le 22 schede regionali con i link alle fonti. Sta in un file
// suo perche' e' un documento, non codice: si aggiorna quando cambiano le
// norme, senza toccare l'applicazione.
export const HTML_NORMATIVA_PMU = String.raw`
<div class="wrap">
<header class="top">
  <div class="eyebrow">Trucco permanente · dermopigmentazione · microblading</div>
  <h1>Mappa Normativa PMU</h1>
  <p class="lede">Cosa serve per esercitare il trucco permanente in Italia, regione per regione, distinguendo l'estetista qualificata ai sensi della Legge 1/1990 dagli altri operatori (tatuatori e dermopigmentisti non estetisti).</p>
  <div class="meta">
    <span>Verifica fonti: 3 settembre 2026</span>
    <span>20 regioni + 2 province autonome</span>
    <span>Fonti: BUR, siti regionali, ASL, CCIAA, associazioni di categoria</span>
  </div>
  <div class="legend">
    <div class="fig est"><h4 class="est">Estetisti</h4><p>Operatori con qualifica di estetista (L. 1/1990) che eseguono trucco permanente con dermografo. Per loro conta se la Regione chiede un corso igienico-sanitario aggiuntivo, quante ore e con quali crediti.</p></div>
    <div class="fig alt"><h4 class="alt">Altri operatori</h4><p>Tatuatori, piercer e dermopigmentisti senza qualifica di estetista. Per loro conta il percorso regionale (da 14 a 1.500 ore), l'eventuale possibilità di fare PMU senza licenza estetica e l'aggiornamento periodico.</p></div>
  </div>
</header>

<div class="layout">
<nav class="side" aria-label="Indice">
  <div class="grp">Quadro</div>
  <a href="#nazionale">Quadro nazionale</a>
  <a href="#sintesi">Tabella di sintesi</a>
  <a href="#checklist">Adempimenti comuni</a>
  <div class="grp">Nord</div>
  <a href="#piemonte">Piemonte</a><a href="#vda">Valle d'Aosta</a><a href="#lombardia">Lombardia</a><a href="#liguria">Liguria</a><a href="#veneto">Veneto</a><a href="#fvg">Friuli-Venezia Giulia</a><a href="#trento">P.A. Trento</a><a href="#bolzano">P.A. Bolzano</a><a href="#emilia">Emilia-Romagna</a>
  <div class="grp">Centro</div>
  <a href="#toscana">Toscana</a><a href="#umbria">Umbria</a><a href="#marche">Marche</a><a href="#lazio">Lazio</a><a href="#abruzzo">Abruzzo</a>
  <div class="grp">Sud e isole</div>
  <a href="#molise">Molise</a><a href="#campania">Campania</a><a href="#puglia">Puglia</a><a href="#basilicata">Basilicata</a><a href="#calabria">Calabria</a><a href="#sicilia">Sicilia</a><a href="#sardegna">Sardegna</a>
</nav>

<main>

<section class="block" id="nazionale">
  <div class="eyebrow">Parte 1</div>
  <h2>Quadro nazionale</h2>
  <p>Non esiste una legge statale sul trucco permanente. Il quadro nasce dall'incrocio fra la disciplina dell'estetista, le linee guida ministeriali del 1998 sul tatuaggio, il regolamento europeo sui pigmenti e due sentenze del Consiglio di Stato che hanno fissato chi può fare cosa.</p>
  <div class="cards">
    <div class="card">
      <h4 class="est" style="color:var(--est)">Base giuridica per l'estetista</h4>
      <ul>
        <li><span class="k">L. 4 gennaio 1990 n. 1</span>: disciplina dell'attività di estetista e della qualifica professionale.</li>
        <li><span class="k">D.I. 15 ottobre 2015 n. 206</span>, scheda tecnica 23 "dermografo per micropigmentazione": l'apparecchio è tra quelli consentiti all'estetista, a condizione di una formazione specifica certificata (dal fabbricante, dal mandatario o da altro ente competente) e del rispetto delle prescrizioni igienico-sanitarie.</li>
        <li><span class="k">Parere MISE prot. 33406 del 19/01/2018</span> (e nota 18706/2017): dove la Regione non ha disciplinato il PMU, vale la sola L. 1/1990 con il D.I. 206/2015, quindi serve la qualifica di estetista.</li>
        <li><span class="k">Cons. Stato n. 4732 del 18/06/2021</span>: annulla la nota del Ministero della Salute 14138/2019; la dermopigmentazione, anche dell'areola, è attività estetica e non terapeutica.</li>
      </ul>
    </div>
    <div class="card">
      <h4 style="color:var(--alt)">Base giuridica per gli altri operatori</h4>
      <ul>
        <li><span class="k">Circolari Min. Sanità 2.9/156 del 05/02/1998 e 2.8/633 del 16/07/1998</span>: linee guida per tatuaggio e piercing in sicurezza, formazione obbligatoria, consenso informato. Sono la base di tutte le delibere regionali.</li>
        <li><span class="k">Cons. Stato Sez. III n. 1930 del 28/02/2024</span>: respinge il ricorso delle estetiste contro il Lazio. Nessuna norma statale riserva la dermopigmentazione all'estetista; ogni Regione può disciplinarla e ammettere i tatuatori formati (potestà concorrente).</li>
        <li>Conseguenza pratica: <strong>dove la Regione ha incluso il PMU nel tatuaggio</strong> (Lazio, Abruzzo, FVG, Bolzano, Sardegna, Puglia, Calabria) il tatuatore formato può eseguirlo; <strong>dove non l'ha fatto</strong> serve la qualifica di estetista.</li>
        <li>Il tavolo tecnico ministeriale del 2018 ("Prescrizioni in materia di sicurezza delle pratiche di tatuaggio e trucco permanente", bozza 2019) non è mai diventato un accordo Stato-Regioni. Nessun riconoscimento automatico interregionale dei titoli.</li>
      </ul>
    </div>
    <div class="card">
      <h4>Obblighi comuni a entrambe le figure</h4>
      <ul>
        <li><span class="k">Reg. (UE) 2020/2081</span> (REACH, all. XVII voce 75): dal 4/1/2022 solo pigmenti conformi, etichettati "Miscela per tatuaggi o trucco permanente"; Pigment Blue 15:3 e Green 7 vietati dal 4/1/2023. Conservare la dichiarazione di conformità del fornitore e la tracciabilità dei lotti.</li>
        <li>SCIA al SUAP comunale (portale impresainungiorno), iscrizione al Registro Imprese o Albo artigiani, responsabile tecnico per sede.</li>
        <li>Consenso informato scritto (riferimento generale L. 219/2017), scheda cliente, verifica età con documento; rifiuti a rischio infettivo (EER 18.01.03*) tramite ditta autorizzata.</li>
        <li><span class="k">Legge di bilancio 2026, art. 1 c. 789</span>: imprese di estetica, tatuaggio e piercing escluse dall'obbligo di iscrizione al RENTRI e dal registro di carico/scarico rifiuti.</li>
        <li>ATECO 2025 (dal 1/4/2025): tatuaggio e piercing 96.99.91 (ex 96.09.02); trucco permanente nei centri estetici 96.22.09. Verificare la codifica con il commercialista.</li>
      </ul>
    </div>
    <div class="card">
      <h4>In arrivo (non ancora in vigore)</h4>
      <ul>
        <li><span class="k">DDL AS 1531 "prevenzione del melanoma"</span>, approvato dal Senato il 27/01/2026 con modifiche: l'art. 3 impone al tatuatore un'informativa scritta e un consenso informato controfirmato e conservato, con decreti attuativi del Ministero della Salute entro 6 mesi. Alla data di verifica il testo è tornato alla Camera e <strong>non è legge</strong>.</li>
        <li>Piemonte: regolamento attuativo della L.R. 2/2023 non ancora adottato. Abruzzo: regolamento attuativo della L.R. 41/2020 non reperito. Valle d'Aosta e Umbria: proposte di legge mai approvate.</li>
      </ul>
    </div>
  </div>
</section>

<section class="block" id="sintesi">
  <div class="eyebrow">Parte 2</div>
  <h2>Tabella di sintesi</h2>
  <p>Le ore indicate sono quelle del corso regionale igienico-sanitario o della qualifica richiesta per fare PMU. Dove l'estetista è esonerata dal corso, resta comunque l'obbligo della formazione certificata sul dermografo (scheda 23).</p>
  <div class="tablewrap">
  <table>
    <thead><tr><th>Regione</th><th>Atto chiave</th><th>Estetista: cosa serve oltre la qualifica</th><th>Altri operatori: percorso per il PMU</th><th>Aggiornamento</th><th>Minori (PMU/tatuaggio)</th><th>Stato</th></tr></thead>
    <tbody>
      <tr><td class="reg">Piemonte</td><td>L.R. 2/2023 mod. L.R. 28/2023; DGR 20-3738/2016</td><td class="hrs">corso 90+4 h</td><td class="hrs">90 h (transitorio) → 1.500 h a regime; serve anche qualifica estetista</td><td>ogni 4 anni</td><td>vietato &lt;16; 16-18 consenso</td><td><span class="pill warn">regolamento mancante</span></td></tr>
      <tr><td class="reg">Valle d'Aosta</td><td>nessun atto regionale; L.R. 63/1993</td><td class="hrs">nessun corso (solo scheda 23)</td><td class="hrs">nessun corso; parere USL locali; serve qualifica estetista</td><td>no</td><td>circolari 1998</td><td><span class="pill warn">non disciplinato</span></td></tr>
      <tr><td class="reg">Lombardia</td><td>L.R. 13/2021; DGR XI/5796/2021</td><td class="hrs">nessun corso (solo scheda 23)</td><td class="hrs">PMU riservato all'estetista; tatuatore 1.500 h</td><td>24 h ogni 3 anni (tatuatori)</td><td>vietato &lt;16; &lt;18 consenso</td><td><span class="pill est">riserva estetista</span></td></tr>
      <tr><td class="reg">Liguria</td><td>DGR 787/2008, 831/2009, 593/2023</td><td class="hrs">nessun corso (solo scheda 23; prassi ASL da verificare)</td><td class="hrs">PMU riservato all'estetista; tatuatore 30 h</td><td>no</td><td>vietato &lt;16; &lt;18 entrambi i genitori</td><td><span class="pill est">riserva estetista</span></td></tr>
      <tr><td class="reg">Veneto</td><td>DGR 11/2013, 355/2016, 1682/2022</td><td class="hrs">corso 90 h (credito 20 h → 70 h) + locali tatuaggio</td><td class="hrs">90 h ma serve anche qualifica estetista (parere 11/06/2026)</td><td>no</td><td>&lt;18 consenso genitori</td><td><span class="pill est">riserva estetista</span></td></tr>
      <tr><td class="reg">Friuli-V.G.</td><td>L.R. 7/2012; DPReg 064/2014</td><td class="hrs">corso ≥90 h + SCIA tatuaggio</td><td class="hrs">≥90 h; PMU = tatuaggio</td><td>non fissato</td><td>vietato &lt;14; 14-18 consenso</td><td><span class="pill alt">PMU nel tatuaggio</span></td></tr>
      <tr><td class="reg">P.A. Trento</td><td>DGP 2131/2003; DGP 715/2023</td><td class="hrs">corso 60 h + idoneità APSS</td><td class="hrs">60 h; qualifica estetista comunque richiesta (MISE 2018)</td><td>non reperito</td><td>vietato &lt;18 (salvo lobo)</td><td><span class="pill warn">PMU non disciplinato</span></td></tr>
      <tr><td class="reg">P.A. Bolzano</td><td>DPP 37/2007</td><td class="hrs">corso ≥30 h + autorizzazione Servizio Igiene + locale separato</td><td class="hrs">≥30 h; PMU = tatuaggio</td><td>no</td><td>solo con genitori presenti</td><td><span class="pill alt">PMU nel tatuaggio</span></td></tr>
      <tr><td class="reg">Emilia-Romagna</td><td>DGR 465/2007; nota PG-2015-743054</td><td class="hrs">corso AUSL 14-16 h + certificazione dermografo + SCIA tatuaggio</td><td class="hrs">14-16 h; qualifica estetista comunque richiesta (MISE 2018)</td><td>no</td><td>&lt;18 consenso; lobo 14-18</td><td><span class="pill warn">PMU non disciplinato</span></td></tr>
      <tr><td class="reg">Toscana</td><td>L.R. 28/2004; DPGR 47/R/2007</td><td class="hrs">corso 80 h (all. H) + esame + locali Titolo II</td><td class="hrs">tecnico tatuaggio 600 h</td><td>20 h ogni 5 anni</td><td>vietato &lt;14; 14-18 consenso</td><td><span class="pill ok">disciplinato</span></td></tr>
      <tr><td class="reg">Umbria</td><td>linee guida USL (DGR 909/2006, da confermare)</td><td class="hrs">corso 90 h (modulo 1 facoltativo)</td><td class="hrs">90 h + idoneità USL; qualifica estetista richiesta</td><td>no</td><td>circolari 1998</td><td><span class="pill warn">nessuna legge</span></td></tr>
      <tr><td class="reg">Marche</td><td>L.R. 38/2013; R.R. 2/2016; DGR 1598/2017</td><td class="hrs">nessun corso se già operante al 28/12/2017; altrimenti 300 o 450 h</td><td class="hrs">PMU riservato all'estetista; tatuatore 700 h</td><td>8 h ogni 5 anni</td><td>vietato &lt;14; 14-18 consenso</td><td><span class="pill est">riserva estetista</span></td></tr>
      <tr><td class="reg">Lazio</td><td>L.R. 2/2021; DGR 270/2022</td><td class="hrs">corso uso dermografo + igienico-sanitario (ore non fissate)</td><td class="hrs">Operatore tatuaggio 800 h (abilita a PMU)</td><td>10 h ogni 2 anni</td><td>vietato &lt;16; 16-18 consenso</td><td><span class="pill alt">PMU nel tatuaggio</span></td></tr>
      <tr><td class="reg">Abruzzo</td><td>L.R. 41/2020; DD 196/DPG009/2019</td><td class="hrs">qualifica regionale con crediti (nessun esonero)</td><td class="hrs">Op. tatuaggio e trucco permanente 450 h o Dermopigmentista</td><td>previsto (reg. mancante)</td><td>vietato &lt;16; &lt;18 consenso</td><td><span class="pill warn">regolamento mancante</span></td></tr>
      <tr><td class="reg">Molise</td><td>DGR 1706/2004</td><td class="hrs">non chiarito</td><td class="hrs">corso regionale + idoneità ASReM (ore non reperite)</td><td>non reperito</td><td>non reperito</td><td><span class="pill warn">testo non reperito</span></td></tr>
      <tr><td class="reg">Campania</td><td>DGR 2072/2007; DGR 157/2010; RRTQ 247</td><td class="hrs">non chiarito (prassi: corso ASL 50 h)</td><td class="hrs">corso ASL 50 h; qualifica 500 h include PMU</td><td>non reperito</td><td>&lt;18 consenso</td><td><span class="pill warn">da confermare con ASL</span></td></tr>
      <tr><td class="reg">Puglia</td><td>DGR 983/2016; R.R. 3/2015</td><td class="hrs">corso 90 h (nessun credito) + locali autonomi</td><td class="hrs">90 h; PMU incluso</td><td>non fissato</td><td>&lt;18 consenso</td><td><span class="pill alt">PMU nel tatuaggio</span></td></tr>
      <tr><td class="reg">Basilicata</td><td>nessun atto sanitario; L.R. 45/1993</td><td class="hrs">nessun corso regionale (scheda 23)</td><td class="hrs">circolari 1998; corso CUR 124 h non obbligatorio</td><td>no</td><td>circolari 1998</td><td><span class="pill warn">non disciplinato</span></td></tr>
      <tr><td class="reg">Calabria</td><td>DGR 228/2012</td><td class="hrs">corso 90 h (credito 20 h → 70 h)</td><td class="hrs">90 h; PMU incluso</td><td>non reperito</td><td>non verificato</td><td><span class="pill alt">PMU nel tatuaggio</span></td></tr>
      <tr><td class="reg">Sicilia</td><td>D.A. Sanità 31/07/2003</td><td class="hrs">corso ASP (credito modulo 1); posizione PMU non scritta</td><td class="hrs">corso ASP ≥60 h (prassi 80-90 h) + nulla osta ASP</td><td>non reperito</td><td>vietato &lt;18</td><td><span class="pill warn">da confermare con ASP</span></td></tr>
      <tr><td class="reg">Sardegna</td><td>DGR 22/11/2012; Det. 1528/2012; DGR 41/21/2023</td><td class="hrs">corso ASL ≥60 h + idoneità SISP (nessun esonero)</td><td class="hrs">≥60 h ASL; qualifica 1.000 h (credito 130 h)</td><td>24 h ogni 3 anni</td><td>&lt;18 consenso con genitore presente</td><td><span class="pill alt">PMU nel tatuaggio</span></td></tr>
    </tbody>
  </table>
  </div>
</section>

<section class="block" id="checklist">
  <div class="eyebrow">Parte 3</div>
  <h2>Adempimenti comuni per aprire</h2>
  <p>Valgono in tutte le regioni, prima ancora delle regole locali. La differenza fra regioni riguarda solo il titolo formativo e i requisiti dei locali.</p>
  <ul class="check">
    <li><strong>Titolo professionale</strong>: qualifica di estetista (L. 1/1990) oppure titolo regionale di tatuatore/dermopigmentista, secondo la scheda della regione.</li>
    <li><strong>Formazione sul dermografo</strong> certificata dal fabbricante o da ente competente (scheda 23 del D.I. 206/2015): richiesta all'estetista in ogni regione.</li>
    <li><strong>Corso igienico-sanitario regionale</strong> dove previsto, con attestato da conservare ed esporre.</li>
    <li><strong>SCIA al SUAP</strong> con planimetria in scala 1:100, relazione tecnica su attrezzature e sterilizzazione, contratto rifiuti a rischio infettivo, titolo di disponibilità dei locali, responsabile tecnico.</li>
    <li><strong>Iscrizione</strong> al Registro Imprese o all'Albo delle imprese artigiane con il codice ATECO corretto.</li>
    <li><strong>Locali</strong>: superfici lavabili, lavabo a comando non manuale, zona sterilizzazione separata (autoclave classe B o solo monouso), servizio igienico, no interrati dove vietati, altezza minima 2,70 m nella maggior parte delle regioni.</li>
    <li><strong>Pigmenti</strong> conformi al Reg. (UE) 2020/2081 con dichiarazione del fornitore, etichetta, lotto e scadenza registrati nella scheda cliente.</li>
    <li><strong>Consenso informato</strong> scritto, informativa sui rischi, verifica dell'età, consenso dei genitori per i minori dove ammesso, conservazione da 5 a 10 anni secondo la regione.</li>
    <li><strong>Sicurezza</strong>: D.Lgs. 81/2008, vaccinazione anti-epatite B raccomandata o richiesta, DPI, protocollo di sterilizzazione con registro.</li>
    <li><strong>Divieti ricorrenti</strong>: attività ambulante (salvo fiere autorizzate), anestetici, rimozione di tatuaggi fuori da strutture sanitarie, sedi anatomiche a rischio.</li>
  </ul>
</section>

<div class="group-title"><div class="eyebrow">Parte 4</div><h2>Schede regionali · Nord</h2></div>

<section class="region" id="piemonte">
  <div class="head"><h3>Piemonte</h3><span class="pill warn">regolamento attuativo mancante</span></div>
  <p class="norm">L.R. 30/01/2023 n. 2 (tatuaggio e piercing) mod. da L.R. 26/10/2023 n. 28 · DGR 20-3738 del 27/07/2016 (corsi rischi sanitari) · D.P.G.R. 46/2003 · Nota Regione prot. 5145 del 28/01/2019 · L.R. 54/1992 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">90 + 4<small>ORE CORSO + ESAME</small></div>
      <ul>
        <li>Serve la qualifica di estetista <strong>e</strong> il corso regionale sui rischi sanitari di tatuaggio, piercing e trucco permanente (DGR 20-3738/2016, agenzie formative accreditate). La nota regionale del 28/01/2019 è esplicita: "non è sufficiente il solo corso sui rischi sanitari".</li>
        <li>ASL TO5 (pagina aggiornata 29/09/2025): per il trucco permanente serve "la formazione specifica per estetista e per tatuatore".</li>
        <li>Esonero dal primo modulo (15 h) per le estetiste dichiarato da alcune agenzie, ma non confermato da un atto regionale.</li>
        <li>SCIA estetica al SUAP e notifica ASL/SISP per il PMU con moduli del D.P.G.R. 46/2003 (scheda cliente, informativa rischi, consenso minori).</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">1.500<small>ORE A REGIME · 90 IN TRANSITORIO</small></div>
      <ul>
        <li>L.R. 2/2023: corso tatuaggio di almeno 1.500 ore (500 di tirocinio), piercing 500 ore; accesso 18 anni e obbligo scolastico; esame finale; enti accreditati.</li>
        <li>Fino all'adozione del regolamento (art. 10, mai emanato al 3/9/2026) valgono i corsi da 90 ore della DGR 20-3738/2016 (art. 15).</li>
        <li>La L.R. 28/2023 ha soppresso l'esclusione della dermopigmentazione dalla legge: il PMU rientra nel tatuaggio, ma la qualifica di estetista resta richiesta dalla Regione.</li>
        <li>Aggiornamento ogni 4 anni. Esonero per chi aveva l'attestato regionale (anche di altre regioni, con verifica di equivalenza).</li>
        <li>SCIA al SUAP trasmessa all'ASL. Minori: vietato sotto i 16 anni (salvo lobo), 16-18 con consenso scritto dei genitori.</li>
        <li>Sanzioni: 3.000-15.000 € senza formazione o SCIA; 2.000-10.000 € per mancato aggiornamento.</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Novità e punti aperti</h4><ul>
    <li>Regime transitorio in corso: chi si forma oggi con le 90 ore dovrebbe verificare come sarà riconosciuto dopo il regolamento. Chiedere al Settore Standard formativi della Regione.</li>
    <li>Art. 9 L.R. 2/2023: contributo regionale per la pigmentazione dell'areola dopo mastectomia.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.piemonte.it/web/temi/sviluppo/artigianato/normativa-riferimento-attivita-tatuaggio-piercing">Regione Piemonte, normativa tatuaggio e piercing</a>
    <a href="https://www.regione.piemonte.it/web/sites/default/files/media/documenti/2019-04/chiarimenti_sullattivita_di_trucco_permanente_e_semipermanente_ed_utilizzo_del_dermografo.pdf">Nota prot. 5145 del 28/01/2019, chiarimenti trucco permanente</a>
    <a href="http://arianna.cr.piemonte.it/iterlegcoordweb/dettaglioLegge.do?urnLegge=urn:nir:regione.piemonte:legge:2023-01-30%3B2@2023-11-17">L.R. 2/2023 testo vigente</a>
    <a href="https://www.aslto5.piemonte.it/it/attivita/requisiti-specifici-per-tatuatori-piercing">ASL TO5, requisiti tatuatori e trucco permanente</a>
  </div>
</section>

<section class="region" id="vda">
  <div class="head"><h3>Valle d'Aosta</h3><span class="pill warn">nessuna norma regionale</span></div>
  <p class="norm">L.R. 20/08/1993 n. 63 (estetista) · nessun atto regionale su tatuaggio, piercing o PMU · Consiglio Valle, oggetto n. 498 del 21/04/2021 · Circolari Min. Sanità 1998</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">0<small>ORE CORSO REGIONALE</small></div>
      <ul>
        <li>Il PMU rientra nell'attività di estetista (L. 1/1990 e scheda 23). Posizione CNA VdA sul parere MISE: può essere esercitato da estetiste "idoneamente formate", cioè con formazione certificata sul dermografo.</li>
        <li>Nessun corso regionale sui rischi sanitari: la Regione non lo organizza.</li>
        <li>Abilitazione estetista rilasciata dalla Regione (4 percorsi); SCIA al SUAP; parere USL sui locali.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">0<small>ORE · SOLO REQUISITI IGIENICI</small></div>
      <ul>
        <li>La Regione "non richiede requisiti professionali specifici" per tatuatori e piercer (risposta della Giunta, 21/04/2021): bastano i requisiti igienico-sanitari, il parere USL sui locali e la comunicazione al SUAP.</li>
        <li>Per il PMU vale il parere MISE 2018: serve la qualifica di estetista, perché la Regione non ha incluso il PMU nel tatuaggio.</li>
        <li>Nessun corso, registro, aggiornamento o sanzione regionale. Si applicano le circolari 1998, il Reg. UE 2020/2081 e i regolamenti comunali.</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Novità e punti aperti</h4><ul>
    <li>Proposta di legge del gruppo Rassemblement Valdôtain (novembre 2024, parere CPEL favorevole il 04/12/2024) con corsi obbligatori ed esame: non approvata; dopo le elezioni del 28/09/2025 lo stato è incerto.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.consiglio.vda.it/app/oggettidelconsiglio/dettaglio?pk_documento=43052&versione=R">Consiglio Valle, oggetto 498/2021</a>
    <a href="https://www.cna.vda.it/trucco-semipermanente-nellambito-dellattivita-di-estetista-puo-essere-esercitato-da-soggetti-idoneamente-formati/">CNA Valle d'Aosta, trucco semipermanente ed estetista</a>
    <a href="https://imprese.regione.vda.it/fare-impresa/lavoro-e-formazione/professioni-artigiane-regolamentate/abilitazioni-professionali/estetista">Regione VdA, abilitazione estetista</a>
  </div>
</section>

<section class="region" id="lombardia">
  <div class="head"><h3>Lombardia</h3><span class="pill est">PMU riservato all'estetista</span></div>
  <p class="norm">L.R. 23/07/2021 n. 13 (tatuaggio e piercing) · DGR XI/5796 del 21/12/2021 (disposizioni attuative, 7 allegati) · R.R. 22/03/2016 n. 5 (estetista) · Consulta artigianato, quesiti 07/10/2021</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">0<small>ORE CORSO REGIONALE</small></div>
      <ul>
        <li>La dermopigmentazione è stata stralciata dalla L.R. 13/2021: resta attività propria dell'estetista da svolgere in istituti con SCIA estetica.</li>
        <li>Consulta tecnica regionale per l'artigianato (07/10/2021): l'estetista che usa il dermografo deve seguire il corso del fabbricante o di ente competente e le prescrizioni della scheda 23 e delle circolari 1998, ma "non deve frequentare i corsi igienico-sanitari per tatuatori". Stesso principio per il microblading.</li>
        <li>Le "abilitazioni 90 o 75 ore per estetiste" vendute da accademie private non hanno base in atti regionali: formazione volontaria.</li>
        <li>SCIA al SUAP, responsabile tecnico, requisiti igienico-sanitari dell'allegato 1 al R.R. 5/2016, vigilanza ATS.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">1.500<small>ORE · 1.000 + 500 TIROCINIO</small></div>
      <ul>
        <li>Il tatuatore non può eseguire PMU senza qualifica di estetista: la legge non lo contempla.</li>
        <li>Corso tatuaggio 1.500 ore (1.000 teorico-pratiche + 500 tirocinio), esame, attestato di competenza regionale QRSP; piercing corso distinto. Requisiti d'accesso nell'allegato 1 (non consultabile online durante la verifica).</li>
        <li>Aggiornamento 24 ore ogni 3 anni. Chi era esonerato nel 2021 doveva completare la formazione entro il 23/07/2024.</li>
        <li>SCIA al SUAP con planimetria e diritti comunali e ATS; requisiti locali allegato 4; consenso informato allegato 6; informativa rischi allegato 3.</li>
        <li>Minori: tatuaggio vietato sotto i 16, piercing sotto i 14 (salvo lobo); sotto i 18 consenso dei genitori.</li>
        <li>Sanzioni 3.000-15.000 € (formazione, igiene, minori) e 1.500-10.000 € per le altre violazioni.</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Novità e punti aperti</h4><ul>
    <li>Nessuna modifica alla L.R. 13/2021 o alla DGR 5796 nel 2024-2026. Nessun riconoscimento automatico dei titoli di altre regioni.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.lombardia.it/wps/portal/istituzionale/HP/DettaglioServizio/servizi-e-informazioni/Enti-e-Operatori/sistema-welfare/Tutela-e-sicurezza-del-cittadino-lavoratore-e-consumatore/attivita-tatuaggio-piercing/attivita-tatuaggio-piercing">Regione Lombardia, attività di tatuaggio e piercing</a>
    <a href="https://normelombardia.consiglio.regione.lombardia.it/NormeLombardia/Accessibile/main.aspx?exp_coll=lr002021072300013&iddoc=lr002021072300013&selnode=lr002021072300013&view=showdoc">L.R. 13/2021</a>
    <a href="https://www.bs.camcom.it/sites/default/files/contenuto_redazione/files/Albi/Quesiti_Consulta_tecnica_artigianato_07_10_2021.pdf">Quesiti Consulta artigianato 07/10/2021 (dermografo e microblading)</a>
  </div>
</section>

<section class="region" id="liguria">
  <div class="head"><h3>Liguria</h3><span class="pill est">PMU riservato all'estetista</span></div>
  <p class="norm">DGR 787 del 04/07/2008 · DGR 831 del 19/06/2009 · DGR 593 del 22/06/2023 (nuova direttiva vincolante) · L.R. 3/2003 artt. 24-34 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">0<small>ORE CORSO REGIONALE (DAL 2023)</small></div>
      <ul>
        <li>La DGR 593/2023 esclude dal proprio ambito "la dermopigmentazione (trucco permanente, micropigmentazione, PMU, microblading, tricopigmentazione, tatuaggio medicale, camouflage), tecnica di esclusiva competenza degli operatori con abilitazione di estetista".</li>
        <li>Resta l'obbligo di formazione certificata sul dermografo (scheda 23). Il corso regionale da 30 ore non è più formalmente richiesto per il PMU.</li>
        <li>Prassi non uniforme: ASL1 Imperia e i corsi CNA/Confartigianato 2024 citano ancora il "trucco permanente cromatico" fra i destinatari. Chiedere conferma alla ASL competente.</li>
        <li>SCIA estetica con autocertificazione igienico-sanitaria; parere ASL a pagamento; locale dedicato consigliato per il PMU in centro estetico (par. 7.1 DGR 593).</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">30<small>ORE · 20 TEORIA + 10 PRATICA</small></div>
      <ul>
        <li>Il tatuatore senza abilitazione di estetista non può eseguire PMU.</li>
        <li>Corso 30 ore con esame (questionario o colloquio + prova pratica) presso enti accreditati; accesso 18 anni e 10 anni di scolarità; nessun aggiornamento periodico.</li>
        <li>Riconoscimento dei titoli di altre regioni su domanda alla Regione con valutazione ASL entro 20 giorni. Guest artist massimo 15 giorni l'anno.</li>
        <li>SCIA al SUAP e nulla osta ASL; area prestazioni ≥6 m², box ≥4 m², autoclave classe B, vietati interrati e attività ambulante; registri conservati 10 anni.</li>
        <li>Minori: vietato sotto i 16 (salvo lobo); sotto i 18 consenso di entrambi i genitori e presenza.</li>
        <li>Sanzioni: sospensione ASL fino all'adeguamento, poi chiusura del Comune (nessuna sanzione pecuniaria regionale).</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.confartigianato.savona.it/sites/default/files/archivio/allegati/news/REG_AMM_A_593_2023.pdf">DGR 593/2023 testo integrale</a>
    <a href="https://www.asl1.liguria.it/servizi-dalla-a-alla-z/50-apertura-tatuatore-piercing-trucco.html">ASL1, apertura tatuatore, piercing e trucco permanente</a>
    <a href="https://www.indicenormativa.it/sites/default/files/2021-03/DGR%20Liguria%20831%202009.pdf">DGR 831/2009</a>
  </div>
</section>

<section class="region" id="veneto">
  <div class="head"><h3>Veneto</h3><span class="pill est">qualifica estetista + corso 90 h</span></div>
  <p class="norm">DGR 11 del 09/01/2013 (requisiti tatuaggio, PMU incluso) · DGR 355 del 24/03/2016 (direttiva corsi 90 h) · DGR 1682 del 30/12/2022 (schema regolamento comunale) · Parere Regione prot. 331025 dell'11/06/2026 · L.R. 29/1991 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">90<small>ORE · CREDITO 20 H → 70 EFFETTIVE</small></div>
      <ul>
        <li>DGR 1682/2022 art. 4: l'estetista può fare "disegno epidermico e trucco semipermanente" solo se l'impresa ha i requisiti soggettivi e oggettivi previsti per il tatuaggio dalla DGR 11/2013.</li>
        <li>Corso igienico-sanitario di 90 ore con esame scritto e colloquio; alle estetiste qualificate è riconosciuto un credito di 20 ore sul modulo 1 (da chiedere all'iscrizione).</li>
        <li>Locali conformi alla DGR 11/2013: locale apposito ed esclusivo anche dentro il centro estetico (condivisibili solo ingresso, attesa e bagno).</li>
        <li>SCIA al SUAP per l'attività di tatuaggio, trasmessa al Dipartimento di Prevenzione ULSS.</li>
        <li>Confestetica contesta l'obbligo del corso (circolari 2023), ma la Regione non ha recepito la posizione.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">90<small>ORE · 4 MODULI · ESAME</small></div>
      <ul>
        <li><strong>Parere regionale dell'11/06/2026</strong>: il PMU richiede la qualifica di estetista; "la sola frequenza del corso di 90 ore" non basta per esercitare la dermopigmentazione. Il tatuatore senza licenza estetica non può fare PMU.</li>
        <li>Corso 90 ore (moduli 20+30+20+20), frequenza minima 90%, esame scritto e colloquio; accesso 18 anni con diploma o qualifica triennale; enti accreditati e ULSS.</li>
        <li>Nessun aggiornamento periodico. Attestati di altre regioni riconosciuti se conformi alle linee guida 1998 e con ore non inferiori.</li>
        <li>Locali: esclusivi, altezza 2,70 m, locale trattamenti ≥9 m², box ≥6 m², lavabo a comando non manuale, no interrati.</li>
        <li>Consenso informato (allegato A1) conservato 5 anni; minori di 18 solo con consenso scritto di chi esercita la potestà; pigmenti conformi ResAP(2008)1 e Reg. UE 2020/2081 (DGR 1682/2022 art. 18).</li>
        <li>Sanzioni solo comunali (25-500 €, sospensione o chiusura).</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Novità e punti aperti</h4><ul>
    <li>Il parere dell'11/06/2026 è l'atto più recente d'Italia sul tema e chiude, per il Veneto, la questione aperta dalla sentenza 1930/2024.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.veneto.it/documents/10713/68019/copia_cortesia_331025-2026.pdf/5d323f41-645b-41a1-a2b4-4d7087c3b28e">Parere Regione Veneto prot. 331025 dell'11/06/2026</a>
    <a href="https://bur.regione.veneto.it/BurvServices/pubblica/Download.aspx?name=11_AllegatoA_245262.pdf&type=9&storico=False">DGR 11/2013 allegato A</a>
    <a href="https://spazio-operatori.regione.veneto.it/documents/365607/404320/AR-Dgr355-16_AllB_Direttiva.pdf/82b82a43-2958-f902-6dd4-cc3c6e91c803">DGR 355/2016 direttiva corsi</a>
    <a href="https://www.regione.veneto.it/web/rete-degli-urp-del-veneto/tatuatore-e-piercer">URP Veneto, tatuatore e piercer</a>
  </div>
</section>

<section class="region" id="fvg">
  <div class="head"><h3>Friuli-Venezia Giulia</h3><span class="pill alt">PMU = tatuaggio per legge</span></div>
  <p class="norm">L.R. 12/04/2012 n. 7 (tatuaggio e piercing, "ivi compreso il trucco permanente") · DPReg 14/04/2014 n. 064/Pres (regolamento) · L.R. 12/2002 e DPReg 126/2015 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">≥90<small>ORE · NESSUN CREDITO</small></div>
      <ul>
        <li>Il trucco permanente "è considerato a tutti gli effetti attività di tatuaggio" (SUAP regionale): l'estetista deve frequentare il corso obbligatorio di almeno 90 ore con esame e presentare SCIA specifica per il tatuaggio.</li>
        <li>Nessun credito o esonero per estetiste nel regolamento. In centro estetico serve un locale dedicato conforme al DPReg 064/2014.</li>
        <li>Iscrizione AIA o Registro Imprese; onorabilità; attestato del corso.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">≥90<small>ORE · ENTI ACCREDITATI</small></div>
      <ul>
        <li>Nessuna qualifica professionale specifica richiesta oltre al corso: il tatuatore formato può eseguire PMU (la legge lo include nel tatuaggio). Resta prudente verificare con la CCIAA l'eventuale applicazione del parere MISE 2018.</li>
        <li>Corso ≥90 ore erogato da enti accreditati con le associazioni di categoria su avviso regionale; esame finale. Requisiti d'accesso e periodicità dell'aggiornamento non fissati.</li>
        <li>SCIA al SUAP trasmessa all'Azienda sanitaria; locale tatuaggio ≥12 m², sterilizzazione ≥4 m², box ≥6 m², pareti lavabili 2 m; vietata attività ambulante.</li>
        <li>Registro prestazioni, scheda cliente, registro sterilizzazione, elenco pigmenti con schede e dichiarazione REACH; consenso informato allegato A.</li>
        <li>Minori: vietato sotto i 14; 14-18 con consenso dei genitori.</li>
        <li>Sanzioni: 2.500-15.000 € senza requisiti o formazione; 2.000-12.000 € consenso e locali.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://lexview-int.regione.fvg.it/fontinormative/xml/xmllex.aspx?anno=2012&legge=7">L.R. 7/2012</a>
    <a href="http://decreti.regione.fvg.it/Storage/2014_64/Allegato1%20al%20DPReg%20064-2014.pdf">DPReg 064/2014</a>
    <a href="https://suap.regione.fvg.it/portale/cms/it/apertura-modifica/Tatuaggio-00002">SUAP FVG, scheda tatuaggio</a>
  </div>
</section>

<section class="region" id="trento">
  <div class="head"><h3>Provincia autonoma di Trento</h3><span class="pill warn">PMU non disciplinato</span></div>
  <p class="norm">DGP 2131 del 29/08/2003 (atto di indirizzo tatuaggi e piercing) · DGP 715 del 28/04/2023 (corso affidato alla Fondazione Franco Demarchi)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">60<small>ORE · CORSO PROVINCIALE</small></div>
      <ul>
        <li>Il corso igienico-sanitario provinciale è obbligatorio anche per "l'attività estetica con trucco permanente" (bandi 2024 e 2025). Nessun esonero per estetiste.</li>
        <li>Qualifica di estetista richiesta per il PMU (parere MISE 2018, nessun atto provinciale diverso).</li>
        <li>Idoneità igienico-sanitaria rilasciata dall'APSS anche per l'area PMU, poi SCIA al SUAP.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">60<small>ORE · 4 MODULI · ESAME</small></div>
      <ul>
        <li>Corso 60 ore (3 moduli teorici + esercitazioni), frequenza minima 80%, esame, iscrizione nel Registro provinciale degli operatori formati; costo 500-1.400 €; bando annuale (2025 con scadenza 1/8/2025).</li>
        <li>Accesso: maggiore età e biennio di scuola superiore (DGP 2003). Aggiornamento periodico non reperito.</li>
        <li>Attestazione di idoneità APSS con planimetria, contratto rifiuti, conformità impianti; locali ≥15 m² esclusivi, pareti lavabili 2 m.</li>
        <li>Minori: vietato sotto i 18 salvo lobo, con genitore presente. Divieto di farmaci e anestetici.</li>
        <li>Nessuna sanzione provinciale specifica; riconoscimento di titoli di altre regioni non disciplinato.</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Punti aperti</h4><ul>
    <li>La DGP 2131/2003 non è più online in fonte primaria e le pagine APSS erano inaccessibili: verificare con APSS se esistono atti successivi. Bando 2026 non ancora pubblicato al 3/9/2026.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.fdemarchi.it/eventi-news/news/bando-2025-corso-igienico-sanitario-tatuaggi-piercing-e-trucco-permanente">Fondazione Demarchi, bando 2025</a>
    <a href="https://www.ufficiostampa.provincia.tn.it/Comunicati/Tatuatori-e-piercer-sono-aperte-le-iscrizioni-al-corso-di-formazione-igienico-sanitaria">Ufficio stampa PAT, corso igienico-sanitario</a>
  </div>
</section>

<section class="region" id="bolzano">
  <div class="head"><h3>Provincia autonoma di Bolzano</h3><span class="pill alt">PMU = tatuaggio per regolamento</span></div>
  <p class="norm">DPP 13/06/2007 n. 37 (regolamento tatuaggi e piercing, include "trucco semipermanente e permanente") · L.P. 1/2008 e DPGP 27/2009 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">≥30<small>ORE · ESAME ORALE</small></div>
      <ul>
        <li>Corso provinciale obbligatorio anche per chi offre trucco permanente (myCivis); nessun esonero per estetiste.</li>
        <li>Art. 6 DPP 37/2007: anche nei saloni di bellezza il locale del trucco permanente deve essere rigorosamente separato dagli altri.</li>
        <li>Autorizzazione del Servizio Igiene e Sanità Pubblica dell'Azienda Sanitaria dopo sopralluogo; SCIA comunale.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">≥30<small>ORE · EDIZIONI IT E DE</small></div>
      <ul>
        <li>Il regolamento si applica a "chiunque" esegue tatuaggi, PMU incluso: il tatuatore formato e autorizzato può eseguirlo.</li>
        <li>Corso organizzato dalla Provincia, esame orale davanti a 3 docenti, frequenza minima 2/3; accesso 18 anni e licenza media; edizioni annuali in tedesco (aprile-giugno) e italiano (settembre-novembre). L'attestato vale solo in Alto Adige.</li>
        <li>Corsi di altre regioni riconosciuti con dichiarazione di equipollenza (32 € di bolli).</li>
        <li>Locali separati fra attesa, trattamento e sterilizzazione; lavabo caldo/freddo; pareti lavabili 2 m. Manifestazioni con autorizzazione 7 giorni prima.</li>
        <li>Minori solo accompagnati dai genitori. Cessazione immediata dell'attività senza autorizzazione; sospensione per carenze non sanate in 30 giorni.</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Novità</h4><ul>
    <li>Edizione italiana 2026: settembre-novembre, iscrizioni chiuse il 27/08/2026. Nessuna modifica al DPP 37/2007.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://mycivis.civis.bz.it/it/Services/ServiceDetail/?lid=1034224">myCivis, corso tatuaggi e piercing</a>
    <a href="https://mycivis.civis.bz.it/it/Services/ServiceDetail/?lid=1034384">myCivis, equipollenza corsi</a>
    <a href="https://www.gazzettaufficiale.it/atto/regioni/caricaDettaglioAtto/originario?atto.dataPubblicazioneGazzetta=2008-07-12&atto.codiceRedazionale=007R0576">DPP 37/2007 in GU</a>
  </div>
</section>

<section class="region" id="emilia">
  <div class="head"><h3>Emilia-Romagna</h3><span class="pill warn">PMU non disciplinato · corso breve</span></div>
  <p class="norm">DGR 465 dell'11/04/2007 (linee guida tatuaggio e piercing) · Nota Regione PG-2015-743054 del 09/10/2015 (estetiste e trucco semipermanente) · L.R. 32/1992 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">14-16<small>ORE · CORSO AUSL</small></div>
      <ul>
        <li>Nota regionale 2015: l'estetista che esegue trucco semipermanente o permanente deve (1) frequentare il corso AUSL della DGR 465/2007, (2) avere la certificazione del dermografo ai sensi del D.I. 206/2015 con dichiarazione del fabbricante sulla formazione, (3) presentare SCIA per l'attività di tatuaggio.</li>
        <li>I corsi AUSL 2025-2026 (Bologna, Imola, Ferrara, Reggio Emilia, Romagna) sono rivolti espressamente anche alle estetiste che fanno dermopigmentazione.</li>
        <li>Regolamenti comunali (es. Reggio Emilia): box o locale ≥10 m² se il PMU è in centro estetico.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">12 + 2<small>ORE · 50 € + IVA</small></div>
      <ul>
        <li>Corso "Tatuaggio e piercing: aspetti di igiene e sicurezza" erogato solo dai Dipartimenti di Sanità Pubblica AUSL: 12 ore di lezione + 2 di esercitazione, frequenza minima 90%, questionario finale, attestato valido in tutta la regione. Attestati di altre regioni riconosciuti.</li>
        <li>Per il PMU vale il parere MISE 2018: serve la qualifica di estetista (la DGR 465 non include il PMU).</li>
        <li>Nessun requisito d'accesso, nessun aggiornamento periodico.</li>
        <li>SCIA telematica tramite portale "Accesso Unitario"; sede fissa obbligatoria; requisiti dei locali nei regolamenti comunali (es. locale lavoro ≥10 m², sterilizzazione con autoclave, +6 m² per posto aggiuntivo).</li>
        <li>Consenso informato; divieto su palpebre, capezzolo, genitali; minori con consenso di chi esercita la potestà (lobo libero 14-18).</li>
        <li>Sanzioni solo comunali (40-500 €, sospensione fino a 20 giorni).</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://salute.regione.emilia-romagna.it/normativa-e-documentazione/leggi-atti/regionali/delibere/archivio/dgr-465-2007">DGR 465/2007</a>
    <a href="https://www.confartigianatoparma.it/archives/2891">Confartigianato Parma, nota regionale 2015 su estetiste e PMU</a>
    <a href="https://www.ausl.bologna.it/servt/dipt/dsp/uo/ispav/formazione">AUSL Bologna, corsi 2026</a>
    <a href="https://emiliaromagna.cna.it/tatuaggio-e-piercing-requisiti-per-lesercizio-dellattivita/">CNA Emilia-Romagna, requisiti</a>
  </div>
</section>

<div class="group-title"><h2>Schede regionali · Centro</h2></div>

<section class="region" id="toscana">
  <div class="head"><h3>Toscana</h3><span class="pill ok">disciplina completa</span></div>
  <p class="norm">L.R. 31/05/2004 n. 28 (mod. fino a L.R. 70/2017) · DPGR 02/10/2007 n. 47/R (mod. 44/R/2008, 31/R/2011, 12/R/2014)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">80<small>ORE · ALLEGATO H · ESAME</small></div>
      <ul>
        <li>Art. 44 c. 5 e art. 87 DPGR 47/R: l'estetista che intende eseguire "trucco con dermopigmentazione" svolge un corso di 80 ore con esame finale (inglese tecnico 8, giuridica 5, comunicazione 8, igienico-sanitaria 15, tecnico-professionale 44). Agenzie accreditate, commissione regionale.</li>
        <li>Deve rispettare i requisiti dei locali del Titolo II (25 m² minimi, locale prestazioni, spazio sterilizzazione, altezza 2,70 m).</li>
        <li>Aggiornamento 20 ore ogni 5 anni (area igienico-sanitaria con test).</li>
        <li>SCIA al SUAP; vigilanza ASL.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">600<small>ORE · TECNICO QUALIFICATO</small></div>
      <ul>
        <li>Tecnico qualificato in tatuaggio: 600 ore (stage ≥30%) con esame; accesso con diploma di secondo ciclo, qualifica di II livello o licenza media + 2 anni di esperienza. Il tecnico può eseguire dermopigmentazione (CNA Toscana Centro).</li>
        <li>Estetista che vuole diventare tatuatrice: percorso abbreviato (allegati M/N). Operatori attivi nel 2007: 90 ore igienico-sanitarie.</li>
        <li>Aggiornamento 20 ore ogni 5 anni. Nessun riconoscimento automatico dei titoli di altre regioni.</li>
        <li>SCIA al SUAP, responsabile tecnico per sede, Albo artigiani; consenso informato con moduli D/E; verifica età con documento.</li>
        <li>Minori: vietato sotto i 14 (salvo lobo); 14-18 con consenso dei genitori.</li>
        <li>Sanzioni: 2.000-12.000 € senza SCIA; 3.000-18.000 € senza formazione; 2.000-18.000 € per minori.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://raccoltanormativa.consiglio.regione.toscana.it/articolo?urndoc=urn%3Anir%3Aregione.toscana%3Aregolamento.giunta%3A2007-10-02%3B47%2FR">DPGR 47/R/2007</a>
    <a href="https://raccoltanormativa.consiglio.regione.toscana.it/articolo?urndoc=urn%3Anir%3Aregione.toscana%3Alegge%3A2004-05-31%3B28">L.R. 28/2004</a>
    <a href="https://toscanacentro.cna.it/la-dermopigmentazione-come-attivita-propria-dellestetista-chiarimenti-sullapplicazione-in-toscana/">CNA Toscana Centro, dermopigmentazione in Toscana</a>
  </div>
</section>

<section class="region" id="umbria">
  <div class="head"><h3>Umbria</h3><span class="pill warn">nessuna legge regionale</span></div>
  <p class="norm">Linee guida regionali per le USL (DGR 909 del 31/05/2006, estremi da confermare) · Programma corso regionale 90 ore · Circolari Min. Sanità 1998</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">90<small>ORE · MODULO 1 (20 H) FACOLTATIVO</small></div>
      <ul>
        <li>Il programma ufficiale del corso regionale lo rende obbligatorio anche per chi, "in possesso della qualifica di estetista", esegue l'attività nello studio estetico; il modulo 1 (cute e mucose, 20 ore) è facoltativo per le diplomate estetiste.</li>
        <li>Qualifica di estetista richiesta per il PMU (parere MISE 2018), più attestato igienico-sanitario e idoneità del Dipartimento di Prevenzione USL sui locali.</li>
        <li>Comunicazione o SCIA al Comune secondo i regolamenti comunali.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">90<small>ORE · PROVA PRATICA + COLLOQUIO</small></div>
      <ul>
        <li>Corso 90 ore (20+30+20+20) a "carattere strettamente sanitario, senza finalità abilitante"; idoneità sanitaria USL; nessun aggiornamento periodico previsto.</li>
        <li>Per il PMU serve comunque la qualifica di estetista, mancando una norma regionale che lo includa nel tatuaggio.</li>
        <li>Consenso informato, minori con consenso dei genitori, sterilizzazione secondo le linee guida 1998; nessuna sanzione regionale.</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Novità e punti aperti</h4><ul>
    <li>Proposta di legge Bori (luglio 2021, 800 ore tatuaggio) mai approvata. Città di Castello ha adottato il 03/12/2025 un nuovo regolamento comunale per estetiste, tatuatori e piercer redatto con USL Umbria 1.</li>
    <li>Estremi della DGR 909/2006 non verificati in originale.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.umbria.it/documents/18/323664/Programma+corso+tatuaggio.pdf/087f0a45-9913-45d3-b22f-86e8ec8dae24?version=1.0&download=true">Regione Umbria, programma corso tatuaggio e piercing</a>
    <a href="https://consiglio.regione.umbria.it/informazione/notizie/comunicati/tatuaggi-e-piercing-una-legge-ad-hoc-tutelare-i-professionisti-e">Assemblea legislativa, proposta di legge 2021</a>
  </div>
</section>

<section class="region" id="marche">
  <div class="head"><h3>Marche</h3><span class="pill est">dermopigmentazione riservata all'estetista</span></div>
  <p class="norm">L.R. 18/11/2013 n. 38 · Regolamento regionale 09/05/2016 n. 2 (art. 1 c. 2 include la dermopigmentazione) · DGR 1598 del 28/12/2017 (profili e standard formativi)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">0 · 300 · 450<small>ORE SECONDO IL CASO</small></div>
      <ul>
        <li>DGR 1598/2017: la dermopigmentazione "è riservata a soggetti in possesso della qualificazione di estetista"; nessun ulteriore obbligo formativo per le estetiste già qualificate e operanti al 28/12/2017.</li>
        <li>Estetiste che entrano dopo: 450 ore (estetista base, attestato "Operatore di tatuaggio, piercing e dermopigmentazione", moduli da 150 h) oppure 300 ore (estetista specializzata triennale, moduli da 100 h); stage 25-30%; enti accreditati, esame regionale.</li>
        <li>Attività ammessa nei locali dell'estetista con SCIA e locale prestazioni dedicato (R.R. art. 2 c. 9).</li>
        <li>Aggiornamento 8 ore ogni 5 anni.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">700<small>ORE · STAGE ≥40%</small></div>
      <ul>
        <li>Il tatuatore senza qualifica di estetista non esegue dermopigmentazione.</li>
        <li>Operatore di tatuaggio e piercing: 700 ore con esame regionale; accesso 18 anni, licenza media, test di italiano. Operatori attivi al 9/5/2016: 90 ore igienico-sanitarie.</li>
        <li>Aggiornamento 8 ore ogni 5 anni; lobo in farmacie e gioiellerie 6 ore.</li>
        <li>SCIA al SUAP con responsabile tecnico; locale prestazioni ≥9 m² (+6 per postazione), lavabo non manuale, autoclave con controllo annuale; vietata l'attività ambulante.</li>
        <li>Consenso informato, scheda cliente, schede di sicurezza pigmenti, contratto rifiuti. Minori: vietato sotto i 14; 14-18 con consenso.</li>
        <li>Sanzioni: 1.000-10.000 € (SCIA, formazione, requisiti); 1.000-15.000 € (divieti) più chiusura.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://static.regione.marche.it/Portals/0/Attivita_Produttive/Artigianato/Tatoo/DGR1598_17%20nuovo%20profilo.pdf">DGR 1598/2017</a>
    <a href="https://www.consiglio.marche.it/banche_dati_e_documentazione/leggi/dettaglio.php?arc=vig&idl=1807">L.R. 38/2013</a>
    <a href="https://www.consiglio.marche.it/banche_dati_e_documentazione/leggi/dettaglio.php?arc=vig&idl=1919">Regolamento regionale 2/2016</a>
  </div>
</section>

<section class="region" id="lazio">
  <div class="head"><h3>Lazio</h3><span class="pill alt">PMU nel tatuaggio · estetista esonerata</span></div>
  <p class="norm">L.R. 03/03/2021 n. 2 (mod. L.R. 14/2021, 20/2021, 11/2026) · DGR 270 del 03/05/2022 (11 allegati) · Det. G11910/2024 e G03998 del 26/03/2026 (qualifiche estere) · Cons. Stato 1930/2024</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">n.d.<small>ORE NON FISSATE · CORSO DERMOGRAFO + IGIENICO</small></div>
      <ul>
        <li>La L.R. 2/2021 include nel tatuaggio "la dermopigmentazione o trucco permanente applicata a fini estetici".</li>
        <li>DGR 270/2022 punto 2: gli estetisti abilitati sono esonerati dal corso di 800 ore per la sola dermopigmentazione se dimostrano "la frequenza del corso per uso del dermografo e per l'apprendimento delle prescrizioni igienico-sanitarie" delle circolari 1998 e del D.I. 206/2015. Nessun monte ore regionale: nella prassi si usano i corsi ex 90 ore più la parte tecnica.</li>
        <li>SCIA al SUAP con linee guida regionali (locale ≥9 m² +5 sterilizzazione, altezza 2,70, aeroilluminazione 1/8).</li>
        <li>Aggiornamento 10 ore per biennio, documentato ai controlli.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">800<small>ORE · EQF 3 · ABILITA A PMU</small></div>
      <ul>
        <li>Operatore delle attività di tatuaggio: 800 ore (max 59 in FAD), accesso 18 anni, licenza media, italiano B1; frequenza ≥80%; esame pubblico; la qualifica abilita a tatuaggio artistico, trucco permanente e microblading. Piercing 300 ore.</li>
        <li>Esoneri: corso Lazio ≥90 ore previgente, oppure 5 anni continuativi di attività al 5/3/2021. Crediti fino al 100% per titoli regionali o UE ≥500 ore e per esperienza (2-4 anni).</li>
        <li>La legittimità del sistema è confermata dal Consiglio di Stato (sent. 1930/2024): i tatuatori formati possono fare dermopigmentazione.</li>
        <li>Aggiornamento 10 ore ogni 2 anni. SCIA con responsabile tecnico; vietato ambulante; affitto poltrona regolato (all. 11).</li>
        <li>Minori: tatuaggio vietato sotto i 16; 16-18 consenso dei genitori; piercing sotto i 14 solo lobo. Anestetici vietati.</li>
        <li>Sanzioni: 3.000-15.000 € senza SCIA o formazione, con sequestro; 2.000-10.000 € senza aggiornamento.</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Novità e punti aperti</h4><ul>
    <li>Det. G03998 del 26/03/2026: procedura di riconoscimento delle qualifiche estere (validità solo regionale).</li>
    <li>L.R. 11/2026 modifica l'art. 4 c. 7 e l'art. 9 della L.R. 2/2021: contenuto da verificare sul BUR.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.aslroma1.it/uploads/files/18_09_delibera_regione_lazio_3_maggio_22_n._270.pdf">DGR 270/2022 testo integrale</a>
    <a href="https://www.consiglio.regione.lazio.it/consiglio-regionale/?vw=leggiregionalidettaglio&id=9411&sv=vigente">L.R. 2/2021 testo vigente</a>
    <a href="https://www.regione.lazio.it/cittadini/formazione/riconoscimento-delle-qualifiche-tatuaggio-piercing">Regione Lazio, riconoscimento qualifiche</a>
    <a href="https://ntplusdiritto.ilsole24ore.com/art/AGvrOMRD">Cons. Stato 1930/2024 (NT+ Diritto)</a>
  </div>
</section>

<section class="region" id="abruzzo">
  <div class="head"><h3>Abruzzo</h3><span class="pill warn">regolamento attuativo mancante</span></div>
  <p class="norm">L.R. 22/12/2020 n. 41 (tatuaggio, piercing e pratiche correlate) · Repertorio regionale: DD 144/DPG009 del 06/10/2017 (Dermopigmentista) e DD 196/DPG009 del 17/10/2019 (standard formativi)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">450<small>ORE · CON CREDITI FINO AL 30-50%</small></div>
      <ul>
        <li>La L.R. 41/2020 non nomina mai l'estetista e definisce autonomamente la dermopigmentazione, rinviando ai profili del Repertorio regionale. Non esiste un esonero automatico per le estetiste: serve la qualifica "Operatore di tatuaggio e trucco permanente" o "Dermopigmentista", con riconoscimento crediti (max 30% delle ore d'aula, 50% del tirocinio).</li>
        <li>Punto incerto: nessuna posizione ufficiale regionale reperita sull'estetista L. 1/1990 che opera con la sola scheda 23. Verificare con Regione e ASL prima di avviare.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">300 + 150<small>ORE AULA + TIROCINIO · EQF 4</small></div>
      <ul>
        <li>Operatore di tatuaggio e trucco permanente: 300 ore d'aula (tatuaggio artistico 100, trucco permanente 50, igienico-sanitario 32, pigmenti 25 e altri moduli) + 150-200 di tirocinio; accesso 18 anni, titolo EQF 3, italiano B2; frequenza ≥70%; esame pubblico. Profilo Dermopigmentista con moduli aggiuntivi (tricopigmentazione, paramedicale).</li>
        <li>SCIA al SUAP con responsabile tecnico qualificato, trasmessa all'ASL; affitto poltrona con SCIA; elenco regionale degli operatori (art. 5).</li>
        <li>Aggiornamento periodico obbligatorio (art. 9) ma requisiti dei locali, pigmenti e modulistica demandati a un regolamento entro 180 giorni: non reperito al 3/9/2026, valgono le linee guida 1998 e i regolamenti comunali.</li>
        <li>Minori: tatuaggio e dermopigmentazione vietati sotto i 16, piercing sotto i 14, sotto i 18 consenso di tutti gli esercenti la potestà.</li>
        <li>Sanzioni: 3.000-15.000 € senza SCIA o formazione; 3.000-20.000 € per minori; 500-3.000 € senza responsabile tecnico.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="http://www2.consiglio.regione.abruzzo.it/leggi_tv/abruzzo_lr/2020/lr20041/Articolato.asp">L.R. 41/2020 articolato</a>
    <a href="https://repertori.regione.abruzzo.it/?cmd=printPdf&cmpcode=trainings&id_trn=124&mcode=repertori">Repertorio, Operatore di tatuaggio e trucco permanente</a>
    <a href="https://repertori.regione.abruzzo.it/?cmd=printPdf&cmpcode=trainings&id_trn=117&mcode=repertori">Repertorio, Dermopigmentista</a>
  </div>
</section>

<div class="group-title"><h2>Schede regionali · Sud e isole</h2></div>

<section class="region" id="molise">
  <div class="head"><h3>Molise</h3><span class="pill warn">testo regionale non reperito</span></div>
  <p class="norm">DGR 1706 del 17/12/2004 (regolamento tatuaggio e piercing) · contenuti ricavati dal modulo SCIA del SUAP di Termoli</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">?<small>NESSUNA INDICAZIONE REGIONALE</small></div>
      <ul>
        <li>Nessuna norma molisana su estetista e PMU. Si applicano L. 1/1990 e scheda 23: qualifica di estetista e formazione certificata sul dermografo.</li>
        <li>Non risulta né obbligo né esonero dal corso regionale tatuatori per l'estetista che fa PMU: chiedere all'Ufficio Igiene e Sanità Pubblica ASReM.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">?<small>ORE NON REPERITE</small></div>
      <ul>
        <li>Corso regionale di formazione obbligatorio con esame; il superamento e i requisiti dei locali danno il "Certificato di idoneità sanitaria" ASReM. Ore, contenuti e aggiornamento non reperiti.</li>
        <li>Requisiti: 18 anni, conoscenze tecnico-professionali e igienico-sanitarie, vaccinazione anti-epatite B.</li>
        <li>SCIA al SUAP con planimetria, relazione, autocertificazione dell'idoneità ASReM, responsabile tecnico qualificato; consenso informato (allegato C), registro clienti, tabella prescrizioni esposta (allegato D).</li>
        <li>Il regolamento riguarda tatuaggio e piercing; nessuna menzione esplicita del PMU: per prudenza vale il parere MISE 2018 (qualifica estetista).</li>
      </ul>
    </div>
  </div>
  <div class="notes"><h4>Punti aperti</h4><ul>
    <li>Annunci privati sostengono che l'attestato 90 ore Puglia "vale anche in Molise": non confermato da fonte ufficiale. Nessun corso ASReM 2024-2026 reperito.</li>
  </ul></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.comune.termoli.cb.it/images/Servizi/AttivitaProduttive/SUAP%20-%20MODULISTICA/tatuaggi%20e%20piercing.pdf">SUAP Termoli, modulo SCIA tatuaggi e piercing</a>
  </div>
</section>

<section class="region" id="campania">
  <div class="head"><h3>Campania</h3><span class="pill warn">da confermare con ASL</span></div>
  <p class="norm">DGR 2072 del 30/11/2007 · DGR 157 del 25/02/2010 (tatuaggio e piercing in sicurezza) · Repertorio RRTQ scheda 247 "Operatore di tatuaggio e piercing" (BURC 66/2019, agg. 14/07/2023)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">50<small>ORE · PRASSI ASL, NON SCRITTO</small></div>
      <ul>
        <li>Nessuna legge regionale sull'estetista; vale L. 1/1990 con scheda 23.</li>
        <li>La DGR 157/2010 è rivolta a tatuaggio e piercing e non contiene esoneri o crediti per estetiste; nella prassi le ASL chiedono il corso di 50 ore anche per il PMU. Nessuna posizione ufficiale scritta reperita: confermare con il Dipartimento di Prevenzione ASL.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">50<small>ORE ASL · QUALIFICA 500 H</small></div>
      <ul>
        <li>Corso ASL 50 ore in 5 moduli (cute, rischi, sterilizzazione, strumenti, normativa); obbligatorio per il responsabile tecnico; costo circa 500 € (ASL Napoli 1); esame e aggiornamento non documentati.</li>
        <li>Qualifica regionale "Operatore di tatuaggio e piercing" (EQF 3): 500 ore (180 aula + 320 laboratorio), accesso 16 anni e obbligo di istruzione, enti accreditati, corsi GOL gratuiti; il profilo include l'ADA "realizzazione di tatuaggi e trucco permanente", quindi la Regione inquadra il PMU anche nel tatuatore.</li>
        <li>SCIA al SUAP e Albo artigiani; verifica ASL entro 60 giorni; locali ≥16 m² (+6 per operatore), altezza 2,70, pareti lavabili 1,80 m; vietata attività ambulante.</li>
        <li>Consenso informato; minori con autorizzazione dei genitori. Sanzioni non reperite.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://capire.regione.campania.it/rrtq/public/scheda/247">RRTQ Campania, scheda 247</a>
    <a href="https://www.aslnapoli1centro.it/tatuaggi-e-piercing-in-sicurezza">ASL Napoli 1 Centro, tatuaggi e piercing</a>
    <a href="https://www.passiamo.it/quesito-attivita-di-tatuaggio-e-piercing-in-campania-normativa-e-autorizzazione/">Sintesi DGR 157/2010</a>
  </div>
</section>

<section class="region" id="puglia">
  <div class="head"><h3>Puglia</h3><span class="pill alt">PMU incluso · corso 90 h per tutti</span></div>
  <p class="norm">DGR 983 del 06/07/2016 (linee guida tatuaggio e piercing, "compresa la dermopigmentazione") · L.R. 24/2013 art. 22 e R.R. 3/2015 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">90<small>ORE · NESSUN CREDITO</small></div>
      <ul>
        <li>La DGR 983/2016 si applica a chi svolge tatuaggio e piercing "compresa la dermopigmentazione", anche "congiuntamente all'attività di estetista", con locali operativi autonomi (condivisibili solo ingresso, attesa e servizi).</li>
        <li>Nessun esonero o credito per estetiste: nella prassi (ASL Bari, enti riconosciuti) il corso di 90 ore è richiesto anche per PMU e microblading. Verificare con il SISP ASL.</li>
        <li>R.R. 3/2015 (linee guida estetiste) non consultato in originale.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">90<small>ORE · 5 MODULI · ESAME SISP</small></div>
      <ul>
        <li>Corso 90 ore (frontale + pratica), accesso 18 anni e 10 anni di scolarità, frequenza ≥80%, esame con commissione (direttore, docenti, responsabile SISP); attestato "senza finalità di abilitazione professionale". Erogato dai Dipartimenti di Prevenzione ASL o da enti da essi autorizzati. Corso ridotto 40 ore per il solo lobo.</li>
        <li>Attestati di altre regioni equiparati se di 90 ore e coerenti con la circolare 2.9/156.</li>
        <li>SCIA al Comune con planimetria, relazione, contratto rifiuti e autocertificazione del corso; trasmissione al SISP; Albo artigiani. Locali esclusivi ≥9 m², altezza 2,70, box ≥6 m², no interrati, WC con antibagno.</li>
        <li>Scheda informativa (all. 1), consenso (all. 2), consenso genitori per minori di 18 (all. 3). Aggiornamento promosso ma senza ore fissate.</li>
        <li>Sanzioni: sospensione ASL, diffida a 30 giorni, chiusura del Sindaco.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://burp.regione.puglia.it/documents/20135/1014161/GR983.pdf/29e3f238-e202-216a-cb50-715e8a30abd5?version=1.0&t=1622796687280">DGR 983/2016 (BURP)</a>
    <a href="https://www.sanita.puglia.it/en/tatuaggi-e-piercing">PugliaSalute, tatuaggi e piercing</a>
  </div>
</section>

<section class="region" id="basilicata">
  <div class="head"><h3>Basilicata</h3><span class="pill warn">nessuna norma sanitaria regionale</span></div>
  <p class="norm">L.R. 03/08/1993 n. 45 (estetista) · nessuna DGR su tatuaggio, piercing o PMU · profilo "Operatore di tatuaggio e piercing" nel Repertorio regionale (2016) · Circolari Min. Sanità 1998</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">0<small>ORE CORSO REGIONALE</small></div>
      <ul>
        <li>Nessuna disposizione regionale sul PMU: valgono L. 1/1990 e scheda 23, quindi qualifica di estetista e formazione certificata sul dermografo.</li>
        <li>Requisiti dei locali e idoneità verificati dall'ASP e dal SUAP comunale secondo le circolari 1998.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">124<small>ORE · CORSO CUR, NON OBBLIGATORIO</small></div>
      <ul>
        <li>Nessun corso igienico-sanitario obbligatorio, nessuna registrazione, nessuna sanzione regionale: si applicano direttamente le circolari 1998 e i regolamenti comunali.</li>
        <li>Nel Catalogo Unico Regionale esiste un corso "Operatore di tatuaggio e piercing" da 124 ore (attestato di frequenza), senza menzione del PMU.</li>
        <li>Per il PMU vale il parere MISE 2018: serve la qualifica di estetista.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.basilicata.it/si-arricchisce-il-repertorio-dei-profili-professionali/">Regione Basilicata, repertorio profili 2016</a>
    <a href="https://oldportalebandi.regione.basilicata.it/PortaleBandi/detail-cur.jsp?id=788352">Catalogo Unico Regionale, corso 124 ore</a>
  </div>
</section>

<section class="region" id="calabria">
  <div class="head"><h3>Calabria</h3><span class="pill alt">PMU incluso nelle linee guida</span></div>
  <p class="norm">DGR 228 del 14/05/2012 "Linee guida per l'esercizio delle attività di tatuaggio, piercing, trucco permanente e semipermanente" · L.R. 5/1999 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">90<small>ORE · CREDITO 20 H → 70 EFFETTIVE</small></div>
      <ul>
        <li>Il corso regionale è obbligatorio anche per chi già esercita e per chi vuole specializzarsi nel trucco permanente; alle estetiste con qualifica regionale è riconosciuto un credito di 20 ore (modulo cute e mucose).</li>
        <li>Fonte: enti di formazione autorizzati, concordi fra loro; il testo della DGR è disponibile solo come scansione non leggibile. Confermare con l'ASP.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">90<small>ORE · 70 TEORIA + 20 LABORATORIO</small></div>
      <ul>
        <li>Corso 90 ore in 6 moduli; accesso 18 anni e obbligo scolastico; frequenza ≥70%; esame scritto, pratico e colloquio con rappresentante della Regione; attestato "di frequenza e idoneità professionale" riconosciuto dall'ASP.</li>
        <li>Le linee guida includono il trucco permanente nel proprio ambito: il tatuatore formato può eseguirlo.</li>
        <li>SCIA al SUAP, requisiti dei locali, consenso, minori, aggiornamento e sanzioni presenti nella DGR ma non verificabili sulla scansione.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.tatuatori.it/blog-news-tattoo/downloads/category/6-direttive-regionali?download=17:regione-calabria-delibera-n-228-del-14-5-2012-linee-guida-per-l-esercizio-delle-attivita-di-tatuaggio-piercing">DGR 228/2012 (scansione)</a>
    <a href="https://www.isteform.com/corsi/36-corso-di-abilitazione-tatuaggi-piercing-trucco-permanente-e-semipermanente.html">Isteform, corso abilitazione (ente autorizzato)</a>
  </div>
</section>

<section class="region" id="sicilia">
  <div class="head"><h3>Sicilia</h3><span class="pill warn">posizione PMU da confermare con ASP</span></div>
  <p class="norm">Decreto Assessorato Sanità 31/07/2003 "Linee guida in materia di tatuaggi e piercing" (GURS 35/2003) · regolamenti aziendali ASP · regolamenti comunali</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">60-90<small>ORE ASP · CREDITO MODULO 1</small></div>
      <ul>
        <li>Nessuna legge regionale sull'estetista; i regolamenti comunali inseriscono il "disegno epidermico o trucco semipermanente" tra le attività dell'estetista e rinviano al D.A. 2003 per il tatuaggio.</li>
        <li>Nei corsi ASP le estetiste qualificate ottengono il credito del primo modulo (ASP Ragusa). Nessun atto regionale dice se l'estetista che fa PMU debba frequentare il corso ASP: chiedere all'ASP (Igiene ambienti di vita).</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">≥60<small>ORE (PRASSI 80-90) · NULLA OSTA ASP</small></div>
      <ul>
        <li>Corso ASP obbligatorio: minimo 60 ore per il decreto, in pratica 80-90 (ASP Palermo 2025: 90 ore, esame scritto, pratico e orale, 610 €; ASP Agrigento: 6ª edizione a fine 2026). Accesso 18 anni con diploma o 10 anni di scolarità. Rilascia idoneità sanitaria, non una qualifica.</li>
        <li>Requisiti: 18 anni, conoscenze tecniche e igieniche, vaccinazione anti-epatite B. Locali: stanza operativa ≥14 m² con lavabo, sterilizzazione separata, WC con antibagno, pareti lavabili 1,80 m.</li>
        <li>SCIA o autorizzazione al SUAP + nulla osta tecnico-sanitario ASP; consenso informato; registro prestazioni.</li>
        <li>Minori: tatuaggi vietati sotto i 18 (ISS). Aggiornamento e sanzioni non reperiti.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="http://www.gurs.regione.sicilia.it/Gazzette/g03-35/g03-35-p16.htm">GURS 35/2003, D.A. 31/07/2003</a>
    <a href="https://www.aspag.it/attivazione-6-corso-di-formazione-per-operatori-addetti-a-tatuaggi-e-piercing-avviso-manifestazione-di-interesse/">ASP Agrigento, 6° corso 2026</a>
    <a href="https://www.ansa.it/sicilia/notizie/2025/05/27/asp-di-palermo-avvia-corso-formazione-per-tatuatori_ff00252f-2fb1-4311-a216-9cc9e1d7a7c5.html">ASP Palermo, corso 2025</a>
  </div>
</section>

<section class="region" id="sardegna">
  <div class="head"><h3>Sardegna</h3><span class="pill alt">PMU = tatuaggio · estetiste al corso</span></div>
  <p class="norm">DGR 22/11 del 22/05/2012 (programma regionale) · Det. DG Sanità 1081/2012 e 1528 del 21/11/2012 · DGR 41/21 del 01/12/2023 (standard formativi Operatore di tatuaggio e piercing)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetisti</h4>
      <div class="hours">≥60<small>ORE ASL · NESSUN ESONERO</small></div>
      <ul>
        <li>Il programma regionale definisce il trucco permanente come "tatuaggio praticato sul viso" e rende il corso ASL obbligatorio anche per chi lo esegue "in via complementare alle attività di estetica".</li>
        <li>Corso ASL ≥60 ore con esame scritto e colloquio, idoneità sanitaria SISP con sopralluogo, notifica al SUAPE (modello D).</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Altri operatori</h4>
      <div class="hours">≥60 · 1.000<small>ORE ASL · ORE QUALIFICA (CREDITO 130)</small></div>
      <ul>
        <li>Corso igienico-sanitario ASL ≥60 ore (3 moduli), frequenza ≥90%, attestato di abilitazione "che non attribuisce qualifica"; titoli di altre regioni riconosciuti se di pari valenza. Requisiti: 18 anni, 10 anni di scolarità, vaccinazione HBV.</li>
        <li>Qualifica "Operatore di tatuaggio e piercing" (DGR 41/21/2023): 1.000 ore (760 tecnico-professionali di cui 300 stage, 130 igienico-sanitarie), agenzie accreditate, esame con esperto ASL; credito di 130 ore a chi ha l'attestato ASL, fino a 522 ore per esperienza. Il documento 2023 non menziona il PMU.</li>
        <li>Aggiornamento 24 ore ogni 3 anni.</li>
        <li>Pratica SUAPE con planimetrie, agibilità, contratto rifiuti, attestato; locale operativo ≥14 m² (10 se un solo operatore), altezza 2,70.</li>
        <li>Consenso (mod. A/B), scheda individuale (mod. C), registro vidimato SISP conservato 5 anni; minori di 18 solo con genitore presente; guest artist massimo 10 giorni.</li>
      </ul>
    </div>
  </div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.sardegna.it/documenti/1_38_20130430124008.pdf">Det. 1528/2012 allegato A</a>
    <a href="https://delibere.regione.sardegna.it/protected/68153/0/def/ref/DBR68083/">DGR 41/21/2023 allegato</a>
    <a href="https://www.comune.cagliari.it/portale/page/it/avvio_di_attivita_tatuatori_e_piercing?contentId=SRV12516">Comune di Cagliari, avvio attività tatuatori</a>
  </div>
</section>

<footer>
  <p><strong>Come usare questo documento.</strong> Le schede riassumono atti pubblici verificati il 3 settembre 2026 e segnalano ogni punto non confermato da fonte ufficiale. Non sostituiscono un parere legale né la verifica con SUAP, ASL e Regione competenti, che restano le sole autorità in grado di confermare i requisiti per un caso concreto. Le ore dei corsi cambiano quando le Regioni riaprono i bandi: prima di iscriversi, controllare l'avviso più recente.</p>
</footer>

</main>
</div>
`;
