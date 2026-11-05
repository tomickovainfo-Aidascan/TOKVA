-- Migrace: přihlášky do pilotu (4.11.2026)
-- Spusť celé najednou v Supabase SQL Editoru. Jde pustit i opakovaně.
--
-- Tlačítko „Chci se přihlásit“ na stránce pilotu (soubor pilot-prihlaska.js)
-- ukládá přihlášky sem. Stejný princip jako u zpětné vazby (zpetna_vazba):
-- web smí jen ZAPISOVAT, číst z webu nejde vůbec (žádná politika na SELECT).
-- Gábina přihlášky vidí v Supabase v Table Editoru.
--
-- Dva způsoby zápisu:
--  - nepřihlášený návštěvník (anon): e-mail a firma povinně, telefon, co ho
--    pálí a souhlas s tipy a novinkami nepovinně,
--    user_id a organization_id musí zůstat prázdné,
--  - přihlášený uživatel Tokvy (authenticated): jeden klik, user_id musí být
--    jeho vlastní a firma jen taková, ve které je členem. Jeden účet = jedna
--    přihláška (druhý klik vrátí chybu 23505 a appka napíše „už máte odeslanou“).
--
-- DOBA UCHOVÁNÍ: zatím 12 měsíců jako u zpětné vazby (mazání níž přes pg_cron).
-- Gábina ji ještě musí potvrdit a stejnou dobu napsat do zásad ochrany
-- osobních údajů. Když se rozhodne jinak, stačí změnit interval dole.

create table if not exists public.pilot_prihlasky (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  varianta text not null default 'a' check (varianta in ('a','b','c')),
  email text not null check (char_length(email) <= 200 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  telefon text check (telefon is null or (char_length(telefon) <= 30 and telefon ~ '^[+0-9\s()/-]+$')),
  -- Souhlas se zasíláním tipů a novinek (samostatné nezaškrtnuté políčko).
  souhlas_novinky boolean not null default false,
  firma text not null check (char_length(firma) between 2 and 200),
  co_pali text check (co_pali is null or char_length(co_pali) <= 2000),
  diktovano boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  stranka text check (stranka is null or char_length(stranka) <= 200),
  zarizeni text check (zarizeni is null or zarizeni in ('mobil','tablet','pocitac')),
  prohlizec text check (prohlizec is null or char_length(prohlizec) <= 300),
  -- Pro Gábinu: stav výběru a vlastní poznámka. Web je vyplnit nesmí.
  stav text not null default 'nova' check (stav in ('nova','domluvena_schuzka','vybrana','nevybrana')),
  poznamka_gabina text
);

-- Jeden účet Tokvy = jedna přihláška.
create unique index if not exists pilot_prihlasky_jeden_ucet
  on public.pilot_prihlasky (user_id) where user_id is not null;

alter table public.pilot_prihlasky enable row level security;

drop policy if exists "kdokoli muze poslat prihlasku do pilotu" on public.pilot_prihlasky;
create policy "kdokoli muze poslat prihlasku do pilotu" on public.pilot_prihlasky
for insert to anon, authenticated
with check (
  stav = 'nova'
  and poznamka_gabina is null
  and (
    (user_id is null and organization_id is null)
    or (
      user_id = auth.uid()
      and (organization_id is null or public.is_org_member(organization_id))
    )
  )
);

grant insert on public.pilot_prihlasky to anon, authenticated;

-- Automatické mazání po 12 měsících, každý den ve 3:25.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pilot-prihlasky-mazani-12-mesicu') then
    perform cron.unschedule('pilot-prihlasky-mazani-12-mesicu');
  end if;
end $$;

select cron.schedule(
  'pilot-prihlasky-mazani-12-mesicu',
  '25 3 * * *',
  $$delete from public.pilot_prihlasky where created_at < now() - interval '12 months'$$
);

-- E-maily po každé nové přihlášce: Gábině oznámení, zájemci potvrzení,
-- a kontakt do Breva (se souhlasem s novinkami jen když ho zaškrtl).
-- Stejné zapojení jako u zpětné vazby: po vložení řádku databáze sama zavolá
-- Edge Function pilot-signup-notification. Tajný klíč (x-webhook-secret) si
-- skript vezme z funkce u objednávek, nikde se nemusí opisovat.
-- Před spuštěním musí být funkce pilot-signup-notification nasazená.

do $$
declare
  zdroj text;
  klic text;
begin
  select prosrc into zdroj from pg_proc where proname = 'trigger_potvrzeni_objednavky' limit 1;
  if zdroj is null then
    raise exception 'Nenašla jsem funkci trigger_potvrzeni_objednavky, napiš Claudovi.';
  end if;

  klic := (regexp_match(zdroj, 'x-webhook-secret[''"]\s*[,:]\s*[''"]([^''"]+)[''"]'))[1];
  if klic is null then
    raise exception 'Ve funkci u objednávek jsem nenašla x-webhook-secret, napiš Claudovi.';
  end if;

  execute format($f$
    create or replace function public.trigger_pilot_prihlaska_email()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    begin
      perform net.http_post(
        url := 'https://uiqjzeubhhnzspkoekxx.supabase.co/functions/v1/pilot-signup-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', %L),
        body := jsonb_build_object('record', to_jsonb(new))
      );
      return new;
    end;
    $body$;
  $f$, klic);
end $$;

-- Funkci smí spustit jen databáze přes spouštěč, ne nikdo zvenku.
revoke all on function public.trigger_pilot_prihlaska_email() from public, anon, authenticated;

drop trigger if exists pilot_prihlaska_email on public.pilot_prihlasky;
create trigger pilot_prihlaska_email
after insert on public.pilot_prihlasky
for each row execute function public.trigger_pilot_prihlaska_email();

-- Kontrola: má vypsat jeden řádek se spouštěčem pilot_prihlaska_email.
select tgname as spoustec, tgrelid::regclass as tabulka
from pg_trigger where tgname = 'pilot_prihlaska_email';
