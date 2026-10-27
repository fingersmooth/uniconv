/**
 * ============================================================================
 *  UniConv — tools/currency-meta-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier que CHAQUE devise du menu deroulant possede :
 *    - un nom complet (et non simplement son code) ;
 *    - un drapeau emoji valide ;
 *    - une entree dans la table CURRENCY_META.
 *
 *  POURQUOI CE TEST EXISTE
 *  -----------------------
 *  L'utilisateur a signale que certaines devises n'avaient « ni nationalite ni
 *  drapeau ». C'etait du a des entrees manquantes dans CURRENCY_META. Ce test
 *  empeche la recidive : toute devise ajoutee a la liste doit avoir son nom et
 *  son drapeau.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/currency-meta-tests.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_FILE = join(ROOT, 'src', 'content.js');

const src = readFileSync(CONTENT_FILE, 'utf8');

function extractBlock(name) {
  const start = src.indexOf(`function ${name}`);
  if (start === -1) throw new Error('fonction introuvable : ' + name);
  let depth = 0, started = false;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; started = true; }
    else if (src[i] === '}') { depth -= 1; if (started && depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('fonction mal fermee : ' + name);
}

function extractObj(name) {
  const start = src.indexOf(`const ${name} = {`);
  if (start === -1) throw new Error('objet introuvable : ' + name);
  let depth = 0, started = false, end = start;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; started = true; }
    else if (src[i] === '}') {
      depth -= 1;
      if (started && depth === 0) { end = src.indexOf(';', i) + 1; break; }
    }
  }
  return src.slice(start, end);
}

const pieces = [extractObj('CURRENCY_META'), extractBlock('flagEmoji')];
pieces.push('return { CURRENCY_META, flagEmoji };');
const { CURRENCY_META, flagEmoji } = new Function(pieces.join('\n\n'))();

let passed = 0;
let failed = 0;

function check(ok, label, detail) {
  if (ok) {
    passed += 1;
    console.log(`  OK    ${label}`);
  } else {
    failed += 1;
    console.log(`  ECHEC ${label}`);
    if (detail) console.log(`        ${detail}`);
  }
}

console.log('UniConv — verification des noms et drapeaux de devises');
console.log(`  fichier : ${CONTENT_FILE}`);
console.log('');

const entries = Object.entries(CURRENCY_META);

const CURRENCIES_PAGE = join(ROOT, 'test', 'monnaies.html');

console.log('1. Couverture');
check(
  entries.length >= 160,
  `au moins 160 devises decrites (${entries.length})`,
  `trouvees : ${entries.length}`
);

// La page « toutes les monnaies » doit lister CHAQUE devise des metadonnees.
let pageHtml = '';
try {
  pageHtml = readFileSync(CURRENCIES_PAGE, 'utf8');
} catch (error) {
  pageHtml = '';
}

const pageCodes = new Set(
  Array.from(pageHtml.matchAll(/data-code="([A-Z]{3})"/g)).map((match) => match[1])
);
const missingFromPage = entries
  .map(([code]) => code)
  .filter((code) => !pageCodes.has(code));

check(
  pageCodes.size === entries.length && missingFromPage.length === 0,
  `la page monnaies liste les ${entries.length} devises`,
  missingFromPage.length
    ? `absentes de la page : ${missingFromPage.join(', ')}`
    : `trouvees : ${pageCodes.size}`
);

console.log('');
console.log('2. Chaque devise a un nom complet');

const withoutName = [];
for (const [code, meta] of entries) {
  if (!meta || typeof meta.name !== 'string' || meta.name.trim() === '') {
    withoutName.push(code);
  }
}
check(
  withoutName.length === 0,
  'toutes les devises ont un nom',
  withoutName.length ? `sans nom : ${withoutName.join(', ')}` : null
);

// Le nom ne doit pas etre simplement le code (sinon il n'apporte rien).
const nameEqualsCode = [];
for (const [code, meta] of entries) {
  if (meta && meta.name === code) {
    nameEqualsCode.push(code);
  }
}
check(
  nameEqualsCode.length === 0,
  'aucun nom n\'est simplement le code de la devise',
  nameEqualsCode.length ? `noms = code : ${nameEqualsCode.join(', ')}` : null
);

console.log('');
console.log('3. Chaque devise a un drapeau');

const withoutFlag = [];
for (const [code, meta] of entries) {
  const flag = flagEmoji(meta ? meta.country : null);
  if (!flag || flag.length < 2) {
    withoutFlag.push(code);
  }
}
check(
  withoutFlag.length === 0,
  'toutes les devises ont un drapeau (ou un globe pour les cas speciaux)',
  withoutFlag.length ? `sans drapeau : ${withoutFlag.join(', ')}` : null
);

// Un drapeau derive d'un code pays doit etre compose de 2 indicatifs
// regionaux (4 unites UTF-16).
const suspicious = [];
for (const [code, meta] of entries) {
  if (!meta || !meta.country) continue;
  const flag = flagEmoji(meta.country);
  if (flag.length !== 4) {
    suspicious.push(`${code} (${meta.country})`);
  }
}
check(
  suspicious.length === 0,
  'les drapeaux derives d\'un pays ont la bonne forme',
  suspicious.length ? `suspects : ${suspicious.join(', ')}` : null
);

console.log('');
console.log('4. Quelques devises de controle');
for (const code of ['USD', 'EUR', 'AED', 'MAD', 'TWD', 'XOF', 'XDR']) {
  const meta = CURRENCY_META[code];
  check(
    Boolean(meta) && Boolean(meta.name) && flagEmoji(meta.country).length >= 2,
    `${code} : ${meta ? flagEmoji(meta.country) + ' ' + meta.name : 'absente'}`
  );
}

console.log('');
console.log(`Bilan : ${passed} reussi(s), ${failed} echec(s)`);

if (failed > 0) {
  console.log('Completer CURRENCY_META dans src/content.js.');
}

process.exit(failed > 0 ? 1 : 0);
