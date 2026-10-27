/**
 * ============================================================================
 *  UniConv — src/converter.js
 * ============================================================================
 *
 *  Convertisseur partage par le popup et la page autonome ouverte par le
 *  raccourci clavier. Le champ de montant est le meme dans les deux cas.
 *
 *  Ce fichier est charge AVANT popup.js (voir popup.html) et avant
 *  converter-page.js (voir converter.html).
 */

'use strict';

const CONVERTER_MESSAGE_TIMEOUT_MS = 7000;

function converterSendMessage(message) {
  return new Promise(function (resolve) {
    let settled = false;

    const timeoutId = setTimeout(function () {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, CONVERTER_MESSAGE_TIMEOUT_MS);

    try {
      chrome.runtime.sendMessage(message, function (response) {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response || null);
      });
    } catch (error) {
      settled = true;
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}

/**
 * Unites du convertisseur du popup.
 *
 * Sous-ensemble des unites de content.js. Le test `popup-tests` verifie que
 * chaque token existe dans content.js avec le MEME facteur : impossible de
 * faire diverger les deux tables sans qu'un test echoue.
 */
const POPUP_UNIT_GROUPS = [
  {
    id: 'length',
    label: 'Longueur',
    units: [
      { token: 'm', label: 'metre (m)', factor: 1 },
      { token: 'km', label: 'kilometre (km)', factor: 1000 },
      { token: 'cm', label: 'centimetre (cm)', factor: 0.01 },
      { token: 'mm', label: 'millimetre (mm)', factor: 0.001 },
      { token: 'mi', label: 'mile (mi)', factor: 1609.344 },
      { token: 'yd', label: 'yard (yd)', factor: 0.9144 },
      { token: 'ft', label: 'pied (ft)', factor: 0.3048 },
      { token: 'in', label: 'pouce (in)', factor: 0.0254 },
      { token: 'nmi', label: 'mille marin (nmi)', factor: 1852 }
    ]
  },
  {
    id: 'weight',
    label: 'Poids',
    units: [
      { token: 'kg', label: 'kilogramme (kg)', factor: 1 },
      { token: 'g', label: 'gramme (g)', factor: 0.001 },
      { token: 'mg', label: 'milligramme (mg)', factor: 0.000001 },
      { token: 'tonne', label: 'tonne (t)', factor: 1000 },
      { token: 'lb', label: 'livre (lb)', factor: 0.45359237 },
      { token: 'oz', label: 'once (oz)', factor: 0.028349523125 },
      { token: 'st', label: 'stone (st)', factor: 6.35029318 }
    ]
  },
  {
    id: 'volume',
    label: 'Volume',
    units: [
      { token: 'L', label: 'litre (L)', factor: 1 },
      { token: 'ml', label: 'millilitre (ml)', factor: 0.001 },
      { token: 'cl', label: 'centilitre (cl)', factor: 0.01 },
      { token: 'dl', label: 'decilitre (dl)', factor: 0.1 },
      { token: 'gal', label: 'gallon US (gal)', factor: 3.785411784 },
      { token: 'qt', label: 'quart US (qt)', factor: 0.946352946 },
      { token: 'pt', label: 'pinte US (pt)', factor: 0.473176473 },
      { token: 'cup', label: 'tasse US (cup)', factor: 0.2365882365 },
      { token: 'fl oz', label: 'once liquide (fl oz)', factor: 0.0295735295625 },
      { token: 'tsp', label: 'cuillere a cafe (tsp)', factor: 0.00492892159375 },
      { token: 'tbsp', label: 'cuillere a soupe (tbsp)', factor: 0.01478676478125 }
    ]
  },
  {
    id: 'speed',
    label: 'Vitesse',
    units: [
      { token: 'km/h', label: 'km/h', factor: 1 },
      { token: 'm/s', label: 'm/s', factor: 3.6 },
      { token: 'mph', label: 'mph', factor: 1.609344 },
      { token: 'kn', label: 'noeud (kn)', factor: 1.852 }
    ]
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      { token: '°C', label: 'Celsius (°C)', factor: null },
      { token: '°F', label: 'Fahrenheit (°F)', factor: null },
      { token: 'K', label: 'Kelvin (K)', factor: null }
    ]
  }
];

/** Dernieres devises recues de l'arriere-plan. */
let converterCurrencyCodes = [];
let converterRequestId = 0;
let converterTimer = null;
let currencyNames = null;

/** Scan active (reglage « uniconv.ocrEnabled »). */
let ocrEnabled = true;

/** Formatage court des nombres du convertisseur. */
function formatConverterNumber(value) {
  if (!Number.isFinite(value)) {
    return '\u2014';
  }
  try {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 4
    }).format(value);
  } catch (error) {
    return String(value);
  }
}

