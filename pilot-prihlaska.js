// Přihláška do pilotu jedním klikem (4. 11. 2026).
// Sdílený soubor pro všechny návrhy stránky pilotu, podobně jako zpetna-vazba.js.
//
// Použití na stránce:
//   <div data-tokva-pilot-prihlaska data-varianta="a"></div>
//   <script src="/pilot-prihlaska.js" defer></script>
//
// Jak to funguje:
// - Přihlášený uživatel Tokvy (session + firma přes auth.js): klik = rovnou
//   zápis do tabulky pilot_prihlasky pod jeho účtem a firmou, jen potvrzení.
// - Nepřihlášený: klik rozbalí malý panel (e-mail a firma povinně, telefon
//   a „Co vás nejvíc pálí?“ s diktováním nepovinně, samostatné nezaškrtnuté
//   políčko se souhlasem s tipy a novinkami) a tlačítko Odeslat.
// - Po každé přihlášce přijde zájemci potvrzení e-mailem (Edge Function).
// - Knihovna Supabase a auth.js se načítají jen tomu, kdo má v prohlížeči
//   uložené přihlášení. Nepřihlášený návštěvník nestahuje nic navíc.
// - Pozor: supabase-client.js má "const supabaseClient", to není window.supabaseClient,
//   proto se tu volá holé jméno supabaseClient.
// - Proti robotům skryté pole, stejně jako u zpětné vazby.
// - Tabulku smí web jen ZAPISOVAT, číst ji jde jen v Supabase
//   (migrace-pilot-prihlasky-4-11.sql). Po každé přihlášce přijde Gábině
//   e-mail přes Edge Function pilot-signup-notification.
// - GA4: pilot_prihlasit_klik (s varianta, prihlaseny a misto: uvod/prihlaska)
//   a pilot_prihlaska_odeslana (s varianta).
// - Tlačítko jinde na stránce s data-pilot-prihlasit="uvod" udělá totéž co hlavní.
(function () {
  'use strict';

  const SUPABASE_URL = 'https://uiqjzeubhhnzspkoekxx.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_IMOVcKSNKeRB80iudKdBZw_4RTm2KY2';
  const AUTH_TOKEN = 'sb-uiqjzeubhhnzspkoekxx-auth-token';
  const ZASADY = 'https://tokva.cz/ochrana-osobnich-udaju/';

  // Kořen webu podle toho, odkud se načetl tenhle soubor (funguje na
  // tokva.cz i v náhledu ve složce _navrhy).
  const KOREN = (function () {
    const s = document.currentScript;
    if (s && s.src) return new URL('.', s.src).href;
    return '/';
  })();

  function sledovat(nazev, data) {
    if (typeof window.trackTokvaEvent === 'function') window.trackTokvaEvent(nazev, data);
  }

  function zarizeni() {
    const w = window.innerWidth || 1024;
    if (w < 700) return 'mobil';
    if (w < 1100) return 'tablet';
    return 'pocitac';
  }

  function maUlozenePrihlaseni() {
    try { return !!localStorage.getItem(AUTH_TOKEN); } catch (e) { return false; }
  }

  // Načte skript a počká na něj.
  function nacistSkript(src) {
    return new Promise(function (ok, chyba) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = chyba;
      document.head.appendChild(s);
    });
  }

  // Knihovna Supabase + supabase-client.js + auth.js, jen jednou.
  let pripravaAuth = null;
  function pripravitAuth() {
    if (pripravaAuth) return pripravaAuth;
    pripravaAuth = (async function () {
      if (typeof window.ziskatSession === 'function' && typeof supabaseClient !== 'undefined') return true;
      if (!window.supabase || !window.supabase.createClient) {
        await nacistSkript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      }
      if (typeof supabaseClient === 'undefined') await nacistSkript(KOREN + 'supabase-client.js');
      if (typeof window.ziskatSession !== 'function') await nacistSkript(KOREN + 'auth.js');
      return true;
    })().catch(function (e) {
      console.warn('Přihlášení Tokvy se nepodařilo načíst, přihláška pojede přes panel.', e);
      return false;
    });
    return pripravaAuth;
  }

  // Zjistí přihlášeného uživatele a jeho firmu. Vrátí null, když nikdo
  // přihlášený není (nebo se to nepodařilo zjistit).
  async function zjistitUzivatele() {
    if (!maUlozenePrihlaseni()) return null;
    const ok = await pripravitAuth();
    if (!ok) return null;
    try {
      const session = await window.ziskatSession();
      if (!session) return null;
      let clen = null;
      try { clen = await window.ziskatMojiOrganizaci(); } catch (e) { clen = null; }
      return {
        email: session.user.email || '',
        userId: session.user.id,
        organizaceId: clen ? clen.organization_id : null,
        firma: clen && clen.organizations ? clen.organizations.name : ''
      };
    } catch (e) {
      return null;
    }
  }

  function platnyEmail(t) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
  }

  function platnyTelefon(t) {
    const cislice = t.replace(/[^0-9]/g, '');
    return /^[+0-9\s()\/-]+$/.test(t) && cislice.length >= 9 && cislice.length <= 15;
  }

  function podporujeDiktovani() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function vlozitStyl() {
    if (document.getElementById('pp-styl')) return;
    const st = document.createElement('style');
    st.id = 'pp-styl';
    st.textContent = '' +
      '.pp{max-width:520px;margin:0 auto;text-align:left;font-family:"DM Sans",sans-serif;}' +
      '.pp-tlacitko{display:block;margin:0 auto;background:#e9a91b;color:#000;font-family:"DM Sans",sans-serif;font-weight:700;font-size:17px;padding:16px 36px;border-radius:10px;border:0;cursor:pointer;min-height:52px;}' +
      '.pp-tlacitko:hover{background:#976e12;color:#fff;}' +
      '.pp-tlacitko[hidden]{display:none;}' +
      '.pp-tlacitko:focus-visible,.pp-odeslat:focus-visible,.pp-diktovat:focus-visible{outline:3px solid #111;outline-offset:3px;}' +
      '.pp-tlacitko[disabled]{opacity:.6;cursor:wait;}' +
      '.pp-panel{background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:22px 20px;margin-top:4px;box-shadow:0 6px 24px rgba(0,0,0,.06);}' +
      '.pp-panel[hidden]{display:none;}' +
      '.pp-panel h3{font-family:"Poppins",sans-serif;font-weight:800;font-size:18px;margin:0 0 4px;color:#111;}' +
      '.pp-panel .pp-uvod{font-size:14px;color:#545454;margin:0 0 16px;line-height:1.5;}' +
      '.pp-pole{margin-bottom:14px;}' +
      '.pp-pole label{display:block;font-size:14px;font-weight:600;color:#111;margin-bottom:6px;}' +
      '.pp-pole label span{font-weight:400;color:#545454;}' +
      '.pp-pole input,.pp-pole textarea{width:100%;box-sizing:border-box;font-family:inherit;font-size:16px;padding:12px 14px;border:1.5px solid #c9c5bc;border-radius:8px;background:#fff;color:#111;}' +
      '.pp-pole input:focus,.pp-pole textarea:focus{outline:none;border-color:#e9a91b;box-shadow:0 0 0 3px rgba(233,169,27,.25);}' +
      '.pp-pole textarea{min-height:88px;resize:vertical;}' +
      '.pp-diktovani{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap;}' +
      '.pp-diktovat{font-family:inherit;font-size:14px;font-weight:700;background:#fff;color:#111;border:1.5px solid #c9c5bc;border-radius:8px;padding:8px 14px;cursor:pointer;}' +
      '.pp-diktovat:hover{border-color:#e9a91b;}' +
      '.pp-diktovat[disabled]{border-color:#e9a91b;background:#fdf3d9;cursor:default;}' +
      '.pp-diktovani small{font-size:12px;color:#545454;line-height:1.4;flex:1 1 200px;}' +
      '.pp-souhlas{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:#333;line-height:1.5;margin:4px 0 16px;cursor:pointer;}' +
      '.pp-souhlas input{margin:3px 0 0;width:18px;height:18px;flex-shrink:0;accent-color:#976e12;}' +
      '.pp-past{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}' +
      '.pp-chyba{display:none;background:#fdecec;color:#8a1c1c;border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:12px;}' +
      '.pp-odeslat{width:100%;background:#e9a91b;color:#000;font-family:inherit;font-weight:700;font-size:16px;padding:14px 20px;border-radius:10px;border:0;cursor:pointer;min-height:50px;}' +
      '.pp-odeslat:hover{background:#976e12;color:#fff;}' +
      '.pp-odeslat[disabled]{opacity:.6;cursor:wait;}' +
      '.pp-pozn{font-size:12px;color:#545454;margin:12px 0 0;line-height:1.5;}' +
      '.pp-pozn a{color:#545454;text-decoration:underline;}' +
      '.pp-hotovo{background:#fff;border:2px solid #e9a91b;border-radius:14px;padding:22px 20px;text-align:center;font-size:16px;line-height:1.6;color:#111;}' +
      '.pp-hotovo strong{font-family:"Poppins",sans-serif;font-weight:800;display:block;font-size:19px;margin-bottom:4px;}' +
      '.pp-hotovo .pp-co{font-weight:700;margin:14px 0 6px;}' +
      '.pp-hotovo .pp-potvrzeni{font-size:14px;color:#545454;margin:8px 0 0;}' +
      '.pp-dal{text-align:left;max-width:380px;margin:0 auto;padding-left:22px;font-size:15px;line-height:1.6;color:#545454;}' +
      '.pp-dal li{margin-bottom:4px;}' +
      '.pp-stav{font-size:14px;color:#545454;text-align:center;margin-top:10px;min-height:1em;}';
    document.head.appendChild(st);
  }

  // Co bude dál: stejné po každém úspěšném odeslání.
  function dalsiKroky(jak, email) {
    return (email ? '<p class="pp-potvrzeni">Potvrzení jsem vám poslala na ' + esc(email) + '.</p>' : '') +
      '<p class="pp-co">Co bude dál</p>' +
      '<ol class="pp-dal">' +
      '<li>Do 2 pracovních dnů se vám ozvu ' + jak + '.</li>' +
      '<li>Domluvíme úvodní schůzku na 30 až 45 minut.</li>' +
      '<li>Do 14 dnů po schůzce vám dám vědět, jestli jste v pilotu.</li>' +
      '</ol>';
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  let pocitadlo = 0;

  function vykreslit(misto) {
    const varianta = (misto.getAttribute('data-varianta') || 'a').toLowerCase().slice(0, 1);
    const id = 'pp' + (++pocitadlo);
    let diktovano = false;

    misto.classList.add('pp');
    misto.innerHTML = '' +
      '<button type="button" class="pp-tlacitko" aria-expanded="false" aria-controls="' + id + '-panel">Chci se přihlásit</button>' +
      '<div class="pp-stav" role="status" aria-live="polite"></div>' +
      '<form class="pp-panel" id="' + id + '-panel" hidden novalidate>' +
        '<p class="pp-uvod">Stačí e-mail a firma. Ozvu se do 2 pracovních dnů.</p>' +
        '<div class="pp-chyba" role="alert"></div>' +
        '<div class="pp-pole"><label for="' + id + '-email">E-mail</label>' +
          '<input type="email" id="' + id + '-email" autocomplete="email" inputmode="email" maxlength="200" required></div>' +
        '<div class="pp-pole"><label for="' + id + '-firma">Název firmy</label>' +
          '<input type="text" id="' + id + '-firma" autocomplete="organization" maxlength="200" required></div>' +
        '<div class="pp-pole"><label for="' + id + '-telefon">Telefon <span>(nepovinné, ozvu se rychleji)</span></label>' +
          '<input type="tel" id="' + id + '-telefon" autocomplete="tel" inputmode="tel" maxlength="30"></div>' +
        '<div class="pp-pole"><label for="' + id + '-pali">Co vás nejvíc pálí? <span>(nepovinné)</span></label>' +
          '<textarea id="' + id + '-pali" maxlength="2000" placeholder="Třeba: vychystávání trvá dlouho, lidi pořád něco hledají…"></textarea>' +
          '<div class="pp-diktovani" hidden>' +
            '<button type="button" class="pp-diktovat">Diktovat</button>' +
            '<small>Hlas převede na text váš prohlížeč (v Chromu přes služby Googlu). Text pak můžete upravit.</small>' +
          '</div></div>' +
        '<label class="pp-souhlas"><input type="checkbox" id="' + id + '-novinky"> <span>Chci dostávat novinky a praktické tipy k Tokvě na tento e-mail. Odhlásit se můžu kdykoli.</span></label>' +
        '<div class="pp-past" aria-hidden="true"><label for="' + id + '-web">Nevyplňujte</label><input type="text" id="' + id + '-web" tabindex="-1" autocomplete="off"></div>' +
        '<button type="submit" class="pp-odeslat">Odeslat přihlášku</button>' +
        '<p class="pp-pozn">E-mail a telefon použiju k domluvě pilotu a pošlu na e-mail potvrzení. Tipy a novinky jen když zaškrtnete políčko. Víc v <a href="' + ZASADY + '" target="_blank" rel="noopener">zásadách ochrany osobních údajů</a>.</p>' +
      '</form>';

    const btn = misto.querySelector('.pp-tlacitko');
    const stav = misto.querySelector('.pp-stav');
    const form = misto.querySelector('form');
    const chyba = misto.querySelector('.pp-chyba');
    const btnOdeslat = misto.querySelector('.pp-odeslat');
    const poleKontakt = misto.querySelector('#' + id + '-email');
    const poleTelefon = misto.querySelector('#' + id + '-telefon');
    const poleNovinky = misto.querySelector('#' + id + '-novinky');
    const poleFirma = misto.querySelector('#' + id + '-firma');
    const polePali = misto.querySelector('#' + id + '-pali');
    const diktBox = misto.querySelector('.pp-diktovani');
    const btnDikt = misto.querySelector('.pp-diktovat');

    // Přihlášenému si dopředu načteme přihlášení, ať je klik okamžitý.
    if (maUlozenePrihlaseni()) {
      const pozdeji = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
      pozdeji(function () { pripravitAuth(); });
    }

    function ukazatChybu(t) {
      chyba.textContent = t;
      chyba.style.display = 'block';
    }

    function hotovo(html) {
      misto.innerHTML = '<div class="pp-hotovo" role="status" tabindex="-1">' + html + '</div>';
      const el = misto.querySelector('.pp-hotovo');
      if (el) el.focus({ preventScroll: true });
    }

    function otevritPanel(predvyplnit) {
      if (predvyplnit) {
        if (predvyplnit.email && !poleKontakt.value) poleKontakt.value = predvyplnit.email;
        if (predvyplnit.firma && !poleFirma.value) poleFirma.value = predvyplnit.firma;
      }
      if (podporujeDiktovani()) diktBox.hidden = false;
      form.hidden = false;
      btn.hidden = true;
      btn.setAttribute('aria-expanded', 'true');
      stav.textContent = '';
      (poleKontakt.value ? (poleFirma.value ? polePali : poleFirma) : poleKontakt).focus({ preventScroll: true });
    }

    // Klik na „Chci se přihlásit“.
    btn.addEventListener('click', async function () {
      if (btn.disabled) return;
      const misto_kliku = btn.dataset.mistoKliku || 'prihlaska';
      delete btn.dataset.mistoKliku;
      btn.disabled = true;
      const uzivatel = await zjistitUzivatele();
      sledovat('pilot_prihlasit_klik', { varianta: varianta, prihlaseny: uzivatel ? 'ano' : 'ne', misto: misto_kliku });

      if (!uzivatel || !uzivatel.organizaceId || !uzivatel.firma) {
        btn.disabled = false;
        otevritPanel(uzivatel);
        return;
      }

      // Přihlášený s firmou: jeden klik a hotovo.
      stav.textContent = 'Odesílám přihlášku…';
      try {
        const { error } = await supabaseClient.from('pilot_prihlasky').insert({
          varianta: varianta,
          email: uzivatel.email.slice(0, 200),
          firma: uzivatel.firma.slice(0, 200),
          user_id: uzivatel.userId,
          organization_id: uzivatel.organizaceId,
          stranka: (location.pathname || '').slice(0, 200),
          zarizeni: zarizeni(),
          prohlizec: (navigator.userAgent || '').slice(0, 300)
        });
        if (error && error.code === '23505') {
          hotovo('<strong>Přihlášku už máte odeslanou.</strong>Firma: ' + esc(uzivatel.firma) + dalsiKroky('e-mailem'));
          return;
        }
        if (error) throw error;
        sledovat('pilot_prihlaska_odeslana', { varianta: varianta, prihlaseny: 'ano', diktovano: 'ne', novinky: 'ne' });
        hotovo('<strong>Hotovo, přihláška dorazila.</strong>Firma: ' + esc(uzivatel.firma) + dalsiKroky('e-mailem', uzivatel.email));
      } catch (e) {
        console.warn('Přihlášku jedním klikem se nepodařilo odeslat, otevírám panel.', e);
        btn.disabled = false;
        otevritPanel(uzivatel);
        ukazatChybu('Jedním klikem to teď nešlo. Zkontrolujte údaje a odešlete přihlášku tady.');
      }
    });

    // Diktování přes Web Speech API, česky.
    btnDikt.addEventListener('click', function () {
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) return;
      let rec;
      try { rec = new Rec(); } catch (e) { diktBox.hidden = true; return; }
      rec.lang = 'cs-CZ';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      btnDikt.disabled = true;
      btnDikt.textContent = 'Poslouchám…';
      rec.onresult = function (e) {
        const text = e.results[0][0].transcript;
        polePali.value = (polePali.value ? polePali.value.trim() + ' ' : '') + text;
        diktovano = true;
      };
      rec.onerror = function (e) {
        if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
          ukazatChybu('Mikrofon není povolený. Napište to prosím do pole, stačí pár slov.');
        }
      };
      rec.onend = function () {
        btnDikt.textContent = 'Diktovat';
        btnDikt.disabled = false;
        polePali.focus();
      };
      rec.start();
    });

    // Odeslání panelu (nepřihlášený, nebo přihlášený bez firmy).
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      chyba.style.display = 'none';

      // Skryté pole vyplní jen robot. Tváříme se, že je odesláno.
      if (misto.querySelector('#' + id + '-web').value) {
        hotovo('<strong>Díky, přihláška dorazila.</strong>Ozvu se vám.');
        return;
      }

      const kontakt = poleKontakt.value.trim();
      const telefon = poleTelefon.value.trim();
      const firma = poleFirma.value.trim();
      const pali = polePali.value.trim();
      const novinky = !!poleNovinky.checked;

      if (!platnyEmail(kontakt)) {
        ukazatChybu('Zkontrolujte prosím e-mail, pošlu na něj potvrzení.');
        poleKontakt.focus();
        return;
      }
      if (telefon && !platnyTelefon(telefon)) {
        ukazatChybu('Telefon nevypadá správně (aspoň 9 číslic). Nebo pole nechte prázdné.');
        poleTelefon.focus();
        return;
      }
      if (firma.length < 2) {
        ukazatChybu('Napište prosím název firmy.');
        poleFirma.focus();
        return;
      }

      btnOdeslat.disabled = true;
      try {
        const res = await fetch(SUPABASE_URL + '/rest/v1/pilot_prihlasky', {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            varianta: varianta,
            email: kontakt.slice(0, 200),
            telefon: telefon ? telefon.slice(0, 30) : null,
            souhlas_novinky: novinky,
            firma: firma.slice(0, 200),
            co_pali: pali ? pali.slice(0, 2000) : null,
            diktovano: diktovano,
            stranka: (location.pathname || '').slice(0, 200),
            zarizeni: zarizeni(),
            prohlizec: (navigator.userAgent || '').slice(0, 300)
          })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        sledovat('pilot_prihlaska_odeslana', { varianta: varianta, prihlaseny: 'ne', diktovano: diktovano ? 'ano' : 'ne', novinky: novinky ? 'ano' : 'ne' });
        hotovo('<strong>Díky, přihláška dorazila.</strong>Firma: ' + esc(firma) + dalsiKroky(telefon ? 'na telefon ' + esc(telefon) : 'e-mailem', kontakt));
      } catch (ex) {
        console.warn('Přihlášku se nepodařilo odeslat.', ex);
        ukazatChybu('Přihlášku se nepodařilo odeslat. Zkuste to prosím znovu za chvíli.');
        btnOdeslat.disabled = false;
      }
    });
  }

  // Tlačítko „Chci se přihlásit“ jinde na stránce (třeba v úvodu) s atributem
  // data-pilot-prihlasit: sjede k přihlášce a rovnou udělá totéž co hlavní
  // tlačítko. Přihlášený je tím hotový, nepřihlášenému se otevře panel.
  // Bez JavaScriptu zůstane obyčejný odkaz na #prihlasit.
  function napojitDalsiTlacitka(misto) {
    document.querySelectorAll('[data-pilot-prihlasit]').forEach(function (odkaz) {
      odkaz.addEventListener('click', function (e) {
        e.preventDefault();
        // Sjezd přes prohlídku se nemá počítat jako její dočtení (GA4).
        document.documentElement.setAttribute('data-skok', '1');
        setTimeout(function () { document.documentElement.removeAttribute('data-skok'); }, 2500);
        const plynule = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        (misto.closest('[id]') || misto).scrollIntoView({ behavior: plynule ? 'smooth' : 'auto', block: 'start' });
        const hlavni = misto.querySelector('.pp-tlacitko');
        if (hlavni && !hlavni.hidden) {
          hlavni.dataset.mistoKliku = odkaz.getAttribute('data-pilot-prihlasit') || 'jinde';
          hlavni.click();
        } else {
          const pole = misto.querySelector('.pp-panel:not([hidden]) input');
          if (pole) setTimeout(function () { pole.focus({ preventScroll: true }); }, 400);
        }
      });
    });
  }

  function start() {
    const mista = document.querySelectorAll('[data-tokva-pilot-prihlaska]');
    if (!mista.length) return;
    vlozitStyl();
    mista.forEach(vykreslit);
    napojitDalsiTlacitka(mista[0]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
