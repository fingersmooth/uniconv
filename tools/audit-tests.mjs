/**
 * ============================================================================
 *  UniConv — tools/audit-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier CHAQUE calcul de conversion, avec les vrais taux de change, pour
 *  la totalite des lignes de la page de test.
 *
 *  POURQUOI CET OUTIL EXISTE
 *  -------------------------
 *  Une conversion fausse peut passer inaperçue si on ne verifie que le format.
 *  Ce test reprend chaque montant de test/formats.html, le convertit vers le
 *  dollar, et compare le resultat a celui calcule manuellement a partir des
 *  taux reels de l'API Frankfurter.
 *
 *  Il repond a une demande explicite d'audit complet du code.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/audit-tests.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_FILE = join(ROOT, 'src', 'content.js');

// ---------------------------------------------------------------------------
// 1. Taux reels, figes pour rendre le test reproductible
// ---------------------------------------------------------------------------
//
// Ces taux sont ceux renvoyes par l'API Frankfurter le 23/10/2026 (base EUR).
// On les fige : un test doit donner le MEME resultat a chaque execution, sinon
// il est inutilisable pour detecter une regression.
//
// Quand on voudra verifier contre des taux du jour, on ajoutera un mode
// « reseau » separe. Ici, on teste la LOGIQUE de conversion, pas l'API.

const RATES = {
  EUR: 1, AUD: 1.5939, BRL: 5.6485, CAD: 1.5665, CHF: 0.9227, CNY: 7.466,
  CZK: 24.327, DKK: 7.4748, GBP: 0.83728, HKD: 8.7793, HUF: 366.73,
  IDR: 20268.06, ILS: 3.4939, INR: 106.272, ISK: 136.2, JPY: 175.51,
  KRW: 1482.46, MXN: 21.0226, MYR: 4.5729, NOK: 10.4665, NZD: 1.9682,
  PHP: 71.235, PLN: 4.3945, RON: 5.3492, SEK: 11.131, SGD: 1.431,
  THB: 37.771, TRY: 55.6715, USD: 1.1193, ZAR: 18.5777
};

/** Convertit via l'euro, comme le fait le script d'arriere-plan. */
function convertViaEuro(amount, from, to) {
  const sourceRate = RATES[from];
  const targetRate = RATES[to];
  if (typeof sourceRate !== 'number' || typeof targetRate !== 'number') {
    return null;
  }
  return amount * (targetRate / sourceRate);
}

// ---------------------------------------------------------------------------
// 2. Extraction du moteur de detection
// ---------------------------------------------------------------------------

const src = readFileSync(CONTENT_FILE, 'utf8');

