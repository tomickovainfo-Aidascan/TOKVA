// Tlačítko „Přidat ověření do kalendáře“ (8. 11. 2026, upraveno 9. 11. 2026
// podle typu nástroje), bez serveru.
//
// Na Androidu nejde spoléhat na stažený .ics: otevře se jen tehdy, když
// telefon má kalendářovou appku zaregistrovanou na typ text/calendar, což
// není jisté (na rozdíl od iPhonu, kde to po staru otevře Kalendář). Proto
// je první nabídka vždycky odkaz do Google Kalendáře (funguje všude ve
// webovém prohlížeči) a stažení .ics je druhá možnost pro Outlook/Apple
// Calendar na počítači. Na Androidu navíc appka vypíše poznámku pod tlačítky.
//
// Použití: <div data-tokva-pripomenout data-nastroj="meric-free" data-za-dni="10"></div>
//          <script src="/pripomenout-overeni.js"></script>
// data-nastroj: klíč z NASTROJE níž - určuje typ události (měřicí nástroj /
//   audit a kvíz / náklady skladu / akční plán), název a odkaz.
// data-nazev: nepovinné, přepíše název nástroje z tabulky (u Akčního plánu
//   je to vždy název konkrétního úkolu, protože ten appka zná jen ona sama).
// data-za-dni: za kolik dní (výchozí 10, v rozmezí doporučených 1 až 3 týdnů).
(function () {
  'use strict';

  var ZAKLAD = 'https://tokva.cz';

  // typ: meric (měřicí nástroje), audit (audity a kvízy), naklady
  // (Kalkulačka nákladů skladu), akcniplan (úkol v Akčním plánu).
  var NASTROJE = {
    'meric-free':    { typ: 'meric', nazev: 'Měřič plýtvání', url: ZAKLAD + '/nastroje/meric-plytvani-free/' },
    'meric-pro':     { typ: 'meric', nazev: 'Měřič plýtvání Pro', url: ZAKLAD + '/nastroje/meric-plytvani-pro/' },
    'spaghetti-free': { typ: 'meric', nazev: 'Spaghetti diagram', url: ZAKLAD + '/nastroje/spaghetti-free/' },
    'spaghetti-pro':  { typ: 'meric', nazev: 'Spaghetti diagram Pro', url: ZAKLAD + '/nastroje/spaghetti-pro/' },
    'casova-studie':  { typ: 'meric', nazev: 'Časová studie', url: ZAKLAD + '/nastroje/casova-studie/' },
    'kalkulacka-ztrat': { typ: 'meric', nazev: 'Kalkulačka ztrát', url: ZAKLAD + '/nastroje/kalkulacka-ztrat/' },
    // 5× Proč samo nic neměří, ale jeho smysl je ověřit opatření druhým
    // měřením v nástroji, na který analýza mířila - proto taky typ meric.
    '5x-proc':       { typ: 'meric', nazev: '5× Proč: opatření', url: ZAKLAD + '/nastroje/5x-proc-ai-kouc/' },
    'kviz-komunikace': { typ: 'audit', nazev: 'Kvíz komunikačního chaosu', url: ZAKLAD + '/nastroje/kviz-komunikacniho-chaosu/' },
    'mini-audit-sklad': { typ: 'audit', nazev: 'Mini audit skladu', url: ZAKLAD + '/nastroje/mini-audit-skladu/' },
    'mini-audit-vyroba': { typ: 'audit', nazev: 'Mini audit výroby', url: ZAKLAD + '/nastroje/mini-audit-vyroby/' },
    'kviz-sklad':    { typ: 'audit', nazev: 'Kvíz: Jak znáte svůj sklad', url: ZAKLAD + '/nastroje/kviz-jak-znate-svuj-sklad/' },
    // 5S je svou podstatou taky audit (kontrola, jestli pořádek vydržel).
    '5s':            { typ: 'audit', nazev: '5S', url: ZAKLAD + '/nastroje/5S_audit/' },
    'kalkulacka-naklady-skladu': { typ: 'naklady', nazev: 'Kalkulačka nákladů skladu', url: ZAKLAD + '/nastroje/kalkulacka-nakladu-skladu/' },
    'akcni-plan':    { typ: 'akcniplan', nazev: 'úkol', url: ZAKLAD + '/akcni-plan/' }
  };

  var SABLONY = {
    meric: function (nazev, url) {
      return {
        nadpis: 'Tokva: změřit znovu (' + nazev + ')',
        popis: 'Stejný proces, stejná směna, pokud jde, stejný člověk. Porovnejte výsledek s dnešním. Odkaz: ' + url
      };
    },
    audit: function (nazev, url) {
      return {
        nadpis: 'Tokva: zopakovat ' + nazev,
        popis: 'Vyplňte stejný audit znovu a porovnejte výsledek s dnešním. Odkaz: ' + url
      };
    },
    naklady: function (nazev, url) {
      return {
        nadpis: 'Tokva: přepočítat náklady skladu',
        popis: 'Spočítejte náklady znovu s aktuálními čísly a porovnejte s dnešním výpočtem. Odkaz: ' + url
      };
    },
    akcniplan: function (nazev, url) {
      return {
        nadpis: 'Tokva: ověřit úkol (' + nazev + ')',
        popis: 'Zkontrolujte, jestli úkol přinesl to, co jste čekali, a porovnejte se stavem při zavedení. Odkaz: ' + url
      };
    }
  };

  function jeAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
  function zaDni(dny) {
    var d = new Date();
    d.setDate(d.getDate() + dny);
    return d;
  }
  function denPote(d) {
    var p = new Date(d);
    p.setDate(p.getDate() + 1);
    return p;
  }

  // Z data-nastroj (a případně data-nazev jako přepisu) poskládá {nadpis, popis, url}.
  function udalost(box) {
    var klic = box.getAttribute('data-nastroj') || '';
    var zaznam = NASTROJE[klic] || { typ: 'meric', nazev: 'výsledek v Tokvě', url: ZAKLAD };
    var nazev = box.getAttribute('data-nazev') || zaznam.nazev;
    var sablona = SABLONY[zaznam.typ] || SABLONY.meric;
    var e = sablona(nazev, zaznam.url);
    e.url = zaznam.url;
    return e;
  }

  function googleUrl(e, datum) {
    var params = [
      'action=TEMPLATE',
      'text=' + encodeURIComponent(e.nadpis),
      'dates=' + ymd(datum) + '/' + ymd(denPote(datum)),
      'details=' + encodeURIComponent(e.popis)
    ];
    return 'https://calendar.google.com/calendar/render?' + params.join('&');
  }

  // RFC 5545: zpětné lomítko, čárka, středník a nový řádek se v textových
  // polích (SUMMARY, DESCRIPTION) escapují, jinak si je někteří kalendáři
  // (hlavně na Androidu) vyloží jako oddělovače a text uříznou.
  function icsText(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
  }

  function icsUrl(e, datum) {
    var radky = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tokva//Pripomenuti overeni//CS', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:tokva-overeni-' + Date.now() + '@tokva.cz',
      'DTSTAMP:' + ymd(new Date()) + 'T000000Z',
      'DTSTART;VALUE=DATE:' + ymd(datum),
      'DTEND;VALUE=DATE:' + ymd(denPote(datum)),
      'SUMMARY:' + icsText(e.nadpis),
      'DESCRIPTION:' + icsText(e.popis),
      'URL:' + e.url,
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(radky.join('\r\n'));
  }

  var CSS =
    '.pripomenout{margin:14px 0;padding:14px 16px;border:1px solid var(--border,#d9d4c7);border-radius:10px;background:var(--white,#fff);}' +
    '.pripomenout-text{font-size:13.5px;color:var(--mid,#4b5563);line-height:1.6;margin:0 0 10px;}' +
    '.pripomenout-tlacitka{display:flex;gap:10px;flex-wrap:wrap;}' +
    '.pripomenout-btn{display:inline-block;font:inherit;font-size:13.5px;font-weight:700;text-decoration:none;padding:9px 14px;border-radius:8px;}' +
    '.pripomenout-btn-hlavni{background:var(--gold,#e9a91b);color:#111;}' +
    '.pripomenout-btn-druhy{border:1.5px solid var(--gold-dark,#976e12);color:var(--gold-dark,#976e12);background:#fff;}' +
    '.pripomenout-pozn{font-size:12px;color:var(--light,#6b7280);line-height:1.5;margin:10px 0 0;}';

  function vlozitStyl() {
    if (document.getElementById('pripomenout-styl')) return;
    var st = document.createElement('style');
    st.id = 'pripomenout-styl';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function vykreslit(box) {
    var dny = parseInt(box.getAttribute('data-za-dni'), 10);
    if (!dny) dny = 10;
    var datum = zaDni(dny);
    var android = jeAndroid();
    var e = udalost(box);

    box.classList.add('pripomenout');
    box.innerHTML =
      '<p class="pripomenout-text">Ať to nezapadne: přidejte si připomínku na ověření za ' + dny + ' dní.</p>' +
      '<div class="pripomenout-tlacitka">' +
        '<a class="pripomenout-btn pripomenout-btn-hlavni" href="' + googleUrl(e, datum) + '" target="_blank" rel="noopener">Přidat do Google Kalendáře</a>' +
        '<a class="pripomenout-btn pripomenout-btn-druhy" href="' + icsUrl(e, datum) + '" download="overit-' + dny + '-dni.ics">Stáhnout do kalendáře (.ics)</a>' +
      '</div>' +
      (android ? '<p class="pripomenout-pozn">Na Androidu doporučujeme Google Kalendář nahoře, stažený soubor .ics se nemusí otevřít (závisí na kalendářové appce v telefonu).</p>' : '');
  }

  function start() {
    var mista = document.querySelectorAll('[data-tokva-pripomenout]');
    if (!mista.length) return;
    vlozitStyl();
    mista.forEach(vykreslit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Pro appky, co výsledek (a tedy i tenhle box) přidávají do stránky až
  // po načtení (5S, 5× Proč, Akční plán): zavolat vykreslit(prvek) rovnou.
  window.tokvaPripomenoutOvereni = { vykreslit: function (box) { vlozitStyl(); vykreslit(box); } };
})();
