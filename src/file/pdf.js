// UN PDF FATTO NEL BROWSER SI CONSEGNA A CHI GUARDA.
//
// Otto righe che non calcolano niente, e stanno qui perche' erano
// scritte TRE VOLTE identiche: in `prezzi/listinoPdf.js`, in
// `eventi/bolla.js` e in App.jsx (`scaricaPdfBytes`). I primi due ora
// la ri-esportano — chi li importa non cambia una riga — e App.jsx ha
// ancora la sua: quando qualcuno ci passa, la faccia delegare qui.
//
// Perche' un <a download> e non `window.open`: su iPhone un blob aperto
// in una scheda nuova a volte resta bianco e a volte viene bloccato,
// mentre il link con `download` apre il foglio di condivisione — ed e'
// da li' che si stampa o si manda a qualcuno.
export function scaricaPdf(bytes, nomeFile) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeFile;
  document.body.appendChild(a); a.click(); a.remove();
  // l'indirizzo si libera dopo, non subito: revocarlo nello stesso giro
  // lascia il browser senza niente da scaricare
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
