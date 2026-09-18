-- Migrace: zrušit sloupec founding_price_until (18.9.2026)
-- Zakladatelská cena 499 Kč/měsíc je trvalá, ne jen na první rok (viz
-- oprava textu na prodejní stránce). Sloupec founding_price_until
-- předpokládal datum, kdy cena skončí a naskočí normální - to už
-- neplatí a sloupec by jen matl v Table Editoru. is_founding_member
-- zůstává (pořád dává smysl - označuje, kdo zakladatelskou cenu má).
--
-- Spusť v Supabase SQL Editoru.

alter table public.organizations drop column if exists founding_price_until;
