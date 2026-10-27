# UniConv — Protocole de test de l'Itération 4

> **Document historique.** Ce protocole date de l'itération 4 (devises en
> lettres). Il reste utile, car les tests qu'il décrit doivent continuer à
> fonctionner : c'est la **non-régression**.
>
> Pour les versions courantes, voir :
> - **`docs/TEST-ITERATION-6.md`** — contenu dynamique (itération 6) ;
> - **`docs/FAUX-POSITIFS.md`** — faux positifs, pause, liste noire (itération 7) ;
> - **`docs/IMAGES-ET-OCR.md`** — prix dans les images, et pourquoi l'OCR est
>   un chantier à part (itération 7bis) ;
> - **`docs/PRIX-DECOUPES.md`** — prix coupés en plusieurs balises (Amazon) ;
> - **`docs/OPTIONS.md`** — page de réglages (itération 8) ;
> - **`docs/OCR.md`** — lecture d'un prix dans une image (itération 9).

Ce document explique comment vérifier que l'Itération 4 fonctionne.

**Ce qui a été ajouté à cette itération :** les **devises en lettres** (« dix euros », « ten dollars », « cent cinquante euros »), en français et en anglais. Les vrais taux de change (itération 3) restent actifs. La conversion n'est
plus fictive : l'extension interroge l'API Frankfurter, garde les taux en cache
pendant 12 heures, et continue de fonctionner **sans internet** grâce à ce cache.

**Durée :** environ 10 minutes.

> ⚠️ **Nouveauté importante : l'extension accède maintenant à internet.**
> Elle contacte **un seul serveur** : `api.frankfurter.dev`, pour les taux de la
> Banque centrale européenne. Deux permissions sont demandées :
>
> | Permission | Pourquoi | Ce que ce n'est PAS |
> |---|---|---|
> | `storage` | Garder les taux en cache 12 h | L'accès aux pages visitées |
> | `https://api.frankfurter.dev/*` | Récupérer les taux | Un accès à tout internet |
>
> Aucune donnée personnelle n'est collectée ni envoyée.

---

## Avant de commencer : recharger l'extension

J'ai modifié et ajouté des fichiers. Firefox ne les connaît pas encore.

1. Va sur **`about:debugging#/runtime/this-firefox`**
2. Sur la carte **UniConv**, clique sur le bouton **« Recharger »** (⟳)

> **À retenir :** ce geste sera nécessaire à chaque fois que je modifie un
> fichier. Sans lui, Firefox continue d'utiliser l'ancienne version.

---

## Étape 1 — Lancer le serveur de test

**Pourquoi un serveur ?** L'extension n'est autorisée à s'activer que sur les
pages `http://` et `https://`. Un fichier ouvert directement depuis le disque
(une adresse commençant par `file://`) n'est pas analysé. Il faut donc servir le
dossier du projet en `http`.

**Comment faire, sans rien installer :**

1. Ouvre l'application **Terminal** (cherche « Terminal » avec `Cmd` + `Espace`)
2. Copie-colle cette ligne, puis appuie sur Entrée :

   ```
   cd ~/Documents/UniConv && python3 -m http.server 8123
   ```

3. Tu dois voir apparaître :

   ```
   Serving HTTP on 0.0.0.0 port 8123 (http://0.0.0.0:8123/) ...
   ```

**Laisse cette fenêtre ouverte.** C'est elle qui fait tourner le serveur. Pour
l'arrêter plus tard, reviens dans cette fenêtre et appuie sur `Ctrl` + `C`.

> **Qu'est-ce qu'un serveur local ?** Un petit programme qui rend les fichiers
> de ton dossier accessibles à ton navigateur, comme s'il s'agissait d'un site
> web. Rien ne sort de ton ordinateur : l'adresse `localhost` désigne ta propre
> machine.

---

## Étape 2 — Vérifier que les taux sont chargés

Ouvre **`http://localhost:8123/test/formats.html`** dans un onglet neuf, puis
`Cmd` + `Option` + `K` pour la console de la page.

Tu dois voir :

```
[UniConv] content.js 0.5.0 charge sur http://localhost:8123/test/formats.html
[UniConv] analyse terminee : 32 montant(s) dans ... bloc(s) de texte
```

**Puis ouvre la console du NAVIGATEUR : `Cmd` + `Shift` + `J`**, et cherche
`UniConv` dans le filtre. Tu dois voir :

```
[UniConv] arriere-plan demarre — version 0.4.1
[UniConv] telechargement des taux depuis https://api.frankfurter.dev/v1/latest?base=EUR
[UniConv] taux recuperes : 31 devises, date 2026-...
```

**Si tu vois la ligne `taux recuperes` : l'API fonctionne.**

---

## Étape 3 — Ouvrir la page de test

