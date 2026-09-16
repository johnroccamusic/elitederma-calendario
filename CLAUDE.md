# CLAUDE.md — Gestionale Accademia Elitederma

> Verificato sul codice il 15 agosto 2026 (561 commit, clone completo).
> Tenere aggiornato questo file fa parte del lavoro.

## 1. Che cos'è

App web gestionale **a uso interno** dello staff di un'accademia di formazione
estetica: corsi a calendario → iscrizioni → pagamenti → magazzino e vendite →
contabilità. Nessun utente finale anonimo.

## 2. Stack (verificato)

| Livello | Tecnologia |
|---|---|
| UI | React 18.3, nessun router, nessuna libreria di stato |
| Build | Vite 5.4 |
| Database | Supabase — progetto `Elitederma-Calendario` (`snhvvipszhfllrgemsdu`), eu-west-1, Postgres 17 |
| Storage | 10 bucket Supabase, **tutti pubblici** |
| Backend | 8 edge function Deno in `supabase/functions/` (login venditori + sincronizzazione WooCommerce) |
| PDF | pdf-lib + pdfjs-dist, generazione e parsing **lato client** |
| Deploy | Vercel, team `elitederma`, progetto `elitederma-calendario` |
| Stile | inline style, nessun CSS framework |

Dipendenze totali: 6 in produzione. È un progetto volutamente essenziale — non
introdurre librerie nuove senza una ragione forte.

## 3. Struttura reale

```
src/App.jsx              25.944 righe — l'intera applicazione
src/main.jsx             entry point
src/Accesso.jsx          gate Supabase Auth (nuovo)
src/comuni-regioni.js    dati statici
supabase/functions/      8 edge function
supabase/migrations/     migrazioni versionate (nuovo)
supabase-*.sql           75 script di setup storici, cumulativi e idempotenti
```

`App.jsx` è un monolite. Non è una svista da correggere di slancio: qualunque
scomposizione va fatta a fette verificabili, una alla volta.

I 75 file `supabase-*.sql` alla radice sono la storia degli interventi sul
database, non lo stato attuale. **Lo stato attuale è il database**: 101 tabelle,
99 con RLS attiva. Le due senza sono `corsi_kit_prodotti_anellini_sostituiti` e
`corsi_kit_prodotti_dermografi_rimossi`. Le migrazioni nuove vanno in
`supabase/migrations/` con timestamp.

Attenzione: lo storico remoto delle migrazioni **non** coincide con la cartella
locale. Non usare `supabase db push` — rieseguirebbe migrazioni già applicate.
Per una migrazione nuova: file in `supabase/migrations/` come traccia, ed
esecuzione mirata (MCP o editor SQL) sul database.

## 4. Sicurezza — stato al 05/09/2026

Verificato interrogando il database e Vercel, non leggendo i file:

- **Le policy sono ancora aperte all'utente anonimo.** Delle 98 policy di
  `public`: 83 sono `for all to anon using (true) with check (true)`, 11 valgono
  per `anon` e `authenticated` insieme, 1 è un `select` per `anon`, e solo 3 sono
  riservate a `authenticated`. In pratica **95 su 98 permettono a un anonimo di
  leggere e scrivere**.

  La migrazione `20260815120000_rls_solo_staff_autenticato.sql` esiste e portava
  tutto a `to authenticated`, ma è stata annullata da
  `20260815120001_rollback_rls_anon.sql`, che le sta accanto. La versione
  precedente di questo file dava per fatto il lockdown: non lo era.

  La chiave anon sta nel bundle. Finché queste policy restano così, l'unica cosa
  che impedisce a chiunque di scrivere sul database è che il bundle non sia
  scaricabile — cioè l'SSO di Vercel. Vedi l'ultimo punto.
- **Le pagine pubbliche non passano più dalle tabelle.** Il link per la master
  (`?master=<token>`) nomina la classe con un token di 64 caratteri su
  `corsi_date.token_master`, e legge tramite due funzioni `security definer`:
  `master_vista` (solo i campi che la pagina disegna, solo quella classe) e
  `master_segna_incassato` (unica scrittura, vincolata a `corso_data_id`).
  Su entrambe l'esecuzione è revocata a `public`.
  Dal 17/09/2026 anche `?modelle=` e `?biglietti=` hanno le loro funzioni
  (`modelle_vista`, `modelle_salva_trattamenti`, `modelle_leggi_trattamenti`,
  `biglietti_vista`, più `slug_link`/`classe_da_link`): create e verificate,
  **ma l'app non è ancora stata collegata** — le due pagine leggono ancora le
  tabelle. Lo slug SQL è stato confrontato con `slugify` di App.jsx su tutti
  i 44 nomi di corsi e città: identico.
- **`Accesso.jsx` NON è collegato. Verificato il 17/09/2026.** Il file esiste,
  è completo e funzionante (213 righe: form di login, e `<App />` dentro una
  volta ottenuta la sessione), ma **nessuno lo importa**: `main.jsx` rende
  `<App />` direttamente. Nel bundle pubblicato la stringa "Area riservata
  allo staff" non compare proprio.

  Conseguenza: **nessun utente ha mai una sessione Supabase. Tutti sono
  `anon`, sempre.** L'unico cancello è la password interna del Gate dentro
  `App.jsx`, confrontata lato client con `venditori`/`utenti_app`/
  `password_menu` — tabelle che, con le policy attuali, chiunque legge con la
  chiave pubblicabile. Le password lì dentro sono in chiaro.

  È anche la spiegazione del rollback del 15/08: la migrazione portò le
  policy a `to authenticated` mentre **nessuno** era autenticato, e l'app
  morì all'istante. Chiudere le policy PRIMA di collegare `Accesso.jsx`
  rifarebbe lo stesso danno.

  Ordine corretto: collegare il gate → dare un account a chi deve entrare →
  poi chiudere le policy. Le tre rotte pubbliche (`master`, `modelle`,
  `biglietti`) restano la deroga, e dal 17/09/2026 passano tutte da funzioni
  `security definer` (vedi sotto).
