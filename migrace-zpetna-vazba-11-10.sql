-- Migrace: zpětná vazba k nástrojům (11.10.2026)
-- Spusť celé najednou v Supabase SQL Editoru. Jde pustit i opakovaně.
--
-- Formulář "Něco nefungovalo, nebo by šlo líp?" (soubor zpetna-vazba.js)
-- ukládá zprávy sem. Kdokoli (i nepřihlášený) smí zprávu jen ZAPSAT.
-- Číst je z webu nejde vůbec, žádná politika na SELECT. Gábina je vidí
-- v Supabase v Table Editoru (jako vlastník projektu obchází RLS).
--
-- Zprávy starší než 12 měsíců se každou noc samy smažou (pg_cron),
-- tak jak to slibují zásady ochrany osobních údajů.

create table if not exists public.zpetna_vazba (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nastroj text not null default 'neuvedeno' check (char_length(nastroj) <= 60),
  stranka text check (char_length(stranka) <= 200),
  zprava text not null check (char_length(zprava) between 3 and 4000),
  email text check (email is null or (char_length(email) <= 200 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  zarizeni text check (zarizeni in ('mobil','tablet','pocitac')),
  prohlizec text check (char_length(prohlizec) <= 300),
  vyreseno boolean not null default false,
  poznamka_gabina text
);

alter table public.zpetna_vazba enable row level security;

drop policy if exists "kdokoli muze poslat zpetnou vazbu" on public.zpetna_vazba;
create policy "kdokoli muze poslat zpetnou vazbu" on public.zpetna_vazba
for insert to anon, authenticated
with check (vyreseno = false and poznamka_gabina is null);

grant insert on public.zpetna_vazba to anon, authenticated;

-- Automatické mazání po 12 měsících, každý den ve 3:15.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'zpetna-vazba-mazani-12-mesicu') then
    perform cron.unschedule('zpetna-vazba-mazani-12-mesicu');
  end if;
end $$;

select cron.schedule(
  'zpetna-vazba-mazani-12-mesicu',
  '15 3 * * *',
  $$delete from public.zpetna_vazba where created_at < now() - interval '12 months'$$
);
