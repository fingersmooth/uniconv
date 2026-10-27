# UniConv — faux positifs (itération 7)

**Convertir tout ce qui bouge, c'était l'objectif des itérations 1 à 6.
Maintenant, il faut apprendre à se taire.**

Version concernée : **0.14.0**

---

## 1. De quoi parle-t-on ?

Un **faux positif**, c'est un nombre que l'extension convertit alors qu'il n'a
aucune valeur monétaire ou physique. Exemples :

| Texte sur la page | Ce qui se passait avant |
|---|---|
| `Version 2.0.1 disponible` | Rien (pas de devise) |
| `v1.2.3 EUR` | Bulle « 2,3 EUR » ❌ |
| `Chapitre 10 €` | Bulle « 10 € » sur un numéro de chapitre ❌ |
| `Budget de 12 m€` | Bulle « 12 m » en pieds ❌ (m€ = millions d'euros) |
| `50 K abonnés` | Bulle « 50 K » en degrés Celsius ❌ |
| `Studio de 10 m²` | Bulle « 10 m » en pieds ❌ (une surface) |

Un faux positif est **agacé** : il souligne du texte qui n'a rien demandé.

Mais il existe un défaut **plus grave** : le **faux négatif**, c'est-à-dire un
vrai prix qui n'est plus converti. Une règle trop zélée qui bloque `10 €` casse
la fonction principale de l'extension.

> **Règle d'or appliquée partout dans cette itération :** mieux vaut laisser
> passer un faux positif que de rejeter un vrai prix. Chaque règle est donc
> **étroite** : elle ne se déclenche que si l'indice est *collé* au nombre.

---

## 2. Les deux mécanismes

### 2.1 Étroitesse du contexte (« collé au nombre »)

```
Chapitre 10 €          → rejeté  (le mot « chapitre » touche le nombre)
Le chapitre parle de 10 € → converti (le mot est loin)
```

C'est ce qui permet de filtrer sans devenir aveugle.

### 2.2 Le nombre doit être un montant, pas un numéro

L'extension exige déjà un **symbole** (`€`, `$`), un **code** (`EUR`, `JPY`) ou
un **mot** (`euros`, `dollars`). Un nombre nu n'est jamais converti. Cela règle
la majorité des pièges **par construction** : `1920x1080`, `12h30`, `75001`,
`ISO 9001` ne contiennent aucun indice monétaire.

Les règles ci-dessous servent donc aux cas **mixtes**, où un indice monétaire
est présent à proximité d'un nombre qui n'est pas un prix.

---

## 3. Les règles en place

Chaque règle a un identifiant, compté et affiché dans le popup.

| # | Identifiant | Ce qu'elle rejette | Exemple |
|---|---|---|---|
| 1 | `percent` | un nombre suivi de `%` | `remise 10 % EUR` |
| 2 | `version` | un numéro de version | `v1.2.3 EUR`, `1.2.3 EUR` |
| 3 | `time` | une heure ou un décalage horaire | `12h30`, `12:30`, `GMT+2` |
| 4 | `date` | une date | `12/10/2025`, `2025-10-12` |
| 5 | `range` | un montant isolé **à l'intérieur** d'une plage (la fourchette de prix elle-même est détectée) | `2000 - 3000 CNY` |
| 6 | `ratio` | une note ou un ratio | `4,5/5 EUR` |
| 7 | `phone` | un numéro de téléphone | `06 12 34 56 78` |
| 8 | `ip` | une adresse IP | `192.168.1.1` |
| 9 | `identifier` | une norme, une référence, un identifiant | `ISO 9001`, `réf. 1234`, `COVID-19`, `#1234` |
| 10 | `numbering` | une numérotation | `page 12`, `chapitre 10`, `figure 3` |
| 11 | `dimension` | une dimension (unités seulement) | `10 m x 12 m`, `10 m²` |
| 12 | `millions` | `m` ou `M` devant une devise | `12 m€` |
| 13 | `dump` | un pavé de chiffres (tableau de statistiques) | une ligne de 20 nombres |

### 3.1 Le piège du format allemand

`1.234.567,89 €` contient **deux points**. Une règle « deux points = version »
aurait rejeté ce prix. La reconnaissance du format des milliers est donc faite
**avant** la règle des versions :

```
1.234.567,89 €  → 1 234 567,89 €  ✅ (points = milliers, virgule = décimale)
1.2.3 EUR       → rejeté (version) ✅
```

C'est aussi une **correction de justesse** apportée à cette itération : avant,
`1.234.567,89 €` affichait `567,89 €`.

### 3.2 Deux unités volontairement retirées de la détection

| Unité | Pourquoi |
|---|---|
| `K` (kelvin) | Sur le web, `50 K` veut dire 50 000 (abonnés, vues, euros). Le mot `kelvin` reste reconnu, et la **conversion** accepte toujours `K`. |
| `m` devant `€` | `12 m€` = 12 millions d'euros. |

### 3.3 Zones jamais analysées

Ces balises sont ignorées, ainsi que tout ce qu'elles contiennent :

`script`, `style`, `noscript`, `textarea`, `input`, `select`, `option`,
`optgroup`, `datalist`, `output`, `title`, `code`, `pre`, `kbd`, `samp`,
`var`, `template`, `iframe`, `canvas`, `object`, `embed`, `meter`, `progress`

Plus : les zones où l'on tape du texte (`contenteditable`) et l'interface de
l'extension elle-même (`data-unic`).

> **Note sur `svg` et `math` (itération 7bis).** Ils figuraient dans cette
> liste, mais l'exclusion était **sans effet** : les balises SVG et MathML
> s'écrivent en minuscules (`<svg>`, `<text>`), alors que le test compare des
> noms en majuscules. Autrement dit, le texte SVG **était déjà analysé** — ce
> qui est le comportement souhaitable, puisqu'un prix peut y être écrit en
> toutes lettres. Les entrées ont donc été retirées pour que cette page dise la
> vérité. Les graphiques bourrés de chiffres sont écartés par la règle
> « pavé de chiffres ».

### 3.4 Les images (itération 7bis)

Une image peut porter un prix **écrit dans son attribut** : c'est du vrai
texte, analysé gratuitement.

```html
<img src="casque.png" alt="Casque Bluetooth à 79,99 €">   ← converti
<img src="photo.jpg" alt="Photo d'un casque noir">        ← ignoré
```

Attributs examinés, par ordre de priorité : `alt`, `aria-label`, `title`.
Les règles de contexte de la section 3 s'y appliquent aussi (un numéro de
version dans un `alt` reste ignoré).

