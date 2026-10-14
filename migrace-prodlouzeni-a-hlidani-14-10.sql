-- Migrace: prodloužení Pro hned po potvrzení + hlídání plateb a mazání dat (14.10.2026)
-- Spusť v Supabase SQL Editoru jako jeden skript, AŽ POTÉ, co nasadíš
-- Edge Function "hlidani-plateb-a-dat".
--
-- Co se mění:
-- 1) Klik "Chci pokračovat" (stránka pokracovani.html) teď rovnou prodlouží
--    Tokva Pro o měsíc. Tím se změní plan_expires_at a stávající trigger
--    trg_vystaveni_faktury sám připraví koncept faktury v iDokladu
--    (splatnost 14 dní). Zároveň se zapíše faktura_splatnost.
-- 2) Když přijde platba, NEPOSOUVÁŠ už plan_expires_at (to by připravilo
--    druhou fakturu). Jen v Table Editoru u firmy smažeš faktura_splatnost
--    (nastavíš na NULL) = zaplaceno.
-- 3) Jednou denně funkce hlidani-plateb-a-dat:
--    - pošle tobě souhrn: nezaplacené faktury po splatnosti a firmy,
--      kterým uplynulo 12 měsíců od konce Pro (data ke smazání);
--    - majiteli firmy pošle jednou upozornění 11 měsíců po konci Pro,
--      že se data za 30 dní smažou.
-- 4) Pilot: když firmě nastavíš mesicni_cena_kc = 0, koncept faktury se
--    nepřipraví (ani při zapnutí pilotu, ani při prodloužení).
--
-- PŘED SPUŠTĚNÍM: na dvou místech níž nahraď SEM_VLOZ_WEBHOOK_SECRET stejným
-- tajným klíčem, jaký je v souboru migrace-brevo-cron-9-9.sql (hodnota
-- 'x-webhook-secret'). V repozitáři je schválně jen zástupný text, protože
-- repozitář je veřejný.

-- Nové sloupce
alter table public.organizations add column if not exists faktura_splatnost date;
alter table public.organizations add column if not exists upozorneni_mazani_at timestamptz;

-- 1) Potvrzení pokračování = rovnou prodloužení o měsíc.
-- Pojistky: jen firma s plan='pro', jen v posledních 10 dnech před koncem
-- (nebo po něm) a jen jednou za období (dvojklik ani opakované otevření
-- odkazu Pro neprodlouží dvakrát). Vrací nové datum konce, nebo NULL,
-- když se nic neprodloužilo (stránka pak ukáže, že už je potvrzeno).
drop function if exists public.potvrdit_pokracovani(uuid);
create or replace function public.potvrdit_pokracovani(p_org_id uuid)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novy_konec date;
begin
  update public.organizations
  set pokracovani_potvrzeno_at = now(),
      plan_expires_at = (greatest(coalesce(plan_expires_at, current_date), current_date) + interval '1 month')::date,
      faktura_splatnost = case when coalesce(mesicni_cena_kc, 0) > 0 then current_date + 14 else null end
  where id = p_org_id
    and plan = 'pro'
    and (plan_expires_at is null or plan_expires_at <= current_date + 10)
    and (pokracovani_potvrzeno_at is null or pokracovani_potvrzeno_at < now() - interval '20 days')
  returning plan_expires_at into v_novy_konec;

  return v_novy_konec;
end;
$$;

grant execute on function public.potvrdit_pokracovani(uuid) to anon, authenticated;

-- Pro stránku pokracovani.html: když už je potvrzeno, ukáže, do kdy Pro platí.
create or replace function public.konec_pro_verejne(p_org_id uuid)
returns date
language sql
security definer
stable
set search_path = public
as $$
  select plan_expires_at from public.organizations where id = p_org_id;
$$;

grant execute on function public.konec_pro_verejne(uuid) to anon, authenticated;

-- 4) Koncept faktury jen u firem s nenulovou cenou (pilot = 0 Kč).
create or replace function public.trigger_vystaveni_faktury()
returns trigger
language plpgsql
as $$
begin
  if new.plan = 'pro'
     and coalesce(new.mesicni_cena_kc, 0) > 0
     and (old.plan_expires_at is distinct from new.plan_expires_at) then
    perform net.http_post(
      url := 'https://uiqjzeubhhnzspkoekxx.supabase.co/functions/v1/create-invoice',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', 'SEM_VLOZ_WEBHOOK_SECRET'
      ),
      body := jsonb_build_object('record', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

-- 3) Denní hlídání (8:15 UTC, tedy dopoledne náš čas).
select cron.unschedule('tokva-hlidani-plateb-a-dat')
where exists (select 1 from cron.job where jobname = 'tokva-hlidani-plateb-a-dat');

select cron.schedule(
  'tokva-hlidani-plateb-a-dat',
  '15 8 * * *',
  $$
  select net.http_post(
    url := 'https://uiqjzeubhhnzspkoekxx.supabase.co/functions/v1/hlidani-plateb-a-dat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'SEM_VLOZ_WEBHOOK_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
