# UniConv — prompts cadre par cadre

**Compagnon de `docs/DESIGN-SPEC.md`.** Un bloc = un cadre Figma. Collez le bloc
entier dans votre outil de design (Figma Make, Galileo, Uizard, Subframe, v0,
Framer AI…), **un cadre à la fois**, puis renommez les calques selon la
nomenclature indiquée.

> **Mise à jour 2.0** : ces 11 cadres couvrent la **bulle**, les **menus** et la
> **page de réglages**. Les nouveaux écrans — popup 360, tutoriel, convertisseur
> autonome, états Scan/detection et RTL arabe — sont dans
> [`EVOLUTIONS-2.0.md`](EVOLUTIONS-2.0.md) (cadres S12–S14).

> **Limite de 2000 caractères ?** Utilisez
> [`FRAME-PROMPTS-2000.md`](FRAME-PROMPTS-2000.md) : les mêmes 11 cadres en
> version compacte (922 à 1547 caractères), vérifiée par les tests.

## Mode d'emploi

1. **Ordre conseillé** : S02 (référence) → S01 → S03 → S04 → S05 → S06 → S07 →
   S08 → S09 → S10 → S11.
2. Chaque prompt est **autonome** : il rappelle le style en une ligne. Ne
   comptez pas sur la mémoire de l'outil entre deux prompts.
3. Produisez d'abord le **thème sombre**, puis dupliquez en **clair** et
   remplacez les 6 couleurs indiquées.
4. Après chaque cadre : **vérifier** les contrastes, les tailles minimales, et
   renommer les calques (`Bubble/…`, `Picker/…`, `Row/…`, `Settings/…`,
   `Popup/…`, `Icon/…`).
5. Les textes entre guillemets sont **les vrais textes du produit** : à
   reproduire à l'identique (les accents seront ajoutés à l'intégration).

### Rappel système (identique dans tous les prompts)

```text
STYLE COMMUN
Sombre : surface #0B1220, surface élevée #111A2C, bordure rgba(255,255,255,.10),
texte #F8FAFC, secondaire #CBD5E1, accent #7DD3FC, accent-sur-fond #0B1220.
Clair : surface #FFFFFF, surface élevée #F8FAFC, bordure #E2E8F0,
texte #0F172A, secondaire #475569, accent #2563EB.
Typographie système ; échelle 22/700, 15/600, 13,5/600, 13/400, 12/400, 11,5/400,
11/600 ; chiffres tabulaires sur les valeurs.
Rayons 4 (badge), 6 (champ/ligne), 8 (bulle), 10 (carte).
Espacements 2/4/6/8/10/12/16/20/24/32.
Ombres douces, jamais dures. Animations 120–160 ms, coupées si mouvement réduit.
Contraste ≥ 4,5:1 (texte) et 3:1 (interactif). Texte ≥ 11 px. Cible ≥ 24 px.
Aucun dégradé décoratif, aucun verre dépoli, aucune police/image distante.
```

---

## S01 — Contexte e-commerce

```text
CADRE : nom « S01 / Contexte / E-commerce », 1440 × 1024, fond de présentation #0F172A.
STYLE : voir le rappel système (bulle sombre par défaut).
CONTEXTE : UniConv affiche une bulle de conversion au survol d'un prix. La page
d'accueil du cadre est une FAUSSE page produit, volontairement neutre (gris),
pour que la bulle ressorte. Ce n'est pas une maquette de site : c'est un décor.
OBJECTIF : montrer la bulle dans son contexte réel et sa position près du curseur.

PAGE (décor, tons neutres #F8FAFC / #E2E8F0 / #111827, aucune couleur vive) :
- barre haute : logo texte « SHOP », champ de recherche, panier ;
- fil d'ariane : Accueil / Audio / Casques ;
- colonne gauche : grand visuel de produit 520 × 520 (rectangle gris arrondi 12 px,
  étiquette « image produit » discrète) ;
- colonne droite : « Casque audio sans fil — Noir », note « 4,6 ★ (128 avis) »,
  prix « 249,90 € », sous-titre « Livraison offerte », bouton « Ajouter au panier » ;
- plus bas : deuxième prix « 1 234,56 € » dans un encart « Offre reconditionnée ».

BULLE 1 (sur le premier prix, à 14 px sous le curseur, thème sombre) :
- ligne 1 : « ≈ 270,44 USD »
- ligne 2 : « 1 EUR = 1,0824 USD »
BULLE 2 (sur le deuxième prix, figée, thème sombre) :
- ligne 1 : « ≈ 1 336,82 USD »
- ligne 2 : « 1 EUR = 1,0824 USD »
- suivie du menu des devises (reprendre la composition de S03), positionnée sous
  le curseur, sans sortir du cadre.

CALQUES :
S01 / Contexte / E-commerce
├── Page / Mock (verrouillé, gris)
├── Cursor / Pointer (petit curseur, 16 × 16)
├── Bubble / Hover / Dark        (nomenclature S02)
└── Bubble / Frozen / Dark       (nomenclature S03)

MESURES :
- la bulle ne dépasse pas 320 px de large ;
- 14 px entre le curseur et le bord de la bulle ;
- 8 px de marge minimum avec les bords de la fenêtre ;
- si la place manque en dessous, la bulle se place au-dessus du curseur.

À ÉVITER : une page colorée qui concurrence la bulle ; une ombre dure ; un
curseur collé à la bulle ; du texte qui dépasse.

SORTIE : 2 PNG @2x (clair et sombre) pour référence + le cadre éditable.
```

