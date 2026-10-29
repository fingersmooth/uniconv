/**
 * ============================================================================
 *  UniConv — src/popup.js
 *  Version 0.4.0 — iteration 3 : etat des taux de change
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Faire fonctionner la petite fenetre qui s'ouvre au clic sur l'icone.
 *
 *  A CETTE ITERATION
 *  -----------------
 *  Le popup affiche :
 *    - l'etat du script d'arriere-plan ;
 *    - la date des taux de change utilises ;
 *    - le nombre de devises disponibles ;
 *    - un bouton pour forcer un rafraichissement.
 *
 *  ITERATION 8 : ce fichier sera enrichi des vrais reglages (choix de la
 *  devise cible, systeme d'unites, activation).
 */

'use strict';

/** Version de l'extension, affichee dans le popup. */
const UNICONV_VERSION = '2.9.10';

/** Delai maximum d'attente d'une reponse de l'arriere-plan, en millisecondes. */
const MESSAGE_TIMEOUT_MS = 7000;

/**
 * Remplace le contenu d'un element de la page, en toute securite.
 *
 * On utilise « textContent » et non « innerHTML » : cette deuxieme methode
 * interpreterait le texte comme du code HTML, ce qui ouvrirait une faille de
 * securite si une valeur provenait d'une source exterieure (ici, l'API).
 */
function setText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Envoie un message a l'arriere-plan et attend sa reponse.
 *
 * On protege l'appel par un delai maximum : sans cela, un arriere-plan muet
 * laisserait le popup bloque sur « chargement... » indefiniment.
 *
 * @param {object} message - le message a envoyer
 * @returns {Promise<object|null>} la reponse, ou null si echec
 */
