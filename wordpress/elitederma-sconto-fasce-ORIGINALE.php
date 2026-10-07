if ( ! defined( 'ABSPATH' ) ) { exit; }

// La categoria "Needling" su WooCommerce. Se un giorno cambiasse, si
// cambia qui e basta: e' l'unico punto che la nomina.
if ( ! defined( 'ELITEDERMA_CATEGORIA_NEEDLING' ) ) {
    define( 'ELITEDERMA_CATEGORIA_NEEDLING', 64 );
}

add_filter( 'woocommerce_coupon_get_discount_amount', 'elitederma_sconto_a_fasce', 10, 5 );

// La guardia c'e' per Code Snippets, non per PHP: quando salva o
// accende uno snippet lo esegue DUE volte nella stessa richiesta, una
// per controllarlo e una per attivarlo, e alla seconda la funzione
// risulta gia' dichiarata. Senza questa riga lo snippet non si accende.
if ( ! function_exists( 'elitederma_sconto_a_fasce' ) ) :
function elitederma_sconto_a_fasce( $sconto, $importo_da_scontare, $riga_carrello, $singolo, $coupon ) {

    // "fixed_cart" sconta il carrello intero e non ha una riga: li' non
    // c'e' nessun prodotto di cui guardare il margine, e si lascia fare
    // a WooCommerce.
    if ( ! is_array( $riga_carrello ) || empty( $riga_carrello['data'] ) ) {
        return $sconto;
    }

    $fasce_grezze    = $coupon->get_meta( '_ed_fasce_sconto' );
    $pct_sul_margine = $coupon->get_meta( '_ed_sconto_margine_pct' );
    $needling_grezzo = $coupon->get_meta( '_ed_needling' );

    // Nessuno dei tre contrassegni: non e' un coupon dell'accademia, o e'
    // una normale percentuale sul prezzo. Si lascia fare a WooCommerce,
    // esattamente come prima che questo file esistesse.
    if ( empty( $fasce_grezze ) && '' === (string) $pct_sul_margine && empty( $needling_grezzo ) ) {
        return $sconto;
    }

    $prodotto = $riga_carrello['data'];

    // ---- CASO 0: NEEDLING, che ha una tabella sua ----
    //
    // I prodotti del reparto Needling non guardano le fasce: lo sconto lo
    // decide la loro tabella, a scaglioni di spesa, e le due non si
    // sommano mai. E' la stessa regola che applica il POS dell'app.
    //
    // Due differenze dalle fasce, ed e' importante non confonderle:
    //  - lo scaglione lo sceglie QUANTO SI SPENDE in tutto il carrello,
    //    non quanto rende il prodotto;
    //  - la percentuale si legge SUL PREZZO NETTO, mentre le fasce sono
    //    sul lordo. Il 30% di needling sono trenta euro ogni cento netti.
    if ( ! empty( $needling_grezzo ) && elitederma_e_needling( $prodotto ) ) {
        $needling = json_decode( $needling_grezzo, true );
        $soglie   = isset( $needling['soglie'] ) && is_array( $needling['soglie'] ) ? $needling['soglie'] : array();
        $sconti   = isset( $needling['sconti'] ) && is_array( $needling['sconti'] ) ? $needling['sconti'] : array();

        if ( count( $soglie ) === 2 && count( $sconti ) === 3 ) {
            // il totale del carrello a listino, IVA compresa e prima di
            // qualunque sconto: e' la stessa base che legge il POS
            $speso = 0.0;
            if ( function_exists( 'WC' ) && WC()->cart ) {
                $speso = (float) WC()->cart->get_subtotal() + (float) WC()->cart->get_subtotal_tax();
            }
            $pct = (float) ( $speso < (float) $soglie[0] ? $sconti[0] : ( $speso < (float) $soglie[1] ? $sconti[1] : $sconti[2] ) );

            if ( $pct <= 0 ) {
                return 0.0; // tabella spenta su questo scaglione: niente sconto
            }

            // la percentuale e' sul NETTO: si prende il prezzo senza IVA e
            // si sconta quello. Applicarla al lordo darebbe un quinto in
            // piu' di sconto senza che nessuno l'abbia deciso.
            $netto_unitario = (float) wc_get_price_excluding_tax( $prodotto, array( 'qty' => 1 ) );
            $quantita       = isset( $riga_carrello['quantity'] ) ? (int) $riga_carrello['quantity'] : 1;
            $pezzi          = $singolo ? 1 : max( 1, $quantita );
            $importo        = $netto_unitario * $pct / 100 * $pezzi;

            return round( min( $importo, (float) $importo_da_scontare ), wc_get_rounding_precision() );
        }
    }


    // ---- CASO 2: una percentuale sola, ma letta sul GUADAGNO ----
    // "15%" vuol dire quindici euro ogni cento guadagnati, non ogni cento
    // incassati. Il guadagno per pezzo lo scrive il gestionale sul
    // prodotto, gia' in euro e gia' netto: qui non si calcola niente, si
    // legge.
    if ( empty( $fasce_grezze ) ) {
        $margine_eur = elitederma_meta_prodotto( $prodotto, '_ed_margine_eur' );
        if ( '' === $margine_eur ) {
            return 0.0; // guadagno sconosciuto: non si sconta
        }
        $quantita = isset( $riga_carrello['quantity'] ) ? (int) $riga_carrello['quantity'] : 1;
        // $singolo = true quando WooCommerce sta scontando UN pezzo e
        // moltiplichera' lui per la quantita'; false quando chiede lo
        // sconto dell'intera riga
        $pezzi = $singolo ? 1 : max( 1, $quantita );
        $importo = (float) $margine_eur * (float) $pct_sul_margine / 100 * $pezzi;
        return round( min( $importo, (float) $importo_da_scontare ), wc_get_rounding_precision() );
    }

    // ---- CASO 1: sconto a fasce ----
    $fasce = json_decode( $fasce_grezze, true );
    if ( ! is_array( $fasce ) || ! count( $fasce ) ) {
        return $sconto;
    }

    $margine = elitederma_meta_prodotto( $prodotto, '_ed_margine_pct' );

    // Margine sconosciuto: niente sconto su questa riga. E' la stessa
    // regola del banco - non si regala qualcosa di cui non si sa quanto
    // vale.
    if ( '' === $margine ) {
        return 0.0;
    }

    $m = (float) $margine;

    // La prima fascia che lo contiene. Oltre l'ultimo confine resta
    // l'ultima, cosi' un margine del 100% non cade nel vuoto.
    $percentuale = 0.0;
    foreach ( $fasce as $fascia ) {
        $percentuale = isset( $fascia['percentuale'] ) ? (float) $fascia['percentuale'] : 0.0;
        if ( isset( $fascia['a'] ) && $m <= (float) $fascia['a'] ) {
            break;
        }
    }

    if ( $percentuale <= 0 ) {
        return 0.0;
    }

    return round( (float) $importo_da_scontare * $percentuale / 100, wc_get_rounding_precision() );
}
endif;

