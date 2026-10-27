# UniConv — Reprise de session (compte rendu complet)

**Document de passation.** Il contient tout ce qu'il faut pour reprendre le
projet dans une nouvelle session, sans rien réexpliquer.

- **Version de l'extension : 2.9.7** (audit sécurité et durcissement ;
  validation visuelle en attente)
- **Refonte visuelle** : le brief de conception est livré
  (`docs/DESIGN-SPEC.md`, `docs/design/tokens.json`,
  `docs/design/tooltip-anatomy.svg`). L'utilisateur fait appel à un service de
  design externe et renverra un fichier Figma + `tokens.json` + icônes. Voir
  § 12.
- **Dernier chantier : itération 51 — audit sécurité** (livrée, voir § 9).
  Itération 50 (Ko-fi) livrée. Itération 12 (polissage, accessibilité, publication) livrée et
  testée. Itération 11 (fuseaux horaires)
  **validée** le 24/10. **L'itération 10 (OCR automatique) a été arrêtée** sur
  décision de l'utilisateur : la lecture manuelle (bouton **Scan**) est plus
  précise et plus économe. Le code reste en place, désactivé et replié.
- **État des tests automatiques : 979 vérifications, 0 échec, 16 suites** (§ 8)
- **Dossier :** `<dossier du projet>` (87 fichiers hors
  archives, ~9 Mo, dont 8,2 Mo de moteur OCR ; archives dans `dist/`)

---

## 1. À lire en premier (30 secondes)

