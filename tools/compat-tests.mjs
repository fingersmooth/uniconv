/**
 * ============================================================================
 *  UniConv — tools/compat-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier la COMPATIBILITE NAVIGATEURS (iteration 13) :
 *
 *    - Firefox (AMO) ;
 *    - Chromium : Chrome, Edge, Brave, Opera, Vivaldi (meme paquet) ;
 *    - Safari 16.4+ (paquet source a convertir en projet Xcode).
 *
 *  CE QUI EST VERIFIE
 *  ------------------
 *    1. Les trois manifestes sont coherents (MV3, permissions, icones).
 *    2. Les seules API `chrome.*` utilisees sont dans la liste AUTORISEE
 *       (toute nouvelle API doit etre revue pour les trois moteurs).
 *    3. Les API partielles ont un garde-fou (ex. capture d'ecran).
 *    4. Aucune URL specifique a un navigateur n'est codee en dur.
 *    5. La documentation cite bien les navigateurs couverts.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/compat-tests.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildPackages, readFromArchive } from './package.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

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

// ---------------------------------------------------------------------------
console.log('');
console.log('1. Les trois paquets se construisent');
// ---------------------------------------------------------------------------

let built = null;
let buildError = null;
try {
  built = buildPackages();
} catch (error) {
  buildError = error;
}

check(buildError === null, 'les paquets Firefox, Chromium et Safari sont produits',
  buildError ? buildError.message : null);

if (!built) {
  console.log(`  Resultat : ${passed} reussi(s), ${failed + 1} echec(s)`);
  process.exit(1);
}

const firefox = JSON.parse(readFromArchive(built.firefox, 'manifest.json'));
const chromium = JSON.parse(readFromArchive(built.chromium, 'manifest.json'));
const safari = JSON.parse(readFromArchive(built.safari, 'manifest.json'));

for (const [name, manifest] of [['Firefox', firefox], ['Chromium', chromium], ['Safari', safari]]) {
  check(manifest.manifest_version === 3, `${name} : Manifest V3`);
  check(Boolean(manifest.action && manifest.action.default_popup),
    `${name} : popup declare`);
  check(Boolean(manifest.options_ui && manifest.options_ui.page),
    `${name} : page de reglages declaree`);
  check(Array.isArray(manifest.content_scripts) &&
    manifest.content_scripts.some((entry) =>
      (entry.matches || []).includes('http://*/*') &&
      (entry.matches || []).includes('https://*/*')),
    `${name} : script de page sur http et https`);
}

check(firefox.background && Array.isArray(firefox.background.scripts) &&
  firefox.browser_specific_settings,
  'Firefox : page d\'evenement + bloc gecko');
check(!chromium.browser_specific_settings && !safari.browser_specific_settings,
  'Chromium et Safari : aucun bloc gecko');
check(chromium.background.service_worker === 'src/background.js' &&
  safari.background.service_worker === 'src/background.js',
  'Chromium et Safari : service worker identique');
check(Boolean(safari.options_ui) && safari.options_ui.open_in_tab === undefined,
  'Safari : options_ui sans « open_in_tab »');

check(existsSync(built.safariDir) && existsSync(join(built.safariDir, 'manifest.json')),
  'Safari : dossier pret pour « safari-web-extension-converter »', built.safariDir);

// ---------------------------------------------------------------------------
console.log('');
console.log('2. Permissions : moindre privilege');
// ---------------------------------------------------------------------------

const permissions = firefox.permissions || [];
check(permissions.length === 3 && permissions.includes('storage') &&
  permissions.includes('activeTab') && permissions.includes('contextMenus'),
  'trois permissions : storage, activeTab et contextMenus',
  permissions.join(', '));

