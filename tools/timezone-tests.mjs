/**
 * ============================================================================
 *  UniConv — tools/timezone-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier la conversion des FUSEAUX HORAIRES (iteration 11).
 *
 *  COMMENT
 *  -------
 *  Le calcul vit dans src/content.js, entre deux marqueurs, sous forme de
 *  fonctions PURES (aucun acces au DOM). On extrait ce bloc et on le rejoue
 *  ici, hors navigateur :
 *
 *    - chaque cas de test/fuseaux.html est relu (une seule source de verite
 *      pour la page ET pour les tests) ;
 *    - l'heure lue et son fuseau doivent etre ceux attendus ;
 *    - l'instant UTC obtenu doit etre EXACT (heures d'ete comprises) ;
 *    - chaque piege doit ne rien detecter ;
 *    - les 132 villes doivent etre des fuseaux IANA valides ;
 *    - le formatage (24 h / 12 h) et les libelles sont verifies.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/timezone-tests.mjs
 *
 *  Sortie : un rapport, et un code de sortie 0 si tout va bien, 1 sinon.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_FILE = join(ROOT, 'src', 'content.js');
const PAGE_FILE = join(ROOT, 'test', 'fuseaux.html');
const OPTIONS_HTML = join(ROOT, 'src', 'options.html');
const OPTIONS_JS = join(ROOT, 'src', 'options.js');

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
console.log('1. Le module fuseaux est present et pur');
// ---------------------------------------------------------------------------

const contentSource = readFileSync(CONTENT_FILE, 'utf8');

const START = '// >>> DEBUT MODULE FUSEAUX';
const END = '// <<< FIN MODULE FUSEAUX';

check(contentSource.includes(START) && contentSource.includes(END),
  'les marqueurs du module fuseaux sont presents');

const startIndex = contentSource.indexOf(START);
const endIndex = contentSource.indexOf(END);
const moduleBlock = contentSource.slice(startIndex, endIndex);

// Le module ne doit toucher ni au DOM ni a l'extension : c'est ce qui le rend
// testable hors navigateur.
check(!/\bdocument\.|\bwindow\.|\bchrome\./.test(moduleBlock),
  'le module ne touche ni au DOM ni a l\'extension');

check(!/Date\.now\(\)/.test(moduleBlock),
  'le module ne lit pas l\'horloge : l\'instant est toujours un parametre');

const api = new Function(moduleBlock + `
  return {
    tzFindTimes, tzConvert, tzZoneFromId, tzFormatClock, tzFormatOffsetDiff,
    tzFormatGmtOffset, tzOffsetMinutesAt,
    tzShiftLabel, tzZoneName, tzBuildContent, tzPartsAt, tzIsIana,
    TZ_CITIES, TZ_ABBREVIATIONS, TZ_PLACES
  };
`)();

check(typeof api.tzFindTimes === 'function' && typeof api.tzConvert === 'function',
  'les fonctions de lecture et de conversion sont exposées');

// ---------------------------------------------------------------------------
console.log('');
console.log('2. Les villes proposées sont des fuseaux IANA valides');
// ---------------------------------------------------------------------------

check(Array.isArray(api.TZ_CITIES) && api.TZ_CITIES.length >= 100,
  'au moins 100 villes proposées',
  `${api.TZ_CITIES ? api.TZ_CITIES.length : 0} ville(s)`);

const invalidCities = [];
const seenIds = new Set();
const duplicateIds = [];

for (const entry of api.TZ_CITIES) {
  if (!entry || typeof entry.id !== 'string') {
    invalidCities.push(String(entry));
    continue;
  }
  if (seenIds.has(entry.id)) {
    duplicateIds.push(entry.id);
  }
  seenIds.add(entry.id);
  if (!api.tzIsIana(entry.id)) {
    invalidCities.push(entry.id);
  }
}

check(invalidCities.length === 0,
  'chaque identifiant est un fuseau IANA reconnu par le navigateur',
  invalidCities.join(', '));

check(duplicateIds.length === 0,
  'aucun doublon de fuseau',
  duplicateIds.join(', '));

const badPlaces = [];
for (const place of Object.keys(api.TZ_PLACES)) {
  const target = api.TZ_PLACES[place];
  if (target && typeof target === 'object') {
    if (typeof target.fixed !== 'number') {
      badPlaces.push(place);
    }
    continue;
  }
  if (typeof target !== 'string' || !api.tzIsIana(target)) {
    badPlaces.push(place);
  }
}

check(badPlaces.length === 0,
  'chaque expression (« heure de Paris ») pointe vers un fuseau valide',
  badPlaces.join(', '));

// ---------------------------------------------------------------------------
console.log('');
console.log('3. Les cas de la page sont lus correctement');
// ---------------------------------------------------------------------------

const pageSource = readFileSync(PAGE_FILE, 'utf8');
const jsonMatch = /<script type="application\/json" id="tz-cases">([\s\S]*?)<\/script>/.exec(pageSource);

check(Boolean(jsonMatch), 'la page de test contient ses cas (bloc JSON)');

const data = JSON.parse(jsonMatch[1]);

check(Array.isArray(data.valid) && data.valid.length >= 25,
  'au moins 25 cas valides',
  `${data.valid ? data.valid.length : 0} cas`);

check(Array.isArray(data.traps) && data.traps.length >= 12,
  'au moins 12 pièges',
  `${data.traps ? data.traps.length : 0} pièges`);

const defaultNow = Date.parse(data.now);

/** Décrit la zone attendue d'un cas (nombre = décalage fixe). */
function zoneMatches(zone, expected) {
  if (typeof expected === 'number') {
    return zone.iana === null && zone.fixedMinutes === expected;
  }
  return zone.iana === expected;
}

