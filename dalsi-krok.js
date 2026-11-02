// Zlatý panel „Co udělat teď“ pro nástroje bez vlastní verze (2. 11. 2026):
// Časová studie, Kalkulačka nákladů skladu, 5S, 5× Proč.
// Použití: <script src="/dalsi-krok.js"></script> (po /postup.js), pak
//   tokvaDalsiKrok.vykreslit(prvek, { kroky: ['proc', 'kviz'], text: '...', zjisteni: ['admin'] })
// kroky: klíče z NASTROJE níž; 'overit' = nástroj, kterým člověk v cestě měřil
// (Měřič, Spaghetti, Kalkulačka ztrát, Časová studie), s textem „Ověřit změnu“.
// Co už je v cestě hotové, se nedoporučí znovu (kromě Akčního plánu a ověření).
(function () {
  'use strict';
  var N = {
    spaghetti: { url: '/nastroje/spaghetti-free/', slozka: 'spaghetti', cta: 'Nakreslit Spaghetti diagram', overit: 'Ověřit změnu: nakreslit trasu znovu' },
    meric:     { url: '/nastroje/meric-plytvani-free/', slozka: 'meric-plytvani', cta: 'Změřit to v Měřiči plýtvání', overit: 'Ověřit změnu: změřit znovu v Měřiči' },
    kalk:      { url: '/nastroje/kalkulacka-ztrat/', slozka: 'kalkulacka-ztrat', cta: 'Spočítat finanční dopad', overit: 'Ověřit změnu: spočítat znovu v Kalkulačce' },
    casova:    { url: '/nastroje/casova-studie/', slozka: 'casova-studie', cta: 'Zaznamenat den v Časové studii', overit: 'Ověřit změnu: zaznamenat den znovu' },
    kalkHaseni: { url: '/nastroje/kalkulacka-ztrat/', slozka: 'kalkulacka-ztrat', cta: 'Spočítat, kolik vás stojí hašení problémů' },
    m2:        { url: '/nastroje/kalkulacka-nakladu-skladu/', slozka: 'kalkulacka-nakladu-skladu', cta: 'Spočítat, kolik stojí metr skladu' },
    proc:      { url: '/nastroje/5x-proc-ai-kouc/', slozka: '5x-proc-ai-kouc', cta: 'Najít příčinu pomocí 5× Proč' },
    s5:        { url: '/nastroje/5S_audit/', slozka: '5S_audit', cta: 'Udělat pořádek podle 5S' },
    kviz:      { url: '/nastroje/kviz-komunikacniho-chaosu/', slozka: 'kviz-komunikacniho-chaosu', cta: 'Projít Kvíz komunikačního chaosu' },
    plan:      { url: 'https://tokva.cz/akcni-plan/', slozka: 'akcni-plan', cta: 'Zapsat do Akčního plánu (Pro)' }
  };
  var MERENI = ['meric', 'spaghetti', 'kalk', 'casova'];
  var AUTOMATIZACE = '<a href="https://gabrielatomickova.cz/#nabidka">Napište mi →</a>';

  var css = document.createElement('style');
  css.textContent =
    '.dalsi-krok{background:#fdf3d9;color:#111;border:2px solid #e9a91b;border-radius:14px;padding:20px 20px 18px;margin:0 0 18px;text-align:left;}' +
    '.dalsi-krok-nadpis{font-family:Poppins,sans-serif;font-weight:800;font-size:19px;margin-bottom:12px;color:#111;}' +
    '.dalsi-krok-proc{font-size:13.5px;line-height:1.5;color:#545454;margin:12px 0 0;}' +
    '.dalsi-krok-proc a{color:#976e12;font-weight:700;}' +
    '.dalsi-krok-hlavni{display:block;text-align:center;background:#e9a91b;color:#000;font-family:Poppins,sans-serif;font-weight:800;font-size:17px;padding:16px 18px;border-radius:10px;text-decoration:none;box-shadow:0 6px 16px rgba(151,110,18,.25);}' +
    '.dalsi-krok-hlavni:hover{background:#976e12;color:#fff;}' +
    '.dalsi-krok-druhy{display:block;text-align:center;margin-top:12px;border:1.5px solid #976e12;color:#976e12;background:#fff;font-family:Poppins,sans-serif;font-weight:700;font-size:14.5px;padding:11px 16px;border-radius:10px;text-decoration:none;}' +
    '.dalsi-krok-druhy:hover{background:#976e12;color:#fff;}';
  (document.head || document.documentElement).appendChild(css);

  function P() { return window.tokvaPostup || null; }
  function hotovo(k) { var p = P(); return !!(p && N[k] && p.hotovo(N[k].slozka)); }
  // Poslední nástroj z cesty, kterým člověk měřil.
  function overitNastroj() {
    var p = P(); if (!p) return null;
    var kroky = p.kroky(), nalez = null;
    kroky.forEach(function (x) { MERENI.forEach(function (k) { if (N[k].slozka === x.nastroj) nalez = k; }); });
    return nalez;
  }

  function vykreslit(box, o) {
    if (!box) return;
    o = o || {};
    var vybrane = [];
    (o.kroky || []).concat(o.doplnit || []).forEach(function (k) {
      var polozka = null;
      if (k === 'overit') {
        var m = overitNastroj();
        if (m) polozka = { url: N[m].url, slozka: N[m].slozka, cta: N[m].overit };
      } else if (N[k] && (k === 'plan' || !hotovo(k))) {
        polozka = N[k];
      }
      if (polozka && !vybrane.some(function (v) { return v.url === polozka.url; })) vybrane.push(polozka);
    });
    vybrane = vybrane.slice(0, o.max || 2);
    var p = P();
    var doporuceno = vybrane.map(function (v) { return v.slozka; });
    if (p && o.zapsat !== false) p.zapsat({ zjisteni: o.zjisteni || [], doporuceno: doporuceno.filter(function (s) { return s !== 'akcni-plan'; }), data: o.data || {} });
    var html = (p ? p.radek(doporuceno) : '') + '<div class="dalsi-krok-nadpis">Co udělat teď</div>';
    if (vybrane[0]) html += '<a class="dalsi-krok-hlavni" href="' + vybrane[0].url + '">' + vybrane[0].cta + '&nbsp;→</a>';
    if (o.text) html += '<p class="dalsi-krok-proc"' + (vybrane[0] ? '' : ' style="margin-top:0;"') + '>' + o.text + '</p>';
    if (vybrane[1]) html += '<a class="dalsi-krok-druhy" href="' + vybrane[1].url + '">' + vybrane[1].cta + '&nbsp;→</a>';
    box.className = 'dalsi-krok';
    box.innerHTML = html;
    box.style.display = 'block';
  }

  window.tokvaDalsiKrok = { vykreslit: vykreslit, overitNastroj: overitNastroj, AUTOMATIZACE: AUTOMATIZACE };
})();
