-- Migrace: funkce na faktury smí přepnout objednávku na "zaplaceno" (14.10.2026)
-- Spusť v Supabase SQL Editoru. Bez tajného klíče, nic nenahrazuješ.
--
-- Funkce create-invoice teď u první faktury po objednávce převezme
-- variabilní symbol z objednávky, fakturu označí jako uhrazenou a objednávku
-- přepne na status 'zaplaceno'. K tomu potřebuje číst a upravovat tabulku
-- orders (stejné oprávnění, jaké už má u organizations).

grant select, update on public.orders to service_role;
