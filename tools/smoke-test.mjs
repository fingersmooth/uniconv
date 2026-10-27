/**
 * ============================================================================
 *  UniConv — tools/smoke-test.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Executer src/content.js de bout en bout dans un faux navigateur, pour
 *  verifier qu'il fonctionne reellement — et pas seulement qu'il est bien
 *  ecrit.
 *
 *  POURQUOI CET OUTIL EXISTE
 *  -------------------------
 *  Un bug reel, rencontre lors du premier test de l'iteration 1 :
 *
 *      [UniConv] surlignage indisponible : foundByNode.forEach is not a function
 *
 *  Une WeakMap n'a PAS de methode forEach (elle n'a que get, set, has et
 *  delete). Cette erreur etait invisible a la lecture, invisible aux tests de
 *  l'expression reguliere, et invisible au controle de syntaxe : le fichier
 *  etait parfaitement valide, il plantait seulement a l'execution.
 *
 *  Ce fichier simule donc le minimum du navigateur (document, NodeFilter,
 *  Highlight, CSS, window) et execute le vrai code de l'extension. Toute
 *  erreur d'execution est ainsi detectee en deux secondes, sans ouvrir Firefox.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/smoke-test.mjs
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

// ===========================================================================
//  1. Faux navigateur
// ===========================================================================

/** Cree un faux nœud de texte, avec la seule propriete utile : son contenu. */
function textNode(value) {
  const node = {
    nodeType: 3,
    nodeValue: value,
    parentNode: null,
    isConnected: true,
    // Comme dans un vrai navigateur : le parent se deduit de l'arbre.
    // Depuis la reconstitution du texte (« suites », prix coupes en plusieurs
    // balises), cette chaine est indispensable : c'est elle qui determine
    // quels morceaux voisins doivent etre analyses ensemble.
    get parentElement() {
      const parent = node.parentNode;
      return parent && parent.nodeType === 1 ? parent : null;
    }
  };
  return node;
}

/**
 * Cree un faux element.
 *
 * On reproduit uniquement ce dont l'extension se sert : les attributs et
 * l'ajout d'enfants. Inutile de simuler tout un navigateur.
 */
