/**
 * ============================================================================
 *  UniConv — src/background.js
 *  Version 0.4.0 — iteration 3 : vrais taux de change + cache
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  C'est le « script d'arriere-plan ». Il tourne en dehors des pages web :
 *  il ne voit ni le contenu de tes onglets, ni ce que tu tapes.
 *
 *  Son travail a cette iteration :
 *    1. telecharger les taux de change depuis l'API Frankfurter ;
 *    2. les garder en cache pendant 12 heures ;
 *    3. repondre aux demandes de conversion envoyees par le script des pages ;
 *    4. continuer a fonctionner SANS INTERNET, grace au cache.
 *
 *  POURQUOI LE SCRIPT D'ARRIERE-PLAN ET PAS LE SCRIPT DE LA PAGE ?
 *  ---------------------------------------------------------------
 *  Une page web n'a pas le droit d'appeler n'importe quel serveur : le
 *  navigateur bloque (c'est la politique CORS). Le script d'arriere-plan, lui,
 *  y est autorise — a condition que manifest.json declare le domaine dans
 *  « host_permissions ».
 *
 *  OU VOIR LES MESSAGES DE CE FICHIER
 *  ----------------------------------
 *  Console du navigateur : « Cmd + Shift + J ».
 *  (Ce n'est pas la console d'une page, qui est ouverte par Cmd + Option + K.)
 */

'use strict';

const LOG_PREFIX = '[UniConv]';
const UNICONV_VERSION = '2.9.9';

/** Langues couvertes par l'interface (les six langues officielles de l'ONU). */
const UNICONV_LANGUAGES = ['fr', 'en', 'es', 'ru', 'zh', 'ar'];

/**
 * Langue systeme, ramenee a une langue couverte.
 *
 * Si la langue du navigateur n'est pas l'une des six, on installe en ANGLAIS.
 * C'est la regle demandee : jamais de francais impose a un systeme allemand.
 */
function systemLanguage() {
  const nav = String(
    (typeof navigator !== 'undefined' && navigator.language) || 'en'
  ).toLowerCase().slice(0, 2);

  return UNICONV_LANGUAGES.indexOf(nav) !== -1 ? nav : 'en';
}

// ===========================================================================
//  1. PARAMETRES
// ===========================================================================

/**
 * Adresse de l'API.
 *
 * Frankfurter est un service gratuit, SANS CLE D'ACCES et sans inscription,
 * adosse a la Banque centrale europeenne. Il renvoie les taux de reference
 * quotidiens.
 *
 * « base=EUR » signifie : donne-moi combien d'unites de chaque devise vaut
 * 1 euro. Les autres conversions sont calculees a partir de la.
 */
const API_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR';

/**
 * SOURCE SECONDAIRE.
 *
 * Frankfurter (Banque centrale europeenne) ne couvre que 30 devises : il lui
 * manque notamment le dirham des Emirats (AED), le riyal saoudien (SAR), le
 * dirham marocain (MAD), le dinar tunisien (TND), le franc CFA (XOF/XAF)...
 *
 * Pour ces devises, on complete avec « currency-api », un service gratuit sans
 * cle qui couvre plus de 150 monnaies. Deux miroirs sont proposes : jsDelivr,
 * puis Cloudflare Pages en secours.
 *
 * REGLE DE FUSION : Frankfurter est prioritaire (source officielle BCE). Le
 * second fournisseur ne sert qu'a combler les devises manquantes.
 */
const SECONDARY_API_URLS = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',
  'https://latest.currency-api.pages.dev/v1/currencies/eur.json'
];

/**
 * SOURCE LARGE.
 *
 * « open.er-api.com » couvre 160+ monnaies du monde, sans cle d'acces.
 * C'est elle qui apporte les devises exotiques (AED, SAR, MAD, TWD, KWD...).
 *
 * La reponse ressemble a :
 *   { result: 'success', time_last_update_utc: '...', rates: { AED: 4.11, ... } }
 */
const BROAD_API_URL = 'https://open.er-api.com/v6/latest/EUR';

/**
 * SOURCE DE SECOURS SUPPLEMENTAIRE.
 *
 * « exchangerate-api.com » (v4, sans cle) couvre ~160 monnaies. Elle est
 * independante des trois autres : si Frankfurter, currency-api ET
 * open.er-api tombent en meme temps, elle peut encore fournir les taux.
 */
const REDUNDANT_API_URL = 'https://api.exchangerate-api.com/v4/latest/EUR';

/** Vrai si la chaine ressemble a un code de devise (3 lettres). */
function isCurrencyCode(code) {
  return typeof code === 'string' && /^[A-Z]{3}$/.test(code);
}

/** Un taux exploitable : fini, strictement positif, borne. */
function isSafeRate(value) {
  return typeof value === 'number' && Number.isFinite(value) &&
    value > 0 && value <= 1e9;
}

/** Nettoie un objet de taux venant du reseau ou du stockage. */
function sanitizeRates(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const result = Object.create(null);
  for (const [code, value] of Object.entries(input)) {
    const upper = String(code).toUpperCase();
    if (isCurrencyCode(upper) && isSafeRate(value)) {
      result[upper] = value;
    }
  }
  result.EUR = 1;
  return Object.keys(result).length > 1 ? result : null;
}

/**
 * Codes acceptes depuis les sources filtrees (46 codes). Le reste
 * (devises exotiques) vient de la source large, non filtree.
 *
 * On filtre les donnees de la source secondaire avec cette liste : elle
 * contient aussi des cryptomonnaies (BTC, ETH, ADA...), qu'on ne veut pas
 * melanger aux monnaies.
 */
const SUPPORTED_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'HKD',
  'SGD', 'BND', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'TRY',
  'RUB', 'UAH', 'INR', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'KRW', 'MAD',
  'TND', 'DZD', 'EGP', 'ZAR', 'ILS', 'SAR', 'AED', 'THB', 'VND', 'IDR',
  'MYR', 'PHP', 'ISK', 'XOF', 'XAF'
];

const SUPPORTED_SET = new Set(SUPPORTED_CURRENCIES);

/**
 * Duree de validite du cache, en millisecondes.
 *
 * 12 heures = 43 200 000 ms. Les taux de la BCE ne changent qu'une fois par
 * jour ouvrable : inutile d'appeler l'API a chaque survol.
 */
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000;

