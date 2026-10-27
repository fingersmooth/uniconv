/**
 * ============================================================================
 *  UniConv — tools/memory-report.mjs
 * ============================================================================
 *
 *  ROLE
 *  ----
 *  Mesurer ce qui est MESURABLE sans navigateur :
 *    - le poids des fichiers (source, paquet, extension installee, OCR) ;
 *    - la memoire retenue par les DONNEES de l'extension (devises, villes,
 *      textes) et par le CODE compile, apres ramasse-miettes ;
 *    - en deduire un plancher par onglet, hors OCR.
 *
 *  CE QUE CE SCRIPT NE FAIT PAS
 *  ----------------------------
 *  Il ne mesure pas la memoire d'un vrai onglet Firefox : le moteur JS, le
 *  DOM de la page et les processus du navigateur ne sont pas reproductibles
 *  ici. Les chiffres « par onglet » sont donc un PLANCHER mesure, pas une
 *  mesure du processus Firefox. La seule facon d'avoir le chiffre exact est
 *  `about:memory` dans Firefox (voir la fin du rapport).
 *
 *  UTILISATION
 *  -----------
 *      node --expose-gc tools/memory-report.mjs
 *
 *  Sans --expose-gc, le script fonctionne mais les chiffres sont plus bruites.
 */

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'src', 'content.js');
const BACKGROUND = join(ROOT, 'src', 'background.js');
const VENDOR = join(ROOT, 'src', 'vendor');

const source = readFileSync(CONTENT, 'utf8');
const backgroundSource = readFileSync(BACKGROUND, 'utf8');

/** Taille d'un fichier, en octets. */
function sizeOf(path) {
  try {
    return statSync(path).size;
  } catch (error) {
    return 0;
  }
}

/** Taille recursive d'un dossier, en octets. */
function directorySize(path) {
  let total = 0;
  let entries = [];
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch (error) {
    return 0;
  }
  for (const entry of entries) {
    const child = join(path, entry.name);
    total += entry.isDirectory() ? directorySize(child) : sizeOf(child);
  }
  return total;
}

/** Formate des octets en Ko / Mo lisibles. */
function human(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  }
  return `${(bytes / 1024).toFixed(1)} Ko`;
}

/** Ramasse les miettes puis lit le tas. */
function heapUsed() {
  if (typeof global.gc === 'function') {
    global.gc();
  }
  return process.memoryUsage().heapUsed;
}

/**
 * Extrait un tableau ou un objet equilibre depuis la source.
 * Les chaines ne contiennent pas de crochets dans les tables de donnees.
 */
