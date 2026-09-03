// Il testo della "Mappa Normativa PMU", ripreso parola per parola dal
// documento originale: quadro nazionale, le sentenze, la strada del
// tatuatore (con la regola d'oro sulla SCIA), formarsi altrove, tabella
// di sintesi e le schede regionali con i link alle fonti. Sta in un file
// suo perche' e' un documento, non codice: si aggiorna quando cambiano le
// norme, senza toccare l'applicazione.
export const HTML_NORMATIVA_PMU = String.raw`
<div class="wrap">
<header class="top">
  <div class="eyebrow">Trucco permanente · dermopigmentazione · microblading</div>
  <h1>Mappa Normativa PMU</h1>
  <p class="lede">In ogni regione: l'estetista può fare trucco permanente? Chi non è estetista può farlo? Cosa serve, cosa rischia, e se conviene formarsi in un'altra regione per poi lavorare qui.</p>
  <div class="meta">
    <span>Verifica fonti: 3 settembre 2026</span>
    <span>20 regioni + 2 province autonome</span>
    <span>Solo trucco permanente: il tatuaggio artistico e il piercing non sono trattati</span>
  </div>
  <div class="legend">
    <div class="fig est"><h4 class="est">Estetista</h4><p>Chi ha la qualifica di estetista (L. 1/1990). In tutta Italia può usare il dermografo (scheda 23 del D.I. 206/2015) con una formazione certificata sull'apparecchio. La differenza fra regioni è se serve anche un corso igienico-sanitario regionale, e di quante ore.</p></div>
    <div class="fig alt"><h4 class="alt">Non estetista</h4><p>Tatuatore, dermopigmentista o chiunque non abbia la qualifica di estetista. Può fare trucco permanente con certezza dove la Regione ha inserito il PMU nel tatuaggio (verde). Dove la Regione non ha scritto nulla (grigio) può aprire uno studio di tatuaggio con la SCIA standard, che copre anche il trucco permanente, con un argomento forte (Cons. Stato 1930/2024) e un rischio reale di contestazione. Dove la Regione ha riservato il PMU all'estetista per iscritto (rosso) opera contro un atto regionale, salvo ricorso.</p></div>
  </div>
</header>

<div class="layout">
<nav class="side" aria-label="Indice">
  <div class="grp">Quadro</div>
  <a href="#nazionale">Quadro nazionale</a>
  <a href="#giurisprudenza">Le sentenze</a>
  <a href="#strada">La strada del tatuatore</a>
  <a href="#mobilita">Formarsi altrove</a>
  <a href="#sintesi">Tabella di sintesi</a>
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
  <h2>Quadro nazionale in quattro righe</h2>
  <div class="cards">
    <div class="card">
      <h4 style="color:var(--est)">L'estetista</h4>
      <ul>
        <li><span class="k">L. 1/1990</span> e <span class="k">D.I. 206/2015 scheda 23</span>: il dermografo per micropigmentazione è fra gli apparecchi dell'estetista, con formazione certificata dal fabbricante o da ente competente.</li>
        <li><span class="k">Parere MISE 33406 del 19/01/2018</span>: dove la Regione non ha disciplinato il PMU, vale la L. 1/1990, quindi serve la qualifica di estetista.</li>
        <li><span class="k">Cons. Stato 4732/2021</span>: la dermopigmentazione è attività estetica, non sanitaria, anche sull'areola.</li>
      </ul>
    </div>
    <div class="card">
      <h4 style="color:var(--alt)">Il non estetista</h4>
      <ul>
        <li>Non esiste una legge nazionale sul tatuaggio: valgono le <span class="k">circolari Min. Sanità 1998</span> e le delibere regionali.</li>
        <li><span class="k">Cons. Stato 1930 del 28/02/2024</span>: nessuna norma statale riserva la dermopigmentazione all'estetista; ogni Regione può ammettere i tatuatori formati. Decide la Regione.</li>
        <li>Otto territori lo hanno fatto (verde): Lazio, Abruzzo, Toscana, FVG, Bolzano, Sardegna, Puglia, Calabria, più la Campania quasi verde. Cinque hanno riservato il PMU all'estetista per iscritto (rosso): Lombardia, Liguria, Marche, Veneto, Piemonte. Sette non hanno scritto nulla (grigio) e possono ancora includerlo: lì la strada del tatuatore è percorribile con rischio.</li>
      </ul>
    </div>
    <div class="card">
      <h4>Per tutti, in ogni regione</h4>
      <ul>
        <li>Pigmenti conformi al <span class="k">Reg. (UE) 2020/2081</span> con dichiarazione del fornitore.</li>
        <li>SCIA al SUAP del Comune dove si lavora, Registro Imprese o Albo artigiani, locali idonei, consenso informato scritto, rifiuti a rischio infettivo con ditta autorizzata.</li>
        <li>Chi opera senza i requisiti rischia una sanzione amministrativa e la chiusura, non un reato: la Cassazione ha escluso l'art. 348 c.p. per il tatuaggio.</li>
      </ul>
    </div>
    <div class="card">
      <h4>Non ancora in vigore</h4>
      <ul>
        <li><span class="k">DDL AS 1531 melanoma</span> (Senato 27/01/2026, ora alla Camera): consenso informato obbligatorio per i tatuatori con decreti attuativi.</li>
        <li>Piemonte: regolamento della L.R. 2/2023 mancante. Abruzzo: regolamento della L.R. 41/2020 mancante. Emilia-Romagna: interrogazione regionale aperta sulla dermopigmentazione.</li>
      </ul>
    </div>
  </div>
</section>

<section class="block" id="giurisprudenza">
  <div class="eyebrow">Parte 2</div>
  <h2>Le sentenze: cosa dicono davvero</h2>
  <p>Circola l'idea che "tribunali e Cassazione" abbiano stabilito che il tatuatore può fare trucco permanente ovunque. Le sentenze verificate dicono una cosa diversa: <strong>nessuna legge statale riserva la dermopigmentazione all'estetista, e ogni Regione è libera di ammettere o non ammettere i tatuatori</strong>.</p>
  <div class="tablewrap">
  <table>
    <thead><tr><th>Pronuncia</th><th>Cosa ha deciso</th><th>Portata per il PMU</th></tr></thead>
    <tbody>
      <tr><td class="reg">Cons. Stato Sez. III<br>n. 1930 del 28/02/2024</td><td>Respinge il ricorso delle estetiste contro la L.R. Lazio 2/2021 e la DGR 270/2022. La L. 1/1990 non riserva la dermopigmentazione; la scheda 23 è fonte secondaria; la dermopigmentazione è un tatuaggio a minore profondità; le Regioni possono ammettere i tatuatori formati.</td><td><span class="pill alt">favorevole ai tatuatori</span> dove la Regione li ha ammessi. Conferma un atto regionale, non crea un diritto nazionale.</td></tr>
      <tr><td class="reg">TAR Lazio Sez. II<br>n. 3861 del 08/03/2023</td><td>Primo grado dello stesso giudizio. Alcune fonti la citano erroneamente come "n. 38/2023".</td><td><span class="pill alt">favorevole ai tatuatori</span> nel Lazio.</td></tr>
      <tr><td class="reg">Cons. Stato Sez. III<br>n. 4732 del 18/06/2021</td><td>Annulla la nota del Ministero della Salute 14138/2019 sull'areola: la dermopigmentazione è attività estetica, non terapeutica.</td><td><span class="pill est">favorevole alle estetiste</span> contro i sanitari. Non riguarda i tatuatori.</td></tr>
      <tr><td class="reg">Cass. pen. Sez. VI<br>n. 524 e n. 2077 del 1996</td><td>Il tatuaggio non è professione protetta: chi lo pratica senza titolo non commette il reato dell'art. 348 c.p. Stesso principio nel Tribunale di Trento, ord. 22/11/2016.</td><td><span class="pill warn">nessun effetto sul PMU</span>. Escludono il penale, non toccano la L. 1/1990.</td></tr>
      <tr><td class="reg">Cons. Stato n. 331/1997<br>TAR Parma n. 678/1999</td><td>Il tatuaggio è assimilabile all'estetica; la sanzione dell'art. 12 L. 1/1990 non esclude ordini di cessazione.</td><td><span class="pill est">sfavorevole ai tatuatori</span>: i precedenti usati dai Comuni per sanzionare.</td></tr>
      <tr><td class="reg">Corte costituzionale</td><td>Nessuna pronuncia sulle leggi regionali di tatuaggio e dermopigmentazione.</td><td><span class="pill warn">nessuna decisione</span></td></tr>
      <tr><td class="reg">Tribunali civili, giudici di pace, TAR di altre Regioni</td><td>Nessuna sentenza pubblicata che annulli sanzioni a tatuatori per PMU fuori dal Lazio. Il caso "Laura" in Lombardia citato dal Sindacato Nazionale Dermopigmentisti è una diffida <strong>ritirata dal Comune in autotutela</strong>: non è una decisione di un giudice e non fa precedente.</td><td><span class="pill warn">nessuna decisione giudiziaria</span></td></tr>
      <tr><td class="reg">Parere legale Studio MGT<br>(avv. B. Giancola, 07/04/2025)</td><td>Parere commissionato dal Sindacato. Ammette che la sentenza riguarda "esclusivamente" il Lazio; per le altre Regioni dice che il tatuatore sanzionato "potrebbe" impugnare al TAR chiedendo la disapplicazione, e il giudice "potrebbe" annullare. Ricorda che il Consiglio di Stato richiede "un apposito corso di formazione" (800 ore nel Lazio).</td><td><span class="pill warn">opinione di parte</span>. Strategia di ricorso in forma condizionale, non un diritto acquisito.</td></tr>
    </tbody>
  </table>
  </div>
  <div class="cards">
    <div class="card">
      <h4>Come usarle al telefono</h4>
      <ul>
        <li><strong>Regola d'oro</strong>: il non estetista apre con la SCIA normale di tatuaggio, che copre anche il trucco permanente. Non si nomina mai "dermopigmentazione" come attività a sé allo sportello. Dettagli nella sezione "La strada del tatuatore".</li>
        <li>Non dire mai "la sentenza ti autorizza". Dire: "la sentenza ha aperto il Lazio e le Regioni che hanno seguito la stessa strada; nella tua regione la situazione è questa".</li>
        <li>Se il cliente cita il volantino "serve l'abilitazione di estetista? NO": spiegare che il parere legale dello stesso Sindacato usa il condizionale e cita come prova un ritiro in autotutela, non una vittoria in tribunale.</li>
        <li>Chi decide di operare senza estetista in una regione restrittiva deve sapere che accetta una sanzione da contestare poi al TAR, a proprie spese e con esito incerto.</li>
      </ul>
    </div>
    <div class="card">
      <h4>Fonti</h4>
      <ul>
        <li><a href="https://ntplusdiritto.ilsole24ore.com/art/AGvrOMRD">NT+ Diritto, Cons. Stato 1930/2024</a></li>
        <li><a href="https://www.sindacatodermopigmentisti.it/wp-content/uploads/2025/04/PARERE-MGT-PDF.pdf">Parere Studio MGT, 07/04/2025 (PDF)</a></li>
        <li><a href="https://www.confestetica.it/comunicazioni/comunicati-stampa/i-tatuaggi-con-finalita-medica-sono-competenze-proprie-della-professione-di-estetista-lo-ha-chiarito-definitivamente-la-sentenza-del-consiglio-di-stato">Confestetica, Cons. Stato 4732/2021</a></li>
        <li><a href="https://www.laleggepertutti.it/434201_attivita-di-tatuatore-ultime-sentenze">La Legge per Tutti, sentenze sull'attività di tatuatore</a></li>
        <li><a href="https://www.sindacatodermopigmentisti.it/dermopigmentazione-le-sentenze-che-rivoluzionano-il-settore/">Sindacato Nazionale Dermopigmentisti, lettura delle sentenze</a></li>
      </ul>
    </div>
  </div>
</section>

<section class="block" id="strada">
  <div class="eyebrow">Parte 2 bis</div>
  <h2>La strada del tatuatore: dove è verde, dove è grigia, dove è rossa</h2>
  <p>Chi non è estetista non è escluso dal trucco permanente. Il tatuaggio non è una professione sanitaria né una professione protetta (Cassazione 1996): nessuno va a processo per aver pigmentato un sopracciglio. La domanda vera è amministrativa: il Comune accetta la SCIA e la ASL non contesta? La risposta cambia per regione, e va detta così com'è.</p>
  <div class="phone" style="border-left-color:var(--ok);margin-top:18px">
    <h4 style="color:var(--ok)">Regola d'oro: la SCIA</h4>
    <p><strong>Nessuno deve scrivere "dermopigmentazione" e farsi dire di no.</strong> Il tatuatore presenta la SCIA normale di tatuaggio, quella che presentano tutti i tatuatori. Il trucco permanente è un tatuaggio (lo dicono l'Istituto Superiore di Sanità e il Consiglio di Stato, sentenza 1930/2024), quindi quella SCIA lo copre. Insegna "studio di tatuaggio", listino con il tatuaggio cosmetico fra le prestazioni. Non si dichiara il falso e non si nasconde niente: si usa il nome giusto. Allo sportello non si chiede mai "posso fare dermopigmentazione senza essere estetista?", perché la risposta sarà no e resta agli atti.</p>
    <p style="margin-top:10px"><strong>Perché la SCIA conviene.</strong> Non viene accettata o respinta: l'attività apre il giorno stesso. Il Comune ha 60 giorni per bloccarla con un atto scritto e motivato. Se non lo fa, dopo 60 giorni la posizione è consolidata e per toglierla serve un'autotutela motivata entro 12 mesi (art. 19 e 21-nonies L. 241/1990). Se lo fa, c'è un atto pulito da impugnare con la sentenza 1930/2024 e il parere MGT. Chi lavora senza una SCIA che copra l'attività, se scoperto, chiude e paga senza difesa.</p>
  </div>
  <div class="cards">
    <div class="card" style="border-top:4px solid var(--ok)">
      <h4 style="color:var(--ok)">Verde: la Regione ha incluso il PMU nel tatuaggio</h4>
      <p>Lazio, Abruzzo, Toscana, Friuli-Venezia Giulia, Bolzano, Sardegna, Puglia, Calabria. Campania quasi verde (il PMU è nella qualifica regionale, non in una delibera sanitaria).</p>
      <p>Percorso: il corso o la qualifica regionale, la SCIA come attività di tatuaggio, i locali. Nessun argomento da preparare: è la regola.</p>
    </div>
    <div class="card" style="border-top:4px solid var(--warn)">
      <h4 style="color:var(--warn)">Grigio: la Regione non ha scritto nulla sul PMU</h4>
      <p>Emilia-Romagna, Umbria, Valle d'Aosta, Trento, Molise, Basilicata, Sicilia. Nessun atto regionale esclude il PMU dal tatuaggio né lo riserva all'estetista. Contro c'è solo il parere MISE 2018, che si fonda sulla L. 1/1990; il Consiglio di Stato nel 2024 ha detto che quella legge non contiene alcuna riserva.</p>
      <p>Percorso: aprire uno studio di tatuaggio con la SCIA standard, che copre anche il trucco permanente (vedi sotto). Rischio reale di contestazione, risposta pronta.</p>
    </div>
    <div class="card" style="border-top:4px solid var(--no)">
      <h4 style="color:var(--no)">Rosso: la Regione ha riservato il PMU all'estetista per iscritto</h4>
      <p>Lombardia (stralcio 2021 e Consulta), Liguria (DGR 593/2023), Marche (DGR 1598/2017), Veneto (parere 11/06/2026), Piemonte (nota 2019, in attesa del regolamento).</p>
      <p>Qui la strada del tatuatore significa operare contro un atto regionale esplicito. Il ricorso al TAR con la 1930/2024 è possibile (è la tesi del parere MGT), ma è un contenzioso, non una zona grigia. Va detto chiaramente.</p>
    </div>
    <div class="card">
      <h4>Come si percorre la strada grigia, senza bugie</h4>
      <ul>
        <li><strong>Corso igienico-sanitario regionale</strong> dove esiste (AUSL 14-16 h in Emilia-Romagna, 90 h in Umbria, 60 h a Trento, ASP in Sicilia). Toglie la contestazione più facile, quella igienica.</li>
        <li><strong>SCIA standard di tatuaggio</strong>, sul modulo unificato "attività di tatuaggio e piercing" del SUAP. Il PMU è tatuaggio a minore profondità (ISS, Consiglio di Stato): la SCIA di tatuaggio lo copre, non serve una SCIA "di dermopigmentazione" e non va mai usata la parola "estetica". Se il modulo chiede l'elenco delle prestazioni, scrivere "tatuaggio, incluso tatuaggio cosmetico (dermopigmentazione)": è vero, resta dentro la categoria tatuaggio e non trasforma la pratica in una richiesta di licenza estetica. Non scrivere il falso e non praticare attività che la SCIA non copre: la difesa regge solo se ciò che si fa è ciò che si è dichiarato.</li>
        <li><strong>Il meccanismo della SCIA lavora a favore.</strong> La SCIA non viene "accettata" o "respinta": l'attività parte il giorno stesso. Il Comune ha 60 giorni per verificare e, se ritiene che manchi un requisito, deve emettere un divieto motivato (o chiedere di conformarsi). Passati i 60 giorni senza atti, la posizione si consolida: il Comune può intervenire solo in autotutela, entro 12 mesi e con una motivazione di interesse pubblico (art. 19 e 21-nonies L. 241/1990). Un eventuale divieto nei 60 giorni è un atto formale, pulito, da impugnare con il kit: è esattamente la strada che il parere MGT descrive. Un'attività scoperta perché non coperta dalla SCIA, invece, è "attività senza SCIA": chiusura, sanzione e nessuna difesa.</li>
        <li><strong>Formazione tecnica PMU documentata</strong> con attestato e programma ore: il Consiglio di Stato ammette i tatuatori "correttamente formati", non chiunque.</li>
        <li><strong>Titolo rafforzativo</strong> di una regione verde (Lazio 800 h, Puglia o Calabria 90 h): non è riconosciuto automaticamente, ma davanti a un Comune o a un TAR pesa molto più di un corso privato.</li>
        <li><strong>Kit di difesa pronto</strong>: sentenza 1930/2024, TAR Lazio 3861/2023, parere MGT del 07/04/2025, definizione ISS. Se arriva una diffida: istanza in autotutela al Comune entro pochi giorni (è così che è finita nel caso lombardo citato dal Sindacato), poi ricorso al TAR entro 60 giorni se serve.</li>
        <li><strong>Una parola da non usare allo sportello: "dermopigmentazione" come attività a sé.</strong> Nelle regioni grigie gli uffici, sentendo "dermopigmentazione" o "trucco permanente", rispondono in automatico "serve l'estetista", perché associano la parola alla scheda 23. La pratica è una SCIA di tatuaggio, l'insegna è "studio di tatuaggio", il listino può elencare il tatuaggio cosmetico fra le prestazioni. Non è nascondere: è chiamare la cosa con il nome della categoria giuridica in cui la mettono ISS e Consiglio di Stato. Chiedere allo sportello "posso fare dermopigmentazione senza essere estetista?" equivale a chiedere un parere che sarà negativo e resterà agli atti.</li>
        <li><strong>Cosa dire all'allieva</strong>: "puoi lavorare, la legge nazionale non ti vieta nulla e la tua regione non ha scritto nulla contro; se un Comune contesta, hai gli strumenti per rispondere, ma è una contestazione possibile e ha un costo. Se vuoi zero rischio, la strada è la qualifica di estetista o una regione verde".</li>
      </ul>
    </div>
  </div>
</section>

<section class="block" id="mobilita">
  <div class="eyebrow">Parte 3</div>
  <h2>Formarsi in una regione e lavorare in un'altra</h2>
  <p>Domanda frequente: "Faccio il corso da tatuatore nel Lazio, che include il trucco permanente, e poi lavoro nella mia regione?". La regola che vale ovunque è questa.</p>
  <div class="cards">
    <div class="card">
      <h4>Il principio</h4>
      <ul>
        <li>Il titolo è regionale. La SCIA si presenta al Comune dove si lavora, e quel Comune applica le regole della <strong>propria</strong> Regione, non di quella dove hai studiato.</li>
        <li>Il corso da tatuatore di un'altra regione può essere riconosciuto solo dove la Regione di arrivo ha una clausola di riconoscimento o di crediti, e solo per il percorso che quella Regione prevede.</li>
        <li>Nelle Regioni che richiedono l'estetista, nessun titolo da tatuatore, di nessuna regione, sostituisce la qualifica di estetista. Il titolo serve solo come argomento in un eventuale ricorso.</li>
      </ul>
    </div>
    <div class="card">
      <h4>Cosa funziona davvero</h4>
      <ul>
        <li><strong>Lazio → Abruzzo, Toscana, Sardegna</strong>: il titolo laziale dà crediti (fino al 30% dell'aula e 50% del tirocinio in Abruzzo; percorso abbreviato valutato in Toscana; 130 ore in Sardegna se hai anche l'attestato ASL), ma serve completare il percorso locale.</li>
        <li><strong>Corso igienico-sanitario 90 ore</strong> (Veneto, FVG, Puglia, Calabria, Umbria, Piemonte): spesso riconosciuto fra queste regioni se le ore non sono inferiori. Non abilita da solo al PMU dove serve l'estetista.</li>
        <li><strong>Regioni restrittive</strong> (Lombardia, Liguria, Marche, Veneto): nessun titolo esterno apre la porta. L'unica strada certa è la qualifica di estetista.</li>
        <li><strong>Regioni grigie</strong> (Valle d'Aosta, Trento, Emilia-Romagna, Umbria, Molise, Basilicata, Sicilia): non c'è un requisito regionale da soddisfare, quindi il titolo di una regione verde è il documento più forte da allegare alla SCIA di tatuaggio, e la prova di formazione che il Consiglio di Stato chiede ai tatuatori. Dove esiste un corso igienico-sanitario locale, resta da fare.</li>
      </ul>
    </div>
  </div>
</section>

<section class="block" id="sintesi">
  <div class="eyebrow">Parte 4</div>
  <h2>Tabella di sintesi</h2>
  <div class="tablewrap">
  <table>
    <thead><tr><th>Regione</th><th>Estetista</th><th>Cosa serve all'estetista</th><th>Non estetista</th><th>Cosa serve al non estetista</th><th>Titolo preso altrove</th></tr></thead>
    <tbody>
      <tr><td class="reg">Piemonte</td><td><span class="pill ok">SÌ</span></td><td>corso 90+4 h</td><td><span class="pill no">NO (per ora)</span></td><td>serve anche qualifica estetista; possibile apertura col regolamento L.R. 2/2023</td><td>non sostituisce l'estetista</td></tr>
      <tr><td class="reg">Valle d'Aosta</td><td><span class="pill ok">SÌ</span></td><td>nessun corso regionale</td><td><span class="pill warn">zona grigia</span></td><td>SCIA standard di tatuaggio + parere USL; nessun divieto regionale</td><td>nessun requisito da soddisfare; titolo esterno utile nella SCIA</td></tr>
      <tr><td class="reg">Lombardia</td><td><span class="pill ok">SÌ</span></td><td>solo formazione dermografo</td><td><span class="pill no">NO</span></td><td>qualifica estetista (riserva regionale)</td><td>non vale</td></tr>
      <tr><td class="reg">Liguria</td><td><span class="pill ok">SÌ</span></td><td>solo formazione dermografo (prassi ASL da verificare)</td><td><span class="pill no">NO</span></td><td>qualifica estetista (DGR 593/2023)</td><td>non vale</td></tr>
      <tr><td class="reg">Veneto</td><td><span class="pill ok">SÌ</span></td><td>corso 90 h (credito 20 h) + locali tatuaggio</td><td><span class="pill no">NO</span></td><td>qualifica estetista (parere Regione 11/06/2026)</td><td>corso 90 h riconosciuto, ma non basta</td></tr>
      <tr><td class="reg">Friuli-V.G.</td><td><span class="pill ok">SÌ</span></td><td>corso ≥90 h + SCIA tatuaggio</td><td><span class="pill ok">SÌ</span></td><td>corso ≥90 h + SCIA tatuaggio</td><td>riconoscimento non disciplinato</td></tr>
      <tr><td class="reg">P.A. Trento</td><td><span class="pill ok">SÌ</span></td><td>corso 60 h + idoneità APSS</td><td><span class="pill warn">zona grigia</span></td><td>corso 60 h + idoneità APSS + SCIA standard di tatuaggio</td><td>corso provinciale comunque richiesto</td></tr>
      <tr><td class="reg">P.A. Bolzano</td><td><span class="pill ok">SÌ</span></td><td>corso ≥30 h + autorizzazione Servizio Igiene</td><td><span class="pill ok">SÌ</span></td><td>corso ≥30 h + autorizzazione Servizio Igiene</td><td>equipollenza su domanda</td></tr>
      <tr><td class="reg">Emilia-Romagna</td><td><span class="pill ok">SÌ</span></td><td>corso AUSL 14-16 h + certificazione dermografo + SCIA tatuaggio</td><td><span class="pill warn">zona grigia</span></td><td>corso AUSL + SCIA standard di tatuaggio; interrogazione regionale aperta</td><td>corsi igienico-sanitari esterni riconosciuti</td></tr>
      <tr><td class="reg">Toscana</td><td><span class="pill ok">SÌ</span></td><td>corso 80 h + esame</td><td><span class="pill ok">SÌ</span></td><td>tecnico qualificato in tatuaggio 600 h</td><td>crediti valutati dalla Regione</td></tr>
      <tr><td class="reg">Umbria</td><td><span class="pill ok">SÌ</span></td><td>corso 90 h USL (modulo 1 facoltativo)</td><td><span class="pill warn">zona grigia</span></td><td>corso 90 h + idoneità USL + SCIA standard di tatuaggio</td><td>corso umbro comunque richiesto</td></tr>
      <tr><td class="reg">Marche</td><td><span class="pill ok">SÌ</span></td><td>nessun corso se operante al 2017; altrimenti 300/450 h</td><td><span class="pill no">NO</span></td><td>qualifica estetista (DGR 1598/2017)</td><td>non vale</td></tr>
      <tr><td class="reg">Lazio</td><td><span class="pill ok">SÌ</span></td><td>corso dermografo + igienico-sanitario</td><td><span class="pill ok">SÌ</span></td><td>Operatore tatuaggio 800 h</td><td>crediti fino al 100% per titoli ≥500 h</td></tr>
      <tr><td class="reg">Abruzzo</td><td><span class="pill warn">SÌ con riserva</span></td><td>qualifica regionale con crediti (legge non cita l'estetista)</td><td><span class="pill ok">SÌ</span></td><td>Op. tatuaggio e trucco permanente 450 h</td><td>crediti 30% aula / 50% tirocinio</td></tr>
      <tr><td class="reg">Molise</td><td><span class="pill ok">SÌ</span></td><td>corso regionale: da chiedere ad ASReM</td><td><span class="pill warn">zona grigia</span></td><td>corso regionale + idoneità ASReM + SCIA standard di tatuaggio</td><td>nessuna norma; corso 90 h Puglia utile</td></tr>
      <tr><td class="reg">Campania</td><td><span class="pill ok">SÌ</span></td><td>corso ASL 50 h (prassi)</td><td><span class="pill warn">SÌ probabile</span></td><td>qualifica regionale 500 h (include PMU) + corso ASL 50 h; conferma ASL</td><td>nessuna norma</td></tr>
      <tr><td class="reg">Puglia</td><td><span class="pill ok">SÌ</span></td><td>corso 90 h + locali autonomi</td><td><span class="pill ok">SÌ</span></td><td>corso 90 h</td><td>corso 90 h di altre regioni equiparato</td></tr>
      <tr><td class="reg">Basilicata</td><td><span class="pill ok">SÌ</span></td><td>nessun corso regionale</td><td><span class="pill warn">zona grigia</span></td><td>SCIA standard di tatuaggio + requisiti ASP; nessun corso obbligatorio</td><td>nessun requisito; corso 90 h Puglia/Calabria utile</td></tr>
      <tr><td class="reg">Calabria</td><td><span class="pill ok">SÌ</span></td><td>corso 90 h (credito 20 h)</td><td><span class="pill ok">SÌ</span></td><td>corso 90 h (DGR 228/2012)</td><td>da confermare con ASP</td></tr>
      <tr><td class="reg">Sicilia</td><td><span class="pill ok">SÌ</span></td><td>corso ASP: posizione non scritta, chiedere</td><td><span class="pill warn">zona grigia</span></td><td>corso ASP + nulla osta + SCIA standard di tatuaggio; verificare regolamento comunale</td><td>corso ASP comunque richiesto</td></tr>
      <tr><td class="reg">Sardegna</td><td><span class="pill ok">SÌ</span></td><td>corso ASL ≥60 h + idoneità SISP</td><td><span class="pill ok">SÌ</span></td><td>corso ASL ≥60 h + idoneità SISP</td><td>attestato ASL di altre regioni riconosciuto se equivalente</td></tr>
    </tbody>
  </table>
  </div>
</section>

<div class="group-title"><div class="eyebrow">Parte 5</div><h2>Schede regionali · Nord</h2></div>

<section class="region" id="piemonte">
  <div class="head"><h3>Piemonte</h3><span class="pill ok">estetista SÌ</span><span class="pill no">non estetista NO, per ora</span></div>
  <p class="norm">L.R. 2/2023 mod. L.R. 28/2023 · DGR 20-3738/2016 (corso 90 h) · Nota Regione prot. 5145 del 28/01/2019 · D.P.G.R. 46/2003</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>qualifica + corso 90 h + 4 h esame</small></div>
      <div class="lbl">Cosa serve</div>
      <ul>
        <li>Corso rischi sanitari tatuaggio, piercing e trucco permanente (DGR 20-3738/2016) presso agenzie formative accreditate; alcune agenzie esonerano dal modulo 1 (15 h), ma senza atto regionale.</li>
        <li>SCIA estetica al SUAP e notifica al SISP dell'ASL con moduli del D.P.G.R. 46/2003; locali con zona trattamenti lavabile e zona sterilizzazione.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict no">NO<small>serve anche la qualifica di estetista</small></div>
      <div class="lbl">Perché</div>
      <ul>
        <li>Nota della Regione del 28/01/2019: "chi intende operare con il trucco permanente deve essere in possesso anche dell'abilitazione di estetista; non è sufficiente il solo corso sui rischi sanitari". ASL TO5 (2025) chiede formazione "per estetista e per tatuatore".</li>
        <li>La L.R. 28/2023 ha incluso la dermopigmentazione nel tatuaggio, ma il regolamento attuativo non è stato adottato: quando arriverà, il percorso tatuatore (1.500 ore) potrebbe abilitare anche al PMU.</li>
      </ul>
      <div class="lbl">Rischio se opera comunque</div>
      <ul><li>Sanzione per esercizio abusivo dell'estetica (art. 12 L. 1/1990) e, per il tatuaggio, 3.000-15.000 € (L.R. 2/2023 art. 12); ordine di cessazione.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Un titolo da tatuatore preso nel Lazio o altrove non sostituisce la qualifica di estetista. La L.R. 2/2023 riconosce gli attestati di altre regioni solo ai fini del percorso tatuaggio (con verifica di equivalenza), non per il PMU. Da rivalutare quando uscirà il regolamento.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.piemonte.it/web/sites/default/files/media/documenti/2019-04/chiarimenti_sullattivita_di_trucco_permanente_e_semipermanente_ed_utilizzo_del_dermografo.pdf">Nota Regione Piemonte 28/01/2019</a>
    <a href="https://www.aslto5.piemonte.it/it/attivita/requisiti-specifici-per-tatuatori-piercing">ASL TO5, requisiti trucco permanente</a>
    <a href="http://arianna.cr.piemonte.it/iterlegcoordweb/dettaglioLegge.do?urnLegge=urn:nir:regione.piemonte:legge:2023-01-30%3B2@2023-11-17">L.R. 2/2023 vigente</a>
  </div>
</section>

<section class="region" id="vda">
  <div class="head"><h3>Valle d'Aosta</h3><span class="pill ok">estetista SÌ</span><span class="pill warn">non estetista zona grigia</span></div>
  <p class="norm">Nessun atto regionale su tatuaggio o PMU · L.R. 63/1993 (estetista) · Consiglio Valle, oggetto 498 del 21/04/2021 · Parere MISE 2018</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>nessun corso regionale</small></div>
      <div class="lbl">Cosa serve</div>
      <ul>
        <li>Qualifica di estetista (abilitazione regionale, 4 percorsi) e formazione sul dermografo certificata dal fabbricante o da ente competente (scheda 23).</li>
        <li>SCIA al SUAP e parere USL sui locali.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict forse">Zona grigia<small>possibile come attività di tatuaggio, con rischio</small></div>
      <div class="lbl">La strada</div>
      <ul>
        <li>Nessun atto regionale esclude il PMU dal tatuaggio né lo riserva all'estetista; la Regione non chiede requisiti professionali ai tatuatori (Consiglio Valle 2021). Contro c'è solo il parere MISE 2018, indebolito dalla sentenza 1930/2024.</li>
        <li>Percorso: SCIA al SUAP con la SCIA standard di tatuaggio (il PMU è tatuaggio; se il modulo chiede le prestazioni: "tatuaggio, incluso tatuaggio cosmetico"), parere USL sui locali, formazione tecnica PMU documentata, meglio con un corso igienico-sanitario di una regione vicina (Piemonte 90 h) e un titolo rafforzativo di regione verde.</li>
        <li>Proposta di legge regionale del 2024 mai approvata: la Regione potrebbe ancora disciplinare, in un senso o nell'altro.</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Medio: diffida o sanzione amministrativa (art. 12 L. 1/1990), mai penale. Risposta: istanza in autotutela con la 1930/2024 e il parere MGT, poi TAR entro 60 giorni. Esito non garantito.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Nessun meccanismo formale di riconoscimento, ma nemmeno un requisito da soddisfare: un titolo del Lazio o un corso 90 ore piemontese sono i documenti da mettere nella SCIA per mostrare la formazione.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.consiglio.vda.it/app/oggettidelconsiglio/dettaglio?pk_documento=43052&versione=R">Consiglio Valle, oggetto 498/2021</a>
    <a href="https://www.cna.vda.it/trucco-semipermanente-nellambito-dellattivita-di-estetista-puo-essere-esercitato-da-soggetti-idoneamente-formati/">CNA Valle d'Aosta</a>
  </div>
</section>

<section class="region" id="lombardia">
  <div class="head"><h3>Lombardia</h3><span class="pill ok">estetista SÌ</span><span class="pill no">non estetista NO</span></div>
  <p class="norm">L.R. 13/2021 (PMU stralciato) · R.R. 5/2016 (estetista) · Consulta artigianato, quesiti 07/10/2021</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>solo formazione sul dermografo</small></div>
      <div class="lbl">Cosa serve</div>
      <ul>
        <li>Corso del fabbricante o di ente competente sul dermografo (scheda 23); nessun corso igienico-sanitario regionale (Consulta 2021, vale anche per il microblading).</li>
        <li>SCIA estetica al SUAP, responsabile tecnico, requisiti dell'allegato 1 al R.R. 5/2016, vigilanza ATS.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict no">NO<small>riserva regionale all'estetista</small></div>
      <div class="lbl">Perché</div>
      <ul>
        <li>Nel 2021 la Regione ha stralciato la dermopigmentazione dalla legge sul tatuaggio dichiarandola attività propria dell'estetista. Il corso tatuatori da 1.500 ore non abilita al PMU.</li>
        <li>Il Sindacato Nazionale Dermopigmentisti sostiene che ci sia un "vuoto normativo" e cita una diffida ritirata in autotutela da un Comune non nominato. Non c'è una sentenza.</li>
      </ul>
      <div class="lbl">Rischio se opera comunque</div>
      <ul><li>Diffida e ordine di cessazione del Comune, sanzione per esercizio abusivo dell'estetica (art. 12 L. 1/1990). Possibile istanza in autotutela e ricorso al TAR con la 1930/2024, esito incerto.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Nessun titolo esterno vale: la Lombardia non riconosce nemmeno automaticamente i titoli di tatuaggio di altre regioni, e per il PMU chiede l'estetista. Chi vuole lavorare in Lombardia senza estetista deve sapere che opera fuori dalle regole regionali.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.bs.camcom.it/sites/default/files/contenuto_redazione/files/Albi/Quesiti_Consulta_tecnica_artigianato_07_10_2021.pdf">Consulta artigianato 07/10/2021</a>
    <a href="https://www.confestetica.it/comunicazioni/approvata-nuova-legge-sul-tatuaggio-in-regione-lombardia-la-dermopigmentazione-e-stata-stralciata-e-resta-di-competenza-propria-dellestetista">Stralcio dermopigmentazione L.R. 13/2021</a>
  </div>
</section>

<section class="region" id="liguria">
  <div class="head"><h3>Liguria</h3><span class="pill ok">estetista SÌ</span><span class="pill no">non estetista NO</span></div>
  <p class="norm">DGR 593 del 22/06/2023 (direttiva vincolante) · DGR 787/2008 e 831/2009 · L.R. 3/2003 (estetista)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>esclusiva per delibera regionale</small></div>
      <div class="lbl">Cosa serve</div>
      <ul>
        <li>Formazione certificata sul dermografo (scheda 23). Il corso 30 ore per tatuatori non è più richiesto dalla DGR 593/2023; ASL1 e i corsi CNA 2024 lo citano ancora per il "trucco permanente cromatico": conferma con la ASL.</li>
        <li>SCIA estetica con autocertificazione igienico-sanitaria; locale dedicato consigliato in centro estetico.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict no">NO<small>DGR 593/2023, cap. 4</small></div>
      <div class="lbl">Perché</div>
      <ul><li>La direttiva regionale esclude la dermopigmentazione dal tatuaggio e la definisce "tecnica di esclusiva competenza degli operatori con abilitazione di estetista".</li></ul>
      <div class="lbl">Rischio se opera comunque</div>
      <ul><li>Sospensione ASL, chiusura del Comune, sanzione art. 12 L. 1/1990.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>La Liguria riconosce i corsi di altre regioni solo per il tatuaggio (domanda alla Regione, valutazione ASL). Per il PMU nessun titolo esterno sostituisce l'estetista.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.confartigianato.savona.it/sites/default/files/archivio/allegati/news/REG_AMM_A_593_2023.pdf">DGR 593/2023</a>
    <a href="https://www.asl1.liguria.it/servizi-dalla-a-alla-z/50-apertura-tatuatore-piercing-trucco.html">ASL1, apertura attività</a>
  </div>
</section>

<section class="region" id="veneto">
  <div class="head"><h3>Veneto</h3><span class="pill ok">estetista SÌ</span><span class="pill no">non estetista NO</span></div>
  <p class="norm">DGR 11/2013 · DGR 355/2016 · DGR 1682/2022 · Parere Regione prot. 331025 dell'11/06/2026</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>qualifica + corso 90 h (70 effettive) + locali</small></div>
      <div class="lbl">Cosa serve</div>
      <ul>
        <li>Corso 90 ore con esame scritto e colloquio (enti accreditati e ULSS); credito 20 ore sul modulo 1 per le estetiste, da chiedere all'iscrizione.</li>
        <li>Locale apposito ed esclusivo anche dentro il centro estetico (condivisibili solo ingresso, attesa, bagno); SCIA al SUAP per l'attività di tatuaggio.</li>
      </ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict no">NO<small>parere regionale dell'11/06/2026</small></div>
      <div class="lbl">Perché</div>
      <ul><li>La Regione, rispondendo alle Camere di Commercio proprio sulla sentenza 1930/2024, ha scritto che in Veneto non esiste una disciplina come quella del Lazio e che "la sola frequenza del corso di 90 ore" non basta per esercitare la dermopigmentazione.</li></ul>
      <div class="lbl">Rischio se opera comunque</div>
      <ul><li>Sanzioni comunali, ordine di cessazione, art. 12 L. 1/1990. Il parere regionale rende il ricorso più difficile che altrove.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Il corso igienico-sanitario di un'altra regione è riconosciuto se conforme alle linee guida 1998 e con ore non inferiori a 90. Ma per il PMU resta obbligatoria la qualifica di estetista: un titolo laziale non apre il Veneto.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.veneto.it/documents/10713/68019/copia_cortesia_331025-2026.pdf/5d323f41-645b-41a1-a2b4-4d7087c3b28e">Parere Regione Veneto 11/06/2026</a>
    <a href="https://bur.regione.veneto.it/BurvServices/pubblica/Download.aspx?name=11_AllegatoA_245262.pdf&type=9&storico=False">DGR 11/2013</a>
  </div>
</section>

<section class="region" id="fvg">
  <div class="head"><h3>Friuli-Venezia Giulia</h3><span class="pill ok">estetista SÌ</span><span class="pill ok">non estetista SÌ</span></div>
  <p class="norm">L.R. 7/2012 (tatuaggio "ivi compreso il trucco permanente") · DPReg 064/2014</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso ≥90 h + SCIA tatuaggio, nessun credito</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso ≥90 ore con esame (enti accreditati); SCIA specifica per il tatuaggio; locale dedicato conforme al DPReg 064/2014 (≥12 m², sterilizzazione ≥4 m²).</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict si">SÌ<small>stesso corso, stessa SCIA</small></div>
      <div class="lbl">Cosa serve</div>
      <ul>
        <li>Corso ≥90 ore, iscrizione AIA o Registro Imprese, SCIA al SUAP; il SUAP regionale conferma che non serve altra qualifica.</li>
        <li>Minori: vietato sotto i 14; 14-18 con consenso dei genitori.</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Basso. Sanzioni 2.500-15.000 € solo per chi opera senza corso o SCIA.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Il riconoscimento dei corsi di altre regioni non è disciplinato: chiedere alla Regione prima di contare su un attestato esterno. Il titolo laziale da 800 ore è un buon argomento ma non dà un automatismo. Al contrario, il corso FVG da 90 ore è spesso riconosciuto in Veneto, Puglia ed Emilia-Romagna come corso igienico-sanitario.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://suap.regione.fvg.it/portale/cms/it/apertura-modifica/Tatuaggio-00002">SUAP FVG, scheda tatuaggio</a>
    <a href="https://lexview-int.regione.fvg.it/fontinormative/xml/xmllex.aspx?anno=2012&legge=7">L.R. 7/2012</a>
  </div>
</section>

<section class="region" id="trento">
  <div class="head"><h3>Provincia autonoma di Trento</h3><span class="pill ok">estetista SÌ</span><span class="pill warn">non estetista zona grigia</span></div>
  <p class="norm">DGP 2131/2003 · DGP 715/2023 (corso Fondazione Demarchi) · Parere MISE 2018</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso 60 h + idoneità APSS</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso igienico-sanitario provinciale, una edizione l'anno con iscrizioni su avviso della Fondazione Demarchi (rivolto anche all'"attività estetica con trucco permanente", 500-1.400 €), iscrizione nel registro operatori formati, idoneità APSS dei locali, SCIA al SUAP.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict forse">Zona grigia<small>corso 60 h + idoneità APSS, come attività di tatuaggio</small></div>
      <div class="lbl">La strada</div>
      <ul>
        <li>Nessun atto provinciale riserva il PMU all'estetista; il corso obbligatorio è lo stesso per tutti e l'avviso annuale di iscrizione cita espressamente il trucco permanente fra i destinatari. Contro c'è solo il parere MISE 2018.</li>
        <li>Percorso: corso 60 ore, iscrizione nel registro operatori formati, idoneità APSS dei locali, SCIA al SUAP con la SCIA standard di tatuaggio, formazione tecnica documentata.</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Medio: diffida o sanzione amministrativa (art. 12 L. 1/1990). Risposta: autotutela con la 1930/2024, poi TAR. Esito non garantito.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Il corso provinciale è comunque richiesto (riconoscimento di corsi esterni non disciplinato). Un titolo di regione verde è un rafforzativo utile nella SCIA.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.fdemarchi.it/eventi-news/news/bando-2025-corso-igienico-sanitario-tatuaggi-piercing-e-trucco-permanente">Fondazione Demarchi, avviso iscrizioni corso 2025</a>
  </div>
</section>

<section class="region" id="bolzano">
  <div class="head"><h3>Provincia autonoma di Bolzano</h3><span class="pill ok">estetista SÌ</span><span class="pill ok">non estetista SÌ</span></div>
  <p class="norm">DPP 37/2007 (include "trucco semipermanente e permanente", si applica a "chiunque")</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso ≥30 h + autorizzazione + locale separato</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso provinciale (edizioni annuali in italiano e tedesco), esame orale, autorizzazione del Servizio Igiene e Sanità Pubblica, locale rigorosamente separato (art. 6 DPP 37/2007).</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict si">SÌ<small>stesso corso, stessa autorizzazione</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso ≥30 ore (18 anni, licenza media), autorizzazione del Servizio Igiene, iscrizione impresa. Minori solo con genitori presenti.</li></ul>
      <div class="lbl">Rischio</div>
      <ul><li>Basso. Chi opera senza autorizzazione riceve l'ordine di cessazione immediata.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Bolzano riconosce i corsi di altre regioni con la "dichiarazione di equipollenza" (domanda con programma e ore, 32 € di bolli). Attenzione al contrario: l'attestato di Bolzano vale solo in Alto Adige.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://mycivis.civis.bz.it/it/Services/ServiceDetail/?lid=1034224">myCivis, corso</a>
    <a href="https://mycivis.civis.bz.it/it/Services/ServiceDetail/?lid=1034384">myCivis, equipollenza</a>
  </div>
</section>

<section class="region" id="emilia">
  <div class="head"><h3>Emilia-Romagna</h3><span class="pill ok">estetista SÌ</span><span class="pill warn">non estetista zona grigia</span></div>
  <p class="norm">DGR 465/2007 · Nota Regione PG-2015-743054 del 09/10/2015 · Parere MISE 2018 · Interrogazione regionale n. 1369 (aperta)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso AUSL 14-16 h + dermografo + SCIA tatuaggio</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Nota regionale 2015: corso AUSL "Tatuaggio e piercing: aspetti di igiene e sicurezza", certificazione di conformità del dermografo al D.I. 206/2015 con dichiarazione del fabbricante sulla formazione, SCIA per il tatuaggio tramite portale "Accesso Unitario". Box ≥10 m² se in centro estetico (regolamenti comunali).</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict forse">Zona grigia<small>corso AUSL + SCIA standard di tatuaggio</small></div>
      <div class="lbl">La strada</div>
      <ul>
        <li>La DGR 465/2007 non esclude il PMU dal tatuaggio e non lo riserva a nessuno; la nota regionale 2015 dice cosa deve fare l'estetista, non cosa non può fare il tatuatore. Contro c'è solo il parere MISE 2018, indebolito dalla 1930/2024. L'interrogazione regionale n. 1369 chiede alla Giunta di chiarire: la Regione potrebbe includere il PMU nel tatuaggio.</li>
        <li>Percorso: corso AUSL (14-16 h), SCIA telematica con la SCIA standard di tatuaggio (il PMU è tatuaggio; se il modulo chiede le prestazioni: "tatuaggio, incluso tatuaggio cosmetico"), sede fissa con locale ≥10 m², formazione tecnica PMU documentata, titolo rafforzativo di regione verde.</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Medio-basso: sanzioni comunali contenute (fino a 500 €, sospensione fino a 20 giorni) e possibile art. 12 L. 1/1990. Risposta: autotutela con la 1930/2024, poi TAR. Esito non garantito.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>L'Emilia-Romagna riconosce gli attestati dei corsi igienico-sanitari di altre regioni. Un titolo laziale da 800 ore o un corso 90 ore è un documento forte da allegare alla SCIA.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.confartigianatoparma.it/archives/2891">Nota regionale 2015 (Confartigianato Parma)</a>
    <a href="https://www.ausl.bologna.it/servt/dipt/dsp/uo/ispav/formazione">AUSL Bologna, corsi</a>
    <a href="https://demetra.regione.emilia-romagna.it/al/articolo?urn=er:assemblealegislativa:attoispettivo:12%3B1369">Interrogazione n. 1369</a>
  </div>
</section>

<div class="group-title"><h2>Schede regionali · Centro</h2></div>

<section class="region" id="toscana">
  <div class="head"><h3>Toscana</h3><span class="pill ok">estetista SÌ</span><span class="pill ok">non estetista SÌ</span></div>
  <p class="norm">L.R. 28/2004 · DPGR 47/R/2007 (artt. 44, 86-90, allegati H e I)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso 80 h (all. H) + esame</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso 80 ore presso agenzie accreditate con esame regionale; locali conformi al Titolo II (25 m² minimi, altezza 2,70); aggiornamento 20 ore ogni 5 anni; SCIA al SUAP.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict si">SÌ<small>tecnico qualificato in tatuaggio 600 h</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso 600 ore (stage ≥30%) con esame; accesso con diploma, qualifica di II livello o licenza media più 2 anni di esperienza. CNA Toscana Centro conferma che il tecnico qualificato può eseguire dermopigmentazione.</li></ul>
      <div class="lbl">Rischio</div>
      <ul><li>Basso con il titolo. Senza titolo: 3.000-18.000 €.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Le qualifiche sono toscane. Chi ha un titolo di altra regione (es. Lazio 800 ore) può chiedere alla Regione la valutazione dei crediti per un percorso abbreviato: non è automatico e non è garantito il 100%.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://raccoltanormativa.consiglio.regione.toscana.it/articolo?urndoc=urn%3Anir%3Aregione.toscana%3Aregolamento.giunta%3A2007-10-02%3B47%2FR">DPGR 47/R/2007</a>
    <a href="https://toscanacentro.cna.it/la-dermopigmentazione-come-attivita-propria-dellestetista-chiarimenti-sullapplicazione-in-toscana/">CNA Toscana Centro</a>
  </div>
</section>

<section class="region" id="umbria">
  <div class="head"><h3>Umbria</h3><span class="pill ok">estetista SÌ</span><span class="pill warn">non estetista zona grigia</span></div>
  <p class="norm">Linee guida regionali per le USL (DGR 909/2006, da confermare) · Programma corso regionale 90 h · Parere MISE 2018</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso 90 h (modulo 1 facoltativo) + idoneità USL</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Il programma regionale rende il corso obbligatorio anche per le estetiste che fanno PMU nello studio; idoneità del Dipartimento di Prevenzione USL; SCIA o comunicazione al Comune.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict forse">Zona grigia<small>corso 90 h + idoneità USL, come attività di tatuaggio</small></div>
      <div class="lbl">La strada</div>
      <ul>
        <li>Nessuna legge regionale e nessun atto che riservi il PMU all'estetista: il corso da 90 ore "non ha finalità abilitante" ma è lo stesso per tutti. Contro c'è solo il parere MISE 2018. La proposta di legge del 2021 (mai approvata) mostra che la Regione può ancora disciplinare.</li>
        <li>Percorso: corso 90 ore, idoneità USL, SCIA con la SCIA standard di tatuaggio (il PMU è tatuaggio; se il modulo chiede le prestazioni: "tatuaggio, incluso tatuaggio cosmetico"), formazione tecnica documentata, titolo rafforzativo di regione verde.</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Medio: diffida o sanzione amministrativa (art. 12 L. 1/1990). Risposta: autotutela con la 1930/2024, poi TAR. Esito non garantito.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Riconoscimento non disciplinato: il corso umbro è comunque da fare. Un titolo di regione verde rafforza la SCIA.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.umbria.it/documents/18/323664/Programma+corso+tatuaggio.pdf/087f0a45-9913-45d3-b22f-86e8ec8dae24?version=1.0&download=true">Programma corso regionale</a>
  </div>
</section>

<section class="region" id="marche">
  <div class="head"><h3>Marche</h3><span class="pill ok">estetista SÌ</span><span class="pill no">non estetista NO</span></div>
  <p class="norm">L.R. 38/2013 · R.R. 2/2016 · DGR 1598 del 28/12/2017</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>0 h se operante al 28/12/2017, altrimenti 300 o 450 h</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Percorso regionale (enti accreditati, esame) da 300 ore per estetista specializzata o 450 per estetista base, con moduli singoli; attività ammessa nei locali dell'estetista con SCIA e locale prestazioni dedicato; aggiornamento 8 ore ogni 5 anni.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict no">NO<small>DGR 1598/2017: riservata all'estetista</small></div>
      <div class="lbl">Perché</div>
      <ul><li>Il profilo "Operatore di tatuaggio e piercing" (700 ore) non comprende l'area di attività della dermopigmentazione, riservata ai percorsi per estetiste.</li></ul>
      <div class="lbl">Rischio se opera comunque</div>
      <ul><li>1.000-10.000 € (L.R. 38/2013) più art. 12 L. 1/1990 e chiusura.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Nessun titolo esterno vale per il PMU senza estetista.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://static.regione.marche.it/Portals/0/Attivita_Produttive/Artigianato/Tatoo/DGR1598_17%20nuovo%20profilo.pdf">DGR 1598/2017</a>
  </div>
</section>

<section class="region" id="lazio">
  <div class="head"><h3>Lazio</h3><span class="pill ok">estetista SÌ</span><span class="pill ok">non estetista SÌ</span></div>
  <p class="norm">L.R. 2/2021 · DGR 270 del 03/05/2022 · Cons. Stato 1930/2024 · Det. G03998 del 26/03/2026</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso dermografo + igienico-sanitario, esonero dalle 800 h</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>DGR 270/2022: esonero dal corso 800 ore "per la sola dermopigmentazione" dimostrando il corso per l'uso del dermografo e le prescrizioni igienico-sanitarie (circolari 1998, D.I. 206/2015); SCIA al SUAP; aggiornamento 10 ore ogni 2 anni.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict si">SÌ<small>Operatore tatuaggio 800 h</small></div>
      <div class="lbl">Cosa serve</div>
      <ul>
        <li>Corso 800 ore (18 anni, licenza media, italiano B1, frequenza ≥80%, esame pubblico); esoneri per chi aveva il corso Lazio ≥90 ore o 5 anni di attività al 5/3/2021.</li>
        <li>Aggiornamento 10 ore ogni 2 anni; minori: vietato sotto i 16.</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Basso con il titolo. Senza: 3.000-15.000 € e sequestro.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Il Lazio riconosce crediti fino al 100% per titoli regionali o UE con percorsi ≥500 ore, e crediti per esperienza (2-4 anni). È la regione "porta" per chi vuole un titolo da non estetista, ma il titolo vale con certezza solo qui: per lavorare altrove leggi la scheda della regione di destinazione.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.aslroma1.it/uploads/files/18_09_delibera_regione_lazio_3_maggio_22_n._270.pdf">DGR 270/2022</a>
    <a href="https://www.regione.lazio.it/cittadini/formazione/riconoscimento-delle-qualifiche-tatuaggio-piercing">Regione Lazio, riconoscimento qualifiche</a>
  </div>
</section>

<section class="region" id="abruzzo">
  <div class="head"><h3>Abruzzo</h3><span class="pill warn">estetista SÌ con riserva</span><span class="pill ok">non estetista SÌ</span></div>
  <p class="norm">L.R. 41/2020 · Repertorio regionale: DD 144/DPG009/2017 (Dermopigmentista), DD 196/DPG009/2019 (Operatore di tatuaggio e trucco permanente)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict forse">SÌ, con riserva<small>qualifica regionale con crediti; nessun esonero scritto</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>La L.R. 41/2020 rinvia ai profili del Repertorio: la qualifica di estetista dà crediti (max 30% aula, 50% tirocinio) ma nessun atto regionale dice che basti da sola con la scheda 23. Punto da verificare con Regione e ASL.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict si">SÌ<small>Operatore tatuaggio e trucco permanente 450 h</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>300 ore d'aula + 150-200 di tirocinio (18 anni, titolo EQF 3, italiano B2), esame pubblico; SCIA al SUAP con responsabile tecnico; iscrizione all'elenco regionale. Regolamento sui locali non ancora adottato: valgono linee guida 1998 e Comuni.</li></ul>
      <div class="lbl">Rischio</div>
      <ul><li>Basso con il titolo. Senza: 3.000-15.000 €.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Crediti per titoli esterni fino al 30% delle ore d'aula e al 50% del tirocinio: un titolo laziale da 800 ore aiuta ma non esonera dall'esame abruzzese.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="http://www2.consiglio.regione.abruzzo.it/leggi_tv/abruzzo_lr/2020/lr20041/Articolato.asp">L.R. 41/2020</a>
    <a href="https://repertori.regione.abruzzo.it/?cmd=printPdf&cmpcode=trainings&id_trn=124&mcode=repertori">Repertorio, Operatore di tatuaggio e trucco permanente</a>
  </div>
</section>

<div class="group-title"><h2>Schede regionali · Sud e isole</h2></div>

<section class="region" id="molise">
  <div class="head"><h3>Molise</h3><span class="pill ok">estetista SÌ</span><span class="pill warn">non estetista zona grigia</span></div>
  <p class="norm">DGR 1706/2004 (tatuaggio e piercing; testo non reperito) · Parere MISE 2018</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso regionale: da chiedere ad ASReM</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Qualifica, formazione dermografo (scheda 23), SCIA al SUAP. Il regolamento regionale prevede un corso e un certificato di idoneità sanitaria ASReM per tatuaggio e piercing; nessuna indicazione sul PMU.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict forse">Zona grigia<small>corso regionale + idoneità ASReM, come attività di tatuaggio</small></div>
      <div class="lbl">La strada</div>
      <ul>
        <li>Il regolamento del 2004 non menziona il PMU né lo riserva a nessuno. Contro c'è solo il parere MISE 2018. Ore del corso e sanzioni non reperite: chiederle ad ASReM.</li>
        <li>Percorso: corso regionale, certificato di idoneità sanitaria ASReM, SCIA con responsabile tecnico con la SCIA standard di tatuaggio (il PMU è tatuaggio; se il modulo chiede le prestazioni: "tatuaggio, incluso tatuaggio cosmetico"), formazione tecnica documentata, titolo rafforzativo (il corso 90 ore Puglia è il più vicino).</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Medio: provvedimenti comunali e art. 12 L. 1/1990. Risposta: autotutela con la 1930/2024, poi TAR.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Nessuna norma di riconoscimento: gli annunci "l'attestato Puglia vale anche in Molise" non hanno conferma ufficiale, ma un corso 90 ore pugliese è comunque il documento più utile da presentare ad ASReM.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.comune.termoli.cb.it/images/Servizi/AttivitaProduttive/SUAP%20-%20MODULISTICA/tatuaggi%20e%20piercing.pdf">SUAP Termoli, modulo SCIA</a>
  </div>
</section>

<section class="region" id="campania">
  <div class="head"><h3>Campania</h3><span class="pill ok">estetista SÌ</span><span class="pill warn">non estetista SÌ probabile</span></div>
  <p class="norm">DGR 2072/2007 · DGR 157/2010 · Repertorio RRTQ scheda 247 (include "realizzazione di tatuaggi e trucco permanente")</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso ASL 50 h nella prassi</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Qualifica, formazione dermografo, corso ASL 50 ore (circa 500 €), SCIA al SUAP con verifica ASL entro 60 giorni.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict forse">SÌ probabile<small>qualifica 500 h con PMU + corso ASL; conferma ASL</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Qualifica "Operatore di tatuaggio e piercing" (500 ore, enti accreditati, anche corsi GOL gratuiti) che include l'attività "tatuaggi e trucco permanente"; corso ASL 50 ore; SCIA; locali ≥16 m².</li></ul>
      <div class="lbl">Rischio</div>
      <ul><li>Medio: la posizione regionale è nel repertorio delle qualifiche, non in una delibera sanitaria. Un Comune potrebbe chiedere l'estetista.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Nessuna norma di riconoscimento. Un titolo laziale è un argomento forte ma va presentato alla ASL insieme al corso campano.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://capire.regione.campania.it/rrtq/public/scheda/247">RRTQ Campania, scheda 247</a>
    <a href="https://www.aslnapoli1centro.it/tatuaggi-e-piercing-in-sicurezza">ASL Napoli 1 Centro</a>
  </div>
</section>

<section class="region" id="puglia">
  <div class="head"><h3>Puglia</h3><span class="pill ok">estetista SÌ</span><span class="pill ok">non estetista SÌ</span></div>
  <p class="norm">DGR 983 del 06/07/2016 ("compresa la dermopigmentazione")</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso 90 h, nessun credito, locali autonomi</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso 90 ore (ASL o enti autorizzati, esame con il SISP), locali operativi autonomi (condivisibili solo ingresso, attesa e servizi), SCIA al Comune trasmessa al SISP.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict si">SÌ<small>corso 90 h</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso 90 ore (18 anni, 10 anni di scolarità, frequenza ≥80%), SCIA, Albo artigiani, locali ≥9 m² esclusivi. Minori solo con consenso dei genitori.</li></ul>
      <div class="lbl">Rischio</div>
      <ul><li>Basso. Senza corso: sospensione ASL e chiusura.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Gli attestati di altre regioni sono equiparati se di 90 ore e conformi alla circolare 1998: chi ha il corso 90 ore di Veneto, FVG, Calabria o Umbria è a posto. Un titolo laziale da 800 ore soddisfa a maggior ragione, previa verifica SISP.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://burp.regione.puglia.it/documents/20135/1014161/GR983.pdf/29e3f238-e202-216a-cb50-715e8a30abd5?version=1.0&t=1622796687280">DGR 983/2016</a>
  </div>
</section>

<section class="region" id="basilicata">
  <div class="head"><h3>Basilicata</h3><span class="pill ok">estetista SÌ</span><span class="pill warn">non estetista zona grigia</span></div>
  <p class="norm">Nessun atto regionale su tatuaggio o PMU · L.R. 45/1993 (estetista) · Parere MISE 2018</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>nessun corso regionale</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Qualifica, formazione dermografo, SCIA, requisiti dei locali verificati da ASP e Comune secondo le circolari 1998.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict forse">Zona grigia<small>nessun corso obbligatorio, come attività di tatuaggio</small></div>
      <div class="lbl">La strada</div>
      <ul>
        <li>Nessun atto regionale su tatuaggio o PMU: nessun requisito, nessun divieto. Contro c'è solo il parere MISE 2018. Il corso "Operatore di tatuaggio e piercing" da 124 ore nel Catalogo regionale è facoltativo ma utile come prova di formazione.</li>
        <li>Percorso: SCIA con la SCIA standard di tatuaggio (il PMU è tatuaggio; se il modulo chiede le prestazioni: "tatuaggio, incluso tatuaggio cosmetico"), requisiti igienici ASP secondo le circolari 1998, formazione tecnica documentata, corso igienico-sanitario di una regione vicina (Puglia 90 h, Calabria 90 h) come rafforzativo.</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Medio: provvedimenti comunali e art. 12 L. 1/1990. Risposta: autotutela con la 1930/2024, poi TAR.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Nessuna norma di riconoscimento, ma nessun requisito regionale da soddisfare: il corso 90 ore di Puglia o Calabria è il documento più utile da allegare alla SCIA.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://oldportalebandi.regione.basilicata.it/PortaleBandi/detail-cur.jsp?id=788352">Catalogo regionale, corso 124 ore</a>
  </div>
</section>

<section class="region" id="calabria">
  <div class="head"><h3>Calabria</h3><span class="pill ok">estetista SÌ</span><span class="pill ok">non estetista SÌ</span></div>
  <p class="norm">DGR 228 del 14/05/2012 "tatuaggio, piercing, trucco permanente e semipermanente" (testo disponibile solo in scansione)</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso 90 h, credito 20 h</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso regionale (70 teoria + 20 laboratorio) con credito di 20 ore per le estetiste qualificate, esame con rappresentante della Regione, SCIA al SUAP.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict si">SÌ<small>corso 90 h</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso 90 ore (18 anni, obbligo scolastico, frequenza ≥70%), attestato "di frequenza e idoneità professionale" riconosciuto dall'ASP, SCIA.</li></ul>
      <div class="lbl">Rischio</div>
      <ul><li>Basso-medio: i dettagli su locali e sanzioni sono nella DGR ma non verificabili sulla scansione.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Gli enti calabresi dichiarano "validità nazionale" del proprio attestato: non verificato. In entrata, chiedere all'ASP se un corso 90 ore di altra regione è accettato.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.tatuatori.it/blog-news-tattoo/downloads/category/6-direttive-regionali?download=17:regione-calabria-delibera-n-228-del-14-5-2012-linee-guida-per-l-esercizio-delle-attivita-di-tatuaggio-piercing">DGR 228/2012 (scansione)</a>
  </div>
</section>

<section class="region" id="sicilia">
  <div class="head"><h3>Sicilia</h3><span class="pill ok">estetista SÌ</span><span class="pill warn">non estetista zona grigia</span></div>
  <p class="norm">D.A. Sanità 31/07/2003 (tatuaggi e piercing) · regolamenti comunali · Parere MISE 2018</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso ASP: chiedere</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Qualifica, formazione dermografo, SCIA al SUAP e nulla osta ASP sui locali; eventuale corso ASP (60-90 ore) con credito del modulo 1.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict forse">Zona grigia<small>corso ASP + nulla osta, come attività di tatuaggio; verificare il regolamento comunale</small></div>
      <div class="lbl">La strada</div>
      <ul>
        <li>Il D.A. 2003 non menziona il PMU e non lo riserva a nessuno; contro c'è il parere MISE 2018 e, in alcuni Comuni (es. Floridia), un regolamento che elenca il "trucco semipermanente" fra le attività dell'estetista: lì il rischio sale.</li>
        <li>Percorso: corso ASP (60-90 h), nulla osta tecnico-sanitario ASP, SCIA con la SCIA standard di tatuaggio (il PMU è tatuaggio; se il modulo chiede le prestazioni: "tatuaggio, incluso tatuaggio cosmetico"), formazione tecnica documentata, titolo rafforzativo di regione verde (Calabria o Puglia 90 h). Minori: vietato sotto i 18.</li>
      </ul>
      <div class="lbl">Rischio</div>
      <ul><li>Medio, alto nei Comuni con regolamento che cita il trucco semipermanente fra le attività estetiche. Risposta: autotutela con la 1930/2024, poi TAR.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>Nessuna norma di riconoscimento: il corso ASP resta da fare. Un titolo di regione verde rafforza la SCIA.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="http://www.gurs.regione.sicilia.it/Gazzette/g03-35/g03-35-p16.htm">GURS 35/2003</a>
    <a href="https://www.aspag.it/attivazione-6-corso-di-formazione-per-operatori-addetti-a-tatuaggi-e-piercing-avviso-manifestazione-di-interesse/">ASP Agrigento, corso 2026</a>
  </div>
</section>

<section class="region" id="sardegna">
  <div class="head"><h3>Sardegna</h3><span class="pill ok">estetista SÌ</span><span class="pill ok">non estetista SÌ</span></div>
  <p class="norm">DGR 22/11 del 22/05/2012 · Det. 1528 del 21/11/2012 · DGR 41/21 del 01/12/2023</p>
  <div class="two">
    <div class="col est"><h4 class="est">Estetista</h4>
      <div class="verdict si">SÌ<small>corso ASL ≥60 h + idoneità SISP, nessun esonero</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso ASL (frequenza ≥90%, esame scritto e colloquio), idoneità SISP, pratica SUAPE con planimetrie, agibilità e contratto rifiuti.</li></ul>
    </div>
    <div class="col alt"><h4 class="alt">Non estetista</h4>
      <div class="verdict si">SÌ<small>corso ASL ≥60 h + idoneità SISP</small></div>
      <div class="lbl">Cosa serve</div>
      <ul><li>Corso ASL (18 anni, 10 anni di scolarità, vaccinazione HBV), idoneità SISP, locale ≥14 m² (10 se un solo operatore). Esiste anche la qualifica "Operatore di tatuaggio e piercing" da 1.000 ore (DGR 41/21/2023) con aggiornamento 24 ore ogni 3 anni.</li></ul>
      <div class="lbl">Rischio</div>
      <ul><li>Basso.</li></ul>
    </div>
  </div>
  <div class="mob"><h4>Formarsi altrove e lavorare qui</h4><p>L'attestato ASL di altra regione è riconosciuto se di pari valenza (ore e argomenti) a giudizio della ASL; per la qualifica da 1.000 ore il modulo igienico-sanitario dà un credito di 130 ore. Un titolo laziale è utile ma passa comunque dalla valutazione ASL.</p></div>
  <div class="src"><h4>Fonti</h4>
    <a href="https://www.regione.sardegna.it/documenti/1_38_20130430124008.pdf">Det. 1528/2012</a>
    <a href="https://delibere.regione.sardegna.it/protected/68153/0/def/ref/DBR68083/">DGR 41/21/2023</a>
  </div>
</section>

<footer>
  <p><strong>Come usare questo documento.</strong> Le schede riassumono atti pubblici verificati il 3 settembre 2026 e sono scritte per chi deve rispondere a una prima domanda al telefono. Non sostituiscono un parere legale né la verifica con SUAP, ASL e Regione, che restano le sole autorità in grado di confermare i requisiti per il singolo caso. Le ore dei corsi cambiano quando le Regioni riaprono i bandi: prima di iscrivere qualcuno, controllare l'avviso più recente.</p>
</footer>

</main>
</div>
`;
