# UniConv

**Convertissez ce que vous lisez, sans quitter la page.**

UniConv est une extension pour **Firefox, Chrome, Edge, Brave, Opera et Safari**
qui affiche, au survol,
la conversion d'un montant, d'une unité de mesure ou d'une heure avec fuseau.
Tout reste en local : aucune donnée de navigation n'est envoyée.

- **Version : 2.9.10**
- Manifest V3, JavaScript pur, **sans build ni dépendance**.
- Moteur OCR **embarqué** (Tesseract, 8,2 Mo) : la lecture d'image fonctionne
  hors ligne.

---

## Ce qu'elle fait

| Domaine | Exemple survolé | Ce que vous voyez |
|---|---|---|
| Devises | `1 234,56 €`, `$1,234.56`, `10 EUR`, `2000 - 3000 CNY`, `Entre 70.000 et 80.000 PHP`, `135 pesos`, `500BND` | la valeur en euros, dollars… (**167 devises détectées**, cibles selon les taux), **fourchettes comprises** |
| Unités | `6 ft 2 in`, `1m80`, `180 lbs`, `20 °C`, `2 quarts`, `2.1 QT`, `1/2 cup`, `300 K` | l'équivalent métrique ou impérial |
| Yuan | `CNY`, `RMB`, `CNH`, `yuan`, `renminbi`, `人民币`, `13元` | toutes les appellations courantes du yuan |
| Ordres de grandeur | `13K`, `1.2M`, `3B`, `$480 billion`, `480 milliards`, `RMB 5-9k` | **k/m/b**, **bn/mn/tn** et mots (thousand, million, billion, milliard) |
| Clic droit | une sélection → **Convertir** ; sur la page → **Scanner** ou **Signaler un bug** | lit la sélection, lance l'OCR, ou prépare un rapport local avec la zone capturée |
| Devise de départ | `¥8,000` ambigu | le **signe de la devise** dans le montant est un **bouton** ; il ouvre un menu avec recherche (10 lignes visibles, toutes les monnaies par défilement) |
| Devise de destination | `1 315,20 $` | le **signe du résultat** est aussi un **bouton** ; même menu avec recherche, sans barre fixe dans la bulle |
| Épinglage | dans chaque menu de devises | **📌** épingle une devise en tête ; sections **Épinglées / Principales / Autres** |
| Drapeaux et ordre | dans chaque menu de devises | un **drapeau emoji** à côté du nom ; **5 Principales** dans l'ordre d'importance (USD, EUR, JPY, GBP, CNY) |
| Somme éditable | dans la bulle | le nombre détecté est un champ discret ; le modifier relance la conversion |
| Scroll | bulle figée | la bulle disparaît dès que la page défile |
| Design | toutes les surfaces | direction **16-bit / Game Boy Advance** : contours 2 px, ombres dures, boutons tactiles ; bulle figée légèrement plus sombre et enfoncée ; bouton de devise toujours après le montant |
| Soutien | bas du popup | lien **Ko-fi** discret, nouvel onglet sécurisé |
| Unités de référence | carte en haut du popup | monnaie, fuseau et système d'unités par défaut ; les valeurs déjà dans ces unités **ne sont pas soulignées** |
| Fuseaux | `14:30 CET`, `2026-10-24T14:30:00Z`, `heure de Paris` | l'heure dans la ville choisie (« 14h30 à Paris »), le décalage GMT de chaque ville, le changement de jour |
| Images | un prix, une **unité** ou une **heure** dessinés dans une image | bouton **Scan** à côté du titre du popup (ou raccourci personnel) ; plusieurs essais OCR, puis secours par le texte HTML de la zone |
| Popup | montant + devise ou unité | **convertisseur classique** : champ, deux listes, résultat immédiat ; bouton **Scan** à côté du titre |
| Tutoriel | à l'installation | **page d'accueil** qui présente devises, unités, fuseaux, Scan, convertisseur et raccourcis |
| Raccourcis | Scan et convertisseur | **choisis par vous** (aucune touche imposée), le convertisseur s'ouvre avec le champ déjà sélectionné |

**Au survol** : une bulle discrète. **Au clic** : la bulle se fige. Les **signes des devises** (départ et
destination) sont des boutons colorés avec relief : ils ouvrent chacun un
menu flottant avec recherche et toutes les monnaies, sans ajouter de barre
fixe dans la bulle. Cliquer un signe dans la bulle de survol **fige** la
bulle, comme un clic sur le prix. Un changement de
**cible** dans une bulle est temporaire : la bulle suivante revient aux
**unités de référence** (monnaie, fuseau, système d'unités).

Un soin particulier est apporté aux **faux positifs** : versions, scores,
heures, dates, dimensions, numéros, codes, IP, plages sans devise, etc. sont écartés. Une
heure **sans fuseau** n'est jamais convertie. Une **liste noire** (Gmail,
GitHub, Notion…) et une pause globale existent aussi.