function sendMessage(message) {
  return new Promise(function (resolve) {
    let settled = false;

    const timeoutId = setTimeout(function () {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, MESSAGE_TIMEOUT_MS);

    try {
      chrome.runtime.sendMessage(message, function (response) {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          console.warn('[UniConv] popup :', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }

        resolve(response || null);
      });
    } catch (error) {
      settled = true;
      clearTimeout(timeoutId);
      console.warn('[UniConv] popup : envoi impossible —', error.message);
      resolve(null);
    }
  });
}


/** Transforme une date ISO (« 2026-10-23 ») en date francaise (« 23/10/2026 »). */
function formatFrenchDate(isoDate) {
  if (!isoDate) {
    return '—';
  }
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) {
    return String(isoDate);
  }
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Traduit l'anciennete d'une date en texte lisible.
 *
 * @param {number} timestamp - date en millisecondes
 */
function formatAge(timestamp) {
  if (typeof timestamp !== 'number') {
    return 'date inconnue';
  }

  const minutes = Math.floor((Date.now() - timestamp) / 60000);

  if (minutes < 1) {
    return "a l'instant";
  }
  if (minutes < 60) {
    return `il y a ${minutes} min`;
  }

  const heures = Math.floor(minutes / 60);
  if (heures < 24) {
    return `il y a ${heures} h`;
  }

  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

/**
 * Met a jour le bloc « Taux de change » du popup.
 *
 * @param {object|null} status - la reponse de l'arriere-plan
 */
function renderRatesStatus(status) {
  const statusElement = document.getElementById('rates-status');
  const dateElement = document.getElementById('rates-date');

  if (!status || status.ok !== true) {
    if (statusElement) {
      statusElement.textContent = 'Indisponible';
      statusElement.className = 'badge-error';
    }
    if (dateElement) {
      dateElement.textContent = 'aucune donnee';
    }
    return;
  }

  const currencies = Array.isArray(status.currencies) ? status.currencies : [];
  const date = formatFrenchDate(status.date);
  const age = formatAge(status.fetchedAt);

  if (dateElement) {
    dateElement.textContent = date;
  }

  if (!statusElement) {
    return;
  }

  if (currencies.length === 0) {
    statusElement.textContent = 'Aucun taux charge';
    statusElement.className = 'badge-error';
    return;
  }

  // Le convertisseur du popup utilise la meme liste que les taux.
  UniConvConverter.populateCurrencySelects(currencies);
  populateReferenceCurrencies(currencies);

  // Les taux viennent peut-etre d'arriver : on relance la conversion
  // initiale, qui avait pu echouer avant leur chargement.
  UniConvConverter.refreshCurrencyConversion();

  if (status.stale) {
    statusElement.textContent =
      `${currencies.length} devises \u00B7 taux anciens (${age})`;
    statusElement.className = 'badge-warn';
  } else {
    statusElement.textContent =
      `${currencies.length} devises \u00B7 mis a jour ${age}`;
    statusElement.className = 'badge-ok';
  }
}

/**
 * Charge et affiche l'etat des taux.
 *
 * @param {boolean} forceRefresh - demande un rafraichissement a l'API
 */
async function refreshRatesPanel(forceRefresh) {
  const button = document.getElementById('refresh-rates');

  if (button) {
    button.disabled = true;
    button.textContent = forceRefresh ? 'Rafraichissement…' : 'Chargement…';
  }

  try {
    if (forceRefresh) {
      await sendMessage({ type: 'refresh-rates' });
    }

    const status = await sendMessage({ type: 'rates-status' });
    renderRatesStatus(status);

    // On en profite pour verifier que l'arriere-plan repond bien, ce qui
    // valide du meme coup toute la chaine de communication.
    setText('background-status', status ? 'actif' : 'injoignable');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Rafraichir les taux';
    }
  }
}

/**
 * Fuseaux proposes dans le popup. La page de reglages garde la liste complete ;
 * ici on veut un choix rapide et compact.
 */
const POPUP_TIMEZONES = [
  { id: '', city: 'Ma ville (fuseau du systeme)' },
  { id: 'Europe/Paris', city: 'Paris' },
  { id: 'Europe/London', city: 'Londres' },
  { id: 'Europe/Berlin', city: 'Berlin' },
  { id: 'Europe/Madrid', city: 'Madrid' },
  { id: 'Europe/Rome', city: 'Rome' },
  { id: 'Europe/Amsterdam', city: 'Amsterdam' },
  { id: 'Europe/Brussels', city: 'Bruxelles' },
  { id: 'Europe/Zurich', city: 'Zurich' },
  { id: 'America/New_York', city: 'New York' },
  { id: 'America/Chicago', city: 'Chicago' },
  { id: 'America/Los_Angeles', city: 'Los Angeles' },
  { id: 'America/Toronto', city: 'Toronto' },
  { id: 'America/Mexico_City', city: 'Mexico' },
  { id: 'America/Sao_Paulo', city: 'Sao Paulo' },
  { id: 'America/Buenos_Aires', city: 'Buenos Aires' },
  { id: 'Asia/Dubai', city: 'Dubai' },
  { id: 'Europe/Istanbul', city: 'Istanbul' },
  { id: 'Europe/Moscow', city: 'Moscou' },
  { id: 'Asia/Shanghai', city: 'Shanghai' },
  { id: 'Asia/Hong_Kong', city: 'Hong Kong' },
  { id: 'Asia/Tokyo', city: 'Tokyo' },
  { id: 'Asia/Seoul', city: 'Seoul' },
  { id: 'Asia/Singapore', city: 'Singapour' },
  { id: 'Australia/Sydney', city: 'Sydney' },
  { id: 'Pacific/Auckland', city: 'Auckland' },
  { id: 'UTC', city: 'UTC' }
];

const REFERENCE_FALLBACK_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY',
  'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN', 'INR', 'BRL'
];

