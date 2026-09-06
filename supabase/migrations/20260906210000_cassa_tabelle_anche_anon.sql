-- Le quattro tabelle nuove erano nate `to authenticated`, con l'idea che
-- fossero "quattro tabelle in meno da mettere in sicurezza". L'idea era
-- giusta, il presupposto no: main.jsx monta App direttamente e non passa
-- da Accesso.jsx, quindi nessuno fa login con Supabase Auth e il client
-- dell'app è sempre `anon`. Per lui una policy `to authenticated` è una
-- porta chiusa: inserendo una spesa ricorrente arrivava
-- "new row violates row-level security policy".
--
-- Qui si aggiunge `anon`, come nelle altre 95 policy del progetto. Non è
-- il punto d'arrivo: è l'allineamento a com'è fatta oggi l'app. Il giorno
-- in cui il login verrà davvero attivato (main.jsx -> Accesso), queste
-- torneranno riservate insieme a tutte le altre.
alter policy "staff autenticato cassa_contanti_movimenti"
  on public.cassa_contanti_movimenti to anon, authenticated;

alter policy "staff autenticato cassa_spese_ricorrenti"
  on public.cassa_spese_ricorrenti to anon, authenticated;

alter policy "staff autenticato cassa_contanti_impostazioni"
  on public.cassa_contanti_impostazioni to anon, authenticated;

alter policy "staff autenticato consulenze_incassi"
  on public.consulenze_incassi to anon, authenticated;