/** Delai maximum accorde a l'API avant d'abandonner, en millisecondes. */
const FETCH_TIMEOUT_MS = 5000;

/** Cles utilisees dans le stockage local du navigateur. */
const STORAGE_KEYS = {
  rates: 'uniconv.rates',
  lastAttempt: 'uniconv.lastAttempt'
};

// ===========================================================================
//  2. ETAT EN MEMOIRE
// ===========================================================================

/**
 * Derniers taux connus, gardes en memoire pour repondre instantanement.
 * Format : { USD: 1.1193, GBP: 0.83728, ... }
 */
let ratesCache = null;

/** Date de reference des taux, telle que fournie par l'API (« 2026-10-23 »). */
let ratesDate = null;

/** Date (locale) du dernier telechargement reussi. */
let ratesFetchedAt = null;

/**
 * Chargement en cours, pour eviter de lancer deux telechargements en meme
 * temps si plusieurs bulles demandent un taux au meme moment.
 */
let pendingLoad = null;

// ===========================================================================
//  3. COMMUNICATION AVEC LE STOCKAGE
// ===========================================================================

/**
 * Lit une valeur du stockage local du navigateur.
 *
 * « chrome.storage.local » est un espace de stockage fourni par Firefox, lie a
 * l'extension (et non au site visite). Il persiste apres la fermeture du
 * navigateur : c'est donc l'endroit ideal pour un cache.
 *
 * Note : Firefox comprend le vocabulaire « chrome.* » et le renvoie sous forme
 * de promesse depuis la version 128. On utilise donc « await ».
 */
async function storageGet(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result ? result[key] : undefined;
  } catch (error) {
    console.warn(`${LOG_PREFIX} lecture du stockage impossible :`, error.message);
    return undefined;
  }
}

/** Ecrit une valeur dans le stockage local. */
async function storageSet(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.warn(`${LOG_PREFIX} ecriture du stockage impossible :`, error.message);
  }
}

// ===========================================================================
//  4. TELECHARGEMENT DES TAUX
// ===========================================================================

/**
 * Interroge l'API et met le cache a jour.
 *
 * @returns {Promise<boolean>} true si les taux sont disponibles
 */
/**
 * Recupere les taux de la source PRINCIPALE (Frankfurter / BCE).
 *
 * @returns {Promise<{rates: object, date: string|null}|null>}
 */
