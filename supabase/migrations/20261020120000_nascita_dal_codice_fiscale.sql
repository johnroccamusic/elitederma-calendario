-- DATA E LUOGO DI NASCITA, LETTI DAL CODICE FISCALE CHE C'ERA GIA'.
--
-- I tre campi nuovi nascono vuoti su 260 schede, ma 253 di quelle
-- schede hanno un codice fiscale, e un codice fiscale *contiene* la
-- data di nascita, il sesso e il comune: non c'e' niente da chiedere a
-- nessuno, c'e' solo da leggerlo.
--
-- Quattro cose non si leggono e restano fuori:
--   * i codici con la forma sbagliata (6 righe) e quelli con la lettera
--     di controllo che non torna (5): sono trascrizioni con un errore
--     dentro, e decodificarle vorrebbe dire scrivere in archivio una
--     data di nascita inventata;
--   * i codici da omocodia, dove l'Agenzia ha sostituito delle cifre
--     con lettere: il filtro sulla forma li esclude da se';
--   * i comuni soppressi, il cui codice non sta piu' nell'elenco ISTAT
--     di oggi (L849 e' il solo caso, e quella riga ha comunque il
--     codice malfatto).
--
-- Il secolo: due cifre non dicono se e' 1987 o 2087. Chi ha "08" o meno
-- e' del 2000, perche' nel 2026 avrebbe 18 anni; dal "09" in su e'
-- del 1900. Sopra i 18 anni non c'e' ambiguita' per nessuno dei nostri.
--
-- Si scrive SOLO dove il campo e' vuoto: una data messa a mano da
-- qualcuno comanda sempre sul calcolo.

-- La lettera di controllo, in SQL, per il tempo di questa migrazione.
-- L'algoritmo vero sta in src/iscrizione/codice-fiscale.js ed e'
-- provato li'; questa copia e' servita a decidere quali codici in
-- archivio si possono leggere e quali no, e viene cancellata in fondo
-- (vedi 20261020123000_rls_e_pulizia_nascita.sql).
create or replace function public._cf_lettera(p text) returns text
language plpgsql immutable as $$
declare
  alfabeto text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  dispari int[] := array[1,0,5,7,9,13,15,17,19,21,1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23];
  somma int := 0; i int; ch text; pos int;
begin
  if p is null or length(p) < 15 then return null; end if;
  for i in 1..15 loop
    ch := substr(upper(p), i, 1);
    pos := position(ch in alfabeto);
    if pos = 0 then return null; end if;
    if i % 2 = 1 then somma := somma + dispari[pos];
    else somma := somma + case when pos <= 10 then pos - 1 else pos - 11 end;
    end if;
  end loop;
  return substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', (somma % 26) + 1, 1);
end; $$;