---

## S02 — Bulle compacte (redlines)

```text
CADRE : nom « S02 / Bulle / Redlines », 1440 × 1200, fond de présentation #0F172A.
STYLE : voir le rappel système.
OBJECTIF : planche de référence, à l'échelle 2×, de la bulle compacte. C'est le
cadre qui fait foi pour les autres.

CONTENU :
- Bulle sombre à 2× (640 px de large) : « ≈ 1 082,45 € » / « taux 1 EUR = 1,0824 USD · 24/10 » ;
- La même en clair ;
- Une variante « libellé long » sur 2 lignes de titre :
  « ≈ 1 234 567 890,12 » / « Franc suisse · taux 1 EUR = 0,9345 CHF · taux en cache » ;
- Un grossissement ×4 du coin supérieur gauche (padding et rayon).

CALQUES :
S02 / Bulle / Redlines
├── Spec / Dark (2×)
│   ├── Bubble / Hover / Dark
│   └── Dimensions (lignes de cote + libellés)
├── Spec / Light (2×)
│   ├── Bubble / Hover / Light
│   └── Dimensions
├── Spec / Long label
└── Spec / Zoom ×4 (coin)

COTES À AFFICHER (en px réels, pas en px de la planche 2×) :
- largeur maximale 320 ;
- padding 10 vertical, 12 horizontal ;
- écart entre les deux lignes 3 ;
- ligne 1 : 13,5 / 600 ; ligne 2 : 11,5 / 400 (jamais d'opacité) ;
- rayon 8 ; bordure 1 ; ombre 0 8 24 (alpha 0,45 sombre / 0,14 clair) ;
- position : 14 px du curseur, 8 px des bords.

À ÉVITER : coter en pixels de la planche sans le dire ; oublier la variante
longue ; utiliser une opacité pour la ligne 2.

SORTIE : planche annotée, PNG @2x (clair et sombre) + composants Figma avec
auto-layout (padding et gap réglés sur les valeurs).
```

---

> **Popup 2.0 :** ce cadre décrit le menu de la bulle. Pour le popup, utiliser **S12** dans [`EVOLUTIONS-2.0.md`](EVOLUTIONS-2.0.md).

## S03 — Menu des devises