const POPUP_CURRENCY_COUNTRIES = {
  'AED': 'AE',
  'AFN': 'AF',
  'ALL': 'AL',
  'AMD': 'AM',
  'ANG': 'CW',
  'AOA': 'AO',
  'ARS': 'AR',
  'AUD': 'AU',
  'AWG': 'AW',
  'AZN': 'AZ',
  'BAM': 'BA',
  'BBD': 'BB',
  'BDT': 'BD',
  'BGN': 'BG',
  'BHD': 'BH',
  'BIF': 'BI',
  'BMD': 'BM',
  'BND': 'BN',
  'BOB': 'BO',
  'BRL': 'BR',
  'BSD': 'BS',
  'BTN': 'BT',
  'BWP': 'BW',
  'BYN': 'BY',
  'BZD': 'BZ',
  'CAD': 'CA',
  'CDF': 'CD',
  'CHF': 'CH',
  'CLF': 'CL',
  'CLP': 'CL',
  'CNH': 'CN',
  'CNY': 'CN',
  'COP': 'CO',
  'CRC': 'CR',
  'CUP': 'CU',
  'CVE': 'CV',
  'CZK': 'CZ',
  'DJF': 'DJ',
  'DKK': 'DK',
  'DOP': 'DO',
  'DZD': 'DZ',
  'EGP': 'EG',
  'ERN': 'ER',
  'ETB': 'ET',
  'EUR': 'EU',
  'FJD': 'FJ',
  'FKP': 'FK',
  'FOK': 'FO',
  'GBP': 'GB',
  'GEL': 'GE',
  'GGP': 'GG',
  'GHS': 'GH',
  'GIP': 'GI',
  'GMD': 'GM',
  'GNF': 'GN',
  'GTQ': 'GT',
  'GYD': 'GY',
  'HKD': 'HK',
  'HNL': 'HN',
  'HRK': 'HR',
  'HTG': 'HT',
  'HUF': 'HU',
  'IDR': 'ID',
  'ILS': 'IL',
  'IMP': 'IM',
  'INR': 'IN',
  'IQD': 'IQ',
  'IRR': 'IR',
  'ISK': 'IS',
  'JEP': 'JE',
  'JMD': 'JM',
  'JOD': 'JO',
  'JPY': 'JP',
  'KES': 'KE',
  'KGS': 'KG',
  'KHR': 'KH',
  'KID': 'KI',
  'KMF': 'KM',
  'KPW': 'KP',
  'KRW': 'KR',
  'KWD': 'KW',
  'KYD': 'KY',
  'KZT': 'KZ',
  'LAK': 'LA',
  'LBP': 'LB',
  'LKR': 'LK',
  'LRD': 'LR',
  'LSL': 'LS',
  'LYD': 'LY',
  'MAD': 'MA',
  'MDL': 'MD',
  'MGA': 'MG',
  'MKD': 'MK',
  'MMK': 'MM',
  'MNT': 'MN',
  'MOP': 'MO',
  'MRU': 'MR',
  'MUR': 'MU',
  'MVR': 'MV',
  'MWK': 'MW',
  'MXN': 'MX',
  'MYR': 'MY',
  'MZN': 'MZ',
  'NAD': 'NA',
  'NGN': 'NG',
  'NIO': 'NI',
  'NOK': 'NO',
  'NPR': 'NP',
  'NZD': 'NZ',
  'OMR': 'OM',
  'PAB': 'PA',
  'PEN': 'PE',
  'PGK': 'PG',
  'PHP': 'PH',
  'PKR': 'PK',
  'PLN': 'PL',
  'PYG': 'PY',
  'QAR': 'QA',
  'RON': 'RO',
  'RSD': 'RS',
  'RUB': 'RU',
  'RWF': 'RW',
  'SAR': 'SA',
  'SBD': 'SB',
  'SCR': 'SC',
  'SDG': 'SD',
  'SEK': 'SE',
  'SGD': 'SG',
  'SHP': 'SH',
  'SLE': 'SL',
  'SLL': 'SL',
  'SOS': 'SO',
  'SRD': 'SR',
  'SSP': 'SS',
  'STN': 'ST',
  'SYP': 'SY',
  'SZL': 'SZ',
  'THB': 'TH',
  'TJS': 'TJ',
  'TMT': 'TM',
  'TND': 'TN',
  'TOP': 'TO',
  'TRY': 'TR',
  'TTD': 'TT',
  'TVD': 'TV',
  'TWD': 'TW',
  'TZS': 'TZ',
  'UAH': 'UA',
  'UGX': 'UG',
  'USD': 'US',
  'UYU': 'UY',
  'UZS': 'UZ',
  'VES': 'VE',
  'VND': 'VN',
  'VUV': 'VU',
  'WST': 'WS',
  'XAF': 'CM',
  'XCD': 'AG',
  'XCG': 'CW',
  'XOF': 'SN',
  'XPF': 'PF',
  'YER': 'YE',
  'ZAR': 'ZA',
  'ZMW': 'ZM',
  'ZWG': 'ZW',
  'ZWL': 'ZW',
};

const POPUP_TOP_CURRENCIES = [
  'USD', 'EUR', 'JPY', 'GBP', 'CNY'
];

let referenceCurrencyCodes = REFERENCE_FALLBACK_CURRENCIES.slice();
let referenceCurrencyCurrent = 'EUR';
const pinnedReferenceCurrencies = new Set();
let referenceCurrencyNames = null;

/** Nom lisible d'une devise, sans dependre du convertisseur. */
function referenceCurrencyName(code) {
  if (referenceCurrencyNames === null) {
    try {
      referenceCurrencyNames = new Intl.DisplayNames(['fr'], { type: 'currency' });
    } catch (error) {
      referenceCurrencyNames = false;
    }
  }
  if (!referenceCurrencyNames) {
    return code;
  }
  try {
    return referenceCurrencyNames.of(code) || code;
  } catch (error) {
    return code;
  }
}

/** Devise par defaut selon la langue systeme (fr -> EUR, sinon USD). */
function defaultReferenceCurrency() {
  const lang = String((navigator && navigator.language) || 'fr').toLowerCase();
  return lang.indexOf('fr') === 0 ? 'EUR' : 'USD';
}

