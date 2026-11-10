-- Migrace: webhook secret pro pripomenuti-overeni pres Supabase Vault (10.11.2026)
--
-- Oprava zjištění z 10. 11. 2026: cron job tokva-pripomenuti-overeni měl v
-- příkazu natvrdo placeholder 'SEM_VLOZ_WEBHOOK_SECRET' místo skutečného
-- hesla, takže Edge Function volání vždy odmítla (401). Zároveň měla funkce
-- nastaveno verify_jwt: true, což volání zastavilo ještě dřív, než se vůbec
-- spustil kód uvnitř (ten je potřeba vypnout při nasazení funkce, ne touto
-- migrací - `supabase functions deploy pripomenuti-overeni --no-verify-jwt`).
--
-- Skutečné heslo (shodné s WEBHOOK_SECRET, co má funkce v Deno.env) je uložené
-- v Supabase Vault pod jménem 'tokva_webhook_secret' (vloženo ručně přímo v
-- databázi, ne touto migrací - at' není v gitu). Cron job si ho při každém
-- běhu vyzvedne dotazem do vault.decrypted_secrets, takže příkaz uložený v
-- cron.job.command žádné heslo neobsahuje.
--
-- Spusť celé najednou v Supabase SQL Editoru. Předpokládá, že secret
-- 'tokva_webhook_secret' už ve Vaultu existuje (select vault.create_secret(...)).

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
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tokva_webhook_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
