/**
 * ============================================================================
 *  UniConv — src/engine.js
 *  Version 1.0.0 — moteur OCR heberge dans une page d'extension
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Charger Tesseract.js, puis repondre a deux messages :
 *
 *    { type: 'engine-ping' }      -> { ok: true, ready: true }
 *    { type: 'engine-ocr', image } -> { ok: true, text, confidence, durationMs }
 *
 *  « image » est une image encodee (data URL) deja decoupee par l'arriere-plan.
 *
 *  POURQUOI CETTE PAGE EXISTE
 *  --------------------------
 *  Une page d'extension reste vivante tant qu'elle est ouverte. Le script
 *  d'arriere-plan, lui, est une « page d'evenement » que Firefox decharge
 *  quand elle est inactive : une lecture de plusieurs secondes pouvait mourir
 *  en silence. Ce fichier deplace donc le moteur dans un contexte stable.
 */

'use strict';

const UNICONV_VERSION = '2.9.10';

/** Promesse de creation du worker (une seule instance, reutilisee). */
let workerPromise = null;

/** Vrai si un message de la part de l'extension a deja ete recu. */
let usedByExtension = false;

// ===========================================================================
//  1. Utilitaires
// ===========================================================================

function describeError(error) {
  if (error === null || error === undefined) {
    return 'échec sans explication';
  }
  if (typeof error === 'string') {
    return error.trim() || 'échec sans explication';
  }
  if (typeof error === 'object' && error.error instanceof Error) {
    return describeError(error.error);
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
    // objet non serialisable
  }
  return String(error);
}

function setStatus(text, kind) {
  const element = document.getElementById('status');
  if (!element) {
    return;
  }
  element.textContent = text;
  element.className = 'status' + (kind ? ` ${kind}` : '');
}

function setDetails(text) {
  const element = document.getElementById('details');
  if (element) {
    element.textContent = text;
  }
}

function showText(text, timing) {
  const zone = document.getElementById('text-zone');
  if (zone) {
    zone.value = text;
  }
  const timingElement = document.getElementById('timing');
  if (timingElement) {
    timingElement.textContent = timing || '';
  }
}

// ===========================================================================
//  2. Le moteur
// ===========================================================================

/**
 * Cree le worker Tesseract (une seule fois).
 *
 * « workerBlobURL: false » : indispensable sous Firefox. Par defaut Tesseract
 * cree son worker depuis une URL « blob: », dont l'origine differe de celle de
 * l'extension : son « importScripts » vers moz-extension:// est alors refuse.
 */
function getWorker() {
  if (workerPromise) {
    return workerPromise;
  }

  if (typeof Tesseract === 'undefined' || !Tesseract.createWorker) {
    return Promise.reject(new Error(
      'moteur absent : vendor/tesseract/tesseract.min.js non chargé'
    ));
  }

  const workerPath = chrome.runtime.getURL('src/vendor/tesseract/worker.min.js');
  const corePath = chrome.runtime.getURL('src/vendor/tesseract/tesseract-core-simd.wasm.js');
  const langPath = chrome.runtime.getURL('src/vendor/tessdata');

  workerPromise = Tesseract.createWorker(['fra', 'eng'], 1, {
    workerPath,
    corePath,
    langPath,
    cacheMethod: 'none',
    workerBlobURL: false
  }).catch((error) => {
    // On oublie la promesse en échec pour permettre une nouvelle tentative.
    workerPromise = null;
    throw error;
  });

  return workerPromise;
}

/**
 * Transforme une image encodee (data URL) en canvas.
 *
 * POURQUOI CE DETOUR
 * ------------------
 * Tesseract accepte plusieurs formes d'entree, mais le chemin le plus fiable
 * est celui qu'on maitrise entierement : une image decodee par le navigateur,
 * dessinee dans un canvas, puis passee au moteur. Confier une chaine a
 * Tesseract marche parfois... et echoue silencieusement dans d'autres
 * contextes. On supprime donc cette incertitude.
 */
function imageToCanvas(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('canvas indisponible'));
          return;
        }

        context.drawImage(image, 0, 0);
        resolve(canvas);
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => reject(new Error('image reçue illisible'));
    image.src = dataUrl;
  });
}

