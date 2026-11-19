-- I PREZZI DEI CORSI A TUTTI I VENDITORI, E IL POS A CHI STA AL BANCO
-- (7/11/2026)
--
-- Il titolare: «Olga non vede più i prezzi dei corsi. I venditori tutti
-- le devono vedere».
--
-- MISURATO PRIMA DI TOCCARE, e sono venute fuori due cose diverse.
--
-- 1. `prezzicorsi` ce l'avevano 18 venditori su 21. I tre senza —
--    ALICE SALVITTO, ANGELICA BURELLI, TOMMASO GIUMBINI — hanno una
--    casella sola in tutto, quindi non e' che gliel'ha tolta qualcuno:
--    non l'hanno mai avuta. Adesso ce l'hanno tutti, come chiesto.
--
--    OLGA PERO' CE L'AVEVA GIA'. Se sul suo telefono non la vede, non e'
--    il permesso: i permessi si leggono UNA VOLTA, all'accesso, e
--    restano scritti nella sessione del browser
--    (`sessionStorage.edc_utente`). Se la casella le e' stata data dopo
--    che lei era entrata, la sua Home resta quella di prima finche' non
--    esce e rientra. E' un difetto vero — non di dati — ed e' scritto in
--    CLAUDE.md: va risolto facendo rileggere i permessi all'avvio, che
--    e' un intervento sul giro dell'accesso e si fa deliberatamente, non
--    con la fiera aperta.
--
-- 2. `pos` NON c'era sulle righe venditore di chi sta al banco:
--    ANDREA, ELENA, OLGA, STEFANO. Le quattro master del banco (Chiara,
--    Elia, Stella, Valentina) ce l'hanno; i quattro venditori no.
--
--    Perche' finora non si e' visto: entrando con la password venditore
--    si eredita anche i permessi della master collegata, e ANDREA la ha
--    (ANDREA PAURA). ELENA e STEFANO hanno un'utenza d'ufficio da cui
--    entrano. **OLGA non ha nessun'altra identita'**: con la sua
--    password, la tessera POS non c'e'. Cioe' la persona per cui ieri si
--    e' scritta la preselezione del banco non puo' aprire il banco.
--
--    Si accende sulle quattro righe venditore del banco, ricavate dal
--    team della fiera e non da una lista di nomi: la tessera segue la
--    password che si batte, ed e' la lezione di ieri (ANDREA e' nel team
--    come venditore ed entra come master; ELIA CITO il contrario).
--
-- Tutto additivo e idempotente: niente viene tolto a nessuno.

-- 1) i prezzi dei corsi a tutti i venditori
update public.venditori
   set permessi = coalesce(permessi, '[]'::jsonb) || '["prezzicorsi"]'::jsonb
 where not coalesce(permessi, '[]'::jsonb) ? 'prezzicorsi';

-- 2) il POS alle righe venditore di chi vende al banco della fiera
with al_banco as (
  select t.persona_id as venditore_id
    from public.eventi_team t
    join public.eventi e on e.id = t.evento_id
   where t.vende_al_banco is true
     and e.pos_banco_fino_al is not null
     and t.persona_tipo = 'venditore'
     and t.persona_id is not null
)
update public.venditori v
   set permessi = coalesce(v.permessi, '[]'::jsonb) || '["pos"]'::jsonb
 where v.id in (select venditore_id from al_banco)
   and not coalesce(v.permessi, '[]'::jsonb) ? 'pos';

-- ROLLBACK (nomina le righe toccate, non tutte)
-- update public.venditori set permessi = permessi - 'prezzicorsi'
--  where nome in ('ALICE SALVITTO','ANGELICA BURELLI','TOMMASO GIUMBINI');
-- update public.venditori set permessi = permessi - 'pos'
--  where nome in ('ANDREA','ELENA','OLGA','STEFANO');
