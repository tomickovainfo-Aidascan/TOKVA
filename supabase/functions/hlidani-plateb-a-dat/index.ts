// Edge Function: jednou denně (pg_cron, viz migrace-prodlouzeni-a-hlidani-14-10.sql)
// projde firmy a:
//  1) majiteli firmy, které Tokva Pro skončila před 11 měsíci, pošle jednou
//     upozornění, že se data za 30 dní smažou (a zapíše upozorneni_mazani_at,
//     ať nechodí znovu);
//  2) Gábině pošle souhrn, jen když je co hlásit:
//     - nezaplacené faktury po splatnosti (faktura_splatnost < dnes),
//     - firmy 12 a víc měsíců po konci Pro = data ke smazání.
//
// Nic sama nemaže ani nevypíná. Vypnutí Pro i smazání dat dělá Gábina ručně.
//
// Firmy bez Pro (plan='free') s plan_expires_at = datum, kdy jim Pro skončilo.
// Firmy, které nikdy Pro neměly, mají plan_expires_at prázdné a nehlídají se.
//
// Dotazy na organization_members a profiles jsou zvlášť (ne přes vnořené
// .select), protože mezi těmi tabulkami není nastavený foreign key.
//
// Zabezpečení: volání musí mít hlavičku x-webhook-secret shodnou s
// WEBHOOK_SECRET (nastaveno přes `supabase secrets set`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ODESILATEL = { name: "Tokva", email: "gabriela@tokva.cz" };
const GABINA = "tomickova.info@gmail.com";

function datum(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("cs-CZ");
}