```text
CADRE : nom « S03 / Menu devises », 1440 × 1200, fond #0F172A, bulle isolée au centre.
STYLE : voir le rappel système.
OBJECTIF : bulle figée + menu des devises, avec tous les états de ligne. C'est le
composant le plus utilisé.

CONTENU EXACT :
- ligne 1 : « ≈ 1 336,82 USD »
- ligne 2 : « 1 EUR = 1,0824 USD »
- recherche (placeholder) : « Rechercher une devise… »
- sections et lignes :
  ÉPINGLÉES
    🇪🇺 Euro (EUR)                      [épingle pleine]
    🇺🇸 Dollar américain (USD)          [sélectionné, épingle pleine]
  PRINCIPALES
    🇬🇧 Livre sterling (GBP)
    🇯🇵 Yen japonais (JPY)
    🇨🇳 Yuan chinois (CNY)
    🇨🇭 Franc suisse (CHF)
  AUTRES
    🇨🇦 Dollar canadien (CAD)
    🇦🇺 Dollar australien (AUD)
    🇮🇳 Roupie indienne (INR)
    🇧🇷 Réal brésilien (BRL)
    🇦🇪 Dirham des Émirats (AED)
    🇲🇦 Dirham marocain (MAD)
- pied : poignée de redimensionnement.

STRUCTURE DES CALQUES :
S03 / Menu devises
├── Bubble / Frozen / Dark
│   ├── Header
│   │   ├── Main (« ≈ 1 336,82 USD »)
│   │   └── Detail (« 1 EUR = 1,0824 USD »)
│   ├── Picker / Currency
│   │   ├── Search (état vide)
│   │   ├── List
│   │   │   ├── Section / Épinglées
│   │   │   ├── Row / EUR / Pinned+Selected
│   │   │   ├── Section / Principales
│   │   │   ├── Row / GBP / Default
│   │   │   └── …
│   │   └── Footer / Resize
└── States / Rows (bande d'états, voir plus bas)

ÉTATS À PRODUIRE (bande sous la bulle, 5 lignes) :
Row / Default · Row / Hover · Row / Selected · Row / Focus-visible · Row / Pinned
+ une variante « Row / Pinned + Selected » (la sélection et l'épingle ne doivent
pas se confondre).

MESURES :
- bulle 320 px ; picker 260 px ; recherche 30 px de haut ; liste max 200 px,
  défilement visible ; en-tête de section 22 px ; ligne 24–28 px ;
- drapeau : boîte 24 px, emoji 18 px ; épingle 12 px à droite (zone 24 × 24) ;
- pied 18 px ; poignée 26 × 18, rayon 4, alignée à droite ;
- sélection : fond accent 16 % + barre 2 px à gauche (ne pas utiliser deux
  conventions différentes).

À ÉVITER : deux boutons par ligne ; sélection par la couleur seule (ajouter la
barre ou une coche) ; liste sans indice de défilement ; drapeaux bitmap.

SORTIE : composant Figma avec variantes (état × thème), PNG @2x, et une variante
« recherche remplie » avec « chine » qui filtre (montrer Yuan chinois).
```

---

## S04 — Menu des unités

```text
CADRE : nom « S04 / Menu unités », 1440 × 1200, fond #0F172A.
STYLE : voir le rappel système.
OBJECTIF : vérifier que le menu fonctionne SANS barre de recherche (liste courte)
et que les unités se lisent bien (symboles, exposants, degrés).

CONTENU EXACT :
- ligne 1 : « 6 ft 2 in = 1,88 m »
- ligne 2 : « 1 in = 2,54 cm »
- pas de recherche
- section unique : « LONGUEUR »
    m (mètre)            [sélectionné]
    km (kilomètre)
    cm (centimètre)
    mm (millimètre)
    mi (mile)
    yd (yard)
    ft (pied)
    in (pouce)
- pied : poignée.

TRANCHES À MONTRER (3 mini-frames) :
1. Longueur (ci-dessus) ;
2. Masse : kg, g, lb, oz, st — avec « 180 lb = 81,65 kg » en en-tête ;
3. Température : °C, °F, K — avec « 20 °C = 68 °F » et la ligne
   « °F = °C × 9/5 + 32 ».

CALQUES :
S04 / Menu unités
├── Bubble / Frozen / Dark / Unit
│   ├── Header / Main, Detail
│   ├── Picker / Unit
│   │   ├── List
│   │   │   ├── Section / Longueur
│   │   │   └── Row / m / Selected …
│   │   └── Footer / Resize
└── Variants / Masse, Température

MESURES : identiques à S03, sans champ de recherche (la liste remonte de 8 px).
Les symboles (°C, °F, km/h, m/s) doivent rester lisibles en 12 px.

À ÉVITER : ajouter une recherche alors qu'elle n'existe pas dans le produit ;
confondre « m » (mètre) et « mi » (mile) visuellement.

SORTIE : 3 variantes, PNG @2x, composant avec auto-layout.
```

---

## S05 — Menu des villes (fuseaux)