create table if not exists public._luoghi_catastali_20261020 (
  codice text primary key, nome text not null, tipo text not null
);
insert into public._luoghi_catastali_20261020 (codice, nome, tipo) values
  ('A048','Acquaviva delle Fonti','comune'),
  ('A123','Alatri','comune'),
  ('A182','Alessandria','comune'),
  ('A323','Anzio','comune'),
  ('A341','Aprilia','comune'),
  ('A345','L''Aquila','comune'),
  ('A390','Arezzo','comune'),
  ('A509','Avellino','comune'),
  ('A512','Aversa','comune'),
  ('A515','Avezzano','comune'),
  ('A662','Bari','comune'),
  ('A930','Bojano','comune'),
  ('A940','Bollate','comune'),
  ('A944','Bologna','comune'),
  ('A952','Bolzano','comune'),
  ('B036','Borgo San Lorenzo','comune'),
  ('B354','Cagliari','comune'),
  ('B428','Caltagirone','comune'),
  ('B519','Campobasso','comune'),
  ('B963','Caserta','comune'),
  ('C111','Castelfranco Veneto','comune'),
  ('C129','Castellammare di Stabia','comune'),
  ('C136','Castellaneta','comune'),
  ('C351','Catania','comune'),
  ('C588','Cetraro','comune'),
  ('C758','Cividale del Friuli','comune'),
  ('C773','Civitavecchia','comune'),
  ('C794','Cles','comune'),
  ('C816','Codogno','comune'),
  ('C858','Colleferro','comune'),
  ('C933','Como','comune'),
  ('C957','Conegliano','comune'),
  ('D003','Cori','comune'),
  ('D086','Cosenza','comune'),
  ('D208','Cuorgnè','comune'),
  ('D286','Desio','comune'),
  ('D451','Fabriano','comune'),
  ('D612','Firenze','comune'),
  ('D643','Foggia','comune'),
  ('D653','Foligno','comune'),
  ('D662','Fondi','comune'),
  ('D773','Frascati','comune'),
  ('D843','Gaeta','comune'),
  ('D869','Gallarate','comune'),
  ('D960','Gela','comune'),
  ('D969','Genova','comune'),
  ('D976','Locri','comune'),
  ('E017','Giarre','comune'),
  ('E155','Gravina in Puglia','comune'),
  ('E202','Grosseto','comune'),
  ('E223','Grumo Appula','comune'),
  ('E230','Gualdo Tadino','comune'),
  ('E281','Iglesias','comune'),
  ('E372','Vasto','comune'),
  ('E435','Lanciano','comune'),
  ('E469','Laterza','comune'),
  ('E472','Latina','comune'),
  ('E473','Latisana','comune'),
  ('E648','Lodi','comune'),
  ('E715','Lucca','comune'),
  ('E801','Magenta','comune'),
  ('E932','Marcianise','comune'),
  ('E951','Mariano Comense','comune'),
  ('E958','Marino','comune'),
  ('E975','Marsciano','comune'),
  ('F032','Massa Marittima','comune'),
  ('F052','Matera','comune'),
  ('F152','Mesagne','comune'),
  ('F205','Milano','comune'),
  ('F240','Mirandola','comune'),
  ('F241','Mirano','comune'),
  ('F712','Morbegno','comune'),
  ('F817','Muro Lucano','comune'),
  ('F839','Napoli','comune'),
  ('F924','Nola','comune'),
  ('G141','Ortona','comune'),
  ('G187','Ostuni','comune'),
  ('G273','Palermo','comune'),
  ('G274','Palestrina','comune'),
  ('G337','Parma','comune'),
  ('G370','Paternopoli','comune'),
  ('G479','Pesaro','comune'),
  ('G482','Pescara','comune'),
  ('G535','Piacenza','comune'),
  ('G596','Piedimonte Matese','comune'),
  ('G713','Pistoia','comune'),
  ('G888','Pordenone','comune'),
  ('G942','Potenza','comune'),
  ('H224','Reggio di Calabria','comune'),
  ('H282','Rieti','comune'),
  ('H501','Roma','comune'),
  ('H620','Rovigo','comune'),
  ('H769','San Benedetto del Tronto','comune'),
  ('H860','San Gennaro Vesuviano','comune'),
  ('H974','Sanluri','comune'),
  ('I138','Sanremo','comune'),
  ('I156','San Severino Marche','comune'),
  ('I182','Santadi','comune'),
  ('I234','Santa Maria Capua Vetere','comune'),
  ('I281','Sant''Angelo dei Lombardi','comune'),
  ('I422','Sapri','comune'),
  ('I533','Sciacca','comune'),
  ('I676','Sessa Aurunca','comune'),
  ('I754','Siracusa','comune'),
  ('I872','Soverato','comune'),
  ('I930','Squinzano','comune'),
  ('L049','Taranto','comune'),
  ('L103','Teramo','comune'),
  ('L113','Termoli','comune'),
  ('L182','Tivoli','comune'),
  ('L219','Torino','comune'),
  ('L378','Trento','comune'),
  ('L719','Velletri','comune'),
  ('L727','Venaria Reale','comune'),
  ('L736','Venezia','comune'),
  ('L738','Venosa','comune'),
  ('L746','Verbania','comune'),
  ('Z100','Albania','stato'),
  ('Z112','Germania','stato'),
  ('Z129','Romania','stato'),
  ('Z138','Ucraina','stato'),
  ('Z140','Moldova','stato'),
  ('Z216','Filippine','stato'),
  ('Z222','India','stato'),
  ('Z322','Kenya','stato'),
  ('Z343','Senegal','stato'),
  ('Z354','Burkina Faso','stato'),
  ('Z404','Stati Uniti d''America','stato'),
  ('Z504','Cuba','stato'),
  ('Z601','Bolivia','stato'),
  ('Z602','Brasile','stato'),
  ('Z604','Colombia','stato'),
  ('Z605','Ecuador','stato'),
  ('Z611','Perù','stato')
