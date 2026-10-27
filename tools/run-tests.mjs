/**
 * ============================================================================
 *  UniConv — tools/run-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier que le moteur de detection (src/detect.js) reconnait bien les
 *  formats attendus, et SEULEMENT ceux-la.
 *
 *  POURQUOI CET OUTIL EXISTE
 *  -------------------------
 *  Une expression reguliere est un motif de texte tres facile a casser : une
 *  parenthese deplacee et tout cesse de fonctionner, souvent sans message
 *  d'erreur. Plutot que d'ouvrir Firefox et de survoler 30 lignes a la main a
 *  chaque modification, on execute le moteur ici, en deux secondes.
 *
 *  Ce test ne remplace PAS le test visuel dans le navigateur : il verifie que
 *  les montants sont bien RECONNUS, pas que la bulle s'affiche. Les deux sont
 *  complementaires.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/run-tests.mjs
 *
 *  Sortie : un rapport ligne par ligne, et un code de sortie 0 si tout passe,
 *  1 sinon (utilisable dans un script automatise).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// 1. Localisation des fichiers
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const CONTENT_FILE = join(ROOT, 'src', 'content.js');
const TEST_FILE = join(ROOT, 'test', 'formats.html');

// ---------------------------------------------------------------------------
// 2. Chargement du moteur de detection, sans navigateur
// ---------------------------------------------------------------------------
//
// POURQUOI CETTE METHODE EST UN PEU PARTICULIERE
// ----------------------------------------------
// Depuis la correction de l'iteration 1, tout le code vit dans UN SEUL fichier
// (src/content.js) : c'est ce qui a rendu l'extension fonctionnelle dans
// Firefox. Ce fichier contient aussi du code qui a besoin d'un navigateur
// (document, window), code qu'on ne peut pas executer ici.
//
// On extrait donc du fichier uniquement les TROIS morceaux necessaires a la
// verification, et on les reassemble dans un petit programme de test :
//   - les constantes (bornes de plausibilite)
//   - l'expression reguliere de detection
//   - les fonctions findAmountsInText et parseAmount
//
// Avantage de cette approche : si quelqu'un renomme ou deplace ces morceaux
// dans content.js, l'extraction echoue bruyamment au lieu de tester du vide.

const contentSource = readFileSync(CONTENT_FILE, 'utf8');

/** Extrait un bloc de code en comptant les accolades, pour ne pas se tromper. */
function extractBlock(source, startMarker, label) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    console.error(`ECHEC : bloc introuvable dans content.js -> ${label}`);
    console.error(`        repere recherche : ${startMarker.slice(0, 60)}...`);
    process.exit(1);
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

  console.error(`ECHEC : bloc mal ferme dans content.js -> ${label}`);
  process.exit(1);
}

const pieces = [];

/**
 * Extrait une declaration `const NOM = ...;` complete.
 *
 * On repere le mot-cle puis on avance jusqu'au point-virgule qui termine la
 * declaration. Contrairement a une expression reguliere, cette methode ne se
 * fait pas piéger par les tableaux multi-lignes (comme CURRENCIES).
 */
function extractConstant(source, name) {
  const marker = `const ${name} =`;
  const start = source.indexOf(marker);
  if (start === -1) {
    console.error(`ECHEC : constante ${name} introuvable dans content.js`);
    process.exit(1);
  }

  const end = source.indexOf(';', start);
  if (end === -1) {
    console.error(`ECHEC : constante ${name} non terminee dans content.js`);
    process.exit(1);
  }

  return source.slice(start, end + 1);
}

// --- Constantes simples -----------------------------------------------------
for (const name of ['SPACES', 'MIN_AMOUNT', 'MAX_AMOUNT']) {
  pieces.push(extractConstant(contentSource, name));
}

