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
src/App.jsx              83.340 righe — ancora il grosso dell'applicazione
src/main.jsx             entry point
src/Accesso.jsx          gate Supabase Auth (collegato, vedi § 4)
src/comuni-regioni.js    dati statici
src/ui/                  mattoni condivisi: Button, Field, CampoNumero, colori
src/<modulo>/            fette già uscite dal monolite — consensi, content,
                         email, eventi, file, iscrizione, iscrizioni, magazzino,
                         notifiche, pos, prezzi, punti, recesso, rientri,
                         salvataggi, spese, stampe
supabase/functions/      40 edge function + _shared
supabase/migrations/     324 migrazioni versionate
supabase-*.sql           130 script di setup storici, cumulativi e idempotenti
```

`App.jsx` è ancora un monolite, e cresce. Non è una svista da correggere di
slancio: qualunque scomposizione va fatta a fette verificabili, una alla volta —
le cartelle qui sopra sono le fette già staccate.

I 130 file `supabase-*.sql` alla radice sono la storia degli interventi sul
database, non lo stato attuale. **Lo stato attuale è il database**: 152 tabelle,
8 viste, 149 policy distribuite su 145 tabelle.

**Dal 17/10/2026 la RLS è attiva su tutte e 152.** Sette tabelle hanno RLS
*senza* nessuna policy, che con la chiave pubblicabile vuol dire inaccessibili,
e in tutti e sette i casi è voluto: `fic_connessioni`,
`fatture_in_cloud_config`, `fic_documenti_pending` e `fic_sync_log` le tocca
solo `service_role` dalle edge function (l'app non le interroga mai dal
browser — verificato); `movimenti_banca_scartati_20261006`,
`_backup_acconti_pagati_20261011` e `_backup_lunchflow_doppioni_20261013` sono i
tre tavoli di scarto delle pulizie di ottobre, ed erano gli ultimi tre rimasti
*senza* RLS — cioè in lettura e scrittura a chiunque avesse la chiave del
bundle, con dentro movimenti bancari e acconti di allievi. Chiusi con
`20261017181500_rls_sui_tre_backup.sql`. Nessuna vista, funzione o foreign key
dipende da loro, e nel repo li nominano solo le due migrazioni che li hanno
creati: restano in attesa di essere esportati e cancellati.

Le migrazioni nuove vanno in `supabase/migrations/` con timestamp.

Attenzione: lo storico remoto delle migrazioni **non** coincide con la cartella
locale. Non usare `supabase db push` — rieseguirebbe migrazioni già applicate.
Per una migrazione nuova: file in `supabase/migrations/` come traccia, ed
esecuzione mirata (MCP o editor SQL) sul database.

## 4. Sicurezza — stato al 18/10/2026

Verificato interrogando il database e Vercel, non leggendo i file:

- **Le policy sono chiuse. 18/10/2026.** Delle 149 policy di `public`, 133
  erano `for all to anon using (true) with check (true)`: con la chiave
  pubblicabile — che sta nel bundle — si leggevano **e si riscrivevano**
  anagrafiche degli allievi, pagamenti, movimenti di banca, le password in
  chiaro di `venditori` e `utenti_app`. Adesso valgono tutte `to authenticated`.

  **Resta aperta una cosa sola, voluta:** `consensi_modelle` ha un `INSERT`
  per `anon` — la modella che firma col QR scrive il suo consenso e basta.
  Non può rileggere né il proprio né quelli delle altre. Stesso patto dei
  moduli di iscrizione: si carica, non si rilegge.

  **Prima di chiudere è stata spenta la registrazione pubblica** su Supabase
  Auth (`disable_signup: true`, verificato dall'esterno con la sola chiave
  pubblicabile). Senza quel passaggio la chiusura sarebbe stata teatro:
  chiunque si sarebbe creato un account e sarebbe rientrato da
  `authenticated`.

  **Perché stavolta non ha spento l'app**, e il 15/08 sì: allora il cancello
  di `Accesso.jsx` era spento e nessuno aveva una sessione. Dall'08/10 il
  cancello è acceso.

  Verificato dall'esterno subito dopo: `iscritti`, `venditori`, `utenti_app`,
  `movimenti_banca`, `vendite_shop`, `consensi_modelle`, `password_menu` →
  **zero righe**; un `insert` su `iscritti` → **401, violates row-level
  security**. La fotografia delle policy di prima è in
  `_policy_snapshot_20261018`, e il rollback è già scritto in
  `20261018230001_rls_rollback_anon.sql`: rimette tutto com'era leggendo da
  quella fotografia, non a memoria.
- **Le sette rotte pubbliche, e come sopravvivono alla chiusura.** Sei non
  toccano più le tabelle: passano da funzioni `security definer`, che girano
  coi permessi del proprietario e ignorano le policy. Tutte hanno `execute`
  concesso ad `anon` e revocato a `public`.

  | Rotta | Come parla col database |
  |---|---|
  | `?master=` | `master_vista`, `master_segna_incassato` |
  | `?modelle=` | `modelle_vista`, `modelle_leggi_trattamenti`, `modelle_salva_trattamenti` |
  | `?biglietti=` | `biglietti_vista` |
  | `?ricevuta=` | `ricevuta_pos` |
  | `?modulo=` | `modulo_vista`, `modulo_salva` + caricamento su `moduli-iscrizione` |
  | `?recesso=` | `recesso_vista` + edge function `modulo-recesso` |
  | `?consenso=` | **scrive dritto in `consensi_modelle`** (INSERT per `anon`) + caricamento su `consensi-documenti` |

  La versione precedente di questo file diceva che modelle e biglietti
  «non sono ancora collegati»: non è più vero dal 18/10/2026.
- **`Accesso.jsx` ORA è collegato. Verificato il 08/10/2026.** In
  `main.jsx` la costante `CANCELLO_ACCESO` è `true`, e l'app rende
  `<Accesso />` con `<App />` dentro: chi entra fa un vero accesso
  Supabase e **ha una sessione**. La versione precedente di questo file
  diceva il contrario — era vero fino a metà settembre, non più.

  Due cose restano però come prima, e sono quelle che contano:
  **le policy non sono state chiuse** (vedi il punto qui sopra: 132 delle
  136 policy di `public` valgono ancora per `anon`), quindi la sessione
  c'è ma non protegge niente; e **il ruolo e l'identità dentro l'app li
  decide ancora il Gate interno** di `App.jsx`, con la password
  confrontata lato client su `venditori`/`utenti_app`/`password_menu` —
  è da lì che esce `utenteLoggato.masterId`, non dal JWT.

  Ordine di quello che manca: dare un account a chiunque debba entrare →
  verificare che nessuno resti fuori → chiudere le policy a
  `authenticated`. Le tre rotte pubbliche (`master`, `modelle`,
  `biglietti`) restano la deroga.
- **`VITE_ACCESS_CODE` e `VITE_ADMIN_CODE` finiscono nel bundle pubblico.** In
  Vite tutto ciò che inizia con `VITE_` è visibile. `ADMIN_CODE` ha anche un
  fallback in chiaro nel sorgente (`"ED26"`). Da eliminare quando i ruoli
  passeranno al JWT.
- **Password in chiaro** nelle colonne `venditori.password` e `utenti_app.password`.
  Dal 18/10/2026 non sono più leggibili da chiunque abbia la chiave del bundle,
  ma restano leggibili **da chiunque abbia una sessione**, cioè da tutto lo
  staff. È il primo dei prossimi passi. Esisteva PBKDF2 via edge function
  `venditori-login`, poi abbandonato. Da ripristinare.
- **Lo storage: 18 secchi pubblici, non 10.** `allegati-iscritti`,
  `master-documenti`, `venditori-documenti`, `spese-allegati`,
  `leve-assistenti-documenti` e altri. «Pubblico» è un'impostazione del secchio:
  chi conosce l'indirizzo di un file lo scarica, policy o non policy.

  **Dal 18/10/2026 però da fuori non si scrive più.** Diciassette policy
  `for all to anon` sono passate a `authenticated`: si potevano sostituire
  loghi, locandine, allegati delle spese e documenti dei venditori. Restano ad
  `anon` due sole policy, tutte e due di solo INSERT, e sono le due pagine
  pubbliche che caricano un file: `moduli-iscrizione` e `consensi-documenti`.
  A `consensi-documenti` è stata tolta la lettura: i documenti d'identità delle
  modelle non si rileggono da fuori.

  **Resta da fare la lettura**: i secchi sono ancora pubblici, e chiuderli
  richiede di sostituire `getPublicUrl` con `createSignedUrl` in 14 punti
  dell'app. È il prossimo passo di questo capitolo.
- **Fatto bene**: le credenziali WooCommerce stanno in variabili d'ambiente delle
  edge function (`WC_CONSUMER_KEY`, `WC_WEBHOOK_SECRET`…), e `woo-webhook` verifica
  la firma HMAC. È il pattern da estendere a Stripe, WhatsApp ed email.
- **Email (dal 15/10/2026).** Invio tramite Resend con la edge function
  `invia-email`, mittente `notifiche@elitederma.net`, risposte a
  `notifiche@elitederma.it`. Dominio separato perché elitederma.it sta su Jimdo,
  che non permette i record DNS di Resend; elitederma.net è su GoDaddy e
  verificato. La chiave è il secret `RESEND_API_KEY`. La funzione accetta solo
  una sessione valida o la service role key: la chiave pubblicabile, che è nel
  bundle, non basta. Massimo 20 destinatari per invio; le campagne agli ex
  allievi avranno una funzione propria (disiscrizione, lotti, registro).

  Il testo delle mail sta in **`email_modelli`** (una riga per `chiave`, la
  prima è `conferma_iscrizione`), scritto da Setting → Modelli email. I
  segnaposti fra graffe li sostituisce `componiMailConferma` in App.jsx; se la
  riga manca o è stata svuotata vale il testo scritto nel codice, che resta lì
  apposta. È la **prima tabella con una sola policy `to authenticated`** e non
  `anon`: da qui si decide cosa esce a nome di Elitederma, e la chiave
  pubblicabile è nel bundle. Funziona perché il cancello di `Accesso.jsx` è
  acceso — se un giorno lo si spegnesse, questa tabella diventerebbe illeggibile
  e le mail tornerebbero al testo del codice senza dire niente a nessuno.

  **Registro e invii automatici (15/10/2026).** Ogni invio lascia una riga in
  `email_inviate`, anche quando fallisce. Un indice unico *parziale*
  (`chiave_modello + iscritto_id`, solo `automatica and esito = 'ok'`) impedisce
  a una mail automatica di partire due volte, lasciando però che il tasto a mano
  rimandi quante volte serve. `email_regole` dice *quando* parte cosa
  (`scarto_giorni` negativo = prima dell'evento) e **nasce sempre spenta**. Il
  lavoro notturno è la edge function `email-programmate`, che con
  `{ "prova": true }` dice solo cosa partirebbe senza mandare niente — è il
  pulsante «Guarda cosa partirebbe oggi». La composizione sta in
  `supabase/functions/_shared/email.js`, importata **sia** da App.jsx **sia** da
  Deno: due copie vorrebbero dire che l'anteprima mostra una mail e l'allieva ne
  riceve un'altra.

  **Il cron è acceso dal 16/10/2026** (`email-programmate-giornaliero`, `0 6 * * *`),
  e la policy di `email_regole` è `to authenticated`. Ma **non parte niente**:
  l'unica regola che esiste (`dettagli_organizzativi`, −3 giorni dall'inizio
  corso) è spenta, e il giro di prova risponde «Nessuna regola accesa.»

  Come si autentica il cron, e perché non con la service role key: la funzione
  confronta il gettone ricevuto con la propria `SUPABASE_SERVICE_ROLE_KEY`
  carattere per carattere, e il JWT `service_role` che il vault ha da agosto
  (`fic_service_key`) è di prima del passaggio alle chiavi nuove — provato, 403.
  Mettere dentro quella giusta voleva dire far passare da una chat o da un file
  una credenziale che scavalca ogni policy. Quindi il cron manda **due** header:
  `Authorization: Bearer <JWT anon>`, che serve solo a passare il cancello
  `verify_jwt` di Supabase, e `x-cron-token`, un gettone di 32 byte **nato dentro
  Postgres** (`gen_random_bytes`) e mai uscito dal database, che la funzione fa
  verificare a `public.email_cron_ok` — `security definer`, eseguibile solo da
  `service_role`, così la chiave pubblicabile del bundle non lo può usare come
  oracolo. Verificato: gettone giusto 200, inventato 403, assente 403.
  Per rigenerarlo: cancellare la riga `email_cron_token` dal vault e rieseguire
  `20261016133139_email_cron_gettone.sql`.

  Gli altri cinque lavori notturni del progetto si limitano a mandare un JWT del
  progetto e si fidano del cancello: le loro funzioni non controllano nient'altro.
  Per una che spedisce posta a nome nostro non bastava.
- **Il testo del contratto si corregge dall'app (16/10/2026).** Regolamento,
  informativa privacy e consensi stanno in `src/iscrizione/contenuto.js`,
  trascritti parola per parola dal modulo del sito. Da Setting → Modulo di
  iscrizione → **Il contratto** si leggono per intero e si correggono; la
  correzione va in **`modulo_iscrizione_testi`** (`chiave`, `corpo` jsonb), che è
  la seconda tabella con una sola policy `to authenticated`.

  Come `email_modelli`: **riga mancante = vale il testo del codice**. La tabella
  nasce vuota apposta, e «Rimetti com'era» cancella la riga invece di riscrivere
  il testo. Quello che una persona firma non può dipendere dal fatto che una
  select sia andata a buon fine.

  Qui niente si salva da solo: sono clausole contrattuali, e una parola cambiata
  uscendo da un campo è una cosa di cui nessuno si accorge. Si entra in
  correzione, si scrive, si preme Salva.

  **Attenzione a cosa cambia davvero.** Oggi `contenuto.js` lo legge solo questa
  pagina: il modulo che l'allieva riceve **non esiste ancora** (è la Fase 2).
  Correggere il testo adesso prepara quel modulo, non cambia niente di ciò che
  gira oggi.
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
npm run dev                  # sviluppo locale
npm run build                # build di produzione
npm run preview              # anteprima della build
sh controlla-funzioni.sh     # tipi delle edge function (Deno), prima di pubblicarle
```

Non esistono lint né test sull'app. Non aggiungerli di iniziativa: prima
concordare se servono e su cosa.

**Le edge function invece un controllo ce l'hanno, dal 18/10/2026.**
`supabase functions deploy` impacchetta e basta: non guarda i tipi e non si
accorge di una variabile che non esiste. È così che è finita in produzione una
funzione con dentro `dataIso is not defined`, scoperta dal titolare premendo il
tasto per emettere una fattura vera. `sh controlla-funzioni.sh` passa
`deno check` su tutte (o su una sola, se la si nomina) e va lanciato **prima**
di `supabase functions deploy`. Deno sta in `~/.deno/bin/deno`.

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
