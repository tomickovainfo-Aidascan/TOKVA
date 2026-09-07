-- Migrace 7.9.2026: hlavička stránky Projekt (souhrn + prezentační mód)
-- Spustit v Supabase SQL editoru. Bezpečné spustit i podruhé (IF NOT EXISTS).

alter table public.projects
  add column if not exists responsible_person text,
  add column if not exists next_step text,
  add column if not exists expected_potential_kc numeric;

comment on column public.projects.responsible_person is 'Odpovědná osoba za projekt - volný text, ne účet.';
comment on column public.projects.next_step is 'Krátký text: co je dalším krokem na projektu (zobrazuje se v hlavičce stránky Projekt).';
comment on column public.projects.expected_potential_kc is 'Očekávaný potenciál úspory v Kč/rok, zadává se ručně v hlavičce stránky Projekt (odděleno od skutečně ověřeného přínosu, který appka počítá ze zavřených/ověřených úkolů).';
