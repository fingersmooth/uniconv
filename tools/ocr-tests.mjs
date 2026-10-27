/**
 * ============================================================================
 *  UniConv — tools/ocr-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier la lecture OCR (iteration 9, interface revue) sans navigateur.
 *
 *  RAPPEL DE L'ARCHITECTURE
 *  ------------------------
 *  - La PAGE (content.js) dessine le rectangle, puis affiche le texte reconnu
 *    dans une bulle.
 *  - L'ARRIERE-PLAN (background.js) photographie l'onglet, decoupe la zone et
 *    fait tourner le moteur OCR : une page web interdit WebAssembly, pas un
 *    contexte d'extension.
 *
 *  CONTROLES
 *  ---------
 *  1. GEOMETRIE : rectangle dessine -> zone analysee.
 *  2. FICHIERS DU MOTEUR : presence et integrite (8,2 Mo).
 *  3. CHEMINS : chaque chemin reference existe vraiment sur le disque.
 *     (C'est le controle qui a fait defaut en 0.16.0 : « moteur absent ».)
 *  4. ARCHITECTURE : la page ne contient pas le moteur, l'arriere-plan oui,
 *     et les messages attendus existent de chaque cote.
 *  5. CONFIDENTIALITE et manifeste.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/ocr-tests.mjs
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const CONTENT_JS = join(ROOT, 'src', 'content.js');
const ENGINE_JS = join(ROOT, 'src', 'engine.js');
const ENGINE_HTML = join(ROOT, 'src', 'engine.html');
const BACKGROUND_JS = join(ROOT, 'src', 'background.js');
const POPUP_JS = join(ROOT, 'src', 'popup.js');
const POPUP_HTML = join(ROOT, 'src', 'popup.html');
const MANIFEST = join(ROOT, 'manifest.json');
const REPORT_HTML = join(ROOT, 'src', 'report.html');
const REPORT_JS = join(ROOT, 'src', 'report.js');

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

const contentSource = readFileSync(CONTENT_JS, 'utf8');
const engineSource = readFileSync(ENGINE_JS, 'utf8');
const engineHtml = readFileSync(ENGINE_HTML, 'utf8');
const backgroundSource = readFileSync(BACKGROUND_JS, 'utf8');
const popupSource = readFileSync(POPUP_JS, 'utf8');
const popupHtml = readFileSync(POPUP_HTML, 'utf8');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

console.log('UniConv — lecture OCR');
console.log(`  page : ${CONTENT_JS}`);
console.log(`  moteur : ${BACKGROUND_JS}`);
console.log('');

// ===========================================================================
//  Outils d'extraction
// ===========================================================================

/** Extrait une fonction complete d'un fichier source (accolades comptees). */
function extractBlock(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) {
    throw new Error(`fonction introuvable : ${name}`);
  }
  let depth = 0;
  let started = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') {
      depth += 1;
      started = true;
    } else if (character === '}') {
      depth -= 1;
      if (started && depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`fonction mal fermee : ${name}`);
}

/** Extrait `const NOM = ...;`. */
function extractConst(source, name) {
  const start = source.indexOf(`const ${name} =`);
  if (start === -1) {
    throw new Error(`constante introuvable : ${name}`);
  }
  const end = source.indexOf(';', start);
  return source.slice(start, end + 1);
}

// ===========================================================================
//  1. Geometrie de la selection
// ===========================================================================

console.log('1. Géométrie : du rectangle dessiné à la zone analysée');

const geometry = new Function([
  extractConst(contentSource, 'OCR_MIN_SIDE'),
  extractBlock(contentSource, 'selectionFromPoints'),
  extractBlock(contentSource, 'isUsableOcrRect'),
  'return { selectionFromPoints, isUsableOcrRect, OCR_MIN_SIDE };'
].join('\n\n'))();

const downRight = geometry.selectionFromPoints(10, 20, 110, 70);
check(
  downRight.x === 10 && downRight.y === 20 &&
  downRight.width === 100 && downRight.height === 50,
  'un glissement vers le bas-droite donne le bon rectangle',
  JSON.stringify(downRight));