function popupFlagEmoji(country) {
  if (!country || String(country).length !== 2) {
    return '';
  }
  const code = String(country).toUpperCase();
  const base = 0x1F1E6;
  return String.fromCodePoint(
    base + code.charCodeAt(0) - 65,
    base + code.charCodeAt(1) - 65
  );
}

function referenceFlag(code) {
  const country = POPUP_CURRENCY_COUNTRIES[code];
  return country ? popupFlagEmoji(country) : '';
}

function referenceCurrencyLabel(code) {
  return `${code} — ${referenceCurrencyName(code)}`;
}

function updateReferenceCurrencyField() {
  const label = document.getElementById('reference-currency-label');
  if (label && referenceCurrencyCurrent) {
    label.textContent = referenceCurrencyLabel(referenceCurrencyCurrent);
  }
}

function closeReferenceCurrencyMenu() {
  const menu = document.getElementById('reference-currency-menu');
  const field = document.getElementById('reference-currency-field');
  if (menu) menu.hidden = true;
  if (field) field.setAttribute('aria-expanded', 'false');
}

function renderReferenceCurrencyList() {
  const list = document.getElementById('reference-currency-list');
  const search = document.getElementById('reference-currency-search');
  if (!list) {
    return;
  }

  const query = String(search ? search.value : '').trim().toLowerCase();
  const matches = (code) => {
    if (!query) return true;
    return code.toLowerCase().indexOf(query) !== -1 ||
      referenceCurrencyName(code).toLowerCase().indexOf(query) !== -1;
  };

  const allCodes = Array.from(new Set(
    referenceCurrencyCodes.concat(
      Array.from(pinnedReferenceCurrencies),
      [referenceCurrencyCurrent],
      POPUP_TOP_CURRENCIES
    )
  ));
  const filtered = allCodes.filter(matches);
  const importance = (code) => {
    const index = POPUP_TOP_CURRENCIES.indexOf(code);
    return index === -1 ? POPUP_TOP_CURRENCIES.length : index;
  };
  const pinned = filtered
    .filter((code) => pinnedReferenceCurrencies.has(code))
    .sort((a, b) => importance(a) - importance(b) || a.localeCompare(b));
  const top = POPUP_TOP_CURRENCIES.filter((code) =>
    allCodes.indexOf(code) !== -1 && matches(code) &&
    !pinnedReferenceCurrencies.has(code));
  const others = filtered
    .filter((code) =>
      !pinnedReferenceCurrencies.has(code) &&
      POPUP_TOP_CURRENCIES.indexOf(code) === -1)
    .sort();

  list.textContent = '';
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'reference-item';
    empty.textContent = 'Aucun resultat';
    list.appendChild(empty);
    return;
  }

  const sections = [
    { title: 'Épinglées', items: pinned },
    { title: 'Principales', items: top },
    { title: 'Autres', items: others }
  ];

  for (const section of sections) {
    if (section.items.length === 0) continue;

    const header = document.createElement('div');
    header.className = 'reference-section';
    header.textContent = section.title;
    list.appendChild(header);

    for (const code of section.items) {
      const row = document.createElement('div');
      row.className = 'reference-row-item';

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'reference-item' +
        (code === referenceCurrencyCurrent ? ' selected' : '');
      item.setAttribute('data-code', code);

      const flag = document.createElement('span');
      flag.className = 'reference-flag';
      flag.textContent = referenceFlag(code);

      const name = document.createElement('span');
      name.className = 'reference-name';
      name.textContent = referenceCurrencyLabel(code);

      item.appendChild(flag);
      item.appendChild(name);
      item.addEventListener('click', function () {
        saveReferenceCurrency(code);
      });
      row.appendChild(item);

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'reference-pin' +
        (pinnedReferenceCurrencies.has(code) ? ' pinned' : '');
      pin.textContent = '📌';
      pin.title = pinnedReferenceCurrencies.has(code)
        ? 'Retirer des épinglées'
        : 'Épingler cette devise';
      pin.setAttribute('aria-label', pin.title);
      pin.setAttribute('aria-pressed', pinnedReferenceCurrencies.has(code) ? 'true' : 'false');
      pin.addEventListener('click', function () {
        toggleReferencePin(code);
      });
      row.appendChild(pin);

      list.appendChild(row);
    }
  }
}

function saveReferencePins() {
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        'uniconv.pinnedCurrencies': Array.from(pinnedReferenceCurrencies)
      });
    }
  } catch (error) {
    // Stockage indisponible.
  }
}

