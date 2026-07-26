# Guida di installazione — Calendario Corsi Elitederma Academy

App ad uso interno (staff) per gestire corsi, città, date/edizioni e iscritti, con vista calendario mensile e ricerca. Protetta da un semplice codice d'accesso.

Stesso procedimento già seguito per il questionario: Supabase (database), GitHub (codice), Vercel (pubblicazione online). 30-40 minuti, nessuna riga di codice da scrivere.

Consiglio: puoi usare lo **stesso account** Supabase, GitHub e Vercel che usi già per il questionario — basta creare un **nuovo progetto** in ognuno (questa app ha un database separato).

---

## PASSO 1 — Il database (Supabase)

1. Su **supabase.com**, dalla tua organizzazione esistente, crea un **nuovo progetto**:
   - Name: `elitederma-calendario`
   - Password e Region: come hai già fatto per il questionario
2. **SQL Editor** → "New query" → apri `supabase-setup.sql` di questa cartella, copia tutto, incolla, **RUN**. Deve dire "Success".
3. **Project Settings → API**: copia **Project URL** e la chiave **anon public** (ti servono al Passo 3). Qui non serve la `service_role`: l'app usa solo la chiave pubblica, protetta dal codice d'accesso.

---

## PASSO 2 — Il codice online (GitHub)

1. **New repository** → nome `elitederma-calendario`, visibilità **Private** → Create
2. "uploading an existing file" → trascina **tutto il contenuto** della cartella `elitederma-calendario` (compresa la sottocartella `src`) → **Commit changes**

---

## PASSO 3 — L'app online (Vercel)

1. **Add New → Project** → importa `elitederma-calendario`
2. Framework Preset: **Vite** (riconosciuto in automatico)
3. **Environment Variables**, tre righe:

   | Nome | Valore |
   |---|---|
   | `VITE_SUPABASE_URL` | il Project URL del nuovo progetto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | la chiave **anon public** dello stesso progetto |
   | `VITE_ACCESS_CODE` | il codice che userete tu e il tuo team per entrare nell'app — scegline uno adesso |

4. **Deploy** → attendi 1-2 minuti → apri il link che ti dà Vercel (tipo `elitederma-calendario.vercel.app`)

---

## PASSO 4 — Collaudo

1. Apri il link → inserisci il codice d'accesso scelto
2. **Impostazioni**: aggiungi una città, poi un corso (nome + colore + posti), poi una data (corso + città + giorno)
3. **Calendario**: verifica che sul giorno scelto compaia la striscia colorata del corso
4. **Cerca corso**: prova a filtrare per città/corso/data, oppure premi "Tutti i corsi"
5. Apri una data → aggiungi un iscritto di prova, verifica che i posti liberi si aggiornino, prova a spostarlo su un'altra data (se ne hai create almeno due per lo stesso corso) e infine eliminalo

---

## Domande frequenti

**Come cambio il codice d'accesso?** Vercel → il progetto → Settings → Environment Variables → modifica `VITE_ACCESS_CODE` → Deployments → ⋯ sull'ultimo deploy → "Redeploy".

**Un colore risulta "già usato" anche se mi sembra libero?** I colori dei corsi devono essere univoci (servono a distinguerli a colpo d'occhio nel calendario): scegline una tonalità leggermente diversa.

**Dove sono i dati?** Nel progetto Supabase `elitederma-calendario`, tabelle `corsi`, `location`, `corsi_date`, `iscritti` — separate dal database del questionario.

**È sicura questa app?** L'accesso è protetto da un codice condiviso lato app, adatto a un uso interno tra poche persone fidate. Non è un sistema di login con utenti singoli: chiunque conosca il codice (o la chiave "anon" di Supabase) può leggere e modificare i dati. Se in futuro serve un controllo più fine (account personali, permessi diversi per ruolo), è un passo successivo da costruire a parte.

**Qualcosa non funziona?** Screenshot dell'errore e lo guardiamo insieme in chat.