async function fetchPrimaryRates() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      signal: controller.signal,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`l'API a repondu ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || typeof payload !== 'object' ||
        !payload.rates || typeof payload.rates !== 'object') {
      throw new Error('reponse de l\'API illisible');
    }

    const rates = {};
    for (const [code, value] of Object.entries(payload.rates)) {
      if (SUPPORTED_SET.has(code) && isSafeRate(value)) {
        rates[code] = value;
      }
    }
    rates.EUR = 1;

    return {
      rates: rates,
      date: typeof payload.date === 'string' ? payload.date : null
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Recupere les taux de la source SECONDAIRE (currency-api).
 *
 * Elle couvre les devises absentes de Frankfurter (AED, SAR, MAD...).
 *
 * @returns {Promise<{rates: object, date: string|null}|null>}
 */
async function fetchSecondaryRates() {
  let lastError = null;

  for (const url of SECONDARY_API_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`reponse ${response.status}`);
      }

      const payload = await response.json();

      // La forme attendue : { date, eur: { usd: 1.11, aed: 4.11, ... } }
      if (!payload || typeof payload !== 'object' ||
          !payload.eur || typeof payload.eur !== 'object') {
        throw new Error('forme inattendue');
      }

      const rates = {};
      for (const [code, value] of Object.entries(payload.eur)) {
        const upper = code.toUpperCase();
        // On ne garde que nos devises connues : la source contient aussi des
        // cryptomonnaies (BTC, ETH, ADA...) qu'on ne veut pas afficher.
        if (SUPPORTED_SET.has(upper) && isSafeRate(value)) {
          rates[upper] = value;
        }
      }
      rates.EUR = 1;

      return {
        rates: rates,
        date: typeof payload.date === 'string' ? payload.date : null
      };
    } catch (error) {
      lastError = error;
      clearTimeout(timeoutId);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error('source secondaire injoignable');
}

/**
 * Recupere les taux de la source LARGE (open.er-api.com).
 *
 * Elle couvre 160+ monnaies : c'est elle qui fournit les devises exotiques.
 *
 * @returns {Promise<{rates: object, date: string|null}>}
 */
async function fetchBroadRates() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(BROAD_API_URL, {
      signal: controller.signal,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`reponse ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || payload.result !== 'success' ||
        !payload.rates || typeof payload.rates !== 'object') {
      throw new Error('forme inattendue');
    }

    const rates = {};
    for (const [code, value] of Object.entries(payload.rates)) {
      const upper = code.toUpperCase();
      // On ne garde que les codes de devise a 3 lettres (pas les metaux
      // precieux comme XAU/XAG, ni les cryptos).
      if (isCurrencyCode(upper) && isSafeRate(value)) {
        rates[upper] = value;
      }
    }
    rates.EUR = 1;

    return {
      rates: rates,
      date: null // cette source fournit un horodatage, pas une date simple
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Recupere les taux de la source de SECOURS (exchangerate-api v4).
 *
 * Reponse : { base: 'EUR', date: '...', rates: { USD: 1.08, ... } }.
 */
async function fetchRedundantRates() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(REDUNDANT_API_URL, {
      signal: controller.signal,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`reponse ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || typeof payload !== 'object' ||
        !payload.rates || typeof payload.rates !== 'object') {
      throw new Error('forme inattendue');
    }

    const rates = {};
    for (const [code, value] of Object.entries(payload.rates)) {
      const upper = code.toUpperCase();
      if (isCurrencyCode(upper) && isSafeRate(value)) {
        rates[upper] = value;
      }
    }
    rates.EUR = 1;

    return {
      rates: rates,
      date: typeof payload.date === 'string' ? payload.date : null
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Telecharge les taux depuis les QUATRE sources et les fusionne.
 *
 * Les deux requetes partent EN PARALLELE. Si l'une echoue, l'autre peut
 * suffire : on degrade proprement au lieu de tout perdre.
 *
 * @returns {Promise<boolean>} true si au moins une source a repondu
 */
async function fetchRates() {
  console.log(`${LOG_PREFIX} telechargement des taux (4 sources)`);

  const results = await Promise.allSettled([
    fetchPrimaryRates(),
    fetchSecondaryRates(),
    fetchBroadRates(),
    fetchRedundantRates()
  ]);

  const primary = results[0].status === 'fulfilled' ? results[0].value : null;
  const secondary = results[1].status === 'fulfilled' ? results[1].value : null;
  const broad = results[2].status === 'fulfilled' ? results[2].value : null;
  const redundant = results[3].status === 'fulfilled' ? results[3].value : null;

  if (!primary) {
    const reason = results[0].reason;
    console.warn(`${LOG_PREFIX} source principale indisponible :`, reason && reason.message);
  }
  if (!secondary) {
    const reason = results[1].reason;
    console.warn(`${LOG_PREFIX} source secondaire indisponible :`, reason && reason.message);
  }
  if (!broad) {
    const reason = results[2].reason;
    console.warn(`${LOG_PREFIX} source large indisponible :`, reason && reason.message);
  }
  if (!redundant) {
    const reason = results[3].reason;
    console.warn(`${LOG_PREFIX} source de secours indisponible :`, reason && reason.message);
  }

  if (!primary && !secondary && !broad && !redundant) {
    return false;
  }

  // Fusion, du moins prioritaire au plus prioritaire :
  //   1. exchangerate-api  (secours independant)
  //   2. currency-api      (large, mais communautaire)
  //   3. open.er-api.com   (tres large, 160+ devises)
  //   4. Frankfurter / BCE (officiel, prioritaire pour ses 30 devises)
  const merged = {};
  if (redundant) {
    Object.assign(merged, redundant.rates);
  }
  if (secondary) {
    Object.assign(merged, secondary.rates);
  }
  if (broad) {
    Object.assign(merged, broad.rates);
  }
  if (primary) {
    Object.assign(merged, primary.rates);
  }
  merged.EUR = 1;

  ratesCache = sanitizeRates(merged);
  if (!ratesCache) {
    return false;
  }
  // On prefere la date de la BCE quand elle est disponible (plus fiable).
  ratesDate = (primary && primary.date) ||
    (secondary && secondary.date) ||
    (redundant && redundant.date) ||
    null;
  ratesFetchedAt = Date.now();

  await storageSet(STORAGE_KEYS.rates, {
    rates: ratesCache,
    date: ratesDate,
    fetchedAt: ratesFetchedAt
  });

  console.log(
    `${LOG_PREFIX} taux recuperes : ${Object.keys(merged).length} devises, ` +
    `date ${ratesDate} ` +
    `(principal=${primary ? 'oui' : 'non'}, secondaire=${secondary ? 'oui' : 'non'}, ` +
    `large=${broad ? 'oui' : 'non'})`
  );
  return true;
}

/**
 * Charge le cache depuis le stockage, ou le rafraichit si necessaire.
 *
 * Trois situations :
 *   1. les taux en memoire sont recents  -> on les utilise ;
 *   2. le cache disque est recent        -> on le charge ;
 *   3. tout est perime ou absent         -> on appelle l'API.
 *
 * Si l'API echoue mais qu'un cache perime existe, on l'utilise quand meme :
 * mieux vaut un taux d'hier qu'aucun taux.
 */
async function loadRates(forceRefresh = false) {
  // Deja en memoire et encore valide : rien a faire.
  if (!forceRefresh && ratesCache && ratesFetchedAt &&
      Date.now() - ratesFetchedAt < CACHE_DURATION_MS) {
    return true;
  }

  // Un chargement est deja en cours : on attend le meme resultat. Cela evite
  // de multiplier les appels reseau.
  if (pendingLoad) {
    return pendingLoad;
  }

  pendingLoad = (async () => {
    try {
      // 1. Lecture du cache disque.
      const stored = await storageGet(STORAGE_KEYS.rates);

      const storedRates = stored ? sanitizeRates(stored.rates) : null;
      if (storedRates && stored && typeof stored.fetchedAt === 'number') {
        const age = Date.now() - stored.fetchedAt;

        // Cache encore frais : on l'accepte sans appel reseau.
        if (!forceRefresh && age < CACHE_DURATION_MS) {
          ratesCache = storedRates;
          ratesDate = stored.date;
          ratesFetchedAt = stored.fetchedAt;
          console.log(`${LOG_PREFIX} taux charges depuis le cache du navigateur`);
          return true;
        }

        // Cache perime : on garde les anciennes valeurs sous la main, au cas
        // ou l'appel reseau echouerait.
        ratesCache = storedRates;
        ratesDate = stored.date;
        ratesFetchedAt = stored.fetchedAt;
      }

      // 2. Tentative de rafraichissement depuis l'API.
      const refreshed = await fetchRates();
      if (refreshed) {
        return true;
      }

      // 3. Echec : on se rabat sur ce qu'on a, meme perime.
      if (ratesCache) {
        console.log(`${LOG_PREFIX} API injoignable, utilisation des taux en cache`);
        return true;
      }

      console.warn(`${LOG_PREFIX} aucun taux disponible (ni API, ni cache)`);
      return false;
    } finally {
      pendingLoad = null;
    }
  })();

  return pendingLoad;
}

// ===========================================================================
//  5. CALCUL DES CONVERSIONS
// ===========================================================================

/**
 * Convertit un montant d'une devise vers une autre.
 *
 * Les taux de l'API sont tous exprimes par rapport a l'euro. Pour convertir
 * de A vers B, on passe donc par l'euro :
 *
 *   1 A  =  (1 / taux[A]) EUR  =  (taux[B] / taux[A]) B
 *
 * On parle de « taux croise ». Exemple : 1 JPY = 1.1193 / 175.51 = 0.006378 USD.
 *
 * @param {number} amount - le montant a convertir
 * @param {string} from - code de la devise d'origine
 * @param {string} to - code de la devise cible
 * @returns {object|null} { value, rate } ou null si impossible
 */
function convert(amount, from, to) {
  if (!ratesCache) {
    return null;
  }

  const source = from.toUpperCase();
  const target = to.toUpperCase();

  // Conversion vers la meme devise : aucune operation.
  if (source === target) {
    return { value: amount, rate: 1 };
  }

  const sourceRate = ratesCache[source];
  const targetRate = ratesCache[target];

  if (!isSafeRate(sourceRate) || !isSafeRate(targetRate)) {
    return null;
  }

  const rate = targetRate / sourceRate;
  const value = amount * rate;
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(value)) {
    return null;
  }
  return {
    value: value,
    rate: rate
  };
}

// ===========================================================================
//  5bis. BADGE DE L'ICONE (iteration 7)
// ===========================================================================
//
// Le badge est le petit texte pose sur l'icone de l'extension, dans la barre
// d'outils. Il sert d'INDICATEUR D'ETAT : « OFF » visible = extension en pause.
//
// Sans cet indicateur, une extension en pause est indiscernable d'une extension
// cassee : c'est exactement le genre de doute qui fait perdre une heure.

/**
 * Met a jour le badge selon l'etat de pause.
 *
 * @param {boolean} paused
 */
function updateBadge(paused) {
  try {
    if (!chrome.action || typeof chrome.action.setBadgeText !== 'function') {
      return;
    }

    chrome.action.setBadgeText({ text: paused ? 'OFF' : '' });

    if (typeof chrome.action.setBadgeBackgroundColor === 'function') {
      chrome.action.setBadgeBackgroundColor({ color: paused ? '#b45309' : '#1a7f37' });
    }
  } catch (error) {
    // API indisponible : on continue sans badge.
  }
}

/** Relit l'etat enregistre et met le badge en accord avec lui. */
function restoreBadge() {
  try {
    if (!chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.get('uniconv.enabled', (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      updateBadge(result && result['uniconv.enabled'] === false);
    });
  } catch (error) {
    // Sans stockage, on laisse le badge vide.
  }
}

// ===========================================================================
//  5ter. OCR : LIRE UNE ZONE DE L'ECRAN (iteration 10)
// ===========================================================================
//
// POURQUOI ICI ET PAS DANS LA PAGE
// --------------------------------
// Le moteur OCR a besoin de WebAssembly. Or une page web a sa propre politique
// de securite (CSP), qui bloque presque toujours WebAssembly : le moteur ne
// peut donc pas tourner dans le script de contenu.
//
// Le script d'arriere-plan, lui, vit dans une page de l'extension : il a SES
// regles (voir manifest.json, « content_security_policy ») et il peut créer le
// worker de Tesseract. C'est donc ici que la lecture a lieu.
//
// La page, elle, ne fait que dessiner le rectangle et afficher la bulle.

/** Maximum de pixels sur le plus grand côté de la zone analysée. */
const OCR_MAX_SIDE = 2400;

/** Agrandissement appliqué avant lecture (améliore nettement la précision). */
const OCR_UPSCALE = 3;

/**
 * Identifiant de l'onglet qui heberge le moteur OCR (null = pas encore ouvert).
 *
 * POURQUOI UN ONGLET ET PAS CE SCRIPT
 * -----------------------------------
 * Le script d'arriere-plan de Firefox est une « page d'evenement » : elle est
 * DECHARGEE des qu'elle est inactive. Une lecture OCR dure 1 a 5 secondes ; si
 * la page est dechargee pendant ce temps, la lecture meurt sans rien dire.
 *
 * Une page d'extension ouverte dans un onglet reste vivante tant qu'elle
 * existe. C'est donc la que tourne le moteur (src/engine.html), et ce script
 * ne fait que : photographier l'onglet, decouper, puis transmettre.
 */
let engineTabId = null;

/** Minuterie de fermeture de l'onglet moteur apres inactivite. */
let engineCloseTimer = null;

/** Delai avant fermeture automatique de l'onglet moteur (ms). */
const ENGINE_IDLE_CLOSE_MS = 120000;

/** Petite pause, sans bloquer le fil. */
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Adresse de la page qui heberge le moteur. */
function engineUrl() {
  return chrome.runtime.getURL('src/engine.html');
}

/**
 * Ouvre la page autonome du convertisseur dans une petite fenetre.
 *
 * Le raccourci « open-converter » ne peut pas ouvrir le popup de l'extension
 * (aucune API ne le permet) : on ouvre donc une page dediee, avec le champ
 * de montant deja selectionne (voir converter-page.js).
 */
function openConverterWindow() {
  const url = chrome.runtime.getURL('src/converter.html');

  try {
    if (chrome.windows && chrome.windows.create) {
      chrome.windows.create({
        url: url,
        type: 'popup',
        width: 400,
        height: 640
      }, function () {
        if (chrome.runtime.lastError) {
          try {
            chrome.tabs.create({ url: url });
          } catch (error) {
            // Rien a faire.
          }
        }
      });
      return;
    }
  } catch (error) {
    // On tente l'onglet ci-dessous.
  }

  try {
    chrome.tabs.create({ url: url });
  } catch (error) {
    // Rien a faire.
  }
}

/**
 * Lance le Scan depuis le raccourci clavier.
 *
 * Le reglage « Activer le Scan » est respecte : desactive, la commande ne
 * fait rien. Le raccourci lui-meme est choisi par l'utilisateur dans
 * about:addons (Firefox) ou chrome://extensions/shortcuts (Chromium).
 */
function runScanCommand() {
  try {
    chrome.storage.local.get('uniconv.ocrEnabled', function (result) {
      if (chrome.runtime.lastError) {
        return;
      }
      if (result && result['uniconv.ocrEnabled'] === false) {
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs && tabs[0] ? tabs[0] : null;
        if (!tab || typeof tab.id !== 'number') {
          return;
        }

        chrome.tabs.sendMessage(tab.id, { type: 'start-ocr-selection' }, function () {
          // Pas de popup pour afficher une erreur : on ignore silencieusement
          // si la page n'a pas de script de contenu.
          void chrome.runtime.lastError;
        });
      });
    });
  } catch (error) {
    // Rien a faire.
  }
}

/**
 * Prepare les unites de reference si elles n'existent pas encore.
 *
 * L'utilisateur francais recoit EUR / metrique / fuseau local ; les autres
 * langues recoivent USD / metrique. Les choix deja enregistres ne sont jamais
 * ecrases. Les valeurs servent au cadre « Unites de reference » du popup et au
 * filtrage des valeurs deja dans ces unites.
 */
function ensureReferenceDefaults() {
  try {
    chrome.storage.local.get([
      'uniconv.referenceUnitsEnabled',
      'uniconv.targetCurrency',
      'uniconv.unitSystem'
    ], function (result) {
      if (chrome.runtime.lastError || !result) {
        return;
      }

      const updates = {};
      if (result['uniconv.referenceUnitsEnabled'] !== true) {
        updates['uniconv.referenceUnitsEnabled'] = true;
      }
      if (!result['uniconv.targetCurrency']) {
        updates['uniconv.targetCurrency'] = systemLanguage() === 'fr' ? 'EUR' : 'USD';
      }
      if (!result['uniconv.unitSystem']) {
        updates['uniconv.unitSystem'] = 'metric';
      }
      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    });
  } catch (error) {
    // Stockage indisponible : le popup initialisera a l'ouverture.
  }
}

/**
 * Ouvre le tutoriel a la PREMIERE installation.
 *
 * On memorise un drapeau : un rechargement temporaire de l'extension ne doit
 * pas rouvrir l'onglet a chaque fois.
 */
ensureReferenceDefaults();

if (chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(function (details) {
    ensureReferenceDefaults();

    if (!details || details.reason !== 'install') {
      return;
    }

    // A l'installation : choisir la langue systeme (ou l'anglais) une fois.
    try {
      chrome.storage.local.get('uniconv.language', function (result) {
        if (chrome.runtime.lastError) {
          return;
        }
        if (!result || !result['uniconv.language']) {
          chrome.storage.local.set({ 'uniconv.language': systemLanguage() });
        }
      });
    } catch (error) {
      // Stockage indisponible : les pages retomberont sur « auto ».
    }

    try {
      chrome.storage.local.get('uniconv.tutorialSeen', function (result) {
        if (chrome.runtime.lastError) {
          return;
        }
        if (result && result['uniconv.tutorialSeen'] === true) {
          return;
        }

        chrome.storage.local.set({ 'uniconv.tutorialSeen': true });
        try {
          chrome.tabs.create({ url: chrome.runtime.getURL('src/tutorial.html') });
        } catch (error) {
          // Rien a faire.
        }
      });
    } catch (error) {
      // Stockage indisponible : on n'ouvre pas le tutoriel.
    }
  });
}

/**
 * Menu contextuel « Convertir » sur le texte selectionne.
 *
 * Le logo de l'extension est fourni par `icons` (Firefox) ; Chrome affiche
 * l'icone de l'extension a cote de l'entree. Le clic envoie le texte a la page,
 * qui utilise le meme moteur que le survol (devises, unites, fuseaux).
 */
const CONTEXT_MENU_ID = 'uniconv-convert-selection';
const SCAN_MENU_ID = 'uniconv-scan-page';
const BUG_MENU_ID = 'uniconv-report-bug';

function createContextMenu() {
  if (!chrome.contextMenus || !chrome.contextMenus.create) {
    return;
  }

  const convertProperties = {
    id: CONTEXT_MENU_ID,
    title: 'Convertir',
    contexts: ['selection']
  };

  const scanProperties = {
    id: SCAN_MENU_ID,
    title: 'Scanner',
    contexts: ['page']
  };

  const bugProperties = {
    id: BUG_MENU_ID,
    title: 'Signaler un bug',
    contexts: ['page']
  };

  const withIcons = function (properties) {
    return Object.assign({}, properties, {
      icons: {
        16: chrome.runtime.getURL('icons/icon16.png'),
        32: chrome.runtime.getURL('icons/icon32.png')
      }
    });
  };

  const create = function (properties) {
    const options = withIcons(properties);
    chrome.contextMenus.create(options, function () {
      if (chrome.runtime.lastError) {
        // Chrome n'accepte pas « icons » : on recree sans, l'icone de
        // l'extension reste affichee par le navigateur.
        if (options.icons) {
          chrome.contextMenus.create(properties);
        }
      }
    });
  };

  try {
    chrome.contextMenus.removeAll(function () {
      create(convertProperties);
      create(scanProperties);
      create(bugProperties);
    });
  } catch (error) {
    create(convertProperties);
    create(scanProperties);
    create(bugProperties);
  }
}

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (!info) {
      return;
    }

    if (info.menuItemId === SCAN_MENU_ID) {
      runScanCommand();
      return;
    }

    if (info.menuItemId === BUG_MENU_ID) {
      if (!tab || typeof tab.id !== 'number') {
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'start-bug-report' }, function () {
        void chrome.runtime.lastError;
      });
      return;
    }

    if (info.menuItemId !== CONTEXT_MENU_ID) {
      return;
    }

    const text = String(info.selectionText || '').trim();
    if (!text || !tab || typeof tab.id !== 'number') {
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: 'convert-selection',
      text: text
    }, function () {
      void chrome.runtime.lastError;
    });
  });
}

createContextMenu();

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(function (command) {
    if (command === 'open-converter') {
      openConverterWindow();
    } else if (command === 'scan-page') {
      runScanCommand();
    }
  });
}

/**
 * Verifie que l'onglet moteur repond.
 *
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
function pingEngine(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: 'engine-ping' }, (response) => {
        if (chrome.runtime.lastError || !response || response.ready !== true) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

/** Programme la fermeture de l'onglet moteur apres inactivite. */
function scheduleEngineClose() {
  if (engineCloseTimer) {
    clearTimeout(engineCloseTimer);
  }

  engineCloseTimer = setTimeout(() => {
    engineCloseTimer = null;

    if (engineTabId === null) {
      return;
    }

    const tabId = engineTabId;
    engineTabId = null;

    try {
      chrome.tabs.remove(tabId, () => {
        // L'onglet a peut-etre deja ete ferme : sans importance.
        void chrome.runtime.lastError;
      });
      console.log(`${LOG_PREFIX} OCR — onglet moteur ferme apres inactivite`);
    } catch (error) {
      // Rien a faire.
    }
  }, ENGINE_IDLE_CLOSE_MS);
}

/**
 * Retourne l'identifiant d'un onglet moteur PRET a l'emploi.
 *
 * On reutilise un onglet deja ouvert ; sinon on en cree un en arriere-plan
 * (jamais selectionne : l'utilisateur reste sur sa page).
 *
 * @returns {Promise<number>}
 */
async function ensureEngineTab() {
  if (engineCloseTimer) {
    clearTimeout(engineCloseTimer);
    engineCloseTimer = null;
  }

  if (engineTabId !== null && await pingEngine(engineTabId)) {
    scheduleEngineClose();
    return engineTabId;
  }

  // Un onglet moteur existe peut-etre deja (extension rechargee, ouverture a
  // la main) : on le reutilise plutot que d'en empiler un second.
  const existing = await new Promise((resolve) => {
    try {
      chrome.tabs.query({ url: engineUrl() }, (tabs) => {
        if (chrome.runtime.lastError || !tabs) {
          resolve([]);
          return;
        }
        resolve(tabs);
      });
    } catch (error) {
      resolve([]);
    }
  });

  for (const tab of existing) {
    if (tab && typeof tab.id === 'number' && await pingEngine(tab.id)) {
      engineTabId = tab.id;
      scheduleEngineClose();
      return engineTabId;
    }
  }

  const created = await new Promise((resolve, reject) => {
    try {
      chrome.tabs.create({ url: engineUrl(), active: false }, (tab) => {
        if (chrome.runtime.lastError || !tab || typeof tab.id !== 'number') {
          reject(new Error(
            chrome.runtime.lastError
              ? `onglet moteur impossible a ouvrir : ${chrome.runtime.lastError.message}`
              : 'onglet moteur impossible a ouvrir'
          ));
          return;
        }
        resolve(tab.id);
      });
    } catch (error) {
      reject(error);
    }
  });

  // On attend que la page soit prete (chargement du script du moteur).
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (await pingEngine(created)) {
      engineTabId = created;
      scheduleEngineClose();
      console.log(`${LOG_PREFIX} OCR — onglet moteur pret (${created})`);
      return engineTabId;
    }
    await sleep(150);
  }

  try {
    chrome.tabs.remove(created, () => void chrome.runtime.lastError);
  } catch (error) {
    // Rien a faire.
  }

  throw new Error('la page du moteur OCR ne repond pas (10 s depassees)');
}

/**
 * Demande la lecture d'une image au moteur.
 *
 * @param {string} image - image encodee (data URL)
 * @returns {Promise<{text: string, confidence: number|null, durationMs: number}>}
 */
async function askEngine(image) {
  const tabId = await ensureEngineTab();

  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: 'engine-ocr', image }, (response) => {
        scheduleEngineClose();

        if (chrome.runtime.lastError) {
          reject(new Error(
            `le moteur n'a pas repondu : ${chrome.runtime.lastError.message}`
          ));
          return;
        }

        if (!response || response.ok !== true) {
          reject(new Error(
            (response && response.error) || 'reponse invalide du moteur'
          ));
          return;
        }

        resolve({
          text: response.text || '',
          confidence: typeof response.confidence === 'number' ? response.confidence : null,
          durationMs: typeof response.durationMs === 'number' ? response.durationMs : 0
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Transforme n'importe quelle erreur en message lisible.
 *
 * Un worker qui échoue lève un événement dont le message est souvent VIDE :
 * sans ce traitement, la page affichait « erreur inconnue ».
 */
function describeFailure(error) {
  if (error === null || error === undefined) {
    return 'échec sans explication';
  }
  if (typeof error === 'string') {
    return error.trim() || 'échec sans explication';
  }
  if (typeof error === 'object' && error.error instanceof Error) {
    return describeFailure(error.error);
  }
  if (typeof error === 'object' && typeof error.message === 'string' &&
      error.message.trim() !== '') {
    return error.message;
  }
  if (typeof error === 'object' && typeof error.type === 'string') {
    return `événement « ${error.type} »`;
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') {
      return serialized.slice(0, 200);
    }
  } catch (serializationError) {
    // objet non sérialisable
  }
  return String(error);
}

/** Valide un rectangle de selection OCR. */
function normalizeOcrRect(rect) {
  if (!rect || typeof rect !== 'object') {
    return null;
  }
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![x, y, width, height].every(Number.isFinite) ||
      width < 1 || height < 1 || width > 100000 || height > 100000) {
    return null;
  }
  return { x: x, y: y, width: width, height: height };
}