const upLeft = geometry.selectionFromPoints(110, 70, 10, 20);
check(
  JSON.stringify(upLeft) === JSON.stringify(downRight),
  'un glissement en sens inverse donne le MÊME rectangle',
  JSON.stringify(upLeft));

check(geometry.isUsableOcrRect({ x: 0, y: 0, width: 200, height: 60 }) === true,
  'une zone de 200 × 60 px est acceptée');

check(geometry.isUsableOcrRect({ x: 0, y: 0, width: 5, height: 60 }) === false,
  'une zone trop étroite est refusée');

check(geometry.isUsableOcrRect({ x: 0, y: 0, width: 200, height: 4 }) === false,
  'une zone trop plate est refusée');

check(geometry.isUsableOcrRect(null) === false,
  'une zone absente est refusée');

check(geometry.isUsableOcrRect({ x: 0, y: 0, width: NaN, height: 60 }) === false,
  'des coordonnées invalides sont refusées');

// ===========================================================================
//  2. Les fichiers du moteur
// ===========================================================================

console.log('');
console.log('2. Le moteur OCR est embarqué (aucun envoi réseau)');

const engineFiles = [
  ['src/vendor/tesseract/tesseract.min.js', 40000],
  ['src/vendor/tesseract/worker.min.js', 80000],
  ['src/vendor/tesseract/tesseract-core-simd.wasm.js', 1000000]
];

for (const [relative, minimum] of engineFiles) {
  const path = join(ROOT, relative);
  const size = existsSync(path) ? statSync(path).size : 0;
  check(
    size >= minimum,
    `${relative.split('/').pop()} est présent (${Math.round(size / 1024)} Ko)`,
    size === 0 ? 'absent' : 'trop petit');
}

for (const language of ['fra', 'eng']) {
  const path = join(ROOT, 'src', 'vendor', 'tessdata', `${language}.traineddata.gz`);

  if (!existsSync(path)) {
    check(false, `le modèle « ${language} » est présent`, 'absent');
    continue;
  }

  let size = 0;
  try {
    size = gunzipSync(readFileSync(path)).length;
  } catch (error) {
    check(false, `le modèle « ${language} » est intact`, error.message);
    continue;
  }

  check(
    size > 500000,
    `le modèle « ${language} » se décompresse (${Math.round(size / 1024)} Ko)`,
    `taille : ${size}`);
}

check(!existsSync(join(ROOT, 'src', 'ocr.html')),
  'l\'ancienne page OCR plein écran a été retirée');
check(!existsSync(join(ROOT, 'src', 'ocr.js')),
  'l\'ancien script de page OCR a été retiré');

// ===========================================================================
//  3. Chemins réellement résolus
// ===========================================================================

console.log('');
console.log('3. Chemins réellement résolus (le bug de la 0.16.0)');

