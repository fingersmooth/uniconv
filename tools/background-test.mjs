/**
 * ============================================================================
 *  UniConv — tools/background-test.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Executer src/background.js hors de Firefox, avec une fausse API et un faux
 *  stockage, pour verifier :
 *    - le calcul des taux croisés ;
 *    - la mise en cache ;
 *    - le comportement SANS INTERNET ;
 *    - les erreurs (devise inconnue, API en panne, delai dépassé).
 *
 *  POURQUOI CET OUTIL EXISTE
 *  -------------------------
 *  L'iteration 3 introduit quelque chose de nouveau et de risqué : un appel
 *  reseau. Une erreur ici ne se voit pas a la lecture, elle se voit en
 *  production : bulle bloquée sur « conversion... », taux absurdes, appels
 *  répétés a l'API.
 *
 *  Ce test simule le réseau, ce qui permet de provoquer des pannes
 *  volontairement — chose impossible avec la vraie API.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/background-test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BACKGROUND_FILE = join(ROOT, 'src', 'background.js');

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
//  1. Faux environnement : stockage, API, messages
// ===========================================================================

/**
 * Construit un faux « chrome » et un faux « fetch », et execute
 * src/background.js dedans.
 *
 * @param {object} options
 * @param {object|null} options.apiPayload - la reponse simulee de l'API
 * @param {boolean} options.apiFails - simule une panne reseau
 * @param {object} options.initialStorage - contenu initial du stockage
 */
function loadBackground(options = {}) {
  const {
    apiPayload = {
      amount: 1.0,
      base: 'EUR',
      date: '2026-10-23',
      rates: { USD: 1.10, GBP: 0.85, JPY: 175.0, CHF: 0.92 }
    },
    secondaryPayload = {
      date: '2026-10-23',
      eur: {
        usd: 1.05,   // volontairement different : Frankfurter doit gagner
        gbp: 0.84,
        aed: 4.11,   // absente de Frankfurter
        sar: 4.20,
        mad: 11.0,
        btc: 0.00002 // crypto, doit etre ignoree
      }
    },
    apiFails = false,
    broadPayload = {
      result: 'success',
      time_last_update_utc: 'Sat, 24 Oct 2026 00:02:31 +0000',
      rates: {
        USD: 1.12,   // sera ecrase par Frankfurter (1.10)
        AED: 4.11,
        SAR: 4.20,
        TWD: 36.49,
        KWD: 0.347
      }
    },
    secondaryFails = false,
    broadFails = false,
    redundantFails = false,
    redundantPayload = {
      base: 'EUR',
      date: '2026-10-24',
      rates: { EUR: 1, USD: 1.06, KWD: 0.34, TWD: 36.5, QAR: 4.1 }
    },
    initialStorage = {}
  } = options;

  const storage = { ...initialStorage };
  const fetchedUrls = [];
  const messages = {
    log: [],
    warn: [],
    error: []
  };

  const chrome = {
    storage: {
      local: {
        async get(key) {
          if (typeof key === 'string') {
            return key in storage ? { [key]: storage[key] } : {};
          }
          return { ...storage };
        },
        async set(values) {
          Object.assign(storage, values);
        }
      }
    },
    runtime: {
      onMessage: { addListener: (handler) => { chrome.__handler = handler; } }
    }
  };

  const fakeFetch = async (url) => {
    fetchedUrls.push(url);

    const isRedundant = url.indexOf('exchangerate-api') !== -1;
    const isBroad = !isRedundant && url.indexOf('er-api') !== -1;
    const isSecondary = url.indexOf('currency-api') !== -1 ||
                        url.indexOf('jsdelivr') !== -1;

    if (isRedundant) {
      if (redundantFails) {
        throw new Error('NetworkError: source de secours injoignable');
      }
      return {
        ok: true,
        status: 200,
        async json() { return redundantPayload; }
      };
    }

    if (isBroad) {
      if (broadFails) {
        throw new Error('NetworkError: source large injoignable');
      }
      return {
        ok: true,
        status: 200,
        async json() { return broadPayload; }
      };
    }

    if (isSecondary) {
      if (secondaryFails) {
        throw new Error('NetworkError: source secondaire injoignable');
      }
      return {
        ok: true,
        status: 200,
        async json() { return secondaryPayload; }
      };
    }

    if (apiFails) {
      throw new Error('NetworkError: connexion impossible');
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return apiPayload;
      }
    };
  };

  const fakeConsole = {
    log: (...args) => messages.log.push(args.join(' ')),
    warn: (...args) => messages.warn.push(args.join(' ')),
    error: (...args) => messages.error.push(args.join(' '))
  };

  const source = readFileSync(BACKGROUND_FILE, 'utf8');

  const run = new Function(
    'chrome', 'fetch', 'console', 'setTimeout', 'clearTimeout', 'AbortController',
    `"use strict";\n${source}\n` +
    'return { convert: convert, loadRates: loadRates, fetchRates: fetchRates, ' +
    'getState: () => ({ ratesCache: ratesCache, ratesDate: ratesDate, ratesFetchedAt: ratesFetchedAt }) };\n'
  );

  const api = run(chrome, fakeFetch, fakeConsole, setTimeout, clearTimeout, AbortController);
  return { api, chrome, storage, fetchedUrls, messages };
}