/** Noms de devises via Intl, avec repli sur le code. */
function currencyDisplayNames() {
  if (currencyNames === null) {
    try {
      currencyNames = new Intl.DisplayNames(['fr'], { type: 'currency' });
    } catch (error) {
      currencyNames = false;
    }
  }
  return currencyNames || null;
}

/** Remplit les listes de devises (sans perdre la selection). */
function populateCurrencySelects(codes) {
  const from = document.getElementById('conv-from');
  const to = document.getElementById('conv-to');
  if (!from || !to) {
    return;
  }

  let list = Array.isArray(codes) ? codes.filter((code) => /^[A-Z]{3}$/.test(code)) : [];
  list = Array.from(new Set(list)).sort();

  if (list.length === 0) {
    list = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'];
  }

  converterCurrencyCodes = list;
  const previousFrom = from.value;
  const previousTo = to.value;
  const names = currencyDisplayNames();

  from.textContent = '';
  to.textContent = '';

  for (const code of list) {
    let name = code;
    if (names) {
      try {
        name = names.of(code) || code;
      } catch (error) {
        name = code;
      }
    }
    const label = `${code} \u2014 ${name}`;

    const fromOption = document.createElement('option');
    fromOption.value = code;
    fromOption.textContent = label;
    from.appendChild(fromOption);

    const toOption = document.createElement('option');
    toOption.value = code;
    toOption.textContent = label;
    to.appendChild(toOption);
  }

  from.value = list.includes(previousFrom) ? previousFrom : (list.includes('EUR') ? 'EUR' : list[0]);
  to.value = list.includes(previousTo) ? previousTo : (list.includes('USD') ? 'USD' : list[0]);
}

/** Groupe d'unites par identifiant. */
function converterUnitGroup(id) {
  return POPUP_UNIT_GROUPS.find((group) => group.id === id) || null;
}

/** Convertit une valeur entre deux unites (temperature a part). */
function convertPopupUnit(value, categoryId, fromToken, toToken) {
  const group = converterUnitGroup(categoryId);
  if (!group) {
    return null;
  }

  const from = group.units.find((unit) => unit.token === fromToken);
  const to = group.units.find((unit) => unit.token === toToken);
  if (!from || !to) {
    return null;
  }

  if (group.id !== 'temperature') {
    return value * from.factor / to.factor;
  }

  let celsius;
  if (from.token === '°C') {
    celsius = value;
  } else if (from.token === '°F') {
    celsius = (value - 32) * 5 / 9;
  } else if (from.token === 'K') {
    celsius = value - 273.15;
  } else {
    return null;
  }

  if (to.token === '°C') {
    return celsius;
  }
  if (to.token === '°F') {
    return celsius * 9 / 5 + 32;
  }
  if (to.token === 'K') {
    return celsius + 273.15;
  }
  return null;
}