/**
 * Cree une variante binaire (noir/blanc) de l'image, avec seuil d'Otsu.
 *
 * POURQUOI : un texte gris clair sur fond creme, ou blanc sur fond sombre,
 * passe mal en niveaux de gris. Le seuillage separe franchement l'encre du
 * fond, ce qui sauve les polices fines (Cormorant Garamond, par exemple).
 */
function otsuCanvas(source, invert) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.drawImage(source, 0, 0);
  let pixels;
  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch (error) {
    return null;
  }

  const data = pixels.data;
  const histogram = new Array(256).fill(0);
  let total = 0;
  for (let index = 0; index < data.length; index += 4) {
    const grey = Math.round(
      0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
    );
    histogram[grey] += 1;
    total += 1;
  }

  let sum = 0;
  for (let value = 0; value < 256; value += 1) {
    sum += value * histogram[value];
  }

  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let threshold = 127;
  for (let value = 0; value < 256; value += 1) {
    weightB += histogram[value];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += value * histogram[value];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) * (meanB - meanF);
    if (between > best) {
      best = between;
      threshold = value;
    }
  }

  for (let index = 0; index < data.length; index += 4) {
    const grey = 0.299 * data[index] + 0.587 * data[index + 1] +
      0.114 * data[index + 2];
    let value = grey > threshold ? 255 : 0;
    if (invert) value = 255 - value;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/**
 * Lit une image encodee et retourne le texte reconnu.
 *
 * Plusieurs essais sont faits, car un seul passage echoue sur certaines
 * polices decoratives ou certains contrastes :
 *   - segmentation « bloc » (6), « ligne » (7) et « texte epars » (11) ;
 *   - image normale, puis binaire, puis binaire inversee (texte clair sur fond
 *     sombre).
 * On s'arrete des qu'un resultat est suffisamment confiant.
 */
async function recognize(image) {
  const startedAt = Date.now();
  const worker = await getWorker();

  // Canvas quand c'est possible (chemin sur), chaine sinon.
  const input = typeof image === 'string' && /^data:/.test(image)
    ? await imageToCanvas(image)
    : image;

  const variants = [{ name: 'normal', canvas: input }];
  if (input && typeof input.getContext === 'function') {
    const binary = otsuCanvas(input, false);
    const inverted = otsuCanvas(input, true);
    if (binary) variants.push({ name: 'binary', canvas: binary });
    if (inverted) variants.push({ name: 'inverted', canvas: inverted });
  }

  const passes = [
    { variant: 0, psm: '6' },
    { variant: 0, psm: '7' },
    { variant: 1, psm: '6' },
    { variant: 1, psm: '7' },
    { variant: 2, psm: '6' },
    { variant: 0, psm: '11' }
  ];

  let best = null;
  let lastError = null;

  try {
    for (const pass of passes) {
      const variant = variants[pass.variant];
      if (!variant) continue;

      try {
        await worker.setParameters({ tessedit_pageseg_mode: pass.psm });
        const result = await worker.recognize(variant.canvas);
        const text = result && result.data && typeof result.data.text === 'string'
          ? result.data.text.trim()
          : '';
        const confidence = result && result.data && typeof result.data.confidence === 'number'
          ? Math.round(result.data.confidence)
          : null;

        if (text !== '') {
          const candidate = { text, confidence, variant: variant.name, psm: pass.psm };
          const score = (confidence || 0) + Math.min(text.length, 120);
          if (!best || score > best.score) {
            best = Object.assign({ score }, candidate);
          }
          if (confidence !== null && confidence >= 60 && text.length >= 2) {
            break;
          }
        }
      } catch (error) {
        lastError = error;
      }
    }
  } finally {
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '3' });
    } catch (error) {
      // Le worker peut avoir ete ferme ; sans importance.
    }
  }

  if (!best && lastError) {
    throw lastError;
  }

  return {
    text: best ? best.text : '',
    confidence: best ? best.confidence : null,
    durationMs: Date.now() - startedAt
  };
}

