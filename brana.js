// Brána k bezplatným nástrojům Tokvy (od 10/2026).
// Jednou zadaný e-mail odemkne všechny bezplatné nástroje. Prohlížeč si to
// pamatuje; na jiném zařízení stačí zadat stejný e-mail znovu.
// E-mail jde do Breva (formulář "Tokva brána", seznam "Tokva brána").
// Souhlas s tipy a novinkami je samostatné nezaškrtnuté políčko; posílá se
// jen když je zaškrtnuté (atribut SOUHLAS_NOVINKY = "ano"), aby se dřív
// daný souhlas nepřepsal na "ne".
//
// Použití na stránce nástroje (od 22. 10. 2026):
//   <script src="../../brana.js" data-vysledek="#vysledky" data-delka="Zabere přibližně 5 minut."></script>
// Nástroj jde vyplnit celý. Až se ukáže výsledek (data-vysledek, selektory
// oddělené čárkou), je rozmazaný v mlze a vyskočí okno s e-mailem. Kde je
// výsledek vidět hned od načtení (kalkulačky), okno samo nevyskočí, je jen
// mlha s tlačítkem.
// data-delka = věta pod štítky v hlavičce; dokud není odemčeno, přidá se za
// ni věta, že na konci se zadá e-mail.
// Starý režim data-zamknout (zamčený celý nástroj) zůstává, nikde se nepoužívá.
// window.tokvaBranaOtevrit() otevře okno s obecným textem (5× Proč).
(function () {
  'use strict';

  var KLIC = 'tokva_brana';
  var BREVO_URL = 'https://2f524664.sibforms.com/serve/MUIFAJU6CAXYzkZlP3eEZxoCLznL6Vc3mJvhI_meuVzkwrkn-OqF_SHNI-ra5K3AvIgDo1sHCNy2wXxDs1IfOnLUHOHX5sAsR9pP6H1ZtfNEfDTc2jlWN24Nq64R-_nusvqzm8DwnmZLWT7lVERHqM6bkcnNP9YsUrOYrt89Y-vnPy9nR73V-VaqO0kccT6XKl1hDhq0qmVHHydlHA==';
  var KLIC_PRIHLASENI = 'sb-uiqjzeubhhnzspkoekxx-auth-token';
  var ZASADY = 'https://tokva.cz/ochrana-osobnich-udaju/';

  var skript = document.currentScript;
  var zamknout = skript ? (skript.getAttribute('data-zamknout') || '') : '';
  var nazevNastroje = skript ? (skript.getAttribute('data-nastroj') || '') : '';
  var vysledek = skript ? (skript.getAttribute('data-vysledek') || '') : '';
  var delka = skript ? (skript.getAttribute('data-delka') || '') : '';
  // data-vysledek-az: mlha až když je splněná podmínka. "#id" = prvek je vidět
  // a má v textu nenulovou číslici (např. délka trasy), "!#id" = prvek NENÍ
  // vidět (např. štítek "Příklad" zmizel).
  var vysledekAz = skript ? (skript.getAttribute('data-vysledek-az') || '') : '';
  // data-vysledek-okno="ne": okno samo nevyskočí, jen mlha s tlačítkem
  // (nástroje, kde se měří dlouho a výsledek roste průběžně).
  var oknoSamo = !skript || skript.getAttribute('data-vysledek-okno') !== 'ne';

  // ?brana=znovu zapomene odemčení v tomhle prohlížeči (na natáčení ukázky
  // nebo testování, když nejde anonymní okno).
  try {
    if (new URLSearchParams(location.search).get('brana') === 'znovu') localStorage.removeItem(KLIC);
  } catch (e) {}

  function nacist() {
    try { return JSON.parse(localStorage.getItem(KLIC) || 'null'); } catch (e) { return null; }
  }
  function ulozit(email) {
    try { localStorage.setItem(KLIC, JSON.stringify({ email: email, od: new Date().toISOString() })); } catch (e) {}
  }
  function jePrihlaseny() {
    try { return !!localStorage.getItem(KLIC_PRIHLASENI); } catch (e) { return false; }
  }
  // Bránu přeskočí: přihlášený do Tokvy, odkaz z výsledkového e-mailu
  // (?odpovedi=), otevření uloženého výsledku (?vysledek=) a kolegové
  // vyplňující anonymní týmový kvíz (?tym=) - po nich e-mail chtít nesmíme.
  function preskocit() {
    if (jePrihlaseny()) return true;
    var q = new URLSearchParams(location.search);
    return q.has('odpovedi') || q.has('vysledek') || q.has('tym');
  }
  function odemceno() { return !!nacist() || preskocit(); }

  window.tokvaBranaEmail = function () { var d = nacist(); return d && d.email ? d.email : ''; };
  window.tokvaBranaOdemceno = odemceno;

  var CSS = '' +
    '.tb-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:none;align-items:center;justify-content:center;padding:16px;}' +
    '.tb-ov.tb-ukaz{display:flex;}' +
    '.tb-box{background:#fff;border-radius:14px;max-width:440px;width:100%;padding:28px 26px 22px;font-family:"DM Sans",Arial,sans-serif;position:relative;box-sizing:border-box;max-height:94vh;overflow-y:auto;}' +
    '.tb-box h3{font-family:"Poppins",Arial,sans-serif;font-size:20px;font-weight:800;line-height:1.3;margin:0 0 8px;color:#111;}' +
    '.tb-box p{font-size:14px;color:#555;line-height:1.6;margin:0 0 14px;}' +
    '.tb-box input[type=email]{width:100%;box-sizing:border-box;border:2px solid #e2e2e2;border-radius:8px;padding:12px 14px;font-size:16px;margin:0 0 12px;font-family:inherit;color:#111;background:#fff;}' +
    '.tb-box input[type=email]:focus{outline:none;border-color:#e9a91b;}' +
    '.tb-souhlas{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:#444;line-height:1.5;margin:0 0 16px;cursor:pointer;text-align:left;}' +
    '.tb-souhlas input{margin:3px 0 0;width:16px;height:16px;flex-shrink:0;}' +
    '.tb-btn{display:block;width:100%;background:#e9a91b;color:#000;border:none;border-radius:8px;padding:14px 18px;font-family:"Poppins",Arial,sans-serif;font-size:15px;font-weight:800;cursor:pointer;}' +
    '.tb-btn:hover{background:#976e12;color:#fff;}' +
    '.tb-btn:disabled{opacity:.7;cursor:default;}' +
    '.tb-chyba{font-size:13px;color:#b91c1c;min-height:0;margin:-6px 0 10px;}' +
    '.tb-zpet{font-size:13px !important;color:#666 !important;margin:14px 0 0 !important;text-align:center;}' +
    '.tb-zasady{font-size:12px !important;color:#888 !important;text-align:center;margin:8px 0 0 !important;}' +
    '.tb-zasady a,.tb-souhlas a{color:#976e12;}' +
    '.tb-x{position:absolute;top:8px;right:12px;background:none;border:none;font-size:24px;line-height:1;cursor:pointer;color:#888;padding:6px;}' +
    '.tb-zamceno{position:relative !important;}' +
    '.tb-kryt{position:absolute;inset:0;z-index:60;background:rgba(250,250,248,.82);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}' +
    '.tb-karta{position:sticky;top:90px;max-width:420px;margin:40px auto;background:#fff;border:1px solid #e8e6e0;border-top:3px solid #e9a91b;border-radius:12px;padding:24px 22px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08);font-family:"DM Sans",Arial,sans-serif;}' +
    '.tb-karta h3{font-family:"Poppins",Arial,sans-serif;font-size:18px;font-weight:800;margin:0 0 8px;color:#111;}' +
    '.tb-karta p{font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;}' +
    '.tb-karta .tb-pozn{font-size:12.5px;color:#5f5d5a;margin:10px 0 0;}' +
    '.tb-pozn-mala{font-size:12px !important;color:#666 !important;line-height:1.5 !important;text-align:center;margin:14px 0 0 !important;}' +
    '.tb-info{font-size:14px;line-height:1.6;margin:16px 0 0;max-width:640px;}' +
    '.tb-mlha{position:relative;}' +
    '.tb-mlha>*:not(.tb-mlha-karta){filter:blur(8px);opacity:.55;pointer-events:none;user-select:none;-webkit-user-select:none;}' +
    '.tb-mlha-karta{position:relative;z-index:60;max-width:420px;margin:0 auto 18px;background:#fff;border:1px solid #e8e6e0;border-top:3px solid #e9a91b;border-radius:12px;padding:22px 20px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.10);font-family:"DM Sans",Arial,sans-serif;box-sizing:border-box;}' +
    '.tb-mlha-karta h3{font-family:"Poppins",Arial,sans-serif;font-size:18px;font-weight:800;margin:0 0 8px;color:#111;}' +
    '.tb-mlha-karta p{font-size:14px;color:#555;line-height:1.6;margin:0 0 14px;}' +
    '@media print{.tb-ov,.tb-kryt,.tb-mlha-karta{display:none !important;}.tb-mlha>*{visibility:hidden !important;}}';

  var ov = null;
  var poOdemceni = [];

  function pripravitOkno() {
    if (ov) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    ov = document.createElement('div');
    ov.className = 'tb-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'tb-nadpis');
    ov.innerHTML =
      '<div class="tb-box">' +
        '<button type="button" class="tb-x" aria-label="Zavřít">×</button>' +
        '<h3 id="tb-nadpis"></h3>' +
        '<p class="tb-text"></p>' +
        '<form class="tb-form" novalidate>' +
          '<input type="email" name="email" placeholder="Váš e-mail" autocomplete="email" inputmode="email" aria-label="Váš e-mail">' +
          '<div class="tb-chyba" role="alert"></div>' +
          '<label class="tb-souhlas"><input type="checkbox" name="souhlas"> <span>Souhlasím se zasíláním tipů a novinek k Tokvě na tento e-mail. Odhlásit se můžu kdykoliv.</span></label>' +
          '<button type="submit" class="tb-btn"></button>' +
        '</form>' +
        '<p class="tb-zasady">E-mail použiju k odemčení nástrojů. Víc v <a href="' + ZASADY + '" target="_blank" rel="noopener">zásadách ochrany osobních údajů</a>.</p>' +
        '<p class="tb-pozn-mala">Odemčení si pamatuje tento prohlížeč. Na jiném zařízení nebo po smazání dat prohlížeče bude potřeba e-mail zadat znovu.</p>' +
      '</div>' +
      '<iframe name="tb-brevo-cil" title="odeslání formuláře" style="display:none;"></iframe>';
    document.body.appendChild(ov);

    ov.querySelector('.tb-x').onclick = zavrit;
    ov.addEventListener('click', function (e) { if (e.target === ov) zavrit(); });
    document.addEventListener('keydown', function (e) {
      if (!ov.classList.contains('tb-ukaz')) return;
      if (e.key === 'Escape') { zavrit(); return; }
      // Tab zůstává uvnitř okna, ať se klávesnicí nedá utéct do stránky za ním.
      if (e.key !== 'Tab') return;
      var prvky = Array.prototype.filter.call(
        ov.querySelectorAll('.tb-box button, .tb-box input, .tb-box a[href]'),
        function (el) { return el.offsetParent !== null && !el.disabled; });
      if (!prvky.length) return;
      var prvni = prvky[0], posledni = prvky[prvky.length - 1];
      var uvnitr = ov.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === prvni || !uvnitr)) { e.preventDefault(); posledni.focus(); }
      else if (!e.shiftKey && (document.activeElement === posledni || !uvnitr)) { e.preventDefault(); prvni.focus(); }
    });
    ov.querySelector('.tb-form').addEventListener('submit', odeslat);
  }

  // Kde byl kurzor před otevřením okna, tam se po zavření vrátí.
  var fokusPred = null;
  function zavrit() {
    if (ov) ov.classList.remove('tb-ukaz');
    if (fokusPred && document.contains(fokusPred)) { try { fokusPred.focus(); } catch (e) {} }
    fokusPred = null;
  }

  var TEXTY = {
    vysledek: {
      nadpis: 'Váš výsledek je připravený',
      text: 'Zadejte e-mail a prohlédněte si výsledek. Odemknete tím i ostatní bezplatné nástroje, příště už e-mail zadávat nemusíte.',
      tlacitko: 'Zobrazit výsledek zdarma'
    },
    obecne: {
      nadpis: 'Odemkněte bezplatné nástroje',
      text: 'Jeden e-mail odemkne výsledky všech bezplatných nástrojů Tokvy. Příště už ho zadávat nemusíte.',
      tlacitko: 'Odemknout nástroje zdarma'
    }
  };
  var rezim = 'obecne';

  function otevrit(r) {
    pripravitOkno();
    rezim = (r === 'vysledek') ? 'vysledek' : 'obecne';
    var t = TEXTY[rezim];
    ov.querySelector('#tb-nadpis').textContent = t.nadpis;
    ov.querySelector('.tb-text').textContent = t.text;
    ov.querySelector('.tb-btn').textContent = t.tlacitko;
    if (!ov.classList.contains('tb-ukaz')) fokusPred = document.activeElement;
    ov.classList.add('tb-ukaz');
    var pole = ov.querySelector('input[type=email]');
    setTimeout(function () { try { pole.focus(); } catch (e) {} }, 50);
    sledovat(rezim === 'vysledek' ? 'brana_zobrazena_vysledek' : 'brana_zobrazena');
  }

  function sledovat(udalost) {
    try {
      if (typeof window.trackTokvaEvent === 'function') window.trackTokvaEvent(udalost, { source_tool: nazevNastroje || location.pathname });
      else if (typeof window.gtag === 'function') window.gtag('event', udalost, { source_tool: nazevNastroje || location.pathname });
    } catch (e) {}
  }

  function platnyEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }

  function odeslat(ev) {
    ev.preventDefault();
    var form = ev.target;
    var email = (form.email.value || '').trim();
    var chyba = form.querySelector('.tb-chyba');
    if (!platnyEmail(email)) {
      chyba.textContent = 'Zkontrolujte prosím e-mail, takhle nevypadá úplně.';
      form.email.focus();
      return;
    }
    chyba.textContent = '';
    var btn = form.querySelector('.tb-btn');
    btn.disabled = true;
    btn.textContent = 'Odemykám…';

    // Do Breva přes skrytý formulář (stejně jako ostatní formuláře Tokvy).
    try {
      var f = document.createElement('form');
      f.method = 'POST';
      f.action = BREVO_URL;
      f.target = 'tb-brevo-cil';
      f.style.display = 'none';
      var pole = { EMAIL: email, email_address_check: '', locale: 'en', html_type: 'simple' };
      if (form.souhlas.checked) pole.SOUHLAS_NOVINKY = 'ano';
      Object.keys(pole).forEach(function (k) {
        var i = document.createElement('input');
        i.type = 'hidden'; i.name = k; i.value = pole[k];
        f.appendChild(i);
      });
      document.body.appendChild(f);
      f.submit();
      setTimeout(function () { f.remove(); }, 3000);
    } catch (e) {
      console.warn('Brána: odeslání do Breva se nepovedlo, odemykám i tak.', e);
    }

    ulozit(email);
    sledovat('brana_odemceno');
    if (form.souhlas.checked) sledovat('brana_souhlas_novinky');
    setTimeout(function () {
      zavrit();
      odemknoutStranku();
      btn.disabled = false;
      btn.textContent = TEXTY[rezim].tlacitko;
    }, 400);
  }

  function odemknoutStranku() {
    odkrytVysledky();
    document.querySelectorAll('.tb-info-email').forEach(function (e) { e.remove(); });
    document.querySelectorAll('[data-tb-inert]').forEach(function (d) { d.removeAttribute('inert'); d.removeAttribute('data-tb-inert'); });
    document.querySelectorAll('.tb-kryt').forEach(function (k) {
      var obal = k.parentElement;
      k.remove();
      // Obal zmizí a zamčená část se vrátí přesně na své místo.
      if (obal && obal.classList.contains('tb-zamceno')) {
        while (obal.firstChild) obal.parentNode.insertBefore(obal.firstChild, obal);
        obal.remove();
      }
    });
    // Formuláře "pošlete výsledek na e-mail" si e-mail rovnou předvyplní.
    predvyplnit();
    var cb = poOdemceni.slice(); poOdemceni = [];
    cb.forEach(function (f) { try { f(); } catch (e) {} });
    try { document.dispatchEvent(new CustomEvent('tokva-brana-odemceno')); } catch (e) {}
  }

  function predvyplnit() {
    var email = window.tokvaBranaEmail();
    if (!email) return;
    document.querySelectorAll('input[type=email], input[name=EMAIL]').forEach(function (i) {
      if (!i.value && !i.closest('.tb-box')) i.value = email;
    });
  }

  function zamknoutCasti() {
    if (!zamknout) return;
    var prvky = [];
    zamknout.split(',').forEach(function (sel) {
      sel = sel.trim();
      if (!sel) return;
      var el = document.querySelector(sel);
      if (el && prvky.indexOf(el) < 0) prvky.push(el);
    });
    if (!prvky.length) return;
    pripravitOkno();
    prvky.forEach(function (el, i) {
      // Zamčená část se obalí, kryt je v obalu vedle ní. Když si nástroj
      // svůj obsah překreslí (třeba 5S přepisuje #main), kryt zůstane.
      var obal = document.createElement('div');
      obal.className = 'tb-zamceno';
      el.parentNode.insertBefore(obal, el);
      obal.appendChild(el);
      // Ať se pod krytem nedá klikat ani tabulátorem dostat do polí.
      el.setAttribute('inert', '');
      el.setAttribute('data-tb-inert', '1');
      var kryt = document.createElement('div');
      kryt.className = 'tb-kryt';
      // Karta s tlačítkem jen u první zamčené části, další jsou jen zakryté.
      if (i === 0) {
        kryt.innerHTML = '<div class="tb-karta"><h3>Nástroj je zdarma</h3>' +
          '<p>Stačí jednou zadat e-mail a odemknete všechny bezplatné nástroje Tokvy.</p>' +
          '<button type="button" class="tb-btn">Odemknout nástroje zdarma</button>' +
          '<p class="tb-pozn">Už jste tu byli? Zadejte stejný e-mail a vstoupíte rovnou.</p></div>';
        kryt.querySelector('.tb-btn').onclick = function () { otevrit(); };
      } else {
        kryt.addEventListener('click', function () { otevrit(); });
      }
      obal.appendChild(kryt);
    });
  }

  // ---- Mlha na výsledcích ----
  var hlidac = null;
  var oknoUkazano = false;
  var videtPriStartu = [];

  function vysledkoveCasti() {
    var out = [];
    vysledek.split(',').forEach(function (sel) {
      sel = sel.trim();
      if (!sel) return;
      document.querySelectorAll(sel).forEach(function (el) { if (out.indexOf(el) < 0) out.push(el); });
    });
    return out;
  }
  function jeVidet(el, minVyska) {
    if (!el.getClientRects().length) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && el.offsetHeight > (minVyska || 10);
  }
  function zahalit(el, sKartou) {
    el.classList.add('tb-mlha');
    if (!el.hasAttribute('data-tb-klik')) {
      el.setAttribute('data-tb-klik', '1');
      el.addEventListener('click', function (e) {
        if (!el.classList.contains('tb-mlha') || e.target.closest('.tb-mlha-karta')) return;
        otevrit('vysledek');
      });
    }
    var karta = null;
    for (var i = 0; i < el.children.length; i++) if (el.children[i].classList.contains('tb-mlha-karta')) karta = el.children[i];
    if (sKartou && !karta) {
      karta = document.createElement('div');
      karta.className = 'tb-mlha-karta';
      karta.innerHTML = '<h3>' + TEXTY.vysledek.nadpis + '</h3>' +
        '<p>Zadejte e-mail a prohlédněte si výsledek. Odemknete tím i ostatní bezplatné nástroje.</p>' +
        '<button type="button" class="tb-btn">' + TEXTY.vysledek.tlacitko + '</button>';
      karta.querySelector('.tb-btn').onclick = function () { otevrit('vysledek'); };
      el.insertBefore(karta, el.firstChild);
    }
    // Ať se pod mlhou nedá klikat ani tabulátorem dostat do polí a tlačítek.
    for (var j = 0; j < el.children.length; j++) {
      var d = el.children[j];
      if (d.classList.contains('tb-mlha-karta') || d.hasAttribute('data-tb-inert')) continue;
      d.setAttribute('inert', '');
      d.setAttribute('data-tb-inert', '1');
    }
  }
  function podminkaSplnena() {
    if (!vysledekAz) return true;
    var neg = vysledekAz.charAt(0) === '!';
    var el = document.querySelector(neg ? vysledekAz.slice(1) : vysledekAz);
    if (neg) return !el || !jeVidet(el, 1);
    return !!el && jeVidet(el, 1) && /[1-9]/.test(el.textContent || '');
  }
  function zkontrolovatVysledky() {
    if (odemceno()) { odkrytVysledky(); return; }
    if (!podminkaSplnena()) return;
    var casti = vysledkoveCasti();
    var prvni = true;
    casti.forEach(function (el) {
      if (!jeVidet(el)) return;
      zahalit(el, prvni);
      prvni = false;
      // Okno samo vyskočí jen když se výsledek ukázal až po vyplnění
      // (ne u kalkulaček, kde je výsledek vidět od začátku).
      if (oknoSamo && !oknoUkazano && videtPriStartu.indexOf(el) < 0) {
        oknoUkazano = true;
        setTimeout(function () { if (!odemceno()) otevrit('vysledek'); }, 600);
      }
    });
  }
  function odkrytVysledky() {
    if (hlidac) { clearInterval(hlidac); hlidac = null; }
    document.querySelectorAll('.tb-mlha-karta').forEach(function (k) { k.remove(); });
    document.querySelectorAll('.tb-mlha').forEach(function (el) { el.classList.remove('tb-mlha'); });
  }
  function hlidatVysledky() {
    if (!vysledek) return;
    pripravitOkno();
    videtPriStartu = podminkaSplnena() ? vysledkoveCasti().filter(function (e) { return jeVidet(e); }) : [];
    zkontrolovatVysledky();
    hlidac = setInterval(zkontrolovatVysledky, 400);
  }
  function infoODelce() {
    var hotova = document.querySelector('.tb-info');
    if (hotova) {
      // Řádek je přímo v HTML (vidí ho i vyhledávače a AI). Kdo už odemkl,
      // větu o e-mailu nepotřebuje.
      var m = document.querySelector('.hero-meta');
      try { if (m) hotova.style.color = getComputedStyle(m.parentNode.querySelector('p') || m).color; } catch (e) {}
      if (odemceno()) hotova.querySelectorAll('.tb-info-email').forEach(function (e) { e.remove(); });
      return;
    }
    if (!delka) return;
    var meta = document.querySelector('.hero-meta');
    if (!meta) return;
    var p = document.createElement('p');
    p.className = 'tb-info';
    p.textContent = delka;
    try { p.style.color = getComputedStyle(meta.parentNode.querySelector('p') || meta).color; } catch (e) {}
    if (!odemceno()) {
      var s = document.createElement('span');
      s.className = 'tb-info-email';
      s.textContent = ' Na konci zadáte e\u2011mail a zobrazíte si výsledek. Tím zároveň odemknete výsledky všech nástrojů zdarma v tomto prohlížeči.';
      p.appendChild(s);
    }
    meta.parentNode.insertBefore(p, meta.nextSibling);
  }

  // Volání z úvodní stránky / tlačítek. Když už je odemčeno, rovnou pokračuje.
  window.tokvaBranaOtevrit = function (poOdemknuti) {
    if (odemceno()) { if (typeof poOdemknuti === 'function') poOdemknuti(); return; }
    if (typeof poOdemknuti === 'function') poOdemceni.push(poOdemknuti);
    otevrit();
  };

  // Zadat jiný e-mail (např. v 5× Proč), i když už je odemčeno.
  window.tokvaBranaZmenit = function (poZadani) {
    if (typeof poZadani === 'function') poOdemceni.push(poZadani);
    otevrit();
  };

  function start() {
    pripravitOkno();
    infoODelce();
    if (odemceno()) { predvyplnit(); return; }
    zamknoutCasti();
    hlidatVysledky();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