- **`VITE_ACCESS_CODE` e `VITE_ADMIN_CODE` finiscono nel bundle pubblico.** In
  Vite tutto ciò che inizia con `VITE_` è visibile. `ADMIN_CODE` ha anche un
  fallback in chiaro nel sorgente (`"ED26"`). Da eliminare quando i ruoli
  passeranno al JWT.
- **Password in chiaro** nelle colonne `venditori.password` e `utenti_app.password`,
  leggibili da chiunque abbia una sessione. Esisteva PBKDF2 via edge function
  `venditori-login`, poi abbandonato. Da ripristinare.
- **10 bucket storage pubblici**, inclusi `allegati-iscritti` (213 file) e
  `master-documenti`. L'app usa `getPublicUrl` in 14 punti e nessun URL firmato:
  chiuderli richiede di sostituirli con `createSignedUrl`.
- **Fatto bene**: le credenziali WooCommerce stanno in variabili d'ambiente delle
  edge function (`WC_CONSUMER_KEY`, `WC_WEBHOOK_SECRET`…), e `woo-webhook` verifica
  la firma HMAC. È il pattern da estendere a Stripe, WhatsApp ed email.
- **`.env` non è mai stato committato**, `.gitignore` corretto, nessuna chiave nella
  storia git. Il repository è però **pubblico** su GitHub.
- **L'SSO di Vercel risulta attivo nelle impostazioni ma non blocca.** L'API dice
  `ssoProtection: enabled`, `deploymentType: all_except_custom_domains`. Provato
  davvero, il 5 settembre 2026, con una `curl` senza cookie né sessione:

  ```
  GET https://elitederma-calendario.vercel.app/  ->  200, index.html vero
  GET /assets/index-CZlCCs46.js                  ->  200, 2,2 MB
  ```

  Dentro quel bundle c'è la chiave pubblicabile del progetto Supabase
  (`sb_publishable_…`). Chiunque conosca l'indirizzo la scarica in due comandi.

  **Messo insieme al punto sulle policy, questo significa che oggi chiunque su
  internet può leggere e scrivere l'intero database** — anagrafiche, pagamenti,
  allegati degli allievi. Non è un rischio teorico: la chiave è pubblica e le
  policy dicono `to anon using (true) with check (true)`.

  La versione precedente di questo file dava l'SSO come "l'unica barriera". Non
  è una barriera: non c'è. Chiudere le policy non è più un passo di igiene, è
  la cosa che manca.

Regola operativa: dati di allievi (nome, residenza, email, pagamenti) sono materia
GDPR. Ogni modifica che li tocca passa da una verifica delle policy prima del merge.

## 5. Comandi

```bash
npm run dev       # sviluppo locale
npm run build     # build di produzione
npm run preview   # anteprima della build
```

Non esistono lint né test. Non aggiungerli di iniziativa: prima concordare se
servono e su cosa.

## 6. Convenzioni

- Italiano ovunque: nomi di variabili, funzioni, commenti, tabelle e colonne.
- Tabelle e colonne in `snake_case`, al plurale (`iscritti`, `corsi_date`).
- Commenti discorsivi che spiegano *perché*, non *cosa*. Mantenere questo registro.
- Date in UTC nel database, formattazione `it-IT` e fuso `Europe/Rome` solo in UI.
- Importi: verificare caso per caso prima di toccare calcoli di acconti, saldi,
  commissioni o inventario.

## 7. Cosa non fare mai

- Migrazioni, `UPDATE` o `DELETE` sul database di produzione senza conferma esplicita.
- Modificare la logica di commissioni, acconti/saldi o inventario senza mostrare
  prima il diff e l'impatto sui dati storici.
- Mettere segreti in variabili `VITE_*`: finiscono nel bundle pubblico.
- Spostare la generazione dei PDF lato server: è client-side per scelta.
- Riformattare o "sistemare" file non toccati dal task in corso.
- Aggiungere dipendenze per problemi che il codice esistente già risolve.

## 8. Come lavoriamo

- Modifiche strutturali: proposta breve → conferma → esecuzione.
- Database: sempre migrazione versionata in `supabase/migrations/`, mai modifiche
  a mano dalla dashboard.
- Su denaro, permessi o dati personali: chiedere, non indovinare.

## 9. Glossario

| Termine | Significato |
|---|---|
| **Master** | Formatrice che tiene il corso; ha obiettivi e commissioni proprie. |
| **Edizione** | Istanza concreta di un corso: sede + data + master. |
| **Leva** | Gruppo/turno di allievi associato a un corso. |
| **Kit corso** | Insieme di prodotti a magazzino consegnato all'allievo. |
| **Punti** | Unità alternativa all'euro per gli obiettivi di vendita. |
| **Origine vendita** | POS (diretta) vs WooCommerce (shop online). |
| **Modella** | Persona su cui gli allievi esercitano durante il corso. |
