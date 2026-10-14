-- Migrace: pilot zdarma do data, cena nastavená rovnou při aktivaci (14.10.2026)
-- Spusť v Supabase SQL Editoru.
--
-- Nový sloupec organizations.zdarma_do = do kdy má firma Pro zdarma (pilot).
-- Dokud konec Pro (plan_expires_at) nepřesáhne zdarma_do, nepřipraví se
-- faktura ani e-mail o faktuře. Cenu (mesicni_cena_kc) tak můžeš vyplnit
-- rovnou při aktivaci pilotu a po pilotu se první prodloužení vyfakturuje
-- samo podle ní.
--
-- Postup při aktivaci pilotu: NEJDŘÍV zdarma_do (konec pilotu), potom
-- plan = pro, plan_expires_at = stejné datum, mesicni_cena_kc = cena po pilotu.
-- Nejbezpečnější je upravit všechno najednou přes "Edit row" (jedno uložení).
--
-- PŘED SPUŠTĚNÍM nahraď SEM_VLOZ_WEBHOOK_SECRET stejným klíčem jako minule.

alter table public.organizations add column if not exists zdarma_do date;

create or replace function public.trigger_vystaveni_faktury()
returns trigger
language plpgsql
as $$
begin
  if new.plan = 'pro'
     and coalesce(new.mesicni_cena_kc, 0) > 0
     and (new.zdarma_do is null or new.plan_expires_at > new.zdarma_do)
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

-- Potvrzení pokračování: splatnost faktury jen když se opravdu fakturuje
-- (cena > 0 a nové období už není zdarma).
create or replace function public.potvrdit_pokracovani(p_org_id uuid)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novy_konec date;
  v_konec date;
begin
  select (greatest(coalesce(plan_expires_at, current_date), current_date) + interval '1 month')::date
    into v_konec
    from public.organizations where id = p_org_id;

  -- Jeden zápis, ať upozornění pro Gábinu (trigger) vidí rovnou i splatnost.
  update public.organizations
  set pokracovani_potvrzeno_at = now(),
      plan_expires_at = v_konec,
      faktura_splatnost = case
        when coalesce(mesicni_cena_kc, 0) > 0 and (zdarma_do is null or v_konec > zdarma_do)
        then current_date + 14 else null end
  where id = p_org_id
    and plan = 'pro'
    and (plan_expires_at is null or plan_expires_at <= current_date + 10)
    and (pokracovani_potvrzeno_at is null or pokracovani_potvrzeno_at < now() - interval '20 days')
  returning plan_expires_at into v_novy_konec;

  return v_novy_konec;
end;
$$;

grant execute on function public.potvrdit_pokracovani(uuid) to anon, authenticated;