/** Remplit les listes d'unites pour une categorie. */
function populateUnitSelects(categoryId) {
  const group = converterUnitGroup(categoryId);
  const from = document.getElementById('unit-from');
  const to = document.getElementById('unit-to');
  if (!group || !from || !to) {
    return;
  }

  const defaults = {
    length: ['m', 'ft'],
    weight: ['kg', 'lb'],
    volume: ['L', 'gal'],
    speed: ['km/h', 'mph'],
    temperature: ['°C', '°F']
  }[group.id] || [group.units[0].token, group.units[1].token];

  from.textContent = '';
  to.textContent = '';

  for (const unit of group.units) {
    const fromOption = document.createElement('option');
    fromOption.value = unit.token;
    fromOption.textContent = unit.label;
    from.appendChild(fromOption);

    const toOption = document.createElement('option');
    toOption.value = unit.token;
    toOption.textContent = unit.label;
    to.appendChild(toOption);
  }

  from.value = defaults[0];
  to.value = defaults[1];
}

/** Remplit la liste des categories. */
function populateUnitCategories() {
  const select = document.getElementById('unit-category');
  if (!select) {
    return;
  }

  select.textContent = '';
  for (const group of POPUP_UNIT_GROUPS) {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.label;
    select.appendChild(option);
  }
  select.value = 'length';
}

/** Met a jour le resultat du convertisseur d'unites. */
function refreshUnitConversion() {
  const amountElement = document.getElementById('unit-amount');
  const categoryElement = document.getElementById('unit-category');
  const fromElement = document.getElementById('unit-from');
  const toElement = document.getElementById('unit-to');
  const resultElement = document.getElementById('unit-result');

  if (!amountElement || !categoryElement || !fromElement || !toElement || !resultElement) {
    return;
  }

  const amount = Number(String(amountElement.value).replace(',', '.'));
  if (!Number.isFinite(amount)) {
    resultElement.textContent = '\u2014';
    return;
  }

  const converted = convertPopupUnit(
    amount,
    categoryElement.value,
    fromElement.value,
    toElement.value
  );

  if (converted === null || !Number.isFinite(converted)) {
    resultElement.textContent = '\u2014';
    return;
  }

  resultElement.textContent = `${formatConverterNumber(converted)} ${toElement.value}`;
}

/** Met a jour le resultat du convertisseur de devises. */
function refreshCurrencyConversion() {
  const amountElement = document.getElementById('conv-amount');
  const fromElement = document.getElementById('conv-from');
  const toElement = document.getElementById('conv-to');
  const resultElement = document.getElementById('conv-result');
  const detailElement = document.getElementById('conv-detail');

  if (!amountElement || !fromElement || !toElement || !resultElement) {
    return;
  }

  const amount = Number(String(amountElement.value).replace(',', '.'));
  const from = fromElement.value;
  const to = toElement.value;

  if (!Number.isFinite(amount) || amount < 0 || !from || !to) {
    resultElement.textContent = '\u2014';
    if (detailElement) {
      detailElement.textContent = '';
    }
    return;
  }

  if (from === to) {
    resultElement.textContent = `${formatConverterNumber(amount)} ${to}`;
    if (detailElement) {
      detailElement.textContent = '';
    }
    return;
  }

  const requestId = ++converterRequestId;
  resultElement.textContent = '\u2026';
  if (detailElement) {
    detailElement.textContent = '';
  }

  converterSendMessage({ type: 'convert', amount: amount, from: from, to: to })
    .then(function (response) {
      if (requestId !== converterRequestId) {
        return;
      }

      if (!response || response.ok !== true) {
        resultElement.textContent = 'Taux indisponible';
        if (detailElement) {
          detailElement.textContent = response && response.error
            ? String(response.error)
            : '';
        }
        return;
      }

      resultElement.textContent = `${formatConverterNumber(response.value)} ${response.to}`;
      if (detailElement) {
        detailElement.textContent =
          `1 ${response.from} = ${formatConverterNumber(response.rate)} ${response.to}`;
      }
    });
}

