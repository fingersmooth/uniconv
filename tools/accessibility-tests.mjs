/**
 * ============================================================================
 *  UniConv — tools/accessibility-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier l'ACCESSIBILITE de la bulle et de ses menus (iteration 12) :
 *
 *    - annonces pour lecteur d'ecran (role, aria-live, aria-label, lang) ;
 *    - libelles des champs de recherche ;
 *    - etat des epingles (aria-pressed) ;
 *    - focus clavier VISIBLE ;
 *    - contrastes des textes (>= 4,5:1, calcule sur les vraies couleurs) ;
 *    - fermeture au clavier (Echap) ;
 *    - poignee de redimensionnement utilisable aux fleches ;
 *    - respect de « reduire les animations ».
 *
 *  Les couleurs sont LUES dans la feuille de style injectee : si quelqu'un la
 *  modifie et casse un contraste, le test echoue.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/accessibility-tests.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_FILE = join(ROOT, 'src', 'content.js');

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

const source = readFileSync(CONTENT_FILE, 'utf8');

/** Luminance relative WCAG d'une couleur #rrggbb. */
function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Rapport de contraste WCAG entre deux couleurs. */
function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

// ---------------------------------------------------------------------------
console.log('');
console.log('1. La bulle est annoncée aux lecteurs d\'écran');
// ---------------------------------------------------------------------------

check(/setAttribute\('role', 'status'\)/.test(source), 'la bulle a le rôle « status »');
check(/setAttribute\('aria-live', 'polite'\)/.test(source),
  'la bulle est une zone « aria-live » (annonce polie)');
check(/setAttribute\('aria-label', 'Conversion UniConv'\)/.test(source),
  'la bulle porte un libellé accessible');
check(/setAttribute\('lang', uiLanguage/.test(source),
  'la langue de la bulle suit la langue de l\'interface');
check(!/aria-hidden="true"[^]*?tooltip/.test(source),
  'la bulle n\'est jamais masquée aux lecteurs d\'écran quand elle est visible');

// ---------------------------------------------------------------------------
console.log('');
console.log('2. Les menus sont étiquetés');
// ---------------------------------------------------------------------------

check(/setAttribute\('aria-label', 'Rechercher une devise'\)/.test(source),
  'la recherche de devises a un libellé accessible');
check(/setAttribute\('aria-label', 'Rechercher une ville ou un pays'\)/.test(source),
  'la recherche de villes a un libellé accessible');
check(/setAttribute\('role', 'group'\)/.test(source) &&
  /setAttribute\('aria-label', 'Choisir une ville de reference'\)/.test(source),
  'le menu des villes est un groupe nommé');

const pressedCount = (source.match(/setAttribute\('aria-pressed'/g) || []).length;
check(pressedCount >= 2,
  'les épingles (devises et villes) annoncent leur état',
  `${pressedCount} occurrence(s)`);

// ---------------------------------------------------------------------------
console.log('');
console.log('3. Focus clavier visible');
// ---------------------------------------------------------------------------

check(/\.unicorn-currency-item:focus-visible/.test(source),
  'les lignes de menu ont un anneau de focus');
check(/\.unicorn-currency-search:focus-visible/.test(source),
  'les champs de recherche ont un anneau de focus');
check(/\.unicorn-tooltip-resize:focus-visible/.test(source),
  'la poignée de redimensionnement a un anneau de focus');
check(/outline: 2px solid/.test(source) && !/outline:\s*(none|0)\b/.test(source),
  'aucun « outline: none » ne supprime l\'anneau de focus');

// ---------------------------------------------------------------------------
console.log('');
console.log('4. Contrastes (calcul WCAG sur les couleurs réelles)');
// ---------------------------------------------------------------------------

const gradient = /linear-gradient\(180deg,\s*(#[0-9a-fA-F]{6})\s*0%,\s*(#[0-9a-fA-F]{6})\s*100%\)/
  .exec(source);

check(Boolean(gradient), 'le dégradé de la bulle est trouvé dans le style');

if (gradient) {
  const top = gradient[1];
  const bottom = gradient[2];
  const topRatio = contrast('#ffffff', top);
  const bottomRatio = contrast('#ffffff', bottom);
  check(topRatio >= 4.5,
    'le texte blanc est lisible sur le HAUT du dégradé',
    `${top} : ${topRatio.toFixed(2)}:1 (minimum 4,5)`);
  check(bottomRatio >= 4.5,
    'le texte blanc est lisible sur le BAS du dégradé',
    `${bottom} : ${bottomRatio.toFixed(2)}:1`);
}

const detailBlock = /\.unicorn-tooltip-detail \{([\s\S]*?)\}/.exec(source);
check(Boolean(detailBlock), 'le style de la ligne secondaire est trouvé');
check(Boolean(detailBlock) && !/opacity\s*:/.test(detailBlock[1]),
  'la ligne secondaire n\'est pas rendue translucide (contraste préservé)');

const lightDetail = /\.unicorn-tooltip\.unicorn-theme-light \.unicorn-tooltip-detail \{([\s\S]*?)\}/.exec(source);
const lightColor = lightDetail ? /(#[0-9a-fA-F]{6})/.exec(lightDetail[1]) : null;
check(Boolean(lightColor), 'la couleur secondaire du thème clair est trouvée');
if (lightColor) {
  const ratio = contrast(lightColor[1], '#ffffff');
  check(ratio >= 4.5, 'le thème clair reste lisible',
    `${lightColor[1]} sur blanc : ${ratio.toFixed(2)}:1`);
}

// ---------------------------------------------------------------------------
console.log('');
console.log('5. Clavier et animations');
// ---------------------------------------------------------------------------

check(/event\.key === 'Escape' \|\| event\.key === 'Esc'\) && frozen/.test(source),
  'Échap ferme une bulle figée');

check(/handle\.addEventListener\('keydown'/.test(source) &&
  /case 'ArrowLeft'/.test(source) && /case 'ArrowRight'/.test(source) &&
  /case 'ArrowUp'/.test(source) && /case 'ArrowDown'/.test(source),
  'la poignée se règle aux flèches (largeur et hauteur)');

check(/handle\.setAttribute\('tabindex', '0'\)/.test(source),
  'la poignée est atteignable au clavier');

check(/prefers-reduced-motion: reduce/.test(source),
  'les animations sont coupées si le système le demande');

check(/\.unicorn-currency-item:focus-visible[\s\S]*unicorn-theme-light[\s\S]*outline-color: #1b4ed1/.test(source),
  'l\'anneau de focus reste visible sur le thème clair');

// ---------------------------------------------------------------------------
console.log('');
console.log('6. Structure des menus');
// ---------------------------------------------------------------------------

check(/document\.createElement\('button'\)[\s\S]{0,120}item\.type = 'button'/.test(source),
  'les lignes du menu des devises sont de vrais boutons');
check((source.match(/item\.type = 'button'/g) || []).length >= 3,
  'les menus (devises, unités, villes) utilisent des boutons',
  `${(source.match(/item\.type = 'button'/g) || []).length} menus`);

check(/search\.type = 'text'/.test(source), 'les recherches sont des champs texte');

// ---------------------------------------------------------------------------
console.log('');
console.log('='.repeat(60));
console.log(failed === 0
  ? `  Resultat : ${passed} reussi(s), 0 echec(s)`
  : `  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('='.repeat(60));

process.exit(failed === 0 ? 0 : 1);