**Limite à connaître :** une image **ne peut pas être soulignée** (on ne
dessine pas dans une image). La bulle s'ouvre au survol, mais rien ne signale
visuellement que l'image contient un prix. Voir `docs/IMAGES-ET-OCR.md`.

---

## 4. Pause, liste noire, indicateur d'état

### 4.1 Le raccourci

<kbd>Alt</kbd> + <kbd>Maj</kbd> + <kbd>U</kbd> suspend ou réactive
l'extension sur toutes les pages.

- Tous les soulignements disparaissent.
- Plus aucune bulle ne s'ouvre.
- L'icône affiche **OFF** (badge orange).

Le raccourci fonctionne même quand l'extension est déjà en pause — c'est
justement son rôle. Le choix est **mémorisé** : il survit au redémarrage du
navigateur.

### 4.2 Le popup

Le bloc **Détection** indique l'état (`active` / `en pause`) et propose le
bouton inverse. Aucune ambiguïté possible entre « en pause » et « cassé ».

### 4.3 La liste noire

Ces sites ne sont **jamais** analysés : ce sont des outils où l'on tape du
texte toute la journée.

| Catégorie | Domaines |
|---|---|
| Messagerie | `mail.google.com`, `outlook.office.com`, `outlook.live.com`, `mail.yahoo.com`, `web.whatsapp.com`, `web.telegram.org` |
| Documents | `docs.google.com`, `drive.google.com`, `notion.so`, `airtable.com` |
| Agenda / photos | `calendar.google.com`, `photos.google.com`, `keep.google.com`, `trello.com` |
| Code | `github.com`, `gitlab.com`, `bitbucket.org`, `stackoverflow.com`, `codepen.io`, `jsfiddle.net`, `codesandbox.io`, `replit.com` |
| Design | `figma.com` |

La règle couvre les **sous-domaines** : `gist.github.com` est exclu aussi.

Sur un site exclu, l'extension ne fait **rien du tout** : pas de scan, pas de
surveillant, pas d'écouteur de souris. C'est la garantie qu'elle n'a aucun coût
sur ces pages.

> La liste **personnelle** (ajouter ses propres domaines) arrivera avec la page
> d'options, à l'itération 8. Le stockage est déjà prêt : clé
> `uniconv.blacklist`, tableau de noms d'hôtes.

---

