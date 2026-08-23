# Passaggio a Supabase Auth — piano di applicazione

Obiettivo: chiudere l'accesso pubblico al database **senza cambiare il modo in cui
sviluppi e senza toccare `App.jsx`**. Il controllo dei ruoli interno (`utenti_app`,
`ACCESS_CODE`, `ADMIN_CODE`) resta esattamente com'è: qui si aggiunge l'identità
sotto, non si sostituisce la logica sopra.

## Cosa cambia davvero

| | Prima | Dopo |
|---|---|---|
| Chi può interrogare il database | chiunque possieda la chiave `anon` | solo una sessione autenticata |
| Policy RLS | `for all to anon using (true)` | `for all to authenticated using (true)` |
| Query in `App.jsx` | — | **nessuna modifica** |
| File modificati | — | solo `src/main.jsx` (2 righe) |
| File nuovi | — | `src/Accesso.jsx` |

`App.jsx` non viene importato finché non esiste una sessione. È voluto: `App.jsx`
crea il proprio client Supabase al momento dell'import, quindi importarlo dopo il
login garantisce che quel client nasca già con la sessione attiva.

## Ordine di esecuzione — l'ordine conta

1. **Crea gli utenti dello staff** in Supabase → Authentication → Users → Add user,
   con email e password. Bastano i pochi che useranno davvero l'app.
2. **Metti in produzione il nuovo client** (`Accesso.jsx` + `main.jsx`) e verifica
   di riuscire a entrare. In questo momento le policy sono ancora su `anon`,
   quindi anche se qualcosa va storto l'app continua a funzionare come prima.
3. **Solo dopo**, applica `20260815120000_rls_solo_staff_autenticato.sql`.
4. **Verifica** con la query in fondo al file di migrazione: deve restituire 0 e 0.

Invertire i passi 2 e 3 lascia l'app senza dati finché non pubblichi il client.

## Se qualcosa va storto

Applica `20260815120001_rollback_rls_anon.sql`: riporta le policy su `anon` e
l'app torna a funzionare come oggi. Nessuna perdita di dati — si toccano solo le
policy, mai le righe.

## Cosa NON è incluso, e perché

- **Permessi per ruolo** (il venditore vede solo i suoi dati). Le policy restano
  `using (true)`: chi è autenticato vede tutto. È comunque un salto enorme rispetto
  a "chiunque su internet". Si stringe tabella per tabella, in un secondo momento,
  senza fretta.
- **Password in chiaro** in `venditori` e `utenti_app`. Si eliminano quando i ruoli
  passeranno al JWT: toglierle adesso significherebbe riscrivere il gate interno.
- **Bucket di storage pubblici** (10 su 10, inclusi `allegati-iscritti` e
  `master-documenti`). Chiuderli richiede sostituire i 14 `getPublicUrl` con URL
  firmati, quindi tocca `App.jsx`. Questa migrazione intanto rende le *policy* di
  storage riservate agli autenticati: i file non sono più elencabili dall'esterno,
  anche se un URL esatto già noto continua a funzionare. Da completare presto.

## Verifica non eseguita

Non ho potuto lanciare `npm run build` in questo ambiente (il registro npm non è
raggiungibile da qui). Prima di pubblicare, esegui in locale:

```bash
npm run dev     # provi il login
npm run build   # confermi che compila
```
