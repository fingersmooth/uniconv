/**
 * ============================================================================
 *  UniConv — tools/false-positive-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier l'iteration 7 : l'extension ne doit PAS convertir ce qui n'est pas
 *  un montant, et doit continuer a convertir les vrais prix.
 *
 *  POURQUOI CET OUTIL EXISTE
 *  -------------------------
 *  Un detecteur trop large transforme la lecture d'un article en cauchemar :
 *  chaque numero de page, chaque numero de version, chaque adresse IP se met a
 *  proposer une conversion. Ce test fige donc les pieges par ecrit, pour qu'une
 *  future modification ne les rende pas detectables par accident.
 *
 *  DEUX CATEGORIES DE PIEGES
 *  -------------------------
 *  1. Les pieges STRUCTURELS : « 1920x1080 » ou « 12h30 » ne contiennent ni
 *     symbole monetaire ni code de devise. Ils ne peuvent donc pas etre
 *     detectes aujourd'hui. On les teste quand meme : si quelqu'un relache un
 *     jour les expressions regulieres, le test le dira immediatement.
 *  2. Les pieges REELS : « v1.2.3 EUR », « chapitre 10 € », « 10-20 € »...
 *     La, c'est le contexte qui doit sauver la mise (regles de l'iteration 7).
 *
 *  Les faux positifs des UNITES (m2, m€, 50 K, 1st...) sont testes dans
 *  tools/units-tests.mjs, section « Faux positifs ».
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/false-positive-tests.mjs
 *
 *  Sortie : un rapport, et un code de sortie 0 si tout va bien, 1 sinon.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_FILE = join(ROOT, 'src', 'content.js');
const PAGE_FILE = join(ROOT, 'test', 'faux-positifs.html');

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

// ===========================================================================
//  1. Extraction du moteur de detection (sans navigateur)
// ===========================================================================
//
// Meme methode que tools/run-tests.mjs : on ne prend dans content.js que les
// morceaux necessaires, puis on les assemble dans un petit programme.

const src = readFileSync(CONTENT_FILE, 'utf8');

/** Extrait une fonction complete en comptant les accolades. */
function extractBlock(name) {
  const start = src.indexOf(`function ${name}`);
  if (start === -1) {
    throw new Error(`fonction introuvable dans content.js : ${name}`);
  }
  let depth = 0;
  let started = false;
  for (let index = start; index < src.length; index += 1) {
    const character = src[index];
    if (character === '{') {
      depth += 1;
      started = true;
    } else if (character === '}') {
      depth -= 1;
      if (started && depth === 0) {
        return src.slice(start, index + 1);
      }
    }
  }
  throw new Error(`fonction mal fermee : ${name}`);
}

/** Extrait une declaration `const NOM = ...;`. */
function extractConst(name) {
  const start = src.indexOf(`const ${name} =`);
  if (start === -1) {
    throw new Error(`constante introuvable dans content.js : ${name}`);
  }
  const end = src.indexOf(';', start);
  return src.slice(start, end + 1);
}

const pieces = ['const LOG_PREFIX = "[UniConv]";'];

for (const name of ['SPACES', 'MIN_AMOUNT', 'MAX_AMOUNT', 'REJECTION_COUNTS']) {
  pieces.push(extractConst(name));
}

// Le bloc des devises : de CURRENCIES jusqu'a la derniere expression reguliere.
const currenciesStart = src.indexOf('const CURRENCIES = [');
const wordsPatternStart = src.indexOf('const PATTERN_WORDS_AFTER');
const currenciesEnd = src.indexOf('\n  );', wordsPatternStart);
pieces.push(src.slice(currenciesStart, currenciesEnd + 5));

for (const name of [
  'escapeForRegex', 'resolveCurrency', 'parseAmount', 'parseNumberWords',
  'amountEnd', 'rejectionForCandidate', 'noteRejection', 'findAmountsInText'
]) {
  pieces.push(extractBlock(name));
}

pieces.push('return { findAmountsInText, rejectionForCandidate, REJECTION_COUNTS };');

let engine;
try {
  engine = new Function(pieces.join('\n\n'))();
} catch (error) {
  console.error('ECHEC : les morceaux extraits de content.js ne compilent pas.');
  console.error('        detail : ' + error.message);
  process.exit(1);
}

