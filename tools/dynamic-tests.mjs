/**
 * ============================================================================
 *  UniConv — tools/dynamic-tests.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Verifier l'iteration 6 : la detection du contenu AJOUTE APRES le chargement
 *  de la page (prix qui se mettent a jour, listes infinies, sites en
 *  JavaScript).
 *
 *  CE QUI EST TESTE
 *  ----------------
 *    1. Le surveillant (MutationObserver) est bien demarre, avec les bonnes
 *       options.
 *    2. Un element ajoute est analyse et ses montants sont detectes.
 *    3. Le regroupement (debounce) fonctionne : dix ajouts simultanes ne
 *       declenchent QU'UN SEUL traitement, et pas avant 300 ms.
 *    4. Un texte MODIFIE (characterData) est reanalyse.
 *    5. Un montant qui disparait est oublie (pas de faux positif residuel).
 *    6. Les zones interdites sont ignorees : script, style, saisie, et notre
 *       propre interface (attribut data-unic).
 *    7. Une rafale de 500 elements passe sans erreur et en un temps
 *       raisonnable (test de charge).
 *
 *  POURQUOI UN FAUX NAVIGATEUR
 *  ---------------------------
 *  Ce fichier n'ouvre pas Firefox : il simule le minimum du navigateur
 *  (document, MutationObserver, Minuteur) et execute le VRAI src/content.js.
 *  Une erreur d'execution est donc vue en deux secondes.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/dynamic-tests.mjs
 *
 *  Sortie : un rapport, et un code de sortie 0 si tout va bien, 1 sinon.
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

/** Attend un delai reel, en millisecondes. */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===========================================================================
//  1. Faux DOM
// ===========================================================================

/**
 * Cree un faux nœud de texte.
 *
 * Les deux proprietes qui comptent : « nodeValue » (son contenu) et
 * « parentElement » (pour savoir si le texte est dans une zone interdite).
 */
function createText(value) {
  const node = {
    nodeType: 3,
    nodeValue: value,
    parentNode: null,
    isConnected: true,
    get parentElement() {
      const parent = node.parentNode;
      return parent && parent.nodeType === 1 ? parent : null;
    }
  };
  return node;
}

/** Cree un faux element, avec ce dont l'extension se sert reellement. */
function createElement(tagName) {
  const attributes = new Map();

  const node = {
    nodeType: 1,
    tagName: String(tagName).toUpperCase(),
    children: [],
    style: {},
    className: '',
    id: '',
    isContentEditable: false,
    isConnected: true,
    parentNode: null,

    // Comme dans un vrai navigateur, « parentElement » remonte la chaine des
    // elements. Sans cette propriete, un texte place dans un <p> lui-meme
    // place dans une zone modifiable semblerait n'avoir aucun parent
    // interdit — le test validerait alors une erreur.
    get parentElement() {
      const parent = node.parentNode;
      return parent && parent.nodeType === 1 ? parent : null;
    },

    appendChild(child) {
      node.children.push(child);
      child.parentNode = node;
      return child;
    },

    removeChild(child) {
      const index = node.children.indexOf(child);
      if (index !== -1) {
        node.children.splice(index, 1);
        child.parentNode = null;
        child.isConnected = false;
      }
      return child;
    },

    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },

    get textContent() {
      if (node.children.length === 0) {
        return '';
      }
      return node.children.map((child) => child.nodeValue || child.textContent || '').join('');
    },
    set textContent(value) {
      node.children.length = 0;
      const text = createText(String(value));
      node.appendChild(text);
    },

    // « classList » : utilise par la bulle (classes de taille, de selection...).
    classList: {
      add(...names) {
        const set = new Set(String(node.className || '').split(/\s+/).filter(Boolean));
        for (const name of names) {
          set.add(name);
        }
        node.className = Array.from(set).join(' ');
      },
      remove(...names) {
        const set = new Set(String(node.className || '').split(/\s+/).filter(Boolean));
        for (const name of names) {
          set.delete(name);
        }
        node.className = Array.from(set).join(' ');
      },
      contains(name) {
        return String(node.className || '').split(/\s+/).indexOf(name) !== -1;
      }
    },

    getBoundingClientRect() {
      return {
        width: 200, height: 60, top: 100, left: 100,
        right: 300, bottom: 160, x: 100, y: 100
      };
    },

    // Les ecouteurs sont memorises : c'est ce qui permet au test de simuler
    // un glissement de souris sur le voile de selection OCR.
    _listeners: {},

    addEventListener(type, handler) {
      if (!node._listeners[type]) {
        node._listeners[type] = [];
      }
      node._listeners[type].push(handler);
    },

    removeEventListener(type, handler) {
      const list = node._listeners[type];
      if (!list) {
        return;
      }
      node._listeners[type] = list.filter((entry) => entry !== handler);
    },

    // Utilise par la mise a jour de la bulle (sans reconstruction).
    insertBefore(child, reference) {
      const index = reference ? node.children.indexOf(reference) : -1;
      if (index === -1) {
        node.children.push(child);
      } else {
        node.children.splice(index, 0, child);
      }
      child.parentNode = node;
      return child;
    },

    // Utilise par la mise a jour de la bulle : insere un element juste apres.
    insertAdjacentElement(position, element) {
      const parent = node.parentNode;
      if (!parent || !parent.children) {
        return null;
      }
      const index = parent.children.indexOf(node);
      if (index === -1) {
        return null;
      }
      parent.children.splice(index + 1, 0, element);
      element.parentNode = parent;
      return element;
    },

    /** Envoie un evenement aux ecouteurs de cet element. */
    dispatch(type, event) {
      const list = node._listeners[type] || [];
      for (const handler of list) {
        handler(Object.assign({
          preventDefault() {},
          stopPropagation() {}
        }, event));
      }
    },

    /**
     * Recherche un descendant par classe CSS (formes « .nom »).
     *
     * INDISPENSABLE : la mise a jour de la bulle (« updateTooltipText »)
     * cherche « .unicorn-tooltip-main » pour modifier le texte SUR PLACE.
     * Un querySelector qui renvoie toujours null faisait creer un SECOND
     * element : le test voyait alors l'ancien texte et concluait a tort que
     * la conversion n'arrivait jamais.
     */
    querySelector(selector) {
      const wanted = String(selector || '').trim();
      if (!wanted.startsWith('.')) {
        return null;
      }
      const className = wanted.slice(1);

      const search = (element) => {
        for (const child of element.children || []) {
          if (child.nodeType !== 1) {
            continue;
          }
          const classes = String(child.className || '').split(/\s+/);
          if (classes.indexOf(className) !== -1) {
            return child;
          }
          const deeper = search(child);
          if (deeper) {
            return deeper;
          }
        }
        return null;
      };

      return search(node);
    }
  };

  return node;
}

/**
 * Parcourt les nœuds de texte contenus dans un element, dans l'ordre du
 * document — comme « document.createTreeWalker ».
 */
function collectTextNodes(root) {
  const found = [];

  function visit(node) {
    if (node.nodeType === 3) {
      found.push(node);
      return;
    }
    for (const child of node.children || []) {
      visit(child);
    }
  }

  visit(root);
  return found;
}

// ===========================================================================
//  2. Faux MutationObserver
// ===========================================================================

/**
 * Simule « MutationObserver ».
 *
 * Le vrai objet ne nous previendrait jamais dans un test : ce faux objet
 * memorise le rappel et les options, et c'est le TEST qui declenche les
 * modifications, comme le ferait le navigateur.
 */
class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.options = null;
    this.target = null;
    FakeMutationObserver.instances.push(this);
  }

  observe(target, options) {
    this.target = target;
    this.options = options;
  }

  disconnect() {
    this.target = null;
    this.options = null;
  }

  /** Envoie une liste de modifications au code de l'extension. */
  emit(mutations) {
    this.callback(mutations, this);
  }
}

FakeMutationObserver.instances = [];

// ===========================================================================
//  3. Preparation du code a executer
// ===========================================================================

const source = readFileSync(CONTENT_FILE, 'utf8');

/** On retire le « 'use strict' » de tete : il n'est valable qu'en debut de fichier. */
const prepared = source.replace(
  /^[\s\S]*?'use strict';\n/,
  '/* debut du fichier insere */\n'
);

/**
 * Monte une page et demarre l'extension dedans.
 *
 * @param {string[]} initialTexts - textes presents AVANT le demarrage
 * @returns {object} les prises du test (body, alertes, minuteurs...)
 */