function element(tagName) {
  const attributes = new Map();
  const node = {
    // « nodeType » et « parentElement » sont indispensables depuis
    // l'iteration 7bis : la recherche d'un montant dans une image remonte la
    // chaine des parents en testant « nodeType === 1 ». Sans ces proprietes,
    // le faux element serait invisible et le test echouerait pour une raison
    // qui n'a rien a voir avec le code teste.
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    children: [],
    parentNode: null,
    get parentElement() {
      const parent = node.parentNode;
      return parent && parent.nodeType === 1 ? parent : null;
    },
    style: {},
    _className: '',
    get className() { return this._className; },
    set className(value) { this._className = String(value); },
    _text: '',
    get firstChild() {
      return this.children[0] || null;
    },

    /**
     * Comme dans un vrai navigateur, « textContent » represente TOUT le texte
     * de l'element, y compris celui de ses enfants.
     *
     * La bulle a maintenant deux lignes (la conversion et le taux), chacune
     * dans un element separe. Si le simulateur ne lisait que le texte direct,
     * il verrait une bulle vide alors qu'elle contient du texte.
     */
    get textContent() {
      if (this.children.length === 0) {
        return this._text;
      }
      return this.children.map((child) => child.textContent).join('');
    },
    set textContent(value) {
      this._text = String(value);
      // Ecrire textContent efface les enfants, comme dans un navigateur.
      this.children.length = 0;
    },
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => attributes.get(name) || null,
    hasAttribute: (name) => attributes.has(name),
    // Les ecouteurs sont memorises pour pouvoir simuler un clic dans les
    // tests (epinglage, choix de devise).
    _listeners: {},
    addEventListener: function (type, handler) {
      this._listeners[type] = handler;
    },
    click: function () {
      const handler = this._listeners.click;
      if (typeof handler === 'function') {
        handler({ target: this, stopPropagation: function () {} });
      }
    },
    contains: function () { return false; },
    focus: function () {},
    querySelector: function (selector) {
      if (typeof selector !== 'string' || selector.charAt(0) !== '.') {
        return null;
      }
      const wanted = selector.slice(1);
      function find(node) {
        for (const child of node.children) {
          const classes = String(child.className || '').split(/\s+/);
          if (classes.indexOf(wanted) !== -1) return child;
          const deeper = find(child);
          if (deeper) return deeper;
        }
        return null;
      }
      return find(this);
    },
    appendChild: function (child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    insertBefore: function (child, reference) {
      child.parentNode = this;
      const index = reference ? this.children.indexOf(reference) : -1;
      if (index === -1) this.children.push(child);
      else this.children.splice(index, 0, child);
      return child;
    },
    insertAdjacentElement: function (position, element) {
      element.parentNode = this.parentNode;
      if (this.parentNode && this.parentNode.children) {
        const index = this.parentNode.children.indexOf(this);
        this.parentNode.children.splice(index + 1, 0, element);
      }
      return element;
    },
    remove: function () {
      if (this.parentNode && this.parentNode.children) {
        const index = this.parentNode.children.indexOf(this);
        if (index !== -1) this.parentNode.children.splice(index, 1);
      }
    },
    getBoundingClientRect: () => ({
      width: 200, height: 26, top: 0, left: 0,
      right: 200, bottom: 26, x: 0, y: 0
    })
  };

  // classList minimal (add / remove / contains), utilise par la bulle.
  node.classList = {
    add(name) {
      const list = new Set(String(node._className || '').split(/\s+/).filter(Boolean));
      list.add(name);
      node._className = Array.from(list).join(' ');
    },
    remove(name) {
      const list = new Set(String(node._className || '').split(/\s+/).filter(Boolean));
      list.delete(name);
      node._className = Array.from(list).join(' ');
    },
    contains(name) {
      return String(node._className || '').split(/\s+/).indexOf(name) !== -1;
    }
  };

  return node;
}

/**
 * Construit le faux environnement et retourne les objets a inspecter ensuite.
 *
 * @param {Array<{text: string}>} texts - les textes presents dans la page
 * @param {object} [options]
 * @param {number} [options.cursorOffset] - position du curseur dans le premier
 *   texte, en nombre de caracteres. Permet de simuler la souris sur un montant
 *   ou juste a cote.
 */
function buildFakeBrowser(texts, options = {}) {
  const cursorOffset = options.cursorOffset === undefined ? 11 : options.cursorOffset;
  const nodes = texts.map((entry) => textNode(entry.text));
  const body = element('body');
  const head = element('head');

  const documentElement = element('html');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  // Chaque texte est place dans son propre paragraphe, lui-meme dans <body> :
  // c'est un vrai arbre, et non une liste plate.
  for (const node of nodes) {
    const paragraph = element('p');
    paragraph.appendChild(node);
    body.appendChild(paragraph);
  }

  const document = {
    body,
    head,
    documentElement,
    createElement: (tag) => element(tag),
    querySelector: () => null,

    // Iteration 7bis : les montants caches dans les attributs des images.
    // Le faux document ne renvoie que les images fournies par le test.
    querySelectorAll: (selector) => {
      if (typeof selector !== 'string' || selector.indexOf('img') !== 0) {
        return [];
      }
      return options.images || [];
    },
    elementFromPoint: () => (options.pointElement === undefined ? null : options.pointElement),

    // Parcours des nœuds de texte SOUS UNE RACINE DONNEE, comme le vrai
    // « document.createTreeWalker ». Le respect de la racine est essentiel
    // depuis la reconstitution du texte : une suite est analysee a partir de
    // son propre conteneur, et non de la page entiere.
    createTreeWalker: (root) => {
      const found = [];
      const visit = (elementOrNode) => {
        if (!elementOrNode) {
          return;
        }
        if (elementOrNode.nodeType === 3) {
          found.push(elementOrNode);
          return;
        }
        for (const child of elementOrNode.children || []) {
          visit(child);
        }
      };
      visit(root);

      let index = -1;
      return {
        nextNode() {
          index += 1;
          return index < found.length ? found[index] : null;
        }
      };
    },

    createRange: () => ({
      setStart: () => {},
      setEnd: () => {},
      getBoundingClientRect: () => ({
        width: 40, height: 16, top: 100, left: 100,
        right: 140, bottom: 116, x: 100, y: 100
      })
    }),

    // Simule « document.caretPositionFromPoint » en respectant FIDELEMENT
    // l'API reelle : l'objet renvoye est un « CaretPosition », dont le nœud de
    // texte s'appelle **offsetNode** — et surtout PAS « node ».
    //
    // C'est essentiel : la premiere version de ce simulateur utilisait le nom
    // « node ». Le code de l'extension lisait lui aussi « node », donc le test
    // passait... alors que le vrai Firefox renvoie « offsetNode » et que la
    // bulle ne s'affichait jamais. Un simulateur doit imiter la realite, pas
    // arranger le code teste.
    //
    // On indique la position demandee par l'appelant, qui tombe soit sur le
    // montant, soit juste a cote. Cela permet de verifier que la zone sensible
    // s'arrete bien au bon endroit.
    caretPositionFromPoint: () => ({
      offsetNode: nodes[0] || null,
      offset: cursorOffset
    }),

    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const highlights = new Map();

  // Registre des evenements : c'est ce qui permet de simuler une souris.
  const listeners = {};
  const addEventListener = (type, handler) => {
    listeners[type] = handler;
  };

  const browser = {
    document,
    NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
    CSS: { highlights: highlights },
    Highlight: function (...ranges) {
      this.ranges = ranges;
      this.size = ranges.length;
    },
    Intl,
    WeakMap,
    Set,
    Map,
    Date,
    Number,
    String,
    Object,
    Array,
    Math,
    JSON,
    RegExp,
    Error,
    console,
    setTimeout,
    clearTimeout,
    Node: { TEXT_NODE: 3 },
    location: { href: 'http://localhost:8123/test/formats.html' },
    listeners: listeners
  };

  // Faux « chrome » : l'extension demande ses conversions a l'arriere-plan.
  // On simule une reponse reussie, avec un taux de 1,10 EUR -> USD.
  //
  // La reponse est renvoyee de maniere SYNCHRONE, comme le ferait un service
  // rapide : le test n'a donc pas besoin d'attendre.
  browser.chrome = {
    runtime: {
      lastError: null,
      sendMessage: (message, callback) => {
        if (message && message.type === 'convert') {
          const rate = message.from === message.to ? 1 : 1.10;
          callback({
            ok: true,
            value: message.amount * rate,
            rate: rate,
            from: message.from,
            to: message.to,
            date: '2026-10-23',
            fetchedAt: Date.now(),
            stale: false
          });
        } else {
          callback({ ok: false, error: 'type inconnu' });
        }
      }
    }
  };

  // « window » et « globalThis » pointent sur le meme objet : c'est le cas
  // dans un content script.
  browser.window = browser;
  browser.innerWidth = 1280;
  browser.innerHeight = 800;
  browser.addEventListener = addEventListener;
  browser.document.addEventListener = addEventListener;

  // Les rappels demandes par « requestAnimationFrame » sont mis en attente
  // puis declenches a la demande : c'est exactement ce que fait un navigateur
  // a l'image suivante.
  const pendingFrames = [];
  browser.requestAnimationFrame = (callback) => {
    pendingFrames.push(callback);
    return pendingFrames.length;
  };
  browser.flushAnimationFrames = () => {
    while (pendingFrames.length > 0) {
      const callback = pendingFrames.shift();
      callback();
    }
  };

  return { browser, highlights, body, nodes, document };
}

// ===========================================================================
//  2. Preparation du code a executer
// ===========================================================================

const source = readFileSync(CONTENT_FILE, 'utf8');

// On retire le bloc « 'use strict'; » isole en tete : il n'est valable qu'au
// debut d'un fichier, et notre code sera insere dans une fonction.
const prepared = source.replace(
  /^[\s\S]*?'use strict';\n/,
  '/* debut du fichier insere */\n'
);

console.log('UniConv — test d\'execution reelle du script');
console.log(`  fichier : ${CONTENT_FILE}`);
console.log('');

// ===========================================================================
//  3. Execution, avec capture des messages de la console
// ===========================================================================

const messages = [];
const capturedConsole = {
  log: (...args) => messages.push({ level: 'log', text: args.join(' ') }),
  warn: (...args) => messages.push({ level: 'warn', text: args.join(' ') }),
  error: (...args) => messages.push({ level: 'error', text: args.join(' ') })
};

// Les deux premiers textes se terminent par une ESPACE, comme dans un tableau
// HTML : « <td>Article a 10&euro;</td><td>10</td> » donne bien un espace apres
// le prix. C'est precisement ce cas qui provoquait une zone de survol trop
// large (premier paragraphe = « Article a 10€ » suivi d'une espace).
const pageTexts = [
  { text: 'Article a 10\u20AC ' },
  { text: 'Prix : 1 234,56 \u20AC ' },
  { text: 'Le modele 10 est disponible.' },
  { text: 'Le premier prix est 5\u20AC, le second 10\u20AC.' },
  { text: 'Ce texte ne contient aucun montant.' },
  { text: 'English price: \u00A310 ' },
  { text: 'Yen price: 100 JPY ' },
  { text: 'Swiss price: CHF 1 234,56 ' },
  { text: 'Anglais : $1,234.56 ' },
  { text: 'En mots : 100 dollars ' },
  { text: 'Distance : 3 miles ' },
  // Montant tres grand : sa conversion depasse l'entierete de l'ecran si elle
  // est ecrite en toutes lettres. Il doit etre affiche en notation compacte.
  { text: 'Tres gros : 12 345 678 901 \u20AC ' }
];

const { browser, highlights, body } = buildFakeBrowser(pageTexts);

/**
 * Demarre le script de l'extension dans un faux navigateur et retourne de quoi
 * l'interroger pendant le test.
 *
 * @param {object} fake - le resultat de buildFakeBrowser
 */
async function startExtension(fake) {
  const localMessages = [];
  const localConsole = {
    log: (...args) => localMessages.push({ level: 'log', text: args.join(' ') }),
    warn: (...args) => localMessages.push({ level: 'warn', text: args.join(' ') }),
    error: (...args) => localMessages.push({ level: 'error', text: args.join(' ') })
  };

  const runInFakeBrowser = new Function(
    'window', 'document', 'NodeFilter', 'CSS', 'Highlight', 'console',
    'requestAnimationFrame', 'location', 'Intl', 'WeakMap', 'Set', 'Map',
    'Date', 'Number', 'String', 'Object', 'Array', 'Math', 'JSON', 'RegExp',
    'Error', 'setTimeout', 'clearTimeout', 'chrome', 'navigator',
    `"use strict";\n${prepared}\n`
  );

  try {
    runInFakeBrowser(
      fake.browser, fake.browser.document, fake.browser.NodeFilter,
      fake.browser.CSS, fake.browser.Highlight, localConsole,
      fake.browser.requestAnimationFrame, fake.browser.location,
      Intl, WeakMap, Set, Map, Date, Number, String, Object, Array, Math,
      JSON, RegExp, Error, setTimeout, clearTimeout, fake.browser.chrome,
      { language: 'fr-FR' }
    );
  } catch (error) {
    return { error, messages: localMessages };
  }

  // Iteration 7 : le script lit d'abord ses reglages (pause, liste noire)
  // avant de lancer l'analyse. Dans un vrai navigateur, cette lecture est
  // asynchrone : on laisse donc passer un tour de boucle pour rester fidele.
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { error: null, messages: localMessages };
}

/** Envoie un deplacement de souris, comme le ferait un vrai navigateur. */
function moveMouseTo(fake, x, y) {
  const handler = fake.browser.listeners.mousemove;
  if (typeof handler === 'function') {
    handler({ clientX: x, clientY: y });
    fake.browser.flushAnimationFrames();
  }
}

/** Retourne la bulle ajoutee a la page, ou null. */
function findBubble(fake) {
  return fake.body.children.find(
    (child) => child.getAttribute && child.getAttribute('data-unic') === 'tooltip'
  ) || null;
}

console.log('1. Execution du script dans un faux navigateur');
let executionError = null;
try {
  const runInFakeBrowser = new Function(
    'window', 'document', 'NodeFilter', 'CSS', 'Highlight', 'console',
    'requestAnimationFrame', 'location', 'Intl', 'WeakMap', 'Set', 'Map',
    'Date', 'Number', 'String', 'Object', 'Array', 'Math', 'JSON', 'RegExp',
    'Error', 'setTimeout', 'clearTimeout', 'chrome', 'navigator',
    `"use strict";\n${prepared}\n`
  );

  runInFakeBrowser(
    browser, browser.document, browser.NodeFilter, browser.CSS,
    browser.Highlight, capturedConsole, browser.requestAnimationFrame,
    browser.location, Intl, WeakMap, Set, Map, Date, Number, String, Object,
    Array, Math, JSON, RegExp, Error, setTimeout, clearTimeout,
    browser.chrome, { language: 'fr-FR' }
  );
} catch (error) {
  executionError = error;
}

check(
  executionError === null,
  'le script s\'execute sans lever d\'erreur',
  executionError ? `${executionError.message}\n${executionError.stack}` : null
);

// Depuis l'iteration 7, le script lit d'abord les reglages (pause, liste noire)
// avant de lancer l'analyse. Cette lecture est ASYNCHRONE dans un vrai
// navigateur : on laisse donc passer un tour de boucle avant de verifier.
await new Promise((resolve) => setTimeout(resolve, 0));

// ===========================================================================
//  4. Verification des messages produits
// ===========================================================================

console.log('');
console.log('2. Messages ecrits dans la console');

const logs = messages.map((entry) => entry.text);

// On ne code PAS le numero en dur : il change a chaque iteration, et un test
// qui exige une version precise devient faussement rouge a chaque livraison.
// On verifie seulement que la balise affiche BIEN une version.
check(
  logs.some((text) => /content\.js \d+\.\d+\.\d+/.test(text)),
  'la balise de diagnostic affiche un numero de version',
  `messages recus : ${logs.join(' | ') || '(aucun)'}`
);

check(
  !messages.some((entry) => entry.level === 'error'),
  'aucun message d\'erreur',
  messages.filter((entry) => entry.level === 'error').map((entry) => entry.text).join(' | ')
);

const warnings = messages.filter((entry) => entry.level === 'warn');
check(
  warnings.length === 0,
  'aucun avertissement (donc pas de fonction inexistante)',
  warnings.map((entry) => entry.text).join(' | ')
);

const analysisLine = logs.find((text) => text.includes('analyse terminee'));
check(
  Boolean(analysisLine),
  'l\'analyse de la page aboutit',
  `messages recus : ${logs.join(' | ')}`
);

// 5 textes de base : 10€, 1 234,56 €, puis 5€ et 10€ = 4 montants.
// 5 textes multidevises : £10, 100 JPY, CHF, $1,234.56, 100 dollars = 5 de plus.
// 1 tres gros montant = 1 de plus.
// Total attendu : 11. Le texte « Le modele 10 est disponible. » ne donne rien.
check(
  Boolean(analysisLine) && analysisLine.includes('11 montant'),
  'le nombre de montants detectes est correct (11 attendus)',
  analysisLine
);

// ===========================================================================
//  5. Verification du surlignage (c'est ici que se trouvait le bug)
// ===========================================================================

console.log('');
console.log('3. Soulignement des montants');

const highlightKeys = Array.from(highlights.keys());
check(
  highlightKeys.includes('unicorn-amount'),
  'le surlignage est enregistre aupres du navigateur',
  `clefs presentes : ${highlightKeys.join(', ') || '(aucune)'}`
);

const recorded = highlights.get('unicorn-amount');
check(
  Boolean(recorded) && recorded.size === 11,
  'les 11 montants (devises ET unites) sont bien surlignes',
  recorded ? `${recorded.size} plage(s) enregistree(s)` : 'aucune plage'
);

// ===========================================================================
//  6. Verification du survol de la souris
// ===========================================================================
//
// C'est le cœur de l'extension : sans cette partie, aucune bulle n'apparait.
// Le faux navigateur indique que la souris se trouve sur le caractere numero 2
// du premier texte, c'est-a-dire a l'interieur de « 10€ ».

console.log('');
console.log('4. Survol de la souris et affichage de la bulle');

if (executionError) {
  check(false, 'le survol peut etre teste', 'le script n\'a pas demarre');
} else {
  // La bulle doit avoir ete ajoutee au body au demarrage.
  const bubble = body.children.find(
    (child) => child.getAttribute && child.getAttribute('data-unic') === 'tooltip'
  );
  check(Boolean(bubble), 'la bulle est creee et ajoutee a la page',
        `enfants du body : ${body.children.length}`);

  // On simule le comportement reel du navigateur : le script s'abonne a
  // l'evenement « mousemove », puis nous lui envoyons un deplacement de
  // souris. On teste donc le VRAI chemin d'execution, sans avoir a exposer
  // les fonctions internes du fichier.
  const listeners = browser.listeners || {};

  check(
    typeof listeners.mousemove === 'function',
    'le script s\'abonne aux deplacements de la souris',
    `evenements enregistres : ${Object.keys(listeners).join(', ') || '(aucun)'}`
  );

  let hoverError = null;
  try {
    if (typeof listeners.mousemove === 'function') {
      listeners.mousemove({ clientX: 200, clientY: 200 });
      // Le script repousse le traitement a l'image suivante : on declenche
      // donc les rappels que le faux navigateur a mis en attente.
      browser.flushAnimationFrames();
    }
  } catch (error) {
    hoverError = error;
  }
  check(hoverError === null, 'le survol ne leve pas d\'erreur',
        hoverError ? `${hoverError.message}\n${hoverError.stack}` : null);

  if (bubble) {
    check(bubble.style.display === 'block',
          'la bulle devient visible au survol d\'un montant',
          `display = ${JSON.stringify(bubble.style.display)}`);

    // Le texte immediat doit annoncer que la conversion est en route.
    check(
      typeof bubble.textContent === 'string' &&
      bubble.textContent.includes('conversion'),
      'la bulle annonce la conversion en cours',
      `contenu = ${JSON.stringify(bubble.textContent)}`
    );

    // On laisse la promesse de conversion se resoudre. Le faux « chrome »
    // repond immediatement, mais la reponse passe par une micro-tache : il
    // faut donc rendre la main a la boucle d'evenements.
    await new Promise((resolve) => setTimeout(resolve, 0));

    check(
      typeof bubble.textContent === 'string' && bubble.textContent.includes('USD'),
      'la bulle affiche la valeur convertie',
      `contenu = ${JSON.stringify(bubble.textContent)}`
    );
    check(
      typeof bubble.textContent === 'string' && bubble.textContent.includes('11'),
      'la conversion reelle est affichee (10 EUR -> 11 USD)',
      `contenu = ${JSON.stringify(bubble.textContent)}`
    );
    // La DATE a ete retiree de la bulle a la demande de l'utilisateur :
    // elle sortait de la bulle et devenait illisible. Elle reste consultable
    // dans le popup.
    check(
      typeof bubble.textContent === 'string' && !bubble.textContent.includes('2026'),
      'la date du taux n\'est PAS affichee dans la bulle',
      `contenu = ${JSON.stringify(bubble.textContent)}`
    );

    // Le taux reste affiche, sur une seconde ligne.
    check(
      typeof bubble.textContent === 'string' && bubble.textContent.includes('1 EUR = '),
      'la bulle affiche le taux applique sur une seconde ligne',
      `contenu = ${JSON.stringify(bubble.textContent)}`
    );

    // Au survol, la conversion et le detail sont dans DEUX elements separes,
    // SANS menu deroulant (le menu n'apparait qu'au clic).
    check(
      bubble.children && bubble.children.length === 2,
      'au survol : conversion et taux, sans menu deroulant',
      `enfants = ${bubble.children ? bubble.children.length : 'aucun'}`
    );
    check(
      typeof bubble.style.left === 'string' && bubble.style.left.endsWith('px'),
      'la bulle est positionnee a l\'ecran',
      `left = ${JSON.stringify(bubble.style.left)}, top = ${JSON.stringify(bubble.style.top)}`
    );

    // Puis on simule une souris qui quitte la fenetre : la bulle doit partir.
    if (typeof listeners.mouseleave === 'function') {
      listeners.mouseleave();
    }
    check(bubble.style.display === 'none',
          'la bulle disparait quand la souris quitte la fenetre',
          `display = ${JSON.stringify(bubble.style.display)}`);
  }
}

// ===========================================================================
//  7. Limite de la zone sensible (bug signale par l'utilisateur)
// ===========================================================================
//
// BUG REELLEMENT CONSTATÉ SUR LA PAGE DE TEST
// -------------------------------------------
// Le texte du premier paragraphe est « Article a 10€ » suivi d'une ESPACE,
// parce que dans un tableau HTML le contenu d'une cellule est suivi d'un
// espace avant la balise suivante.
//
// L'expression reguliere capturait cet espace final dans le montant. Resultat :
// la bulle apparaissait non seulement sur « 10 € », mais sur tout l'espace
// vide a droite du prix, jusqu'a la colonne suivante du tableau.
//
// Ce test verifie les deux cotes de la limite.

console.log('');
console.log('5. Limite de la zone sensible au survol');

const boundaryTexts = [{ text: 'Article a 10\u20AC ' }];

// Caracteres du texte ci-dessus, avec leur numero :
//   0:A 1:r 2:t 3:i 4:c 5:l 6:e 7:(espace) 8:a 9:(espace)
//   10:1 11:0 12:€ 13:(espace final)
const AMOUNT_MIDDLE = 11;   // sur le « 0 » de 10 €
const TRAILING_SPACE = 13;  // sur l'espace situe APRES le montant

// --- Cas 1 : la souris est sur le montant -> la bulle doit apparaitre -------
const onAmount = buildFakeBrowser(boundaryTexts, { cursorOffset: AMOUNT_MIDDLE });
const runOnAmount = await startExtension(onAmount);
check(runOnAmount.error === null, 'demarrage du test (souris sur le montant)',
      runOnAmount.error ? runOnAmount.error.message : null);
moveMouseTo(onAmount, 200, 200);
const bubbleOnAmount = findBubble(onAmount);
check(
  Boolean(bubbleOnAmount) && bubbleOnAmount.style.display === 'block',
  'souris SUR le montant -> la bulle apparait',
  bubbleOnAmount ? `display = ${JSON.stringify(bubbleOnAmount.style.display)}` : 'bulle absente'
);

// --- Cas 2 : la souris est sur l'espace APRES -> rien ne doit apparaitre ----
const onSpace = buildFakeBrowser(boundaryTexts, { cursorOffset: TRAILING_SPACE });
const runOnSpace = await startExtension(onSpace);
check(runOnSpace.error === null, 'demarrage du test (souris sur l\'espace)',
      runOnSpace.error ? runOnSpace.error.message : null);
moveMouseTo(onSpace, 200, 200);
const bubbleOnSpace = findBubble(onSpace);
check(
  Boolean(bubbleOnSpace) && bubbleOnSpace.style.display === 'none',
  'souris sur l\'ESPACE apres le montant -> aucune bulle',
  bubbleOnSpace
    ? `display = ${JSON.stringify(bubbleOnSpace.style.display)} (la bulle ne devrait pas s'afficher)`
    : 'bulle absente'
);

// ===========================================================================
//  7bis. Cache de conversion : un taux partage, des valeurs differentes
// ===========================================================================
//
// BUG REEL corrige ici : le cache stockait la VALEUR convertie avec pour seule
// cle la devise. Resultat : « $100 » puis « $1 234,56 » affichaient tous deux
// 100 USD, car le second survol reutilisait la valeur mise en cache par le
// premier.
//
// La bonne regle : le cache memorise le TAUX (identique pour tous les
// montants), et recalcule la valeur a chaque demande.

console.log('');
console.log('5bis. Cache : un taux, des montants differents');

{
  const fake = buildFakeBrowser(
    [{ text: 'Prix : 100 \u20AC ' }, { text: 'Gros : 1 234,56 \u20AC ' }],
    { cursorOffset: 8 }
  );
  const run = await startExtension(fake);
  check(run.error === null, 'demarrage du test de cache', run.error ? run.error.message : null);

  // Premier survol : 100 EUR.
  // On force le curseur sur le premier nœud via le fake chrome.
  // (Le fake « caretPositionFromPoint » pointe toujours sur nodes[0], offset 8.)
  moveMouseTo(fake, 200, 200);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const bubble1 = findBubble(fake);
  const text1 = bubble1 ? bubble1.textContent : '';
  check(text1.includes('100'), 'premier montant affiche (100 EUR)',
        `contenu = ${JSON.stringify(text1)}`);

  // On simule un changement de montant en modifiant la position du curseur :
  // le fake pointe maintenant sur le second nœud.
  //
  // IMPORTANT : on attend 70 ms avant le second survol. Le code reel espace
  // ses traitements de 60 ms (HOVER_THROTTLE_MS). Sans cette attente, les
  // deux survols tomberaient dans la meme milliseconde et le second serait
  // ignore par le frein — un defaut du test, pas du code.
  await new Promise((resolve) => setTimeout(resolve, 70));
  fake.document.caretPositionFromPoint = () => ({
    offsetNode: fake.nodes[1] || null,
    offset: 8
  });
  moveMouseTo(fake, 200, 200);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const bubble2 = findBubble(fake);
  const text2 = bubble2 ? bubble2.textContent : '';

  // On verifie deux choses distinctes :
  //  1. le montant affiche est bien 1 234,56 (et non 100) ;
  //  2. la valeur convertie est 1 358,02 (1 234,56 x 1,10), et non 110.
  //
  // ATTENTION : le formatage francais utilise une ESPACE INSECABLE FINE
  // (\u202F) entre les milliers, pas une espace normale. On teste donc sur
  // une version normalisee ou toutes les espaces sont identiques.
  const normalized = text2.replace(/[\s\u00A0\u202F\u2009]/gu, ' ');
  check(
    normalized.includes('1 234,56'),
    'second montant affiche bien 1 234,56 (pas le cache de 100)',
    `contenu = ${JSON.stringify(text2)}`
  );
  check(
    normalized.includes('1 358,02') && !normalized.includes('$110'),
    'second montant convertit sa PROPRE valeur (1 358,02), pas celle de 100',
    `contenu = ${JSON.stringify(text2)}`
  );
}


// ===========================================================================
//  7ter. Clic sur un montant : bulle figee + menu deroulant
// ===========================================================================
//
// Au survol, la bulle affiche la conversion avec la devise par defaut, SANS
// menu. Au CLIC sur le montant, la bulle se fige et affiche le menu deroulant.

console.log('');
console.log('5ter. Clic : bulle figee + menu deroulant');

{
  const fake = buildFakeBrowser(
    [{ text: 'Article a 10\u20AC ' }],
    { cursorOffset: 11 }
  );
  const run = await startExtension(fake);
  check(run.error === null, 'demarrage du test de clic', run.error ? run.error.message : null);

  moveMouseTo(fake, 200, 200);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const hoverBubble = findBubble(fake);
  check(
    hoverBubble && hoverBubble.children.length === 2,
    'au survol : 2 elements (conversion + taux)',
    hoverBubble ? `enfants = ${hoverBubble.children.length}` : 'bulle absente'
  );

  const clickHandler = fake.browser.listeners.click;
  check(typeof clickHandler === 'function', 'le script ecoute les clics');

  if (typeof clickHandler === 'function') {
    clickHandler({ clientX: 200, clientY: 200, target: {} });
  }
  await new Promise((resolve) => setTimeout(resolve, 0));

  const frozenBubble = findBubble(fake);
  check(
    frozenBubble && frozenBubble.children.length === 2,
    'au clic : 2 elements (conversion + taux, sans poignee)',
    frozenBubble ? `enfants = ${frozenBubble.children.length}` : 'bulle absente'
  );

  const childByClass = (parent, prefix) =>
    (parent && parent.children ? parent.children.find(
      (child) => child.className && child.className.indexOf(prefix) === 0
    ) : null);

  // Le signe de la devise cible est un bouton ; il ouvre le menu flottant.
  const targetTrigger = frozenBubble && frozenBubble.querySelector
    ? frozenBubble.querySelector('.unicorn-target-trigger')
    : null;
  check(
    Boolean(targetTrigger) && targetTrigger.className.indexOf('unicorn-currency-trigger') === 0,
    'le signe de la devise cible est un bouton cliquable',
    targetTrigger ? targetTrigger.className : 'absent'
  );

  if (targetTrigger) {
    const handlers = targetTrigger._listeners && targetTrigger._listeners.click;
    const list = Array.isArray(handlers) ? handlers : [handlers];
    for (const handler of list) {
      if (typeof handler === 'function') {
        handler({ target: targetTrigger, stopPropagation: function () {} });
      }
    }
  }

  const targetMenu = childByClass(frozenBubble, 'unicorn-source-menu');
  const targetList = childByClass(targetMenu, 'unicorn-source-list');
  check(
    Boolean(targetMenu) && Boolean(targetList) && targetList.children.length > 10,
    'le menu de la cible contient toutes les devises',
    targetList ? `${targetList.children.length} element(s)` : 'menu absent'
  );

  // La bulle de devise garde la taille automatique du survol : pas de
  // poignee de redimensionnement ni de largeur memorisee.
  const resizeHandle = childByClass(frozenBubble, 'unicorn-tooltip-resize');
  check(
    !resizeHandle,
    'la bulle de devise n’ajoute pas de poignee de redimensionnement',
    resizeHandle ? resizeHandle.className : null
  );
  check(
    !frozenBubble.style.width,
    'la bulle figée garde la largeur automatique du survol',
    `width = ${JSON.stringify(frozenBubble.style.width)}`
  );
}

// ===========================================================================
//  7quater. Clic sur une UNITE : bulle figee + menu des unites
// ===========================================================================

console.log('');
console.log('5quater. Clic sur une unite : menu de conversion');

{
  const fake = buildFakeBrowser(
    [{ text: 'Distance : 3 miles ' }],
    { cursorOffset: 14 }
  );
  const run = await startExtension(fake);
  check(run.error === null, 'demarrage du test unite', run.error ? run.error.message : null);

  moveMouseTo(fake, 200, 200);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const hoverBubble = findBubble(fake);
  check(
    hoverBubble && hoverBubble.children.length === 2,
    'au survol d\'une unite : 2 elements, sans menu',
    hoverBubble ? `enfants = ${hoverBubble.children.length}` : 'bulle absente'
  );

  const clickHandler = fake.browser.listeners.click;
  if (typeof clickHandler === 'function') {
    clickHandler({ clientX: 200, clientY: 200, target: {} });
  }
  await new Promise((resolve) => setTimeout(resolve, 0));

  const frozenBubble = findBubble(fake);
  check(
    frozenBubble && frozenBubble.children.length === 3,
    'au clic sur une unite : conversion + taux + menu',
    frozenBubble ? `enfants = ${frozenBubble.children.length}` : 'bulle absente'
  );

  if (frozenBubble && frozenBubble.children[2]) {
    const picker = frozenBubble.children[2];
    check(
      picker.className === 'unicorn-unit-picker',
      'le menu des unites est present',
      picker.className
    );

    const list = picker.children[0];
    const items = list ? list.children : [];
    check(
      items.length >= 5,
      'le menu liste les unites de la meme categorie',
      `${items.length} unites`
    );

    // On choisit le kilometre et on verifie que le texte se met a jour.
    const kmItem = items.find((item) =>
      item.getAttribute && item.getAttribute('data-unit') === 'km'
    );
    check(Boolean(kmItem), 'l\'unite « km » est proposee');

    if (kmItem && kmItem._listeners && kmItem._listeners.click) {
      kmItem._listeners.click({ stopPropagation: function () {} });
      const mainText = frozenBubble.children[0] ? frozenBubble.children[0].textContent : '';
      check(
        mainText.indexOf('km') !== -1,
        'choisir « km » convertit bien 3 miles en km',
        JSON.stringify(mainText)
      );
    }
  }
}

// ===========================================================================
//
// Un montant de 12 345 678 901 EUR converti en USD depasse 13 milliards.
// Ecrit en toutes lettres (« 13 800 000 000,00 »), il ne tient pas dans la
// bulle. On verifie donc que le format compact est utilise.
//
// On teste ici le CONTENU produit, pas la mise en page : la taille reelle de
// la bulle depend du navigateur, impossible a simuler fidelement.

console.log('');
console.log('6. Affichage des tres grands montants');

if (executionError) {
  check(false, 'le grand montant peut etre teste', 'le script n\'a pas demarre');
} else {
  // On cherche le montant de 12 345 678 901 dans les nœuds de la page.
  const bigFake = buildFakeBrowser(
    [{ text: 'Tres gros : 12 345 678 901 \u20AC ' }],
    { cursorOffset: 20 }
  );
  const bigRun = await startExtension(bigFake);
  check(bigRun.error === null, 'demarrage du test du grand montant',
        bigRun.error ? bigRun.error.message : null);

  moveMouseTo(bigFake, 200, 200);
  const bigBubble = findBubble(bigFake);

  if (!bigBubble) {
    check(false, 'la bulle du grand montant existe', 'bulle absente');
  } else {
    check(bigBubble.style.display === 'block',
          'la bulle apparait sur le grand montant');

    // On laisse la conversion se resoudre.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // On mesure la ligne PRINCIPALE (premier enfant), pas le menu deroulant
    // qui contient tous les codes de devises.
    const bigText = (bigBubble.children && bigBubble.children[0]
      ? bigBubble.children[0].textContent
      : '') || '';
    check(
      !/\d{3}\s\d{3}\s\d{3}/.test(bigText),
      'aucun nombre n\'est ecrit en toutes lettres (pas de groupes de milliers)',
      `contenu = ${JSON.stringify(bigText)}`
    );
    check(
      /Bn|Md|k|M/.test(bigText),
      'le grand montant utilise la notation compacte',
      `contenu = ${JSON.stringify(bigText)}`
    );
    check(
      bigText.length < 70,
      'le contenu de la bulle reste court (< 70 caracteres)',
      `longueur = ${bigText.length} — ${JSON.stringify(bigText)}`
    );
  }
}

// ===========================================================================
//  8bis. Montants ecrits dans les attributs d'une image
// ===========================================================================
//
// Une balise <img> n'a pas de texte lisible : son prix peut en revanche etre
// ecrit dans son attribut « alt ». Ce n'est PAS de l'OCR (aucune lecture de
// pixels) : c'est du texte present dans le HTML.

console.log('');
console.log('8. Images : montants ecrits dans les attributs');

{
  // a) Une image dont l'attribut « alt » contient un prix.
  const imageWithPrice = element('img');
  imageWithPrice.setAttribute('alt', 'Casque Bluetooth a 79,99 \u20AC');

  const imageFake = buildFakeBrowser(
    [{ text: 'Ce texte ne contient aucun montant.' }],
    { images: [imageWithPrice], pointElement: imageWithPrice }
  );

  const imageRun = await startExtension(imageFake);
  check(imageRun.error === null, 'le script demarre avec une image portant un prix',
    imageRun.error ? imageRun.error.message : null);

  moveMouseTo(imageFake, 400, 300);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const imageBubble = findBubble(imageFake);
  check(
    Boolean(imageBubble) && imageBubble.style.display === 'block',
    'survol d\'une image dont « alt » contient un prix -> la bulle s\'ouvre',
    imageBubble ? `display = ${JSON.stringify(imageBubble.style.display)}` : 'bulle absente'
  );

  const imageText = imageBubble ? imageBubble.textContent : '';
  check(
    imageText.indexOf('79,99') !== -1 || imageText.indexOf('88') !== -1,
    'la bulle affiche bien la conversion de ce prix',
    `contenu = ${JSON.stringify(imageText)}`
  );

  // b) Une image sans prix : rien ne doit s'ouvrir.
  const plainImage = element('img');
  plainImage.setAttribute('alt', 'Photo d\'un casque noir');

  const plainFake = buildFakeBrowser(
    [{ text: 'Ce texte ne contient aucun montant.' }],
    { images: [plainImage], pointElement: plainImage }
  );

  const plainRun = await startExtension(plainFake);
  check(plainRun.error === null, 'le script demarre avec une image sans prix');

  moveMouseTo(plainFake, 400, 300);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const plainBubble = findBubble(plainFake);
  check(
    !plainBubble || plainBubble.style.display === 'none',
    'survol d\'une image sans prix -> aucune bulle',
    plainBubble ? `display = ${JSON.stringify(plainBubble.style.display)}` : 'bulle absente'
  );

  // c) Le prix peut venir de « aria-label » quand « alt » est muet.
  const ariaImage = element('img');
  ariaImage.setAttribute('alt', 'Illustration');
  ariaImage.setAttribute('aria-label', 'Abonnement annuel 149 \u20AC');

  const ariaFake = buildFakeBrowser(
    [{ text: 'Aucun montant ici.' }],
    { images: [ariaImage], pointElement: ariaImage }
  );

  const ariaRun = await startExtension(ariaFake);
  check(ariaRun.error === null, 'le script demarre avec une image « aria-label »');

  moveMouseTo(ariaFake, 400, 300);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const ariaBubble = findBubble(ariaFake);
  const ariaText = ariaBubble ? ariaBubble.textContent : '';
  check(
    ariaText.indexOf('149') !== -1 || ariaText.indexOf('163') !== -1,
    'un prix dans « aria-label » est aussi reconnu',
    `contenu = ${JSON.stringify(ariaText)}`
  );

  // d) Une version n'est pas un prix, meme dans un attribut : les regles de
  //    l'iteration 7 s'appliquent ici aussi.
  const versionImage = element('img');
  versionImage.setAttribute('alt', 'Version v1.2.3 EUR');

  const versionFake = buildFakeBrowser(
    [{ text: 'Aucun montant ici.' }],
    { images: [versionImage], pointElement: versionImage }
  );

  const versionRun = await startExtension(versionFake);
  check(versionRun.error === null, 'le script demarre avec une image « version »');

  moveMouseTo(versionFake, 400, 300);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const versionBubble = findBubble(versionFake);
  check(
    !versionBubble || versionBubble.style.display === 'none',
    'un numero de version dans un attribut n\'est pas converti',
    versionBubble ? `display = ${JSON.stringify(versionBubble.style.display)}` : 'bulle absente'
  );
}

// ===========================================================================
//  9. Bilan
// ===========================================================================

console.log('');
console.log(`Bilan : ${passed} reussi(s), ${failed} echec(s)`);

if (failed > 0) {
  console.log('');
  console.log('Une erreur d\'execution a ete detectee dans src/content.js.');
  console.log('Corriger le fichier : ce test doit passer avant tout essai dans Firefox.');
}

process.exit(failed > 0 ? 1 : 0);
