/**
 * ============================================================================
 *  UniConv — tools/units-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier le moteur des UNITES DE MESURE (iteration 5) :
 *    - la detection de chaque format (symbole, mot, compose, 1m80...) ;
 *    - les conversions, avec une « table de verite » de valeurs de reference.
 *
 *  Les conversions d'unites sont exactes (facteurs constants), contrairement
 *  aux taux de change. On peut donc verifier des valeurs exactes.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/units-tests.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_FILE = join(ROOT, 'src', 'content.js');

// ---------------------------------------------------------------------------
// 1. Extraction du moteur d'unites
// ---------------------------------------------------------------------------

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

function extractConst(name) {
  const start = src.indexOf(`const ${name} =`);
  const end = src.indexOf(';', start);
  return src.slice(start, end + 1);
}

function extractArr(name) {
  const start = src.indexOf(`const ${name} = [`);
  let depth = 0, started = false, end = start;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '[') { depth += 1; started = true; }
    else if (src[i] === ']') { depth -= 1; if (started && depth === 0) { end = src.indexOf(';', i) + 1; break; } }
  }
  return src.slice(start, end);
}

function extractObj(name) {
  const start = src.indexOf(`const ${name} =`);
  let depth = 0, started = false, end = start;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; started = true; }
    else if (src[i] === '}') { depth -= 1; if (started && depth === 0) { end = src.indexOf(';', i) + 1; break; } }
  }
  return src.slice(start, end);
}

const pieces = ['const LOG_PREFIX = "[UniConv]";'];
pieces.push(extractConst('SPACES'));
pieces.push(extractConst('NOT_BEFORE'));
pieces.push(extractConst('NOT_AFTER'));
pieces.push('const MIN_AMOUNT = 0.01; const MAX_AMOUNT = 1000000000000;');
for (const name of ['NUMBER_WORD_UNITS', 'NUMBER_WORD_SCALES', 'NUMBER_WORD_HUNDREDS']) {
  pieces.push(extractObj(name));
}
pieces.push('const NUMBER_WORD_FILLERS = new Set(["and","et","de","d"]);');
pieces.push(extractBlock('escapeForRegex'));
pieces.push(extractBlock('parseNumberWords'));
pieces.push(extractBlock('parseAmount'));
pieces.push(extractBlock('amountEnd'));
pieces.push(extractArr('UNITS'));
pieces.push('const UNIT_BY_TOKEN = new Map(); for (const u of UNITS) for (const t of u.tokens) UNIT_BY_TOKEN.set(t, u);');
pieces.push(extractBlock('addUppercaseUnitAliases'));
pieces.push('addUppercaseUnitAliases(UNIT_BY_TOKEN);');
pieces.push(extractConst('DETECTION_EXCLUDED_TOKENS'));
pieces.push('const UNIT_TOKENS = Array.from(UNIT_BY_TOKEN.keys()).filter((t) => !DETECTION_EXCLUDED_TOKENS.has(t)).sort((a,b)=>b.length-a.length);');
pieces.push('let targetSystem = \'metric\';');
// Iteration 8 : les libelles sont traduits (systemLabel + t + TEXTS).
pieces.push("let uiLanguage = 'fr';");
pieces.push(extractObj('TEXTS'));
// « extractBlock('t') » chercherait « function t », qui peut correspondre a
// n'importe quelle fonction commencant par « t ». On vise la signature exacte.
{
  const start = src.indexOf('function t(key)');
  if (start === -1) throw new Error('fonction t(key) introuvable');
  let depth = 0, started = false;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; started = true; }
    else if (src[i] === '}') { depth -= 1; if (started && depth === 0) { pieces.push(src.slice(start, i + 1)); break; } }
  }
}
pieces.push(extractBlock('systemLabel'));
pieces.push(extractBlock('numberLocale'));
const patternStart = src.indexOf('const FRACTION_GLYPHS');
const patternEnd = src.indexOf('\n  );', src.indexOf('const PATTERN_HEIGHT_FR'));
pieces.push(src.slice(patternStart, patternEnd + 5));
pieces.push(extractBlock('convertUnitValue'));
pieces.push(extractBlock('convertTemperature'));
pieces.push(extractBlock('normalizeTempToken'));
// Iteration 7 : findUnitsInText appelle les regles anti-faux-positifs.
pieces.push(extractBlock('rejectionForCandidate'));
pieces.push(extractBlock('noteRejection'));
pieces.push('const REJECTION_COUNTS = Object.create(null);');
pieces.push(extractBlock('findUnitsInText'));
pieces.push(extractBlock('convertUnitToSystem'));
pieces.push(extractBlock('pickMetricUnit'));
pieces.push(extractBlock('pickImperialUnit'));
pieces.push(extractBlock('unitDisplayToken'));
pieces.push(extractObj('EQUIVALENCE_TARGET'));
pieces.push(extractBlock('buildUnitEquivalence'));
pieces.push(extractBlock('buildUnitEquivalenceTo'));
pieces.push(extractBlock('buildUnitTooltipContent'));
pieces.push('const numberFormatters = new Map();');
pieces.push(extractBlock('numberFormatter'));
pieces.push(extractBlock('formatUnitValue'));
pieces.push('return { findUnitsInText, convertUnitValue, convertUnitToSystem, formatUnitValue, buildUnitTooltipContent, buildUnitEquivalence, UNIT_BY_TOKEN };');

const api = new Function(pieces.join('\n\n'))();

// ---------------------------------------------------------------------------
// 2. Verification
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

/** Conversion de reference, par token. */
function conv(value, fromToken, toToken) {
  return api.convertUnitValue(value, api.UNIT_BY_TOKEN.get(fromToken), api.UNIT_BY_TOKEN.get(toToken));
}

