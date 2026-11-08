// Tlačítko „Přidat ověření do kalendáře“ (8. 11. 2026), bez serveru.
//
// Na Androidu nejde spoléhat na stažený .ics: otevře se jen tehdy, když
// telefon má kalendářovou appku zaregistrovanou na typ text/calendar, což
// není jisté (na rozdíl od iPhonu, kde to po staru otevře Kalendář). Proto
// je první nabídka vždycky odkaz do Google Kalendáře (funguje všude ve
// webovém prohlížeči) a stažení .ics je druhá možnost pro Outlook/Apple
// Calendar na počítači. Na Androidu navíc appka vypíše poznámku pod tlačítky.
//
// Použití: <div data-tokva-pripomenout data-nazev="Měřič plýtvání" data-za-dni="10"></div>
//          <script src="/pripomenout-overeni.js"></script>
// data-za-dni: za kolik dní (výchozí 10, tedy uprostřed doporučených 1 až 2 týdnů).
(function () {
  'use strict';

  var POPIS = 'Změřte znovu: stejný proces, stejná směna, pokud jde, stejný člověk. Porovnejte výsledek s dnešním měřením v Tokvě.';

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

  function googleUrl(nazev, datum) {
    var params = [
      'action=TEMPLATE',
      'text=' + encodeURIComponent('Ověřit: ' + nazev),
      'dates=' + ymd(datum) + '/' + ymd(denPote(datum)),
      'details=' + encodeURIComponent(POPIS)
    ];
    return 'https://calendar.google.com/calendar/render?' + params.join('&');
  }

  function icsUrl(nazev, datum) {
    var radky = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tokva//Pripomenuti overeni//CS', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:tokva-overeni-' + Date.now() + '@tokva.cz',
      'DTSTAMP:' + ymd(new Date()) + 'T000000Z',
      'DTSTART;VALUE=DATE:' + ymd(datum),
      'DTEND;VALUE=DATE:' + ymd(denPote(datum)),
      'SUMMARY:Ověřit: ' + nazev,
      'DESCRIPTION:' + POPIS,
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
    var nazev = box.getAttribute('data-nazev') || 'výsledek v Tokvě';
    var dny = parseInt(box.getAttribute('data-za-dni'), 10);
    if (!dny) dny = 10;
    var datum = zaDni(dny);
    var android = jeAndroid();

    box.className = 'pripomenout';
    box.innerHTML =
      '<p class="pripomenout-text">Ať to nezapadne: přidejte si připomínku na ověření za ' + dny + ' dní.</p>' +
      '<div class="pripomenout-tlacitka">' +
        '<a class="pripomenout-btn pripomenout-btn-hlavni" href="' + googleUrl(nazev, datum) + '" target="_blank" rel="noopener">Přidat do Google Kalendáře</a>' +
        '<a class="pripomenout-btn pripomenout-btn-druhy" href="' + icsUrl(nazev, datum) + '" download="overit-' + dny + '-dni.ics">Stáhnout do kalendáře (.ics)</a>' +
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
  // po načtení (5S, dalsi-krok.js): zavolat vykreslit(prvek) rovnou.
  window.tokvaPripomenoutOvereni = { vykreslit: function (box) { vlozitStyl(); vykreslit(box); } };
})();