async function boot(initialTexts, options = {}) {
  FakeMutationObserver.instances = [];

  /** Nom d'hote simule (pour tester la liste noire). */
  const host = options.host || 'localhost';

  const body = createElement('body');
  const head = createElement('head');

  for (const text of initialTexts) {
    const paragraph = createElement('p');
    paragraph.appendChild(createText(text));
    body.appendChild(paragraph);
  }

  // Le test peut construire une structure HTML sur mesure (prix coupes en
  // plusieurs balises, par exemple) avant que le script ne demarre.
  if (typeof options.setup === 'function') {
    options.setup(body);
  }

  // Contenu present des le chargement, mais dans une zone ou l'on tape du
  // texte : il ne doit jamais etre analyse, meme au tout premier scan.
  if (options.initialEditable) {
    const editableZone = createElement('div');
    editableZone.isContentEditable = true;
    const editableParagraph = createElement('p');
    editableParagraph.appendChild(createText(options.initialEditable));
    editableZone.appendChild(editableParagraph);
    body.appendChild(editableZone);
  }

  const document = {
    body,
    head,
    documentElement: createElement('html'),
    createElement,
    querySelector: () => null,
    location: { href: 'http://localhost:8123/test/dynamique.html' },

    // L'extension parcourt la page avec un TreeWalker : on reproduit son
    // comportement (tous les nœuds de texte sous la racine).
    createTreeWalker(root, whatToShow, filter) {
      const nodes = collectTextNodes(root);
      let index = -1;

      return {
        nextNode() {
          while (true) {
            index += 1;
            if (index >= nodes.length) {
              return null;
            }
            const node = nodes[index];
            if (filter && typeof filter.acceptNode === 'function') {
              const verdict = filter.acceptNode(node);
              if (verdict === 1 || verdict === 4) {
                return node;
              }
              continue;
            }
            return node;
          }
        }
      };
    },

    createRange() {
      // On memorise le nœud et les bornes : c'est ce qui permet de verifier
      // QUELLE portion de texte a ete surlignee.
      const range = {
        startNode: null,
        startOffset: 0,
        endNode: null,
        endOffset: 0,
        setStart(node, offset) {
          range.startNode = node;
          range.startOffset = offset;
        },
        setEnd(node, offset) {
          range.endNode = node;
          range.endOffset = offset;
        },
        getBoundingClientRect: () => ({
          width: 40, height: 16, top: 100, left: 100,
          right: 140, bottom: 116, x: 100, y: 100
        }),
        // Le recours spatial teste les rectangles REELLEMENT occupes par le
        // texte. On renvoie ici la zone « utile » du test : le test place son
        // curseur a (200, 200), donc dans ce rectangle.
        getClientRects: () => [{
          width: 200, height: 40, top: 180, left: 150,
          right: 350, bottom: 220, x: 150, y: 180
        }]
      };
      return range;
    },

    // Le test place le curseur ou il veut, comme le ferait le navigateur
    // au-dessus d'un morceau de texte precis.
    caretPositionFromPoint: () => document._caret || null,

    // Iteration 7bis : recherche des montants portes par une image.
    querySelectorAll: (selector) => {
      if (typeof selector !== 'string' || selector.indexOf('img') !== 0) {
        return [];
      }
      return document._images || [];
    },
    elementFromPoint: () => document._pointElement || null,
    // La PILE des elements au point (elementsFromPoint), qui voit a travers
    // les superpositions : c'est ce que consulte le recours spatial.
    elementsFromPoint: () => document._stack || [],
    _images: [],
    _pointElement: null,
    _caret: null,
    _stack: [],
    // On memorise les ecouteurs : c'est ce qui permet de simuler le raccourci
    // clavier de pause (Alt + Maj + U).
    _listeners: {},
    addEventListener(type, handler) {
      if (!document._listeners[type]) {
        document._listeners[type] = [];
      }
      document._listeners[type].push(handler);
    },
    removeEventListener() {}
  };

  document.documentElement.appendChild(head);
  document.documentElement.appendChild(body);

  const highlights = new Map();

  const messages = [];

  // Minuteurs instrumentes : on veut pouvoir compter les appels a
  // « setTimeout » (c'est ainsi qu'on verifie le regroupement des
  // modifications).
  const timerCalls = [];
  const instrumentedSetTimeout = (callback, delay) => {
    timerCalls.push(delay);
    return setTimeout(callback, delay);
  };

  /** Messages envoyes a l'arriere-plan (pour verifier le badge). */
  const sentMessages = [];

  /** Comportements que le test peut modifier (ex. : faire echouer un appel). */
  const behaviour = {
    convertFails: false,
    // « deferOcr » : la lecture OCR ne repond pas tout de suite. C'est le seul
    // moyen de simuler une lecture de plusieurs secondes et de verifier qu'une
    // deuxieme image n'est pas analysee en meme temps.
    deferOcr: false,
    answerOcr: null,
    // Texte renvoye par le faux moteur OCR (permet de tester les unites).
    ocrText: null
  };

  /** Demandes de lecture OCR recues par le faux arriere-plan. */
  const ocrRequests = [];

  // Faux stockage : l'extension y publie ses statistiques, et y lit ses
  // reglages (pause, liste noire).
  const stored = Object.assign({}, options.storage || {});

  if (options.paused) {
    stored['uniconv.enabled'] = false;
  }
  if (options.blacklist) {
    stored['uniconv.blacklist'] = options.blacklist;
  }

  /** Ecouteurs de messages (pour simuler un envoi depuis une autre page). */
  const messageListeners = [];

  const chrome = {
    runtime: {
      lastError: null,
      onMessage: {
        addListener(handler) {
          messageListeners.push(handler);
        }
      },
      sendMessage(message, callback) {
        if (message && message.type === 'convert') {
          if (behaviour.convertFails) {
            callback({ ok: false, error: 'devise non disponible' });
            return;
          }

          const rate = message.from === message.to ? 1 : 1.1;
          callback({
            ok: true,
            value: message.amount * rate,
            rate,
            from: message.from,
            to: message.to,
            date: '2026-10-23',
            fetchedAt: Date.now(),
            stale: false
          });
        } else if (message && message.type === 'rates-status') {
          callback({ ok: true, date: '2026-10-23', currencies: ['EUR', 'USD'], fetchedAt: Date.now() });
        } else if (message && message.type === 'ocr-capture') {
          // On note si une bulle etait affichee AU MOMENT de la photo : c'est
          // exactement le defaut corrige en 0.19.0 (la bulle recouvrait le prix).
          const tooltip = body.children.find(
            (child) => child.getAttribute && child.getAttribute('data-unic') === 'tooltip');

          // Meme question pour la pastille « OCR… » de l'iteration 10 : elle
          // etait affichee AVANT la photo, donc photographiee puis relue.
          const badge = body.children.find(
            (child) => child.getAttribute && child.getAttribute('data-unic') === 'ocr-badge');

          ocrRequests.push({
            type: 'ocr-capture',
            rect: message.rect,
            dpr: message.dpr,
            viewport: message.viewport,
            tooltipVisibleAtCapture: Boolean(tooltip) && tooltip.style.display === 'block',
            badgeVisibleAtCapture: Boolean(badge)
          });

          callback({ ok: true, id: 'zone-test-1', crop: { sourceWidth: 240, sourceHeight: 120 } });
        } else if (message && message.type === 'ocr-recognize') {
          ocrRequests.push({ type: 'ocr-recognize', id: message.id });

          const answer = () => callback({
            ok: true,
            text: behaviour.ocrText || 'Prix : 54,00 € (0,01 € / unité)',
            confidence: 91,
            durationMs: 420,
            crop: { sourceWidth: 240, sourceHeight: 120 }
          });

          if (behaviour.deferOcr) {
            behaviour.answerOcr = answer;
          } else {
            answer();
          }
        } else if (message && message.type === 'set-paused') {
          sentMessages.push(message);
          callback({ ok: true, paused: message.paused });
        } else {
          callback({ ok: false });
        }
      }
    },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          const list = Array.isArray(keys) ? keys : [keys];
          for (const key of list) {
            if (key in stored) {
              result[key] = stored[key];
            }
          }
          callback(result);
        },
        set(values, callback) {
          for (const [key, value] of Object.entries(values)) {
            stored[key] = value;
          }
          if (callback) {
            callback();
          }
        }
      },
      onChanged: {
        addListener() {}
      }
    }
  };

  const localConsole = {
    log: (...args) => messages.push({ level: 'log', text: args.join(' ') }),
    warn: (...args) => messages.push({ level: 'warn', text: args.join(' ') }),
    error: (...args) => messages.push({ level: 'error', text: args.join(' ') }),
    // Le rapport de diagnostic (Alt + Maj + D) utilise des groupes.
    group: (...args) => messages.push({ level: 'log', text: args.join(' ') }),
    groupEnd: () => {},
    info: (...args) => messages.push({ level: 'log', text: args.join(' ') })
  };

  const run = new Function(
    'window', 'document', 'NodeFilter', 'CSS', 'Highlight', 'console',
    'requestAnimationFrame', 'location', 'Intl', 'WeakMap', 'Set', 'Map',
    'Date', 'Number', 'String', 'Object', 'Array', 'Math', 'JSON', 'RegExp',
    'Error', 'setTimeout', 'clearTimeout', 'chrome', 'MutationObserver',
    `"use strict";\n${prepared}\n`
  );

  /** Ecouteurs poses sur la fenetre (le voile OCR ecoute « mouseup »). */
  const windowListeners = {};

  const fakeWindow = {
    innerWidth: 1280,
    innerHeight: 800,
    location: {
      href: `http://${host}/test/dynamique.html`,
      hostname: host
    },
    // Le script pose des ecouteurs sur la fenetre (« scroll », et « mouseup »
    // pendant le dessin d'une zone OCR) : on les memorise pour pouvoir les
    // declencher depuis le test.
    addEventListener(type, handler) {
      if (!windowListeners[type]) {
        windowListeners[type] = [];
      }
      windowListeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      const list = windowListeners[type];
      if (!list) {
        return;
      }
      windowListeners[type] = list.filter((entry) => entry !== handler);
    }
  };

  let error = null;

  try {
    run(
      fakeWindow, document, { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
      { highlights }, function Highlight(...ranges) {
        this.ranges = ranges;
        this.size = ranges.length;
      },
      localConsole, (callback) => setTimeout(callback, 0),
      fakeWindow.location,
      Intl, WeakMap, Set, Map, Date, Number, String, Object, Array, Math,
      JSON, RegExp, Error, instrumentedSetTimeout, clearTimeout, chrome,
      FakeMutationObserver
    );
  } catch (thrown) {
    error = thrown;
  }

  // Iteration 7 : le script lit ses reglages (pause, liste noire) avant de
  // lancer la detection. Cette lecture est asynchrone : on laisse passer un
  // tour de boucle, sinon le test observerait un script encore inactif.
  await wait(0);

  return {
    document,
    body,
    head,
    host,
    sentMessages,
    behaviour,
    ocrRequests,
    /** Debloque une lecture OCR differee (quand behaviour.deferOcr est actif). */
    answerOcr() {
      const answer = behaviour.answerOcr;
      behaviour.answerOcr = null;
      if (answer) {
        answer();
      }
    },
    /** Simule un defilement de la page. */
    scrollWindow(event) {
      const list = windowListeners.scroll || [];
      for (const handler of list) {
        handler(Object.assign({
          preventDefault() {},
          stopPropagation() {}
        }, event || {}));
      }
    },
    /** Simule un relachement de souris au niveau de la fenetre. */
    releaseMouse(event) {
      const list = windowListeners.mouseup || [];
      for (const handler of list) {
        handler(Object.assign({
          preventDefault() {},
          stopPropagation() {}
        }, event));
      }
    },
    /** Simule un message venu d'une autre page de l'extension (OCR). */
    emitMessage(message) {
      let response = null;
      for (const handler of messageListeners) {
        handler(message, {}, (value) => { response = value; });
      }
      return response;
    },
    /** Simule une frappe clavier (raccourci de pause). */
    pressKey(event) {
      const handlers = document._listeners.keydown || [];
      for (const handler of handlers) {
        handler(Object.assign({
          preventDefault() {},
          stopPropagation() {}
        }, event));
      }
    },
    highlights,
    messages,
    stored,
    timerCalls,
    error,
    observer: FakeMutationObserver.instances[0] || null,
    /** Ajoute un paragraphe contenant le texte donne, et previent l'observateur. */
    appendParagraph(text) {
      const paragraph = createElement('p');
      const textNode = createText(text);
      paragraph.appendChild(textNode);
      body.appendChild(paragraph);

      if (this.observer) {
        this.observer.emit([
          { type: 'childList', target: body, addedNodes: [paragraph], removedNodes: [] }
        ]);
      }

      return { paragraph, textNode };
    }
  };
}

/** Compte les montants surlignes, sans planter si aucun surlignage n'existe. */
function countHighlights(page) {
  const collection = page.highlights.get('unicorn-amount');
  return collection ? collection.ranges.length : 0;
}

/** Extrait, pour une page, le texte de tous les montants surlignes. */
function highlightedTexts(page) {
  const collection = page.highlights.get('unicorn-amount');
  if (!collection) {
    return [];
  }
  return collection.ranges.map((range) => {
    if (!range.startNode || typeof range.startNode.nodeValue !== 'string') {
      return '';
    }
    return range.startNode.nodeValue.slice(range.startOffset, range.endOffset);
  });
}

// ===========================================================================
//  4. Execution des tests
// ===========================================================================

console.log('UniConv — iteration 6 : contenu dynamique');
console.log(`  fichier : ${CONTENT_FILE}`);
console.log('');

// ---------------------------------------------------------------------------
console.log('1. Demarrage du surveillant');
// ---------------------------------------------------------------------------

const page = await boot(['Prix de depart : 10\u20AC ']);

check(page.error === null, 'le script demarre sans erreur',
  page.error ? `${page.error.message}\n${page.error.stack}` : null);

check(page.observer !== null,
  'un MutationObserver est cree au demarrage');

check(
  page.observer !== null &&
  page.observer.target === page.body,
  'il surveille le corps de la page (document.body)');

check(
  page.observer !== null &&
  page.observer.options !== null &&
  page.observer.options.childList === true &&
  page.observer.options.subtree === true &&
  page.observer.options.characterData === true,
  'il surveille les ajouts, les sous-elements et les modifications de texte',
  page.observer ? JSON.stringify(page.observer.options) : '(aucun observateur)');

check(
  page.messages.some((entry) => /surveillance du contenu dynamique/.test(entry.text)),
  'la console annonce la surveillance du contenu dynamique');

check(
  !page.messages.some((entry) => entry.level === 'error'),
  'aucun message d\'erreur au demarrage',
  page.messages.filter((e) => e.level === 'error').map((e) => e.text).join(' | '));

// Au demarrage, le montant deja present doit etre trouve.
check(
  highlightedTexts(page).some((text) => text.indexOf('10') === 0),
  'le montant present au chargement est deja detecte',
  JSON.stringify(highlightedTexts(page)));

// ---------------------------------------------------------------------------
console.log('');
console.log('2. Contenu ajoute apres coup');
// ---------------------------------------------------------------------------

const before = countHighlights(page);

page.appendParagraph('Nouveau prix : 25\u20AC ');

// Le traitement ne doit PAS etre immediat : on regroupe pendant 300 ms.
await wait(150);
check(
  countHighlights(page) === before,
  'rien n\'est traite pendant les 150 premieres millisecondes (regroupement)',
  `attendu ${before} montant(s), obtenu ${page.highlights.get('unicorn-amount') ? countHighlights(page) : 0}`);

await wait(300);

const after = countHighlights(page);

check(after > before,
  'le montant ajoute est detecte apres le delai de 300 ms',
  `avant ${before}, apres ${after}`);

// ---------------------------------------------------------------------------
console.log('');
console.log('3. Regroupement des modifications (debounce)');
// ---------------------------------------------------------------------------

const timerCallsBefore = page.timerCalls.length;

for (let index = 0; index < 10; index += 1) {
  page.appendParagraph(`Prix en serie ${index} : ${index + 1}\u20AC `);
}

const timerCallsAfter = page.timerCalls.slice(timerCallsBefore);

// On ne regarde que les minuteurs de 300 ms : ce sont ceux du regroupement.
// (L'extension arme aussi, de temps en temps, un minuteur de publication des
// statistiques : il ne doit pas fausser ce comptage.)
const debounceTimers = timerCallsAfter.filter((delay) => delay === 300);

check(
  debounceTimers.length === 1,
  '10 ajouts simultanes ne declenchent qu\'un seul traitement (un seul minuteur)',
  `minuteurs de 300 ms armes : ${debounceTimers.length} (${JSON.stringify(timerCallsAfter)})`);

check(
  page.timerCalls.includes(300),
  'le delai de regroupement est bien de 300 ms',
  `minuteurs observes : ${JSON.stringify(page.timerCalls)}`);

await wait(400);

