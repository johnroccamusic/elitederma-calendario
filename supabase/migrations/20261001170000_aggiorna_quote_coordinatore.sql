-- Riallinea la quota coordinatore scritta sulle schede degli iscritti dei
-- corsi che devono ancora cominciare.
--
-- Serve perche' il congelamento vale solo all'indietro: su un corso futuro
-- la quota si ricalcola sempre con la percentuale di oggi, e quello che
-- l'app mostra e' gia' giusto da solo. Ma il numero va anche SCRITTO, se
-- no il giorno in cui quel corso diventa passato si congela una colonna
-- vuota o vecchia. Questa funzione fa quella scrittura in un colpo solo,
-- dal tasto in Definizione provvigioni.
--
-- Non tocca i corsi gia' cominciati: quello era l'accordo di allora, e una
-- percentuale decisa oggi non riscrive il passato.
create or replace function aggiorna_quote_coordinatore(percentuale numeric)
returns integer
language plpgsql
as $$
declare quante integer;
begin
  if percentuale is null or percentuale < 0 or percentuale > 100 then
    raise exception 'Percentuale fuori scala: %', percentuale;
  end if;
  update iscritti i
     set quota_coordinatore = round(coalesce(i.totale_pattuito, 0) * percentuale / 100.0, 2)
    from corsi_date cd
   where cd.id = i.corso_data_id
     and cd.data_inizio >= current_date;
  get diagnostics quante = row_count;
  return quante;
end;
$$;

comment on function aggiorna_quote_coordinatore(numeric) is
  'Riscrive iscritti.quota_coordinatore come percentuale del totale pattuito, solo sui corsi non ancora cominciati (01/10/2026).';
