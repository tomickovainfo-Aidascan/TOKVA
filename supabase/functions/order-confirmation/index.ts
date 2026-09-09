// Edge Function: odešle potvrzovací e-mail (Brevo šablona 23) při nové
// objednávce. Volá se přes Supabase Database Webhook na INSERT do
// public.orders - webhook posílá { record: {...nová objednávka...} }.
//
// Zabezpečení: webhook musí v hlavičce posílat x-webhook-secret shodný
// s WEBHOOK_SECRET (nastaveno přes `supabase secrets set`), jinak appka
// požadavek odmítne - jinak by mohl e-mail poslat kdokoli zvenku.

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const TEMPLATE_ID = 23;

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const order = payload?.record;
  if (!order || !order.email) {
    return new Response("Chybí data objednávky", { status: 400 });
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateId: TEMPLATE_ID,
      to: [{ email: order.email, name: order.contact_name || "" }],
      params: {
        CONTACT_NAME: order.contact_name,
        COMPANY_NAME: order.company_name,
        VS: order.variabilni_symbol,
        PRICE: order.expected_price_kc,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Brevo error", res.status, text);
    return new Response("Brevo error: " + text, { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
