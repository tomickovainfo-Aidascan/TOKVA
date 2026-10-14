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

// Adresa firmy z veřejného rejstříku ARES podle IČO (ulice, město, PSČ
// zvlášť, jak je chce iDoklad). Když ARES neodpoví, vrátí null a použije
// se adresa napsaná v objednávce.
async function adresaZAres(ico: string): Promise<{ nazev?: string; dic?: string; ulice: string; mesto: string; psc: string } | null> {
  try {
    const res = await fetch("https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/" + encodeURIComponent(ico.replace(/\s/g, "")));
    if (!res.ok) return null;
    const d = await res.json();
    const s = d?.sidlo || {};
    const cislo = [s.cisloDomovni, s.cisloOrientacni ? String(s.cisloOrientacni) + (s.cisloOrientacniPismeno || "") : null]
      .filter(Boolean).join("/");
    const ulice = ((s.nazevUlice || s.nazevCastiObce || s.nazevObce || "") + (cislo ? " " + cislo : "")).trim();
    return {
      nazev: d?.obchodniJmeno,
      dic: d?.dic,
      ulice,
      mesto: s.nazevObce || "",
      psc: s.psc ? String(s.psc) : "",
    };
  } catch {
    return null;
  }
}

function datumCz(d: string | Date): string {
  return new Date(d).toLocaleDateString("cs-CZ");
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

  // Pilot nebo jiná firma s cenou 0 Kč: žádná faktura ani e-mail.
  // (Pojistka navíc k podmínce v databázovém triggeru.)
  if (org.mesicni_cena_kc !== null && org.mesicni_cena_kc !== undefined && Number(org.mesicni_cena_kc) === 0) {
    return new Response("Cena 0 Kč, faktura se nepřipravuje", { status: 200 });
  }

  // Pilot: období, které je ještě zdarma (konec Pro nepřesáhl zdarma_do).
  if (org.zdarma_do && org.plan_expires_at && new Date(org.plan_expires_at) <= new Date(org.zdarma_do)) {
    return new Response("Období zdarma (pilot), faktura se nepřipravuje", { status: 200 });
  }

  // Prodloužení = zákazník během posledního dne klikl na "Chci pokračovat"
  // (od 14.10.2026 klik sám prodlouží Pro). Jinak jde o první aktivaci
  // nebo ruční změnu data Gábinou.
  const jeProdlouzeni = !!org.pokracovani_potvrzeno_at &&
    (Date.now() - new Date(org.pokracovani_potvrzeno_at).getTime()) < 24 * 3600 * 1000;
  const konecPro = org.plan_expires_at ? new Date(org.plan_expires_at).toLocaleDateString("cs-CZ") : "";

  const ladiciLog: string[] = [];
  const log = (s: string) => {
    ladiciLog.push(s);
    console.log(s);
  };

  try {
    log("Start pro firmu: " + org.name + " (" + org.id + ")");

    const token = await ziskatToken();
    log("Token OK");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // E-mail majitele firmy
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

    // Poslední objednávka majitele (IČO, DIČ, adresa, variabilní symbol)
    let objednavka: any = null;
    if (email !== "-") {
      const { data } = await supabase
        .from("orders")
        .select("id, ico, dic, billing_address, variabilni_symbol, status, created_at")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      objednavka = data;
      log("Objednávka: " + JSON.stringify(objednavka));
    }

    // První faktura po zaplacené objednávce: zákazník už zaplatil předem
    // podle variabilního symbolu z objednávky. Faktura převezme stejný VS
    // a číslo objednávky a rovnou se označí jako uhrazená.
    const jePrvniPoObjednavce = !jeProdlouzeni && !!objednavka && objednavka.status === "nova" &&
      !!objednavka.variabilni_symbol;
    const vs = jePrvniPoObjednavce ? String(objednavka.variabilni_symbol) : undefined;
    log("První faktura po objednávce: " + jePrvniPoObjednavce + (vs ? " (VS " + vs + ")" : ""));

    // Kontakt v iDokladu: nejdřív podle IČO, pak podle názvu firmy.
    // Filtr přes URL se spolehlivě netrefoval, takže appka stáhne stránku
    // kontaktů a hledá shodu sama.
    const hledani = await idokladFetch(token, "/Contacts?pageSize=200");
    const vsechnyKontakty = hledani?.Data?.Items ?? [];
    const icoObj = (objednavka?.ico || "").replace(/\s/g, "");
    const nazevHledany = (org.name || "").trim().toLowerCase();
    let partnerId: number | null = null;
    let kontaktZAres = false;
    const shoda =
      (icoObj && vsechnyKontakty.find((k: any) => (k.IdentificationNumber || "").replace(/\s/g, "") === icoObj)) ||
      vsechnyKontakty.find((k: any) => (k.CompanyName || "").trim().toLowerCase() === nazevHledany);
    if (shoda) {
      partnerId = shoda.Id;
      log("Kontakt nalezen, Id=" + partnerId);
    } else {
      const zeme = await idokladFetch(token, "/Countries");
      const seznamZemi = zeme?.Data?.Items ?? [];
      const ceskoZaznam = seznamZemi.find((z: any) =>
        z.Code === "CZ" || z.Code === "CZE" || /česk/i.test(z.Name || "")
      );
      const countryId = ceskoZaznam?.Id;

      const ares = icoObj ? await adresaZAres(icoObj) : null;
      kontaktZAres = !!(ares && ares.mesto);
      log("ARES: " + JSON.stringify(ares));

      const novyKontakt = await idokladFetch(token, "/Contacts", {
        method: "POST",
        body: JSON.stringify({
          CompanyName: org.name,
          CountryId: countryId,
          IdentificationNumber: icoObj || null,
          VatIdentificationNumber: objednavka?.dic || ares?.dic || null,
          Street: kontaktZAres ? ares!.ulice : (objednavka?.billing_address || ""),
          City: kontaktZAres ? ares!.mesto : undefined,
          PostalCode: kontaktZAres ? ares!.psc : undefined,
          Email: email !== "-" ? email : null,
        }),
      });
      partnerId = novyKontakt?.Data?.Id ?? novyKontakt?.Id;
      log("Kontakt založen -> Id=" + partnerId);
    }

    // Výchozí hodnoty potřebné appkou - číselná řada, způsob platby, měna
    const rady = await idokladFetch(token, "/NumericSequences");
    const vsechnyRady = rady?.Data?.Items ?? [];
    log("Všechny číselné řady: " + JSON.stringify(vsechnyRady).slice(0, 800));
    const radaProFaktury = vsechnyRady.find((r: any) =>
      /invoice|faktur/i.test(r.DocumentType || r.Name || "")
    ) ?? vsechnyRady[0];
    const numericSequenceId = radaProFaktury?.Id;
    const dalsiCislo = (radaProFaktury?.LastNumber ?? radaProFaktury?.LastSerialNumber ?? 0) + 1;
    log("Vybraná číselná řada (plně): " + JSON.stringify(radaProFaktury) + " -> další číslo=" + dalsiCislo);

    const platby = await idokladFetch(token, "/PaymentOptions");
    const seznamPlateb = platby?.Data?.Items ?? [];
    const paymentOptionId = seznamPlateb.find((p: any) => /převod|transfer/i.test(p.Name || ""))?.Id
      ?? seznamPlateb[0]?.Id;
    log("Způsob platby: " + JSON.stringify(seznamPlateb));

    const ucty = await idokladFetch(token, "/BankAccounts");
    const seznamUctu = ucty?.Data?.Items ?? [];
    const vychoziUcet = seznamUctu.find((u: any) => u.IsDefault) ?? seznamUctu[0];
    log("Bankovní účty: " + JSON.stringify(seznamUctu));

    const meny = await idokladFetch(token, "/Currencies");
    const seznamMen = meny?.Data?.Items ?? [];
    const czk = seznamMen.find((m: any) => m.Code === "CZK") ?? seznamMen[0];
    const currencyId = czk?.Id;
    log("Měna: " + JSON.stringify(czk));

    const dnes = new Date().toISOString().slice(0, 10);
    const splatnost = new Date();
    splatnost.setDate(splatnost.getDate() + 14);
    const splatnostStr = splatnost.toISOString().slice(0, 10);

    const cena = Number(org.mesicni_cena_kc ?? 699) || 699;

    // Období, za které se platí: měsíc před novým koncem Pro
    let obdobi = "";
    if (org.plan_expires_at) {
      const doD = new Date(org.plan_expires_at);
      const odD = new Date(doD);
      odD.setMonth(odD.getMonth() - 1);
      obdobi = datumCz(odD) + " až " + datumCz(doD);
    }
    const nazevPolozky = "Tokva Pro, měsíční předplatné" + (obdobi ? " (" + obdobi + ")" : "");

    const faktura = await idokladFetch(token, "/IssuedInvoices", {
      method: "POST",
      body: JSON.stringify({
        PartnerId: partnerId,
        NumericSequenceId: numericSequenceId,
        PaymentOptionId: paymentOptionId,
        CurrencyId: currencyId,
        DateOfIssue: dnes,
        DateOfTaxing: dnes,
        DateOfMaturity: jePrvniPoObjednavce ? dnes : splatnostStr,
        DocumentSerialNumber: dalsiCislo,
        AccountNumber: vychoziUcet?.AccountNumber || undefined,
        BankId: vychoziUcet?.BankId || undefined,
        IsEet: false,
        IsIncomeTax: false,
        Description: "Tokva Pro - měsíční předplatné",
        VariableSymbol: vs,
        OrderNumber: vs,
        Note: jePrvniPoObjednavce ? "Uhrazeno převodem předem (VS " + vs + "). Neplaťte." : undefined,
        Items: [
          {
            Name: nazevPolozky,
            Amount: 1,
            UnitPrice: cena,
            PriceType: "WithoutVat",
            VatRateType: "Zero",
            DiscountPercentage: 0,
            IsTaxMovement: false,
          },
        ],
      }),
    });
    log("Faktura vytvořena: " + JSON.stringify(faktura));
    const fakturaId = faktura?.Data?.Id ?? faktura?.Id;
    const cisloDokladu = faktura?.Data?.DocumentNumber || faktura?.DocumentNumber || fakturaId || "-";

    let oznacenoUhrazeno = false;
    if (jePrvniPoObjednavce && fakturaId) {
      try {
        await idokladFetch(token, "/IssuedDocumentPayments/FullyPay/" + fakturaId + "?dateOfPayment=" + dnes, { method: "PUT" });
        oznacenoUhrazeno = true;
        log("Faktura označena jako uhrazená");
      } catch (e) {
        log("Označení úhrady se nepovedlo: " + String(e));
      }
      await supabase.from("orders").update({ status: "zaplaceno" }).eq("id", objednavka.id);
    }

    // E-mail zákazníkovi, že má Tokva Pro aktivní. Posílá se jen když
    // se podařilo dohledat e-mail majitele - jinak appka zákazníka
    // nezná a jen to zaloguje, ať si toho Gábina všimne v e-mailu níž.
    if (email !== "-") {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "Tokva Pro", email: "gabriela@tokva.cz" },
            to: [{ email }],
            subject: jePrvniPoObjednavce ? "Platba dorazila, Tokva Pro je aktivní"
              : jeProdlouzeni ? "Tokva Pro máte prodloužené" : "Vaše Tokva Pro je aktivní",
            htmlContent:
              "<p>Dobrý den,</p>" +
              (jePrvniPoObjednavce
                ? "<p>platba dorazila, děkuju. Tokva Pro je u vás aktivní" + (konecPro ? " do " + konecPro : "") + ". " +
                  "Přístup najdete tady: <a href=\"https://tokva.cz/moje-tokva/\">tokva.cz/moje-tokva</a></p>" +
                  "<p>Fakturu pro účetnictví vám pošlu zvlášť. Je už zaplacená, nic dalšího neplaťte.</p>"
                : jeProdlouzeni
                ? "<p>díky, že pokračujete. Tokva Pro máte prodloužené" + (konecPro ? " do " + konecPro : "") +
                  ", běží dál bez přerušení.</p>" +
                  "<p>Fakturu na " + cena + " Kč za další měsíc dostanete zvlášť, splatnost je 14 dní.</p>"
                : "<p>Tokva Pro je u vás aktivní" + (konecPro ? " do " + konecPro : "") + ". Přístup najdete tady: " +
                  "<a href=\"https://tokva.cz/moje-tokva/\">tokva.cz/moje-tokva</a></p>" +
                  "<p>Fakturu na " + cena + " Kč za měsíc dostanete zvlášť.</p>") +
              "<p>Kdyby něco nesedělo nebo jste měli otázku, napište na gabriela@tokva.cz.</p>" +
              "<p>Gabriela</p>",
          }),
        });
        log("E-mail zákazníkovi odeslán na " + email);
      } catch (e) {
        log("E-mail zákazníkovi se nepodařilo poslat: " + String(e));
      }
    } else {
      log("E-mail zákazníkovi NEODESLÁN - majitel firmy nedohledán");
    }

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Tokva Pro", email: "gabriela@tokva.cz" },
        to: [{ email: "tomickova.info@gmail.com" }],
        subject: (jePrvniPoObjednavce ? "Faktura (zaplacená, VS " + vs + ") - "
          : jeProdlouzeni ? "Koncept faktury (prodloužení) - " : "Koncept faktury vytvořen - ") + (org.name || org.id),
        htmlContent:
          "<p>V iDokladu vznikla faktura:</p>" +
          "<p>Firma: " + (org.name || "-") + "<br>" +
          "Cena: " + cena + " Kč<br>" +
          (obdobi ? "Období: " + obdobi + "<br>" : "") +
          (vs ? "Variabilní symbol a číslo objednávky: " + vs + "<br>" : "") +
          "E-mail zákazníka: " + email + "<br>" +
          "Číslo dokladu: " + cisloDokladu + "</p>" +
          (jePrvniPoObjednavce
            ? (oznacenoUhrazeno
                ? "<p>Faktura je označená jako uhrazená. Objednávka je v Tokvě přepnutá na zaplaceno.</p>"
                : "<p><b>Označení jako uhrazená se nepovedlo, označ ji v iDokladu ručně.</b></p>")
            : "") +
          (kontaktZAres
            ? "<p>Kontakt je nově založený podle IČO z ARES. Zkontroluj a pošli zákazníkovi.</p>"
            : "<p>Zkontroluj odběratele (IČO a adresu) a pošli fakturu zákazníkovi.</p>"),
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