// --- Bloc complet des devises ------------------------------------------------
//
// On extrait d'un seul tenant : la table CURRENCIES, les index construits a
// partir d'elle, la fonction escapeForRegex et les cinq expressions
// regulieres. Ce bloc est autonome : il ne depend que des constantes
// ci-dessus. L'extraire en entier evite d'avoir a enumerer chaque morceau.
const currencyStart = contentSource.indexOf('const CURRENCIES = [');

// La fin du bloc est la fin de la declaration PATTERN_NAME_AFTER, qui est la
// derniere expression reguliere de la section. On la cherche explicitement
// pour ne pas s'arreter a l'une des quatre precedentes.
const namePatternStart = contentSource.indexOf('const PATTERN_WORDS_AFTER');
const currencyEnd = contentSource.indexOf('\n  );', namePatternStart);

if (currencyStart === -1 || namePatternStart === -1 || currencyEnd === -1) {
  console.error('ECHEC : bloc des devises introuvable dans content.js');
  console.error('        repere : const CURRENCIES = [ ... PATTERN_WORDS_AFTER');
  process.exit(1);
}

pieces.push(contentSource.slice(currencyStart, currencyEnd + 5));

// --- Fonctions de detection -------------------------------------------------
// L'ordre compte : findAmountsInText appelle parseAmount, amountEnd et
// resolveCurrency, qui doivent donc etre extraites elles aussi.
// Iteration 7 : findAmountsInText appelle desormais rejectionForCandidate et
// noteRejection, qui s'appuient sur REJECTION_COUNTS. Ces morceaux doivent
// donc etre extraits eux aussi, sinon le programme de test ne compile pas.
pieces.push(extractConstant(contentSource, 'REJECTION_COUNTS'));

for (const name of ['findAmountsInText', 'parseAmount', 'parseNumberWords', 'amountEnd', 'resolveCurrency', 'rejectionForCandidate', 'noteRejection']) {
  pieces.push(extractBlock(contentSource, `function ${name}`, name));
}

pieces.push('return { findAmountsInText: findAmountsInText, CURRENCIES: CURRENCIES };');

let findAmountsInText;
let CURRENCIES;
try {
  const engine = new Function(pieces.join('\n\n'))();
  findAmountsInText = engine.findAmountsInText;
  CURRENCIES = engine.CURRENCIES;
} catch (error) {
  console.error('ECHEC : les morceaux extraits de content.js ne compilent pas.');
  console.error('        detail : ' + error.message);
  process.exit(1);
}

