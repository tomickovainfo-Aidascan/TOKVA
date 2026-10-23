// Cookies lišta a spuštění Google Analytics jen po souhlasu (23. 10. 2026).
// Pro stránky, které vlastní lištu nemají. Když stránka lištu má (#cookies-bar),
// tenhle skript nic nedělá, ať se nic nespouští dvakrát.
(function () {
  'use strict';
  if (document.getElementById('cookies-bar')) return;
  var GA = 'G-NJWW5ZX4J9';
  var CSS = ".cookies-bar{position:fixed;bottom:0;left:0;right:0;background:#111;border-top:2px solid #e9a91b;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;z-index:9999;font-family:\"DM Sans\",sans-serif;}\n.cookies-bar p{font-size:13px;color:rgba(255,255,255,.6);line-height:1.6;margin:0;flex:1;min-width:200px;}\n.cookies-bar a{color:#e9a91b;text-decoration:none;}\n.cookies-bar a:hover{text-decoration:underline;}\n.cookies-btns{display:flex;gap:8px;flex-shrink:0;}\n.cookies-ok{background:#e9a91b;color:#000;border:none;border-radius:4px;padding:8px 18px;font-family:\"DM Sans\",sans-serif;font-size:13px;font-weight:700;cursor:pointer;}\n.cookies-ok:hover{background:#c48e10;}\n.cookies-no{background:transparent;color:rgba(255,255,255,.4);border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:8px 14px;font-family:\"DM Sans\",sans-serif;font-size:13px;cursor:pointer;}\n.cookies-no:hover{color:rgba(255,255,255,.7);}\n\n/* Cookies li\u0161ta (23. 10.): \u010diteln\u011bj\u0161\u00ed text, Odm\u00edtnout jako norm\u00e1ln\u00ed tla\u010d\u00edtko, na mobilu ni\u017e\u0161\u00ed */\n#cookies-bar{padding:12px 20px !important;gap:10px 16px !important;}\n#cookies-bar p{color:rgba(255,255,255,.85) !important;font-size:13px !important;line-height:1.5 !important;}\n#cookies-bar .cookies-no,#cookies-bar .cookies-ok{border-radius:6px !important;padding:9px 18px !important;font-size:13.5px !important;font-weight:700 !important;}\n#cookies-bar .cookies-no{background:transparent !important;color:#fff !important;border:1.5px solid rgba(255,255,255,.6) !important;}\n#cookies-bar .cookies-no:hover{background:rgba(255,255,255,.12) !important;}\n#cookies-bar .cookies-ok{border:1.5px solid #e9a91b !important;}\n@media (max-width:600px){\n#cookies-bar{padding:10px 14px !important;}\n#cookies-bar p{min-width:0 !important;flex:1 1 100% !important;font-size:12.5px !important;}\n#cookies-bar .cookies-btns{width:100%;}\n#cookies-bar .cookies-btns button{flex:1;}\n}";

  window.spustitGA = function () {
    if (window.__tokvaGA) return;
    window.__tokvaGA = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA);
  };
  window.cookiesSouhlasit = function () {
    try { localStorage.setItem('cookies_souhlas', 'ano'); } catch (e) {}
    var b = document.getElementById('cookies-bar'); if (b) b.style.display = 'none';
    window.spustitGA();
  };
  window.cookiesOdmitnout = function () {
    try { localStorage.setItem('cookies_souhlas', 'ne'); } catch (e) {}
    var b = document.getElementById('cookies-bar'); if (b) b.style.display = 'none';
  };

  function start() {
    var souhlas = null;
    try { souhlas = localStorage.getItem('cookies_souhlas'); } catch (e) {}
    if (souhlas === 'ano') { window.spustitGA(); return; }
    if (souhlas === 'ne') return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var bar = document.createElement('div');
    bar.className = 'cookies-bar';
    bar.id = 'cookies-bar';
    bar.innerHTML = '<p>Používám analytické cookies (Google Analytics) k měření návštěvnosti. <a href="https://tokva.cz/ochrana-osobnich-udaju/">Víc v zásadách</a></p>' +
      '<div class="cookies-btns"><button type="button" class="cookies-no">Odmítnout</button><button type="button" class="cookies-ok">Souhlasím</button></div>';
    bar.querySelector('.cookies-no').onclick = window.cookiesOdmitnout;
    bar.querySelector('.cookies-ok').onclick = window.cookiesSouhlasit;
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