let validFailures = 0;
for (const testCase of data.valid) {
  const now = testCase.now ? Date.parse(testCase.now) : defaultNow;
  const found = api.tzFindTimes(testCase.text);
  const prefix = `« ${testCase.text} » (${testCase.label})`;

  if (found.length !== 1) {
    validFailures += 1;
    console.log(`  ECHEC ${prefix} : ${found.length} détection(s) au lieu de 1`);
    continue;
  }

  const detection = found[0];
  if (detection.hour !== testCase.hour || detection.minute !== testCase.minute) {
    validFailures += 1;
    console.log(`  ECHEC ${prefix} : heure lue ${detection.hour}:${detection.minute}` +
      ` au lieu de ${testCase.hour}:${testCase.minute}`);
    continue;
  }

  if (!zoneMatches(detection.zone, testCase.zone)) {
    validFailures += 1;
    console.log(`  ECHEC ${prefix} : fuseau lu ` +
      `${detection.zone.iana || detection.zone.fixedMinutes} au lieu de ${testCase.zone}`);
    continue;
  }

  const conversion = api.tzConvert(detection, api.tzZoneFromId('UTC'), now);
  const expectedMs = Date.parse(testCase.utc);
  if (Math.floor(conversion.instant / 1000) * 1000 !== expectedMs) {
    validFailures += 1;
    console.log(`  ECHEC ${prefix} : instant ` +
      `${new Date(conversion.instant).toISOString()} au lieu de ${testCase.utc}`);
    continue;
  }

  passed += 1;
  console.log(`  OK    ${prefix} -> ${testCase.utc}`);
}

check(validFailures === 0, 'tous les cas valides donnent l\'instant exact',
  `${validFailures} cas en échec`);

// ---------------------------------------------------------------------------
console.log('');
console.log('4. Les pièges ne déclenchent rien');
// ---------------------------------------------------------------------------

let trapFailures = 0;
for (const trap of data.traps) {
  const found = api.tzFindTimes(trap.text);
  if (found.length === 0) {
    passed += 1;
    console.log(`  OK    ${trap.text} -> rien (${trap.why})`);
  } else {
    trapFailures += 1;
    console.log(`  ECHEC ${trap.text} -> ${found.length} détection(s) : ` +
      found.map((entry) => `${entry.hour}:${entry.minute}`).join(', '));
  }
}

check(trapFailures === 0, 'aucun piège ne produit de détection',
  `${trapFailures} piège(s) en échec`);

// ---------------------------------------------------------------------------
console.log('');
console.log('5. Formatage de l\'heure et du décalage');
// ---------------------------------------------------------------------------

check(api.tzFormatClock({ hour: 20, minute: 5 }, false) === '20:05',
  '24 h : 20:05', api.tzFormatClock({ hour: 20, minute: 5 }, false));
check(api.tzFormatClock({ hour: 8, minute: 5 }, true) === '8:05 AM',
  '12 h : 8:05 AM', api.tzFormatClock({ hour: 8, minute: 5 }, true));
check(api.tzFormatClock({ hour: 0, minute: 0 }, true) === '12:00 AM',
  '12 h : minuit = 12:00 AM', api.tzFormatClock({ hour: 0, minute: 0 }, true));
check(api.tzFormatClock({ hour: 12, minute: 0 }, true) === '12:00 PM',
  '12 h : midi = 12:00 PM', api.tzFormatClock({ hour: 12, minute: 0 }, true));

check(api.tzFormatOffsetDiff(0) === 'meme heure', 'décalage nul', api.tzFormatOffsetDiff(0));
check(api.tzFormatOffsetDiff(60) === '+1 h', 'décalage +1 h', api.tzFormatOffsetDiff(60));
check(api.tzFormatOffsetDiff(90) === '+1 h 30', 'décalage +1 h 30', api.tzFormatOffsetDiff(90));
check(api.tzFormatOffsetDiff(-210) === '-3 h 30', 'décalage -3 h 30', api.tzFormatOffsetDiff(-210));