---

## Installation

### En développement (Firefox)

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. « Charger un module temporaire… » → choisir `manifest.json`.
3. Recharger l'extension après chaque modification du code.

> Une page ne voit une nouvelle version du script de page qu'après
> **rechargement de l'onglet**.

### Navigateurs pris en charge

| Navigateur | Paquet | Installation |
|---|---|---|
| **Firefox** (140+) | `dist/uniconv-<version>.xpi` | AMO, ou module temporaire en développement |
| **Chrome**, **Edge**, **Brave**, **Opera**, **Vivaldi** | `dist/uniconv-<version>-chromium.zip` | dézipper, puis `chrome://extensions` (ou `edge://extensions`, `brave://extensions`) → mode développeur → « Charger l'extension non empaquetée » |
| **Safari** (16.4+, macOS) | `dist/uniconv-<version>-safari.zip` + `dist/safari/` | `xcrun safari-web-extension-converter dist/safari/uniconv-<version>` puis Xcode |

**Limite connue sur Safari** : la capture d'écran (OCR manuel) dépend de
`tabs.captureVisibleTab`, qui peut être refusée selon la version et les
réglages. L'extension affiche alors un message clair au lieu d'une erreur
technique. Le reste (devises, unités, fuseaux) fonctionne normalement.

---

## Utilisation

| Action | Effet |
|---|---|
| Survoler un montant / une unité / une heure | bulle de conversion |
| Cliquer sur un montant | fige la bulle + menu de choix |
| Cliquer ailleurs | ferme la bulle |
| `Échap` | ferme la bulle figée |
| Clic droit sur une sélection → **Convertir** | convertit le texte sélectionné |
| Clic droit sur la page → **Scanner** | lance la sélection OCR, comme le bouton Scan |
| Icône **engrenage** (en haut à droite) | ouvre les réglages |
| Bouton **Scan** | lit une zone dessinée sur la page (OCR) |
| Raccourcis personnels | Scan et convertisseur, choisis dans le navigateur |

La bulle est **redimensionnable** : poignée dans le pied du menu (souris), ou
**flèches** du clavier quand la poignée a le focus (`Maj` = pas plus grand).

---

## Réglages

Accessibles par l'icône de l'extension → « Ouvrir les réglages » :