check(
  countHighlights(page) >= after + 10,
  'les 10 montants ajoutes en une rafale sont tous detectes',
  `apres rafale : ${countHighlights(page)}`);

// ---------------------------------------------------------------------------
console.log('');
console.log('4. Texte modifie sur place (characterData)');
// ---------------------------------------------------------------------------

const target = page.appendParagraph('Aucun montant ici.');
await wait(400);

const removedNodeIndex = page.document.body.children.indexOf(target.paragraph);
check(removedNodeIndex !== -1, 'le paragraphe temoin est bien dans la page');

const beforeChange = countHighlights(page);

// Le site change le TEXTE du nœud existant (cas tres frequent : un compteur
// qui se met a jour toutes les secondes).
target.textNode.nodeValue = 'Maintenant 42\u20AC ';

page.observer.emit([
  { type: 'characterData', target: target.textNode }
]);

await wait(400);

check(
  countHighlights(page) === beforeChange + 1,
  'un texte modifie sur place est reanalyse',
  `avant ${beforeChange}, apres ${countHighlights(page)}`);

// ---------------------------------------------------------------------------
console.log('');
console.log('5. Montant qui disparait');
// ---------------------------------------------------------------------------

const beforeRemoval = countHighlights(page);

// Le prix est remplace par du texte sans montant.
target.textNode.nodeValue = 'Article epuise.';

page.observer.emit([
  { type: 'characterData', target: target.textNode }
]);

await wait(400);

check(
  countHighlights(page) === beforeRemoval - 1,
  'un montant qui disparait n\'est plus surligne',
  `avant ${beforeRemoval}, apres ${countHighlights(page)}`);

// ---------------------------------------------------------------------------
console.log('');
console.log('6. Zones interdites');
// ---------------------------------------------------------------------------

const beforeForbidden = countHighlights(page);

// a) Balise <script>
const script = createElement('script');
script.appendChild(createText('var prix = "100\\u20AC";'));
page.body.appendChild(script);

// b) Balise <style>
const style = createElement('style');
style.appendChild(createText('.prix { content: "100\\u20AC"; }'));
page.body.appendChild(style);

// c) Champ de saisie
const textarea = createElement('textarea');
textarea.appendChild(createText('100\u20AC dans une zone de saisie'));
page.body.appendChild(textarea);

// d) Notre propre bulle (interface de l'extension)
const ownUi = createElement('div');
ownUi.setAttribute('data-unic', 'tooltip');
ownUi.appendChild(createText('100\u20AC affiche par la bulle'));
page.body.appendChild(ownUi);

// e) Zone modifiable
const editable = createElement('div');
editable.isContentEditable = true;
editable.appendChild(createText('100\u20AC en cours de frappe'));
page.body.appendChild(editable);

page.observer.emit([
  {
    type: 'childList',
    target: page.body,
    addedNodes: [script, style, textarea, ownUi, editable]
  }
]);

await wait(400);

check(
  countHighlights(page) === beforeForbidden,
  'script, style, saisie, zone modifiable et interface interne sont ignores',
  `avant ${beforeForbidden}, apres ${countHighlights(page)}`);

// ---------------------------------------------------------------------------
console.log('');
console.log('7. Zone modifiable des le chargement');
// ---------------------------------------------------------------------------

const editablePage = await boot(
  ['Prix normal : 10\u20AC '],
  { initialEditable: 'Montant tape : 99\u20AC ' }
);

const editableTexts = highlightedTexts(editablePage);

check(
  editableTexts.length === 1,
  'un montant deja present dans une zone modifiable n\'est pas analyse',
  `montants surlignes : ${JSON.stringify(editableTexts)}`);

check(
  editableTexts.length === 1 && editableTexts[0].indexOf('10') === 0,
  'le montant normal de la meme page reste, lui, detecte',
  JSON.stringify(editableTexts));

// ---------------------------------------------------------------------------
console.log('');
console.log('8. Test de charge : 500 elements d\'un coup');
// ---------------------------------------------------------------------------

const loadPage = await boot(['Un montant initial : 1\u20AC ']);
const beforeLoad = countHighlights(loadPage);

const addedNodes = [];
for (let index = 0; index < 500; index += 1) {
  const paragraph = createElement('p');
  paragraph.appendChild(createText(`Produit ${index} a ${index + 1}\u20AC `));
  loadPage.body.appendChild(paragraph);
  addedNodes.push(paragraph);
}

const loadStart = Date.now();

loadPage.observer.emit([
  { type: 'childList', target: loadPage.body, addedNodes }
]);

await wait(400);

const loadDuration = Date.now() - loadStart;
const afterLoad = countHighlights(loadPage);

check(
  afterLoad >= 500,
  'les 500 elements ajoutes sont tous analyses',
  `trouves : ${afterLoad}`);

check(
  loadDuration < 3000,
  'la rafale de 500 elements est traitee en moins de 3 secondes',
  `duree : ${loadDuration} ms`);

check(
  !loadPage.messages.some((entry) => entry.level === 'error'),
  'aucune erreur pendant le test de charge',
  loadPage.messages.filter((e) => e.level === 'error').map((e) => e.text).join(' | '));

// ---------------------------------------------------------------------------
console.log('');
console.log('9. Rafale exceptionnelle (soupape de securite)');
// ---------------------------------------------------------------------------

// Au-dela de 3 000 nœuds d'un coup, l'extension prefere relire la page en
// entier plutot que d'ignorer silencieusement des elements.
const hugePage = await boot(['Depart : 1\u20AC ']);

const hugeNodes = [];
for (let index = 0; index < 3500; index += 1) {
  const paragraph = createElement('p');
  paragraph.appendChild(createText(`Lot ${index} : ${index + 2}\u20AC `));
  hugePage.body.appendChild(paragraph);
  hugeNodes.push(paragraph);
}

const burstStart = Date.now();
hugePage.observer.emit([
  { type: 'childList', target: hugePage.body, addedNodes: hugeNodes }
]);

// On attend la fin reelle (regroupement de 300 ms compris), avec un plafond.
while (Date.now() - burstStart < 5000 && countHighlights(hugePage) < 3500) {
  await wait(25);
}
const burstMs = Date.now() - burstStart;

check(
  countHighlights(hugePage) >= 3500,
  'une rafale de 3 500 elements est traitee malgre le plafond',
  `trouves : ${countHighlights(hugePage)} en ${burstMs} ms`);

check(
  burstMs < 3000,
  'la rafale de 3 500 elements est traitee en moins de 3 secondes',
  `${burstMs} ms`);

console.log(`        temps mesure de la rafale : ${burstMs} ms`);

check(
  !hugePage.messages.some((entry) => entry.level === 'error'),
  'aucune erreur pendant la rafale exceptionnelle',
  hugePage.messages.filter((e) => e.level === 'error').map((e) => e.text).join(' | '));

// ---------------------------------------------------------------------------
console.log('');
console.log('10. Sites exclus et pause (iteration 7)');
// ---------------------------------------------------------------------------

// a) Un site en liste noire : l'extension doit etre totalement absente.
const blacklistedPage = await boot(
  ['Prix : 10\u20AC '],
  { host: 'mail.google.com' }
);

check(
  blacklistedPage.observer === null,
  'site en liste noire : aucun surveillant n\'est cree',
  blacklistedPage.observer ? 'un observateur a ete cree' : null);

check(
  countHighlights(blacklistedPage) === 0,
  'site en liste noire : aucun montant n\'est surligne');

check(
  blacklistedPage.messages.some((entry) => /liste noire/.test(entry.text)),
  'site en liste noire : la console l\'annonce clairement');

// b) La sous-domaine est couvert par la regle (« a.github.com »).
const subdomainPage = await boot(
  ['Prix : 10\u20AC '],
  { host: 'gist.github.com' }
);

check(
  countHighlights(subdomainPage) === 0,
  'un sous-domaine d\'un site exclu est exclu aussi (gist.github.com)');

// c) Un site normal n'est pas exclu.
const normalPage = await boot(
  ['Prix : 10\u20AC '],
  { host: 'www.exemple.fr' }
);

check(
  countHighlights(normalPage) === 1,
  'un site ordinaire reste analyse (www.exemple.fr)',
  `montants : ${countHighlights(normalPage)}`);

// d) Extension en pause au demarrage.
const pausedPage = await boot(
  ['Prix : 10\u20AC '],
  { host: 'www.exemple.fr', paused: true }
);

check(
  countHighlights(pausedPage) === 0,
  'extension en pause : rien n\'est surligne au chargement');

check(
  pausedPage.messages.some((entry) => /en pause/.test(entry.text)),
  'extension en pause : la console l\'annonce');

check(
  pausedPage.sentMessages.some((message) =>
    message.type === 'set-paused' && message.paused === true),
  'extension en pause : l\'arriere-plan est prevenu (badge « OFF »)');

// e) Le raccourci Alt + Maj + U a ete RETIRE : il ne doit plus rien faire.
pausedPage.pressKey({ key: 'u', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false });
await wait(50);

check(
  pausedPage.stored['uniconv.enabled'] === false,
  'Alt + Maj + U ne reprend plus l\'extension (raccourci retire)',
  `valeur : ${JSON.stringify(pausedPage.stored['uniconv.enabled'])}`);

check(
  countHighlights(pausedPage) === 0,
  'Alt + Maj + U ne relance plus l\'analyse',
  `montants : ${countHighlights(pausedPage)}`);

// e-bis) Le cas macOS (Option + Maj + U produit « Û ») est retire aussi.
const macPage = await boot(['Prix : 10\u20AC '], { host: 'www.exemple.fr' });
macPage.pressKey({ key: '\u00db', code: 'KeyU', altKey: true, shiftKey: true });
await wait(50);

check(
  macPage.stored['uniconv.enabled'] === undefined ||
    macPage.stored['uniconv.enabled'] === true,
  'macOS : Option + Maj + U ne suspend plus l\'extension',
  `valeur enregistree : ${JSON.stringify(macPage.stored['uniconv.enabled'])}`);

// f) Un autre raccourci ne doit rien changer.
const otherKeyPage = await boot(['Prix : 10\u20AC '], { host: 'www.exemple.fr' });
const beforeOtherKey = otherKeyPage.observer;
otherKeyPage.pressKey({ key: 'u', altKey: false, shiftKey: false, ctrlKey: false, metaKey: false });
await wait(20);

check(
  otherKeyPage.observer === beforeOtherKey,
  'taper « u » seul ne suspend pas l\'extension');

// ---------------------------------------------------------------------------
console.log('');
console.log('11. Prix ecrits dans les attributs d\'une image (iteration 7bis)');
// ---------------------------------------------------------------------------

const imagePage = await boot(['Aucun montant dans ce texte.'], { host: 'www.exemple.fr' });

const productImage = createElement('img');
imagePage.body.appendChild(productImage);
imagePage.document._images = [productImage];
imagePage.document._pointElement = productImage;

// 1. Sans attribut, l'image n'apporte rien.
imagePage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(60);

const tooltipOf = (page) => page.body.children.find(
  (child) => child.getAttribute && child.getAttribute('data-unic') === 'tooltip'
);

check(
  !tooltipOf(imagePage) || tooltipOf(imagePage).style.display === 'none',
  'une image sans attribut de prix n\'ouvre aucune bulle');

// 2. Le site renseigne « alt » APRES coup (chargement paresseux).
productImage.setAttribute('alt', 'Enceinte portable a 59,90 \u20AC');

imagePage.observer.emit([
  { type: 'attributes', target: productImage, attributeName: 'alt' }
]);

await wait(400);

imagePage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

const imageBubble = tooltipOf(imagePage);
const imageBubbleText = imageBubble ? imageBubble.textContent : '';

check(
  Boolean(imageBubble) && imageBubble.style.display === 'block',
  'un « alt » rempli apres coup est pris en compte (chargement paresseux)',
  imageBubble ? `display = ${JSON.stringify(imageBubble.style.display)}` : 'bulle absente');

check(
  imageBubbleText.indexOf('59,90') !== -1 || imageBubbleText.indexOf('65') !== -1,
  'la bulle affiche la conversion du prix de l\'image',
  `contenu = ${JSON.stringify(imageBubbleText)}`);

// 3. Une image dont l'attribut ne contient pas de prix est ignoree.
productImage.setAttribute('alt', 'Enceinte portable noire');
imagePage.observer.emit([
  { type: 'attributes', target: productImage, attributeName: 'alt' }
]);
await wait(400);

imagePage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

check(
  !tooltipOf(imagePage) || tooltipOf(imagePage).style.display === 'none',
  'quand l\'attribut change et ne contient plus de prix, la bulle disparait');

// ---------------------------------------------------------------------------
console.log('');
console.log('12. Prix coupes en plusieurs balises (cas Amazon)');
// ---------------------------------------------------------------------------

