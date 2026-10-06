-- Migrace: oprávnění pro týmové kolo Kvízu komunikačního chaosu
-- Zapsáno 6.10.2026. Tabulky kviz_tym_kola a kviz_tym_odpovedi v databázi jsou,
-- ale přihlášený uživatel ani anonymní kolega k nim neměli udělený přístup.
-- Databáze vracela "permission denied for table kviz_tym_kola" i majiteli firmy,
-- takže záložka Tým v kvízu by naostro spadla hned při načtení.
--
-- Co skript dělá:
--   1) zapne RLS na obou tabulkách (pokud už zapnuté je, nic se nestane),
--   2) smaže stará pravidla na těchhle dvou tabulkách a založí je znovu načisto,
--   3) udělí přístup rolím authenticated (přihlášený) a anon (kolega přes odkaz).
--
-- Kdo co smí po spuštění:
--   - člen firmy: vidí, zakládá a zavírá týmová kola své firmy, vidí odpovědi z nich
--   - kolega přes odkaz (bez přihlášení): smí jen ODESLAT odpověď do otevřeného kola.
--     Nic nečte. Kolo si appka dohledává přes funkci najit_tym_kolo, ta už funguje.
--
-- Spusť celé najednou v Supabase SQL Editoru. Jde pustit i opakovaně.

-- Pomocná funkce: je tohle kolo ještě otevřené?
-- Security definer, protože anonymní kolega do tabulky kol sám nevidí.
create or replace function public.tym_kolo_je_otevrene(p_kolo_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.kviz_tym_kola
    where id::text = p_kolo_id and uzavreno = false
  );
$$;

revoke all on function public.tym_kolo_je_otevrene(text) from public;
grant execute on function public.tym_kolo_je_otevrene(text) to anon, authenticated;

alter table public.kviz_tym_kola enable row level security;
alter table public.kviz_tym_odpovedi enable row level security;

-- Úklid starých pravidel na těchhle dvou tabulkách, ať se nic nepere
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('kviz_tym_kola', 'kviz_tym_odpovedi')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- KVIZ_TYM_KOLA: stejný vzorec jako ostatní firemní tabulky
create policy "clenove pristup k tymovym kolum" on public.kviz_tym_kola
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- KVIZ_TYM_ODPOVEDI: člen firmy čte odpovědi z kol své firmy
create policy "clenove ctou odpovedi sve firmy" on public.kviz_tym_odpovedi
for select to authenticated
using (
  exists (
    select 1 from public.kviz_tym_kola k
    where k.id = kviz_tym_odpovedi.kolo_id
    and public.is_org_member(k.organization_id)
  )
);

-- KVIZ_TYM_ODPOVEDI: kdokoli s odkazem smí poslat odpověď, ale jen do otevřeného kola
create policy "odpoved jen do otevreneho kola" on public.kviz_tym_odpovedi
for insert to anon, authenticated
with check (public.tym_kolo_je_otevrene(kolo_id::text));

-- Oprávnění k tabulkám (tohle chybělo)
grant select, insert, update, delete on public.kviz_tym_kola to authenticated;
grant select on public.kviz_tym_odpovedi to authenticated;
grant insert on public.kviz_tym_odpovedi to anon, authenticated;

-- Kontrola: po spuštění mají vyjet 3 řádky (1 pravidlo na kola, 2 na odpovědi)
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('kviz_tym_kola', 'kviz_tym_odpovedi')
order by tablename, policyname;