/** Programme la conversion de devises (frappe rapide). */
function scheduleCurrencyConversion() {
  if (converterTimer) {
    clearTimeout(converterTimer);
  }
  converterTimer = setTimeout(refreshCurrencyConversion, 250);
}

/** Change l'onglet Devises / Unites. */
function setConverterTab(tab) {
  const isCurrency = tab === 'currency';
  const currencyTab = document.getElementById('tab-currency');
  const unitTab = document.getElementById('tab-unit');
  const currencyPane = document.getElementById('pane-currency');
  const unitPane = document.getElementById('pane-unit');

  if (currencyTab) {
    currencyTab.classList.toggle('active', isCurrency);
    currencyTab.setAttribute('aria-selected', isCurrency ? 'true' : 'false');
  }
  if (unitTab) {
    unitTab.classList.toggle('active', !isCurrency);
    unitTab.setAttribute('aria-selected', isCurrency ? 'false' : 'true');
  }
  if (currencyPane) {
    currencyPane.hidden = !isCurrency;
  }
  if (unitPane) {
    unitPane.hidden = isCurrency;
  }
}

/** Installe le convertisseur (appele au demarrage). */
function initConverter() {
  populateUnitCategories();
  populateUnitSelects('length');
  populateCurrencySelects([]);

  converterSendMessage({ type: 'rates-status' }).then(function (status) {
    if (status && status.ok === true &&
        Array.isArray(status.currencies) && status.currencies.length > 0) {
      populateCurrencySelects(status.currencies);
      refreshCurrencyConversion();
    }
  });

  const currencyTab = document.getElementById('tab-currency');
  const unitTab = document.getElementById('tab-unit');
  if (currencyTab) {
    currencyTab.addEventListener('click', function () { setConverterTab('currency'); });
  }
  if (unitTab) {
    unitTab.addEventListener('click', function () { setConverterTab('unit'); });
  }

  const convAmount = document.getElementById('conv-amount');
  const convFrom = document.getElementById('conv-from');
  const convTo = document.getElementById('conv-to');
  const convSwap = document.getElementById('conv-swap');

  if (convAmount) {
    convAmount.addEventListener('input', scheduleCurrencyConversion);
  }
  if (convFrom) {
    convFrom.addEventListener('change', refreshCurrencyConversion);
  }
  if (convTo) {
    convTo.addEventListener('change', refreshCurrencyConversion);
  }
  if (convSwap) {
    convSwap.addEventListener('click', function () {
      const from = document.getElementById('conv-from');
      const to = document.getElementById('conv-to');
      if (!from || !to) {
        return;
      }
      const previous = from.value;
      from.value = to.value;
      to.value = previous;
      refreshCurrencyConversion();
    });
  }

  const unitAmount = document.getElementById('unit-amount');
  const unitCategory = document.getElementById('unit-category');
  const unitFrom = document.getElementById('unit-from');
  const unitTo = document.getElementById('unit-to');
  const unitSwap = document.getElementById('unit-swap');

  if (unitAmount) {
    unitAmount.addEventListener('input', refreshUnitConversion);
  }
  if (unitCategory) {
    unitCategory.addEventListener('change', function () {
      populateUnitSelects(unitCategory.value);
      refreshUnitConversion();
    });
  }
  if (unitFrom) {
    unitFrom.addEventListener('change', refreshUnitConversion);
  }
  if (unitTo) {
    unitTo.addEventListener('change', refreshUnitConversion);
  }
  if (unitSwap) {
    unitSwap.addEventListener('click', function () {
      const from = document.getElementById('unit-from');
      const to = document.getElementById('unit-to');
      if (!from || !to) {
        return;
      }
      const previous = from.value;
      from.value = to.value;
      to.value = previous;
      refreshUnitConversion();
    });
  }

  refreshUnitConversion();
  refreshCurrencyConversion();
}


window.UniConvConverter = {
  initConverter: initConverter,
  populateCurrencySelects: populateCurrencySelects,
  refreshCurrencyConversion: refreshCurrencyConversion
};