```text
CADRE : nom « S05 / Menu villes », 1440 × 1400, fond #0F172A.
STYLE : voir le rappel système.
OBJECTIF : le menu le plus long (132 villes) doit rester lisible et rapide à
parcourir. C'est aussi le seul avec une ligne « Ma position ».

CONTENU EXACT :
- ligne 1 : « 15h30 à Paris »
- ligne 2 : « 14:30 CET · +1 h »
- recherche (placeholder) : « Rechercher une ville ou un pays… »
- sections :
  MA POSITION
    🇫🇷 Ma ville — Paris (GMT+2)       [sélectionné par défaut]
  ÉPINGLÉES
    🇯🇵 Tokyo (GMT+9)                  [épingle pleine]
    🇺🇸 New York (GMT-4)                [épingle pleine]
  PRINCIPALES
    🇬🇧 Londres (GMT+1)
    🇫🇷 Paris (GMT+2)
    🇺🇸 New York (GMT-4)
    🇯🇵 Tokyo (GMT+9)
    🇦🇪 Dubaï (GMT+4)
    🇸🇬 Singapour (GMT+8)
    🇦🇺 Sydney (GMT+10)
  AUTRES VILLES
    🇦🇷 Buenos Aires (GMT-3)
    🇿🇦 Johannesburg (GMT+2)
    🇮🇳 Mumbai (GMT+5:30)
    🇳🇵 Katmandou (GMT+5:45)
    🇧🇷 São Paulo (GMT-3)
- pied : poignée.

VARIANTES :
1. liste complète (ci-dessus) ;
2. recherche remplie « tok » → une seule ligne « Tokyo (GMT+9) » ;
3. recherche sans résultat → état « Aucun résultat » (calme, pas d'alerte) ;
4. décalage à la demi-heure : « Mumbai (GMT+5:30) » et « Katmandou (GMT+5:45) »
   restent sur une ligne, sans ellipse.

CALQUES :
S05 / Menu villes
├── Bubble / Frozen / Dark / Timezone
│   ├── Header / Main, Detail
│   ├── Picker / Timezone
│   │   ├── Search
│   │   ├── List
│   │   │   ├── Section / Ma position
│   │   │   ├── Row / Paris / Selected
│   │   │   ├── Section / Épinglées
│   │   │   └── …
│   │   └── Footer / Resize
└── Variants / Search filled, Empty, Long label

MESURES : identiques à S03 ; la ligne principale (ville) est en 12 px, la partie
entre parenthèses en 11 px `text-muted`.

À ÉVITER : couper le nom de ville ; mettre le nom technique (IANA) en avant ;
utiliser un drapeau différent pour la même ville.

SORTIE : 4 variantes, PNG @2x.
```

---

## S06 — Sélection OCR

```text
CADRE : nom « S06 / OCR », 1440 × 1024, fond de présentation #0F172A.
STYLE : voir le rappel système ; accent #7DD3FC (sombre) / #2563EB (clair).
OBJECTIF : montrer la sélection d'une zone à lire (prix dessiné dans une image).

DÉCOR : une fausse page produit neutre (comme S01), avec une image contenant un
prix dessiné (texte « 149,99 € » dans un rectangle clair).

ÉTAT 1 — PRÊT :
- voile sur toute la page : rgba(15,23,42,0.22) ;
- cadre de sélection : bordure 2 px accent, fond accent 12 %, rayon 2 px,
  autour du prix dessiné ;
- pastille d'aide en haut au centre (top 14 px) :
  « Dessinez un rectangle autour du texte à lire · Échap pour annuler »
  (fond #0B1220, texte blanc 12,5/600, padding 8/14, rayon 8, ombre douce).
ÉTAT 2 — ERREUR :
- même pastille, bordure 1 px danger, texte :
  « Zone trop petite : dessinez un rectangle plus grand (Échap pour annuler) ».
ÉTAT 3 — RÉSULTAT :
- la bulle de résultat, même chemin que S03 : « 149,99 € » → « ≈ 162,35 USD ».

CALQUES :
S06 / OCR
├── Page / Mock
├── OCR / Veil
├── OCR / Frame
├── OCR / Hint / Ready
├── OCR / Hint / Error
└── Bubble / Frozen / Dark / OCR

MESURES : voile plein écran ; cadre 2 px ; pastille top 14, padding 8/14, 12,5/600.
La pastille ne doit jamais masquer la sélection.

À ÉVITER : un voile trop sombre (on doit lire la page) ; une pastille qui
chevauche le cadre ; une couleur d'erreur criarde.

SORTIE : 3 états, PNG @2x (clair et sombre).
```

---

> **Réglages 2.0 :** l'OCR automatique a été supprimé ; la page contient la case Scan, la case Detection, les six langues et les raccourcis personnalisables. Voir [`EVOLUTIONS-2.0.md`](EVOLUTIONS-2.0.md).

## S07 — Page de réglages (2.0)