function toggleReferencePin(code) {
  if (pinnedReferenceCurrencies.has(code)) {
    pinnedReferenceCurrencies.delete(code);
  } else {
    pinnedReferenceCurrencies.add(code);
  }
  saveReferencePins();
  renderReferenceCurrencyList();
}

function loadReferencePins() {
  try {
    if (!chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.get('uniconv.pinnedCurrencies', function (result) {
      if (chrome.runtime.lastError) {
        return;
      }
      const value = result && result['uniconv.pinnedCurrencies'];
      if (!Array.isArray(value)) {
        return;
      }
      pinnedReferenceCurrencies.clear();
      for (const code of value) {
        if (/^[A-Z]{3}$/.test(String(code))) {
          pinnedReferenceCurrencies.add(String(code));
        }
      }
      renderReferenceCurrencyList();
    });
  } catch (error) {
    // Stockage indisponible.
  }
}

function openReferenceCurrencyMenu() {
  const menu = document.getElementById('reference-currency-menu');
  const field = document.getElementById('reference-currency-field');
  const search = document.getElementById('reference-currency-search');
  if (!menu) return;
  menu.hidden = false;
  if (field) field.setAttribute('aria-expanded', 'true');
  if (search) {
    search.value = '';
    renderReferenceCurrencyList();
    search.focus();
  } else {
    renderReferenceCurrencyList();
  }
}

/** Remplit la liste des devises de reference disponibles. */
function populateReferenceCurrencies(codes) {
  const list = Array.isArray(codes)
    ? codes.filter((code) => /^[A-Z]{3}$/.test(String(code)))
    : [];
  if (list.length > 0) {
    referenceCurrencyCodes = Array.from(new Set(list)).sort();
  }
  renderReferenceCurrencyList();
}

/** Reconstruit la liste (10 resultats max) selon la recherche. */
function refreshReferenceCurrencyOptions() {
  renderReferenceCurrencyList();
}

/** Remplit le selecteur de fuseau de reference. */
function populateReferenceTimezones(current) {
  const select = document.getElementById('reference-timezone');
  if (!select) {
    return;
  }

  const list = POPUP_TIMEZONES.slice();
  if (current && !list.some((zone) => zone.id === current)) {
    list.push({ id: current, city: current });
  }

  select.textContent = '';
  for (const zone of list) {
    const option = document.createElement('option');
    option.value = zone.id;
    option.textContent = zone.city;
    if (zone.id === (current || '')) {
      option.selected = true;
    }
    select.appendChild(option);
  }
}

/** Enregistre la monnaie de reference (et active les unites de reference). */
async function saveReferenceCurrency(code) {
  referenceCurrencyCurrent = String(code || '').toUpperCase();
  updateReferenceCurrencyField();
  closeReferenceCurrencyMenu();
  try {
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        'uniconv.targetCurrency': referenceCurrencyCurrent,
        'uniconv.referenceUnitsEnabled': true
      });
    }
  } catch (error) {
    console.warn('[UniConv] popup : monnaie de reference non enregistree');
  }
}

/** Enregistre le fuseau de reference (chaine vide = fuseau local). */
async function saveReferenceTimezone(id) {
  try {
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        'uniconv.targetTimezone': String(id || ''),
        'uniconv.referenceUnitsEnabled': true
      });
    }
  } catch (error) {
    console.warn('[UniConv] popup : fuseau de reference non enregistre');
  }
}

/** Charge les valeurs du cadre « Unites de reference ». */
async function loadReferenceSettings() {
  let currency = defaultReferenceCurrency();
  let timezone = '';

  try {
    if (chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get([
        'uniconv.targetCurrency',
        'uniconv.targetTimezone',
        'uniconv.unitSystem',
        'uniconv.referenceUnitsEnabled'
      ]);
      if (result) {
        if (result['uniconv.targetCurrency']) {
          currency = String(result['uniconv.targetCurrency']).toUpperCase();
        } else {
          await chrome.storage.local.set({ 'uniconv.targetCurrency': currency });
        }
        if (typeof result['uniconv.targetTimezone'] === 'string') {
          timezone = result['uniconv.targetTimezone'];
        }
        if (!result['uniconv.unitSystem']) {
          await chrome.storage.local.set({ 'uniconv.unitSystem': 'metric' });
        }
        if (result['uniconv.referenceUnitsEnabled'] !== true) {
          await chrome.storage.local.set({ 'uniconv.referenceUnitsEnabled': true });
        }
      }
    }
  } catch (error) {
    // On garde les valeurs par defaut.
  }

  referenceCurrencyCurrent = currency;
  updateReferenceCurrencyField();
  populateReferenceTimezones(timezone);
  renderReferenceCurrencyList();
}

