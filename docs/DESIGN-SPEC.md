# UniConv — Cahier de conception visuelle

**Version du document : 2.0 — 26 octobre 2026**
**Produit : extension navigateur UniConv 2.9.10 (Firefox / Chrome / Safari, Manifest V3)**

---

## 0. À qui s'adresse ce document, et comment l'utiliser

Ce fichier est un **brief de conception exécutable**. Il est écrit pour être :

1. **collé dans un outil de design assisté par IA** (Figma Make, Galileo, Uizard,
   Subframe, v0, Framer AI…) qui doit produire des **calques**, des
   **composants** et des **variantes** ;
2. **lu par un designer** qui produira un fichier Figma ;
3. **relu par le développeur** (moi) qui intégrera le résultat dans le code.

### Ce qui est figé (ne pas le réinventer)

Le produit existe et fonctionne. Les **structures**, les **états**, les
**contenus** et les **contraintes techniques** décrits ici sont réels. Une
proposition qui les ignore ne pourra pas être intégrée.

### Ce qui est à redessiner (toute latitude)

Tout le **style** : couleurs, typographie, ombres, formes, densité, iconographie,
micro-animations. La palette proposée au § 2.4 est un **point de départ**, pas
une obligation. Vous pouvez la remplacer intégralement — à condition de remplir
le fichier `tokens.json` (§ 8.3) et de respecter les contrastes (§ 6).

### Le contrat en une phrase

**Vous rendez un fichier Figma + un `tokens.json` + les icônes ; j'intègre sans
toucher à la structure.** Aucun code n'est demandé au designer.

---

## 1. Le produit en 30 secondes

### 1.1 Ce qu'il fait

