/**
 * ============================================================================
 *  UniConv — tools/popup-tests.mjs
 * ============================================================================
 *
 *  ROLE
 *  ----
 *  Verifier le popup sans navigateur :
 *    - le bouton OCR est bien dans l'en-tete, a cote du titre ;
 *    - le convertisseur (devises ET unites) a tous ses champs ;
 *    - la table d'unites du popup est IDENTIQUE a celle de content.js
 *      (memes tokens, memes facteurs) : impossible de diverger en silence ;
 *    - la version affichee est celle du manifeste ;
 *    - pas de innerHTML (regle de securite du projet).
 *
 *  UTILISATION
 *  -----------
 *      node tools/popup-tests.mjs
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POPUP_HTML = join(ROOT, 'src', 'popup.html');
const POPUP_JS = join(ROOT, 'src', 'popup.js');
const CONVERTER_JS = join(ROOT, 'src', 'converter.js');
const CONVERTER_HTML = join(ROOT, 'src', 'converter.html');
const CONVERTER_PAGE_JS = join(ROOT, 'src', 'converter-page.js');
const TUTORIAL_HTML = join(ROOT, 'src', 'tutorial.html');
const TUTORIAL_JS = join(ROOT, 'src', 'tutorial.js');
const OPTIONS_HTML = join(ROOT, 'src', 'options.html');
const I18N_JS = join(ROOT, 'src', 'i18n.js');
const CONTENT_JS = join(ROOT, 'src', 'content.js');
const MANIFEST = join(ROOT, 'manifest.json');

const html = readFileSync(POPUP_HTML, 'utf8');
const js = readFileSync(POPUP_JS, 'utf8');
const converter = readFileSync(CONVERTER_JS, 'utf8');
const converterHtml = readFileSync(CONVERTER_HTML, 'utf8');
const converterPageJs = readFileSync(CONVERTER_PAGE_JS, 'utf8');
const tutorialHtml = readFileSync(TUTORIAL_HTML, 'utf8');
const tutorialJs = readFileSync(TUTORIAL_JS, 'utf8');
const optionsHtml = readFileSync(OPTIONS_HTML, 'utf8');
const i18n = readFileSync(I18N_JS, 'utf8');
const content = readFileSync(CONTENT_JS, 'utf8');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const version = manifest.version;

let passed = 0;
let failed = 0;

function check(ok, label, detail) {
  if (ok) {
    passed += 1;
    console.log(`  OK    ${label}`);
  } else {
    failed += 1;
    console.log(`  ECHEC ${label}`);
    if (detail) {
      console.log(`        ${detail}`);
    }
  }
}

/** Extrait l'en-tete (pour verifier la place du bouton Scan). */
function headText(source) {
  const match = source.match(/<header class="popup-header">([\s\S]*?)<\/header>/);
  return match ? match[1] : '';
}

/** Extrait une fonction equilibree : function NAME(...) { ... }. */
function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`fonction ${name} introuvable`);
  }

  let depth = 0;
  let started = false;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
      started = true;
    } else if (source[index] === '}') {
      depth -= 1;
      if (started && depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`fonction ${name} mal fermee`);
}

function approx(actual, expected, tolerance) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= (tolerance || 0.0000001);
}

/** Extrait un tableau equilibre : const NAME = [ ... ]; */
function extractArray(source, name) {
  const marker = `const ${name} = [`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`tableau ${name} introuvable`);
  }

  let depth = 0;
  let started = false;
  let end = start;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '[') {
      depth += 1;
      started = true;
    } else if (source[index] === ']') {
      depth -= 1;
      if (started && depth === 0) {
        end = source.indexOf(';', index) + 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

console.log('UniConv — verification du popup');
console.log(`  fichier : ${POPUP_HTML}`);
console.log('');

// ---------------------------------------------------------------------------
console.log('1. En-tete : titre et bouton OCR');
// ---------------------------------------------------------------------------
const headerMatch = html.match(/<header class="popup-header">([\s\S]*?)<\/header>/);
const header = headerMatch ? headerMatch[1] : '';

check(
  header !== '' && /class="popup-title"/.test(header) && /id="ocr-button"/.test(header),
  'le bouton OCR est dans l\'en-tete, avec le titre',
  header === '' ? 'en-tete introuvable' : header.slice(0, 120)
);

check(
  /popup-title[\s\S]*id="ocr-button"/.test(header),
  'le bouton OCR est place APRES le titre UniConv',
  header === '' ? 'en-tete introuvable' : null
);

check(
  (html.match(/id="ocr-button"/g) || []).length === 1,
  'un seul bouton OCR (pas de doublon en bas de page)'
);

// ---------------------------------------------------------------------------
console.log('');
console.log('2. Convertisseur : champs et onglets');
// ---------------------------------------------------------------------------
const requiredIds = [
  'conv-amount', 'conv-from', 'conv-to', 'conv-result',
  'unit-amount', 'unit-category', 'unit-from', 'unit-to', 'unit-result',
  'tab-currency', 'tab-unit', 'pane-currency', 'pane-unit'
];
const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));

