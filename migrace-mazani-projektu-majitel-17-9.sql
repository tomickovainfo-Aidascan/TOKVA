-- Migrace: mazání projektů vyhrazené jen majiteli (17.9.2026)
-- Dřív mohl projekt smazat kdokoli z firmy (i řadový člen) - jedno
-- pravidlo "for all" na is_org_member pokrývalo select/insert/update/delete
-- najednou. Teď je delete oddělené a smí ho jen majitel.
--
-- Spusť v SQL Editoru.

drop policy if exists "clenove pristup k projektum" on public.projects;

create policy "clenove ctou projekty" on public.projects
for select using (public.is_org_member(organization_id));

create policy "clenove zakladaji projekty" on public.projects
for insert with check (public.is_org_member(organization_id));

create policy "clenove upravuji projekty" on public.projects
for update using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "jen majitel maze projekty" on public.projects
for delete using (
  exists (
    select 1 from public.organization_members
    where organization_id = projects.organization_id
    and user_id = auth.uid()
    and role = 'majitel'
  )
);
