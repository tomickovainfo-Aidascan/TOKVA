// Edge Function: pošle interní upozornění Gábině, když zákazník klikne
// na "Chci pokračovat" na stránce pokracovani.html (RPC potvrdit_pokracovani
// zapíše pokracovani_potvrzeno_at, SQL trigger na organizations pak zavolá
// tuhle appku).
//
// Zabezpečení: volání musí mít hlavičku x-webhook-secret shodnou s
// WEBHOOK_SECRET (nastaveno přes `supabase secrets set`).

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const org = payload?.record;
  if (!org) {
    return new Response("Chybí data firmy", { status: 400 });
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