function approx(actual, expected, tolerance = 0.01) {
  return actual !== null && Math.abs(actual - expected) <= tolerance;
}

console.log('UniConv — verification des unites de mesure');
console.log(`  fichier : ${CONTENT_FILE}`);
console.log('');

// --- 2a. Table de verite des conversions ------------------------------------
console.log('1. Table de verite des conversions');
const truth = [
  [0, '°C', '°F', 32],
  [100, '°C', '°F', 212],
  [32, '°F', '°C', 0],
  [212, '°F', '°C', 100],
  [0, '°C', 'K', 273.15],
  [273.15, 'K', '°C', 0],
  [1, 'mi', 'm', 1609.344],
  [1, 'km', 'm', 1000],
  [1, 'kg', 'lb', 2.2046226218487757],
  [1, 'lb', 'kg', 0.45359237],
  [1, 'gal', 'l', 3.785411784],
  [1, 'l', 'gal', 0.2641720523581484],
  [1, 'mph', 'km/h', 1.609344],
  [1, 'ft', 'in', 12]
];

for (const [value, from, to, expected] of truth) {
  const actual = conv(value, from, to);
  check(
    approx(actual, expected, 0.0001),
    `${value} ${from} = ${expected} ${to}`,
    `obtenu : ${actual}`
  );
}

// --- 2b. Detection des formats ----------------------------------------------
console.log('');
console.log('2. Detection des formats');
const detectCases = [
  ['5 km', 5, 'metric', 'length'],
  ['5km', 5, 'metric', 'length'],
  ['3 miles', 3, 'imperial', 'length'],
  ['2,5 kg', 2.5, 'metric', 'weight'],
  ['10 lbs', 10, 'imperial', 'weight'],
  ['6 ft', 6, 'imperial', 'length'],
  ['20°C', 20, 'metric', 'temperature'],
  ['70°F', 70, 'imperial', 'temperature'],
  ['100 km/h', 100, 'metric', 'speed'],
  ['60 mph', 60, 'imperial', 'speed'],
  ['5 L', 5, 'metric', 'volume'],
  ['10 gal', 10, 'imperial', 'volume']
];

for (const [text, value, system, category] of detectCases) {
  const found = api.findUnitsInText(text)[0];
  const ok = Boolean(found) && found.value === value &&
             found.system === system && found.category === category;
  check(ok, `"${text}" -> ${value} ${system} ${category}`,
        found ? `obtenu : ${found.value} ${found.system} ${found.category}` : 'rien');
}

// --- 2c. Formats speciaux ---------------------------------------------------
console.log('');
console.log('3. Formats speciaux');
const special = [
  ['1m80', 1.8],
  ['6 ft 2 in', 74],
  ['5\'10"', 70]
];
for (const [text, expected] of special) {
  const found = api.findUnitsInText(text)[0];
  check(Boolean(found) && Math.abs(found.value - expected) < 0.001,
        `"${text}" -> ${expected}`,
        found ? `obtenu : ${found.value}` : 'rien');
}

// --- 2c-bis. Faux positifs des unites ---------------------------------------
console.log('');
console.log('3bis. Faux positifs a ne PAS detecter');

