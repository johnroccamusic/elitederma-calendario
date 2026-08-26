# Integrazione — Note di credito e scadenzario

> **Aggiunta a quello che hai già applicato.** La sincronizzazione con Fatture in Cloud
> resta com'è: non toccare `fic-sync/index.ts` né la migration `20260824090000_fic_sync.sql`.
> Qui ci sono **due migration nuove, puramente additive**, più una riga da aggiungere alla
> fine della sincronizzazione.

## Perché serve

Senza questo pezzo la contabilità è sbagliata in due modi:

1. **Le note di credito venivano sommate ai costi invece che sottratte** → totali per
   fornitore gonfiati.
2. **La fattura stornata restava "da pagare" per intero** → lo scadenzario mostra soldi
   che non devi.

Il conto giusto è:

```
da pagare = totale fattura − note di credito abbinate − pagamenti già registrati
```

## File da aggiungere

- `supabase/migrations/20260824093000_fic_note_credito.sql` — riconciliazione NC ↔ fatture
- `supabase/migrations/20260824100000_fic_scadenzario.sql` — pagamenti, scadenze, da pagare

Poi `supabase db push`. Non serve ridistribuire la Edge Function.

⚠️ La seconda migration **ricrea** la vista `fic_fatture_residuo` creata dalla prima,
aggiungendo le colonne `pagato` e `da_pagare`. Vanno applicate **in quest'ordine**.

## Un principio da non violare

Una nota di credito **non cancella** la fattura. Restano due documenti distinti, entrambi
registrati, entrambi nel cassetto fiscale. Non si sovrascrive e non si cancella niente: si
tiene traccia di **quale nota abbatte quale fattura, e di quanto**.

## L'abbinamento automatico

Fatture in Cloud **non espone** un campo che colleghi la nota di credito alla fattura
originale (nello schema `ReceivedDocument` ci sono solo `invoice_number` e `description`,
testo libero). Il collegamento lo ricostruiamo noi, su tre livelli — e **mai per
approssimazione**:

| Livello | Condizione | Cosa fa |
|---|---|---|
| `certa` | stesso fornitore e il numero della fattura compare in `invoice_number` o nella descrizione della NC | abbina |
| `probabile` | stesso fornitore, **una sola** fattura aperta con residuo esattamente pari alla NC | abbina |
| nessuno | tutto il resto | lascia da abbinare a mano |

Il caso "NC datata prima della fattura" è escluso di proposito: sono quasi sempre storni di
acconto che un algoritmo non può interpretare.

Per gli abbinamenti a mano c'è `fic_abbina_manuale(...)`, che accetta **importi parziali**:
una NC può abbattere più fatture e una fattura può ricevere più NC. Rifiuta di allocare più
del disponibile, sia sulla nota sia sulla fattura.

## L'unica modifica al flusso esistente

Alla fine di ogni sincronizzazione, dopo che i documenti sono stati scritti, lancia
l'abbinamento. Due strade, scegli quella che si incastra meglio con il codice che hai già:

**A. Dentro la Edge Function**, dopo il ciclo dei documenti di ogni azienda:

```ts
await sb.rpc("fic_abbina_note_credito", { p_company: cid, p_direzione: "ricevuto" });
await sb.rpc("fic_abbina_note_credito", { p_company: cid, p_direzione: "emesso" });
```

**B. Dal cron**, subito dopo `fic_avvia_sync`, se preferisci non toccare la funzione.

Vale anche per le note di credito **emesse** ai clienti: stessa logica, `direzione = 'emesso'`.

## Le viste da usare nell'interfaccia

| Vista | A cosa serve |
|---|---|
| `fic_da_pagare` | **lo scadenzario**: solo ciò che resta davvero da pagare, con stato `scaduta` / `in_scadenza` / `futura` / `senza_scadenza` e i giorni di ritardo |
| `fic_fatture_residuo` | per ogni fattura: totale, abbattuto da NC, pagato, `da_pagare` |
| `fic_note_credito_aperte` | le note ancora da abbinare — è la lista di lavoro dell'operatore |
| `fic_saldo_controparti` | saldo per fornitore, con le NC già in negativo |
| `fic_scadenze` | una riga per rata: scadenza, importo, pagata sì/no |
| `fic_anomalie_pagamenti` | fatture pagate **più** del dovuto: quasi sempre una NC contata due volte. Da controllare a mano |

## Test di accettazione

Eseguiti su PostgreSQL 16, devono dare questi risultati esatti.

**Abbinamento automatico**, quattro fornitori:

| Caso | Atteso |
|---|---|
| Fattura `100/2026` da 1220 € + NC da 244 € che cita "ns. fattura 100/2026" | abbinata, confidenza `certa` |
| Fatture da 500 € e 900 € + NC da 900 € | abbinata alla sola fattura da 900, confidenza `probabile` |
| Due fatture identiche da 300 € + NC da 300 € | **nessun abbinamento** (ambiguo), resta in `fic_note_credito_aperte` |
| NC datata **prima** della fattura | **nessun abbinamento** |
| A mano: la NC da 300 € divisa 150 + 150 sulle due fatture | entrambe con residuo 150 € |
| A mano: allocare 500 € da una NC che ne ha 200 | **errore**, rifiutato |

**Scadenzario**, con i pagamenti dentro `payments_list`:

| Fattura | Totale | NC | Pagato | Da pagare | Nota |
|---|---|---|---|---|---|
| `100/2026` Alfa | 1220 | 244 | 610 (1ª rata) | **366,00** | prossima scadenza 10/05 |
| `A-55` Beta | 500 | 0 | 0 | **500,00** | |
| `A-56` Beta | 900 | 900 | 0 | **0,00** | ⚠️ su FIC ha ancora una rata aperta da 900 €, ma la NC l'ha azzerata: **non deve comparire in `fic_da_pagare`** |

L'ultima riga è il motivo per cui serve tutto questo. Se `A-56` compare nello scadenzario,
l'integrazione non funziona.