## 5. Le compteur « nombres écartés »

Après avoir rechargé une page, ouvrez le popup :

> **Dernière page analysée**
> 187 bloc(s) de texte analysés · 4 mise(s) à jour dynamique(s) (il y a 3 s).
> 9 nombre(s) écarté(s) : 5 numérotations, 3 versions, 1 date.

C'est un choix de transparence : plutôt qu'un silence inexpliqué, l'extension
dit ce qu'elle a volontairement ignoré, et pourquoi.

---

## 6. Tester soi-même (10 minutes)

### 6.1 La page de test

```
http://localhost:8123/test/faux-positifs.html
```

- **Section 1 : 61 pièges.** Aucun ne doit être souligné ni ouvrir de bulle.
- **Section 2 : 12 vrais prix.** Tous doivent fonctionner comme avant.
- **Section 3 :** vérifie la pause et rappelle la liste noire.

Si un piège est converti, **notez son numéro** : il identifie la règle fautive.

### 6.2 Les 8 sites réels à essayer (2 minutes chacun)

Ces sites sont représentatifs des situations où un détecteur se trompe.

| # | Site | Ce qu'on y vérifie |
|---|---|---|
| 1 | **wikipedia.org** (article au hasard) | Beaucoup de nombres, dates, références : rien ne doit être souligné sans raison |
| 2 | **lemonde.fr** ou un site d'actualité | Prix cités convertis, pourcentages et années ignorés |
| 3 | **amazon.fr** (une fiche produit) | Les prix fonctionnent, les notes (`4,5/5`) et numéros de modèle ne sont pas convertis |
| 4 | **booking.com** (résultats de recherche) | Prix dans les cartes, notes (`8,7/10`), nombres de chambres |
| 5 | **github.com** (une page de code) | **Doit être totalement muet** (liste noire) |
| 6 | **mail.google.com** | **Doit être totalement muet** (liste noire) |
| 7 | Un site de **bourse** (cours en direct) | Montants mis à jour en continu : c'est le croisement des itérations 6 et 7 |
| 8 | Un site de **e-commerce avec défilement infini** | Prix corrects, aucun ralentissement |

**Ce qu'il faut regarder à chaque fois :** y a-t-il un nombre souligné qui n'est
pas un prix ? Y a-t-il un prix qui n'est plus souligné (régression) ?

### 6.3 Vérification automatique

```bash
cd ~/Documents/UniConv

node tools/false-positive-tests.mjs
#   Resultat : 90 reussi(s), 0 echec(s)

node tools/dynamic-tests.mjs
#   Resultat : 42 reussi(s), 0 echec(s)
```

`false-positive-tests.mjs` contient **les mêmes pièges que la page HTML** et
vérifie que les deux listes ne divergent pas : si quelqu'un ajoute un piège à
la page sans vérifier le moteur, le test le signale.

---

## 7. Si quelque chose ne va pas

| Symptôme | À transmettre |
|---|---|
| Un piège est converti | Le **numéro** de la page de test, ou le texte exact + l'URL |
| Un vrai prix n'est plus converti | Le texte exact + l'URL (**régression**, priorité haute) |
| Deux montants s'affichent au même endroit | Capture d'écran + URL |
| Le raccourci ne fait rien | Est-ce que le focus est dans un champ de saisie ? (le raccourci y est ignoré) |
| L'icône affiche OFF en permanence | Le bloc Détection du popup, ou refaire <kbd>Alt</kbd>+<kbd>Maj</kbd>+<kbd>U</kbd> |
| Une page est totalement muette alors qu'elle devrait fonctionner | L'URL : elle est peut-être dans la liste noire |

---

## 8. Ce que cette itération ne fait **pas**

- Pas de page d'options pour **modifier** la liste noire (itération 8).
- Pas de réglage de la sensibilité (itération 8).
- Pas de détection de la langue.
- Pas d'OCR.

---

## 9. Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/content.js` | Les 13 règles, les zones exclues, la pause, le raccourci, la liste noire |
| `src/background.js` | Le badge **OFF** de l'icône |
| `src/popup.html` / `src/popup.js` | Bloc Détection + compteur de nombres écartés |
| `test/faux-positifs.html` | 61 pièges + 12 vrais prix |
| `tools/false-positive-tests.mjs` | 90 vérifications automatiques |
| `tools/dynamic-tests.mjs` | Vérifie la pause, la liste noire et le raccourci |
| `docs/FAUX-POSITIFS.md` | Ce document |