check(api.tzShiftLabel(0) === '' && api.tzShiftLabel(1) === 'le lendemain' &&
  api.tzShiftLabel(-1) === 'la veille',
  'libellés de changement de jour',
  `${api.tzShiftLabel(0)} / ${api.tzShiftLabel(1)} / ${api.tzShiftLabel(-1)}`);

// La phrase « 3–7 working days » ne doit produire aucune heure.
check(
  api.tzFindTimes('Usually takes 3–7 working days').length === 0,
  '"3–7 working days" ne doit produire aucune heure'
);

// ---------------------------------------------------------------------------
console.log('');
console.log('6. La bulle (contenu) est cohérente');
// ---------------------------------------------------------------------------

const midnight = Date.parse('2026-10-24T12:00:00Z');
const tokyo = api.tzZoneFromId('Asia/Tokyo');
const tokyoBubble = api.tzBuildContent(api.tzFindTimes('23:00 CET')[0], tokyo, false, midnight);

check(tokyoBubble.main === '07h00 à Tokyo',
  '23:00 CET -> première ligne « 07h00 à Tokyo »', tokyoBubble.main);
check(tokyoBubble.detail.includes('le lendemain'),
  'le changement de jour est annoncé', tokyoBubble.detail);
check(tokyoBubble.detail.includes('+8 h'),
  'le décalage est annoncé', tokyoBubble.detail);
check(!tokyoBubble.detail.includes('->'),
  'le détail ne répète pas la cible (elle est dans la première ligne)',
  tokyoBubble.detail);

const paris = api.tzZoneFromId('Europe/Paris');
const sameBubble = api.tzBuildContent(api.tzFindTimes('14:30 heure de Paris')[0], paris, false, midnight);
check(sameBubble.main === '14h30 à Paris',
  'la même ville affiche « 14h30 à Paris »', sameBubble.main);
check(sameBubble.detail.includes('meme heure'),
  'la même ville annonce « meme heure »', sameBubble.detail);

const utcBubble = api.tzBuildContent(
  api.tzFindTimes('14:30 CET')[0],
  { fixedMinutes: 0, label: 'UTC', iana: null },
  false,
  midnight
);
check(utcBubble.main === '13h30 UTC',
  'un fuseau fixe affiche « 13h30 UTC » (sans « à »)', utcBubble.main);

// Décalages GMT du menu des villes.
check(api.tzFormatGmtOffset(0) === 'GMT', 'GMT pour 0', api.tzFormatGmtOffset(0));
check(api.tzFormatGmtOffset(120) === 'GMT+2', 'GMT+2 pour +120 min', api.tzFormatGmtOffset(120));
check(api.tzFormatGmtOffset(-300) === 'GMT-5', 'GMT-5 pour -300 min', api.tzFormatGmtOffset(-300));
check(api.tzFormatGmtOffset(330) === 'GMT+5:30', 'GMT+5:30 (Inde)', api.tzFormatGmtOffset(330));
check(api.tzFormatGmtOffset(345) === 'GMT+5:45', 'GMT+5:45 (Népal)', api.tzFormatGmtOffset(345));

const parisZone = api.tzZoneFromId('Europe/Paris');
check(api.tzFormatGmtOffset(api.tzOffsetMinutesAt(parisZone, Date.parse('2026-07-01T12:00:00Z'))) === 'GMT+2',
  'Paris en été = GMT+2');
check(api.tzFormatGmtOffset(api.tzOffsetMinutesAt(parisZone, Date.parse('2026-01-15T12:00:00Z'))) === 'GMT+1',
  'Paris en hiver = GMT+1');

// ---------------------------------------------------------------------------
console.log('');
console.log('7. Réglages : page d\'options et stockage');
// ---------------------------------------------------------------------------

const optionsHtml = readFileSync(OPTIONS_HTML, 'utf8');
const optionsJs = readFileSync(OPTIONS_JS, 'utf8');

check(/id="detect-timezones"/.test(optionsHtml), 'la page de réglages a la case « fuseaux »');
check(/id="target-timezone"/.test(optionsHtml), 'la page de réglages a la ville de référence');
check(/id="time-format"/.test(optionsHtml), 'la page de réglages a le format des heures');

check(/'uniconv\.detectTimezones'/.test(optionsJs) &&
  /'uniconv\.targetTimezone'/.test(optionsJs) &&
  /'uniconv\.timeFormat'/.test(optionsJs),
  'les trois réglages ont une valeur par défaut');

check(/uniconv\.detectTimezones/.test(contentSource) &&
  /uniconv\.targetTimezone/.test(contentSource) &&
  /uniconv\.timeFormat/.test(contentSource),
  'le script de page lit ces trois réglages');

check(/uniconv\.pinnedTimezones/.test(contentSource),
  'les villes épinglées ont leur propre clé de stockage');

// ---------------------------------------------------------------------------
console.log('');
console.log('='.repeat(60));
console.log(failed === 0
  ? `  Resultat : ${passed} reussi(s), 0 echec(s)`
  : `  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('='.repeat(60));

process.exit(failed === 0 ? 0 : 1);