// Reproduction de la structure reelle d'Amazon. Le prix visible « 54,00 € »
// n'existe NULLE PART sous forme de texte continu : il est eclate en quatre
// morceaux (symbole, entier, virgule, decimales). Une analyse morceau par
// morceau ne peut donc rien trouver — c'est le bogue signale.
const amazon = {};

const amazonPage = await boot([], {
  host: 'www.amazon.fr',
  setup(body) {
    const price = createElement('span');
    price.className = 'a-price';

    // Texte destine aux lecteurs d'ecran (invisible a l'oeil).
    const offscreen = createElement('span');
    offscreen.className = 'a-offscreen';
    amazon.offscreenText = createText('54,00 €');
    offscreen.appendChild(amazon.offscreenText);

    const ariaHidden = createElement('span');
    ariaHidden.setAttribute('aria-hidden', 'true');

    const symbol = createElement('span');
    symbol.className = 'a-price-symbol';
    amazon.symbolText = createText('€');
    symbol.appendChild(amazon.symbolText);

    const whole = createElement('span');
    whole.className = 'a-price-whole';
    amazon.wholeText = createText('54');
    const decimal = createElement('span');
    decimal.className = 'a-price-decimal';
    decimal.appendChild(createText(','));
    whole.appendChild(amazon.wholeText);
    whole.appendChild(decimal);

    const fraction = createElement('span');
    fraction.className = 'a-price-fraction';
    amazon.fractionText = createText('00');
    fraction.appendChild(amazon.fractionText);

    // Ordre reel du DOM chez Amazon : symbole, entier, decimales.
    ariaHidden.appendChild(symbol);
    ariaHidden.appendChild(whole);
    ariaHidden.appendChild(fraction);

    price.appendChild(offscreen);
    price.appendChild(ariaHidden);

    // Le prix unitaire, lui aussi eclate : « (0,01 € / unité) ».
    const unitPrice = createElement('span');
    unitPrice.className = 'a-price a-text-price';
    amazon.unitText = createText('0,01 €');
    unitPrice.appendChild(amazon.unitText);
    const unitLabel = createText(' / unité');
    unitPrice.appendChild(unitLabel);

    body.appendChild(price);
    body.appendChild(unitPrice);
  }
});

check(
  countHighlights(amazonPage) >= 2,
  'un prix eclate en 4 balises est tout de meme detecte (et souligne)',
  `montants surlignes : ${countHighlights(amazonPage)}`);

// On place le curseur sur le « 54 » visible, comme un vrai survol.
amazonPage.document._caret = { offsetNode: amazon.wholeText, offset: 1 };
amazonPage.document._listeners.mousemove[0]({ clientX: 200, clientY: 200 });
await wait(80);

const amazonBubble = tooltipOf(amazonPage);
const amazonText = amazonBubble ? amazonBubble.textContent : '';

check(
  Boolean(amazonBubble) && amazonBubble.style.display === 'block',
  'survoler le « 54 » d\'un prix decoupe ouvre la bulle',
  amazonBubble ? `display = ${JSON.stringify(amazonBubble.style.display)}` : 'bulle absente');

// 54 x 1,10 = 59,4 : le taux du faux navigateur est volontairement simple.
check(
  /59[.,]4/.test(amazonText) && /54/.test(amazonText),
  'la bulle convertit bien 54 EUR (54 x 1,10 = 59,4)',
  `contenu = ${JSON.stringify(amazonText)}`);

// Le prix unitaire « 0,01 € » doit etre reconnu lui aussi.
amazonPage.document._caret = { offsetNode: amazon.unitText, offset: 2 };
amazonPage.document._listeners.mousemove[0]({ clientX: 200, clientY: 240 });
await wait(80);

const unitBubble = tooltipOf(amazonPage);
const unitBubbleText = unitBubble ? unitBubble.textContent : '';

check(
  Boolean(unitBubble) && unitBubble.style.display === 'block',
  'le prix unitaire « 0,01 EUR » est converti aussi',
  unitBubble ? `contenu = ${JSON.stringify(unitBubbleText)}` : 'bulle absente');

// --- Une vignette cliquable : <label><span>13,50</span><span>€</span></label>
const tile = {};

const tilePage = await boot([], {
  host: 'www.amazon.fr',
  setup(body) {
    const label = createElement('label');
    label.className = 'swatch';

    const labelText = createElement('span');
    tile.numberText = createText('13,50');
    labelText.appendChild(tile.numberText);

    const labelEuro = createElement('span');
    labelEuro.appendChild(createText('€'));

    label.appendChild(labelText);
    label.appendChild(labelEuro);
    body.appendChild(label);
  }
});

check(
  countHighlights(tilePage) >= 1,
  'une vignette cliquable « 13,50 € » coupee en deux est detectee',
  `montants : ${countHighlights(tilePage)}`);

tilePage.document._caret = { offsetNode: tile.numberText, offset: 2 };
tilePage.document._listeners.mousemove[0]({ clientX: 120, clientY: 160 });
await wait(80);

const tileBubble = tooltipOf(tilePage);
check(
  Boolean(tileBubble) && tileBubble.style.display === 'block',
  'survoler le montant d\'une case cliquable ouvre la bulle',
  tileBubble ? `contenu = ${JSON.stringify(tileBubble.textContent)}` : 'bulle absente');

// --- Non-regression : deux prix separes ne doivent pas fusionner ----------
const twoPrices = await boot(
  // Virgule (et non un separateur de plage) : deux prix distincts.
  ['Le premier coute 5 €, le second 10 €.'],
  { host: 'www.exemple.fr' }
);

check(
  countHighlights(twoPrices) === 2,
  'un phrase avec deux prix detecte bien deux montants distincts',
  `montants : ${countHighlights(twoPrices)}`);

// --- Garde-fou : le texte ne fusionne pas a travers un bloc ---------------
const acrossBlocks = {};

const blockPage = await boot([], {
  host: 'www.exemple.fr',
  setup(body) {
    const first = createElement('div');
    acrossBlocks.numberText = createText('12');
    first.appendChild(acrossBlocks.numberText);

    const second = createElement('div');
    second.appendChild(createText('€'));

    body.appendChild(first);
    body.appendChild(second);
  }
});

check(
  countHighlights(blockPage) === 0,
  'un nombre dans un bloc et un symbole dans un AUTRE bloc ne fusionnent pas',
  `montants : ${countHighlights(blockPage)}`);

// ---------------------------------------------------------------------------
console.log('');
console.log('13. Prix sous un lien transparent (cases de variantes Amazon)');
// ---------------------------------------------------------------------------

// Structure reelle relevee sur amazon.fr : la case de variante contient un
// lien VIDE qui occupe toute la surface (<a class="page-load-link"
// style="height:100%;width:100%">). Le curseur tombe donc sur un element sans
// texte : caretPositionFromPoint ne renvoie rien d'utile. C'est le recours
// spatial qui doit sauver la mise.
const overlay = {};

const overlayPage = await boot([], {
  host: 'www.amazon.fr',
  setup(body) {
    const tile = createElement('span');
    tile.className = 'a-button a-button-toggle text-swatch-button-with-slots';

    const inner = createElement('span');
    inner.className = 'a-button-inner';

    const title = createElement('span');
    title.className = 'swatch-title-text';
    title.appendChild(createText('90 Unité (Lot de 48)'));

    const priceSlot = createElement('div');
    priceSlot.className = 'a-section dimension-slot-info';

    const price = createElement('span');
    price.className = 'a-price';

    // Prix en clair, comme dans la case de variante.
    overlay.priceText = createText('54,00 €');
    price.appendChild(overlay.priceText);

    priceSlot.appendChild(price);

    // Lien transparent qui recouvre toute la case, sans aucun texte.
    const link = createElement('a');
    link.className = 'page-load-link';
    overlay.link = link;

    inner.appendChild(title);
    inner.appendChild(priceSlot);
    inner.appendChild(link);
    tile.appendChild(inner);
    body.appendChild(tile);

    overlay.tile = tile;
    overlay.inner = inner;
  }
});

check(
  countHighlights(overlayPage) >= 1,
  'le prix d\'une case de variante est detecte',
  `montants : ${countHighlights(overlayPage)}`);

// Le curseur tombe sur le lien transparent : aucune position de texte.
overlayPage.document._caret = null;
// La pile d'elements au point : le lien d'abord, puis la case.
overlayPage.document._stack = [overlay.link, overlay.inner, overlay.tile];

overlayPage.document._listeners.mousemove[0]({ clientX: 200, clientY: 200 });
await wait(80);

const overlayBubble = tooltipOf(overlayPage);
const overlayText = overlayBubble ? overlayBubble.textContent : '';

check(
  Boolean(overlayBubble) && overlayBubble.style.display === 'block',
  'malgre un lien transparent sur le prix, la bulle s\'ouvre (recours spatial)',
  overlayBubble ? `contenu = ${JSON.stringify(overlayText)}` : 'bulle absente');

check(
  /54/.test(overlayText),
  'le montant affiche est bien celui de la case (54)',
  `contenu = ${JSON.stringify(overlayText)}`);

// --- Non-regression : le survol dans le texte reste prioritaire -----------
// Une page normale (sans superposition) ne doit pas dependre du recours
// spatial : on verifie que le survol fonctionne toujours avec le curseur.
const normalPage2 = await boot(['Un prix de 12 € ici.'], { host: 'www.exemple.fr' });
normalPage2.document._caret = { offsetNode: normalPage2.document.body.children[0].children[0], offset: 12 };
normalPage2.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

const normalBubble = tooltipOf(normalPage2);
check(
  Boolean(normalBubble) && normalBubble.style.display === 'block',
  'le survol normal (curseur dans le texte) fonctionne toujours',
  normalBubble ? `contenu = ${JSON.stringify(normalBubble.textContent)}` : 'bulle absente');

// ---------------------------------------------------------------------------
console.log('');
console.log('14. Diagnostic Alt + Maj + D');
// ---------------------------------------------------------------------------

const diagPage = await boot(['Un prix de 12 € ici.'], { host: 'www.exemple.fr' });

// Le curseur doit avoir une position connue : on simule un deplacement.
diagPage.document._caret = {
  offsetNode: diagPage.document.body.children[0].children[0],
  offset: 12
};
diagPage.document._listeners.mousemove[0]({ clientX: 120, clientY: 140 });
await wait(40);

diagPage.pressKey({ code: 'KeyD', altKey: true, shiftKey: true });
await wait(20);

check(
  diagPage.messages.some((entry) => /diagnostic au point/.test(entry.text)),
  'Alt + Maj + D produit un rapport de diagnostic');

check(
  diagPage.messages.some((entry) => /suite reconstituee/.test(entry.text)),
  'le rapport indique le texte reconstitue sous le curseur');

check(
  diagPage.messages.some((entry) => /resultats/.test(entry.text)),
  'le rapport indique le resultat des trois methodes de recherche');

check(
  !diagPage.messages.some((entry) => entry.level === 'error'),
  'le diagnostic ne provoque aucune erreur',
  diagPage.messages.filter((e) => e.level === 'error').map((e) => e.text).join(' | '));

// ---------------------------------------------------------------------------
console.log('');
console.log('15. Reglages de la page d\'options (iteration 8)');
// ---------------------------------------------------------------------------

// a) Les devises peuvent etre desactivees sans toucher aux unites.
const noCurrency = await boot(
  ['Un prix de 10 € et une distance de 3 km.'],
  { host: 'www.exemple.fr', storage: { 'uniconv.detectCurrencies': false } }
);

const noCurrencyTexts = highlightedTexts(noCurrency);
check(
  noCurrencyTexts.length === 1 && /km/.test(noCurrencyTexts[0]),
  'devises desactivees : seul le montant en unites reste souligne',
  `surlignes : ${JSON.stringify(noCurrencyTexts)}`);

// b) Et inversement.
const noUnits = await boot(
  ['Un prix de 10 € et une distance de 3 km.'],
  { host: 'www.exemple.fr', storage: { 'uniconv.detectUnits': false } }
);

const noUnitsTexts = highlightedTexts(noUnits);
check(
  noUnitsTexts.length === 1 && /10/.test(noUnitsTexts[0]),
  'unites desactivees : seul le prix reste souligne',
  `surlignes : ${JSON.stringify(noUnitsTexts)}`);

// c) Theme clair applique a la bulle.
const lightPage = await boot(
  ['Un prix de 10 €.'],
  { host: 'www.exemple.fr', storage: { 'uniconv.theme': 'light' } }
);

const lightBubble = tooltipOf(lightPage);
check(
  Boolean(lightBubble) && String(lightBubble.className).indexOf('unicorn-theme-light') !== -1,
  'theme clair : la bulle recoit la classe « unicorn-theme-light »',
  lightBubble ? `classe = ${JSON.stringify(lightBubble.className)}` : 'bulle absente');