const { findAmountsInText, REJECTION_COUNTS } = engine;

/** Retourne la liste lisible des montants detectes dans un texte. */
function detect(text) {
  return findAmountsInText(text).map((amount) => amount.text.trim());
}

// ===========================================================================
//  2. Pieges : rien ne doit etre detecte
// ===========================================================================

console.log('UniConv — faux positifs des devises');
console.log(`  fichier : ${CONTENT_FILE}`);
console.log('');

/** Chaque entree : [texte, raison]. */
const traps = [
  // --- Numeros de version ------------------------------------------------
  ['v1.2.3 EUR', 'numero de version precede de « v »'],
  ['EUR 1.2.3', 'numero de version apres un code de devise'],
  ['1.2.3 EUR', 'numero de version nu'],
  ['version 2.0 EUR', 'mot « version » colle au nombre'],
  ['build 4.2.1 EUR', 'mot « build » colle au nombre'],
  ['Mise a jour 10.0.2 EUR', 'version d\'un logiciel'],
  ['rev. 3.1 EUR', 'revision de document'],

  // --- Heures ------------------------------------------------------------
  ['Il est 12h30', 'heure francaise'],
  ['Rendez-vous a 12:30', 'heure avec deux-points'],
  ['Ouvert de 9 h a 17 h', 'horaires'],
  ['Le train part a 08h05', 'heure de depart'],

  // --- Dates -------------------------------------------------------------
  ['Le 12/10/2025', 'date francaise'],
  ['2025-10-12', 'date ISO'],
  ['le 02.11.2024', 'date allemande'],

  // --- Plages et intervalles --------------------------------------------
  ['Entre 10-20 pages', 'plage sans devise'],
  ['de 5–10 chapitres', 'plage sans devise (tiret cadratin)'],
  ['3:1 EUR', 'ratio'],
  ['4,5/5 EUR', 'note sur cinq'],

  // --- Telephones --------------------------------------------------------
  ['+33 6 12 34 56 78', 'numero de telephone international'],
  ['06.12.34.56.78', 'telephone francais'],
  ['(555) 123-4567 EUR', 'telephone americain suivi d\'un code'],
  ['Appelez le 01 23 45 67 89', 'telephone francais a deux chiffres par groupe'],

  // --- Adresses techniques ----------------------------------------------
  ['192.168.1.1 EUR', 'adresse IP'],
  ['10.0.0.1', 'adresse IP privee'],

  // --- Normes, references, identifiants --------------------------------
  ['ISO 9001', 'norme ISO'],
  ['EN 1234 EUR', 'norme europeenne'],
  ['ref. 1234 EUR', 'reference de commande'],
  ['REF 4500 EUR', 'reference en majuscules'],
  ['modele 2500 EUR', 'numero de modele'],
  ['ISBN 978-2-07-0414', 'ISBN'],
  ['SKU 12345 EUR', 'identifiant produit'],
  ['COVID-19 EUR', 'nom de maladie'],
  ['H1N1', 'souche de virus'],
  ['Voir note 12 EUR', 'renvoi de bas de page'],

  // --- Numerotation ------------------------------------------------------
  ['page 12', 'numero de page'],
  ['chapitre 10 EUR', 'numero de chapitre'],
  ['figure 3 EUR', 'numero de figure'],
  ['n° 45 EUR', 'numero'],
  ['section 2 EUR', 'numero de section'],
  ['tome 1 EUR', 'numero de tome'],
  ['Le 3e etage EUR', 'numero d\'etage'],

  // --- Pourcentages et taux ---------------------------------------------
  ['remise 10 %', 'pourcentage'],
  ['taux 1,5 % EUR', 'taux suivi d\'un code de devise'],
  ['remise de 10% EUR', 'pourcentage'],

  // --- Dimensions et resolutions ----------------------------------------
  ['1920x1080', 'resolution d\'ecran'],
  ['10x20x30 EUR', 'dimensions a trois axes'],
  ['charge 1000 kg/m2 EUR', 'contrainte technique'],

  // --- Codes postaux, pluriels, divers ---------------------------------
  ['75001 Paris', 'code postal'],
  ['SW1A 1AA', 'code postal britannique'],
  ['GMT+2', 'fuseau horaire'],
  ['1,5 Go', 'taille de fichier'],
  ['250 Mo EUR', 'taille de fichier avec code'],
  ['#1234 EUR', 'numero de ticket'],
  ['0x1F EUR', 'nombre hexadecimal'],
  ['Article L123-4 EUR', 'reference legislative']
];

