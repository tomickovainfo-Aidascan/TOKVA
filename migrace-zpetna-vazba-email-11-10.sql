-- Migrace: e-mail Gábině po každé nové zpětné vazbě (11.10.2026)
-- Spusť celé najednou v Supabase SQL Editoru, až po migrace-zpetna-vazba-11-10.sql.
-- Jde pustit i opakovaně.
--
-- Stejné zapojení jako u objednávek (trigger_potvrzeni_objednavky): po vložení
-- řádku do zpetna_vazba databáze sama zavolá Edge Function feedback-notification.
-- Tajný klíč (x-webhook-secret) si skript vezme z funkce u objednávek,
-- nikde se nemusí opisovat.

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
    create or replace function public.trigger_zpetna_vazba_email()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    begin
      perform net.http_post(
        url := 'https://uiqjzeubhhnzspkoekxx.supabase.co/functions/v1/feedback-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', %L),
        body := jsonb_build_object('record', to_jsonb(new))
      );
      return new;
    end;
    $body$;
  $f$, klic);
end $$;

-- Funkci smí spustit jen databáze přes spouštěč, ne nikdo zvenku.
revoke all on function public.trigger_zpetna_vazba_email() from public, anon, authenticated;

drop trigger if exists zpetna_vazba_email on public.zpetna_vazba;
create trigger zpetna_vazba_email
after insert on public.zpetna_vazba
for each row execute function public.trigger_zpetna_vazba_email();

-- Kontrola: má vypsat jeden řádek se spouštěčem zpetna_vazba_email.
select tgname as spoustec, tgrelid::regclass as tabulka
from pg_trigger where tgname = 'zpetna_vazba_email';
