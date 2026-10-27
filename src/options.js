/**
 * ============================================================================
 *  UniConv — src/options.js
 *  Version 1.0.0 — page de reglages
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Faire fonctionner la page de reglages (src/options.html).
 *
 *  PRINCIPE
 *  --------
 *  Pas de bouton « Enregistrer » : chaque modification est ecrite tout de
 *  suite dans le stockage du navigateur, et le script des pages (content.js)
 *  la voit immediatement grace a un ecouteur de changements.
 *
 *  OU SONT STOCKES LES REGLAGES
 *  ----------------------------
 *  Dans le stockage du navigateur (chrome.storage.local), et NON dans les
 *  fichiers du dossier : modifier un fichier ne change donc pas un reglage
 *  deja enregistre.
 */

'use strict';

/** Version affichee en haut de la page. */
const UNICONV_VERSION = '2.9.7';

/**
 * Valeurs par defaut de TOUS les reglages.
 *
 * Elles servent de reference : la remise a zero les reinstalle, et un reglage
 * absent est considere comme ayant sa valeur par defaut.
 */
const DEFAULTS = {
  'uniconv.targetCurrency': 'USD',
  'uniconv.unitSystem': 'metric',
  'uniconv.language': 'auto',
  'uniconv.detectCurrencies': true,
  'uniconv.detectUnits': true,
  'uniconv.detectTimezones': true,
  'uniconv.targetTimezone': '',
  'uniconv.timeFormat': 'auto',
  'uniconv.hoverDelay': 0,
  'uniconv.theme': 'dark',
  'uniconv.ocrEnabled': true,
  'uniconv.blacklist': []
};

/** Toutes les cles de reglages (pour l'export et la remise a zero). */
const SETTING_KEYS = Object.keys(DEFAULTS);

/**
 * Villes proposees dans la page de reglages.
 *
 * La liste COMPLETE (132 villes) vit dans src/content.js, avec le menu de la
 * bulle. Ici, on se limite aux principales : la page de reglages doit rester
 * simple, et le menu de la bulle permet de choisir n'importe quelle ville.
 * Un choix fait dans la bulle et absent de cette liste est ajoute a la volee.
 */