// d) Theme sombre par defaut.
const darkPage = await boot(['Un prix de 10 €.'], { host: 'www.exemple.fr' });
const darkBubble = tooltipOf(darkPage);
check(
  Boolean(darkBubble) && String(darkBubble.className).indexOf('unicorn-theme-dark') !== -1,
  'theme sombre par defaut : la bulle recoit la classe « unicorn-theme-dark »',
  darkBubble ? `classe = ${JSON.stringify(darkBubble.className)}` : 'bulle absente');

// e) Langue anglaise : les nombres suivent le format anglais.
const englishPage = await boot(
  ['A price of 1234.56 € here.'],
  { host: 'www.exemple.fr', storage: { 'uniconv.language': 'en' } }
);

englishPage.document._caret = {
  offsetNode: englishPage.document.body.children[0].children[0],
  offset: 13
};
englishPage.document._listeners.mousemove[0]({ clientX: 200, clientY: 200 });
await wait(80);

const englishBubble = tooltipOf(englishPage);
const englishText = englishBubble ? englishBubble.textContent : '';

check(
  /1,358\.02|1,358\.0/.test(englishText),
  'langue anglaise : les nombres sont formates a l\'anglaise (1,358.02)',
  `contenu = ${JSON.stringify(englishText)}`);

// f) Delai d'apparition : la bulle ne doit PAS etre immediate.
const delayPage = await boot(
  ['Un prix de 10 €.'],
  { host: 'www.exemple.fr', storage: { 'uniconv.hoverDelay': 120 } }
);

delayPage.document._caret = {
  offsetNode: delayPage.document.body.children[0].children[0],
  offset: 12
};
delayPage.document._listeners.mousemove[0]({ clientX: 200, clientY: 200 });
await wait(40);

const bubbleDuringDelay = tooltipOf(delayPage);
check(
  !bubbleDuringDelay || bubbleDuringDelay.style.display === 'none',
  'delai de 120 ms : la bulle n\'apparait pas dans les 40 premieres ms',
  bubbleDuringDelay ? `display = ${JSON.stringify(bubbleDuringDelay.style.display)}` : 'bulle absente');

await wait(140);

const bubbleAfterDelay = tooltipOf(delayPage);
check(
  Boolean(bubbleAfterDelay) && bubbleAfterDelay.style.display === 'block',
  'delai de 120 ms : la bulle apparait ensuite',
  bubbleAfterDelay ? `display = ${JSON.stringify(bubbleAfterDelay.style.display)}` : 'bulle absente');

// g) Sans delai (valeur par defaut), l'affichage reste immediat.
const immediatePage = await boot(['Un prix de 10 €.'], { host: 'www.exemple.fr' });
immediatePage.document._caret = {
  offsetNode: immediatePage.document.body.children[0].children[0],
  offset: 12
};
immediatePage.document._listeners.mousemove[0]({ clientX: 200, clientY: 200 });
await wait(20);

const immediateBubble = tooltipOf(immediatePage);
check(
  Boolean(immediateBubble) && immediateBubble.style.display === 'block',
  'sans delai, la bulle reste immediate',
  immediateBubble ? `display = ${JSON.stringify(immediateBubble.style.display)}` : 'bulle absente');

// ---------------------------------------------------------------------------
console.log('');
console.log('16. OCR : voile de selection sur la page, puis bulle (iteration 9)');
// ---------------------------------------------------------------------------

// a) Le message du popup doit faire apparaitre le voile.
const ocrPage = await boot(['Ce texte ne contient aucun montant.'], { host: 'www.exemple.fr' });

const startResponse = ocrPage.emitMessage({ type: 'start-ocr-selection' });
await wait(20);

const overlayOf = (page) => page.body.children.find(
  (child) => child.getAttribute && child.getAttribute('data-unic') === 'ocr-overlay'
);

check(
  startResponse && startResponse.ok === true,
  'la page repond au message « start-ocr-selection »',
  JSON.stringify(startResponse));

check(
  Boolean(overlayOf(ocrPage)),
  'un voile de selection apparait SUR la page',
  overlayOf(ocrPage) ? null : 'voile absent');

const ocrOverlay = overlayOf(ocrPage);

check(
  Boolean(ocrOverlay) && ocrOverlay.children.some(
    (child) => String(child.className).indexOf('unicorn-ocr-frame') === 0),
  'le voile contient un cadre de selection');

check(
  Boolean(ocrOverlay) && ocrOverlay.children.some(
    (child) => String(child.className).indexOf('unicorn-ocr-hint') === 0),
  'une consigne est affichee en haut de l\'ecran');

// b) Dessiner un rectangle : la zone doit partir vers l'arriere-plan.
if (ocrOverlay) {
  ocrOverlay.dispatch('mousedown', { clientX: 100, clientY: 100 });
  ocrOverlay.dispatch('mousemove', { clientX: 220, clientY: 160 });
  ocrPage.releaseMouse({ clientX: 220, clientY: 160 });
}

// La page attend deux images de repeint puis 70 ms avant de photographier.
await wait(220);

check(
  ocrPage.ocrRequests.length === 2 &&
  ocrPage.ocrRequests[0].type === 'ocr-capture' &&
  ocrPage.ocrRequests[1].type === 'ocr-recognize',
  'la page demande D\'ABORD la capture, PUIS la lecture',
  ocrPage.ocrRequests.map((entry) => entry.type).join(' -> '));

const requested = ocrPage.ocrRequests[0] || {};
check(
  requested.rect && requested.rect.x === 100 && requested.rect.y === 100 &&
  requested.rect.width === 120 && requested.rect.height === 60,
  'la zone envoyee correspond au rectangle dessine (120 × 60)',
  JSON.stringify(requested.rect));

check(
  typeof requested.dpr === 'number' && requested.dpr > 0,
  'la densite de l\'ecran accompagne la demande (Retina)',
  String(requested.dpr));

check(
  requested.viewport && typeof requested.viewport.width === 'number' &&
  requested.viewport.width > 0,
  'la taille du viewport accompagne la demande (base de l\'échelle réelle)',
  JSON.stringify(requested.viewport));

check(
  !overlayOf(ocrPage),
  'le voile disparait une fois la zone dessinee');

check(
  ocrPage.ocrRequests[0].tooltipVisibleAtCapture === false,
  'aucune bulle n\'est affichee au moment de la capture (le prix reste lisible)',
  `bulle visible pendant la photo : ${ocrPage.ocrRequests[0].tooltipVisibleAtCapture}`);

// c) Le texte reconnu doit s'afficher dans la bulle.
const ocrBubble = tooltipOf(ocrPage);
const ocrText = ocrBubble ? ocrBubble.textContent : '';

check(
  Boolean(ocrBubble) && ocrBubble.style.display === 'block',
  'le texte reconnu s\'affiche dans une bulle, sur la page',
  ocrBubble ? `display = ${JSON.stringify(ocrBubble.style.display)}` : 'bulle absente');

check(
  ocrPage.messages.some((entry) => /OCR : « Prix : 54,00/.test(entry.text)),
  'le texte reconnu est journalise (traçabilité)',
  ocrPage.messages.filter((e) => /OCR/.test(e.text)).map((e) => e.text).join(' | '));

const bubblePart = (bubble, className) => {
  if (!bubble || !Array.isArray(bubble.children)) {
    return null;
  }
  return bubble.children.find((child) => child.className === className) || null;
};

const ocrMain = bubblePart(ocrBubble, 'unicorn-tooltip-main');
const ocrDetail = bubblePart(ocrBubble, 'unicorn-tooltip-detail');

if (!(ocrMain && /=/.test(ocrMain.textContent))) {
  console.log('        messages de la page :',
    ocrPage.messages.map((entry) => entry.level + ':' + entry.text).join(' | '));
}

check(
  Boolean(ocrMain) && /=/.test(ocrMain.textContent) && /\d/.test(ocrMain.textContent),
  'la CONVERSION est la ligne principale de la bulle (54,00 € = …)',
  ocrMain ? JSON.stringify(ocrMain.textContent) : 'ligne principale absente');

check(
  Boolean(ocrDetail) && /1\s*EUR/i.test(ocrDetail.textContent),
  'la seconde ligne est le TAUX, comme après un clic sur du texte',
  ocrDetail ? JSON.stringify(ocrDetail.textContent) : 'seconde ligne absente');

// LE point demande par l'utilisateur : le SIGNE CIBLE ouvre le menu.
const ocrTargetTrigger = ocrBubble && ocrBubble.querySelector
  ? ocrBubble.querySelector('.unicorn-target-trigger')
  : null;

check(
  Boolean(ocrTargetTrigger),
  'la bulle OCR propose un signe de devise cible cliquable',
  ocrBubble ? ocrBubble.children.map((child) => child.className).join(' | ') : 'bulle absente'
);

if (ocrTargetTrigger) {
  const handlers = ocrTargetTrigger._listeners && ocrTargetTrigger._listeners.click;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: ocrTargetTrigger, stopPropagation: function () {} });
  }
}

const ocrCurrencyMenu = ocrBubble && ocrBubble.querySelector
  ? ocrBubble.querySelector('.unicorn-source-menu')
  : null;
const ocrCurrencyList = ocrBubble && ocrBubble.querySelector
  ? ocrBubble.querySelector('.unicorn-source-list')
  : null;

check(
  Boolean(ocrCurrencyMenu) && Boolean(ocrCurrencyList) &&
  ocrCurrencyList.children.some((row) =>
    Array.isArray(row.children) &&
    row.children.some((child) => String(child.className).indexOf('unicorn-source-item') === 0)),
  'le menu OCR liste bien toutes les devises',
  ocrCurrencyList ? `${ocrCurrencyList.children.length} element(s)` : 'liste absente');

check(
  ocrPage.messages.some((entry) => /OCR : « Prix : 54,00/.test(entry.text)),
  'le texte reconnu est journalise (traçabilité)',
  ocrPage.messages.filter((e) => /OCR/.test(e.text)).map((e) => e.text).join(' | '));

// c-bis) Conversion impossible : la bulle doit DIRE pourquoi.
const failPage = await boot(['Rien ici.'], { host: 'www.exemple.fr' });
failPage.behaviour.convertFails = true;

failPage.emitMessage({ type: 'start-ocr-selection' });
await wait(20);

const failOverlay = overlayOf(failPage);
if (failOverlay) {
  failOverlay.dispatch('mousedown', { clientX: 100, clientY: 100 });
  failOverlay.dispatch('mousemove', { clientX: 220, clientY: 160 });
  failPage.releaseMouse({ clientX: 220, clientY: 160 });
}

await wait(800);

const failBubble = tooltipOf(failPage);
const failMain = bubblePart(failBubble, 'unicorn-tooltip-main');
const failDetail = bubblePart(failBubble, 'unicorn-tooltip-detail');
const failText = `${failMain ? failMain.textContent : ''} ${failDetail ? failDetail.textContent : ''}`;

check(
  /exchange|disponible|taux|rate/i.test(failText),
  'conversion rate : la RAISON est affichee (pas seulement le prix)',
  JSON.stringify(failText.trim()));

// d) Echap annule la selection.
const escapePage = await boot(['Rien ici.'], { host: 'www.exemple.fr' });
escapePage.emitMessage({ type: 'start-ocr-selection' });
await wait(20);

check(Boolean(overlayOf(escapePage)), 'le voile est bien ouvert avant Echap');

escapePage.pressKey({ key: 'Escape' });
await wait(20);

check(
  !overlayOf(escapePage),
  'la touche Echap retire le voile de selection');

check(
  escapePage.ocrRequests.length === 0,
  'Echap n\'envoie aucune demande de lecture');

// e) Une zone trop petite ne doit rien envoyer.
const smallPage = await boot(['Rien ici.'], { host: 'www.exemple.fr' });
smallPage.emitMessage({ type: 'start-ocr-selection' });
await wait(20);

const smallOverlay = overlayOf(smallPage);
if (smallOverlay) {
  smallOverlay.dispatch('mousedown', { clientX: 50, clientY: 50 });
  smallOverlay.dispatch('mousemove', { clientX: 54, clientY: 52 });
  smallPage.releaseMouse({ clientX: 54, clientY: 52 });
}

await wait(30);

check(
  smallPage.ocrRequests.length === 0,
  'un rectangle minuscule ne lance aucune lecture',
  `${smallPage.ocrRequests.length} demande(s)`);

check(
  Boolean(overlayOf(smallPage)),
  'apres une zone trop petite, le voile reste ouvert pour reessayer');

// ---------------------------------------------------------------------------
console.log('');
console.log('17bis. Menu contextuel : conversion du texte selectionne');
// ---------------------------------------------------------------------------