/** Envoie un message au script d'arriere-plan et attend la reponse. */
function sendMessage(env, message) {
  return new Promise((resolve) => {
    const handler = env.chrome.__handler;
    if (typeof handler !== 'function') {
      resolve(null);
      return;
    }
    handler(message, {}, resolve);
  });
}

// ===========================================================================
//  2. Tests
// ===========================================================================

console.log('UniConv — verification du script d\'arriere-plan');
console.log(`  fichier : ${BACKGROUND_FILE}`);
console.log('');

// --- 2a. Chargement initial depuis l'API ------------------------------------
console.log('1. Telechargement depuis l\'API');
{
  const env = loadBackground();
  await new Promise((r) => setTimeout(r, 50));

  const state = env.api.getState();
  const codes = state.ratesCache ? Object.keys(state.ratesCache) : [];
  check(
    state.ratesCache !== null && codes.length === 11,
    'les taux sont fusionnes (BCE + secondaire + large + secours)',
    `devises : ${codes.join(', ') || 'aucune'}`
  );
  check(
    codes.includes('AED') && codes.includes('SAR') && codes.includes('MAD'),
    'les devises absentes de la BCE (AED, SAR, MAD) sont disponibles',
    `devises : ${codes.join(', ')}`
  );
  check(
    !codes.includes('BTC'),
    'les cryptomonnaies de la source secondaire sont ignorees',
    `devises : ${codes.join(', ')}`
  );
  check(
    codes.includes('QAR'),
    'la source de secours apporte une devise supplementaire (QAR)',
    `devises : ${codes.join(', ')}`
  );
  check(
    codes.includes('TWD') && codes.includes('KWD'),
    'la source large apporte des devises exotiques (TWD, KWD)',
    `devises : ${codes.join(', ')}`
  );
  check(state.ratesDate === '2026-10-23', 'la date de reference est conservee',
        `date : ${state.ratesDate}`);
  check(env.fetchedUrls.length === 4, 'quatre appels reseau (un par source)',
        `${env.fetchedUrls.length} appel(s)`);
  check(
    typeof env.storage['uniconv.rates'] === 'object',
    'les taux sont ecrits dans le stockage local'
  );
}

// --- 2c. Repli sur la quatrieme source --------------------------------------
console.log('');
{
  const env = loadBackground({
    apiFails: true,
    secondaryFails: true,
    broadFails: true
  });

  await env.api.loadRates(false);
  const state = env.api.getState();
  const codes = Object.keys(state.ratesCache || {});

  check(
    codes.includes('USD') && codes.includes('KWD') && codes.includes('TWD'),
    'la quatrieme source prend le relais quand les trois autres echouent',
    `devises : ${codes.join(', ')}`
  );
  check(
    state.ratesDate === '2026-10-24',
    'la date de la source de secours est conservee',
    `date : ${state.ratesDate}`
  );
}

