-- Migrace: appka na dotazníky pilotu (4.11.2026)
-- Zadání: Moje-AI/10-obchod/pilot/zadani-appka-dotazniky.md
-- Znění otázek: Moje-AI/10-obchod/pilot/dotazniky-pilot.md (verze 2)
--
-- Appka (/dotaznik/?k=<klíč>) nepřihlašuje uživatele, jen pozná firmu a
-- dotazník podle klíče v odkazu. Proto tabulky NEMAJÍ žádnou veřejnou
-- politiku na SELECT ani INSERT - zvenčí (anon klíč Supabase) na ně nejde
-- sáhnout přímo, ani přes RLS, ani přes grant. Appka smí jen zavolat čtyři
-- funkce níže (RPC), které klíč ověří a vrátí nebo zapíšou vždy jen ten
-- jeden řádek, co ke klíči patří. Cizí nebo upravený klíč nevrátí nic.
--
-- Znění otázek (text, pořadí, povinnost ★) je v appce v souboru
-- otazky.json, ne tady - aby šlo měnit bez zásahu do databáze.
--
-- Spusť celé najednou v Supabase SQL Editoru. Jde pustit i opakovaně.

create extension if not exists pgcrypto;

-- DOTAZNIKY_ODKAZY - jeden řádek = jeden odkaz pro jednu firmu a jeden
-- ze tří dotazníků. Klíč je 48 znaků náhodně (192 bitů), nejde uhodnout.
create table if not exists public.dotazniky_odkazy (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cislo_dotazniku int not null check (cislo_dotazniku in (1, 2, 3)),
  klic text not null unique default encode(gen_random_bytes(24), 'hex'),
  vytvoreno_at timestamptz not null default now(),
  odeslano_at timestamptz,
  dokonceno_at timestamptz,
  -- Souhlas s referencí (jen u dotazníku 3, otázka 9). Nikdy povinný.
  souhlas_s_referenci text check (souhlas_s_referenci in ('ano_s_nazvem', 'ano_bez_nazvu', 'ne')),
  souhlas_cas timestamptz
);

create index if not exists dotazniky_odkazy_org_cislo_idx
  on public.dotazniky_odkazy (organization_id, cislo_dotazniku);

alter table public.dotazniky_odkazy enable row level security;
-- Vědomě žádná policy a žádný grant pro anon/authenticated - přístup jen
-- přes RPC funkce níže (security definer, běží jako vlastník databáze).

-- DOTAZNIKY_ODPOVEDI - jedna odpověď na jednu otázku jednoho odkazu.
-- "otazka" je identifikátor otázky z otazky.json (např. "6"), ne text otázky.
create table if not exists public.dotazniky_odpovedi (
  id uuid primary key default gen_random_uuid(),
  odkaz_id uuid not null references public.dotazniky_odkazy(id) on delete cascade,
  otazka text not null check (char_length(otazka) <= 20),
  odpoved text not null check (char_length(odpoved) <= 4000),
  ulozeno_at timestamptz not null default now(),
  unique (odkaz_id, otazka)
);

alter table public.dotazniky_odpovedi enable row level security;
-- Stejně jako u odkazů: žádná veřejná policy, žádný přímý grant.

-- RPC: appka si podle klíče vyzvedne, který dotazník to je, co je už
-- vyplněné (pro návrat po zavření appky), a u dotazníku 3 i odhad z
-- otázky 6 dotazníku 1 té stejné firmy.
create or replace function public.dotaznik_ziskat(p_klic text)
returns json
language plpgsql
security definer
as $$
declare
  odkaz public.dotazniky_odkazy;
  odhad_d1 text;
  odpovedi json;