function normalizeViewport(viewport) {
  if (!viewport || typeof viewport !== 'object') {
    return null;
  }
  const width = Number(viewport.width);
  const height = Number(viewport.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0 || width > 100000 || height > 100000) {
    return null;
  }
  return { width: width, height: height };
}

function normalizeDpr(value) {
  const dpr = Number(value);
  return Number.isFinite(dpr) && dpr >= 0.1 && dpr <= 10 ? dpr : 1;
}

/** Ne conserve que des champs bornes du rapport de bug. */
function sanitizeBugReport(input) {
  const source = input && typeof input === 'object' ? input : {};
  const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
  const ocr = source.ocr && typeof source.ocr === 'object' ? source.ocr : {};
  const confidence = Number(ocr.confidence);
  return {
    createdAt: text(source.createdAt, 40),
    pageUrl: text(source.pageUrl, 2048),
    pageTitle: text(source.pageTitle, 300),
    userAgent: text(source.userAgent, 500),
    language: text(source.language, 20),
    extensionVersion: text(source.extensionVersion, 20),
    rect: normalizeOcrRect(source.rect),
    dpr: normalizeDpr(source.dpr),
    viewport: normalizeViewport(source.viewport),
    ocr: {
      ok: ocr.ok === true,
      text: text(ocr.text, 4000),
      confidence: Number.isFinite(confidence)
        ? Math.max(0, Math.min(100, Math.round(confidence)))
        : null,
      error: text(ocr.error, 200)
    },
    pageText: text(source.pageText, 4000)
  };
}