// --- 2b. Calcul des taux croises --------------------------------------------
console.log('');
console.log('2. Calcul des conversions');
{
  const env = loadBackground();
  await new Promise((r) => setTimeout(r, 50));

  // 1 EUR = 1.10 USD
  const euroToDollar = env.api.convert(100, 'EUR', 'USD');
  check(euroToDollar !== null && Math.abs(euroToDollar.value - 110) < 0.001,
        '100 EUR = 110 USD', `obtenu : ${euroToDollar ? euroToDollar.value : 'null'}`);

  // 1 EUR = 0.85 GBP
  const euroToPound = env.api.convert(100, 'EUR', 'GBP');
  check(euroToPound !== null && Math.abs(euroToPound.value - 85) < 0.001,
        '100 EUR = 85 GBP', `obtenu : ${euroToPound ? euroToPound.value : 'null'}`);

  // Taux croise : USD -> GBP = 0.85 / 1.10 = 0.7727
  const dollarToPound = env.api.convert(100, 'USD', 'GBP');
  check(
    dollarToPound !== null && Math.abs(dollarToPound.value - 77.2727) < 0.01,
    '100 USD = 77,27 GBP (taux croise via l\'euro)',
    `obtenu : ${dollarToPound ? dollarToPound.value : 'null'}`
  );

  // Taux croise exotique : JPY -> USD = 1.10 / 175 = 0.006286
  const yenToDollar = env.api.convert(10000, 'JPY', 'USD');
  check(
    yenToDollar !== null && Math.abs(yenToDollar.value - 62.857) < 0.1,
    '10 000 JPY = 62,86 USD (taux croise)',
    `obtenu : ${yenToDollar ? yenToDollar.value : 'null'}`
  );

  // Conversion vers la meme devise
  const same = env.api.convert(42, 'USD', 'USD');
  check(same !== null && same.value === 42, 'USD vers USD ne change pas le montant',
        `obtenu : ${same ? same.value : 'null'}`);

  // Devise totalement inconnue : elle ne doit pas etre inventee.
  const unsupported = env.api.convert(100, 'XYZ', 'USD');
  check(unsupported === null, 'une devise inconnue n\'est pas convertie',
        `obtenu : ${JSON.stringify(unsupported)}`);

  // Devise couverte UNIQUEMENT par la source secondaire (AED) : elle doit
  // maintenant se convertir. C'est le correctif apporte a cette version.
  const aedToUsd = env.api.convert(100, 'AED', 'USD');
  check(
    aedToUsd !== null && Math.abs(aedToUsd.value - (100 * (1.10 / 4.11))) < 0.01,
    '100 AED = 26,76 USD (source secondaire)',
    `obtenu : ${aedToUsd ? aedToUsd.value : 'null'}`
  );
}

// --- 2c. Utilisation du cache disque ----------------------------------------
console.log('');
console.log('3. Cache : pas d\'appel reseau inutile');
{
  // On simule un cache recent deja present sur le disque.
  const env = loadBackground({
    initialStorage: {
      'uniconv.rates': {
        rates: { EUR: 1, USD: 1.05 },
        date: '2026-10-20',
        fetchedAt: Date.now() - 60 * 1000 // il y a 1 minute
      }
    }
  });

  await env.api.loadRates(false);

  check(env.fetchedUrls.length === 0,
        'un cache recent evite tout appel reseau',
        `${env.fetchedUrls.length} appel(s) effectue(s)`);
  check(env.api.getState().ratesDate === '2026-10-20',
        'la date du cache est utilisee',
        `date : ${env.api.getState().ratesDate}`);
}

