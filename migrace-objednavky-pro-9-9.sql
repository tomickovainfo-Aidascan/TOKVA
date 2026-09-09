-- Migrace: tabulka objednávek Tokva Pro (9.9.2026)
-- Spustit v Supabase SQL Editoru jako jeden skript.
--
-- Účel: formulář na /pro/ ukládá objednávku (fakturační údaje + kontakt),
-- appka rovnou založí přihlašovací účet (email/heslo), ale NEČEKÁ na
-- potvrzení e-mailu ani na založení firmy, aby formulář fungoval hned.
-- Objednávka jde do vlastní tabulky, nezávisle na organizaci - tu si
-- zákazník založí sám při prvním přihlášení (běžný krok "Založit firmu").
--
-- Gábina objednávky vidí a zpracovává ručně přes Supabase Table Editor
-- (jako vlastník projektu obchází RLS) - podle e-mailu spáruje objednávku
-- s firmou, vystaví fakturu, po přijetí platby nastaví u organizace
-- plan='pro' (a is_founding_member/founding_price_until, pokud patří
-- mezi prvních 10), a u objednávky přepne status na 'zaplaceno'.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  contact_name text not null,
  company_name text not null,
  ico text,
  dic text,
  billing_address text,
  phone text,
  note text,
  expected_price_kc numeric,
  status text not null default 'nova' check (status in ('nova','faktura_vystavena','zaplaceno','zrusena')),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Kdokoli (i nepřihlášený) smí založit objednávku - je to veřejný
-- objednávkový formulář, ne appka za přihlášením. Číst objednávky se
-- z appky nedá vůbec (žádná SELECT politika) - jen Gábina přes dashboard.
create policy "kdokoli muze zalozit objednavku" on public.orders
for insert with check (true);

-- Pomocná funkce pro /pro/ stránku: kolik firem už má zakladatelské
-- členství, aby appka mohla ukázat "zbývá X z 10 míst" bez toho,
-- aby veřejně vystavovala celou tabulku organizations.
create or replace function public.pocet_zakladajicich_clenu()
returns integer
language sql
security definer
stable
as $$
  select count(*)::integer from public.organizations where is_founding_member = true;
$$;
