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
  // data-jen-sbalit: stránky po přihlášení (Přehled, Projekty…) – nic
  // nepřidávat ani nepřeskládávat, jen na mobilu schovat položky pod Menu.
  var skript = document.currentScript;
  var jenSbalit = !!(skript && skript.hasAttribute('data-jen-sbalit'));

  var CSS = '' +
    '.menu-zlate{background:#e9a91b !important;border-color:#e9a91b !important;color:#000 !important;font-weight:700 !important;text-decoration:none !important;}' +
    '.menu-zlate:hover{background:#976e12 !important;border-color:#976e12 !important;color:#fff !important;}' +
    '.menu-kontejner{gap:8px;}' +
    // Kdo má Tokva Pro: bez Otevřít Tokvu zdarma, Můj příběh a Víc o Tokva Pro.
    'html.tokva-ma-pro .menu-zlate,html.tokva-ma-pro .menu-pribeh,html.tokva-ma-pro #nav-pro-odkaz,html.tokva-ma-pro .menu-pro{display:none !important;}' +
    '.menu-prepinac{display:none !important;cursor:pointer;font-family:inherit;background:transparent;}' +
    // Jednotný vzhled lišty a tlačítek na webu i v nástrojích (23. 10.).
    // Černá lišta = web, bílá = nástroje. Barvy zůstávají, velikosti jsou stejné.
    '.menu-lista{min-height:64px;box-sizing:border-box;padding-top:12px !important;padding-bottom:12px !important;}' +
    '.menu-lista .brand,.menu-lista .nav-brand{font-size:16px !important;}' +
    '.menu-kontejner > a,.menu-kontejner > button,.menu-kontejner > span{font-family:"DM Sans",sans-serif !important;font-size:13px !important;font-weight:700 !important;line-height:1.35 !important;padding:8px 16px !important;border-radius:6px !important;border-width:1.5px !important;}' +
    '.menu-lista-svetla .menu-kontejner > a:not(.menu-zlate),.menu-lista-svetla .menu-kontejner > button{color:#111 !important;background:#fff !important;border-color:#c9c5bc !important;border-style:solid !important;}' +
    '.menu-lista-svetla .menu-kontejner > a:not(.menu-zlate):hover,.menu-lista-svetla .menu-kontejner > button:hover{border-color:#e9a91b !important;}' +
    '.menu-lista-svetla .menu-kontejner > .nav-aktivni{border-color:#e9a91b !important;}' +
    '@media (max-width:700px){' +
      '.menu-lista{min-height:58px;padding-top:10px !important;padding-bottom:10px !important;padding-left:16px !important;padding-right:16px !important;}' +
      '.menu-kontejner > a,.menu-kontejner > button{padding:8px 14px !important;}' +
      '.menu-kontejner{gap:8px !important;}' +
      '.menu-prepinac{display:inline-flex !important;align-items:center;}' +
      '.menu-sbaleno > :not(.menu-zlate):not(.menu-prepinac){display:none !important;}' +
      '.menu-kontejner:not(.menu-sbaleno){flex-wrap:wrap;}' +
    '}';

  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  // Pro uživatel (přihlášený a auth.js si zapamatoval Pro): třídu nastavit
  // hned, ať menu neblikne. auth.js ji pak případně opraví.
  try {
    if (localStorage.getItem('sb-uiqjzeubhhnzspkoekxx-auth-token') && localStorage.getItem('tokva_ma_pro') === '1') document.documentElement.classList.add('tokva-ma-pro');
  } catch (e) {}

  // Odkaz „Přeskočit na hlavní obsah“, ukáže se až při prvním stisku Tab.
  function preskocit() {
    if (document.querySelector('.preskocit-obsah')) return;
    var cil = document.querySelector('main, #main, .main');
    if (!cil) return;
    if (!cil.id) cil.id = 'hlavni-obsah';
    if (!cil.hasAttribute('tabindex')) cil.setAttribute('tabindex', '-1');
    var st = document.createElement('style');
    st.textContent = '.preskocit-obsah{position:absolute;left:12px;top:-60px;z-index:10000;background:#e9a91b;color:#000;font-weight:700;padding:10px 16px;border-radius:6px;text-decoration:none;font-family:"DM Sans",sans-serif;}' +
      '.preskocit-obsah:focus{top:12px;}' + '#' + cil.id + ':focus{outline:none;}';
    document.head.appendChild(st);
    var a = document.createElement('a');
    a.className = 'preskocit-obsah';
    a.href = '#' + cil.id;
    a.textContent = 'Přeskočit na hlavní obsah';
    document.body.insertBefore(a, document.body.firstChild);
  }

  function start() {
    preskocit();
    var kont = document.querySelector('.topbar-right') || document.querySelector('.nav-right');
    if (!kont || kont.classList.contains('menu-kontejner')) return;
    var deti = Array.prototype.slice.call(kont.children);
    var vzor = deti.filter(function (d) { return d.tagName === 'A'; })[0] || deti[0];
    if (!vzor) return;
    var trida = vzor.className.split(' ').filter(function (c) { return c && c.indexOf('menu-') !== 0; })[0] || '';

    // Lišta (rodič kontejneru) dostane společnou třídu, světlá i druhou.
    var lista = kont.parentElement;
    if (lista) {
      lista.classList.add('menu-lista');
      try {
        var bg = getComputedStyle(lista).backgroundColor.match(/\d+/g);
        if (bg && (+bg[0] + +bg[1] + +bg[2]) > 600) lista.classList.add('menu-lista-svetla');
      } catch (e) {}
    }

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
    function pridatPrepinac(zaCo) {
      // Mobil: tlačítko Menu, ostatní položky se schovají.
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
      // Escape rozbalené menu zase sbalí a vrátí kurzor na tlačítko Menu.
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || kont.classList.contains('menu-sbaleno')) return;
        if (getComputedStyle(prep).display === 'none') return;
        kont.classList.add('menu-sbaleno');
        prep.setAttribute('aria-expanded', 'false');
        prep.textContent = 'Menu';
        try { prep.focus(); } catch (er) {}
      });
      kont.insertBefore(prep, zaCo ? zaCo.nextSibling : kont.firstChild);
      kont.classList.add('menu-kontejner', 'menu-sbaleno');
    }

    if (jenSbalit) {
      pridatPrepinac(null);
      return;
    }

    var vsechny = najdi(function (d) { return d.id === 'nav-vsechny-nastroje' || text(d) === 'Všechny nástroje'; });
    var pribeh = najdi(function (d) { return text(d) === 'Můj příběh'; });
    var pro = najdi(function (d) { return d.id === 'nav-pro-odkaz' || text(d) === 'Víc o Tokva Pro'; });
    var zlate = najdi(function (d) { return d.classList.contains('menu-zlate'); });
    // Odkaz na přihlášení se všude jmenuje stejně.
    deti.forEach(function (d) {
      if (d.tagName === 'A' && /prihlaseni\.html/.test(d.getAttribute('href') || '') && text(d) === 'Moje Tokva') d.textContent = 'Přihlásit se';
    });
    // Přihlášený na stránce, která si účet sama neřeší (statický odkaz
    // „Přihlásit se“): místo přihlášení odkaz na Přehled.
    var maToken = false;
    try { maToken = !!localStorage.getItem('sb-uiqjzeubhhnzspkoekxx-auth-token'); } catch (e) {}
    if (maToken) {
      deti.forEach(function (d) {
        if (d.tagName === 'A' && d.id !== 'nav-ucet-btn' && /prihlaseni\.html/.test(d.getAttribute('href') || '')) {
          d.textContent = 'Přehled';
          d.href = 'https://tokva.cz/moje-tokva/';
        }
      });
    }

    // Katalog má "Všechny nástroje" jako název stránky vlevo, odkaz nepotřebuje.
    var jeKatalog = /^\/nastroje\/?$/.test(location.pathname);
    if (!vsechny && !jeKatalog) vsechny = odkaz(KATALOG, 'Všechny nástroje');
    if (!pribeh) pribeh = odkaz(PRIBEH, 'Můj příběh');
    pribeh.classList.add('menu-pribeh');
    if (pro) pro.classList.add('menu-pro');
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

    pridatPrepinac(zlate);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