// --- 2d. Cache perime : nouvel appel ----------------------------------------
console.log('');
console.log('4. Cache perime : rafraichissement');
{
  const env = loadBackground({
    initialStorage: {
      'uniconv.rates': {
        rates: { EUR: 1, USD: 1.05 },
        date: '2026-10-20',
        // 24 heures : au-dela des 12 heures de validite
        fetchedAt: Date.now() - 24 * 60 * 60 * 1000
      }
    }
  });

  await env.api.loadRates(false);

  check(env.fetchedUrls.length === 4,
        'un cache perime declenche de nouveaux appels aux quatre sources',
        `${env.fetchedUrls.length} appel(s)`);
  check(env.api.getState().ratesDate === '2026-10-23',
        'les taux sont mis a jour',
        `date : ${env.api.getState().ratesDate}`);
}

// --- 2e. Panne reseau avec cache disponible ---------------------------------
console.log('');
console.log('5. Panne internet : le cache prend le relais');
{
  const env = loadBackground({
    apiFails: true,
    secondaryFails: true,
    broadFails: true,
    redundantFails: true,
    initialStorage: {
      'uniconv.rates': {
        rates: { EUR: 1, USD: 1.05 },
        date: '2026-10-20',
        fetchedAt: Date.now() - 24 * 60 * 60 * 1000
      }
    }
  });

  const available = await env.api.loadRates(false);
  const conversion = env.api.convert(100, 'EUR', 'USD');

  check(available === true, 'le cache permet de continuer malgre la panne');
  check(conversion !== null && Math.abs(conversion.value - 105) < 0.001,
        'la conversion utilise les taux du cache',
        `obtenu : ${conversion ? conversion.value : 'null'}`);
}

// --- 2f. Panne reseau sans aucun cache --------------------------------------
console.log('');
console.log('6. Panne internet sans cache : echec propre');
{
  const env = loadBackground({
    apiFails: true,
    secondaryFails: true,
    broadFails: true,
    redundantFails: true
  });
  const available = await env.api.loadRates(false);

  check(available === false, 'sans cache ni reseau, le chargement echoue proprement');
  check(env.api.convert(100, 'EUR', 'USD') === null,
        'aucune conversion n\'est inventee');
}

// --- 2g. Messages echanges avec la page -------------------------------------
console.log('');
console.log('7. Reponses aux demandes de conversion');
{
  const env = loadBackground();
  await new Promise((r) => setTimeout(r, 50));

  const success = await sendMessage(env, {
    type: 'convert', amount: 50, from: 'EUR', to: 'USD'
  });
  check(success && success.ok === true && Math.abs(success.value - 55) < 0.001,
        'message convert : 50 EUR -> 55 USD',
        `reponse : ${JSON.stringify(success)}`);
  check(success && success.date === '2026-10-23',
        'la reponse contient la date du taux',
        `date : ${success ? success.date : 'absente'}`);
  check(success && success.stale === false,
        'la reponse indique que le taux est frais');

  const badAmount = await sendMessage(env, {
    type: 'convert', amount: 'beaucoup', from: 'EUR', to: 'USD'
  });
  check(badAmount && badAmount.ok === false,
        'un montant invalide est refuse',
        `reponse : ${JSON.stringify(badAmount)}`);

  const unsupported = await sendMessage(env, {
    type: 'convert', amount: 10, from: 'XYZ', to: 'USD'
  });
  check(unsupported && unsupported.ok === false &&
        unsupported.error === 'devise non disponible',
        'une devise sans taux est signalee clairement',
        `reponse : ${JSON.stringify(unsupported)}`);
}

// ===========================================================================
//  3. Bilan
// ===========================================================================

console.log('');
console.log(`Bilan : ${passed} reussi(s), ${failed} echec(s)`);

if (failed > 0) {
  console.log('');
  console.log('Corriger src/background.js avant de passer au test dans Firefox.');
}

process.exit(failed > 0 ? 1 : 0);
