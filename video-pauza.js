// Ukázková videa, která se sama přehrávají dokola: tlačítko pro pozastavení
// (23. 10. 2026). Kdo má v zařízení zapnuté omezení animací, video se samo
// nespustí a pustí si ho tlačítkem.
(function () {
  'use strict';
  var css = document.createElement('style');
  css.textContent =
    '.video-pauza-obal{display:flex;flex-direction:column;align-items:center;gap:8px;}' +
    '.video-pauza{background:transparent;border:1.5px solid #c9c5bc;color:#111;border-radius:6px;padding:6px 14px;' +
    'font-family:"DM Sans",sans-serif;font-size:12.5px;font-weight:700;cursor:pointer;}' +
    '.video-pauza:hover{border-color:#e9a91b;}' +
    '.video-pauza:focus-visible{outline:3px solid #e9a91b;outline-offset:2px;}';
  document.head.appendChild(css);

  var omezitPohyb = false;
  try { omezitPohyb = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function start() {
    var videa = document.querySelectorAll('video[autoplay][loop]');
    Array.prototype.forEach.call(videa, function (v) {
      if (v.parentElement && v.parentElement.classList.contains('video-pauza-obal')) return;
      var obal = document.createElement('div');
      obal.className = 'video-pauza-obal';
      v.parentNode.insertBefore(obal, v);
      obal.appendChild(v);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'video-pauza';
      obal.appendChild(btn);

      function popis() { btn.textContent = v.paused ? '▶ Přehrát ukázku' : '❚❚ Pozastavit ukázku'; }
      if (omezitPohyb) { v.removeAttribute('autoplay'); v.autoplay = false; try { v.pause(); } catch (e) {} }
      btn.addEventListener('click', function () {
        if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
      v.addEventListener('play', popis);
      v.addEventListener('pause', popis);
      popis();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
