-- Migrace: firma smí mít navíc jen konzultanta (21.9.2026)
--
-- Zakladatelská cena pro jednotlivce (499 Kč) teď zahrnuje i možnost
-- přizvat 1 dalšího člověka do firmy, ale jen s rolí Konzultant - ne
-- jako plnohodnotného člena zdarma (to by obcházelo týmovou cenu).
--
-- Nový ruční sloupec: zaškrtneš u konkrétní firmy, appka Nastavení firmy
-- pak v nabídce role při pozvání i při změně role u existujícího člověka
-- schová "Člen" a "Správce", zůstane jen "Konzultant".
--
-- Spusť v Supabase SQL Editoru. U firem, co mají dostat 1 konzultanta
-- navíc, pak ručně v Table Editoru: pouze_konzultant = true,
-- max_uzivatelu = 2.

alter table public.organizations
  add column if not exists pouze_konzultant boolean not null default false;

comment on column public.organizations.pouze_konzultant is
  'Ruční pole. Firma na variantě jednotlivec, co smí navíc pozvat jen konzultanta (ne plnohodnotného člena/správce). Nastav spolu s max_uzivatelu = 2.';
