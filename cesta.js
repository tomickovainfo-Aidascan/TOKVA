// Cesta oblastí (1. 11. 2026): místo dlouhého seznamu situací se ptá po jedné.
// Ano = doporučený nástroj, další možnosti a cesta zpět. Ne = další situace.
// Skládá se z bloků .krok-block, které stránka už má. Celý seznam zůstává
// pod cestou v rozbalovacím bloku (pro ty, co chtějí vidět všechno, i pro Google).
// Použití: <div id="cesta"></div> a <script src="/cesta.js"></script>
(function () {
  'use strict';
  var misto = document.getElementById('cesta');
  if (!misto) return;
  var bloky = [].slice.call(document.querySelectorAll('.krok-block'));
  if (!bloky.length) return;

  var ROZCESTI = 'https://tokva.cz/vstup/';
  var KDE_ZACIT = 'https://tokva.cz/kde-zacit/';
  var KATALOG = 'https://tokva.cz/nastroje/';

  function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Situace z bloků. „Nevím, kde je problém“ není otázka, je to záchrana na konci.
  var situace = [], zachrana = null;
  bloky.forEach(function (b) {
    var s = {
      nazev: txt(b.querySelector('.krok-head h2')),
      // data-postup na .krok-block: nástroje jdou po sobě (Potom:), jinak jsou to možnosti (Nebo zkuste:)
      postup: b.hasAttribute('data-postup'),
      popis: txt(b.querySelector('.krok-head p')),
      nastroje: [].slice.call(b.querySelectorAll('a.krok-row')).map(function (a) {
        return { href: a.getAttribute('href'), jmeno: txt(a.querySelector('.krok-name')), prinos: txt(a.querySelector('.krok-benefit')), pro: /🔒/.test(a.textContent) };
      }).filter(function (n) { return n.href && n.jmeno; })
    };
    if (!s.nazev || !s.nastroje.length) return;
    if (/^Nevím, kde je problém/i.test(s.nazev)) zachrana = s; else situace.push(s);
  });
  if (!situace.length) return;

  var css = document.createElement('style');
  css.textContent =
    '.cesta{scroll-margin-top:84px;background:#fff;border:1.5px solid var(--border2,#e8e6e0);border-radius:16px;padding:26px 28px;margin:0 0 30px;box-shadow:0 8px 24px rgba(0,0,0,.05);}' +
    '.cesta-krok{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold-dark,#976e12);margin-bottom:10px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;}' +
    '.cesta-tecky{display:flex;gap:5px;align-items:center;}.cesta-tecky i{width:8px;height:8px;border-radius:50%;background:#e8e6e0;}.cesta-tecky i.on{background:var(--gold,#e9a91b);}' +
    '.cesta h2{font-family:Poppins,sans-serif;font-weight:800;font-size:23px;line-height:1.25;margin:0 0 8px;}' +
    '.cesta-popis{font-size:15.5px;color:var(--mid,#545454);margin:0 0 20px;max-width:620px;}' +
    '.cesta-volby{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;}' +
    '.cesta-ano,.cesta-ne,.cesta-start{font-family:Poppins,sans-serif;font-weight:800;font-size:15px;border-radius:10px;padding:13px 22px;cursor:pointer;border:2px solid var(--gold,#e9a91b);text-decoration:none;display:inline-block;}' +
    '.cesta-ano,.cesta-start{background:var(--gold,#e9a91b);color:#000;}.cesta-ano:hover,.cesta-start:hover{background:var(--gold-dark,#976e12);border-color:var(--gold-dark,#976e12);color:#fff;}' +
    '.cesta-ne{background:#fff;color:var(--dark,#111);border-color:#d6d3cb;}.cesta-ne:hover{border-color:var(--gold,#e9a91b);}' +
    '.cesta-odkazy{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;margin-top:6px;}' +
    '.cesta-odkazy a,.cesta-odkazy button{color:var(--mid,#545454);font-weight:700;text-decoration:none;background:none;border:none;padding:0;font:inherit;font-weight:700;cursor:pointer;}' +
    '.cesta-odkazy a:hover,.cesta-odkazy button:hover{color:var(--gold-dark,#976e12);}' +
    '.cesta-hlavni{display:block;background:var(--gold-light,#fdf3d9);border:1.5px solid var(--gold,#e9a91b);border-radius:12px;padding:18px 20px;margin:4px 0 16px;text-decoration:none;color:var(--dark,#111);}' +
    '.cesta-hlavni b{display:block;font-family:Poppins,sans-serif;font-size:19px;font-weight:800;margin-bottom:4px;}' +
    '.cesta-hlavni span{display:block;font-size:14.5px;color:var(--mid,#545454);margin-bottom:12px;}' +
    '.cesta-hlavni em{font-style:normal;display:inline-block;background:#111;color:#fff;font-family:Poppins,sans-serif;font-weight:800;font-size:14px;padding:9px 16px;border-radius:8px;}' +
    '.cesta-hlavni:hover em{background:var(--gold-dark,#976e12);}' +
    '.cesta-alt-nadpis{font-size:13px;font-weight:700;color:var(--mid,#545454);margin:0 0 8px;}' +
    '.cesta-alt{display:flex;flex-direction:column;gap:8px;margin-bottom:16px;}' +
    '.cesta-alt a{display:flex;justify-content:space-between;gap:14px;align-items:center;border:1.5px solid var(--border2,#e8e6e0);border-radius:10px;padding:11px 14px;text-decoration:none;color:var(--dark,#111);font-size:14px;}' +
    '.cesta-alt a:hover{border-color:var(--gold,#e9a91b);}.cesta-alt a b{font-family:Poppins,sans-serif;font-size:14px;white-space:nowrap;}' +
    '.cesta-vse{margin:6px 0 30px;}.cesta-vse>summary{cursor:pointer;font-weight:700;color:var(--gold-dark,#976e12);font-size:14.5px;margin-bottom:22px;list-style:none;}' +
    '.cesta-vse>summary::-webkit-details-marker{display:none;}.cesta-vse>summary::after{content:" ↓";}.cesta-vse[open]>summary::after{content:" ↑";}' +
    '@media (max-width:600px){.cesta{padding:20px 16px;}.cesta h2{font-size:20px;}.cesta-volby{flex-direction:column;}.cesta-ano,.cesta-ne{width:100%;text-align:center;}.cesta-alt a{flex-direction:column;align-items:flex-start;gap:2px;}.cesta-alt a b{white-space:normal;}}';
  document.head.appendChild(css);

  // Původní seznam schovat pod rozbalovací odkaz (obsah zůstává na stránce).
  var vse = document.createElement('details');
  vse.className = 'cesta-vse';
  vse.innerHTML = '<summary>Zobrazit všechny situace a nástroje najednou</summary>';
  bloky[0].parentNode.insertBefore(vse, bloky[0]);
  bloky.forEach(function (b) { vse.appendChild(b); });

  var box = document.createElement('div');
  box.className = 'cesta';
  box.setAttribute('aria-live', 'polite');
  misto.appendChild(box);

  var i = 0;
  function sled(udalost, extra) {
    try { if (typeof window.trackTokvaEvent === 'function') window.trackTokvaEvent(udalost, extra || {}); } catch (e) {}
  }
  function tecky() {
    return '<span class="cesta-tecky" aria-hidden="true">' + situace.map(function (_, j) { return '<i class="' + (j <= i ? 'on' : '') + '"></i>'; }).join('') + '</span>';
  }
  function odkazy(zpet) {
    return '<div class="cesta-odkazy">' +
      (zpet ? '<button type="button" data-akce="zpet">← Předchozí otázka</button>' : '') +
      '<a href="' + ROZCESTI + '">Řeším něco jiného, zpět na rozcestí</a></div>';
  }
  function otazka() {
    var s = situace[i];
    box.innerHTML =
      '<div class="cesta-krok"><span>Platí to u vás? ' + (i + 1) + ' z ' + situace.length + '</span>' + tecky() + '</div>' +
      '<h2>' + esc(s.nazev) + '</h2><p class="cesta-popis">' + esc(s.popis) + '</p>' +
      '<div class="cesta-volby"><button type="button" class="cesta-ano" data-akce="ano">Ano, tohle řešíme</button>' +
      '<button type="button" class="cesta-ne" data-akce="ne">Ne, další</button></div>' + odkazy(i > 0);
  }
  function doporuceni(s, nadpis) {
    var hlavni = s.nastroje[0], dalsi = s.nastroje.slice(1);
    box.innerHTML =
      '<div class="cesta-krok"><span>Doporučuji začít tady</span></div>' +
      '<h2>' + esc(nadpis || s.nazev) + '</h2>' +
      '<a class="cesta-hlavni" href="' + esc(hlavni.href) + '" data-nastroj="' + esc(hlavni.jmeno) + '"><b>' + esc(hlavni.jmeno) + (hlavni.pro ? ' (Tokva Pro)' : '') + '</b><span>' + esc(hlavni.prinos) + '</span><em>Otevřít nástroj →</em></a>' +
      (dalsi.length ? '<p class="cesta-alt-nadpis">' + (s.postup ? 'Potom:' : 'Nebo zkuste:') + '</p><div class="cesta-alt">' + dalsi.map(function (n) {
        return '<a href="' + esc(n.href) + '" data-nastroj="' + esc(n.jmeno) + '"><span>' + esc(n.prinos) + '</span><b>' + esc(n.jmeno) + (n.pro ? ' 🔒' : '') + ' →</b></a>';
      }).join('') + '</div>' : '') +
      '<div class="cesta-odkazy"><button type="button" data-akce="dal">Projít další situace</button><a href="' + ROZCESTI + '">Zpět na rozcestí</a></div>';
  }
  function nicNesedi() {
    box.innerHTML =
      '<div class="cesta-krok"><span>Nic z toho nesedí?</span></div>' +
      '<h2>Nevadí. Najdeme to jinak.</h2>' +
      '<p class="cesta-popis">' + (zachrana ? 'Rychlá diagnostika ukáže, kde se nejvíc ztrácí čas, i když přesně nevíte proč.' : 'Pět krátkých otázek doporučí, čím začít.') + '</p>' +
      (zachrana ? '<a class="cesta-hlavni" href="' + esc(zachrana.nastroje[0].href) + '" data-nastroj="' + esc(zachrana.nastroje[0].jmeno) + '"><b>' + esc(zachrana.nastroje[0].jmeno) + '</b><span>' + esc(zachrana.nastroje[0].prinos) + '</span><em>Otevřít nástroj →</em></a>'
        : '<a class="cesta-hlavni" href="' + KDE_ZACIT + '"><b>Nevím, čím začít</b><span>Pět otázek, přibližně dvě minuty.</span><em>Získat doporučení →</em></a>') +
      '<div class="cesta-odkazy"><button type="button" data-akce="znovu">Projít otázky znovu</button>' +
      (zachrana ? '<a href="' + KDE_ZACIT + '">Nevím, čím začít</a>' : '') +
      '<a href="' + KATALOG + '">Všechny nástroje</a><a href="' + ROZCESTI + '">Zpět na rozcestí</a></div>';
  }

  box.addEventListener('click', function (e) {
    var t = e.target.closest('[data-akce],[data-nastroj]');
    if (!t) return;
    if (t.hasAttribute('data-nastroj')) { sled('cesta_nastroj', { nastroj: t.getAttribute('data-nastroj'), stranka: location.pathname }); return; }
    var a = t.getAttribute('data-akce');
    if (a === 'ano') { sled('cesta_ano', { situace: situace[i].nazev, stranka: location.pathname }); doporuceni(situace[i]); }
    else if (a === 'ne') { i++; if (i < situace.length) otazka(); else nicNesedi(); }
    else if (a === 'zpet') { if (i > 0) i--; otazka(); }
    else if (a === 'dal') { i++; if (i < situace.length) otazka(); else nicNesedi(); }
    else if (a === 'znovu') { i = 0; otazka(); }
    var top = box.getBoundingClientRect().top;
    if (top < 70) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  otazka();
})();