/** Branche le cadre « Unites de reference ». */
function initReferenceCard() {
  const field = document.getElementById('reference-currency-field');
  const search = document.getElementById('reference-currency-search');
  const menu = document.getElementById('reference-currency-menu');
  const control = document.querySelector
    ? document.querySelector('.reference-currency-control')
    : null;
  const timezone = document.getElementById('reference-timezone');

  populateReferenceCurrencies(REFERENCE_FALLBACK_CURRENCIES);
  populateReferenceTimezones('');
  loadReferencePins();

  if (field) {
    field.addEventListener('click', function (event) {
      if (event) event.stopPropagation();
      if (menu && menu.hidden) {
        openReferenceCurrencyMenu();
      } else {
        closeReferenceCurrencyMenu();
      }
    });
  }

  if (search) {
    search.addEventListener('input', function () {
      renderReferenceCurrencyList();
    });
    search.addEventListener('keydown', function (event) {
      if (event && event.key === 'Escape') {
        closeReferenceCurrencyMenu();
      }
    });
  }

  if (timezone) {
    timezone.addEventListener('change', function () {
      saveReferenceTimezone(timezone.value);
    });
  }

  if (control) {
    control.addEventListener('click', function (event) {
      if (event) event.stopPropagation();
    });
  }

  document.addEventListener('click', function (event) {
    if (control && event && event.target && control.contains(event.target)) {
      return;
    }
    closeReferenceCurrencyMenu();
  });

  loadReferenceSettings();
}

/**
 * Lit la preference de systeme d'unites et met a jour les boutons.
 */
async function refreshUnitSystemButtons() {
  const metricButton = document.getElementById('units-metric');
  const imperialButton = document.getElementById('units-imperial');
  if (!metricButton || !imperialButton) {
    return;
  }

  let system = 'metric';
  try {
    if (chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get('uniconv.unitSystem');
      if (result && (result['uniconv.unitSystem'] === 'metric' || result['uniconv.unitSystem'] === 'imperial')) {
        system = result['uniconv.unitSystem'];
      }
    }
  } catch (error) {
    // On garde la valeur par defaut.
  }

  if (system === 'metric') {
    metricButton.classList.add('active');
    imperialButton.classList.remove('active');
  } else {
    imperialButton.classList.add('active');
    metricButton.classList.remove('active');
  }
}

/**
 * Enregistre la preference de systeme d'unites.
 */
async function setUnitSystem(system) {
  try {
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        'uniconv.unitSystem': system,
        'uniconv.referenceUnitsEnabled': true
      });
    }
  } catch (error) {
    console.warn('[UniConv] popup : impossible d\'enregistrer la preference');
  }
  refreshUnitSystemButtons();
}

/**
 * Affiche les statistiques d'analyse de la page courante (iteration 6).
 *
 * Le script de contenu ecrit ces chiffres dans le stockage local :
 *   - nodes   : nombre de blocs de texte analyses au total ;
 *   - batches : nombre de mises a jour dynamiques traitees ;
 *   - updatedAt : date de la derniere mise a jour.
 */
async function refreshScanStats() {
  const element = document.getElementById('scan-stats');
  if (!element) {
    return;
  }

  let stats = null;
  try {
    if (chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get('uniconv.observerStats');
      stats = result ? result['uniconv.observerStats'] : null;
    }
  } catch (error) {
    // Stockage indisponible : on laisse le texte par defaut.
  }

  if (!stats || typeof stats.nodes !== 'number') {
    element.textContent =
      'Aucune analyse enregistree. Rechargez la page apres avoir ouvert ' +
      'le popup une premiere fois.';
    return;
  }

  const nodes = stats.nodes;
  const batches = typeof stats.batches === 'number' ? stats.batches : 0;
  const age = formatAge(stats.updatedAt);

  const images = typeof stats.images === 'number' ? stats.images : 0;

  const parts = [`${nodes} bloc(s) de texte analyses`];

  if (images > 0) {
    parts.push(`${images} image(s) avec un prix`);
  }

  if (batches > 0) {
    parts.push(`${batches} mise(s) a jour dynamique(s)`);
  } else {
    parts.push('page statique');
  }

  element.textContent = `${parts.join(' \u00B7 ')} (${age}).`;

  // Iteration 7 : quoi a ete ecarte, et pourquoi.
  renderIgnoredStats(stats);
}

