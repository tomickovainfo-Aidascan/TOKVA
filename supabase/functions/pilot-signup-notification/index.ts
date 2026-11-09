// Edge Function: po každé přihlášce do pilotu (tlačítko „Chci se přihlásit“,
// soubor pilot-prihlaska.js) udělá tři věci:
//   1. pošle Gábině e-mail o nové přihlášce,
//   2. pošle zájemci potvrzení, že přihláška dorazila,
//   3. uloží kontakt do Breva (seznam z PILOT_BREVO_LIST_ID). Souhlas s tipy
//      a novinkami (SOUHLAS_NOVINKY = "ano") se zapíše jen když ho zájemce
//      zaškrtl, stejně jako u brány k nástrojům. Dřív daný souhlas se nikdy
//      nepřepíše na „ne“.
// Volá ji databázový spouštěč po INSERT do public.pilot_prihlasky
// (migrace-pilot-prihlasky-4-11.sql), posílá { record: {...nová přihláška...} }.
//
// Zabezpečení: spouštěč musí v hlavičce posílat x-webhook-secret shodný
// s WEBHOOK_SECRET (stejný jako u ostatních funkcí), jinak funkce
// požadavek odmítne. Text přihlášky píše kdokoli z webu, proto se před
// vložením do e-mailu převádí na obyčejný text.
//
// Nastavení (jednou):
//   supabase secrets set PILOT_BREVO_LIST_ID=<číslo seznamu v Brevu>
//   (bez něj se kontakt do Breva uloží, jen nebude v žádném seznamu)
// Nasazení:
//   supabase functions deploy pilot-signup-notification --no-verify-jwt

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const PILOT_LIST_ID = parseInt(Deno.env.get("PILOT_BREVO_LIST_ID") || "", 10);