check(
  missingIds.length === 0,
  'tous les champs du convertisseur sont presents',
  missingIds.length ? `manquants : ${missingIds.join(', ')}` : null
);

check(
  /aria-controls="pane-currency"/.test(html) && /aria-controls="pane-unit"/.test(html),
  'les deux onglets sont relies a leurs panneaux (ARIA)'
);

// ---------------------------------------------------------------------------
console.log('');
console.log('3. Table d\'unites du popup = table de content.js');
// ---------------------------------------------------------------------------
const popupGroups = new Function(
  `${extractArray(converter, 'POPUP_UNIT_GROUPS')}\nreturn POPUP_UNIT_GROUPS;`
)();
const contentUnits = new Function(
  `${extractArray(content, 'UNITS')}\nreturn UNITS;`
)();

const missingInContent = [];
const factorMismatch = [];

for (const group of popupGroups) {
  for (const unit of group.units) {
    const reference = contentUnits.find(
      (candidate) => Array.isArray(candidate.tokens) && candidate.tokens.includes(unit.token)
    );

    if (!reference) {
      missingInContent.push(`${group.id}:${unit.token}`);
      continue;
    }
    if (reference.factor !== unit.factor) {
      factorMismatch.push(`${unit.token} (${unit.factor} vs ${reference.factor})`);
    }
  }
}

check(
  missingInContent.length === 0,
  'chaque unite du popup existe dans content.js',
  missingInContent.length ? `absentes : ${missingInContent.join(', ')}` : null
);

check(
  factorMismatch.length === 0,
  'les facteurs de conversion sont identiques',
  factorMismatch.length ? `ecarts : ${factorMismatch.join(', ')}` : null
);

check(
  popupGroups.length === 5 &&
    popupGroups.every((group) => group.units.length >= 3),
  'cinq categories, au moins trois unites chacune',
  popupGroups.map((group) => `${group.id}:${group.units.length}`).join(', ')
);

// ---------------------------------------------------------------------------
console.log('');
console.log('3bis. Conversions reelles du popup');
// ---------------------------------------------------------------------------
const convertPopupUnitFn = new Function(
  `${extractArray(converter, 'POPUP_UNIT_GROUPS')}\n` +
  `${extractFunction(converter, 'converterUnitGroup')}\n` +
  `${extractFunction(converter, 'convertPopupUnit')}\n` +
  'return convertPopupUnit;'
)();

check(approx(convertPopupUnitFn(1, 'weight', 'kg', 'lb'), 2.2046226218),
  '1 kg -> 2,2046 lb', String(convertPopupUnitFn(1, 'weight', 'kg', 'lb')));
check(approx(convertPopupUnitFn(1, 'length', 'mi', 'km'), 1.609344),
  '1 mile -> 1,609344 km', String(convertPopupUnitFn(1, 'length', 'mi', 'km')));
check(approx(convertPopupUnitFn(1, 'volume', 'L', 'gal'), 0.2641720524),
  '1 L -> 0,2642 gal', String(convertPopupUnitFn(1, 'volume', 'L', 'gal')));
check(approx(convertPopupUnitFn(0, 'temperature', '°C', '°F'), 32),
  '0 °C -> 32 °F', String(convertPopupUnitFn(0, 'temperature', '°C', '°F')));
check(approx(convertPopupUnitFn(100, 'temperature', '°C', 'K'), 373.15),
  '100 °C -> 373,15 K', String(convertPopupUnitFn(100, 'temperature', '°C', 'K')));

// ---------------------------------------------------------------------------
console.log('');
console.log('4. Coherence et securite');
// ---------------------------------------------------------------------------
check(
  js.includes(`const UNICONV_VERSION = '${version}'`),
  `la version du popup est celle du manifeste (${version})`
);

check(
  typeof popupGroups === 'object' &&
    /function convertPopupUnit/.test(converter) &&
    /function refreshCurrencyConversion/.test(converter) &&
    /function initConverter/.test(converter),
  'les fonctions du convertisseur sont presentes'
);

check(
  !/\.innerHTML\s*=/.test(js) && !/\.innerHTML\s*=/.test(converter),
  'ni le popup ni le convertisseur n\'utilisent innerHTML'
);

