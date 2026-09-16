-- Migrace: víc lidí z jedné firmy v Tokva Pro (pozvánky + role)
-- Zapsáno 16.9.2026, navazuje na supabase-schema-navrh.md (organization_members
-- s rolí majitel/spravce/clen/konzultant existuje už od 25.8., RLS na "je člen
-- firmy = ano/ne" taky). Tahle migrace doplňuje: tabulku pozvánek, RPC na přijetí
-- pozvánky, a dvě bezpečnostní pojistky (jen majitel smí nabídnout roli správce,
-- firma nikdy nepřijde o posledního majitele).
--
-- Spusť celé najednou v Supabase SQL Editoru, stejně jako předchozí migrace.

-- ORGANIZATION_INVITES – čekající pozvánky do firmy
create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('spravce','clen','konzultant')),
  token text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'cekajici' check (status in ('cekajici','prijato','zruseno')),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  unique (token)
);

-- Jen jedna čekající pozvánka na stejný e-mail ve stejné firmě zároveň
create unique index organization_invites_cekajici_email_idx
  on public.organization_invites (organization_id, lower(email))
  where (status = 'cekajici');

alter table public.organization_invites enable row level security;

create policy "admin firmy spravuje pozvanky" on public.organization_invites
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

-- Pojistka: roli "správce" smí pozvánkou nabídnout jen majitel, ne jiný správce
create or replace function public.zkontrolovat_pozvanku()
returns trigger
language plpgsql
security definer
as $$
declare
  moje_role text;
begin
  if new.role = 'spravce' then
    select role into moje_role from public.organization_members
      where organization_id = new.organization_id and user_id = auth.uid();
    if moje_role is distinct from 'majitel' then
      raise exception 'Roli správce může nabídnout jen majitel firmy.';
    end if;
  end if;
  return new;
end;
$$;

create trigger before_organization_invites_insert
before insert on public.organization_invites
for each row execute function public.zkontrolovat_pozvanku();

-- Stejná pojistka i při přímé změně role u existujícího člena (ne přes pozvánku)
create or replace function public.zkontrolovat_zmenu_role()
returns trigger
language plpgsql
security definer
as $$
declare
  moje_role text;
begin
  if new.role = 'spravce' and old.role <> 'spravce' then
    select role into moje_role from public.organization_members
      where organization_id = new.organization_id and user_id = auth.uid();
    if moje_role is distinct from 'majitel' then
      raise exception 'Roli správce může nastavit jen majitel firmy.';
    end if;
  end if;
  return new;
end;
$$;

create trigger before_organization_members_role_update
before update of role on public.organization_members
for each row execute function public.zkontrolovat_zmenu_role();

-- Pojistka: firma nikdy nesmí přijít o posledního majitele (smazáním ani
-- přerolováním role pryč od majitele)
create or replace function public.zabranit_ztrate_majitele()
returns trigger
language plpgsql
security definer
as $$
declare
  pocet_majitelu int;
begin
  if (tg_op = 'DELETE' and old.role = 'majitel')
     or (tg_op = 'UPDATE' and old.role = 'majitel' and new.role <> 'majitel') then
    select count(*) into pocet_majitelu from public.organization_members
      where organization_id = old.organization_id and role = 'majitel';
    if pocet_majitelu <= 1 then
      raise exception 'Firma musí mít aspoň jednoho majitele - nejdřív předejte roli majitele někomu jinému.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger before_organization_members_zmena
before update or delete on public.organization_members
for each row execute function public.zabranit_ztrate_majitele();

-- RPC: náhled pozvánky podle tokenu (appka to zavolá dřív, než se člověk
-- vůbec přihlásí/zaregistruje, aby věděl, do jaké firmy ho appka zve)
create or replace function public.nacist_pozvanku(p_token text)
returns table(organizace_nazev text, email text, role text, platna boolean)
language sql
security definer
stable
as $$
  select o.name, i.email, i.role, (i.status = 'cekajici' and i.expires_at > now())
  from public.organization_invites i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;

-- RPC: přijetí pozvánky přihlášeným uživatelem (musí mít stejný e-mail
-- jako pozvánka, a nesmí už patřit k jiné firmě)
create or replace function public.prijmout_pozvanku(p_token text)
returns public.organizations
language plpgsql
security definer
as $$
declare
  inv public.organization_invites;
  org public.organizations;
  moje_email text;
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

  insert into public.organization_members (organization_id, user_id, role)
  values (inv.organization_id, auth.uid(), inv.role);

  update public.organization_invites set status = 'prijato' where id = inv.id;

  select * into org from public.organizations where id = inv.organization_id;
  return org;
end;
$$;
