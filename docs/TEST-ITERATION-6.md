# UniConv — Protocole de test de l'itération 6

**Contenu dynamique : détecter les montants qui arrivent après le chargement.**

Version testée : **0.10.0** (protocole toujours valable ; remplacez le
numéro de version par celui affiché dans la console)

---

## 1. Ce qui change (en clair)

Jusqu'ici, l'extension lisait la page **une seule fois**, au moment où la page
s'ouvre.

C'est suffisant pour un article de journal. Ça ne l'est pas pour les sites
modernes, qui fabriquent leur contenu **après** :

| Site | Ce qui arrive après le chargement |
|---|---|
| YouTube | La liste des vidéos recommandées |
| Amazon | Les prix des produits, les avis |
| Un site de bourse | Les cours, mis à jour en continu |
| Une place de marché | Les nouvelles annonces quand on fait défiler |
| Une banque en ligne | Le solde, chargé par le code de la page |

À cette itération, l'extension **surveille** la page et analyse ce qui apparaît.

**Trois précautions ont été prises**, toutes invisibles pour vous :

1. **Regroupement (300 ms).** Quand un site ajoute 50 éléments d'un coup, on
   attend la fin de la rafale et on analyse une seule fois, au lieu de 50.
   Sans cela, la page ralentirait.
2. **Traitement à la carte.** On n'analyse que ce qui vient d'apparaître. La
   page entière n'est jamais relue.
3. **Zones ignorées.** Les champs de saisie, les zones où l'on tape du texte,
   les blocs de code (`<script>`, `<style>`) et l'interface de l'extension
   elle-même sont exclus.

**Note technique :** le plan de route prévoyait un fichier séparé
`src/observer.js`. Le code a finalement été ajouté **dans `src/content.js`**,
pour une raison de simplicité : le script du contenu est une seule fonction
fermée, et un fichier séparé n'aurait pas pu accéder à ses variables internes
(détections déjà trouvées, liste des nœuds, etc.). Le comportement visible est
identique à ce qui était prévu.

---

## 2. Avant de commencer

### 2.1 Recharger l'extension

1. Ouvrir `about:debugging#/runtime/this-firefox` dans Firefox.
2. Repérer **UniConv** dans la liste.
3. Cliquer sur **Recharger**.

> Si vous voyez **deux** entrées UniConv, supprimez la plus ancienne, quittez
> Firefox entièrement (`Cmd` + `Q`), puis rechargez `manifest.json` par
> **Charger un module temporaire**. Une extension fantôme est le piège numéro 1
> du projet : elle injecte l'ancien code et fait perdre des heures.

### 2.2 Lancer le serveur de test

```bash
cd ~/Documents/UniConv && python3 -m http.server 8123
```

Laisser ce Terminal ouvert pendant tout le test.

### 2.3 Vérifier que la bonne version est chargée

Ouvrir `http://localhost:8123/test/dynamique.html` dans un **onglet neuf**,
puis `Cmd` + `Option` + `K` (console de la page).

On doit lire exactement :

```
[UniConv] content.js <version> charge sur http://localhost:8123/test/dynamique.html
[UniConv] analyse terminee : ... montant(s) dans ... bloc(s) de texte
[UniConv] surveillance du contenu dynamique activee
```

La **troisième ligne est nouvelle** : c'est elle qui prouve que le surveillant
tourne. Si elle manque, arrêtez-vous et signalez-le.

---

## 3. Protocole A — la page de test (5 minutes)

Page : `http://localhost:8123/test/dynamique.html`

Suivre les sections **dans l'ordre**.

### Section 1 — Témoin (contenu présent au chargement)

| # | Action | Attendu |
|---|---|---|
| 1 | Regarder `10 €` et `25 €` | Les deux sont déjà soulignés en pointillés |
| 2 | Survoler `10 €` | La bulle s'ouvre normalement |

C'est le contrôle de non-régression : si cette section ne marche plus, le
problème ne vient pas du contenu dynamique.

### Section 2 — Ajout à la demande