const falsePositives = [
  ['1st', 'ordinaux anglais (1st, 2nd)'],
  ['10 in the box', '« in » suivi d\'un mot'],
  ['Le 1st prix', 'ordinal au milieu d\'une phrase'],

  // --- Iteration 7 -------------------------------------------------------
  ['12 m\u20AC de budget', '« m\u20AC » = millions d\'euros, pas des metres'],
  ['un chiffre d\'affaires de 25 m\u20AC', '« m\u20AC » = millions d\'euros'],
  ['50 K abonnes', '« K » = milliers, pas des kelvins'],
  ['1,2 M de vues', '« M » = millions (aucune unite « M »)'],
  ['appartement de 10 m\u00B2', 'une surface (m2), pas une longueur'],
  ['un volume de 5 m\u00B3', 'un volume (m3), pas une longueur'],
  ['piece de 10 m x 12 m', 'des dimensions, pas une longueur isolee'],
  ['1.2.3 kg', 'un numero de version'],
  ['a 12 in 2020', '« in » suivi d\'une annee'],
  ['10 m2 de carrelage', 'une surface ecrite sans exposant'],
  ['Le fichier fait 1,5 mo', '« mo » n\'est pas une unite reconnue']
];
for (const [text, reason] of falsePositives) {
  const found = api.findUnitsInText(text);
  check(
    found.length === 0,
    `"${text}" ne doit rien detecter (${reason})`,
    found.length ? `trouve : ${found.map((f) => f.text).join(', ')}` : null
  );
}

// Mais « 1 st » (avec espace) doit rester valide (1 stone).
const stone = api.findUnitsInText('1 st');
check(
  stone.length === 1 && stone[0].value === 1,
  '"1 st" (avec espace) reste detecte comme 1 stone',
  stone.length ? `trouve : ${stone.map((f) => f.text).join(', ')}` : 'rien'
);

// --- 2d. Conversion vers le systeme cible -----------------------------------
console.log('');
console.log('4. Conversion vers le systeme cible');
const toMetric = api.findUnitsInText('3 miles')[0];
const resultMetric = api.convertUnitToSystem(toMetric, 'metric');
check(
  Boolean(resultMetric) && approx(resultMetric.value, 4.828032),
  '3 miles -> metrique (4,83 km)',
  resultMetric ? `${resultMetric.value} ${resultMetric.unit.tokens[resultMetric.unit.tokens.length - 1]}` : 'null'
);

const toImperial = api.findUnitsInText('5 km')[0];
const resultImperial = api.convertUnitToSystem(toImperial, 'imperial');
check(
  Boolean(resultImperial) && approx(resultImperial.value, 3.1068559612),
  '5 km -> imperial (3,11 mi)',
  resultImperial ? `${resultImperial.value} ${resultImperial.unit.tokens[resultImperial.unit.tokens.length - 1]}` : 'null'
);

// --- 2d bis. Les quarts (iteration 14) --------------------------------------
console.log('');
console.log('4bis. Les quarts (US)');
check(
  approx(conv(1, 'qt', 'L'), 0.946352946),
  '1 quart US = 0,946352946 L',
  String(conv(1, 'qt', 'L'))
);
check(
  approx(conv(4, 'qt', 'gal'), 1, 0.0001),
  '4 quarts = 1 gallon US',
  String(conv(4, 'qt', 'gal'))
);
check(
  approx(conv(2, 'qt', 'pt'), 4, 0.0001),
  '2 quarts = 4 pints US',
  String(conv(2, 'qt', 'pt'))
);

const quartMatch = api.findUnitsInText('2 quarts');
check(
  quartMatch.length === 1 && quartMatch[0].value === 2,
  '"2 quarts" est reconnu',
  quartMatch.length ? quartMatch[0].text : 'rien'
);
check(
  api.findUnitsInText('2 qt').length === 1,
  '"2 qt" est reconnu',
  String(api.findUnitsInText('2 qt').length)
);

const quartBubble = quartMatch.length ? api.buildUnitTooltipContent(quartMatch[0]) : null;
check(
  Boolean(quartBubble) && /1[.,]89/.test(quartBubble.main) && quartBubble.main.includes('L'),
  "2 quarts s'affiche en litres (1,89 L)",
  quartBubble ? quartBubble.main : 'null'
);

// Faux positif : « trois quarts de la surface » (fraction francaise).
check(
  api.findUnitsInText('3 quarts de la surface').length === 0,
  '"3 quarts de la surface" (fraction) ne doit rien detecter',
  String(api.findUnitsInText('3 quarts de la surface').length)
);
// En anglais, « of » n'est pas concerne : c'est un vrai volume.
check(
  api.findUnitsInText('2 quarts of milk').length === 1,
  '"2 quarts of milk" reste un volume',
  String(api.findUnitsInText('2 quarts of milk').length)
);

