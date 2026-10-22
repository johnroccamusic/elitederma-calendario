-- DUE COSE, CHIESTE IL 22/10/2026.
--
-- 1) RIAPRIRE UN MODULO GIA' ARRIVATO.
--
-- La serratura e' `modulo_ricevuto_il`: appena il modulo torna, il link
-- non si apre piu'. E' nata il 19/10/2026 per un motivo vero — chi
-- riapriva la mail poteva rifirmare, e la seconda spedizione
-- SOVRASCRIVEVA `firma_path`, `doc_fronte` e `doc_retro` lasciando
-- `contratto_firmato` e `modulo_ricevuto_il` della prima: il PDF
-- archiviato mostrava una firma e nel secchio ce n'era un'altra.
--
-- Ma capita che manchi qualcosa e il modulo vada rifatto, e fino a oggi
-- non c'era modo: era scritto in CLAUDE.md come cosa da aggiungere, «un
-- gesto apposta, deliberato».
--
-- Questo e' quel gesto. Prima di togliere la serratura mette da parte
-- TUTTO quello che c'era — firma, documenti, testo del contratto
-- firmato, PDF, data di arrivo — in `moduli_riaperture`. Il guasto del
-- 19/10 non puo' tornare: la prima consegna non viene sovrascritta, viene
-- archiviata, e resta scritto chi ha riaperto e perche'.
--
-- 2) SENZA FIRMA NON SI SPEDISCE.
--
-- La pagina del modulo gia' tiene spento il tasto finche' non si firma
-- (`if (!firma) mancanti.push("La firma")`), ma `modulo_salva` NON
-- controllava niente: `firma_path = coalesce(p_firma, firma_path)`
-- accettava un modulo senza firma, segnava `modulo_ricevuto_il`,
-- cambiava stato e faceva partire la conferma con il PDF allegato — un
-- contratto senza sottoscrizione. Un controllo che vive solo nel
-- browser non e' un controllo: e' un suggerimento.

create table if not exists moduli_riaperture (
  id uuid primary key default gen_random_uuid(),
  iscritto_id uuid not null references iscritti(id) on delete cascade,
  riaperto_il timestamptz not null default now(),
  riaperto_da text,
  motivo text,
  -- la fotografia di quello che c'era: non si cancella niente, si mette
  -- da parte. I file restano nel secchio ai percorsi qui sotto.
  firma_path text,
  doc_fronte text,
  doc_retro text,
  contratto_firmato jsonb,
  modulo_pdf_path text,
  modulo_ricevuto_il timestamptz,
  stato_prima text
);

create index if not exists moduli_riaperture_iscritto
  on moduli_riaperture (iscritto_id, riaperto_il desc);

alter table moduli_riaperture enable row level security;

drop policy if exists moduli_riaperture_staff on moduli_riaperture;
create policy moduli_riaperture_staff on moduli_riaperture
  for all to authenticated using (true) with check (true);

comment on table moduli_riaperture is
  'Ogni volta che un modulo gia'' arrivato viene riaperto: chi, quando, perche'', e la fotografia di quello che c''era prima. La prima consegna non si sovrascrive mai.';


-- Riapre il modulo. Una scrittura sola, perche' la fotografia e lo
-- sblocco devono vivere o morire insieme: una riapertura a meta'
-- lascerebbe il link aperto senza che resti traccia di cosa c'era.
create or replace function public.modulo_riapri(
  p_iscritto_id uuid,
  p_motivo text default null,
  p_chi text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  i public.iscritti%rowtype;
begin
  select * into i from public.iscritti where id = p_iscritto_id;
  if not found then
    return jsonb_build_object('ok', false, 'errore', 'Iscrizione non trovata.');
  end if;
  if i.modulo_ricevuto_il is null then
    return jsonb_build_object('ok', false,
      'errore', 'Questo modulo non è ancora arrivato: il link è già aperto.');
  end if;

  insert into moduli_riaperture (
    iscritto_id, riaperto_da, motivo,
    firma_path, doc_fronte, doc_retro, contratto_firmato,
    modulo_pdf_path, modulo_ricevuto_il, stato_prima
  ) values (
    i.id, nullif(btrim(coalesce(p_chi, '')), ''), nullif(btrim(coalesce(p_motivo, '')), ''),
    i.firma_path, i.doc_fronte, i.doc_retro, i.contratto_firmato,
    i.modulo_pdf_path, i.modulo_ricevuto_il, i.stato
  );

  -- `contratto_firmato` torna vuoto APPOSTA: quello che l'allieva
  -- sottoscrive la seconda volta e' il testo che ha davanti adesso, non
  -- quello di un mese fa. Il vecchio e' nella fotografia qui sopra.
  --
  -- Lo stato torna a "modulo_inviato": la mail e' gia' partita e il link
  -- adesso si riapre. Se l'acconto e' pagato, `modulo_salva` rimettera'
  -- "confermato" da solo quando il modulo ritorna.
  update public.iscritti set
    modulo_ricevuto_il = null,
    modulo_ricevuto_da = null,
    contratto_firmato = null,
    modulo_pdf_path = null,
    modulo_pdf_generato_il = null,
    stato = 'modulo_inviato'
  where id = i.id;

  return jsonb_build_object('ok', true, 'riaperto_il', now());
end;
$$;

revoke all on function public.modulo_riapri(uuid, text, text) from public, anon;
grant execute on function public.modulo_riapri(uuid, text, text) to authenticated;

comment on function public.modulo_riapri(uuid, text, text) is
  'Riapre un modulo gia'' arrivato, dopo averne archiviato la consegna in moduli_riaperture. Solo per chi ha una sessione: ad anon e'' revocata.';