const getUrlPaths = Array.from(
  new Set(((backgroundSource + engineSource).match(/getURL\('([^']+)'\)/g) || [])
    .map((match) => match.slice("getURL('".length, -2)))
);

check(getUrlPaths.length >= 4, 'le moteur est référencé par plusieurs chemins',
  `${getUrlPaths.length} chemin(s)`);

let resolvedOk = 0;
for (const relative of getUrlPaths) {
  const resolved = join(ROOT, relative);
  if (existsSync(resolved)) {
    resolvedOk += 1;
    console.log(`     OK  getURL('${relative}')`);
  } else {
    console.log(`     ABSENT  getURL('${relative}') -> ${resolved}`);
  }
}

check(
  resolvedOk === getUrlPaths.length,
  'chaque chemin de chrome.runtime.getURL() existe depuis la racine de l\'extension',
  `${resolvedOk}/${getUrlPaths.length}`);

const languagesFound = ((engineSource.match(/createWorker\(\[([^\]]+)\]/) || [])[1] || '')
  .match(/'([a-z]{3})'/g) || [];

const languageCodes = languagesFound.map((code) => code.slice(1, -1));
const missingModels = languageCodes.filter(
  (code) => !existsSync(join(ROOT, 'src', 'vendor', 'tessdata', `${code}.traineddata.gz`)));

check(
  languageCodes.length >= 2 && missingModels.length === 0,
  'un modèle de langue existe pour chaque langue demandée',
  `langues : ${languageCodes.join(', ')} | manquants : ${missingModels.join(', ')}`);

// ===========================================================================
//  4. Architecture : qui fait quoi
// ===========================================================================

console.log('');
console.log('4. Architecture : la page dessine, l\'arrière-plan lit');

check(/unicorn-ocr-overlay/.test(contentSource) && /unicorn-ocr-frame/.test(contentSource),
  'la page contient le voile et le cadre de sélection');

check(/function startOcrSelection/.test(contentSource),
  'la page sait démarrer une sélection');

check(/type: 'ocr-capture'/.test(contentSource) &&
  /type: 'ocr-recognize'/.test(contentSource),
  'la page photographie D\'ABORD, puis demande la lecture');

check(/case 'ocr-capture'/.test(backgroundSource) &&
  /case 'ocr-recognize'/.test(backgroundSource),
  'l\'arrière-plan traite la capture et la lecture séparément');

check(/function waitForCleanRepaint/.test(contentSource),
  'la capture attend le repeint (aucun voile ni bulle dans la photo)');

check(/function showOcrText/.test(contentSource),
  'la page affiche le TEXTE reconnu dans la bulle');

check(/function textInsideOcrRect/.test(contentSource) &&
  /textInsideOcrRect\(rect\)/.test(contentSource),
  'un texte HTML sous la zone sert de secours si l\'OCR ne lit rien');

check(/parent\.closest\('\.unicorn-tooltip'\)/.test(contentSource),
  'le secours HTML ignore la bulle de l\'extension (pas de « Lecture… » dans le rapport)');

check(existsSync(REPORT_HTML) && existsSync(REPORT_JS) &&
  /report\.js/.test(readFileSync(REPORT_HTML, 'utf8')),
  'la page de rapport de bug existe et charge son script');

check(/start-bug-report/.test(contentSource) &&
  /type: 'bug-report'/.test(contentSource) &&
  /case 'bug-report'/.test(backgroundSource),
  'la sélection de bug envoie la zone à la page de rapport');

check(/captureVisibleTab/.test(backgroundSource),
  'l\'arrière-plan photographie l\'onglet');

check(/workerBlobURL: false/.test(engineSource),
  'le worker OCR est créé de même origine (workerBlobURL: false)');

check(existsSync(ENGINE_HTML) && /engine\.js/.test(engineHtml),
  'la page du moteur existe et charge son script');

check(/engine-ocr/.test(engineSource) && /engine-ping/.test(engineSource),
  'la page du moteur répond aux messages « engine-ping » et « engine-ocr »');

check(/ensureEngineTab/.test(backgroundSource) && /askEngine/.test(backgroundSource),
  'l\'arrière-plan délègue la lecture à l\'onglet moteur');

check(/create\(\{ url: engineUrl\(\), active: false \}/.test(backgroundSource),
  'l\'onglet moteur est créé sans voler le focus (active: false)');

// L'echelle de decoupe doit se deduire de la capture REELLE, pas du seul
// devicePixelRatio : c'est ce qui rend la decoupe fiable (zoom, Retina).
check(/naturalWidth \/ viewport\.width/.test(backgroundSource),
  'l\'échelle de découpe est calculée depuis la capture réelle (pas du dpr supposé)');

// Le moteur doit decoder l'image en canvas avant lecture (chemin fiable).
check(/function imageToCanvas/.test(engineSource) && /\^data:/.test(engineSource),
  'le moteur décode l\'image en canvas avant de la lire');

check(/const OCR_UPSCALE = 3/.test(backgroundSource),
  'les petites zones sont agrandies 3× avant lecture');

check(/function otsuCanvas/.test(engineSource) &&
  /tessedit_pageseg_mode/.test(engineSource) &&
  /name: 'binary'/.test(engineSource) &&
  /name: 'inverted'/.test(engineSource),
  'le moteur essaie plusieurs seuillages et modes de page');

// La page du moteur doit montrer la derniere zone recue (diagnostic visuel).
check(/id="last-zone"/.test(engineHtml) && /last-zone/.test(engineSource),
  'le moteur affiche la dernière zone reçue (diagnostic visuel)');

check(/function describeFailure/.test(backgroundSource),
  'les erreurs du moteur sont décrites par describeFailure');

check(/start-ocr-selection/.test(popupSource),
  'le popup demande le démarrage de la sélection dans la page');

check(/id="ocr-button"/.test(popupHtml),
  'le popup propose le bouton de sélection');

check(!/captureVisibleTab/.test(popupSource) && !/ocrShot/.test(popupSource),
  'le popup ne capture plus l\'onglet (ancien fonctionnement retiré)');

// --- Messages d'erreur : jamais « erreur inconnue » ----------------------
const describeFailure = new Function(
  `${extractBlock(engineSource, 'describeError')}\nreturn describeError;`
)();

const errorCases = [
  [new Error('fichier introuvable'), /fichier introuvable/],
  ['chaîne brute', /chaîne brute/],
  [{ type: 'error' }, /événement « error »/],
  [{ error: new Error('erreur interne du worker') }, /erreur interne du worker/],
  [null, /sans explication/],
  [undefined, /sans explication/]
];

let describeFailed = 0;
for (const [value, expected] of errorCases) {
  const message = describeFailure(value);
  if (!message || !expected.test(message)) {
    describeFailed += 1;
    console.log(`        ${JSON.stringify(value)} -> ${JSON.stringify(message)}`);
  }
}

check(describeFailed === 0,
  'chaque forme d\'erreur produit un message exploitable',
  `${describeFailed} cas en échec`);

// ===========================================================================
//  5. Manifeste et confidentialité
// ===========================================================================

console.log('');
console.log('5. Manifeste et confidentialité');

const csp = manifest.content_security_policy && manifest.content_security_policy.extension_pages;

check(Boolean(csp) && /wasm-unsafe-eval/.test(csp),
  'la politique de sécurité autorise WebAssembly (wasm-unsafe-eval)',
  String(csp));

check(Boolean(csp) && /script-src 'self'/.test(csp),
  'les scripts restent limités à l\'extension',
  String(csp));

check(Array.isArray(manifest.permissions) && manifest.permissions.indexOf('activeTab') !== -1,
  'la permission « activeTab » est demandée (capture de l\'onglet)',
  JSON.stringify(manifest.permissions));

check(Array.isArray(manifest.permissions) && manifest.permissions.indexOf('<all_urls>') === -1,
  'aucun accès permanent à tous les sites',
  JSON.stringify(manifest.permissions));

// La page ne doit contenir aucun appel au moteur : c'est la clef de
// l'architecture (WebAssembly interdit dans une page web).
check(!/createWorker/.test(contentSource) && !/Tesseract/.test(contentSource),
  'le script de page ne charge pas le moteur OCR lui-même');

check(/<script src="vendor\/tesseract\/tesseract\.min\.js"><\/script>/.test(engineHtml),
  'la page du moteur charge bien la bibliothèque Tesseract.js');

// Version coherente.
const versionMatch = backgroundSource.match(/const UNICONV_VERSION = '([^']+)'/);
check(
  Boolean(versionMatch) && versionMatch[1] === manifest.version,
  'la version de l\'arrière-plan correspond au manifeste',
  `background.js : ${versionMatch ? versionMatch[1] : '?'} / manifeste : ${manifest.version}`);

// ===========================================================================
//  Bilan
// ===========================================================================

console.log('');
console.log('============================================================');
console.log(`  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('============================================================');

process.exit(failed === 0 ? 0 : 1);