/** Photographie l'onglet visible. */
function captureVisibleTab() {
  return new Promise((resolve, reject) => {
    // Certains navigateurs (ou contextes) n'exposent pas cette API. Sans ce
    // test, l'erreur affichee etait technique (« ... is not a function »).
    if (!chrome.tabs || typeof chrome.tabs.captureVisibleTab !== 'function') {
      reject(new Error(
        'la capture d\'écran n\'est pas prise en charge par ce navigateur'
      ));
      return;
    }

    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        reject(new Error(
          chrome.runtime.lastError
            ? `capture refusée : ${chrome.runtime.lastError.message}`
            : 'capture vide'
        ));
        return;
      }
      resolve(dataUrl);
    });
  });
}

/**
 * Découpe la zone, l'agrandit et la passe en niveaux de gris.
 *
 * @param {string} dataUrl - la capture complète
 * @param {{x:number,y:number,width:number,height:number}} rect - en pixels CSS
 * @param {number} dpr - densité de l'écran (2 sur un écran Retina)
 * @returns {Promise<string>} une image (data URL) prête pour l'OCR
 */
function cropForOcr(dataUrl, rect, dpr, viewport) {
  return new Promise((resolve, reject) => {
    const loadImage = () => {
      const image = new Image();

      image.onload = () => {
        try {
          // ECHELLE REELLE : on la deduit des dimensions de la capture
          // (naturalWidth) comparees a celles du viewport. Se fier au seul
          // « devicePixelRatio » est une source d'erreur classique : zoom de
          // page, capture reduite, ou navigateur qui renvoie une image 1x.
          const hasViewport = viewport &&
            Number.isFinite(viewport.width) && viewport.width > 0 &&
            Number.isFinite(viewport.height) && viewport.height > 0;

          const scaleX = hasViewport
            ? image.naturalWidth / viewport.width
            : (dpr > 0 ? dpr : 1);
          const scaleY = hasViewport
            ? image.naturalHeight / viewport.height
            : (dpr > 0 ? dpr : 1);

          const sourceX = Math.max(0, Math.round(rect.x * scaleX));
          const sourceY = Math.max(0, Math.round(rect.y * scaleY));
          const sourceWidth = Math.max(1, Math.min(
            Math.round(rect.width * scaleX),
            image.naturalWidth - sourceX
          ));
          const sourceHeight = Math.max(1, Math.min(
            Math.round(rect.height * scaleY),
            image.naturalHeight - sourceY
          ));

          console.log(`${LOG_PREFIX} OCR — découpe`, {
            capture: `${image.naturalWidth}×${image.naturalHeight}`,
            viewport: hasViewport ? `${viewport.width}×${viewport.height}` : 'inconnu',
            echelle: `${scaleX.toFixed(2)} / ${scaleY.toFixed(2)}`,
            zone: `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(rect.height)}`,
            source: `${sourceX},${sourceY} ${sourceWidth}×${sourceHeight}`
          });

          const factor = Math.min(OCR_UPSCALE, OCR_MAX_SIDE / Math.max(sourceWidth, sourceHeight));

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(sourceWidth * factor));
          canvas.height = Math.max(1, Math.round(sourceHeight * factor));

          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('canvas indisponible'));
            return;
          }

          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(
            image,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, canvas.width, canvas.height
          );

          // Niveaux de gris + contraste : l'OCR lit mieux du texte net.
          try {
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const data = pixels.data;
            for (let index = 0; index < data.length; index += 4) {
              const grey = 0.299 * data[index] + 0.587 * data[index + 1] +
                0.114 * data[index + 2];
              const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.25 + 128));
              data[index] = contrasted;
              data[index + 1] = contrasted;
              data[index + 2] = contrasted;
            }
            context.putImageData(pixels, 0, 0);
          } catch (error) {
            // Canvas « sale » : on garde l'image en couleur.
          }

          resolve({
            image: canvas.toDataURL('image/png'),
            info: {
              imageWidth: image.naturalWidth,
              imageHeight: image.naturalHeight,
              sourceWidth: sourceWidth,
              sourceHeight: sourceHeight,
              outputWidth: canvas.width,
              outputHeight: canvas.height
            }
          });
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = () => reject(new Error('capture illisible'));
      image.src = dataUrl;
    };

    loadImage();
  });
}