Dans Firefox, ouvre un nouvel onglet et va à l'adresse :

```
http://localhost:8123/test/formats.html
```

Tu dois voir un tableau avec trois sections numérotées.

**Vérification du chargement :** ouvre la console du navigateur
(`Cmd` + `Shift` + `J`) et cherche la ligne :

```
[UniConv] analyse terminee : 32 montant(s) dans ... bloc(s) de texte
```

- Si tu vois cette ligne : **le moteur fonctionne et a trouvé 32 montants.**
- Si le nombre est très différent (0, ou 3), dis-le moi : c'est une information
  précieuse.
- Si tu ne vois **aucune** ligne `[UniConv]` : l'extension n'est pas active sur
  cette page. Vérifie que l'adresse commence bien par `http://localhost`.

> **Pourquoi 16 et non 26 ?** La page contient bien 26 lignes de test, mais
> 10 d'entre elles sont soit des pièges (qui ne doivent rien déclencher), soit
> du texte présenté dans un bloc de code, que le moteur ignore volontairement.
> Le décompte exact a été vérifié en analysant le fichier automatiquement.

---

## Étape 4 — Le test principal : une conversion réelle

Dans la **section 1 « Doivent être détectés »**, promène la souris sur les
textes, un par un. À chaque fois, deux choses doivent se produire :

1. **Le montant se souligne en pointillés fins** (bleu-gris discret).
2. **Une bulle bleue apparaît** avec un texte du genre :

   ```
   10,00 € = 11,00 USD  (valeur de test)
   ```

**Les 12 lignes de la section 1 doivent toutes réagir.**

### Comment lire la bulle

La bulle doit afficher quelque chose comme :

```
10,00 € = 11,19 USD
1 EUR = 1,1193 USD
```

**Deux lignes :** la conversion en premier (la plus grosse), le taux appliqué
en second (plus discret).

| Partie affichée | Signification |
|---|---|
| `10,00 €` | Le montant tel qu'il a été compris |
| `11,19 USD` | La valeur convertie avec le **taux réel** |
| `1 EUR = 1,1193 USD` | Le taux utilisé, pour que tu puisses le vérifier |

> **La date n'apparaît plus dans la bulle** (version 0.4.1). Elle était trop
> longue et sortait de la bulle, devenant illisible. Elle reste consultable
> dans le popup de l'extension.

**Vérification indépendante :** cherche « cours euro dollar » sur un moteur de
recherche. Le taux doit être **proche** (à quelques centièmes près).

**Le point le plus important à vérifier :** pour la ligne 7
(`1 234,56 €`), la bulle doit afficher **`1 234,56 €`**, et non `1 234,00 €` ou
`234,56 €`.

---

## Étape 4 — Le test des faux positifs

Dans la **section 2 « Ne doivent PAS être détectés »**, survole les 8 lignes.

**Aucune bulle ne doit apparaître. Aucun soulignement non plus.**

C'est le test le plus important après le premier : une extension qui convertit
tout et n'importe quoi devient insupportable. Si une seule de ces 8 lignes
réagit, **c'est un bug à me signaler** — avec son numéro.

---

## Étape 5 — Les cas particuliers

Dans la **section 3**, vérifie trois choses :

| # | Ce que tu survoles | Attendu |
|---|---|---|
| 1 | `Le prix est de 10€ aujourd'hui.` | Seul `10€` réagit, pas le reste de la phrase |
| 2 | `De 5€ à 10€ seulement.` | **Les deux** montants réagissent séparément |
| 3 | `Ce texte ne contient aucun montant.` | Rien ne réagit |

---

## Étape 6 — Le test sur un vrai site

La page de test est propre et facile. Le vrai web l'est beaucoup moins.

1. Va sur **`https://fr.wikipedia.org`**
2. Cherche un article contenant des prix ou des montants (par exemple un article
   sur une entreprise, un pays, un film)
3. Survole les montants

**Attendu :** les montants en euros réagissent, le reste de la page reste
parfaitement normal.

**Point de vigilance :** la mise en page du site ne doit **pas** changer. Si un
élément se déplace, si un texte change de couleur ou si un bouton disparaît,
c'est grave — signale-le moi immédiatement avec une capture d'écran.

---

## Étape 5 — Le mode hors ligne (le test décisif)

C'est la raison d'être du cache.

1. **Débranche le Wi-Fi** (ou désactive-le dans le menu du Mac)
2. **Recharge la page** de test (`Cmd` + `R`)
3. Survole `10 €`

**Attendu :** la bulle affiche **quand même** une conversion.

> 💡 Ne recharge pas l'extension avant ce test : cela viderait la mémoire des
> taux. Le cache disque, lui, persiste.

4. **Rebranche le Wi-Fi.**

**Si tu vois « conversion indisponible »** alors qu'un taux avait déjà été
chargé, c'est un bug du cache : signale-le moi.

