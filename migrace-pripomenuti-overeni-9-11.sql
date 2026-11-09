-- Migrace: připomínka ověření e-mailem (9.11.2026)
-- Navazuje na _navrhy/overeni-vysledku-v-nastrojich.md, bod E a na
-- navrhy-agentu/2026-11-08.md ("Hotové zadání pro Claude Code"). Když se
-- úkol v Akčním plánu přepne na Hotovo, appka (akcni-plan/index.html) si
-- rovnou vyžádá termín ověření a úkol rovnou uloží se stavem
-- overit_vysledek. V ten den ráno pošle Edge Function pripomenuti-overeni
-- majiteli firmy e-mail: co se změnilo a kterým nástrojem to změřit znovu,
-- s odkazem rovnou do nástroje.
--
-- Spusť celé najednou v Supabase SQL Editoru.

-- Pojistka proti dvojímu odeslání (stejný princip jako u sloupce
-- upozorneni_mazani_at v migrace-prodlouzeni-a-hlidani-14-10.sql). Appka
-- (akcni-plan/index.html) ho vynuluje, kdykoli se verification_date
-- změní, ať e-mail na nový termín dorazí znovu.
alter table public.actions
  add column if not exists verification_reminder_sent_at timestamptz;

comment on column public.actions.verification_reminder_sent_at is
  'Kdy odešel e-mail s připomínkou ověření (Edge Function pripomenuti-overeni). NULL = ještě neodešel. Appka ho vynuluje, když se verification_date změní.';

-- Denní spuštění (8:15 UTC, stejný čas jako tokva-hlidani-plateb-a-dat).
select cron.unschedule('tokva-pripomenuti-overeni')
where exists (select 1 from cron.job where jobname = 'tokva-pripomenuti-overeni');

select cron.schedule(
  'tokva-pripomenuti-overeni',
  '15 8 * * *',
  $$
  select net.http_post(
    url := 'https://uiqjzeubhhnzspkoekxx.supabase.co/functions/v1/pripomenuti-overeni',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'SEM_VLOZ_WEBHOOK_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