/**
 * Derniere zone capturee, en attente de lecture.
 *
 * POURQUOI DEUX ETAPES (capture, puis lecture)
 * --------------------------------------------
 * La bulle « lecture en cours » ne doit apparaitre qu'APRES la photographie.
 * Sinon elle se trouve dans l'image, et l'OCR lit la bulle au lieu du prix —
 * c'etait le defaut constate sur une petite zone.
 *
 * La page appelle donc :
 *   1. « ocr-capture »   -> la photo est prise tout de suite ;
 *   2. « ocr-recognize » -> la lecture commence, une fois la photo faite.
 *
 * L'image reste ici entre les deux appels : elle ne repasse pas par la page.
 */
let pendingCrop = null;

/**
 * Photographie la zone et la prepare pour l'OCR.
 *
 * @param {{x:number,y:number,width:number,height:number}} rect
 * @param {number} dpr
 * @param {{width:number,height:number}|null} viewport
 */
async function captureRegion(rect, dpr, viewport) {
  const shot = await captureVisibleTab();
  const zone = await cropForOcr(shot, rect, dpr, viewport);

  pendingCrop = {
    id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    image: zone.image,
    info: zone.info,
    createdAt: Date.now()
  };

  return pendingCrop;
}

// ===========================================================================
//  6. REPONSES AUX MESSAGES
// ===========================================================================