const selectionPage = await boot([], { host: 'www.exemple.fr' });
const selectionResponse = selectionPage.emitMessage({
  type: 'convert-selection',
  text: '13K RMB'
});
await wait(80);

const selectionBubble = tooltipOf(selectionPage);

check(
  selectionResponse && selectionResponse.ok === true,
  'le message « convert-selection » est accepte',
  JSON.stringify(selectionResponse)
);

check(
  Boolean(selectionBubble) && selectionBubble.style.display === 'block' &&
    /13/.test(selectionBubble.textContent),
  'la sélection « 13K RMB » ouvre une bulle de conversion',
  selectionBubble ? selectionBubble.textContent : 'aucune bulle'
);

// La devise de départ est modifiable (¥ ambigu).
const sourcePage = await boot([], { host: 'www.exemple.fr' });
sourcePage.emitMessage({ type: 'convert-selection', text: '¥8,000' });
await wait(80);

function findMenuCurrencyItem(list, code) {
  if (!list || !Array.isArray(list.children)) {
    return null;
  }
  for (const row of list.children) {
    if (!row || !Array.isArray(row.children)) {
      continue;
    }
    const item = row.children.find(
      (child) => child.getAttribute && child.getAttribute('data-code') === code
    );
    if (item) {
      return item;
    }
  }
  return null;
}

const sourceBubble = tooltipOf(sourcePage);
const sourceTrigger = sourceBubble && sourceBubble.querySelector
  ? sourceBubble.querySelector('.unicorn-source-trigger')
  : null;

check(
  Boolean(sourceTrigger),
  'le signe de la devise de départ est cliquable',
  sourceBubble ? sourceBubble.textContent.slice(0, 120) : 'aucune bulle'
);

{
  const mainElement = sourceBubble && sourceBubble.querySelector
    ? sourceBubble.querySelector('.unicorn-tooltip-main')
    : null;
  const amountField = mainElement && mainElement.querySelector
    ? mainElement.querySelector('.unicorn-amount-input')
    : null;
  const trigger = mainElement && mainElement.querySelector
    ? mainElement.querySelector('.unicorn-source-trigger')
    : null;
  const children = mainElement && Array.isArray(mainElement.children)
    ? mainElement.children
    : [];
  check(
    Boolean(amountField) && Boolean(trigger) &&
      children.indexOf(trigger) > children.indexOf(amountField),
    'le bouton de devise reste après la somme, quelle que soit la devise',
    `enfants = ${children.map((child) => child.className).join(' | ')}`
  );
}

if (sourceTrigger) {
  const handlers = sourceTrigger._listeners && sourceTrigger._listeners.click;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: sourceTrigger, stopPropagation: function () {} });
  }
}

const sourceMenu = sourceBubble && sourceBubble.querySelector
  ? sourceBubble.querySelector('.unicorn-source-menu')
  : null;
const sourceList = sourceBubble && sourceBubble.querySelector
  ? sourceBubble.querySelector('.unicorn-source-list')
  : null;
const sourceSearch = sourceBubble && sourceBubble.querySelector
  ? sourceBubble.querySelector('.unicorn-source-search')
  : null;

const sourceSections = sourceList && sourceList.children
  ? sourceList.children.filter(
      (child) => String(child.className).indexOf('unicorn-source-section') === 0
    ).map((child) => child.textContent)
  : [];

check(
  Boolean(sourceMenu) && Boolean(sourceList) && sourceList.children.length > 10,
  'le menu de départ contient toutes les monnaies (plus de 10)',
  sourceList ? `${sourceList.children.length} monnaie(s)` : 'aucune liste'
);

check(
  sourceSections[0] === 'Principales',
  'les devises principales sont en haut du menu de départ',
  sourceSections.join(' | ')
);

const principalCodes = [];
let inPrincipalSection = false;
for (const child of sourceList ? sourceList.children : []) {
  if (String(child.className).indexOf('unicorn-source-section') === 0) {
    inPrincipalSection = child.textContent === 'Principales';
    continue;
  }
  if (!inPrincipalSection || !child.children) {
    continue;
  }
  const label = child.children.find(
    (item) => item.getAttribute && item.getAttribute('data-code')
  );
  if (label) {
    principalCodes.push(label.getAttribute('data-code'));
  }
}

check(
  principalCodes.join(',') === 'USD,EUR,JPY,GBP,CNY',
  'les cinq devises principales suivent l’ordre d’importance',
  principalCodes.join(', ')
);

const usdItem = findMenuCurrencyItem(sourceList, 'USD');
const usdFlag = usdItem && usdItem.children
  ? usdItem.children.find(
      (child) => String(child.className).indexOf('unicorn-source-flag') === 0
    )
  : null;

check(
  Boolean(usdFlag) && usdFlag.textContent.length >= 2,
  'chaque devise affiche son drapeau',
  usdFlag ? JSON.stringify(usdFlag.textContent) : 'drapeau absent'
);

const bndItem = findMenuCurrencyItem(sourceList, 'BND');
const bndRow = bndItem && bndItem.parentNode ? bndItem.parentNode : null;
const bndPin = bndRow && bndRow.children
  ? bndRow.children.find(
      (child) => String(child.className).indexOf('unicorn-source-pin') === 0
    )
  : null;

if (bndPin && bndPin._listeners && bndPin._listeners.click) {
  const handlers = bndPin._listeners.click;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: bndPin, stopPropagation: function () {} });
  }
}

const sectionsAfterPin = sourceList && sourceList.children
  ? sourceList.children.filter(
      (child) => String(child.className).indexOf('unicorn-source-section') === 0
    ).map((child) => child.textContent)
  : [];

check(
  sectionsAfterPin[0] === 'Épinglées' &&
    Array.isArray(sourcePage.stored['uniconv.pinnedCurrencies']) &&
    sourcePage.stored['uniconv.pinnedCurrencies'].indexOf('BND') !== -1,
  'épingler une devise la place en tête et la mémorise',
  `${sectionsAfterPin.join(' | ')} / ${JSON.stringify(sourcePage.stored['uniconv.pinnedCurrencies'])}`
);

if (sourceSearch) {
  sourceSearch.value = 'yuan';
  const handlers = sourceSearch._listeners && sourceSearch._listeners.input;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: sourceSearch });
  }
}

const cnyItem = findMenuCurrencyItem(sourceList, 'CNY');

check(
  Boolean(cnyItem),
  'la recherche de la devise de départ filtre bien les résultats',
  'CNY introuvable'
);

if (cnyItem) {
  const handlers = cnyItem._listeners && cnyItem._listeners.click;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: cnyItem, stopPropagation: function () {} });
  }
  await wait(120);

  const updated = tooltipOf(sourcePage);
  const updatedMain = updated && updated.querySelector
    ? updated.querySelector('.unicorn-tooltip-main')
    : null;
  check(
    Boolean(updatedMain) && (/元/.test(updatedMain.textContent) || /CNY/.test(updatedMain.textContent)),
    'changer la devise de départ reconvertit le montant (¥ -> CNY)',
    updatedMain ? updatedMain.textContent : 'aucune bulle'
  );
}

// Un clic sur le signe de devise d'une bulle de SURVOL doit figer la bulle
// et ouvrir le menu, sans devoir cliquer d'abord sur le prix.
const hoverFreezePage = await boot(['Prix ¥8,000 '], { host: 'www.exemple.fr' });
hoverFreezePage.document._caret = {
  offsetNode: hoverFreezePage.document.body.children[0].children[0],
  offset: 8
};
hoverFreezePage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(100);

const hoverFreezeBubble = tooltipOf(hoverFreezePage);
const hoverFreezeTrigger = hoverFreezeBubble && hoverFreezeBubble.querySelector
  ? hoverFreezeBubble.querySelector('.unicorn-source-trigger')
  : null;

check(
  Boolean(hoverFreezeBubble) &&
    !hoverFreezeBubble.classList.contains('unicorn-tooltip-frozen'),
  'la bulle de survol n’a pas l’état figé',
  hoverFreezeBubble ? hoverFreezeBubble.className : 'aucune bulle'
);

check(
  Boolean(hoverFreezeTrigger),
  'le signe de devise est présent dans la bulle de survol',
  hoverFreezeBubble ? hoverFreezeBubble.textContent.slice(0, 100) : 'aucune bulle'
);

if (hoverFreezeTrigger) {
  const handlers = hoverFreezeTrigger._listeners && hoverFreezeTrigger._listeners.click;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: hoverFreezeTrigger, stopPropagation: function () {} });
  }
}

check(
  Boolean(hoverFreezeBubble) &&
    Boolean(hoverFreezeBubble.querySelector('.unicorn-source-menu')) &&
    hoverFreezeBubble.style.display === 'block',
  'cliquer le signe fige la bulle de survol et ouvre le menu',
  hoverFreezeBubble ? hoverFreezeBubble.style.display : 'aucune bulle'
);

check(
  Boolean(hoverFreezeBubble) &&
    hoverFreezeBubble.classList.contains('unicorn-tooltip-frozen'),
  'la bulle figée prend l’état visuel « enfoncé »',
  hoverFreezeBubble ? hoverFreezeBubble.className : 'aucune bulle'
);

// La somme detectee est editable dans la bulle (et le champ se fige).
const editPage = await boot([], { host: 'www.exemple.fr' });
editPage.emitMessage({ type: 'convert-selection', text: '¥8,000' });
await wait(80);

const editBubble = tooltipOf(editPage);
const editInput = editBubble && editBubble.querySelector
  ? editBubble.querySelector('.unicorn-amount-input')
  : null;

check(
  Boolean(editInput),
  'la somme detectee est un champ editable dans la bulle',
  editBubble ? editBubble.textContent.slice(0, 120) : 'aucune bulle'
);

if (editInput) {
  const enter = editInput._listeners && editInput._listeners.mouseenter;
  for (const handler of Array.isArray(enter) ? enter : []) {
    handler({ target: editInput });
  }
}

check(
  Boolean(editInput) && String(editInput.className).indexOf('is-hover') !== -1,
  'le champ de somme change d’état au survol',
  editInput ? editInput.className : 'champ absent'
);

if (editInput) {
  const leave = editInput._listeners && editInput._listeners.mouseleave;
  for (const handler of Array.isArray(leave) ? leave : []) {
    handler({ target: editInput });
  }
}

if (editInput) {
  editInput.textContent = '16000';
  const handlers = editInput._listeners && editInput._listeners.blur;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: editInput });
  }
}
await wait(120);

const editedBubble = tooltipOf(editPage);
const editedMain = editedBubble && editedBubble.querySelector
  ? editedBubble.querySelector('.unicorn-tooltip-main')
  : null;

check(
  Boolean(editedMain) && /16/.test(editedMain.textContent),
  'modifier la somme relance la conversion avec la nouvelle valeur',
  editedMain ? editedMain.textContent : 'aucune bulle'
);

// Deuxieme modification : aucune trace de l'ancien contenu ne doit rester.
const secondBubble = tooltipOf(editPage);
const secondInput = secondBubble && secondBubble.querySelector
  ? secondBubble.querySelector('.unicorn-amount-input')
  : null;

if (secondInput) {
  secondInput.textContent = '12000';
  const handlers = secondInput._listeners && secondInput._listeners.blur;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: secondInput });
  }
}
await wait(120);

const secondMain = secondBubble && secondBubble.querySelector
  ? secondBubble.querySelector('.unicorn-tooltip-main')
  : null;
check(
  Boolean(secondMain) &&
    (String(secondMain.textContent).match(/=/g) || []).length === 1 &&
    !/conversion/.test(secondMain.textContent),
  'chaque modification remplace l’ancienne somme sans laisser de trace',
  secondMain ? secondMain.textContent : 'aucune bulle'
);

// Une bulle figee disparait au defilement de la page.
editPage.scrollWindow({ target: editPage.document });
await wait(20);
check(
  Boolean(editedBubble) && editedBubble.style.display === 'none',
  'une bulle figee disparait au defilement',
  editedBubble ? editedBubble.style.display : 'aucune bulle'
);

// Unites de reference : les valeurs EUR / metriques / Paris ne sont pas
// soulignees ; les valeurs etrangeres le sont.
const referencePage = await boot(
  ['Prix 10 €, 10 km et 14:30 CET ; 10 USD, 10 miles, 14:30 EST'],
  {
    host: 'www.exemple.fr',
    storage: {
      'uniconv.referenceUnitsEnabled': true,
      'uniconv.targetCurrency': 'EUR',
      'uniconv.unitSystem': 'metric',
      'uniconv.targetTimezone': 'Europe/Paris'
    }
  }
);
await wait(80);

check(
  countHighlights(referencePage) === 3,
  'les valeurs de reference ne sont pas soulignees',
  `${countHighlights(referencePage)} surlignage(s)`
);