const TIMEZONE_CHOICES = [
  { id: 'Europe/Paris', label: 'Paris' },
  { id: 'Europe/London', label: 'Londres' },
  { id: 'Europe/Brussels', label: 'Bruxelles' },
  { id: 'Europe/Zurich', label: 'Geneve' },
  { id: 'Europe/Madrid', label: 'Madrid' },
  { id: 'Europe/Lisbon', label: 'Lisbonne' },
  { id: 'Europe/Rome', label: 'Rome' },
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Europe/Amsterdam', label: 'Amsterdam' },
  { id: 'Europe/Vienna', label: 'Vienne' },
  { id: 'Europe/Stockholm', label: 'Stockholm' },
  { id: 'Europe/Moscow', label: 'Moscou' },
  { id: 'Europe/Istanbul', label: 'Istanbul' },
  { id: 'Africa/Casablanca', label: 'Casablanca' },
  { id: 'Africa/Algiers', label: 'Alger' },
  { id: 'Africa/Tunis', label: 'Tunis' },
  { id: 'Africa/Cairo', label: 'Le Caire' },
  { id: 'Africa/Dakar', label: 'Dakar' },
  { id: 'Africa/Abidjan', label: 'Abidjan' },
  { id: 'Africa/Johannesburg', label: 'Johannesburg' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'America/Chicago', label: 'Chicago' },
  { id: 'America/Denver', label: 'Denver' },
  { id: 'America/Los_Angeles', label: 'Los Angeles' },
  { id: 'America/Toronto', label: 'Toronto' },
  { id: 'America/Vancouver', label: 'Vancouver' },
  { id: 'America/Mexico_City', label: 'Mexico' },
  { id: 'America/Sao_Paulo', label: 'Sao Paulo' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Asia/Shanghai', label: 'Shanghai' },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { id: 'Asia/Singapore', label: 'Singapour' },
  { id: 'Asia/Kolkata', label: 'Mumbai' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Asia/Bangkok', label: 'Bangkok' },
  { id: 'Australia/Sydney', label: 'Sydney' },
  { id: 'Australia/Melbourne', label: 'Melbourne' },
  { id: 'Pacific/Auckland', label: 'Auckland' },
  { id: 'Pacific/Tahiti', label: 'Papeete' },
  { id: 'Pacific/Noumea', label: 'Noumea' }
];

// ===========================================================================
//  1. VALIDATION (fonctions pures, testables sans navigateur)
// ===========================================================================

/**
 * Nettoie un nom de domaine saisi par l'utilisateur.
 *
 * On accepte les formes fautives courantes et on les corrige :
 *   « https://WWW.Example.COM/page »  ->  « www.example.com »
 *   « .example.com »                  ->  « example.com »
 *
 * @param {string} raw
 * @returns {string} le domaine nettoye, ou une chaine vide si inutilisable
 */
function normalizeHost(raw) {
  let value = String(raw === undefined || raw === null ? '' : raw).trim();

  if (value === '') {
    return '';
  }

  // Protocole eventuel (« https:// »).
  value = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');

  // Tout ce qui suit le premier « / », « ? » ou « # » n'est pas le domaine.
  value = value.split(/[/?#]/)[0];

  // Identifiants de connexion eventuels (« user@exemple.com »).
  const at = value.lastIndexOf('@');
  if (at !== -1) {
    value = value.slice(at + 1);
  }

  // Port eventuel (« exemple.com:8080 »).
  value = value.replace(/:\d+$/, '');

  value = value.toLowerCase();

  // Points superflus au debut et a la fin.
  value = value.replace(/^\.+/, '').replace(/\.+$/, '');

  return value;
}

/**
 * Vrai si la chaine est un nom de domaine plausible.
 *
 * Regles : au moins un point, des lettres/chiffres/tirets, un suffixe de
 * 2 lettres ou plus, pas d'espace. On refuse volontairement « localhost »
 * seul (trop permissif) : pour un test local, on ecrira « localhost » quand
 * meme — voir la note ci-dessous.
 */
function isValidHost(host) {
  if (typeof host !== 'string' || host === '') {
    return false;
  }

  if (/\s/.test(host)) {
    return false;
  }

  // Cas particulier du developpement local, accepte explicitement.
  if (host === 'localhost') {
    return true;
  }

  // Une adresse IP n'a pas de sens ici (on ne peut pas exclure « une IP »).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return false;
  }

  return /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host);
}

/** Vrai si le domaine est deja dans la liste. */
function isDuplicateHost(list, host) {
  return Array.isArray(list) && list.indexOf(host) !== -1;
}

/** Texte affiche a cote du curseur de delai. */
function formatDelayLabel(milliseconds) {
  const value = Number(milliseconds);

  if (!Number.isFinite(value) || value <= 0) {
    return 'immédiat';
  }

  return `${Math.round(value)} ms`;
}

/**
 * Lit un texte JSON d'import et retourne les reglages valides qu'il contient.
 *
 * On ne fait JAMAIS confiance au contenu : chaque valeur est verifiee. Une
 * valeur invalide est ignoree (et signalee), jamais appliquee telle quelle.
 *
 * @param {string} text
 * @returns {{settings: object, errors: string[]}}
 */
function parseSettingsJson(text) {
  const settings = {};
  const errors = [];

  const raw = String(text === undefined || text === null ? '' : text).trim();

  if (raw === '') {
    return { settings: settings, errors: ['Le texte est vide.'] };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { settings: settings, errors: [`JSON invalide : ${error.message}`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { settings: settings, errors: ['Le contenu doit être un objet JSON.'] };
  }

  for (const key of SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
      continue;
    }

    const value = parsed[key];

    if (key === 'uniconv.blacklist') {
      if (!Array.isArray(value)) {
        errors.push('« uniconv.blacklist » doit être une liste.');
        continue;
      }
      const hosts = value
        .map((entry) => normalizeHost(entry))
        .filter((host) => isValidHost(host));
      settings[key] = Array.from(new Set(hosts));
      continue;
    }

    if (key === 'uniconv.detectCurrencies' || key === 'uniconv.detectUnits' ||
        key === 'uniconv.detectTimezones') {
      if (typeof value !== 'boolean') {
        errors.push(`« ${key} » doit être vrai ou faux.`);
        continue;
      }
      settings[key] = value;
      continue;
    }

    if (key === 'uniconv.targetTimezone') {
      if (typeof value !== 'string') {
        errors.push('« uniconv.targetTimezone » doit être un nom de fuseau.');
        continue;
      }
      if (value !== '') {
        let valid = false;
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
          valid = true;
        } catch (validationError) {
          valid = false;
        }
        if (!valid) {
          errors.push(`« ${value} » n'est pas un fuseau horaire connu.`);
          continue;
        }
      }
      settings[key] = value;
      continue;
    }

    if (key === 'uniconv.hoverDelay') {
      const delay = Number(value);
      if (!Number.isFinite(delay) || delay < 0 || delay > 1500) {
        errors.push('« uniconv.hoverDelay » doit être un nombre entre 0 et 1500.');
        continue;
      }
      settings[key] = Math.round(delay);
      continue;
    }

    // Champs a choix ferme.
    const allowed = {
      'uniconv.unitSystem': ['metric', 'imperial'],
      'uniconv.language': ['fr', 'en', 'es', 'ru', 'zh', 'ar', 'auto'],
      'uniconv.theme': ['light', 'dark', 'auto']
    };

    if (allowed[key]) {
      if (allowed[key].indexOf(value) === -1) {
        errors.push(`« ${key} » n'accepte pas la valeur « ${String(value)} ».`);
        continue;
      }
      settings[key] = value;
      continue;
    }

    if (key === 'uniconv.targetCurrency') {
      if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value)) {
        errors.push('« uniconv.targetCurrency » doit être un code à 3 lettres.');
        continue;
      }
      settings[key] = value.toUpperCase();
      continue;
    }

    settings[key] = value;
  }

  if (Object.keys(settings).length === 0 && errors.length === 0) {
    errors.push('Aucun réglage UniConv reconnu dans ce texte.');
  }

  return { settings: settings, errors: errors };
}