Au survol d'un montant (`1 234,56 €`), d'une unité (`6 ft 2 in`) ou d'une heure
avec fuseau (`14:30 CET`), l'extension affiche une **petite bulle** avec la
conversion. Au **clic**, la bulle se **fige** et un **menu** s'ouvre pour choisir
la devise, l'unité ou la ville cible. Une lecture de prix dessiné dans une image se fait par le bouton
**Scan** (sélection d'un rectangle), par un **clic droit → Scanner**, ou par
un raccourci personnel. Le popup
contient aussi un **convertisseur** (devises et unités), et un **tutoriel**
s'ouvre à la première installation.

### 1.2 Les six surfaces à dessiner

| # | Surface | Où elle apparaît | Contexte |
|---|---|---|---|
| S1 | **Bulle** (survol / figée + menu, fourchettes) | **par-dessus n'importe quel site web** | fond inconnu, souvent chargé |
| S2 | **Page de réglages** | onglet d'extension | page blanche, calme, six langues |
| S3 | **Popup** | petit panneau sous l'icône | **largeur 360 px**, convertisseur, Scan, engrenage |
| S4 | **Sélection OCR (Scan)** | par-dessus n'importe quel site | voile + cadre + aide |
| S5 | **Tutoriel** | onglet d'extension, ouvert à l'installation | page d'accueil, exemples et raccourcis |
| S6 | **Convertisseur autonome** | petite fenêtre (raccourci) | champ de montant déjà sélectionné |

Les quatre doivent **appartenir à la même famille** : mêmes couleurs, mêmes
rayons, même typographie, mêmes ombres.

### 1.3 Contraintes techniques qui pèsent sur le design

| Contrainte | Conséquence pour le designer |
|---|---|
| La bulle est injectée dans des pages arbitraires | elle doit rester lisible sur fond clair **et** sombre, et ne jamais dépendre du style du site (préfixe `.unicorn-`, styles protégés) |
| **Aucune ressource réseau** n'est chargée | pas de police distante, pas d'image distante, pas de CDN. Une police embarquée (WOFF2 dans l'extension) est possible mais ajoute du poids |
| Les drapeaux sont des **emoji** | leur rendu varie selon l'OS ; ne pas dessiner de drapeaux bitmap sauf livraison d'un jeu SVG complet |
| La bulle est en `position: fixed`, `z-index` maximal | elle flotte au-dessus de tout ; l'ombre et le contour doivent la détacher du fond |
| Bulle devise : largeur **automatique** (max 700 px), identique au survol et au clic | le design doit tenir à 240 px (fenêtre étroite) ; les menus unités/fuseaux restent redimensionnables 240–700 px |
| Popup **360 px** avec gouttière de défilement réservée (`scrollbar-gutter: stable`) | les contrôles de droite ne passent jamais sous la barre verticale ; pas de barre horizontale |
| Menus unités/fuseaux : liste **max 200 px**, redimensionnable | la bulle de devise n'a ni liste fixe ni poignée |
| Thème **clair et sombre** | les deux sont obligatoires pour S1, S2, S3 ; le tutoriel et le convertisseur suivent aussi le thème |
| **Six langues** (fr, en, es, ru, zh, ar) + RTL arabe | prévoir les libellés longs, le miroir RTL et des boutons qui ne se chevauchent pas |
| **Aucun raccourci imposé** | Scan et convertisseur sont des commandes personnalisables ; les écrans doivent expliquer où les affecter |
| OCR automatique **supprimé** | ne plus dessiner de pastille, de score, de budget ni de statistiques d'OCR automatique |
| **Zoom 200 %** et fenêtre étroite | tailles en px, mais tout doit rester lisible et sans chevauchement |
| « Réduire les animations » | toute animation doit pouvoir être coupée |

---

### 1.4 Ce qui a changé depuis la version 1.0

Cette version du brief intègre les fonctionnalités livrées entre-temps :

- **Popup 360 px** : convertisseur devises/unités, bouton **Scan**, case
  « Activer le Scan », section **Detection** avec case à cocher, engrenage
  **30 px** en haut à droite (icône SVG 18 px), version.
- **Aucune barre horizontale** : la gouttière de défilement est réservée ; la
  barre verticale ne recouvre plus les boutons.
- **Tutoriel** ouvert à l'installation, puis accessible depuis le popup et les
  réglages.
- **Convertisseur autonome** ouvert par un raccourci personnel : champ de
  montant déjà sélectionné.
- **Six langues** avec repli anglais et arabe RTL ; la langue système est
  reprise à l'installation si elle est couverte.
- **Scan manuel** uniquement ; l'OCR automatique a été supprimé (code, réglages,
  page de test et statistiques). L'OCR essaie plusieurs seuillages/modes de page,
  puis lit le texte HTML sous la zone si le moteur ne trouve rien.
- **167 devises**, fourchettes de prix, unités, fuseaux, fourchettes, etc. :
  les états de la bulle et du menu restent ceux des sections suivantes.
- **Yuan et ordres de grandeur** : `RMB`, `CNH`, `renminbi`, `13元`, `13K`,
  `1.2M`, `3B`, `RMB 5-9k` ; la bulle affiche la valeur complète.
- **Menu contextuel natif** : entrées **Convertir** (sélection) et **Scanner**
  (page), avec le logo de l'extension
  sur une sélection (devises, unités, fuseaux). Aucun cadre à dessiner : le
  navigateur fournit le menu ; prévoir seulement l'icône 16/32 px.
- **Devises source et destination** : les **signes** de la devise de départ
  et du résultat sont des **boutons colorés avec relief** (bleu pour la
  source, vert pour la destination), avec un petit chevron. Chacun ouvre un
  menu flottant avec recherche et toutes les monnaies. Aucune barre de
  recherche fixe dans la bulle.
- **Épinglage / devises principales** : chaque menu de devises contient une
  icône **📌** par ligne et les sections **Épinglées / Principales / Autres** ;
  l'épinglage est partagé entre la bulle et le popup.
- **Drapeaux et hiérarchie** : un drapeau emoji à côté du nom (si le pays est
  connu), et les **5 Principales** dans l'ordre d'importance (USD, EUR, JPY,
  GBP, CNY), jamais alphabétique. Les séparateurs de sections ont un fond et
  un filet contrastés.
- **Clic sur un signe en survol** : il fige la bulle (comme un clic sur le
  prix) puis ouvre le menu ; le menu ne dépend pas d'un clic préalable.
- **Somme éditable** : le nombre détecté est un champ contenteditable discret
  (transparence légère, soulignement pointillé) ; au survol, le fond devient
  blanc avec un texte sombre, puis Entrée ou blur relance la conversion. Le
  contenu est entièrement reconstruit à chaque changement (aucune trace).
  Les fourchettes restent informatives.
- **Scroll** : toute bulle figée est fermée dès que la page défile.
- **Signaler un bug** : le menu contextuel lance une sélection OCR et ouvre
  `src/report.html` (image + diagnostics) ; aucun envoi réseau automatique. Elle ne change que le montant affiché, pas la détection
  automatique.
- **Yuan/ordres de grandeur** : `RMB`, `CNH`, `renminbi`, `13元`, `13K`,
  `1.2M`, `3B`, `RMB 5-9k`.
- **Unités de référence** : carte en haut du popup avec **monnaie**
  (recherche, 10 lignes visibles, toutes par défilement), **fuseau** et **système d'unités**. Les
  valeurs déjà dans ces unités ne sont **ni soulignées ni survolées**. La
  cible choisie dans une bulle est temporaire et revient à la référence à la
  bulle suivante.
- **Devise de départ / destination** : signes cliquables (boutons bleu/vert
  avec relief et chevron) ; menus flottants avec recherche, 10 lignes
  visibles, toutes les monnaies par défilement.

Les cadres **S01 à S06 et S09 à S11** restent la référence pour la bulle, les
menus et les icônes. **S07** (réglages) et **S08** (popup) sont mis à jour
2.0 ; les nouveaux cadres **S12 à S14** sont détaillés dans
[`design/EVOLUTIONS-2.0.md`](design/EVOLUTIONS-2.0.md).

---

## 2. Direction artistique

### 2.1 Intention

> **« Pixel net, panneau de jeu 16-bit. »**
> La bulle, le popup et les réglages doivent évoquer une **interface de jeu
> portable** : contours francs, ombres dures, boutons qui s'enfoncent, palette
> limitée. On garde la lisibilité et la hiérarchie d'une annotation de
> navigateur, mais avec une matière visible, assumée et tactile.

L'esthétique de référence est la **Game Boy Advance** : panneaux colorés,
bordures sombres, petits rayons, reliefs en escalier, pas de flou décoratif.

### 2.2 Cinq principes

1. **Contour encre de 2 px** autour des panneaux, boutons, champs et menus.
2. **Ombre dure** de 2–4 px, sans flou, décalée en bas à droite.
3. **Rayons courts** : 2 px pour les champs, 3 px pour les boutons, 4 px pour
   les panneaux. Jamais de pastille ni de coin très arrondi.
4. **Palette limitée** : encre, bleu, cyan, vert, ambre, papier. Une couleur
   d'action à la fois ; les états sont des aplats, pas des dégradés.
5. **Relief tactile** : un bouton s'enfonce de 2 px au clic, son ombre
   disparaît. Au survol, il s'éclaircit légèrement.

### 2.3 À éviter

- les dégradés décoratifs, le verre dépoli et les ombres floues ;
- les coins très arrondis (> 6 px) sur les panneaux et boutons ;
- les icônes multicolores ou photoréalistes ;
- les animations de rebond ; les transitions doivent rester courtes ;
- les gris trop clairs : le contraste reste une règle, pas un réglage.

### 2.4 Palette 16-bit

**Thème sombre de la bulle** (bleu de panneau, encre presque noire) :

| Rôle | Valeur | Usage |
|---|---|---|
| `ink` | `#071018` | contours et ombres dures |
| `surface` | `#1B4ED1` | fond de la bulle |
| `surface-raised` | `#1642B8` | lignes de menu, recherche |
| `text` | `#FFFFFF` | valeur convertie |
| `text-muted` | `#E0ECFF` | ligne secondaire, en-têtes |
| `accent` | `#FDE68A` | sélection, focus |
| `accent-ink` | `#071018` | texte sur aplat accent |
| `shadow` | `#071018` | ombre dure 4 px |

**Thème clair de la bulle** :

| Rôle | Valeur | Usage |
|---|---|---|
| `surface` | `#FFFFFF` | fond |
| `surface-raised` | `#F1F5FF` | lignes, recherche |
| `border` | `#071018` | contour 2 px |
| `text` | `#0F172A` | valeur |
| `text-muted` | `#334155` | secondaire |
| `accent` | `#1D4ED8` | sélection, focus |
| `shadow` | `#071018` | ombre dure 4 px |

**Boutons de devise** :

| Rôle | Valeur |
|---|---|
| source fond | `#7DD3FC` |
| source contour/ombre | `#071018` |
| destination fond | `#86EFAC` |
| destination contour/ombre | `#071018` |
| texte | `#071018` |

**Surfaces S2/S3** (réglages, popup) : papier `#F8FAFC` / `#FFFFFF`, cartes
blanches, contours `#071018`, ombre dure `3px 3px 0 #071018`.

**Couleurs d'état** : succès `#15803D`, avertissement `#B45309`, danger
`#DC2626`, focus `#FDE68A` (sombre) / `#1D4ED8` (clair).

### 2.5 Typographie

- **Famille d'interface** : `"Trebuchet MS", "Segoe UI", Tahoma, Verdana,
  sans-serif` — ronde, compacte, lisible, sans téléchargement.
- **Chiffres, en-têtes et libellés techniques** : pile monospace
  `ui-monospace, "SFMono-Regular", Menlo, "Courier New", monospace` pour
  l'effet « panneau de jeu ».
- **Aucune police distante** ; une police embarquée reste possible si elle est
  livrée avec sa licence, mais la pile système suffit.
- **Échelle** (px, entiers ou demi-pixels) :

| Rôle | Taille | Graisse | Interligne | Usage |
|---|---|---|---|---|
| `display` | 22 | 700 | 1,2 | titre de la page de réglages |
| `title` | 15 | 600 | 1,3 | titre de carte, en-tête de popup |
| `label` | 13,5 | 600 | 1,35 | libellé de champ, valeur convertie |
| `body` | 13 | 400 | 1,45 | texte courant |
| `small` | 12 | 400 | 1,4 | aide, lignes de menu |
| `micro` | 11 | 600 | 1,3 | en-têtes de section (capitales), badges |
| `detail` | 11,5 | 400 | 1,35 | ligne secondaire de la bulle |

- **Chiffres** : `font-variant-numeric: tabular-nums` sur toutes les valeurs
  converties et les taux (les chiffres ne doivent pas « sauter »).
- **Letter-spacing** : 0 par défaut ; `0.04em` uniquement pour les capitales
  des en-têtes de section.

### 2.6 Iconographie

- **Icônes fonctionnelles** : SVG inline, trait de 1,5–2 px, `currentColor`,
  16 ou 18 px. Aucune icône bitmap.
- **Drapeaux** : emoji (0 octet). Tailles : 16 px dans les lignes compactes,
  18 px dans les lignes de menu.
- **Épingle** : 📌 emoji, désaturée à 35 % quand inactif, pleine quand actif.
- **Poignée de redimensionnement** : glyphe `⤡` (U+2921) ou une icône « coins »
  fournie en SVG 12 × 12.

---

### 2.7 Composants 16-bit

**Bouton** : contour `2px #071018`, rayon `3px`, ombre `2px 2px 0 #071018`,
fond aplat, texte `700`. Au clic : `translate(2px, 2px)` et ombre supprimée.
Au survol : `brightness(1.05)`.

**Champ** : contour `2px #071018`, rayon `2px`, fond papier. Au survol/focus :
fond blanc, texte encre, ombre dure `2px 2px 0` ; anneau de focus visible.

**Panneau / carte** : contour `2px`, rayon `4px`, ombre `3px 3px 0 #071018`.

**Menu déroulant** : contour `2px`, rayon `3px`, ombre `4px 4px 0 #071018`.
Les sections **Épinglées / Principales / Autres** gardent un fond et un filet
contrastés.

**Bulle de devise** : largeur automatique (max 700 px), même taille au survol
et au clic, ligne principale sans retour à la ligne. Le **bouton de devise est
toujours après le montant**, quelle que soit la convention (USD, EUR, JPY…),
donc il ne change jamais de côté. Pas de poignée de redimensionnement pour les
devises ; les menus unités/fuseaux conservent la leur.

## 3. Fondations (design tokens)

Toutes les valeurs ci-dessous doivent exister dans `tokens.json` (§ 8.3) sous
les mêmes noms. C'est ce fichier que je brancherai dans le code.

### 3.1 Espacement — base 4

| Token | px | Usage typique |
|---|---|---|
| `space-1` | 2 | écart interne d'un badge |
| `space-2` | 4 | entre deux lignes serrées |
| `space-3` | 6 | écart recherche / liste |
| `space-4` | 8 | padding de ligne, gap d'icône |
| `space-5` | 10 | padding vertical de la bulle |
| `space-6` | 12 | padding horizontal de la bulle |
| `space-7` | 16 | padding de carte |
| `space-8` | 20 | marge entre cartes, bord de page |
| `space-9` | 24 | séparation de blocs |
| `space-10` | 32 | marge haute de page |

**Règle :** aucun espacement hors de cette échelle (pas de 5, 7, 9, 11, 13 px
isolés). Les valeurs actuelles 5/7/9/14 px doivent être remplacées par 4/6/8/12/16.

### 3.2 Rayons

| Token | px | Usage |
|---|---|---|
| `radius-xs` | 4 | badge, poignée |
| `radius-sm` | 6 | champ, ligne, bouton |
| `radius-md` | 8 | bulle, carte |
| `radius-lg` | 10 | carte de réglages |
| `radius-full` | 999 | interrupteur, pastille |

### 3.3 Ombres

| Token | Valeur | Usage |
|---|---|---|
| `shadow-bubble` | `4px 4px 0 #071018` | bulle sombre |
| `shadow-bubble-light` | `4px 4px 0 #071018` | bulle claire |
| `shadow-card` | `3px 3px 0 #071018` | cartes de réglages |
| `ring-focus` | `0 0 0 2px surface, 0 0 0 4px accent` | focus (contour 2 px + offset 2 px) |

### 3.4 Bordures

- **2 px** pour les panneaux, boutons, champs et menus ; **3 px** pour le cadre OCR.
- Couleur : `border` du thème.

### 3.5 Mouvement

| Token | Valeur | Usage |
|---|---|---|
| `duration-fast` | 120 ms | survol, focus |
| `duration-base` | 160 ms | ouverture de la bulle |
| `ease` | `steps(2, end)` | tout |
| `reduced` | 0 ms | si `prefers-reduced-motion` |

Aucun rebond, aucun ressort, aucune animation de plus de 200 ms.

### 3.6 Couches (z-index)

| Couche | Valeur | Contenu |
|---|---|---|
| `z-bubble` | 2147483647 | bulle, menu, messages |
| `z-ocr-frame` | 2147483647 | cadre de sélection |
| `z-ocr-veil` | 2147483646 | voile OCR |

### 3.7 Tailles minimales

- cible interactive : **24 × 24 px** minimum (lignes de menu : 24 px de haut) ;
- corps de texte : **11 px** minimum ;
- trou de contraste : voir § 6.

---

## 4. Composants — anatomie, mesures, états

### 4.0 Nomenclature des calques (obligatoire)

Les calques doivent suivre ce schéma pour que je puisse mapper le fichier au
code sans ambiguïté :

```
Bubble / <state> / <theme>
  Header
  Main
  Detail
  Picker / <kind>
    Search
    List
      Section / <name>
      Row / <id> / <state>
        Flag
        Label
        SubLabel
        Pin
    Footer
      Resize

Settings / <section>
Popup / <state>
OCR / <state>
Icon / <size>
```

- `<state>` : `hover`, `frozen`, `error`, `empty`, `disabled`.
- `<theme>` : `dark`, `light`.
- `<kind>` : `currency`, `unit`, `timezone`.
- `<id>` : code devise (`EUR`), jeton d'unité (`km`), fuseau (`Europe-Paris`).
- `<size>` : `16`, `32`, `48`, `128`.
- Les calques doivent porter le **même nom** que les tokens quand ils en
  utilisent un (ex. un texte en `text-muted` s'appelle `Detail` et non
  `Text 2`).

### 4.1 Bulle compacte (survol)

**Rôle :** afficher la conversion sans interrompre la lecture.

**Structure :** deux lignes, deux boutons de signe et un champ de somme éditable.

| Propriété | Valeur |
|---|---|
| Largeur | `max-content`, plafonnée à **700 px** (ou largeur de fenêtre − 16 px) |
| Padding | **10 px** vertical, **12 px** horizontal |
| Rayon | **4 px** |
| Bordure | **2 px** encre `#071018` |
| Ombre | `4px 4px 0 #071018` |
| Ligne 1 (`Main`) | 13,5 px / 600 / `text` ; ex. `≈ 1 082,45 €` |
| Ligne 2 (`Detail`) | 11,5 px / 400 / `text-muted` ; ex. `taux 1 EUR = 1,0824 USD · 24/10` ; **jamais d'opacité** |
| Écart entre lignes | 3 px |
| Position | à **14 px** du curseur, jamais à moins de **8 px** du bord de la fenêtre |
| Retournement | au-dessus du curseur si la place manque en dessous |
| Animation | apparition 120 ms, pas de rebond (coupée si mouvement réduit) |

**États :** `hover` (fond bleu, ombre 4 px) et `frozen` (fond légèrement plus
sombre `#1642B8`, ombre réduite à 2 px + enfoncement interne, sans déplacement).
Le clic sur le prix ou sur un signe fige la bulle et active cet état.

**Contenu extrême :** un nom de devise long (`Dollar des États-Unis`) ou un
montant énorme (`≈ 1 234 567 890,12 ¥`) doit **aller à la ligne**, jamais
déborder. Le design doit prévoir une variante « 2 lignes de `Main` ».

**Variantes à produire :** `Bubble/hover/dark`, `Bubble/hover/light`,
`Bubble/hover/dark/Long`.

### 4.2 Bulle figée avec menu

**Rôle :** permettre de choisir la cible. Elle contient la même `Header` que la
bulle compacte, puis un **picker**.

| Propriété | Valeur |
|---|---|
| Largeur | **automatique** pour la bulle de devise (max 700 px) ; menus unités/fuseaux redimensionnables 240–700 px |
| Hauteur | automatique, plafonnée à la fenêtre − 32 px |
| Picker | largeur **260 px** par défaut (100 % de la bulle quand elle est élargie) |
| Liste | unités/fuseaux : `max-height` **200 px**, redimensionnable jusqu'à fenêtre − 180 px ; aucune liste fixe pour les devises |
| Pied | 18 px de haut, aligné à droite : poignée **26 × 18 px**, rayon 4 px |
| Séparation | 8 px entre la ligne secondaire et le picker |

**Anatomie :**

```
┌──────────────────────────────────┐  padding 12/10
│ Main                             │  13,5/600
│ Detail                           │  11,5/400 muted
│ ┌──────────────────────────────┐ │  +8 px
│ │ Search                       │ │  30 px de haut
│ ├──────────────────────────────┤ │
│ │ SECTION                      │ │  22 px, micro, capitales
│ │ ● Row                        │ │  24–28 px
│ │ ● Row                        │ │
│ │ ● Row            (scroll)    │ │
│ └──────────────────────────────┘ │
│                        [⤡ 26×18] │  pied 18
└──────────────────────────────────┘
```

**États du conteneur :** `frozen` (devise : largeur automatique), `frozen/resized` (unités/fuseaux : largeur > 320),
`error` (message d'échec à la place du menu).

**Variantes à produire :** `Bubble/frozen/dark/Currency`,
`Bubble/frozen/dark/Unit`, `Bubble/frozen/dark/Timezone`,
`Bubble/frozen/light/*`, `Bubble/frozen/dark/Resized`,
`Bubble/frozen/dark/Error`.

### 4.3 Barre de recherche

| Propriété | Valeur |
|---|---|
| Hauteur | **30 px** (padding 5 px + texte 12 px) |
| Rayon | 6 px |
| Fond | `surface-raised` |
| Bordure | 1 px `border` ; au focus : 1 px `accent` + anneau |
| Texte | 12 px, `text` ; placeholder `text-muted` |
| Icône | loupe 14 px à gauche (optionnelle), espace 8 px |
| Largeur | 100 % |

**Variantes :** `empty`, `filled`, `focus`. **Aucune** recherche dans le menu
des unités (liste courte) — le prévoir explicitement.

### 4.4 Sections et lignes de liste

**En-tête de section :** 11 px / 600, capitales, `letter-spacing 0.04em`,
`text-muted`, hauteur 22 px, séparateur 1 px sous l'en-tête, padding 4/8.

**Ligne (`Row`) :**

| Propriété | Valeur |
|---|---|
| Hauteur | **24 px** minimum, 28 px recommandé |
| Padding | 4 px vertical, 8 px horizontal |
| Gap | 8 px |
| Drapeau | 24 px de large, emoji 18 px, centré |
| Libellé | 12 px / 400, `text`, une ligne, ellipse si trop long |
| Sous-libellé (optionnel) | 11 px, `text-muted` (ex. nom IANA) |
| Épingle | 12 px, à droite, 24 × 24 px de zone cliquable |
| Fond survol | `surface-raised` |
| Fond sélection | `accent` à 16 % + barre de 2 px `accent` à gauche **ou** texte `accent` + coche discrète (choisir UNE convention, pas les deux) |
| Focus | anneau 2 px `accent` + offset 2 px |

**États :** `default`, `hover`, `selected`, `focus-visible`,
`pinned`, `pinned+selected`, `disabled` (ligne « aucune ville » si besoin).

**Contenu extrême :** `Dollar des Caraïbes orientales (XCD)` sur une largeur de
240 px ; `Amérique/Argentina/Buenos_Aires`. Le design doit montrer la stratégie :
libellé principal jamais coupé, partie secondaire en ellipse.

### 4.5 Drapeau et épingle

- **Drapeau** : emoji, 18 px, largeur fixe 24 px (alignement vertical des lignes).
  Prévoir le cas « drapeau absent » : globe 🌐 en `text-muted`.
- **Épingle** : 12 px. Inactive : `filter: grayscale(1)`, opacité 35 %.
  Active : pleine, `aria-pressed="true"`. Zone cliquable 24 × 24 px.
  Elle est **à l'intérieur** de la ligne (un seul bouton par ligne côté code) :
  le design ne doit pas imbriquer deux boutons.

### 4.6 Poignée de redimensionnement (unités/fuseaux)

26 × 18 px, rayon 4 px, fond `surface-raised`, glyphe 12 px `text-muted`.
Curseur `nwse-resize`. Au focus : anneau. Elle est **dans le pied**, jamais
au-dessus de la barre de défilement.

### 4.7 Sélection OCR (S4)

| Élément | Valeur |
|---|---|
| Voile | voile noir `rgba(15,23,42,0.22)` sur toute la fenêtre, curseur en croix |
| Cadre | 2 px `accent`, fond `accent` à 12 %, ombre « mille-feuille » sombre |
| Aide | pastille en haut au centre, `top: 14 px`, padding 8/14, rayon 8, fond `#0B1220`, texte blanc 12,5 px / 600 |
| Message d'erreur | même pastille, bordure 1 px `danger` |
| Échap | annule (mention dans l'aide) |

**Variantes :** `OCR/dragging`, `OCR/ready`, `OCR/error`.

### 4.8 Message temporaire (`notice`)

Pastille centrée en haut (`top: 16 px`), fond `#0B1220`, texte blanc 12,5/600,
rayon 8, ombre. Sert aux refus explicites (« extension en pause », « moteur
indisponible »). Variante `error` avec bordure `danger`.

### 4.9 Page de réglages (S2)

| Propriété | Valeur |
|---|---|
| Largeur du contenu | **720–760 px**, centré |
| Marge de page | 32 px en haut, 20 px sur les côtés, 80 px en bas |
| Fond | `surface-raised` (glacé très clair) |
| Carte | fond `surface`, bordure **2 px**, rayon **4 px**, ombre dure 3 px, padding 16/18, marge 14 px |
| Titre de carte | 15 px / 600 |
| Aide de carte | 12,5 px / 400, `text-muted` |
| Champ | ligne en `flex`, padding 10 px vertical, séparateur 2 px, libellé 13,5/600, aide 12/400 muted, contrôle à droite (largeur min 220 px) |
| Interrupteur | 44 × 24 px, piste `radius-full`, bouton 18 px, actif `accent` |
| Segmented | bordure 2 px, rayon 3 px, boutons 12,5/600 padding 6/12, actif `accent` sur fond `accent` 10 % |
| Bouton | 13/600, padding 7/12, rayon 3 px, bordure 2 px, ombre dure 2 px ; primaire, secondaire, danger |
| Champ texte / select | 13 px, padding 6/8, rayon 2 px, bordure 2 px, largeur min 200 px |
| Zone export | monospace 12,5 px, min-height 90 px |
| Message | 12,5 px, couleur `success` / `danger` |
| Liste noire | lignes 24 px avec bouton « Retirer » |

**États à produire :** focus, désactivé, message de succès, message d'erreur,
thème clair, thème sombre.

### 4.10 Popup (S3)

| Propriété | Valeur |
|---|---|
| Largeur | **360 px** (gouttière de défilement réservée ; aucune barre horizontale) |
| Padding | 12 px haut / 20 px droite / 14 px bas / 16 px gauche |
| Pied | rubrique **Soutenir UniConv** : lien Ko-fi ambre, nouvel onglet sécurisé (`noopener noreferrer`) |
| En-tête | titre 14/600 + bouton **Scan** (pilule 10,5/700) + version 11 muted + **engrenage 30×30** (icône SVG 18×18), alignés au centre, séparateur 1 px |
| Carte « Unités de référence » | en **tête du popup**, avant le convertisseur : **champ monnaie cliquable** ouvrant un menu avec recherche (10 lignes visibles, toutes par défilement), fuseau, métrique/impérial ; compacte, 3 lignes |
| Boutons de droite | l'engrenage ne passe jamais sous la barre verticale ; cible 30 px |
| Cartes de statut | fond `surface-raised`, rayon 6 px, padding 9/10, texte 11 px |
| Convertisseur | onglets Devises/Unités, champ montant, deux listes, résultat 20/700 |
| Cases | « Activer le Scan », « Activer la detection » (14 px, libellé 11 px) |
| Ligne de statistiques | 11 px muted |
| Raccourcis | aucune touche imposée ; renvoyer vers les commandes personnalisables |

**Variantes :** taux à jour / taux en cache / hors ligne, Scan actif /
désactivé, detection active / en pause, six langues (dont arabe RTL), thème
clair, thème sombre.

Le détail des nouveaux cadres est dans
[`design/EVOLUTIONS-2.0.md`](design/EVOLUTIONS-2.0.md).

### 4.11 Icônes de l'extension

- 4 tailles : **16, 32, 48, 128** (PNG carrés), plus la source SVG.
- Style : pictogramme simple, lisible à 16 px, fond transparent, une seule
  couleur dominante (l'accent) sur un fond neutre éventuel.
- Le badge navigateur (« OFF ») est dessiné par le navigateur : prévoir un fond
  de badge `danger` et un texte blanc.

### 4.12 États vides et d'erreur

À dessiner explicitement :

- devise indisponible (`devise non disponible`) ;
- aucun taux (`aucun taux disponible`) ;
- OCR sans texte reconnu ;
- extension en pause / site en liste noire ;
- liste de recherche vide (« Aucun résultat »).

---

## 5. Écrans et cadres à produire

Créer **une page Figma par groupe**, avec les cadres suivants (noms exacts) :

| Cadre | Taille | Contenu |
|---|---|---|
| `S01 / Contexte / E-commerce` | 1440 × 1024 | page produit factice neutre + bulle compacte près d'un prix + bulle figée près d'un autre |
| `S02 / Bulle / Redlines` | 1440 × 1200 | bulle compacte à 2×, cotes, tokens, thèmes clair et sombre |
| `S03 / Menu devises` | 1440 × 1200 | figée + picker complet : recherche, Épinglées, Principales, Autres ; états des lignes |
| `S04 / Menu unités` | 1440 × 1200 | picker sans recherche, 8 unités, état sélectionné |
| `S05 / Menu villes` | 1440 × 1400 | « Ma position », « Épinglées », « Principales », « Autres villes » ; recherche « chine » |
| `S06 / OCR` | 1440 × 1024 | voile + cadre + pastille d'aide + erreur |
| `S07 / Réglages` | 1440 × 2400 | page complète, clair + sombre, tous les contrôles |
| `S08 / Popup 2.0 (résumé)` | 360 × 640 | résumé compact du popup ; détail dans S12 |
| `S09 / Icônes` | 800 × 400 | 16/32/48/128 sur fond clair et sombre, badge OFF |
| `S10 / Redlines / Tokens` | 1440 × 1600 | planche de tokens : couleurs, typo, espacements, rayons, ombres |
| `S11 / Cas extrêmes` | 1440 × 1200 | libellé long, montant énorme, 240 px, 700 px, zoom 200 %, fenêtre 320 px |
| `S12 / Popup 2.0` | 360 × 640 | convertisseur, Scan, detection, engrenage 30 px, six langues, RTL arabe |
| `S13 / Tutoriel` | 1440 × 1600 | héros, huit sections, exemples, actions, clair + sombre |
| `S14 / Convertisseur autonome` | 400 × 640 | champ montant focus/sélectionné, onglets, résultat |

Chaque cadre doit exister en **clair** et **sombre** pour S1–S5 (S6–S9 selon
pertinence).

> **Prompts prêts à coller :** `docs/design/EVOLUTIONS-2.0.md` couvre S12–S14 ; `docs/design/FRAME-PROMPTS.md` contient un prompt
> autonome par cadre (contenu exact, arborescence des calques, mesures, états,
> pièges à éviter).

---

## 6. Accessibilité — exigences bloquantes

1. **Contraste** : tout texte ≥ **4,5:1** ; éléments interactifs et focus ≥
   **3:1**. Calculer sur les couleurs finales, pas à l'œil.
2. **Focus visible** : anneau 2 px, offset 2 px, sur les champs, les lignes, la
   poignée. Jamais `outline: none` sans remplacement.
3. **Pas de couleur seule** : l'état sélectionné doit avoir une forme (barre,
   coche, graisse) en plus de la couleur ; l'épingle active doit être pleine.
4. **Texte ≥ 11 px**, jamais de texte en majuscules pour un libellé long.
5. **Cibles ≥ 24 × 24 px**.
6. **Mouvement** : toutes les animations coupées sous
   `prefers-reduced-motion: reduce`.
7. **Annonces** : la bulle est une zone `aria-live="polite"` ; le design ne doit
   pas masquer le texte aux lecteurs d'écran (`aria-hidden` interdit sur la
   bulle visible).
8. **Zoom 200 %** : aucun chevauchement, aucune coupure de texte.

---

## 7. Contraintes d'intégration (ce que je fais du design)

### 7.1 Ce que le code attend

| Élément | Attendu |
|---|---|
| Couleurs, rayons, ombres, typo | exprimés en **tokens** (`tokens.json`), que je traduis en variables CSS injectées |
| Structure | conservée : `Header`, `Main`, `Detail`, `Picker`, `Search`, `List`, `Footer` |
| Taille | bulle de devise : largeur automatique, identique au survol et au clic ; unités/fuseaux redimensionnables 240–700 px |
| Champs | un seul bouton par ligne (l'épingle est un `span` dans le bouton) : ne pas proposer deux boutons imbriqués |
| Drapeaux | emoji ; tout jeu SVG doit être livré complet (132 fuseaux / 167 devises) ou restera en emoji |
| Police | pile système par défaut ; webfont seulement si livrée avec licence |
| Images | aucune image bitmap dans la bulle (poids, netteté au zoom) |

### 7.2 Ce que je ferai à la réception

1. Extraire les tokens et les injecter en variables CSS (`--uni-*`).
2. Reporter les styles dans `src/content.js` (bulle + menus), `src/options.html`,
   `src/popup.html`.
3. Vérifier les contrastes avec le calcul WCAG des tests.
4. Mettre à jour `accessibility-tests` et `release-tests`.
5. Reconstruire les archives (`node tools/package.mjs`).
6. Faire valider visuellement dans Firefox.

### 7.3 Ce qui serait refusé

- une police ou une image chargée depuis Internet ;
- une structure qui casse la redimensionnabilité ou le défilement de la liste ;
- des contrastes sous les seuils ;
- des tailles de texte inférieures à 11 px ;
- des calques non nommés selon § 4.0 (l'intégration deviendrait une devinette).

---

## 8. Livrables attendus

### 8.1 Arborescence

```
uniconv-design/
├── UniConv-design.fig          (ou lien Figma public)
├── tokens.json                 (obligatoire, schéma § 8.3)
├── assets/
│   ├── icon.svg                (source vectorielle)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── exports/                    (facultatif)
│   ├── s01-contexte@2x.png
│   ├── s02-bulle@2x.png
│   ├── s03-devises@2x.png
│   └── ...
└── NOTES.md                    (écarts, doutes, choix)
```

### 8.2 Formats

- Figma (`.fig`) ou lien de lecture ;
- PNG pour les icônes, **fond transparent**, tailles exactes ;
- SVG pour l'icône source et toute icône fonctionnelle ;
- JSON UTF-8 pour les tokens, sans commentaires.

### 8.3 Schéma de `tokens.json`

```json
{
  "meta": {
    "product": "UniConv",
    "version": "1.0",
    "author": "…",
    "date": "2026-…"
  },
  "color": {
    "bubble-dark": {
      "surface": "#0B1220",
      "surface-raised": "#111A2C",
      "border": "rgba(255,255,255,0.10)",
      "text": "#F8FAFC",
      "text-muted": "#CBD5E1",
      "accent": "#7DD3FC",
      "accent-ink": "#0B1220",
      "shadow": "rgba(2,6,23,0.45)"
    },
    "bubble-light": { "…": "…" },
    "app-light": { "…": "…" },
    "app-dark": { "…": "…" },
    "state": {
      "success": "#16A34A",
      "warning": "#D97706",
      "danger": "#DC2626",
      "focus-ring": "#7DD3FC"
    }
  },
  "font": {
    "family": "system",
    "scale": {
      "display": 22,
      "title": 15,
      "label": 13.5,
      "body": 13,
      "small": 12,
      "micro": 11,
      "detail": 11.5
    },
    "weight": { "regular": 400, "semibold": 600, "bold": 700 }
  },
  "space": { "1": 2, "2": 4, "3": 6, "4": 8, "5": 10, "6": 12, "7": 16, "8": 20, "9": 24, "10": 32 },
  "radius": { "xs": 4, "sm": 6, "md": 8, "lg": 10, "full": 999 },
  "shadow": {
    "bubble": "0 8px 24px rgba(2,6,23,0.45)",
    "bubble-light": "0 8px 24px rgba(15,23,42,0.14)",
    "card": "0 1px 2px rgba(15,23,42,0.06)"
  },
  "motion": { "fast": 120, "base": 160, "ease": "cubic-bezier(0.2,0.8,0.2,1)" },
  "size": {
    "bubble-max": 320,
    "bubble-min": 240,
    "bubble-resized-max": 700,
    "picker-width": 260,
    "list-max": 200,
    "row-min": 24,
    "search-height": 30,
    "footer-height": 18,
    "handle": { "width": 26, "height": 18 }
  }
}
```

Les clés sont **stables** : renseigner les mêmes noms, même si les valeurs
changent. Toute clé manquante gardera la valeur actuelle.

---

## 9. Prompt prêt à coller dans un outil de design

> **Contexte.** Conçois l'interface d'« UniConv », une extension navigateur qui
> affiche une bulle de conversion au survol d'un montant, d'une unité ou d'une
> heure avec fuseau. La bulle apparaît **par-dessus n'importe quel site web**.
>
> **Style.** « Pixel net, panneau de jeu 16-bit. » Contours 2 px encre
> `#071018`, ombres dures 2–4 px, rayons 2–4 px, palette limitée. Boutons
> tactiles qui s'enfoncent de 2 px. Pas de dégradé, pas de verre dépoli.
> Une seule couleur d'accent. Typographie système, échelle 11–22 px, chiffres
> tabulaires. Deux thèmes : sombre (par défaut, pour se détacher des pages
> claires) et clair. Tout texte ≥ 4,5:1.
>
> **Écrans à produire.** (1) Page e-commerce 1440×1024 avec la bulle compacte
> puis la bulle figée ; (2) planche de cotations de la bulle à 2× ; (3) menu
> devises avec recherche, sections Épinglées/Principales/Autres, états
> survol/sélection/focus/épingle ; (4) menu unités sans recherche ; (5) menu
> villes avec « Ma position », recherche « chine » ; (6) sélection OCR (voile
> sombre + cadre accent + pastille d'aide) ; (7) page de réglages complète
> (cartes, champs, interrupteurs, segments, boutons) en clair et sombre ;
> (8) popup 320 px en clair et sombre ; (9) icônes 16/32/48/128 ; (10) planche
> de tokens ; (11) cas extrêmes (libellé long, montant énorme, bulle 240 px et
> 700 px, zoom 200 %).
>
> **Contraintes fermes.** Bulle de devise : largeur automatique (max 700 px), identique au survol et au clic ; unités/fuseaux redimensionnables
> 240–700 px, padding 12/10, deux lignes de texte, menu avec liste de 200 px
> maximum et poignée 26×18 dans le pied. Aucune image bitmap dans la bulle,
> aucun chargement réseau, drapeaux en emoji, un seul bouton par ligne de menu.
> Noms de calques imposés : `Bubble/<state>/<theme>`, `Picker/<kind>`,
> `Row/<id>/<state>`, `Settings/<section>`, `Popup/<state>`, `Icon/<size>`.
>
> **Livrables.** Fichier Figma + `tokens.json` (couleurs, typo, espacements,
> rayons, ombres, mouvement, tailles) + icônes PNG 16/32/48/128 + SVG source.

---

## 10. Recette d'acceptation

Avant de m'envoyer les fichiers :

- [ ] Les 14 cadres existent : S01–S11 (bulle/menus) + S12–S14 (popup 2.0, tutoriel, convertisseur), nommés exactement.
- [ ] Chaque composant a ses variantes d'état (survol, focus, sélection,
      épingle, désactivé).
- [ ] Les deux thèmes sont complets (S1 à S5).
- [ ] `tokens.json` est valide (JSON), aux clés du § 8.3.
- [ ] Les contrastes sont calculés et ≥ 4,5:1 / 3:1.
- [ ] Les tailles minimales sont respectées (texte ≥ 11 px, cible ≥ 24 px).
- [ ] La bulle tient à 240 px sans débordement.
- [ ] Les libellés longs (devise, ville) ont une stratégie visible.
- [ ] Les icônes sont livrées aux 4 tailles, fond transparent.
- [ ] Aucune police ni image distante.
- [ ] `NOTES.md` liste les écarts éventuels.

---

## 11. Ce qui existe aujourd'hui (mesures de référence)

Pour situer le point de départ, voici les valeurs réellement dans le code. Elles
sont **remplaçables** par le nouveau design, mais elles montrent l'échelle et
les contraintes déjà en place.

| Élément | Valeur actuelle |
|---|---|
| Bulle | `max-width: 700px`, padding 10/12, rayon 4, bordure 2 px `#071018`, fond bleu plat `#1B4ED1`, ombre dure 4 px, ligne principale sans retour |
| Ligne 1 / ligne 2 | 13,5 / 600 ; 11,5 / 400 (opacité 0,82 — à remplacer) |
| Picker | largeur 260 px, marge haute 8 px |
| Recherche | padding 5/8, rayon 2, bordure 2 px, fond encre/bleu |
| Liste | `max-height: 200px`, rayon 2 |
| Ligne | padding 5/8, gap 8, texte 12 px |
| Drapeau | boîte 24 px, emoji 18 px |
| Épingle | 12 px, opacité 35 %, désaturée |
| Poignée | 26 × 18, rayon 2 (unités/fuseaux seulement) |
| En-tête de section | 10,5 px / 600, capitales, fond et filet contrastés |
| Réglages | contenu 720 px, cartes rayon 10, padding 16/18, champs 13 px, switch 44 × 24 |
| Popup | 268 px, padding 12/14, texte 11–14 px |
| OCR | voile `rgba(15,23,42,0.22)`, cadre 2 px `#2f6bff`, aide 12,5 px / 600 |
| Police | pile système |
| Thèmes | bulle : clair/sombre/auto ; réglages et popup : clair uniquement (à compléter) |