const hosts = (firefox.host_permissions || []).slice().sort();
const expectedHosts = [
  'https://api.exchangerate-api.com/v4/latest/*',
  'https://api.frankfurter.dev/v1/*',
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api/*',
  'https://latest.currency-api.pages.dev/v1/currencies/*',
  'https://open.er-api.com/v6/latest/*'
].sort();
check(JSON.stringify(hosts) === JSON.stringify(expectedHosts),
  'les 5 hotes de taux sont exactement ceux utilises',
  hosts.join(', '));

check(JSON.stringify(chromium.host_permissions) === JSON.stringify(firefox.host_permissions) &&
  JSON.stringify(safari.host_permissions) === JSON.stringify(firefox.host_permissions),
  'les trois manifestes demandent les memes hotes');

// ---------------------------------------------------------------------------
console.log('');
console.log('2bis. Durcissement securite');
// ---------------------------------------------------------------------------

const backgroundSource = readFileSync(join(ROOT, 'src', 'background.js'), 'utf8');
const contentSource = readFileSync(join(ROOT, 'src', 'content.js'), 'utf8');
const engineSource = readFileSync(join(ROOT, 'src', 'engine.js'), 'utf8');
const reportSource = readFileSync(join(ROOT, 'src', 'report.js'), 'utf8');

check(/sender && sender\.id && sender\.id !== chrome\.runtime\.id/.test(backgroundSource) &&
  /sender && sender\.id && sender\.id !== chrome\.runtime\.id/.test(engineSource) &&
  /sender && sender\.id && sender\.id !== chrome\.runtime\.id/.test(contentSource),
  'les messages d\'autres extensions sont rejetes (sender.id)');

check(/function isSafeRate/.test(backgroundSource) &&
  /function sanitizeRates/.test(backgroundSource) &&
  /sanitizeRates\(stored\.rates\)/.test(backgroundSource),
  'les taux reseau et stockes sont valides et nettoyes');

check(/function normalizeOcrRect/.test(backgroundSource) &&
  /function sanitizeBugReport/.test(backgroundSource) &&
  /image\.length > 8 \* 1024 \* 1024/.test(backgroundSource),
  'les entrees OCR/rapport sont bornees');

check(/base-uri 'none'/.test(firefox.content_security_policy.extension_pages) &&
  /form-action 'none'/.test(firefox.content_security_policy.extension_pages),
  'la CSP interdit base-uri et form-action');

check(/data:image\\\/png;base64/.test(reportSource) ||
  /data:image\/png;base64/.test(reportSource),
  'le rapport valide le type de son image');

// ---------------------------------------------------------------------------
console.log('');
console.log('3. API navigateur : liste autorisee et garde-fous');
// ---------------------------------------------------------------------------

/**
 * API `chrome.*` disponibles sur les trois moteurs.
 * Toute nouvelle API doit etre ajoutee ICI apres verification.
 */
const ALLOWED_APIS = new Set([
  'chrome.action.setBadgeBackgroundColor',
  'chrome.action.setBadgeText',
  'chrome.commands.onCommand',
  'chrome.contextMenus.create',
  'chrome.contextMenus.onClicked',
  'chrome.contextMenus.removeAll',
  'chrome.runtime.id',
  'chrome.runtime.getURL',
  'chrome.runtime.onInstalled',
  'chrome.windows.create',
  'chrome.runtime.lastError',
  'chrome.runtime.onMessage',
  'chrome.runtime.openOptionsPage',
  'chrome.runtime.sendMessage',
  'chrome.storage.local',
  'chrome.storage.onChanged',
  'chrome.tabs.captureVisibleTab',
  'chrome.tabs.create',
  'chrome.tabs.query',
  'chrome.tabs.remove',
  'chrome.tabs.sendMessage'
]);

/** API partielles : elles doivent avoir un garde-fou explicite. */
const PARTIAL_APIS = {
  'chrome.tabs.captureVisibleTab': 'la capture d\'ecran peut manquer (Safari, contextes restreints)'
};

const sources = readdirSync(join(ROOT, 'src'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, source: readFileSync(join(ROOT, 'src', file), 'utf8') }));

const usedApis = new Set();
for (const { source } of sources) {
  for (const match of source.matchAll(/chrome\.([A-Za-z]+)\.([A-Za-z]+)/g)) {
    usedApis.add(`chrome.${match[1]}.${match[2]}`);
  }
}

const unknown = [...usedApis].filter((api) => !ALLOWED_APIS.has(api));
check(unknown.length === 0, 'aucune API hors de la liste autorisee',
  unknown.join(', '));

for (const [api, why] of Object.entries(PARTIAL_APIS)) {
  const guard = sources.some(({ source }) =>
    source.includes('typeof chrome.tabs.captureVisibleTab !==')) ;
  check(guard, `garde-fou present pour ${api} (${why})`);
}

const background = sources.find(({ file }) => file === 'background.js').source;
check(background.includes('pas prise en charge par ce navigateur'),
  'la capture absente produit un message clair, pas une erreur technique');

const usesBrowserNamespace = sources.some(({ source }) => /\bbrowser\.(runtime|tabs|storage|action)\b/.test(source));
check(!usesBrowserNamespace, 'le code reste sur le namespace « chrome » (compatible partout)');

// On ignore les commentaires : ils peuvent citer un schema pour expliquer un bug.
const codeOnly = sources.map(({ source }) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, ''));

check(!codeOnly.some((source) => /moz-extension:|chrome-extension:/.test(source)),
  'aucune URL specifique a un navigateur n\'est codee en dur');

// ---------------------------------------------------------------------------
console.log('');
console.log('4. Documentation des navigateurs');
// ---------------------------------------------------------------------------

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
for (const browser of ['Firefox', 'Chrome', 'Edge', 'Safari', 'Brave', 'Opera']) {
  check(readme.includes(browser), `le README cite ${browser}`);
}

check(readme.includes('chromium.zip') && readme.includes('safari.zip'),
  'le README donne les noms des archives');

const publication = readFileSync(join(ROOT, 'docs', 'PUBLICATION.md'), 'utf8');
check(/Safari/.test(publication) && /safari-web-extension-converter/.test(publication),
  'le guide de publication explique la conversion Safari');
check(/Edge|Brave|Opera/.test(publication),
  'le guide de publication couvre les navigateurs Chromium');

// ---------------------------------------------------------------------------
console.log('');
console.log('='.repeat(60));
console.log(failed === 0
  ? `  Resultat : ${passed} reussi(s), 0 echec(s)`
  : `  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('='.repeat(60));

process.exit(failed === 0 ? 0 : 1);
