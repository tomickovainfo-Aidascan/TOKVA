// Sdílené funkce pro přihlášení a práci s firmou (organizací).
// Vyžaduje, aby stránka už měla načtený supabase-client.js.
// Používá appka, která appka potřebuje vědět, jestli je uživatel přihlášený,
// a ke které firmě patří.

// Zjistí, odkud appka běží, podle toho, odkud se skutečně načetl tenhle
// soubor (auth.js) - funguje na file:// jednoho počítače, na github.io/nazev-repo/
// i na vlastní doméně, appka to nemusí nikde ručně nastavovat.
var KOREN_TOKVA = (function () {
  var scripty = document.getElementsByTagName('script');
  for (var i = 0; i < scripty.length; i++) {
    if (scripty[i].src && scripty[i].src.indexOf('auth.js') !== -1) {
      return new URL('.', scripty[i].src).href;
    }
  }
  return './';
})();

// Vrátí aktuální session (nebo null, pokud nikdo není přihlášený).
async function ziskatSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

// Zavolej na začátku appky, která smí jet jen po přihlášení (Pro appky).
// Pokud uživatel není přihlášený, přesměruje na přihlašovací stránku
// a po přihlášení ho vrátí zpátky tam, odkud přišel.
async function vyzadovatPrihlaseni() {
  const session = await ziskatSession();
  if (!session) {
    const zpet = encodeURIComponent(window.location.href);
    window.location.href = KOREN_TOKVA + 'prihlaseni.html?zpet=' + zpet;
    return null;
  }
  return session;
}

// Zjistí, ke které firmě přihlášený uživatel patří (a jakou tam má roli).
// Vrátí null, pokud si ještě žádnou firmu nezaložil.
async function ziskatMojiOrganizaci() {
  const session = await ziskatSession();
  if (!session) return null;

  const { data, error } = await supabaseClient
    .from('organization_members')
    .select('organization_id, role, organizations(name, plan, plan_expires_at, max_uzivatelu, pouze_konzultant)')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (error) { console.error('ziskatMojiOrganizaci chyba:', error, 'pro user_id:', session.user.id); return null; }
  if (!data) { console.warn('ziskatMojiOrganizaci: zadna organizace pro user_id:', session.user.id); return null; }
  return data;
}

// Řekne appce, jestli firma má aktivní Pro (ne jen "je přihlášený").
// Kontroluje plan i to, jestli náhodou nevypršel.
function maAktivniPro(clenstvi) {
  if (!clenstvi || !clenstvi.organizations) return false;
  if (clenstvi.organizations.plan !== 'pro') return false;
  const expiruje = clenstvi.organizations.plan_expires_at;
  if (expiruje && new Date(expiruje) < new Date()) return false;
  return true;
}

// Zkrátí e-mail na jméno před zavináčem, ať se vejde do malého odznaku
// v horní liště i na mobilu - appka podle něj ukazuje, kdo je přihlášený.
function zkratitEmail(email) {
  if (!email) return '';
  const jmeno = email.split('@')[0];
  return jmeno.length > 16 ? jmeno.slice(0, 16) + '…' : jmeno;
}

// Založí novou firmu a rovnou přihlášeného uživatele udělá jejím majitelem.
// Používá databázovou funkci create_organization (viz supabase-schema-navrh.md),
// protože běžný zápis přes .insert() by tady na založení první členské role nestačil.
async function zalozitOrganizaci(nazevFirmy) {
  const session = await ziskatSession();
  if (!session) throw new Error('Nejste přihlášeni.');

  const { data, error } = await supabaseClient.rpc('create_organization', {
    org_name: nazevFirmy
  });

  if (error) throw error;
  return data;
}

