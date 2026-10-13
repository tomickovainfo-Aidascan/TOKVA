// Zpětná vazba k nástrojům Tokvy.
//
// Krátký formulář: co funguje, co ne, co zlepšit. E-mail je nepovinný.
// Na stránku se vloží jen prázdné místo:
//   <div data-tokva-zpetna-vazba data-nastroj="kalkulacka"></div>
//   <script src="../../zpetna-vazba.js"></script>
// Bez data-nastroj se ukáže výběr nástroje (rozcestníky, katalog).
// Třída zv-samostatne přidá okraje, když místo nestojí uvnitř sloupce s textem.
//
// Zprávy se ukládají do Supabase, do tabulky zpetna_vazba (viz
// migrace-zpetna-vazba-11-10.sql). Web do ní smí jen zapisovat, číst ji
// může jen Gábina v Supabase. Po každé nové zprávě jí přijde e-mail
// (Edge Function feedback-notification přes Database Webhook).
(function () {
  const SUPABASE_URL = 'https://uiqjzeubhhnzspkoekxx.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_IMOVcKSNKeRB80iudKdBZw_4RTm2KY2';

  // Stejná id a názvy jako v katalogu nástrojů (nastroje/index.html).
  const NASTROJE = [
    ['meric-free', 'Měřič plýtvání'],
    ['meric-pro', 'Měřič plýtvání Pro'],
    ['kalkulacka', 'Kalkulačka ztrát'],
    ['kalkulacka-naklady-skladu', 'Kalkulačka nákladů skladu na m²'],
    ['mini-audit', 'Mini audit skladu'],
    ['mini-audit-vyroba', 'Mini audit výroby'],
    ['kviz-sklad', 'Kvíz: Jak dobře znáte svůj sklad'],
    ['kviz-komunikace', 'Kvíz komunikačního chaosu'],
    ['spaghetti-sklad', 'Spaghetti diagram'],
    ['spaghetti-vyroba', 'Spaghetti diagram Pro'],
    ['5s-audit', '5S pro každého smrtelníka'],
    ['5x-proc', '5× Proč AI kouč'],
    ['casova-studie', 'Časová studie mého dne'],
    ['tokva-pro', 'Účet Tokva Pro (přehled, akční plán, projekty)'],
    ['obecne', 'Obecně, celý web']
  ];

  const CSS = `
.zv-wrap{width:100%;max-width:760px;margin:28px auto;padding:0;box-sizing:border-box;font-family:inherit;}
.zv-wrap.zv-samostatne{padding:0 16px;}
.zv-wrap [hidden]{display:none!important;}
.zv-wrap *{box-sizing:border-box;}
.zv-otevrit{display:block;width:100%;background:none;border:1px dashed var(--border,#d9d4c7);border-radius:10px;padding:14px 16px;font:inherit;font-size:14px;font-weight:600;color:var(--dark,#1f2a37);cursor:pointer;text-align:left;}
.zv-otevrit:hover{border-color:var(--gold,#c9a227);}
.zv-otevrit span{color:var(--gold-dark,#9a7a12);}
.zv-box{border:1px solid var(--border,#d9d4c7);border-radius:12px;padding:20px;background:var(--white,#fff);}
.zv-box h2{font-size:17px;margin:0 0 8px;color:var(--dark,#1f2a37);line-height:1.35;}
.zv-box p{font-size:14px;line-height:1.7;color:var(--mid,#4b5563);margin:0 0 14px;}
.zv-box label{display:block;font-size:13px;font-weight:600;color:var(--dark,#1f2a37);margin:0 0 6px;}
.zv-box textarea,.zv-box input[type=email],.zv-box select{width:100%;font:inherit;font-size:14px;padding:10px 12px;border:1px solid var(--border,#d9d4c7);border-radius:8px;background:#fff;color:var(--dark,#1f2a37);margin:0 0 14px;}
.zv-box textarea{min-height:110px;resize:vertical;line-height:1.55;}
.zv-pole-past{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden;}
.zv-odeslat{background:var(--gold,#c9a227);color:#fff;border:none;border-radius:8px;padding:11px 22px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;}
.zv-odeslat:disabled{opacity:.6;cursor:default;}
.zv-pozn{font-size:12px!important;color:var(--light,#6b7280)!important;margin:12px 0 0!important;}
.zv-pozn a{color:inherit;}
.zv-chyba{display:none;font-size:13px;color:#b42318;margin:0 0 12px;}
.zv-diky{font-size:14px;line-height:1.7;color:var(--dark,#1f2a37);margin:0;}
@media print{.zv-wrap,[data-tokva-zpetna-vazba]{display:none!important;}}
`;

  function vlozitStyl() {
    if (document.getElementById('zv-styl')) return;
    const st = document.createElement('style');
    st.id = 'zv-styl';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function zarizeni() {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
    if (/Mobi|Android|iPhone/i.test(ua)) return 'mobil';
    return 'pocitac';
  }

  function vykreslit(misto, poradi) {
    const nastroj = (misto.getAttribute('data-nastroj') || '').trim();
    const sVyberem = !nastroj;
    const id = 'zv' + poradi;
    misto.classList.add('zv-wrap');

    const moznosti = NASTROJE.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
    misto.innerHTML = `
<button type="button" class="zv-otevrit" aria-expanded="false" aria-controls="${id}-box">Něco nefungovalo, nebo by šlo líp? <span>Napište mi.</span></button>
<div class="zv-box" id="${id}-box" hidden>
  <h2>Co vám tu funguje, co ne a co byste změnili?</h2>
  <p>Appky stavím sama a ladím je podle toho, jak je lidi opravdu používají. Když se vám něco nespočítalo, jak jste čekali, něco se zaseklo nebo vám tu něco chybí, napište mi to. Čtu každou zprávu.</p>
  <form novalidate>
    ${sVyberem ? `<label for="${id}-nastroj">Kterého nástroje se to týká?</label>
    <select id="${id}-nastroj"><option value="">Vyberte</option>${moznosti}</select>` : ''}
    <label for="${id}-text">Co se stalo, nebo co byste změnili?</label>
    <textarea id="${id}-text" maxlength="4000" placeholder="Třeba: na mobilu Apple mi nejde uložit výsledek. Nebo: chyběla mi tam možnost zadat dvě směny."></textarea>
    <label for="${id}-email">E-mail (nepovinný, jen pokud jste ochotni mi o závadě povědět víc)</label>
    <input type="email" id="${id}-email" maxlength="200" autocomplete="email">
    <div class="zv-pole-past" aria-hidden="true"><label for="${id}-web">Nevyplňujte</label><input type="text" id="${id}-web" tabindex="-1" autocomplete="off"></div>
    <div class="zv-chyba" role="alert"></div>
    <button type="submit" class="zv-odeslat">Odeslat</button>
    <p class="zv-pozn">E-mail použiju jen k odpovědi na tuhle zprávu. Žádný newsletter. Víc v <a href="https://tokva.cz/ochrana-osobnich-udaju/" target="_blank" rel="noopener">zásadách ochrany osobních údajů</a>.</p>
  </form>
</div>`;

    const btnOtevrit = misto.querySelector('.zv-otevrit');
    const box = misto.querySelector('.zv-box');
    const form = misto.querySelector('form');
    const chyba = misto.querySelector('.zv-chyba');
    const btnOdeslat = misto.querySelector('.zv-odeslat');

    btnOtevrit.addEventListener('click', function () {
      box.hidden = false;
      btnOtevrit.hidden = true;
      btnOtevrit.setAttribute('aria-expanded', 'true');
      misto.querySelector('#' + id + (sVyberem ? '-nastroj' : '-text')).focus();
    });

    function ukazatChybu(t) {
      chyba.textContent = t;
      chyba.style.display = 'block';
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      chyba.style.display = 'none';

      // Neviditelné pole vyplní jen robot. Tváříme se, že je odesláno.
      if (misto.querySelector('#' + id + '-web').value) {
        box.innerHTML = '<p class="zv-diky">Díky, dorazilo to.</p>';
        return;
      }

      const text = misto.querySelector('#' + id + '-text').value.trim();
      const email = misto.querySelector('#' + id + '-email').value.trim();
      const vybrany = sVyberem ? misto.querySelector('#' + id + '-nastroj').value : nastroj;

      if (text.length < 3) {
        ukazatChybu('Napište prosím pár slov, co vám nesedělo.');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        ukazatChybu('Tenhle e-mail nevypadá správně. Zkontrolujte ho, nebo pole nechte prázdné.');
        return;
      }

      btnOdeslat.disabled = true;
      try {
        const res = await fetch(SUPABASE_URL + '/rest/v1/zpetna_vazba', {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            nastroj: vybrany || 'neuvedeno',
            stranka: (location.pathname || '').slice(0, 200),
            zprava: text.slice(0, 4000),
            email: email || null,
            zarizeni: zarizeni(),
            prohlizec: (navigator.userAgent || '').slice(0, 300)
          })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (typeof window.trackTokvaEvent === 'function') {
          window.trackTokvaEvent('feedback_sent', { source_tool: vybrany || 'neuvedeno', with_email: email ? 'ano' : 'ne' });
        }
        box.innerHTML = '<p class="zv-diky"><strong>Díky, dorazilo to.</strong> Jestli jste nechali e-mail, ozvu se.</p>';
      } catch (ex) {
        console.warn('Zpětnou vazbu se nepodařilo odeslat.', ex);
        ukazatChybu('Zprávu se nepodařilo odeslat. Zkuste to prosím znovu, nebo mi napište na tomickova.info@gmail.com.');
        btnOdeslat.disabled = false;
      }
    });
  }

  function start() {
    const mista = document.querySelectorAll('[data-tokva-zpetna-vazba]');
    if (!mista.length) return;
    vlozitStyl();
    mista.forEach(vykreslit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
