// Edge Function: po potvrzení platby (plan='pro' + změna plan_expires_at)
// vytvoří v iDokladu koncept faktury a pošle Gábině e-mail s odkazem,
// ať ji zkontroluje a sama pošle zákazníkovi. Fakturu NEODESÍLÁ appka -
// jen ji připraví jako koncept.
//
// Postup: OAuth2 client_credentials -> najít/založit kontakt podle
// názvu firmy -> vytvořit IssuedInvoice -> poslat interní e-mail.
//
// Zabezpečení: volání musí mít hlavičku x-webhook-secret shodnou s
// WEBHOOK_SECRET (nastaveno přes `supabase secrets set`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IDOKLAD_CLIENT_ID = Deno.env.get("IDOKLAD_CLIENT_ID")!;
const IDOKLAD_CLIENT_SECRET = Deno.env.get("IDOKLAD_CLIENT_SECRET")!;

const IDOKLAD_TOKEN_URL = "https://identity.idoklad.cz/server/connect/token";
const IDOKLAD_API = "https://api.idoklad.cz/v3";

async function ziskatToken(): Promise<string> {
  const res = await fetch(IDOKLAD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: IDOKLAD_CLIENT_ID,
      client_secret: IDOKLAD_CLIENT_SECRET,
      scope: "idoklad_api",
    }),
  });
  if (!res.ok) {
    throw new Error("iDoklad token error " + res.status + ": " + (await res.text()));
  }
  const data = await res.json();
  return data.access_token;
}

async function idokladFetch(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(IDOKLAD_API + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error("iDoklad API " + path + " " + res.status + ": " + text);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const org = payload?.record;
  if (!org) {
    return new Response("Chybí data firmy", { status: 400 });
  }

  const ladiciLog: string[] = [];
  const log = (s: string) => {
    ladiciLog.push(s);
    console.log(s);
  };

  try {
    log("Start pro firmu: " + org.name + " (" + org.id + ")");

    const token = await ziskatToken();
    log("Token OK");

    // Najít kontakt podle názvu firmy
    const filtr = encodeURIComponent(`CompanyName~eq~'${(org.name || "").replace(/'/g, "''")}'`);
    const hledani = await idokladFetch(token, "/Contacts?filter=" + filtr);
    log("Hledání kontaktu: " + JSON.stringify(hledani).slice(0, 300));

    let partnerId: number | null = null;
    if (hledani?.Data?.length > 0) {
      partnerId = hledani.Data[0].Id;
      log("Kontakt nalezen, Id=" + partnerId);
    } else {
      const novyKontakt = await idokladFetch(token, "/Contacts", {
        method: "POST",
        body: JSON.stringify({ CompanyName: org.name }),
      });
      partnerId = novyKontakt.Id;
      log("Kontakt založen, Id=" + partnerId);
    }

    // Výchozí hodnoty potřebné appkou - číselná řada, způsob platby, měna
    const rady = await idokladFetch(token, "/NumericSequences?filter=DocumentType~eq~'IssuedInvoice'");
    const numericSequenceId = rady?.Data?.[0]?.Id;
    log("Číselná řada: " + JSON.stringify(rady?.Data?.[0]));

    const platby = await idokladFetch(token, "/PaymentOptions");
    const paymentOptionId = platby?.Data?.find((p: any) => /převod|transfer/i.test(p.Name))?.Id
      ?? platby?.Data?.[0]?.Id;
    log("Způsob platby: " + JSON.stringify(platby?.Data));

    const meny = await idokladFetch(token, "/Currencies?filter=Code~eq~'CZK'");
    const currencyId = meny?.Data?.[0]?.Id;
    log("Měna: " + JSON.stringify(meny?.Data?.[0]));

    const dnes = new Date().toISOString().slice(0, 10);
    const splatnost = new Date();
    splatnost.setDate(splatnost.getDate() + 14);
    const splatnostStr = splatnost.toISOString().slice(0, 10);

    const cena = Number(org.mesicni_cena_kc) || 699;

    const faktura = await idokladFetch(token, "/IssuedInvoices", {
      method: "POST",
      body: JSON.stringify({
        PartnerId: partnerId,
        NumericSequenceId: numericSequenceId,
        PaymentOptionId: paymentOptionId,
        CurrencyId: currencyId,
        DateOfIssue: dnes,
        DateOfTaxing: dnes,
        DateOfMaturity: splatnostStr,
        ReportLanguage: "Czech",
        Items: [
          {
            Name: "Tokva Pro - měsíční předplatné",
            Amount: 1,
            UnitPrice: cena,
            PriceType: "WithoutVat",
            VatRateType: "Zero",
          },
        ],
      }),
    });
    log("Faktura vytvořena: " + JSON.stringify(faktura).slice(0, 500));

    // Dohledat e-mail majitele (pro info v e-mailu, appka fakturu sama neposílá)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let email = "-";
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

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Tokva Pro", email: "gabriela@tokva.cz" },
        to: [{ email: "tomickova.info@gmail.com" }],
        subject: "Koncept faktury vytvořen - " + (org.name || org.id),
        htmlContent:
          "<p>V iDokladu vznikl koncept faktury:</p>" +
          "<p>Firma: " + (org.name || "-") + "<br>" +
          "Cena: " + cena + " Kč<br>" +
          "E-mail zákazníka: " + email + "<br>" +
          "Číslo dokladu: " + (faktura?.DocumentNumber || faktura?.Id || "-") + "</p>" +
          "<p>Zkontroluj IČO a adresu v kontaktu, doplň, a pošli zákazníkovi.</p>",
      }),
    });

    return new Response("OK\n" + ladiciLog.join("\n"), { status: 200 });
  } catch (e) {
    console.error("Chyba při vystavování faktury", e);
    // I při chybě pošli sobě upozornění, ať to nezůstane bez povšimnutí
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "Tokva Pro", email: "gabriela@tokva.cz" },
          to: [{ email: "tomickova.info@gmail.com" }],
          subject: "Faktura se NEVYTVOŘILA - " + (org.name || org.id),
          htmlContent:
            "<p>Vytvoření konceptu faktury pro firmu " + (org.name || "-") +
            " selhalo. Fakturu je potřeba založit ručně v iDokladu.</p>" +
            "<p>Chyba: " + String(e).slice(0, 500) + "</p>",
        }),
      });
    } catch {}
    return new Response("Chyba: " + String(e) + "\n" + ladiciLog.join("\n"), { status: 500 });
  }
});
