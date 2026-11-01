// Které nástroje Tokvy člověk prošel za posledních 24 hodin (1. 11. 2026).
// Aby ho další krok po výsledku neposlal zpátky tam, odkud přišel.
// Použití: <script src="/prosle.js"></script> v hlavičce každého nástroje.
// Pamatuje si složku nástroje (např. spaghetti-free) a čas. Bere i stránku,
// ze které člověk přišel (document.referrer), když je z tokva.cz.
// window.tokvaProsle() vrátí seznam složek, např. ["spaghetti-free"].
(function () {
  'use strict';
  var KLIC = 'tokva_prosle', DEN = 864e5;
  function nacti() {
    try { var o = JSON.parse(localStorage.getItem(KLIC) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }
  function slozka(cesta) { var m = /\/nastroje\/([^\/?#]+)/.exec(cesta || ''); return m ? m[1] : ''; }
  var o = nacti(), ted = Date.now();
  Object.keys(o).forEach(function (k) { if (!(ted - o[k] < DEN)) delete o[k]; });
  var tady = slozka(location.pathname);
  if (tady) o[tady] = ted;
  try {
    if (document.referrer) {
      var r = new URL(document.referrer);
      var odkud = r.host === location.host ? slozka(r.pathname) : '';
      if (odkud && odkud !== tady) o[odkud] = o[odkud] || ted;
    }
  } catch (e) {}
  try { localStorage.setItem(KLIC, JSON.stringify(o)); } catch (e) {}
  window.tokvaProsle = function () {
    var x = nacti(), t = Date.now();
    return Object.keys(x).filter(function (k) { return t - x[k] < DEN; });
  };
})();
