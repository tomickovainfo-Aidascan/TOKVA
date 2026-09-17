-- Migrace: explicitní pásmo/strop počtu lidí na firmu (17.9.2026)
-- Navazuje na migrace-clenove-pozvanky-16-9.sql. Dřív appka jen počítala
-- pásmo z aktuálního počtu lidí a při překročení se jen zeptala (confirm
-- dialog) - žádný skutečný strop nikde nebyl, nic nebránilo pozvat
-- víc lidí, než firma platí. Gábina chce mít pásmo zadané explicitně
-- a tvrdý strop na maximu.
--
-- Spusť celé najednou v Supabase SQL Editoru.

-- Nový sloupec: kolik lidí smí mít firma v Tokva Pro najednou (aktivní
-- členové + čekající pozvánky dohromady). Gábina ho nastavuje ručně podle
-- zaplaceného pásma - 1 / 5 / 15, u 16+ podle individuální dohody.
alter table public.organizations
  add column if not exists max_uzivatelu integer not null default 1;

comment on column public.organizations.max_uzivatelu is
  'Ruční pole. Varianty podle pásma: 1 / 5 (pásmo 2-5) / 15 (pásmo 6-15) / vlastní číslo u 16+. Strop počtu lidí (členové + čekající pozvánky) v Tokva Pro.';

-- Popisky i u zbylých polí, co se v týhle tabulce vyplňují ručně - ať jsou
-- vidět rovnou v Table Editoru (ikonka ⓘ vedle názvu sloupce), ne jen v
-- dokumentaci.
comment on column public.organizations.plan is
  'Ruční pole. Varianty: free / pro. Přepíná Gábina na pro, jakmile potvrdí přijatou platbu.';
comment on column public.organizations.plan_expires_at is
  'Ruční pole: datum konce předplatného Tokva Pro. Nastavuje Gábina spolu s plan.';
comment on column public.organizations.mesicni_cena_kc is
  'Ruční pole. Varianty podle pásma: 699 (1 uživatel, 499 u prvních 10 zakladatelských klientů) / 1390 (2-5) / 2690 (6-15) / individuálně u 16+.';

-- Pojistka na úrovni databáze: pozvánka nad strop se vůbec nezaloží,
-- appka jen zobrazí hlášku z chyby.
create or replace function public.zkontrolovat_limit_pozvanky()
returns trigger
language plpgsql
security definer
as $$
declare
  v_max integer;
  v_pocet integer;
begin
  select max_uzivatelu into v_max from public.organizations where id = new.organization_id;

  select
    (select count(*) from public.organization_members where organization_id = new.organization_id)
    +
    (select count(*) from public.organization_invites where organization_id = new.organization_id and status = 'cekajici')
  into v_pocet;

  if v_max is not null and v_pocet >= v_max then
    raise exception 'Firma dosáhla svého limitu % lidí v Tokva Pro. Pro víc lidí se prosím ozvěte na tomickova.info@gmail.com.', v_max;
  end if;

  return new;
end;
$$;

create trigger before_organization_invites_limit
before insert on public.organization_invites
for each row execute function public.zkontrolovat_limit_pozvanky();

-- Stejná pojistka i uvnitř přijetí pozvánky - kdyby mezi odesláním
-- a přijetím pozvánky limit klesl (např. dvě pozvánky se přijaly rychle
-- po sobě a mezitím se počet lidí navýšil), appka to zachytí i tady.
create or replace function public.prijmout_pozvanku(p_token text)
returns public.organizations
language plpgsql
security definer
as $$
declare
  inv public.organization_invites;
  org public.organizations;
  moje_email text;
  v_max integer;
  v_pocet integer;
begin
  if auth.uid() is null then
    raise exception 'Nejste přihlášeni.';
  end if;

  select * into inv from public.organization_invites where token = p_token;
  if inv is null then
    raise exception 'Pozvánka neexistuje nebo je neplatná.';
  end if;
  if inv.status <> 'cekajici' then
    raise exception 'Pozvánka už byla použitá nebo zrušená.';
  end if;
  if inv.expires_at < now() then
    raise exception 'Pozvánce vypršela platnost - požádejte o novou.';
  end if;

  select email into moje_email from public.profiles where id = auth.uid();
  if moje_email is null or lower(moje_email) <> lower(inv.email) then
    raise exception 'Pozvánka je na e-mail %, přihlaste se prosím tímhle účtem.', inv.email;
  end if;

  if exists (select 1 from public.organization_members where user_id = auth.uid()) then
    raise exception 'Tenhle účet už patří k jiné firmě.';
  end if;

  select max_uzivatelu into v_max from public.organizations where id = inv.organization_id;
  select count(*) into v_pocet from public.organization_members where organization_id = inv.organization_id;
  if v_max is not null and v_pocet >= v_max then
    raise exception 'Firma mezitím dosáhla svého limitu % lidí. Ozvěte se prosím majiteli firmy.', v_max;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (inv.organization_id, auth.uid(), inv.role);

  update public.organization_invites set status = 'prijato' where id = inv.id;

  select * into org from public.organizations where id = inv.organization_id;
  return org;
end;
$$;
