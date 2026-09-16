// Edge Function: pošle pozvánku do firmy e-mailem, když někdo (majitel/správce)
// pozve kolegu do appky Nastavení firmy. Volá se přes Supabase Database Webhook
// na INSERT do public.organization_invites - webhook posílá { record: {...} }.
//
// Zabezpečení: webhook musí v hlavičce posílat x-webhook-secret shodný
// s WEBHOOK_SECRET (stejný jako u order-confirmation/continuation-notification).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const NAZEV_ROLE: Record<string, string> = {
  spravce: "správce",
  clen: "člen týmu",
  konzultant: "konzultant",
};

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const invite = payload?.record;
  if (!invite || !invite.email || !invite.token) {
    return new Response("Chybí data pozvánky", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", invite.organization_id)
    .maybeSingle();

  let pozvalJmeno = "kolega z Tokvy";
  if (invite.invited_by) {
    const { data: profil } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", invite.invited_by)
      .maybeSingle();
    if (profil?.full_name) pozvalJmeno = profil.full_name;
    else if (profil?.email) pozvalJmeno = profil.email;
  }

  const nazevFirmy = org?.name || "vaší firmy";
  const nazevRole = NAZEV_ROLE[invite.role] || invite.role;
  const odkaz = `https://tokva.cz/prihlaseni.html?pozvanka=${invite.token}`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Tokva", email: "gabriela@tokva.cz" },
      to: [{ email: invite.email }],
      subject: `Pozvánka do Tokvy — ${nazevFirmy}`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="font-family:Arial,sans-serif;color:#1a1a1a;">Zvou vás do Tokvy</h2>
          <p style="color:#545454;font-size:14px;line-height:1.6;">
            ${pozvalJmeno} vás zve do appky <b>${nazevFirmy}</b> na Tokva Pro, s rolí <b>${nazevRole}</b>.
            Uvidíte společné výsledky, projekty a akční plán firmy.
          </p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${odkaz}" style="background:#e9a91b;color:#1a1a1a;text-decoration:none;
               font-weight:bold;padding:13px 28px;border-radius:8px;display:inline-block;">
              Přijmout pozvánku
            </a>
          </p>
          <p style="color:#a8a6a6;font-size:12px;line-height:1.6;">
            Pozvánka platí 14 dní a je určená pro e-mail ${invite.email}. Pokud jste tuhle pozvánku
            nečekali, klidně ji ignorujte.
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Brevo chyba:", text);
    return new Response("Chyba při odesílání e-mailu", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
