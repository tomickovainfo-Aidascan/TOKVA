-- Pohled (view) pro pohodlné ruční koukání v Table Editoru - spojuje profily
-- s firmou a rolí, ať se nemusí hledat podle ID. Appka tenhle pohled
-- nepoužívá, je jen pro Gábinu.
--
-- Spusť v SQL Editoru.

create or replace view public.prehled_uzivatelu as
select
  p.id,
  p.email,
  p.full_name,
  o.name as firma,
  m.role,
  o.plan,
  p.created_at
from public.profiles p
left join public.organization_members m on m.user_id = p.id
left join public.organizations o on o.id = m.organization_id
order by p.created_at desc;

comment on view public.prehled_uzivatelu is
  'Jen pro ruční čtení v Table Editoru - profil + firma + role pohromadě. Appka tenhle pohled nepoužívá.';