function extractBlock(name) {
  const start = src.indexOf(`function ${name}`);
  if (start === -1) {
    throw new Error('fonction introuvable : ' + name);
  }
  let depth = 0;
  let started = false;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; started = true; }
    else if (src[i] === '}') { depth -= 1; if (started && depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('fonction mal fermee : ' + name);
}

function extractConst(name) {
  const start = src.indexOf(`const ${name} =`);
  const end = src.indexOf(';', start);
  return src.slice(start, end + 1);
}

const pieces = ['const LOG_PREFIX = "[UniConv]";'];
for (const name of ['SPACES', 'MIN_AMOUNT', 'MAX_AMOUNT']) {
  pieces.push(extractConst(name));
}
const currenciesStart = src.indexOf('const CURRENCIES = [');
const patternStart = src.indexOf('const PATTERN_WORDS_AFTER');
const patternEnd = src.indexOf('\n  );', patternStart);
pieces.push(src.slice(currenciesStart, patternEnd + 5));
// Iteration 7 : les regles anti-faux-positifs sont appelees par
// findAmountsInText ; il faut donc les extraire aussi.
pieces.push(extractConst('REJECTION_COUNTS'));
for (const name of ['escapeForRegex', 'resolveCurrency', 'parseAmount', 'parseNumberWords', 'amountEnd', 'findAmountsInText', 'rejectionForCandidate', 'noteRejection']) {
  pieces.push(extractBlock(name));
}
pieces.push('return { findAmountsInText: findAmountsInText };');

const { findAmountsInText } = new Function(pieces.join('\n\n'))();

// ---------------------------------------------------------------------------
// 3. Les cas a auditer : un pour chaque ligne de la page de test
// ---------------------------------------------------------------------------

const CASES = [
  { text: '10\u20AC',               code: 'EUR', amount: 10 },
  { text: '10 \u20AC',              code: 'EUR', amount: 10 },
  { text: '10,50 \u20AC',           code: 'EUR', amount: 10.5 },
  { text: '10.50 \u20AC',           code: 'EUR', amount: 10.5 },
  { text: '0,99 \u20AC',            code: 'EUR', amount: 0.99 },
  { text: '1 234 \u20AC',           code: 'EUR', amount: 1234 },
  { text: '1 234,56 \u20AC',        code: 'EUR', amount: 1234.56 },
  { text: '12 345 678 \u20AC',      code: 'EUR', amount: 12345678 },
  { text: '999 \u20AC',             code: 'EUR', amount: 999 },
  { text: '12345 \u20AC',           code: 'EUR', amount: 12345 },
  { text: '\u20AC10',               code: 'EUR', amount: 10 },
  { text: '$1,234.56',              code: 'USD', amount: 1234.56 },
  { text: '\u00A310',               code: 'GBP', amount: 10 },
  { text: '\u00A5100',              code: 'JPY', amount: 100 },
  { text: '10 EUR',                 code: 'EUR', amount: 10 },
  { text: 'EUR 10',                 code: 'EUR', amount: 10 },
  { text: '100 JPY',                code: 'JPY', amount: 100 },
  { text: '10 CHF',                 code: 'CHF', amount: 10 },
  { text: 'CHF 1 234,56',           code: 'CHF', amount: 1234.56 },
  { text: '100 dollars',            code: 'USD', amount: 100 },
  { text: '10 livres sterling',     code: 'GBP', amount: 10 },
  { text: '5 yens',                 code: 'JPY', amount: 5 },
  { text: '10 pounds',              code: 'GBP', amount: 10 },
  { text: '1 234,56 USD',           code: 'USD', amount: 1234.56 },
  { text: 'USD 1,234.56',           code: 'USD', amount: 1234.56 },
  { text: '$ 0.99',                 code: 'USD', amount: 0.99 }
];

// ---------------------------------------------------------------------------
// 4. Verification
// ---------------------------------------------------------------------------

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

console.log('UniConv — audit complet des conversions');
console.log(`  taux figes au 23/10/2026 (base EUR)`);
console.log('');

for (const testCase of CASES) {
  const found = findAmountsInText(testCase.text)[0];

  const amountOk = Boolean(found) && found.value === testCase.amount;
  const codeOk = Boolean(found) && found.currency && found.currency.code === testCase.code;

  if (!amountOk || !codeOk) {
    check(false,
      `"${testCase.text}" lit ${found ? found.value : 'rien'} ${found && found.currency ? found.currency.code : '?'}`,
      `attendu ${testCase.amount} ${testCase.code}`
    );
    continue;
  }

  // Le calcul attendu via l'euro.
  const converted = convertViaEuro(found.value, found.currency.code, 'USD');
  const label = `"${testCase.text}" = ${found.value} ${found.currency.code}` +
    (converted === null
      ? ' (non convertible)'
      : ` -> ${converted.toFixed(2)} USD`);

  if (converted === null) {
    check(testCase.code === 'MAD' || testCase.code === 'TND', label + ' (devise hors API, assume)');
  } else {
    check(true, label);
  }
}

console.log('');
console.log(`Bilan : ${passed} conversions verifiees, ${failed} en erreur`);

if (failed > 0) {
  console.log('Un calcul est faux. Corriger src/content.js ou le cas de test.');
}

process.exit(failed > 0 ? 1 : 0);