/**
 * Test autonome : dessine un texte connu, le fait lire, compare.
 *
 * Sert a diagnostiquer en une seconde : si ce test passe, le moteur va bien et
 * le probleme vient d'ailleurs (capture, message, zone vide).
 */
async function selfTest() {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 110;

  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  context.font = 'bold 44px Helvetica, Arial, sans-serif';
  context.textBaseline = 'top';
  context.fillText('54,00 EUR', 24, 26);

  const outcome = await recognize(canvas.toDataURL('image/png'));

  return {
    text: outcome.text,
    confidence: outcome.confidence,
    durationMs: outcome.durationMs,
    expected: '54,00 EUR'
  };
}

// ===========================================================================
//  3. Messages de l'extension
// ===========================================================================

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (sender && sender.id && sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message.type === 'engine-ping') {
    usedByExtension = true;
    sendResponse({
      ok: true,
      ready: true,
      version: UNICONV_VERSION,
      engineLoaded: typeof Tesseract !== 'undefined' && Boolean(Tesseract.createWorker)
    });
    return false;
  }

  if (message.type === 'engine-ocr') {
    usedByExtension = true;

    if (typeof message.image !== 'string' ||
        !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(message.image) ||
        message.image.length > 8 * 1024 * 1024) {
      sendResponse({ ok: false, error: 'image OCR invalide' });
      return false;
    }

    // On montre l'image recue : c'est le meilleur diagnostic possible. Si
    // l'aperçu ne contient pas le texte, inutile de chercher du cote du
    // moteur : c'est la decoupe qui est fautive.
    const preview = document.getElementById('last-zone');
    if (preview) {
      preview.src = message.image;
      preview.style.display = 'block';
    }

    recognize(message.image).then(function (outcome) {
      // On met AUSSI a jour le texte affiche dans la page : sans cela, le
      // champ « Dernier texte reconnu » gardait le resultat du dernier test,
      // sans rapport avec l'image montree juste au-dessus. Defaut signale par
      // l'utilisateur.
      showText(
        outcome.text,
        `confiance ${outcome.confidence} % · ${(outcome.durationMs / 1000).toFixed(1)} s`
      );
      setStatus('moteur opérationnel', 'ok');

      sendResponse({
        ok: true,
        text: outcome.text,
        confidence: outcome.confidence,
        durationMs: outcome.durationMs
      });
    }).catch(function (error) {
      sendResponse({ ok: false, error: describeError(error) });
    });

    return true; // reponse asynchrone
  }

  if (message.type === 'engine-self-test') {
    usedByExtension = true;

    selfTest().then(function (outcome) {
      sendResponse({ ok: true, result: outcome });
    }).catch(function (error) {
      sendResponse({ ok: false, error: describeError(error) });
    });

    return true;
  }

  return false;
});

// ===========================================================================
//  4. Page ouverte a la main : bouton de test
// ===========================================================================

document.addEventListener('DOMContentLoaded', function () {
  setStatus('prêt', 'ok');
  setDetails(
    'Moteur chargé : ' +
    (typeof Tesseract !== 'undefined' && Tesseract.createWorker ? 'oui' : 'non')
  );

  const button = document.getElementById('self-test');
  if (!button) {
    return;
  }

  button.addEventListener('click', function () {
    button.disabled = true;
    setStatus('test en cours…', 'busy');

    selfTest().then(function (outcome) {
      const text = outcome.text || '';
      showText(
        text + `\n\n(attendu : ${outcome.expected})`,
        `confiance ${outcome.confidence} % · ${(outcome.durationMs / 1000).toFixed(1)} s`
      );

      const ok = /54/.test(text);
      setStatus(ok ? 'moteur opérationnel' : 'texte mal reconnu', ok ? 'ok' : 'error');
      setDetails(ok
        ? 'Le moteur lit correctement un texte simple : la chaîne complète fonctionne.'
        : 'Le moteur fonctionne mais lit mal ce test : vérifiez la version de Firefox.');
    }).catch(function (error) {
      setStatus('échec : ' + describeError(error), 'error');
      setDetails('Détail technique dans la console (Cmd + Option + K).');
      console.error('[UniConv] moteur OCR :', error);
    }).then(function () {
      button.disabled = false;
    });
  });
});
