// Appka na dotazníky pilotu. Zadání: Moje-AI/10-obchod/pilot/zadani-appka-dotazniky.md
//
// Odkaz: tokva.cz/dotaznik/?k=<klíč>. Appka klíč jen předá databázi (RPC
// funkce v migrace-dotazniky-pilot-4-11.sql) - sama nikdy neví, které firmě
// klíč patří, a cizí nebo upravený klíč jí nevrátí žádná data.
(function () {
  const SUPABASE_URL = 'https://uiqjzeubhhnzspkoekxx.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_IMOVcKSNKeRB80iudKdBZw_4RTm2KY2';

  const klic = new URLSearchParams(location.search).get('k');

  const elNacitani = document.getElementById('stav-nacitani');
  const elChyba = document.getElementById('stav-chyba');
  const elUvod = document.getElementById('uvod-text');
  const elOtazky = document.getElementById('stav-otazky');
  const elDekovani = document.getElementById('stav-dekovani');
  const elProgressNav = document.getElementById('progress-nav');
  const progressFill = document.getElementById('progress-fill');
  const progressCount = document.getElementById('progress-count');

  let dotaznik = null;     // { nazev, uvod, konec, otazky }
  let odpovedi = {};       // { '1': 'text', '4': 'potvrdil', ... }
  let screens = [];        // otázky seskupené po obrazovkách
  let screenIndex = 0;

  async function rpc(nazev, params) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + nazev, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    // Funkce, co nic nevrací (uložení, dokončení), pošlou prázdné tělo -
    // res.json() by na něm spadlo.
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function zobrazitChybu(zprava) {
    elNacitani.hidden = true;
    elOtazky.hidden = true;
    elUvod.hidden = true;
    elProgressNav.hidden = true;
    elChyba.hidden = false;
    elChyba.querySelector('.chyba-text').textContent = zprava;
  }

  function ukazatUpozorneni(text, cb) {
    const overlay = document.getElementById('notice-overlay');
    document.getElementById('notice-text').textContent = text;
    overlay.hidden = false;
    document.getElementById('notice-ok').onclick = function () {
      overlay.hidden = true;
      if (cb) cb();
    };
  }

  // Otázky se stejnou "skupina" patří na jednu obrazovku (např. hlavní
  // otázka + navazující komentář).
  function seskupitObrazovky(seznam) {
    const out = [];
    let posledniSkupina = null;
    seznam.forEach(function (o) {
      if (o.skupina && o.skupina === posledniSkupina && out.length) {
        out[out.length - 1].push(o);
      } else {
        out.push([o]);
        posledniSkupina = o.skupina || null;
      }
    });
    return out;
  }

  function jeViditelna(o) {
    if (!o.zobrazit_pokud) return true;
    return odpovedi[o.zobrazit_pokud.id] === o.zobrazit_pokud.hodnota;
  }

  function vyplnena(o) {
    const v = odpovedi[o.id];
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  function obrazovkaSplnena(screen) {
    return screen.every(function (o) {
      if (!jeViditelna(o)) return true;
      if (!o.povinna) return true;
      return vyplnena(o);
    });
  }

  function najdiStartovniObrazovku() {
    for (let i = 0; i < screens.length; i++) {
      if (!obrazovkaSplnena(screens[i])) return i;
    }
    return screens.length - 1;
  }

  function podporujeDiktovani() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function spustitDiktovani(pole, tlacitko) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = 'cs-CZ';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    tlacitko.disabled = true;
    const puvodniText = tlacitko.textContent;
    tlacitko.textContent = 'Poslouchám…';
    rec.onresult = function (e) {
      const text = e.results[0][0].transcript;
      pole.value = (pole.value ? pole.value.trim() + ' ' : '') + text;
      odpovedi[pole.dataset.otazkaId] = pole.value;
      aktualizovatDalsiTlacitko();
    };
    rec.onerror = function () {
      tlacitko.textContent = puvodniText;
      tlacitko.disabled = false;
    };
    rec.onend = function () {
      tlacitko.textContent = puvodniText;
      tlacitko.disabled = false;
    };
    rec.start();
  }

  function kliknutiDiktovat(pole, tlacitko) {
    if (localStorage.getItem('dotaznik_diktovani_vysvetleno') === 'ano') {
      spustitDiktovani(pole, tlacitko);
      return;
    }
    ukazatUpozorneni('Povolte mikrofon. Mluvte normálně, text se objeví v poli a můžete ho upravit.', function () {
      localStorage.setItem('dotaznik_diktovani_vysvetleno', 'ano');
      spustitDiktovani(pole, tlacitko);
    });
  }

  function vytvoritVyber(o, karta) {
    const wrap = document.createElement('div');
    wrap.className = 'moznosti';
    o.moznosti.forEach(function (m) {
      const btn = document.createElement('div');
      btn.className = 'moznost';
      btn.textContent = m.popis;
      if (odpovedi[o.id] === m.hodnota) btn.classList.add('selected');
      btn.onclick = function () {
        odpovedi[o.id] = m.hodnota;
        vykreslitObrazovku();
      };
      wrap.appendChild(btn);
    });
    karta.appendChild(wrap);
  }

  function vytvoritPoleText(o, karta, viceradkove) {
    const radek = document.createElement('div');
    radek.className = 'pole-radek';
    const pole = document.createElement(viceradkove ? 'textarea' : 'input');
    if (!viceradkove) pole.type = 'text';
    pole.maxLength = 4000;
    pole.className = 'dotaznik-pole';
    pole.dataset.otazkaId = o.id;
    pole.value = odpovedi[o.id] || '';
    pole.addEventListener('input', function () {
      odpovedi[o.id] = pole.value;
      aktualizovatDalsiTlacitko();
    });
    radek.appendChild(pole);
    if (viceradkove && podporujeDiktovani()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-diktovat';
      btn.textContent = 'Diktovat';
      btn.onclick = function () { kliknutiDiktovat(pole, btn); };
      radek.appendChild(btn);
    }
    karta.appendChild(radek);
  }

  function aktualizovatDalsiTlacitko() {
    const btn = document.getElementById('btn-dal');
    if (!btn) return;
    btn.disabled = !obrazovkaSplnena(screens[screenIndex]);
  }

  function aktualizovatProgress() {
    progressCount.textContent = (screenIndex + 1) + ' / ' + screens.length;
    progressFill.style.width = Math.round((screenIndex + 1) / screens.length * 100) + '%';
  }

  function vykreslitObrazovku() {
    elUvod.hidden = screenIndex !== 0;
    elOtazky.innerHTML = '';

    const karta = document.createElement('div');
    karta.className = 'otazka-card';
    const screen = screens[screenIndex];

    let prvni = true;
    screen.forEach(function (o) {
      if (!jeViditelna(o)) return;
      if (!prvni) {
        const odd = document.createElement('div');
        odd.className = 'otazka-oddeleni';
        karta.appendChild(odd);
      }
      prvni = false;

      const text = document.createElement('div');
      text.className = 'otazka-text';
      text.textContent = o.text;
      karta.appendChild(text);

      if (o.kontext) {
        const k = document.createElement('div');
        k.className = 'otazka-kontext';
        k.textContent = o.kontext;
        karta.appendChild(k);
      }

      if (o.typ === 'vyber' || o.typ === 'souhlas' || o.typ === 'stupnice') {
        vytvoritVyber(o, karta);
      } else if (o.typ === 'delsi') {
        vytvoritPoleText(o, karta, true);
      } else {
        vytvoritPoleText(o, karta, false);
      }
    });

    const nav = document.createElement('div');
    nav.className = 'otazka-nav';
    if (screenIndex > 0) {
      const zpet = document.createElement('button');
      zpet.className = 'btn-zpet';
      zpet.type = 'button';
      zpet.textContent = 'Předchozí';
      zpet.onclick = function () { screenIndex--; vykreslitObrazovku(); };
      nav.appendChild(zpet);
    }
    const dal = document.createElement('button');
    dal.id = 'btn-dal';
    dal.className = 'btn-dal';
    dal.type = 'button';
    dal.textContent = screenIndex === screens.length - 1 ? 'Dokončit' : 'Další';
    dal.onclick = kliknutiDal;
    nav.appendChild(dal);
    karta.appendChild(nav);

    elOtazky.appendChild(karta);
    aktualizovatDalsiTlacitko();
    aktualizovatProgress();
  }

  async function kliknutiDal() {
    const btn = document.getElementById('btn-dal');
    const screen = screens[screenIndex];
    btn.disabled = true;
    try {
      for (const o of screen) {
        if (!jeViditelna(o) || !vyplnena(o)) continue;
        if (o.typ === 'souhlas') {
          await rpc('dotaznik_ulozit_souhlas', { p_klic: klic, p_souhlas: odpovedi[o.id] });
        } else {
          await rpc('dotaznik_ulozit_odpoved', { p_klic: klic, p_otazka: o.id, p_odpoved: String(odpovedi[o.id]) });
        }
      }
      if (screenIndex === screens.length - 1) {
        await rpc('dotaznik_dokoncit', { p_klic: klic });
        ukazatDekovani();
      } else {
        screenIndex++;
        vykreslitObrazovku();
      }
    } catch (e) {
      console.warn('Ulozeni odpovedi se nepodarilo', e);
      ukazatUpozorneni('Nepodařilo se uložit odpověď. Zkontrolujte prosím připojení k internetu a zkuste to znovu.');
      btn.disabled = false;
    }
  }

  function ukazatDekovani() {
    elOtazky.hidden = true;
    elUvod.hidden = true;
    elProgressNav.hidden = true;
    elDekovani.hidden = false;
    elDekovani.querySelector('.dekovani-text').textContent = dotaznik.konec;
  }

  async function init() {
    if (!klic) {
      zobrazitChybu('Chybí odkaz na dotazník. Zkontrolujte prosím adresu, nebo mi napište na gabriela@tokva.cz.');
      return;
    }
    try {
      const [vysledek, otazkyJson] = await Promise.all([
        rpc('dotaznik_ziskat', { p_klic: klic }),
        fetch('./otazky.json').then(function (r) { return r.json(); })
      ]);

      dotaznik = otazkyJson['d' + vysledek.cislo_dotazniku];
      odpovedi = Object.assign({}, vysledek.odpovedi);
      if (vysledek.souhlas_s_referenci) {
        const otazkaSouhlas = dotaznik.otazky.find(function (o) { return o.typ === 'souhlas'; });
        if (otazkaSouhlas) odpovedi[otazkaSouhlas.id] = vysledek.souhlas_s_referenci;
      }

      // Dotazník 3: ukázat odhad z otázky 6 dotazníku 1 u otázky "co se změnilo".
      if (vysledek.cislo_dotazniku === 3 && vysledek.odhad_d1_otazka6) {
        const cilova = dotaznik.otazky.find(function (o) { return o.id === '2'; });
        if (cilova) {
          cilova.kontext = 'Na začátku jste odhadli: „' + vysledek.odhad_d1_otazka6 + '“. ' + (cilova.kontext || '');
        }
      }

      screens = seskupitObrazovky(dotaznik.otazky);
      elNacitani.hidden = true;

      if (vysledek.dokonceno) {
        ukazatDekovani();
        return;
      }

      elUvod.textContent = dotaznik.uvod;
      elOtazky.hidden = false;
      screenIndex = najdiStartovniObrazovku();
      vykreslitObrazovku();
    } catch (e) {
      console.warn('Dotaznik se nepodarilo nacist', e);
      zobrazitChybu('Tenhle odkaz nefunguje. Zkontrolujte ho prosím, nebo mi napište na gabriela@tokva.cz.');
    }
  }

  init();
})();