| # | Action | Attendu |
|---|---|---|
| 3 | Cliquer sur **Ajouter une ligne** | Une ligne « Article n°1 : 7 € » apparaît |
| 4 | Attendre une demi-seconde | Le montant `7 €` **se souligne** tout seul |
| 5 | Le survoler | La bulle s'ouvre |
| 6 | Cliquer 3 fois de plus, puis **Vider la liste** | Chaque nouvelle ligne est soulignée ; la liste se vide |

> **C'est le test décisif de cette itération.** Avant, une ligne ajoutée par un
> bouton n'était jamais soulignée : la page avait été lue une seule fois, au
> tout début.

### Section 3 — Flux continu (le cas d'un site en direct)

| # | Action | Attendu |
|---|---|---|
| 7 | Cliquer sur **Démarrer le flux** | Une ligne apparaît toutes les 0,7 s |
| 8 | Regarder 20 secondes | Chaque nouveau montant se souligne à son tour |
| 9 | Pendant ce temps, faire défiler la page | Le défilement reste **fluide** (critère bloquant) |
| 10 | Cliquer sur **Arrêter le flux** | L'ajout s'arrête immédiatement |

> Le compteur « lignes ajoutées » doit augmenter d'environ 1,4 par seconde.

### Section 4 — Texte modifié sur place

| # | Action | Attendu |
|---|---|---|
| 11 | Regarder la « Cagnotte en direct » | Le montant augmente chaque seconde |
| 12 | Le survoler pendant qu'il change | La bulle reste cohérente (valeur à jour) |
| 13 | Cliquer sur **Mettre en pause** | Le montant se fige |

