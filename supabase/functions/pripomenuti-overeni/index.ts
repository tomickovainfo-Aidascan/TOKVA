// Edge Function: jednou denně (pg_cron, viz migrace-pripomenuti-overeni-9-11.sql)
// projde úkoly v Akčním plánu, co mají termín ověření dnes nebo dřív
// (status overit_vysledek, e-mail ještě neodešel - "dřív" taky, ať
// připomínka nezapadne, když cron jeden den neproběhne), a pošle e-mail:
// co se změnilo a kterým nástrojem to změřit znovu, s odkazem rovnou do
// nástroje. Adresát: odpovědná osoba úkolu, pokud má ve firmě účet,
// jinak majitel firmy.
//
// Zdroj zadání: _navrhy/overeni-vysledku-v-nastrojich.md (bod E) a
// Moje-AI/navrhy-agentu/2026-11-08.md ("Hotové zadání pro Claude Code").
//
// Dotazy na organization_members a profiles jsou zvlášť (ne přes vnořené
// .select), protože mezi těmi tabulkami není nastavený foreign key -
// stejně jako v hlidani-plateb-a-dat.
//
// Zabezpečení: volání musí mít hlavičku x-webhook-secret shodnou s
// WEBHOOK_SECRET (nastaveno přes `supabase secrets set`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ODESILATEL = { name: "Tokva", email: "gabriela@tokva.cz" };
const GABINA = "gabriela@tokva.cz";
const ZAKLAD = "https://tokva.cz";

// Stejné klíče jako appka zapisuje do tool_runs.nastroj při uložení
// měření (nastroje/*/index.html). Jen Pro nástroje - ty jediné se
// ukládají k organizaci a mají tool_run_id, na který se akce odkazuje.
const NASTROJE: Record<string, { nazev: string; cesta: string }> = {
  "5s": { nazev: "5S", cesta: "/nastroje/5S_audit/" },
  "5x-proc": { nazev: "5× Proč AI kouč", cesta: "/nastroje/5x-proc-ai-kouc/" },
  "casova-studie": { nazev: "Časová studie", cesta: "/nastroje/casova-studie/" },
  "kalkulacka-m2": { nazev: "Kalkulačka nákladů skladu", cesta: "/nastroje/kalkulacka-nakladu-skladu/" },
  "kalkulacka-ztrat": { nazev: "Kalkulačka ztrát", cesta: "/nastroje/kalkulacka-ztrat/" },
  "kviz-sklad": { nazev: "Kvíz: Jak znáte svůj sklad", cesta: "/nastroje/kviz-jak-znate-svuj-sklad/" },
  "kviz-komunikacniho-chaosu": { nazev: "Kvíz komunikačního chaosu", cesta: "/nastroje/kviz-komunikacniho-chaosu/" },
  "meric-plytvani-pro": { nazev: "Měřič plýtvání Pro", cesta: "/nastroje/meric-plytvani-pro/" },
  "mini-audit-skladu": { nazev: "Mini audit skladu", cesta: "/nastroje/mini-audit-skladu/" },
  "mini-audit-vyroby": { nazev: "Mini audit výroby", cesta: "/nastroje/mini-audit-vyroby/" },
  "spaghetti-pro": { nazev: "Spaghetti diagram Pro", cesta: "/nastroje/spaghetti-pro/" },
};