console.log('1. Pieges : aucun montant ne doit etre detecte');
console.log('');

for (const [text, reason] of traps) {
  const found = detect(text);
  check(
    found.length === 0,
    `${JSON.stringify(text)} ne doit rien detecter`,
    found.length ? `trouve : ${found.join(' | ')} (${reason})` : null
  );
}

// ===========================================================================
//  3. Vrais prix : ils doivent TOUJOURS etre detectes
// ===========================================================================
//
// C'est la partie la plus importante : une regle anti-faux-positif qui rejette
// un vrai prix est un bogue plus grave que le faux positif qu'elle corrige.

console.log('');
console.log('2. Non-regression : les vrais prix restent detectes');
console.log('');

/** Chaque entree : [texte, nombre de montants attendus]. */
const realPrices = [
  ['Prix : 10 €', 1],
  ['Article a 10 € seulement', 1],
  ['Le prix est de 250 € TTC', 1],
  ['12 € par personne', 1],
  ['$1,234.56', 1],
  ['100 JPY', 1],
  ['EUR 10', 1],
  ['CHF 1 234,56', 1],
  ['1 234,56 €', 1],
  ['1.234.567,89 €', 1],
  ['25 000 000 EUR', 1],
  ['0,50 €', 1],
  ['£5', 1],
  ['10 dollars', 1],
  ['dix euros', 1],
  ['De 5 € à 10 € seulement', 1],
  ['Prix : 10 € - 20 €', 1],
  ['Salaire 2 500 EUR brut', 1],
  ['iPhone 15 Pro a 999 €', 1],
  ['Le ratio qualite-prix est bon : 49,99 €', 1],
  ['Facture du 12/10/2025 : 149,90 €', 1],
  ['Ouvert de 9 h a 17 h, entree 8 €', 1],
  ['ISO 9001 certifie, audit a 1 200 €', 1],
  ['page 12, abonnement a 9,99 € par mois', 1],
  ['remise 10 %, soit 4,50 € de moins', 1],
  ['version 2.0 disponible pour 79 €', 1]
];

for (const [text, expected] of realPrices) {
  const found = detect(text);
  check(
    found.length === expected,
    `${JSON.stringify(text)} -> ${expected} montant(s)`,
    `trouve ${found.length} : ${found.join(' | ') || '(rien)'}`
  );
}

// ---------------------------------------------------------------------------
console.log('');
console.log('3. Les pieges traversent-ils vraiment les regles ?');
// ---------------------------------------------------------------------------

// Les compteurs doivent avoir enregistre des rejets : sans cela, les pieges
// seraient ecartes par hasard (aucun candidat), et non par une regle.
const totalRejections = Object.values(REJECTION_COUNTS)
  .reduce((total, count) => total + count, 0);

check(
  totalRejections >= 10,
  'les regles de contexte ont bien rejete des candidats',
  `rejets enregistres : ${JSON.stringify(REJECTION_COUNTS)}`);

check(
  (REJECTION_COUNTS.version || 0) >= 3,
  'la regle « numero de version » s\'est declenchee',
  `compteur : ${REJECTION_COUNTS.version || 0}`);

check(
  (REJECTION_COUNTS.numbering || 0) >= 3,
  'la regle « numerotation » s\'est declenchee',
  `compteur : ${REJECTION_COUNTS.numbering || 0}`);

// Les plages de PRIX sont desormais DETECTEES (une seule fourchette) ;
// seules les plages sans devise restent des pieges.
const priceRange = findAmountsInText('Entre 10-20 EUR');
check(
  priceRange.length === 1 && Boolean(priceRange[0].range) &&
    priceRange[0].range.min === 10 && priceRange[0].range.max === 20,
  'une plage de prix est detectee (10-20 EUR)',
  priceRange.length === 0 ? 'aucune detection' : JSON.stringify(priceRange[0]));