check(
  html.includes('<script src="converter.js"></script>') &&
    converterHtml.includes('<script src="converter.js"></script>') &&
    converterHtml.includes('<script src="converter-page.js"></script>'),
  'le convertisseur partage est charge dans le popup et la page autonome'
);

check(
  /conv-amount/.test(converterHtml) && /focus\(\)/.test(converterPageJs) &&
    /select\(\)/.test(converterPageJs),
  'la page autonome selectionne le champ de montant a l\'ouverture'
);

check(
  headText(html).includes('id="ocr-button"') && /Scan<\/button>/.test(html),
  'le bouton s\'appelle « Scan »'
);

check(
  manifest.commands &&
    manifest.commands['scan-page'] &&
    manifest.commands['open-converter'],
  'deux commandes declarées : Scan et convertisseur'
);

check(
  /commands\.onCommand\.addListener/.test(readFileSync(join(ROOT, 'src', 'background.js'), 'utf8')),
  'l\'arriere-plan ecoute les commandes'
);

// ---------------------------------------------------------------------------
console.log('');
console.log('5. Tutoriel, installation et reglage du Scan');
// ---------------------------------------------------------------------------
const background = readFileSync(join(ROOT, 'src', 'background.js'), 'utf8');

check(
  /<h1>UniConv/.test(tutorialHtml) &&
    /Devises/.test(tutorialHtml) && /Scan \(OCR\)/.test(tutorialHtml) &&
    /fuseaux/.test(tutorialHtml) && /Raccourcis/.test(tutorialHtml),
  'le tutoriel couvre devises, unites, fuseaux, Scan et raccourcis'
);

check(
  tutorialHtml.includes('<script src="tutorial.js"></script>') &&
    !/<script(?![^>]*\bsrc=)[^>]*>/.test(tutorialHtml),
  'le tutoriel charge son script externe (CSP MV3, pas d\'inline)'
);

check(
  /onInstalled/.test(background) && /tutorial\.html/.test(background) &&
    /systemLanguage/.test(background),
  'l\'installation resout la langue systeme et ouvre le tutoriel'
);

check(
  /id="open-tutorial"/.test(html) &&
    /id="open-tutorial"/.test(optionsHtml) &&
    /id="ocr-enabled"/.test(optionsHtml),
  'le tutoriel est accessible depuis le popup et les reglages, avec la case Scan'
);

check(
  ['es', 'ru', 'zh', 'ar'].every((code) => optionsHtml.includes(`data-value="${code}"`)) &&
    ['en', 'es', 'ru', 'zh', 'ar'].every((code) => i18n.includes(`${code}:`)),
  'six langues visibles et traduites : fr, en, es, ru, zh, ar'
);

check(
  /class="gear-button"[^>]*id="open-options"/.test(html) &&
    /class="gear-icon"/.test(html) &&
    /width: 30px/.test(html) && /width: 18px/.test(html) &&
    !/class="refresh-button"[^>]*id="open-options"/.test(html) &&
    (html.match(/id="open-options"/g) || []).length === 1,
  'les reglages sont un engrenage SVG aligne en haut a droite'
);

check(
  /width:\s*360px/.test(html) && /scrollbar-gutter:\s*stable/.test(html) &&
    /overflow-x:\s*hidden/.test(html),
  'le popup est assez large et sans barre horizontale'
);

check(
  !/OCR automatique/i.test(optionsHtml) &&
    !/autoOcr|ocrAuto|ocr-auto/.test(content) &&
    !/auto-ocr-stats/.test(html),
  'l OCR automatique est entierement retire'
);

check(
  /UNICONV_LANGUAGES\.indexOf\(nav\) !== -1 \? nav : 'en'/.test(i18n) &&
    /dir = lang === 'ar' \? 'rtl'/.test(i18n),
  'langue systeme sinon anglais, avec arabe RTL'
);

check(
  ['popup.html', 'options.html', 'tutorial.html', 'converter.html']
    .every((file) => readFileSync(join(ROOT, 'src', file), 'utf8').includes('src="i18n.js"')),
  'les quatre pages chargent le module de traduction'
);

check(
  /es:\s*'convirtiendo/.test(content) &&
    /ru:\s*'преобразование/.test(content) &&
    /zh:\s*'转换中/.test(content),
  'les messages de la bulle existent en espagnol, russe et chinois'
);

check(
  /setOcrEnabled/.test(js) && /ocr-enabled-popup/.test(html),
  'le popup a sa propre case pour activer/desactiver le Scan'
);