on conflict (codice) do nothing;

-- la fotografia di prima: queste tre colonne sono vuote su tutte le
-- righe che il backfill tocca, ma l'elenco degli id serve per disfare
create table if not exists public._backup_nascita_20261020 as
select id, codice_fiscale, sesso, data_nascita, comune_nascita, stato_nascita, now() as fotografato_il
from public.iscritti where false;

with letti as (
  select i.id,
         upper(btrim(i.codice_fiscale)) as cf,
         position(substr(upper(btrim(i.codice_fiscale)),9,1) in 'ABCDEHLMPRST') as mese,
         substr(upper(btrim(i.codice_fiscale)),10,2)::int as gg,
         substr(upper(btrim(i.codice_fiscale)),7,2)::int as yy,
         substr(upper(btrim(i.codice_fiscale)),12,4) as luogo
    from public.iscritti i
   where coalesce(btrim(i.codice_fiscale),'') <> ''
     and upper(btrim(i.codice_fiscale)) ~ '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$'
     and public._cf_lettera(upper(btrim(i.codice_fiscale))) = substr(upper(btrim(i.codice_fiscale)),16,1)
),
calcolati as (
  select l.id, l.cf, l.luogo,
         case when l.gg > 40 then 'F' else 'M' end as sesso,
         case when l.yy <= 8 then 2000 + l.yy else 1900 + l.yy end as anno,
         l.mese,
         case when l.gg > 40 then l.gg - 40 else l.gg end as giorno,
         lu.nome as nome_luogo, lu.tipo as tipo_luogo
    from letti l
    join public._luoghi_catastali_20261020 lu on lu.codice = l.luogo
   where l.mese between 1 and 12
),
buoni as (
  select c.*, make_date(c.anno, c.mese, c.giorno) as nascita
    from calcolati c
   where c.giorno between 1
     and extract(day from (date_trunc('month', make_date(c.anno, c.mese, 1)) + interval '1 month - 1 day'))::int
),
daScrivere as (
  select b.* from buoni b
    join public.iscritti i on i.id = b.id
   where i.data_nascita is null
      or coalesce(btrim(i.sesso),'') = ''
      or (coalesce(btrim(i.comune_nascita),'') = '' and coalesce(btrim(i.stato_nascita),'') = '')
),
fotografia as (
  insert into public._backup_nascita_20261020 (id, codice_fiscale, sesso, data_nascita, comune_nascita, stato_nascita, fotografato_il)
  select i.id, i.codice_fiscale, i.sesso, i.data_nascita, i.comune_nascita, i.stato_nascita, now()
    from public.iscritti i where i.id in (select id from daScrivere)
  returning 1
)
update public.iscritti i set
  sesso          = coalesce(nullif(btrim(i.sesso),''), d.sesso),
  data_nascita   = coalesce(i.data_nascita, d.nascita),
  comune_nascita = case when d.tipo_luogo = 'comune'
                        then coalesce(nullif(btrim(i.comune_nascita),''), upper(d.nome_luogo))
                        else i.comune_nascita end,
  stato_nascita  = case when d.tipo_luogo = 'stato'
                        then coalesce(nullif(btrim(i.stato_nascita),''), d.nome_luogo)
                        else i.stato_nascita end
from daScrivere d where d.id = i.id;