// --- Un cas limite, verifie explicitement --------------------------------
//
// « 1.234,56 € » est un prix allemand. Il contient deux points, et ne doit donc
// PAS etre pris pour un numero de version : c'est la raison d'etre de la
// reconnaissance du format des milliers.
const german = findAmountsInText('Prix : 1.234.567,89 €');
check(
  german.length === 1 && Math.abs(german[0].value - 1234567.89) < 0.01,
  'un prix au format allemand (1.234.567,89) est lu correctement',
  german.length ? `valeur lue : ${german[0].value}` : 'aucun montant');

// ===========================================================================
//  4. Verification croisee : la page de test dit-elle la meme chose ?
// ===========================================================================
//
// La page test/faux-positifs.html contient les memes pieges, sous forme de
// tableau, pour un test visuel dans Firefox. Si les deux listes divergent,
// l'utilisateur teste autre chose que ce que verifie la machine. On lit donc
// la page et on rejoue ses lignes.

console.log('');
console.log('4. Coherence avec la page test/faux-positifs.html');
console.log('');

/** Decode les entites HTML employees dans la page de test. */
function decodeEntities(text) {
  const map = {
    '&euro;': '\u20AC',
    '&agrave;': '\u00E0',
    '&sup2;': '\u00B2',
    '&ndash;': '\u2013',
    '&rsquo;': '\u2019',
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>'
  };

  let decoded = text;
  for (const [entity, character] of Object.entries(map)) {
    decoded = decoded.split(entity).join(character);
  }
  return decoded.replace(/<[^>]*>/g, '').trim();
}

/** Extrait les textes des cellules « td class=\"text\" » d'une section. */
function textsOfSection(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + 1);
  if (start === -1 || end === -1) {
    return [];
  }

  const section = html.slice(start, end);
  const cells = section.match(/<td class="text">([\s\S]*?)<\/td>/g) || [];

  return cells.map((cell) => decodeEntities(
    cell.replace(/^<td class="text">/, '').replace(/<\/td>$/, '')
  ));
}

let pageHtml = '';
try {
  pageHtml = readFileSync(PAGE_FILE, 'utf8');
} catch (error) {
  console.error(`ECHEC : page de test introuvable -> ${PAGE_FILE}`);
  process.exit(1);
}

const trapTexts = textsOfSection(
  pageHtml,
  '1. Les pieges (aucune conversion attendue)',
  '2. Les vrais prix (conversion attendue)'
);

const priceTexts = textsOfSection(
  pageHtml,
  '2. Les vrais prix (conversion attendue)',
  '3. Pause et liste noire'
);

check(
  trapTexts.length === 63,
  'la page contient bien 63 pieges',
  `${trapTexts.length} ligne(s) trouvee(s)`);

check(
  priceTexts.length === 13,
  'la page contient bien 13 vrais prix',
  `${priceTexts.length} ligne(s) trouvee(s)`);

let pageTrapsFailed = 0;
for (const text of trapTexts) {
  const found = detect(text);
  if (found.length > 0) {
    pageTrapsFailed += 1;
    console.log(`        piege converti : ${JSON.stringify(text)} -> ${found.join(' | ')}`);
  }
}
check(
  pageTrapsFailed === 0,
  'aucun piege de la page n\'est converti par le moteur',
  `${pageTrapsFailed} piege(s) converti(s)`);

let pagePricesFailed = 0;
for (const text of priceTexts) {
  if (detect(text).length === 0) {
    pagePricesFailed += 1;
    console.log(`        prix non converti : ${JSON.stringify(text)}`);
  }
}
check(
  pagePricesFailed === 0,
  'tous les vrais prix de la page sont convertis par le moteur',
  `${pagePricesFailed} prix non converti(s)`);

// ---------------------------------------------------------------------------
console.log('');
console.log('============================================================');
console.log(`  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('============================================================');

if (failed > 0) {
  console.log('Corriger les regles dans src/content.js.');
}

process.exit(failed === 0 ? 0 : 1);