> Ici, le texte change **dans le même élément** HTML : c'est le cas le plus
> courant sur les sites modernes (un compteur qui s'actualise).

### Section 5 — Test de charge

| # | Action | Attendu |
|---|---|---|
| 14 | Cliquer sur **Ajouter 500 lignes** | 500 lignes apparaissent d'un coup |
| 15 | Lire la durée affichée | Moins de **1 000 ms** |
| 16 | Faire défiler immédiatement | Pas de blocage, pas de saccade |
| 17 | Survoler une ligne au hasard | La bulle s'ouvre |

> Une durée de 1 000 ms est un plafond large. En pratique, on attend plutôt
> 200 à 500 ms. Au-delà de 1 000 ms, ou si la page se fige, c'est un échec.

### Section 6 — Zones à ignorer

| # | Action | Attendu |
|---|---|---|
| 18 | Survoler le contenu du champ de saisie (`100 €`) | **Aucune** bulle |
| 19 | Cliquer dans la zone modifiable et survoler `100 €` | **Aucune** bulle |
| 20 | Survoler le texte de la zone `textarea` | **Aucune** bulle |

### 3.1 Le compteur du popup

| # | Action | Attendu |
|---|---|---|
| 21 | Cliquer sur l'icône UniConv | Un bloc **Dernière page analysée** est visible |
| 22 | Lire le texte | « N bloc(s) de texte analysés », suivi du nombre de mises à jour dynamiques |

> Ce bloc décrit la **dernière page analysée**, pas forcément l'onglet visible :
> le compteur est partagé entre les onglets, et c'est le dernier onglet à avoir
> enregistré une analyse qui s'affiche.

Sur la page de test, après avoir utilisé le flux continu, on doit lire quelque
chose comme :

> 132 bloc(s) de texte analysés · 8 mise(s) à jour dynamique(s) (il y a 2 s).

Sur une page sans contenu dynamique, il s'affiche « page statique » à la place
du nombre de mises à jour : c'est normal.

---

## 4. Protocole B — un site calme (2 minutes)

**But :** vérifier que le surveillant ne dérange pas un site normal.

Exemple : un article de presse (site d'actualités, blog), ou `wikipedia.org`.

| # | Action | Attendu |
|---|---|---|
| 1 | Ouvrir l'article | Aucun changement visible |
| 2 | Faire défiler de haut en bas et remonter | Défilement fluide |
| 3 | Survoler les prix cités dans l'article | Bulle correcte |
| 4 | Ouvrir le popup | Un nombre de blocs analysés, et « page statique » |

**Rien ne doit clignoter, se déplacer, ni changer de couleur.** L'extension ne
modifie jamais le HTML de la page : elle utilise une API du navigateur qui
surligne sans ajouter de balise.

---

## 5. Protocole C — un site agressif (3 minutes)

**But :** le vrai test de performance. C'est ici qu'un mauvais surveillant
s'effondre.

Choisir **un** site à contenu infini (fil d'actualité, place de marché,
galerie) : par exemple la page d'accueil d'un réseau social, une boutique en
ligne, ou une plateforme de vidéos.

1. Ouvrir le **Moniteur d'activité** (`Cmd` + `Espace`, taper « Moniteur
   d'activité »), chercher **Firefox**.
2. Noter la consommation processeur **avant** de faire défiler.
3. Faire défiler **30 secondes** sans s'arrêter.
4. Noter la consommation **pendant** le défilement.
5. Faire défiler encore 30 secondes.

| # | Mesure | Attendu |
|---|---|---|
| 1 | Défilement | Fluide, sans à-coups |
| 2 | Processeur pendant le défilement | Comparable à la même page sans l'extension |
| 3 | Popup, nombre de mises à jour | Un chiffre élevé (dizaines à centaines) : le surveillant travaille |
| 4 | Survol des prix apparus après le scroll | Bulle correcte |

**Critère bloquant :** toute saccade franche, ou un processeur qui reste collé à
100 % après l'arrêt du défilement, invalide l'itération.

**Astuce de comparaison :** ouvrir le même site dans une fenêtre de navigation
privée (où l'extension n'est pas active si elle n'est pas autorisée dans les
fenêtres privées) permet de comparer côte à côte. À défaut, comparer avec la
mesure « avant ».

---

## 6. Si quelque chose ne va pas

Noter le **numéro de point** (1 à 22), puis :

| Symptôme | Ce qu'il faut transmettre |
|---|---|
| Aucun montant ajouté n'est souligné | La console complète (`Cmd` + `Option` + `K`), en particulier la ligne « surveillance du contenu dynamique activee » |
| La ligne « surveillance » n'apparaît jamais | La console complète + la version affichée |
| Ça rame ou ça fige | Le point 9 / 16 / protocole C, et la consommation processeur |
| Un montant s'affiche **deux fois** | Une capture d'écran |
| Le popup dit « Aucune analyse enregistrée » | Ouvrir le popup **après** avoir rechargé la page, puis rappuyer sur l'icône |
| Un montant dans une zone interdite est souligné | Le numéro du point (18, 19 ou 20) |
| Un montant correct n'est **plus** souligné (régression) | Le texte exact + l'URL |

---

## 7. Vérification automatique (sans navigateur)

```bash
cd ~/Documents/UniConv
node tools/dynamic-tests.mjs
```

Sortie attendue :

```
  Resultat : 26 reussi(s), 0 echec(s)
```

Ce fichier vérifie, dans un faux navigateur et avec le vrai code :

- que le surveillant démarre avec les bonnes options ;
- qu'un élément ajouté est analysé, et **pas avant 300 ms** ;
- que dix ajouts simultanés ne déclenchent **qu'un seul** traitement ;
- qu'un texte modifié sur place est réanalysé ;
- qu'un montant qui disparaît est oublié ;
- que `script`, `style`, champ de saisie, zone modifiable et interface interne
  sont ignorés ;
- que 500 éléments passent en moins de 3 secondes ;
- qu'un montant présent dès le chargement dans une zone modifiable est ignoré ;
- qu'une rafale exceptionnelle de 3 500 éléments est traitée malgré le
  plafond de sécurité (relire la page en entier plutôt que d'ignorer des
  éléments) ;
- que les statistiques du popup sont bien publiées.

Pour lancer **toute** la batterie :

```bash
cd ~/Documents/UniConv
for f in run-tests smoke-test background-test audit-tests units-tests \
         currency-meta-tests currency-search-tests dynamic-tests; do
  node tools/$f.mjs | tail -2
done
```

Attendu : 284 vérifications réussies, 0 échec.

---

## 8. Ce que cette itération ne fait **pas**

- Pas de traitement des `iframe` (cadres intégrés).
- Pas d'amélioration des faux positifs : c'est l'itération 7.
- Pas de page d'options complète : c'est l'itération 8.
- Pas d'OCR (lecture d'image) : itérations 9 et 10.
