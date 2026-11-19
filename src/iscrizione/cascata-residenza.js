// LA CASCATA DELLA RESIDENZA, IN UN POSTO SOLO.
//
// Stato -> regione/cantone -> provincia -> comune/localita' -> CAP/NPA:
// quattro gradini, e ognuno apre il successivo. La regola e' scritta in
// `residenza.js` (gli elenchi, uno per Stato) e in `disposizione.js`
// (l'ordine delle caselle); qui c'e' il pezzo che DA UN CAMPO tira fuori
// la tendina giusta per quello che si e' scelto sopra.
//
// PERCHE' STA FUORI DALLA PAGINA (16/11/2026). Viveva dentro
// `PaginaModulo`, il modulo che compila l'allieva. Dal 16/11/2026
// serve anche al contratto che firma la master: la stessa cascata,
// scritta due volte, vorrebbe dire due idee di «dove abita questa
// persona» — una che offre i cantoni svizzeri e una che non li offre, e
// nessuno dei due saprebbe di essere quella sbagliata.
//
// Non e' un componente e non disegna niente: prende come arriva al
// valore di una casella (`valoreDi`) e restituisce `campoConElenco`, che
// arricchisce la definizione del campo con le voci da mostrare.
import { elencoResidenza, vociStatoResidenza, etichettaResidenza, campoFiscale } from "./residenza.js";
import { normalizzaNome } from "./AreeAnagrafiche.jsx";

/**
 * @param {(chiave: string) => string} valoreDi come leggere il valore di una casella, gia' ripulito
 * @param {{ suggerimentoFiscale?: string }} opzioni
 */
export function cascataResidenza(valoreDi, { suggerimentoFiscale = "Inserisci il tuo identificativo fiscale" } = {}) {
  const statoScritto = valoreDi("stato_residenza");
  // L'ELENCO DELLO STATO. Italia e Svizzera ne hanno uno; degli altri
  // 230 non abbiamo ne' localita' ne' codici postali, e la' le caselle
  // restano libere com'erano.
  const elenco = elencoResidenza(statoScritto);
  const comuneScritto = valoreDi("citta_residenza");
  const provincia = (valoreDi("prov_residenza")
    || (elenco ? elenco.provinciaDi(comuneScritto, valoreDi("cap_residenza")) : "")
    || "").toUpperCase();
  // UN ELENCO CHIUSO NON PUO' CANCELLARE QUELLO CHE C'E' GIA'. Se il
  // valore in casella non e' fra le voci, la tendina lo mostrerebbe
  // vuoto e basterebbe spedire per perderlo: li' si resta sul testo.
  const elencoBuono = (voci, valore) => voci.length > 0
    && (!valore || voci.some((x) => normalizzaNome(x) === normalizzaNome(valore)));
  const comuni = elenco && provincia ? elenco.comuniDi(provincia) : [];
  const cap = elenco && comuneScritto ? elenco.capDi(provincia, comuneScritto) : [];
  // DOVE SOPRA LA PROVINCIA NON C'E' NIENTE, la provincia si scegli da
  // qui. In Svizzera i cantoni sono ventisei e stanno in una tendina;
  // le 107 province italiane senza il gradino della regione sarebbero
  // un elenco da scorrere a vuoto, e di qua quella casella la riempie
  // quasi sempre il venditore. Senza questa tendina una allieva
  // svizzera non arriverebbe mai alla sua localita': la cascata parte
  // dal cantone.
  const province = elenco && !elenco.conRegione
    ? elenco.provinceDi().map((x) => ({ valore: x.sigla, etichetta: `${x.nome} (${x.sigla})` }))
    : [];
  // LO STATO SI SCEGLIE DALLA STESSA LISTA DELLA SCHEDA, e con la
  // stessa scrittura: due liste vorrebbero dire «Svizzera» da una parte
  // e «SVIZZERA» dall'altra, cioe' due paesi per chi conta. Uno Stato
  // che in archivio c'e' e nella lista non c'e' resta in coda marcato:
  // una tendina che mostra il vuoto si spedisce senza accorgersene.
  const vociStato = (() => {
    const voci = vociStatoResidenza({ conAltro: false })
      .map((v) => ({ valore: v.valore, etichetta: v.testo }));
    if (statoScritto && !voci.some((v) => normalizzaNome(v.valore) === normalizzaNome(statoScritto))) {
      return [...voci, { valore: statoScritto, etichetta: `${statoScritto} — già scritto` }];
    }
    return voci;
  })();

  function campoConElenco(campo) {
    // in Svizzera «Provincia» si chiama «Cantone» e il CAP «NPA»: chi
    // compila legge l'etichetta, e quella deve dire il vero
    const conNome = campoFiscale(etichettaResidenza(campo, elenco), elenco);
    // il prefisso del telefono parte dal paese che si e' appena scelto
    // qui sopra: nella scheda il venditore, nel modulo lei, stessa regola
    if (conNome.tipo === "telefono") return { ...conNome, statoResidenza: statoScritto };
    // di qua compila la persona stessa, quindi il suggerimento le da'
    // del tu: nella scheda del venditore la stessa casella dice
    // «Inserisci l'identificativo fiscale», perche' li' compila un altro
    if (campo.chiave === "codice_fiscale") {
      return { ...conNome, suggerimento: suggerimentoFiscale };
    }
    if (campo.chiave === "stato_residenza") {
      return { ...conNome, opzioni: vociStato };
    }
    if (campo.chiave === "prov_residenza" && elencoBuono(province.map((x) => x.valore), valoreDi("prov_residenza"))) {
      return { ...conNome, opzioni: province };
    }
    if (campo.chiave === "citta_residenza" && elencoBuono(comuni, comuneScritto)) {
      return { ...conNome, opzioni: comuni };
    }
    if (campo.chiave === "cap_residenza" && elencoBuono(cap, valoreDi("cap_residenza"))) {
      return { ...conNome, opzioni: cap };
    }
    return conNome;
  }

  return { elenco, statoScritto, campoConElenco };
}
