// Jednotné horní menu na veřejných stránkách a v nástrojích (od 22. 10. 2026).
// Pořadí: Otevřít Tokvu zdarma (zlaté) · Všechny nástroje · Můj příběh ·
// Víc o Tokva Pro · Přihlásit se. Odkazy, které stránka nemá, doplní; ty, co
// má, jen přeskládá (zůstanou jim id a chování z auth.js).
// Na mobilu je vidět jen zlaté tlačítko a „Menu“, zbytek se rozbalí.
(function () {
  'use strict';
  var VSTUP = 'https://tokva.cz/vstup/';
  var KATALOG = 'https://tokva.cz/nastroje/';
  var PRIBEH = 'https://tokva.cz/muj-pribeh/';

  var CSS = '' +
    '.menu-zlate{background:#e9a91b !important;border-color:#e9a91b !important;color:#000 !important;font-weight:700 !important;text-decoration:none !important;}' +
    '.menu-zlate:hover{background:#976e12 !important;border-color:#976e12 !important;color:#fff !important;}' +
    '.menu-prepinac{display:none !important;cursor:pointer;font-family:inherit;background:transparent;}' +
    '@media (max-width:700px){' +
      '.menu-kontejner{gap:8px !important;}' +
      '.menu-prepinac{display:inline-flex !important;align-items:center;}' +
      '.menu-sbaleno > :not(.menu-zlate):not(.menu-prepinac){display:none !important;}' +
      '.menu-kontejner:not(.menu-sbaleno){flex-wrap:wrap;}' +
    '}';

  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  function start() {
    var kont = document.querySelector('.topbar-right') || document.querySelector('.nav-right');
    if (!kont || kont.classList.contains('menu-kontejner')) return;
    var deti = Array.prototype.slice.call(kont.children);
    var vzor = deti.filter(function (d) { return d.tagName === 'A'; })[0] || deti[0];
    if (!vzor) return;
    var trida = vzor.className.split(' ').filter(function (c) { return c && c.indexOf('menu-') !== 0; })[0] || '';

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    function odkaz(href, popis, extra) {
      var a = document.createElement('a');
      a.className = trida + (extra ? ' ' + extra : '');
      a.href = href;
      a.textContent = popis;
      return a;
    }
    function najdi(fn) { return deti.filter(fn)[0] || null; }

    var vsechny = najdi(function (d) { return d.id === 'nav-vsechny-nastroje' || text(d) === 'Všechny nástroje'; });
    var pribeh = najdi(function (d) { return text(d) === 'Můj příběh'; });
    var pro = najdi(function (d) { return d.id === 'nav-pro-odkaz' || text(d) === 'Víc o Tokva Pro'; });
    var zlate = najdi(function (d) { return d.classList.contains('menu-zlate'); });
    // Odkaz na přihlášení se všude jmenuje stejně.
    deti.forEach(function (d) {
      if (d.tagName === 'A' && /prihlaseni\.html/.test(d.getAttribute('href') || '') && text(d) === 'Moje Tokva') d.textContent = 'Přihlásit se';
    });

    // Katalog má "Všechny nástroje" jako název stránky vlevo, odkaz nepotřebuje.
    var jeKatalog = /^\/nastroje\/?$/.test(location.pathname);
    if (!vsechny && !jeKatalog) vsechny = odkaz(KATALOG, 'Všechny nástroje');
    if (!pribeh) pribeh = odkaz(PRIBEH, 'Můj příběh');
    if (!zlate) {
      zlate = odkaz(VSTUP, 'Otevřít Tokvu zdarma', 'menu-zlate');
      zlate.addEventListener('click', function () {
        try { if (typeof window.trackTokvaEvent === 'function') window.trackTokvaEvent('vstup_click', { placement: 'menu' }); } catch (e) {}
      });
    }

    // Přeskládat: zlaté na začátek, pak Všechny nástroje, Můj příběh, Pro.
    // Položky přihlášeného (Přehled, Projekty…) a účet zůstanou za nimi.
    kont.insertBefore(zlate, kont.firstChild);
    var za = zlate;
    [vsechny, pribeh, pro].forEach(function (el) {
      if (!el) return;
      kont.insertBefore(el, za.nextSibling);
      za = el;
    });

    // Mobil: tlačítko Menu
    var prep = document.createElement('button');
    prep.type = 'button';
    prep.className = trida + ' menu-prepinac';
    prep.setAttribute('aria-expanded', 'false');
    prep.textContent = 'Menu';
    prep.addEventListener('click', function () {
      var otevreno = kont.classList.toggle('menu-sbaleno') === false;
      prep.setAttribute('aria-expanded', otevreno ? 'true' : 'false');
      prep.textContent = otevreno ? 'Zavřít' : 'Menu';
    });
    kont.insertBefore(prep, zlate.nextSibling);
    kont.classList.add('menu-kontejner', 'menu-sbaleno');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