/**
 * Il prodotto appartiene al reparto Needling?
 *
 * Si guarda la categoria di WooCommerce (id 64) invece di un
 * contrassegno scritto sul prodotto: il contrassegno andrebbe tenuto
 * aggiornato su duecento schede, la categoria e' gia' li' e la si
 * cambia in un posto solo. Su una variante si guarda il padre, che e'
 * dove stanno le categorie.
 */
if ( ! function_exists( 'elitederma_e_needling' ) ) :
function elitederma_e_needling( $prodotto ) {
    $id = $prodotto->get_parent_id() ? $prodotto->get_parent_id() : $prodotto->get_id();
    return has_term( ELITEDERMA_CATEGORIA_NEEDLING, 'product_cat', $id );
}
endif;

/**
 * Legge un campo del prodotto guardando prima la variante e poi il
 * prodotto padre: su un prodotto con varianti il dato puo' stare
 * sull'una o sull'altro.
 */
if ( ! function_exists( 'elitederma_meta_prodotto' ) ) :
function elitederma_meta_prodotto( $prodotto, $chiave ) {
    $valore = $prodotto->get_meta( $chiave );
    if ( '' === $valore || null === $valore ) {
        $padre = $prodotto->get_parent_id();
        if ( $padre ) {
            $valore = get_post_meta( $padre, $chiave, true );
        }
    }
    return ( null === $valore ) ? '' : (string) $valore;
}
endif;

// In pagina carrello, accanto al coupon, una riga che spiega perche' lo
// sconto non e' "il 10% di tutto": chi compra deve poter capire il
// totale che gli viene chiesto.
add_filter( 'woocommerce_cart_totals_coupon_label', 'elitederma_etichetta_coupon_fasce', 10, 2 );

if ( ! function_exists( 'elitederma_etichetta_coupon_fasce' ) ) :
function elitederma_etichetta_coupon_fasce( $etichetta, $coupon ) {
    if ( $coupon->get_meta( '_ed_fasce_sconto' ) || '' !== (string) $coupon->get_meta( '_ed_sconto_margine_pct' ) || $coupon->get_meta( '_ed_needling' ) ) {
        $etichetta .= ' - sconto variabile per prodotto';
    }
    return $etichetta;
}
endif;
