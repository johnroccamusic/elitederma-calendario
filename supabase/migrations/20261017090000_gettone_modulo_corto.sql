-- IL GETTONE DEL MODULO DIVENTA CORTO.
-- APPLICATA il 17/10/2026 via MCP.
--
-- Era 64 caratteri esadecimali — 256 bit. In una mail su un telefono
-- quel link andava a capo due volte e sembrava un errore.
--
-- 256 bit qui non servono. Quello che deve essere impossibile e'
-- indovinare il link di un'iscrizione, e 16 caratteri su un alfabeto di
-- 32 fanno 80 bit: un numero con 24 cifre di tentativi contro una
-- funzione che risponde una richiesta alla volta. Fuori discussione allo
-- stesso modo, e sta su una riga.
--
-- L'ALFABETO, senza le lettere che si confondono. Niente I, L, O, U: un
-- gettone finisce per essere letto al telefono o ricopiato a mano, e "l"
-- contro "1" o "O" contro "0" e' il modo di far sbagliare qualcuno.
--
-- I gettoni esistenti si rifanno tutti: ne era stato spedito uno solo,
-- per prova. Il controllo sulla lunghezza in modulo_vista e modulo_salva
-- scende da 32 a 12: lasciandolo a 32 avrebbero rifiutato ogni gettone
-- nuovo, e il link avrebbe detto "non valido".
--
-- Verificato: 259 iscritti, 259 gettoni distinti, tutti di 16 caratteri,
-- e modulo_vista accetta quelli nuovi. Link da 113 a 65 caratteri.

create or replace function public.gettone_modulo()
returns text
language plpgsql
volatile
as $function$
declare
  alfabeto constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';  -- senza I L O U
  fuori text := '';
  i int;
begin
  for i in 1..16 loop
    fuori := fuori || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
  end loop;
  return fuori;
end;
$function$;

alter table public.iscritti alter column token_modulo set default public.gettone_modulo();
update public.iscritti set token_modulo = public.gettone_modulo();

-- modulo_vista e modulo_salva sono state riscritte con `length(p_token) < 12`
-- al posto di `< 32`. Il resto del corpo e' invariato: vedi
-- 20261016170000 e 20261016190000.
