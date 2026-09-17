-- Migrace: mazání akcí v akčním plánu jen pro majitele/správce (17.9.2026)
-- Navazuje na migrace-mazani-projektu-majitel-17-9.sql, co řešila tabulku
-- projects. Původně jsem chtěla omezit mazání i u tool_runs a files, ale
-- tam by to rozbilo běžné věci, co dneska dělá každý člen sám za sebe:
-- mazání vlastního uloženého výpočtu/nákresu (tool_runs u kalkulačky
-- nákladů a spaghetti pro) a výměnu fotky u vlastní akce (files). Tam
-- nejde o cizí práci, ale o vlastní věc člena, takže to zůstává, jak je.
--
-- Actions (úkoly v akčním plánu) jsou jiná věc - to je společná práce
-- celého týmu, a tam mazání admin-only odpovídá původnímu záměru:
-- číst/zakládat/upravovat smí každý člen firmy, mazat celou akci jen
-- admin firmy (majitel nebo správce).
--
-- Spusť v SQL Editoru.

drop policy if exists "clenove pristup k akcnimu planu" on public.actions;

create policy "clenove ctou akcni plan" on public.actions
for select using (public.is_org_member(organization_id));

create policy "clenove zakladaji akce" on public.actions
for insert with check (public.is_org_member(organization_id));

create policy "clenove upravuji akce" on public.actions
for update using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "admin maze akce" on public.actions
for delete using (public.is_org_admin(organization_id));
