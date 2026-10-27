# UniConv — images, texte et OCR

**La question : « l'extension peut-elle reconnaître un prix écrit dans une
image ? »**

Réponse courte : **pas encore, et pas comme vous l'imaginez.** Mais une partie
du problème est déjà résolue — gratuitement.

Version concernée : **0.14.0**

---

## 1. Pourquoi une image n'est pas du texte

Une page web est un document structuré (le **DOM**) : des titres, des
paragraphes, des tableaux… et, à l'intérieur de chacun, du **texte**, stocké
caractère par caractère.

Une image, non. C'est une **boîte** avec une adresse :

```html
<img src="prix-promo.png">
```

Le navigateur **peint des pixels** dans cette boîte. Pour l'extension, il n'y a
**rien à lire** : pas de « 49,99 », pas de « € ». Un humain voit le prix ;
l'extension voit un rectangle de couleur.

| Ce que vous voyez | Ce que l'extension reçoit |
|---|---|
| Un prix dans un paragraphe | `« Le casque est à 79,99 € »` → **du texte** |
| Un prix dessiné dans une photo | `une image, 600 × 400 pixels` → **rien de lisible** |

---

## 2. Les quatre situations, en clair

| # | Situation | Reconnu ? | Depuis quand |
|---|---|---|---|
| 1 | Prix écrit en **texte HTML** (`<p>79,99 €</p>`) | ✅ | itération 1 |
| 2 | Prix en **texte posé par-dessus** une image (bannière, vignette) | ✅ | itération 1 |
| 3 | Prix dans le **texte d'un SVG** (`<svg><text>79,99 €</text></svg>`) | ✅ | itération 1 (vérifié à l'itération 7bis) |
| 4 | Prix **écrit dans l'attribut** d'une image (`alt`, `title`, `aria-label`) | ✅ | **itération 7bis** |
| 5 | Prix **dessiné dans les pixels** de l'image | ❌ | nécessite un OCR (itérations 9-10) |

Le cas 2 est de loin le plus fréquent : sur la plupart des sites marchands, le
prix est du texte HTML, même s'il est joliment posé sur une photo de produit.
Autrement dit, **l'extension couvre déjà la majorité des prix « dans les
images »**… sans lire une seule image.

---

## 3. Ce que fait l'itération 7bis (les attributs)

Beaucoup d'images portent une **description écrite dans le HTML** :

```html
<img src="casque.png" alt="Casque Bluetooth à 79,99 €">
```

Ce texte-là est lisible **instantanément**, sans analyser l'image. L'extension
l'analyse donc comme n'importe quel autre texte.

**Attributs examinés**, par ordre de priorité :

| Attribut | Fréquence | Remarque |
|---|---|---|
| `alt` | très fréquent | décrit l'image pour les lecteurs d'écran ; contient souvent le nom du produit **et son prix** |
| `aria-label` | fréquent | équivalent de `alt` pour les composants riches |
| `title` | rare | info-bulle native du navigateur |

**Détails importants :**

- Les règles anti-faux-positifs de l'itération 7 s'appliquent **aussi** ici :
  un `alt` qui contient `v1.2.3 EUR` n'est pas converti.
- L'attribut peut arriver **après** l'affichage (chargement paresseux) :
  l'extension surveille donc les changements de ces trois attributs.
- Si l'attribut change et ne contient plus de prix, la bulle disparaît.

**Deux limites honnêtes :**

1. **Aucun soulignement.** On ne peut pas dessiner dans une image : rien ne
   signale qu'elle contient un prix. La bulle s'ouvre au survol, mais il faut
   déjà être curieux. *(Une solution existe — entourer l'image d'un liseré —
   mais elle oblige à modifier la page, ce que le projet évite jusqu'ici :
   c'est une décision à prendre, pas un oubli.)*
2. **La qualité dépend du site.** Beaucoup d'images ont un `alt` vide
   (`alt=""`, images décoratives) ou purement descriptif
   (`alt="photo.jpg"`). Sur ces sites, il ne reste que l'OCR.

---

## 4. Ce qu'il faudrait pour lire dans les pixels : l'OCR

**OCR** = *Optical Character Recognition* : reconnaissance des caractères sur
une image. Un moteur spécialisé analyse les formes, devine les lettres, et
restitue du texte. Firefox n'en fournit aucun : il faut l'embarquer.

Le plan de route prévoit deux itérations :

| Itération | Ce qu'elle apporterait |
|---|---|
| **9 — OCR manuel** | Vous **cliquez** sur une image (`Alt` + clic), l'extension l'analyse et affiche les prix trouvés |
| **10 — OCR automatique** | Analyse au **survol prolongé** des images « qui ont l'air » de contenir un prix (nom de fichier, `alt`, taille, proximité d'un bouton d'achat), avec un budget de 5 images par page |

### Les contraintes, sans enrobage

| Contrainte | Ordre de grandeur |
|---|---|
| **Poids ajouté** | ~5 Mo (moteur Tesseract.js + modèles français/anglais) |
| **Temps par image** | 1 à 5 secondes |
| **Précision sur un badge de prix** | mauvaise : un prix de 60 × 20 px est illisible, même pour un bon OCR |
| **Précision sur une capture d'écran** | bonne |
| **Processeur** | consommation notable pendant l'analyse |
| **Confidentialité** | **aucun envoi réseau** si le moteur est embarqué (c'est la voie choisie) |

### La tentation à écarter

Un service OCR **en ligne** (API commerciale) serait rapide et précis. Mais il
faudrait **envoyer vos images à un tiers**, ce qui contredirait la promesse
actuelle (« aucune donnée collectée ni envoyée ») et exigerait une permission
réseau supplémentaire. Ce n'est pas la voie retenue.

---

## 5. Tester le comportement actuel

### 5.1 Sur une vraie page

1. Ouvrir une fiche produit (Amazon, Cdiscount, une boutique quelconque).
2. **Survoler l'image du produit** (pas le texte à côté) : si son `alt` contient
   un prix, la bulle doit s'ouvrir.
3. Survoler une image **sans** prix : rien ne doit apparaître.
4. Ouvrir le popup : la ligne « Dernière page analysée » indique désormais
   « … et 3 image(s) avec un prix ».

### 5.2 Vérification automatique

```bash
cd ~/Documents/UniConv
node tools/smoke-test.mjs      # 70 / 70
node tools/dynamic-tests.mjs   # 47 / 47
```

Ces tests couvrent : prix dans `alt`, dans `aria-label`, image sans prix,
version dans un `alt`, `alt` rempli **après** l'affichage, et disparition de la
bulle quand l'attribut change.

### 5.3 Vérifier soi-même, sans site particulier

Dans la console de n'importe quelle page (`Cmd` + `Option` + `K`) :

```js
// Ajoute une image dont l'attribut alt contient un prix, puis la survole.
const img = document.createElement('img');
img.alt = 'Article de demonstration a 42 €';
img.style.cssText = 'width:200px;height:120px;background:#eee;display:block;margin:20px';
document.body.appendChild(img);
```

La bulle doit s'ouvrir au survol de ce rectangle gris.

---

## 6. Ce qui reste impossible aujourd'hui

- Un prix **dessiné** dans une image ou une vidéo.
- Un prix dans un **canvas** (graphique dynamique) : ce sont aussi des pixels.
- Un prix dans une **iframe** d'un autre domaine (l'extension ne voit pas son
  contenu ; ce n'est pas lié à l'OCR).
- Un prix dans une **capture d'écran** collée dans une page.

Les quatre premiers points sont l'objet des itérations 9 et 10, à l'exception
des iframes, hors périmètre assumé.
