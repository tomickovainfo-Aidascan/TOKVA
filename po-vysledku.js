// Stránky nástrojů: co patří až k výsledku, ukázat až s výsledkem (23. 10. 2026).
// Použití: <script src="/po-vysledku.js" data-vysledek="#vysledky"></script>
// a prvkům, které se mají ukázat až po dokončení, dát třídu "po-vysledku".
// Jakmile je výsledek na stránce vidět, dostane <html> třídu "tokva-hotovo".
// Když člověk začne znovu a výsledek zmizí, třída zase zmizí.
// Navíc: časté otázky jako <details class="faq-item"><summary class="faq-q">
// dostanou jednotný vzhled se znaménkem + a −.
(function () {
  'use strict';
  var skript = document.currentScript;
  var vyber = skript ? skript.getAttribute('data-vysledek') : '';

  var css = document.createElement('style');
  css.textContent =
    'html:not(.tokva-hotovo) .po-vysledku{display:none !important;}' +
    'details.faq-item{border-bottom:1px solid #e2e2e2;padding:0 !important;}' +
    'details.faq-item:last-child{border-bottom:none;}' +
    'details.faq-item > summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:14px 0 !important;margin:0 !important;}' +
    'details.faq-item > summary::-webkit-details-marker{display:none;}' +
    'details.faq-item > summary::after{content:"+";font-size:20px;line-height:1;font-weight:400;color:#976e12;flex-shrink:0;}' +
    'details.faq-item[open] > summary::after{content:"\\2212";}' +
    'details.faq-item > summary:hover{color:#976e12;}' +
    'details.faq-item > .faq-a{padding:0 0 16px;}';
  document.head.appendChild(css);

  if (!vyber) return;
  function jeVidet() {
    var el = document.querySelectorAll(vyber);
    for (var i = 0; i < el.length; i++) {
      // Výsledek pod mlhou (brana.js, čeká se na e-mail) se ještě nepočítá.
      if (el[i].closest('.tb-mlha')) continue;
      if (el[i].offsetParent !== null && el[i].getBoundingClientRect().height > 0) return true;
    }
    return false;
  }
  function tik() {
    document.documentElement.classList.toggle('tokva-hotovo', jeVidet());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tik);
  else tik();
  setInterval(tik, 500);
})();