- devise cible, couverture devises/unités, système d'unités ;
- ville de référence des fuseaux, format 12/24 h ;
- **langue** : français, anglais, espagnol, russe, chinois, arabe (libellés principaux ; RTL pour l'arabe) ; la langue système est reprise **à l'installation** si elle est couverte, sinon **anglais** ;
- langue (six langues + auto), thème (clair / sombre / auto) ;
- délai d'apparition, taille de la bulle ;
- liste noire personnelle ;
- export / import JSON des réglages, remise à zéro.

---

## Confidentialité

**Aucune collecte.** Pas de compte, pas de télémétrie, pas de publicité, pas de
suivi. Les réglages restent dans le stockage local de votre navigateur.

Seuls des **taux de change** sont demandés à des services publics, sans jamais
transmettre le contenu de vos pages. L'OCR s'exécute **entièrement en local**.

Détails : [`docs/CONFIDENTIALITE.md`](docs/CONFIDENTIALITE.md).

---

## Permissions demandées

| Permission | Pourquoi |
|---|---|
| `storage` | mémoriser vos réglages, le cache des taux et les villes épinglées |
| `activeTab` | lire l'onglet **au moment où vous le demandez** (Scan) |
| `contextMenus` | ajouter **Convertir** (sélection), **Scanner** et **Signaler un bug** (page) au clic droit |
| `api.frankfurter.dev` | taux de change (source principale) |
| `cdn.jsdelivr.net`, `latest.currency-api.pages.dev` | taux de secours (source secondaire) |
| `open.er-api.com` | taux élargis (160+ devises) |
| `api.exchangerate-api.com` | 4e source de secours (indépendante) |
| accès aux pages `http`/`https` | c'est le principe même de l'extension : lire le texte affiché pour y réagir |

Aucun accès aux pages `file://`, ni aux onglets internes du navigateur.

---

## Tests

16 suites, **pas de navigateur** : les scripts sont exécutés dans un faux DOM.
Les pages de `test/` partagent une **barre de navigation** (`test-nav.css`) :
on passe de l'une à l'autre sans revenir au projet.

```bash
cd ~/Documents/UniConv
for f in run-tests smoke-test background-test audit-tests units-tests \
         currency-meta-tests currency-search-tests dynamic-tests \
         false-positive-tests options-tests ocr-tests \
         timezone-tests accessibility-tests release-tests compat-tests \
         popup-tests; do
  printf "%-24s " "$f"; node tools/$f.mjs | tail -2
done
```

Pages de test servies en local (`python3 -m http.server 8123`) :

| Page | Contenu |
|---|---|
| `test/formats.html` | devises et unités |
| `test/monnaies.html` | **les 167 devises** : tableau, recherche, exemples à survoler |
| `test/faux-positifs.html` | pièges et vrais prix |
| `test/dynamique.html` | contenu injecté après le chargement |
| `test/fuseaux.html` | 33 cas d'heures + 15 pièges |

---

## Mémoire

Mesures reproductibles avec `node --expose-gc tools/memory-report.mjs` :

| Élément | Mesure |
|---|---|
| `content.js` | **301 Ko** (83 Ko gzip) |
| Code compilé (content) | ~803 Ko |
| Données + index (167 devises, 132 villes, textes) | ~354 Ko |
| **Plancher par onglet** (code + données) | **~1,13 Mo** |
| `background.js` compilé | ~99 Ko (+ les taux) |
| Moteur OCR (fichiers) | 8,2 Mo |
| OCR actif (wasm + fra/eng) | 60 à 120 Mo, onglet fermé après 120 s |
| Extension installée | 8,7 Mo |
| Paquet `.xpi` | 5,4 Mo |

Hors OCR, l'extension ne charge ni wasm ni image : l'essentiel est le script
et ses tables. Le chiffre exact dans Firefox s'obtient par `about:memory`.

> La **détection** couvre 167 devises (codes ISO et noms français) ; les
> **cibles de conversion** sont celles fournies par les taux (≈166). Ce sont
> deux listes différentes : KPW, par exemple, est détecté mais sans taux.

## Structure

```
manifest.json          carte d'identité (MV3)
src/content.js         script injecté dans les pages (détection, bulle, menus)
src/background.js      taux de change, capture d'écran, coordination OCR
src/engine.html/.js    page d'extension qui héberge le moteur OCR
src/options.html/.js   page de réglages
src/popup.html/.js     popup (état des taux, pause, statistiques)
src/vendor/            moteur Tesseract + modèles fra/eng (aucun réseau)
icons/                 icônes 16/32/48/128
docs/                  plan de route, options, OCR, fuseaux, tests, publication
test/                  pages de test servies en HTTP
tools/                 suites de tests et empaquetage
```

---

## Empaquetage

```bash
node tools/package.mjs
# dist/uniconv-<version>.xpi            → Firefox (AMO)
# dist/uniconv-<version>-chromium.zip   → Chrome, Edge, Brave, Opera, Vivaldi
# dist/uniconv-<version>-safari.zip     → Safari (source à convertir)
# dist/safari/uniconv-<version>/        → dossier pour Xcode
```

Le script vérifie que chaque fichier cité par le manifeste existe et que le
manifeste est bien à la racine des trois archives. Les manifestes sont adaptés
automatiquement : page d'événement + bloc `gecko` pour Firefox, service worker
sans bloc `gecko` pour Chromium et Safari.

Guide de publication : [`docs/PUBLICATION.md`](docs/PUBLICATION.md).

---

## État du projet

Itérations 0 à 29 livrées. **L'OCR automatique a été entièrement supprimé**
(code, réglages, page de test et suite `page-tests`) : seule la lecture
manuelle par le bouton **Scan** reste, plus économe. Voir
[`docs/REPRISE-DE-SESSION.md`](docs/REPRISE-DE-SESSION.md).

Licence : **MIT** — voir [LICENSE](LICENSE).


## Installation gratuite (aucun compte payant)

| Navigateur | Paquet | Statut |
|---|---|---|
| **Firefox** | `uniconv-<version>.xpi` (Release GitHub) | signé par AMO, un clic |
| **Microsoft Edge** | `uniconv-<version>-chromium.zip` | Edge Add-ons |
| **Opera** | `uniconv-<version>-chromium.zip` | Opera Add-ons |
| **Chrome, Brave, Vivaldi** | `uniconv-<version>-chromium.zip` | **mode développeur** (`chrome://extensions`) |
| **Safari** | non pris en charge | compte Apple payant requis |

Pour Chrome/Brave/Vivaldi sans store : dézipper le ZIP dans un dossier permanent,
puis `chrome://extensions` → **mode développeur** → **Charger l'extension non
empaquetée**. Pas de mise à jour automatique.

## Source de publication AMO

Voir [AMO-SOURCE.md](AMO-SOURCE.md) pour reproduire le paquet Firefox.

## Mettre le code sur GitHub

Voir [docs/GITHUB.md](docs/GITHUB.md).


## Sécurité

Voir [docs/SECURITY.md](docs/SECURITY.md).
