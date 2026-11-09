-- Migrace: nová e-mailová adresa Tokvy (9.11.2026)
-- Gábina přešla na gabriela@tokva.cz (Email Profi na Seznamu, funguje od
-- 9. 11. 2026). Funkce zkontrolovat_limit_pozvanky z migrace-limit-uzivatelu-17-9.sql
-- má v chybové hlášce natvrdo starou adresu tomickova.info@gmail.com - stará
-- migrace se neupravuje, tahle jen nahrazuje stejnou funkci (create or
-- replace) s opravenou adresou, nic jiného na ní neměníme.
--
-- Spusť celé najednou v Supabase SQL Editoru.

create or replace function public.zkontrolovat_limit_pozvanky()
returns trigger
language plpgsql
security definer
as $$
declare
  v_max integer;
  v_pocet integer;
begin
  select max_uzivatelu into v_max from public.organizations where id = new.organization_id;

  select
    (select count(*) from public.organization_members where organization_id = new.organization_id)
    +
    (select count(*) from public.organization_invites where organization_id = new.organization_id and status = 'cekajici')
  into v_pocet;

  if v_max is not null and v_pocet >= v_max then
    raise exception 'Firma dosáhla svého limitu % lidí v Tokva Pro. Pro víc lidí se prosím ozvěte na gabriela@tokva.cz.', v_max;
  end if;

  return new;
end;
$$;
