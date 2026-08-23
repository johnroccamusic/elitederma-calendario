// ---------------------------------------------------------------------------
// Gate di accesso con Supabase Auth.
//
// Sta DAVANTI ad App.jsx e non ne modifica una riga: finché non esiste una
// sessione valida, App.jsx non viene nemmeno importato. Questo è voluto —
// App.jsx crea il proprio client Supabase al momento dell'import, quindi
// importarlo solo dopo il login garantisce che quel client parta con la
// sessione già in memoria e che tutte le query esistenti continuino a
// funzionare senza alcuna modifica.
//
// Il controllo interno dei ruoli (utenti_app, ACCESS_CODE, ADMIN_CODE) resta
// esattamente com'è: questo livello aggiunge l'identità, non la sostituisce.
// ---------------------------------------------------------------------------

import React, { useEffect, useState, Suspense, lazy } from "react";
import { createClient } from "@supabase/supabase-js";

const App = lazy(() => import("./App.jsx"));

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const NAVY = "#0E1B33";
const BG = "#EFE9DC";
const BORDO = "#E8E3D6";
const GOLD = "#C9A26D";

function Schermata({ children }) {
  return (
    <div style={{
      minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {children}
    </div>
  );
}


// Cattura gli errori di App.jsx e li mostra a schermo invece di lasciare
// una pagina bianca. Senza questo, qualunque eccezione durante il render
// produce solo un <div> vuoto e bisogna aprire la console per capirlo.
class ConfineErrori extends React.Component {
  constructor(props) {
    super(props);
    this.state = { errore: null };
  }
  static getDerivedStateFromError(errore) {
    return { errore };
  }
  componentDidCatch(errore, info) {
    console.error("Errore nell'app:", errore, info);
  }
  render() {
    if (this.state.errore) {
      return (
        <Schermata>
          <div style={{
            maxWidth: 700, background: "#fff", border: "1px solid #E8E3D6",
            borderRadius: 14, padding: 24, color: "#0E1B33",
          }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18, color: "#B4453F" }}>
              L'applicazione ha generato un errore
            </h2>
            <pre style={{
              whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.5,
              background: "#F6F5F1", padding: 14, borderRadius: 9, margin: 0,
              maxHeight: 380, overflow: "auto",
            }}>
{String(this.state.errore && this.state.errore.stack || this.state.errore)}
            </pre>
          </div>
        </Schermata>
      );
    }
    return this.props.children;
  }
}

export default function Accesso() {
  const [sessione, setSessione] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessione(data.session);
      setCaricamento(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSessione(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function accedi(e) {
    e.preventDefault();
    setErrore("");
    setInCorso(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setInCorso(false);
    if (error) {
      // Diagnostica temporanea: mostra l'errore grezzo di Supabase.
      // Da rimettere a messaggio generico una volta risolto.
      console.error("Supabase auth error:", error);
      setErrore(`${error.message} — codice ${error.status ?? "n/d"} — ${error.code ?? "senza code"}`);
    }
  }

  if (caricamento) {
    return <Schermata><div style={{ color: NAVY, opacity: 0.6 }}>Caricamento…</div></Schermata>;
  }

  if (!sessione) {
    return (
      <Schermata>
        <form
          onSubmit={accedi}
          style={{
            width: "100%", maxWidth: 380, background: "#fff", border: `1px solid ${BORDO}`,
            borderRadius: 16, padding: "32px 28px",
            boxShadow: "0 8px 32px rgba(14,27,51,.08)",
          }}
        >
          <div style={{ height: 3, width: 44, background: GOLD, borderRadius: 2, marginBottom: 20 }} />
          <h1 style={{ margin: "0 0 6px", fontSize: 21, color: NAVY, letterSpacing: "-.01em" }}>
            Accademia Elitederma
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "#8B8FA3" }}>
            Area riservata allo staff.
          </p>

          <label style={{ display: "block", fontSize: 12.5, color: NAVY, marginBottom: 6 }}>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="username" required
            style={{
              width: "100%", padding: "10px 12px", fontSize: 14.5, marginBottom: 16,
              border: `1px solid ${BORDO}`, borderRadius: 9, outline: "none", color: NAVY,
            }}
          />

          <label style={{ display: "block", fontSize: 12.5, color: NAVY, marginBottom: 6 }}>Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required
            style={{
              width: "100%", padding: "10px 12px", fontSize: 14.5, marginBottom: 20,
              border: `1px solid ${BORDO}`, borderRadius: 9, outline: "none", color: NAVY,
            }}
          />

          {errore && (
            <div style={{
              background: "#FDECEC", color: "#B4453F", fontSize: 13,
              padding: "9px 12px", borderRadius: 9, marginBottom: 16,
            }}>
              {errore}
            </div>
          )}

          <button
            type="submit" disabled={inCorso}
            style={{
              width: "100%", padding: "11px 12px", fontSize: 15, fontWeight: 600,
              background: NAVY, color: "#fff", border: "none", borderRadius: 9,
              cursor: inCorso ? "default" : "pointer", opacity: inCorso ? 0.6 : 1,
            }}
          >
            {inCorso ? "Accesso in corso…" : "Entra"}
          </button>
        </form>
      </Schermata>
    );
  }

  return (
    <ConfineErrori>
      <Suspense fallback={<Schermata><div style={{ color: NAVY, opacity: 0.6 }}>Caricamento…</div></Schermata>}>
        <App />
      </Suspense>
    </ConfineErrori>
  );
}

// Esci dalla sessione: richiamabile da App.jsx in un secondo momento
// (es. dal menu della rotellina) senza dover importare nulla d'altro.
export async function esci() {
  await supabase.auth.signOut();
  window.location.reload();
}