function datum(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("cs-CZ");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

async function poslat(to: { email: string; name?: string }, subject: string, htmlContent: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: ODESILATEL,
      replyTo: { email: "gabriela@tokva.cz", name: "Gabriela Tomíčková" },
      to: [to],
      subject,
      htmlContent,
    }),
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

  // Odpovědná osoba (actions.responsible_person) je volný text - najde se
  // podle jména mezi členy firmy, co mají účet. Nenajde se (nemá účet,
  // je prázdná, jméno nesedí), pošle se majiteli.
  async function emailOdpovedneOsoby(orgId: string, jmeno: string | null): Promise<{ email: string; name: string } | null> {
    if (!jmeno?.trim()) return null;
    const { data: clenove } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId);
    if (!clenove?.length) return null;
    const { data: profily } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", clenove.map((c) => c.user_id))
      .ilike("full_name", jmeno.trim());
    const shoda = profily?.[0];
    if (!shoda?.email) return null;
    return { email: shoda.email, name: shoda.full_name || "" };
  }

  // "nebo dřív" (ne jen = dnes), ať připomínka nezapadne, když cron den
  // vynechá (výpadek, nasazení apod.).
  const { data: ukoly, error } = await supabase
    .from("actions")
    .select("id, organization_id, title, note, tool_run_id, responsible_person, organizations(name)")
    .eq("status", "overit_vysledek")
    .lte("verification_date", dnesStr)
    .is("verification_reminder_sent_at", null);
  if (error) return new Response("DB error: " + error.message, { status: 500 });

  let odeslano = 0;
  const neodeslano: string[] = [];

  for (const ukol of ukoly || []) {
    const orgName = (ukol as any).organizations?.name || "vaší firmy";
    const komu = (await emailOdpovedneOsoby(ukol.organization_id, ukol.responsible_person)) || (await emailMajitele(ukol.organization_id));
    if (!komu) {
      neodeslano.push((ukol.title || ukol.id) + " (" + orgName + ", chybí majitel nebo e-mail)");
      continue;
    }

    let nastrojHtml =
      "<p>Změřte to znovu stejným nástrojem, jakým jste to zjistili poprvé, a porovnejte výsledek.</p>" +
      "<p><a href=\"" + ZAKLAD + "/nastroje/\">Otevřít přehled nástrojů →</a></p>";
    if (ukol.tool_run_id) {
      const { data: run } = await supabase
        .from("tool_runs")
        .select("nastroj")
        .eq("id", ukol.tool_run_id)
        .maybeSingle();
      const info = run?.nastroj ? NASTROJE[run.nastroj] : null;
      if (info) {
        nastrojHtml =
          "<p>Změřte to znovu stejným nástrojem jako poprvé: <b>" + escapeHtml(info.nazev) + "</b>.</p>" +
          "<p><a href=\"" + ZAKLAD + info.cesta + "\" style=\"display:inline-block;background:#e9a91b;color:#000000;" +
          "font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;" +
          "font-family:'DM Sans',Arial,sans-serif;\">Otevřít " + escapeHtml(info.nazev) + " →</a></p>";
      }
    }

    const subject = "Je čas ověřit: " + (ukol.title || "váš úkol v Tokvě");
    const htmlContent =
      "<!DOCTYPE html><html lang=\"cs\"><head><meta charset=\"UTF-8\"></head>" +
      "<body style=\"margin:0;padding:0;background:#fafaf8;font-family:'DM Sans',Arial,sans-serif;color:#1a1a1a;\">" +
      "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fafaf8;padding:32px 16px;\">" +
      "<tr><td align=\"center\">" +
      "<table width=\"100%\" style=\"max-width:480px;background:#ffffff;border:1px solid #e8e8e8;border-radius:16px;padding:36px 32px;\" cellpadding=\"0\" cellspacing=\"0\">" +
      "<tr><td style=\"font-family:'Poppins',Arial,sans-serif;font-weight:800;font-size:16px;padding-bottom:28px;\">Moje <span style=\"color:#e9a91b;\">Tokva</span></td></tr>" +
      "<tr><td style=\"font-family:'Poppins',Arial,sans-serif;font-weight:800;font-size:20px;padding-bottom:10px;\">Je čas ověřit, jestli to zabralo</td></tr>" +
      "<tr><td style=\"font-size:14px;color:#545454;line-height:1.6;padding-bottom:8px;\">" +
      "Dobrý den, u firmy <b style=\"color:#1a1a1a;\">" + escapeHtml(orgName) + "</b> jste si naplánovali ověřit tenhle úkol:</td></tr>" +
      "<tr><td style=\"background:#fdf3d9;border-radius:12px;padding:16px 18px;font-size:14px;color:#1a1a1a;line-height:1.6;margin-bottom:8px;\">" +
      "<b>" + escapeHtml(ukol.title || "") + "</b>" +
      (ukol.note ? "<br><span style=\"color:#545454;font-size:13px;\">" + escapeHtml(ukol.note) + "</span>" : "") +
      "</td></tr>" +
      "<tr><td style=\"font-size:14px;color:#1a1a1a;line-height:1.6;padding-top:20px;\">" + nastrojHtml + "</td></tr>" +
      "<tr><td style=\"font-size:14px;color:#545454;line-height:1.6;padding-top:12px;\">" +
      "Až budete mít nové měření, zapište v Akčním plánu u úkolu, co se změnilo.</td></tr>" +
      "<tr><td style=\"font-size:12.5px;color:#a8a6a6;padding-top:28px;border-top:1px solid #e8e8e8;margin-top:24px;\">" +
      "Kdyby něco nesedělo, napište na <a href=\"mailto:gabriela@tokva.cz\" style=\"color:#976e12;\">gabriela@tokva.cz</a> nebo odpovězte na tento e-mail.<br>Gabriela Tomíčková<br>Tokva<br>Zlepšování výroby a skladu jednoduše</td></tr>" +
      "</table></td></tr></table></body></html>";

    try {
      await poslat(komu, subject, htmlContent);
      await supabase.from("actions").update({ verification_reminder_sent_at: new Date().toISOString() }).eq("id", ukol.id);
      odeslano++;
    } catch (err) {
      console.error("Připomínka ověření se neodeslala", ukol.id, err);
      neodeslano.push((ukol.title || ukol.id) + " (" + orgName + ", chyba Brevo)");
    }
  }

  // Souhrn pro Gábinu, jen když je co hlásit (stejný princip jako hlidani-plateb-a-dat).
  if (neodeslano.length) {
    try {
      await poslat(
        { email: GABINA },
        "Tokva: připomínky ověření se nepodařilo poslat (" + neodeslano.length + ")",
        "<p>Dnes mělo odejít " + (ukoly || []).length + " připomínek ověření, " + odeslano + " se povedlo.</p>" +
          "<p><b>Nepodařilo se:</b></p><ul>" + neodeslano.map((s) => "<li>" + escapeHtml(s) + "</li>").join("") + "</ul>" +
          "<p>Ozvi se jim ručně, nebo jim doplň majitele / e-mail v Table Editoru.</p>",
      );
    } catch (err) {
      console.error("Souhrn pro Gábinu se neodeslal", err);
    }
  }

  return new Response(`OK: k ověření ${(ukoly || []).length}, odesláno ${odeslano}, nepovedlo se ${neodeslano.length}`, { status: 200 });
});