// --- 2d ter. Unites ecrites en MAJUSCULES (emballages, OCR) -----------------
console.log('');
console.log('4ter. Unites en majuscules');
check(
  api.findUnitsInText('2.1 QT').length === 1,
  '"2.1 QT" (majuscules) est reconnu',
  String(api.findUnitsInText('2.1 QT').length)
);
check(
  api.findUnitsInText('10 IN').length === 1,
  '"10 IN" (majuscules) est reconnu',
  String(api.findUnitsInText('10 IN').length)
);
check(
  api.findUnitsInText('10 IN THE BOX').length === 0,
  '"10 IN THE BOX" n\'est pas des pouces (phrase)',
  String(api.findUnitsInText('10 IN THE BOX').length)
);
check(
  api.findUnitsInText('6 FT').length === 1,
  '"6 FT" (majuscules) est reconnu',
  String(api.findUnitsInText('6 FT').length)
);
check(
  api.findUnitsInText('2 L').length === 1,
  '"2 L" (litre majuscule) est reconnu',
  String(api.findUnitsInText('2 L').length)
);

const capsQuart = api.findUnitsInText('2.1 QT');
const capsBubble = capsQuart.length ? api.buildUnitTooltipContent(capsQuart[0]) : null;
check(
  Boolean(capsBubble) && /1[.,]99/.test(capsBubble.main),
  '2.1 QT s\'affiche en litres (1,99 L)',
  capsBubble ? capsBubble.main : 'null'
);

// --- 4quater. Ecritures etendues (iteration 16) -----------------------------
console.log('');
console.log('4quater. Mots pleins, nouvelles unites, temperatures, fractions');

const detections = (text) => api.findUnitsInText(text);
const one = (text) => {
  const list = detections(text);
  return list.length === 1 ? list[0] : null;
};

// a) Noms en toutes lettres (les cinq categories).
check(one('5 kilogrammes') && one('5 kilogrammes').value === 5,
  '« 5 kilogrammes » est reconnu');
check(Boolean(one('10 mètres')), '« 10 mètres » est reconnu');
check(Boolean(one('2 litres')), '« 2 litres » est reconnu');
check(Boolean(one('3 miles')), '« 3 miles » est reconnu');
check(Boolean(one('20 degrés Celsius')), '« 20 degrés Celsius » est reconnu');
check(Boolean(one('70 degrés Fahrenheit')), '« 70 degrés Fahrenheit » est reconnu');
check(Boolean(one('20 deg C')), '« 20 deg C » est reconnu');
check(Boolean(one('20 ° C')), '« 20 ° C » est reconnu');

// b) Conversions des nouvelles unites.
check(approx(conv(1, 'tonne', 'kg'), 1000), '1 tonne = 1000 kg', String(conv(1, 'tonne', 'kg')));
check(approx(conv(1, 'mg', 'kg'), 0.000001), '1 mg = 0,000001 kg', String(conv(1, 'mg', 'kg')));
check(approx(conv(1, 'µg', 'kg'), 0.000000001), '1 µg = 0,000000001 kg', String(conv(1, 'µg', 'kg')));
check(approx(conv(1, 'cl', 'L'), 0.01), '1 cl = 0,01 L', String(conv(1, 'cl', 'L')));
check(approx(conv(1, 'dl', 'L'), 0.1), '1 dl = 0,1 L', String(conv(1, 'dl', 'L')));
check(approx(conv(1, 'hl', 'L'), 100), '1 hl = 100 L', String(conv(1, 'hl', 'L')));
check(approx(conv(1, 'fl oz', 'L'), 0.0295735295625), '1 fl oz = 0,0295735 L', String(conv(1, 'fl oz', 'L')));
check(approx(conv(1, 'tsp', 'L'), 0.00492892159375), '1 tsp = 0,0049289 L', String(conv(1, 'tsp', 'L')));
check(approx(conv(1, 'tbsp', 'L'), 0.01478676478125), '1 tbsp = 0,0147868 L', String(conv(1, 'tbsp', 'L')));
check(approx(conv(1, 'cc', 'L'), 0.001), '1 cc = 0,001 L', String(conv(1, 'cc', 'L')));
check(approx(conv(1, 'nmi', 'm'), 1852), '1 nmi = 1852 m', String(conv(1, 'nmi', 'm')));
check(approx(conv(1, 'µm', 'm'), 0.000001), '1 µm = 0,000001 m', String(conv(1, 'µm', 'm')));
check(approx(conv(1, 'm/s', 'km/h'), 3.6), '1 m/s = 3,6 km/h', String(conv(1, 'm/s', 'km/h')));
check(approx(conv(1, 'kn', 'km/h'), 1.852), '1 nœud = 1,852 km/h', String(conv(1, 'kn', 'km/h')));

