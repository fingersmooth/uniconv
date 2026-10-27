/**
 * ============================================================================
 *  UniConv — tools/options-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier la page de reglages (iteration 8) SANS ouvrir de navigateur.
 *
 *  TROIS FAMILLES DE CONTROLES
 *  ---------------------------
 *  1. COHERENCE HTML <-> JAVASCRIPT : chaque element manipule par options.js
 *     existe vraiment dans options.html. C'est le controle le plus utile : une
 *     faute de frappe sur un identifiant donne une page qui « ne fait rien »,
 *     sans aucune erreur visible.
 *  2. VALIDATION : les fonctions pures (domaine, delai, import JSON) sont
 *     testees sur des cas normaux ET sur des cas pieges.
 *  3. MANIFESTE : la page d'options est declaree, et le fichier existe.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/options-tests.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const OPTIONS_JS = join(ROOT, 'src', 'options.js');
const OPTIONS_HTML = join(ROOT, 'src', 'options.html');
const MANIFEST = join(ROOT, 'manifest.json');

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

const jsSource = readFileSync(OPTIONS_JS, 'utf8');
const htmlSource = readFileSync(OPTIONS_HTML, 'utf8');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

console.log('UniConv — page de reglages');
console.log(`  fichiers : ${OPTIONS_HTML}`);
console.log(`             ${OPTIONS_JS}`);
console.log('');

// ===========================================================================
//  1. Coherence HTML <-> JavaScript
// ===========================================================================

console.log('1. Chaque element utilise par le script existe dans la page');

const htmlIds = new Set(
  (htmlSource.match(/\bid="([^"]+)"/g) || []).map((match) => match.slice(4, -1))
);

const usedIds = Array.from(
  new Set((jsSource.match(/getElementById\('([^']+)'\)/g) || [])
    .map((match) => match.slice("getElementById('".length, -2)))
);

check(usedIds.length >= 12, 'le script manipule un nombre plausible d\'elements',
  `${usedIds.length} identifiant(s)`);

const missingIds = usedIds.filter((id) => !htmlIds.has(id));
check(
  missingIds.length === 0,
  'tous les identifiants utilises existent dans le HTML',
  `absents du HTML : ${missingIds.join(', ')}`);

// Les groupes segmentes sont adresses par identifiant : ils doivent contenir
// des boutons « data-value ».
for (const group of ['unit-system', 'language', 'theme']) {
  const block = htmlSource.indexOf(`id="${group}"`);
  const hasButtons = block !== -1 &&
    /data-value="/.test(htmlSource.slice(block, block + 400));
  check(hasButtons, `le groupe « ${group} » a des boutons data-value`);
}

// Les valeurs proposees doivent correspondre a celles acceptees par le script.
for (const [group, values] of [
  ['unit-system', ['metric', 'imperial']],
  ['language', ['fr', 'en', 'auto']],
  ['theme', ['light', 'dark', 'auto']]
]) {
  const block = htmlSource.slice(htmlSource.indexOf(`id="${group}"`));
  const provided = (block.slice(0, 500).match(/data-value="([^"]+)"/g) || [])
    .map((match) => match.slice(12, -1));

  const ok = values.every((value) => provided.indexOf(value) !== -1);
  check(ok, `le groupe « ${group} » propose ${values.join(' / ')}`,
    `valeurs trouvees : ${provided.join(', ')}`);
}

// ===========================================================================
//  2. Fonctions de validation
// ===========================================================================

console.log('');
console.log('2. Nettoyage et validation des noms de domaine');

/** Extrait une fonction complete (accolades comptees). */
function extractBlock(name) {
  const start = jsSource.indexOf(`function ${name}`);
  if (start === -1) {
    throw new Error(`fonction introuvable dans options.js : ${name}`);
  }
  let depth = 0;
  let started = false;
  for (let index = start; index < jsSource.length; index += 1) {
    const character = jsSource[index];
    if (character === '{') {
      depth += 1;
      started = true;
    } else if (character === '}') {
      depth -= 1;
      if (started && depth === 0) {
        return jsSource.slice(start, index + 1);
      }
    }
  }
  throw new Error(`fonction mal fermee : ${name}`);
}