/** Libelles des regles anti-faux-positifs (iteration 7). */
const REJECTION_LABELS = {
  percent: 'pourcentages',
  version: 'numeros de version',
  time: 'heures',
  date: 'dates',
  range: 'plages de valeurs',
  ratio: 'ratios',
  phone: 'numeros de telephone',
  ip: 'adresses IP',
  identifier: 'references et normes',
  numbering: 'numerotations',
  dimension: 'dimensions',
  millions: '« millions »',
  dump: 'tableaux de chiffres'
};

/**
 * Affiche la liste des nombres volontairement ignores sur la derniere page.
 *
 * L'utilisateur voit ainsi que l'extension travaille, et pourquoi elle ne
 * convertit pas certains nombres : c'est plus rassurant qu'un silence.
 *
 * @param {object|null} stats - statistiques ecrites par le script de page
 */
function renderIgnoredStats(stats) {
  const element = document.getElementById('ignored-stats');
  if (!element) {
    return;
  }

  if (!stats || !stats.rejections || typeof stats.rejections !== 'object') {
    element.textContent = '';
    return;
  }

  const entries = Object.entries(stats.rejections)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    element.textContent = 'Aucun nombre ecarte.';
    return;
  }

  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  // On n'affiche que les trois premieres causes : au-dela, la ligne devient
  // illisible dans une fenetre de 268 pixels.
  const details = entries.slice(0, 3).map(function ([id, count]) {
    const label = REJECTION_LABELS[id] || id;
    return `${count} ${label}`;
  });

  element.textContent =
    `${total} nombre(s) ecarte(s) : ${details.join(', ')}` +
    (entries.length > 3 ? '…' : '') + '.';
}

/**
 * Lit l'etat de pause et met le bouton en accord.
 */
async function refreshGuardState() {
  const stateElement = document.getElementById('guard-state');
  const toggle = document.getElementById('detection-enabled');

  let paused = false;
  try {
    if (chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get('uniconv.enabled');
      paused = Boolean(result) && result['uniconv.enabled'] === false;
    }
  } catch (error) {
    // En cas de doute : on affiche « active ».
  }

  if (stateElement) {
    stateElement.textContent = paused ? 'en pause' : 'active';
    stateElement.className = paused ? 'guard-state paused' : 'guard-state';
  }
  if (toggle) {
    toggle.checked = !paused;
  }

  return paused;
}

/**
 * Bascule l'etat de pause et previent l'arriere-plan (pour le badge).
 */
async function setPaused(paused) {
  try {
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ 'uniconv.enabled': !paused });
    }
  } catch (error) {
    console.warn('[UniConv] popup : impossible d\'enregistrer la pause');
  }

  // Le badge de l'icone est mis a jour par l'arriere-plan.
  await sendMessage({ type: 'set-paused', paused: paused });

  await refreshGuardState();
}

/**
 * Demande a la page d'afficher son voile de selection OCR.
 *
 * POURQUOI LE CLIC ICI EST IMPORTANT
 * ----------------------------------
 * Le clic sur l'icone accorde la permission « activeTab » a l'onglet courant.
 * C'est elle qui autorisera la capture de l'ecran par l'arriere-plan, un peu
 * plus tard, quand le rectangle sera dessine.
 *
 * Aucune capture n'est faite ici : le rectangle se dessine SUR la page, et
 * c'est la zone choisie qui sera photographiee.
 */
/** Enregistre l'activation du Scan et met a jour le bouton. */
function setOcrEnabled(enabled) {
  ocrEnabled = enabled === true;

  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ 'uniconv.ocrEnabled': ocrEnabled });
    }
  } catch (error) {
    // Stockage indisponible : le changement reste en memoire.
  }

  const button = document.getElementById('ocr-button');
  if (button) {
    button.disabled = !ocrEnabled;
    button.title = ocrEnabled
      ? 'Scanner une zone de l\'ecran'
      : 'Scan desactive dans les reglages';
  }

  const status = document.getElementById('ocr-status');
  if (status) {
    status.textContent = ocrEnabled ? '' : 'Scan desactive.';
  }
}

