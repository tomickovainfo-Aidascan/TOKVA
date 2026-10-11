// Edge Function: pošle Gábině e-mail, když někdo odešle zpětnou vazbu
// z formuláře na webu. Volá se přes Supabase Database Webhook na INSERT
// do public.zpetna_vazba - webhook posílá { record: {...nová zpráva...} }.
//
// Zabezpečení: webhook musí v hlavičce posílat x-webhook-secret shodný
// s WEBHOOK_SECRET (stejný jako u ostatních funkcí), jinak appka
// požadavek odmítne.
//
// Text zprávy píše kdokoli z webu, proto se před vložením do e-mailu
// převádí na obyčejný text (žádné HTML z formuláře se nevykreslí).

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;

const NAZVY: Record<string, string> = {
  "meric-free": "Měřič plýtvání",
  "meric-pro": "Měřič plýtvání Pro",
  "kalkulacka": "Kalkulačka ztrát",
  "kalkulacka-naklady-skladu": "Kalkulačka nákladů skladu na m²",
  "mini-audit": "Mini audit skladu",
  "mini-audit-vyroba": "Mini audit výroby",
  "kviz-sklad": "Kvíz: Jak dobře znáte svůj sklad",
  "kviz-komunikace": "Kvíz komunikačního chaosu",
  "spaghetti-sklad": "Spaghetti diagram",
  "spaghetti-vyroba": "Spaghetti diagram Pro",
  "5s-audit": "5S pro každého smrtelníka",
  "5x-proc": "5× Proč AI kouč",
  "casova-studie": "Časová studie mého dne",
  "tokva-pro": "Účet Tokva Pro",
  "obecne": "Obecně, celý web",
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const z = payload?.record;
  if (!z || !z.zprava) {
    return new Response("Chybí data zprávy", { status: 400 });
  }

  const nastroj = NAZVY[z.nastroj] || z.nastroj || "neuvedeno";
  const zarizeni = { mobil: "mobil", tablet: "tablet", pocitac: "počítač" }[z.zarizeni as string] || "-";

  const body: Record<string, unknown> = {
    sender: { name: "Tokva", email: "gabriela@tokva.cz" },
    to: [{ email: "tomickova.info@gmail.com" }],
    subject: "Zpětná vazba: " + nastroj + (z.email ? " (s e-mailem)" : ""),
    htmlContent:
      "<p><strong>Nástroj:</strong> " + esc(nastroj) + "<br>" +
      "<strong>Stránka:</strong> " + esc(z.stranka || "-") + "<br>" +
      "<strong>E-mail:</strong> " + esc(z.email || "nevyplnil") + "<br>" +
      "<strong>Zařízení:</strong> " + esc(zarizeni) + "</p>" +
      "<p style=\"white-space:pre-wrap;border-left:3px solid #c9a227;padding-left:12px;\">" + esc(z.zprava) + "</p>" +
      "<p style=\"color:#6b7280;font-size:12px;\">Prohlížeč: " + esc(z.prohlizec || "-") + "</p>",
  };
  // Odpověď z Gmailu půjde rovnou pisateli, pokud nechal e-mail.
  if (z.email) body.replyTo = { email: z.email };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Brevo error", res.status, text);
    return new Response("Brevo error: " + text, { status: 500 });
  }
  return new Response("OK", { status: 200 });
});
