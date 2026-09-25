// Fatture in Cloud: il token e l'emissione di una fattura.
//
// Finora l'app da Fatture in Cloud leggeva soltanto — i documenti
// RICEVUTI, per la contabilita' passiva. Emettere e' un'altra cosa e
// vive qui.
//
// Attenzione al token: ci sono DUE tabelle con la stessa connessione,
// "fic_connessioni" (usata da fic-sync) e "fatture_in_cloud_config"
// (usata da fic-sync-documenti). Sono la stessa azienda e tutte e due
// vengono rinnovate. Qui si legge la prima e si ripiega sulla seconda,
// cosi' un rinnovo fatto da una parte sola non lascia a piedi nessuno.

const FIC = "https://api-v2.fattureincloud.it";

export type ConnessioneFic = {
  company_id: number;
  access_token: string;
  refresh_token: string;
  scade_il: string;
  tabella: "fic_connessioni" | "fatture_in_cloud_config";
};

export async function leggiConnessione(sb: any): Promise<ConnessioneFic> {
  const { data: a } = await sb.from("fic_connessioni")
    .select("company_id, access_token, refresh_token, scade_il").limit(1).maybeSingle();
  if (a?.access_token) return { ...a, tabella: "fic_connessioni" };

  const { data: b } = await sb.from("fatture_in_cloud_config")
    .select("company_id, access_token, refresh_token, token_scade_il").limit(1).maybeSingle();
  if (b?.access_token) {
    return {
      company_id: b.company_id, access_token: b.access_token, refresh_token: b.refresh_token,
      scade_il: b.token_scade_il, tabella: "fatture_in_cloud_config",
    };
  }
  throw new Error("Fatture in Cloud non e' collegato: nessun token in fic_connessioni ne' in fatture_in_cloud_config.");
}

export async function tokenValido(sb: any, conn: ConnessioneFic): Promise<string> {
  const mancano = new Date(conn.scade_il).getTime() - Date.now();
  if (mancano > 5 * 60 * 1000) return conn.access_token;

  const clientId = Deno.env.get("FIC_CLIENT_ID");
  const clientSecret = Deno.env.get("FIC_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("FIC_CLIENT_ID/FIC_CLIENT_SECRET non impostati: non posso rinnovare il token.");

  const risposta = await fetch(`${FIC}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret,
      refresh_token: conn.refresh_token,
    }),
  });
  if (!risposta.ok) throw new Error(`Rinnovo del token fallito (${risposta.status}): ${await risposta.text()}`);

  const dati = await risposta.json();
  const scade = new Date(Date.now() + (dati.expires_in ?? 86400) * 1000).toISOString();
  const campi = conn.tabella === "fic_connessioni"
    ? { access_token: dati.access_token, refresh_token: dati.refresh_token ?? conn.refresh_token, scade_il: scade }
    : { access_token: dati.access_token, refresh_token: dati.refresh_token ?? conn.refresh_token, token_scade_il: scade };
  await sb.from(conn.tabella).update(campi).eq("company_id", conn.company_id);
  return dati.access_token as string;
}

// L'aliquota non si indovina: Fatture in Cloud identifica le aliquote
// con un id suo, e quale numero sia il 22% dipende dall'account. Qui si
// chiede all'account e si prende quella che vale davvero la percentuale
// richiesta — sbagliare questo numero vuol dire emettere una fattura
// con l'IVA sbagliata, e quella non si corregge con una modifica.
export async function idAliquota(token: string, companyId: number, percentuale: number): Promise<number> {
  const r = await fetch(`${FIC}/c/${companyId}/settings/vat_types?per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Non riesco a leggere le aliquote IVA (${r.status}): ${await r.text()}`);
  const lista = (await r.json())?.data || [];
  const esatta = lista.find((v: any) => Number(v.value) === Number(percentuale) && !v.is_disabled);
  if (!esatta) {
    const disponibili = lista.filter((v: any) => !v.is_disabled).map((v: any) => `${v.value}% (id ${v.id})`).join(", ");
    throw new Error(`Su Fatture in Cloud non c'e' un'aliquota al ${percentuale}%. Ci sono: ${disponibili || "nessuna"}.`);
  }
  return Number(esatta.id);
}

// Emette la fattura. `cliente` sono i dati raccolti sulla pagina di
// pagamento; `righe` e' quello che si e' venduto, coi prezzi al netto.
export async function emettiFattura(
  token: string,
  companyId: number,
  { cliente, righe, aliquotaId, dataIso, importoPagato, metodo }: {
    cliente: Record<string, any>;
    righe: { nome: string; quantita: number; prezzoNetto: number }[];
    aliquotaId: number;
    dataIso: string;
    importoPagato: number;
    metodo: string;
  },
): Promise<{ id: number; numero: string }> {
  // Una fattura elettronica vuole sapere DOVE mandarla: il codice
  // destinatario di sette caratteri, oppure la PEC. Per un privato senza
  // ne' l'uno ne' l'altro si usa il codice di cortesia 0000000, che e'
  // quello che lo Stato si aspetta quando il documento va solo al
  // cassetto fiscale.
  const codiceDestinatario = String(cliente.cod_dest || "").trim().toUpperCase();
  const pec = String(cliente.pec || "").trim();
  const entita: Record<string, any> = {
    name: [cliente.ditta, [cliente.nome, cliente.cognome].filter(Boolean).join(" ")].filter(Boolean)[0] || "Cliente",
    vat_number: cliente.piva || null,
    tax_code: cliente.codice_fiscale || null,
    address_street: [cliente.indirizzo, cliente.civico].filter(Boolean).join(" ") || null,
    address_postal_code: cliente.cap || null,
    address_city: cliente.citta || null,
    address_province: cliente.provincia || null,
    country: "Italia",
    email: cliente.email || null,
    certified_email: pec || null,
    ei_code: codiceDestinatario || (pec ? "0000000" : "0000000"),
    type: cliente.piva ? "company" : "person",
  };

  const corpo = {
    data: {
      type: "invoice",
      entity: entita,
      date: dataIso,
      currency: { id: "EUR" },
      e_invoice: true,
      items_list: righe.map((r) => ({
        name: r.nome,
        qty: r.quantita,
        net_price: r.prezzoNetto,
        vat: { id: aliquotaId },
      })),
      payments_list: [{
        amount: importoPagato,
        due_date: dataIso,
        paid_date: dataIso,
        status: "paid",
      }],
      payment_method: { name: metodo },
    },
  };

  const r = await fetch(`${FIC}/c/${companyId}/issued_documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) {
    const testo = await r.text();
    // 401/403 qui vuol dire quasi sempre una cosa sola: il collegamento
    // con Fatture in Cloud e' nato per leggere, e i permessi di
    // scrittura non ci sono. Va rifatta l'autorizzazione.
    if (r.status === 401 || r.status === 403) {
      throw new Error(`Fatture in Cloud ha rifiutato l'emissione (${r.status}). Di solito vuol dire che il collegamento non ha i permessi di scrittura sui documenti emessi: va rifatta l'autorizzazione. Risposta: ${testo}`);
    }
    throw new Error(`Emissione fallita (${r.status}): ${testo}`);
  }
  const dati = (await r.json())?.data || {};
  return { id: Number(dati.id), numero: String(dati.number ?? dati.numeration ?? "") };
}
