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
    .select('organization_id, role, organizations(name, plan, plan_expires_at)')
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

// Odhlášení, s přesměrováním zpátky na přihlašovací stránku.
async function odhlasit() {
  await supabaseClient.auth.signOut();
  window.location.href = KOREN_TOKVA + 'prihlaseni.html';
}