// Přepíše odkazy na Měřič plýtvání / Spaghetti diagram na jejich Pro variantu,
// pokud je uživatel přihlášený jako Pro. Appky doporučují tyhle dva nástroje
// napříč výsledky (mini audit, 5x Proč, časová studie...), a jen tyhle dva mají
// oddělenou Pro appku - volej znovu po každém překreslení výsledků, protože
// odkazy se v appkách staví dynamicky.
function prepnoutOdkazyNaPro(jePro) {
  if (!jePro) return;
  document.querySelectorAll('a[href*="meric-plytvani-free/"]').forEach(a => {
    a.href = a.href.replace('meric-plytvani-free/', 'meric-plytvani-pro/');
  });
  document.querySelectorAll('a[href*="spaghetti-free/"]').forEach(a => {
    a.href = a.href.replace('spaghetti-free/', 'spaghetti-pro/');
  });
}

// Ukáže/schová trvalý odkaz na Akční plán v horní liště appky - jen appky,
// co mají v HTML prvek #nav-akcni-plan (skrytý defaultně přes style="display:none"),
// ho zobrazí. Bez tohohle šlo do Akčního plánu jen přes odkaz "Otevřít akční
// plán", který appka nabídne až po přidání konkrétního úkolu - jinak se tam
// přihlášený Pro uživatel nedostal vůbec.
function zobrazitOdkazAkcniPlan(jePro) {
  const el = document.getElementById('nav-akcni-plan');
  if (!el) return;
  el.style.display = jePro ? '' : 'none';
}

// Ukáže/schová trvalý odkaz na Projekty v horní liště appky - stejný vzorec jako
// zobrazitOdkazAkcniPlan výš, jen pro appku Projekty (souhrn projektu + prezentační mód).
function zobrazitOdkazProjekty(jePro) {
  const el = document.getElementById('nav-projekty');
  if (!el) return;
  el.style.display = jePro ? '' : 'none';
}

// Ukáže/schová trvalý odkaz na Moje Tokva (centrální přehled po přihlášení)
// v horní liště appky - na rozdíl od zobrazitOdkazAkcniPlan/Projekty výš tenhle
// odkaz nepodmiňuje Pro, appka Moje Tokva umí ukázat i omezený přehled zdarma
// firmě - stačí, že vůbec existuje firma (clenstvi), ne že má aktivní Pro.
function zobrazitOdkazMojeTokva(maFirmu) {
  const el = document.getElementById('nav-moje-tokva');
  if (!el) return;
  el.style.display = maFirmu ? '' : 'none';
}

// Řekne appce, jestli je přihlášený člověk majitel/správce firmy (ne jen
// běžný člen) - používá appka Nastavení firmy na to, co komu ukázat/dovolit.
function jsemAdminFirmy(clenstvi) {
  return !!clenstvi && (clenstvi.role === 'majitel' || clenstvi.role === 'spravce');
}

// Ukáže/schová trvalý odkaz na Nastavení firmy v horní liště appky - stejný
// vzorec jako zobrazitOdkazAkcniPlan/Projekty výš, ale navíc jen pro
// majitele/správce (ne pro běžné členy - ti nemají co spravovat).
function zobrazitOdkazNastaveniFirmy(jePro, clenstvi) {
  const el = document.getElementById('nav-nastaveni-firmy');
  if (!el) return;
  el.style.display = (jePro && jsemAdminFirmy(clenstvi)) ? '' : 'none';
}

// Odhlášení, s přesměrováním zpátky na přihlašovací stránku.
async function odhlasit() {
  await supabaseClient.auth.signOut();
  window.location.href = KOREN_TOKVA + 'prihlaseni.html';
}