/** Lit le reglage « Activer le Scan » et adapte le bouton. */
function loadOcrEnabled() {
  try {
    if (!chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.get('uniconv.ocrEnabled', function (result) {
      if (chrome.runtime.lastError) {
        return;
      }
      ocrEnabled = !result || result['uniconv.ocrEnabled'] !== false;

      const toggle = document.getElementById('ocr-enabled-popup');
      if (toggle) {
        toggle.checked = ocrEnabled;
      }

      const button = document.getElementById('ocr-button');
      if (button) {
        button.disabled = !ocrEnabled;
        button.title = ocrEnabled
          ? 'Scanner une zone de l\'ecran'
          : 'Scan desactive dans les reglages';
      }
      const status = document.getElementById('ocr-status');
      if (status && !ocrEnabled) {
        status.textContent = 'Scan desactive dans les reglages.';
      }
    });
  } catch (error) {
    // Stockage indisponible : on laisse le Scan actif.
  }
}

function startOcrCapture() {
  const status = document.getElementById('ocr-status');
  const button = document.getElementById('ocr-button');

  const say = function (message) {
    if (status) {
      status.textContent = message;
    }
  };

  if (!ocrEnabled) {
    say('Scan desactive dans les reglages.');
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0] ? tabs[0] : null;

    if (!tab || typeof tab.id !== 'number') {
      say('Onglet introuvable : impossible de demarrer ici.');
      return;
    }

    if (button) {
      button.disabled = true;
    }
    say('Preparation…');

    chrome.tabs.sendMessage(tab.id, { type: 'start-ocr-selection' }, function (response) {
      if (chrome.runtime.lastError) {
        // Cas classique : la page etait ouverte avant l'installation ou le
        // rechargement de l'extension, donc le script n'y est pas encore.
        say('Page non prete : rechargez-la (Cmd+R), puis reessayez.');
        if (button) {
          button.disabled = false;
        }
        return;
      }

      if (!response || response.ok !== true) {
        // La page renvoie la raison exacte (pause, site exclu, erreur) : on
        // l'affiche telle quelle plutot qu'un message vague.
        const reason = response && response.error ? response.error : 'raison inconnue';
        say(`Non demarre : ${reason}.`);
        if (button) {
          button.disabled = false;
        }
        return;
      }

      // La selection se passe dans la page : le popup a fini son travail.
      window.close();
    });
  });
}

/**
 * Affiche les statistiques de l'OCR automatique (iteration 10).
 *
 * L'utilisateur voit ainsi combien d'images ont ete analysees, combien ont ete
 * ignorees, et le temps moyen : de quoi juger si l'option lui coute cher.
 */
/**
 * Demarrage du popup.
 *
 * « DOMContentLoaded » = l'evenement qui se declenche quand la structure HTML
 * est entierement construite. Avant, les elements n'existent pas encore.
 */
document.addEventListener('DOMContentLoaded', function () {
  setText('version', `version ${UNICONV_VERSION}`);

  const button = document.getElementById('refresh-rates');
  if (button) {
    button.addEventListener('click', function () {
      refreshRatesPanel(true);
    });
  }

  const metricButton = document.getElementById('units-metric');
  const imperialButton = document.getElementById('units-imperial');
  if (metricButton) {
    metricButton.addEventListener('click', function () {
      setUnitSystem('metric');
    });
  }
  if (imperialButton) {
    imperialButton.addEventListener('click', function () {
      setUnitSystem('imperial');
    });
  }

  // Iteration 9 : capture de l'onglet puis page de lecture OCR.
  const ocrButton = document.getElementById('ocr-button');
  if (ocrButton) {
    ocrButton.addEventListener('click', function () {
      startOcrCapture();
    });
  }

  const tutorialButton = document.getElementById('open-tutorial');
  if (tutorialButton) {
    tutorialButton.addEventListener('click', function () {
      try {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/tutorial.html') });
      } catch (error) {
        console.warn('[UniConv] popup : impossible d\'ouvrir le tutoriel');
      }
    });
  }

  // Iteration 8 : acces direct a la page de reglages.
  const optionsButton = document.getElementById('open-options');
  if (optionsButton) {
    optionsButton.addEventListener('click', function () {
      try {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      } catch (error) {
        console.warn('[UniConv] popup : impossible d\'ouvrir les reglages');
      }
    });
  }

  const detectionToggle = document.getElementById('detection-enabled');
  if (detectionToggle) {
    detectionToggle.addEventListener('change', function () {
      setPaused(!detectionToggle.checked);
    });
  }

  if (window.UniConvI18n) {
    UniConvI18n.applyCurrent();
  }

  loadOcrEnabled();

  const scanToggle = document.getElementById('ocr-enabled-popup');
  if (scanToggle) {
    scanToggle.addEventListener('change', function () {
      setOcrEnabled(scanToggle.checked);
    });
  }

  UniConvConverter.initConverter();
  refreshGuardState();
  initReferenceCard();
  refreshUnitSystemButtons();
  refreshScanStats();
  refreshRatesPanel(false);
});