UniConv est une extension **Firefox/Chrome** (Manifest V3, cible principale
**Firefox**) qui, au survol d'un montant, affiche sa conversion dans une bulle ;
au clic, elle fige la bulle et ouvre le menu des devises. Elle convertit aussi
les **unités de mesure**, filtre les **faux positifs**, détecte le **contenu
dynamique**, applique une **liste noire**, convertit les **fuseaux horaires**
(« 14:30 CET » -> l'heure de votre ville) et sait lire un prix **dessiné dans
une image** (OCR manuel embarqué, hors ligne).

Tout est écrit en **JavaScript pur**, sans build, sans dépendance : une seule
grosse IIFE dans `src/content.js` (6 700 lignes), volontairement.

---

## 2. Comment reprendre (commandes exactes)

```bash
# 1. Serveur de test (les pages file:// ne sont pas analysées par l'extension)
cd ~/Documents/UniConv && python3 -m http.server 8123

# 2. Vérifier que tout passe AVANT de toucher au code
for f in run-tests smoke-test background-test audit-tests units-tests \
         currency-meta-tests currency-search-tests dynamic-tests \
         false-positive-tests options-tests ocr-tests \
         timezone-tests accessibility-tests release-tests compat-tests; do
  printf "%-24s " "$f"; node tools/$f.mjs | grep -E "Bilan|Resultat" | tail -1
done
```

**Dans Firefox, après chaque modification :**
1. `about:debugging#/runtime/this-firefox` → carte **UniConv** → **Recharger**.
2. **Recharger l'onglet testé** (le script de page n'est pas rechargé avec
   l'extension).
3. Console de la page : `Cmd` + `Option` + `K`. Console de l'arrière-plan :
   `Cmd` + `Shift` + `J`.

> Si Firefox affiche **deux** UniConv : supprimer la vieille, `Cmd`+`Q`,
> recharger `manifest.json` par « Charger un module temporaire ». Une extension
> fantôme injecte l'ancien code et fait perdre des heures (déjà arrivé).

Pages de test servies :

| Page | À quoi elle sert |
|---|---|
| `test/formats.html` | tous les formats de devises et d'unités (119 cas automatiques) |
| `test/monnaies.html` | **les 167 devises** : tableau, recherche, exemples à survoler |
| `test/faux-positifs.html` | 63 pièges + 13 vrais prix (aucune conversion sur les pièges) |
| `test/dynamique.html` | contenu injecté après le chargement |
| `test/fuseaux.html` | fuseaux horaires : 33 cas valides + 15 pièges |
| `test/options-checklist.md` | liste de contrôle des réglages (30 points) |

---

## 3. Façon de travailler attendue (préférences de l'utilisateur)

1. **L'utilisateur n'est pas développeur.** Expliquer chaque étape, définir le
   jargon, donner les chemins de fichiers exacts.
2. **Tout le code est écrit directement sur le disque**, jamais en extraits à
   recopier.
3. **Progression par itérations** : une itération → l'utilisateur teste dans
   Firefox → il valide → on passe à la suivante. Ne pas enchaîner deux
   itérations sans validation.
4. **Français** pour les documents, l'interface et les messages de console
   (sans accents dans le code pour éviter tout souci d'encodage : « arriere-plan »).
5. **Honnêteté stricte** : ne jamais affirmer qu'un résultat visuel a été
   constaté sans l'utilisateur ; dire clairement ce qui n'a pas pu être vérifié
   (l'agent n'a pas de navigateur).
6. **Design harmonisé** : l'utilisateur est sensible aux tailles/proportions
   (drapeaux agrandis, bulle stable, menu cohérent).
7. **Parité fonctionnelle** : une fonctionnalité doit se comporter comme les
   autres (ex. : l'OCR utilise **le même** chemin de bulle qu'un clic).
8. **Discrétion et performance** avant tout : mieux vaut manquer un prix que
   ralentir une page.

---

## 4. Architecture (qui fait quoi, et pourquoi)

| Fichier | Rôle | Volume |
|---|---|---|
| `manifest.json` | MV3, `background.scripts` (Firefox) + `service_worker` (Chrome), `options_ui`, `activeTab`, CSP `wasm-unsafe-eval` | ~60 l. |
| `src/content.js` | tout le script de page : détection, bulle, menus, réglages, OCR (sélection + automatique) | 6 696 l. |
| `src/background.js` | taux de change (3 sources + cache 12 h), capture d'écran + découpe, coordination OCR, badge | ~1 000 l. |
| `src/engine.html` + `engine.js` | **heberge le moteur Tesseract** (page d'extension stable) + test autonome | 336 l. |
| `src/options.html` + `options.js` | page de réglages complète (même page = source de vérité des `DEFAULTS`) | 921 l. |
| `src/popup.html` + `popup.js` | convertisseur, état des taux, pause, réglages, OCR, statistiques | 1 553 l. |
| `src/vendor/tesseract/` + `tessdata/` | moteur OCR + modèles fra/eng (8,2 Mo, aucun réseau) | — |
| `tools/*.mjs` | 16 suites de tests Node (aucun navigateur) + `package.mjs` + `generate-currency-page.mjs` | — |
| `docs/*.md` | ROADMAP, OPTIONS, OCR, FUSEAUX-HORAIRES, **UNITES-ECRITURES**, PRIX-DECOUPES, FAUX-POSITIFS, IMAGES-ET-OCR, TESTS, INSTALL, CONFIDENTIALITE, PUBLICATION | — |
| `README.md` | présentation, installation, utilisation, permissions | — |
| `dist/` | archives générées (`.xpi`, `-chromium.zip`, `-safari.zip`, dossier Safari) | 25 Mo |

### Les trois contraintes de plateforme qui expliquent cette architecture

1. **Une page web interdit WebAssembly** (CSP) → le moteur OCR ne peut pas
   tourner dans `content.js`.
2. **Le script d'arrière-plan de Firefox est une « page d'événement »**,
   déchargée dès qu'elle est inactive → il ne peut pas héberger un travail long
   (une lecture de 1 à 5 s mourait en silence). **C'est pourquoi
   `src/engine.html` existe.**
3. **Une capture d'écran ne doit rien afficher avant elle** → l'ordre est :
   retirer voile/bulle → attendre le repeint (2 images + 70 ms) → capturer →
   *ensuite seulement* afficher « lecture en cours ».

---

## 5. Journal des itérations (0 → 26)

| # | Livré | Points clés |
|---|---|---|
| 0 | Socle | Manifeste, popup ↔ arrière-plan, extension chargée à la main |
| 1 | MVP `10€` | Bulle + soulignement (CSS Custom Highlight), `caretPositionFromPoint` |
| 2 | Tous les formats | 45 devises, 5 familles de formats, `POSITIONS`/`PATTERN_*` |
| 3 | Vrais taux | Frankfurter + 2 sources de secours, cache 12 h, hors ligne |
| 4 | Devises en lettres | « dix euros », « ten dollars » |
| 5 | Unités | longueur, poids, température, volume, vitesse, `1m80`, `6 ft 2 in` |
| 6 | Contenu dynamique | `MutationObserver`, debounce 300 ms, exclusions |
| 7 | Faux positifs | 13 règles de contexte, 16 balises ignorées, pause `Alt+Maj+U` + badge OFF, liste noire (24 domaines), compteur de rejets |
| 8 | Page de réglages | devise cible, couverture, langue fr/en/auto, thème clair/sombre/auto, délai 0–1000 ms, liste noire personnelle validée, export/import JSON vérifié |
| 9 | OCR (manuel) | rectangle de sélection **sur la page**, bulle de résultat, moteur embarqué |
| 9bis→9nonies | Corrections OCR | voir § 6 (5 bugs successifs) |
| 10 | OCR automatique — **arrêtée le 24/10** | score de pertinence, survol 800 ms, budget, cache, pastille, statistiques ; 5 défauts corrigés. **Non retenue** : 1 à 5 s par image, filtrage imparfait, bulle ouverte sans clic. La sélection manuelle (bouton **Scan**) est plus précise et gratuite. Code **supprimé en 2.0.0** (avec la page de test et `page-tests`) |
| 11 | Fuseaux horaires | 33 cas de formats (24 h, 12 h, `14h30`, ISO 8601, RFC 2822), ~50 abréviations, noms IANA (heure d'été comprise), formules « heure de Paris » / « Pacific Time », 132 villes, menu de choix au clic, conversion + décalage + changement de jour |
| 12 | Polissage et publication | styles.css supprimé ; accessibilité (Échap, focus clavier, ARIA, contrastes, poignée aux flèches) ; mesures de performance ; archives Firefox + Chrome reproductibles ; README, confidentialité, guide de publication ; `accessibility-tests` et `release-tests` |
| 13 | Optimisation et navigateurs | caches `Intl` (25× sur le formatage), court-circuit du survol quand aucun montant n'est détecté, mémoïsation des zones interdites, élagage des nœuds disparus, `Range` réutilisé, code mort supprimé ; paquets Firefox, Chromium (Chrome/Edge/Brave/Opera/Vivaldi) et Safari ; `compat-tests` |
| 14 | OCR des unités + quarts | l'OCR convertit désormais **les montants, les unités (toutes) et les heures**, sur le même chemin qu'un clic (bulle figée + menu) ; ajout du **quart US** (`quart(s)`, `qt`, `qts`, 0,946352946 L), règle anti-fraction « 3 quarts de la surface » ; 8 tests unités + 5 tests d'intégration OCR. |
| 15 | Corrections OCR/unités | **« unreal » n'est plus un real brésilien** (espace obligatoire entre nombre en lettres et devise) ; **unités en MAJUSCULES** (`2.1 QT`, `10 IN`, `6 FT`) via des alias, avec les règles « in »/« st » insensibles à la casse ; 6 tests unités + 2 tests d'intégration ; serveur de test relancé. |
| 16 | Écritures des unités | **Inventaire complet** (`docs/UNITES-ECRITURES.md`) et ajout : mots pleins (kilogrammes, mètres, litres…), températures en toutes lettres (« degrés Celsius/Fahrenheit », « deg C »), **Kelvin contextuel** (« 300 K » → 26,85 °C, mais « 50 K abonnés » = milliers), nouvelles unités (tonne, mg, µg, cl, dl, hl, fl oz, tsp, tbsp, cc, nmi, µm, m/s, nœud), **fractions** (1/2, 2 1/2, 2½, ½), formats composés en majuscules ; 37 tests unités + 2 OCR. |
| 17 | Ville + fuseau dans la bulle | La ligne cible affiche « **Paris (Europe/Paris)** » au lieu de « Paris » ; la ligne « Ma ville » affiche aussi le fuseau local ; les libellés du menu passent à la ligne au lieu de tronquer le fuseau ; 4 tests (3 fuseaux + 1 dynamique). |
| 18 | Décalage GMT + première ligne | Le menu affiche « **Paris (GMT+2)** », « Tokyo (GMT+9) », « Mumbai (GMT+5:30) » (calculé à la date de l'heure convertie) ; la première ligne devient « **14h30 à Paris** » (ou « 13h30 UTC » pour un fuseau fixe), le détail ne répète plus la cible ; 7 tests fuseaux + 2 tests dynamiques. |
| 19 | Fourchettes de prix | Détection de « **2000 - 3000 CNY** » comme **une** fourchette, convertis en « 2 000 – 3 000 CNY = 254 – 381 € » avec un seul taux. Séparateurs : `-` `–` `—` `−` `/` `~`, `to`, `à`, `a`, `entre … et`, `between … and`. Devise avant, après, au milieu ou des deux côtés (`€200-€300`, `CNY 2000 - 3000`, `10 EUR - 20`). Garde-fous : notes (`4,5/5`), téléphones, dates, plages sans devise. 26 tests + 3 dynamiques. |
| 20 | FLE/PHP + navigation | **Milliers à points** (`70.000`, `80.000`) : le salaire « Entre 70.000 et 80.000 PHP » de FLE est détecté et converti ; `70.000 PHP` seul aussi. **Barre de navigation** commune aux 5 pages de test (`test/test-nav.css`), page courante surlignée. 4 tests run-tests + 2 dynamiques. |
| 21 | Pesos génériques | « **135 pesos** » (Mexique) est reconnu comme **MXN** par défaut, comme « $ » l'est du dollar US ; les formes précises (pesos mexicains / philippins / argentins) restent exactes ; 6 tests run-tests + 1 dynamique. |
| 22 | Dollar de Brunéi | **BND** ajouté à la table des devises (il n'existait que comme drapeau/nom) : « **500BND** » (code collé), « 500 BND » et « 500 dollars de brunei » sont détectés ; recherche « brunei » dans le menu. 3 tests run-tests + 1 dynamique + 1 recherche. |
| 23 | Audit mémoire et optimisations | **Fourchettes** : 4 expressions sautées sans chiffre ; **unités** : sortie rapide sans lettre/°/µ ; **cache des formateurs de fuseaux borné** à 32 (le menu des 132 villes en créait 132) ; **correction d'une inexactitude** : 46 devises détectées, 168 cibles ; outil `memory-report.mjs`. 2 tests de couverture. |
| 24 | Toutes les devises + 4e source | **167 devises détectées** (codes ISO + noms français, insensibles à la casse) au lieu de 46 ; **4e source de taux** indépendante (exchangerate-api) et test de repli ; 5 hôtes déclarés. |
| 23 | Audit mémoire | Fourchettes sautées sans chiffre, unités sans lettre, cache de fuseaux borné ; 46 devises détectées / 168 cibles ; outil `memory-report.mjs`. |
| 24 | Toutes les devises + 4e source | **167 devises** détectées (codes + noms, casse ignorée) ; 4e source de taux indépendante ; 5 hôtes. |
| 25 | Convertisseur popup + page Monnaies | **Popup** : champs montant/devise ou unité, onglets Devises/Unités, bouton **OCR dans l'en-tête** ; **page `monnaies.html`** : tableau des 167 devises avec recherche et exemples à survoler ; bandeau de navigation complété et pages de test en `no-store` ; 16 tests popup + 1 test page. |
| 26 | Scan, tutoriel et raccourcis | Bouton **Scan**, **case « Activer le Scan (OCR) »**, ancien `Alt+Maj+O` retiré ; **page tutoriel** ouverte à l'installation ; **commandes personnalisables** Scan et convertisseur, avec page autonome au champ déjà sélectionné ; proposition de traduction ONU. |
| 27 | Langues et Scan visible | Sélecteur **5 langues** (fr, en, es, ru, zh) avec libellés/titres traduits (module `i18n.js`), messages de bulle dans les 5 langues ; **case « Activer le Scan » dans le popup** en plus des réglages ; 4 tests popup. |
| 28 | Frontières et case Detection | **Bug « 3–7 working days »** : le code KES était lu dans « takes » puis « KES 3–7 » devenait une fourchette ; garde-fous avant la devise dans les fourchettes, espace obligatoire avant les noms ; **bouton pause remplacé par la case « Activer la detection »** dans le popup, raccourci `Alt+Maj+U` retiré. |

### Décisions d'UX actées

- Survol = conversion simple. **Clic = bulle figée + menu des devises.**
  (recherche par pays, épinglage 📌, drapeaux 18 px, symboles, noms complets)
- La bulle est **redimensionnable** (poignée dans le pied, jamais sur la
  barre de défilement) et **stable** (ne bascule pas haut/bas).
- Le **taux** est en seconde ligne (petit) ; la **date** n'est que dans le popup.
- Montants très grands : **notation compacte**.
- **Tout prix reconnu par OCR suit le MÊME chemin qu'un clic** (même bulle, même
  menu). Le texte reconnu va dans la console et dans l'onglet moteur.
- OCR **automatique désactivé par défaut** (coût réel : 1 à 5 s/image).
- Raccourcis : `Alt+Maj+D` diagnostic ; Scan et convertisseur sont des commandes personnalisables (aucune touche imposée).
  diagnostic (rapport console).

---

## 6. Bugs corrigés (et pourquoi ils étaient invisibles)

| # | Symptôme | Cause | Correctif | Test qui le couvre |
|---|---|---|---|---|
| 1 | Extension muette | `data_collection_permissions` manquant (Firefox 140+) | ajout au manifeste | — |
| 2 | Bulle jamais affichée | `position.node` au lieu de **`offsetNode`** | corrigé | `smoke-test` |
| 3 | Surlignage KO | `WeakMap.forEach` inexistant | `Set` parallèle `scannedNodes` | `smoke-test` |
| 4 | Zone de survol trop large | borne de fin inclusive | fin exclusive + `amountEnd` | `smoke-test` |
| 5 | `$1,234.56` → `$100.00` | cache de la **valeur** au lieu du **taux** | recalcul `value = amount * rate` | `smoke-test` |
| 6 | Devises manquantes (AED, MAD) | Frankfurter = 30 devises | 3 sources fusionnées | `background-test` |
| 7 | `1.234.567,89 €` → `567,89 €` | pas de motif « milliers à points » | motif ajouté AVANT celui des versions | `run-tests` |
| 8 | Prix Amazon invisibles | prix **découpés** en 4 balises (`€` `54` `,` `00`) | « suites » : texte reconstitué par conteneur inline, puis redistribué | `dynamic-tests` (§12) |
| 9 | Prix dans une case cliquable invisible | un **lien transparent** (`a.page-load-link` 100 %×100 %) recouvre le prix | **recours spatial** : `elementsFromPoint` + `getClientRects` | `dynamic-tests` (§13) |
| 10 | « Moteur OCR absent » | chemins `vendor/` au lieu de `src/vendor/` (deux bases différentes : `getURL` part de la racine, `<script src>` du dossier de la page) | chemins corrigés + test qui résout chaque chemin sur le disque | `ocr-tests` |
| 11 | « erreur inconnue » | `ErrorEvent` d'un worker : `message` vide | `describeError`/`describeFailure` | `ocr-tests` |
| 12 | Worker OCR refusé sous Firefox | Tesseract crée son worker en `blob:` (origine différente) | **`workerBlobURL: false`** | `ocr-tests` |
| 13 | OCR : rien du tout | demande d'OCR branchée **trop tard** (jamais en pause / site exclu) | écouteur branché dès `main()` + message d'échec **visible** | `dynamic-tests` (§17) |
| 14 | OCR : texte incohérent avec l'image | le champ « dernier texte » n'était mis à jour que par le bouton de test | aperçu **et** texte synchronisés | — (visuel) |
| 15 | « aucune lecture » | moteur dans le script d'arrière-plan (déchargé) | moteur dans `src/engine.html` | `ocr-tests` |
| 16 | Découpe à côté du texte | échelle supposée = `devicePixelRatio` | échelle **calculée** = largeur capture ÷ largeur viewport | `ocr-tests` |
| 17 | La bulle se faisait photographier | bulle « lecture en cours » affichée **avant** la capture | ordre inversé + `waitForCleanRepaint` + 2 messages (`ocr-capture` puis `ocr-recognize`) | `dynamic-tests` (§16) |
| 18 | OCR « isolé » (pas de menu) | bulle OCR dessinée par un chemin séparé | même chemin que le clic (`showTooltip` figé) | `dynamic-tests` |
| 19 | `679€99` non converti | format « euros + symbole + centimes » absent | 3e motif `PATTERN_SYMBOL_CENTS` | `run-tests` |
| 20 | Faux DOM trompeur (tests) | `querySelector` absent, `getBoundingClientRect` figé | simulation fidèle (voir § 8) | — |
| 21 | La pastille « OCR… » se faisait photographier | affichée **avant** la capture (famille du bug 17) | rien d'affiché avant la photo ; pastille après, retirée à la fin | `dynamic-tests` §17 h/§17 i |
| 22 | Deux lectures simultanées, « zone expirée » | verrou libéré 400 ms après l'**envoi**, pas après la réponse | libéré à la **fin réelle**, + garde-fou 30 s | `dynamic-tests` §17 i |
| 23 | Compteur « ignorées » gonflé | recompté à chaque passage de souris | une image écartée comptée **une seule fois** | `dynamic-tests` §17 j |
| 24 | Validation impossible sur la page de test | budget 5 annoncé pour **6** analyses attendues | budget 10 + explication affichée dans la page | `page-tests` |
| 25 | « La première détection marche, ensuite plus rien » | cache indexé par **fichier image** : les vignettes d'une galerie partagent le même fichier, donc la 2e était « déjà lue » | cache par **vignette** (`WeakMap` element → signature), réexamen si la source change | `dynamic-tests` §17 m |
| 26 | « Ensuite plus rien » (2e cause) | une bulle figée par l'OCR **automatique** bloquait tout survol suivant | `frozenByAutoOcr` : survoler une autre image remplace la bulle, sans clic | `dynamic-tests` §17 n |

### Leçons de méthode (à ne pas réapprendre)

- **Un test qui ne peut pas échouer ne vérifie rien** : chaque correctif
  important a été rejoué « par la négative » (réintroduire le bug, voir le test
  échouer).
- **Le simulateur doit imiter la réalité** : un faux DOM plus permissif que
  Firefox a déjà masqué deux bugs (`offsetNode`, `querySelector`).
- **Une action qui échoue en silence est le pire des défauts** : tout refus
  s'affiche désormais dans la page.
- **L'interface ne doit pas gêner la mesure** : rien d'affiché avant une capture.
- **Deux chemins d'affichage finissent par diverger** : un seul chemin, deux
  entrées (clic et OCR).
- **Une page de test qui n'affiche rien ne teste rien** : elle doit
  s'auto-diagnostiquer (tableau de bord + rapport copiable) et dire *pourquoi*
  elle n'affiche rien.

---

## 7. Interfaces techniques

### Messages

| Message | Émetteur → destinataire | Réponse |
|---|---|---|
| `convert` | page → arrière-plan | `{ok, value, rate, from, to, date, fetchedAt, stale}` |
| `rates-status` | popup/options → arrière-plan | `{ok, date, fetchedAt, currencies[]}` |
| `refresh-rates` | popup → arrière-plan | `{ok, date}` |
| `set-paused` | page/popup → arrière-plan | `{ok}` (met le badge **OFF**) |
| `start-ocr-selection` | popup → page | `{ok}` ou `{ok:false, error}` |
| `ocr-capture` | page → arrière-plan | `{ok, id, crop}` (photo prise, rien affiché avant) |
| `ocr-recognize` | page → arrière-plan | `{ok, text, confidence, durationMs, crop}` |
| `engine-ping` / `engine-ocr` / `engine-self-test` | arrière-plan ↔ `engine.html` | `{ok, text…}` |

### Clés de stockage (`chrome.storage.local`)

`uniconv.targetCurrency` · `uniconv.unitSystem` · `uniconv.language` ·
`uniconv.detectCurrencies` · `uniconv.detectUnits` · `uniconv.hoverDelay` ·
`uniconv.theme` · `uniconv.blacklist` · `uniconv.pinnedCurrencies` ·
`uniconv.detectTimezones` · `uniconv.targetTimezone` · `uniconv.timeFormat` ·
`uniconv.pinnedTimezones` · `uniconv.tooltipSize` · `uniconv.enabled` (pause) ·
`uniconv.ocrAuto` · `uniconv.ocrThreshold` · `uniconv.ocrBudget` ·
`uniconv.rates` · `uniconv.lastAttempt` · `uniconv.observerStats` ·
`uniconv.autoOcrStats`

### Points d'entrée du code (dans `content.js`)

`main()` → `loadGuardSettings()` (pause/liste noire) → `loadDisplaySettings()`
→ `startDetection()` → `scanDocument()` + `scanImages()` + `startObserver()` +
écouteurs souris/clavier/messages.
Survol : `onMouseMove` → `handleHover` → `amountInImageAt` → `amountAtPoint` →
`amountByRectAt` → `scheduleShow` → `showTooltip` / `showUnitTooltip` /
`showTimeTooltip`.
Détection : `processTextNode` → `runForNode`/`buildRun` (suites) → `indexRun`
→ `findAmountsInText` / `findUnitsInText` / `tzFindTimes`
(+ `rejectionForCandidate`).
Fuseaux : module pur entre les marqueurs `>>> DEBUT MODULE FUSEAUX` et
`<<< FIN MODULE FUSEAUX` (aucun DOM, aucune horloge) ; bulle et menu dans
`showTimeTooltip` / `appendTimezonePicker`.

---

## 8. Les 16 suites de tests (979 vérifications)

| Suite | Nb | Ce qu'elle vérifie |
|---|---|---|
| `run-tests` | 134 | détection, depuis les données JSON de `formats.html` |
| `smoke-test` | 57 | exécution réelle dans un faux navigateur : bulle, clic, épinglage, redimensionnement, images |
| `background-test` | 30 | cache, sources de taux, validations |
| `audit-tests` | 26 | conversions vérifiées à la main |
| `units-tests` | 104 | unités (table de vérité, formats, faux positifs) |
| `currency-meta-tests` | 13 | nom + drapeau de chaque devise, page Monnaies à jour |
| `currency-search-tests` | 33 | recherche par pays (« chine » → yuan) |
| `dynamic-tests` | 155 | contenu dynamique, garde-fous, réglages, OCR manuel (parcours complet), **fuseaux** (détection, bulle, menu, choix mémorisé) |
| `false-positive-tests` | 90 | 63 pièges, 13 vrais prix, cohérence avec la page HTML |
| `options-tests` | 35 | page de réglages : identifiants HTML↔JS, validation, import/export, manifeste |
| `ocr-tests` | 50 | géométrie, intégrité des 8,2 Mo, **résolution réelle des chemins**, architecture, CSP |
| `timezone-tests` | 91 | module de fuseaux extrait et rejoué : 33 cas (dont heures d'été et décalage à 5 h 45), 15 pièges, 132 fuseaux IANA validés, formatage 12/24 h, Réglages |
| `accessibility-tests` | 28 | ARIA de la bulle et des menus, `lang`, libellés, `aria-pressed`, focus visible, **contrastes calculés** (WCAG), Échap, poignée aux flèches, `prefers-reduced-motion` |
| `release-tests` | 46 | archives Firefox/Chromium/Safari (contenu, manifestes adaptés), icônes PNG, fichiers morts, README/confidentialité/publication, **performances mesurées** |
| `compat-tests` | 40 | trois manifestes (MV3, permissions, service worker), **liste blanche des API**, garde-fous (capture), documentation des navigateurs |
| `popup-tests` | 47 | bouton **Scan** dans l'en-tête, convertisseur, table d'unités identique à `content.js`, conversions réelles, page autonome, commandes, tutoriel, case OCR, absence de l'ancien raccourci |

**Faux navigateur** : construit à la main dans `dynamic-tests` et `smoke-test`
(`document`, `createTreeWalker` **respectant sa racine**, `querySelector` par
classe, `insertBefore`, `insertAdjacentElement`, `classList`, `elementFromPoint`,
`elementsFromPoint`, `caretPositionFromPoint` → **`offsetNode`**, `CSS.highlights`,
minuteurs instrumentés, stockage simulé, messages simulés).

---

## 9. État exact au moment de la passation

### Fait et validé par l'utilisateur (dans Firefox)

- Formats de devises et d'unités, bulle au survol, clic + menu, réglages,
  faux positifs, pause, liste noire, contenu dynamique, prix découpés (Amazon),
  prix sous lien transparent, `679€99`, OCR manuel avec **menu de devises**.

### Itération 10 — OCR automatique : **arrêtée le 24/10**

Décision de l'utilisateur après test : « pas sûr que cette fonctionnalité soit
utile ; la sélection sur la page est bien plus pratique et économe ». Raisons
retenues : 1 à 5 s de calcul par image, filtrage imparfait (il a fallu un
budget et un seuil), bulle ouverte sans clic. Le code a été **entièrement supprimé en 2.0.0** (module, réglages,
statistiques, page `test/ocr-auto.html` et suite `page-tests`).

### Itération 11 — fuseaux horaires : **validée le 24/10**

Ce qui est en place :

1. Module **pur** (aucun DOM, aucune horloge) entre les marqueurs
   `>>> DEBUT MODULE FUSEAUX` / `<<< FIN MODULE FUSEAUX` : lecture, conversion,
   formatage.
2. **33 cas de formats** : `14:30`, `14h30`, `14 h 30`, `14h`, `2:30 PM`, `12:00 AM`,
   ISO 8601 (avec date), RFC 2822, `UTC`, `UTC+2`, `GMT-05:00`, `14:30Z`,
   décalages `+05:45`, noms IANA, ~50 abréviations, formules françaises
   (« heure de Paris », « heure de l'Est », « heure du Pacifique ») et anglaises
   (« Paris time », « Pacific Time »).
3. **Règle de détection** : une heure sans fuseau n'est jamais touchée.
4. **Conversion** : `Intl` (heure d'été comprise), décalage affiché, changement
   de jour (« le lendemain » / « la veille »).
5. **Menu des villes au clic** : 132 villes, recherche (ville, pays, région,
   IANA), drapeaux, épinglage, « Ma position » (fuseau du système). Le choix est
   mémorisé (`uniconv.targetTimezone`).
6. **Réglages** : activer/désactiver, ville de référence (41 principales),
   format 12/24 h, export/import validés.
7. **Page de test** : `test/fuseaux.html` (33 cas + 15 pièges), qui affiche
   l'heure attendue à Paris pour comparaison.
8. **Tests** : `timezone-tests` (80) + 9 vérifications d'intégration dans
   `dynamic-tests` (bulle, décalage, surlignage, menu, choix mémorisé, heure
   sans fuseau). **708 au total**.

Limites connues (documentées dans `docs/FUSEAUX-HORAIRES.md`) : date écrite
séparément ignorée, abréviations ambiguës (IST = Inde, CST = États-Unis),
plages horaires, secondes ignorées, `2:30` sans AM/PM lu en 24 h.

### Validation

Testée par l'utilisateur dans Firefox le 24/10 : « tout fonctionne ». Version
passée en **0.24.0** (manifeste + `background.js`, `engine.js`, `options.js`,
`popup.js`, `content.js`), marqueur de code `0.24.0-fuseaux`, ROADMAP marquée
« Validée ». Aucun correctif n'a été nécessaire après le test.

### Itération 12 — polissage, accessibilité, publication : **livrée, test visuel en attente**

1. **Nettoyage** : `styles.css` (inutilisé depuis l'itération 1) supprimé.
2. **Accessibilité** :
   - `Échap` ferme la bulle figée (clavier) ;
   - anneau de focus visible sur les lignes de menu, les recherches et la poignée ;
   - `aria-label` sur la bulle, les deux recherches et le menu des villes ;
   - `aria-pressed` sur les épingles (devises et villes) ;
   - `lang` de la bulle aligné sur la langue de l'interface ;
   - contrastes recalculés : haut du dégradé assombri (`#3a79ff` → `#2a62e8`),
     ligne secondaire non translucide, titres de section et placeholders
     éclaircis — tous ≥ 4,5:1 ;
   - poignée de redimensionnement utilisable aux flèches (`Maj` = pas plus
     grand).
3. **Performance mesurée** (Node, hors navigateur) : **3,8 µs** par ligne
   courante ; 400 Ko en **253 ms** ; 5 000 heures valides en **99 ms** ; un pavé
   de 220 Ko de chiffres n'entraîne aucun ralentissement.
4. **Publication** :
   - `README.md` (présentation, installation, usage, permissions, tests) ;
   - `docs/CONFIDENTIALITE.md` (aucune collecte, 4 services de taux, OCR local) ;
   - `docs/PUBLICATION.md` (AMO + Chrome, justifications de permissions,
     mises à jour) ;
   - `tools/package.mjs` : `dist/uniconv-1.0.0.xpi` (Firefox) et
     `-chrome.zip` (manifeste adapté, service worker), 5,3 Mo, contenu vérifié.
5. **Tests** : `accessibility-tests` (28) + `release-tests` (33), plus Échap
   dans `dynamic-tests`. **770 au total.**

Limites d'accessibilité assumées : l'ouverture de la bulle passe par la souris
(survol ou clic) — il n'existe pas de raccourci clavier global pour « convertir
ce que je lis » ; l'épinglage 📌 se fait à la souris (l'état est annoncé, mais
l'action n'est pas atteignable au clavier).

### À faire pour clore l'itération 12

1. `about:debugging` → **Recharger** (nouveau marqueur `1.0.0`).
2. Vérifier la bulle et les menus : contraste, lisibilité, focus au clavier
   (`Tab` dans le menu après un clic), `Échap` pour fermer, flèches sur la
   poignée de redimensionnement.
3. Vérifier que devises, unités et fuseaux fonctionnent toujours.
4. **Publication** : créer le compte AMO, puis suivre `docs/PUBLICATION.md` ;
   les archives sont prêtes dans `dist/`.
5. Après validation : marquer l'itération 12 « Validée » dans `ROADMAP.md`.

### Itération 13 — optimisation et navigateurs : **livrée, validation en attente**

**Optimisations :**

1. **Caches `Intl`** : les formateurs de nombres et de dates de fuseau étaient
   recréés à chaque survol. Mesure : 5 000 formatages passent de **94,5 ms à
   3,8 ms** (×25). Une conversion de fuseau ne crée plus aucun formateur.
2. **Court-circuit du survol** : sans montant, unité ni heure sur la page,
   plus aucun test de position n'est fait (test dédié : 0 appel à
   `caretPositionFromPoint` et `elementsFromPoint`).
3. **Mémoïsation des zones interdites** : coût amorti O(1) par élément au lieu
   d'une remontée de toute la chaîne des parents pour chaque nœud.
4. **Court-circuit des expressions** : sans chiffre, les formats numériques ne
   sont plus essayés (les nombres en lettres restent analysés).
5. **Élagage mémoire** : nœuds et images retirés de la page supprimés des
   ensembles ; `Range` réutilisé pour les mesures de survol.
6. **Code mort supprimé** : `REJECTION_LABELS`, `BASE_CURRENCY`, commentaire
   dupliqué.
7. Mesures ajoutées : rafale de 3 500 nœuds (**366 ms**), prose de 2 000
   paragraphes, DOM profond (1 500 prix × 10 niveaux), 6 000 conversions.

**Navigateurs :**

| Paquet | Cibles | Manifeste |
|---|---|---|
| `uniconv-1.1.0.xpi` | Firefox 140+ | `background.scripts` + bloc `gecko` |
| `uniconv-1.1.0-chromium.zip` | Chrome, Edge, Brave, Opera, Vivaldi | `background.service_worker`, sans `gecko` |
| `uniconv-1.1.0-safari.zip` + `dist/safari/` | Safari 16.4+ (Xcode) | idem Chromium, `options_ui` sans `open_in_tab` |

`compat-tests` vérifie les trois manifestes, la liste blanche des API, le
garde-fou de `captureVisibleTab` et la documentation des navigateurs.

**À vérifier :** recharger l'extension (marqueur `1.1.0`), vérifier devises,
unités et fuseaux, la fluidité sur une page sans montant, puis charger le
dossier Chromium dans Chrome/Edge/Brave/Opera. Safari : `docs/PUBLICATION.md`
§ 4bis.

### Itération 14 — OCR des unités et quarts : **livrée, validation en attente**

1. **L'OCR convertit toutes les unités** (et aussi les heures), pas seulement
   les devises. Le résultat emprunte le MÊME chemin qu'un clic : bulle figée,
   menu du bon type (devises / unités / villes), poignée. La première
   conversion trouvée dans l'ordre de lecture est affichée ; les autres sont
   listées en console.
2. **Quart US ajouté** : `quart`, `quarts`, `qt`, `qts` = **0,946352946 L**
   (quart liquide US, cohérent avec le gallon US déjà présent). Il apparaît
   dans le menu des volumes.
3. **Faux positif évité** : « 3 quarts de la surface » (fraction française)
   n'est pas converti ; « 2 quarts of milk » (anglais) l'est.
4. **Tests** : 8 vérifications d'unités (conversions, tokens, fraction) et
   9 vérifications d'intégration OCR (pieds/pouces, Fahrenheit, quarts, livres,
   mph, heure, menus, aucun résultat). **842 au total.**

**À vérifier :** sur `test/formats.html` (lignes 25–27) et en OCR manuel
(bouton **Scan**) sur une zone contenant « 2 quarts », « 6 ft 2 in » ou
« 68 °F » : la bulle doit convertir et proposer le menu des unités.

### Itération 15 — corrections OCR/unités : **livrée, validation en attente**

Deux défauts signalés par l'utilisateur :

1. **« unreal » converti en real brésilien.** `PATTERN_WORDS_AFTER` acceptait
   l'absence d'espace : « un » (nombre) + « real » (devise) formaient
   « unreal » → 1 BRL. L'espace est désormais **obligatoire** entre un nombre
   en lettres et une devise. « dix euros » et « ten dollars » continuent de
   fonctionner ; « unreal engine » ne déclenche plus rien. Piège n° 61 ajouté
   à `test/faux-positifs.html`.
2. **« 2.1 QT » non reconnu par l'OCR.** Les tokens d'unités étaient en
   minuscules ; l'OCR (et les emballages) écrit en capitales. Des **alias
   majuscules** sont générés pour tous les tokens de 2 caractères ou plus
   (`QT`, `QTS`, `IN`, `FT`, `ML`, `LB`, `KM/H`…), et les règles anti-faux-
   positifs « in »/« st » sont désormais insensibles à la casse. « 10 IN THE
   BOX » reste une phrase, pas des pouces.
3. **Serveur de test** : il s'était arrêté, d'où le lien
   `http://localhost:8123/test/formats.html` inaccessible. Relancé.

**Tests** : `units-tests` 66 (+6), `dynamic-tests` 158 (+2),
`false-positive-tests` 90 (61 pièges). **850 au total.**

**À vérifier :** recharger l'extension (marqueur `1.2.1`), puis :
- sur une page contenant « unreal », aucun pointillé ni bulle ;
- Bouton **Scan** sur une zone « 2.1 QT » : conversion en 1,99 L + menu des unités ;
- `test/formats.html` (serveur relancé).

### Itération 16 — écritures des unités : **livrée, validation en attente**

À la demande de l'utilisateur, un **inventaire complet** des écritures d'unités
a été rédigé (`docs/UNITES-ECRITURES.md`, sources BIPM/NIST/Wikipédia) puis
implémenté :

1. **Mots pleins** : `kilogrammes`, `mètres`, `litres`, `milles`, `livres`…
   (déjà présents, désormais testés) et **températures en toutes lettres** :
   « 20 degrés Celsius », « 70 degrés Fahrenheit », « 20 deg C », « 20 ° C »,
   y compris sans accent et en capitales.
2. **Kelvin** : « 300 K » est détecté et converti en **26,85 °C** (ou °F selon
   le système). Règles de contexte : « 50 K abonnés », « 50K vues », « 50K »
   ou « 50 K » seul ne sont **pas** des températures ; « température 77 K » et
   « azote liquide 77 K » le sont.
3. **Nouvelles unités** : tonne, mg, µg, cl, dl, hl, fl oz, tsp/tbsp (et
   « cuillère à café/soupe »), cc, mille marin (nmi), micron/µm, m/s, nœud.
4. **Fractions** : `1/2`, `3/4`, `2 1/2`, `2½`, `2 ½`, `½` — avec ou sans
   espace avant l'unité. « 1/2/2026 » n'est pas une mesure.
5. **Équivalences** affichées pour les nouvelles unités, et choix de l'unité
   métrique affiné (mm, µm).
6. **Tests** : `units-tests` 103 (+37), `dynamic-tests` 160 (+2 : « 1/2 cup »,
   « 300 K »), `false-positive-tests` 90 (63 pièges : « 50 K abonnés »,
   « 50K vues »). **889 au total.**
7. **Page de test** : 10 cas visuels ajoutés (`formats.html` 28–37).

**À vérifier :** recharger l'extension (marqueur `1.3.0`), puis sur
`formats.html` les lignes 28–37, et l'OCR sur « 1/2 cup », « 300 K »,
« 20 degrés Celsius ».

### Itération 17 — ville + fuseau dans la bulle : **livrée, validation en attente**

Demande de l'utilisateur : « écrire le fuseau horaire à côté de la ville que
l'on veut choisir ».

1. **Ligne cible de la bulle** : `14:30 CET -> Paris (Europe/Paris) · -1 h`
   (au lieu de `-> Paris`). Pour un fuseau fixe (UTC+2), on garde `UTC+2`
   sans parenthèses inutiles.
2. **« Ma ville »** : `Ma ville (Paris — Europe/Paris)`.
3. **Menu des villes** : le libellé passe à la ligne au lieu d'être tronqué,
   donc « Buenos Aires (America/Argentina/Buenos Aires) » reste lisible en
   entier même sur 260 px.
4. **Tests** : `timezone-tests` 83 (+3 : Paris, Tokyo, fuseau fixe),
   `dynamic-tests` 161 (+1 : bulle cible avec « Paris (Europe/Paris) »).
   **893 au total.**
5. Prompts de conception mis à jour (`docs/design/FRAME-PROMPTS*.md`).

**À vérifier :** recharger l'extension (marqueur `1.3.1`), cliquer sur une
heure (« 14:30 CET »), puis choisir Paris : la bulle doit afficher
« Paris (Europe/Paris) » et le menu doit laisser le fuseau visible.

### Itération 18 — décalage GMT et première ligne : **livrée, validation en attente**

Précision de l'utilisateur : ce n'était pas l'identifiant IANA qu'il fallait à
côté de chaque ville, mais le **décalage horaire** (`GMT+2`).

1. **Menu des villes** : chaque ligne affiche `Ville (GMT±X)` — `Paris
   (GMT+2)`, `Tokyo (GMT+9)`, `New York (GMT-4)`, `Mumbai (GMT+5:30)`,
   `Katmandou (GMT+5:45)`, `Londres (GMT)`. Le décalage est calculé à
   **l'instant de l'heure convertie** (heure d'été/hiver), pas à l'ouverture
   de la bulle. L'identifiant IANA reste en infobulle (`title`).
2. **« Ma ville »** : `Ma ville — Paris (GMT+1)` (ou GMT+2 en été).
3. **Première ligne** : `14h30 à Paris` (24 h) ou `2:30 PM à Paris` (12 h).
   Pour un fuseau fixe : `13h30 UTC` (sans « à »). Le détail devient
   `14:30 CET · -1 h` : il ne répète plus la cible.
4. **Format** : `GMT` pour 0, `GMT+5:30` pour les demi-heures, `GMT+5:45`
   pour les trois quarts d'heure.
5. **Tests** : `timezone-tests` 90 (+7), `dynamic-tests` 163 (+2 :
   « Tokyo (GMT+9) », « Mumbai (GMT+5:30) »). **902 au total.**
6. Prompts de conception mis à jour.

**À vérifier :** recharger l'extension (marqueur `1.3.2`), cliquer sur
« 14:30 CET », puis ouvrir le menu : chaque ville doit afficher son GMT ;
la première ligne doit afficher « 14h30 à Paris » (ou l'heure de la ville
choisie).

### Itération 19 — fourchettes de prix : **livrée, validation en attente**

Demande de l'utilisateur : les salaires de `jobs.echinacities.com` ne sont pas
détectés. La page affiche `Salary Range : 2000 - 3000 CNY /Day`,
`€200-€300`, `330 - 3300 USD /Day`.

1. **Une fourchette = UNE détection** (priorité 4) : elle s'affiche
   `2 000 – 3 000 CNY = 254 – 381 €` et se convertit avec **un seul taux**.
   Les montants isolés qui la composent sont écartés.
2. **Tous les séparateurs** : `-`, `–` (tiret cadratin), `—` (tiret long),
   `−` (signe moins), `/`, `~`, `to`, `à`, `a`, `entre … et`,
   `between … and`.
3. **Toutes les places de devise** : avant les deux bornes (`€200-€300`,
   `CNY 2000 - 3000`), après la seconde (`2000 - 3000 CNY`, `10–20 €`),
   après la première (`10 EUR - 20`), des deux côtés (`10 EUR - 20 EUR`).
4. **Garde-fous** : une note `4,5/5 EUR`, un téléphone `(555) 123-4567 EUR`,
   une date, un ratio, une plage sans devise (`10-20 pages`) ne sont **pas**
   des fourchettes.
5. **Affichage** : `$2,000 – $3,000` (symbole répété) ou
   `2 000 – 3 000 €` / `2 000 – 3 000 CNY` (symbole ou code une seule fois).
6. **Tests** : `run-tests` 93 (+26), `dynamic-tests` 166 (+3 : bulle,
   conversion, une seule surbrillance), `false-positive-tests` 90.
   **931 au total.** 15 cas visuels ajoutés à `formats.html` (§ 5).

**À vérifier :** recharger l'extension (marqueur `1.4.0`), ouvrir
`jobs.echinacities.com/jobchapter/1355114339`, survoler « 2000 » du salaire :
la bulle doit afficher la fourchette convertie. Tester aussi
`formats.html` § 5 (15 écritures).

### Itération 20 — FLE/PHP et navigation des tests : **livrée, validation en attente**

1. **PHP philippin sur FLE** : la page écrit « Entre **70.000** et **80.000**
   PHP ». Le nombre n'était pas reconnu car le motif exigeait une virgule
   décimale derrière les points de milliers. Un nouveau motif accepte
   « 70.000 » (milliers à points **sans** décimale) ; `parseAmount` les lisait
   déjà comme des milliers. Résultat : « Entre 70.000 et 80.000 PHP » est une
   fourchette, et « 70.000 PHP » seul est un montant.
2. **Navigation des pages de test** : les 5 pages (`formats`, `monnaies`, `faux-positifs`,
   `dynamique`, `fuseaux`) partagent une barre collée en haut,
   avec la page courante surlignée. Fichier `test/test-nav.css`.
3. **Tests** : `run-tests` 97 (+4 : trois fourchettes PHP et un montant seul),
   `dynamic-tests` 168 (+2 : bulle FLE et conversion). **937 au total.**
4. **Effet de bord assumé** : « 1.234 € » est désormais lu **1 234 €**
   (milliers à points), alors qu'il n'était pas détecté avant. C'est la
   convention française ; un « 1.234 » décimal anglais à trois chiffres reste
   ambigu et est traité comme des milliers.

**À vérifier :** recharger l'extension (marqueur `1.4.1`), ouvrir la page FLE,
survoler « 70.000 » : la bulle doit afficher la fourchette convertie. Les
pages de test ont maintenant des liens en haut.

### Itération 21 — pesos génériques : **livrée, validation en attente**

La page FLE de Oaxaca écrit « **135 pesos** l'heure ». L'extension connaissait
« peso mexicain », « pesos philippins », « pesos argentins », mais **pas** le
mot seul « pesos » : rien n'était détecté.

1. **« peso » / « pesos »** sont désormais rattachés au **peso mexicain
   (MXN)** par défaut, comme « $ » l'est au dollar US. « 135 pesos » →
   135 MXN → conversion en euros.
2. **Les formes précises restent prioritaires** (les mots sont triés du plus
   long au plus court) : « 135 pesos philippins » → PHP, « 135 pesos
   argentins » → ARS, « 135 pesos mexicains » → MXN.
3. **Fourchettes** : « Entre 135 et 150 pesos » → 135–150 MXN.
4. **Tests** : `run-tests` 103 (+6), `dynamic-tests` 169 (+1 : bulle FLE
   Mexique). **944 au total.**
5. **Limite documentée** : « pesos » seul est ambigu (Mexique, Argentine,
   Philippines, Colombie, Chili…). Le défaut MXN est un choix ; la ligne
   « 1 MXN = … » de la bulle rend la devise utilisée explicite.

**À vérifier :** recharger l'extension (marqueur `1.4.2`), ouvrir la page FLE
de Oaxaca, survoler « 135 pesos » : la bulle doit afficher 135 MXN converti.

### Itération 22 — dollar de Brunéi : **livrée, validation en attente**

La page FLE de Bandar Seri Begawan écrit « **500BND** net d'impôt ». BND
n'existait que dans les **métadonnées** (drapeau + nom), pas dans la table des
devises : le code n'était donc jamais reconnu.

1. **BND ajouté** à `CURRENCIES` (sans symbole : « B$ » entrerait en conflit
   avec « $ » dans la classe de caractères des symboles ; le code suffit).
   Noms : « dollar de brunei », « dollars de brunei », « dollar brunéien »…
2. **`500BND`** (code collé, sans espace), **`500 BND`** et
   **`500 dollars de brunei`** sont détectés. La conversion utilise les taux
   de la source large (open.er-api), qui couvre BND.
3. **Recherche** : taper « brunei » dans le menu trouve BND.
4. **toutes les devises des taux** dans les réglages ; la détection couvre 167 devises
   (étendue à l'itération 24).
5. **Tests** : `run-tests` 106 (+3), `dynamic-tests` 170 (+1),
   `currency-search-tests` 30 (+1). **949 au total.**

**À vérifier :** recharger l'extension (marqueur `1.4.3`), ouvrir la page FLE
de Brunéi, survoler « 500BND » : la bulle doit afficher 500 BND converti.

### Itération 23 — audit mémoire et optimisations : **livrée, validation en attente**

**Optimisations trouvées par l'audit :**

1. **Fourchettes** : les 4 expressions régulières étaient lancées sur **tous**
   les nœuds de texte, même sans chiffre. Elles sont désormais dans le
   `if (hasDigit)` : travail nul sur la prose sans nombre.
2. **Unités** : la grande expression (tous les tokens) était lancée sur des
   nœuds purement numériques. Une sortie rapide (`lettre`, `°`, `µ`, quote ou
   barre) l'évite.
3. **Formateurs de fuseaux** : le cache n'était pas borné. Le menu des 132
   villes créait **132 `Intl.DateTimeFormat`** retenus pour toute la durée de
   l'onglet. Cache **LRU de 32** désormais.
4. **Inexactitude corrigée** : le README annonçait « 167 devises » pour la
   **détection**. La table de détection contient **46 devises** (celles dont
   le symbole et les noms sont vérifiés) ; les **168 devises cibles** sont
   celles proposées pour la conversion, via les taux. Deux tests de couverture
   empêchent la confusion de revenir.

**Mesures (outil `tools/memory-report.mjs`, Node, après GC) :**

| Élément | Mesure |
|---|---|
| `content.js` | 305 Ko (84 Ko gzip) |
| Code compilé (content) | ~776 Ko |
| Données + index | ~144 Ko |
| **Plancher par onglet** | **~0,9 Mo** |
| `background.js` compilé | ~85 Ko |
| OCR (fichiers) | 8,2 Mo |
| OCR actif | 60–120 Mo, onglet fermé après 120 s |
| Installé / paquet | 8,6 Mo / 5,4 Mo |

**Limite** : ces chiffres sont mesurés dans Node, pas dans Firefox. Le
« plancher » est ce que l'extension retient (code + tables), sans le moteur JS
ni le DOM de l'onglet. Pour le chiffre exact : `about:memory` dans Firefox.

**À vérifier :** recharger l'extension (marqueur `1.5.0`), vérifier que les
devises, unités, fuseaux et fourchettes fonctionnent toujours, puis
`node --expose-gc tools/memory-report.mjs`.

### Itération 24 — toutes les devises + 4e source : **livrée, validation en attente**

1. **167 devises détectées** : la table CURRENCIES ne contenait que 46 devises
   curatées ; les 121 autres (KWD, QAR, TWD, BHD, OMR, JOD, LBP…) existaient
   dans CURRENCY_META. Elles sont maintenant ajoutées au démarrage avec leur
   **code ISO** et leur **nom français**. Les codes et les noms sont acceptés
   **sans tenir compte de la casse** (« 500 kwd », « 500 Dollars »).
   - Une seule devise (SLE) reste détectable par son code seul : son nom
     « leone » est déjà pris par SLL.
   - Les symboles des nouvelles devises ne sont pas ajoutés (la classe de
     caractères des symboles ne gère que les symboles d'un caractère) : le
     code et le nom suffisent.
2. **4e source de taux** : `api.exchangerate-api.com/v4/latest/EUR`
   (gratuite, sans clé, indépendante). Elle est la **dernière** dans l'ordre
   de fusion : Frankfurter (BCE) reste prioritaire, puis open.er-api, puis
   currency-api, puis ce secours.
3. **Permission** : 5e hôte `https://api.exchangerate-api.com/*` dans les
   trois manifestes ; confidentialité et guide de publication mis à jour.
4. **Tests** : `run-tests` 119 (+11), `background-test` 30 (+3 : repli,
   QAR), `dynamic-tests` 171 (+1 : 500 KWD), `currency-search-tests` 31
   (+1 : « koweit »). **967 au total.**
5. **Mémoire** : données + index 200 Ko (au lieu de 144), plancher par onglet
   **0,96 Mo** ; paquet toujours ~5,4 Mo.

**À vérifier :** recharger l'extension (marqueur `1.6.0`), tester « 500 KWD »,
« 500 QAR », « 500 TWD », puis vérifier que les taux se chargent (la 4e
source n'est utilisée qu'en secours).

### Itération 25 — convertisseur popup + page Monnaies : **livrée, validation en attente**

1. **Convertisseur dans le popup** : champ de montant, deux listes (devise
   ou unité), bouton d'inversion, résultat immédiat. Deux onglets :
   **Devises** (via les taux de l'arrière-plan) et **Unités** (5 catégories,
   conversions locales). Les facteurs du popup sont **identiques** à ceux de
   `content.js` (test `popup-tests`).
2. **Bouton OCR à côté du titre** : le bouton « OCR » est désormais dans
   l'en-tête, juste après « UniConv » ; l'ancien bloc du bas a été retiré.
3. **Page `test/monnaies.html`** : grand tableau des **167 devises**
   (drapeau, code, nom, symbole, exemple), champ de recherche, exemples à
   survoler. Générée par `tools/generate-currency-page.mjs` ; un test vérifie
   qu'aucune devise ne manque.
4. **Bandeau de navigation** : le bandeau existait déjà dans `fuseaux.html` ;
   le problème était le cache du navigateur. Les pages de test sont passées en
   `no-cache, no-store` et le lien **Monnaies** est ajouté partout.
5. **Tests** : `popup-tests` 16 (nouvelle suite), `currency-meta-tests` 13
   (+1 : page Monnaies). **984 au total, 17 suites.**

**À vérifier :** recharger l'extension (marqueur `1.7.0`), ouvrir le popup :
le convertisseur doit fonctionner (devises et unités), le bouton OCR doit être
à côté du titre. Ouvrir `monnaies.html?` avec un rechargement forcé
(`Cmd+Shift+R`) pour voir le bandeau et le tableau.

### Itération 26 — Scan, tutoriel et raccourcis : **livrée, validation en attente**

1. **Bouton « Scan »** à côté du titre du popup (au lieu de « OCR »).
2. **Case « Activer le Scan (OCR) »** dans les réglages : décochée, le bouton
   Scan et le raccourci personnel sont inactifs. L'ancien raccourci imposé
   `Alt+Maj+O` est **retiré** (il était déjà pris par Firefox).
3. **Tutoriel** `src/tutorial.html`, ouvert **une seule fois à l'installation**
   (drapeau `uniconv.tutorialSeen`) et accessible depuis le popup et les
   réglages : devises, unités, fuseaux, Scan, convertisseur, raccourcis,
   confidentialité.
4. **Raccourcis personnalisables** via `commands` : « Lancer le Scan » et
   « Ouvrir le convertisseur ». Aucune touche par défaut. Le convertisseur
   s'ouvre dans une petite fenêtre (`converter.html`), avec le **champ de
   montant déjà sélectionné** ; le code du convertisseur est partagé
   (`converter.js`).
5. **Traductions** : proposition `docs/TRADUCTIONS.md` pour les **six**
   langues officielles de l'ONU (l'ONU en compte six, pas cinq), avec
   glossaire et plan RTL arabe. L'intégration runtime reste un chantier dédié ;
   l'interface active est toujours fr/en.
6. **Tests** : `popup-tests` 16 → **26** (Scan, convertisseur partagé, page
   autonome, commandes, tutoriel, case OCR, absence de l'ancien raccourci).
   **994 au total.**

**À vérifier :** recharger l'extension (marqueur `1.8.0`), vider éventuellement
`uniconv.tutorialSeen` pour revoir le tutoriel, tester le bouton Scan, la case
dans les réglages, puis affecter les deux raccourcis dans `about:addons`.

### Itération 27 — langues et Scan visible : **livrée, validation en attente**

Deux reproches justes de l'utilisateur :

1. **Aucun sélecteur de langues** : la page de réglages n'offrait que
   fr/en/auto. J'avais livré une **proposition** (`docs/TRADUCTIONS.md`) au
   lieu de l'intégration. Le sélecteur propose maintenant **français,
   anglais, espagnol, russe, chinois** (`i18n.js`), et les **libellés/titres**
   du popup, des réglages, du tutoriel et du convertisseur sont traduits.
   Les messages de la bulle (`TEXTS`) existent dans les cinq langues.
   **Limite** : les textes d'aide longs restent en français ; l'arabe (sixième
   langue officielle de l'ONU, RTL) n'est pas encore proposé.
2. **Case OCR invisible depuis le popup** : elle existait dans les réglages
   (section 6), mais pas dans le popup. Une case **« Activer le Scan »** est
   maintenant sous l'en-tête du popup ; elle enregistre `uniconv.ocrEnabled`
   et désactive immédiatement le bouton Scan. La case des réglages reste.
3. **Tests** : `popup-tests` 26 → **30** (langues, chargement d'`i18n.js`,
   messages es/ru/zh, case du popup). **998 au total.**

**À vérifier :** recharger l'extension (marqueur `1.9.0`), fermer/rouvrir le
popup et les réglages, choisir une langue dans « Langue », puis décocher
« Activer le Scan » dans le popup : le bouton Scan doit se désactiver.

### Itération 28 — frontières et case Detection : **livrée, validation en attente**

Deux bugs signalés, tous deux confirmés :

1. **« 3–7 working days » souligné** : le code **KES** (shilling kényan) était
   reconnu **dans le mot « takes »**, puis « KES 3–7 » formait une fourchette.
   Les motifs de fourchette n'avaient pas de garde-fou **avant** la devise.
   Ajout de `NOT_BEFORE` / `(?<![\p{L}])` avant la devise des fourchettes.
   Les **noms** de devises exigent désormais un **espace** avant eux
   (« 10 dollars » oui, « 10dollars » non).
2. **Case Detection** : le bouton « Suspendre sur toutes les pages » est
   remplacé par la **case « Activer la detection »** (cochée = active,
   décochée = pause + badge OFF). Le raccourci `Alt+Maj+U` est **retiré** de
   l'interface, du code et des tests. Aucun raccourci de pause n'est imposé.
3. **Tests** : `run-tests` 122, `units-tests` 104, `timezone-tests` 91,
   `dynamic-tests` 169 (raccourci négatif), `popup-tests` 32.
   **1003 au total.**

**À vérifier :** recharger l'extension (marqueur `1.9.1`), ouvrir la page qui
contenait « 3–7 working days » : plus aucun pointillé ; dans le popup,
décocher la case **Activer la detection** → badge OFF, puis la recocher.

### Itération 29 — six langues, engrenage, audit : **livrée, validation en attente**

1. **Langue système** : à l'installation, la langue du système est reprise si
   elle fait partie des **six** (ar, zh, en, fr, ru, es) et **enregistrée** ;
   toute autre langue donne **l'anglais**. L'option `auto` reste disponible.
   L'arabe est ajouté au sélecteur, avec `dir="rtl"` sur les pages et la bulle.
   Les libellés principaux sont traduits ; les textes d'aide longs restent en
   français.
2. **Engrenage** : le bouton des réglages est une icône **⚙** en haut à droite
   du popup ; le bouton du bas est supprimé.
3. **Popup** : largeur **340 px**, `overflow-x: hidden` : plus de barre
   horizontale.
4. **OCR automatique supprimé** : réglages, code de score/capture/cache,
   statistiques, page `test/ocr-auto.html` et suite `page-tests`. Seul le Scan
   manuel reste. Le contenu de `content.js` diminue d'environ **20 Ko** (306 → 286 Ko).
5. **Audit** : suppression des clés `ocrAuto`/`ocrThreshold`/`ocrBudget`, des
   fonctions et messages associés, des liens de navigation vers la page
   supprimée. **Tests : 934, 16 suites.**

**À vérifier :** recharger (marqueur `2.0.0`), vérifier le popup (engrenage,
aucune barre horizontale), les six langues, puis choisir une langue non
couverte (allemand) : l'interface doit être en anglais.

### Itération 30 — popup 360 et design 2.0 : **livrée, validation en attente**

1. **Cause de la barre** : le popup était large de 340 px et la barre verticale
   recouvrait les contrôles de droite. Largeur portée à **360 px**, padding
   **12/20/14/16** et **`scrollbar-gutter: stable`** : la gouttière est réservée,
   les boutons ne passent plus dessous.
2. **Engrenage** : bouton **30×30**, icône **SVG 18×18** (`currentColor`),
   centré avec le titre, le bouton Scan et la version. Le bouton des réglages
   reste en haut à droite.
3. **Design** : `DESIGN-SPEC.md` passe en **2.0.1** (six surfaces, popup 360,
   S12–S14, RTL, six langues, OCR automatique retiré), `tokens.json` reçoit les
   valeurs de layout, `design/EVOLUTIONS-2.0.md` décrit les nouveaux cadres,
   `design/README.md` et les prompts renvoient vers cette mise à jour.
4. **Tests** : `popup-tests` vérifie 360 px, la gouttière, l'absence de barre
   horizontale et l'engrenage SVG 30/18. **934 vérifications, 16 suites.**

**À vérifier :** recharger (marqueur `2.0.1`), ouvrir le popup : l'engrenage
est aligné et plus grand, aucun bouton ne touche la barre verticale, aucune
barre horizontale. Vérifier aussi en arabe (RTL).

### Itération 31 — yuan, k/m/b et clic droit : **livrée, validation en attente**

1. **Faux positif KES** : le code `KES` était reconnu dans le mot « takes »
   (« takes 6 » → KES 6). Le motif code-avant-nombre a reçu le même garde-fou
   `NOT_BEFORE` que les fourchettes. Test : « It takes 6 weeks » ne produit
   aucun montant.
2. **Yuan** : `CNY`, `RMB`, `CNH`, `yuan`, `renminbi`, `chinese yuan`,
   `人民币` et `元` ; alias `RMB`/`CNH` → `CNY` ; recherche « rmb » et
   « renminbi ». Le symbole `元` est détecté collé (`13元`).
3. **Ordres de grandeur** : `13K`, `1.2M`, `3B`, dans les montants isolés et
   les fourchettes (`RMB 5-9k` = 5 000 – 9 000). Les pièges `1,2 M de vues`,
   `50 K abonnés` et `50K vues` restent muets ; `12 m€` devient un vrai prix
   (12 millions d'euros).
4. **Menu contextuel** : permission `contextMenus`, entrée **Convertir** avec
   le logo de l'extension, sur une sélection ; le texte est envoyé au moteur
   de la page (devises, unités, fuseaux) et la bulle s'ouvre.
5. **Tests** : `run-tests` 122 → **130**, `currency-search-tests` 31 → **33**,
   `dynamic-tests` 133 → **135**, `popup-tests` 36 → **38**. **948 au total.**

**À vérifier :** recharger (marqueur `2.1.0`), sélectionner « 13K RMB » puis
clic droit → **Convertir** ; tester « RMB 5-9k », « renminbi 100 », « 13元 »,
et la page `discoverchinatefl.com` (plus de « kes 6 »).

### Itération 32 — devise de départ modifiable : **livrée, validation en attente**

1. **Bulle figée** : ajout d'une ligne **« Devise de départ »** au-dessus de
   « Convertir vers ». Liste native des 167 devises ; la devise détectée est
   présélectionnée.
2. **Ambiguïté `¥`** : `¥8,000` reste détecté JPY par défaut, mais l'utilisateur
   choisit **CNY** dans la liste ; la bulle recalcule `8 000 元` et le taux
   CNY → cible. La détection automatique n'est pas modifiée.
3. **Portée** : le choix vaut pour le montant affiché ; il n'est pas enregistré
   comme devise cible et ne change pas les autres bulles.
4. **Tests** : `dynamic-tests` 135 → **137** (liste de départ, reconversion
   `¥` → CNY). **947 au total.**

**À vérifier :** recharger (marqueur `2.2.0`), cliquer sur `¥8,000`, puis dans
la bulle choisir **CNY** dans « Devise de départ » : la conversion et le taux
doivent changer.

### Itération 33 — unités de référence : **livrée, validation en attente**

1. **Cadre « Unités de référence »** en haut du popup : monnaie (recherche,
   10 résultats), fuseau, métrique/impérial.
2. **Plus de pointillés** pour les valeurs déjà dans ces unités : EUR,
   métrique et Paris pour un utilisateur français. Les autres valeurs sont
   converties vers ces références.
3. **Cible temporaire** : changer la devise, l'unité ou la ville dans une
   bulle n'est pas enregistré ; la bulle suivante revient aux références.
4. **Devise de départ** : recherche + 10 résultats maximum (au lieu de
   167 options natives).
5. **Tests** : `dynamic-tests` 137 → **140** (référence EUR/métrique/Paris,
   cible non enregistrée, recherche de départ), `popup-tests` 38 → **40**
   (cadre en haut, champs). **952 au total.**

**À vérifier :** recharger (marqueur `2.3.0`), ouvrir le popup : le cadre
« Unités de référence » est en haut ; une page avec `10 €`, `10 km` et
`14:30 CET` ne doit plus les souligner, mais doit encore souligner `10 USD`,
`10 miles` et `14:30 EST`.

### Itération 34 — correctif du cadre de référence : **livrée, validation en attente**

Deux bugs réels signalés :

1. **Le cadre du popup ne s'initialisait jamais** : `initReferenceCard()` avait
   été placé dans `setUnitSystem()` au lieu du démarrage. Les champs restaient
   vides et aucun écouteur n'était branché. Déplacé dans `DOMContentLoaded`.
2. **La recherche de la devise de départ ne recevait pas la frappe** : la ligne
   était un `<label>` contenant deux champs (recherche + select), donc le focus
   partait sur le select. Remplacée par un `<div>` ; test de recherche ajouté.
3. **Popup** : la monnaie de référence est désormais un **champ cliquable**
   ouvrant un menu avec **barre de recherche** et 10 résultats ; le fuseau est
   un select peuplé au démarrage.
4. **Tests** : `dynamic-tests` 140 → **141** (recherche « yuan » dans la devise
   de départ). **954 au total.**

**À vérifier :** recharger (marqueur `2.3.1`), ouvrir le popup : cliquer sur le
champ **Monnaie**, taper « yuan », choisir CNY ; le fuseau doit proposer les
villes. Dans une bulle, taper dans la recherche de « Devise de départ ».

### Itération 35 — menus de devises complets : **livrée, validation en attente**

Le défaut signalé était réel : les menus ne contenaient que 10 monnaies.

1. **Popup** : la liste contient **toutes les monnaies** ; la hauteur montre
   ~10 lignes et le reste se parcourt à la molette. La recherche filtre.
2. **Bulle** : la devise de départ est une **vraie combobox** (champ cliquable,
   menu, recherche), avec **toutes les monnaies**, 10 lignes visibles et
   défilement.
3. **Tests** : `dynamic-tests` vérifie que le menu de la bulle contient
   **plus de 10 monnaies** ; `popup-tests` vérifie qu'aucune coupe à 10 n'est
   faite et que la liste a une hauteur de 10 lignes. **955 au total.**

**À vérifier :** recharger (marqueur `2.3.2`), ouvrir les deux menus, faire
défiler jusqu'à une monnaie rare (ex. BND), et rechercher « yuan ».

### Itération 36 — signe de devise cliquable : **livrée, validation en attente**

1. **Bulle allégée** : la ligne « Devise de départ » est supprimée. Les
   **signes de la devise de départ et de la devise cible** sont des boutons
   colorés avec relief (bleu/vert) et un chevron.
2. **Menus flottants** : chacun contient **toutes les monnaies**, avec
   recherche, 10 lignes visibles et défilement ; il se place sous le signe (ou
   au-dessus près du bas de la fenêtre).
3. **Tests** : `dynamic-tests` vérifie que le signe est cliquable, que le menu
   contient plus de 10 monnaies, que la recherche « yuan » trouve CNY et que
   le montant est reconverti. **955 au total.**

**À vérifier :** recharger (marqueur `2.4.0`), cliquer sur le signe `¥` d'un
montant, faire défiler jusqu'à BND, rechercher « yuan », choisir CNY.

### Itération 37 — épinglage et devises principales : **livrée, validation en attente**

1. **Menus de devises** (source, destination, monnaie de référence du popup) :
   sections **Épinglées / Principales / Autres**.
2. **Épinglage** : icône **📌** sur chaque ligne ; elle épingle sans sélectionner
   et mémorise le choix dans `uniconv.pinnedCurrencies`. L'épinglage est
   partagé entre la bulle et le popup.
3. **Devises principales** : USD, EUR, JPY, GBP, CNY, AUD, CAD, CHF, HKD, NZD
   restent en tête après les épinglées.
4. **Tests** : `dynamic-tests` 141 → **143** (sections + épinglage de BND),
   `popup-tests` 42 → **43** (sections et épinglage du popup). **951 au total.**

**À vérifier :** recharger (marqueur `2.5.0`), ouvrir un menu de devises,
épingler BND, vérifier la section **Épinglées** en tête, puis retrouver BND
épinglé dans l'autre menu.

### Itération 38 — drapeaux et ordre d'importance : **livrée, validation en attente**

1. **Drapeaux** : chaque ligne des menus source, destination et monnaie de
   référence affiche le drapeau emoji du pays quand il est connu (🇪🇺, 🇺🇸,
   🇯🇵…). Les devises multi-pays sans drapeau (CFA) restent sans emoji.
2. **Ordre d'importance** : les sections **Principales** suivent l'ordre
   USD, EUR, JPY, GBP, CNY, AUD, CAD, CHF, HKD, NZD (plus l'ordre
   alphabétique). Les épinglées restent en tête, triées par importance.
3. **Tests** : `dynamic-tests` 143 → **145** (ordre USD/EUR/JPY + drapeau
   USD), `popup-tests` 43 → **44** (table pays + ordre). **954 au total.**

**À vérifier :** recharger (marqueur `2.6.0`), ouvrir les menus : drapeaux à
gauche des noms, Principales dans l'ordre, épinglées en tête.

### Itération 39 — Scanner au clic droit : **livrée, validation en attente**

1. **Clic droit → Scanner** (contexte page) avec le logo de l'extension ;
   **Convertir** reste sur une sélection. Le Scan respecte « Activer le Scan ».
2. **Principales limitées à 5** : USD, EUR, JPY, GBP, CNY. Les autres
   (AUD, CAD, CHF, HKD, NZD) passent dans **Autres**.
3. **Séparateurs de catégories** plus contrastés : filet, fond et texte plus
   marqués dans la bulle et le popup.
4. **Tests** : `popup-tests` 44 → **45** (Scanner + 5 principales). **955.**

**À vérifier :** recharger (marqueur `2.7.0`), clic droit sur une page →
**Scanner** avec le logo, puis vérifier les 5 principales et les séparateurs.

### Itération 40 — clic sur un signe en survol : **livrée, validation en attente**

1. **Défaut corrigé** : dans une bulle de survol (non figée), cliquer sur le
   signe de devise animait le bouton mais n'ouvrait rien. Le clic **fige**
   maintenant la bulle sur le montant survolé, puis ouvre le menu.
2. **Tests** : `dynamic-tests` 145 → **147** (signe présent dans la bulle de
   survol + clic qui fige et ouvre le menu). **957 au total.**

**À vérifier :** survoler un prix, amener la souris sur la bulle, cliquer sur
le signe `¥` ou `$` sans avoir cliqué le prix : la bulle doit rester et le
menu doit s'ouvrir.

### Itération 41 — OCR plus robuste : **livrée, validation en attente**

Le signalement : zone 458×82 px, texte non reconnu sur
`discoverchinatefl.com` (police Cormorant Garamond), alors que Reddit marche.

1. **Agrandissement 3×** des petites zones (au lieu de 2×).
2. **Multi-essais** : image normale, binaire (seuil d'Otsu), inversée ; modes
   de page 6 (bloc), 7 (ligne) et 11 (texte épars), avec arrêt dès qu'un
   résultat est fiable.
3. **Secours texte HTML** : si le moteur ne lit toujours rien, l'extension lit
   le texte réel sous la zone ; les images restent lues par l'OCR.
4. **Tests** : `ocr-tests` 44 → **47**. **960 au total.**

**À vérifier :** relancer l'OCR sur la zone de `discoverchinatefl.com` ; elle
doit maintenant afficher le texte, même avec la police décorative.

### Itération 42 — édition, scroll, rapport de bug : **livrée, validation en attente**

1. **Somme éditable** : le nombre détecté est un champ contenteditable discret
   (transparence + soulignement pointillé). Entrée ou blur relance la
   conversion ; les fourchettes restent informatives.
2. **Scroll** : toute bulle figée se ferme au défilement (y compris un
   conteneur scrollable).
3. **Signaler un bug** : entrée du clic droit avec logo ; elle lance une
   sélection OCR, puis ouvre `src/report.html` avec l'image, le texte, l'URL,
   la zone et les diagnostics. Boutons **Copier le rapport**, **Copier
   l'image**, **Télécharger l'image**. **Aucun envoi réseau automatique** :
   le rapport est préparé localement.
4. **OCR** : multi-essais (normal/binaire/inversé, PSM 6/7/11) et secours texte
   HTML ; couverture de polices décoratives améliorée.
5. **Tests** : dynamic 147 → **150**, ocr 47 → **49**, popup 45 → **46**.
   **966 au total.**

**À vérifier :** recharger (marqueur `2.8.0`), modifier une somme, faire
défiler une bulle figée, puis clic droit → **Signaler un bug** et copier le
rapport.

### Itération 43 — correctif édition de somme : **livrée, validation en attente**

1. **Traces** : `renderMainContent` réutilisait le même élément sans le vider ;
   chaque modification empilait l'ancienne ligne. Le contenu est maintenant
   effacé avant chaque rendu.
2. **Survol** : le champ de somme passe sur fond blanc avec texte sombre au
   survol (et au focus), au lieu d'attendre le clic.
3. **Tests** : `dynamic-tests` 150 → **152** (deux modifications successives
   sans trace + classe de survol). **968 au total.**

**À vérifier :** cliquer 15, taper 17, valider, puis 12 : la bulle ne doit
afficher qu'une seule ligne, et le champ doit changer de couleur au survol.

### Itération 44 — design 16-bit + taille de bulle : **livrée, validation en attente**

1. **Taille** : la bulle de devise appliquait une largeur mémorisée et ajoutait
   une poignée ; le clic était donc plus grand que le survol. Elle garde
   maintenant la largeur automatique du survol, sans poignée.
2. **Direction 16-bit / Game Boy Advance** : contours encre 2 px, ombres dures
   2–4 px, rayons 2–4 px, boutons qui s'enfoncent, palette limitée.
3. **Surfaces** : `src/pixel-theme.css` est chargé par le popup, les réglages,
   le tutoriel, le convertisseur et le rapport. La bulle a ses propres règles.
4. **Docs** : `DESIGN-SPEC.md`, `EVOLUTIONS-2.0.md`, `tokens.json`, README et
   tutoriel mis à jour.
5. **Tests** : smoke 60 → **57** (la poignée de devise n'existe plus ; deux
   contrôles de largeur automatique la remplacent). **965 au total.**

**À vérifier :** cliquer un prix : la bulle doit avoir la même largeur que le
survol, sans poignée, avec les contours/ombres 16-bit.

### Itération 45 — audit lisibilité/placement : **livrée, validation en attente**

1. **Cadres inutiles** : `.field-control` et `.segmented` ne reçoivent plus de
   bordure/ombre de la surcouche 16-bit ; seuls les vrais boutons, champs et
   cartes en ont.
2. **Une seule ligne** : la bulle peut aller jusqu'à 700 px (ou fenêtre − 16 px)
   et la ligne principale ne revient plus à la ligne.
3. **Bouton toujours après** : le signe de devise est affiché en suffixe pour
   toutes les conventions (USD, EUR, JPY…), donc le bouton ne change plus de
   côté.
4. **Audit** : suppression de ~11 ko de code mort (`appendCurrencyPicker`), restauration de
   `selectSourceCurrency`/`selectTargetCurrency`/`updateTooltipText`.
5. **Tests** : dynamic 152 → **153** (bouton après la somme). **966.**

**À vérifier :** réglages sans cadres autour des interrupteurs/segments ; bulle
sur une ligne ; bouton à droite du montant pour USD, EUR et JPY.

### Itération 46 — état figé de la bulle : **livrée, validation en attente**

1. **Nuance** : la bulle figée passe de `#1B4ED1` à `#1642B8` (sombre) ou
   `#EEF3FF` (clair).
2. **Effet bouton cliqué** : ombre réduite de 4 px à 2 px + enfoncement interne
   `inset`. Aucun `transform`, pour ne pas casser les menus en position fixed.
3. **Déclencheurs** : clic sur le prix, clic sur un signe de devise, OCR.
4. **Tests** : `dynamic-tests` 153 → **155** (survol non figé + état figé).
   **968 au total.**

**À vérifier :** survoler puis cliquer un prix : la bulle doit légèrement
s'assombrir et paraître enfoncée, sans changer de position.

### Itération 47 — billion/milliard : **livrée, validation en attente**

Le rapport de bug YouTube contenait `$480 billion`, interprété seulement comme
`480` (le mot `billion` n'était pas un multiplicateur).

1. **Multiplicateurs en mots** : thousand(s), million(s), billion(s),
   trillion(s), millier(s), milliard(s).
2. **Abréviations** : bn, mn, tn, en plus de k/m/b.
3. **Texte du rapport** : le secours HTML ignore désormais la bulle de
   l'extension, donc plus de « Lecture de la zone… » dans `pageText`.
4. **Tests** : `run-tests` 130 → **133**, `ocr-tests` 49 → **50**. **972.**

**À vérifier :** hover sur `$480 billion` : la bulle doit convertir 480 milliards,
et le rapport de bug ne doit plus contenir « Lecture… ».

### Itération 48 — audit total/portabilité : **livrée**

- suppression du dernier ensemble mort (`availableCurrencies`) ;
- `MAX_AMOUNT` à `1e15`, test `1.2 trillion` ;
- chemins personnels retirés des scripts et docs ;
- `.gitignore`, suppression des `.DS_Store` ;
- guide GitHub `docs/GITHUB.md` ;
- **973 vérifications, 0 échec.**

### Itération 49 — rubrique Ko-fi : **livrée, validation en attente**

Un pied de popup **Soutenir UniConv** ajoute un bouton ambre **Offrir un café
sur Ko-fi**, en nouvel onglet (`noopener noreferrer`). Le lien pointe vers la page personnelle `https://ko-fi.com/fingersmooth`. `popup-tests` 46 → **47**.

### Itération 51 — audit sécurité : **livrée, validation en attente**

Audit complet documenté dans `docs/SECURITY.md`.

1. **Messages** : `sender.id` vérifié dans l'arrière-plan, le content script et
   le moteur OCR ; une autre extension ne peut plus déclencher capture/OCR.
2. **Taux** : validation finie/positive/bornée et nettoyage du cache.
3. **OCR/rapport** : rectangle, DPR, viewport, texte et image bornés ; image
   PNG uniquement ; bouton de suppression du rapport.
4. **Permissions** : hôtes réduits aux chemins réellement utilisés.
5. **CSP** : `base-uri 'none'; form-action 'none'`.
6. **Taille de bulle** : valeurs stockées bornées.
7. **Tests** : `compat-tests` 35 → **40**. **979.**

### Ce qui relève de l'utilisateur (honnêteté)

L'agent n'a pas de navigateur (Firefox « sans fenêtre » refusé par le bac à
sable). Le visuel — lisibilité, position de la bulle, fluidité du menu des
132 villes — a été constaté par l'utilisateur le 24/10 (« tout fonctionne »),
pas par l'agent.

## 10. Prochaine étape après l'itération 12

**Publication** : créer le compte Mozilla (gratuit), soumettre
`dist/uniconv-1.0.0.xpi` sur addons.mozilla.org, remplir la fiche et les
justifications de permissions (tout est rédigé dans `docs/PUBLICATION.md`),
puis éventuellement le paquet Chrome. Ensuite : maintenance (correctifs de faux
positifs, nouvelle version, notes de version).

---

## 11. Pièges déjà payés — ne pas les refaire

| Piège | Rappel |
|---|---|
| Extension fantôme | vérifier qu'il n'y a qu'une UniConv, quitter Firefox, recharger |
| Chemins d'extension | `chrome.runtime.getURL('src/…')` part de la **racine** ; `<script src="…">` part du **dossier de la page** |
| Worker Tesseract | toujours `workerBlobURL: false` sous Firefox |
| Moteur OCR | jamais dans le script d'arrière-plan (page d'événement déchargée) |
| Capture d'écran | ne **rien** afficher avant (bulle, voile) + attendre le repeint |
| Échelle de capture | la calculer depuis `naturalWidth / viewport.width`, pas depuis `devicePixelRatio` |
| Faux DOM des tests | il doit imiter Firefox (racine des TreeWalker, `querySelector`, `offsetNode`) |
| `WeakMap` | pas de `forEach` ; garder un `Set` en parallèle |
| Images cassées | `complete && naturalWidth === 0` → ne rien analyser |
| `data:` dans les pages de test | peut être bloqué par la CSP → préférer de vrais fichiers |
| Bulle figée | `frozen = true` bloque `hideTooltip()` ; passer par `dismissFrozenTooltip()` |
| Pastille OCR | jamais avant la capture : elle serait photographiée (famille du bug 17) |
| Verrou d'analyse | le libérer à la **fin** de la lecture, jamais après l'envoi des messages |
| Module pur | un calcul sans DOM se teste hors navigateur : l'extraire entre deux marqueurs |
| Heure sans fuseau | ne jamais convertir : ambigu et bruyant (« 14:30 ») |
| Abréviations de fuseau | la casse compte (`EST` ≠ « est ») ; documenter les ambiguïtés (IST, CST) |
| Décalage affiché | c'est **cible − source** : UTC face à CET donne bien `-1 h` |
| Page de test muette | elle doit s'auto-diagnostiquer (tableau de bord + rapport copiable) |
| Extension fantôme | le marqueur `data-unic-build` la révèle : la page affiche le code réellement chargé |

---

## 12. Refonte visuelle (engagée le 24/10)

L'utilisateur juge le design actuel « pas très bon » et confie la refonte à un
service externe. Le rôle de l'agent est désormais d'**intégrer** la maquette,
pas de la produire.

Le brief livré (ne pas le réécrire sans raison) :

| Fichier | Rôle |
|---|---|
| `docs/DESIGN-SPEC.md` | 756 lignes : surfaces, contraintes techniques, direction artistique, tokens, anatomie et cotations de chaque composant, 11 cadres à produire, accessibilité, contrat de livraison, prompt prêt à coller |
| `docs/design/tokens.json` | valeurs machine (couleurs, typo, espacements, rayons, ombres, mouvement, tailles) — le **contrat d'intégration** |
| `docs/design/tooltip-anatomy.svg` | planche de cotations à l'échelle 1:1, servie en HTTP |
| `docs/design/README.md` | mode d'emploi du dossier |
| `docs/design/FRAME-PROMPTS.md` | **11 prompts cadre par cadre** (S01 à S11), prêts à coller dans un outil de design |
| `docs/design/FRAME-PROMPTS-2000.md` | la même chose en compact (**922 à 1547 caractères**), pour les outils limités à 2000 |

**À la réception des fichiers** :

1. lire `tokens.json` et le traduire en variables CSS `--uni-*` ;
2. reporter les styles dans `src/content.js` (bulle + menus),
   `src/options.html`, `src/popup.html`, **sans toucher à la structure** ;
3. rejouer `accessibility-tests` (contrastes) et `release-tests` ;
4. reconstruire les archives et faire valider dans Firefox ;
5. renseigner le marqueur de code (`CONTENT_BUILD_TAG`) et la version
   (1.0.1 ou 1.1.0 selon l'ampleur).

**Points de vigilance** : pas de police/image distante, contrastes ≥ 4,5:1,
redimensionnement 240–700 px, liste 200 px, un seul bouton par ligne, drapeaux
emoji.

## 13. Prompt à recoller dans une nouvelle session

> « Projet UniConv (extension Firefox, Manifest V3) dans
> `<dossier du projet>`. Lis d'abord
> `docs/REPRISE-DE-SESSION.md` : il contient l'historique complet, l'architecture,
> les décisions, les bugs corrigés et l'état exact du dernier chantier.
> Version 2.9.8, 979 vérifications qui passent en 16 suites
> (`for f in run-tests smoke-test background-test audit-tests units-tests
> currency-meta-tests currency-search-tests dynamic-tests false-positive-tests
> options-tests ocr-tests timezone-tests accessibility-tests
> release-tests compat-tests popup-tests; do node tools/$f.mjs | tail -2; done`).
> Les archives sont produites par `node tools/package.mjs`.
> Je ne suis pas développeur : explique chaque étape, en français, et attends ma
> validation visuelle dans Firefox avant de passer à la suite.
> Une refonte visuelle est en cours : j'ai confié le design à un service externe
> et je te renverrai un fichier Figma, `tokens.json` et les icônes. Le brief est
> dans `docs/DESIGN-SPEC.md` ; le rôle de l'agent est de l'intégrer sans toucher
> à la structure. L'OCR automatique (itération 10) a été arrêtée : ne pas y
> revenir. »
