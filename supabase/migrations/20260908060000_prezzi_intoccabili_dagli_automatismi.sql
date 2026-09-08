-- I prezzi li decide la scheda prodotto. Nessun altro.
--
-- Fino a oggi non era vero: woo-gestisci-prodotto, dopo aver pubblicato
-- sul sito, riscriveva in anagrafica il prezzo che WooCommerce
-- restituiva. Ma "prezzo_vendita" e' il NETTO, e quello che il sito
-- restituisce e' il LORDO pubblicato: un lordo finiva dentro un campo
-- netto, e al salvataggio successivo l'app ripubblicava quel numero
-- moltiplicato ancora per 1,22. Ogni giro gonfiava il prezzo del 22%.
-- Il codice delle due edge function e' stato corretto lo stesso giorno;
-- questo trigger e' la garanzia che regge anche se domani qualcuno
-- scrive una funzione nuova e se ne dimentica.
--
-- La regola: un automatismo non puo' cambiare i prezzi. Le edge function
-- parlano al database con la chiave di servizio (ruolo "service_role");
-- l'app, dove sta la scheda prodotto, parla come "anon". Quindi qui si
-- guarda chi sta scrivendo: se e' un automatismo, i quattro campi dei
-- prezzi restano quelli di prima e la modifica viene ignorata in
-- silenzio, senza far fallire il resto dell'update (stock, stato, nome).
-- Da SQL diretto (ruolo postgres) si passa: serve per correggere a mano.
create or replace function public.protezione_prezzi_automatismi()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'service_role' then
    return new;
  end if;

  if new.prezzo_vendita is distinct from old.prezzo_vendita then
    raise notice 'Prezzo di vendita di "%": modifica da automatismo ignorata (% -> %)', new.nome, old.prezzo_vendita, new.prezzo_vendita;
    new.prezzo_vendita := old.prezzo_vendita;
  end if;
  if new.costo_acquisto is distinct from old.costo_acquisto then
    raise notice 'Costo di acquisto di "%": modifica da automatismo ignorata (% -> %)', new.nome, old.costo_acquisto, new.costo_acquisto;
    new.costo_acquisto := old.costo_acquisto;
  end if;
  if new.aliquota_iva_vendita is distinct from old.aliquota_iva_vendita then
    new.aliquota_iva_vendita := old.aliquota_iva_vendita;
  end if;
  if new.aliquota_iva_acquisto is distinct from old.aliquota_iva_acquisto then
    new.aliquota_iva_acquisto := old.aliquota_iva_acquisto;
  end if;

  return new;
end;
$$;

-- il nome viene prima di trg_protezione_prezzo_lordo nell'ordine
-- alfabetico, che e' l'ordine in cui Postgres esegue i trigger: prima si
-- respinge l'automatismo, poi resta la vecchia rete contro l'eco del
-- lordo per le scritture che arrivano dall'app
drop trigger if exists trg_protezione_prezzi_automatismi on public.prodotti_shop;
create trigger trg_protezione_prezzi_automatismi
  before update on public.prodotti_shop
  for each row execute function public.protezione_prezzi_automatismi();

comment on function public.protezione_prezzi_automatismi() is
  'I prezzi (vendita, costo, aliquote) si cambiano solo dalla scheda prodotto: qualunque scrittura fatta con la chiave di servizio li lascia come sono.';
