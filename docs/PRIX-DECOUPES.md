# UniConv — les prix coupés en plusieurs balises

**Le bug :** sur Amazon, un prix comme `54,00 €` ne s'affichait pas du tout.
Pas de soulignement, pas de bulle.

Version concernée : **0.14.0**

---

## 1. Le problème, tel qu'il se présente

L'extension analysait le texte **morceau par morceau**. Or les sites
découpent souvent l'affichage d'un prix pour styler chaque partie :

```html
<span class="a-price">
  <span class="a-offscreen">54,00 €</span>   <!-- texte pour lecteurs d'écran -->
  <span aria-hidden="true">
    <span class="a-price-symbol">€</span>
    <span class="a-price-whole">54<span class="a-price-decimal">,</span></span>
    <span class="a-price-fraction">00</span>
  </span>
</span>
```

Morceau par morceau, le contenu analysé était donc :

| Morceau | Texte analysé | Résultat |
|---|---|---|
| `a-price-symbol` | `€` | aucun montant (pas de nombre) |
| `a-price-whole` | `54,` | aucun montant (pas de devise) |
| `a-price-fraction` | `00` | aucun montant (pas de devise) |

Le prix n'existe **nulle part** sous forme de texte continu. D'où le silence
total — et le même silence sur les **vignettes cliquables**
(`<span>13,50</span><span>€</span>`), d'où le second symptôme signalé.

---

## 2. La solution : reconstituer le texte d'une « suite »

**Une suite** est un ensemble de morceaux de texte qui s'affichent **côte à
côte**, dans un même conteneur en ligne. L'extension :

1. **remonte** depuis le morceau survolé jusqu'au conteneur commun (au plus
   4 niveaux, uniquement à travers des balises *inline* comme `span`, `a`,
   `label`, `b`, `i`…) ;
2. **reconstitue** le texte de ce conteneur, morceaux mis bout à bout ;
3. **analyse** ce texte reconstitué avec les moteurs habituels (devises,
   unités, règles anti-faux-positifs) ;
4. **répartit** chaque montant trouvé sur les morceaux qu'il couvre.

Pour l'exemple Amazon, le texte reconstitué est `€54,00` (l'ordre du DOM) :
la règle « symbole avant le nombre » le reconnaît parfaitement.

```
€ + 54 + , + 00   →   €54,00   →   54,00 €   ✅
```

Chaque morceau reçoit ensuite sa **portion** du montant, ce qui permet au
soulignement et au survol de continuer à fonctionner morceau par morceau :
survoler le `54` suffit à ouvrir la bulle.

---

## 3. Les garde-fous (pour ne pas créer de faux positifs)

Reconstituer du texte est puissant… et risqué : si l'on colle trop de choses
ensemble, on peut inventer des montants qui n'existent pas.

| Garde-fou | Pourquoi |
|---|---|
| **On ne franchit jamais un bloc** (`div`, `td`, `li`, `p`, `button`…) | sinon le `12` d'une colonne pourrait se coller au `€` d'une autre |
| **Au plus 4 niveaux** de remontée | limite les regroupements hasardeux |
| **Conteneur de moins de 240 caractères** | évite d'analyser une page entière d'un coup |
| **Une zone interdite sépare** | un montant ne peut pas traverser un `<code>`, un champ de saisie… |
| **Les règles de l'itération 7 s'appliquent** | un `v1.2.3` reconstitué reste un numéro de version |

Un test dédié vérifie le cas le plus dangereux : `12` dans un bloc, `€` dans
un **autre** bloc → **aucun** montant (les deux ne fusionnent pas).

---

## 4. Ce que ça change concrètement

| Situation | Avant | Après |
|---|---|---|
| `<span>54</span><span>,</span><span>00</span><span> €</span>` | rien | converti |
| Vignette `<label><span>13,50</span><span>€</span></label>` | rien | converti |
| Case de variante recouverte d'un lien transparent | rien | converti (recours spatial) |
| `<td>Prix</td><td>54,00 €</td>` | converti | converti (inchangé) |
| `12` dans un bloc, `€` dans un autre | rien | rien (volontaire) |
| Deux prix dans une phrase (`de 5 € à 10 €`) | deux | deux (inchangé) |

---

## 4bis. Les prix cachés sous un lien transparent (cases de variantes)

**Deuxième cause, trouvée sur la fiche Amazon** (`B077XHPGTW`, case
« 90 Unité (Lot de 48) »).

La case de variante est construite ainsi :