// Le choix de la cible dans une bulle ne doit PAS etre enregistre.
const targetSavePage = await boot(['Prix : 10 € '], { host: 'www.exemple.fr' });
targetSavePage.emitMessage({ type: 'convert-selection', text: '13K RMB' });
await wait(80);
const targetSaveBubble = tooltipOf(targetSavePage);
const targetSaveTrigger = targetSaveBubble && targetSaveBubble.querySelector
  ? targetSaveBubble.querySelector('.unicorn-target-trigger')
  : null;

if (targetSaveTrigger) {
  const handlers = targetSaveTrigger._listeners && targetSaveTrigger._listeners.click;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: targetSaveTrigger, stopPropagation: function () {} });
  }
}

const targetSaveList = targetSaveBubble && targetSaveBubble.querySelector
  ? targetSaveBubble.querySelector('.unicorn-source-list')
  : null;
const eurItem = findMenuCurrencyItem(targetSaveList, 'EUR');

if (eurItem && eurItem._listeners && eurItem._listeners.click) {
  const handlers = eurItem._listeners.click;
  for (const handler of Array.isArray(handlers) ? handlers : []) {
    handler({ target: eurItem, stopPropagation: function () {} });
  }
}
await wait(50);

check(
  targetSavePage.stored['uniconv.targetCurrency'] !== 'EUR',
  "changer la cible dans une bulle ne modifie pas la devise par defaut",
  JSON.stringify(targetSavePage.stored['uniconv.targetCurrency'])
);

// ---------------------------------------------------------------------------
console.log('');
console.log('18. Statistiques publiees pour le popup');
// ---------------------------------------------------------------------------

// Une page contenant un piege : le rejet doit etre comptabilise et remonte
// jusqu'au stockage, pour que le popup puisse l'afficher.
const trapPage = await boot(
  ['chapitre 10\u20AC ', 'un vrai prix a 25\u20AC '],
  { host: 'www.exemple.fr' }
);

await wait(1200);

const trapStats = trapPage.stored['uniconv.observerStats'] || {};
const trapRejections = trapStats.rejections || {};

check(
  (trapRejections.numbering || 0) >= 1,
  'les nombres ecartes sont comptes par regle (numerotation)',
  `rejets : ${JSON.stringify(trapRejections)}`);

check(
  countHighlights(trapPage) === 1,
  'sur la meme page, le vrai prix reste converti',
  `montants : ${countHighlights(trapPage)}`);

check(
  trapStats.host === 'www.exemple.fr',
  'le nom d\'hote accompagne les statistiques',
  `hote : ${JSON.stringify(trapStats.host)}`);

// Les statistiques sont volontairement ecrites au maximum une fois par
// seconde : on laisse donc passer ce delai avant de les verifier.
await wait(1300);

check(
  typeof loadPage.stored['uniconv.observerStats'] === 'object' &&
  loadPage.stored['uniconv.observerStats'] !== null,
  'les statistiques sont ecrites dans le stockage',
  JSON.stringify(loadPage.stored['uniconv.observerStats'] || null));

const stats = loadPage.stored['uniconv.observerStats'] || {};

check(
  typeof stats.nodes === 'number' && stats.nodes >= 500,
  'le compteur de blocs analyses est renseigne',
  `nodes = ${stats.nodes}`);

check(
  typeof stats.batches === 'number' && stats.batches >= 1,
  'le compteur de lots traites est renseigne',
  `batches = ${stats.batches}`);

// ---------------------------------------------------------------------------
console.log('');
console.log('19. Fuseaux horaires : detection, bulle, menu des villes (iteration 11)');
// ---------------------------------------------------------------------------

const tzPage = await boot(['La reunion commence a 14:30 CET.'], {
  host: 'www.exemple.fr',
  storage: { 'uniconv.targetTimezone': 'UTC', 'uniconv.timeFormat': '24' }
});

const tzTextNode = tzPage.body.children[0].children[0];
const tzTextValue = String(tzTextNode.nodeValue || '');
const tzOffset = tzTextValue.indexOf('14:30');

check(tzOffset !== -1, 'le texte de test contient bien l\'heure');

tzPage.document._caret = { offsetNode: tzTextNode, offset: tzOffset + 2 };
tzPage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

const tzBubble = tooltipOf(tzPage);

check(
  Boolean(tzBubble) && tzBubble.style.display === 'block' &&
    String(tzBubble.textContent).includes('13h30'),
  'le survol de « 14:30 CET » affiche 13h30 (cible UTC)',
  tzBubble ? JSON.stringify(tzBubble.textContent) : 'aucune bulle');

check(
  Boolean(tzBubble) && String(tzBubble.textContent).includes('-1 h'),
  'la bulle annonce le decalage (UTC est 1 h derriere CET)',
  tzBubble ? JSON.stringify(tzBubble.textContent) : 'aucune bulle');

check(
  Boolean(tzPage.highlights.get('unicorn-amount')) && countHighlights(tzPage) >= 1,
  'l\'heure avec fuseau est soulignee comme un montant',
  `surlignage : ${tzPage.highlights.get('unicorn-amount') ? countHighlights(tzPage) : 0}`);

// Clic : la bulle se fige et le menu des villes s'ouvre.
tzPage.document._listeners.click[0]({ clientX: 100, clientY: 100, target: null });
await wait(20);

const tzPicker = tzBubble.children.find(
  (child) => child.className === 'unicorn-currency-picker');

check(Boolean(tzPicker), 'au clic, le menu des villes s\'ouvre',
  tzBubble ? tzBubble.children.map((child) => child.className).join(', ') : 'aucune bulle');

const tzList = tzPicker && tzPicker.children.find(
  (child) => child.className === 'unicorn-currency-list');

check(
  Boolean(tzList) && tzList.children.some(
    (child) => child.getAttribute && child.getAttribute('data-zone') === 'Asia/Tokyo'),
  'le menu propose Tokyo');

const tokyoItem = tzList && tzList.children.find(
  (child) => child.getAttribute && child.getAttribute('data-zone') === 'Asia/Tokyo');

if (tokyoItem) {
  tokyoItem._listeners.click[0]({ target: tokyoItem, stopPropagation: function () {} });
}
await wait(20);

check(
  Boolean(tzBubble) && String(tzBubble.textContent).includes('22h30'),
  'apres le choix de Tokyo, la bulle affiche 22h30',
  tzBubble ? JSON.stringify(tzBubble.textContent) : 'aucune bulle');

check(
  Boolean(tzPicker) && /Tokyo \(GMT\+9\)/.test(String(tzPicker.textContent)),
  'le menu affiche « Tokyo (GMT+9) » (decalage a cote de la ville)',
  tzPicker ? JSON.stringify(String(tzPicker.textContent).slice(0, 120)) : 'aucun menu');

check(
  Boolean(tzPicker) && /Mumbai \(GMT\+5:30\)/.test(String(tzPicker.textContent)),
  'les decalages a la demi-heure sont affiches (Mumbai GMT+5:30)');

check(
  tzPage.stored['uniconv.targetTimezone'] !== 'Asia/Tokyo',
  'le choix de la ville ne devient pas le fuseau par defaut');

// Echap ferme la bulle figee (accessibilite clavier).
tzPage.pressKey({
  key: 'Escape',
  code: 'Escape',
  altKey: false,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false
});
await wait(20);

check(
  !tooltipOf(tzPage) || tooltipOf(tzPage).style.display === 'none',
  'Echap ferme la bulle figee (accessibilite clavier)');

// Un texte SANS fuseau ne doit jamais etre converti.
const noZonePage = await boot(['Le train part a 14:30.'], { host: 'www.exemple.fr' });
const noZoneText = noZonePage.body.children[0].children[0];
noZonePage.document._caret = {
  offsetNode: noZoneText,
  offset: String(noZoneText.nodeValue).indexOf('14:30') + 2
};
noZonePage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

check(
  !tooltipOf(noZonePage) || tooltipOf(noZonePage).style.display === 'none',
  'une heure SANS fuseau n\'ouvre aucune bulle');

// ---------------------------------------------------------------------------
console.log('');
// La cible choisie doit afficher la ville ET son fuseau.
const tzParisPage = await boot(['La reunion commence a 14:30 CET.'], {
  host: 'www.exemple.fr',
  storage: { 'uniconv.targetTimezone': 'Europe/Paris', 'uniconv.timeFormat': '24' }
});
const tzParisNode = tzParisPage.body.children[0].children[0];
const tzParisOffset = String(tzParisNode.nodeValue || '').indexOf('14:30');
tzParisPage.document._caret = { offsetNode: tzParisNode, offset: tzParisOffset + 2 };
tzParisPage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);
const tzParisBubble = tooltipOf(tzParisPage);
check(
  Boolean(tzParisBubble) && String(tzParisBubble.textContent).includes('à Paris'),
  'la première ligne affiche « 14h30 à Paris »',
  tzParisBubble ? JSON.stringify(tzParisBubble.textContent) : 'aucune bulle');

// ---------------------------------------------------------------------------
console.log('');
console.log('19bis. Fourchettes de prix : « 2000 - 3000 CNY » (site d\'emploi)');
// ---------------------------------------------------------------------------

const rangePage = await boot(['Salary Range : 2000 - 3000 CNY /Day'], {
  host: 'jobs.exemple.com'
});

const rangeNode = rangePage.body.children[0].children[0];
const rangeOffset = String(rangeNode.nodeValue || '').indexOf('2000');
rangePage.document._caret = { offsetNode: rangeNode, offset: rangeOffset + 2 };
rangePage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

const rangeBubble = tooltipOf(rangePage);

check(
  Boolean(rangeBubble) && rangeBubble.style.display === 'block' &&
    /2[\s,.]?000/.test(String(rangeBubble.textContent)) &&
    /3[\s,.]?000/.test(String(rangeBubble.textContent)),
  'le survol de « 2000 » affiche la fourchette 2 000 – 3 000 CNY',
  rangeBubble ? JSON.stringify(rangeBubble.textContent) : 'aucune bulle');

check(
  Boolean(rangeBubble) &&
    /2[\s,.]?200/.test(String(rangeBubble.textContent)) &&
    /3[\s,.]?300/.test(String(rangeBubble.textContent)),
  'la fourchette est convertie avec le meme taux (2 200 – 3 300)',
  rangeBubble ? JSON.stringify(rangeBubble.textContent) : 'aucune bulle');

check(
  countHighlights(rangePage) === 1,
  'la fourchette ne produit qu\'une seule surbrillance',
  `surlignages : ${countHighlights(rangePage)}`);

// Cas reel FLE : « Entre 70.000 et 80.000 PHP » (milliers a points).
const flePage = await boot(
  ['Rémunération : Entre 70.000 et 80.000 PHP selon les heures.'],
  { host: 'www.fle.fr' }
);
const fleNode = flePage.body.children[0].children[0];
const fleOffset = String(fleNode.nodeValue || '').indexOf('70.000');
flePage.document._caret = { offsetNode: fleNode, offset: fleOffset + 2 };
flePage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

const fleBubble = tooltipOf(flePage);
check(
  Boolean(fleBubble) && fleBubble.style.display === 'block' &&
    /70[\s,.]?000/.test(String(fleBubble.textContent)) &&
    /80[\s,.]?000/.test(String(fleBubble.textContent)),
  'FLE : « Entre 70.000 et 80.000 PHP » affiche la fourchette',
  fleBubble ? JSON.stringify(fleBubble.textContent) : 'aucune bulle');

check(
  Boolean(fleBubble) &&
    /77[\s,.]?000/.test(String(fleBubble.textContent)) &&
    /88[\s,.]?000/.test(String(fleBubble.textContent)),
  'FLE : la fourchette PHP est convertie (77 000 – 88 000)',
  fleBubble ? JSON.stringify(fleBubble.textContent) : 'aucune bulle');

// FLE Mexique : « 135 pesos l'heure » (nom generique).
const mxPage = await boot(
  ["Rémunération : 135 pesos l'heure en groupe."],
  { host: 'www.fle.fr' }
);
const mxNode = mxPage.body.children[0].children[0];
const mxOffset = String(mxNode.nodeValue || '').indexOf('135');
mxPage.document._caret = { offsetNode: mxNode, offset: mxOffset + 1 };
mxPage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

const mxBubble = tooltipOf(mxPage);
check(
  Boolean(mxBubble) && mxBubble.style.display === 'block' &&
    /135/.test(String(mxBubble.textContent)) &&
    /MXN/.test(String(mxBubble.textContent)) &&
    /148[.,]5/.test(String(mxBubble.textContent)),
  'FLE Mexique : « 135 pesos » -> 135 MXN converti',
  mxBubble ? JSON.stringify(mxBubble.textContent) : 'aucune bulle');

