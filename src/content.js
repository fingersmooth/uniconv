/**
 * ============================================================================
 *  UniConv — src/content.js
 *  Version 0.3.0 — iteration 2 : tous les formats de devises
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Firefox l'injecte dans chaque page web (http et https). Il :
 *    1. repere les montants en devises dans le texte de la page ;
 *    2. affiche une bulle au survol ;
 *    3. souligne les montants detectes, sans jamais modifier le contenu du site.
 *
 *  CE QUI EST RECONNU A CETTE ITERATION (iteration 2)
 *  -------------------------------------------------
 *    Symbole avant :  €10   $1,234.56   £5   ¥100
 *    Symbole apres :  10€   10 €   10,50 €   1 234,56 €
 *    Code avant    :  EUR 10   USD 5   CHF 1 234,56
 *    Code apres    :  10 EUR   100 JPY   1 234,56 CHF
 *    Nom apres     :  100 dollars   10 livres sterling   5 yens
 *    Separateurs   :  1 234,56 (francais)   1,234.56 (anglais)
 *    Espaces       :  insecable, fine, tabulation
 *
 *  LA CONVERSION RESTE FICTIVE (x 1,10) : les vrais taux arrivent a
 *  l'iteration 3.
 *
 *  ARCHITECTURE — UN SEUL FICHIER
 *  ------------------------------
 *  Une version precedente repartissait le code en trois fichiers declares
 *  ensemble dans le manifeste. Firefox chargeait alors l'extension mais
 *  n'injectait aucun script dans les pages, sans message d'erreur. On garde
 *  donc un fichier unique, et le style est injecte par le code.
 */

'use strict';

// ===========================================================================
//  VERROU ANTI-DOUBLE-INJECTION
// ===========================================================================

if (window.__UNICONV_CONTENT_LOADED__) {
  console.log('[UniConv] deja charge sur cette page, deuxieme passage ignore');
} else {
  window.__UNICONV_CONTENT_LOADED__ = true;

  /** Numero de version de ce fichier, affiche dans la console au demarrage. */
  const UNICONV_CONTENT_VERSION = '2.9.9';

  /**
   * Marqueur de CODE, distinct de la version du manifeste.
   *
   * Il est ecrit dans la page sur la feuille de style injectee
   * (`<style data-unic="style" data-unic-build="...">`). Une page de test peut
   * le lire pour verifier qu'elle parle bien au code attendu.
   *
   * POURQUOI : le projet a deja perdu des heures sur une « extension fantome »
   * — deux UniConv installees, l'ancienne injectant son code dans la page, si
   * bien qu'un correctif semblait sans effet. Le marqueur rend ce piege
   * immediatement visible.
   *
   * A CHANGER a chaque modification de ce fichier (une date et un mot suffisent).
   */
  const CONTENT_BUILD_TAG = '2.9.9';

  console.log(
    `[UniConv] content.js ${UNICONV_CONTENT_VERSION} (${CONTENT_BUILD_TAG}) charge sur ${window.location.href}`
  );

  // =========================================================================
  //  1. CONSTANTES
  // =========================================================================

  /** Prefixe commun a tous les messages : facilite la recherche dans la console. */
  const LOG_PREFIX = '[UniConv]';

  /**
   * Devise cible de la conversion.
   *
   * Elle est choisie par l'utilisateur via le menu deroulant de la bulle, et
   * memorisee dans le stockage. Defaut : dollar americain.
   */
  let targetCurrency = 'USD';
  let defaultTargetCurrency = 'USD';
  let defaultTargetTimezone = '';
  let referenceUnitsEnabled = false;

  /** Vrai quand la bulle est FIGEE par un clic sur un montant. */
  let frozen = false;

  /**
   * Vrai quand la bulle a ete ouverte par l'OCR AUTOMATIQUE (pas par un clic).
   *
   * POURQUOI CETTE DISTINCTION : une bulle figee bloque le survol, ce qui est
   * voulu pour un clic (l'utilisateur lit, la bulle reste). Mais la bulle de
   * l'OCR automatique s'ouvre sans clic : si elle bloquait tout, il faudrait
   * cliquer ailleurs entre chaque image, et l'image suivante ne s'analyserait
   * jamais — c'est le defaut signale (« la premiere detection marche, ensuite
   * plus rien »). Dans ce cas seulement, survoler une AUTRE image relance une
   * lecture et remplace la bulle.
   */

  /**
   * Taille choisie par l'utilisateur (en pixels), memorisee.
   * null = taille automatique.
   */
  const tooltipSize = { width: null, listHeight: null };

  /** Le montant fige (celui sur lequel l'utilisateur a clique). */
  let frozenAmount = null;

  /** Montant actuellement survole (pour figer depuis un bouton de devise). */
  let hoveredAmount = null;

  /** L'unite figee (quand l'utilisateur clique sur une unite). */
  let frozenUnit = null;

  /** L'heure figee (quand l'utilisateur clique sur une heure avec fuseau). */
  let frozenTime = null;

  /** Unite cible choisie dans le menu (ou null = choix automatique). */
  let selectedUnit = null;

  /** Devises epinglees par l'utilisateur (codes), affichees tout en haut. */
  const pinnedCurrencies = new Set();

  /**
   * Charge la devise cible depuis le stockage, puis ecoute ses changements.
   */
  function loadTargetCurrency() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }

      chrome.storage.local.get('uniconv.targetCurrency', function (result) {
        if (chrome.runtime.lastError) return;
        const value = result && result['uniconv.targetCurrency'];
        if (value && /^[A-Za-z]{3}$/.test(String(value))) {
          defaultTargetCurrency = String(value).toUpperCase();
          if (!frozen) {
            targetCurrency = defaultTargetCurrency;
          }
        }
      });

      if (chrome.storage.onChanged && chrome.storage.onChanged.addListener) {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area === 'local' && changes['uniconv.targetCurrency']) {
            const next = changes['uniconv.targetCurrency'].newValue;
            if (next && /^[A-Za-z]{3}$/.test(String(next))) {
              defaultTargetCurrency = String(next).toUpperCase();
              if (!frozen) {
                targetCurrency = defaultTargetCurrency;
              }
            }
          }
        });
      }
    } catch (error) {
      // Stockage indisponible : on garde le dollar.
    }
  }

  /**
   * Revient aux unites de reference pour une NOUVELLE bulle.
   * Les choix de cible faits dans une bulle ne doivent jamais devenir les
   * valeurs par defaut.
   */
  function resetBubbleTargets() {
    targetCurrency = defaultTargetCurrency;
    targetTimezone = defaultTargetTimezone;
    selectedUnit = null;
  }

  /**
   * Change la devise cible de la bulle courante. Elle n'est PAS enregistree :
   * la devise par defaut vient du cadre « Unites de reference » et une
   * nouvelle bulle y revient.
   */
  function saveTargetCurrency(code) {
    targetCurrency = String(code || '').toUpperCase();
  }

  /** Delai maximum d'attente d'une reponse de l'arriere-plan, en millisecondes. */
  const CONVERSION_TIMEOUT_MS = 6000;

  /** Delai minimum entre deux verifications de survol, en millisecondes. */
  const HOVER_THROTTLE_MS = 60;

  /** Marge entre la souris et la bulle, en pixels. */
  const MOUSE_GAP = 14;

  /** Marge minimale avec les bords de la fenetre, en pixels. */
  const VIEWPORT_MARGIN = 8;

  /**
   * Les espaces acceptes entre le nombre et le symbole.
   *
   * Il en existe plusieurs, visuellement identiques mais techniquement
   * differentes. C'est la premiere cause de detection ratee sur le web :
   *
   *   \u0020 espace normale          (« 10 € » tape au clavier)
   *   \u00A0 espace insecable        (tres repandu : Wikipedia, presse)
   *   \u202F espace insecable fine   (typographie francaise soignee)
   *   \u2009 espace fine             (idem)
   *   \t    tabulation
   */
  const SPACES = '[ \\u00A0\\u202F\\u2009\\t]';

  /**
   * Bornes de plausibilite : hors de ces valeurs, ce n'est pas un prix.
   * Un montant sous 1 centime ou au-dessus de mille milliards est presque
   * toujours un identifiant, une reference ou une annee.
   */
  const MIN_AMOUNT = 0.01;
  const MAX_AMOUNT = 1_000_000_000_000_000;

  /**
   * Balises dont on ne doit JAMAIS lire le contenu.
   *
   * SCRIPT et STYLE contiennent du code. TEXTAREA et INPUT sont des zones de
   * saisie. CODE et PRE affichent du code informatique, ou un montant n'a rien
   * a faire.
   */
  const SKIPPED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
    'OPTGROUP', 'DATALIST', 'OUTPUT', 'TITLE', 'CODE', 'PRE',
    // Iteration 7 : zones techniques ou un nombre n'est jamais un prix.
    'KBD', 'SAMP', 'VAR', 'TEMPLATE', 'MATH',
    'IFRAME', 'CANVAS', 'OBJECT', 'EMBED',
    'METER', 'PROGRESS'
    // NOTE : « SVG » et « MATH » ne figurent PAS dans cette liste. Le texte
    // qu'ils contiennent est du VRAI texte (un prix peut y etre ecrit), et
    // leurs balises sont en minuscules, donc hors de portee de ce test.
    // Les graphiques truffes de chiffres sont ecartes autrement, par la regle
    // « pave de chiffres » (voir looksLikeNumberDump).
  ]);

  // =========================================================================
  //  2. TABLE DES DEVISES
  // =========================================================================
  //
  // Chaque devise contient :
  //   code    : le code ISO a trois lettres, tel qu'on le voit sur le web
  //   symbol  : le symbole habituel, ou null si la devise n'en a pas
  //   names   : les mots qui peuvent la designer (en minuscules)
  //   before  : true si le symbole se place habituellement AVANT le nombre
  //
  // NOTE SUR LES SYMBOLES AMBIGUS
  // -----------------------------
  // « $ » peut designer le dollar americain, canadien, australien... Sans
  // autre indice, on choisit le dollar americain (USD). C'est la convention
  // la plus repandue sur le web anglophone. « £ » est attribue a la livre
  // sterling, « ¥ » au yen japonais. Ce choix sera rendu configurable a
  // l'iteration 8 (page d'options).

  const CURRENCIES = [
    { code: 'EUR', symbol: '\u20AC', names: ['euro', 'euros'], before: false },
    { code: 'USD', symbol: '$', names: ['dollar', 'dollars', 'buck', 'bucks'], before: true },
    { code: 'GBP', symbol: '\u00A3', names: ['livre sterling', 'livres sterling', 'pound', 'pounds'], before: true },
    { code: 'JPY', symbol: '\u00A5', names: ['yen', 'yens'], before: true },
    { code: 'CHF', symbol: null, names: ['franc suisse', 'francs suisses'], before: false },
    { code: 'CAD', symbol: null, names: ['dollar canadien', 'dollars canadiens'], before: true },
    { code: 'AUD', symbol: null, names: ['dollar australien', 'dollars australiens'], before: true },
    { code: 'NZD', symbol: null, names: ['dollar neozelandais', 'dollars neozelandais'], before: true },
    { code: 'CNY', symbol: '\u5143', names: ['yuan', 'yuans', 'renminbi', 'rmb', 'chinese yuan', 'yuan renminbi', '\u4eba\u6c11\u5e01', '\u5143'], before: false },
    { code: 'HKD', symbol: null, names: ['dollar de hong kong'], before: true },
    { code: 'SGD', symbol: null, names: ['dollar de singapour'], before: true },
    // Brunéi : le site FLE ecrit « 500BND » (code colle au nombre).
    // Pas de symbole : « B$ » entrerait en conflit avec « $ » dans la classe
    // de caracteres des symboles. Le code BND suffit.
    { code: 'BND', symbol: null, names: ['dollar de brunei', 'dollars de brunei',
      'dollar bruneien', 'dollars bruneiens', 'dollar brunéien', 'dollars brunéiens'], before: true },
    { code: 'SEK', symbol: 'kr', names: ['couronne suedoise', 'couronnes suedoises'], before: false },
    { code: 'NOK', symbol: 'kr', names: ['couronne norvegienne', 'couronnes norvegiennes'], before: false },
    { code: 'DKK', symbol: 'kr', names: ['couronne danoise', 'couronnes danoises'], before: false },
    { code: 'PLN', symbol: 'z\u0142', names: ['zloty', 'zlotys'], before: false },
    { code: 'CZK', symbol: 'K\u010D', names: ['couronne tcheque', 'couronnes tcheques'], before: false },
    { code: 'HUF', symbol: 'Ft', names: ['forint', 'forints'], before: false },
    { code: 'RON', symbol: null, names: ['leu', 'lei'], before: false },
    { code: 'BGN', symbol: null, names: ['lev', 'leva'], before: false },
    { code: 'TRY', symbol: '\u20BA', names: ['lire turque', 'lire turques'], before: false },
    { code: 'RUB', symbol: '\u20BD', names: ['rouble', 'roubles'], before: false },
    { code: 'UAH', symbol: '\u20B4', names: ['hryvnia', 'hryvnias'], before: false },
    { code: 'INR', symbol: '\u20B9', names: ['roupie', 'roupies'], before: true },
    { code: 'BRL', symbol: 'R$', names: ['real', 'reais'], before: true },
    // « pesos » seul est ambigu (Mexique, Argentine, Philippines, Colombie,
    // Chili...). On le rattache au PESO MEXICAIN par defaut, comme « $ » l'est
    // au dollar US. Les formes precises (« pesos philippins », « pesos
    // argentins ») restent prioritaires : les mots sont tries du plus long au
    // plus court.
    { code: 'MXN', symbol: null, names: ['peso', 'pesos', 'peso mexicain', 'pesos mexicains'], before: true },
    { code: 'ARS', symbol: null, names: ['peso argentin', 'pesos argentins'], before: true },
    { code: 'CLP', symbol: null, names: ['peso chilien', 'pesos chiliens'], before: true },
    { code: 'COP', symbol: null, names: ['peso colombien', 'pesos colombiens'], before: true },
    { code: 'KRW', symbol: '\u20A9', names: ['won', 'wons'], before: true },
    { code: 'MAD', symbol: 'DH', names: ['dirham', 'dirhams'], before: false },
    { code: 'TND', symbol: null, names: ['dinar tunisien', 'dinars tunisiens'], before: false },
    { code: 'DZD', symbol: null, names: ['dinar algerien', 'dinars algeriens'], before: false },
    { code: 'EGP', symbol: null, names: ['livre egyptienne', 'livres egyptiennes'], before: false },
    { code: 'ZAR', symbol: 'R', names: ['rand', 'rands'], before: true },
    { code: 'ILS', symbol: '\u20AA', names: ['shekel', 'shekels', 'shequels'], before: true },
    { code: 'SAR', symbol: null, names: ['riyal saoudien', 'riyals saoudiens'], before: false },
    { code: 'AED', symbol: null, names: ['dirham des emirats', 'dirhams des emirats'], before: false },
    { code: 'THB', symbol: '\u0E3F', names: ['baht', 'bahts'], before: true },
    { code: 'VND', symbol: '\u20AB', names: ['dong', 'dongs'], before: false },
    { code: 'IDR', symbol: null, names: ['roupie indonesienne', 'roupies indonesiennes'], before: false },
    { code: 'MYR', symbol: null, names: ['ringgit', 'ringgits'], before: false },
    { code: 'PHP', symbol: '\u20B1', names: ['peso philippin', 'pesos philippins'], before: true },
    { code: 'ISK', symbol: null, names: ['couronne islandaise', 'couronnes islandaises'], before: false },
    { code: 'XOF', symbol: null, names: ['franc CFA', 'francs CFA'], before: false },
    { code: 'XAF', symbol: null, names: ['franc CFA', 'francs CFA'], before: false }
  ];

  /** Index rapide : code ISO -> devise. */
  const CURRENCY_BY_CODE = new Map();
  for (const currency of CURRENCIES) {
    CURRENCY_BY_CODE.set(currency.code, currency);
  }

  /**
   * Table des symboles -> codes possibles.
   *
   * Plusieurs devises peuvent partager un symbole (« $ », « kr », « R »).
   * Le premier code rencontre dans CURRENCIES sert de choix par defaut.
   */
  const CURRENCY_BY_SYMBOL = new Map();
  for (const currency of CURRENCIES) {
    if (!currency.symbol) {
      continue;
    }
    if (!CURRENCY_BY_SYMBOL.has(currency.symbol)) {
      CURRENCY_BY_SYMBOL.set(currency.symbol, []);
    }
    CURRENCY_BY_SYMBOL.get(currency.symbol).push(currency.code);
  }

  /** Table des mots -> code, pour « 100 dollars » ou « 5 yens ». */
  const CURRENCY_BY_NAME = new Map();
  for (const currency of CURRENCIES) {
    for (const name of currency.names) {
      CURRENCY_BY_NAME.set(name, currency.code);
    }
  }

  /**
   * Alias non ISO tres courants : RMB et CNH designent le yuan chinois.
   * Ils entrent dans le motif des codes, mais resolvent vers CNY.
   */
  const CURRENCY_ALIASES = new Map([
    ['RMB', 'CNY'],
    ['CNH', 'CNY']
  ]);

  /** Tous les codes (ISO + alias), tries du plus long au plus court. */
  const CURRENCY_CODES = Array.from(new Set(
    CURRENCIES.map((currency) => currency.code)
      .concat(Array.from(CURRENCY_ALIASES.keys()))
  )).sort((a, b) => b.length - a.length);

  /**
   * Tous les symboles, tries du plus long au plus court (« R$ » avant « $ »).
   *
   * Le symbole « CHF » est volontairement exclu : c'est aussi un code ISO, et
   * il est traite comme tel par les motifs de code. Le garder ici creerait
   * deux detections concurrentes pour la meme chose.
   */
  const CURRENCY_SYMBOLS = [];
  for (const symbol of CURRENCY_BY_SYMBOL.keys()) {
    if (symbol !== 'CHF') {
      CURRENCY_SYMBOLS.push(symbol);
    }
  }
  CURRENCY_SYMBOLS.sort((a, b) => b.length - a.length);

  /** Tous les mots de devises, tries du plus long au plus court. */
  const CURRENCY_WORDS = Array.from(CURRENCY_BY_NAME.keys())
    .sort((a, b) => b.length - a.length);

  // =========================================================================
  //  META-DONNEES DES DEVISES POUR LE MENU DEROULANT
  // =========================================================================
  //
  // Le menu deroulant custom a besoin, pour chaque devise :
  //   - un NOM COMPLET en francais ;
  //   - un DRAPEAU (emoji) ;
  //   - un ordre d'importance pour les 10 devises majeures.

  /**
   * Code pays (ISO 3166-1 alpha-2) et nom complet en francais, par devise.
   * « EU » est un cas particulier (le drapeau europeen n'est pas derivable
   * des indicatifs regionaux). « null » = devise multi-pays (CFA), on affiche
   * alors un globe.
   */
  const CURRENCY_META = {
    EUR: { country: 'EU', name: 'Euro' },
    USD: { country: 'US', name: 'Dollar americain' },
    GBP: { country: 'GB', name: 'Livre sterling' },
    JPY: { country: 'JP', name: 'Yen japonais' },
    CHF: { country: 'CH', name: 'Franc suisse' },
    CAD: { country: 'CA', name: 'Dollar canadien' },
    AUD: { country: 'AU', name: 'Dollar australien' },
    NZD: { country: 'NZ', name: 'Dollar neo-zelandais' },
    CNY: { country: 'CN', name: 'Yuan chinois' },
    HKD: { country: 'HK', name: 'Dollar de Hong Kong' },
    SGD: { country: 'SG', name: 'Dollar de Singapour' },
    SEK: { country: 'SE', name: 'Couronne suedoise' },
    NOK: { country: 'NO', name: 'Couronne norvegienne' },
    DKK: { country: 'DK', name: 'Couronne danoise' },
    PLN: { country: 'PL', name: 'Zloty polonais' },
    CZK: { country: 'CZ', name: 'Couronne tcheque' },
    HUF: { country: 'HU', name: 'Forint hongrois' },
    RON: { country: 'RO', name: 'Leu roumain' },
    BGN: { country: 'BG', name: 'Lev bulgare' },
    TRY: { country: 'TR', name: 'Livre turque' },
    RUB: { country: 'RU', name: 'Rouble russe' },
    UAH: { country: 'UA', name: 'Hryvnia ukrainienne' },
    INR: { country: 'IN', name: 'Roupie indienne' },
    BRL: { country: 'BR', name: 'Real bresilien' },
    MXN: { country: 'MX', name: 'Peso mexicain' },
    ARS: { country: 'AR', name: 'Peso argentin' },
    CLP: { country: 'CL', name: 'Peso chilien' },
    COP: { country: 'CO', name: 'Peso colombien' },
    KRW: { country: 'KR', name: 'Won sud-coreen' },
    MAD: { country: 'MA', name: 'Dirham marocain' },
    TND: { country: 'TN', name: 'Dinar tunisien' },
    DZD: { country: 'DZ', name: 'Dinar algerien' },
    EGP: { country: 'EG', name: 'Livre egyptienne' },
    ZAR: { country: 'ZA', name: 'Rand sud-africain' },
    ILS: { country: 'IL', name: 'Shekel israelien' },
    SAR: { country: 'SA', name: 'Riyal saoudien' },
    AED: { country: 'AE', name: 'Dirham des Emirats' },
    THB: { country: 'TH', name: 'Baht thailandais' },
    VND: { country: 'VN', name: 'Dong vietnamien' },
    IDR: { country: 'ID', name: 'Roupie indonesienne' },
    MYR: { country: 'MY', name: 'Ringgit malaisien' },
    PHP: { country: 'PH', name: 'Peso philippin' },
    ISK: { country: 'IS', name: 'Couronne islandaise' },
    XOF: { country: 'SN', name: 'Franc CFA (UEMOA)' },
    XAF: { country: 'CM', name: 'Franc CFA (CEMAC)' },
    // --- Autres monnaies courantes (source large) -------------------------
    TWD: { country: 'TW', name: 'Nouveau dollar taiwanais' },
    KWD: { country: 'KW', name: 'Dinar koweitien' },
    QAR: { country: 'QA', name: 'Riyal qatari' },
    OMR: { country: 'OM', name: 'Rial omanais' },
    BHD: { country: 'BH', name: 'Dinar bahreini' },
    JOD: { country: 'JO', name: 'Dinar jordanien' },
    LBP: { country: 'LB', name: 'Livre libanaise' },
    PKR: { country: 'PK', name: 'Roupie pakistanaise' },
    BDT: { country: 'BD', name: 'Taka bangladais' },
    NPR: { country: 'NP', name: 'Roupie nepalaise' },
    LKR: { country: 'LK', name: 'Roupie srilankaise' },
    MMK: { country: 'MM', name: 'Kyat birman' },
    KHR: { country: 'KH', name: 'Riel cambodgien' },
    BND: { country: 'BN', name: 'Dollar de Brunei' },
    MOP: { country: 'MO', name: 'Pataca de Macao' },
    NGN: { country: 'NG', name: 'Naira nigerian' },
    GHS: { country: 'GH', name: 'Cedi ghaneen' },
    KES: { country: 'KE', name: 'Shilling kenyan' },
    TZS: { country: 'TZ', name: 'Shilling tanzanien' },
    UGX: { country: 'UG', name: 'Shilling ougandais' },
    ZMW: { country: 'ZM', name: 'Kwacha zambien' },
    MZN: { country: 'MZ', name: 'Metical mozambicain' },
    AOA: { country: 'AO', name: 'Kwanza angolais' },
    ETB: { country: 'ET', name: 'Birr ethiopien' },
    MUR: { country: 'MU', name: 'Roupie mauricienne' },
    FJD: { country: 'FJ', name: 'Dollar fidjien' },
    PGK: { country: 'PG', name: 'Kina papou' },
    XPF: { country: 'PF', name: 'Franc pacifique' },
    KZT: { country: 'KZ', name: 'Tenge kazakh' },
    AZN: { country: 'AZ', name: 'Manat azerbaidjanais' },
    GEL: { country: 'GE', name: 'Lari georgien' },
    AMD: { country: 'AM', name: 'Dram armenien' },
    BYN: { country: 'BY', name: 'Rouble bielorusse' },
    MDL: { country: 'MD', name: 'Leu moldave' },
    RSD: { country: 'RS', name: 'Dinar serbe' },
    MKD: { country: 'MK', name: 'Denar macedonien' },
    ALL: { country: 'AL', name: 'Lek albanais' },
    BAM: { country: 'BA', name: 'Mark convertible' },
    TMT: { country: 'TM', name: 'Manat turkmene' },
    UZS: { country: 'UZ', name: 'Sum ouzbek' },
    KGS: { country: 'KG', name: 'Som kirghize' },
    TJS: { country: 'TJ', name: 'Somoni tadjik' },
    XDR: { country: null, name: 'Droits de tirage speciaux (FMI)' },
    DOP: { country: 'DO', name: 'Peso dominicain' },
    GTQ: { country: 'GT', name: 'Quetzal guatemalteque' },
    HNL: { country: 'HN', name: 'Lempira hondurien' },
    PYG: { country: 'PY', name: 'Guarani paraguayen' },
    UYU: { country: 'UY', name: 'Peso uruguayen' },
    BOB: { country: 'BO', name: 'Boliviano' },
    VES: { country: 'VE', name: 'Bolivar venezuelien' },
    CRC: { country: 'CR', name: 'Colon costaricien' },
    NIO: { country: 'NI', name: 'Cordoba nicaraguayen' },
    PAB: { country: 'PA', name: 'Balboa panameen' },
    JMD: { country: 'JM', name: 'Dollar jamaicain' },
    TTD: { country: 'TT', name: 'Dollar de Trinite-et-Tobago' },
    BSD: { country: 'BS', name: 'Dollar bahameen' },
    BBD: { country: 'BB', name: 'Dollar barbadien' },
    BZD: { country: 'BZ', name: 'Dollar belizeen' },
    XCD: { country: 'AG', name: 'Dollar des Caraibes orientales' },
    GYD: { country: 'GY', name: 'Dollar guyanien' },
    SRD: { country: 'SR', name: 'Dollar surinamais' },
    HTG: { country: 'HT', name: 'Gourde haitienne' },
    CUP: { country: 'CU', name: 'Peso cubain' },
    AFN: { country: 'AF', name: 'Afghani' },
    IQD: { country: 'IQ', name: 'Dinar irakien' },
    IRR: { country: 'IR', name: 'Rial iranien' },
    SYP: { country: 'SY', name: 'Livre syrienne' },
    YER: { country: 'YE', name: 'Rial yemenite' },
    KPW: { country: 'KP', name: 'Won nord-coreen' },
    MNT: { country: 'MN', name: 'Tugrik mongol' },
    BTN: { country: 'BT', name: 'Ngultrum bhoutanais' },
    MVR: { country: 'MV', name: 'Rufiyaa maldivienne' },
    SCR: { country: 'SC', name: 'Roupie seychelloise' },
    MGA: { country: 'MG', name: 'Ariary malgache' },
    CVE: { country: 'CV', name: 'Escudo cap-verdien' },
    GMD: { country: 'GM', name: 'Dalasi gambien' },
    GNF: { country: 'GN', name: 'Franc guineen' },
    LRD: { country: 'LR', name: 'Dollar liberien' },
    SLL: { country: 'SL', name: 'Leone sierra-leonais' },
    SDG: { country: 'SD', name: 'Livre soudanaise' },
    SSP: { country: 'SS', name: 'Livre sud-soudanaise' },
    SOS: { country: 'SO', name: 'Shilling somalien' },
    DJF: { country: 'DJ', name: 'Franc djiboutien' },
    ERN: { country: 'ER', name: 'Nakfa erythreen' },
    KMF: { country: 'KM', name: 'Franc comorien' },
    BWP: { country: 'BW', name: 'Pula botswanais' },
    LSL: { country: 'LS', name: 'Loti lesothan' },
    NAD: { country: 'NA', name: 'Dollar namibien' },
    SZL: { country: 'SZ', name: 'Lilangeni swazi' },
    ZWL: { country: 'ZW', name: 'Dollar zimbabween' },
    LYD: { country: 'LY', name: 'Dinar libyen' },
    // --- Dernieres devises (completude 166/166) ---------------------------
    ANG: { country: 'CW', name: 'Florin des Antilles neerlandaises' },
    AWG: { country: 'AW', name: 'Florin arubais' },
    BIF: { country: 'BI', name: 'Franc burundais' },
    BMD: { country: 'BM', name: 'Dollar bermudien' },
    CDF: { country: 'CD', name: 'Franc congolais' },
    CLF: { country: 'CL', name: 'Unite de compte chilienne (UF)' },
    CNH: { country: 'CN', name: 'Yuan offshore (CNH)' },
    FKP: { country: 'FK', name: 'Livre des iles Malouines' },
    FOK: { country: 'FO', name: 'Couronne feroienne' },
    GGP: { country: 'GG', name: 'Livre de Guernesey' },
    GIP: { country: 'GI', name: 'Livre de Gibraltar' },
    HRK: { country: 'HR', name: 'Kuna croate' },
    IMP: { country: 'IM', name: 'Livre de l\'ile de Man' },
    JEP: { country: 'JE', name: 'Livre de Jersey' },
    KID: { country: 'KI', name: 'Dollar de Kiribati' },
    KYD: { country: 'KY', name: 'Dollar des iles Caimans' },
    LAK: { country: 'LA', name: 'Kip laotien' },
    MRU: { country: 'MR', name: 'Ouguiya mauritanien' },
    MWK: { country: 'MW', name: 'Kwacha malawite' },
    PEN: { country: 'PE', name: 'Sol peruvien' },
    RWF: { country: 'RW', name: 'Franc rwandais' },
    SBD: { country: 'SB', name: 'Dollar des iles Salomon' },
    SHP: { country: 'SH', name: 'Livre de Sainte-Helene' },
    SLE: { country: 'SL', name: 'Leone sierra-leonais' },
    STN: { country: 'ST', name: 'Dobra santomeen' },
    TOP: { country: 'TO', name: 'Pa\'anga tongien' },
    TVD: { country: 'TV', name: 'Dollar tuvaluan' },
    VUV: { country: 'VU', name: 'Vatu vanuatais' },
    WST: { country: 'WS', name: 'Tala samoan' },
    XCG: { country: 'CW', name: 'Florin caribeen' },
    ZWG: { country: 'ZW', name: 'Zimbabwe Gold (ZiG)' }
  };

  // -------------------------------------------------------------------------
  //  TOUTES LES DEVISES CONNUES SONT DETECTABLES
  // -------------------------------------------------------------------------
  //
  // CURRENCIES ne contient que les 46 devises dont le symbole et les noms ont
  // ete verifies a la main. Les 127 autres (KWD, QAR, TWD, BHD...) existent
  // dans CURRENCY_META : on les ajoute ici pour que « 500 KWD » ou
  // « 500 dinars koweitiens » soient reconnus.
  //
  // On n'invente PAS de symbole : la classe de caracteres des symboles ne
  // gere que les symboles d'un caractere, et les melanger casserait la
  // detection. Le code ISO et le nom francais suffisent.
  for (const [code, meta] of Object.entries(CURRENCY_META)) {
    if (CURRENCY_BY_CODE.has(code)) {
      continue;
    }

    const entry = { code: code, symbol: null, names: [], before: false };
    CURRENCIES.push(entry);
    CURRENCY_BY_CODE.set(code, entry);
    CURRENCY_CODES.push(code);

    const name = String(meta && meta.name ? meta.name : '').toLowerCase();
    if (name && !CURRENCY_BY_NAME.has(name)) {
      entry.names.push(name);
      CURRENCY_BY_NAME.set(name, code);
    }
  }

  // Les motifs sont construits plus bas a partir de CURRENCY_WORDS : on y
  // ajoute les nouveaux noms, puis on les trie du plus long au plus court.
  for (const name of CURRENCY_BY_NAME.keys()) {
    if (!CURRENCY_WORDS.includes(name)) {
      CURRENCY_WORDS.push(name);
    }
  }
  CURRENCY_WORDS.sort((a, b) => b.length - a.length);
  CURRENCY_CODES.sort((a, b) => b.length - a.length);

  /**
   * Noms des pays en francais, par code ISO 3166-1 alpha-2.
   *
   * Sert a la RECHERCHE dans le menu : taper « chine » doit trouver le yuan
   * (CNY), taper « japon » doit trouver le yen (JPY), etc. Le nom de la devise
   * seul ne suffit pas toujours : « Yuan chinois » ne contient pas la chaine
   * « chine ».
   */
  const COUNTRY_NAMES = {
    AE: 'Emirats arabes unis', AF: 'Afghanistan', AG: 'Antigua-et-Barbuda',
    AL: 'Albanie', AM: 'Armenie', AO: 'Angola', AR: 'Argentine',
    AU: 'Australie', AW: 'Aruba', AZ: 'Azerbaidjan',
    BA: 'Bosnie-Herzegovine', BB: 'Barbade', BD: 'Bangladesh',
    BG: 'Bulgarie', BH: 'Bahrein', BI: 'Burundi', BM: 'Bermudes',
    BN: 'Brunei', BO: 'Bolivie', BR: 'Bresil', BS: 'Bahamas',
    BT: 'Bhoutan', BW: 'Botswana', BY: 'Bielorussie', BZ: 'Belize',
    CA: 'Canada', CD: 'Republique democratique du Congo', CH: 'Suisse',
    CL: 'Chili', CM: 'Cameroun', CN: 'Chine', CO: 'Colombie',
    CR: 'Costa Rica', CU: 'Cuba', CV: 'Cap-Vert', CW: 'Curacao',
    CZ: 'Tchequie', DJ: 'Djibouti', DK: 'Danemark',
    DO: 'Republique dominicaine', DZ: 'Algerie', EG: 'Egypte',
    ER: 'Erythree', ET: 'Ethiopie', EU: 'Union europeenne',
    FJ: 'Fidji', FK: 'Iles Malouines', FO: 'Iles Feroe',
    GB: 'Royaume-Uni', GE: 'Georgie', GG: 'Guernesey', GH: 'Ghana',
    GI: 'Gibraltar', GM: 'Gambie', GN: 'Guinee', GT: 'Guatemala',
    GY: 'Guyana', HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatie',
    HT: 'Haiti', HU: 'Hongrie', ID: 'Indonesie', IL: 'Israel',
    IM: 'Ile de Man', IN: 'Inde', IQ: 'Irak', IR: 'Iran',
    IS: 'Islande', JE: 'Jersey', JM: 'Jamaique', JO: 'Jordanie',
    JP: 'Japon', KE: 'Kenya', KG: 'Kirghizistan', KH: 'Cambodge',
    KI: 'Kiribati', KM: 'Comores', KP: 'Coree du Nord',
    KR: 'Coree du Sud', KW: 'Koweit', KY: 'Iles Caimans',
    KZ: 'Kazakhstan', LA: 'Laos', LB: 'Liban', LK: 'Sri Lanka',
    LR: 'Liberia', LS: 'Lesotho', LY: 'Libye', MA: 'Maroc',
    MD: 'Moldavie', MG: 'Madagascar', MK: 'Macedoine du Nord',
    MM: 'Birmanie', MN: 'Mongolie', MO: 'Macao', MR: 'Mauritanie',
    MU: 'Maurice', MV: 'Maldives', MW: 'Malawi', MX: 'Mexique',
    MY: 'Malaisie', MZ: 'Mozambique', NA: 'Namibie', NG: 'Nigeria',
    NI: 'Nicaragua', NO: 'Norvege', NP: 'Nepal',
    NZ: 'Nouvelle-Zelande', OM: 'Oman', PA: 'Panama', PE: 'Perou',
    PF: 'Polynesie francaise', PG: 'Papouasie-Nouvelle-Guinee',
    PH: 'Philippines', PK: 'Pakistan', PL: 'Pologne', PY: 'Paraguay',
    QA: 'Qatar', RO: 'Roumanie', RS: 'Serbie', RU: 'Russie',
    RW: 'Rwanda', SA: 'Arabie saoudite', SB: 'Iles Salomon',
    SC: 'Seychelles', SD: 'Soudan', SE: 'Suede', SG: 'Singapour',
    SH: 'Sainte-Helene', SL: 'Sierra Leone', SN: 'Senegal',
    SO: 'Somalie', SR: 'Suriname', SS: 'Soudan du Sud',
    ST: 'Sao Tome-et-Principe', SY: 'Syrie', SZ: 'Eswatini',
    TH: 'Thailande', TJ: 'Tadjikistan', TM: 'Turkmenistan',
    TN: 'Tunisie', TO: 'Tonga', TR: 'Turquie',
    TT: 'Trinite-et-Tobago', TV: 'Tuvalu', TW: 'Taiwan',
    TZ: 'Tanzanie', UA: 'Ukraine', UG: 'Ouganda', US: 'Etats-Unis',
    UY: 'Uruguay', UZ: 'Ouzbekistan', VE: 'Venezuela', VN: 'Viet Nam',
    VU: 'Vanuatu', WS: 'Samoa', YE: 'Yemen', ZA: 'Afrique du Sud',
    ZM: 'Zambie', ZW: 'Zimbabwe'
  };

  /**
   * Pays supplementaires pour les monnaies partagees par plusieurs pays.
   *
   * L'euro est utilise par 20 pays, le franc CFA par 14... On veut que taper
   * « france », « cote d'ivoire » ou « gabon » trouve la bonne monnaie.
   */
  const CURRENCY_EXTRA_COUNTRIES = {
    EUR: [
      'Allemagne', 'Autriche', 'Belgique', 'Chypre', 'Espagne', 'Estonie',
      'Finlande', 'France', 'Grece', 'Irlande', 'Italie', 'Lettonie',
      'Lituanie', 'Luxembourg', 'Malte', 'Pays-Bas', 'Portugal',
      'Slovaquie', 'Slovenie', 'Croatie', 'Europe', 'zone euro'
    ],
    XOF: [
      'Afrique de l Ouest', 'UEMOA', 'Benin', 'Burkina Faso',
      'Cote d Ivoire', 'Guinee-Bissau', 'Mali', 'Niger', 'Senegal', 'Togo'
    ],
    XAF: [
      'Afrique centrale', 'CEMAC', 'Cameroun', 'Centrafrique', 'Congo',
      'Gabon', 'Guinee equatoriale', 'Tchad'
    ],
    XCD: [
      'Caraibes orientales', 'Antigua-et-Barbuda', 'Dominique', 'Grenade',
      'Saint-Christophe-et-Nieves', 'Sainte-Lucie',
      'Saint-Vincent-et-les-Grenadines'
    ],
    XDR: ['FMI', 'Droit de tirage special', 'Fonds monetaire international'],
    USD: ['Etats-Unis', 'Amerique', 'USA']
  };

  /**
   * Les 10 devises majeures, dans l'ordre d'importance sur les marches
   * des changes (volume d'echange mondial, ordre approximatif).
   * Elles sont epinglees en haut du menu.
   */
  const TOP_CURRENCIES = [
    'USD', 'EUR', 'JPY', 'GBP', 'CNY'
  ];

  /**
   * Convertit un code pays (2 lettres) en drapeau emoji.
   * Ex. « US » -> 🇺🇸, « FR » -> 🇫🇷, « EU » -> 🇪🇺.
   */
  function flagEmoji(country) {
    if (country === 'EU') {
      return '🇪🇺';
    }
    if (!country || country.length !== 2) {
      return '🌍';
    }
    const base = 0x1F1E6; // Indicatif regional A
    const first = base + country.charCodeAt(0) - 65;
    const second = base + country.charCodeAt(1) - 65;
    return String.fromCodePoint(first, second);
  }

  /** Nom complet d'une devise, ou son code en secours. */
  function currencyFullName(code) {
    const meta = CURRENCY_META[code];
    return meta && meta.name ? meta.name : code;
  }

  /** Drapeau d'une devise. */
  function currencyFlag(code) {
    const meta = CURRENCY_META[code];
    return flagEmoji(meta ? meta.country : null);
  }

  /** Symbole d'une devise, ou chaine vide. */
  function currencySymbolFor(code) {
    const currency = CURRENCY_BY_CODE.get(code);
    return currency && currency.symbol ? currency.symbol : '';
  }

  /** Echappe les caracteres speciaux d'une chaine pour une expression reguliere. */
  function escapeForRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Motif d'un NOMBRE, au format francais ou anglais.
   *
   * Quatre ecritures sont acceptees :
   *   12345                nombre simple
   *   1 234 / 1 234 567    espaces de milliers (normale, insecable, fine)
   *   1,234,567            virgules de milliers (usage anglais)
   *   1'234                apostrophe de milliers (usage suisse)
   * Et, facultativement, une partie decimale : « ,50 » ou « .50 ».
   *
   * Le groupe 1 de toutes les expressions ci-dessous est TOUJOURS ce motif :
   * c'est lui qui sera converti en nombre.
   */
  const NUMBER_PATTERN =
    // Format europeen continental : 1.234.567,89 (points = milliers,
    // virgule = decimale).
    '(?:\\d{1,3}(?:\\.\\d{3})+,\\d{1,2}' +
    // Milliers a points SANS decimale : « 70.000 », « 1.234 ».
    // Tres courant en francais pour les salaires (FLE : « Entre 70.000 et
    // 80.000 PHP »). Le parseur les lit deja comme des milliers (3 chiffres
    // apres le point).
    '|\\d{1,3}(?:\\.\\d{3})+' +
    '|\\d{1,3}(?:' + SPACES + '\\d{3})+(?:[.,]\\d{1,2})?' +
    '|\\d{1,3}(?:[,\']\\d{3})+(?:\\.\\d{1,2})?' +
    '|\\d+(?:[.,]\\d{1,2})?)';

  /**
   * Ordre de grandeur colle au nombre : k (mille), m (million), b (milliard),
   * bn/mn/tn, ou en mots (thousand, million, billion, milliard…).
   */
  const MAGNITUDE_WORD = '(?:' + SPACES +
    '?(?:thousands?|millions?|billions?|trillions?|milliers?|milliards?)(?![\\p{L}\\d]))';
  const MAGNITUDE_SUFFIX = '(?:(?:' + SPACES +
    '?(?:bn|mn|tn|[kKmMbB])(?![\\p{L}\\d]))|' + MAGNITUDE_WORD + ')?';
  const NUMBER_WITH_MAGNITUDE = '(' + NUMBER_PATTERN + MAGNITUDE_SUFFIX + ')';

  /**
   * Les nombres ecrits en toutes lettres, en francais et en anglais.
   *
   * On ne supporte que les montants « ronds » d'usage courant pour des prix :
   * unites, dizaines, centaines, milliers, millions, milliards, et leurs
   * combinaisons simples (« vingt-cinq », « cent cinquante »). Les nombres
   * farfelus (« trois cent quatre-vingt-dix-sept mille six cent vingt-deux »)
   * seront ajoutes progressivement si le besoin se presente.
   */
  const NUMBER_WORD_UNITS = {
    // Francais
    'zero': 0, 'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4,
    'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
    'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15,
    'seize': 16, 'vingt': 20, 'trente': 30, 'quarante': 40, 'cinquante': 50,
    'soixante': 60,
    // Anglais
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
    'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11,
    'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60,
    'seventy': 70, 'eighty': 80, 'ninety': 90
  };

  /** Multiplicateurs : les grands nombres. */
  const NUMBER_WORD_SCALES = {
    'mille': 1000, 'mil': 1000, 'million': 1_000_000, 'millions': 1_000_000,
    'milliard': 1_000_000_000, 'milliards': 1_000_000_000,
    'thousand': 1000, 'million': 1_000_000, 'millions': 1_000_000,
    'billion': 1_000_000_000, 'billions': 1_000_000_000
  };

  /** Mots a ignorer lors de la lecture (« and » en anglais, « de » en francais). */
  const NUMBER_WORD_FILLERS = new Set(['and', 'et', 'de', 'd']);

  /**
   * Les centaines sont speciales : « cent » / « hundred » signifient
   *   - « + 100 » quand rien ne precede  (« cent cinquante » = 150) ;
   *   - « x 100 » quand un nombre precede  (« deux cents » = 200).
   * On les garde a part pour appliquer cette double regle.
   */
  const NUMBER_WORD_HUNDREDS = { 'cent': 100, 'cents': 100, 'hundred': 100 };

  /**
   * Motif d'un NOMBRE EN LETTRES.
   *
   * Il accepte une suite de mots-nombres, eventuellement lies par des traits
   * d'union (« vingt-cinq ») ou des espaces (« cent cinquante »), ainsi que
   * les mots de liaison (« and », « de »).
   *
   * Le groupe 1 est toujours ce motif : c'est lui qui sera converti en nombre.
   */
  const NUMBER_WORDS_PATTERN =
    '(?:' +
    Object.keys(NUMBER_WORD_UNITS)
      .concat(Object.keys(NUMBER_WORD_SCALES))
      .concat(Object.keys(NUMBER_WORD_HUNDREDS))
      .concat(Array.from(NUMBER_WORD_FILLERS))
      .map(escapeForRegex)
      .join('|') +
    ')(?:[ \\u00A0\\u202F\\u2009\\-]*(?:et|and|de)?[ \\u00A0\\u202F\\u2009\\-]*' +
    '(?:' +
    Object.keys(NUMBER_WORD_UNITS)
      .concat(Object.keys(NUMBER_WORD_SCALES))
      .concat(Object.keys(NUMBER_WORD_HUNDREDS))
      .concat(Array.from(NUMBER_WORD_FILLERS))
      .map(escapeForRegex)
      .join('|') +
    '))*';

  /** Bornes : pas de lettre ni de chiffre colle au montant. */
  const NOT_BEFORE = '(?<![\\p{L}\\d])';
  const NOT_AFTER = '(?![\\p{L}\\d])';

  /** Symbole seul dans un groupe (pour les symboles avant). */
  const SYMBOL_CLASS = '[' + CURRENCY_SYMBOLS.map(escapeForRegex).join('') + ']';

  /** Codes ISO dans un groupe. */
  const CODE_CLASS = '(?:' + CURRENCY_CODES.join('|') + ')';

  // -------------------------------------------------------------------------
  //  Cinq expressions regulieres, une par famille de format.
  //
  //  On les teste separement plutot que de tout mettre dans une seule
  //  expression : chacune reste lisible, et il est facile d'en corriger une
  //  sans casser les quatre autres.
  // -------------------------------------------------------------------------

  /**
   * Format 1 : le symbole est AVANT le nombre.
   *   €10   $1,234.56   £5   R$ 10
   * Groupe 1 : le symbole       Groupe 2 : le nombre
   */
  const PATTERN_SYMBOL_BEFORE = new RegExp(
    NOT_BEFORE +
    '(' + SYMBOL_CLASS + ')' +
    '(?:' + SPACES + ')?' +
    NOT_BEFORE +
    NUMBER_WITH_MAGNITUDE +
    NOT_AFTER,
    'gu'
  );

  /**
   * Format 2 : le symbole est APRES le nombre.
   *   10€   10 €   10,50 €   1 234,56 $
   * Groupe 1 : le nombre        Groupe 2 : le symbole
   */
  /**
   * Format « 679€99 » : le symbole est place ENTRE les euros et les centimes.
   *
   * C'est un format reel, tres courant sur les sites qui affichent les
   * centimes en exposant (679 € 99 s'ecrit alors « 679€99 »). Une fois le
   * texte reconnu (ou lu par OCR), il donne exactement « 679€99 ».
   *
   * Sans ce motif, le detecteur ne trouvait RIEN :
   *   - « 679 € » est refuse, car « 99 » suit le symbole (NOT_AFTER) ;
   *   - « €99 » est refuse, car « 679 » precede le symbole (NOT_BEFORE).
   * Resultat : le texte etait bien vu, mais aucun montant n'en sortait.
   *
   * Groupe 1 : les euros   Groupe 2 : le symbole   Groupe 3 : les centimes
   */
  const PATTERN_SYMBOL_CENTS = new RegExp(
    NOT_BEFORE +
    NUMBER_WITH_MAGNITUDE +
    '(?:' + SPACES + ')?' +
    '(' + SYMBOL_CLASS + ')' +
    '(?:' + SPACES + ')?' +
    '(\\d{2})' +
    '(?![\\d])',
    'gu'
  );

  const PATTERN_SYMBOL_AFTER = new RegExp(
    NOT_BEFORE +
    NUMBER_WITH_MAGNITUDE +
    '(?:' + SPACES + ')?' +
    '(' + SYMBOL_CLASS + ')' +
    NOT_AFTER,
    'gu'
  );

  /**
   * Format 3 : le code ISO est AVANT le nombre.
   *   EUR 10   USD 5   CHF 1 234,56
   * Groupe 1 : le code          Groupe 2 : le nombre
   */
  const PATTERN_CODE_BEFORE = new RegExp(
    // Pas de code colle a la fin d'un mot : « takes 6 » ne donne pas KES 6.
    NOT_BEFORE +
    '(' + CODE_CLASS + ')' +
    '(?:' + SPACES + ')?' +
    NOT_BEFORE +
    NUMBER_WITH_MAGNITUDE +
    NOT_AFTER,
    'giu'
  );

  /**
   * Format 4 : le code ISO est APRES le nombre.
   *   10 EUR   100 JPY   1 234,56 CHF
   * Groupe 1 : le nombre        Groupe 2 : le code
   */
  const PATTERN_CODE_AFTER = new RegExp(
    NOT_BEFORE +
    NUMBER_WITH_MAGNITUDE +
    '(?:' + SPACES + ')?' +
    '(' + CODE_CLASS + ')' +
    NOT_AFTER,
    'giu'
  );

  /**
   * Format 5 : le NOM de la devise est apres le nombre.
   *   100 dollars   10 livres sterling   5 yens
   *
   * Le nombre doit precéder le mot : « Miles Davis » n'est donc jamais touche.
   * Groupe 1 : le nombre        Groupe 2 : le nom
   */
  const PATTERN_NAME_AFTER = new RegExp(
    NOT_BEFORE +
    NUMBER_WITH_MAGNITUDE +
    // L'espace est OBLIGATOIRE entre le nombre et le NOM de la devise :
    // « 10 dollars » oui, « 10dollars » non. Cela evite les noms de devises
    // colles a un autre mot (« working » ne doit pas donner « won »).
    '(?:' + SPACES + '+)' +
    '(' + CURRENCY_WORDS.map(escapeForRegex).join('|') + ')' +
    '(?![\\p{L}\\d])',
    'giu'
  );

  /**
   * Format 5bis : le NOM de la devise est AVANT le nombre.
   *   dollars 100   yuans 50   RMB 5-9k
   * Groupe 1 : le nom        Groupe 2 : le nombre
   */
  const PATTERN_NAME_BEFORE = new RegExp(
    NOT_BEFORE +
    '(' + CURRENCY_WORDS.map(escapeForRegex).join('|') + ')' +
    '(?:' + SPACES + '+)' +
    NUMBER_WITH_MAGNITUDE +
    NOT_AFTER,
    'giu'
  );

  // =========================================================================
  //  FOURCHETTES DE PRIX
  // =========================================================================
  //
  // « 2000 - 3000 CNY », « €200-€300 », « 10–20 € », « 2000/3000 USD »…
  //
  // Pourquoi un traitement a part : une fourchette n'est PAS deux montants
  // independants. Elle doit s'afficher « 2 000 – 3 000 CNY = 254 – 381 € »,
  // avec un seul taux. Les montants isoles qui la composent sont donc
  // ecartes au profit de cette detection (priorite 4).

  /** Separateurs admis entre les deux bornes. */
  const RANGE_SEPARATOR =
    '(?:\\s*[-–—−/~]\\s*|\\s+(?:to|à|a)\\s+)';

  /** Devise d'une fourchette : symbole, code ISO ou nom. */
  const RANGE_CURRENCY =
    '(?:' + SYMBOL_CLASS + '|' + CODE_CLASS + '|' +
    CURRENCY_WORDS.map(escapeForRegex).join('|') + ')';

  /**
   * Devise AVANT les deux nombres : « €200-€300 », « CNY 2000 - 3000 ».
   * Groupes : 1 devise, 2 minimum, 3 devise de la seconde borne (option), 4 maximum.
   */
  const PATTERN_RANGE_BOTH = new RegExp(
    // Pas de devise collee a un mot : « takes 3–7 » ne doit pas donner KES.
    NOT_BEFORE +
    '(' + RANGE_CURRENCY + ')' + '(?:' + SPACES + ')?' +
    NUMBER_WITH_MAGNITUDE +
    RANGE_SEPARATOR +
    '(?:(' + RANGE_CURRENCY + ')' + '(?:' + SPACES + ')?)?' +
    NUMBER_WITH_MAGNITUDE +
    NOT_AFTER,
    'giu'
  );

  /**
   * Devise APRES le second nombre : « 2000 - 3000 CNY », « 10–20 € ».
   * Groupes : 1 minimum, 2 maximum, 3 devise.
   */
  const PATTERN_RANGE_SUFFIX = new RegExp(
    NOT_BEFORE +
    NUMBER_WITH_MAGNITUDE +
    RANGE_SEPARATOR +
    NUMBER_WITH_MAGNITUDE +
    '(?:' + SPACES + ')?' +
    // Autorise « 2000-3000CNY » (chiffre avant) mais pas « 7working ».
    '(?<![\\p{L}])' +
    '(' + RANGE_CURRENCY + ')' +
    NOT_AFTER,
    'giu'
  );

  /**
   * Devise APRES le premier nombre : « 10 EUR - 20 », « 10€-20 ».
   * Groupes : 1 minimum, 2 devise, 3 maximum.
   */
  const PATTERN_RANGE_MID = new RegExp(
    NOT_BEFORE +
    NUMBER_WITH_MAGNITUDE +
    '(?:' + SPACES + ')?' +
    '(?<![\\p{L}])' +
    '(' + RANGE_CURRENCY + ')' +
    RANGE_SEPARATOR +
    NUMBER_WITH_MAGNITUDE +
    NOT_AFTER,
    'giu'
  );

  /**
   * « between 2000 and 3000 CNY », « entre 2000 et 3000 € ».
   * Groupes : 1 minimum, 2 maximum, 3 devise.
   */
  const PATTERN_RANGE_BETWEEN = new RegExp(
    '\\b(?:between|entre)\\s+' +
    NUMBER_WITH_MAGNITUDE +
    '\\s+(?:and|et)\\s+' +
    NUMBER_WITH_MAGNITUDE +
    '(?:' + SPACES + ')?' +
    '(?<![\\p{L}])' +
    '(' + RANGE_CURRENCY + ')' +
    NOT_AFTER,
    'giu'
  );

  /**
   * Format 6 : un NOMBRE EN LETTRES suivi du nom d'une devise.
   *   dix euros    ten dollars    vingt-cinq euros    cent livres sterling
   *
   * Groupe 1 : le nombre en lettres   Groupe 2 : le nom de la devise
   */
  const PATTERN_WORDS_AFTER = new RegExp(
    NOT_BEFORE +
    '(' + NUMBER_WORDS_PATTERN + ')' +
    // L'ESPACE EST OBLIGATOIRE. Sans elle, « unreal » etait lu comme
    // « un real » (1 real bresilien) : un mot anglais courant declenchait
    // une conversion. « dix euros » et « ten dollars » ont toujours un
    // espace, donc rien de valide n'est perdu.
    '(?:' + SPACES + '+)' +
    '(' + CURRENCY_WORDS.map(escapeForRegex).join('|') + ')' +
    '(?![\\p{L}\\d])',
    'giu'
  );

  // =========================================================================
  // =========================================================================
  //  2quater. FUSEAUX HORAIRES (module PUR : aucun acces au DOM)
  // =========================================================================
  //
  // BUT : « 14:30 CET » -> « 20:30 » dans la ville choisie par l'utilisateur.
  //
  // POURQUOI UN MODULE A PART, SANS DOM
  // -----------------------------------
  // Tout le calcul (lecture, conversion, decalage) est ecrit ici en fonctions
  // pures : pas de document, pas de bulle. tools/timezone-tests.mjs extrait ce
  // bloc entre les deux marqueurs et le rejoue hors navigateur, des centaines
  // de fois. C'est ce qui rend les formats verifiables.
  //
  // REGLE DE DETECTION
  // ------------------
  // Une heure n'est convertie QUE si un fuseau est ecrit juste a cote
  // (« 14:30 CET », « 14:30 heure de Paris », « 2026-10-24T14:30:00Z »).
  // Sans fuseau, « 14:30 » est ambigu : on ne touche a rien. C'est le meilleur
  // filtre a faux positifs — et c'est le sujet de la fonctionnalite.
  //
  // LANGUES : les abreviations sont sensibles a la casse (EST en majuscules,
  // pas le mot francais « est »). Les noms de villes acceptent les accents.
  //
  // >>> DEBUT MODULE FUSEAUX (extrait tel quel par tools/timezone-tests.mjs)

  /**
   * Decalages des abreviations de fuseau, en MINUTES.
   *
   * Le choix des abreviations ambigues est documente dans
   * docs/FUSEAUX-HORAIRES.md : IST = Inde (+5 h 30), CST = centre des
   * Etats-Unis (-6 h), AST = Atlantique (-4 h), BST = Royaume-Uni (+1 h).
   */
  const TZ_ABBREVIATIONS = {
    WET: 0, WEST: 60,
    CET: 60, CEST: 120,
    EET: 120, EEST: 180,
    BST: 60, IST: 330, MSK: 180,
    EST: -300, EDT: -240,
    CST: -360, CDT: -300,
    MST: -420, MDT: -360,
    PST: -480, PDT: -420,
    AKST: -540, AKDT: -480, HST: -600,
    AST: -240, ADT: -180, NST: -210, NDT: -150,
    BRT: -180, ART: -180, CLT: -240, COT: -300, PET: -300, VET: -240,
    WAT: 60, CAT: 120, EAT: 180, SAST: 120,
    JST: 540, KST: 540, HKT: 480, SGT: 480, PHT: 480,
    WIB: 420, ICT: 420, MYT: 480,
    AEST: 600, AEDT: 660, ACST: 570, ACDT: 630, AWST: 480,
    NZST: 720, NZDT: 780,
    GST: 240, PKT: 300, NPT: 345, LKT: 330, BDT: 360,
    IRST: 210, IRDT: 270
  };

  /**
   * Villes proposees dans le menu.
   *
   * « id » est un nom de fuseau IANA : c'est lui qui porte les regles d'heure
   * d'ete, mises a jour par le navigateur. « city » est le libelle affiche,
   * « country » sert au drapeau, « primary » place la ville dans la section
   * « Principales » du menu.
   */
  const TZ_CITIES = [
    // Europe
    { id: 'Europe/Paris', city: 'Paris', country: 'FR', region: 'Europe', primary: true },
    { id: 'Europe/London', city: 'Londres', country: 'GB', region: 'Europe', primary: true },
    { id: 'Europe/Lisbon', city: 'Lisbonne', country: 'PT', region: 'Europe' },
    { id: 'Europe/Madrid', city: 'Madrid', country: 'ES', region: 'Europe' },
    { id: 'Europe/Rome', city: 'Rome', country: 'IT', region: 'Europe' },
    { id: 'Europe/Berlin', city: 'Berlin', country: 'DE', region: 'Europe', primary: true },
    { id: 'Europe/Amsterdam', city: 'Amsterdam', country: 'NL', region: 'Europe' },
    { id: 'Europe/Brussels', city: 'Bruxelles', country: 'BE', region: 'Europe' },
    { id: 'Europe/Zurich', city: 'Geneve', country: 'CH', region: 'Europe' },
    { id: 'Europe/Vienna', city: 'Vienne', country: 'AT', region: 'Europe' },
    { id: 'Europe/Stockholm', city: 'Stockholm', country: 'SE', region: 'Europe' },
    { id: 'Europe/Oslo', city: 'Oslo', country: 'NO', region: 'Europe' },
    { id: 'Europe/Copenhagen', city: 'Copenhague', country: 'DK', region: 'Europe' },
    { id: 'Europe/Helsinki', city: 'Helsinki', country: 'FI', region: 'Europe' },
    { id: 'Europe/Warsaw', city: 'Varsovie', country: 'PL', region: 'Europe' },
    { id: 'Europe/Prague', city: 'Prague', country: 'CZ', region: 'Europe' },
    { id: 'Europe/Budapest', city: 'Budapest', country: 'HU', region: 'Europe' },
    { id: 'Europe/Athens', city: 'Athenes', country: 'GR', region: 'Europe' },
    { id: 'Europe/Bucharest', city: 'Bucarest', country: 'RO', region: 'Europe' },
    { id: 'Europe/Kyiv', city: 'Kyiv', country: 'UA', region: 'Europe' },
    { id: 'Europe/Istanbul', city: 'Istanbul', country: 'TR', region: 'Europe', primary: true },
    { id: 'Europe/Moscow', city: 'Moscou', country: 'RU', region: 'Europe', primary: true },
    { id: 'Europe/Dublin', city: 'Dublin', country: 'IE', region: 'Europe' },
    { id: 'Atlantic/Reykjavik', city: 'Reykjavik', country: 'IS', region: 'Europe' },
    { id: 'Europe/Belgrade', city: 'Belgrade', country: 'RS', region: 'Europe' },
    { id: 'Europe/Zagreb', city: 'Zagreb', country: 'HR', region: 'Europe' },
    { id: 'Europe/Sofia', city: 'Sofia', country: 'BG', region: 'Europe' },
    { id: 'Europe/Vilnius', city: 'Vilnius', country: 'LT', region: 'Europe' },
    { id: 'Europe/Riga', city: 'Riga', country: 'LV', region: 'Europe' },
    { id: 'Europe/Tallinn', city: 'Tallinn', country: 'EE', region: 'Europe' },
    { id: 'Europe/Luxembourg', city: 'Luxembourg', country: 'LU', region: 'Europe' },
    { id: 'Europe/Monaco', city: 'Monaco', country: 'MC', region: 'Europe' },
    { id: 'Europe/Malta', city: 'La Valette', country: 'MT', region: 'Europe' },
    { id: 'Europe/Sarajevo', city: 'Sarajevo', country: 'BA', region: 'Europe' },
    { id: 'Europe/Skopje', city: 'Skopje', country: 'MK', region: 'Europe' },
    { id: 'Europe/Tirane', city: 'Tirana', country: 'AL', region: 'Europe' },

    // Afrique
    { id: 'Africa/Casablanca', city: 'Casablanca', country: 'MA', region: 'Afrique', primary: true },
    { id: 'Africa/Algiers', city: 'Alger', country: 'DZ', region: 'Afrique' },
    { id: 'Africa/Tunis', city: 'Tunis', country: 'TN', region: 'Afrique' },
    { id: 'Africa/Cairo', city: 'Le Caire', country: 'EG', region: 'Afrique', primary: true },
    { id: 'Africa/Dakar', city: 'Dakar', country: 'SN', region: 'Afrique' },
    { id: 'Africa/Abidjan', city: 'Abidjan', country: 'CI', region: 'Afrique' },
    { id: 'Africa/Lagos', city: 'Lagos', country: 'NG', region: 'Afrique' },
    { id: 'Africa/Accra', city: 'Accra', country: 'GH', region: 'Afrique' },
    { id: 'Africa/Nairobi', city: 'Nairobi', country: 'KE', region: 'Afrique' },
    { id: 'Africa/Johannesburg', city: 'Johannesburg', country: 'ZA', region: 'Afrique' },
    { id: 'Africa/Addis_Ababa', city: 'Addis-Abeba', country: 'ET', region: 'Afrique' },
    { id: 'Africa/Kinshasa', city: 'Kinshasa', country: 'CD', region: 'Afrique' },
    { id: 'Africa/Tripoli', city: 'Tripoli', country: 'LY', region: 'Afrique' },
    { id: 'Africa/Douala', city: 'Douala', country: 'CM', region: 'Afrique' },
    { id: 'Africa/Khartoum', city: 'Khartoum', country: 'SD', region: 'Afrique' },
    { id: 'Africa/Luanda', city: 'Luanda', country: 'AO', region: 'Afrique' },
    { id: 'Africa/Maputo', city: 'Maputo', country: 'MZ', region: 'Afrique' },

    // Amerique du Nord et Caraibes
    { id: 'America/New_York', city: 'New York', country: 'US', region: 'Amerique du Nord', primary: true },
    { id: 'America/Chicago', city: 'Chicago', country: 'US', region: 'Amerique du Nord' },
    { id: 'America/Denver', city: 'Denver', country: 'US', region: 'Amerique du Nord' },
    { id: 'America/Phoenix', city: 'Phoenix', country: 'US', region: 'Amerique du Nord' },
    { id: 'America/Los_Angeles', city: 'Los Angeles', country: 'US', region: 'Amerique du Nord', primary: true },
    { id: 'America/Anchorage', city: 'Anchorage', country: 'US', region: 'Amerique du Nord' },
    { id: 'Pacific/Honolulu', city: 'Honolulu', country: 'US', region: 'Amerique du Nord' },
    { id: 'America/Toronto', city: 'Toronto', country: 'CA', region: 'Amerique du Nord', primary: true },
    { id: 'America/Vancouver', city: 'Vancouver', country: 'CA', region: 'Amerique du Nord' },
    { id: 'America/St_Johns', city: 'Saint-Jean', country: 'CA', region: 'Amerique du Nord' },
    { id: 'America/Regina', city: 'Regina', country: 'CA', region: 'Amerique du Nord' },
    { id: 'America/Mexico_City', city: 'Mexico', country: 'MX', region: 'Amerique du Nord', primary: true },
    { id: 'America/Havana', city: 'La Havane', country: 'CU', region: 'Amerique du Nord' },
    { id: 'America/Guatemala', city: 'Guatemala', country: 'GT', region: 'Amerique du Nord' },
    { id: 'America/Panama', city: 'Panama', country: 'PA', region: 'Amerique du Nord' },
    { id: 'America/Port-au-Prince', city: 'Port-au-Prince', country: 'HT', region: 'Amerique du Nord' },
    { id: 'America/Martinique', city: 'Fort-de-France', country: 'MQ', region: 'Amerique du Nord' },
    { id: 'America/Guadeloupe', city: 'Pointe-a-Pitre', country: 'GP', region: 'Amerique du Nord' },
    { id: 'America/Cayenne', city: 'Cayenne', country: 'GF', region: 'Amerique du Sud' },
    { id: 'America/Santo_Domingo', city: 'Saint-Domingue', country: 'DO', region: 'Amerique du Nord' },
    { id: 'America/Puerto_Rico', city: 'San Juan', country: 'PR', region: 'Amerique du Nord' },

    // Amerique du Sud
    { id: 'America/Bogota', city: 'Bogota', country: 'CO', region: 'Amerique du Sud' },
    { id: 'America/Lima', city: 'Lima', country: 'PE', region: 'Amerique du Sud' },
    { id: 'America/Santiago', city: 'Santiago', country: 'CL', region: 'Amerique du Sud' },
    { id: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires', country: 'AR', region: 'Amerique du Sud', primary: true },
    { id: 'America/Sao_Paulo', city: 'Sao Paulo', country: 'BR', region: 'Amerique du Sud', primary: true },
    { id: 'America/Caracas', city: 'Caracas', country: 'VE', region: 'Amerique du Sud' },
    { id: 'America/La_Paz', city: 'La Paz', country: 'BO', region: 'Amerique du Sud' },
    { id: 'America/Montevideo', city: 'Montevideo', country: 'UY', region: 'Amerique du Sud' },
    { id: 'America/Asuncion', city: 'Asuncion', country: 'PY', region: 'Amerique du Sud' },
    { id: 'America/Guayaquil', city: 'Quito', country: 'EC', region: 'Amerique du Sud' },

    // Asie
    { id: 'Asia/Tokyo', city: 'Tokyo', country: 'JP', region: 'Asie', primary: true },
    { id: 'Asia/Seoul', city: 'Seoul', country: 'KR', region: 'Asie' },
    { id: 'Asia/Shanghai', city: 'Shanghai', country: 'CN', region: 'Asie', primary: true },
    { id: 'Asia/Hong_Kong', city: 'Hong Kong', country: 'HK', region: 'Asie', primary: true },
    { id: 'Asia/Taipei', city: 'Taipei', country: 'TW', region: 'Asie' },
    { id: 'Asia/Singapore', city: 'Singapour', country: 'SG', region: 'Asie', primary: true },
    { id: 'Asia/Bangkok', city: 'Bangkok', country: 'TH', region: 'Asie' },
    { id: 'Asia/Jakarta', city: 'Jakarta', country: 'ID', region: 'Asie' },
    { id: 'Asia/Manila', city: 'Manille', country: 'PH', region: 'Asie' },
    { id: 'Asia/Kuala_Lumpur', city: 'Kuala Lumpur', country: 'MY', region: 'Asie' },
    { id: 'Asia/Ho_Chi_Minh', city: 'Ho Chi Minh-Ville', country: 'VN', region: 'Asie' },
    { id: 'Asia/Kolkata', city: 'Mumbai', country: 'IN', region: 'Asie', primary: true },
    { id: 'Asia/Karachi', city: 'Karachi', country: 'PK', region: 'Asie' },
    { id: 'Asia/Dhaka', city: 'Dacca', country: 'BD', region: 'Asie' },
    { id: 'Asia/Kathmandu', city: 'Katmandou', country: 'NP', region: 'Asie' },
    { id: 'Asia/Colombo', city: 'Colombo', country: 'LK', region: 'Asie' },
    { id: 'Asia/Dubai', city: 'Dubai', country: 'AE', region: 'Asie', primary: true },
    { id: 'Asia/Riyadh', city: 'Riyad', country: 'SA', region: 'Asie' },
    { id: 'Asia/Qatar', city: 'Doha', country: 'QA', region: 'Asie' },
    { id: 'Asia/Tehran', city: 'Teheran', country: 'IR', region: 'Asie' },
    { id: 'Asia/Baghdad', city: 'Bagdad', country: 'IQ', region: 'Asie' },
    { id: 'Asia/Jerusalem', city: 'Jerusalem', country: 'IL', region: 'Asie' },
    { id: 'Asia/Beirut', city: 'Beyrouth', country: 'LB', region: 'Asie' },
    { id: 'Asia/Amman', city: 'Amman', country: 'JO', region: 'Asie' },
    { id: 'Asia/Kuwait', city: 'Koweit', country: 'KW', region: 'Asie' },
    { id: 'Asia/Muscat', city: 'Mascate', country: 'OM', region: 'Asie' },
    { id: 'Asia/Baku', city: 'Bakou', country: 'AZ', region: 'Asie' },
    { id: 'Asia/Tbilisi', city: 'Tbilissi', country: 'GE', region: 'Asie' },
    { id: 'Asia/Yerevan', city: 'Erevan', country: 'AM', region: 'Asie' },
    { id: 'Asia/Almaty', city: 'Almaty', country: 'KZ', region: 'Asie' },
    { id: 'Asia/Tashkent', city: 'Tachkent', country: 'UZ', region: 'Asie' },
    { id: 'Asia/Ulaanbaatar', city: 'Oulan-Bator', country: 'MN', region: 'Asie' },
    { id: 'Asia/Yangon', city: 'Rangoun', country: 'MM', region: 'Asie' },
    { id: 'Asia/Kabul', city: 'Kaboul', country: 'AF', region: 'Asie' },

    // Oceanie
    { id: 'Australia/Sydney', city: 'Sydney', country: 'AU', region: 'Oceanie', primary: true },
    { id: 'Australia/Melbourne', city: 'Melbourne', country: 'AU', region: 'Oceanie' },
    { id: 'Australia/Brisbane', city: 'Brisbane', country: 'AU', region: 'Oceanie' },
    { id: 'Australia/Perth', city: 'Perth', country: 'AU', region: 'Oceanie' },
    { id: 'Australia/Adelaide', city: 'Adelaide', country: 'AU', region: 'Oceanie' },
    { id: 'Australia/Darwin', city: 'Darwin', country: 'AU', region: 'Oceanie' },
    { id: 'Pacific/Auckland', city: 'Auckland', country: 'NZ', region: 'Oceanie', primary: true },
    { id: 'Pacific/Fiji', city: 'Suva', country: 'FJ', region: 'Oceanie' },
    { id: 'Pacific/Noumea', city: 'Noumea', country: 'NC', region: 'Oceanie' },
    { id: 'Pacific/Tahiti', city: 'Papeete', country: 'PF', region: 'Oceanie' },
    { id: 'Pacific/Guam', city: 'Guam', country: 'GU', region: 'Oceanie' },
    { id: 'Pacific/Port_Moresby', city: 'Port Moresby', country: 'PG', region: 'Oceanie' },
    { id: 'Pacific/Apia', city: 'Apia', country: 'WS', region: 'Oceanie' },
    { id: 'Pacific/Tongatapu', city: 'Nuku\'alofa', country: 'TO', region: 'Oceanie' }
  ];

  /** Retrouve une ville par son fuseau IANA. */
  const TZ_CITY_BY_ID = new Map(TZ_CITIES.map(function (entry) {
    return [entry.id, entry];
  }));

  /**
   * Noms de lieux acceptes dans « heure de … » et « … time ».
   *
   * Les noms de villes viennent de TZ_CITIES ; on ajoute les expressions
   * courantes (« heure de l'Est », « Pacific Time »...), les noms anglais des
   * grandes villes, et UTC/GMT.
   */
  const TZ_PLACE_ALIASES = {
    'new york': 'America/New_York',
    'los angeles': 'America/Los_Angeles',
    londres: 'Europe/London', london: 'Europe/London',
    'le caire': 'Africa/Cairo',
    pekin: 'Asia/Shanghai', 'pékin': 'Asia/Shanghai',
    beijing: 'Asia/Shanghai', shanghai: 'Asia/Shanghai',
    'sao paulo': 'America/Sao_Paulo', 'são paulo': 'America/Sao_Paulo',
    moscou: 'Europe/Moscow', moscow: 'Europe/Moscow',
    'ho chi minh-ville': 'Asia/Ho_Chi_Minh',
    'kuala lumpur': 'Asia/Kuala_Lumpur',
    'hong kong': 'Asia/Hong_Kong',
    'new delhi': 'Asia/Kolkata', delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata',
    bangalore: 'Asia/Kolkata',
    'buenos aires': 'America/Argentina/Buenos_Aires',
    'saint-jean': 'America/St_Johns',
    'la havane': 'America/Havana', havana: 'America/Havana',
    'la valette': 'Europe/Malta',
    'addis-abeba': 'Africa/Addis_Ababa',
    // Expressions de fuseaux (surtout Etats-Unis / France)
    pacifique: 'America/Los_Angeles', pacific: 'America/Los_Angeles',
    est: 'America/New_York', eastern: 'America/New_York',
    centre: 'America/Chicago', central: 'America/Chicago',
    rocheuses: 'America/Denver', montagnes: 'America/Denver',
    mountain: 'America/Denver',
    hawaii: 'Pacific/Honolulu', 'hawaï': 'Pacific/Honolulu',
    alaska: 'America/Anchorage',
    atlantique: 'America/Halifax', atlantic: 'America/Halifax',
    utc: { fixed: 0 }, gmt: { fixed: 0 }, zulu: { fixed: 0 }
  };

  /** Tous les lieux acceptes : villes + expressions. */
  const TZ_PLACES = (function () {
    const places = {};
    for (const entry of TZ_CITIES) {
      places[entry.city.toLowerCase()] = entry.id;
    }
    for (const name of Object.keys(TZ_PLACE_ALIASES)) {
      places[name] = TZ_PLACE_ALIASES[name];
    }
    return places;
  })();

  /** Echappe un texte pour l'utiliser dans une expression reguliere. */
  function tzEscape(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Alternative « Paris|Londres|... », du plus long au plus court. */
  const TZ_PLACES_PATTERN = Object.keys(TZ_PLACES)
    .sort(function (a, b) { return b.length - a.length; })
    .map(tzEscape)
    .join('|');

  /**
   * Expression des formules « heure de Paris », « heure du Pacifique »,
   * « Paris time », « Pacific Time ».
   *
   * Construite UNE seule fois : la reconstruire a chaque survol coutait cher
   * (alternance de 150 noms de lieux).
   */
  const TZ_PHRASE_REGEX = new RegExp(
    '^[ \\u00A0]*,?[ \\u00A0]*(?:' +
      'heure[s]?(?:[ \\u00A0]+locale)?[ \\u00A0]+(?:de|du|des|d[\\u2019\'])[ \\u00A0]*(?:l[\\u2019\'])?[ \\u00A0]*(' + TZ_PLACES_PATTERN + ')' +
      '|(' + TZ_PLACES_PATTERN + ')[ \\u00A0]+[Tt]ime' +
    ')',
    'i'
  );

  /** Vrai si Intl connait ce fuseau IANA (reponse mise en cache). */
  const tzIanaCache = new Map();
  function tzIsIana(name) {
    if (tzIanaCache.has(name)) {
      return tzIanaCache.get(name);
    }
    let known = false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: name }).format(new Date(0));
      known = true;
    } catch (error) {
      known = false;
    }
    tzIanaCache.set(name, known);
    return known;
  }

  /** Construit un fuseau fixe (UTC+2, CET...). */
  function tzFixedZone(minutes, label) {
    return { iana: null, fixedMinutes: minutes, label: label || null };
  }

  /** Construit un fuseau IANA. */
  function tzIanaZone(id) {
    return { iana: id, fixedMinutes: null, label: null };
  }

  /** Fuseau local du navigateur, en IANA (calcule une seule fois). */
  let tzLocalZoneCache = null;

  function tzLocalZoneId() {
    if (tzLocalZoneCache !== null) {
      return tzLocalZoneCache;
    }
    try {
      tzLocalZoneCache = new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (error) {
      tzLocalZoneCache = 'UTC';
    }
    return tzLocalZoneCache;
  }

  /** Lit un identifiant de fuseau (IANA ou « UTC+2 »). */
  function tzZoneFromId(id) {
    const text = String(id || '').trim();
    if (!text) {
      return tzIanaZone(tzLocalZoneId());
    }
    const offset = /^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(text);
    if (offset) {
      const sign = offset[1] === '-' ? -1 : 1;
      const minutes = sign * (Number(offset[2]) * 60 + Number(offset[3] || 0));
      return tzFixedZone(minutes, text.toUpperCase());
    }
    if (/^(?:UTC|GMT|Z)$/i.test(text)) {
      return tzFixedZone(0, 'UTC');
    }
    if (tzIsIana(text)) {
      return tzIanaZone(text);
    }
    return tzIanaZone(tzLocalZoneId());
  }

  /**
   * Cache des formateurs de fuseau.
   *
   * POURQUOI : une seule conversion en creait QUATRE (deux pour le decalage,
   * deux pour les dates), et creer un Intl.DateTimeFormat coute cher. Avec le
   * cache, une conversion ne cree plus rien apres le premier affichage.
   */
  const tzFormatterCache = new Map();

  // Le menu des villes calcule le decalage des 132 villes : sans borne, il
  // retenait 132 objets Intl.DateTimeFormat pour toute la duree de l'onglet.
  // 32 suffisent largement (les conversions courantes + le menu).
  const TZ_FORMATTER_CACHE_LIMIT = 32;

  function tzFormatter(zone, kind) {
    const key = `${zone.iana}|${kind}`;
    let formatter = tzFormatterCache.get(key);
    if (!formatter) {
      formatter = kind === 'offset'
        ? new Intl.DateTimeFormat('en-US', {
            timeZone: zone.iana,
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })
        : new Intl.DateTimeFormat('en-US', {
            timeZone: zone.iana,
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          });
      tzFormatterCache.set(key, formatter);

      if (tzFormatterCache.size > TZ_FORMATTER_CACHE_LIMIT) {
        const oldestKey = tzFormatterCache.keys().next().value;
        tzFormatterCache.delete(oldestKey);
      }
    }
    return formatter;
  }

  /** Decalage du fuseau par rapport a UTC, en minutes, a un instant donne. */
  function tzOffsetMinutesAt(zone, instantMs) {
    if (typeof zone.fixedMinutes === 'number') {
      return zone.fixedMinutes;
    }

    const whole = Math.floor(instantMs / 1000) * 1000;
    const formatter = tzFormatter(zone, 'offset');

    const parts = {};
    for (const part of formatter.formatToParts(new Date(whole))) {
      if (part.type !== 'literal') {
        parts[part.type] = part.value;
      }
    }

    // Intl peut rendre « 24 » pour minuit : on ramene a 0.
    const hour = Number(parts.hour) % 24;
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      hour, Number(parts.minute), Number(parts.second)
    );

    return Math.round((asUtc - whole) / 60000);
  }

  /** Date et heure LOCALES dans un fuseau, a un instant donne. */
  function tzPartsAt(zone, instantMs) {
    if (typeof zone.fixedMinutes === 'number') {
      const shifted = new Date(instantMs + zone.fixedMinutes * 60000);
      return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes()
      };
    }

    const formatter = tzFormatter(zone, 'parts');

    const parts = {};
    for (const part of formatter.formatToParts(new Date(instantMs))) {
      if (part.type !== 'literal') {
        parts[part.type] = part.value;
      }
    }

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour) % 24,
      minute: Number(parts.minute)
    };
  }

  /**
   * Transforme une heure LOCALE d'un fuseau en instant absolu (millisecondes).
   *
   * Methode : on suppose d'abord que l'heure est en UTC, on regarde le decalage
   * reel a cet instant, on corrige, puis on verifie une seconde fois (le
   * decalage peut changer a la frontiere de l'heure d'ete).
   */
  function tzZonedToInstant(parts, zone) {
    const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);

    if (typeof zone.fixedMinutes === 'number') {
      return guess - zone.fixedMinutes * 60000;
    }

    const first = tzOffsetMinutesAt(zone, guess);
    let instant = guess - first * 60000;
    const second = tzOffsetMinutesAt(zone, instant);
    if (second !== first) {
      instant = guess - second * 60000;
    }
    return instant;
  }

  /** Lit le fuseau ecrit juste apres une heure. Rend { zone, length } ou null. */
  function tzZoneAfter(suffix) {
    let match;

    // 1. UTC+2, GMT-05:00, UTC+0530.
    match = /^[ \u00A0]*,?[ \u00A0]*(UTC|GMT)[ \u00A0]*([+-])[ \u00A0]*(\d{1,2})(?:[:.][ \u00A0]?(\d{2}))?/i.exec(suffix);
    if (match) {
      const hours = Number(match[3]);
      const minutes = Number(match[4] || 0);
      if (hours <= 14 && minutes <= 59) {
        const sign = match[2] === '-' ? -1 : 1;
        const total = sign * (hours * 60 + minutes);
        return {
          zone: tzFixedZone(total, `UTC${match[2]}${hours}${minutes ? ':' + String(minutes).padStart(2, '0') : ''}`),
          length: match[0].length
        };
      }
      return null;
    }

    // 2. UTC ou GMT seul.
    match = /^[ \u00A0]*,?[ \u00A0]*(UTC|GMT)(?![A-Za-z])/i.exec(suffix);
    if (match) {
      return { zone: tzFixedZone(0, 'UTC'), length: match[0].length };
    }

    // 3. Z colle (forme ISO, journaux, horodatages).
    match = /^[ \u00A0]*Z(?![A-Za-z])/.exec(suffix);
    if (match) {
      return { zone: tzFixedZone(0, 'UTC'), length: match[0].length };
    }

    // 4. Decalage ISO : +02:00, -0500, +02.
    match = /^[ \u00A0]*([+-])(\d{2})(?::?(\d{2}))?(?![0-9])/.exec(suffix);
    if (match) {
      const hours = Number(match[2]);
      const minutes = Number(match[3] || 0);
      if (hours <= 14 && minutes <= 59) {
        const sign = match[1] === '-' ? -1 : 1;
        const total = sign * (hours * 60 + minutes);
        return {
          zone: tzFixedZone(total, `UTC${match[1]}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`),
          length: match[0].length
        };
      }
      return null;
    }

    // 5. Nom IANA : Europe/Paris.
    match = /^[ \u00A0]*([A-Za-z][A-Za-z0-9_+-]*\/[A-Za-z][A-Za-z0-9_+-]*)(?![A-Za-z0-9_+/-])/.exec(suffix);
    if (match && tzIsIana(match[1])) {
      return { zone: tzIanaZone(match[1]), length: match[0].length };
    }

    // 6. Abreviation EN MAJUSCULES (EST, CET...). La casse compte : le mot
    //    francais « est » ne doit jamais etre pris pour Eastern Standard Time.
    match = /^[ \u00A0]*([A-Z]{2,5})(?![A-Za-z])/.exec(suffix);
    if (match && Object.prototype.hasOwnProperty.call(TZ_ABBREVIATIONS, match[1])) {
      return {
        zone: tzFixedZone(TZ_ABBREVIATIONS[match[1]], match[1]),
        length: match[0].length
      };
    }

    // 7. Expressions : « heure de Paris », « heure du Pacifique »,
    //    « heure de l'Est », « Paris time », « Pacific Time ».
    match = TZ_PHRASE_REGEX.exec(suffix);

    if (match) {
      const place = (match[1] || match[2] || '').toLowerCase();
      const target = TZ_PLACES[place];

      if (target && typeof target === 'object' && typeof target.fixed === 'number') {
        return { zone: tzFixedZone(target.fixed, 'UTC'), length: match[0].length };
      }
      if (typeof target === 'string') {
        return { zone: tzIanaZone(target), length: match[0].length };
      }
    }

    return null;
  }

  /** Vrai si l'heure est plausible (0-24 h, minutes 0-59). */
  function tzValidClock(hour, minute) {
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return false;
    }
    if (hour < 0 || hour > 24 || minute < 0 || minute > 59) {
      return false;
    }
    return !(hour === 24 && minute !== 0);
  }

  /**
   * Cherche toutes les heures PORTEUSES D'UN FUSEAU dans un texte.
   *
   * @param {string} text
   * @returns {Array<object>} detections avec start, end, hour, minute, zone, date
   */
  function tzFindTimes(text) {
    const found = [];
    const taken = [];

    function isFree(start, end) {
      return !taken.some(function (range) {
        return start < range[1] && end > range[0];
      });
    }

    function push(start, end, hour, minute, zone, date) {
      if (hour < 0 || hour > 24 || minute < 0 || minute > 59) {
        return;
      }
      if (hour === 24 && minute !== 0) {
        return;
      }
      if (!isFree(start, end)) {
        return;
      }
      taken.push([start, end]);
      found.push({
        start: start,
        end: end,
        text: text.slice(start, end),
        hour: hour,
        minute: minute,
        zone: zone,
        date: date || null,
        kind: 'time'
      });
    }

    // 1. ISO 8601 : 2026-10-24T14:30:00Z, 2026-10-24T14:30+02:00.
    const iso = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:[.,]\d{1,6})?[ \u00A0]*(Z|[+-]\d{2}:?\d{2})/g;
    let match;
    while ((match = iso.exec(text)) !== null) {
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      if (!tzValidClock(hour, minute)) {
        continue;
      }
      const zoneText = match[7];
      let zone = null;
      if (/^Z$/i.test(zoneText)) {
        zone = tzFixedZone(0, 'UTC');
      } else {
        const offset = /^([+-])(\d{2}):?(\d{2})$/.exec(zoneText);
        if (offset) {
          const sign = offset[1] === '-' ? -1 : 1;
          zone = tzFixedZone(sign * (Number(offset[2]) * 60 + Number(offset[3])), zoneText);
        }
      }
      if (!zone) {
        continue;
      }
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        continue;
      }
      push(match.index, match.index + match[0].length, hour, minute, zone, {
        year: Number(match[1]), month: month, day: day
      });
    }

    // 2. RFC 2822 : Sat, 24 Oct 2026 14:30:00 +0200.
    const rfcMonths = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };
    const rfc = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),[ \u00A0]+(\d{1,2})[ \u00A0]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ \u00A0]+(\d{4})[ \u00A0]+(\d{2}):(\d{2})(?::(\d{2}))?[ \u00A0]+(Z|[+-]\d{4})\b/g;
    while ((match = rfc.exec(text)) !== null) {
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      if (!tzValidClock(hour, minute)) {
        continue;
      }
      const zoneText = match[7];
      let zone = null;
      if (/^Z$/i.test(zoneText)) {
        zone = tzFixedZone(0, 'UTC');
      } else {
        const offset = /^([+-])(\d{2})(\d{2})$/.exec(zoneText);
        if (offset) {
          const sign = offset[1] === '-' ? -1 : 1;
          zone = tzFixedZone(sign * (Number(offset[2]) * 60 + Number(offset[3])), zoneText);
        }
      }
      if (!zone) {
        continue;
      }
      push(match.index, match.index + match[0].length, hour, minute, zone, {
        year: Number(match[3]),
        month: rfcMonths[match[2].toLowerCase()],
        day: Number(match[1])
      });
    }

    // 3. Heure suivie d'un fuseau.

    // 3a. 12 heures : 2:30 PM, 11 am.
    const twelve = /(?<![\d.:,])(\d{1,2})(?:[ \u00A0]*[:h.][ \u00A0]*(\d{2}))?[ \u00A0]*(am|pm|a\.m\.|p\.m\.)(?![a-z])/gi;
    while ((match = twelve.exec(text)) !== null) {
      let hour = Number(match[1]);
      const minute = match[2] === undefined ? 0 : Number(match[2]);
      if (hour < 1 || hour > 12 || minute > 59) {
        continue;
      }
      const suffix = text.slice(match.index + match[0].length, match.index + match[0].length + 60);
      const zoneInfo = tzZoneAfter(suffix);
      if (!zoneInfo) {
        continue;
      }
      const isPm = /^p/i.test(match[3].replace(/\./g, ''));
      hour = hour % 12 + (isPm ? 12 : 0);
      push(match.index, match.index + match[0].length + zoneInfo.length, hour, minute, zoneInfo.zone, null);
    }

    // 3b. 24 heures : 14:30, 14h30, 14 h 30, 14h, 14:30:15.
    const clock = /(?<![\d.:,])(\d{1,2})[ \u00A0]*(?:[:h][ \u00A0]*(\d{2})(?:[ \u00A0]*[:.][ \u00A0]*(\d{2}))?|[hH](?![a-zA-Z]))/g;
    while ((match = clock.exec(text)) !== null) {
      const hour = Number(match[1]);
      const minute = match[2] === undefined ? 0 : Number(match[2]);
      if (!tzValidClock(hour, minute)) {
        continue;
      }
      const suffix = text.slice(match.index + match[0].length, match.index + match[0].length + 60);
      const zoneInfo = tzZoneAfter(suffix);
      if (!zoneInfo) {
        continue;
      }
      push(match.index, match.index + match[0].length + zoneInfo.length, hour, minute, zoneInfo.zone, null);
    }

    found.sort(function (a, b) { return a.start - b.start; });
    return found;
  }

  /** Nom lisible d'un fuseau cible. */
  function tzZoneName(zone) {
    if (zone.fixedMinutes !== null && zone.fixedMinutes !== undefined) {
      return zone.label || 'UTC';
    }
    const entry = TZ_CITY_BY_ID.get(zone.iana);
    return entry ? entry.city : zone.iana;
  }

  /**
   * Convertit une heure detectee vers un fuseau cible.
   *
   * @param {object} detection - sortie de tzFindTimes
   * @param {object} targetZone - { iana } ou { fixedMinutes }
   * @param {number} nowMs - instant de reference (la date du jour)
   * @returns {object} { instant, sourceParts, targetParts, offsetDiffMinutes, shiftDays }
   */
  function tzConvert(detection, targetZone, nowMs) {
    const sourceZone = detection.zone;
    const base = detection.date || tzPartsAt(sourceZone, nowMs);

    const instant = tzZonedToInstant({
      year: base.year,
      month: base.month,
      day: base.day,
      hour: detection.hour,
      minute: detection.minute
    }, sourceZone);

    const sourceParts = tzPartsAt(sourceZone, instant);
    const targetParts = tzPartsAt(targetZone, instant);
    const sourceOffset = tzOffsetMinutesAt(sourceZone, instant);
    const targetOffset = tzOffsetMinutesAt(targetZone, instant);

    const sourceDay = Date.UTC(sourceParts.year, sourceParts.month - 1, sourceParts.day);
    const targetDay = Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day);

    return {
      instant: instant,
      sourceParts: sourceParts,
      targetParts: targetParts,
      offsetDiffMinutes: targetOffset - sourceOffset,
      shiftDays: Math.round((targetDay - sourceDay) / 86400000)
    };
  }

  /** Formate une heure (deja decoupee) en 24 h ou 12 h. */
  function tzFormatClock(parts, hour12) {
    if (hour12) {
      const suffix = parts.hour >= 12 ? 'PM' : 'AM';
      let hour = parts.hour % 12;
      if (hour === 0) {
        hour = 12;
      }
      return `${hour}:${String(parts.minute).padStart(2, '0')} ${suffix}`;
    }
    return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  }

  /** « +6 h », « −3 h 30 », « même heure ». */
  function tzFormatOffsetDiff(minutes) {
    if (minutes === 0) {
      return 'meme heure';
    }
    const sign = minutes > 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const hours = Math.floor(abs / 60);
    const rest = abs % 60;
    if (rest === 0) {
      return `${sign}${hours} h`;
    }
    return `${sign}${hours} h ${String(rest).padStart(2, '0')}`;
  }

  /**
   * Decalage d'un fuseau, facon « GMT+2 ».
   *
   *  0        -> « GMT »
   *  +120     -> « GMT+2 »
   *  -300     -> « GMT-5 »
   *  +330     -> « GMT+5:30 » (Inde)
   *  +345     -> « GMT+5:45 » (Nepal)
   *
   * C'est le format demande pour le menu des villes : plus parlant que
   * l'identifiant IANA (« Europe/Paris ») pour savoir s'il est tot ou tard.
   */
  function tzFormatGmtOffset(minutes) {
    const total = Number(minutes) || 0;
    if (total === 0) {
      return 'GMT';
    }
    const sign = total > 0 ? '+' : '-';
    const abs = Math.abs(total);
    const hours = Math.floor(abs / 60);
    const rest = abs % 60;
    if (rest === 0) {
      return `GMT${sign}${hours}`;
    }
    return `GMT${sign}${hours}:${String(rest).padStart(2, '0')}`;
  }

  /** « le lendemain », « la veille », ou vide. */
  function tzShiftLabel(days) {
    if (days === 1) {
      return 'le lendemain';
    }
    if (days === -1) {
      return 'la veille';
    }
    if (days !== 0) {
      return `${days > 0 ? '+' : '-'}${Math.abs(days)} jours`;
    }
    return '';
  }

  /**
   * Contenu de la bulle pour une heure detectee.
   *
   * @param {object} detection
   * @param {object} targetZone
   * @param {boolean} hour12
   * @param {number} [nowMs] - instant de reference (tests)
   */
  function tzBuildContent(detection, targetZone, hour12, nowMs) {
    if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
      throw new Error('tzBuildContent : instant de reference manquant');
    }
    const conversion = tzConvert(detection, targetZone, nowMs);

    const clock = tzFormatClock(conversion.targetParts, hour12 === true);
    const targetName = tzZoneName(targetZone);
    const targetIsCity = Boolean(targetZone && targetZone.iana && TZ_CITY_BY_ID.has(targetZone.iana));

    // Premiere ligne plus CLAIRE : « 14h30 à Paris » (24 h) ou
    // « 2:30 PM à Paris » (12 h). Le « h » remplace les deux-points, comme
    // on ecrit une heure en francais. Pour un fuseau fixe (« UTC »), « à »
    // serait bancal : on affiche « 13h30 UTC ».
    const clockLabel = hour12 === true ? clock : clock.replace(':', 'h');
    const main = targetIsCity
      ? `${clockLabel} à ${targetName}`
      : `${clockLabel} ${targetName}`;

    const diff = tzFormatOffsetDiff(conversion.offsetDiffMinutes);
    const shift = tzShiftLabel(conversion.shiftDays);

    // La cible est deja dans la premiere ligne : le detail ne la repete pas.
    // Il garde l'heure source, le decalage et le changement de jour.
    const detail = [
      detection.text.trim(),
      diff,
      shift
    ].filter(Boolean).join(' · ');

    return { main: main, detail: detail };
  }

  /** Vrai si le navigateur affiche les heures en 12 h (calcule une fois). */
  let tzUses12HourCache = null;

  function tzBrowserUses12Hour() {
    if (tzUses12HourCache !== null) {
      return tzUses12HourCache;
    }
    try {
      const resolved = new Intl.DateTimeFormat().resolvedOptions();
      if (typeof resolved.hour12 === 'boolean') {
        tzUses12HourCache = resolved.hour12;
      } else {
        const formatted = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
          .format(new Date(2020, 0, 1, 13, 0));
        tzUses12HourCache = /[ap]\.?m/i.test(formatted);
      }
    } catch (error) {
      tzUses12HourCache = false;
    }
    return tzUses12HourCache;
  }

  // <<< FIN MODULE FUSEAUX

  //  3. ETAT INTERNE
  // =========================================================================

  /**
   * Liste associative reliant chaque morceau de texte de la page (un « nœud de
   * texte ») a la liste des montants qu'il contient.
   *
   * « WeakMap » plutot qu'un objet normal : le navigateur peut liberer la
   * memoire des elements supprimes. Une WeakMap ne permet PAS d'etre parcourue
   * (elle n'a que get, set, has et delete) : une version precedente l'a
   * appris a ses depens en appelant forEach dessus.
   */
  const foundByNode = new WeakMap();

  /** Unites de mesure detectees, reliees a leur nœud de texte (parallele a foundByNode). */
  const unitByNode = new WeakMap();

  /** Heures avec fuseau detectees, reliees a leur nœud de texte (iteration 11). */
  const timeByNode = new WeakMap();

  /**
   * Nœuds de texte portant AU MOINS une detection (devise, unite ou heure).
   *
   * POURQUOI : sans cet ensemble, chaque mouvement de souris declenchait un
   * test de position (caretPositionFromPoint) puis, en cas d'echec, un test
   * spatial (elementsFromPoint + parcours du DOM) — les operations les plus
   * cheres du survol, meme sur une page qui ne contient aucun montant.
   * Si l'ensemble est vide, il n'y a rien a trouver : on ne fait rien.
   */
  const indexedNodes = new Set();

  /**
   * Montants portes par une IMAGE, via ses attributs (alt, title, aria-label).
   *
   * POURQUOI CE N'EST PAS DE L'OCR
   * ------------------------------
   * Beaucoup d'images n'ont pas de texte visible, mais portent une description
   * ecrite dans le HTML : <img alt="iPhone 15 a 999 EUR">. Ce texte-la est du
   * VRAI texte, lisible sans analyse d'image. On le convertit donc
   * gratuitement.
   *
   * Une image dont le prix est DESSINE dans les pixels reste invisible : cela
   * demandera un moteur d'OCR (iterations 9 et 10).
   */
  const imageAmounts = new WeakMap();

  /** Attributs d'image analyses, par ordre de fiabilite. */
  const IMAGE_AMOUNT_ATTRIBUTES = ['alt', 'aria-label', 'title'];

  /** Liste des elements d'image porteurs d'un montant (pour le surlignage). */
  const scannedImages = new Set();

  /** Liste des nœuds analyses, pour pouvoir les parcourir lors du surlignage. */
  const scannedNodes = new Set();

  /** Element HTML de la bulle, cree au demarrage. */
  let tooltipElement = null;

  /** Signature du montant affiche, pour detecter un CHANGEMENT de montant. */
  let currentSignature = null;

  /** Date du dernier survol traite (voir HOVER_THROTTLE_MS). */
  let lastHoverCheck = 0;

  /** Indique qu'un traitement de survol est deja en attente. */
  let framePending = false;

  /** Vrai quand la souris est SUR la bulle elle-meme (pour ne pas la masquer
   *  pendant que l'utilisateur manipule le menu deroulant). */
  let isTooltipHovered = false;

  /**
   * Cache des conversions deja obtenues, pour ne pas redemander la meme chose
   * a chaque mouvement de souris.
   *
   * Cle : « EUR|USD ». Valeur : la reponse complete de l'arriere-plan.
   */
  const conversionCache = new Map();

  /** Numero de la derniere demande de conversion (voir requestConversion). */
  let conversionRequestId = 0;

  /**
   * Systeme d'unites cible : « metric » ou « imperial ».
   * Defaut : metrique. L'iteration 8 permettra de le regler dans les options.
   */
  let targetSystem = 'metric';

  /**
   * Charge la preference de systeme d'unites depuis le stockage, puis ecoute
   * ses changements (le popup peut la modifier a tout moment).
   *
   * Le stockage n'existe pas dans tous les contextes (tests, iframes) : on
   * garde alors la valeur par defaut « metric ».
   */
  function loadUnitSystemPreference() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }

      chrome.storage.local.get('uniconv.unitSystem', function (result) {
        if (chrome.runtime.lastError) {
          return;
        }
        const value = result && result['uniconv.unitSystem'];
        if (value === 'metric' || value === 'imperial') {
          targetSystem = value;
        }
      });

      if (chrome.storage.onChanged && chrome.storage.onChanged.addListener) {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area === 'local' && changes['uniconv.unitSystem']) {
            const next = changes['uniconv.unitSystem'].newValue;
            if (next === 'metric' || next === 'imperial') {
              targetSystem = next;
            }
          }
        });
      }
    } catch (error) {
      // Le stockage n'est pas disponible : on reste en metrique.
    }
  }

  /**
   * Derniere position connue de la souris.
   *
   * Elle sert a repositionner la bulle quand son texte s'allonge : la reponse
   * de conversion est souvent plus longue que « conversion... », et sans ce
   * repositionnement la bulle pourrait depasser du bord de l'ecran.
   */
  let lastTooltipPosition = null;

  // =========================================================================
  //  4. DETECTION DES MONTANTS
  // =========================================================================

  /**
   * Retrouve l'objet devise correspondant a un symbole ou a un code.
   *
   * @param {string} token - « € », « $ », « EUR », « USD »...
   * @returns {object|null} la devise, ou null si inconnue
   */
  function resolveCurrency(token) {
    if (!token) {
      return null;
    }

    // 1. Le mot (« dollars », « Dollars », « livres sterling »...).
    //    La table est en minuscules ; selon la casse du texte, on essaie les
    //    deux formes.
    const byName = CURRENCY_BY_NAME.get(token) ||
      CURRENCY_BY_NAME.get(String(token).toLowerCase());
    if (byName) {
      return CURRENCY_BY_CODE.get(byName);
    }

    // 2. Le code ISO exact, ou un alias courant (RMB/CNH -> CNY).
    const upper = token.toUpperCase();
    const alias = CURRENCY_ALIASES.get(upper);
    if (alias) {
      return CURRENCY_BY_CODE.get(alias);
    }
    const byCode = CURRENCY_BY_CODE.get(upper);
    if (byCode) {
      return byCode;
    }

    // 3. Le symbole. En cas de symbole ambigu, on prend la premiere devise
    //    declaree (USD pour « $ », GBP pour « £ », JPY pour « ¥ »).
    const codes = CURRENCY_BY_SYMBOL.get(token);
    if (codes && codes.length > 0) {
      return CURRENCY_BY_CODE.get(codes[0]);
    }

    return null;
  }

  /**
   * Transforme un NOMBRE EN LETTRES en nombre calculable.
   *
   * Exemples :
   *   « dix »             -> 10
   *   « vingt-cinq »      -> 25
   *   « cent cinquante »  -> 150
   *   « deux mille »      -> 2000
   *   « un million »      -> 1000000
   *   « ten dollars »     -> 10 (on ne lit que la partie nombre)
   *
   * Algorithme classique : on parcourt les mots de gauche a droite, on
   * additionne les unites/dizaines, et des qu'on rencontre un multiplicateur
   * (cent, mille, million...), on multiplie la somme partielle par celui-ci.
   *
   * @param {string} raw - la phrase a analyser
   * @returns {number|null} le nombre, ou null si illisible
   */
  function parseNumberWords(raw) {
    if (!raw) {
      return null;
    }

    // On normalise : minuscules, traits d'union -> espaces, apostrophes.
    const normalized = String(raw)
      .toLowerCase()
      .replace(/[\u2019']/gu, ' ')
      .replace(/[-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized === '') {
      return null;
    }

    const words = normalized.split(' ').filter((word) => word !== '');

    let total = 0;      // le resultat accumule
    let current = 0;    // la somme partielle depuis le dernier multiplicateur

    for (const word of words) {
      // Mots de liaison : on les ignore.
      if (NUMBER_WORD_FILLERS.has(word)) {
        continue;
      }

      // Unite ou dizaine : on l'ajoute a la somme partielle.
      if (Object.prototype.hasOwnProperty.call(NUMBER_WORD_UNITS, word)) {
        current += NUMBER_WORD_UNITS[word];
        continue;
      }

      // Centaine : regle double.
      if (Object.prototype.hasOwnProperty.call(NUMBER_WORD_HUNDREDS, word)) {
        if (current === 0) {
          // « cent cinquante » : 100 + cinquante
          current = NUMBER_WORD_HUNDREDS[word];
        } else {
          // « deux cents » : deux x 100
          total += current * NUMBER_WORD_HUNDREDS[word];
          current = 0;
        }
        continue;
      }

      // Multiplicateur : on multiplie la somme partielle, puis on l'accumule.
      if (Object.prototype.hasOwnProperty.call(NUMBER_WORD_SCALES, word)) {
        const scale = NUMBER_WORD_SCALES[word];
        if (current === 0) {
          current = 1; // « mille euros » = 1 mille = 1000
        }
        total += current * scale;
        current = 0;
        continue;
      }

      // Mot inconnu : le texte n'est pas un nombre en lettres propre.
      return null;
    }

    const result = total + current;
    return Number.isFinite(result) && result > 0 ? result : null;
  }

  /**
   * Transforme un nombre ecrit en texte en nombre calculable.
   *
   * Deux systemes coexistent sur le web :
   *   francais : 1 234,56   -> 1234.56   (virgule = decimale)
   *   anglais  : 1,234.56   -> 1234.56   (point = decimale)
   *
   * La methode employee est volontairement simple et robuste :
   *   1. on supprime tous les espaces et apostrophes ;
   *   2. si la chaine contient un point ET une virgule, le dernier des deux est
   *      le separateur decimal, l'autre est un separateur de milliers ;
   *   3. s'il n'y a qu'un seul separateur, il est decimal s'il est suivi de
   *      1 ou 2 chiffres, et de milliers s'il est suivi de 3 chiffres.
   *
   * @param {string} raw - le nombre tel qu'il apparait sur la page
   * @returns {number|null} le nombre, ou null si illisible
   */
  function parseAmount(raw) {
    if (!raw) {
      return null;
    }

    // Ordre de grandeur : « 13K », « 1.2 M », « 3B », « 480 billion »,
    // « 480 milliards », « 480bn ». Le motif est repete ici (et non dans un
    // helper externe) pour que les tests qui extraient parseAmount seul
    // puissent l'executer.
    let numeric = String(raw).trim();
    let factor = 1;

    const wordMagnitude = /(thousands?|millions?|billions?|trillions?|milliers?|milliards?)\s*$/iu.exec(numeric);
    if (wordMagnitude) {
      const word = wordMagnitude[1].toLowerCase();
      factor *= word.indexOf('trillion') === 0
        ? 1e12
        : (word.indexOf('billion') === 0 || word.indexOf('milliard') === 0
          ? 1e9
          : (word.indexOf('million') === 0 ? 1e6 : 1e3));
      numeric = numeric.slice(0, wordMagnitude.index).trim();
    }

    const suffix = /(bn|mn|tn|[kKmMbB])\s*$/i.exec(numeric);
    if (suffix) {
      const unit = suffix[1].toLowerCase();
      factor *= unit === 'k' ? 1e3
        : (unit === 'm' || unit === 'mn') ? 1e6
          : (unit === 't' || unit === 'tn') ? 1e12 : 1e9;
      numeric = numeric.slice(0, suffix.index).trim();
    }

    // Les nombres EN LETTRES sont traites par un parseur dedie.
    // Detection simple : une chaine qui contient des lettres (et aucun chiffre)
    // est une candidature pour « dix », « vingt-cinq », « ten »...
    if (/\p{L}/u.test(numeric) && !/\d/u.test(numeric)) {
      const words = parseNumberWords(numeric);
      return words === null ? null : words * factor;
    }

    // Etape 1 : retirer les separateurs de milliers.
    //
    // \s couvre deja tous les types d'espaces (normale, insecable, fine,
    // tabulation). On ajoute l'apostrophe (\u0027), utilisee comme
    // separateur de milliers en Suisse : 1'234,56.
    let cleaned = numeric.replace(/[\s\u0027]/gu, '');

    if (cleaned === '') {
      return null;
    }

    const hasDot = cleaned.includes('.');
    const hasComma = cleaned.includes(',');

    // Etape 2 : les deux separateurs sont presents. Le dernier est decimal.
    if (hasDot && hasComma) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        // francais : 1.234,56 -> on retire les points, la virgule devient point
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // anglais : 1,234.56 -> on retire les virgules
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Virgule seule : decimale si 1 ou 2 chiffres suivent, sinon milliers.
      if (/,\d{1,2}$/.test(cleaned)) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasDot) {
      // Point seul : decimal si 1 ou 2 chiffres suivent, sinon milliers.
      if (!/\.\d{1,2}$/.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, '');
      }
    }

    // Etape 3 : seuls les chiffres et un point sont acceptes.
    if (!/^\d+(\.\d+)?$/.test(cleaned)) {
      return null;
    }

    const value = Number(cleaned);
    return Number.isFinite(value) ? value * factor : null;
  }

  /**
   * Calcule la position de fin REELLE d'un montant, en excluant l'espace qui
   * peut le suivre.
   *
   * La zone sensible est un intervalle « debut inclus, fin EXCLUE » :
   * [start, end[. « end » designe la position du premier caractere qui
   * n'appartient PLUS au montant.
   *
   * Pour « 10 € » occupe par les caracteres 10, 11 et 12, on veut donc
   * end = 13, afin que le caractere 13 (l'espace d'apres) soit exclu. Sans
   * cela, la bulle apparaissait sur tout l'espace vide a droite du prix.
   */
  function amountEnd(matched, start) {
    let length = matched.length;

    while (length > 0 && /\s/u.test(matched[length - 1])) {
      length -= 1;
    }

    if (length === 0) {
      length = matched.length;
    }

    return start + length;
  }

  /**
   * Analyse un texte et retourne la liste des montants trouves.
   *
   * Cinq familles de formats sont testees l'une apres l'autre. Quand deux
   * detections se chevauchent (par exemple « 10 EUR » et « 10 »), on garde la
   * plus fiable : d'abord les codes ISO, puis les symboles, puis les noms.
   *
   * @param {string} text - le texte a analyser
   * @returns {Array} liste d'objets { start, end, text, value, currency }
   */
  function findAmountsInText(text, hasDigitHint) {
    const candidates = [];
    // Les formats numeriques ne peuvent pas correspondre sans chiffre. On
    // evite donc de lancer 6 expressions regulieres pour du texte courant.
    const hasDigit = hasDigitHint === undefined ? /\d/.test(text) : hasDigitHint === true;

    /** Lance une famille de formats et empile les candidats trouves. */
    function collect(pattern, numberGroup, tokenGroup, priority) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = parseAmount(match[numberGroup]);
        if (value === null || value < MIN_AMOUNT || value > MAX_AMOUNT) {
          continue;
        }

        const currency = resolveCurrency(match[tokenGroup]);
        if (!currency) {
          continue;
        }

        const candidateEnd = amountEnd(match[0], match.index);

        // Iteration 7 : le nombre est-il vraiment un montant ?
        const rejection = rejectionForCandidate(
          text, match.index, candidateEnd, 'amount'
        );
        if (rejection) {
          noteRejection(rejection);
          continue;
        }

        candidates.push({
          start: match.index,
          end: candidateEnd,
          text: match[0],
          value: value,
          currency: currency,
          priority: priority
        });
      }
    }

    // Priorite 3 : les codes ISO (les plus explicites, donc les plus fiables).
    if (hasDigit) {
    collect(PATTERN_CODE_BEFORE, 2, 1, 3);
    collect(PATTERN_CODE_AFTER, 1, 2, 3);

    // Priorite 2 : le symbole ENTRE les euros et les centimes (« 679€99 »).
    PATTERN_SYMBOL_CENTS.lastIndex = 0;
    let centsMatch;
    while ((centsMatch = PATTERN_SYMBOL_CENTS.exec(text)) !== null) {
      // Un nombre deja decimal (« 679,50€99 ») n'a pas de sens : on ignore.
      if (/[.,]\d/.test(centsMatch[1])) {
        continue;
      }

      const whole = parseAmount(centsMatch[1]);
      if (whole === null) {
        continue;
      }

      const value = whole + Number(centsMatch[3]) / 100;
      if (value < MIN_AMOUNT || value > MAX_AMOUNT) {
        continue;
      }

      const currency = resolveCurrency(centsMatch[2]);
      if (!currency) {
        continue;
      }

      const end = amountEnd(centsMatch[0], centsMatch.index);
      const rejection = rejectionForCandidate(text, centsMatch.index, end, 'amount');
      if (rejection) {
        noteRejection(rejection);
        continue;
      }

      candidates.push({
        start: centsMatch.index,
        end: end,
        text: centsMatch[0],
        value: value,
        currency: currency,
        priority: 2
      });
    }

    // Priorite 2 : les symboles (tres fiables, mais « $ » reste ambigu).
    collect(PATTERN_SYMBOL_BEFORE, 2, 1, 2);
    collect(PATTERN_SYMBOL_AFTER, 1, 2, 2);

    // Priorite 1 : les noms (« 100 dollars », « yuan 100 »), moins precis.
    collect(PATTERN_NAME_AFTER, 1, 2, 1);
    collect(PATTERN_NAME_BEFORE, 2, 1, 1);
    }

    // Les nombres en lettres (« dix euros », « ten dollars ») : meme priorite
    // que les nombres chiffres, car l'information est equivalente. Ce format
    // ne contient pas forcement de chiffre : il est toujours analyse.
    collect(PATTERN_WORDS_AFTER, 1, 2, 1);

    // --- Fourchettes de prix -------------------------------------------------
    //
    // Priorite 4 : elles englobent les montants isoles et doivent gagner le
    // filtrage des chevauchements.
    function addPriceRange(match, minGroup, maxGroup, currencyGroup, secondGroup) {
      const minRaw = match[minGroup];
      const maxRaw = match[maxGroup];

      // Multiplicateur local : « 5-9k » propage le k aux deux bornes.
      function rangeFactor(raw) {
        const suffix = /([kKmMbB])\s*$/u.exec(String(raw).trim());
        if (!suffix) {
          return 1;
        }
        const unit = suffix[1].toLowerCase();
        return unit === 'k' ? 1e3 : unit === 'm' ? 1e6 : 1e9;
      }

      let min = parseAmount(minRaw);
      let max = parseAmount(maxRaw);

      if (min !== null && max !== null) {
        const minHas = rangeFactor(minRaw) !== 1;
        const maxHas = rangeFactor(maxRaw) !== 1;
        if (maxHas && !minHas) {
          min *= rangeFactor(maxRaw);
        } else if (minHas && !maxHas) {
          max *= rangeFactor(minRaw);
        }
      }

      if (min === null || max === null || min <= 0 || max <= 0 || min > max) {
        return;
      }
      if (min < MIN_AMOUNT || max > MAX_AMOUNT) {
        return;
      }

      const currency = resolveCurrency(match[currencyGroup]) ||
        resolveCurrency(String(match[currencyGroup]).toLowerCase());
      if (!currency) {
        return;
      }

      if (secondGroup && match[secondGroup]) {
        const second = resolveCurrency(match[secondGroup]) ||
          resolveCurrency(String(match[secondGroup]).toLowerCase());
        if (second && second.code !== currency.code) {
          return; // deux devises differentes : ce n'est pas une fourchette
        }
      }

      // Telephone juste avant : « (555) 123-4567 EUR » n'est pas un prix.
      const beforeRange = text.slice(Math.max(0, match.index - 16), match.index);
      if (/\(\d{2,4}\)\s*$/u.test(beforeRange)) {
        return;
      }
      if (/[\d)]\s*$/.test(beforeRange) && /^\d{3}[-.]\d{4}\b/u.test(match[0])) {
        return;
      }

      // « 4,5/5 EUR » est une note, pas une fourchette de prix.
      if (match[0].includes('/') && max <= 5) {
        return;
      }

      // « 10/10 EUR » : plage vide.
      if (match[0].includes('/') && min === max) {
        return;
      }

      const end = amountEnd(match[0], match.index);
      candidates.push({
        start: match.index,
        end: end,
        text: match[0],
        value: min,
        currency: currency,
        range: { min: min, max: max },
        priority: 4
      });
    }

    // Une fourchette contient TOUJOURS des chiffres : inutile de lancer
    // quatre expressions regulieres sur un texte sans chiffre.
    if (hasDigit) {
      let rangeMatch;

      PATTERN_RANGE_BOTH.lastIndex = 0;
      while ((rangeMatch = PATTERN_RANGE_BOTH.exec(text)) !== null) {
        addPriceRange(rangeMatch, 2, 4, 1, 3);
      }

      PATTERN_RANGE_SUFFIX.lastIndex = 0;
      while ((rangeMatch = PATTERN_RANGE_SUFFIX.exec(text)) !== null) {
        addPriceRange(rangeMatch, 1, 2, 3, 0);
      }

      PATTERN_RANGE_MID.lastIndex = 0;
      while ((rangeMatch = PATTERN_RANGE_MID.exec(text)) !== null) {
        addPriceRange(rangeMatch, 1, 3, 2, 0);
      }

      PATTERN_RANGE_BETWEEN.lastIndex = 0;
      while ((rangeMatch = PATTERN_RANGE_BETWEEN.exec(text)) !== null) {
        addPriceRange(rangeMatch, 1, 2, 3, 0);
      }
    }

    // --- Suppression des chevauchements --------------------------------------
    //
    // On trie par priorite decroissante, puis par longueur decroissante. On
    // garde un candidat seulement s'il ne chevauche aucun candidat deja garde.
    candidates.sort(function (a, b) {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return (b.end - b.start) - (a.end - a.start);
    });

    const kept = [];
    for (const candidate of candidates) {
      const overlaps = kept.some(function (other) {
        return candidate.start < other.end && other.start < candidate.end;
      });
      if (!overlaps) {
        kept.push(candidate);
      }
    }

    // On les remet dans l'ordre de lecture du texte.
    kept.sort(function (a, b) {
      return a.start - b.start;
    });

    return kept;
  }

  // =========================================================================
  //  ANTI-FAUX-POSITIFS (iteration 7)
  // =========================================================================
  //
  // Un nombre n'est pas forcement un montant. « Page 12 », « version 2.0 »,
  // « 1920 x 1080 », « 12h30 » contiennent tous des nombres, et aucun n'a de
  // valeur a convertir.
  //
  // Le risque SYMETRIQUE est plus grave : rejeter un vrai prix. Chaque regle
  // est donc ecrite de maniere ETROITE : elle ne se declenche que si l'indice
  // est colle au nombre (« chapitre 10 » mais pas « le chapitre parle de 10 »).

  /** Compteurs de rejets, remontes au popup pour rester transparent. */
  const REJECTION_COUNTS = Object.create(null);

  /** Incremente le compteur d'une regle de rejet. */
  function noteRejection(id) {
    if (!id) {
      return;
    }
    REJECTION_COUNTS[id] = (REJECTION_COUNTS[id] || 0) + 1;
  }

  /**
   * Vrai si le texte ressemble a un tableau de chiffres (statistiques, jeu de
   * donnees, mur de nombres).
   *
   * Un tel bloc est presque toujours une suite de mesures sans prix. On
   * demande beaucoup de chiffres ET tres peu de lettres : un paragraphe de
   * tarifs (« 10 €, 20 €… ») contient trop de mots pour etre confondu.
   */
  function looksLikeNumberDump(text) {
    if (!text || text.length < 40) {
      return false;
    }

    const digits = (text.match(/\d/gu) || []).length;
    if (digits < 12) {
      return false;
    }

    const letters = (text.match(/\p{L}/gu) || []).length;
    return letters < digits * 0.35;
  }

  /**
   * Decide si un nombre detecte n'est PAS un montant.
   *
   * @param {string} text - le texte complet du nœud analyse
   * @param {number} start - debut du nombre dans ce texte
   * @param {number} end - fin (exclue) du nombre dans ce texte
   * @param {string} kind - « amount » (devise) ou « unit » (unite)
   * @returns {string|null} identifiant de la regle, ou null si plausible
   */
  function rejectionForCandidate(text, start, end, kind) {
    const raw = text.slice(start, end);
    const before = text.slice(Math.max(0, start - 32), start);
    const after = text.slice(end, end + 32);
    const around = before + raw + after;

    // 1. Pourcentage : « 10 % ». Un prix n'est jamais suivi de « % ».
    if (/^\s*%/u.test(after)) {
      return 'percent';
    }

    // 2. Numero de version. « v1.2.3 », « version 2.0 », « EUR 1.2.3 ».
    //
    // ATTENTION : « 1.234,56 € » contient aussi des points. On reconnait
    // d'abord ce format (milliers a points, decimale a virgule) pour ne PAS
    // le prendre pour une version.
    const numberText = raw.replace(/[^\d.,\u0027\s]/gu, '');
    const dotThousands =
      /^\s*\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\s*$/u.test(numberText);
    const dotCount = (numberText.match(/\./gu) || []).length;

    if (dotCount >= 2 && !dotThousands) {
      return 'version';
    }
    if (dotCount >= 1 && /^\.\d/u.test(after)) {
      return 'version';
    }
    if (/(?:^|[^\p{L}])v\d*[.,]\s*$/iu.test(before)) {
      return 'version';
    }
    if (/(?:^|[\s(])(?:version|ver\.|release|build|rev\.)\s*$/iu.test(before) &&
        dotCount >= 1) {
      return 'version';
    }
    // « 1.2.3 kg » : le nombre est precede d'une suite de chiffres terminee par
    // un point. C'est la fin d'un numero de version.
    if (/(?:^|[\s(])[\d.,]*\d[.,]\s*$/u.test(before)) {
      return 'version';
    }

    // 3. Heure : « 12h30 », « 12:30 ».
    //
    // Le separateur doit etre COLLE au nombre : « 12h30 » et « 12:30 » sont des
    // heures, mais « Lot 12 : 15 € » est un prix (l'espace avant les deux-points
    // suffit a les distinguer).
    if (/^\s*h\s*\d{1,2}\b/u.test(after) || /^:\d{2}\b/u.test(after)) {
      return 'time';
    }
    if (/\d[h:]\s*$/u.test(before)) {
      return 'time';
    }
    // Decalage horaire : « GMT+2 », « UTC-5 ».
    if (/\b(?:GMT|UTC|CET|CEST|EST|EDT|CST|CDT|MST|MDT|PST|PDT|BST|IST)\s*[+\-]\s*$/u.test(before)) {
      return 'time';
    }

    // 4. Date : « 12/10/2025 », « 2025-10-12 », « 12.10.2025 ».
    if (/^\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{2,4}/u.test(after)) {
      return 'date';
    }

    // 5. Plage de valeurs : « 10-20 € ». Le tiret doit etre colle au nombre :
    //    « 20 € - 30 € » (deux prix) n'est donc PAS concerne.
    if (/^[-–—]\s*\d/u.test(after)) {
      return 'range';
    }
    if (/\d\s*[-–—]\s*$/u.test(before)) {
      return 'range';
    }

    // 5bis. Ratio ou note : « 4,5/5 », « 3/4 ». Le nombre suit une barre
    //       oblique collée a un autre nombre.
    if (/\d\s*\/\s*$/u.test(before)) {
      return 'ratio';
    }

    // 6. Numero de telephone : groupes de DEUX chiffres (« 06 12 34 56 78 »).
    //    Les milliers s'ecrivent par groupes de TROIS : pas de confusion avec
    //    « 1 234 567 890 ».
    if (/(?:\+\d{1,3}[\s.\-]?)?(?:\d{2}[\s.\-]){3,}\d{2}/u.test(around)) {
      return 'phone';
    }

    // 7. Adresse IP : « 192.168.1.1 ».
    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/u.test(around)) {
      return 'ip';
    }

    // 8. Norme ou reference collee au nombre : « ISO 9001 », « réf. 1234 »,
    //    « COVID-19 », « #1234 ».
    if (/\b(?:ISO|DIN|EN|NF|CE|ASTM|IEEE|ISBN|EAN|UPC|SKU|[Rr]éf\.?|[Rr][Ee][Ff]\.?|[Rr]ef\.?|modèle|modele|model)\s*$/u.test(before)) {
      return 'identifier';
    }
    // « COVID-19 », « A4-2 » : un mot suivi d'un tiret, puis du nombre.
    if (/\p{L}[-–—]\s*$/u.test(before)) {
      return 'identifier';
    }
    // « #1234 » : un numero de ticket, jamais un prix.
    if (/#\s*$/u.test(before)) {
      return 'identifier';
    }

    // 9. Numerotation : « page 12 », « chapitre 10 », « figure 3 ».
    if (/\b(?:page|p\.|pag\.|chapitre|chap\.|ch\.|section|§|figure|fig\.|tome|vol\.|volume|annexe|note|n°|no\.|numéro|numero|ligne|line|étage|etage|partie|acte|étape|etape|question)\s*$/iu.test(before)) {
      return 'numbering';
    }

    // --- Regles propres aux unites de mesure -------------------------------
    if (kind === 'unit') {
      // 10. Dimensions : « 10 m x 20 m », « 10 m² ».
      if (/[x×]\s*$/u.test(before) || /^\s*[x×]\s*\d/u.test(after)) {
        return 'dimension';
      }
      if (/^[²³]/u.test(after)) {
        return 'dimension';
      }

      // 11. « 12 m€ » = 12 millions d'euros, pas 12 metres.
      if (/^\s*(?:€|\$|£|¥|₽|₹|₩|₺|₪)/u.test(after)) {
        return 'millions';
      }

      // 12. « 3 quarts de la surface » : en francais, « quart » est une
      //     FRACTION (« trois quarts de »), pas un volume. En anglais, « of »
      //     n'est pas concerne : « 2 quarts of milk » reste un volume.
      if (/(?:^|[^\p{L}])quarts?\s*$/iu.test(raw) &&
          /^\s+(?:de|du|des|d['’])/iu.test(after)) {
        return 'fraction';
      }
    }

    return null;
  }

  // =========================================================================
  //  UNITES DE MESURE
  // =========================================================================
  //
  // Iteration 5. Les unites sont converties LOCALEMENT (aucun appel reseau) :
  // les facteurs de conversion sont des constantes exactes.

  /**
   * Table des unites reconnues.
   *
   * Chaque unite contient :
   *   tokens   : les ecritures possibles (« km », « kilometre », « kilomètres »)
   *   category : longueur, poids, volume, vitesse ou temperature
   *   system   : « metric » ou « imperial »
   *   factor   : coefficient vers l'unite de BASE de sa categorie
   *              (longueur -> metre, poids -> kilogramme, volume -> litre,
   *               vitesse -> km/h). Les temperatures n'ont pas de factor :
   *              leur conversion n'est pas proportionnelle.
   *
   * NOTE : « livre(s) » est volontairement absent des unites de POIDS pour ne
   * pas entrer en conflit avec la devise « livre sterling ». Le poids en
   * livres se note donc « lb », « lbs », « pound(s) ».
   */
  const UNITS = [
    // ---- Longueurs (base : metre) -----------------------------------------
    { tokens: ['kilometre', 'kilometres', 'kilomètre', 'kilomètres', 'km'],
      category: 'length', system: 'metric', factor: 1000 },
    { tokens: ['centimetre', 'centimetres', 'centimètre', 'centimètres', 'cm'],
      category: 'length', system: 'metric', factor: 0.01 },
    { tokens: ['millimetre', 'millimetres', 'millimètre', 'millimètres', 'mm'],
      category: 'length', system: 'metric', factor: 0.001 },
    { tokens: ['metre', 'metres', 'mètre', 'mètres', 'm'],
      category: 'length', system: 'metric', factor: 1 },
    { tokens: ['mile', 'miles', 'mi'],
      category: 'length', system: 'imperial', factor: 1609.344 },
    { tokens: ['yard', 'yards', 'yd'],
      category: 'length', system: 'imperial', factor: 0.9144 },
    { tokens: ['foot', 'feet', 'ft', 'pied', 'pieds'],
      category: 'length', system: 'imperial', factor: 0.3048 },
    { tokens: ['inch', 'inches', 'in', 'pouce', 'pouces'],
      category: 'length', system: 'imperial', factor: 0.0254 },
    { tokens: ['micron', 'microns', 'micrometre', 'micrometres', 'micromètre', 'micromètres', 'µm', 'μm'],
      category: 'length', system: 'metric', factor: 0.000001 },
    { tokens: ['nautical mile', 'nautical miles', 'mille marin', 'milles marins', 'nmi'],
      category: 'length', system: 'imperial', factor: 1852 },

    // ---- Poids (base : kilogramme) ----------------------------------------
    { tokens: ['kilogramme', 'kilogrammes', 'kilo', 'kilos', 'kg'],
      category: 'weight', system: 'metric', factor: 1 },
    { tokens: ['gramme', 'grammes', 'gram', 'grams', 'g'],
      category: 'weight', system: 'metric', factor: 0.001 },
    { tokens: ['stone', 'stones', 'st'],
      category: 'weight', system: 'imperial', factor: 6.35029318 },
    { tokens: ['pound', 'pounds', 'lb', 'lbs'],
      category: 'weight', system: 'imperial', factor: 0.45359237 },
    { tokens: ['ounce', 'ounces', 'oz'],
      category: 'weight', system: 'imperial', factor: 0.028349523125 },
    { tokens: ['tonne', 'tonnes', 'metric ton', 'metric tons', 't'],
      category: 'weight', system: 'metric', factor: 1000 },
    { tokens: ['milligramme', 'milligrammes', 'milligram', 'milligrams', 'mg'],
      category: 'weight', system: 'metric', factor: 0.000001 },
    { tokens: ['microgramme', 'microgrammes', 'microgram', 'micrograms', 'µg', 'μg', 'mcg'],
      category: 'weight', system: 'metric', factor: 0.000000001 },

    // ---- Volumes (base : litre) -------------------------------------------
    { tokens: ['litre', 'litres', 'liter', 'liters', 'l', 'L'],
      category: 'volume', system: 'metric', factor: 1 },
    { tokens: ['millilitre', 'millilitres', 'milliliter', 'milliliters', 'ml'],
      category: 'volume', system: 'metric', factor: 0.001 },
    { tokens: ['gallon', 'gallons', 'gal'],
      category: 'volume', system: 'imperial', factor: 3.785411784 },
    { tokens: ['pint', 'pints', 'pinte', 'pintes', 'pt'],
      category: 'volume', system: 'imperial', factor: 0.473176473 },
    // Quart US liquide = 1/4 de gallon US (et non le quart imperial anglais,
    // qui vaut 1,1365 L : le reste de la table suit le gallon US).
    { tokens: ['quart', 'quarts', 'qt', 'qts'],
      category: 'volume', system: 'imperial', factor: 0.946352946 },
    { tokens: ['cup', 'cups', 'tasse', 'tasses'],
      category: 'volume', system: 'imperial', factor: 0.2365882365 },
    { tokens: ['centilitre', 'centilitres', 'centiliter', 'centiliters', 'cl'],
      category: 'volume', system: 'metric', factor: 0.01 },
    { tokens: ['decilitre', 'decilitres', 'deciliter', 'deciliters', 'dl'],
      category: 'volume', system: 'metric', factor: 0.1 },
    { tokens: ['hectolitre', 'hectolitres', 'hectoliter', 'hectoliters', 'hl'],
      category: 'volume', system: 'metric', factor: 100 },
    { tokens: ['cubic centimetre', 'cubic centimetres', 'cubic centimeter', 'cubic centimeters', 'cc'],
      category: 'volume', system: 'metric', factor: 0.001 },
    { tokens: ['fluid ounce', 'fluid ounces', 'fl oz'],
      category: 'volume', system: 'imperial', factor: 0.0295735295625 },
    { tokens: ['teaspoon', 'teaspoons', 'tsp', 'cuillère à café', 'cuillères à café', 'cuillere a cafe', 'cuilleres a cafe'],
      category: 'volume', system: 'imperial', factor: 0.00492892159375 },
    { tokens: ['tablespoon', 'tablespoons', 'tbsp', 'cuillère à soupe', 'cuillères à soupe', 'cuillere a soupe', 'cuilleres a soupe'],
      category: 'volume', system: 'imperial', factor: 0.01478676478125 },

    // ---- Vitesses (base : km/h) -------------------------------------------
    { tokens: ['kilometres par heure', 'kilomètres par heure', 'km/h', 'kmh'],
      category: 'speed', system: 'metric', factor: 1 },
    { tokens: ['miles per hour', 'mph'],
      category: 'speed', system: 'imperial', factor: 1.609344 },
    { tokens: ['metre per second', 'metres per second', 'meter per second', 'meters per second',
               'mètre par seconde', 'mètres par seconde', 'm/s'],
      category: 'speed', system: 'metric', factor: 3.6 },
    { tokens: ['knot', 'knots', 'nœud', 'nœuds', 'noeud', 'noeuds', 'kn'],
      category: 'speed', system: 'imperial', factor: 1.852 },

    // ---- Temperatures (pas de factor : conversion avec decalage) -----------
    { tokens: ['celsius', '°C',
               'degré celsius', 'degrés celsius', 'degré Celsius', 'degrés Celsius',
               'degre celsius', 'degres celsius', 'Degré Celsius', 'Degrés Celsius',
               'degré centigrade', 'degrés centigrades', 'degré centigrade',
               'deg c', 'deg C', 'deg celsius', '° c'],
      category: 'temperature', system: 'metric', factor: null },
    { tokens: ['fahrenheit', '°F',
               'degré fahrenheit', 'degrés fahrenheit', 'degré Fahrenheit', 'degrés Fahrenheit',
               'degre fahrenheit', 'degres fahrenheit', 'Degré Fahrenheit', 'Degrés Fahrenheit',
               'deg f', 'deg F', 'deg fahrenheit', '° f'],
      category: 'temperature', system: 'imperial', factor: null },
    // « K » est une unite connue ET detectee, mais avec une REGLE DE CONTEXTE
    // (voir findUnitsInText) : « 300 K » est une temperature, « 50 K abonnes »
    // veut dire 50 000. Le symbole « °K » (ancien) est aussi accepte.
    { tokens: ['kelvin', 'kelvins', 'K', '°K', 'degré kelvin', 'degrés kelvin', 'deg k', '° k'],
      category: 'temperature', system: 'metric', factor: null }
  ];

  /** Index rapide : token -> unite. */
  const UNIT_BY_TOKEN = new Map();
  for (const unit of UNITS) {
    for (const token of unit.tokens) {
      UNIT_BY_TOKEN.set(token, unit);
    }
  }

  /**
   * Ajoute un alias en MAJUSCULES aux tokens de deux caracteres ou plus.
   *
   * POURQUOI : les emballages et l'OCR ecrivent souvent les unites en
   * capitales : « 2.1 QT », « 10 IN », « 6 FT », « 2 L ». Sans alias, ces
   * formes n'etaient pas reconnues.
   *
   * Les tokens d'UN SEUL caractere sont volontairement exclus : « M » peut
   * signifier « millions », « K » « milliers » (deja exclu de la detection).
   */
  function addUppercaseUnitAliases(map) {
    for (const [token, unit] of Array.from(map.entries())) {
      const upper = token.toUpperCase();
      if (token.length >= 2 && upper !== token && !map.has(upper)) {
        map.set(upper, unit);
      }
    }
    return map;
  }

  addUppercaseUnitAliases(UNIT_BY_TOKEN);

  /**
   * Tokens connus mais JAMAIS cherches dans le texte (iteration 7).
   *
   * « K » : le kelvin ne s'ecrit « K » que dans un laboratoire. Sur le web,
   * « 50 K » signifie « 50 000 » (abonnes, vues, euros). Convertir cela en
   * degres Celsius serait absurde ; on exige donc le mot « kelvin ».
   * La conversion, elle, continue d'accepter « K ».
   */
  // Aucun token n'est plus interdit : « K » (kelvin) est desormais accepte
  // avec une REGLE DE CONTEXTE (voir findUnitsInText) qui distingue
  // « 300 K » de « 50 K abonnes ». Le set reste en place pour de futurs cas.
  const DETECTION_EXCLUDED_TOKENS = new Set([
    // « t » sert de SYMBOLE d'affichage au tonne (« 2 t = 2000 kg »), mais il
    // n'est pas cherche seul dans le texte : « T » vaut Tesla ou tera, et
    // « t » est trop court pour etre fiable. On ecrit « tonne(s) ».
    't'
  ]);

  /** Tous les tokens, tries du plus long au plus court (km/h avant km, mL avant m). */
  const UNIT_TOKENS = Array.from(UNIT_BY_TOKEN.keys())
    .filter((token) => !DETECTION_EXCLUDED_TOKENS.has(token))
    .sort((a, b) => b.length - a.length);

  /**
   * Motif d'un nombre simple pour les unites (pas de separateurs de milliers,
   * rares pour des mesures).
   */
  /**
   * Fractions admises : « 1/2 », « 2 1/2 », « 2½ », « ½ ».
   *
   * POURQUOI : les recettes anglo-saxonnes ecrivent leurs volumes ainsi
   * (« 1/2 cup », « 2 1/2 cups », « ½ tasse »). Sans elles, ces mesures
   * n'etaient pas converties.
   */
  const FRACTION_GLYPHS = '\u00BD\u00BC\u00BE\u2153\u2154\u2155\u2156\u2157\u2158\u2159\u215A\u215B\u215C\u215D\u215E';

  const UNIT_NUMBER =
    '(?:' +
      '\\d+\\s+\\d+\\s*\\/\\s*\\d+' +        // 2 1/2
      '|\\d+\\s*[' + FRACTION_GLYPHS + ']' +        // 2½
      '|\\d+\\s*\\/\\s*\\d+' +                  // 1/2
      '|\\d+(?:[.,]\\d{1,2})?' +                // 2,5
      '|[' + FRACTION_GLYPHS + ']' +               // ½
    ')';

  /** Vrai si le texte contient un nombre (chiffre ou fraction). */
  const HAS_QUANTITY = new RegExp('[\\d' + FRACTION_GLYPHS + ']', 'u');

  /** Reconnait « 2½ » (chiffre + fraction). */
  const NUMBER_FRACTION = new RegExp('^(\\d+)\\s*([' + FRACTION_GLYPHS + '])$', 'u');

  /**
   * Lit un nombre d'unite, y compris les fractions.
   *
   * @param {string} raw
   * @returns {number|null}
   */
  function parseUnitQuantity(raw) {
    const text = String(raw).trim();

    const glyphs = {
      '\u00BD': 0.5, '\u00BC': 0.25, '\u00BE': 0.75,
      '\u2153': 1 / 3, '\u2154': 2 / 3,
      '\u2155': 0.2, '\u2156': 0.4, '\u2157': 0.6, '\u2158': 0.8,
      '\u2159': 1 / 6, '\u215A': 5 / 6,
      '\u215B': 0.125, '\u215C': 0.375, '\u215D': 0.625, '\u215E': 0.875
    };

    let match = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/u.exec(text);
    if (match) {
      const denominator = Number(match[3]);
      return denominator > 0 ? Number(match[1]) + Number(match[2]) / denominator : null;
    }

    match = /^(\d+)\s*\/\s*(\d+)$/u.exec(text);
    if (match) {
      const denominator = Number(match[2]);
      return denominator > 0 ? Number(match[1]) / denominator : null;
    }

    match = NUMBER_FRACTION.exec(text);
    if (match && glyphs[match[2]] !== undefined) {
      return Number(match[1]) + glyphs[match[2]];
    }

    if (glyphs[text] !== undefined) {
      return glyphs[text];
    }

    return parseAmount(text);
  }

  /** Tous les tokens d'unite, pour une classe regex. */
  const UNIT_TOKEN_CLASS = UNIT_TOKENS.map(escapeForRegex).join('|');

  /**
   * Format : nombre suivi d'une unite.
   *   5 km   5km   2,5 kg   10 lbs   6 ft   20°C   70°F
   * Groupe 1 : le nombre   Groupe 2 : l'unite
   */
  const PATTERN_UNIT = new RegExp(
    NOT_BEFORE +
    '(' + UNIT_NUMBER + ')' +
    '(?:' + SPACES + ')?' +
    '(' + UNIT_TOKEN_CLASS + ')' +
    NOT_AFTER,
    'gu'
  );

  /**
   * Format compose : pieds + pouces.
   *   6 ft 2 in   5'10"
   * On capte separement les pieds et les pouces, puis on additionne.
   */
  const PATTERN_FEET_INCHES = new RegExp(
    NOT_BEFORE +
    '(' + UNIT_NUMBER + ')' +
    '(?:' + SPACES + ')?(?:ft|feet|pied|pieds|\')' +
    '(?:' + SPACES + ')?' +
    '(' + UNIT_NUMBER + ')' +
    '(?:' + SPACES + ')?(?:in|inch|inches|pouce|pouces|")' +
    NOT_AFTER,
    'giu'
  );

  /**
   * Format francais de taille : 1m80 (= 1,80 m).
   *   Un chiffre, la lettre « m », puis deux chiffres (les centimetres).
   */
  const PATTERN_HEIGHT_FR = new RegExp(
    '(?<![\\p{L}\\d])' +
    '(\\d)m(\\d{2})' +
    '(?![\\p{L}\\d])',
    'gu'
  );

  /**
   * Convertit une valeur d'une unite vers une autre.
   *
   * Regles :
   *   - meme categorie, non-temperature : passage par l'unite de base ;
   *   - temperature : formules avec decalage (le piege classique) ;
   *   - categories differentes : impossible.
   *
   * @param {number} value
   * @param {object} from - l'unite de depart
   * @param {object} to - l'unite d'arrivee
   * @returns {number|null}
   */
  function convertUnitValue(value, from, to) {
    if (!from || !to || from.category !== to.category) {
      return null;
    }

    // Temperatures : conversion avec decalage.
    if (from.category === 'temperature') {
      return convertTemperature(value, from.tokens[0], to.tokens[0]);
    }

    // Autres : passage par l'unite de base.
    const inBase = value * from.factor;
    return inBase / to.factor;
  }

  /**
   * Conversion de temperature.
   *
   * La conversion n'est PAS une multiplication : elle inclut un decalage.
   * C'est la cause n°1 des conversions de temperature fausses.
   *
   * @param {number} value
   * @param {string} fromToken - « °C », « °F », « K »...
   * @param {string} toToken
   * @returns {number|null}
   */
  function convertTemperature(value, fromToken, toToken) {
    const from = normalizeTempToken(fromToken);
    const to = normalizeTempToken(toToken);
    if (!from || !to) {
      return null;
    }

    // On passe d'abord par le Celsius, reference commune.
    let celsius;
    if (from === 'C') {
      celsius = value;
    } else if (from === 'F') {
      celsius = (value - 32) * 5 / 9;
    } else if (from === 'K') {
      celsius = value - 273.15;
    } else {
      return null;
    }

    if (to === 'C') {
      return celsius;
    }
    if (to === 'F') {
      return celsius * 9 / 5 + 32;
    }
    if (to === 'K') {
      return celsius + 273.15;
    }
    return null;
  }

  /** Normalise un token de temperature vers « C », « F » ou « K ». */
  function normalizeTempToken(token) {
    if (!token) {
      return null;
    }
    const t = String(token).toLowerCase();
    if (t.includes('c') || t.includes('celsius')) return 'C';
    if (t.includes('f') || t.includes('fahrenheit')) return 'F';
    if (t.includes('k') || t.includes('kelvin')) return 'K';
    return null;
  }

  /**
   * Analyse un texte et retourne les unites trouvees.
   *
   * @param {string} text
   * @returns {Array} [{ start, end, text, value, unit, category, system }]
   */
  function findUnitsInText(text) {
    const found = [];

    // Aucune unite possible sans lettre, degre, micro, quote ou barre
    // oblique : un texte purement numerique (« 2026 », « 12 345 ») n'a pas
    // besoin de lancer la grande expression des unites.
    if (!/[\p{L}°µμ'"\/′″]/u.test(text)) {
      return found;
    }

    // 1. Format simple : nombre + unite.
    PATTERN_UNIT.lastIndex = 0;
    let match;
    while ((match = PATTERN_UNIT.exec(text)) !== null) {
      const value = parseUnitQuantity(match[1]);
      if (value === null || !Number.isFinite(value) || value <= 0) continue;
      const unit = UNIT_BY_TOKEN.get(match[2]);
      if (!unit) continue;

      // --- Garde-fous contre les faux positifs des unites ---------------
      const token = match[2];
      // Les alias majuscules (« IN », « ST ») doivent suivre les MEMES regles.
      const tokenKey = token.toLowerCase();

      // « 1st » (premier) ne doit pas etre lu comme « 1 stone ». On exige un
      // espace entre le nombre et « st ».
      if (tokenKey === 'st' && !/\s/u.test(match[0])) {
        continue;
      }

      // « 10 IN THE BOX » ne doit pas etre lu comme « 10 pouces ». On rejette
      // « in » quand il est suivi d'un espace puis d'un mot (toute casse) ou
      // d'un nombre.
      if (tokenKey === 'in') {
        const after = text.slice(match.index + match[0].length);
        if (/^[ \u00A0](?:[\p{L}]|\d)/u.test(after)) {
          continue;
        }
      }

      // Kelvin : « 300 K » est une temperature, mais « 50 K » veut tres
      // souvent dire 50 000 (abonnes, vues, euros). On n'accepte donc K que :
      //   - colle a un espace (« 50K » = 50 000, rejete) ;
      //   - sans contexte de comptage/argent juste apres ;
      //   - dans une plage plausible, ou avec un mot de contexte scientifique.
      if (tokenKey === 'k' || tokenKey === '°k') {
        const afterText = text.slice(match.index + match[0].length, match.index + match[0].length + 24);
        const beforeText = text.slice(Math.max(0, match.index - 40), match.index);
        const countContext = /^\s*(?:€|\$|£|¥|abonn|follow|vues?|views?|membres?|clients?|utilisateurs?|users?|likes?|j'aime|euros?|dollars?)/iu.test(afterText);
        const moneyBefore = /[€$£¥]\s*$/u.test(beforeText);
        const hasSpace = /\s/u.test(match[0]);
        const temperatureContext = /(?:temp[ée]rature|temperature|kelvin|thermo|azote|fusion|[ée]bullition|\bT\s*=)/iu
          .test(beforeText + ' ' + afterText);
        const numeric = parseUnitQuantity(match[1]);

        if (!hasSpace || countContext || moneyBefore) {
          continue;
        }
        if (!temperatureContext && (numeric === null || numeric < 200 || numeric > 10000)) {
          continue;
        }
      }

      const unitEnd = amountEnd(match[0], match.index);

      // Iteration 7 : meme filtrage que pour les devises, avec des regles
      // supplementaires propres aux mesures (dimensions, « m€ »).
      const rejection = rejectionForCandidate(
        text, match.index, unitEnd, 'unit'
      );
      if (rejection) {
        noteRejection(rejection);
        continue;
      }

      found.push({
        start: match.index,
        end: unitEnd,
        text: match[0],
        value: value,
        unit: unit,
        category: unit.category,
        system: unit.system,
        kind: 'unit'
      });
    }

    // 2. Format compose : pieds + pouces.
    PATTERN_FEET_INCHES.lastIndex = 0;
    while ((match = PATTERN_FEET_INCHES.exec(text)) !== null) {
      const feet = parseAmount(match[1]);
      const inches = parseAmount(match[2]);
      if (feet === null || inches === null) continue;
      // On represente le resultat comme une longueur en pouces (imperial).
      const totalInches = feet * 12 + inches;
      found.push({
        start: match.index,
        end: amountEnd(match[0], match.index),
        text: match[0],
        value: totalInches,
        unit: { category: 'length', system: 'imperial', factor: 0.0254, tokens: ['in'] },
        category: 'length',
        system: 'imperial',
        kind: 'unit',
        compound: { feet: feet, inches: inches }
      });
    }

    // 3. Format francais : 1m80.
    PATTERN_HEIGHT_FR.lastIndex = 0;
    while ((match = PATTERN_HEIGHT_FR.exec(text)) !== null) {
      const meters = parseAmount(match[1]);
      const cm = parseAmount(match[2]);
      if (meters === null || cm === null) continue;
      const valueInMeters = meters + cm / 100;
      found.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        value: valueInMeters,
        unit: { category: 'length', system: 'metric', factor: 1, tokens: ['m'] },
        category: 'length',
        system: 'metric',
        kind: 'unit'
      });
    }

    // Dedoublonnage par position de depart (le plus long gagne).
    found.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const kept = [];
    for (const item of found) {
      const overlaps = kept.some((k) => item.start < k.end && k.start < item.end);
      if (!overlaps) kept.push(item);
    }
    kept.sort((a, b) => a.start - b.start);
    return kept;
  }

  /**
   * Convertit une unite vers le systeme cible (metrique ou imperial).
   *
   * @param {object} unitMatch - resultat de findUnitsInText
   * @param {string} targetSystem - « metric » ou « imperial »
   * @returns {object|null} { value, unit, label }
   */
  function convertUnitToSystem(unitMatch, targetSystem) {
    // Le KELVIN est une unite scientifique : on le convertit TOUJOURS vers
    // l'echelle de l'utilisateur (°C en metrique, °F en imperial), meme si
    // son « systeme » est deja metrique. « 300 K » affiche donc 26,85 °C.
    const isKelvin = unitMatch.category === 'temperature' &&
      (unitMatch.unit.tokens || []).indexOf('K') !== -1;

    if (unitMatch.system === targetSystem && !isKelvin) {
      return null; // deja dans le bon systeme
    }

    // Temperatures : conversion directe vers la reference du systeme cible.
    if (unitMatch.category === 'temperature') {
      const want = targetSystem === 'metric' ? '°C' : '°F';
      const target = UNIT_BY_TOKEN.get(want);
      const converted = convertUnitValue(unitMatch.value, unitMatch.unit, target);
      if (converted === null) return null;
      return { value: converted, unit: target, label: systemLabel(targetSystem) };
    }

    // Autres : on convertit d'abord dans l'unite de BASE metrique (m, kg, l,
    // km/h), puis on choisit l'unite d'affichage selon l'ordre de grandeur.
    const inBase = unitMatch.value * unitMatch.unit.factor;

    let target = null;

    if (targetSystem === 'metric') {
      target = pickMetricUnit(unitMatch.category, inBase);
    } else {
      target = pickImperialUnit(unitMatch.category, inBase);
    }

    if (!target) {
      return null;
    }

    const converted = inBase / target.factor;
    return {
      value: converted,
      unit: target,
      label: systemLabel(targetSystem)
    };
  }

  /**
   * Choisit l'unite metrique la plus lisible selon la grandeur.
   *
   * @param {string} category
   * @param {number} inBase - valeur exprimee en unite de base (m, kg, l, km/h)
   */
  function pickMetricUnit(category, inBase) {
    const abs = Math.abs(inBase);
    if (category === 'length') {
      if (abs >= 1000) return UNIT_BY_TOKEN.get('km');
      if (abs >= 0.01) return UNIT_BY_TOKEN.get('m');
      if (abs >= 0.001) return UNIT_BY_TOKEN.get('cm');
      if (abs >= 0.0001) return UNIT_BY_TOKEN.get('mm');
      return UNIT_BY_TOKEN.get('µm') || UNIT_BY_TOKEN.get('cm');
    }
    if (category === 'weight') {
      if (abs >= 1) return UNIT_BY_TOKEN.get('kg');
      return UNIT_BY_TOKEN.get('g');
    }
    if (category === 'volume') {
      if (abs >= 1) return UNIT_BY_TOKEN.get('l');
      return UNIT_BY_TOKEN.get('ml');
    }
    if (category === 'speed') {
      return UNIT_BY_TOKEN.get('km/h');
    }
    return null;
  }

  /**
   * Choisit l'unite imperiale la plus lisible selon la grandeur.
   *
   * @param {string} category
   * @param {number} inBase - valeur exprimee en unite de base (m, kg, l, km/h)
   */
  function pickImperialUnit(category, inBase) {
    const abs = Math.abs(inBase);
    if (category === 'length') {
      // 5280 pieds = 1 mile ; au-dela, on parle en miles.
      const feet = inBase / 0.3048;
      if (Math.abs(feet) >= 5280) return UNIT_BY_TOKEN.get('mi');
      return UNIT_BY_TOKEN.get('ft');
    }
    if (category === 'weight') {
      const pounds = inBase / 0.45359237;
      if (Math.abs(pounds) < 1) return UNIT_BY_TOKEN.get('oz');
      return UNIT_BY_TOKEN.get('lb');
    }
    if (category === 'volume') {
      return UNIT_BY_TOKEN.get('gal');
    }
    if (category === 'speed') {
      return UNIT_BY_TOKEN.get('mph');
    }
    return null;
  }

  /**
   * Parcourt toute la page et repere les montants.
   */
  // =========================================================================
  //  LISTE NOIRE, PAUSE ET RACCOURCI (iteration 7)
  // =========================================================================
  //
  // Objectif : rendre l'extension ABSENTE la ou elle n'a rien a faire.
  //
  //   - liste noire de domaines (boites mail, editeurs de code, agendas) ;
  //   - pause globale, pilotee par le popup (case « Activer la detection »),
  //     avec un indicateur sur l'icone (badge « OFF »).

  /**
   * Domaines ou l'extension ne fait rien par defaut.
   *
   * Ce sont des outils ou l'on tape du texte toute la journee (courriel,
   * documents, code) et ou un soulignement intempestif est insupportable.
   * La liste personnelle viendra s'ajouter a celle-ci (reglage prevu a
   * l'iteration 8).
   */
  const DEFAULT_BLACKLIST = [
    'mail.google.com', 'docs.google.com', 'drive.google.com',
    'calendar.google.com', 'photos.google.com', 'keep.google.com',
    'outlook.office.com', 'outlook.live.com', 'mail.yahoo.com',
    'web.whatsapp.com', 'web.telegram.org',
    'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
    'codepen.io', 'jsfiddle.net', 'codesandbox.io', 'replit.com',
    'notion.so', 'figma.com', 'airtable.com', 'trello.com'
  ];

  /** Vrai si l'extension est en pause (reglage utilisateur). */
  let extensionPaused = false;

  /** Domaines ajoutes par l'utilisateur. */
  let userBlacklist = [];

  /** Vrai si le script a ete desactive sur cette page (liste noire). */
  let disabledHere = false;

  /** Vrai si le premier scan a deja eu lieu (pour eviter les doublons). */
  let initialScanDone = false;

  /** Retourne le nom d'hote de la page, en minuscules, sans planter. */
  function safeHostname() {
    try {
      return String(location.hostname || '').toLowerCase();
    } catch (error) {
      return '';
    }
  }

  /** Vrai si la page courante figure dans la liste noire. */
  function isBlacklistedHost() {
    const host = safeHostname();
    if (!host) {
      return false;
    }

    const all = DEFAULT_BLACKLIST.concat(userBlacklist);

    return all.some(function (domain) {
      const clean = String(domain || '').trim().toLowerCase();
      if (!clean) {
        return false;
      }
      return host === clean || host.endsWith('.' + clean);
    });
  }

  /**
   * Lit les reglages de pause et de liste noire.
   *
   * @returns {Promise<{paused: boolean, blacklisted: boolean}>}
   */
  function loadGuardSettings() {
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve({ paused: false, blacklisted: isBlacklistedHost() });
        return;
      }

      try {
        chrome.storage.local.get(
          ['uniconv.enabled', 'uniconv.blacklist'],
          function (result) {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve({ paused: false, blacklisted: isBlacklistedHost() });
              return;
            }

            extensionPaused = result && result['uniconv.enabled'] === false;

            const stored = result ? result['uniconv.blacklist'] : null;
            userBlacklist = Array.isArray(stored) ? stored : [];

            watchGuardSettings();

            resolve({
              paused: extensionPaused,
              blacklisted: isBlacklistedHost()
            });
          }
        );
      } catch (error) {
        resolve({ paused: false, blacklisted: isBlacklistedHost() });
      }
    });
  }

  /**
   * Reagit aux changements de reglages faits ailleurs (popup, autre onglet).
   *
   * Sans cela, suspendre l'extension depuis le popup ne prendrait effet
   * qu'apres un rechargement des pages ouvertes — comportement incomprehensible
   * pour l'utilisateur.
   */
  function watchGuardSettings() {
    if (typeof chrome === 'undefined' || !chrome.storage ||
        !chrome.storage.onChanged || !chrome.storage.onChanged.addListener) {
      return;
    }

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes) {
        return;
      }

      if (changes['uniconv.enabled'] && !disabledHere) {
        const paused = changes['uniconv.enabled'].newValue === false;
        if (paused !== extensionPaused) {
          applyPauseState(paused);
        }
      }

      if (changes['uniconv.blacklist']) {
        const stored = changes['uniconv.blacklist'].newValue;
        userBlacklist = Array.isArray(stored) ? stored : [];
        // Un site deja ouvert n'est pas desactive a chaud : il faut le
        // recharger. On le signale dans la console pour eviter la confusion.
        if (isBlacklistedHost()) {
          console.log(
            `${LOG_PREFIX} ce site est desormais en liste noire : ` +
            `rechargez la page pour desactiver l'extension ici`
          );
        }
      }
    });
  }

  /**
   * Lit les reglages d'affichage (langue, thème, délai, couverture).
   *
   * @returns {Promise<void>}
   */
  function loadDisplaySettings() {
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }

      const keys = [
        'uniconv.language',
        'uniconv.detectCurrencies',
        'uniconv.detectUnits',
        'uniconv.detectTimezones',
        'uniconv.targetTimezone',
        'uniconv.timeFormat',
        'uniconv.hoverDelay',
        'uniconv.theme',
        'uniconv.targetCurrency',
        'uniconv.unitSystem',
        'uniconv.referenceUnitsEnabled'
      ];

      try {
        chrome.storage.local.get(keys, function (result) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve();
            return;
          }

          applyDisplaySettings(result || {});
          watchDisplaySettings();
          resolve();
        });
      } catch (error) {
        resolve();
      }
    });
  }

  /** Applique un objet de reglages a l'etat du script. */
  function applyDisplaySettings(result) {
    const language = result['uniconv.language'];

    const supportedLanguages = ['fr', 'en', 'es', 'ru', 'zh', 'ar'];

    if (supportedLanguages.indexOf(language) !== -1) {
      uiLanguage = language;
    } else {
      // « auto » : on suit la langue du navigateur.
      const nav = String(
        (typeof navigator !== 'undefined' && navigator.language) || 'fr'
      ).toLowerCase().slice(0, 2);
      uiLanguage = supportedLanguages.indexOf(nav) !== -1 ? nav : 'en';
    }

    if (typeof result['uniconv.detectCurrencies'] === 'boolean') {
      detectCurrencies = result['uniconv.detectCurrencies'];
    }
    if (typeof result['uniconv.detectUnits'] === 'boolean') {
      detectUnits = result['uniconv.detectUnits'];
    }
    if (typeof result['uniconv.detectTimezones'] === 'boolean') {
      detectTimezones = result['uniconv.detectTimezones'];
    }

    const timezone = result['uniconv.targetTimezone'];
    if (typeof timezone === 'string') {
      defaultTargetTimezone = timezone;
      if (!frozen) {
        targetTimezone = timezone;
      }
    }

    if (typeof result['uniconv.referenceUnitsEnabled'] === 'boolean') {
      referenceUnitsEnabled = result['uniconv.referenceUnitsEnabled'];
    }

    if (typeof result['uniconv.targetCurrency'] === 'string' &&
        /^[A-Za-z]{3}$/.test(result['uniconv.targetCurrency'])) {
      defaultTargetCurrency = result['uniconv.targetCurrency'].toUpperCase();
      if (!frozen) {
        targetCurrency = defaultTargetCurrency;
      }
    }

    if (result['uniconv.unitSystem'] === 'metric' ||
        result['uniconv.unitSystem'] === 'imperial') {
      targetSystem = result['uniconv.unitSystem'];
      if (!frozen) {
        selectedUnit = null;
      }
    }

    const timeFormat = result['uniconv.timeFormat'];
    if (timeFormat === '24' || timeFormat === '12' || timeFormat === 'auto') {
      timeFormatSetting = timeFormat;
    }

    const delay = Number(result['uniconv.hoverDelay']);
    hoverDelayMs = Number.isFinite(delay) && delay >= 0
      ? Math.min(delay, 1500)
      : 0;

    const theme = result['uniconv.theme'];
    if (theme === 'light' || theme === 'dark' || theme === 'auto') {
      tooltipThemeSetting = theme;
    }

    applyTheme();
  }

  /** Reagit aux changements faits dans la page d'options, sans rechargement. */
  function watchDisplaySettings() {
    if (typeof chrome === 'undefined' || !chrome.storage ||
        !chrome.storage.onChanged || !chrome.storage.onChanged.addListener) {
      return;
    }

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes) {
        return;
      }

      const relevant = [
        'uniconv.language',
        'uniconv.detectCurrencies',
        'uniconv.detectUnits',
        'uniconv.detectTimezones',
        'uniconv.targetTimezone',
        'uniconv.timeFormat',
        'uniconv.hoverDelay',
        'uniconv.theme'
      ];

      const touched = relevant.some(function (key) {
        return Object.prototype.hasOwnProperty.call(changes, key);
      });

      if (!touched) {
        return;
      }

      const update = {};
      for (const key of relevant) {
        if (changes[key]) {
          update[key] = changes[key].newValue;
        } else {
          // Valeur inchangee : on la relit pour ne pas la perdre.
          update[key] = key === 'uniconv.language' ? uiLanguage :
            key === 'uniconv.detectCurrencies' ? detectCurrencies :
            key === 'uniconv.detectUnits' ? detectUnits :
            key === 'uniconv.detectTimezones' ? detectTimezones :
            key === 'uniconv.targetTimezone' ? targetTimezone :
            key === 'uniconv.timeFormat' ? timeFormatSetting :
            key === 'uniconv.hoverDelay' ? hoverDelayMs :
            key === 'uniconv.targetCurrency' ? defaultTargetCurrency :
            key === 'uniconv.unitSystem' ? targetSystem :
            key === 'uniconv.referenceUnitsEnabled' ? referenceUnitsEnabled : tooltipThemeSetting;
        }
      }

      applyDisplaySettings(update);

      // Le texte de la bulle ouverte doit suivre le changement de langue.
      hideTooltip();

      // Un changement de couverture doit se voir tout de suite.
      if (initialScanDone && !extensionPaused && !disabledHere) {
        runCache.clear();
        skippedZoneCache = new WeakMap();
        scanDocument();
      }
    });
  }

  /** Met a jour le badge de l'icone (« OFF » quand c'est en pause). */
  function notifyPauseState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'set-paused',
          paused: extensionPaused
        }, function () {
          // On ignore la reponse : cet appel est purement informatif.
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
        });
      }
    } catch (error) {
      // L'arriere-plan n'est pas joignable : sans importance.
    }
  }

  /** Applique l'etat de pause : cache la bulle et previent l'arriere-plan. */
  function applyPauseState(paused) {
    extensionPaused = Boolean(paused);

    if (extensionPaused) {
      hideTooltip();
      CSS_HIGHLIGHT_OFF();
    } else if (initialScanDone) {
      scanDocument();
    } else if (!disabledHere) {
      // Reprise alors que le script avait demarre en pause : on lance
      // maintenant le premier scan.
      startDetection();
    }

    notifyPauseState();

    console.log(
      `${LOG_PREFIX} ${extensionPaused ? 'en pause' : 'reactivation'}`
    );
  }

  /** Retire le soulignement (utilise a la mise en pause). */
  function CSS_HIGHLIGHT_OFF() {
    try {
      if (typeof CSS !== 'undefined' && CSS.highlights) {
        CSS.highlights.delete('unicorn-amount');
      }
    } catch (error) {
      // API indisponible : rien a faire.
    }
  }

  /** Raccourci de diagnostic : Alt + Maj + D (« debug »). */
  const DEBUG_SHORTCUT = { alt: true, shift: true, code: 'KeyD' };

  /** Resume lisible d'un element : « span.a-price.a-text-price ». */
  function describeElement(element) {
    if (!element || element.nodeType !== 1) {
      return '(inconnu)';
    }

    const tag = String(element.tagName || '').toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = String(element.className || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((name) => `.${name}`)
      .join('');

    return `${tag}${id}${classes}`;
  }

  /** Resume lisible d'un nœud de texte. */
  function describeNode(node) {
    if (!node || typeof node.nodeValue !== 'string') {
      return '(aucun)';
    }

    const text = node.nodeValue.trim().replace(/\s+/g, ' ');
    const short = text.length > 40 ? `${text.slice(0, 40)}…` : text;

    return `${describeElement(node.parentElement)} «${short}»`;
  }

  /**
   * Affiche dans la console tout ce que l'extension « voit » sous la souris.
   *
   * Raccourci : Alt + Maj + D. Prevue pour le diagnostic : si un prix n'est
   * pas converti, ce rapport dit exactement ou le raisonnement s'arrete
   * (element sans texte, texte reconstitue vide, aucun montant detecte...).
   */
  function dumpDiagnostics() {
    if (typeof console === 'undefined' || typeof console.group !== 'function') {
      return;
    }

    const point = lastPointer || { x: 0, y: 0 };

    console.group(`${LOG_PREFIX} diagnostic au point (${point.x}, ${point.y})`);

    // 1. La pile des elements sous le curseur (les superpositions sont vues).
    let stack = [];
    try {
      stack = typeof document.elementsFromPoint === 'function'
        ? (document.elementsFromPoint(point.x, point.y) || [])
        : [];
    } catch (error) {
      stack = [];
    }

    console.log('1. elements sous le curseur :',
      stack.slice(0, 8).map(describeElement));

    // 2. La position du curseur dans le texte.
    const position = caretPositionAt(point.x, point.y);
    console.log('2. curseur dans le texte :',
      position && position.node
        ? `${describeNode(position.node)} decalage ${position.offset}`
        : 'aucun (un element sans texte recouvre peut-etre le prix)');

    // 3. La suite reconstituee (le texte recolle).
    if (position && position.node) {
      const root = runRootFor(position.node);
      if (root) {
        const info = buildRun(root);
        console.log('3. suite reconstituee :',
          `${describeElement(root)} -> ${JSON.stringify(info.text)} ` +
          `(${info.parts.length} morceau(x))`);

        const detected = findAmountsInText(info.text);
        console.log('4. montants dans cette suite :',
          detected.length === 0
            ? 'aucun'
            : detected.map((amount) => `${amount.text} = ${amount.value} ${amount.currency}`));

        const units = findUnitsInText(info.text);
        if (units.length > 0) {
          console.log('   unites :', units.map((unit) => unit.text));
        }
      }
    }

    // 5. Ce que chaque methode de recherche trouve au meme point.
    try {
      const byImage = amountInImageAt(point.x, point.y);
      const byCaret = amountAtPoint(point.x, point.y);
      const byRect = amountByRectAt(point.x, point.y);

      console.log('5. resultats :', {
        image: byImage ? `${byImage.amount ? byImage.amount.text : 'unite'}` : 'rien',
        curseur: byCaret ? `${byCaret.amount ? byCaret.amount.text : 'unite'}` : 'rien',
        spatial: byRect ? `${byRect.amount ? byRect.amount.text : 'unite'}` : 'rien'
      });
    } catch (error) {
      console.warn('5. resultats : erreur', error.message);
    }

    console.log(
      'Rappel : la detection se suspend depuis le popup ; ' +
      'ce rapport peut etre copie et transmis.'
    );
    console.groupEnd();
  }

  /** Vrai si la touche est « D » (diagnostic). */
  function isDebugKey(event) {
    if (event.code) {
      return event.code === DEBUG_SHORTCUT.code;
    }
    return String(event.key || '').toLowerCase() === 'd';
  }

  /** Ecoute le raccourci de diagnostic Alt + Maj + D (developpement). */
  function onGlobalKeyDown(event) {
    if (!event) {
      return;
    }

    // ECHAP : referme une bulle FIGEE (accessibilite clavier).
    // Sans cela, une bulle ouverte par un clic ne pouvait etre fermee qu'a la
    // souris — impossible pour qui n'utilise pas de souris.
    if ((event.key === 'Escape' || event.key === 'Esc') && frozen) {
      event.preventDefault();
      event.stopPropagation();
      dismissFrozenTooltip();
      return;
    }

    const debugModifiers =
      event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;

    // Alt + Maj + D : rapport de diagnostic dans la console.
    if (debugModifiers && isDebugKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      dumpDiagnostics();
      return;
    }
  }

  // =========================================================================
  //  4ter. IMAGES : MONTANTS ECRITS DANS LES ATTRIBUTS
  // =========================================================================
  //
  // Rappel de vocabulaire : une balise <img> n'a pas de texte lisible. Mais
  // elle peut porter une description entre guillemets (l'attribut « alt »),
  // ecrite par l'auteur du site. C'est du texte comme un autre : on l'analyse.
  //
  // Sur les sites marchands, cet attribut contient souvent le nom du produit
  // et son prix : « Casque Bluetooth - 79,99 EUR ».

  /** Analyse les attributs d'une image. Retourne true si un montant est trouve. */
  function scanImage(image) {
    if (!image || image.tagName !== 'IMG' || !detectCurrencies) {
      return false;
    }

    // Une image CASSEE affiche le texte de son attribut « alt » a l'ecran.
    // Lire ce texte reviendrait a convertir un texte deja visible sur la page,
    // avec une bulle au survol de l'icone d'image cassee. On ignore donc les
    // images qui ne se sont pas chargees.
    if (image.complete === true && image.naturalWidth === 0) {
      imageAmounts.delete(image);
      scannedImages.delete(image);
      return false;
    }

    for (const attribute of IMAGE_AMOUNT_ATTRIBUTES) {
      let value = null;
      try {
        value = image.getAttribute ? image.getAttribute(attribute) : null;
      } catch (error) {
        value = null;
      }

      if (!value || !String(value).trim()) {
        continue;
      }

      const amounts = findAmountsInText(String(value))
        .filter((amount) => !isReferenceAmount(amount));
      if (amounts.length > 0) {
        imageAmounts.set(image, amounts);
        scannedImages.add(image);
        return true;
      }
    }

    // Aucun montant : on oublie cette image (son attribut a peut-etre change).
    imageAmounts.delete(image);
    scannedImages.delete(image);
    return false;
  }

  /**
   * Analyse les images d'une portion de page (toute la page par defaut).
   *
   * @param {Element} [root]
   * @returns {number} nombre d'images porteuses d'un montant
   */
  function scanImages(root) {
    const scope = root || document;

    let images = [];
    try {
      images = Array.from(scope.querySelectorAll('img'));
    } catch (error) {
      return 0;
    }

    let found = 0;

    // Si la racine elle-meme est une image (element ajoute dynamiquement),
    // querySelectorAll ne la renvoie pas : on la traite a part.
    if (scope.nodeType === 1 && scope.tagName === 'IMG') {
      if (scanImage(scope)) {
        found += 1;
      }
    }

    for (const image of images) {
      if (scanImage(image)) {
        found += 1;
      }
    }

    return found;
  }

  /**
   * Vrai si le point (x, y) tombe sur l'intervalle de texte couvert par « entry ».
   *
   * On interroge les RECTANGLES du navigateur (getClientRects) et non le seul
   * rectangle englobant : un texte replie sur deux lignes donne deux
   * rectangles, et un rectangle englobant couvrirait a tort l'espace vide
   * entre les deux.
   */
  function entryContainsPoint(node, entry, clientX, clientY) {
    const tolerance = 2;

    try {
      const range = probeRange();
      range.setStart(node, entry.start);
      range.setEnd(node, entry.end);

      const rects = typeof range.getClientRects === 'function'
        ? range.getClientRects()
        : [range.getBoundingClientRect()];

      for (const rect of rects) {
        if (!rect) {
          continue;
        }
        if (clientX >= rect.left - tolerance &&
            clientX <= rect.right + tolerance &&
            clientY >= rect.top - tolerance &&
            clientY <= rect.bottom + tolerance) {
          return true;
        }
      }
    } catch (error) {
      return false;
    }

    return false;
  }

  /**
   * Cherche un montant dans le sous-arbre d'un element, au point donne.
   *
   * @returns {object|null}
   */
  function findAmountInSubtree(element, clientX, clientY) {
    let node;
    let inspected = 0;

    try {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

      while ((node = walker.nextNode()) !== null) {
        inspected += 1;
        if (inspected > 160) {
          break;
        }

        const amounts = foundByNode.get(node);
        if (amounts) {
          for (const entry of amounts) {
            if (entryContainsPoint(node, entry, clientX, clientY)) {
              return { kind: 'currency', amount: entry.amount, fromRect: true };
            }
          }
        }

        const units = unitByNode.get(node);
        if (units) {
          for (const entry of units) {
            if (entryContainsPoint(node, entry, clientX, clientY)) {
              return { kind: 'unit', unit: entry.unit, fromRect: true };
            }
          }
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  /**
   * DERNIER RECOURS : retrouve un montant par test SPATIAL.
   *
   * POURQUOI CE RECOURS EXISTE (cas reel Amazon)
   * --------------------------------------------
   * Les cases de variantes (« 90 Unite (Lot de 48) ») sont recouvertes d'un
   * lien transparent qui occupe toute la case :
   *
   *   <a class="page-load-link" style="height:100%; width:100%"></a>
   *
   * Ce lien n'a AUCUN texte. L'API qui donne la position du curseur dans le
   * texte (caretPositionFromPoint) tombe donc sur un element muet, et renvoie
   * une position sans rapport — ou rien du tout. Le prix, lui, est bien la,
   * juste dessous.
   *
   * On demande donc au navigateur la PILE des elements au point
   * (elementsFromPoint, qui voit a travers les superpositions), puis on teste
   * les rectangles des montants deja detectes. Ce test ne depend ni des liens
   * transparents, ni des superpositions.
   */
  function amountByRectAt(clientX, clientY) {
    if (indexedNodes.size === 0) {
      return null;
    }

    if (typeof document.elementsFromPoint !== 'function') {
      return null;
    }

    let stack = [];
    try {
      stack = document.elementsFromPoint(clientX, clientY) || [];
    } catch (error) {
      return null;
    }

    let inspected = 0;

    for (const element of stack) {
      if (!element || element.nodeType !== 1) {
        continue;
      }

      if (isInsideOurUi(element)) {
        continue;
      }

      // On se limite aux petites zones (une case, un prix, une vignette).
      // Une page entiere couterait trop cher a parcourir a chaque survol.
      let rect = null;
      try {
        rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
      } catch (error) {
        rect = null;
      }

      if (!rect || rect.width > 900 || rect.height > 700) {
        continue;
      }

      const hit = findAmountInSubtree(element, clientX, clientY);
      if (hit) {
        return hit;
      }

      inspected += 1;
      if (inspected >= 4) {
        break;
      }
    }

    return null;
  }

  /**
   * Cherche un montant porte par l'image situee sous le curseur.
   *
   * On remonte la chaine des parents sur quelques niveaux : le curseur peut
   * tomber sur le <a> qui entoure l'image, ou sur un <span> pose dessus.
   *
   * @returns {object|null} un resultat de la meme forme que amountAtPoint
   */
  function amountInImageAt(clientX, clientY) {
    // Economie importante : si aucune image de la page ne porte de prix, on
    // evite un test de survol (elementFromPoint) a chaque deplacement de
    // souris. Sur une page sans image, le cout est donc nul.
    if (scannedImages.size === 0) {
      return null;
    }

    if (typeof document.elementFromPoint !== 'function') {
      return null;
    }

    let element = null;
    try {
      element = document.elementFromPoint(clientX, clientY);
    } catch (error) {
      return null;
    }

    let current = element;
    let depth = 0;

    while (current && depth < 4) {
      if (current.nodeType === 1) {
        const amounts = imageAmounts.get(current);
        if (amounts && amounts.length > 0) {
          return { kind: 'currency', amount: amounts[0], fromImage: true };
        }
        // Une image sans montant arrete la recherche : inutile de remonter
        // jusqu'a la vignette du produit, qui n'apporte rien.
        if (current.tagName === 'IMG') {
          return null;
        }
      }
      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  // =========================================================================
  //  TEXTE RECONSTITUE : LES PRIX COUPES EN PLUSIEURS BALISES
  // =========================================================================
  //
  // PROBLEME REEL (constate sur Amazon)
  // -----------------------------------
  // Un prix n'est pas toujours UN morceau de texte. Les sites decoupent
  // souvent l'affichage pour styler chaque partie :
  //
  //   <span class="a-price-symbol">€</span>
  //   <span class="a-price-whole">54<span>,</span></span>
  //   <span class="a-price-fraction">00</span>
  //
  // Aucun de ces morceaux ne contient « 54,00 € » a lui seul : une analyse
  // morceau par morceau ne voit donc AUCUN montant. C'est exactement ce qui
  // se passait avant cette correction.
  //
  // SOLUTION
  // --------
  // On reconstitue le texte d'une « suite » : des morceaux de texte affiches
  // cote a cote, dans un meme conteneur en ligne. On analyse ce texte
  // reconstitue, puis on repartit chaque montant trouve sur les morceaux qu'il
  // couvre. Le survol, le soulignement et la bulle continuent donc de
  // fonctionner morceau par morceau.

  /** Balises qui s'affichent « dans le fil » du texte (inline). */
  const INLINE_RUN_TAGS = new Set([
    'SPAN', 'A', 'B', 'I', 'EM', 'STRONG', 'SMALL', 'BIG', 'FONT', 'TT',
    'SUB', 'SUP', 'BDI', 'BDO', 'LABEL', 'MARK', 'U', 'S', 'STRIKE',
    'ABBR', 'ACRONYM', 'CITE', 'Q', 'TIME', 'DFN', 'INS', 'DEL', 'NOBR'
  ]);

  /** Longueur maximale d'un conteneur que l'on accepte de fusionner. */
  const RUN_MAX_LENGTH = 240;

  /** Nombre maximal de niveaux remontes pour trouver le conteneur d'une suite. */
  const RUN_MAX_DEPTH = 4;

  /** Cache des suites pour la passe d'analyse en cours. */
  const runCache = new Map();

  /** Vrai si le nœud de texte est dans une zone interdite. */
  /**
   * Cache « cet element est-il dans une zone interdite ? ».
   *
   * POURQUOI : la version precedente remontait toute la chaine des parents
   * POUR CHAQUE NŒUD DE TEXTE, a chaque analyse. Sur une page de 3 500
   * paragraphes et 10 niveaux, cela faisait 35 000 verifications. Le cache
   * rend le cout amorti O(1) par element. Il est vide a chaque lot de
   * mutations (voir handleMutations) pour rester exact si un attribut change.
   */
  let skippedZoneCache = new WeakMap();

  function elementIsInSkippedZone(element) {
    if (!element || element.nodeType !== 1) {
      return false;
    }

    const cached = skippedZoneCache.get(element);
    if (cached !== undefined) {
      return cached;
    }

    const own = SKIPPED_TAGS.has(String(element.tagName || '').toUpperCase()) ||
      element.isContentEditable === true ||
      Boolean(element.hasAttribute && element.hasAttribute('data-unic'));
    const result = own || elementIsInSkippedZone(element.parentElement);
    skippedZoneCache.set(element, result);
    return result;
  }

  function isInsideSkippedZone(node) {
    return elementIsInSkippedZone(node.parentElement);
  }

  /**
   * Trouve le conteneur de la suite a laquelle appartient un nœud de texte.
   *
   * On remonte tant que le parent est un element INLINE : franchir un bloc
   * (div, td, li, p...) melangerait des colonnes ou des lignes differentes.
   */
  function runRootFor(node) {
    let current = node.parentElement;
    if (!current) {
      return null;
    }

    let root = current;
    let depth = 0;

    while (current && depth < RUN_MAX_DEPTH) {
      const parent = current.parentElement;
      if (!parent) {
        break;
      }

      const parentTag = String(parent.tagName || '').toUpperCase();
      if (!INLINE_RUN_TAGS.has(parentTag)) {
        break;
      }

      const parentText = parent.textContent || '';
      if (parentText.length > RUN_MAX_LENGTH) {
        break;
      }

      root = parent;
      current = parent;
      depth += 1;
    }

    return root;
  }

  /**
   * Reconstitue le texte d'un conteneur et la position de chaque morceau.
   *
   * @returns {{root: Element, text: string, parts: Array, done: boolean}}
   */
  function buildRun(root) {
    const parts = [];
    let text = '';

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

    let node;
    while ((node = walker.nextNode()) !== null) {
      if (!node.nodeValue) {
        continue;
      }

      if (isInsideSkippedZone(node)) {
        // Une zone interdite separe : un montant ne doit pas la traverser.
        text += ' ';
        continue;
      }

      parts.push({
        node: node,
        start: text.length,
        end: text.length + node.nodeValue.length
      });

      text += node.nodeValue;
    }

    return { root: root, text: text, parts: parts, done: false, matches: 0 };
  }

  /** Retourne la suite du nœud (avec cache pour la passe en cours). */
  function runForNode(node) {
    const root = runRootFor(node);
    if (!root) {
      return null;
    }

    // Cas limite : un texte place directement dans <body> (ou dans <html>)
    // ferait de la PAGE ENTIERE sa « suite ». On se limite alors a ce seul
    // morceau : le prix ne peut pas etre recolle a travers toute la page.
    if (root === document.body || root === document.documentElement) {
      const value = node.nodeValue || '';
      return {
        root: node,
        text: value,
        parts: [{ node: node, start: 0, end: value.length }],
        done: false,
        matches: 0
      };
    }

    let info = runCache.get(root);
    if (!info) {
      info = buildRun(root);
      runCache.set(root, info);
    }

    return info;
  }

  /**
   * Analyse une suite et repartit les montants trouves sur ses morceaux.
   *
   * Chaque montant devient une « entree » attachee a chacun des morceaux qu'il
   * couvre, avec des positions RELATIVES a ce morceau. Le reste du code
   * (surlignage, survol) continue ainsi de raisonner morceau par morceau.
   */
  /** Vrai si le montant est deja dans la monnaie de reference. */
  function isReferenceAmount(amount) {
    return referenceUnitsEnabled && amount && amount.currency &&
      amount.currency.code === defaultTargetCurrency;
  }

  /** Vrai si l'unite appartient deja au systeme de reference (sauf Kelvin). */
  function isReferenceUnit(unit) {
    if (!referenceUnitsEnabled || !unit || !unit.system) {
      return false;
    }
    const isKelvin = unit.category === 'temperature' &&
      (unit.unit.tokens || []).indexOf('K') !== -1;
    return !isKelvin && unit.system === targetSystem;
  }

  /** Vrai si l'heure est deja dans le fuseau de reference. */
  function isReferenceTime(time) {
    if (!referenceUnitsEnabled || !time || !time.zone) {
      return false;
    }
    const reference = tzZoneFromId(defaultTargetTimezone || tzLocalZoneId());
    if (time.zone.iana && reference.iana && time.zone.iana === reference.iana) {
      return true;
    }
    const now = Date.now();
    return tzOffsetMinutesAt(time.zone, now) === tzOffsetMinutesAt(reference, now);
  }

  function indexRun(info) {
    info.done = true;

    // Iteration 8 : l'utilisateur peut desactiver les devises ou les unites.
    // Un seul test de chiffre pour les trois moteurs : unites et fuseaux
    // exigent un nombre, les montants numeriques aussi (les nombres en
    // lettres restent analyses separement).
    const hasDigit = /\d/.test(info.text);
    // Les valeurs deja dans les unites de reference ne sont ni soulignees ni
    // survolees : inutile de convertir des euros en euros, des metres en
    // metres ou l'heure de Paris vers Paris.
    const amounts = (detectCurrencies ? findAmountsInText(info.text, hasDigit) : [])
      .filter((amount) => !isReferenceAmount(amount));
    const units = (detectUnits && HAS_QUANTITY.test(info.text) ? findUnitsInText(info.text) : [])
      .filter((unit) => !isReferenceUnit(unit));
    const times = (detectTimezones && hasDigit ? tzFindTimes(info.text) : [])
      .filter((time) => !isReferenceTime(time));
    info.matches = amounts.length + units.length + times.length;

    // On repart de zero pour ces morceaux : un texte a pu changer.
    for (const part of info.parts) {
      foundByNode.delete(part.node);
      unitByNode.delete(part.node);
      timeByNode.delete(part.node);
      indexedNodes.delete(part.node);
    }

    function distribute(detection, kind) {
      for (const part of info.parts) {
        const from = Math.max(detection.start, part.start);
        const to = Math.min(detection.end, part.end);

        if (to <= from) {
          continue;
        }

        const entry = {
          kind: kind,
          start: from - part.start,
          end: to - part.start,
          amount: kind === 'currency' ? detection : null,
          unit: kind === 'unit' ? detection : null,
          time: kind === 'time' ? detection : null
        };

        indexedNodes.add(part.node);

        const map = kind === 'currency' ? foundByNode
          : kind === 'unit' ? unitByNode
          : timeByNode;
        const list = map.get(part.node);
        if (list) {
          list.push(entry);
        } else {
          map.set(part.node, [entry]);
        }
      }
    }

    for (const amount of amounts) {
      distribute(amount, 'currency');
    }
    for (const unit of units) {
      distribute(unit, 'unit');
    }
    for (const time of times) {
      distribute(time, 'time');
    }

    return info.matches;
  }

  /**
   * Analyse UN nœud de texte et met a jour les detections.
   *
   * Le travail reel se fait par « suite » (voir plus haut) : plusieurs nœuds
   * voisins sont analyses ensemble, et le resultat est reparti sur chacun.
   * Un nœud appartenant a une suite deja analysee ne coute donc presque rien.
   *
   * @param {Node} node - un nœud de texte
   * @returns {number} nombre de montants + unites trouves pour cette suite
   */
  function processTextNode(node) {
    if (!node || typeof node.nodeValue !== 'string') {
      return 0;
    }

    if (!node.nodeValue.trim()) {
      return 0;
    }

    // On ignore les zones interdites : code, champs de saisie, zones ou
    // l'utilisateur est en train de taper, et notre propre interface.
    if (isInsideSkippedZone(node)) {
      return 0;
    }

    // Iteration 7 : un bloc fait uniquement de chiffres (statistiques, jeu de
    // donnees) n'est pas analyse du tout.
    if (looksLikeNumberDump(node.nodeValue)) {
      noteRejection('dump');
      foundByNode.delete(node);
      unitByNode.delete(node);
      timeByNode.delete(node);
      indexedNodes.delete(node);
      return 0;
    }

    const info = runForNode(node);

    if (!info) {
      scannedNodes.add(node);
      foundByNode.delete(node);
      unitByNode.delete(node);
      timeByNode.delete(node);
      indexedNodes.delete(node);
      return 0;
    }

    for (const part of info.parts) {
      scannedNodes.add(part.node);
    }

    if (info.done) {
      return 0;
    }

    return indexRun(info);
  }

  /**
   * Analyse toute la page (premiere passe, au demarrage).
   *
   * @returns {{nodes: number, matches: number, date: Date}}
   */
  function scanDocument() {
    const stats = { nodes: 0, matches: 0, date: new Date() };

    if (!document.body) {
      return stats;
    }

    // On repart d'une liste vide : les nœuds qui ne sont plus dans la page
    // (contenu remplace, element supprime) disparaissent ainsi tout seuls.
    scannedNodes.clear();
    scannedImages.clear();
    indexedNodes.clear();
    runCache.clear();
    skippedZoneCache = new WeakMap();

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while ((node = walker.nextNode()) !== null) {
      stats.nodes += 1;
      stats.matches += processTextNode(node);
    }

    // Iteration 7bis : les montants ecrits dans les attributs des images.
    // Ce n'est pas de l'OCR : c'est du texte present dans le HTML.
    stats.images = scanImages();

    applyHighlights();
    return stats;
  }

  // =========================================================================
  //  4bis. CONTENU DYNAMIQUE (MutationObserver)
  // =========================================================================
  //
  // Iteration 6. Beaucoup de sites (React, scroll infini, YouTube, Amazon)
  // injectent du contenu APRES le chargement initial. Un simple scan au
  // demarrage ne suffit donc pas : on surveille les modifications du DOM.

  /** Delai de regroupement : on attend la fin d'une rafale de modifications. */
  const OBSERVER_DEBOUNCE_MS = 300;

  /**
   * Limite de securite : au-dela de ce nombre de nœuds dans une meme rafale,
   * on relit la page en entier au lieu de traiter element par element. Mieux
   * vaut une relecture complete qu'oublier silencieusement des montants.
   */
  const OBSERVER_MAX_NODES = 3000;

  /** Le surveillant, cree au demarrage. */
  let mutationObserver = null;

  /** Nœuds en attente de traitement (un Set evite les doublons). */
  const pendingNodes = new Set();

  /** Minuterie du regroupement. */
  let observerTimer = null;

  /** Statistiques du surveillant, affichees dans le popup. */
  const observerStats = {
    batches: 0,
    nodes: 0,
    images: 0,
    lastDuration: 0,
    updatedAt: 0
  };

  /** Derniere publication des stats (pour ne pas ecrire trop souvent). */
  let lastStatsPublishedAt = 0;

  /** Publication differee en attente, pour ne perdre aucune mise a jour. */
  let statsPublishTimer = null;

  /** Intervalle minimum entre deux ecritures des statistiques (1 seconde). */
  const STATS_MIN_INTERVAL_MS = 1000;

  /** Vrai si le nœud appartient a l'interface de l'extension (bulle, menu). */
  function isInsideOurUi(node) {
    let current = node;
    while (current) {
      if (current.nodeType === 1 &&
          current.hasAttribute &&
          current.hasAttribute('data-unic')) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  /** Vrai si l'element est une zone a ignorer (saisie, code...). */
  function isSkippedElement(element) {
    if (!element || !element.tagName) {
      return false;
    }
    if (SKIPPED_TAGS.has(element.tagName)) {
      return true;
    }
    if (element.isContentEditable) {
      return true;
    }
    return false;
  }

  /** Programme le traitement des nœuds en attente (regroupement). */
  function scheduleObserverProcess() {
    if (observerTimer) {
      return;
    }
    observerTimer = setTimeout(processPendingNodes, OBSERVER_DEBOUNCE_MS);
  }

  /**
   * Traite les nœuds accumules depuis la derniere rafale.
   *
   * On ne re-scanne PAS toute la page : uniquement les nœuds ajoutes ou
   * modifies. C'est ce qui garde l'extension discrete en performance.
   */
  function processPendingNodes() {
    observerTimer = null;

    const startedAt = Date.now();
    const nodes = Array.from(pendingNodes);
    pendingNodes.clear();

    // Le DOM vient de changer : les suites reconstituees ne sont plus valables,
    // et un attribut a pu changer (contenteditable, data-unic).
    runCache.clear();
    skippedZoneCache = new WeakMap();

    if (nodes.length === 0) {
      return;
    }

    // Soupape de securite : si une rafale depasse largement ce qu'on sait
    // traiter, une seule relecture complete de la page est plus sure (et plus
    // honnete) que d'ignorer silencieusement des elements. Ce cas ne se
    // produit que sur des pages extremement agressives.
    if (nodes.length > OBSERVER_MAX_NODES) {
      const stats = scanDocument();

      observerStats.batches += 1;
      observerStats.nodes = stats.nodes;
      observerStats.lastDuration = Date.now() - startedAt;
      observerStats.updatedAt = Date.now();
      publishObserverStats();
      return;
    }

    let processed = 0;

    for (const node of nodes) {
      if (processed >= OBSERVER_MAX_NODES) {
        break;
      }
      if (!node || !node.isConnected || isInsideOurUi(node)) {
        continue;
      }

      if (node.nodeType === 3) {
        // Un texte a change : on le reanalyse.
        processTextNode(node);
        processed += 1;
        continue;
      }

      if (node.nodeType !== 1) {
        continue;
      }

      if (isSkippedElement(node)) {
        continue;
      }

      // Element ajoute : on analyse aussi les images qu'il contient.
      scanImages(node);

      // Element ajoute : on analyse tous ses nœuds de texte.
      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        null
      );

      let textNode;
      while ((textNode = walker.nextNode()) !== null) {
        if (processed >= OBSERVER_MAX_NODES) {
          break;
        }
        processTextNode(textNode);
        processed += 1;
      }
    }

    applyHighlights();

    observerStats.batches += 1;
    observerStats.nodes += processed;
    observerStats.lastDuration = Date.now() - startedAt;
    observerStats.updatedAt = Date.now();
    publishObserverStats();
  }

  /**
   * Publie les statistiques dans le stockage, pour que le popup puisse les
   * afficher. On limite les ecritures a une toutes les 2 secondes.
   */
  function publishObserverStats(force) {
    const now = Date.now();
    const elapsed = now - lastStatsPublishedAt;

    if (!force && elapsed < STATS_MIN_INTERVAL_MS) {
      // Trop tot : on programme une publication differee. Sans cela, une
      // page tres active verrait son compteur reste bloque sur une vieille
      // valeur, puisqu'on repondrait « trop tot » a chaque fois.
      if (!statsPublishTimer) {
        statsPublishTimer = setTimeout(function () {
          statsPublishTimer = null;
          publishObserverStats(true);
        }, STATS_MIN_INTERVAL_MS - elapsed);
      }
      return;
    }

    lastStatsPublishedAt = now;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          'uniconv.observerStats': {
            batches: observerStats.batches,
            nodes: observerStats.nodes,
            images: observerStats.images || 0,
            lastDuration: observerStats.lastDuration,
            updatedAt: observerStats.updatedAt,
            // Iteration 7 : quoi a ete ignore, et pourquoi.
            rejections: Object.assign({}, REJECTION_COUNTS),
            host: safeHostname()
          }
        });
      }
    } catch (error) {
      // Stockage indisponible.
    }
  }

  /**
   * Demarre la surveillance du DOM.
   *
   * Trois precautions :
   *   1. on ne traite que les nœuds AJOUTES ou MODIFIES (pas toute la page) ;
   *   2. on regroupe les modifications (debounce de 300 ms) ;
   *   3. on ignore notre propre interface et les zones de saisie.
   */
  function startObserver() {
    if (mutationObserver || typeof MutationObserver === 'undefined' || !document.body) {
      return;
    }

    mutationObserver = new MutationObserver(function (mutations) {
      let queued = 0;
      let attributesTouched = 0;

      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const target = mutation.target;
          if (target && !isInsideOurUi(target)) {
            pendingNodes.add(target);
            queued += 1;
          }
          continue;
        }

        if (mutation.type === 'attributes') {
          // Un attribut d'image vient de changer : cas tres courant avec le
          // chargement paresseux (« lazy loading »), ou « alt » n'arrive
          // qu'apres l'affichage de l'image.
          if (mutation.target && mutation.target.tagName === 'IMG' &&
              !isInsideOurUi(mutation.target)) {
            scanImage(mutation.target);
            attributesTouched += 1;
            queued += 1;
          }
          continue;
        }

        if (mutation.type === 'childList') {
          for (const added of mutation.addedNodes) {
            if (added.nodeType !== 1 && added.nodeType !== 3) {
              continue;
            }
            if (isInsideOurUi(added)) {
              continue;
            }
            pendingNodes.add(added);
            queued += 1;
          }
        }
      }

      if (queued > 0) {
        scheduleObserverProcess();
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      // Iteration 7bis : les prix caches dans « alt » arrivent parfois apres
      // coup (chargement paresseux). On surveille donc ces trois attributs.
      attributes: true,
      attributeFilter: ['alt', 'title', 'aria-label']
    });

    console.log(`${LOG_PREFIX} surveillance du contenu dynamique activee`);
  }

  /**
   * Demande au navigateur de souligner tous les montants trouves.
   *
   * L'API « CSS Custom Highlight » souligne du texte SANS ajouter la moindre
   * balise dans la page. Le site ne s'apercoit donc de rien.
   */
  function applyHighlights() {
    if (typeof Highlight === 'undefined' ||
        typeof CSS === 'undefined' ||
        !CSS.highlights) {
      return;
    }

    try {
      const ranges = [];

      // Un nœud retire de la page ne doit ni couter du temps a chaque lot, ni
      // retenir la memoire (les WeakMap liberent leurs entrees, pas le Set).
      for (const image of scannedImages) {
        if (image.isConnected === false) {
          scannedImages.delete(image);
          imageAmounts.delete(image);
        }
      }

      for (const node of scannedNodes) {
        if (!node.isConnected) {
          scannedNodes.delete(node);
          foundByNode.delete(node);
          unitByNode.delete(node);
          timeByNode.delete(node);
          indexedNodes.delete(node);
          continue;
        }

        // 1. Devises.
        const amounts = foundByNode.get(node);
        if (amounts) {
          for (const amount of amounts) {
            const range = document.createRange();
            range.setStart(node, amount.start);
            range.setEnd(node, amount.end);
            ranges.push(range);
          }
        }

        // 2. Unites de mesure (elles etaient omises dans une version
        //    precedente : pas de pointilles sous les unites).
        const units = unitByNode.get(node);
        if (units) {
          for (const unit of units) {
            const range = document.createRange();
            range.setStart(node, unit.start);
            range.setEnd(node, unit.end);
            ranges.push(range);
          }
        }

        // 3. Heures et fuseaux horaires (iteration 11).
        const times = timeByNode.get(node);
        if (times) {
          for (const time of times) {
            const range = document.createRange();
            range.setStart(node, time.start);
            range.setEnd(node, time.end);
            ranges.push(range);
          }
        }
      }

      if (ranges.length > 0) {
        CSS.highlights.set('unicorn-amount', new Highlight(...ranges));
      } else {
        CSS.highlights.delete('unicorn-amount');
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} surlignage indisponible :`, error.message);
    }
  }

  /**
   * Retrouve le montant precis situe sous le curseur de la souris.
   */
  function amountAtPoint(clientX, clientY) {
    if (indexedNodes.size === 0) {
      return null;
    }

    const position = caretPositionAt(clientX, clientY);
    if (!position || !position.node) {
      return null;
    }

    // 1. Devises.
    //
    // « entry » couvre une PORTION du morceau survole ; « entry.amount » est
    // le montant complet (qui peut s'etendre sur plusieurs morceaux voisins).
    const amounts = foundByNode.get(position.node);
    if (amounts) {
      for (const entry of amounts) {
        // Intervalle « debut inclus, fin EXCLUE ».
        if (position.offset >= entry.start && position.offset < entry.end) {
          return {
            kind: 'currency',
            amount: entry.amount,
            rect: rectOfAmount(position.node, entry)
          };
        }
      }
    }

    // 2. Unites de mesure.
    const units = unitByNode.get(position.node);
    if (units) {
      for (const entry of units) {
        if (position.offset >= entry.start && position.offset < entry.end) {
          return {
            kind: 'unit',
            unit: entry.unit,
            rect: rectOfAmount(position.node, entry)
          };
        }
      }
    }

    // 3. Heures et fuseaux horaires.
    const times = timeByNode.get(position.node);
    if (times) {
      for (const entry of times) {
        if (position.offset >= entry.start && position.offset < entry.end) {
          return {
            kind: 'time',
            time: entry.time,
            rect: rectOfAmount(position.node, entry)
          };
        }
      }
    }

    return null;
  }

  /**
   * Demande au navigateur le caractere situe a une position de l'ecran.
   *
   * PIEGE : « caretPositionFromPoint » renvoie un objet « CaretPosition » dont
   * le nœud s'appelle **offsetNode**. Il n'y a PAS de propriete « node ».
   * Une version precedente lisait position.node, obtenait « undefined », et
   * n'affichait donc jamais la bulle.
   */
  function caretPositionAt(clientX, clientY) {
    if (typeof document.caretPositionFromPoint === 'function') {
      const position = document.caretPositionFromPoint(clientX, clientY);
      if (!position) {
        return null;
      }
      const node = position.offsetNode || position.node;
      if (!node || typeof position.offset !== 'number') {
        return null;
      }
      return { node: node, offset: position.offset };
    }

    if (typeof document.caretRangeFromPoint === 'function') {
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (!range) {
        return null;
      }
      return { node: range.startContainer, offset: range.startOffset };
    }

    return null;
  }

  /** Calcule le rectangle occupe a l'ecran par un montant. */
  /**
   * Range reutilise pour les mesures de survol.
   *
   * POURQUOI : le survol creait un Range par montant, a chaque mouvement.
   * Un seul objet suffit : on ne conserve jamais le Range au-dela du calcul.
   */
  let sharedProbeRange = null;

  function probeRange() {
    if (!sharedProbeRange) {
      sharedProbeRange = document.createRange();
    }
    return sharedProbeRange;
  }

  function rectOfAmount(node, amount) {
    try {
      const range = probeRange();
      range.setStart(node, amount.start);
      range.setEnd(node, amount.end);
      return range.getBoundingClientRect();
    } catch (error) {
      return null;
    }
  }

  // =========================================================================
  //  5. AFFICHAGE DE LA BULLE
  // =========================================================================

  /** Style de l'extension, injecte dans la page au demarrage. */
  const STYLE_TEXT = `
    .unicorn-tooltip {
      position: fixed;
      z-index: 2147483647;

      /* LARGEUR : la bulle s'adapte a son contenu, mais ne depasse jamais
         320 pixels par defaut. L'utilisateur peut l'agrandir via la poignee
         de redimensionnement (le style « width » est alors applique en ligne,
         plafonne a 700 px). */
      width: max-content;
      max-width: 320px;
      box-sizing: border-box;

      /* « white-space: normal » autorise le retour a la ligne. La version
         precedente utilisait « nowrap » : le texte ne pouvait donc PAS
         revenir a la ligne et depassait de la bulle. */
      white-space: normal;
      overflow-wrap: break-word;
      word-break: break-word;

      padding: 10px 12px;
      border: 1px solid #16325c;
      border-radius: 8px;
      background-color: #1b4ed1;
      background-image: linear-gradient(180deg, #2a62e8 0%, #1b4ed1 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                   "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.45;
      letter-spacing: 0.01em;
      box-shadow: 0 4px 14px rgba(12, 32, 80, 0.32);
      margin: 0 !important;
      text-align: left !important;
      text-transform: none !important;
      text-indent: 0 !important;
      opacity: 1 !important;
      visibility: visible !important;

      /* La bulle est interactive : elle contient un menu deroulant de
         devises. pointer-events doit donc etre « auto » (et non « none »). */
      pointer-events: auto;
    }

    /* ---- SELECTION D'UNE ZONE A LIRE (OCR, iteration 10) ----------------
       Un voile sombre couvre la page, et le rectangle dessine a la souris
       laisse voir la zone choisie. « pointer-events » est indispensable :
       sans lui, la page continuerait de recevoir les clics. */
    .unicorn-ocr-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483646;
      background: rgba(15, 23, 42, 0.22);
      cursor: crosshair;
      pointer-events: auto;
    }

    .unicorn-ocr-frame {
      position: fixed;
      z-index: 2147483647;
      border: 2px solid #2f6bff;
      background: rgba(47, 107, 255, 0.12);
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.18);
      pointer-events: none;
      border-radius: 2px;
    }

    .unicorn-ocr-hint {
      position: fixed;
      z-index: 2147483647;
      left: 50%;
      top: 14px;
      transform: translateX(-50%);
      max-width: 80vw;
      padding: 8px 14px;
      border-radius: 8px;
      background: #111827;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      line-height: 1.35;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.28);
      pointer-events: none;
    }

    /* ---- THEME CLAIR (iteration 8) --------------------------------------
       Le theme sombre est celui d'origine (degrade bleu). Le theme clair
       reprend les memes elements en fond blanc : il est plus lisible sur les
       pages claires, et il respecte le choix « auto » du systeme. */
    .unicorn-tooltip.unicorn-theme-light {
      border: 1px solid #d7dce5;
      background-color: #ffffff;
      background-image: none;
      color: #111827;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.16);
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-tooltip-detail {
      color: #6b7280;
      border-top-color: #e5e7eb;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-list,
    .unicorn-tooltip.unicorn-theme-light .unicorn-unit-list {
      border-color: #e5e7eb;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-section {
      color: #6b7280;
      border-bottom-color: #e5e7eb;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-item,
    .unicorn-tooltip.unicorn-theme-light .unicorn-unit-item {
      color: #111827;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-item:hover,
    .unicorn-tooltip.unicorn-theme-light .unicorn-unit-item:hover {
      background: #eef2ff;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-item.selected,
    .unicorn-tooltip.unicorn-theme-light .unicorn-unit-item.selected {
      background: #dfe7ff;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-search,
    .unicorn-tooltip.unicorn-theme-light .unicorn-unit-search {
      border-color: #d7dce5;
      background: #f8fafc;
      color: #111827;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-tooltip-resize {
      background: #eef2f7;
      color: #4b5563;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-tooltip-resize:hover {
      background: #dde4ee;
      color: #111827;
    }

    /* La conversion : l'information principale, la plus lisible. */
    .unicorn-tooltip-main {
      font-weight: 600;
      font-size: 13.5px;
      line-height: 1.35;
    }

    /* Le taux applique : secondaire, plus petit et plus discret. */
    .unicorn-tooltip-detail {
      margin-top: 3px;
      font-size: 11.5px;
      font-weight: 400;
      line-height: 1.35;
      /* PAS d'opacite : le texte secondaire doit rester lisible (contraste
         >= 4,5:1 sur le degrade). La hierarchie passe par la taille et la
         graisse, pas par la transparence. */
    }

    /* ---- Menu deroulant custom des devises -------------------------------- */
    .unicorn-source-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 11.5px;
    }
    .unicorn-source-label {
      flex: none;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
    }
    .unicorn-source-control {
      position: relative;
      flex: 1;
      min-width: 0;
    }
    .unicorn-currency-trigger {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin: 0 1px;
      padding: 1px 5px;
      border: 1px solid #38BDF8;
      border-radius: 5px;
      background: #7DD3FC;
      color: #0B1220;
      font: inherit;
      font-weight: 700;
      line-height: 1.25;
      cursor: pointer;
      vertical-align: baseline;
      box-shadow: 0 2px 0 #0284C7, inset 0 1px 0 rgba(255, 255, 255, 0.5);
    }
    .unicorn-currency-trigger::after {
      content: '\\25BE';
      font-size: 9px;
      line-height: 1;
      opacity: 0.8;
    }
    .unicorn-currency-trigger:hover { filter: brightness(1.06); }
    .unicorn-currency-trigger:active {
      transform: translateY(1px);
      box-shadow: 0 1px 0 #0284C7, inset 0 1px 2px rgba(15, 23, 42, 0.18);
    }
    .unicorn-currency-trigger.target {
      border-color: #4ADE80;
      background: #86EFAC;
      box-shadow: 0 2px 0 #15803D, inset 0 1px 0 rgba(255, 255, 255, 0.55);
    }
    .unicorn-currency-trigger.target:active {
      box-shadow: 0 1px 0 #15803D, inset 0 1px 2px rgba(15, 23, 42, 0.18);
    }
    .unicorn-amount-input {
      display: inline-block;
      width: auto;
      min-width: 3ch;
      max-width: 14ch;
      margin: 0 1px;
      padding: 0 2px;
      border: 0;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.5);
      border-radius: 3px 3px 0 0;
      background: rgba(255, 255, 255, 0.12);
      color: inherit;
      font: inherit;
      font-weight: inherit;
      text-align: center;
      white-space: nowrap;
      opacity: 0.82;
      cursor: text;
      transition: background-color 120ms ease, color 120ms ease,
        opacity 120ms ease, box-shadow 120ms ease;
    }
    .unicorn-amount-input:hover,
    .unicorn-amount-input.is-hover,
    .unicorn-amount-input:focus {
      opacity: 1;
      background: #ffffff;
      color: #0b1220;
      border-bottom-color: #0b1220;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
    }
    .unicorn-amount-input:focus {
      outline: 2px solid #ffffff;
      outline-offset: 1px;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-amount-input {
      border-bottom-color: #94a3b8;
      background: #f1f5f9;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-amount-input:hover,
    .unicorn-tooltip.unicorn-theme-light .unicorn-amount-input.is-hover,
    .unicorn-tooltip.unicorn-theme-light .unicorn-amount-input:focus {
      background: #ffffff;
      color: #0f172a;
      border-bottom-color: #0f172a;
      box-shadow: 0 0 0 2px rgba(29, 78, 216, 0.22);
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-amount-input:focus {
      outline-color: #1d4ed8;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-trigger {
      border-color: #2563EB;
      background: #DBEAFE;
      color: #1E3A8A;
      box-shadow: 0 2px 0 #93C5FD, inset 0 1px 0 #ffffff;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-trigger.target {
      border-color: #16A34A;
      background: #DCFCE7;
      color: #14532D;
      box-shadow: 0 2px 0 #86EFAC, inset 0 1px 0 #ffffff;
    }
    .unicorn-source-field {
      width: 100%;
      min-width: 0;
      padding: 4px 6px;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      font-family: inherit;
      font-size: 11.5px;
      text-align: left;
      cursor: pointer;
    }
    .unicorn-source-field:hover { background: rgba(255, 255, 255, 0.26); }
    .unicorn-source-menu-floating {
      position: fixed;
      right: auto;
      bottom: auto;
      width: 260px;
      z-index: 2147483647;
    }
    .unicorn-source-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 20;
      padding: 6px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 6px;
      background: #111A2C;
      box-shadow: 0 10px 24px rgba(2, 6, 23, 0.45);
    }
    .unicorn-source-menu[hidden] { display: none; }
    .unicorn-source-list {
      max-height: 240px;
      overflow-y: auto;
      margin-top: 5px;
    }
    .unicorn-source-section {
      margin-top: 4px;
      padding: 7px 6px 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.32);
      background: rgba(255, 255, 255, 0.07);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: rgba(255, 255, 255, 0.95);
    }
    .unicorn-source-row-item {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .unicorn-source-item {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 1;
      min-width: 0;
      padding: 5px 6px;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: #ffffff;
      font-family: inherit;
      font-size: 11.5px;
      text-align: left;
      cursor: pointer;
    }
    .unicorn-source-flag {
      flex: none;
      width: 18px;
      text-align: center;
      font-size: 12px;
      line-height: 1;
    }
    .unicorn-source-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .unicorn-source-item:hover,
    .unicorn-source-item.selected {
      background: rgba(125, 211, 252, 0.18);
      color: #7DD3FC;
    }
    .unicorn-source-pin {
      flex: none;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: transparent;
      font-size: 11px;
      cursor: pointer;
      filter: grayscale(1);
      opacity: 0.35;
    }
    .unicorn-source-pin:hover { opacity: 0.75; }
    .unicorn-source-pin.pinned {
      filter: none;
      opacity: 1;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-section {
      color: #334155;
      border-top-color: #94a3b8;
      background: #f1f5f9;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-pin {
      color: #0f172a;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-field {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #0f172a;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-menu {
      border-color: #cbd5e1;
      background: #ffffff;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-item {
      color: #0f172a;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-item:hover,
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-item.selected {
      background: #eef3ff;
      color: #1d4ed8;
    }
    .unicorn-source-search {
      width: 100%;
      box-sizing: border-box;
      padding: 4px 6px;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      font-family: inherit;
      font-size: 11.5px;
    }
    .unicorn-source-search::placeholder { color: rgba(255, 255, 255, 0.8); }
    .unicorn-source-select {
      width: 100%;
      min-width: 0;
      padding: 4px 6px;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      font-family: inherit;
      font-size: 11.5px;
    }
    .unicorn-picker-title {
      margin: 2px 0 4px;
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: rgba(255, 255, 255, 0.7);
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-label {
      color: #334155;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-select {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #0f172a;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-picker-title {
      color: #64748b;
    }

    .unicorn-currency-picker {
      position: relative;
      margin-top: 8px;
      /* Largeur par defaut. Quand la bulle est elargie par l'utilisateur,
         la regle suivante fait prendre toute la largeur disponible. */
      width: 260px;
      font-size: 12px;
    }
    .unicorn-tooltip-sized .unicorn-currency-picker {
      width: 100%;
    }

    .unicorn-currency-search {
      width: 100%;
      box-sizing: border-box;
      padding: 5px 8px;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      font-family: inherit;
      font-size: 12px;
      line-height: 1.3;
    }
    .unicorn-currency-search::placeholder {
      color: rgba(255, 255, 255, 0.8);
    }

    .unicorn-currency-list {
      margin-top: 6px;
      /* La liste a TOUJOURS une hauteur maximale : c'est ce qui empeche le
         menu de s'etendre sur toute la page. L'utilisateur peut l'agrandir
         via la poignee (style « max-height » applique en ligne). */
      max-height: 200px;
      overflow-y: auto;
      border-radius: 6px;
    }

    /* Pied de menu : accueille la poignee de redimensionnement, SEPAREMENT
       de la liste pour ne pas la chevaucher avec la barre de defilement. */
    .unicorn-picker-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      height: 18px;
      margin-top: 2px;
    }

    .unicorn-currency-section {
      padding: 5px 8px 4px;
      font-weight: 600;
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.18);
    }

    .unicorn-currency-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
      padding: 5px 8px;
      border: none;
      background: transparent;
      color: #ffffff;
      font-family: inherit;
      font-size: 12px;
      line-height: 1.35;
      text-align: left;
      cursor: pointer;
    }
    .unicorn-currency-item:hover {
      background: rgba(255, 255, 255, 0.14);
    }
    .unicorn-currency-item.selected {
      background: rgba(255, 255, 255, 0.22);
      font-weight: 600;
    }

    /* Drapeau : place dans sa propre colonne, a gauche du libelle.
       Iteration 7 : il etait trop petit pour etre reconnaissable (le drapeau
       europeen, en particulier, ressemble a une pastille bleue a 12 px).
       Largeur FIXE = tous les drapeaux sont alignes verticalement, quelle
       que soit la largeur de l'emoji. */
    .unicorn-flag {
      flex: none;
      width: 24px;
      margin-right: 1px;
      font-size: 18px;
      line-height: 1;
      text-align: center;
      vertical-align: -2px;
    }

    /* Le fuseau doit rester LISIBLE EN ENTIER : « Buenos Aires
       (America/Argentina/Buenos Aires) » ne tient pas sur 260 px. On laisse
       donc le libelle passer a la ligne plutot que de le tronquer (le menu
       s'allonge horizontalement, jamais le texte). */
    .unicorn-currency-item-label {
      flex: 1;
      min-width: 0;
      white-space: normal;
      overflow-wrap: break-word;
    }

    /* Poignee de redimensionnement : placee dans le PIED du menu, donc
       jamais par-dessus la barre de defilement. */
    .unicorn-tooltip-resize {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 18px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.16);
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      line-height: 1;
      cursor: nwse-resize;
      user-select: none;
      touch-action: none;
    }
    .unicorn-tooltip-resize:hover {
      background: rgba(255, 255, 255, 0.32);
      color: #ffffff;
    }

    .unicorn-currency-item-pin {
      flex: none;
      cursor: pointer;
      font-size: 12px;
      /* Non epinglee : grisee et estompee. */
      filter: grayscale(1);
      opacity: 0.35;
      transition: opacity 0.15s ease, filter 0.15s ease;
    }
    .unicorn-currency-item-pin:hover {
      opacity: 0.7;
    }
    /* Epinglee : en couleur, comme un bouton enfonce. */
    .unicorn-currency-item-pin.pinned {
      filter: none;
      opacity: 1;
    }

    /* ---- Menu deroulant des UNITES ---------------------------------------- */
    .unicorn-unit-picker {
      position: relative;
      margin-top: 6px;
      width: 240px;
      font-size: 11px;
    }
    .unicorn-tooltip-sized .unicorn-unit-picker {
      width: 100%;
    }

    .unicorn-unit-list {
      max-height: 180px;
      overflow-y: auto;
      border-radius: 4px;
      padding-bottom: 14px;
    }

    .unicorn-unit-item {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 4px 6px;
      border: none;
      background: transparent;
      color: #ffffff;
      font-family: inherit;
      font-size: 11px;
      text-align: left;
      cursor: pointer;
    }
    .unicorn-unit-item:hover {
      background: rgba(255, 255, 255, 0.14);
    }
    .unicorn-unit-item.selected {
      background: rgba(255, 255, 255, 0.22);
      font-weight: 600;
    }

    ::highlight(unicorn-amount) {
      text-decoration: underline dotted #5b7fd4;
      text-decoration-thickness: 1.5px;
      text-underline-offset: 2.5px;
      background-color: transparent;
    }

    /* ---- ACCESSIBILITE : anneau de focus visible ----------------------
       Les menus sont de vrais boutons : ils sont donc atteignables avec Tab.
       Sans anneau visible, on ne saurait pas ou l'on est. */
    .unicorn-currency-item:focus-visible,
    .unicorn-unit-item:focus-visible,
    .unicorn-currency-search:focus-visible,
    .unicorn-source-select:focus-visible,
    .unicorn-unit-search:focus-visible,
    .unicorn-tooltip-resize:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }

    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-item:focus-visible,
    .unicorn-tooltip.unicorn-theme-light .unicorn-unit-item:focus-visible,
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-search:focus-visible,
    .unicorn-tooltip.unicorn-theme-light .unicorn-tooltip-resize:focus-visible {
      outline-color: #1b4ed1;
    }

    @media (prefers-reduced-motion: reduce) {
      .unicorn-tooltip { transition: none !important; }
    }
    /* =====================================================================
       16-BIT / GAME BOY ADVANCE — surcouche visuelle
       Contours 2 px, ombres dures, petits rayons, palette limitée.
       ===================================================================== */
    .unicorn-tooltip {
      max-width: min(700px, calc(100vw - 16px)) !important;
      border: 2px solid #071018 !important;
      border-radius: 4px !important;
      background: #1B4ED1 !important;
      background-image: none !important;
      box-shadow: 4px 4px 0 #071018 !important;
      font-family: "Trebuchet MS", "Segoe UI", Roboto, sans-serif !important;
      letter-spacing: 0.015em !important;
    }
    .unicorn-tooltip-main {
      font-weight: 700 !important;
      white-space: nowrap !important;
      text-shadow: 0 1px 0 rgba(7, 16, 24, 0.35) !important;
    }
    .unicorn-tooltip-detail {
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace !important;
      font-variant-numeric: tabular-nums !important;
    }
    .unicorn-currency-trigger {
      border: 2px solid #071018 !important;
      border-radius: 3px !important;
      box-shadow: 2px 2px 0 #071018 !important;
    }
    .unicorn-currency-trigger:hover { filter: brightness(1.05) !important; }
    .unicorn-currency-trigger:active {
      transform: translate(2px, 2px) !important;
      box-shadow: none !important;
    }
    .unicorn-amount-input {
      border: 2px solid rgba(7, 16, 24, 0.45) !important;
      border-radius: 2px !important;
      box-shadow: 2px 2px 0 rgba(7, 16, 24, 0.28) !important;
    }
    .unicorn-amount-input:hover,
    .unicorn-amount-input.is-hover,
    .unicorn-amount-input:focus {
      border-color: #071018 !important;
      box-shadow: 2px 2px 0 #071018 !important;
    }
    .unicorn-source-menu {
      border: 2px solid #071018 !important;
      border-radius: 3px !important;
      box-shadow: 4px 4px 0 #071018 !important;
    }
    .unicorn-source-search,
    .unicorn-currency-search {
      border: 2px solid rgba(7, 16, 24, 0.5) !important;
      border-radius: 2px !important;
    }
    .unicorn-source-item {
      border-radius: 2px !important;
    }
    .unicorn-source-section {
      border-top: 2px solid rgba(255, 255, 255, 0.35) !important;
    }
    .unicorn-picker-title {
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace !important;
      letter-spacing: 0.06em !important;
    }
    .unicorn-currency-list {
      border-radius: 2px !important;
    }
    .unicorn-tooltip-resize {
      border: 2px solid #071018 !important;
      border-radius: 2px !important;
      box-shadow: 2px 2px 0 #071018 !important;
    }
    .unicorn-ocr-frame {
      border: 3px solid #071018 !important;
      border-radius: 0 !important;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.2) !important;
    }
    .unicorn-ocr-hint {
      border: 2px solid #071018 !important;
      border-radius: 3px !important;
      box-shadow: 3px 3px 0 #071018 !important;
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace !important;
    }
    .unicorn-tooltip.unicorn-theme-light {
      border-color: #071018 !important;
      background: #ffffff !important;
      background-image: none !important;
      color: #0f172a !important;
      box-shadow: 4px 4px 0 #071018 !important;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-source-menu {
      border-color: #071018 !important;
      box-shadow: 4px 4px 0 #071018 !important;
    }
    .unicorn-tooltip.unicorn-theme-light .unicorn-currency-trigger {
      border-color: #071018 !important;
      box-shadow: 2px 2px 0 #071018 !important;
    }

    /* Etat FIGE : legerement plus sombre, ombre reduite, enfoncement interne.
       Aucun transform : la bulle contient des menus en position fixed. */
    .unicorn-tooltip.unicorn-tooltip-frozen {
      background: #1642B8 !important;
      box-shadow: 2px 2px 0 #071018,
        inset 0 2px 0 rgba(7, 16, 24, 0.22) !important;
    }
    .unicorn-tooltip.unicorn-theme-light.unicorn-tooltip-frozen {
      background: #EEF3FF !important;
      color: #0F172A !important;
      box-shadow: 2px 2px 0 #071018,
        inset 0 2px 0 rgba(7, 16, 24, 0.10) !important;
    }
    .unicorn-tooltip {
      transition: background-color 120ms ease, box-shadow 120ms ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .unicorn-tooltip { transition: none !important; }
    }

  `;

  /** Injecte la feuille de style dans la page. Appelee une seule fois. */
  function injectStyles() {
    if (document.querySelector('style[data-unic="style"]')) {
      return;
    }
    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-unic', 'style');
    // Marqueur lisible par les pages de test (voir CONTENT_BUILD_TAG).
    styleElement.setAttribute('data-unic-build', CONTENT_BUILD_TAG);
    styleElement.textContent = STYLE_TEXT;
    (document.head || document.documentElement).appendChild(styleElement);
  }

  /** Cree la bulle dans la page. Appelee une seule fois. */
  function initTooltip() {
    if (tooltipElement) {
      return;
    }

    tooltipElement = document.createElement('div');
    tooltipElement.setAttribute('data-unic', 'tooltip');
    tooltipElement.className = 'unicorn-tooltip';
    tooltipElement.setAttribute('role', 'status');
    tooltipElement.setAttribute('aria-live', 'polite');
    tooltipElement.setAttribute('aria-label', 'Conversion UniConv');
    // La langue du contenu aide les lecteurs d'ecran a bien prononcer.
    tooltipElement.setAttribute('lang', uiLanguage || 'fr');
    tooltipElement.setAttribute('dir', uiLanguage === 'ar' ? 'rtl' : 'ltr');
    tooltipElement.style.display = 'none';

    // Quand la souris entre dans la bulle, on la garde ouverte : sinon le
    // menu deroulant disparaitrait des qu'on tente de cliquer dessus.
    if (typeof tooltipElement.addEventListener === 'function') {
      tooltipElement.addEventListener('mouseenter', function () {
        isTooltipHovered = true;
      });
      tooltipElement.addEventListener('mouseleave', function () {
        isTooltipHovered = false;
        hideTooltip();
      });
    }

    document.body.appendChild(tooltipElement);

    // Iteration 8 : le theme choisi dans les options.
    applyTheme();
  }

  /**
   * Demande la conversion d'un montant au script d'arriere-plan.
   *
   * POURQUOI PASSER PAR L'ARRIERE-PLAN ?
   * Une page web n'a pas le droit d'appeler l'API Frankfurter directement (le
   * navigateur bloque pour des raisons de securite). Le script d'arriere-plan,
   * lui, y est autorise.
   *
   * Le resultat est mis en cache ICI, dans la page : si l'utilisateur survole
   * dix fois le meme prix, un seul message est envoye.
   *
   * @param {object} amount - le montant detecte
   * @returns {Promise<object>} la reponse de l'arriere-plan
   */
  function requestConversion(amount) {
    const currencyCode = amount.currency ? amount.currency.code : null;
    if (!currencyCode) {
      return Promise.resolve({ ok: false, error: 'devise inconnue' });
    }

    // La cle de cache ne contient QUE le couple de devises, et non le montant.
    // C'est volontaire : un TAUX est le meme quel que soit le montant.
    // En revanche, la VALEUR convertie depend du montant. On ne doit donc
    // jamais mettre en cache la valeur convertie.
    const cacheKey = `${currencyCode}|${targetCurrency}`;

    // Deja obtenu : on recalcule la valeur a partir du taux en cache.
    if (conversionCache.has(cacheKey)) {
      const cached = conversionCache.get(cacheKey);
      if (cached && cached.ok && typeof cached.rate === 'number') {
        return Promise.resolve({
          ...cached,
          value: amount.value * cached.rate
        });
      }
      // Cache corrompu ou rate manquant : on le laisse tomber et on refait
      // un appel reseau.
      conversionCache.delete(cacheKey);
    }

    return new Promise(function (resolve) {
      let settled = false;

      // Filet de securite : si l'arriere-plan ne repond jamais, on ne laisse
      // pas la bulle bloquee sur « conversion… » indefiniment.
      const timeoutId = setTimeout(function () {
        if (!settled) {
          settled = true;
          resolve({ ok: false, error: 'delai depasse' });
        }
      }, CONVERSION_TIMEOUT_MS);

      try {
        chrome.runtime.sendMessage(
          {
            type: 'convert',
            amount: amount.value,
            from: currencyCode,
            to: targetCurrency
          },
          function (response) {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timeoutId);

            // Erreur de communication (extension rechargee, arriere-plan
            // endormi...). On l'explique clairement plutot que d'afficher
            // un message technique incomprehensible.
            if (chrome.runtime.lastError) {
              const message = chrome.runtime.lastError.message || '';
              resolve({ ok: false, error: 'arriere-plan injoignable', detail: message });
              return;
            }

            if (!response) {
              resolve({ ok: false, error: 'reponse vide' });
              return;
            }

            // On ne met en cache que les succes : une erreur reseau doit
            // pouvoir etre retentee au survol suivant.
            if (response.ok) {
              conversionCache.set(cacheKey, response);
            }
            resolve(response);
          }
        );
      } catch (error) {
        settled = true;
        clearTimeout(timeoutId);
        // Cette erreur signifie presque toujours que l'API « chrome » n'est
        // pas disponible (contexte de test, extension dechargee...). On la
        // trace pour ne pas la confondre avec une panne reseau.
        console.warn(`${LOG_PREFIX} envoi du message impossible :`, error.message);
        resolve({ ok: false, error: 'envoi impossible', detail: error.message });
      }
    });
  }

  /**
   * Met en forme un montant, en restant lisible meme pour les tres grands
   * nombres.
   *
   * POURQUOI CE TRAITEMENT DES GRANDS NOMBRES
   * ----------------------------------------
   * Un montant comme 1 000 000 000 000 EUR converti en won coreen donne un
   * nombre de 19 chiffres. Ecrit en entier avec ses separateurs, il ne tient
   * pas dans la bulle. On utilise donc, au-dela d'un milliard, la notation
   * compacte de « Intl.NumberFormat » : « 1,3 Bn » (milliard), « 4,2 Bn »...
   *
   * Ce n'est pas de la precision perdue : au-dela de 100 milliards, les
   * centimes n'ont plus aucun sens pour l'utilisateur.
   *
   * @param {number} value - le montant
   * @param {object|null} currency - la devise (pour le symbole et la position)
   * @returns {string} le montant mis en forme
   */
  function formatMoney(value, currency) {
    if (!Number.isFinite(value)) {
      return '\u2014';
    }

    const absValue = Math.abs(value);
    const symbol = currency && currency.symbol ? currency.symbol : '';
    const code = currency && currency.code ? currency.code : '';

    // Un milliard et plus : notation compacte (« 1,23 Bn »).
    if (absValue >= 1_000_000_000) {
      const compact = numberFormatter(numberLocale(), {
        notation: 'compact',
        maximumFractionDigits: 2
      }).format(value);
      return symbol
        ? `${compact} ${symbol}`
        : `${compact} ${code}`.trim();
    }

    const formattedNumber = numberFormatter(numberLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);

    if (!currency) {
      return formattedNumber;
    }

    if (!symbol) {
      return `${formattedNumber} ${code}`;
    }

    // Les devises dont le symbole se place avant le nombre.
    if (currency.before && (code === 'USD' || code === 'GBP' || code === 'JPY')) {
      return `${symbol}${formattedNumber}`;
    }

    return `${formattedNumber} ${symbol}`;
  }

  /**
   * Affiche une fourchette d'argent : « 2 000 – 3 000 CNY ».
   *
   * - symbole AVANT (USD, GBP, JPY) : on repete le symbole (« $2,000 – $3,000 ») ;
   * - sinon : le symbole ou le code n'apparait QU'UNE fois (« 2 000 – 3 000 € »).
   */
  function formatMoneyRange(min, max, currency) {
    const symbol = currency && currency.symbol ? currency.symbol : '';
    const code = currency && currency.code ? currency.code : '';
    const before = Boolean(
      symbol && currency.before && (code === 'USD' || code === 'GBP' || code === 'JPY')
    );

    if (before) {
      return `${formatMoney(min, currency)} \u2013 ${formatMoney(max, currency)}`;
    }

    const minText = formatMoney(min, null);
    const maxText = formatMoney(max, null);
    const suffix = symbol ? ` ${symbol}` : (code ? ` ${code}` : '');

    return `${minText} \u2013 ${maxText}${suffix}`;
  }

  /**
   * Construit le CONTENU de la bulle.
   *
   * On renvoie un objet a deux parties plutot qu'une seule chaine :
   *   - « main »    : la conversion, en gros. C'est l'information cherchee.
   *   - « detail »  : le taux applique, en petit, ou null.
   *
   * POURQUOI DEUX LIGNES
   * --------------------
   * La premiere version affichait tout sur une seule ligne, avec la date du
   * taux. Consequence : la bulle etait trop large et debordait de l'ecran, si
   * bien que la fin du texte devenait illisible (blanc sur blanc). La date a
   * ete retiree (elle reste consultable dans le popup) et le taux est passe
   * sur une seconde ligne, plus discrete.
   *
   * @param {object} amount - le montant survole
   * @param {object|null} result - la reponse de l'arriere-plan, ou null
   * @returns {{main: string, detail: string|null, sourceSign: string, targetSign: string, sourceAmountText: string, editableAmount: boolean}}
   */
  function buildTooltipContent(amount, result) {
    const sourceCode = amount.currency ? amount.currency.code : '?';
    const sourceSign = amount.currency
      ? (amount.currency.symbol || amount.currency.code)
      : '';
    const targetSign = result && result.ok && result.to
      ? (currencySymbolOf(result.to) || result.to)
      : '';
    const isRange = Boolean(amount.range && Number.isFinite(amount.range.max));
    // Le signe de devise est toujours APRES le montant dans la bulle, quelle
    // que soit la convention de la devise : le bouton ne change donc jamais
    // de cote quand on change de devise.
    const displayCurrency = amount.currency
      ? Object.assign({}, amount.currency, { before: false })
      : amount.currency;
    const sourceText = isRange
      ? formatMoneyRange(amount.range.min, amount.range.max, displayCurrency)
      : formatMoney(amount.value, displayCurrency);
    const sourceAmountText = isRange ? '' : formatMoney(amount.value, null);
    const editableAmount = !isRange && Math.abs(amount.value) < 1e9;

    // Cas 2 : la conversion est encore en route.
    if (!result) {
      return {
        main: `${sourceText} \u2192 ${t('conversion')}`,
        detail: null,
        sourceSign: sourceSign,
        sourceAmountText: sourceAmountText,
        editableAmount: editableAmount
      };
    }

    // Cas 3 : la conversion a echoue. On distingue les causes, avec des mots
    // simples : l'utilisateur n'a pas a lire des codes d'erreur.
    if (!result.ok) {
      if (result.error === 'devise non disponible') {
        return {
          main: `${sourceText} (${sourceCode})`,
          detail: t('noRate'),
          sourceSign: sourceSign,
          sourceAmountText: sourceAmountText,
          editableAmount: editableAmount
        };
      }
      if (result.error === 'arriere-plan injoignable' ||
          result.error === 'delai depasse') {
        return {
          main: `${sourceText} (${sourceCode})`,
          detail: t('backgroundDown'),
          sourceSign: sourceSign,
          sourceAmountText: sourceAmountText,
          editableAmount: editableAmount
        };
      }
      // Cas inattendu : message simple a l'ecran, detail technique en console.
      // Sans cela, un vrai bug ressemblerait a une panne reseau.
      console.warn(
        `${LOG_PREFIX} conversion impossible :`,
        result.error || result,
        result.detail || ''
      );
      return {
        main: `${sourceText} (${sourceCode})`,
        detail: t('impossible'),
        sourceSign: sourceSign,
        sourceAmountText: sourceAmountText,
        editableAmount: editableAmount
      };
    }

    // Cas 1 : succes.
    const targetCurrency = {
      code: result.to,
      symbol: currencySymbolOf(result.to),
      before: false
    };

    const rateText = numberFormatter(numberLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(result.rate);

    const cacheText = result.stale ? ` \u00B7 ${t('cachedRate')}` : '';

    if (isRange) {
      const convertedRange = formatMoneyRange(
        amount.range.min * result.rate,
        amount.range.max * result.rate,
        targetCurrency
      );

      return {
        main: `${sourceText} = ${convertedRange}`,
        detail: `1 ${result.from} = ${rateText} ${result.to}${cacheText}`,
        sourceSign: sourceSign,
        sourceAmountText: sourceAmountText,
        editableAmount: editableAmount,
        targetSign: targetSign
      };
    }

    const targetText = formatMoney(result.value, targetCurrency);

    return {
      main: `${sourceText} = ${targetText}`,
      detail: `1 ${result.from} = ${rateText} ${result.to}${cacheText}`,
      sourceSign: sourceSign,
      sourceAmountText: sourceAmountText,
      editableAmount: editableAmount,
      targetSign: targetSign
    };
  }

  /**
   * Retourne le symbole d'une devise a partir de son code.
   * Sert uniquement a l'affichage du resultat converti.
   */
  function currencySymbolOf(code) {
    const currency = CURRENCY_BY_CODE.get(String(code).toUpperCase());
    return currency && currency.symbol ? currency.symbol : null;
  }

  /** Menu flottant de la devise de depart (ouvert par le signe cliquable). */
  let sourceMenuElement = null;
  let sourceMenuAnchor = null;
  let sourceMenuCleanup = null;

  function closeSourceMenu() {
    if (sourceMenuCleanup) {
      sourceMenuCleanup();
      sourceMenuCleanup = null;
    }
    if (sourceMenuElement && sourceMenuElement.parentNode) {
      sourceMenuElement.parentNode.removeChild(sourceMenuElement);
    }
    sourceMenuElement = null;
    sourceMenuAnchor = null;
  }

  /** Relance la conversion de la bulle courante (source et/ou cible). */
  function refreshCurrencyBubble() {
    if (!frozenAmount) {
      return;
    }

    conversionRequestId += 1;
    const requestId = conversionRequestId;

    updateTooltipText(buildTooltipContent(frozenAmount, null));

    requestConversion(frozenAmount).then(function (result) {
      if (requestId !== conversionRequestId) {
        return;
      }
      if (!tooltipElement || tooltipElement.style.display === 'none') {
        return;
      }
      updateTooltipText(buildTooltipContent(frozenAmount, result));
      if (lastTooltipPosition) {
        positionTooltip(lastTooltipPosition.x, lastTooltipPosition.y);
      }
    });
  }

  /** Change la devise de depart du montant fige. */
  function selectSourceCurrency(code) {
    const currency = CURRENCY_BY_CODE.get(String(code || '').toUpperCase());
    if (!frozenAmount || !currency) {
      return;
    }
    if (currency.code === frozenAmount.currency.code) {
      return;
    }

    frozenAmount = Object.assign({}, frozenAmount, { currency: currency });
    currentSignature = null;
    refreshCurrencyBubble();
  }

  /**
   * Change la cible de la bulle courante. Ce choix reste TEMPORAIRE : il n'est
   * pas ecrit dans le stockage, contrairement aux unites de reference.
   */
  function selectTargetCurrency(code) {
    if (!/^[A-Z]{3}$/.test(String(code || ''))) {
      return;
    }
    closeSourceMenu();
    saveTargetCurrency(code);
    if (!frozenAmount) {
      return;
    }
    currentSignature = null;
    refreshCurrencyBubble();
  }

  /**
   * Chaine dans laquelle on cherche pour une devise.
   * Code + nom + symbole + noms de pays.
   */
  function currencySearchTerms(code) {
    const currency = CURRENCY_BY_CODE.get(code);
    const aliases = currency && Array.isArray(currency.names)
      ? currency.names
      : [];

    return [
      code,
      currencyFullName(code),
      currencySymbolFor(code)
    ].concat(aliases, currencyCountryNames(code)).join(' ');
  }

  /**
   * Ouvre la liste des devises (depart ou destination) au-dessus/en dessous du
   * signe clique. La liste contient TOUTES les devises ; la hauteur visible
   * est d'environ 10 lignes, le reste se parcourt a la molette.
   */
  function openCurrencyMenu(kind, anchor) {
    if (!frozenAmount || !frozenAmount.currency) {
      return;
    }
    if (sourceMenuElement && sourceMenuAnchor === anchor) {
      closeSourceMenu();
      return;
    }

    closeSourceMenu();

    const currentCode = kind === 'target'
      ? targetCurrency
      : frozenAmount.currency.code;

    const menu = document.createElement('div');
    menu.className = 'unicorn-source-menu unicorn-source-menu-floating';
    menu.setAttribute('data-kind', kind);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'unicorn-source-search';
    search.placeholder = kind === 'target'
      ? 'Rechercher une devise cible...'
      : 'Rechercher une devise...';
    search.setAttribute('aria-label', 'Rechercher une devise');
    menu.appendChild(search);

    const list = document.createElement('div');
    list.className = 'unicorn-source-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', kind === 'target'
      ? 'Devises de destination'
      : t('sourceCurrency'));
    menu.appendChild(list);

    const allCodes = Array.from(new Set(
      Object.keys(CURRENCY_META).concat([currentCode])
    )).sort();

    function render() {
      const query = String(search.value || '').trim().toLowerCase();
      const matches = (code) => {
        if (!query) return true;
        return code.toLowerCase().indexOf(query) !== -1 ||
          currencyFullName(code).toLowerCase().indexOf(query) !== -1;
      };

      const filtered = allCodes.filter(matches);
      const importance = (code) => {
        const index = TOP_CURRENCIES.indexOf(code);
        return index === -1 ? TOP_CURRENCIES.length : index;
      };
      const pinned = filtered
        .filter((code) => pinnedCurrencies.has(code))
        .sort((a, b) => importance(a) - importance(b) || a.localeCompare(b));
      const top = TOP_CURRENCIES.filter((code) =>
        filtered.indexOf(code) !== -1 && !pinnedCurrencies.has(code));
      const others = filtered
        .filter((code) => !pinnedCurrencies.has(code) && TOP_CURRENCIES.indexOf(code) === -1)
        .sort();

      list.textContent = '';
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'unicorn-source-item';
        empty.textContent = 'Aucun résultat';
        list.appendChild(empty);
        return;
      }

      const sections = [
        { title: 'Épinglées', items: pinned },
        { title: 'Principales', items: top },
        { title: 'Autres', items: others }
      ];

      for (const section of sections) {
        if (section.items.length === 0) {
          continue;
        }

        const header = document.createElement('div');
        header.className = 'unicorn-source-section';
        header.textContent = section.title;
        list.appendChild(header);

        for (const code of section.items) {
          const row = document.createElement('div');
          row.className = 'unicorn-source-row-item';

          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'unicorn-source-item' +
            (code === currentCode ? ' selected' : '');
          item.setAttribute('data-code', code);

          const flag = document.createElement('span');
          flag.className = 'unicorn-source-flag';
          const emoji = currencyFlag(code);
          flag.textContent = emoji && emoji !== '\u{1F30D}' ? emoji : '';

          const name = document.createElement('span');
          name.className = 'unicorn-source-name';
          name.textContent = `${code} — ${currencyFullName(code)}`;

          item.appendChild(flag);
          item.appendChild(name);
          item.addEventListener('click', function (event) {
            if (event && event.stopPropagation) event.stopPropagation();
            if (kind === 'target') {
              selectTargetCurrency(code);
            } else {
              selectSourceCurrency(code);
            }
            closeSourceMenu();
          });
          row.appendChild(item);

          const pin = document.createElement('button');
          pin.type = 'button';
          pin.className = 'unicorn-source-pin' +
            (pinnedCurrencies.has(code) ? ' pinned' : '');
          pin.textContent = '📌';
          pin.title = pinnedCurrencies.has(code)
            ? 'Retirer des épinglées'
            : 'Épingler cette devise';
          pin.setAttribute('aria-label', pin.title);
          pin.setAttribute('aria-pressed', pinnedCurrencies.has(code) ? 'true' : 'false');
          pin.addEventListener('click', function (event) {
            if (event && event.stopPropagation) event.stopPropagation();
            togglePinnedCurrency(code);
            render();
          });
          row.appendChild(pin);

          list.appendChild(row);
        }
      }
    }

    search.addEventListener('input', render);
    render();

    tooltipElement.appendChild(menu);
    sourceMenuElement = menu;
    sourceMenuAnchor = anchor;

    let rect = { left: 0, top: 0, bottom: 0 };
    try {
      if (anchor.getBoundingClientRect) {
        rect = anchor.getBoundingClientRect();
      }
    } catch (error) {
      // Position de secours.
    }
    const width = 260;
    const viewWidth = window.innerWidth || 0;
    const viewHeight = window.innerHeight || 0;
    let left = rect.left || 0;
    if (viewWidth && left + width > viewWidth - 8) {
      left = Math.max(8, viewWidth - width - 8);
    }
    let top = (rect.bottom || 0) + 4;
    if (viewHeight && top + 290 > viewHeight - 8) {
      top = Math.max(8, (rect.top || 0) - 294);
    }
    menu.style.position = 'fixed';
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.width = `${width}px`;

    if (typeof search.focus === 'function') {
      search.focus();
    }

    const onDocumentClick = function (event) {
      if (menu.contains(event.target) || anchor.contains(event.target)) {
        return;
      }
      closeSourceMenu();
    };
    const onKeyDown = function (event) {
      if (event && event.key === 'Escape') {
        closeSourceMenu();
      }
    };
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    sourceMenuCleanup = function () {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }

  /**
   * Si la bulle est encore en survol, la fige sur le montant courant.
   * Renvoie false si aucun montant n'est disponible.
   */
  function freezeHoveredCurrency() {
    if (frozen && frozenAmount) {
      return true;
    }
    if (!hoveredAmount) {
      return false;
    }
    frozen = true;
    frozenAmount = hoveredAmount;
    frozenUnit = null;
    frozenTime = null;
    selectedUnit = null;
    if (tooltipElement && tooltipElement.classList) {
      tooltipElement.classList.add('unicorn-tooltip-frozen');
    }
    return true;
  }

  /**
   * Convertit la saisie utilisateur en nombre, en acceptant les conventions
   * françaises (espace, virgule) et anglaises (virgule de milliers, point).
   */
  function parseEditedAmount(raw) {
    let value = String(raw || '').replace(/[^0-9,.'-]/g, '').trim();
    if (value === '') {
      return null;
    }

    if (value.indexOf(',') !== -1 && value.indexOf('.') !== -1) {
      if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
        value = value.replace(/\./g, '').replace(',', '.');
      } else {
        value = value.replace(/,/g, '');
      }
    } else if (value.indexOf(',') !== -1) {
      const parts = value.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        value = parts[0] + '.' + parts[1];
      } else {
        value = value.replace(/,/g, '');
      }
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  /** Applique une somme saisie dans la bulle et relance la conversion. */
  function applyEditedCurrencyAmount(field, originalText) {
    if (!freezeHoveredCurrency() || !frozenAmount) {
      field.textContent = originalText;
      return;
    }

    const value = parseEditedAmount(field.textContent);
    if (value === null) {
      field.textContent = originalText;
      return;
    }

    if (Math.abs(value - frozenAmount.value) < 1e-9) {
      field.textContent = originalText;
      return;
    }

    const updated = Object.assign({}, frozenAmount, {
      value: value,
      range: null,
      text: String(value)
    });
    frozenAmount = updated;
    currentSignature = null;

    conversionRequestId += 1;
    const requestId = conversionRequestId;

    updateTooltipText(buildTooltipContent(updated, null));

    requestConversion(updated).then(function (result) {
      if (requestId !== conversionRequestId) {
        return;
      }
      if (!tooltipElement || tooltipElement.style.display === 'none') {
        return;
      }
      updateTooltipText(buildTooltipContent(updated, result));
      if (lastTooltipPosition) {
        positionTooltip(lastTooltipPosition.x, lastTooltipPosition.y);
      }
    });
  }

  /** Remplit la ligne principale : signes, somme éditable, texte. */
  function renderMainContent(element, content) {
    // Indispensable : updateTooltipText reutilise le meme element. Sans ce
    // nettoyage, chaque modification de somme empilait un nouveau contenu.
    element.textContent = '';

    const main = content.main;
    const sourceSign = String(content.sourceSign || '');
    const targetSign = String(content.targetSign || '');
    const sourceAmountText = String(content.sourceAmountText || '');
    const editable = content.editableAmount === true && sourceAmountText !== '';
    const sourceIndex = sourceSign ? main.indexOf(sourceSign) : -1;
    const targetIndex = targetSign
      ? main.indexOf(targetSign, sourceIndex >= 0 ? sourceIndex + sourceSign.length : 0)
      : -1;
    const amountIndex = editable ? main.indexOf(sourceAmountText) : -1;

    const marks = [];
    if (sourceIndex !== -1) {
      marks.push({ index: sourceIndex, sign: sourceSign, kind: 'source' });
    }
    if (amountIndex !== -1) {
      marks.push({ index: amountIndex, sign: sourceAmountText, kind: 'amount' });
    }
    if (targetIndex !== -1) {
      marks.push({ index: targetIndex, sign: targetSign, kind: 'target' });
    }
    marks.sort((a, b) => a.index - b.index);

    let cursor = 0;
    for (const mark of marks) {
      if (mark.index < cursor) {
        continue;
      }
      if (mark.index > cursor) {
        const before = document.createElement('span');
        before.textContent = main.slice(cursor, mark.index);
        element.appendChild(before);
      }

      if (mark.kind === 'amount') {
        const field = document.createElement('span');
        field.className = 'unicorn-amount-input';
        field.setAttribute('contenteditable', 'true');
        field.setAttribute('role', 'textbox');
        field.setAttribute('aria-label', 'Modifier le montant détecté');
        field.setAttribute('spellcheck', 'false');
        field.title = 'Cliquez pour modifier le montant détecté';
        field.textContent = sourceAmountText;

        field.addEventListener('focus', function () {
          freezeHoveredCurrency();
          try {
            const selection = typeof window.getSelection === 'function'
              ? window.getSelection()
              : null;
            if (selection && typeof document.createRange === 'function') {
              const range = document.createRange();
              range.selectNodeContents(field);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } catch (error) {
            // Selection non disponible : l'utilisateur clique dans le champ.
          }
        });

        field.addEventListener('keydown', function (event) {
          if (event && (event.key === 'Enter' || event.key === 'NumpadEnter')) {
            event.preventDefault();
            event.stopPropagation();
            applyEditedCurrencyAmount(field, sourceAmountText);
            if (typeof field.blur === 'function') {
              field.blur();
            }
          } else if (event && (event.key === 'Escape' || event.key === 'Esc')) {
            event.preventDefault();
            event.stopPropagation();
            field.textContent = sourceAmountText;
            if (typeof field.blur === 'function') {
              field.blur();
            }
          }
        });

        field.addEventListener('blur', function () {
          applyEditedCurrencyAmount(field, sourceAmountText);
        });

        field.addEventListener('click', function (event) {
          if (event && event.stopPropagation) event.stopPropagation();
        });

        field.addEventListener('mouseenter', function () {
          field.classList.add('is-hover');
        });
        field.addEventListener('mouseleave', function () {
          field.classList.remove('is-hover');
        });

        element.appendChild(field);
      } else {
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'unicorn-currency-trigger ' +
          (mark.kind === 'target' ? 'target' : 'source') +
          (mark.kind === 'source' ? ' unicorn-source-trigger' : ' unicorn-target-trigger');
        trigger.textContent = mark.sign;
        trigger.title = mark.kind === 'target'
          ? 'Changer la devise de destination'
          : 'Changer la devise de depart';
        trigger.setAttribute('aria-label', trigger.title);
        trigger.addEventListener('click', function (event) {
          if (event && event.stopPropagation) event.stopPropagation();
          if (!freezeHoveredCurrency()) {
            return;
          }
          openCurrencyMenu(mark.kind, trigger);
        });
        element.appendChild(trigger);
      }

      cursor = mark.index + mark.sign.length;
    }

    if (cursor < main.length) {
      const after = document.createElement('span');
      after.textContent = main.slice(cursor);
      element.appendChild(after);
    }
  }

  /**
   * Remplit la bulle et la positionne.
   *
   * On ecrit le contenu dans DEUX elements separes : un pour la conversion,
   * un pour le detail. Le second est masque quand il n'y a rien a dire.
   */
  /** Met a jour le texte de la bulle sans reconstruire tout le conteneur. */
  function updateTooltipText(content) {
    if (!tooltipElement) {
      return;
    }

    const find = function (selector) {
      return typeof tooltipElement.querySelector === 'function'
        ? tooltipElement.querySelector(selector)
        : null;
    };

    let mainElement = find('.unicorn-tooltip-main');
    let detailElement = find('.unicorn-tooltip-detail');

    if (!mainElement) {
      mainElement = document.createElement('div');
      mainElement.className = 'unicorn-tooltip-main';
      tooltipElement.insertBefore(mainElement, tooltipElement.firstChild);
    }
    renderMainContent(mainElement, content);

    if (content.detail) {
      if (!detailElement) {
        detailElement = document.createElement('div');
        detailElement.className = 'unicorn-tooltip-detail';
        if (typeof mainElement.insertAdjacentElement === 'function') {
          mainElement.insertAdjacentElement('afterend', detailElement);
        } else {
          tooltipElement.appendChild(detailElement);
        }
      }
      detailElement.textContent = content.detail;
    } else if (detailElement) {
      if (typeof detailElement.remove === 'function') {
        detailElement.remove();
      } else if (detailElement.parentNode &&
                 typeof detailElement.parentNode.removeChild === 'function') {
        detailElement.parentNode.removeChild(detailElement);
      }
    }
  }

  function renderTooltip(content, clientX, clientY, pickerType) {
    if (!tooltipElement) {
      return;
    }

    // Etat visuel distinct : la bulle figee est le bouton « enfonce ».
    if (tooltipElement.classList) {
      if (frozen) {
        tooltipElement.classList.add('unicorn-tooltip-frozen');
      } else {
        tooltipElement.classList.remove('unicorn-tooltip-frozen');
      }
    }

    closeSourceMenu();

    // On reconstruit le contenu (deux lignes au maximum).
    tooltipElement.textContent = '';

    const mainElement = document.createElement('div');
    mainElement.className = 'unicorn-tooltip-main';
    renderMainContent(mainElement, content);
    tooltipElement.appendChild(mainElement);

    if (content.detail) {
      const detailElement = document.createElement('div');
      detailElement.className = 'unicorn-tooltip-detail';
      detailElement.textContent = content.detail;
      tooltipElement.appendChild(detailElement);
    }

    // Le menu deroulant n'apparait que lorsque la bulle est FIGEE (clic sur
    // le montant ou l'unite). Au simple survol, on affiche seulement la
    // conversion par defaut.
    if (frozen && pickerType === 'unit') {
      appendUnitPicker();
      appendResizeHandle();
      applyTooltipSize();
    } else if (frozen && pickerType === 'time') {
      appendTimezonePicker();
      appendResizeHandle();
      applyTooltipSize();
    } else {
      // Au survol simple, la bulle reprend sa taille automatique.
      tooltipElement.style.width = '';
      tooltipElement.style.maxWidth = '';
      tooltipElement.classList.remove('unicorn-tooltip-sized');
      // On remet aussi la liste a sa hauteur par defaut (CSS).
      const list = getCurrencyListElement();
      if (list) {
        list.style.height = '';
        list.style.maxHeight = '';
      }
    }

    // On affiche AVANT de positionner : sans cela, la taille mesuree serait
    // celle de la bulle vide, et le placement serait faux.
    tooltipElement.style.display = 'block';
    positionTooltip(clientX, clientY);
  }

  /**
   * Ajoute le menu deroulant des devises cibles dans la bulle.
   *
   * Il permet de convertir le montant affiche vers N'IMPORTE QUELLE devise,
   * pas seulement le dollar. Le choix est memorise.
   */
  /**
   * Construit le menu deroulant CUSTOM de choix de la devise cible.
   *
   * Un menu natif (<select>) ne permet ni barre de recherche, ni drapeaux,
   * ni sections epinglees. On construit donc notre propre liste :
   *   - une barre de recherche ;
   *   - une section « Epinglees » (choix de l'utilisateur) ;
   *   - une section « Principales » (10 devises majeures) ;
   *   - une section « Autres » (ordre alphabetique).
   */
  /**
   * Retire les accents et met en minuscules, pour une recherche tolerante.
   * « Emirats » et « Émirats » doivent donner le meme resultat.
   */
  function normalizeSearchText(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Tous les noms de pays associes a une devise. */
  function currencyCountryNames(code) {
    const names = [];

    const meta = CURRENCY_META[code];
    if (meta && meta.country && COUNTRY_NAMES[meta.country]) {
      names.push(COUNTRY_NAMES[meta.country]);
    }

    const extra = CURRENCY_EXTRA_COUNTRIES[code];
    if (Array.isArray(extra)) {
      names.push(...extra);
    }

    return names;
  }

  /** Epingle / depingle une devise (menus source et destination). */
  function togglePinnedCurrency(code) {
    if (pinnedCurrencies.has(code)) {
      pinnedCurrencies.delete(code);
    } else {
      pinnedCurrencies.add(code);
    }
    savePinnedCurrencies();
  }

  /**
   * Enregistre la liste des devises epinglees dans le stockage.
   */
  function savePinnedCurrencies() {
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          'uniconv.pinnedCurrencies': Array.from(pinnedCurrencies)
        });
      }
    } catch (error) {
      // Stockage indisponible : l'epinglage reste en memoire seulement.
    }
  }

  /**
   * Charge les devises epinglees depuis le stockage.
   */
  function loadPinnedCurrencies() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }
      chrome.storage.local.get('uniconv.pinnedCurrencies', function (result) {
        if (chrome.runtime.lastError) return;
        const value = result && result['uniconv.pinnedCurrencies'];
        if (Array.isArray(value)) {
          for (const code of value) {
            if (CURRENCY_BY_CODE.has(code)) {
              pinnedCurrencies.add(code);
            }
          }
        }
      });

      if (chrome.storage.onChanged && chrome.storage.onChanged.addListener) {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area !== 'local' || !changes || !changes['uniconv.pinnedCurrencies']) {
            return;
          }
          const value = changes['uniconv.pinnedCurrencies'].newValue;
          pinnedCurrencies.clear();
          if (Array.isArray(value)) {
            for (const code of value) {
              if (CURRENCY_BY_CODE.has(code)) {
                pinnedCurrencies.add(code);
              }
            }
          }
        });
      }
    } catch (error) {
      // Stockage indisponible.
    }
  }

  /**
   * Affiche la bulle pour un montant, a une position donnee.
   *
   * La conversion etant asynchrone (elle passe par l'arriere-plan), la bulle
   * s'affiche d'abord avec « conversion… », puis se met a jour des que la
   * reponse arrive — a condition que la souris soit toujours sur le meme
   * montant.
   */
  /**
   * Unite cible effective pour une unite donnee :
   *   - celle choisie dans le menu si l'utilisateur en a choisi une ;
   *   - sinon celle deduite du systeme (metrique / imperial).
   */
  function effectiveTargetUnit(unitMatch) {
    if (selectedUnit) {
      return selectedUnit;
    }
    const converted = convertUnitToSystem(unitMatch, targetSystem);
    return converted ? converted.unit : unitMatch.unit;
  }

  /**
   * Ajoute le menu deroulant des UNITES (celles de la meme categorie que
   * l'unite figee) : longueurs, poids, volumes, temperatures ou vitesses.
   */
  function appendUnitPicker() {
    if (!frozenUnit) {
      return;
    }

    const container = document.createElement('div');
    container.className = 'unicorn-unit-picker';

    // Les clics dans le menu ne doivent pas fermer la bulle.
    container.addEventListener('click', function (event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    });

    const list = document.createElement('div');
    list.className = 'unicorn-unit-list';

    const current = effectiveTargetUnit(frozenUnit);
    const units = UNITS.filter((unit) => unit.category === frozenUnit.category);

    for (const unit of units) {
      const token = unitDisplayToken(unit);
      const fullName = unit.tokens[0];

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'unicorn-unit-item' + (unit === current ? ' selected' : '');
      item.setAttribute('data-unit', token);
      item.textContent = token === fullName ? token : `${token} · ${fullName}`;

      item.addEventListener('click', function (event) {
        if (event && typeof event.stopPropagation === 'function') {
          event.stopPropagation();
        }
        selectUnit(unit);
      });

      list.appendChild(item);
    }

    container.appendChild(list);

    // Pied de menu : accueille la poignee de redimensionnement.
    const footer = document.createElement('div');
    footer.className = 'unicorn-picker-footer';
    container.appendChild(footer);

    tooltipElement.appendChild(container);
  }

  /**
   * Change l'unite cible et met a jour le texte SANS reconstruire le menu.
   */
  function selectUnit(unit) {
    selectedUnit = unit;
    if (!frozenUnit) {
      return;
    }
    currentSignature = `unit|${frozenUnit.text}|${unitDisplayToken(unit)}`;
    updateTooltipText(buildUnitTooltipContent(frozenUnit, unit));
    updateUnitPickerSelection();
    keepTooltipInViewport();
  }

  /**
   * Met a jour la surbrillance de l'unite choisie sans reconstruire la liste.
   */
  function updateUnitPickerSelection() {
    if (!tooltipElement || !frozenUnit ||
        typeof tooltipElement.querySelector !== 'function') {
      return;
    }
    const list = tooltipElement.querySelector('.unicorn-unit-list');
    if (!list) {
      return;
    }

    const currentToken = unitDisplayToken(effectiveTargetUnit(frozenUnit));

    for (const item of list.children) {
      if (!item.className || item.className.indexOf('unicorn-unit-item') !== 0) {
        continue;
      }
      const token = item.getAttribute ? item.getAttribute('data-unit') : null;
      if (token === currentToken) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    }
  }

  /**
   * Construit le contenu de la bulle pour une UNITE de mesure.
   *
   * @param {object} unitMatch - resultat de findUnitsInText
   * @returns {{main: string, detail: string|null}}
   */
  /**
   * Retourne le symbole court d'une unite pour l'affichage.
   *   « kilometre » -> « km », « celsius » -> « °C », « litres » -> « L ».
   */
  function unitDisplayToken(unit) {
    const tokens = unit.tokens || [];

    // On choisit le token le PLUS COURT : c'est le symbole canonique et
    // singulier (« km » plutot que « kilometre », « lb » plutot que « lbs »).
    let token = tokens[0] || '';
    for (const candidate of tokens) {
      if (candidate.length < token.length) {
        token = candidate;
      }
    }

    if (unit.category === 'speed' && unit.system === 'metric') {
      return 'km/h';
    }
    if (unit.category === 'speed' && unit.system === 'imperial') {
      return 'mph';
    }
    if (token === 'l') {
      return 'L';
    }
    return token;
  }

  /**
   * Unite d'equivalence « naturelle » pour chaque source.
   *
   * Pour la ligne « 1 km = 0,62 mi », il faut choisir l'unite opposee la plus
   * parlante, INDEPENDAMMENT de la grandeur (sinon « 1 km » donnerait
   * « 3280 pieds », techniquement juste mais illisible).
   */
  const EQUIVALENCE_TARGET = {
    'km': 'mi', 'm': 'ft', 'cm': 'in', 'mm': 'in',
    'mi': 'km', 'ft': 'm', 'in': 'cm', 'yd': 'm',
    'kg': 'lb', 'g': 'oz', 'lb': 'kg', 'oz': 'g', 'st': 'kg',
    'L': 'gal', 'ml': 'gal', 'gal': 'L', 'pt': 'L', 'qt': 'L', 'cup': 'L',
    'cl': 'gal', 'dl': 'gal', 'hl': 'gal', 'cc': 'gal',
    'fl oz': 'L', 'tsp': 'L', 'tbsp': 'L',
    'nmi': 'km',
    'km/h': 'mph', 'mph': 'km/h', 'm/s': 'mph', 'kn': 'km/h'
  };

  /**
   * Construit la ligne d'equivalence « 1 km = 0,62 mi ».
   *
   * Comme pour les devises (« 1 EUR = 1,1193 USD »), on affiche la valeur
   * d'UNE unite de depart dans le systeme oppose.
   *
   * Cas particulier : les temperatures n'ont pas de facteur (leur conversion
   * inclut un decalage). On affiche alors la formule, plus lisible qu'un
   * pseudo-taux qui serait faux.
   */
  function buildUnitEquivalence(unitMatch) {
    // Temperatures : formule, pas de taux.
    if (unitMatch.category === 'temperature') {
      // Kelvin : la formule differe du Celsius.
      const tokens = unitMatch.unit.tokens || [];
      if (tokens.indexOf('K') !== -1 || tokens.indexOf('kelvin') !== -1) {
        return '°C = K − 273,15';
      }
      return unitMatch.system === 'metric'
        ? '°F = °C × 9/5 + 32'
        : '°C = (°F − 32) × 5/9';
    }

    const sourceToken = unitDisplayToken(unitMatch.unit);
    const targetToken = EQUIVALENCE_TARGET[sourceToken];

    if (!targetToken) {
      return null;
    }

    const target = UNIT_BY_TOKEN.get(targetToken);
    if (!target) {
      return null;
    }

    // 1 unite de depart, convertie dans l'unite cible.
    const rate = (1 * unitMatch.unit.factor) / target.factor;

    const rateText = numberFormatter(numberLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    }).format(rate);

    return `1 ${sourceToken} = ${rateText} ${targetToken}`;
  }

  /**
   * Construit le contenu de la bulle pour une UNITE de mesure.
   *
   * @param {object} unitMatch - resultat de findUnitsInText
   * @returns {{main: string, detail: string|null}}
   */
  function buildUnitTooltipContent(unitMatch, forcedUnit) {
    const sourceText = formatUnitValue(unitMatch.value, unitMatch.unit);

    // Unite cible : celle choisie par l'utilisateur, sinon celle deduite du
    // systeme (metrique / imperial).
    let targetUnit = forcedUnit || null;
    if (!targetUnit) {
      const converted = convertUnitToSystem(unitMatch, targetSystem);
      targetUnit = converted ? converted.unit : null;
    }

    let convertedValue = null;
    if (targetUnit && targetUnit !== unitMatch.unit) {
      convertedValue = convertUnitValue(unitMatch.value, unitMatch.unit, targetUnit);
    }

    const equivalence = targetUnit
      ? buildUnitEquivalenceTo(unitMatch, targetUnit)
      : buildUnitEquivalence(unitMatch);

    if (convertedValue === null) {
      // Meme unite, ou conversion impossible : on affiche juste la valeur.
      return {
        main: sourceText,
        detail: equivalence
      };
    }

    return {
      main: `${sourceText} = ${formatUnitValue(convertedValue, targetUnit)}`,
      detail: equivalence
    };
  }

  /**
   * Ligne d'equivalence vers une unite precise : « 1 km = 0,62 mi ».
   * Pour les temperatures, on garde la formule (pas de taux).
   */
  function buildUnitEquivalenceTo(unitMatch, targetUnit) {
    if (unitMatch.category === 'temperature') {
      return buildUnitEquivalence(unitMatch);
    }

    const rate = unitMatch.unit.factor / targetUnit.factor;
    const rateText = numberFormatter(numberLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    }).format(rate);

    return `1 ${unitDisplayToken(unitMatch.unit)} = ${rateText} ${unitDisplayToken(targetUnit)}`;
  }

  /**
   * Met en forme une valeur d'unite, sans zeros inutiles.
   *
   * @param {number} value
   * @param {object} unit
   * @returns {string}
   */
  function formatUnitValue(value, unit) {
    const token = unitDisplayToken(unit);

    const number = numberFormatter(numberLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);

    // Temperature : le degre et la lettre sont colles (« 20°C »).
    if (token.startsWith('°')) {
      return `${number}${token}`;
    }

    // Autres : une espace entre le nombre et l'unite.
    return `${number} ${token}`;
  }

  /**
   * Affiche la bulle pour une unite (conversion locale, sans attente reseau).
   */
  function showUnitTooltip(unitMatch, clientX, clientY) {
    hoveredAmount = null;
    if (!frozen) {
      resetBubbleTargets();
    }
    if (!tooltipElement) {
      initTooltip();
    }

    const key = `unit|${unitMatch.text}|${selectedUnit ? unitDisplayToken(selectedUnit) : ''}`;
    lastTooltipPosition = { x: clientX, y: clientY };

    if (key !== currentSignature) {
      currentSignature = key;
      conversionRequestId += 1; // toute conversion de devise en cours est obsolete
      renderTooltip(buildUnitTooltipContent(unitMatch, selectedUnit), clientX, clientY, 'unit');
    }

    tooltipElement.style.display = 'block';
    positionTooltip(clientX, clientY);
  }

  // =========================================================================
  //  FUSEAUX HORAIRES : BULLE ET MENU DES VILLES (iteration 11)
  // =========================================================================

  /**
   * Change le fuseau cible de la bulle courante. Il n'est PAS enregistre :
   * le fuseau par defaut vient du cadre « Unites de reference ».
   */
  function saveTargetTimezone(id) {
    targetTimezone = typeof id === 'string' ? id : '';
  }

  /** Fuseau cible effectif : celui du reglage, sinon le fuseau local. */
  function timezoneTargetZone() {
    return tzZoneFromId(targetTimezone || tzLocalZoneId());
  }

  /** Contenu de la bulle pour une heure detectee. */
  function buildTimeTooltipContent(timeMatch) {
    const hour12 = timeFormatSetting === '12' ||
      (timeFormatSetting === 'auto' && tzBrowserUses12Hour());
    return tzBuildContent(timeMatch, timezoneTargetZone(), hour12, Date.now());
  }

  /**
   * Affiche la bulle d'une heure avec fuseau.
   *
   * Meme principe que les devises et les unites : au survol, la conversion
   * seule ; au clic (bulle figee), le menu des villes.
   */
  function showTimeTooltip(timeMatch, clientX, clientY) {
    hoveredAmount = null;
    if (!frozen) {
      resetBubbleTargets();
    }
    if (!tooltipElement) {
      initTooltip();
    }

    const key = foundTimeKey(timeMatch);
    lastTooltipPosition = { x: clientX, y: clientY };

    if (key !== currentSignature) {
      currentSignature = key;
      conversionRequestId += 1; // toute conversion de devise en cours est obsolete
      renderTooltip(buildTimeTooltipContent(timeMatch), clientX, clientY, 'time');
    }

    tooltipElement.style.display = 'block';
    positionTooltip(clientX, clientY);
  }

  /** Cle d'affichage d'une heure (text + fuseau source + cible + format). */
  function foundTimeKey(timeMatch) {
    return `time|${timeMatch.text}|${timeMatch.zone.iana || timeMatch.zone.fixedMinutes}|` +
      `${targetTimezone}|${timeFormatSetting}`;
  }

  /** Met a jour la surbrillance du menu des villes, sans le reconstruire. */
  function updateTimezoneSelection() {
    if (!tooltipElement || typeof tooltipElement.querySelector !== 'function') {
      return;
    }
    const list = tooltipElement.querySelector('.unicorn-currency-list');
    if (!list) {
      return;
    }
    const currentId = targetTimezone;
    for (const item of list.children) {
      if (!item.className || item.className.indexOf('unicorn-currency-item') !== 0) {
        continue;
      }
      const zoneId = item.getAttribute ? item.getAttribute('data-zone') : null;
      if (zoneId === currentId) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    }
  }

  /**
   * Change la ville de reference et met la bulle a jour.
   */
  function selectTargetTimezone(id) {
    saveTargetTimezone(id);

    if (!frozenTime) {
      return;
    }

    updateTimezoneSelection();
    currentSignature = foundTimeKey(frozenTime);
    updateTooltipText(buildTimeTooltipContent(frozenTime));
    positionTooltip(
      lastTooltipPosition ? lastTooltipPosition.x : 0,
      lastTooltipPosition ? lastTooltipPosition.y : 0
    );
  }

  /** Enregistre les villes epinglees. */
  function savePinnedTimezones() {
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          'uniconv.pinnedTimezones': Array.from(pinnedTimezones)
        });
      }
    } catch (error) {
      // Stockage indisponible : l'epinglage reste en memoire seulement.
    }
  }

  /** Charge les villes epinglees. */
  function loadPinnedTimezones() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }
      chrome.storage.local.get('uniconv.pinnedTimezones', function (result) {
        if (chrome.runtime.lastError) return;
        const value = result && result['uniconv.pinnedTimezones'];
        if (Array.isArray(value)) {
          for (const id of value) {
            if (typeof id === 'string' && TZ_CITY_BY_ID.has(id)) {
              pinnedTimezones.add(id);
            }
          }
        }
      });
    } catch (error) {
      // Stockage indisponible.
    }
  }

  /**
   * Construit le menu des villes dans la bulle figee.
   *
   * Il REUTILISE les classes CSS du menu des devises (meme apparence, memes
   * drapeaux, meme poignee de redimensionnement). C'est volontaire : deux
   * menus differents finiraient par diverger visuellement.
   */
  function appendTimezonePicker() {
    if (!frozenTime) {
      return;
    }

    // Les decalages affiches correspondent a l'INSTANT DE L'HEURE convertie
    // (heure d'ete / heure d'hiver), pas forcement a maintenant : une heure
    // de janvier doit afficher GMT+1 pour Paris, pas GMT+2.
    let referenceInstant = Date.now();
    try {
      referenceInstant = tzConvert(frozenTime, timezoneTargetZone(), referenceInstant).instant;
    } catch (error) {
      // On garde l'instant courant.
    }

    // Cache par ville : le menu est reconstruit a chaque frappe dans la
    // recherche, et calculer 132 decalages a chaque fois serait inutile.
    const offsetLabels = new Map();

    /** « GMT+2 », « GMT-5 », « GMT+5:30 »… pour une ville. */
    function gmtLabel(zoneId) {
      if (offsetLabels.has(zoneId)) {
        return offsetLabels.get(zoneId);
      }
      let label = 'GMT';
      try {
        label = tzFormatGmtOffset(tzOffsetMinutesAt(tzZoneFromId(zoneId), referenceInstant));
      } catch (error) {
        label = 'GMT';
      }
      offsetLabels.set(zoneId, label);
      return label;
    }

    const container = document.createElement('div');
    container.className = 'unicorn-currency-picker';

    container.addEventListener('click', function (event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    });

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'unicorn-currency-search';
    search.placeholder = 'Rechercher une ville ou un pays…';
    search.setAttribute('aria-label', 'Rechercher une ville ou un pays');
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Choisir une ville de reference');
    container.appendChild(search);

    const list = document.createElement('div');
    list.className = 'unicorn-currency-list';
    container.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'unicorn-picker-footer';
    container.appendChild(footer);

    /** Vrai si la ville correspond a la recherche. */
    function matches(entry, query) {
      if (!query) {
        return true;
      }
      const needle = normalizeSearchText(query).trim();
      if (needle === '') {
        return true;
      }
      const terms = [entry.city, entry.id, entry.country, entry.region].join(' ');
      return normalizeSearchText(terms).includes(needle);
    }

    /** Une ligne du menu : drapeau, ville, epingle. */
    function buildItem(entry) {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('data-zone', entry.id);
      // « Ma position » est une ligne a part : une ville de la liste n'est
      // marquee comme choisie que si l'utilisateur l'a vraiment choisie.
      item.className = 'unicorn-currency-item' +
        (targetTimezone !== '' && entry.id === targetTimezone ? ' selected' : '');

      const flag = document.createElement('span');
      flag.className = 'unicorn-flag';
      flag.textContent = flagEmoji(entry.country);
      item.appendChild(flag);

      const label = document.createElement('span');
      label.className = 'unicorn-currency-item-label';
      // Le DECALAGE (GMT+2) est plus parlant que l'identifiant IANA.
      // L'identifiant complet reste accessible en infobulle (title).
      label.textContent = `${entry.city} (${gmtLabel(entry.id)})`;
      item.title = entry.id;
      item.appendChild(label);

      const pin = document.createElement('span');
      pin.className = 'unicorn-currency-item-pin' +
        (pinnedTimezones.has(entry.id) ? ' pinned' : '');
      pin.textContent = '📌';
      pin.title = pinnedTimezones.has(entry.id) ? 'Retirer des epinglees' : 'Epingler';
      pin.setAttribute('aria-pressed', pinnedTimezones.has(entry.id) ? 'true' : 'false');
      item.appendChild(pin);

      item.addEventListener('click', function (event) {
        if (event && typeof event.stopPropagation === 'function') {
          event.stopPropagation();
        }
        if (event && event.target === pin) {
          if (pinnedTimezones.has(entry.id)) {
            pinnedTimezones.delete(entry.id);
          } else {
            pinnedTimezones.add(entry.id);
          }
          savePinnedTimezones();
          renderList(search.value);
          return;
        }
        selectTargetTimezone(entry.id);
      });

      return item;
    }

    /** Ligne speciale : revenir au fuseau local du navigateur. */
    function buildLocalItem() {
      const localId = tzLocalZoneId();
      const entry = TZ_CITY_BY_ID.get(localId);

      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('data-zone', '');
      item.className = 'unicorn-currency-item' + (targetTimezone === '' ? ' selected' : '');

      const flag = document.createElement('span');
      flag.className = 'unicorn-flag';
      flag.textContent = entry ? flagEmoji(entry.country) : '🌐';
      item.appendChild(flag);

      const label = document.createElement('span');
      label.className = 'unicorn-currency-item-label';
      label.textContent = entry
        ? `Ma ville — ${entry.city} (${gmtLabel(localId)})`
        : `Ma ville (${localId})`;
      item.title = localId;
      item.appendChild(label);

      item.addEventListener('click', function (event) {
        if (event && typeof event.stopPropagation === 'function') {
          event.stopPropagation();
        }
        selectTargetTimezone('');
      });

      return item;
    }

    function appendSection(title, entries) {
      if (entries.length === 0) {
        return;
      }
      const header = document.createElement('div');
      header.className = 'unicorn-currency-section';
      header.textContent = title;
      list.appendChild(header);
      for (const entry of entries) {
        list.appendChild(buildItem(entry));
      }
    }

    function renderList(query) {
      list.textContent = '';
      const q = (query || '').trim();

      const pinned = TZ_CITIES.filter(function (entry) {
        return pinnedTimezones.has(entry.id) && matches(entry, q);
      });
      const top = TZ_CITIES.filter(function (entry) {
        return entry.primary && !pinnedTimezones.has(entry.id) && matches(entry, q);
      });
      const others = TZ_CITIES.filter(function (entry) {
        return !entry.primary && !pinnedTimezones.has(entry.id) && matches(entry, q);
      }).sort(function (a, b) { return a.city.localeCompare(b.city, 'fr'); });

      if (q === '') {
        const localHeader = document.createElement('div');
        localHeader.className = 'unicorn-currency-section';
        localHeader.textContent = 'Ma position';
        list.appendChild(localHeader);
        list.appendChild(buildLocalItem());
      }

      appendSection('Epinglees', pinned);
      appendSection('Principales', top);
      appendSection('Autres villes', others);
    }

    search.addEventListener('input', function () {
      renderList(search.value);
    });

    renderList('');
    tooltipElement.appendChild(container);
  }

  function showTooltip(amount, clientX, clientY) {
    hoveredAmount = amount;
    if (!frozen) {
      resetBubbleTargets();
    }
    if (!tooltipElement) {
      initTooltip();
    }

    const currencyCode = amount.currency ? amount.currency.code : '?';
    const key = `${currencyCode}|${amount.value}|${amount.range ? amount.range.max : ''}|${amount.text}`;

    // On memorise la position pour pouvoir repositionner la bulle quand le
    // texte s'allonge (le resultat prend plus de place que « conversion… »).
    lastTooltipPosition = { x: clientX, y: clientY };

    if (key !== currentSignature) {
      currentSignature = key;

      // Affichage immediat : « conversion… », pour que la bulle apparaisse
      // sans attendre le reseau.
      renderTooltip(buildTooltipContent(amount, null), clientX, clientY, 'currency');

      // Identifiant de cette demande : si la souris part ailleurs avant la
      // reponse, on ignore la reponse devenue obsolete.
      conversionRequestId += 1;
      const requestId = conversionRequestId;

      requestConversion(amount).then(function (result) {
        if (requestId !== conversionRequestId) {
          return; // une demande plus recente a pris le relais
        }
        if (!tooltipElement || tooltipElement.style.display === 'none') {
          return; // la bulle n'est plus affichee
        }


        // On redessine, puis on repositionne : le texte a change de taille,
        // et la bulle doit rester entierement visible a l'ecran.
        renderTooltip(
          buildTooltipContent(amount, result),
          lastTooltipPosition ? lastTooltipPosition.x : clientX,
          lastTooltipPosition ? lastTooltipPosition.y : clientY,
          'currency'
        );
      });
    } else {
      // Meme montant qu'avant : on rafraichit seulement la position.
      tooltipElement.style.display = 'block';
      positionTooltip(clientX, clientY);
    }
  }

  /**
   * Place la bulle pres du curseur, en la gardant toujours visible a l'ecran.
   */
  function positionTooltip(clientX, clientY) {
    const box = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = clientX + MOUSE_GAP;
    if (left + box.width > viewportWidth - VIEWPORT_MARGIN) {
      left = clientX - box.width - MOUSE_GAP;
    }
    if (left < VIEWPORT_MARGIN) {
      left = VIEWPORT_MARGIN;
    }

    let top = clientY - box.height - MOUSE_GAP;
    if (top < VIEWPORT_MARGIN) {
      top = clientY + MOUSE_GAP;
    }
    if (top + box.height > viewportHeight - VIEWPORT_MARGIN) {
      top = Math.max(VIEWPORT_MARGIN, viewportHeight - box.height - VIEWPORT_MARGIN);
    }

    tooltipElement.style.left = `${Math.round(left)}px`;
    tooltipElement.style.top = `${Math.round(top)}px`;
  }

  /**
   * Garde la bulle a sa position actuelle, en la decalant seulement si elle
   * depasse de l'ecran.
   *
   * POURQUOI CETTE FONCTION : pendant le redimensionnement, on ne doit PAS
   * recalculer la position par rapport a la souris. Sinon, la bulle change de
   * camp (au-dessus / en dessous du curseur) des que sa hauteur varie, ce qui
   * donne un comportement incoherent. Ici, le coin superieur gauche reste
   * fixe et seule la taille change ; on ne decale que si necessaire.
   */
  function keepTooltipInViewport() {
    if (!tooltipElement) {
      return;
    }

    const box = tooltipElement.getBoundingClientRect();
    let left = box.left;
    let top = box.top;

    const maxLeft = window.innerWidth - box.width - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - box.height - VIEWPORT_MARGIN;

    if (left > maxLeft) {
      left = Math.max(VIEWPORT_MARGIN, maxLeft);
    }
    if (top > maxTop) {
      top = Math.max(VIEWPORT_MARGIN, maxTop);
    }

    tooltipElement.style.left = `${Math.round(left)}px`;
    tooltipElement.style.top = `${Math.round(top)}px`;
  }

  /** Masque la bulle. */
  function hideTooltip() {
    // Une bulle figee reste affichee tant que l'utilisateur n'a pas clique
    // ailleurs. Les deplacements de souris ne doivent pas la fermer.
    if (frozen) {
      return;
    }

    // Un affichage programme n'a plus lieu d'etre : on l'annule.
    cancelPendingShow();
    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }
    // La bulle disparait peut-etre alors que la souris la survolait : on
    // remet le drapeau a zero, sinon plus aucun survol ne serait traite.
    isTooltipHovered = false;
    currentSignature = null;
    // Toute reponse de conversion qui arriverait maintenant serait obsolete.
    conversionRequestId += 1;
  }

  /** Charge la taille memorisee de la bulle. */
  function loadTooltipSize() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }
      chrome.storage.local.get('uniconv.tooltipSize', function (result) {
        if (chrome.runtime.lastError) return;
        const value = result && result['uniconv.tooltipSize'];
        if (value && typeof value === 'object') {
          if (typeof value.width === 'number' && Number.isFinite(value.width)) {
            tooltipSize.width = Math.max(240, Math.min(700, value.width));
          }
          // Compatibilite avec l'ancien format (« height »).
          const listHeight = typeof value.listHeight === 'number'
            ? value.listHeight
            : value.height;
          if (typeof listHeight === 'number' && Number.isFinite(listHeight)) {
            tooltipSize.listHeight = Math.max(100, Math.min(
              Math.max(100, window.innerHeight - 180), listHeight
            ));
          }
        }
      });
    } catch (error) {
      // Stockage indisponible : taille automatique.
    }
  }

  /** Enregistre la taille choisie. */
  function saveTooltipSize() {
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          'uniconv.tooltipSize': {
            width: tooltipSize.width,
            listHeight: tooltipSize.listHeight
          }
        });
      }
    } catch (error) {
      // Stockage indisponible.
    }
  }

  /** Retourne la liste des devises de la bulle, ou null. */
  function getCurrencyListElement() {
    if (!tooltipElement || typeof tooltipElement.querySelector !== 'function') {
      return null;
    }
    return tooltipElement.querySelector('.unicorn-currency-list') ||
           tooltipElement.querySelector('.unicorn-unit-list');
  }

  /** Applique la taille memorisee (ou la taille automatique). */
  function applyTooltipSize() {
    if (!tooltipElement) {
      return;
    }

    // 1. Largeur de la BULLE (entre 240 et 700 px, applique en ligne).
    if (tooltipSize.width) {
      const safeWidth = Math.max(240, Math.min(700, tooltipSize.width));
      tooltipElement.style.width = `${safeWidth}px`;
      tooltipElement.style.maxWidth = 'none';
      // Cette classe fait prendre au menu toute la largeur de la bulle.
      tooltipElement.classList.add('unicorn-tooltip-sized');
    } else {
      tooltipElement.style.width = '';
      tooltipElement.style.maxWidth = '';
      tooltipElement.classList.remove('unicorn-tooltip-sized');
    }

    // 2. Hauteur de la LISTE, et non de la bulle.
    //
    // POURQUOI LA LISTE ET PAS LA BULLE : redimensionner la bulle entiere
    // laissait la liste s'etendre sans limite et deborder sur toute la page.
    // En bornant la LISTE, le menu reste toujours contenu dans la bulle, et
    // il defile a l'interieur.
    const list = getCurrencyListElement();
    if (list) {
      if (tooltipSize.listHeight) {
        const safeHeight = Math.max(100, Math.min(
          Math.max(100, window.innerHeight - 180), tooltipSize.listHeight
        ));
        list.style.height = `${safeHeight}px`;
        list.style.maxHeight = `${safeHeight}px`;
      } else {
        list.style.height = '';
        list.style.maxHeight = '';
      }
    }
  }

  /**
   * Ajoute la poignee de redimensionnement en bas a droite de la bulle.
   *
   * Glisser horizontalement change la largeur de la bulle ; glisser
   * verticalement change la hauteur de la liste des devises. Tout est
   * borne : la bulle ne peut pas depasser l'ecran.
   */
  function appendResizeHandle() {
    const handle = document.createElement('span');
    handle.className = 'unicorn-tooltip-resize';
    handle.textContent = '\u2921';
    handle.title = 'Redimensionner la bulle';
    handle.setAttribute('role', 'button');
    handle.setAttribute('aria-label', 'Redimensionner la bulle');
    handle.setAttribute('tabindex', '0');

    handle.addEventListener('pointerdown', function (event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      const startX = event.clientX;
      const startY = event.clientY;
      const box = tooltipElement.getBoundingClientRect();
      const startWidth = box.width > 0 ? box.width : 320;

      const list = getCurrencyListElement();
      const startListHeight = list
        ? Math.max(100, list.getBoundingClientRect().height)
        : 180;

      const maxWidth = Math.min(700, window.innerWidth - 20);
      const maxListHeight = Math.max(100, window.innerHeight - 180);

      function onMove(moveEvent) {
        const width = Math.max(240, Math.min(maxWidth, startWidth + (moveEvent.clientX - startX)));
        const listHeight = Math.max(100, Math.min(maxListHeight, startListHeight + (moveEvent.clientY - startY)));

        tooltipSize.width = Math.round(width);
        tooltipSize.listHeight = Math.round(listHeight);

        applyTooltipSize();
        // On garde le coin superieur gauche fixe : la bulle grandit vers le
        // bas et la droite, sans changer de camp.
        keepTooltipInViewport();
      }

      function onUp() {
        // On retire les trois ecouteurs, y compris « pointercancel » : si
        // l'utilisateur relache la souris hors de la fenetre, l'evenement
        // pointerup peut ne jamais arriver et les ecouteurs fuiraient.
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        saveTooltipSize();
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });

    // Meme reglage au CLAVIER : fleches gauche/droite pour la largeur,
    // haut/bas pour la hauteur de la liste (Maj = pas plus grand).
    handle.addEventListener('keydown', function (event) {
      const step = event.shiftKey ? 40 : 10;
      const box = tooltipElement.getBoundingClientRect();
      const list = getCurrencyListElement();
      const currentWidth = tooltipSize.width || (box.width > 0 ? box.width : 320);
      const currentHeight = tooltipSize.listHeight ||
        (list ? list.getBoundingClientRect().height : 180);
      let handled = true;

      switch (event.key) {
        case 'ArrowLeft':
          tooltipSize.width = Math.round(Math.max(240, currentWidth - step));
          break;
        case 'ArrowRight':
          tooltipSize.width = Math.round(Math.min(700, currentWidth + step));
          break;
        case 'ArrowUp':
          tooltipSize.listHeight = Math.round(Math.max(100, currentHeight - step));
          break;
        case 'ArrowDown':
          tooltipSize.listHeight = Math.round(Math.min(
            Math.max(100, window.innerHeight - 180), currentHeight + step));
          break;
        default:
          handled = false;
      }

      if (!handled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyTooltipSize();
      keepTooltipInViewport();
      saveTooltipSize();
    });

    // On place la poignee dans le PIED du menu (s'il existe), pour qu'elle
    // ne recouvre jamais la barre de defilement de la liste.
    const footer = (typeof tooltipElement.querySelector === 'function')
      ? tooltipElement.querySelector('.unicorn-picker-footer')
      : null;

    (footer || tooltipElement).appendChild(handle);
  }

  /** Defige la bulle et la masque. */
  function dismissFrozenTooltip() {
    frozen = false;
    if (tooltipElement && tooltipElement.classList &&
        typeof tooltipElement.classList.remove === 'function') {
      tooltipElement.classList.remove('unicorn-tooltip-frozen');
    }
    hoveredAmount = null;
    closeSourceMenu();
    resetBubbleTargets();
        frozenAmount = null;
    frozenUnit = null;
    frozenTime = null;
    selectedUnit = null;
    isTooltipHovered = false;
    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }
    currentSignature = null;
    conversionRequestId += 1;
  }

  /**
   * Gere le clic : un clic sur un montant FIGE la bulle et ouvre le menu de
   * devise ; un clic ailleurs la referme.
   */
  function onDocumentClick(event) {
    // Un clic DANS la bulle (menu) ne doit rien fermer.
    if (tooltipElement && tooltipElement.contains && tooltipElement.contains(event.target)) {
      return;
    }

    const found = amountInImageAt(event.clientX, event.clientY) ||
      amountAtPoint(event.clientX, event.clientY) ||
      amountByRectAt(event.clientX, event.clientY);

    if (found) {
      resetBubbleTargets();
    }

    if (found && found.kind === 'currency') {
      // On fige la bulle sur ce montant et on affiche le menu des devises.
      frozen = true;
            frozenAmount = found.amount;
      frozenUnit = null;
      frozenTime = null;
      selectedUnit = null;
      currentSignature = null;
      // On rafraichit la liste des devises disponibles au moment d'ouvrir le
      // menu : si l'arriere-plan a fini de charger les taux entre-temps, les
      // 160+ monnaies seront proposees.
        showTooltip(found.amount, event.clientX, event.clientY);
    } else if (found && found.kind === 'unit') {
      // On fige la bulle sur cette unite et on affiche le menu des unites.
      frozen = true;
            frozenAmount = null;
      frozenUnit = found.unit;
      frozenTime = null;
      selectedUnit = null;
      currentSignature = null;
      showUnitTooltip(found.unit, event.clientX, event.clientY);
    } else if (found && found.kind === 'time') {
      // Heure figee : le menu des villes s'ouvre (meme principe qu'une devise).
      frozen = true;
            frozenAmount = null;
      frozenUnit = null;
      frozenTime = found.time;
      selectedUnit = null;
      currentSignature = null;
      showTimeTooltip(found.time, event.clientX, event.clientY);
    } else {
      dismissFrozenTooltip();
    }
  }

  // =========================================================================
  //  6. SURVEILLANCE DE LA SOURIS
  // =========================================================================

  /**
   * Appelee a chaque deplacement de la souris.
   *
   * Deux optimisations indispensables :
   *  1. « requestAnimationFrame » : une seule verification par image affichee ;
   *  2. le frein HOVER_THROTTLE_MS : au maximum une verification toutes les
   *     60 millisecondes.
   * Et un verrou (framePending) : une seule verification en attente a la fois,
   * pour ne pas empiler des traitements en retard sur la souris.
   */
  // =========================================================================
  //  REGLAGES UTILISATEUR (iteration 8)
  // =========================================================================
  //
  // Ces reglages sont lus dans le stockage du navigateur (page d'options) et
  // s'appliquent IMMEDIATEMENT a tous les onglets ouverts : c'est le role de
  // watchDisplaySettings().

  /** Langue de l'interface de la bulle : « fr » ou « en ». */
  let uiLanguage = (function () {
    const supported = ['fr', 'en', 'es', 'ru', 'zh', 'ar'];
    const nav = String(
      (typeof navigator !== 'undefined' && navigator.language) || 'en'
    ).toLowerCase().slice(0, 2);
    // Langue systeme couverte -> elle ; sinon ANGLAIS.
    return supported.indexOf(nav) !== -1 ? nav : 'en';
  })();

  /** Faut-il convertir les devises ? (reglage utilisateur) */
  let detectCurrencies = true;

  /** Faut-il convertir les unites de mesure ? (reglage utilisateur) */
  let detectUnits = true;

  /** Faut-il convertir les heures et fuseaux horaires ? (reglage utilisateur) */
  let detectTimezones = true;

  /** Fuseau cible (ville) en IANA. Chaine vide = fuseau local du navigateur. */
  let targetTimezone = '';

  /** Affichage des heures : « auto », « 24 » ou « 12 ». */
  let timeFormatSetting = 'auto';

  /** Villes epinglees dans le menu des fuseaux. */
  const pinnedTimezones = new Set();

  /** Delai avant affichage de la bulle, en millisecondes (0 = immediat). */
  let hoverDelayMs = 0;

  /** Theme de la bulle : « dark », « light », ou « auto ». */
  let tooltipThemeSetting = 'dark';

  /** Delai reellement applique (auto = selon le systeme). */
  let effectiveTheme = 'dark';

  /** Minuterie d'affichage differe de la bulle. */
  let showTimer = null;

  /** Signature du montant en attente d'affichage. */
  let pendingShowKey = null;

  /**
   * Textes de l'interface de la bulle.
   *
   * On ne traduit QUE ce que l'extension affiche : jamais le contenu de la
   * page. Deux langues suffisent (francais, anglais) ; le reste viendra si
   * le besoin se presente.
   */
  const TEXTS = {
    conversion: {
      fr: 'conversion…', en: 'converting…',
      es: 'convirtiendo…', ru: 'преобразование…', zh: '转换中…',
      ar: 'جارٍ التحويل…'
    },
    noRate: {
      fr: 'pas de taux disponible pour cette devise',
      en: 'no exchange rate for this currency',
      es: 'sin tipo de cambio para esta moneda',
      ru: 'нет курса для этой валюты',
      zh: '此货币没有可用汇率',
      ar: 'لا يوجد سعر صرف لهذه العملة'
    },
    backgroundDown: {
      fr: 'conversion indisponible (arriere-plan)',
      en: 'conversion unavailable (background)',
      es: 'conversión no disponible (segundo plano)',
      ru: 'конвертация недоступна (фон)',
      zh: '转换不可用（后台）',
      ar: 'التحويل غير متاح (الخلفية)'
    },
    impossible: {
      fr: 'conversion impossible', en: 'conversion failed',
      es: 'conversión imposible', ru: 'конвертация невозможна', zh: '无法转换',
      ar: 'التحويل مستحيل'
    },
    cachedRate: {
      fr: 'taux en cache', en: 'cached rate',
      es: 'tipo en caché', ru: 'курс в кэше', zh: '缓存汇率',
      ar: 'سعر مخزّن'
    },
    toMetric: {
      fr: 'vers metrique', en: 'to metric',
      es: 'a métrico', ru: 'в метрическую', zh: '转公制',
      ar: 'إلى المتري'
    },
    toImperial: {
      fr: 'vers imperial', en: 'to imperial',
      es: 'a imperial', ru: 'в имперскую', zh: '转英制',
      ar: 'إلى الإمبراطوري'
    },
    sameSystem: {
      fr: 'deja en metrique', en: 'already metric',
      es: 'ya en métrico', ru: 'уже метрическая', zh: '已是公制',
      ar: 'متري بالفعل'
    },
    sourceCurrency: {
      fr: 'Devise de départ', en: 'From currency',
      es: 'Moneda de origen', ru: 'Исходная валюта',
      zh: '源货币', ar: 'عملة المصدر'
    },
    convertTo: {
      fr: 'Convertir vers', en: 'Convert to',
      es: 'Convertir a', ru: 'Конвертировать в',
      zh: '转换为', ar: 'حوّل إلى'
    }
  };

  /** Traduit une cle selon la langue choisie. */
  function t(key) {
    const entry = TEXTS[key];
    if (!entry) {
      return key;
    }
    return entry[uiLanguage] || entry.fr;
  }

  /** Locale de formatage des nombres, selon la langue. */
  function numberLocale() {
    const locales = {
      fr: 'fr-FR', en: 'en-US', es: 'es-ES', ru: 'ru-RU', zh: 'zh-CN',
      ar: 'ar-EG'
    };
    return locales[uiLanguage] || 'fr-FR';
  }

  /**
   * Cache des formateurs de nombres.
   *
   * POURQUOI : creer un Intl.NumberFormat coute environ 30 fois plus cher que
   * formater avec. La bulle en creait un NOUVEAU a chaque survol (et deux pour
   * la notation compacte), sur chaque mouvement de souris. Le cache rend le
   * cout constant apres le premier appel.
   */
  const numberFormatters = new Map();
  function numberFormatter(locale, options) {
    const key = `${locale}|${options ? JSON.stringify(options) : ''}`;
    let formatter = numberFormatters.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, options);
      numberFormatters.set(key, formatter);
    }
    return formatter;
  }

  /** Libelle « vers metrique » / « vers imperial », selon la langue. */
  function systemLabel(target) {
    return target === 'imperial' ? t('toImperial') : t('toMetric');
  }

  /**
   * Détermine le theme reellement applique (le mode « auto » suit le systeme).
   */
  function resolveTheme() {
    if (tooltipThemeSetting === 'light' || tooltipThemeSetting === 'dark') {
      return tooltipThemeSetting;
    }

    try {
      if (typeof matchMedia === 'function' &&
          matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (error) {
      // Pas de support : on garde le theme clair.
    }

    return 'light';
  }

  /** Applique le theme a la bulle (classe CSS). */
  function applyTheme() {
    effectiveTheme = resolveTheme();

    if (!tooltipElement || !tooltipElement.classList) {
      return;
    }

    tooltipElement.classList.remove('unicorn-theme-dark', 'unicorn-theme-light');
    tooltipElement.classList.add(
      effectiveTheme === 'light' ? 'unicorn-theme-light' : 'unicorn-theme-dark'
    );
  }

  /** Derniere position connue de la souris (utile au diagnostic). */
  let lastPointer = null;

  function onMouseMove(event) {
    lastPointer = { x: event.clientX, y: event.clientY };

    // Iteration 7 : en pause, on ne fait STRICTEMENT rien (aucun calcul, aucune
    // bulle). C'est aussi la garantie qu'un site « pause » reste rapide.
    if (extensionPaused || disabledHere) {
      return;
    }

    const now = Date.now();
    if (now - lastHoverCheck < HOVER_THROTTLE_MS) {
      return;
    }
    lastHoverCheck = now;

    if (framePending) {
      return;
    }
    framePending = true;

    const clientX = event.clientX;
    const clientY = event.clientY;

    requestAnimationFrame(function () {
      framePending = false;
      handleHover(clientX, clientY);
    });
  }

  /** Verifie ce qui se trouve sous le curseur et met la bulle a jour. */
  function handleHover(clientX, clientY) {
    // Bulle figee : les deplacements de souris ne changent rien — SAUF si elle
    // a ete ouverte par l'OCR automatique. Dans ce cas, survoler une autre
    // image lance une nouvelle lecture (la bulle est alors remplacee).
    if (frozen) {
      return;
    }

    // Si la souris est sur la bulle (menu deroulant), on la laisse ouverte.
    if (isTooltipHovered) {
      return;
    }

    // COURT-CIRCUIT : si la page ne contient aucun montant, aucune unite et
    // aucune heure (ensembles vides), les tests de position ne peuvent rien
    // trouver. On evite deux operations couteuses par mouvement de souris.
    if (indexedNodes.size === 0 && scannedImages.size === 0) {
      cancelPendingShow();
      hideTooltip();
      return;
    }

    // Ordre des essais, du moins cher au plus cher :
    //   1. une image (prix dans un attribut) ;
    //   2. le curseur dans le texte (cas normal, tres rapide) ;
    //   3. le test spatial (lien transparent pose sur le prix, cas Amazon).
    const found = amountInImageAt(clientX, clientY) ||
      amountAtPoint(clientX, clientY) ||
      amountByRectAt(clientX, clientY);

    if (!found) {
      cancelPendingShow();
      hideTooltip();

      // Iteration 10 : survol prolonge d'une IMAGE -> analyse automatique
      // (seulement si l'utilisateur l'a activee).
      return;
    }

    // On survole autre chose qu'une image : on annule l'attente en cours.

    // Iteration 8 : delai configurable avant l'apparition de la bulle.
    scheduleShow(found, clientX, clientY);
  }

  /** Clef d'un resultat, pour reconnaitre « le meme montant qu'avant ». */
  function foundKey(found) {
    if (!found) {
      return null;
    }
    if (found.kind === 'unit') {
      return `unit|${found.unit.value}|${found.unit.text}`;
    }
    if (found.kind === 'time') {
      return `time|${found.time.text}|${found.time.zone.iana || found.time.zone.fixedMinutes}|${targetTimezone}`;
    }
    return `currency|${found.amount.currency.code}|${found.amount.value}|` +
      `${found.amount.range ? found.amount.range.max : ''}|${found.amount.text}`;
  }

  /** Annule un affichage programme. */
  function cancelPendingShow() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    pendingShowKey = null;
  }

  /**
   * Affiche la bulle, tout de suite ou apres le delai choisi.
   *
   * Detail important : si la souris reste SUR LE MEME montant, on ne remet pas
   * le compteur a zero. Sans cela, le moindre micro-mouvement (et la souris
   * bouge toujours d'un pixel) repousserait l'affichage indefiniment : la
   * bulle n'apparaitrait jamais.
   */
  function scheduleShow(found, clientX, clientY) {
    const key = foundKey(found);

    if (showTimer && key === pendingShowKey) {
      lastTooltipPosition = { x: clientX, y: clientY };
      return;
    }

    cancelPendingShow();
    pendingShowKey = key;

    if (hoverDelayMs <= 0) {
      showFound(found, clientX, clientY);
      return;
    }

    showTimer = setTimeout(function () {
      showTimer = null;
      showFound(found, clientX, clientY);
    }, hoverDelayMs);
  }

  /** Affiche reellement la bulle correspondant a un resultat. */
  function showFound(found, clientX, clientY) {
    pendingShowKey = null;

    if (found.kind === 'unit') {
      showUnitTooltip(found.unit, clientX, clientY);
    } else if (found.kind === 'time') {
      showTimeTooltip(found.time, clientX, clientY);
    } else {
      showTooltip(found.amount, clientX, clientY);
    }
  }

  // =========================================================================
  //  OCR : SELECTION D'UNE ZONE SUR LA PAGE (iteration 10)
  // =========================================================================
  //
  // Fonctionnement :
  //   1. le popup demande le demarrage (ou un message interne) ;
  //   2. la page affiche un voile et laisse dessiner un rectangle ;
  //   3. au relachement, la zone est envoyee au script d'arriere-plan, qui
  //      photographie l'onglet, decoupe, et lit le texte (moteur embarque) ;
  //   4. le texte reconnu s'affiche dans la BULLE, ici, sur la page.
  //
  // Pourquoi la lecture n'a pas lieu ici : une page web interdit
  // WebAssembly via sa politique de securite (CSP). Le moteur vit donc dans
  // l'arriere-plan, qui est un contexte de l'extension.

  /** Cote minimum d'une zone, en pixels CSS. */
  const OCR_MIN_SIDE = 12;

  /** Etat de la selection en cours (null = pas de selection). */
  let ocrSelection = null;

  /** Vrai si la selection sert a preparer un rapport de bug. */
  let bugReportMode = false;

  /**
   * Affiche un message discret en haut de la page, pendant quelques secondes.
   *
   * POURQUOI CE MESSAGE EXISTE
   * --------------------------
   * La premiere version de la selection OCR echouait parfois EN SILENCE
   * (extension en pause, site exclu, feuille de style absente) : l'utilisateur
   * cliquait et rien ne se passait. Desormais, chaque echec est DIT, dans la
   * page, sous les yeux de l'utilisateur.
   *
   * Les styles sont ecrits EN LIGNE : le message doit rester lisible meme si
   * la feuille de style injectee n'est pas appliquee par le navigateur.
   */
  function showNotice(message, durationMs) {
    try {
      const previous = document.querySelector('[data-unic="notice"]');
      if (previous && previous.parentNode) {
        previous.parentNode.removeChild(previous);
      }

      const notice = document.createElement('div');
      notice.setAttribute('data-unic', 'notice');
      notice.textContent = message;
      notice.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:16px',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        'max-width:80vw',
        'padding:9px 14px',
        'border-radius:8px',
        'background:#111827',
        'color:#ffffff',
        'font:600 12.5px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        'line-height:1.35',
        'box-shadow:0 4px 14px rgba(15,23,42,0.28)',
        'pointer-events:none',
        'text-align:center'
      ].join(';');

      document.body.appendChild(notice);

      setTimeout(function () {
        if (notice.parentNode) {
          notice.parentNode.removeChild(notice);
        }
      }, durationMs || 3500);
    } catch (error) {
      // Sans message visible, on garde au moins la console.
      console.warn(`${LOG_PREFIX} message impossible a afficher :`, message);
    }
  }

  /** Construit un rectangle a partir de deux coins, dans n'importe quel ordre. */
  function selectionFromPoints(x1, y1, x2, y2) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  /** Vrai si le rectangle est assez grand pour etre lu. */
  function isUsableOcrRect(rect) {
    return Boolean(rect) &&
      Number.isFinite(rect.width) && Number.isFinite(rect.height) &&
      rect.width >= OCR_MIN_SIDE && rect.height >= OCR_MIN_SIDE;
  }

  /** Affiche (ou cache) le cadre de selection. */
  function paintOcrFrame() {
    if (!ocrSelection || !ocrSelection.frame) {
      return;
    }

    const rect = ocrSelection.rect;

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      ocrSelection.frame.style.display = 'none';
      return;
    }

    const frame = ocrSelection.frame;
    frame.style.display = 'block';
    frame.style.left = `${Math.round(rect.x)}px`;
    frame.style.top = `${Math.round(rect.y)}px`;
    frame.style.width = `${Math.round(rect.width)}px`;
    frame.style.height = `${Math.round(rect.height)}px`;
  }

  /** Change le texte d'aide affiche en haut de l'ecran. */
  function setOcrHint(text) {
    if (ocrSelection && ocrSelection.hint) {
      ocrSelection.hint.textContent = text;
    }
  }

  /** Retire le voile et les ecouteurs de selection. */
  function closeOcrOverlay() {
    if (!ocrSelection) {
      return;
    }

    const { root } = ocrSelection;

    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }

    document.removeEventListener('keydown', onOcrKeyDown, true);
    window.removeEventListener('mouseup', onOcrMouseUp, true);
    ocrSelection = null;
  }

  /** Annule la selection (touche Echap). */
  function cancelOcrSelection() {
    closeOcrOverlay();
    bugReportMode = false;
    console.log(`${LOG_PREFIX} OCR : sélection annulée`);
  }

  /**
   * Demarre la selection d'une zone a lire.
   *
   * @returns {{ok: boolean, error?: string}} un compte rendu EXPLICITE : plus
   *   aucun echec silencieux (c'etait le defaut signale par l'utilisateur).
   */
  function startOcrSelection(options) {
    bugReportMode = Boolean(options && options.bugReport);
    // Une selection deja ouverte est remplacee, jamais ignoree en silence.
    if (ocrSelection) {
      closeOcrOverlay();
    }

    if (extensionPaused) {
      showNotice('UniConv est en pause : reactivez-la depuis le popup.');
      return { ok: false, error: 'extension en pause' };
    }

    if (disabledHere) {
      showNotice('UniConv est desactive sur ce site (liste noire)');
      return { ok: false, error: 'site exclu' };
    }

    // On ferme ce qui est ouvert (bulle, menu, affichage programme).
    dismissFrozenTooltip();
    cancelPendingShow();

    const root = document.createElement('div');
    root.className = 'unicorn-ocr-overlay';
    root.setAttribute('data-unic', 'ocr-overlay');

    // Styles EN LIGNE en plus de la feuille injectee : si celle-ci n'est pas
    // appliquee (page exotique, conflit de CSS), le voile reste visible et
    // capte quand meme la souris.
    root.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'bottom:0',
      'z-index:2147483646',
      'background:rgba(15,23,42,0.22)',
      'cursor:crosshair',
      'pointer-events:auto'
    ].join(';');

    const frame = document.createElement('div');
    frame.className = 'unicorn-ocr-frame';
    frame.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'border:2px solid #2f6bff',
      'background:rgba(47,107,255,0.12)',
      'box-sizing:border-box',
      'display:none',
      'pointer-events:none',
      'border-radius:2px'
    ].join(';');
    root.appendChild(frame);

    const hint = document.createElement('div');
    hint.className = 'unicorn-ocr-hint';
    hint.textContent = bugReportMode
      ? 'Sélectionnez la zone à signaler · Échap pour annuler'
      : 'Dessinez un rectangle autour du texte à lire · Échap pour annuler';
    hint.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'left:50%',
      'top:14px',
      'transform:translateX(-50%)',
      'max-width:80vw',
      'padding:8px 14px',
      'border-radius:8px',
      'background:#111827',
      'color:#ffffff',
      'font:600 12.5px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'line-height:1.35',
      'box-shadow:0 4px 14px rgba(15,23,42,0.28)',
      'pointer-events:none',
      'text-align:center'
    ].join(';');
    root.appendChild(hint);

    try {
      document.body.appendChild(root);
    } catch (error) {
      console.error(`${LOG_PREFIX} OCR : impossible d'afficher le voile — ${error.message}`);
      showNotice('Impossible d\'afficher la zone de sélection sur cette page');
      return { ok: false, error: error.message };
    }

    ocrSelection = { root, frame, hint, rect: null, dragging: false, start: null };

    root.addEventListener('mousedown', onOcrMouseDown, true);
    root.addEventListener('mousemove', onOcrMouseMove, true);
    // Un clic sur le voile ne doit pas atteindre la page (elle fermerait la
    // bulle, ou suivrait un lien).
    root.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
    }, true);

    document.addEventListener('keydown', onOcrKeyDown, true);
    window.addEventListener('mouseup', onOcrMouseUp, true);

    console.log(`${LOG_PREFIX} OCR : voile affiché, dessinez un rectangle`);
    return { ok: true };
  }

  function onOcrMouseDown(event) {
    if (!ocrSelection) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    ocrSelection.dragging = true;
    ocrSelection.start = { x: event.clientX, y: event.clientY };
    ocrSelection.rect = { x: event.clientX, y: event.clientY, width: 0, height: 0 };
    paintOcrFrame();
  }

  function onOcrMouseMove(event) {
    if (!ocrSelection || !ocrSelection.dragging) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    ocrSelection.rect = selectionFromPoints(
      ocrSelection.start.x, ocrSelection.start.y,
      event.clientX, event.clientY
    );
    paintOcrFrame();
  }

  function onOcrMouseUp(event) {
    if (!ocrSelection || !ocrSelection.dragging) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    ocrSelection.dragging = false;

    const rect = ocrSelection.rect;

    if (!isUsableOcrRect(rect)) {
      setOcrHint('Zone trop petite : dessinez un rectangle plus grand (Échap pour annuler)');
      return;
    }

    finishOcrSelection(rect);
  }

  function onOcrKeyDown(event) {
    if (!ocrSelection || !event.key) {
      return;
    }

    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      event.stopPropagation();
      cancelOcrSelection();
    }
  }

  /**
   * Attend que la page soit REELLEMENT repeinte (deux images + un court delai).
   *
   * POURQUOI C'EST INDISPENSABLE
   * ----------------------------
   * La capture d'ecran a lieu juste apres. Sans cette attente, elle peut encore
   * montrer le voile sombre ou la bulle d'attente : l'OCR lit alors la bulle
   * au lieu du prix. C'est exactement le defaut constate par l'utilisateur :
   * sur une petite zone, la bulle recouvrait le prix au moment de la photo.
   */
  function waitForCleanRepaint(callback) {
    const nextFrame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : function (handler) { return setTimeout(handler, 16); };

    nextFrame(function () {
      nextFrame(function () {
        // Un petit delai de securite : le compositeur du navigateur a besoin
        // d'un instant supplementaire pour que la capture voie l'ecran propre.
        setTimeout(callback, 70);
      });
    });
  }

  /**
   * Lit le texte REELLEMENT present dans la page sous le rectangle.
   *
   * Filet de securite quand l'OCR ne reconnait rien sur du texte HTML :
   * certaines polices decoratives (Cormorant Garamond) ou certains rendus
   * resistant au moteur. Les images, elles, n'ont pas de texte DOM et
   * continuent d'etre lues par l'OCR.
   */
  function textInsideOcrRect(rect) {
    if (!rect || !document.body || typeof document.createTreeWalker !== 'function') {
      return '';
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }
        const tag = String(parent.tagName || '').toUpperCase();
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION)$/.test(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest && (
            parent.closest('[contenteditable="true"]') ||
            parent.closest('.unicorn-tooltip') ||
            parent.closest('[data-unic="tooltip"]'))) {
          return NodeFilter.FILTER_REJECT;
        }
        try {
          const style = window.getComputedStyle(parent);
          if (style && (style.display === 'none' || style.visibility === 'hidden' ||
              style.opacity === '0')) {
            return NodeFilter.FILTER_REJECT;
          }
        } catch (error) {
          // Style indisponible : on garde le noeud.
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const left = rect.x;
    const top = rect.y;
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    let text = '';

    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue && node.nodeValue.trim() !== '') {
        try {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rects = range.getClientRects ? range.getClientRects() : [];
          for (const box of rects) {
            if (box.width > 0 && box.height > 0 &&
                box.right >= left && box.left <= right &&
                box.bottom >= top && box.top <= bottom) {
              text += ' ' + node.nodeValue;
              break;
            }
          }
        } catch (error) {
          // Noeud non mesurable : on ignore.
        }
      }
      node = walker.nextNode();
    }

    return text.replace(/\s+/g, ' ').trim().slice(0, 4000);
  }

  /**
   * Photographie la zone, PUIS la fait lire, puis affiche le resultat.
   *
   * L'ordre est le cœur du sujet :
   *   1. le voile et toute bulle sont retires ;
   *   2. on attend le repeint (sinon la photo les contient) ;
   *   3. la capture est faite (cote arriere-plan) ;
   *   4. SEULEMENT APRES, on affiche « lecture en cours » — jamais avant.
   *
   * @param {{x:number,y:number,width:number,height:number}} rect
   */
  function finishOcrSelection(rect) {
    const reportMode = bugReportMode;
    bugReportMode = false;
    closeOcrOverlay();

    // Aucune bulle ne doit rester sur la zone : elle serait photographiee.
    dismissFrozenTooltip();

    const bubbleX = Math.round(rect.x);
    const bubbleY = Math.round(rect.y + rect.height + 10);

    const dpr = typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0
      ? window.devicePixelRatio
      : 1;

    const viewport = {
      width: window.innerWidth || document.documentElement.clientWidth || 0,
      height: window.innerHeight || document.documentElement.clientHeight || 0
    };

    waitForCleanRepaint(function () {
      let capture = null;

      try {
        chrome.runtime.sendMessage(
          { type: 'ocr-capture', rect, dpr, viewport },
          function (response) {
            if (chrome.runtime.lastError || !response || response.ok !== true) {
              showOcrBubble({
                main: 'OCR impossible',
                detail: (response && response.error) ||
                  (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
                  'capture impossible'
              }, bubbleX, bubbleY);
              return;
            }

            capture = response;

            // La photo est prise : on peut enfin afficher l'indicateur.
            showOcrBubble({ main: 'Lecture de la zone…', detail: null }, bubbleX, bubbleY);

            chrome.runtime.sendMessage(
              { type: 'ocr-recognize', id: capture.id },
              function (result) {
                if (chrome.runtime.lastError || !result) {
                  showOcrBubble({
                    main: 'OCR impossible',
                    detail: (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
                      'aucune réponse du moteur'
                  }, bubbleX, bubbleY);
                  return;
                }

                if (reportMode) {
                  sendBugReport(capture, result, rect, dpr, viewport,
                    result.ok === true ? String(result.text || '') : '');
                  return;
                }

                if (result.ok !== true) {
                  const fallback = textInsideOcrRect(rect);
                  if (fallback !== '') {
                    showOcrText(fallback, bubbleX, bubbleY, null, result.crop || capture.crop);
                    return;
                  }
                  showOcrBubble({
                    main: 'OCR impossible',
                    detail: String(result.error || 'erreur inconnue')
                  }, bubbleX, bubbleY);
                  return;
                }

                const recognized = String(result.text || '');
                if (recognized.trim() === '') {
                  // Le moteur n'a rien lu : si la zone contient du texte HTML,
                  // on le lit directement (police decorative, rendu exotique).
                  const fallback = textInsideOcrRect(rect);
                  if (fallback !== '') {
                    showOcrText(fallback, bubbleX, bubbleY, null, result.crop || capture.crop);
                    return;
                  }
                }

                showOcrText(
                  recognized, bubbleX, bubbleY,
                  result.confidence, result.crop || capture.crop
                );
              }
            );
          }
        );
      } catch (error) {
        showOcrBubble({
          main: 'OCR impossible',
          detail: String(error && error.message ? error.message : error)
        }, bubbleX, bubbleY);
      }
    });
  }

  /**
   * Envoie la zone et les diagnostics a l'arriere-plan, qui ouvre le rapport.
   * Aucun envoi reseau : le rapport reste local, pret a etre copie.
   */
  function sendBugReport(capture, result, rect, dpr, viewport, text) {
    const report = {
      createdAt: new Date().toISOString(),
      pageUrl: location.href,
      pageTitle: document.title,
      userAgent: navigator.userAgent,
      language: navigator.language,
      extensionVersion: UNICONV_CONTENT_VERSION,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      dpr: dpr,
      viewport: viewport,
      ocr: {
        ok: Boolean(result && result.ok === true),
        text: String(text || ''),
        confidence: result && typeof result.confidence === 'number' ? result.confidence : null,
        error: result && result.ok !== true ? String(result.error || '') : ''
      },
      pageText: textInsideOcrRect(rect)
    };

    try {
      chrome.runtime.sendMessage({ type: 'bug-report', id: capture.id, report: report }, function (response) {
        if (chrome.runtime.lastError || !response || response.ok !== true) {
          showNotice('Rapport impossible : ' +
            ((response && response.error) || 'réessayez'));
        }
      });
    } catch (error) {
      showNotice('Rapport impossible : ' + (error && error.message ? error.message : error));
    }
  }

  /** Affiche un contenu dans la bulle, figee, a la position donnee. */
  function showOcrBubble(content, clientX, clientY) {
    frozen = true;
    renderTooltip(content, clientX, clientY, null);
  }

  /**
   * Affiche le TEXTE reconnu dans la bulle, avec sa conversion si un montant
   * y est present.
   *
   * @param {string} text - texte reconnu par l'OCR
   * @param {number} clientX
   * @param {number} clientY
   * @param {number|null} confidence - confiance du moteur, en pourcentage
   */
  function showOcrText(text, clientX, clientY, confidence, crop) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();

    if (clean === '') {
      // On affiche AUSSI les dimensions reellement analysees : si la capture
      // est tombee a cote, ces chiffres le montrent tout de suite.
      const sizes = crop && crop.sourceWidth
        ? `zone ${Math.round(crop.sourceWidth)}×${Math.round(crop.sourceHeight)} px dans une capture ${crop.imageWidth}×${crop.imageHeight}`
        : 'zone inconnue';

      showOcrBubble({
        main: 'Aucun texte reconnu',
        detail: `${sizes} — essayez une zone plus serrée, ou testez le moteur dans les réglages`
      }, clientX, clientY);
      return;
    }

    // L'OCR doit convertir TOUT ce que l'extension sait convertir : devises,
    // unites de mesure et heures avec fuseau. On retient la premiere detection
    // dans l'ordre de lecture, comme le ferait un survol.
    const findings = [];

    if (detectCurrencies) {
      for (const amount of findAmountsInText(clean)) {
        findings.push({ kind: 'currency', at: amount.start, value: amount });
      }
    }
    if (detectUnits) {
      for (const unit of findUnitsInText(clean)) {
        findings.push({ kind: 'unit', at: unit.start, value: unit });
      }
    }
    if (detectTimezones) {
      for (const time of tzFindTimes(clean)) {
        findings.push({ kind: 'time', at: time.start, value: time });
      }
    }

    findings.sort(function (left, right) { return left.at - right.at; });

    const finding = findings[0] || null;
    const kindLabels = { currency: 'montant', unit: 'unite', time: 'heure' };

    console.log(
      `${LOG_PREFIX} OCR : « ${clean.slice(0, 80)} »` +
      (finding
        ? ` — ${findings.length} conversion(s), la premiere est un(e) ${kindLabels[finding.kind]}`
        : ' — aucune conversion')
    );

    if (findings.length > 1) {
      console.log(
        `${LOG_PREFIX} OCR : plusieurs conversions possibles`,
        findings.map(function (entry) { return entry.value.text; })
      );
    }

    if (!finding) {
      showOcrBubble({
        main: clean,
        detail: 'aucun montant, unité ou heure reconnu dans ce texte'
      }, clientX, clientY);
      return;
    }

    // ---------------------------------------------------------------------
    //  PARITE COMPLETE AVEC UN CLIC SUR UN MONTANT DE LA PAGE
    // ---------------------------------------------------------------------
    //
    // Une conversion issue de l'OCR doit se comporter EXACTEMENT comme un clic
    // sur du texte : bulle figee, ligne du taux, menu de choix de la devise
    // cible, poignee de redimensionnement. Le montant reconnu a la meme forme
    // qu'un montant detecte dans la page, donc il suffit de suivre le meme
    // chemin de code — c'est le meilleur moyen que les deux ne divergent
    // jamais.
    //
    // Le texte reconnu, lui, part dans la console : la bulle doit rester
    // identique a celle d'un clic.
    if (typeof confidence === 'number' && confidence > 0) {
      console.log(`${LOG_PREFIX} OCR : confiance ${confidence} %`);
    }

    resetBubbleTargets();
    frozen = true;
        frozenAmount = null;
    frozenUnit = null;
    frozenTime = null;
    selectedUnit = null;
    currentSignature = null;

    if (finding.kind === 'currency') {
      frozenAmount = finding.value;
      // On rafraichit la liste des devises disponibles au moment d'ouvrir le
      // menu, comme pour un clic (les taux ont pu arriver entre-temps).
        showTooltip(finding.value, clientX, clientY);
    } else if (finding.kind === 'unit') {
      frozenUnit = finding.value;
      showUnitTooltip(finding.value, clientX, clientY);
    } else {
      frozenTime = finding.value;
      showTimeTooltip(finding.value, clientX, clientY);
    }
  }

  /** Point d'ancrage de la selection (ou centre de la fenetre). */
  function selectionAnchor() {
    try {
      const selection = window.getSelection ? window.getSelection() : null;
      if (selection && selection.rangeCount > 0) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        if (rect && (rect.width || rect.height)) {
          return { x: rect.left + rect.width / 2, y: rect.bottom };
        }
      }
    } catch (error) {
      // Selection indisponible : on retombe au centre.
    }
    return {
      x: (window.innerWidth || 0) / 2,
      y: (window.innerHeight || 0) / 2
    };
  }

  /**
   * Convertit le texte selectionne (menu contextuel « Convertir »).
   * Essaie devises, puis unites, puis fuseaux ; ouvre la bulle figee.
   */
  function convertSelectionText(text) {
    const value = String(text || '').trim();
    if (!value) {
      return false;
    }

    resetBubbleTargets();
    const point = selectionAnchor();
    const amounts = findAmountsInText(value);
    if (amounts.length > 0) {
      frozen = true;
      frozenAmount = amounts[0];
      frozenUnit = null;
      frozenTime = null;
      selectedUnit = null;
      currentSignature = null;
        showTooltip(amounts[0], point.x, point.y);
      return true;
    }

    const units = findUnitsInText(value);
    if (units.length > 0) {
      frozen = true;
      frozenAmount = null;
      frozenUnit = units[0];
      frozenTime = null;
      selectedUnit = null;
      currentSignature = null;
      showUnitTooltip(units[0], point.x, point.y);
      return true;
    }

    const times = tzFindTimes(value);
    if (times.length > 0) {
      frozen = true;
      frozenAmount = null;
      frozenUnit = null;
      frozenTime = times[0];
      selectedUnit = null;
      currentSignature = null;
      showTimeTooltip(times[0], point.x, point.y);
      return true;
    }

    showNotice('Aucun montant, unite ou heure reconnu dans la selection.');
    return false;
  }

  /** Vrai si l'ecouteur de messages a deja ete branche. */
  let messageListenerRegistered = false;

  /**
   * Recoit les demandes venant du popup (demarrage de l'OCR).
   *
   * @returns {boolean} false : la reponse est immediate
   */
  function onRuntimeMessage(message, sender, sendResponse) {
    if (!message) {
      return false;
    }
    if (sender && sender.id && sender.id !== chrome.runtime.id) {
      return false;
    }

    if (message.type === 'convert-selection') {
      try {
        const ok = convertSelectionText(message.text);
        sendResponse({ ok: ok });
      } catch (error) {
        console.error(`${LOG_PREFIX} conversion de la selection : ${error.message}`);
        showNotice(`Conversion impossible : ${error.message}`);
        sendResponse({ ok: false, error: error.message });
      }
      return false;
    }

    if (message.type !== 'start-ocr-selection' && message.type !== 'start-bug-report') {
      return false;
    }

    try {
      const outcome = startOcrSelection({ bugReport: message.type === 'start-bug-report' });
      sendResponse(outcome || { ok: true });
    } catch (error) {
      console.error(`${LOG_PREFIX} OCR : démarrage impossible — ${error.message}`);
      showNotice(`OCR impossible : ${error.message}`);
      sendResponse({ ok: false, error: error.message });
    }

    return false;
  }

  /** Masque la bulle quand la souris quitte la fenetre. */
  function onMouseLeave() {
    hideTooltip();
  }

  /** Masque la bulle au defilement : sa position ne serait plus exacte. */
  function onScroll(event) {
    if (tooltipElement && event && event.target &&
        typeof tooltipElement.contains === 'function' &&
        tooltipElement.contains(event.target)) {
      return;
    }
    if (frozen) {
      dismissFrozenTooltip();
      return;
    }
    hideTooltip();
  }

  // =========================================================================
  //  7. DEMARRAGE
  // =========================================================================

  function main() {
    if (!document.body) {
      console.warn(`${LOG_PREFIX} pas de contenu a analyser sur cette page.`);
      return;
    }

    console.log(
      `${LOG_PREFIX} environnement : caretPositionFromPoint=` +
      `${typeof document.caretPositionFromPoint === 'function'}, ` +
      `Highlight=${typeof Highlight !== 'undefined'}, ` +
      `devises=${CURRENCIES.length}`
    );

    injectStyles();
    initTooltip();

    // Iteration 9bis : l'ecouteur de messages est branche AVANT de savoir si
    // l'extension est en pause ou si le site est exclu. Sans cela, une demande
    // d'OCR envoyee depuis le popup n'arrivait nulle part : le popup croyait
    // la page injoignable, et l'utilisateur ne voyait RIEN se passer.
    // startOcrSelection() decide ensuite, et explique toujours son refus.
    if (!messageListenerRegistered &&
        typeof chrome !== 'undefined' && chrome.runtime &&
        chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
      messageListenerRegistered = true;
    }
    loadUnitSystemPreference();
    loadTargetCurrency();
    loadPinnedCurrencies();
    loadPinnedTimezones();
    loadTooltipSize();

    // Iteration 7 : on verifie AVANT tout le reste si cette page est exclue.
    // Un site en liste noire ne recoit ni scan, ni surveillant, ni ecouteur :
    // l'extension y est totalement absente, ce qui est le but.
    loadGuardSettings().then(function (settings) {
      if (settings.blacklisted) {
        disabledHere = true;
        console.log(
          `${LOG_PREFIX} site en liste noire (${safeHostname()}) : ` +
          `extension inactive ici`
        );
        return;
      }

      // Le raccourci clavier reste actif, meme en pause : il sert justement
      // a reprendre.
      document.addEventListener('keydown', onGlobalKeyDown, true);

      if (settings.paused) {
        console.log(
          `${LOG_PREFIX} extension en pause (reactivation depuis le popup)`
        );
        notifyPauseState();
        // On lit quand meme les reglages : a la reprise, ils seront deja la.
        loadDisplaySettings();
        return;
      }

      // Iteration 8 : langue, theme, delai, couverture devises/unites.
      loadDisplaySettings().then(function () {
        startDetection();
      });
    });
  }

  /**
   * Demarre reellement la detection : premier scan, ecouteurs, surveillant.
   *
   * Separee de main() pour pouvoir etre appelee apres la lecture des reglages
   * (qui est asynchrone), et de nouveau a la reprise apres une pause.
   */
  function startDetection() {
    if (disabledHere) {
      return;
    }

    const stats = scanDocument();
    initialScanDone = true;

    console.log(
      `${LOG_PREFIX} analyse terminee : ${stats.matches} montant(s) ` +
      `dans ${stats.nodes} bloc(s) de texte` +
      (stats.images ? ` et ${stats.images} image(s)` : '')
    );

    // On publie tout de suite le compteur pour le popup (iteration 6).
    observerStats.nodes = stats.nodes;
    observerStats.images = stats.images || 0;
    observerStats.updatedAt = Date.now();
    publishObserverStats(true);

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave, { passive: true });
    document.addEventListener('click', onDocumentClick, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });


    // Iteration 6 : on surveille les ajouts de contenu (prix qui se mettent
    // a jour, listes infinies, applications qui se chargent en JavaScript).
    startObserver();
  }

  /**
   * Lancement protege.
   *
   * Sans ce bloc « try / catch », la moindre erreur ferait s'arreter le script
   * EN SILENCE : la console resterait vide et on ne saurait pas pourquoi.
   */
  try {
    main();
  } catch (error) {
    console.error(`${LOG_PREFIX} erreur au demarrage :`, error);
    console.error(`${LOG_PREFIX} detail : ${error && error.message}`);
    console.error(`${LOG_PREFIX} pile d'appels : ${error && error.stack}`);
  }
}