// Místní data nástrojů (historie měření, uložené výpočty, nákresy, pracoviště 5S)
// patří firmě, ne prohlížeči. Pravdivý zdroj je účet firmy v databázi, prohlížeč
// drží jen pracovní kopii. Aby na sdíleném počítači jedna firma neviděla kopii
// druhé, má každá firma (a nepřihlášený návštěvník zvlášť) svou vlastní přihrádku.
// Vrací true, když se zobrazená data změnila a stránka se má načíst znovu.
function oddelitMistniDataPodleFirmy(klice, orgId) {
  var ted = orgId || 'anon';
  var zmena = false;
  function slouceni(a, b) {
    try {
      var x = JSON.parse(a), y = JSON.parse(b);
      var podleId = function (pole, dalsi) {
        var mam = {}; pole.forEach(function (z) { if (z && z.id != null) mam[z.id] = 1; });
        return pole.concat(dalsi.filter(function (z) { return !(z && z.id != null && mam[z.id]); }));
      };
      if (Array.isArray(x) && Array.isArray(y)) return JSON.stringify(podleId(x, y));
      if (x && y && Array.isArray(x.mista) && Array.isArray(y.mista)) { x.mista = podleId(x.mista, y.mista); return JSON.stringify(x); }
    } catch (e) {}
    return a;
  }
  (klice || []).forEach(function (klic) {
    try {
      var znacka = localStorage.getItem(klic + '__firma');
      if (znacka === ted) return;
      var aktualni = localStorage.getItem(klic);
      if (!znacka) { localStorage.setItem(klic + '__firma', ted); return; } // první spuštění po téhle úpravě
      var ulozene = localStorage.getItem(klic + '__' + ted);
      if (znacka === 'anon') {
        // nepřihlášený návštěvník se přihlásil: jeho rozdělaná data si firma vezme s sebou
        if (ulozene != null) {
          localStorage.setItem(klic, aktualni != null ? slouceni(ulozene, aktualni) : ulozene);
          localStorage.removeItem(klic + '__' + ted);
          zmena = true;
        }
      } else {
        // odhlášení nebo jiná firma: data té předchozí schovat do její přihrádky
        if (aktualni != null) localStorage.setItem(klic + '__' + znacka, aktualni);
        if (ulozene != null) { localStorage.setItem(klic, ulozene); localStorage.removeItem(klic + '__' + ted); }
        else localStorage.removeItem(klic);
        if (aktualni != null || ulozene != null) zmena = true;
      }
      localStorage.setItem(klic + '__firma', ted);
    } catch (e) {}
  });
  return zmena;
}

// Našeptávání členů firmy u pole „Odpovědná osoba". Jde dál napsat i jméno
// člověka, který v Tokvě účet nemá (brigádník, údržbář), jen se nabídnou ti, co ho mají.
var TOKVA_POLE_OSOBA = '#akce-osoba,#s-akce-osoba,#ap-osoba,#ak-osoba,#ukol-kdo,#hl-osoba';
var tokvaClenoveStav = null;
async function nacistNaseptavaniClenu() {
  if (tokvaClenoveStav) return tokvaClenoveStav;
  tokvaClenoveStav = (async function () {
    try {
      var session = await ziskatSession();
      if (!session) { tokvaClenoveStav = null; return; }
      var cl = await supabaseClient.from('organization_members').select('user_id');
      var ids = (cl.data || []).map(function (c) { return c.user_id; });
      if (!ids.length) return;
      var pr = await supabaseClient.from('profiles').select('id, email, full_name').in('id', ids);
      var jmena = [];
      (pr.data || []).forEach(function (p) {
        var j = (p.full_name || '').trim() || (p.email || '').split('@')[0];
        if (j && jmena.indexOf(j) === -1) jmena.push(j);
      });
      if (!jmena.length) return;
      var dl = document.getElementById('tokva-clenove');
      if (!dl) { dl = document.createElement('datalist'); dl.id = 'tokva-clenove'; document.body.appendChild(dl); }
      dl.innerHTML = '';
      jmena.sort(function (a, b) { return a.localeCompare(b, 'cs'); }).forEach(function (j) {
        var o = document.createElement('option'); o.value = j; dl.appendChild(o);
      });
    } catch (e) { console.warn('Členy firmy se nepodařilo načíst pro našeptávání.', e); tokvaClenoveStav = null; }
  })();
  return tokvaClenoveStav;
}
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches(TOKVA_POLE_OSOBA)) return;
    if (!t.getAttribute('list')) { t.setAttribute('list', 'tokva-clenove'); t.setAttribute('autocomplete', 'off'); }
    nacistNaseptavaniClenu();
  });
}
