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

// Odhlášení, s přesměrováním zpátky na přihlašovací stránku.
async function odhlasit() {
  await supabaseClient.auth.signOut();
  window.location.href = KOREN_TOKVA + 'prihlaseni.html';
}
