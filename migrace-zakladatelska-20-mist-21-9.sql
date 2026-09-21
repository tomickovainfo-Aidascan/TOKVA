-- Migrace: zakladatelská cena pro prvních 20 firem, ne 10 (21.9.2026)
--
-- Rozhodnuto: limit zakladatelských míst se zdvojnásobuje z 10 na 20,
-- a zakladatelská cena teď platí u všech tří variant (jednotlivec i oba
-- týmy), ne jen u jednotlivce jako dřív. Číslo 20 je nastavené přímo
-- v pro/index.html (zbyvaZakladatelskych = Math.max(0, 20 - data)),
-- tahle migrace jen opravuje popisek sloupce v Table Editoru, ať
-- neplete starým číslem.
--
-- Spusť v Supabase SQL Editoru.

comment on column public.organizations.is_founding_member is
  'Ruční pole. Varianty: true/false. Patří firma mezi prvních 20 zakladatelských Pro klientů?';
