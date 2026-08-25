// Sdílené napojení na Supabase databázi Nástrojovny.
// Tenhle soubor načítá KAŽDÁ appka, co potřebuje přihlášení nebo ukládání dat.
// Musí být načtený AŽ PO knihovně Supabase, viz pořadí v <head>:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="supabase-client.js"></script>

const SUPABASE_URL = 'https://uiqjzeubhhnzspkoekxx.supabase.co';

// Vlož sem svůj Publishable / anon klíč (Supabase dashboard → Project Settings → API).
// Tenhle klíč je bezpečné mít přímo v kódu appky – zabezpečení dělá RLS v databázi,
// ne skrytí tohohle klíče. NIKDY sem nedávej Secret / service_role klíč.
const SUPABASE_ANON_KEY = 'sb_publishable_IMOVcKSNKeRB80iudKdBZw_4RTm2KY2';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