// ===========================================================================
//  2. ACCES AU STOCKAGE
// ===========================================================================

/** Lit un ou plusieurs reglages. */
function readSettings(keys) {
  return new Promise(function (resolve) {
    try {
      chrome.storage.local.get(keys, function (result) {
        resolve(result || {});
      });
    } catch (error) {
      resolve({});
    }
  });
}

/** Ecrit des reglages. */
function writeSettings(values) {
  return new Promise(function (resolve) {
    try {
      chrome.storage.local.set(values, function () {
        resolve(true);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

/** Supprime des cles du stockage. */
function removeSettings(keys) {
  return new Promise(function (resolve) {
    try {
      chrome.storage.local.remove(keys, function () {
        resolve(true);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

// ===========================================================================
//  3. INTERFACE
// ===========================================================================

/** Etat local de la page (reflet des reglages enregistres). */
const state = {
  settings: Object.assign({}, DEFAULTS),
  blacklist: []
};

/** Affiche la barre « Enregistré » pendant un court instant. */
let statusTimer = null;

function flashStatus(message) {
  const bar = document.getElementById('status-bar');
  if (!bar) {
    return;
  }

  bar.textContent = message || 'Enregistré';
  bar.classList.add('visible');

  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  statusTimer = setTimeout(function () {
    bar.classList.remove('visible');
  }, 1300);
}

/** Enregistre un reglage et previent l'utilisateur. */
function save(key, value) {
  state.settings[key] = value;

  const values = {};
  values[key] = value;

  writeSettings(values).then(function (ok) {
    flashStatus(ok ? 'Enregistré' : 'Échec de l\'enregistrement');
  });
}

/** Met a jour l'etat visuel d'un groupe de boutons segmentes. */
function renderSegmented(containerId, value) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  for (const button of container.querySelectorAll('button')) {
    const active = button.getAttribute('data-value') === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

/** Branche un groupe de boutons segmentes sur un reglage. */
function setupSegmented(containerId, key) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.addEventListener('click', function (event) {
    const button = event.target.closest
      ? event.target.closest('button')
      : null;

    if (!button) {
      return;
    }

    const value = button.getAttribute('data-value');
    if (!value) {
      return;
    }

    save(key, value);
    renderSegmented(containerId, value);
  });
}

// --- Devise cible ---------------------------------------------------------

/** Nombre de devises disponibles, pour l'aide sous le champ. */
let availableCurrencies = [];

/** Nom lisible d'une devise, sans maintenir une table a la main. */
function currencyName(code) {
  try {
    if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
      const names = new Intl.DisplayNames(['fr'], { type: 'currency' });
      const name = names.of(code);
      if (name && name !== code) {
        return name;
      }
    }
  } catch (error) {
    // Pas de support : on affichera le code seul.
  }
  return '';
}

/** Remplit la liste deroulante des devises. */
function renderCurrencyOptions(filter) {
  const select = document.getElementById('target-currency');
  if (!select) {
    return;
  }

  const needle = String(filter || '').trim().toLowerCase();

  select.textContent = '';

  for (const code of availableCurrencies) {
    const name = currencyName(code);
    const label = name ? `${code} — ${name}` : code;

    if (needle) {
      const haystack = `${code} ${name}`.toLowerCase();
      if (haystack.indexOf(needle) === -1) {
        continue;
      }
    }

    const option = document.createElement('option');
    option.value = code;
    option.textContent = label;
    option.selected = code === state.settings['uniconv.targetCurrency'];
    select.appendChild(option);
  }
}

/** Charge la liste des devises aupres de l'arriere-plan. */
function loadCurrencies() {
  return new Promise(function (resolve) {
    try {
      chrome.runtime.sendMessage({ type: 'rates-status' }, function (response) {
        if (chrome.runtime.lastError || !response || !Array.isArray(response.currencies)) {
          resolve();
          return;
        }

        availableCurrencies = response.currencies.slice().sort();
        resolve();
      });
    } catch (error) {
      resolve();
    }
  });
}

// --- Liste noire ---------------------------------------------------------

/** Affiche la liste des sites exclus. */
function renderBlacklist() {
  const list = document.getElementById('blacklist-list');
  if (!list) {
    return;
  }

  list.textContent = '';

  if (state.blacklist.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Aucun site exclu pour le moment.';
    list.appendChild(empty);
    return;
  }

  for (const host of state.blacklist) {
    const item = document.createElement('li');

    const label = document.createElement('span');
    label.textContent = host;
    item.appendChild(label);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '\u00D7';
    remove.title = `Ne plus exclure ${host}`;
    remove.setAttribute('data-host', host);
    item.appendChild(remove);

    list.appendChild(item);
  }
}

/** Ajoute un site a la liste noire, avec validation. */
function addHost(rawValue) {
  const message = document.getElementById('blacklist-message');
  const host = normalizeHost(rawValue);

  if (host === '') {
    if (message) {
      message.className = 'message error';
      message.textContent = 'Saisissez un nom de domaine (exemple.com).';
    }
    return;
  }

  if (!isValidHost(host)) {
    if (message) {
      message.className = 'message error';
      message.textContent =
        `« ${host} » n'est pas un domaine valide. Essayez « exemple.com ».`;
    }
    return;
  }

  if (isDuplicateHost(state.blacklist, host)) {
    if (message) {
      message.className = 'message error';
      message.textContent = `« ${host} » est déjà dans la liste.`;
    }
    return;
  }

  state.blacklist = state.blacklist.concat([host]);
  save('uniconv.blacklist', state.blacklist);
  renderBlacklist();

  const input = document.getElementById('blacklist-input');
  if (input) {
    input.value = '';
    input.focus();
  }

  if (message) {
    message.className = 'message ok';
    message.textContent = `« ${host} » est désormais exclu.`;
  }
}

/** Retire un site de la liste noire. */
function removeHost(host) {
  state.blacklist = state.blacklist.filter((entry) => entry !== host);
  save('uniconv.blacklist', state.blacklist);
  renderBlacklist();

  const message = document.getElementById('blacklist-message');
  if (message) {
    message.className = 'message ok';
    message.textContent = `« ${host} » n'est plus exclu.`;
  }
}

// --- Export / import -----------------------------------------------------

/** Construit le texte JSON des reglages actuels. */
function buildExportText() {
  const payload = {};

  for (const key of SETTING_KEYS) {
    payload[key] = state.settings[key];
  }

  return JSON.stringify(payload, null, 2);
}

/** Applique le texte d'import. */
function applyImport() {
  const zone = document.getElementById('export-zone');
  const message = document.getElementById('import-message');
  if (!zone) {
    return;
  }

  const result = parseSettingsJson(zone.value);

  if (Object.keys(result.settings).length === 0) {
    if (message) {
      message.className = 'message error';
      message.textContent = result.errors.join(' ');
    }
    return;
  }

  writeSettings(result.settings).then(function () {
    applyToUi(Object.assign({}, state.settings, result.settings));

    if (message) {
      message.className = result.errors.length ? 'message error' : 'message ok';
      message.textContent = result.errors.length
        ? `Importé, avec des valeurs ignorées : ${result.errors.join(' ')}`
        : 'Réglages importés.';
    }

    flashStatus('Réglages importés');
  });
}

// --- Application a l'interface ------------------------------------------

/** Remplit la liste des villes de reference. */
function renderTimezoneOptions() {
  const select = document.getElementById('target-timezone');
  if (!select) {
    return;
  }

  const current = state.settings['uniconv.targetTimezone'] || '';
  select.textContent = '';

  const local = document.createElement('option');
  local.value = '';
  local.textContent = 'Ma ville (fuseau du systeme)';
  select.appendChild(local);

  for (const choice of TIMEZONE_CHOICES) {
    const option = document.createElement('option');
    option.value = choice.id;
    option.textContent = `${choice.label} (${choice.id.replace(/_/g, ' ')})`;
    select.appendChild(option);
  }

  // Un choix fait dans le menu de la bulle peut ne pas figurer dans la liste
  // courte : on l'ajoute pour ne pas le perdre silencieusement.
  if (current !== '' && !TIMEZONE_CHOICES.some(function (choice) {
    return choice.id === current;
  })) {
    const extra = document.createElement('option');
    extra.value = current;
    extra.textContent = current;
    select.appendChild(extra);
  }

  select.value = current;
}

/** Reporte l'etat des reglages dans les champs de la page. */
function applyToUi(settings) {
  state.settings = Object.assign({}, state.settings, settings);
  state.blacklist = Array.isArray(state.settings['uniconv.blacklist'])
    ? state.settings['uniconv.blacklist'].slice()
    : [];

  renderSegmented('unit-system', state.settings['uniconv.unitSystem']);
  renderSegmented('language', state.settings['uniconv.language']);
  renderSegmented('theme', state.settings['uniconv.theme']);

  const currenciesToggle = document.getElementById('detect-currencies');
  if (currenciesToggle) {
    currenciesToggle.checked = state.settings['uniconv.detectCurrencies'] !== false;
  }

  const unitsToggle = document.getElementById('detect-units');
  if (unitsToggle) {
    unitsToggle.checked = state.settings['uniconv.detectUnits'] !== false;
  }

  const timezonesToggle = document.getElementById('detect-timezones');
  if (timezonesToggle) {
    timezonesToggle.checked = state.settings['uniconv.detectTimezones'] !== false;
  }

  renderSegmented('time-format', state.settings['uniconv.timeFormat'] || 'auto');
  renderTimezoneOptions();

  const ocrEnabledToggle = document.getElementById('ocr-enabled');
  if (ocrEnabledToggle) {
    ocrEnabledToggle.checked = state.settings['uniconv.ocrEnabled'] !== false;
  }

  const delay = document.getElementById('hover-delay');
  if (delay) {
    delay.value = String(state.settings['uniconv.hoverDelay'] || 0);
  }

  const delayLabel = document.getElementById('hover-delay-label');
  if (delayLabel) {
    delayLabel.textContent = formatDelayLabel(state.settings['uniconv.hoverDelay']);
  }

  renderCurrencyOptions(document.getElementById('target-search')
    ? document.getElementById('target-search').value
    : '');

  renderBlacklist();

  // La zone d'export reflete toujours les reglages courants (sauf pendant une
  // saisie d'import : on ne l'ecrase pas sous les doigts de l'utilisateur).
  const exportZone = document.getElementById('export-zone');
  if (exportZone && document.activeElement !== exportZone) {
    exportZone.value = buildExportText();
  }
}

// ===========================================================================
//  4. BRANCHEMENTS
// ===========================================================================

/** Branche tous les champs de la page. */
function setupControls() {
  setupSegmented('unit-system', 'uniconv.unitSystem');
  setupSegmented('language', 'uniconv.language');

  const languageGroup = document.getElementById('language');
  if (languageGroup) {
    languageGroup.addEventListener('click', function () {
      setTimeout(function () {
        if (window.UniConvI18n) {
          UniConvI18n.applyCurrent();
        }
      }, 0);
    });
  }
  setupSegmented('theme', 'uniconv.theme');

  const currenciesToggle = document.getElementById('detect-currencies');
  if (currenciesToggle) {
    currenciesToggle.addEventListener('change', function () {
      save('uniconv.detectCurrencies', currenciesToggle.checked);
    });
  }

  const unitsToggle = document.getElementById('detect-units');
  if (unitsToggle) {
    unitsToggle.addEventListener('change', function () {
      save('uniconv.detectUnits', unitsToggle.checked);
    });
  }

  const timezonesToggle = document.getElementById('detect-timezones');
  if (timezonesToggle) {
    timezonesToggle.addEventListener('change', function () {
      save('uniconv.detectTimezones', timezonesToggle.checked);
    });
  }

  setupSegmented('time-format', 'uniconv.timeFormat');

  const timezoneSelect = document.getElementById('target-timezone');
  if (timezoneSelect) {
    timezoneSelect.addEventListener('change', function () {
      save('uniconv.targetTimezone', timezoneSelect.value);
    });
  }

  const ocrEnabledToggle = document.getElementById('ocr-enabled');
  if (ocrEnabledToggle) {
    ocrEnabledToggle.addEventListener('change', function () {
      save('uniconv.ocrEnabled', ocrEnabledToggle.checked);
    });
  }

  const delay = document.getElementById('hover-delay');
  if (delay) {
    delay.addEventListener('input', function () {
      const value = Number(delay.value);
      const label = document.getElementById('hover-delay-label');
      if (label) {
        label.textContent = formatDelayLabel(value);
      }
      save('uniconv.hoverDelay', value);
    });
  }

  const targetSearch = document.getElementById('target-search');
  if (targetSearch) {
    targetSearch.addEventListener('input', function () {
      renderCurrencyOptions(targetSearch.value);
    });
  }

  const targetSelect = document.getElementById('target-currency');
  if (targetSelect) {
    targetSelect.addEventListener('change', function () {
      save('uniconv.targetCurrency', targetSelect.value);
    });
  }

  // Iteration 9 : test autonome du moteur OCR (diagnostic en un clic).
  const testOcr = document.getElementById('test-ocr');
  if (testOcr) {
    testOcr.addEventListener('click', function () {
      const message = document.getElementById('ocr-test-message');

      const say = function (text, kind) {
        if (message) {
          message.className = 'message ' + (kind || '');
          message.textContent = text;
        }
      };

      testOcr.disabled = true;
      say('Test en cours (le premier lancement charge le moteur)…');

      try {
        chrome.runtime.sendMessage({ type: 'engine-self-test' }, function (response) {
          testOcr.disabled = false;

          if (chrome.runtime.lastError) {
            say(`Échec : ${chrome.runtime.lastError.message}`, 'error');
            return;
          }

          if (!response || response.ok !== true) {
            say(`Échec du moteur : ${(response && response.error) || 'raison inconnue'}`, 'error');
            return;
          }

          const result = response.result || {};
          const lu = String(result.text || '').replace(/\s+/g, ' ').trim();
          const ok = /54/.test(lu);

          say(
            `${ok ? 'Moteur opérationnel' : 'Texte mal reconnu'} — lu : « ${lu} » ` +
            `(attendu « ${result.expected} »), confiance ${result.confidence} %, ` +
            `${(result.durationMs / 1000).toFixed(1)} s.`,
            ok ? 'ok' : 'error'
          );
        });
      } catch (error) {
        testOcr.disabled = false;
        say(`Envoi impossible : ${error.message}`, 'error');
      }
    });
  }

  const resetSize = document.getElementById('reset-size');
  if (resetSize) {
    resetSize.addEventListener('click', function () {
      removeSettings(['uniconv.tooltipSize']).then(function () {
        flashStatus('Taille de la bulle réinitialisée');
      });
    });
  }

  const blacklistAdd = document.getElementById('blacklist-add');
  if (blacklistAdd) {
    blacklistAdd.addEventListener('click', function () {
      const input = document.getElementById('blacklist-input');
      addHost(input ? input.value : '');
    });
  }

  const blacklistInput = document.getElementById('blacklist-input');
  if (blacklistInput) {
    blacklistInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        addHost(blacklistInput.value);
      }
    });
  }

  const blacklistList = document.getElementById('blacklist-list');
  if (blacklistList) {
    blacklistList.addEventListener('click', function (event) {
      const button = event.target.closest
        ? event.target.closest('button.remove')
        : null;
      if (button) {
        removeHost(button.getAttribute('data-host'));
      }
    });
  }

  const exportCopy = document.getElementById('export-copy');
  if (exportCopy) {
    exportCopy.addEventListener('click', function () {
      const zone = document.getElementById('export-zone');
      if (!zone) {
        return;
      }
      zone.select();
      try {
        document.execCommand('copy');
        flashStatus('Réglages copiés');
      } catch (error) {
        flashStatus('Copie impossible : sélectionnez puis Cmd+C');
      }
    });
  }

  const exportDownload = document.getElementById('export-download');
  if (exportDownload) {
    exportDownload.addEventListener('click', function () {
      const blob = new Blob([buildExportText()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'uniconv-reglages.json';
      link.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
      flashStatus('Fichier téléchargé');
    });
  }

  const importApply = document.getElementById('import-apply');
  if (importApply) {
    importApply.addEventListener('click', applyImport);
  }

  const resetAll = document.getElementById('reset-all');
  if (resetAll) {
    resetAll.addEventListener('click', function () {
      const confirmed = typeof window.confirm === 'function'
        ? window.confirm('Rétablir tous les réglages par défaut ?')
        : false;

      if (!confirmed) {
        return;
      }

      removeSettings(SETTING_KEYS).then(function () {
        applyToUi(Object.assign({}, DEFAULTS));

        const message = document.getElementById('reset-message');
        if (message) {
          message.className = 'message ok';
          message.textContent = 'Réglages rétablis.';
        }

        flashStatus('Réglages rétablis');
      });
    });
  }
}

/** Demarrage de la page. */
document.addEventListener('DOMContentLoaded', function () {
  const versionElement = document.getElementById('version');
  if (versionElement) {
    const tutorialButton = document.getElementById('open-tutorial');
  if (tutorialButton) {
    tutorialButton.addEventListener('click', function () {
      try {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/tutorial.html') });
      } catch (error) {
        console.warn('[UniConv] options : impossible d\'ouvrir le tutoriel');
      }
    });
  }

  versionElement.textContent = `version ${UNICONV_VERSION}`;

  if (window.UniConvI18n) {
    UniConvI18n.applyCurrent();
  }
  }

  setupControls();

  Promise.all([
    readSettings(SETTING_KEYS),
    loadCurrencies()
  ]).then(function (results) {
    const stored = results[0] || {};

    const merged = Object.assign({}, DEFAULTS);
    for (const key of SETTING_KEYS) {
      if (stored[key] !== undefined) {
        merged[key] = stored[key];
      }
    }

    applyToUi(merged);

    const help = document.getElementById('target-help');
    if (help && availableCurrencies.length > 0) {
      help.textContent =
        `Tapez pour filtrer (${availableCurrencies.length} devises disponibles) : ` +
        'le nom du pays fonctionne aussi (« chine » trouve le yuan).';
    }
  });
});
