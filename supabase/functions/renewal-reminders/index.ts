// Edge Function: jednou denně zkontroluje firmy, kterým za 7 dní končí
// Tokva Pro (plan_expires_at), a pošle jim e-mail s odkazem "Chci
// pokračovat" (Brevo šablona 24). Firmám na Pro už 90+ dní bez dřívější
// nabídky navíc přidá do e-mailu nabídku roční platby a označí
// rocni_nabidka_poslana, ať se nabídka neopakuje pořád dokola.
//
// Spouští se přes pg_cron + pg_net (SQL v migraci), jednou denně.
// Používá service role klíč, protože potřebuje číst napříč všemi
// firmami, ne jen tou, pod kterou by byl přihlášený uživatel.
//
// Zabezpečení: volání musí mít hlavičku x-webhook-secret shodnou s
// WEBHOOK_SECRET (nastaveno přes `supabase secrets set`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEMPLATE_ID = 24;

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const dnes = new Date();
  dnes.setUTCHours(0, 0, 0, 0);
  const za7dni = new Date(dnes);
  za7dni.setUTCDate(za7dni.getUTCDate() + 7);
  const za7dniStr = za7dni.toISOString().slice(0, 10);

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, plan_expires_at, pro_started_at, rocni_nabidka_poslana")
    .eq("plan", "pro")
    .eq("plan_expires_at", za7dniStr);

  if (error) {
    console.error(error);
    return new Response("DB error: " + error.message, { status: 500 });
  }

  let odeslano = 0;

  for (const org of orgs || []) {
    const { data: majitel, error: memberErr } = await supabase
      .from("organization_members")
      .select("profiles(email, full_name)")
      .eq("organization_id", org.id)
      .eq("role", "majitel")
      .maybeSingle();

    const email = majitel?.profiles?.email;
    if (memberErr || !email) {
      console.warn("Bez e-mailu majitele, přeskočeno", org.id, memberErr);
      continue;
    }

    let annualOffer = false;
    if (org.pro_started_at && !org.rocni_nabidka_poslana) {
      const start = new Date(org.pro_started_at);
      const rozdilDny = (dnes.getTime() - start.getTime()) / 86400000;
      if (rozdilDny >= 90) annualOffer = true;
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateId: TEMPLATE_ID,
        to: [{ email, name: majitel?.profiles?.full_name || "" }],
        params: {
          COMPANY_NAME: org.name,
          ORG_ID: org.id,
          KONCI_DATUM: new Date(za7dniStr).toLocaleDateString("cs-CZ"),
          ANNUAL_OFFER: annualOffer,
        },
      }),
    });

    if (!res.ok) {
      console.error("Brevo error pro org", org.id, await res.text());
      continue;
    }

    odeslano++;

    if (annualOffer) {
      await supabase.from("organizations").update({ rocni_nabidka_poslana: true }).eq("id", org.id);
    }
  }

  return new Response(`OK, odesláno ${odeslano} e-mailů`, { status: 200 });
});