function minusMesice(od: Date, mesice: number): string {
  const d = new Date(od);
  d.setUTCMonth(d.getUTCMonth() - mesice);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

async function poslat(to: { email: string; name?: string }, subject: string, htmlContent: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: ODESILATEL, to: [to], subject, htmlContent }),
  });
  if (!res.ok) throw new Error("Brevo " + res.status + ": " + (await res.text()));
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const dnes = new Date();
  dnes.setUTCHours(0, 0, 0, 0);
  const dnesStr = dnes.toISOString().slice(0, 10);
  const pred11 = minusMesice(dnes, 11);
  const pred12 = minusMesice(dnes, 12);

  async function emailMajitele(orgId: string): Promise<{ email: string; name: string } | null> {
    const { data: clen } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("role", "majitel")
      .maybeSingle();
    if (!clen?.user_id) return null;
    const { data: profil } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", clen.user_id)
      .maybeSingle();
    if (!profil?.email) return null;
    return { email: profil.email, name: profil.full_name || "" };
  }

  // 1) Nezaplacené faktury po splatnosti
  const { data: dluzi, error: e1 } = await supabase
    .from("organizations")
    .select("id, name, faktura_splatnost, plan_expires_at")
    .not("faktura_splatnost", "is", null)
    .lt("faktura_splatnost", dnesStr);
  if (e1) return new Response("DB error: " + e1.message, { status: 500 });

  // 2) Upozornění majiteli 11 měsíců po konci Pro (jednou)
  const { data: kUpozorneni, error: e2 } = await supabase
    .from("organizations")
    .select("id, name, plan_expires_at")
    .eq("plan", "free")
    .not("plan_expires_at", "is", null)
    .lte("plan_expires_at", pred11)
    .is("upozorneni_mazani_at", null);
  if (e2) return new Response("DB error: " + e2.message, { status: 500 });

  let upozorneno = 0;
  const neupozorneno: string[] = [];
  for (const org of kUpozorneni || []) {
    const komu = await emailMajitele(org.id);
    if (!komu) {
      neupozorneno.push(org.name || org.id);
      continue;
    }
    const smazaniDatum = new Date(dnes);
    smazaniDatum.setUTCDate(smazaniDatum.getUTCDate() + 30);
    try {
      await poslat(
        komu,
        "Data vaší firmy v Tokvě se za 30 dní smažou",
        "<p>Dobrý den,</p>" +
          "<p>firmě " + escapeHtml(org.name || "") + " skončila Tokva Pro " + datum(org.plan_expires_at) +
          ". Data (výsledky, projekty, akční plán, fotky) uchovávám 12 měsíců pro případ, že se vrátíte.</p>" +
          "<p>Pokud Tokva Pro znovu nezačnete používat, data smažu po " +
          smazaniDatum.toLocaleDateString("cs-CZ") + ".</p>" +
          "<p>Chcete je dřív stáhnout nebo pokračovat? Stačí odpovědět na tento e-mail.</p>" +
          "<p>Gabriela Tomíčková<br>Tokva</p>",
      );
      await supabase.from("organizations").update({ upozorneni_mazani_at: new Date().toISOString() }).eq("id", org.id);
      upozorneno++;
    } catch (err) {
      console.error("Upozornění se neodeslalo", org.id, err);
      neupozorneno.push(org.name || org.id);
    }
  }

  // 3) Firmy 12+ měsíců po konci Pro = data ke smazání
  const { data: kSmazani, error: e3 } = await supabase
    .from("organizations")
    .select("id, name, plan_expires_at, upozorneni_mazani_at")
    .eq("plan", "free")
    .not("plan_expires_at", "is", null)
    .lte("plan_expires_at", pred12);
  if (e3) return new Response("DB error: " + e3.message, { status: 500 });

  // Smazat jde až 30 dní po upozornění, ať slib v podmínkách platí.
  const hranice = new Date(dnes);
  hranice.setUTCDate(hranice.getUTCDate() - 30);
  const smazatTed = (kSmazani || []).filter(
    (o) => o.upozorneni_mazani_at && new Date(o.upozorneni_mazani_at) <= hranice,
  );

  // Souhrn pro Gábinu, jen když je co hlásit
  const radky: string[] = [];
  if ((dluzi || []).length) {
    radky.push("<h3>Nezaplacené faktury po splatnosti</h3><ul>" +
      dluzi!.map((o) =>
        "<li>" + escapeHtml(o.name || o.id) + ": splatnost " + datum(o.faktura_splatnost) +
        ", Pro prodlouženo do " + datum(o.plan_expires_at) + "</li>").join("") +
      "</ul><p>Když platba přišla, smaž u firmy v Table Editoru faktura_splatnost (NULL). " +
      "Když nepřišla a chceš Pro vypnout, nastav u firmy plan na free a faktura_splatnost na NULL. Datum konce (plan_expires_at) neměň, jinak se připraví další faktura.</p>");
  }
  if (smazatTed.length) {
    radky.push("<h3>Data ke smazání (12 měsíců po konci Pro, upozornění odešlo před 30+ dny)</h3><ul>" +
      smazatTed.map((o) =>
        "<li>" + escapeHtml(o.name || o.id) + " (ID " + o.id + "): Pro skončilo " + datum(o.plan_expires_at) + "</li>").join("") +
      "</ul>");
  }
  if (upozorneno) {
    radky.push("<p>Dnes odešlo upozornění na smazání dat " + upozorneno + " firmám.</p>");
  }
  if (neupozorneno.length) {
    radky.push("<p><b>Upozornění se nepodařilo poslat</b> (chybí majitel nebo e-mail, nebo chyba Brevo): " +
      neupozorneno.map(escapeHtml).join(", ") + ". Ozvi se jim ručně.</p>");
  }

  if (radky.length) {
    try {
      await poslat({ email: GABINA }, "Tokva: co dnes pohlídat", radky.join(""));
    } catch (err) {
      console.error("Souhrn se neodeslal", err);
      return new Response("Brevo error", { status: 500 });
    }
  }

  return new Response(
    `OK: po splatnosti ${(dluzi || []).length}, upozorněno ${upozorneno}, ke smazání ${smazatTed.length}`,
    { status: 200 },
  );
});
