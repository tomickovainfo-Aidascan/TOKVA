-- Migrace: majitel/správce vidí jméno a e-mail členů své firmy (17.9.2026)
-- Tabulka profiles mela jen jedno pravidlo "vlastni profil" - kazdy vidi
-- jen sam sebe (id = auth.uid()). Nastaveni firmy proto u ostatnich
-- clenu nedostalo z databaze zadna data a appka ukazovala "Neznamy ucet"
-- misto jmena/e-mailu, i kdyz je clen v tabulce organization_members
-- v poradku.
--
-- Nove pravidlo pridava (nenahrazuje puvodni) moznost videt i profily
-- lidi, se kterymi jsem ve stejne firme - presne to, co Nastaveni firmy
-- potrebuje k zobrazeni seznamu lidi.
--
-- Spusť v Supabase SQL Editoru.

create policy "clenove firmy vidi profily navzajem" on public.profiles
for select using (
  exists (
    select 1 from public.organization_members m1
    join public.organization_members m2 on m1.organization_id = m2.organization_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);