/**
 * Repond a une demande de conversion.
 *
 * La reponse contient assez d'informations pour que la bulle affiche tout :
 * la valeur, le taux, la date, et si c'est un taux en cache.
 */
async function handleConvertRequest(message) {
  const { amount, from, to } = message;

  if (typeof amount !== 'number' || !Number.isFinite(amount) ||
      Math.abs(amount) > 1e15) {
    return { ok: false, error: 'montant invalide' };
  }

  // On verifie aussi les devises : un message malforme ne doit pas faire
  // planter la conversion (from.toUpperCase() leverait une exception).
  if (typeof from !== 'string' || typeof to !== 'string' ||
      !/^[A-Za-z]{3}$/.test(from) || !/^[A-Za-z]{3}$/.test(to)) {
    return { ok: false, error: 'devise invalide' };
  }

  const available = await loadRates(false);

  if (!available) {
    return {
      ok: false,
      error: 'aucun taux disponible',
      hint: 'verifie ta connexion internet'
    };
  }

  const result = convert(amount, from, to);

  if (!result) {
    return {
      ok: false,
      error: 'devise non disponible',
      from: from,
      to: to,
      hint: `l'API ne fournit pas de taux pour ${from} -> ${to}`
    };
  }

  const stale = ratesFetchedAt
    ? Date.now() - ratesFetchedAt >= CACHE_DURATION_MS
    : false;

  return {
    ok: true,
    value: result.value,
    rate: result.rate,
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    date: ratesDate,
    fetchedAt: ratesFetchedAt,
    stale: stale,
    version: UNICONV_VERSION
  };
}