/** Extrait `const NOM = ...;` (jusqu'au point-virgule). */
function extractConst(name) {
  const start = jsSource.indexOf(`const ${name} =`);
  if (start === -1) {
    throw new Error(`constante introuvable dans options.js : ${name}`);
  }
  const end = jsSource.indexOf(';', start);
  return jsSource.slice(start, end + 1);
}

const pieces = [
  extractConst('DEFAULTS'),
  extractConst('SETTING_KEYS'),
  extractBlock('normalizeHost'),
  extractBlock('isValidHost'),
  extractBlock('isDuplicateHost'),
  extractBlock('formatDelayLabel'),
  extractBlock('parseSettingsJson')
];

pieces.push(
  'return { normalizeHost, isValidHost, isDuplicateHost, formatDelayLabel, ' +
  'parseSettingsJson, DEFAULTS, SETTING_KEYS };'
);

let api;
try {
  api = new Function(pieces.join('\n\n'))();
} catch (error) {
  console.error('ECHEC : les fonctions extraites ne compilent pas.');
  console.error('        detail : ' + error.message);
  process.exit(1);
}

const normalizeCases = [
  ['example.com', 'example.com'],
  ['  Example.COM  ', 'example.com'],
  ['https://www.example.com/page?x=1', 'www.example.com'],
  ['http://example.com:8080/', 'example.com'],
  ['.example.com', 'example.com'],
  ['user@example.com', 'example.com'],
  ['', '']
];

let normalizeFailed = 0;
for (const [input, expected] of normalizeCases) {
  const actual = api.normalizeHost(input);
  if (actual !== expected) {
    normalizeFailed += 1;
    console.log(`        ${JSON.stringify(input)} -> ${JSON.stringify(actual)} ` +
      `(attendu ${JSON.stringify(expected)})`);
  }
}
check(normalizeFailed === 0, 'les domaines sont nettoyes correctement',
  `${normalizeFailed} cas en erreur`);

const validHosts = ['example.com', 'mail.google.com', 'a-b.co.uk', 'localhost'];
const invalidHosts = ['', 'example', '.com', 'exa mple.com', '192.168.1.1',
  'http://example.com', '-example.com', 'example..com', 'exa_mple.com'];

const badValid = validHosts.filter((host) => !api.isValidHost(host));
check(badValid.length === 0, 'les domaines valides sont acceptes',
  `refuses a tort : ${badValid.join(', ')}`);

const badInvalid = invalidHosts.filter((host) => api.isValidHost(host));
check(badInvalid.length === 0, 'les saisies invalides sont refusees',
  `acceptes a tort : ${badInvalid.join(', ')}`);

check(api.isDuplicateHost(['a.com'], 'a.com') === true &&
  api.isDuplicateHost(['a.com'], 'b.com') === false,
  'les doublons sont detectes');

// ===========================================================================
//  3. Delai et import/export
// ===========================================================================

console.log('');
console.log('3. Delai d\'apparition et import des reglages');

check(api.formatDelayLabel(0) === 'immédiat', '0 ms s\'affiche « immédiat »',
  api.formatDelayLabel(0));
check(api.formatDelayLabel(250) === '250 ms', '250 s\'affiche « 250 ms »',
  api.formatDelayLabel(250));
check(api.formatDelayLabel(-5) === 'immédiat', 'une valeur negative est traitee comme 0');

// Import : cas normal.
const good = api.parseSettingsJson(JSON.stringify({
  'uniconv.targetCurrency': 'jpy',
  'uniconv.unitSystem': 'imperial',
  'uniconv.language': 'en',
  'uniconv.theme': 'light',
  'uniconv.hoverDelay': 300,
  'uniconv.detectUnits': false,
  'uniconv.blacklist': ['https://Example.com/x', 'pas un domaine', 'ok.fr']
}));

check(good.errors.length === 0, 'un import valide ne signale aucune erreur',
  good.errors.join(' '));
check(good.settings['uniconv.targetCurrency'] === 'JPY',
  'le code de devise est mis en majuscules',
  String(good.settings['uniconv.targetCurrency']));
