<?php
/**
 * Plugin Name: Elitederma - Listino master e ordine per categoria
 * Version: 1.0
 *
 * Sta a parte dallo snippet "Sconto a fasce" apposta: sono due cose
 * nuove, e se una non si accende l'altra continua a funzionare.
 *
 * Gira a priorita' 9, cioe' PRIMA dello sconto a fasce. Quando il coupon
 * non e' di una master questo file non tocca niente, e quando lo e' lo
 * sconto a fasce lascia passare il valore: fra i suoi contrassegni la
 * quota master non c'e'.
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

add_filter( 'woocommerce_coupon_get_discount_amount', 'ed_master_sconto', 9, 5 );
add_filter( 'posts_clauses', 'ed_master_ordine_categoria', 999, 2 );
add_action( 'wp_footer', 'ed_master_traccia' );

if ( ! function_exists( 'ed_master_campo' ) ) {
    function ed_master_campo( $prodotto, $chiave ) {
        $v = $prodotto->get_meta( $chiave );
        if ( '' === $v || null === $v ) {
            $padre = $prodotto->get_parent_id();
            if ( $padre ) {
                $v = get_post_meta( $padre, $chiave, true );
            }
        }
        return ( null === $v ) ? '' : (string) $v;
    }
}

if ( ! function_exists( 'ed_master_sconto' ) ) {
    function ed_master_sconto( $sconto, $da_scontare, $riga, $singolo, $coupon ) {
        $quota_grezza = $coupon->get_meta( '_ed_quota_master' );
        if ( empty( $quota_grezza ) ) {
            return $sconto;
        }
        if ( ! is_array( $riga ) || empty( $riga['data'] ) ) {
            return $sconto;
        }
        $prodotto = $riga['data'];
        $cedibile = ed_master_campo( $prodotto, '_ed_cedibile_eur' );
        if ( '' === $cedibile ) {
            return 0.0;
        }
        $quota = json_decode( $quota_grezza, true );
        if ( ! is_array( $quota ) ) {
            return 0.0;
        }
        $pct = 0.0;
        if ( isset( $quota['generale'] ) ) {
            $pct = (float) $quota['generale'];
        }
        $blocco = ed_master_campo( $prodotto, '_ed_blocco' );
        $reparti = isset( $quota['reparti'] ) ? $quota['reparti'] : null;
        if ( '' !== $blocco && is_array( $reparti ) ) {
            if ( array_key_exists( $blocco, $reparti ) ) {
                $pct = (float) $reparti[ $blocco ];
            }
        }
        if ( $pct <= 0 ) {
            return 0.0;
        }
        $quantita = 1;
        if ( isset( $riga['quantity'] ) ) {
            $quantita = (int) $riga['quantity'];
        }
        $pezzi = $singolo ? 1 : max( 1, $quantita );
        $importo = (float) $cedibile * $pct / 100 * $pezzi;
        $tetto = (float) $da_scontare;
        return round( min( $importo, $tetto ), wc_get_rounding_precision() );
    }
}

// Una riga invisibile in fondo alla pagina che dice se questo pezzo ha
// girato e con quale campo. Serve a non tirare a indovinare da fuori: la
// si legge e si sa. Si toglie quando la cosa funziona.
if ( ! function_exists( 'ed_master_traccia' ) ) {
    function ed_master_traccia() {
        global $ed_master_segno;
        if ( empty( $ed_master_segno ) ) {
            $ed_master_segno = 'non ha girato';
        }
        echo "\n<!-- ed-ordine: " . esc_html( $ed_master_segno ) . " -->\n";
    }
}

if ( ! function_exists( 'ed_master_ordine_categoria' ) ) {
    function ed_master_ordine_categoria( $clausole, $query ) {
        if ( is_admin() ) {
            return $clausole;
        }
        if ( ! is_a( $query, 'WP_Query' ) ) {
            return $clausole;
        }
        if ( ! $query->is_main_query() ) {
            return $clausole;
        }
        if ( ! $query->is_tax( 'product_cat' ) ) {
            global $ed_master_segno;
            $ed_master_segno = "non e' una pagina di categoria";
            return $clausole;
        }
        $scelto = '';
        if ( isset( $_GET['orderby'] ) ) {
            $scelto = sanitize_text_field( wp_unslash( $_GET['orderby'] ) );
        }
        if ( '' !== $scelto && 'menu_order' !== $scelto ) {
            global $ed_master_segno;
            $ed_master_segno = "il cliente ha scelto un altro ordinamento";
            return $clausole;
        }
        $termine = $query->get_queried_object();
        if ( ! $termine ) {
            return $clausole;
        }
        if ( ! isset( $termine->term_id ) ) {
            return $clausole;
        }
        global $wpdb;
        $chiave = '_ed_ordine_cat_' . (int) $termine->term_id;
        $giunzione = ' LEFT JOIN ' . $wpdb->postmeta . ' AS ed_ord';
        $giunzione .= ' ON ( ed_ord.post_id = ' . $wpdb->posts . '.ID';
        $giunzione .= ' AND ed_ord.meta_key = %s ) ';
        $clausole['join'] .= $wpdb->prepare( $giunzione, $chiave );
        $ordine = ' COALESCE( CAST( ed_ord.meta_value AS UNSIGNED ), 999999 ) ASC, ';
        $ordine .= $wpdb->posts . '.menu_order ASC, ';
        $ordine .= $wpdb->posts . '.post_title ASC ';
        $clausole['orderby'] = $ordine;
        global $ed_master_segno;
        $ed_master_segno = 'ha ordinato con ' . $chiave;
        return $clausole;
    }
}
