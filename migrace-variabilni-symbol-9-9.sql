-- Migrace: variabilní symbol pro objednávky (9.9.2026)
-- Spustit v Supabase SQL Editoru jako jeden skript.
--
-- Účel: každá objednávka teď dostane vlastní číselný variabilní symbol,
-- podle kterého poznáš platbu na účtu. Zápis objednávky i vygenerování
-- symbolu se od teď dělá přes jednu funkci (vytvorit_objednavku), aby
-- appka na /pro/ mohla symbol rovnou ukázat zákazníkovi po odeslání
-- formuláře. Přímý zápis do orders z appky už proto není potřeba a
-- pro jistotu ho rušíme (RLS politika z minula může zůstat, jen se
-- nepoužije).

create sequence public.orders_vs_seq start with 900001 increment by 1;

alter table public.orders add column variabilni_symbol bigint;

create or replace function public.vytvorit_objednavku(
  p_email text,
  p_contact_name text,
  p_company_name text,
  p_ico text,
  p_dic text,
  p_billing_address text,
  p_phone text,
  p_note text,
  p_expected_price_kc numeric
) returns bigint
language plpgsql
security definer
as $$
declare
  v_vs bigint;
begin
  v_vs := nextval('public.orders_vs_seq');
  insert into public.orders(
    email, contact_name, company_name, ico, dic, billing_address, phone, note,
    expected_price_kc, variabilni_symbol
  ) values (
    p_email, p_contact_name, p_company_name, p_ico, p_dic, p_billing_address, p_phone, p_note,
    p_expected_price_kc, v_vs
  );
  return v_vs;
end;
$$;

grant execute on function public.vytvorit_objednavku(text,text,text,text,text,text,text,text,numeric) to anon, authenticated;

-- Appka teď zapisuje objednávky výhradně přes funkci výš (běží s vyššími
-- právy sama o sobě), takže přímý INSERT z veřejnosti už nepotřebujeme.
revoke insert on public.orders from anon, authenticated;