---

## Étape 6 — Un seul appel réseau

1. Ouvre l'onglet **Réseau** (`Cmd` + `Option` + `E`)
2. Filtre sur `frankfurter`
3. Recharge la page de test
4. Survole **cinq montants différents**

**Attendu : au maximum un appel** à `api.frankfurter.dev`. Pas cinq.

Si tu vois plusieurs appels, le cache ne fonctionne pas.

---

## Étape 7 — Le popup

Clique sur l'icône `€|$`.

Tu dois voir un bloc **« Taux de change »** avec :

- la **date** des taux,
- le nombre de **devises** disponibles,
- la mention `mis a jour a l'instant` (ou `il y a X min`),
- un bouton **« Rafraichir les taux »**.

Clique sur le bouton : il doit se désactiver le temps du chargement, puis
revenir à son état normal.

---

## Récapitulatif des points de contrôle

| # | Où | Attendu |
|---|---|---|
| 1 | Console navigateur | `taux recuperes : 31 devises` |
| 2 | Bulle sur `10 €` | Un montant en USD **proche du taux réel** |
| 3 | Bulle sur `10 €` | Le taux et la date s'affichent |
| 4 | Bulle sur `100 JPY` | Conversion plausible (taux croisé) |
| 5 | Wi-Fi coupé + rechargement | La conversion **fonctionne encore** |
| 6 | Onglet Réseau | Un seul appel à Frankfurter |
| 7 | Popup | Date, nombre de devises, bouton fonctionnel |

---

## Si quelque chose ne marche pas

### Aucune bulle n'apparaît nulle part

**À vérifier toi-même, dans l'ordre :**
1. L'extension a-t-elle bien été **rechargée** (`about:debugging` → Recharger) ?
2. L'adresse de la page commence-t-elle par **`http://localhost`** ?
3. Le serveur tourne-t-il toujours dans le Terminal ?
4. La console (`Cmd` + `Shift` + `J`) affiche-t-elle une ligne rouge ?

**À me transmettre :** la réponse aux 4 questions, et toute ligne rouge en entier.

### Une bulle apparaît, mais au mauvais endroit

**À me transmettre :** une capture d'écran de la page avec la bulle visible, et
l'adresse de la page.

### La page du site est cassée (texte déplacé, couleur changée)

**C'est le scénario le plus grave.** J'ai conçu l'extension pour qu'elle ne
touche jamais au contenu des pages — si ce n'est pas le cas, il y a un vrai bug.

**À me transmettre :** capture d'écran + adresse de la page.

### Le soulignement en pointillés n'apparaît pas

**Ce n'est pas forcément un bug.** Le soulignement utilise une technologie
récente (« CSS Custom Highlight ») qui n'existe pas dans tous les navigateurs.
Si la bulle s'affiche mais pas les pointillés, dis-le moi : je saurai si tu as
la bonne version de Firefox.

**À me transmettre :** le résultat de la commande suivante, tapée dans la
console de la page (`Cmd` + `Option` + `K`) :

```js
typeof Highlight !== 'undefined'
```

Réponse attendue : `true` (la technologie est disponible) ou `false`.

### La ligne rouge apparaît dans la console

**À me transmettre :** la ligne complète, copiée telle quelle, avec le nom de
fichier et le numéro de ligne.

---

## Ce que cette itération ne fait PAS

- ❌ Pas de choix de la devise cible (fixée au dollar → itération 8)
- ❌ Pas de devises écrites en lettres (« dix euros » → itération 4)
- ❌ Aucune unité de mesure (km, kg, °C → itération 5)
- ❌ Pas de contenu dynamique (scroll infini, React → itération 6)
- ❌ Pas de MAD, TND, XOF : l'API Frankfurter ne les fournit pas
- ❌ Aucune OCR (itérations 9 et 10)

**Si tu observes l'un de ces comportements, c'est normal** — ce n'est pas un bug.

---

## Pour les curieux : vérifier sans navigateur

Le projet contient un outil qui teste le moteur de détection directement, en
ligne de commande. Pratique pour vérifier après une modification :

```
cd ~/Documents/UniConv
node tools/run-tests.mjs        # 54 vérifications — reconnaissance des devises
node tools/smoke-test.mjs       # 29 vérifications — exécution, souris, grands nombres
node tools/background-test.mjs  # 27 vérifications — 3 sources, cache, pannes
node tools/currency-meta-tests.mjs # 12 vérifications — noms et drapeaux
node tools/currency-search-tests.mjs # 29 vérifications — recherche par pays
```

**Le troisième est nouveau à cette itération.** Il simule une API en panne, un
cache périmé, et vérifie que les taux croisés sont justes — ce qui permet de
tester « sans internet » sans réellement couper internet.