begin
  select * into odkaz from public.dotazniky_odkazy where klic = p_klic;
  if odkaz is null then
    raise exception 'Odkaz neexistuje.';
  end if;

  select json_object_agg(otazka, odpoved) into odpovedi
    from public.dotazniky_odpovedi where odkaz_id = odkaz.id;

  if odkaz.cislo_dotazniku = 3 then
    select o.odpoved into odhad_d1
      from public.dotazniky_odpovedi o
      join public.dotazniky_odkazy k on k.id = o.odkaz_id
      where k.organization_id = odkaz.organization_id
        and k.cislo_dotazniku = 1
        and o.otazka = '6'
      order by o.ulozeno_at desc
      limit 1;
  end if;

  return json_build_object(
    'cislo_dotazniku', odkaz.cislo_dotazniku,
    'dokonceno', (odkaz.dokonceno_at is not null),
    'odpovedi', coalesce(odpovedi, '{}'::json),
    'odhad_d1_otazka6', odhad_d1,
    'souhlas_s_referenci', odkaz.souhlas_s_referenci
  );
end;
$$;

revoke all on function public.dotaznik_ziskat(text) from public;
grant execute on function public.dotaznik_ziskat(text) to anon, authenticated;

-- RPC: uložení jedné odpovědi. Přepíše, když se na otázku vrátí (Předchozí
-- a doplnění). Odmítne psát do už dokončeného dotazníku.
create or replace function public.dotaznik_ulozit_odpoved(p_klic text, p_otazka text, p_odpoved text)
returns void
language plpgsql
security definer
as $$
declare
  odkaz public.dotazniky_odkazy;
begin
  select * into odkaz from public.dotazniky_odkazy where klic = p_klic;
  if odkaz is null then
    raise exception 'Odkaz neexistuje.';
  end if;
  if odkaz.dokonceno_at is not null then
    raise exception 'Dotazník je už dokončený.';
  end if;

  insert into public.dotazniky_odpovedi (odkaz_id, otazka, odpoved)
  values (odkaz.id, p_otazka, p_odpoved)
  on conflict (odkaz_id, otazka) do update
    set odpoved = excluded.odpoved, ulozeno_at = now();
end;
$$;

revoke all on function public.dotaznik_ulozit_odpoved(text, text, text) from public;
grant execute on function public.dotaznik_ulozit_odpoved(text, text, text) to anon, authenticated;

-- RPC: označení konce (poslední obrazovka s poděkováním).
create or replace function public.dotaznik_dokoncit(p_klic text)
returns void
language plpgsql
security definer
as $$
begin
  update public.dotazniky_odkazy
  set dokonceno_at = now()
  where klic = p_klic and dokonceno_at is null;

  if not found then
    raise exception 'Odkaz neexistuje nebo je už dokončený.';
  end if;
end;
$$;

revoke all on function public.dotaznik_dokoncit(text) from public;
grant execute on function public.dotaznik_dokoncit(text) to anon, authenticated;

-- RPC: souhlas s referencí (dotazník 3, otázka 9). Vlastní funkce, ne
-- obyčejná odpověď, protože se ukládá i čas a patří jen k dotazníku 3.
create or replace function public.dotaznik_ulozit_souhlas(p_klic text, p_souhlas text)
returns void
language plpgsql
security definer
as $$
declare
  odkaz public.dotazniky_odkazy;
begin
  if p_souhlas not in ('ano_s_nazvem', 'ano_bez_nazvu', 'ne') then
    raise exception 'Neplatná hodnota souhlasu.';
  end if;

  select * into odkaz from public.dotazniky_odkazy where klic = p_klic;
  if odkaz is null then
    raise exception 'Odkaz neexistuje.';
  end if;
  if odkaz.cislo_dotazniku <> 3 then
    raise exception 'Souhlas s referencí patří jen k dotazníku 3.';
  end if;

  update public.dotazniky_odkazy
  set souhlas_s_referenci = p_souhlas, souhlas_cas = now()
  where id = odkaz.id;
end;
$$;

revoke all on function public.dotaznik_ulozit_souhlas(text, text) from public;
grant execute on function public.dotaznik_ulozit_souhlas(text, text) to anon, authenticated;

-- Jak Gábina zatím ručně vytvoří odkaz pro firmu (dokud appka nemá admin
-- stránku na odkazy - krok 5 plánu):
--
-- insert into public.dotazniky_odkazy (organization_id, cislo_dotazniku)
-- values ('<uuid firmy z organizations>', 1)
-- returning klic;
--
-- Odkaz pro firmu: https://tokva.cz/dotaznik/?k=<klic z výsledku>
