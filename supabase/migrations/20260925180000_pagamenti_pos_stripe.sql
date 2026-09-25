-- Le richieste di pagamento del POS con carta, via Stripe.
--
-- Il giro: il banco chiede un pagamento, nasce una riga qui con un
-- codice corto, il codice diventa un QR, la cliente lo inquadra, paga e
-- compila i suoi dati di fatturazione sulla pagina di Stripe. Il webhook
-- di Stripe torna qui, segna l'incasso e fa partire la fattura.
--
-- Il codice e' corto apposta: l'indirizzo che finisce nel QR deve
-- restare breve, o il quadrato diventa fitto e la fotocamera di un
-- telefono in aula fa fatica. Sei caratteri di un alfabeto senza
-- lettere che si confondono (niente O/0, I/1) bastano per un miliardo
-- di richieste.
create table if not exists pagamenti_pos (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  scade_il timestamptz not null default now() + interval '2 hours',

  importo numeric not null check (importo > 0),
  descrizione text,
  righe jsonb not null default '[]'::jsonb,

  operatore_tipo text,
  operatore_id uuid,
  operatore_nome text,
  corso_data_id uuid references corsi_date(id) on delete set null,
  carrello_id uuid,

  stato text not null default 'in_attesa',
  stripe_session_id text unique,
  stripe_payment_intent text,
  pagato_il timestamptz,

  cliente jsonb,
  cliente_fattura_id uuid references clienti_fattura(id) on delete set null,
  vendita_id uuid references vendite_shop(id) on delete set null,

  fattura_fic_id bigint,
  fattura_numero text,
  fattura_emessa_il timestamptz,
  fattura_errore text
);

create index if not exists pagamenti_pos_stato on pagamenti_pos (stato, creato_il desc);

alter table pagamenti_pos enable row level security;
drop policy if exists pagamenti_pos_tutti on pagamenti_pos;
create policy pagamenti_pos_tutti on pagamenti_pos for all to anon, authenticated using (true) with check (true);