/**
 * Guichet des messages.
 *
 * Rappel : le script de la page et l'arriere-plan ne partagent pas la memoire.
 * Ils s'echangent des messages, comme deux collegues qui se parlent par mail.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  // Un message d'une AUTRE extension ne doit jamais pouvoir declencher une
  // capture d'ecran, un OCR ou une ecriture de rapport. Les messages de nos
  // pages (content, popup, options) portent l'identifiant de l'extension.
  if (sender && sender.id && sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: 'expéditeur non autorisé' });
    return false;
  }

  switch (message.type) {
    // Demande de conversion : c'est le cas principal de cette iteration.
    case 'convert':
      handleConvertRequest(message)
        .then(sendResponse)
        .catch((error) => {
          console.error(`${LOG_PREFIX} erreur de conversion :`, error);
          sendResponse({ ok: false, error: error.message });
        });
      return true; // « true » = la reponse arrivera de facon asynchrone.

    // Le popup demande l'etat des taux.
    case 'rates-status':
      (async () => {
        await loadRates(false);
        sendResponse({
          ok: true,
          version: UNICONV_VERSION,
          date: ratesDate,
          fetchedAt: ratesFetchedAt,
          currencies: ratesCache ? Object.keys(ratesCache).sort() : [],
          stale: ratesFetchedAt
            ? Date.now() - ratesFetchedAt >= CACHE_DURATION_MS
            : false
        });
      })();
      return true;

    // Le popup demande un rafraichissement immediat.
    case 'refresh-rates':
      (async () => {
        const ok = await loadRates(true);
        sendResponse({
          ok: ok,
          date: ratesDate,
          fetchedAt: ratesFetchedAt
        });
      })();
      return true;

    // Iteration 10 : ETAPE 1, photographier la zone (avant toute bulle).
    case 'ocr-capture':
      (async () => {
        try {
          const rect = normalizeOcrRect(message.rect);
          if (!rect) {
            sendResponse({ ok: false, error: 'zone invalide' });
            return;
          }
          const captured = await captureRegion(
            rect, normalizeDpr(message.dpr), normalizeViewport(message.viewport)
          );
          sendResponse({ ok: true, id: captured.id, crop: captured.info });
        } catch (error) {
          const detail = describeFailure(error);
          console.error(`${LOG_PREFIX} OCR — capture impossible :`, detail, error);
          sendResponse({ ok: false, error: detail });
        }
      })();
      return true;

    // Iteration 10 : ETAPE 2, faire lire la zone deja photographiee.
    case 'ocr-recognize':
      (async () => {
        try {
          if (!pendingCrop || (message.id && message.id !== pendingCrop.id)) {
            sendResponse({ ok: false, error: 'zone expirée : redessinez le rectangle' });
            return;
          }

          const startedAt = Date.now();
          const outcome = await askEngine(pendingCrop.image);

          sendResponse({
            ok: true,
            text: outcome.text,
            confidence: outcome.confidence,
            durationMs: Date.now() - startedAt,
            crop: pendingCrop.info
          });
        } catch (error) {
          const detail = describeFailure(error);
          console.error(`${LOG_PREFIX} OCR — lecture impossible :`, detail, error);
          sendResponse({ ok: false, error: detail });
        }
      })();
      return true;

    // Rapport de bug : la zone est deja photographiee, on l'ajoute aux
    // diagnostics et on ouvre une page locale (aucun envoi reseau).
    case 'bug-report':
      (async () => {
        try {
          if (!pendingCrop || (message.id && message.id !== pendingCrop.id)) {
            sendResponse({ ok: false, error: 'zone expirée : recommencez la sélection' });
            return;
          }

          const image = typeof pendingCrop.image === 'string'
            ? pendingCrop.image
            : '';
          if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image) ||
              image.length > 8 * 1024 * 1024) {
            sendResponse({ ok: false, error: 'image de rapport invalide' });
            return;
          }

          const report = sanitizeBugReport(message.report);
          report.image = image;
          report.crop = pendingCrop.info || null;

          chrome.storage.local.set({ 'uniconv.bugReport': report }, function () {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            try {
              chrome.tabs.create({ url: chrome.runtime.getURL('src/report.html') }, function () {
                void chrome.runtime.lastError;
              });
              sendResponse({ ok: true });
            } catch (error) {
              sendResponse({ ok: false, error: error.message });
            }
          });
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
      })();
      return true;

    // Test autonome du moteur (bouton « Tester le moteur » des reglages).
    case 'engine-self-test':
      (async () => {
        try {
          const tabId = await ensureEngineTab();
          chrome.tabs.sendMessage(tabId, { type: 'engine-self-test' }, (response) => {
            scheduleEngineClose();
            if (chrome.runtime.lastError || !response) {
              sendResponse({
                ok: false,
                error: chrome.runtime.lastError
                  ? chrome.runtime.lastError.message
                  : 'aucune reponse du moteur'
              });
              return;
            }
            sendResponse(response);
          });
        } catch (error) {
          sendResponse({ ok: false, error: describeFailure(error) });
        }
      })();
      return true;

    // Le script de page (ou le popup) signale un changement de pause :
    // on met a jour le badge pour que l'etat soit visible sur l'icone.
    case 'set-paused':
      updateBadge(Boolean(message.paused));
      sendResponse({ ok: true, paused: Boolean(message.paused) });
      return true;

    // Compatibilite avec l'ancienne version du popup.
    case 'ping':
      sendResponse({
        ok: true,
        version: UNICONV_VERSION,
        stage: 'iteration 3 — vrais taux de change'
      });
      return true;

    default:
      sendResponse({ ok: false, error: `type de message inconnu : ${message.type}` });
      return true;
  }
});

// ===========================================================================
//  7. DEMARRAGE
// ===========================================================================

console.log(`${LOG_PREFIX} arriere-plan demarre — version ${UNICONV_VERSION}`);

// Iteration 7 : le badge doit refleter l'etat de pause des le demarrage.
restoreBadge();

// On precharge les taux des le demarrage : la premiere bulle sera donc
// instantanee, au lieu d'attendre un appel reseau.
loadRates(false).catch((error) => {
  console.warn(`${LOG_PREFIX} prechargement impossible :`, error.message);
});
