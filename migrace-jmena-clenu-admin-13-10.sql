-- Migrace: majitel a správce můžou doplnit nebo změnit jméno členům své firmy (13.10.2026)
-- Tabulka profiles dovoluje upravit jen vlastní profil (id = auth.uid()).
-- Jména ostatních proto zatím nešla doplnit. Místo širšího pravidla pro
-- update (to by dovolilo měnit i e-mail a další pole) je tu jedna funkce,
-- která umí jen tohle: nastavit jméno člověku, který je ve stejné firmě
-- jako volající, a jen když je volající v té firmě majitel nebo správce.
--
-- Spusť v Supabase SQL Editoru.

create or replace function public.nastavit_jmeno_clena(p_user_id uuid, p_jmeno text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jmeno text := btrim(regexp_replace(coalesce(p_jmeno, ''), '\s+', ' ', 'g'));
begin
  if length(v_jmeno) < 2 or length(v_jmeno) > 80 then
    raise exception 'Jméno musí mít 2 až 80 znaků.';
  end if;

  if not exists (
    select 1
    from public.organization_members ja
    join public.organization_members clen on clen.organization_id = ja.organization_id
    where ja.user_id = auth.uid()
      and ja.role in ('majitel', 'spravce')
      and clen.user_id = p_user_id
  ) then
    raise exception 'Jméno může měnit jen majitel nebo správce stejné firmy.';
  end if;

  update public.profiles set full_name = v_jmeno where id = p_user_id;
end;
$$;

revoke all on function public.nastavit_jmeno_clena(uuid, text) from public;
grant execute on function public.nastavit_jmeno_clena(uuid, text) to authenticated;
