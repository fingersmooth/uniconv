/**
 * ============================================================================
 *  UniConv — tools/currency-search-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier que la barre de recherche du menu deroulant trouve une devise
 *  par son CODE, son NOM, son SYMBOLE ou son PAYS.
 *
 *  POURQUOI CE TEST EXISTE
 *  -----------------------
 *  « Yuan chinois » ne contient pas la chaine « chine ». Sans les noms de
 *  pays, taper « chine » ne trouvait donc rien. Ce test verrouille le
 *  comportement : chaque pays connu doit ramener sa devise.
 *
 *  Le test est volontairement tolerant aux accents : « emirats » doit trouver
 *  les « Émirats », et inversement.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/currency-search-tests.mjs
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

const pieces = [];
pieces.push(extractObj('CURRENCY_META'));
pieces.push(extractObj('COUNTRY_NAMES'));
pieces.push(extractObj('CURRENCY_EXTRA_COUNTRIES'));

const currenciesStart = src.indexOf('const CURRENCIES = [');
const currenciesEnd = src.indexOf('\n  ];', currenciesStart) + 4;
pieces.push(src.slice(currenciesStart, currenciesEnd));
pieces.push('const CURRENCY_BY_CODE = new Map(); for (const c of CURRENCIES) CURRENCY_BY_CODE.set(c.code, c);');

for (const name of [
  'flagEmoji', 'currencyFullName', 'currencyFlag', 'currencySymbolFor',
  'normalizeSearchText', 'currencyCountryNames', 'currencySearchTerms'
]) {
  pieces.push(extractBlock(name));
}

pieces.push('return { normalizeSearchText, currencySearchTerms, CURRENCY_META, currencyFullName, currencyFlag };');

const api = new Function(pieces.join('\n\n'))();

/** Retourne les codes qui correspondent a une recherche. */
function search(query) {
  const needle = api.normalizeSearchText(query).trim();
  return Object.keys(api.CURRENCY_META).filter((code) =>
    api.normalizeSearchText(api.currencySearchTerms(code)).includes(needle)
  );
}

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

console.log('UniConv — recherche de devises par pays');
console.log(`  fichier : ${CONTENT_FILE}`);
console.log('');

// --- Recherche par pays -----------------------------------------------------
console.log('1. Recherche par nom de pays');
const countryCases = [
  ['chine', 'CNY'],
  ['japon', 'JPY'],
  ['emirats', 'AED'],
  ['taiwan', 'TWD'],
  ['koweit', 'KWD'],
  ['maroc', 'MAD'],
  ['tunisie', 'TND'],
  ['norvege', 'NOK'],
  ['suede', 'SEK'],
  ['pologne', 'PLN'],
  ['turquie', 'TRY'],
  ['coree du sud', 'KRW'],
  ['afrique du sud', 'ZAR'],
  ['arabie saoudite', 'SAR'],
  ['nouvelle-zelande', 'NZD'],
  ['royaume-uni', 'GBP'],
  ['etats-unis', 'USD']
];

for (const [query, expected] of countryCases) {
  const hits = search(query);
  check(
    hits.includes(expected),
    `"${query}" trouve ${expected}`,
    `obtenu : ${hits.join(', ') || 'rien'}`
  );
}

// --- Tolerance aux accents --------------------------------------------------
console.log('');
console.log('2. Tolerance aux accents');
check(
  search('emirats').includes('AED') && search('émirats').includes('AED'),
  '"emirats" et "émirats" trouvent tous deux AED'
);
check(
  search('coree').includes('KRW') && search('corée').includes('KRW'),
  '"coree" et "corée" trouvent tous deux KRW'
);

// --- Monnaies multi-pays ----------------------------------------------------
console.log('');
console.log('3. Monnaies partagees par plusieurs pays');
check(search('france').includes('EUR'), '"france" trouve EUR');
check(search('allemagne').includes('EUR'), '"allemagne" trouve EUR');
check(search('cote d ivoire').includes('XOF'), '"cote d ivoire" trouve XOF');
check(search('gabon').includes('XAF'), '"gabon" trouve XAF');
check(search('fmi').includes('XDR'), '"fmi" trouve XDR');
check(search('brunei').includes('BND'), '"brunei" trouve BND');
check(search('koweit').includes('KWD'), '"koweit" trouve KWD');

// --- Recherche par code et par nom de devise --------------------------------
console.log('');
console.log('4. Recherche par code et par nom de devise');
check(search('usd').includes('USD'), '"usd" trouve USD');
check(search('yen').includes('JPY'), '"yen" trouve JPY');
check(search('yuan').includes('CNY'), '"yuan" trouve CNY');
check(search('renminbi').includes('CNY'), '"renminbi" trouve CNY');
check(search('rmb').includes('CNY'), '"rmb" trouve CNY');
check(search('dollar').length >= 5, '"dollar" trouve plusieurs devises');

// --- Recherche vide ---------------------------------------------------------
console.log('');
console.log('5. Recherche vide');
const all = search('');
check(all.length === Object.keys(api.CURRENCY_META).length,
      'une recherche vide renvoie toutes les devises',
      `${all.length} sur ${Object.keys(api.CURRENCY_META).length}`);

console.log('');
console.log(`Bilan : ${passed} reussi(s), ${failed} echec(s)`);

if (failed > 0) {
  console.log('Completer COUNTRY_NAMES ou CURRENCY_EXTRA_COUNTRIES dans src/content.js.');
}

process.exit(failed > 0 ? 1 : 0);
