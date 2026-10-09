// Doporučený první krok k uloženému výsledku nástroje.
//
// Když člověk udělá třeba Mini audit a nemá hned čas pokračovat, po otevření
// výsledku v historii dřív viděl jen odpovědi a skóre, ale už ne, co má
// udělat dál. Tenhle soubor z uložených dat výsledku dopočítá stejný první
// krok, jaký ukázala obrazovka výsledku, a to i u starších výsledků.
//
// Používá se v Přehledu (Moje Tokva), Akčním plánu, Projektech a v historii
// jednotlivých nástrojů. Texty jsou převzaté z nástrojů, při změně textu
// v nástroji je potřeba upravit i tady.
(function () {
  const ZAKLAD = 'https://tokva.cz/nastroje/';
  // Historii vidí jen Tokva Pro, proto odkazy rovnou na Pro verze nástrojů.
  const PRO_VERZE = { 'meric-plytvani-free/': 'meric-plytvani-pro/', 'spaghetti-free/': 'spaghetti-pro/' };
  const url = (cesta) => ZAKLAD + (PRO_VERZE[cesta] || cesta);

  // ---- Mini audit skladu ----
  const SKLAD_OTAZKY = ['Víte, kde přesně zboží leží?', 'Nechodí lidé zbytečně kilometry navíc?', 'Funguje příjem zboží bez chaosu?', 'Kolik chyb vzniká při vychystávání?', 'Nečeká se zbytečně mezi kroky?', 'Přepisují se stejná data vícekrát?', 'Máte jasná pravidla pro výjimky?', 'Víte, kde vznikají reklamace a opravy?', 'Jsou postupy jasné i bez starých mazáků?', 'Měříte výkon skladu?'];
  const SKLAD_KROK = {
    1: 'Vyberte 5 nejčastěji hledaných položek a zkontrolujte, jestli systém sedí s realitou na místě.',
    2: 'Změřte jednu běžnou vychystávací trasu.',
    3: 'Zaznamenejte čas od vyložení kamionu do zaskladnění posledního kusu, u jednoho příjmu.',
    4: 'Týden si zapisujte každou chybu při vychystávání - co, kdy, kdo si všiml.',
    5: 'Vyberte jeden proces a zapište, kde v něm věc nebo člověk čeká - a jak dlouho.',
    6: 'Spočítejte, kolikrát se dnes jedna objednávka ručně přepíše, než skončí u zákazníka.',
    7: 'Sepište 5 nejčastějších výjimek z posledního měsíce.',
    8: 'Vypište posledních 10 reklamací a zkuste u nich najít společnou příčinu.',
    9: 'Napište, co by se zítra nestihlo, kdyby jeden konkrétní člověk byl na 3 měsíce pryč.',
    10: 'Zvolte 3 čísla, která začnete od pondělí zapisovat.'
  };
  const SKLAD_ODKAZ = {
    1: ['5S_audit/', 'Zavést pořádek pomocí 5S'], 2: ['spaghetti-free/', 'Nakreslit Spaghetti diagram'],
    3: ['meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání'], 5: ['meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání'],
    6: ['casova-studie/', 'Zaznamenat svůj den'], 8: ['5x-proc-ai-kouc/', 'Najít příčinu pomocí 5× Proč'],
    9: ['5S_audit/', 'Zavést pořádek pomocí 5S'], 10: ['kalkulacka-ztrat/', 'Spočítat finanční dopad']
  };

  // ---- Mini audit výroby ----
  const VYROBA_OTAZKY = ['Je na první pohled jasné, co se má vyrábět a v jakém množství?', 'Mají pracovníci materiál, nářadí a informace připravené včas?', 'Nehledá se běžně materiál, nářadí nebo dokumentace?', 'Jsou pracoviště uspořádaná bez zbytečného chození?', 'Nevznikají mezi operacemi fronty rozpracované výroby?', 'Víte přesně, proč a jak dlouho výroba stála?', 'Pracují lidé stejnou činnost stejným způsobem?', 'Nevracejí se stejné vady nebo předělávky?', 'Je jasné, kdo řeší problém během výroby?', 'Víte, kde vzniká největší ztráta času nebo výkonu?'];
  const VYROBA_KROK = {
    1: 'Zeptejte se dvou operátorů, co teď přesně vyrábí a proč zrovna tohle.',
    2: 'Jednu směnu si počítejte, kolikrát někdo přeruší práci kvůli chybějící věci.',
    3: 'Zapište si, kolikrát dnes někdo řekl „kde je“ - materiál, nářadí nebo dokumentaci.',
    4: 'Půl hodiny sledujte jednoho pracovníka a zakreslete jeho trasy do plánku haly.',
    5: 'Projděte tok jedné zakázky a zapište, kde mezi operacemi čeká rozpracovaná výroba.',
    6: 'Zaveďte jednoduchý papírový záznam prostojů - kdy, jak dlouho, proč.',
    7: 'Porovnejte, jak stejnou operaci dělají dva různí lidé.',
    8: 'Vypište posledních 10 vad a hledejte, co mají společného.',
    9: 'Sepište, kdo přesně řeší problém, když se během směny něco pokazí.',
    10: 'Vyberte tři čísla, která od zítřka začnete zapisovat.'
  };
  const VYROBA_ODKAZ = {
    1: ['meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání'], 3: ['5S_audit/', 'Zavést pořádek pomocí 5S'],
    4: ['spaghetti-free/', 'Nakreslit Spaghetti diagram'], 5: ['meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání'],
    6: ['meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání'], 8: ['5x-proc-ai-kouc/', 'Najít příčinu pomocí 5× Proč'],
    9: ['kviz-komunikacniho-chaosu/', 'Zjistit, kde vázne předávání informací'], 10: ['meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání']
  };

  // Stejné pořadí jako na obrazovce výsledku: nejvíc bodů, při shodě nižší číslo otázky.
  function miniAudit(d, otazky, kroky, odkazy) {
    const odp = d.odpovedi || {};
    const serazene = Object.entries(odp).filter(([, b]) => b >= 2).sort((a, b) => b[1] - a[1]);
    if (serazene.length) {
      const q = Number(serazene[0][0]);
      const o = odkazy[q];
      return { oblast: otazky[q - 1], text: kroky[q], odkaz: o ? { url: url(o[0]), cta: o[1] } : null };
    }
    const nevim = (d.nevim || []).map(Number).sort((a, b) => a - b);
    if (nevim.length) {
      const q = nevim[0];
      const o = odkazy[q];
      return { oblast: otazky[q - 1] + ' (zatím nevíte)', text: 'Jak to zjistit: ' + kroky[q], odkaz: o ? { url: url(o[0]), cta: o[1] } : null };
    }
    return null;
  }

  // ---- Kvíz komunikačního chaosu ----
  const CHAOS_NAZEV = { 'chaos-zmen': 'Chaos při změnách', 'zavislost': 'Závislost na jedné osobě', 'cekani': 'Čekání a dohledávání', 'uloziste': 'Roztříštěné úložiště', 'kanalovy-chaos': 'Kanálový chaos', 'prepisovani': 'Přepisování dat' };
  const CHAOS_KROK = {
    'kanalovy-chaos': 'Vyberte jednu běžnou zakázku a napište si, přes kolik kanálů dnes projde.',
    'prepisovani': 'Vyberte jedno pole, třeba termín dodání, a zjistěte, na kolika místech se dnes zadává ručně.',
    'cekani': 'Jeden pracovní den si zapisujte, kolikrát jste na něco čekali a jak dlouho.',
    'zavislost': 'Vyberte jeden proces, který dnes umí jen jeden člověk, a popište ho tak, aby ho zvládl i někdo jiný.',
    'chaos-zmen': 'Zmapujte jednu změnu termínu od zákazníka až k člověku, který podle ní musí jednat.',
    'uloziste': 'Vyberte 5 nejčastěji používaných dokumentů a zjistěte, jestli pro ně existuje jedno oficiální místo.'
  };
  function kvizChaos(d) {
    let klic = d.nejslabsiKey;
    if (!klic && d.oblastiVysledky) {
      let max = 0;
      Object.keys(CHAOS_NAZEV).forEach(k => { const v = d.oblastiVysledky[k]; if (v && typeof v.pct === 'number' && v.pct > max) { max = v.pct; klic = k; } });
    }
    if (!klic || !CHAOS_KROK[klic]) return null;
    return { oblast: CHAOS_NAZEV[klic], text: CHAOS_KROK[klic], odkaz: null };
  }

  // ---- Kvíz Jak dobře znáte svůj sklad ----
  const KVIZ_SKLAD_NAZVY = ['Náklady na metr čtvereční', 'Sledování reálné práce', 'Přepisování dat', 'Náklady fluktuace', 'Náklady na chybu', 'Zastaralé postupy', 'Zastupitelnost lidí', 'Procházení procesu osobně', 'Měření výkonu', 'Hašení místo práce'];
  const KVIZ_SKLAD_TIP = [
    'Spočítejte, co stojí metr čtvereční za měsíc. Pak se podívejte na místa, kde leží zboží, které se nehýbe. Každý nevyužitý metr je náklad, který platíte každý měsíc.',
    'Vyhraďte si jednou za čas půl hodiny a jen sledujte. Bez telefonu, bez zasahování. Uvidíte věci, které z kanceláře nikdy neuvidíte.',
    'Zmapujte jeden den a vypište každý přepis dat. U každého se zeptejte: musí to dělat člověk? Jedno propojení dvou nástrojů může uvolnit hodiny týdně.',
    'Spočítejte celý součet: inzerce + výběrko + čas zapracování + chyby nováčka + nižší výkon prvních měsíců. Číslo většinou překvapí a změní pohled na fluktuaci.',
    'Zkuste si jednou sečíst náklady na jednu konkrétní chybu od začátku do konce. Čas, oprava, komunikace se zákazníkem. Výsledek změní priority.',
    'Vyberte jeden postup, který "se tak dělá", a zeptejte se proč. Pokud nikdo nezná odpověď, možná je čas se zamyslet, jestli to má stále smysl.',
    'Klíčoví lidé jsou vaše největší skryté riziko. Začněte s jedním procesem: popište ho tak, aby ho zvládl nový člověk bez ptaní.',
    'Projděte jeden celý proces fyzicky, od začátku do konce, jak to dělá váš pracovník. Uvidíte místa, která na papíře nevypadají jako problém.',
    'Začněte s jedním ukazatelem, třeba počtem vychystaných objednávek za hodinu. Jen jedno číslo sledované pravidelně změní způsob rozhodování.',
    'Spočítejte, kolik hodin týdně strávíte vy nebo vaši vedoucí hašením. Pak se zeptejte, co způsobuje, že se stále stejné věci opakují.'
  ];
  const KVIZ_SKLAD_ODKAZ = {
    1: ['kalkulacka-nakladu-skladu/', 'Spočítat náklady na m² skladu'], 2: ['meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání'],
    3: ['casova-studie/', 'Zapsat si den v Časové studii'], 5: ['kalkulacka-ztrat/', 'Spočítat finanční dopad'],
    6: ['5x-proc-ai-kouc/', 'Najít příčinu pomocí 5× Proč'], 8: ['spaghetti-free/', 'Nakreslit Spaghetti diagram']
  };
  function kvizSklad(d) {
    const prvni = (d.nejvetsi_mezery || [])[0];
    const i = KVIZ_SKLAD_NAZVY.indexOf(prvni) + 1;
    if (!i) return null;
    const o = KVIZ_SKLAD_ODKAZ[i];
    return { oblast: prvni, text: KVIZ_SKLAD_TIP[i - 1], odkaz: o ? { url: url(o[0]), cta: o[1] } : null };
  }

  // ---- 5× Proč: sekce "8. PRVNÍ KROK DO 24 HODIN" z výstupu AI ----
  function petProc(d) {
    if (!d.raw) return null;
    const radky = String(d.raw).split('\n').map(r => r.replace(/\*\*|__/g, '').replace(/^[\s#>*\-=]+/, '').trim());
    const out = [];
    let sbirat = false;
    for (const r of radky) {
      if (/^8\.\s*PRVNÍ KROK/i.test(r)) { sbirat = true; const zbytek = r.replace(/^8\.\s*PRVNÍ KROK[^:]*:?\s*/i, ''); if (zbytek) out.push(zbytek); continue; }
      if (sbirat && /^(9|10)\.\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(r)) break;
      if (sbirat && r && !/^-{3,}$/.test(r)) out.push(r);
    }
    if (!out.length) return null;
    return { oblast: null, text: out.join(' '), odkaz: null };
  }

  // ---- Kalkulačka ztrát ----
  const ZTRATY_CILE = {
    'Zbytečná chůze a přesuny': ['Zmapujte skutečnou trasu a najděte, kde se dá zkrátit.', 'spaghetti-free/', 'Nakreslit Spaghetti diagram'],
    'Čekání a prostoje': ['Změřte přímo v provozu, během které části procesu se čeká.', 'meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání'],
    'Ruční administrativa': ['Časová studie dne rozklíčuje, kolik z toho je administrativa a kolik hašení problémů.', 'casova-studie/', 'Zaznamenat svůj den'],
    'Dodávky a expedice': ['Změřte proces příjmu nebo expedice přímo v provozu.', 'meric-plytvani-free/', 'Změřit čas v Měřiči plýtvání'],
    'Rozloženo napříč více oblastmi': ['Když nic výrazně nepřevažuje, problém většinou není jedna činnost, ale celkové fungování provozu.', 'mini-audit-skladu/', 'Provést Mini audit skladu']
  };
  function kalkulackaZtrat(d) {
    const dop = d.doporuceni || {};
    // Název bývá i s podílem ("Čekání a prostoje - 45 % ztraceného času").
    const klic = Object.keys(ZTRATY_CILE).find(k => String(dop.nazev || '').indexOf(k) === 0);
    const c = ZTRATY_CILE[klic];
    if (c) return { oblast: dop.nazev, text: c[0], odkaz: { url: url(c[1]), cta: c[2] } };
    if (dop.nazev) return { oblast: dop.nazev, text: dop.popis || '', odkaz: null };
    return null;
  }

  // ---- Měřič plýtvání Pro: největší plýtvání nad prahem ("Kde začít") ----
  const MERIC_PRAHY = { presun: 20, hledani: 10, cekani: 10, papiry: 10, priprava: 15, kontrola: 10 };
  const MERIC_NAZEV = { presun: 'Přesun', hledani: 'Hledání', cekani: 'Čekání', papiry: 'Administrativa', priprava: 'Příprava', kontrola: 'Kontrola' };
  const MERIC_TIP = {
    presun: ['Nakreslete trasu a vizuálně uvidíte, kde se kříží a opakuje.', 'spaghetti-free/', 'Nakreslit Spaghetti diagram'],
    hledani: ['Vizuální řízení, označení míst a standardizace umístění eliminují hledání rychle a levně.', '5S_audit/', 'Zavést pořádek pomocí 5S'],
    cekani: ['Hledejte příčinu - chybí informace, materiál nebo rozhodnutí? Odstraňte příčinu, ne jen symptom.', '5x-proc-ai-kouc/', 'Najít příčinu pomocí 5× Proč'],
    papiry: ['Kolik z toho je nutné? Zde je prostor pro digitalizaci nebo zjednodušení.', null, null],
    priprava: ['Může ji dělat méně kvalifikovaný pracovník? Oddělte přípravu od samotné operace.', null, null],
    kontrola: ['Je jako samostatná operace nutná? Evidujete nalezené neshody a hledáte příčiny?', null, null]
  };
  function meric(d) {
    const avg = d.kategorie_avg || {};
    const avgC = Math.round((d.avgC || 0) * 10) / 10;
    if (!avgC) return null;
    let nej = null, nejPct = -1;
    Object.keys(MERIC_PRAHY).forEach(k => {
      if (!avg[k]) return;
      const pct = Math.round((Math.round(avg[k] * 10) / 10) / avgC * 100);
      if (pct >= MERIC_PRAHY[k] && pct > nejPct) { nej = k; nejPct = pct; }
    });
    if (!nej) return null;
    const t = MERIC_TIP[nej];
    return { oblast: MERIC_NAZEV[nej] + ' tvoří ' + nejPct + ' % času', text: t[0], odkaz: t[1] ? { url: url(t[1]), cta: t[2] } : null };
  }

  // ---- Časová studie dne: kategorie s největší rezervou ----
  const CS_NAZEV = { haseni: 'Hašení problémů', komunikace: 'Komunikace', administrativa: 'Administrativa', presun: 'Přesun' };
  const CS_TIP = {
    haseni: ['Opakované hašení stejné věci je signál, že se řeší jen důsledek, ne kořenová příčina.', '5x-proc-ai-kouc/', 'Najít příčinu pomocí 5× Proč'],
    komunikace: ['Čas v komunikaci jde často zkrátit: kratší porady, jasnější pravidlo, kdo koho a kdy kontaktuje.', 'kviz-komunikacniho-chaosu/', 'Zjistit úroveň komunikačního chaosu'],
    administrativa: ['Opakující se papírování je typický kandidát na automatizaci nebo delegování, ne na váš čas.', 'kalkulacka-ztrat/', 'Spočítat finanční dopad'],
    presun: ['Zbytečné přesuny jde často vyřešit lepším rozmístěním věcí, lidí nebo informací.', 'spaghetti-free/', 'Nakreslit Spaghetti diagram']
  };
  function casovaStudie(d) {
    const kc = d.kat_cas || {};
    const nej = Object.keys(CS_TIP).filter(k => kc[k] > 0).sort((a, b) => kc[b] - kc[a])[0];
    if (!nej) return null;
    const t = CS_TIP[nej];
    return { oblast: CS_NAZEV[nej], text: t[0], odkaz: { url: url(t[1]), cta: t[2] } };
  }

  // ---- Kalkulačka nákladů skladu ----
  const M2_NAZEV = { zakladni: 'Základní náklad', energie: 'Energie', pojisteni: 'Daně a pojištění', revize: 'Údržba a revize', provoz: 'Provozní služby', odpisy: 'Odpisy vybavení', ostatni: 'Ostatní a rezerva' };
  function kalkulackaM2(d) {
    const kat = d.kategorie || {};
    const nej = Object.keys(M2_NAZEV).filter(k => kat[k] > 0).sort((a, b) => kat[b] - kat[a])[0];
    if (!nej) return null;
    return { oblast: 'Největší položka: ' + M2_NAZEV[nej], text: 'Zjistěte, kdy se u ní naposledy měnila smlouva nebo dodavatel. U energií a ostrahy to bývá před lety.', odkaz: null };
  }

  // ---- Spaghetti diagram Pro ----
  function spaghetti() {
    return { oblast: null, text: 'Vytiskněte diagram a položte ho na stůl tomu, kdo po té trase chodí. Jediná otázka: které kolečko je tady zbytečné? Pak přesuňte tři nejčastěji používané věci blíž a za týden nakreslete trasu znovu.', odkaz: null };
  }

  // ---- 5S pracoviště: první nedokončený krok ----
  const S5 = [['s1', '1S Vytřídit', 'Zbavte se všeho, co tam nepatří.'], ['s2', '2S Uspořádat', 'Každá věc má své místo. Tam kde ji skutečně používáte.'], ['s3', '3S Uklidit', 'Umýt a vyčistit. Úklid je zároveň kontrola.'], ['s4', '4S Udržet pořádek', 'Zapište, jak to má vypadat, aby to tak vypadalo vždy.'], ['s5', '5S Udržovat disciplínu', '5S není projekt, je to návyk. Naplánujte pravidelnou kontrolu.']];
  function pracoviste5s(d) {
    const spl = d.splneno || {};
    const dalsi = S5.find(s => !spl[s[0]]);
    if (!dalsi) return { oblast: 'Všech 5 kroků je hotových', text: 'Naplánujte si kontrolu za pár týdnů a sledujte, jestli pracoviště drží nový standard.', odkaz: { url: url('5S_audit/'), cta: 'Otevřít 5S' } };
    return { oblast: 'Další krok: ' + dalsi[1], text: dalsi[2], odkaz: { url: url('5S_audit/'), cta: 'Pokračovat v 5S' } };
  }
  function kontrola5s(d) {
    const ch = d.checklist || {};
    const NAZ = { c1: 'Nepotřebné věci se nehromadí', c2: 'Věci jsou na svém místě', c3: 'Pracoviště je čisté', c4: 'Označení je stále srozumitelné', c5: 'Standard se dodržuje' };
    const nesplneno = Object.keys(NAZ).filter(k => !ch[k]);
    if (!nesplneno.length) return { oblast: 'Standard drží', text: 'Naplánujte další kontrolu a pokračujte v ní pravidelně.', odkaz: null };
    return { oblast: 'Nedrží: ' + NAZ[nesplneno[0]].toLowerCase(), text: 'Hledejte příčinu. Většinou to není lenost, ale že standard nesedí na skutečný provoz.', odkaz: { url: url('5x-proc-ai-kouc/'), cta: 'Najít příčinu pomocí 5× Proč' } };
  }

  const PODLE_NASTROJE = {
    'mini-audit-skladu': d => miniAudit(d, SKLAD_OTAZKY, SKLAD_KROK, SKLAD_ODKAZ),
    'mini-audit-vyroby': d => miniAudit(d, VYROBA_OTAZKY, VYROBA_KROK, VYROBA_ODKAZ),
    'kviz-komunikacniho-chaosu': kvizChaos,
    'kviz-sklad': kvizSklad,
    '5x-proc': petProc,
    'kalkulacka-ztrat': kalkulackaZtrat,
    'meric-plytvani-pro': meric,
    'casova-studie': casovaStudie,
    'kalkulacka-m2': kalkulackaM2,
    'spaghetti-pro': spaghetti,
    '5s-pracoviste': pracoviste5s,
    '5s': kontrola5s
  };

  function esc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.tokvaPrvniKrok = function (nastroj, data) {
    const fn = PODLE_NASTROJE[nastroj];
    if (!fn) return null;
    try { return fn(data || {}); } catch (e) { return null; }
  };

  // Hotový blok "Jak pokračovat" pro okno s detailem výsledku. Prázdný
  // řetězec, když k výsledku žádný konkrétní krok není.
  window.tokvaPrvniKrokHtml = function (nastroj, data) {
    const k = window.tokvaPrvniKrok(nastroj, data);
    if (!k || !k.text) return '';
    return '<div class="tokva-prvni-krok" style="background:#fdf6e3;border:1px solid #e9a91b;border-radius:10px;padding:12px 14px;margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#2b2b2b;text-align:left;">' +
      '<div style="font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#b07d10;margin-bottom:5px;">Jak pokračovat: doporučený první krok</div>' +
      (k.oblast ? '<div style="font-weight:700;margin-bottom:3px;">' + esc(k.oblast) + '</div>' : '') +
      '<div>' + esc(k.text) + '</div>' +
      (k.odkaz ? '<a href="' + esc(k.odkaz.url) + '" style="display:inline-block;margin-top:8px;color:#b07d10;font-weight:700;text-decoration:none;">' + esc(k.odkaz.cta) + ' →</a>' : '') +
      '</div>';
  };

  // Vloží blok do okna s detailem výsledku v samotném nástroji (historie).
  // Starý blok z dřív otevřeného výsledku nejdřív odstraní.
  window.tokvaVlozitPrvniKrok = function (modal, nastroj, data) {
    if (!modal) return;
    modal.querySelectorAll('.tokva-prvni-krok').forEach(el => el.remove());
    const html = window.tokvaPrvniKrokHtml(nastroj, data);
    if (!html) return;
    const pod = modal.querySelector('#detail-vysledku-datum, #detail-vysledku-meta');
    if (pod) { pod.insertAdjacentHTML('afterend', html); return; }
    const prvni = modal.querySelector('[id^="detail-vysledku-"]');
    if (prvni) prvni.insertAdjacentHTML('beforebegin', html);
  };
})();