if (typeof findAmountsInText !== 'function') {
  console.error('ECHEC : findAmountsInText non recupere depuis ' + CONTENT_FILE);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Lecture des donnees de test depuis la page de test
// ---------------------------------------------------------------------------

const html = readFileSync(TEST_FILE, 'utf8');

const match = html.match(
  /<script type="application\/json" id="unicorn-test-data">([\s\S]*?)<\/script>/
);

if (!match) {
  console.error('ECHEC : bloc de donnees de test introuvable dans ' + TEST_FILE);
  process.exit(1);
}

const data = JSON.parse(match[1]);

// ---------------------------------------------------------------------------
// 4. Verification
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

/** Affiche une ligne de resultat. */
function report(ok, label, detail) {
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

/** Presente un caractere invisible de facon lisible dans le terminal. */
function visualise(text) {
  return text
    .replace(/\u00A0/g, '[insecable]')
    .replace(/\u202F/g, '[fine]')
    .replace(/\u2009/g, '[fine2]')
    .replace(/\t/g, '[tabulation]');
}

function valuesOf(text) {
  const values = [];
  for (const found of findAmountsInText(text)) {
    if (found.range) {
      values.push(found.range.min, found.range.max);
    } else {
      values.push(found.value);
    }
  }
  return values;
}

/** Retourne les detections completes (valeur ET devise). */
function resultsOf(text) {
  return findAmountsInText(text);
}

console.log('UniConv — verification du moteur de detection');
console.log(`  moteur   : ${CONTENT_FILE}`);
console.log(`  donnees  : ${TEST_FILE}`);
console.log('');

// La table de detection est DISTINCTE de la liste des cibles disponibles :
// 46 devises sont detectees (symboles/noms verifies), les autres servent
// seulement de cible de conversion via les taux.
report(
  CURRENCIES.length === 167,
  `la table de detection couvre ${CURRENCIES.length} devises`,
  CURRENCIES.length === 167 ? null : 'mettre a jour le README et ce test'
);

const missingCode = CURRENCIES.filter((currency) => !currency.code);
report(
  missingCode.length === 0,
  'chaque devise detectee a un code ISO',
  missingCode.length ? `sans code : ${missingCode.length}` : null
);

const codeOnly = CURRENCIES.filter(
  (currency) => !currency.symbol && (!currency.names || currency.names.length === 0)
);
report(
  codeOnly.length <= 1,
  `devises detectees par le code seul : ${codeOnly.length}`,
  codeOnly.length ? codeOnly.map((currency) => currency.code).join(', ') : null
);

// --- 4a. Les textes qui DOIVENT etre detectes -------------------------------
console.log('1. Textes qui doivent etre detectes');
for (const testCase of data.mustMatch) {
  const results = resultsOf(testCase.text);

  const expectedCurrency = testCase.currency || null;
  const foundCurrency = results.length > 0 && results[0].currency
    ? results[0].currency.code
    : null;

  const valueOk = results.length === 1 && results[0].value === testCase.value;
  const currencyOk = !expectedCurrency || foundCurrency === expectedCurrency;
  const ok = valueOk && currencyOk;

  let detail = null;
  if (!valueOk) {
    detail = `trouve : ${results.length === 0
      ? 'rien'
      : results.map((r) => r.value).join(', ')}`;
  } else if (!currencyOk) {
    detail = `devise trouvee : ${foundCurrency}, attendue : ${expectedCurrency}`;
  }

  const label = expectedCurrency
    ? `"${visualise(testCase.text)}" -> ${testCase.value} ${expectedCurrency}`
    : `"${visualise(testCase.text)}" -> ${testCase.value}`;

  report(ok, label, detail);
}

// --- 4b. Les textes qui NE DOIVENT PAS etre detectes ------------------------
console.log('');
console.log('2. Textes qui ne doivent PAS etre detectes');
for (const testCase of data.mustNotMatch) {
  const values = valuesOf(testCase.text);
  const ok = values.length === 0;
  report(
    ok,
    `"${visualise(testCase.text)}" (${testCase.reason})`,
    ok ? null : `faux positif : ${values.join(', ')}`
  );
}

// --- 4c. Les textes qui doivent contenir au moins une valeur ----------------
console.log('');
console.log('3. Textes contenant un montant au milieu d\'une phrase');
for (const testCase of data.mustContain) {
  const values = valuesOf(testCase.text);
  const ok = values.includes(testCase.value);
  report(
    ok,
    `"${visualise(testCase.text)}" contient ${testCase.value} (${testCase.reason})`,
    ok ? null : `trouve : ${values.length === 0 ? 'rien' : values.join(', ')}`
  );
}

// --- 4c bis. Les fourchettes de prix ---------------------------------------
console.log('');
console.log('3bis. Fourchettes de prix (2000 - 3000 CNY)');

const rangeCases = [
  ['2000 - 3000 CNY', 2000, 3000, 'CNY'],
  ['2000-3000 CNY', 2000, 3000, 'CNY'],
  ['2000–3000 CNY', 2000, 3000, 'CNY'],
  ['2000 — 3000 CNY', 2000, 3000, 'CNY'],
  ['2000 ~ 3000 CNY', 2000, 3000, 'CNY'],
  ['2000/3000 CNY', 2000, 3000, 'CNY'],
  ['2000 to 3000 CNY', 2000, 3000, 'CNY'],
  ['de 2000 à 3000 CNY', 2000, 3000, 'CNY'],
  ['entre 2000 et 3000 CNY', 2000, 3000, 'CNY'],
  ['between 2000 and 3000 CNY', 2000, 3000, 'CNY'],
  ['CNY 2000 - 3000', 2000, 3000, 'CNY'],
  ['2 000 – 3 000 CNY', 2000, 3000, 'CNY'],
  ['€200-€300', 200, 300, 'EUR'],
  ['€10 - 20', 10, 20, 'EUR'],
  ['10 EUR - 20 EUR', 10, 20, 'EUR'],
  ['10 EUR - 20', 10, 20, 'EUR'],
  ['330 - 3300 USD', 330, 3300, 'USD'],
  ['8000 - 15000 CNY', 8000, 15000, 'CNY'],
  ['2000 - 3000 CNY /Day', 2000, 3000, 'CNY'],
  ['€200-€300 compensation', 200, 300, 'EUR'],
  ['Entre 70.000 et 80.000 PHP', 70000, 80000, 'PHP'],
  ['70.000 - 80.000 PHP', 70000, 80000, 'PHP'],
  ['70.000/80.000 PHP', 70000, 80000, 'PHP'],
  ['Entre 135 et 150 pesos', 135, 150, 'MXN']
];

for (const [text, min, max, code] of rangeCases) {
  const list = resultsOf(text);
  const found = list[0];
  const ok = list.length === 1 && Boolean(found.range) &&
    found.range.min === min && found.range.max === max &&
    found.currency && found.currency.code === code;
  report(
    ok,
    `"${visualise(text)}" -> fourchette ${min}–${max} ${code}`,
    ok ? null : (list.length === 0
      ? 'aucune detection'
      : list.map((entry) => entry.range
        ? `${entry.range.min}–${entry.range.max} ${entry.currency.code}`
        : `${entry.value} ${entry.currency.code}`).join(' | '))
  );
}

// Salaire philippin : milliers a points, devise PHP.
const fleSalary = resultsOf('Rémunération : 70.000 PHP');
report(
  fleSalary.length === 1 && fleSalary[0].value === 70000 &&
    fleSalary[0].currency && fleSalary[0].currency.code === 'PHP',
  '"70.000 PHP" (FLE) -> 70 000 PHP',
  fleSalary.length === 0
    ? 'aucune detection'
    : fleSalary.map((entry) => `${entry.value} ${entry.currency.code}`).join(' | ')
);

// Peso generique : « 135 pesos » (Mexique) et formes precises.
for (const [text, value, code] of [
  ['135 pesos', 135, 'MXN'],
  ['150 pesos', 150, 'MXN'],
  ['135 pesos mexicains', 135, 'MXN'],
  ['135 pesos philippins', 135, 'PHP'],
  ['135 pesos argentins', 135, 'ARS']
]) {
  const list = resultsOf(text);
  const found = list[0];
  const ok = list.length === 1 && found.value === value &&
    found.currency && found.currency.code === code;
  report(
    ok,
    `"${text}" -> ${value} ${code}`,
    ok ? null : (list.length === 0
      ? 'aucune detection'
      : list.map((entry) => `${entry.value} ${entry.currency.code}`).join(' | '))
  );
}

// Brunéi : « 500BND » (code colle), « 500 BND », nom complet.
for (const text of ['500BND', '500 BND', '500 dollars de brunei']) {
  const list = resultsOf(text);
  const found = list[0];
  const ok = list.length === 1 && found.value === 500 &&
    found.currency && found.currency.code === 'BND';
  report(
    ok,
    `"${text}" -> 500 BND`,
    ok ? null : (list.length === 0
      ? 'aucune detection'
      : list.map((entry) => `${entry.value} ${entry.currency.code}`).join(' | '))
  );
}

// Devises nouvellement detectees par leur code (et la casse).
for (const [text, value, code] of [
  ['500 KWD', 500, 'KWD'],
  ['500 kwd', 500, 'KWD'],
  ['500 QAR', 500, 'QAR'],
  ['500 TWD', 500, 'TWD'],
  ['500 BHD', 500, 'BHD'],
  ['500 OMR', 500, 'OMR'],
  ['500 JOD', 500, 'JOD'],
  ['500 LBP', 500, 'LBP'],
  ['500 dinar koweitien', 500, 'KWD'],
  ['500 Dollars', 500, 'USD']
]) {
  const list = resultsOf(text);
  const found = list[0];
  const ok = list.length === 1 && found.value === value &&
    found.currency && found.currency.code === code;
  report(
    ok,
    `"${text}" -> ${value} ${code}`,
    ok ? null : (list.length === 0
      ? 'aucune detection'
      : list.map((entry) => `${entry.value} ${entry.currency.code}`).join(' | '))
  );
}

// Le faux positif KES : « takes 6 » ne doit jamais être un montant.
const takeSix = resultsOf('It takes 6 weeks to learn');
report(
  takeSix.length === 0,
  '"takes 6" ne doit pas être lu comme KES 6',
  takeSix.length ? takeSix.map((entry) => entry.text).join(' | ') : null
);

// Yuan : toutes les appellations et le code non ISO RMB.
const rmbBefore = resultsOf('RMB 100');
report(
  rmbBefore.length === 1 && rmbBefore[0].currency.code === 'CNY' &&
    rmbBefore[0].value === 100,
  'RMB 100 = 100 CNY',
  rmbBefore.length ? `${rmbBefore[0].text} / ${rmbBefore[0].currency.code} / ${rmbBefore[0].value}` : 'aucun'
);

const renminbi = resultsOf('renminbi 100');
report(
  renminbi.length === 1 && renminbi[0].currency.code === 'CNY' &&
    renminbi[0].value === 100,
  'renminbi 100 = 100 CNY',
  renminbi.length ? `${renminbi[0].currency.code} / ${renminbi[0].value}` : 'aucun'
);

const yuanSymbol = resultsOf('13元');
report(
  yuanSymbol.length === 1 && yuanSymbol[0].currency.code === 'CNY' &&
    yuanSymbol[0].value === 13,
  '13元 = 13 CNY',
  yuanSymbol.length ? `${yuanSymbol[0].currency.code} / ${yuanSymbol[0].value}` : 'aucun'
);

const kAfter = resultsOf('13K RMB');
report(
  kAfter.length === 1 && kAfter[0].currency.code === 'CNY' &&
    kAfter[0].value === 13000,
  '13K RMB = 13 000 CNY',
  kAfter.length ? `${kAfter[0].value}` : 'aucun'
);

const kRange = resultsOf('RMB 5-9k');
report(
  kRange.length === 1 && kRange[0].range &&
    kRange[0].range.min === 5000 && kRange[0].range.max === 9000,
  'RMB 5-9k = 5 000 – 9 000 CNY',
  kRange.length && kRange[0].range
    ? `${kRange[0].range.min} – ${kRange[0].range.max}`
    : 'aucun'
);

const million = resultsOf('1.2M USD');
report(
  million.length === 1 && million[0].currency.code === 'USD' &&
    million[0].value === 1200000,
  '1.2M USD = 1 200 000 USD',
  million.length ? `${million[0].value}` : 'aucun'
);

const billion = resultsOf('3B EUR');
report(
  billion.length === 1 && billion[0].currency.code === 'EUR' &&
    billion[0].value === 3000000000,
  '3B EUR = 3 000 000 000 EUR',
  billion.length ? `${billion[0].value}` : 'aucun'
);

const billionWord = resultsOf('$480 billion');
report(
  billionWord.length === 1 && billionWord[0].currency.code === 'USD' &&
    billionWord[0].value === 480000000000,
  '$480 billion = 480 000 000 000 USD',
  billionWord.length ? `${billionWord[0].value}` : 'aucun'
);

const billionDollars = resultsOf('480 billion dollars');
report(
  billionDollars.length === 1 && billionDollars[0].currency.code === 'USD' &&
    billionDollars[0].value === 480000000000,
  '480 billion dollars = 480 000 000 000 USD',
  billionDollars.length ? `${billionDollars[0].value}` : 'aucun'
);

const trillion = resultsOf('1.2 trillion dollars');
report(
  trillion.length === 1 && trillion[0].currency.code === 'USD' &&
    trillion[0].value === 1200000000000,
  '1.2 trillion dollars = 1 200 000 000 000 USD',
  trillion.length ? `${trillion[0].value}` : 'aucun'
);

const milliards = resultsOf('480 milliards €');
report(
  milliards.length === 1 && milliards[0].currency.code === 'EUR' &&
    milliards[0].value === 480000000000,
  '480 milliards € = 480 000 000 000 EUR',
  milliards.length ? `${milliards[0].value}` : 'aucun'
);

// Noms de devises : l'espace avant le nom est obligatoire.
const gluedName = findAmountsInText('10dollars');
report(
  gluedName.length === 0,
  '"10dollars" (nom colle) n\'est pas un montant',
  gluedName.length ? gluedName.map((entry) => entry.text).join(' | ') : null
);
const spacedName = findAmountsInText('10 dollars');
report(
  spacedName.length === 1,
  '"10 dollars" (avec espace) reste un montant',
  spacedName.length ? spacedName[0].text : 'aucun'
);

// La phrase « 3–7 working days » ne doit produire AUCUN montant.
const workingDays = resultsOf('Usually takes 3–7 working days');
report(
  workingDays.length === 0,
  '"3–7 working days" ne doit produire aucun montant',
  workingDays.length ? workingDays.map((entry) => entry.text).join(' | ') : null
);

// Les plages qui ne sont PAS des prix restent muettes.
for (const [text, reason] of [
  ['4,5/5 EUR', 'note sur cinq'],
  ['24/7 EUR', 'disponibilite'],
  ['1-2 hours', 'duree sans devise'],
  ['10-20 %', 'pourcentage'],
  ['2026-10-22', 'date'],
  ['3:1 EUR', 'ratio']
]) {
  const list = resultsOf(text);
  report(
    list.length === 0,
    `"${visualise(text)}" -> aucune fourchette (${reason})`,
    list.length === 0 ? null : list.map((entry) => entry.text).join(' | ')
  );
}

// --- 4d. Pas de detection en double -----------------------------------------
console.log('');
console.log('4. Chaque montant ne doit etre detecte qu\'une seule fois');
for (const testCase of data.mustNotOverlap) {
  const results = resultsOf(testCase.text);
  const ok = results.length === 1;
  report(
    ok,
    `"${visualise(testCase.text)}" -> 1 detection (${testCase.reason})`,
    ok ? null : `${results.length} detection(s) : ${results.map((r) => r.text).join(' | ')}`
  );
}

// --- 4e. Observation des devises reconnues ----------------------------------
console.log('');
console.log('5. Observation — devises detectees sur des exemples varies');
for (const sample of ['\u20AC10', '$10', '\u00A310', '\u00A5100', '10 EUR', '100 JPY',
                      '10 CHF', '100 dollars', '10 livres sterling', '5 yens']) {
  const results = resultsOf(sample);
  const rendered = results.length === 0
    ? 'aucune detection'
    : results.map((r) => `${r.value} ${r.currency ? r.currency.code : '?'}`).join(', ');
  console.log(`  note  "${visualise(sample)}" -> ${rendered}`);
}

// ---------------------------------------------------------------------------
// 5. Bilan
// ---------------------------------------------------------------------------

console.log('');
console.log(`Bilan : ${passed} reussi(s), ${failed} echec(s)`);

if (failed > 0) {
  console.log('');
  console.log('Le moteur de detection doit etre corrige dans src/detect.js.');
  console.log('Ne pas modifier les valeurs attendues pour faire passer le test :');
  console.log('c\'est le comportement du moteur qu\'il faut ajuster.');
}

process.exit(failed > 0 ? 1 : 0);
