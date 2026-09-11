# 5x Proč: doplněk do Apps Scriptu – oprava pádů uprostřed konverzace (BUG-04)

## Co se dělo a proč

Appka `nastroje/5x-proc-ai-kouc/index.html` posílala při každé zprávě
**celou dosavadní konverzaci** na server jako součást webové adresy (GET
požadavek, `?action=ai&messages=...`). Adresa roste s každou výměnou -
appka historii nijak neomezovala.

Živě jsem si to ověřila přímo proti tvému Apps Scriptu:

- konverzace do cca 6 000 znaků v adrese → funguje bez problému,
- kolem 15 000 znaků (to je běžná délka po cca 8-10 výměnách, přesně jak
  to sbíral zářijový test) → požadavek spadne s `Failed to fetch`, appka
  ukáže "Nepodařilo se spojit se serverem."

Tohle je přesně to, na co narazil test appky 11.9. - ne náhodná chyba
serveru, ale tvrdý limit délky adresy (buď u Googlu, nebo u sítě/proxy po
cestě), na který appka spolehlivě narazí u každé delší konverzace.

## Co jsem opravila v appce (hotovo, čeká na push)

- Appka teď posílá zprávy přes POST (v těle požadavku, ne v adrese) -
  tělo nemá takový limit délky.
- Dokud tenhle doplněk níž nenasadíš, appka **automaticky spadne zpátky**
  na starý GET způsob (pozná to podle chybové odpovědi z Apps Scriptu) -
  appku tedy nic nerozbije, jen zůstane omezená jako dřív, dokud
  nenasadíš krok níž.
- Přidala jsem 2 automatická opakování při výpadku sítě (dřív appka
  spadla hned napoprvé).
- Appka teď uloží rozpracovanou otázku do historie ještě PŘED čekáním na
  odpověď, ne až po ní - takže i když se odpověď nepovede, otázka se
  neztratí při obnovení stránky.

## Co je potřeba doplnit do Apps Scriptu (aby se to opravilo doopravdy)

Do stejného Apps Script projektu, který dnes obsluhuje `action=check`,
`action=ai` a `action=zdarma` pro tuhle appku
(`AKfycbyP2l58OvGi5mzk-PXMaGNRZoMj4E8C3vn7o4Ib89DVhqdePdj90OWUUHXC1hYiQ5pC`),
doplň funkci `doPost` - **nemusíš se vůbec dotýkat existujícího `doGet`**,
tahle funkce mu jen předá stejná data, jaká by dostal z adresy, jen tentokrát
z těla požadavku:

```javascript
function doPost(e) {
  try {
    var telo = JSON.parse(e.postData.contents);
    if (telo && telo.action === 'ai') {
      if (!e.parameter) e.parameter = {};
      e.parameter.action = 'ai';
      e.parameter.messages = JSON.stringify(telo.messages);
      return doGet(e);
    }
  } catch (err) {
    // Tělo požadavku nešlo přečíst - spadneme na doGet(e) níž, staré
    // GET volání (action=check, action=zdarma) dál funguje beze změny.
  }
  return doGet(e);
}
```

### Jak to nasadit

1. Otevři script.google.com, najdi projekt, který stojí za
   `AKfycbyP2l58OvGi5mzk-PXMaGNRZoMj4E8C3vn7o4Ib89DVhqdePdj90OWUUHXC1hYiQ5pC`
   (stejný, kam jsi dřív přidávala `overitZdarma`).
2. Přidej funkci `doPost` podle kódu výš (pokud už nějaký `doPost` máš,
   dej vědět, spíš ho jen doplníme, ne přepíšeme).
3. Ulož, **znovu nasaď jako Web App** (Deploy → Manage deployments →
   Edit → New version) - jinak se změna neprojeví na stávající adrese.
4. Dej mi vědět, já to hned nato ověřím živě dlouhou testovací konverzací
   (20+ zpráv), ať máme jistotu, že appka teď zvládne i dlouhý rozhovor
   bez pádu.

Appka samotná už je na tuhle změnu připravená a nic se nemusí dít na
mojí straně znovu - jakmile `doPost` nasadíš, appka si POST cestu najde
sama při dalším requestu.
