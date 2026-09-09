// Edge Function: pošle interní upozornění Gábině, když zákazník klikne
// na "Chci pokračovat" na stránce pokracovani.html (RPC potvrdit_pokracovani
// zapíše pokracovani_potvrzeno_at, SQL trigger na organizations pak zavolá
// tuhle appku).
//
// Dohledá i e-mail majitele firmy (servisní klíč), ať je hned jasné,
// kam poslat fakturu. Dotazy jsou zvlášť (ne přes vnořené .select), protože
// mezi organization_members a profiles není nastavený foreign key, který
// by Supabase potřeboval pro automatické spojení.
//
// Zabezpečení: volání musí mít hlavičku x-webhook-secret shodnou s
// WEBHOOK_SECRET (nastaveno přes `supabase secrets set`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const org = payload?.record;
  if (!org) {
    return new Response("Chybí data firmy", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let email = "nenalezen - zkontroluj v Table Editoru";
  const { data: clen } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", org.id)
    .eq("role", "majitel")
    .maybeSingle();

  if (clen?.user_id) {
    const { data: profil } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", clen.user_id)
      .maybeSingle();
    if (profil?.email) email = profil.email;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Tokva Pro", email: "gabriela@tokva.cz" },
      to: [{ email: "tomickova.info@gmail.com" }],
      subject: "Potvrzeno pokračování - " + (org.name || org.id),
      htmlContent:
        "<p>Firma potvrdila, že chce pokračovat v Tokva Pro:</p>" +
        "<p>Firma: " + (org.name || "-") + "<br>" +
        "E-mail pro fakturu: " + email + "<br>" +
        "ID firmy: " + org.id + "<br>" +
        "Konec předplatného (do teď): " + (org.plan_expires_at || "-") + "</p>" +
        "<p>Pošli fakturu na další měsíc.</p>",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Brevo error", res.status, text);
    return new Response("Brevo error: " + text, { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