```html
<span class="a-button">
  <span class="a-button-inner">
    <span class="swatch-title-text">90 Unité (Lot de 48)</span>
    <div class="dimension-slot-info"> … 54,00 € … </div>
    <a class="page-load-link" style="height:100%; width:100%"></a>  ← !!
  </span>
</span>
```

Ce `<a class="page-load-link">` est **vide de texte** et **recouvre toute la
case** : il sert simplement à rendre la case cliquable.

Or l'extension demandait au navigateur « quel caractère y a-t-il sous la
souris ? ». Sur le lien transparent, la réponse est : **aucun**. D'où
l'absence de bulle, alors que le prix est bien là, une couche plus bas.

### Le recours spatial

L'extension essaie maintenant **trois** méthodes, dans cet ordre :

| Ordre | Méthode | Coût | Quand elle suffit |
|---|---|---|---|
| 1 | prix dans un **attribut d'image** | quasi nul | images décrites (`alt`) |
| 2 | **curseur dans le texte** | faible | cas normal (99 % des pages) |
| 3 | **test spatial par rectangles** | modéré (petites zones seulement) | prix recouvert par un lien transparent, superposition |

La troisième méthode demande au navigateur **toute la pile** des éléments sous
le curseur (`elementsFromPoint`, qui voit *à travers* les superpositions),
puis compare la position du curseur avec les **rectangles réels** des montants
déjà détectés (`getClientRects`).

Garde-fous : seules les **petites zones** sont parcourues (moins de 900 × 700
px), au plus **4 éléments** de la pile, au plus **160 morceaux de texte**, et
cette méthode n'est appelée **que si les deux premières ont échoué**.

---

## 4ter. Que faire si un prix reste muet

Un raccourci de diagnostic existe : **<kbd>Alt</kbd> + <kbd>Maj</kbd> +
<kbd>D</kbd>** (D comme *debug*).

1. Placer la souris **sur le prix** qui ne réagit pas.
2. Appuyer sur <kbd>Alt</kbd> + <kbd>Maj</kbd> + <kbd>D</kbd>.
3. Ouvrir la console de la page (<kbd>Cmd</kbd> + <kbd>Option</kbd> +
   <kbd>K</kbd>).

Le rapport indique, pour l'endroit précis du curseur :

| Ligne | Ce qu'elle dit |
|---|---|
| `1. elements sous le curseur` | la pile réelle, superpositions comprises |
| `2. curseur dans le texte` | le morceau de texte trouvé, ou « aucun » |
| `3. suite reconstituée` | le texte recollé, entre guillemets |
| `4. montants dans cette suite` | ce que le moteur y reconnaît |
| `5. resultats` | ce que chaque méthode de recherche renvoie |

**Lecture rapide :**

- `curseur dans le texte : aucun` → quelque chose recouvre le prix. Le recours
  spatial devrait s'en charger ; s'il échoue aussi, c'est un défaut à corriger.
- `suite reconstituée` ne contient **pas** le prix → le texte est découpé plus
  largement qu'attendu (à transmettre avec la ligne 3).
- Les montants sont bien listés en 4, mais `resultats` est vide partout → le
  problème est dans la recherche, pas dans la détection.

Copier ce rapport et le transmettre permet de corriger sans deviner.

---

## 5. Vérifier soi-même

### 5.1 Sur Amazon

1. Recharger l'extension.
2. Ouvrir une fiche produit Amazon.
3. Survoler **le nombre** du prix principal (le `54` de `54,00 €`) : la bulle
   doit s'ouvrir.
4. Survoler le prix d'une **vignette de variante** (taille, couleur) : les prix
   de ces cases doivent aussi réagir.
5. Vérifier que `54,00 € (0,01 € / unité)` donne **deux** montants distincts
   selon l'endroit survolé.

### 5.2 Vérification automatique

```bash
cd ~/Documents/UniConv
node tools/dynamic-tests.mjs      # 63 / 63
```

La section 12 de ce test reproduit **la structure exacte d'Amazon** (symbole,
entier, virgule, décimales, texte hors écran) et vérifie :
la détection, le survol du `54`, la conversion, le prix unitaire, la vignette
cliquable, le refus de fusionner à travers un bloc, et — section 13 — une case
de variante **recouverte d'un lien transparent** (structure exacte relevée sur
amazon.fr).

---

## 6. Ce que cette correction ne fait pas

- Elle ne lit toujours **pas** un prix dessiné dans les pixels (voir
  `docs/IMAGES-ET-OCR.md`).
- Elle ne recolle pas deux morceaux séparés par un bloc, même si le site les
  affiche visuellement côte à côte (ex. deux cellules d'un tableau). C'est un
  choix : mieux vaut manquer un prix que d'en inventer un.
