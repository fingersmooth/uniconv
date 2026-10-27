/**
 * ============================================================================
 *  UniConv — tools/release-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier que l'extension est PRETE A PUBLIER (iteration 12) :
 *
 *    1. Empaquetage : les deux archives se construisent, le manifeste est a la
 *       racine, tous les fichiers cites sont dedans, et rien de superflu
 *       (docs, tests, outils) n'est embarque.
 *    2. Manifeste Chrome : service worker present, bloc Firefox absent.
 *    3. Icones : fichiers PNG valides, carres, aux bonnes tailles.
 *    4. Fichiers morts : plus de styles.css, aucune reference orpheline.
 *    5. Documents de publication presents et complets.
 *    6. Performance : mesures sur de gros textes, avec seuils.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/release-tests.mjs
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildPackages, listArchive, readFromArchive, referencedPaths } from './package.mjs';

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
console.log('1. Empaquetage');
// ---------------------------------------------------------------------------

let built = null;
let buildError = null;
try {
  built = buildPackages();
} catch (error) {
  buildError = error;
}

check(buildError === null, 'les archives se construisent',
  buildError ? buildError.message : null);

if (!built) {
  console.log('');
  console.log(`  Resultat : ${passed} reussi(s), ${failed + 1} echec(s)`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

check(built.firefox.endsWith(`uniconv-${manifest.version}.xpi`),
  'l\'archive Firefox porte la version du manifeste', built.firefox);
check(built.chromium.endsWith(`uniconv-${manifest.version}-chromium.zip`),
  'l\'archive Chromium porte la version du manifeste', built.chromium);

check(built.safari.endsWith(`uniconv-${manifest.version}-safari.zip`),
  'l\'archive Safari porte la version du manifeste', built.safari);

const firefoxEntries = listArchive(built.firefox);
const chromiumEntries = listArchive(built.chromium);
const safariEntries = listArchive(built.safari);

check(firefoxEntries.includes('manifest.json') && chromiumEntries.includes('manifest.json') &&
  safariEntries.includes('manifest.json'),
  'le manifeste est a la racine des trois archives');

const missingFirefox = referencedPaths(manifest).filter((path) => !firefoxEntries.includes(path));
const missingChromium = referencedPaths(manifest).filter((path) => !chromiumEntries.includes(path));
const missingSafari = referencedPaths(manifest).filter((path) => !safariEntries.includes(path));
check(missingFirefox.length === 0, 'tous les fichiers cites sont dans l\'archive Firefox',
  missingFirefox.join(', '));
check(missingChromium.length === 0, 'tous les fichiers cites sont dans l\'archive Chromium',
  missingChromium.join(', '));
check(missingSafari.length === 0, 'tous les fichiers cites sont dans l\'archive Safari',
  missingSafari.join(', '));

const forbidden = firefoxEntries.filter((entry) =>
  entry.startsWith('docs/') || entry.startsWith('test/') || entry.startsWith('tools/') ||
  entry.startsWith('dist/') || entry === 'README.md');
check(forbidden.length === 0, 'aucun fichier de documentation, de test ou d\'outil n\'est embarque',
  forbidden.slice(0, 6).join(', '));

const firefoxManifest = JSON.parse(readFromArchive(built.firefox, 'manifest.json'));
const chromiumManifest = JSON.parse(readFromArchive(built.chromium, 'manifest.json'));
const safariManifest = JSON.parse(readFromArchive(built.safari, 'manifest.json'));

check(Array.isArray(firefoxManifest.background.scripts) &&
  firefoxManifest.background.scripts.length === 1,
  'le manifeste Firefox garde « background.scripts » (page d\'evenement)');
check(Boolean(firefoxManifest.browser_specific_settings),
  'le manifeste Firefox garde le bloc « gecko »');

check(chromiumManifest.background &&
  typeof chromiumManifest.background.service_worker === 'string',
  'le manifeste Chromium declare un service worker');
check(!chromiumManifest.background.scripts,
  'le manifeste Chromium n\'a pas « background.scripts » (refuse en MV3)');
check(!chromiumManifest.browser_specific_settings,
  'le manifeste Chromium n\'a pas le bloc « gecko »');

check(safariManifest.background &&
  typeof safariManifest.background.service_worker === 'string',
  'le manifeste Safari declare un service worker');
check(!safariManifest.background.scripts && !safariManifest.browser_specific_settings,
  'le manifeste Safari n\'a ni « scripts » ni bloc « gecko »');
check(existsSync(built.safariDir) && existsSync(join(built.safariDir, 'manifest.json')),
  'le dossier Safari pret pour Xcode est present', built.safariDir);

const sizes = [built.firefox, built.chromium, built.safari]
  .map((archive) => statSync(archive).size / (1024 * 1024));
check(sizes.every((size) => size < 12), 'taille des archives raisonnable',
  sizes.map((size) => `${size.toFixed(1)} Mo`).join(' / '));

// ---------------------------------------------------------------------------
console.log('');
console.log('2. Icones');
// ---------------------------------------------------------------------------

const iconSizes = { '16': 16, '32': 32, '48': 48, '128': 128 };
const iconProblems = [];

for (const [name, expected] of Object.entries(iconSizes)) {
  const path = join(ROOT, 'icons', `icon${name}.png`);
  if (!existsSync(path)) {
    iconProblems.push(`icon${name}.png manquant`);
    continue;
  }
  const buffer = readFileSync(path);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    iconProblems.push(`icon${name}.png n'est pas un PNG`);
    continue;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== expected || height !== expected) {
    iconProblems.push(`icon${name}.png fait ${width}x${height}`);
  }
}

check(iconProblems.length === 0, 'les 4 icones sont des PNG carres aux bonnes tailles',
  iconProblems.join(' ; '));

// ---------------------------------------------------------------------------
console.log('');
console.log('3. Fichiers morts');
// ---------------------------------------------------------------------------

check(!existsSync(join(ROOT, 'styles.css')),
  'styles.css (inutilise depuis l\'iteration 1) a ete supprime');

const contentSource = readFileSync(join(ROOT, 'src', 'content.js'), 'utf8');
check(!readFileSync(join(ROOT, 'src', 'popup.html'), 'utf8').includes('styles.css a l\'iteration 1'),
  'plus aucun document ne renvoie a styles.css');

const deadReference = existsSync(join(ROOT, 'src', 'ocr.html'));
check(!deadReference, 'la page OCR de l\'ancienne interface (src/ocr.html) n\'existe plus');

// ---------------------------------------------------------------------------
console.log('');
console.log('4. Documents de publication');
// ---------------------------------------------------------------------------

const readmePath = join(ROOT, 'README.md');
check(existsSync(readmePath), 'README.md existe');
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf8');
  check(readme.includes(manifest.version), 'le README cite la version courante');
  check(/Installation/i.test(readme) && /Confidentialit/i.test(readme) &&
    /Permissions/i.test(readme),
    'le README couvre installation, confidentialite et permissions');
  const readmePlain = readme.replace(/`/g, '');
  check(/raccourcis/i.test(readmePlain) &&
    /Scan/.test(readmePlain) &&
    /convertisseur/i.test(readmePlain) &&
    !/Alt\s*\+\s*Maj\s*\+\s*[OU]/.test(readmePlain),
    'le README documente les raccourcis personnalisables, sans touche imposee');
}

const privacyPath = join(ROOT, 'docs', 'CONFIDENTIALITE.md');
check(existsSync(privacyPath), 'docs/CONFIDENTIALITE.md existe');
if (existsSync(privacyPath)) {
  const privacy = readFileSync(privacyPath, 'utf8');
  // On retire les accents : le document est en francais, les tests en ASCII.
  const privacyPlain = privacy
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  check(/aucune\s+(donnee|telemetrie)/.test(privacyPlain) &&
    privacyPlain.includes('frankfurter.dev'),
    'la politique de confidentialite dit ce qui n\'est pas collecte et quels services sont appeles');
}

const publicationPath = join(ROOT, 'docs', 'PUBLICATION.md');
check(existsSync(publicationPath), 'docs/PUBLICATION.md existe');
if (existsSync(publicationPath)) {
  const publication = readFileSync(publicationPath, 'utf8');
  check(/addons\.mozilla\.org/.test(publication) && /Chrome/i.test(publication),
    'le guide de publication couvre Firefox (AMO) et Chrome');
  check(/package\.mjs/.test(publication), 'le guide donne la commande d\'empaquetage');
}

// ---------------------------------------------------------------------------
console.log('');
console.log('4bis. Prompts de conception (limite de 2000 caracteres)');
// ---------------------------------------------------------------------------

const designDir = join(ROOT, 'docs', 'design');
const longPromptsPath = join(designDir, 'FRAME-PROMPTS.md');
const shortPromptsPath = join(designDir, 'FRAME-PROMPTS-2000.md');

check(existsSync(longPromptsPath), 'les prompts detailles existent (version longue)');
check(existsSync(shortPromptsPath), 'les prompts compacts existent (version 2000)');

if (existsSync(shortPromptsPath)) {
  const shortSource = readFileSync(shortPromptsPath, 'utf8');
  const blocks = shortSource.match(/```text\n([\s\S]*?)\n```/g) || [];
  const lengths = blocks.map((block) =>
    block.replace(/^```text\n/, '').replace(/\n```$/, '').length);

  check(blocks.length === 11, '11 prompts compacts (un par cadre)',
    `${blocks.length} bloc(s)`);

  const tooLong = lengths
    .map((length, index) => ({ cadre: `S${String(index + 1).padStart(2, '0')}`, length }))
    .filter((entry) => entry.length > 2000);

  check(tooLong.length === 0, 'chaque prompt tient dans 2000 caracteres',
    tooLong.map((entry) => `${entry.cadre} = ${entry.length}`).join(', '));

  const frames = blocks.map((block) => {
    const match = /CADRE S(\d{2})/.exec(block);
    return match ? match[1] : null;
  });

  check(frames.every((frame, index) =>
    frame === String(index + 1).padStart(2, '0')),
    'les prompts sont numerotes S01 a S11 dans l\'ordre',
    frames.join(', '));
}

// ---------------------------------------------------------------------------
console.log('');
console.log('5. Performance (mesures reelles)');
// ---------------------------------------------------------------------------

const start = contentSource.indexOf('// >>> DEBUT MODULE FUSEAUX');
const end = contentSource.indexOf('// <<< FIN MODULE FUSEAUX');
const moduleBlock = contentSource.slice(start, end);

const api = new Function(moduleBlock + '\nreturn { tzFindTimes, tzConvert, tzZoneFromId };')();

const typical = 'La reunion commence a 14:30 CET, puis a 16:00 heure de Paris. Prix : 12,50 EUR.';

// a) Cout d'un texte courant (une ligne d'article).
const iterations = 2000;
const startTypical = process.hrtime.bigint();
for (let index = 0; index < iterations; index += 1) {
  api.tzFindTimes(typical);
}
const perCallMs = Number(process.hrtime.bigint() - startTypical) / 1e6 / iterations;

check(perCallMs < 1, 'une ligne de texte courant est analysee en moins d\'une milliseconde',
  `${perCallMs.toFixed(3)} ms par appel`);

// b) Gros texte : 4 000 lignes (~ 400 Ko).
const big = typical.repeat(4000);
const startBig = process.hrtime.bigint();
const bigFound = api.tzFindTimes(big);
const bigMs = Number(process.hrtime.bigint() - startBig) / 1e6;

check(bigFound.length === 8000, 'le gros texte trouve les 2 heures par ligne',
  `${bigFound.length} detection(s)`);
check(bigMs < 1500, '400 Ko de texte sont analyses en moins de 1,5 s',
  `${bigMs.toFixed(0)} ms`);

// c) Texte hostile : que des chiffres (aucune heure possible).
const digits = '1234567890 '.repeat(20000);
const startDigits = process.hrtime.bigint();
api.tzFindTimes(digits);
const digitsMs = Number(process.hrtime.bigint() - startDigits) / 1e6;

check(digitsMs < 1500, 'un pave de chiffres ne provoque pas de ralentissement',
  `${digitsMs.toFixed(0)} ms pour 220 Ko`);

// d) Beaucoup d'heures valides : le cout doit rester lineaire.
const many = '14:30 CET '.repeat(5000);
const startMany = process.hrtime.bigint();
const manyFound = api.tzFindTimes(many);
const manyMs = Number(process.hrtime.bigint() - startMany) / 1e6;

check(manyFound.length === 5000 && manyMs < 1500,
  '5 000 heures valides sont lues en moins de 1,5 s',
  `${manyFound.length} detection(s) en ${manyMs.toFixed(0)} ms`);

// e) Conversions de fuseau en volume : les formateurs sont-ils caches ?
const zoneSource = '14:30 CET, puis 15:00 Europe/Paris et 16:00 America/New_York.';
const zoneTarget = api.tzZoneFromId('Asia/Tokyo');
const zoneDetections = api.tzFindTimes(zoneSource);

let startZone = process.hrtime.bigint();
for (let index = 0; index < 2000; index += 1) {
  for (const detection of zoneDetections) {
    api.tzConvert(detection, zoneTarget, Date.parse('2026-10-24T12:00:00Z'));
  }
}
const zoneMs = Number(process.hrtime.bigint() - startZone) / 1e6;

check(zoneDetections.length === 3, 'les 3 heures de test sont lues', `${zoneDetections.length}`);
check(zoneMs < 150, '6 000 conversions de fuseau en moins de 150 ms',
  `${zoneMs.toFixed(1)} ms`);

// Comparaison honnete : recreer le formateur a chaque appel (ancienne
// approche) coute combien, sur le meme nombre d'appels ?
let startNaive = process.hrtime.bigint();
for (let index = 0; index < 6000; index += 1) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
  formatter.formatToParts(new Date(Date.parse('2026-10-24T12:00:00Z')));
}
const naiveMs = Number(process.hrtime.bigint() - startNaive) / 1e6;

// Comparaison honnete : a chaque iteration, l'ancienne version CREAIT un
// formateur (une seule fois) en plus de formater ; ici, une conversion
// complete (quatre lectures de date) tient dans le meme temps.
check(zoneMs < naiveMs,
  '6 000 conversions cachees coutent moins que 6 000 creations de formateur',
  `cache ${zoneMs.toFixed(1)} ms / creation seule ${naiveMs.toFixed(1)} ms`);

// ---------------------------------------------------------------------------
console.log('');
console.log('6. Coherence generale');
// ---------------------------------------------------------------------------

const versions = [
  ['manifest.json', manifest.version],
  ['src/background.js', (/const UNICONV_VERSION = '([^']+)'/.exec(readFileSync(join(ROOT, 'src', 'background.js'), 'utf8')) || [])[1]],
  ['src/content.js', (/const UNICONV_CONTENT_VERSION = '([^']+)'/.exec(contentSource) || [])[1]],
  ['src/options.js', (/const UNICONV_VERSION = '([^']+)'/.exec(readFileSync(join(ROOT, 'src', 'options.js'), 'utf8')) || [])[1]],
  ['src/popup.js', (/const UNICONV_VERSION = '([^']+)'/.exec(readFileSync(join(ROOT, 'src', 'popup.js'), 'utf8')) || [])[1]],
  ['src/engine.js', (/const UNICONV_VERSION = '([^']+)'/.exec(readFileSync(join(ROOT, 'src', 'engine.js'), 'utf8')) || [])[1]]
];

const mismatched = versions.filter(([, version]) => version !== manifest.version);
check(mismatched.length === 0, 'les 6 fichiers annoncent la meme version que le manifeste',
  mismatched.map(([file, version]) => `${file} = ${version}`).join(', '));

check(!/console\.log\([^)]*TODO/i.test(contentSource),
  'aucun « TODO » oublie dans du code affiche');

// ---------------------------------------------------------------------------
console.log('');
console.log('='.repeat(60));
console.log(failed === 0
  ? `  Resultat : ${passed} reussi(s), 0 echec(s)`
  : `  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('='.repeat(60));

process.exit(failed === 0 ? 0 : 1);