check(
  /class="reference-box"/.test(html) &&
    html.indexOf('reference-box') < html.indexOf('<section class="converter"') &&
    /id="reference-currency-search"/.test(html) &&
    /id="reference-currency-field"/.test(html) &&
    /id="reference-currency-list"/.test(html) &&
    /id="reference-timezone"/.test(html) &&
    /id="units-metric"/.test(html) &&
    !/class="units-box"/.test(html),
  'le cadre « Unités de référence » est en haut, compact et complet'
);

check(
  /initReferenceCard\(\);\s*refreshUnitSystemButtons\(\);/.test(js) &&
    !/function setUnitSystem[\s\S]{0,400}initReferenceCard\(\)/.test(js),
  "le cadre de référence est initialisé au démarrage, pas au clic sur les unités"
);

{
  const backgroundSource = readFileSync(join(ROOT, 'src', 'background.js'), 'utf8');
  check(
    /SCAN_MENU_ID/.test(backgroundSource) &&
      /title: 'Scanner'/.test(backgroundSource) &&
      /contexts: \['page'\]/.test(backgroundSource) &&
      /runScanCommand\(\)/.test(backgroundSource) &&
      /icons: \{/.test(backgroundSource),
    'le clic droit propose Scanner avec le logo de l’extension'
  );

{
  const backgroundSource = readFileSync(join(ROOT, 'src', 'background.js'), 'utf8');
  check(
    /BUG_MENU_ID/.test(backgroundSource) &&
      /title: 'Signaler un bug'/.test(backgroundSource) &&
      /start-bug-report/.test(backgroundSource) &&
      /src\/report\.html/.test(backgroundSource),
    'le clic droit propose « Signaler un bug » et ouvre le rapport local'
  );
}
}

check(
  /const POPUP_CURRENCY_COUNTRIES = \{/.test(js) &&
    /function referenceFlag/.test(js) &&
    /reference-flag/.test(html) &&
    /POPUP_TOP_CURRENCIES = \[\s*'USD', 'EUR', 'JPY', 'GBP', 'CNY'\s*\]/.test(js),
  'le menu du popup affiche les drapeaux et l’ordre d’importance'
);

check(
  /POPUP_TOP_CURRENCIES/.test(js) &&
    /pinnedReferenceCurrencies/.test(js) &&
    /function toggleReferencePin/.test(js) &&
    /function loadReferencePins/.test(js) &&
    /reference-section/.test(html) &&
    /reference-pin/.test(html),
  'le menu du popup a les sections Épinglées / Principales / Autres et l’épinglage'
);

check(
  !/function renderReferenceCurrencyList[\s\S]*?slice\(0, 10\)/.test(js) &&
    /max-height: 240px/.test(html),
  'le menu monnaie contient toutes les devises, avec ~10 lignes visibles'
);

check(
  /function loadReferenceSettings/.test(js) &&
    /function populateReferenceCurrencies/.test(js) &&
    /referenceUnitsEnabled/.test(js),
  'le popup enregistre les unités de référence'
);

check(
  /id="detection-enabled"/.test(html) &&
    !/id="toggle-pause"/.test(html) &&
    !/Alt\s*\+\s*Maj\s*\+\s*U/.test(html),
  'la detection se coupe par une CASE, sans raccourci impose'
);

check(
  /id="detection-enabled"/.test(html) &&
    /setPaused/.test(js) &&
    !/toggle-pause/.test(html) && !/toggle-pause/.test(js),
  'la case du popup enregistre la pause et met a jour le badge'
);

check(
  manifest.permissions.includes('contextMenus') &&
    /title: 'Convertir'/.test(background) &&
    /CONTEXT_MENU_ID/.test(background) &&
    /contextMenus\.onClicked/.test(background),
  'menu contextuel « Convertir » avec permission et clic'
);

check(
  /convert-selection/.test(content) &&
    /findAmountsInText\(value\)/.test(content) &&
    /showTooltip\(amounts\[0\]/.test(content),
  'le texte selectionne est converti par le moteur de la page'
);

check(
  !/Alt\s*\+\s*Maj\s*\+\s*O/.test(html) &&
    !/Alt\s*\+\s*Maj\s*\+\s*O/.test(optionsHtml) &&
    !/Alt\s*\+\s*Maj\s*\+\s*O/.test(tutorialHtml),
  'aucune mention du raccourci OCR impose (Alt+Maj+O)'
);

check(
  /class="donation-footer"/.test(html) &&
    /href="https:\/\/ko-fi\.com\/fingersmooth"/.test(html) &&
    /target="_blank"/.test(html) &&
    /rel="noopener noreferrer"/.test(html),
  'le popup a une rubrique de don Ko-fi, en nouvel onglet sécurisé'
);

console.log('');
console.log('============================================================');
console.log(`  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('============================================================');

process.exit(failed > 0 ? 1 : 0);