```text
CADRE : nom « S07 / Réglages 2.0 », 1440 × 2600, fond #F6F8FC / #0B1220.
STYLE : voir le rappel système (page d'extension, cartes blanches).
OBJECTIF : page complète, calme, avec les réglages réellement livrés en 2.0.

CONTENU EXACT (dans cet ordre) :
- en-tête : « Réglages d'UniConv » 22/700 + « version 2.0.1 » 12 muted +
  bouton secondaire « Revoir le tutoriel » ;
- CARTE 1 « Devise cible » : recherche + liste, aide ;
- CARTE 2 « Ce que l'extension convertit » : Devises / Unités (interrupteurs),
  « Système d'unités cible » Métrique | Impérial ;
- CARTE 3 « Affichage » : délai 0–1000 ms, thème Clair | Sombre | Auto,
  « Réinitialiser la taille », Langue : Français | English | Español |
  Русский | 中文 | العربية | Auto ;
- CARTE 4 « Fuseaux horaires » : interrupteur, ville de référence, format ;
- CARTE 5 « Sites exclus » : champ + Ajouter, liste + Retirer, message ;
- CARTE 6 « Scan (OCR) — lire dans les images » : case « Activer le Scan (OCR) »
  (cochée), aide « bouton Scan ou raccourci personnel », bouton « Tester le
  moteur OCR », message. PAS de bloc OCR automatique ;
- CARTE 7 « Raccourcis clavier » : aucune touche imposée ; Firefox
  about:addons → Gérer les raccourcis ; Chrome chrome://extensions/shortcuts ;
  commandes « Lancer le Scan » et « Ouvrir le convertisseur » ;
- CARTE 8 « Sauvegarde des réglages » : export/import JSON ;
- CARTE 9 « Remise à zéro » : bouton danger.

CALQUES : Page/Header, Card/<nom> (×9), Field/<libellé>, Message/<succès|erreur>.
MESURES : contenu 760 centré ; carte r10 padding 16/18 ; switch 44×24 ;
segmenté langue sur deux lignes si nécessaire (7 options) ; aucune barre
horizontale.
ÉTATS : focus, succès, erreur, clair, sombre, arabe RTL.
CONTRAINTES : pas de police/image distante ; contraste 4,5:1 ; ne pas dessiner
d'OCR automatique, de seuil, de budget ni de statistiques automatiques.
SORTIE : clair + sombre PNG@2x.
```

---

## S08 — Popup (2.0)

> **Version compacte** dans [`FRAME-PROMPTS-2000.md`](FRAME-PROMPTS-2000.md) ;
> **détail complet** dans **S12** de [`EVOLUTIONS-2.0.md`](EVOLUTIONS-2.0.md).
> Ne pas réutiliser les anciens raccourcis `Alt+Maj+U` / `Alt+Maj+O`.

---

## S09 — Icônes

```text
CADRE : nom « S09 / Icônes », 800 × 400, fond de présentation #0F172A.
STYLE : voir le rappel système ; accent #7DD3FC (sombre) / #2563EB (clair).
OBJECTIF : une icône lisible à 16 px, cohérente avec la bulle.

CONTENU :
- 4 tailles : 128, 48, 32, 16 px, alignées, sur fond clair et sombre ;
- une grille de contrôle : le 16 px agrandi ×8 avec la grille de pixels ;
- le badge navigateur « OFF » (pastille danger + texte blanc 9 px) ;
- la version monochrome (pour les contextes à une couleur).

PISTE (à adapter) : un symbole de conversion (deux flèches croisées) ou un
« U » stylisé formé de deux traits ; une seule couleur dominante ; pas de détail
sous 2 px à la taille 16 ; fond transparent.

CALQUES :
S09 / Icônes
├── Icon / 128 / Light
├── Icon / 48 / Light
├── Icon / 32 / Light
├── Icon / 16 / Light
├── Icon / 128 / Dark  (…)
├── Grid / 16 ×8
└── Badge / OFF

MESURES : carrés stricts (16, 32, 48, 128) ; marge interne 1/8 de la taille ;
traits ≥ 1,5 px à 16 px.

À ÉVITER : du texte dans l'icône ; un dégradé ; un symbole qui devient une tache
à 16 px.

SORTIE : SVG source + PNG 16/32/48/128, fond transparent, sur fond clair et sombre.
```

---

## S10 — Planche de tokens