// FLE Brunéi : « 500BND net d'impôt » (code colle, sans espace).
const bndPage = await boot(
  ["Rémunération : 500BND net d'impôt."],
  { host: 'www.fle.fr' }
);
const bndNode = bndPage.body.children[0].children[0];
const bndOffset = String(bndNode.nodeValue || '').indexOf('500');
bndPage.document._caret = { offsetNode: bndNode, offset: bndOffset + 1 };
bndPage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

const bndBubble = tooltipOf(bndPage);
check(
  Boolean(bndBubble) && bndBubble.style.display === 'block' &&
    /500/.test(String(bndBubble.textContent)) &&
    /BND/.test(String(bndBubble.textContent)) &&
    /550/.test(String(bndBubble.textContent)),
  'FLE Brunéi : « 500BND » -> 500 BND converti',
  bndBubble ? JSON.stringify(bndBubble.textContent) : 'aucune bulle');

// Devise nouvelle (hors des 46 historiques) : « 500 KWD ».
const kwdPage = await boot(['Salaire : 500 KWD par mois.'], { host: 'www.exemple.com' });
const kwdNode = kwdPage.body.children[0].children[0];
const kwdOffset = String(kwdNode.nodeValue || '').indexOf('500');
kwdPage.document._caret = { offsetNode: kwdNode, offset: kwdOffset + 1 };
kwdPage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

const kwdBubble = tooltipOf(kwdPage);
check(
  Boolean(kwdBubble) && kwdBubble.style.display === 'block' &&
    /500/.test(String(kwdBubble.textContent)) &&
    /KWD/.test(String(kwdBubble.textContent)) &&
    /550/.test(String(kwdBubble.textContent)),
  'devise nouvelle : « 500 KWD » est converti',
  kwdBubble ? JSON.stringify(kwdBubble.textContent) : 'aucune bulle');

console.log('20. Performance de la detection (prose et DOM profond)');
// ---------------------------------------------------------------------------

// a) 2 000 paragraphes de PROSE, sans aucun chiffre. Les formats numeriques
//    ne peuvent pas correspondre : le court-circuit doit eviter de les lancer.
const prosePage = await boot([], { host: 'www.exemple.fr' });
const proseNodes = [];
for (let index = 0; index < 2000; index += 1) {
  const paragraph = createElement('p');
  paragraph.appendChild(createText(
    'Le service est rapide, fiable et disponible partout dans le monde.'));
  prosePage.body.appendChild(paragraph);
  proseNodes.push(paragraph);
}
const proseMarker = createElement('p');
proseMarker.appendChild(createText('Prix : 10\u20AC'));
prosePage.body.appendChild(proseMarker);
proseNodes.push(proseMarker);

let proseStart = Date.now();
prosePage.observer.emit([{ type: 'childList', target: prosePage.body, addedNodes: proseNodes }]);
while (Date.now() - proseStart < 5000 && countHighlights(prosePage) === 0) {
  await wait(25);
}
const proseMs = Date.now() - proseStart;

check(
  countHighlights(prosePage) >= 1,
  'la prose sans chiffre est analysee (le prix temoin est trouve)',
  `${proseMs} ms`);
check(proseMs < 2500,
  '2 000 paragraphes de prose sont analyses en moins de 2,5 s',
  `${proseMs} ms`);
console.log(`        prose (2 000 paragraphes, sans chiffre) : ${proseMs} ms`);

// b) 1 500 prix imbriques a 10 niveaux. L'ancienne version remontait toute la
//    chaine des parents pour chaque nœud ; la memoisation doit rendre le cout
//    amorti constant.
const deepPage = await boot([], { host: 'www.exemple.fr' });
const deepRoots = [];
for (let index = 0; index < 1500; index += 1) {
  let container = createElement('div');
  const root = container;
  for (let level = 0; level < 10; level += 1) {
    const child = createElement('div');
    container.appendChild(child);
    container = child;
  }
  container.appendChild(createText('Prix : 10\u20AC'));
  deepPage.body.appendChild(root);
  deepRoots.push(root);
}

let deepStart = Date.now();
deepPage.observer.emit([{ type: 'childList', target: deepPage.body, addedNodes: deepRoots }]);
while (Date.now() - deepStart < 5000 && countHighlights(deepPage) < 1500) {
  await wait(25);
}
const deepMs = Date.now() - deepStart;

check(
  countHighlights(deepPage) >= 1500,
  '1 500 prix imbriques a 10 niveaux sont detectes',
  `trouves : ${countHighlights(deepPage)} en ${deepMs} ms`);
check(deepMs < 2500,
  'le DOM profond est analyse en moins de 2,5 s',
  `${deepMs} ms`);
console.log(`        DOM profond (1 500 prix x 10 niveaux) : ${deepMs} ms`);

// ---------------------------------------------------------------------------
console.log('');
console.log('21. Court-circuit du survol sur une page sans aucun montant');
// ---------------------------------------------------------------------------

const emptyPage = await boot(
  ['Le service est rapide et fiable, sans le moindre montant.'],
  { host: 'www.exemple.fr' }
);

let caretCalls = 0;
let stackCalls = 0;
const caretOriginal = emptyPage.document.caretPositionFromPoint;
const stackOriginal = emptyPage.document.elementsFromPoint;

emptyPage.document.caretPositionFromPoint = function (...args) {
  caretCalls += 1;
  return caretOriginal.apply(this, args);
};
emptyPage.document.elementsFromPoint = function (...args) {
  stackCalls += 1;
  return stackOriginal.apply(this, args);
};

emptyPage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

check(
  caretCalls === 0 && stackCalls === 0,
  'page sans montant : aucun test de position au survol (cout nul)',
  `caret ${caretCalls}, pile ${stackCalls}`);

// « unreal » ne doit PAS etre lu comme « un real » (real bresilien).
const unrealPage = await boot(['unreal engine is source-available.'], { host: 'www.exemple.fr' });
check(
  countHighlights(unrealPage) === 0,
  '« unreal » n\'est pas un real bresilien (aucune detection)',
  `surlignages : ${countHighlights(unrealPage)}`);

// Controle : sur une page AVEC un montant, le test a bien lieu.
const pricePage = await boot(['Prix : 10\u20AC'], { host: 'www.exemple.fr' });
let priceCaretCalls = 0;
const priceCaretOriginal = pricePage.document.caretPositionFromPoint;
pricePage.document.caretPositionFromPoint = function (...args) {
  priceCaretCalls += 1;
  return priceCaretOriginal.apply(this, args);
};
pricePage.document._listeners.mousemove[0]({ clientX: 100, clientY: 100 });
await wait(80);

check(
  priceCaretCalls > 0,
  'page avec un montant : le test de position a bien lieu',
  `${priceCaretCalls} appel(s)`);

// ---------------------------------------------------------------------------
console.log('');
console.log('22. OCR : unites de mesure, quarts et heures (iteration 14)');
// ---------------------------------------------------------------------------

/** Lance le parcours OCR complet et rend la bulle resultat. */
async function ocrBubbleFor(text, storage) {
  const page = await boot(['Rien ici.'], { host: 'www.exemple.fr', storage: storage || {} });
  page.behaviour.ocrText = text;
  page.emitMessage({ type: 'start-ocr-selection' });
  await wait(20);

  const overlay = page.body.children.find(
    (child) => child.getAttribute && child.getAttribute('data-unic') === 'ocr-overlay');

  if (overlay) {
    overlay.dispatch('mousedown', { clientX: 100, clientY: 100 });
    overlay.dispatch('mousemove', { clientX: 220, clientY: 160 });
    page.releaseMouse({ clientX: 220, clientY: 160 });
  }

  await wait(260);
  return { page, bubble: tooltipOf(page) };
}

const ocrFeet = await ocrBubbleFor('6 ft 2 in');
check(
  Boolean(ocrFeet.bubble) && ocrFeet.bubble.style.display === 'block' &&
    /1[.,]88/.test(String(ocrFeet.bubble.textContent)),
  'OCR « 6 ft 2 in » : la bulle convertit l\'unite (1,88 m)',
  ocrFeet.bubble ? JSON.stringify(ocrFeet.bubble.textContent) : 'aucune bulle');

const ocrFahrenheit = await ocrBubbleFor('68 °F');
check(
  Boolean(ocrFahrenheit.bubble) &&
    String(ocrFahrenheit.bubble.textContent).includes('20'),
  'OCR « 68 °F » : la bulle convertit la temperature',
  ocrFahrenheit.bubble ? JSON.stringify(ocrFahrenheit.bubble.textContent) : 'aucune bulle');

const ocrQuarts = await ocrBubbleFor('2 quarts');
check(
  Boolean(ocrQuarts.bubble) &&
    /1[.,]89/.test(String(ocrQuarts.bubble.textContent)),
  'OCR « 2 quarts » : la bulle convertit les quarts (1,89 L)',
  ocrQuarts.bubble ? JSON.stringify(ocrQuarts.bubble.textContent) : 'aucune bulle');

const ocrFraction = await ocrBubbleFor('1/2 cup');
check(
  Boolean(ocrFraction.bubble) && /118[.,]29/.test(String(ocrFraction.bubble.textContent)),
  'OCR « 1/2 cup » (fraction) : la bulle convertit (118,29 ml)',
  ocrFraction.bubble ? JSON.stringify(ocrFraction.bubble.textContent) : 'aucune bulle');

const ocrKelvin = await ocrBubbleFor('300 K');
check(
  Boolean(ocrKelvin.bubble) && /26[.,]85/.test(String(ocrKelvin.bubble.textContent)),
  'OCR « 300 K » : la bulle convertit en °C (26,85)',
  ocrKelvin.bubble ? JSON.stringify(ocrKelvin.bubble.textContent) : 'aucune bulle');

const ocrCaps = await ocrBubbleFor('2.1 QT');
check(
  Boolean(ocrCaps.bubble) && /1[.,]99/.test(String(ocrCaps.bubble.textContent)),
  'OCR « 2.1 QT » (majuscules) : la bulle convertit (1,99 L)',
  ocrCaps.bubble ? JSON.stringify(ocrCaps.bubble.textContent) : 'aucune bulle');

const ocrPounds = await ocrBubbleFor('180 lb');
check(
  Boolean(ocrPounds.bubble) &&
    /81[.,]65/.test(String(ocrPounds.bubble.textContent)),
  'OCR « 180 lb » : la bulle convertit le poids (81,65 kg)',
  ocrPounds.bubble ? JSON.stringify(ocrPounds.bubble.textContent) : 'aucune bulle');

const ocrMph = await ocrBubbleFor('60 mph');
check(
  Boolean(ocrMph.bubble) &&
    /96[.,]56/.test(String(ocrMph.bubble.textContent)),
  'OCR « 60 mph » : la bulle convertit la vitesse (96,56 km/h)',
  ocrMph.bubble ? JSON.stringify(ocrMph.bubble.textContent) : 'aucune bulle');

check(
  Boolean(ocrQuarts.bubble) && ocrQuarts.bubble.children.some(
    (child) => String(child.className).indexOf('unicorn-unit-picker') === 0),
  'OCR d\'une unité : le menu des unités est ouvert (parité avec un clic)',
  ocrQuarts.bubble ? ocrQuarts.bubble.children.map((child) => child.className).join(', ') : 'aucune bulle');

const ocrTime = await ocrBubbleFor('14:30 CET', {
  'uniconv.targetTimezone': 'UTC',
  'uniconv.timeFormat': '24'
});
check(
  Boolean(ocrTime.bubble) &&
    String(ocrTime.bubble.textContent).includes('13h30'),
  'OCR « 14:30 CET » : la bulle convertit l\'heure (13h30 UTC)',
  ocrTime.bubble ? JSON.stringify(ocrTime.bubble.textContent) : 'aucune bulle');

check(
  Boolean(ocrTime.bubble) && ocrTime.bubble.children.some(
    (child) => String(child.className).indexOf('unicorn-currency-picker') === 0),
  'OCR d\'une heure : le menu des villes est ouvert (parité avec un clic)',
  ocrTime.bubble ? ocrTime.bubble.children.map((child) => child.className).join(', ') : 'aucune bulle');

const ocrNothing = await ocrBubbleFor('aucun nombre ici');
check(
  Boolean(ocrNothing.bubble) &&
    String(ocrNothing.bubble.textContent).includes('aucun montant'),
  'OCR sans conversion : la page le dit clairement',
  ocrNothing.bubble ? JSON.stringify(ocrNothing.bubble.textContent) : 'aucune bulle');

// ---------------------------------------------------------------------------
console.log('');
console.log('============================================================');
console.log(`  Resultat : ${passed} reussi(s), ${failed} echec(s)`);
console.log('============================================================');

process.exit(failed === 0 ? 0 : 1);
