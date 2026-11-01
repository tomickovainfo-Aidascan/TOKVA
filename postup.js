// Cesta člověka napříč nástroji Tokvy (1. 11. 2026).
// Každý nástroj si do prohlížeče zapíše, co zjistil a co doporučil. Další
// nástroj si to přečte, porovná se svým výsledkem a doporučí, co z cesty
// ještě zbývá. Cesta platí 30 dní, nebo dokud člověk neklikne na
// „Začít novou cestu“. Nic se neposílá na server.
// Použití: <script src="/postup.js"></script> v hlavičce nástroje.
// Nástroj bez vlastního zápisu se označí jako hotový sám, jakmile ukáže
// výsledek (třída tokva-hotovo z po-vysledku.js).
//   tokvaPostup.zapsat({ zjisteni:['chuze'], doporuceno:['kalkulacka-ztrat'], data:{} })
//   tokvaPostup.hotovo('spaghetti')   // true/false (bez -free/-pro)
//   tokvaPostup.krok('kalkulacka-ztrat')   // zápis nástroje nebo null
//   tokvaPostup.predchozi()   // poslední jiný nástroj se zjištěním
//   tokvaPostup.radek(dalsi)   // HTML řádku „Vaše cesta“
(function () {
  'use strict';
  var KLIC = 'tokva_postup', PLATNOST = 30 * 864e5;
  var NAZVY = {
    'mini-audit-skladu': 'Mini audit skladu', 'mini-audit-vyroby': 'Mini audit výroby',
    'kviz-jak-znate-svuj-sklad': 'Kvíz Jak znáte svůj sklad', 'kviz-komunikacniho-chaosu': 'Kvíz komunikačního chaosu',
    'kalkulacka-ztrat': 'Kalkulačka ztrát', 'kalkulacka-nakladu-skladu': 'Kalkulačka nákladů skladu',
    'spaghetti': 'Spaghetti diagram', 'meric-plytvani': 'Měřič plýtvání', 'casova-studie': 'Časová studie',
    '5x-proc-ai-kouc': '5× Proč', '5S_audit': '5S'
  };
  function druh(slozka) { return String(slozka || '').replace(/-(free|pro)$/, ''); }
  var m = /\/nastroje\/([^\/?#]+)/.exec(location.pathname);
  var tady = m ? druh(m[1]) : '';

  function nacist() {
    try {
      var o = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (!o || !o.kroky || !(Date.now() - o.zacatek < PLATNOST)) return { zacatek: Date.now(), kroky: [] };
      return o;
    } catch (e) { return { zacatek: Date.now(), kroky: [] }; }
  }
  function ulozit(o) { try { localStorage.setItem(KLIC, JSON.stringify(o)); } catch (e) {} }

  var api = {
    tady: tady,
    nazev: function (s) { return NAZVY[druh(s)] || s; },
    druh: druh,
    zapsat: function (k) {
      if (!tady) return;
      var o = nacist(), stary = null;
      o.kroky = o.kroky.filter(function (x) { if (x.nastroj === tady) { stary = x; return false; } return true; });
      var novy = { nastroj: tady, cas: Date.now() };
      novy.zjisteni = (k && k.zjisteni) || (stary && stary.zjisteni) || [];
      novy.doporuceno = ((k && k.doporuceno) || (stary && stary.doporuceno) || []).map(druh);
      novy.data = (k && k.data) || (stary && stary.data) || {};
      o.kroky.push(novy);
      ulozit(o);
    },
    hotovo: function (s) { s = druh(s); return nacist().kroky.some(function (x) { return x.nastroj === s; }); },
    krok: function (s) { s = druh(s); var k = nacist().kroky.filter(function (x) { return x.nastroj === s; }); return k[0] || null; },
    kroky: function () { return nacist().kroky; },
    predchozi: function () {
      var k = nacist().kroky.filter(function (x) { return x.nastroj !== tady && x.zjisteni && x.zjisteni.length; });
      return k.length ? k[k.length - 1] : null;
    },
    zbyva: function () {
      var o = nacist(), hot = {}, ven = [];
      o.kroky.forEach(function (x) { hot[x.nastroj] = 1; });
      hot[tady] = 1;
      o.kroky.forEach(function (x) { if (x.nastroj === tady) return; (x.doporuceno || []).forEach(function (d) { if (!hot[d] && ven.indexOf(d) < 0) ven.push(d); }); });
      return ven;
    },
    novy: function () { try { localStorage.removeItem(KLIC); } catch (e) {} },
    // dalsi = pole nástrojů, které přijdou po tomhle (jen pro zobrazení)
    radek: function (dalsi) {
      var kroky = nacist().kroky.filter(function (x) { return x.nastroj !== tady; });
      var casti = kroky.map(function (x) { return '<span class="postup-hotovo">' + api.nazev(x.nastroj) + ' ✓</span>'; });
      if (tady) casti.push('<span class="postup-ted">' + api.nazev(tady) + (api.hotovo(tady) ? ' ✓' : '') + '</span>');
      (dalsi || []).forEach(function (d) { d = druh(d); if (d !== tady && !kroky.some(function (x) { return x.nastroj === d; })) casti.push('<span class="postup-dalsi">' + api.nazev(d) + '</span>'); });
      if (casti.length < 2) return '';
      return '<div class="postup-radek"><span class="postup-nadpis">Vaše cesta:</span> ' + casti.join(' <span class="postup-sipka">→</span> ') +
        ' <a href="#" class="postup-novy" onclick="tokvaPostup.novy();location.reload();return false;">Začít novou cestu</a></div>';
    }
  };
  window.tokvaPostup = api;

  var css = document.createElement('style');
  css.textContent = '.postup-radek{font-size:12.5px;line-height:1.7;color:#545454;margin:0 0 12px;}' +
    '.postup-nadpis{font-weight:700;color:#111;}.postup-hotovo{color:#545454;}.postup-ted{font-weight:700;color:#976e12;}' +
    '.postup-dalsi{color:#8a8a8a;}.postup-sipka{color:#b8b8b8;margin:0 2px;}' +
    '.postup-novy{margin-left:6px;color:#976e12;font-weight:600;white-space:nowrap;}';
  (document.head || document.documentElement).appendChild(css);

  // Nástroj bez vlastního zápisu: hotovo, jakmile je vidět výsledek.
  if (tady) {
    var hlidac = new MutationObserver(function () {
      if (window.tokvaPostupVlastni) { hlidac.disconnect(); return; }
      if (document.documentElement.classList.contains('tokva-hotovo')) {
        if (!api.hotovo(tady)) api.zapsat({});
        hlidac.disconnect();
      }
    });
    hlidac.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
})();