```text
CADRE : nom « S10 / Redlines / Tokens », 1440 × 1600, fond #0F172A.
STYLE : voir le rappel système.
OBJECTIF : une planche unique qui documente toutes les valeurs, pour que
l'intégration soit mécanique.

CONTENU :
- COULEURS : 2 colonnes (bulle sombre, bulle clair) + 1 colonne états ;
  chaque pastille avec son nom et son code ;
- TYPOGRAPHIE : la rampe complète (22/700, 15/600, 13,5/600, 13/400, 12/400,
  11,5/400, 11/600), avec un exemple de texte pour chaque ;
- ESPACEMENTS : barres de 2, 4, 6, 8, 10, 12, 16, 20, 24, 32 ;
- RAYONS : carrés de 4, 6, 8, 10, 999 ;
- OMBRES : 3 exemples (bulle sombre, bulle claire, carte) ;
- FOCUS : anneau 2 px + offset 2 px, sur un bouton et une ligne ;
- MOUVEMENT : 120 ms, 160 ms, courbe, et la mention « coupé si mouvement réduit » ;
- CONTRASTES : tableau des couples texte/fond avec le ratio calculé.

CALQUES :
S10 / Redlines / Tokens
├── Section / Couleurs
├── Section / Typographie
├── Section / Espacements
├── Section / Rayons
├── Section / Ombres
├── Section / Focus
├── Section / Mouvement
└── Section / Contrastes

À ÉVITER : des valeurs hors des tokens ; des noms de calques inventés ; des
contrastes annoncés sans calcul.

SORTIE : planche PNG @2x + le fichier `tokens.json` rempli avec EXACTEMENT ces
valeurs (mêmes clés).
```

---

## S11 — Cas extrêmes

```text
CADRE : nom « S11 / Cas extrêmes », 1440 × 1200, fond #0F172A.
STYLE : voir le rappel système.
OBJECTIF : garantir que le design tient dans les cas réels les plus durs.

6 MINI-FRAMES (320 px de large sauf mention) :
1. « Libellé long » : « Dollar des Caraïbes orientales (XCD) » dans une ligne de
   menu à 240 px — nom non coupé, partie technique en ellipse.
2. « Montant énorme » : « ≈ 1 234 567 890,12 ¥ » + « 1 EUR = 161,2345 JPY ».
3. « Bulle à 240 px » (largeur minimale) : texte qui passe à la ligne, pas de
   débordement.
4. « Bulle à 700 px » (largeur maximale) : la liste s'élargit, la poignée reste
   à droite, le texte ne s'étire pas de façon illisible (largeur de lecture).
5. « Zoom 200 % » : le même composant agrandi ×2, vérifier qu'aucun texte ne se
   chevauche et que le focus reste visible.
6. « Erreurs » : « aucun taux disponible », « devise non disponible », « Aucun
   résultat », « OCR impossible ».

CALQUES :
S11 / Cas extrêmes
├── Case / Long label
├── Case / Huge amount
├── Case / Bubble 240
├── Case / Bubble 700
├── Case / Zoom 200
└── Case / Errors (4 messages)

MESURES : rappeler la largeur de chaque cas au-dessus (240, 320, 700) et le
facteur de zoom.

À ÉVITER : tronquer un nom de devise ; laisser un texte sortir de la bulle ;
oublier l'état « Aucun résultat ».

SORTIE : PNG @2x + les composants correspondants.
```

---

## Contrôle de cohérence entre les cadres

Avant d'envoyer, vérifiez que :

- [ ] les **6 couleurs** de chaque thème sont identiques partout (bulle, menus,
      réglages, popup) ;
- [ ] les **hauteurs de ligne** sont les mêmes dans S03, S04 et S05 ;
- [ ] les **rayons** suivent 4/6/8/10 (aucun 12 ou 16 isolé) ;
- [ ] les **espacements** appartiennent à l'échelle (aucun 5, 7, 9, 11, 13) ;
- [ ] le **focus** est visible et identique partout ;
- [ ] la **poignée** fait 26 × 18 et reste dans le pied ;
- [ ] les **drapeaux** sont des emoji, jamais des images ;
- [ ] les textes sont ceux listés (mêmes libellés, même casse) ;
- [ ] chaque cadre existe en **clair et sombre** ;
- [ ] les calques portent les noms imposés.

## Correspondance avec le code (pour information)

| Cadre | Fichier que je modifierai |
|---|---|
| S01–S06 | `src/content.js` (feuille de style injectée : `STYLE_TEXT`) |
| S07 | `src/options.html` (+ `src/options.js` pour les libellés dynamiques) |
| S08 | `src/popup.html` (+ `src/popup.js`) |
| S09 | `icons/` + `manifest.json` |
| S10 | `src/content.js`, `src/options.html`, `src/popup.html` (via des variables `--uni-*`) |
| S11 | aucune modification de structure : vérifications |