// c) Kelvin : temperature ou milliers ?
check(Boolean(one('300 K')), '« 300 K » est une temperature');
check(Boolean(one('300 °K')), '« 300 °K » est une temperature');
check(Boolean(one('température 77 K')), '« température 77 K » est une temperature');
check(detections('50 K').length === 0, '« 50 K » seul n\'est pas une temperature (milliers)');
check(detections('50 K abonnés').length === 0, '« 50 K abonnés » n\'est pas une temperature');
check(detections('50K').length === 0, '« 50K » (colle) n\'est pas une temperature');
check(detections('77 K').length === 0, '« 77 K » sans contexte n\'est pas une temperature');
check(Boolean(one('300 kelvins')), '« 300 kelvins » est reconnu');

const kelvinMatch = one('300 K');
const kelvinMetric = kelvinMatch ? api.convertUnitToSystem(kelvinMatch, 'metric') : null;
check(
  Boolean(kelvinMetric) && approx(kelvinMetric.value, 26.85, 0.01),
  '300 K -> 26,85 °C (conversion vers l\'echelle de l\'utilisateur)',
  kelvinMetric ? String(kelvinMetric.value) : 'null'
);

// d) Fractions.
check(one('1/2 cup') && approx(one('1/2 cup').value, 0.5), '« 1/2 cup » = 0,5 cup');
check(one('2 1/2 cups') && approx(one('2 1/2 cups').value, 2.5), '« 2 1/2 cups » = 2,5 cups');
check(one('2½ cups') && approx(one('2½ cups').value, 2.5), '« 2½ cups » = 2,5 cups');
check(one('½ tasse') && approx(one('½ tasse').value, 0.5), '« ½ tasse » = 0,5 tasse');
check(one('3/4 in') && approx(one('3/4 in').value, 0.75), '« 3/4 in » = 0,75 pouce');
check(detections('1/2/2026').length === 0, '« 1/2/2026 » n\'est pas une mesure');

// La phrase « 3–7 working days » ne doit produire aucune unite.
check(
  api.findUnitsInText('Usually takes 3–7 working days').length === 0,
  '"3–7 working days" ne doit produire aucune unite',
  String(api.findUnitsInText('Usually takes 3–7 working days').length)
);

// --- 2e. Affichage sans zeros inutiles --------------------------------------
console.log('');
console.log('5. Affichage');
check(
  api.formatUnitValue(5, api.UNIT_BY_TOKEN.get('km')) === '5 km',
  '5 kilometre s\'affiche "5 km"',
  api.formatUnitValue(5, api.UNIT_BY_TOKEN.get('km'))
);
check(
  api.formatUnitValue(20, api.UNIT_BY_TOKEN.get('°C')) === '20°C',
  '20 celsius s\'affiche "20°C"',
  api.formatUnitValue(20, api.UNIT_BY_TOKEN.get('°C'))
);

// --- 5bis. Ligne d'equivalence « 1 km = 0,62 mi » ---------------------------
console.log('');
console.log('5bis. Ligne d\'equivalence « 1 unité = ... »');
{
  const eq = (text) => {
    const match = api.findUnitsInText(text)[0];
    return api.buildUnitTooltipContent(match);
  };
  check(
    eq('3 miles').detail === '1 mi = 1,6093 km',
    '3 miles -> "1 mi = 1,6093 km"',
    eq('3 miles').detail
  );
  check(
    eq('5 km').detail === '1 km = 0,6214 mi',
    '5 km -> "1 km = 0,6214 mi"',
    eq('5 km').detail
  );
  check(
    eq('10 lbs').detail === '1 lb = 0,4536 kg',
    '10 lbs -> "1 lb = 0,4536 kg"',
    eq('10 lbs').detail
  );
  check(
    eq('70°F').detail === '°C = (°F − 32) × 5/9',
    '70°F -> formule de conversion',
    eq('70°F').detail
  );
}

// ---------------------------------------------------------------------------
// 3. Bilan
// ---------------------------------------------------------------------------

console.log('');
console.log(`Bilan : ${passed} reussi(s), ${failed} echec(s)`);

if (failed > 0) {
  console.log('Corriger le moteur d\'unites dans src/content.js.');
}

process.exit(failed > 0 ? 1 : 0);