check(good.settings['uniconv.unitSystem'] === 'imperial',
  'le systeme d\'unites est repris');
check(good.settings['uniconv.hoverDelay'] === 300, 'le delai est repris');
check(
  JSON.stringify(good.settings['uniconv.blacklist']) === JSON.stringify(['example.com', 'ok.fr']),
  'la liste noire importee est nettoyee et filtree',
  JSON.stringify(good.settings['uniconv.blacklist']));

// Import : valeurs invalides.
const bad = api.parseSettingsJson(JSON.stringify({
  'uniconv.unitSystem': 'furlongs',
  'uniconv.hoverDelay': 99999,
  'uniconv.targetCurrency': 'EURO',
  'uniconv.detectUnits': 'oui'
}));

check(Object.keys(bad.settings).length === 0,
  'aucune valeur invalide n\'est appliquee',
  JSON.stringify(bad.settings));
check(bad.errors.length === 4, 'les quatre valeurs invalides sont signalees',
  `${bad.errors.length} erreur(s) : ${bad.errors.join(' ')}`);

// Import : texte qui n'est pas du JSON.
const broken = api.parseSettingsJson('{ pas du json ');
check(broken.errors.length === 1 && /JSON invalide/.test(broken.errors[0]),
  'un JSON casse est signale clairement', broken.errors.join(' '));

const empty = api.parseSettingsJson('   ');
check(empty.errors.length === 1, 'un texte vide est signale');

const foreign = api.parseSettingsJson(JSON.stringify({ autre: 'chose' }));
check(foreign.errors.length === 1, 'un JSON sans reglage UniConv est signale',
  foreign.errors.join(' '));

// Toutes les cles exportees doivent etre couvertes par les valeurs par defaut.
check(
  api.SETTING_KEYS.length === api.SETTING_KEYS.filter(
    (key) => Object.prototype.hasOwnProperty.call(api.DEFAULTS, key)).length,
  'chaque cle de reglage a une valeur par defaut');

check(
  api.SETTING_KEYS.every((key) => /^uniconv\./.test(key)),
  'toutes les cles sont prefixees par « uniconv. »');

// ===========================================================================
//  4. Manifeste et fichiers
// ===========================================================================

console.log('');
console.log('4. Manifeste et fichiers');

check(Boolean(manifest.options_ui) && manifest.options_ui.page === 'src/options.html',
  'le manifeste declare src/options.html comme page d\'options',
  JSON.stringify(manifest.options_ui));

check(manifest.options_ui && manifest.options_ui.open_in_tab === true,
  'la page s\'ouvre dans un onglet (plus confortable qu\'un panneau)');

check(existsSync(OPTIONS_HTML), 'le fichier options.html existe');
check(existsSync(OPTIONS_JS), 'le fichier options.js existe');

check(/<script src="options.js"><\/script>/.test(htmlSource),
  'la page charge bien options.js');

check(!/\son[a-z]+="/i.test(htmlSource),
  'aucun gestionnaire d\'evenement en ligne dans le HTML (bonne pratique)');

// La version affichee doit correspondre au manifeste.
const versionMatch = jsSource.match(/const UNICONV_VERSION = '([^']+)'/);
check(
  Boolean(versionMatch) && versionMatch[1] === manifest.version,
  'la version affichee correspond au manifeste',
  `options.js : ${versionMatch ? versionMatch[1] : '?'} / manifeste : ${manifest.version}`);

// Permissions : « storage » (reglages et taux) et « activeTab » (capture de
// l'onglet pour l'OCR, accordee uniquement au clic sur l'icone).
const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
const ALLOWED = ['storage', 'activeTab', 'contextMenus'];
check(
  permissions.every((permission) => ALLOWED.indexOf(permission) !== -1),
  'aucune permission inattendue n\'a ete ajoutee',
  permissions.join(', '));

// ===========================================================================
//  Bilan
// ===========================================================================

console.log('');
console.log('============================================================');
console.log(`  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('============================================================');

process.exit(failed === 0 ? 0 : 1);