function extractBalanced(name, open, close) {
  const marker = `const ${name} = ${open}`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`table ${name} introuvable`);
  }

  let depth = 0;
  let started = false;
  let end = start;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) {
      depth += 1;
      started = true;
    } else if (source[index] === close) {
      depth -= 1;
      if (started && depth === 0) {
        end = source.indexOf(';', index) + 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

const dataSource = [
  extractBalanced('CURRENCIES', '[', ']'),
  extractBalanced('CURRENCY_META', '{', '}'),
  extractBalanced('TZ_ABBREVIATIONS', '{', '}'),
  extractBalanced('TZ_CITIES', '[', ']'),
  extractBalanced('TEXTS', '{', '}')
].join('\n');

// ---------------------------------------------------------------------------
// 1. Code compile
// ---------------------------------------------------------------------------

const baseHeap = heapUsed();

// On COMPILE le script sans l'executer : il a besoin d'un DOM. Le garder
// vivant empeche le ramasse-miettes de le liberer avant la mesure.
const compiled = new Function(source);
globalThis.__unicornKeepAlive = { compiled };

const afterCode = heapUsed();

// Meme mesure pour le script d'arriere-plan (compile sans etre execute).
let backgroundCompiled = null;
try {
  backgroundCompiled = new Function(backgroundSource);
  globalThis.__unicornKeepAlive.background = backgroundCompiled;
} catch (error) {
  backgroundCompiled = null;
}

const afterBackground = heapUsed();

// ---------------------------------------------------------------------------
// 2. Donnees + index
// ---------------------------------------------------------------------------

const dataFactory = new Function(
  `${dataSource}\nreturn { CURRENCIES, CURRENCY_META, TZ_ABBREVIATIONS, TZ_CITIES, TEXTS };`
);
const data = dataFactory();

// Reproduire l'extension au demarrage : elle ajoute a CURRENCIES les devises
// de CURRENCY_META qui n'y figurent pas (KWD, QAR, TWD...). Sans cela, le
// rapport sous-estimerait la table reelle.
for (const [code, meta] of Object.entries(data.CURRENCY_META)) {
  if (data.CURRENCIES.some((currency) => currency.code === code)) {
    continue;
  }
  const name = String(meta && meta.name ? meta.name : '').toLowerCase();
  data.CURRENCIES.push({
    code: code,
    symbol: null,
    names: name ? [name] : [],
    before: false
  });
}

// Index construits au demarrage, comme dans content.js.
const currencyByCode = new Map();
const currencyByName = new Map();
const currencyBySymbol = new Map();
const currencyCodes = [];

for (const currency of data.CURRENCIES) {
  currencyByCode.set(currency.code, currency);
  currencyCodes.push(currency.code);
  for (const name of currency.names || []) {
    currencyByName.set(name, currency.code);
  }
  if (currency.symbol) {
    if (!currencyBySymbol.has(currency.symbol)) {
      currencyBySymbol.set(currency.symbol, []);
    }
    currencyBySymbol.get(currency.symbol).push(currency.code);
  }
}

const tzCityById = new Map(data.TZ_CITIES.map((entry) => [entry.id, entry]));

globalThis.__unicornKeepAlive.data = {
  data,
  currencyByCode,
  currencyByName,
  currencyBySymbol,
  currencyCodes,
  tzCityById
};

const afterData = heapUsed();

// ---------------------------------------------------------------------------
// 3. Fichiers
// ---------------------------------------------------------------------------

const version = JSON.parse(
  readFileSync(join(ROOT, 'manifest.json'), 'utf8')
).version;

const contentBytes = sizeOf(CONTENT);
const contentGzip = gzipSync(Buffer.from(source)).length;
const backgroundBytes = sizeOf(BACKGROUND);
const popupBytes = sizeOf(join(ROOT, 'src', 'popup.js'));
const optionsBytes = sizeOf(join(ROOT, 'src', 'options.js'));
const engineBytes = sizeOf(join(ROOT, 'src', 'engine.js'));
const vendorBytes = directorySize(VENDOR);
const installedBytes = directorySize(join(ROOT, 'dist', 'safari', `uniconv-${version}`));
const packageBytes = sizeOf(join(ROOT, 'dist', `uniconv-${version}.xpi`));

// ---------------------------------------------------------------------------
// 4. Rapport
// ---------------------------------------------------------------------------

const line = (label, value) => {
  console.log(`  ${label.padEnd(38)} ${value}`);
};

console.log('');
console.log(`UniConv ${version} — rapport memoire`);
console.log('='.repeat(58));
console.log('');

console.log('FICHIERS');
line('content.js', `${human(contentBytes)} (gzip ${human(contentGzip)})`);
line('background.js', human(backgroundBytes));
line('popup.js / options.js / engine.js',
  `${human(popupBytes)} / ${human(optionsBytes)} / ${human(engineBytes)}`);
line('Moteur OCR (vendor/)', human(vendorBytes));
line('Extension installee (non compressee)', human(installedBytes));
line('Paquet .xpi', human(packageBytes));
console.log('');

console.log('MEMOIRE MESUREE (Node, apres ramasse-miettes)');
line('Code compile (content.js)', human(Math.max(0, afterCode - baseHeap)));
line('Code compile (background.js)', human(Math.max(0, afterBackground - afterCode)));
line('Donnees + index', human(Math.max(0, afterData - afterBackground)));
line('  devises', `${data.CURRENCIES.length} entrees`);
line('  villes / fuseaux', `${data.TZ_CITIES.length} entrees`);
line('  textes UI', `${Object.keys(data.TEXTS).length} cles`);
line('Plancher par onglet (code + donnees)',
  human(Math.max(0, afterCode - baseHeap) + Math.max(0, afterData - afterBackground)));
line('Background (code seul)', human(Math.max(0, afterBackground - afterCode)));
console.log('');

console.log('OCR');
line('Fichiers OCR', human(vendorBytes));
line('Onglet moteur', 'ferme apres 120 s d\'inactivite');
line('Memoire active (ordre de grandeur)', '60 a 120 Mo (wasm + fra+eng)');
console.log('');

console.log('LECTURE');
console.log('  - Le « plancher par onglet » est ce que l\'extension elle-meme');
console.log('    retient : code + tables. Firefox ajoute le moteur JS de');
console.log('    l\'onglet et le DOM de la page (non mesures ici).');
console.log('  - Hors OCR, l\'extension ne charge ni wasm ni image :');
console.log('    l\'essentiel du poids est le script et ses tables.');
console.log('  - L\'OCR n\'est charge qu\'a la demande, dans un onglet');
console.log('    d\'extension separe, ferme automatiquement apres 120 s.');
console.log('');
console.log('  Pour le chiffre exact dans Firefox : about:memory ->');
console.log('  « Measure » -> chercher les processus de l\'extension.');
console.log('');

if (typeof global.gc !== 'function') {
  console.log('  (Relancer avec « node --expose-gc » pour des chiffres plus stables.)');
  console.log('');
}
