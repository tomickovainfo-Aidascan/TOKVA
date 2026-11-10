-- Migrace: chybějící práva service_role na actions a tool_runs (10.11.2026)
--
-- Zjištění při zkušebním spuštění Edge Function pripomenuti-overeni: role
-- service_role (tu funkce používá přes SUPABASE_SERVICE_ROLE_KEY) nemá na
-- tabulce actions právo SELECT ani UPDATE a na tool_runs právo SELECT -
-- zřejmě chyběla od vzniku těch tabulek. Funkce proto nemohla nikdy přečíst
-- úkoly k ověření ani zapsat, že e-mail odeslala, bez ohledu na cron nebo
-- verify_jwt. RLS tím není dotčená (service_role ji obchází jako dřív),
-- jde jen o chybějící GRANT na úrovni tabulky.
--
-- Spusť celé najednou v Supabase SQL Editoru.

grant select, update on public.actions to service_role;
grant select on public.tool_runs to service_role;