const ODESILATEL = { name: "Gabriela Tomíčková, Tokva", email: "gabriela@tokva.cz" };
const GABINA = "gabriela@tokva.cz";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function brevo(cesta: string, body: unknown, metoda = "POST") {
  const res = await fetch("https://api.brevo.com/v3" + cesta, {
    method: metoda,
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Brevo " + cesta + " " + res.status + ": " + text);
  }
  return res;
}

function emailGabine(p: Record<string, unknown>) {
  const zarizeni = { mobil: "mobil", tablet: "tablet", pocitac: "počítač" }[p.zarizeni as string] || "-";
  const prihlaseny = p.user_id ? "ano, má účet v Tokvě" : "ne";
  const tel = p.telefon
    ? "<a href=\"tel:" + esc(String(p.telefon).replace(/[^+0-9]/g, "")) + "\">" + esc(p.telefon) + "</a>"
    : "nevyplnil";
  return {
    sender: ODESILATEL,
    to: [{ email: GABINA }],
    replyTo: { email: String(p.email) },
    subject: "Přihláška do pilotu: " + String(p.firma).slice(0, 80),
    htmlContent:
      "<p><strong>Firma:</strong> " + esc(p.firma) + "<br>" +
      "<strong>E-mail:</strong> <a href=\"mailto:" + esc(p.email) + "\">" + esc(p.email) + "</a><br>" +
      "<strong>Telefon:</strong> " + tel + "<br>" +
      "<strong>Tipy a novinky:</strong> " + (p.souhlas_novinky ? "souhlasí" : "ne") + "<br>" +
      "<strong>Přihlášený v Tokvě:</strong> " + esc(prihlaseny) + "<br>" +
      "<strong>Zařízení:</strong> " + esc(zarizeni) + "</p>" +
      "<p><strong>Co je nejvíc pálí" + (p.diktovano ? " (nadiktováno)" : "") + ":</strong></p>" +
      "<p style=\"white-space:pre-wrap;border-left:3px solid #e9a91b;padding-left:12px;\">" +
        esc(p.co_pali || "nevyplnili") + "</p>" +
      "<p style=\"color:#6b7280;font-size:12px;\">Ozvat se do 2 pracovních dnů. Stránka: " + esc(p.stranka || "-") +
        " · Prohlížeč: " + esc(p.prohlizec || "-") + "</p>",
  };
}

// Potvrzení zájemci ve stejném vzhledu jako ostatní e-maily Tokvy
// (claude/brevo-emaily-sablona.md v projektu Moje OSVČ): béžové pozadí,
// bílá karta 600 px, černá hlavička se zlatým „Tokva“, zlatý box, podpis.
// Je to transakční e-mail (odpověď na přihlášku), proto bez odkazu na
// odhlášení; místo něj vysvětlení, proč e-mail přišel.
const F = "font-family:helvetica,arial,sans-serif;";
function odst(text: string, barva = "#3c4858", okraj = "0 0 16px") {
  return "<p style=\"margin:" + okraj + ";" + F + "font-size:15px;color:" + barva + ";line-height:1.7;\">" + text + "</p>";
}

export function potvrzeniHtml(p: Record<string, unknown>) {
  const jak = p.telefon
    ? "Zavolám vám na " + esc(p.telefon) + ", případně napíšu sem."
    : "Napíšu vám na tento e-mail.";
  const novinky = p.souhlas_novinky
    ? odst("Zaškrtli jste i tipy a novinky k Tokvě. Budou chodit občas a odhlásit se můžete v každém z nich.", "#3c4858", "0 0 20px")
    : "";
  return "<!DOCTYPE html><html lang=\"cs\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Přihláška do pilotu Tokvy</title></head>" +
    "<body style=\"margin:0;padding:0;background-color:#f5f4f0;\">" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f5f4f0;\"><tr><td align=\"center\" style=\"padding:24px 16px;\">" +
    "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;\">" +
      // hlavička
      "<tr><td style=\"background-color:#000000;padding:24px 32px;\"><span style=\"" + F + "font-size:14px;font-weight:700;color:#ffffff;\">Pilot Změř, změň, ověř <span style=\"color:#e9a91b;\">Tokva</span></span></td></tr>" +
      // úvod
      "<tr><td style=\"padding:32px 32px 8px;\">" +
        "<h1 style=\"margin:0 0 16px;" + F + "font-size:22px;font-weight:800;color:#111111;line-height:1.3;\">Přihláška dorazila</h1>" +
        odst("Dobrý den,") +
        odst("děkuji za přihlášku do pilotu <strong style=\"color:#111111;\">Změř, změň, ověř</strong> za firmu <strong style=\"color:#111111;\">" + esc(p.firma) + "</strong>. Dorazila v pořádku a mám ji.") +
      "</td></tr>" +
      // zlatý box
      "<tr><td style=\"padding:0 32px 24px;\">" +
        "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#fdf3d9;border:1px solid #e9c877;border-radius:10px;\"><tr><td style=\"padding:20px 24px;\">" +
          "<p style=\"margin:0 0 10px;" + F + "font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c48e10;\">Co bude dál</p>" +
          odst("<strong>Do 2 pracovních dnů se vám ozvu.</strong> " + jak, "#111111", "0 0 8px") +
          odst("<strong>Domluvíme úvodní schůzku na 30 až 45 minut.</strong> Do 80 km od Vrchlabí přijedu za vámi, dál online.", "#111111", "0 0 8px") +
          odst("<strong>Do 14 dnů po schůzce</strong> vám dám vědět, jestli jste v pilotu.", "#111111", "0") +
        "</td></tr></table>" +
      "</td></tr>" +
      // závěr + tlačítko
      "<tr><td style=\"padding:0 32px 32px;\">" +
        odst(p.co_pali
          ? "Kdybyste chtěli něco doplnit, stačí odpovědět na tenhle e-mail."
          : "Kdybyste chtěli něco doplnit, třeba co vás ve firmě nejvíc pálí, stačí odpovědět na tenhle e-mail.", "#3c4858", "0 0 20px") +
        novinky +
        "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"border-radius:8px;background-color:#e9a91b;\">" +
          "<a href=\"https://tokva.cz/pilot/#podminky\" style=\"display:inline-block;padding:14px 28px;" + F + "font-size:14px;font-weight:800;color:#000000;text-decoration:none;\">Chci si projít podmínky pilotu</a>" +
        "</td></tr></table>" +
      "</td></tr>" +
      // podpis
      "<tr><td style=\"padding:20px 32px 32px;border-top:1px solid #e2e2e2;\">" +
        "<p style=\"margin:20px 0 0;" + F + "font-size:13px;font-weight:700;color:#111111;\">Gabriela</p>" +
        "<p style=\"margin:16px 0 0;" + F + "font-size:12px;color:#8a8a8a;line-height:1.6;\">Tenhle e-mail jste dostali, protože jste se přihlásili do pilotu na tokva.cz. Pokud jste to nebyli vy, stačí ho smazat. " +
          "<a href=\"https://tokva.cz/ochrana-osobnich-udaju/\" style=\"color:#8a8a8a;text-decoration:underline;\">Jak s údaji zacházím</a></p>" +
      "</td></tr>" +
    "</table></td></tr></table></body></html>";
}

function potvrzeniZajemci(p: Record<string, unknown>) {
  return {
    sender: { name: "Tokva", email: "gabriela@tokva.cz" },
    to: [{ email: String(p.email) }],
    replyTo: { email: GABINA },
    subject: "Přihláška do pilotu Tokvy dorazila",
    htmlContent: potvrzeniHtml(p),
  };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const p = payload?.record;
  if (!p || !p.email || !p.firma) {
    return new Response("Chybí data přihlášky", { status: 400 });
  }

  const chyby: string[] = [];

  // 1. Gábině
  try { await brevo("/smtp/email", emailGabine(p)); } catch (e) { chyby.push(String(e)); }

  // 2. Zájemci potvrzení
  try { await brevo("/smtp/email", potvrzeniZajemci(p)); } catch (e) { chyby.push(String(e)); }

  // 3. Kontakt do Breva. Souhlas jen když ho dal, jinak se atribut neposílá
  //    (aby se dřívější „ano“ nepřepsalo).
  try {
    const kontakt: Record<string, unknown> = { email: String(p.email), updateEnabled: true };
    if (p.souhlas_novinky) kontakt.attributes = { SOUHLAS_NOVINKY: "ano" };
    if (Number.isFinite(PILOT_LIST_ID)) kontakt.listIds = [PILOT_LIST_ID];
    await brevo("/contacts", kontakt);
  } catch (e) { chyby.push(String(e)); }

  if (chyby.length) {
    console.error("pilot-signup-notification:", chyby.join(" | "));
    return new Response("Částečně: " + chyby.join(" | "), { status: 500 });
  }
  return new Response("OK", { status: 200 });
});
