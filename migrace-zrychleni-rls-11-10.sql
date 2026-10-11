-- Migrace: zrychlení přehledu, projektů, úkolů a výsledků (11.10.2026)
-- Spusť celé najednou v Supabase SQL Editoru. Jde pustit i opakovaně.
--
-- Proč: zátěžový test (50 lidí naráz) ukázal, že načtení projektů a úkolů
-- trvá 2,5 až 5 s, zatímco uložení výsledku 0,2 s. Důvody:
--   1) tabulky projects, actions a tool_runs neměly rejstřík (index) podle
--      firmy, databáze procházela celou tabulku všech firem,
--   2) pravidla volala is_org_member(organization_id) u KAŽDÉHO řádku zvlášť.
--
-- Co skript dělá:
--   1) přidá rejstříky podle firmy (a podle data, jak appka řadí),
--   2) přidá funkci moje_organizace(): firmy přihlášeného člověka, zjistí se
--      jednou na celý dotaz,
--   3) přepíše pravidla pro čtení, zakládání a úpravy na tvar
--      "organization_id in (select moje_organizace())".
--
-- Kdo co smí, se NEMĚNÍ: člen firmy dál čte, zakládá a upravuje data své
-- firmy, nikdo cizí nic. Pravidla pro mazání (majitel/správce) zůstávají.

begin;

-- 1) Rejstříky
create index if not exists projects_org_created_idx on public.projects (organization_id, created_at desc);
create index if not exists actions_org_due_idx on public.actions (organization_id, due_date);
create index if not exists actions_project_idx on public.actions (project_id);
create index if not exists tool_runs_org_created_idx on public.tool_runs (organization_id, created_at desc);
create index if not exists tool_runs_org_nastroj_created_idx on public.tool_runs (organization_id, nastroj, created_at desc);
create index if not exists organization_members_user_idx on public.organization_members (user_id, organization_id);

-- 2) Firmy přihlášeného člověka
create or replace function public.moje_organizace()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.organization_members where user_id = auth.uid();
$$;
revoke all on function public.moje_organizace() from public;
grant execute on function public.moje_organizace() to authenticated, anon;

-- 3) Pravidla: projekty
drop policy if exists "clenove ctou projekty" on public.projects;
create policy "clenove ctou projekty" on public.projects
for select using (organization_id in (select public.moje_organizace()));

drop policy if exists "clenove upravuji projekty" on public.projects;
create policy "clenove upravuji projekty" on public.projects
for update using (organization_id in (select public.moje_organizace()))
with check (organization_id in (select public.moje_organizace()));

drop policy if exists "clenove zakladaji projekty" on public.projects;
create policy "clenove zakladaji projekty" on public.projects
for insert with check (organization_id in (select public.moje_organizace()));

-- Pravidla: úkoly v akčním plánu
drop policy if exists "clenove ctou akcni plan" on public.actions;
create policy "clenove ctou akcni plan" on public.actions
for select using (organization_id in (select public.moje_organizace()));

drop policy if exists "clenove upravuji akce" on public.actions;
create policy "clenove upravuji akce" on public.actions
for update using (organization_id in (select public.moje_organizace()))
with check (organization_id in (select public.moje_organizace()));

drop policy if exists "clenove zakladaji akce" on public.actions;
create policy "clenove zakladaji akce" on public.actions
for insert with check (organization_id in (select public.moje_organizace()));

-- Pravidla: výsledky nástrojů (čtení, zakládání, úpravy i mazání vlastní firmy, jako dřív)
drop policy if exists "clenove pristup k behum nastroju" on public.tool_runs;
create policy "clenove pristup k behum nastroju" on public.tool_runs
for all using (organization_id in (select public.moje_organizace()))
with check (organization_id in (select public.moje_organizace()));

commit;

-- Kontrola: má vypsat 9 pravidel, u 7 z nich je moje_organizace.
select tablename, policyname, cmd,
       (coalesce(qual,'') || coalesce(with_check,'')) like '%moje_organizace%' as nove
from pg_policies where tablename in ('projects','actions','tool_runs')
order by tablename, policyname;
