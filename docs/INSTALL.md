# UniConv — Guide d'installation et de test (Itération 0)

Ce document explique comment installer l'extension dans Firefox et vérifier
qu'elle fonctionne. Aucune connaissance technique n'est nécessaire : il suffit
de suivre les étapes dans l'ordre.

**Durée :** environ 5 minutes.

---

## Avant de commencer : à quoi s'attendre

À ce stade (itération 0), l'extension **ne convertit encore rien**. Elle sert
uniquement à prouver que la chaîne complète fonctionne :

- le navigateur sait lire le dossier du projet,
- les fichiers sont bien formés,
- le script qui vit dans les pages web s'exécute,
- le script d'arrière-plan s'exécute,
- la petite fenêtre au clic sur l'icône s'affiche.

Si ces cinq points sont validés, tout le reste du projet peut s'appuyer dessus.

---

## Étape 1 — Où se trouve le projet

Le dossier du projet est :

```
<dossier du projet>
```

**Le fichier que Firefox va te demander de sélectionner est `manifest.json`**,
à la racine de ce dossier. Ce n'est pas le dossier entier : Firefox veut
précisément ce fichier.

Pour le trouver dans le Finder :
1. Ouvre le Finder.
2. Va dans `Documents` → `UniConv`.
3. Tu dois y voir : `manifest.json`, `icons`, `src`, `docs`, `tools`.

> **Qu'est-ce qu'un manifeste ?** C'est la carte d'identité de l'extension :
> un fichier texte qui déclare son nom, sa version, et la liste des fichiers
> qu'elle utilise. Sans lui, le navigateur ne sait rien faire.

---

## Étape 2 — Ouvrir la page des extensions de développement

1. Dans Firefox, clique dans la barre d'adresse en haut.
2. Tape exactement :

   ```
   about:debugging#/runtime/this-firefox
   ```

3. Appuie sur Entrée.

Cette page n'existe pas sur le web : c'est une page interne de Firefox, réservée
aux extensions en cours de développement. C'est normal qu'elle ait un aspect
différent des autres sites.

Tu dois voir une page intitulée **« Débogage des extensions »** avec un bloc
**« Extensions temporaires »** et un bouton **« Charger un module
complémentaire temporaire… »**.

---

## Étape 3 — Charger l'extension

1. Clique sur **« Charger un module complémentaire temporaire… »**.
2. Une fenêtre de sélection de fichier s'ouvre.
3. Navigue jusqu'à `Documents` → `UniConv`.
4. Sélectionne le fichier **`manifest.json`**.
5. Clique sur **Ouvrir**.

**Ce que tu dois voir immédiatement :** une nouvelle carte apparaît dans la
liste, avec le nom **UniConv**, un identifiant, et un bouton **Inspecter**.

### À savoir : l'extension est temporaire

Avec cette méthode, **l'extension disparaît quand tu fermes Firefox.** Ce n'est
pas un bug : Firefox refuse d'installer définitivement une extension non signée.
Il faudra donc refaire les étapes 2 et 3 à chaque nouvelle session de travail.
Cela prend 30 secondes, et c'est le prix à payer pour pouvoir modifier le code
librement.

---

## ⚠️ Le piège des copies multiples (à lire une fois, il fait perdre des heures)

**Symptôme :** tu modifies un fichier, tu recharges l'extension, et rien ne
change dans le navigateur. Pire : l'ancien comportement persiste alors que le
fichier a bien été modifié sur le disque.

**Cause :** Firefox garde en mémoire **plusieurs copies** de la même extension
quand elle est chargée plusieurs fois. Il les reconnaît à leur identifiant (ici
`uniconv@hamidaouladyoussef.local`). Le message suivant apparaît alors dans la
console du navigateur (`Cmd` + `Shift` + `J`) :

```
Addon with ID uniconv@hamidaouladyoussef.local already installed,
older version will be disabled
```

Le plus vicieux : **il peut arriver que la nouvelle copie soit chargée (le popup
affiche la bonne version) alors que c'est l'ancienne qui injecte ses scripts
dans les pages web.** On croit donc tester le nouveau code, alors qu'on teste
l'ancien. C'est exactement ce qui s'est produit lors de l'itération 1.

### La procédure de nettoyage complète

À faire dès que quelque chose d'inexpliqué se produit :

1. `about:debugging#/runtime/this-firefox`
2. Sur la carte **UniConv**, clique sur **Supprimer** (`Remove`)
3. **Vérifie que la carte a bien disparu** de la liste
4. **Quitte Firefox complètement** (`Cmd` + `Q`)
5. Rouvre Firefox
6. Recharge l'extension : **Charger un module complémentaire temporaire…** →
   `Documents` → `UniConv` → **`manifest.json`**

### Comment vérifier que c'est bien la bonne version qui tourne

L'extension affiche son numéro de version à **trois endroits**. Les trois
doivent indiquer la même chose :

| Où regarder | Ce que tu dois voir |
|---|---|
| Clic sur l'icône → petite fenêtre | `version 0.2.0` |
| Carte UniConv sur `about:debugging` | `0.2.0` |
| Console de la page (`Cmd` + `Option` + `K`) | `[UniConv] content.js 0.2.0 charge sur https://...` |

Si ces trois numéros diffèrent, c'est qu'une ancienne copie traîne : refais la
procédure de nettoyage ci-dessus.

---

## Étape 4 — Vérifier que le script d'arrière-plan parle

> **Correction du 14/10 — erreur de ma part.** La première version de ce guide
> indiquait de cliquer sur le bouton « Inspecter » de la carte UniConv.
> **C'était faux.** Dans Firefox récent, ce bouton ouvre les outils de
> développement sur les *pages* de l'extension (le popup, la future page
> d'options), et non sur le script d'arrière-plan. On y voit d'ailleurs le
> message « Your addon does not have any document opened yet » — normal et sans
> gravité.
>
> Le script d'arrière-plan écrit dans la **Console du navigateur**, qui est
> distincte de la console d'une page web.

1. Appuie sur **`Cmd` + `Shift` + `J`** (Majuscule puis J).
2. Une fenêtre s'ouvre, avec un fond sombre : c'est la Console du navigateur.
3. Dans la barre de recherche en haut de cette fenêtre, tape `UniConv` pour
   filtrer.
4. Cherche la ligne :

   ```
   [UniConv] arriere-plan demarre — version 0.0.1
   ```

Si tu vois cette ligne : **le script d'arrière-plan fonctionne.**

> **Les deux consoles, à ne plus confondre :**
> - `Cmd + Option + K` = console **de la page web** que tu regardes.
> - `Cmd + Shift + J` = console **du navigateur**, qui voit l'extension
>   elle-même.
>
> Cette distinction existe dans Firefox mais pas dans Chrome. Si cette étape te
> paraît obscure, ce n'est pas grave : **l'étape 6 vérifie exactement la même
> chose en un clic sur l'icône**, et c'est même un test plus fiable, puisqu'il
> prouve que l'arrière-plan non seulement démarre, mais qu'il répond.

---

## Étape 5 — Vérifier que le script dans les pages parle

1. Ouvre un nouvel onglet et va sur `https://fr.wikipedia.org`.
2. Appuie sur **`Cmd` + `Option` + `K`** (les trois touches en même temps).
3. Un panneau s'ouvre en bas de la fenêtre : c'est la console de la page.
4. Cherche la ligne :

   ```
   [UniConv] Hello depuis https://fr.wikipedia.org/wiki/Wikipédia — content script actif, version 0.0.1
   ```

Si tu vois cette ligne : **le script s'injecte bien dans les pages web.** C'est
le point le plus important de cette itération, car toute la détection de
montants reposera dessus.

> **Pourquoi `Cmd + Option + K` et non F12 ?** Sur un Mac, la touche F12 est
> souvent réglée sur une fonction système (volume, Mission Control) et ne fait
> rien pour Firefox. Le raccourci `Cmd + Option + K` ouvre directement la
> console.

---

## Étape 6 — Vérifier l'icône et la petite fenêtre

1. Dans la barre d'outils de Firefox, cherche l'icône bleue avec `€|$`.
   Si tu ne la vois pas : clique sur l'icône en forme de puzzle à droite de la
   barre d'adresse, puis sur la petite punaise à côté de **UniConv** pour
   l'épingler.
2. Clique sur l'icône.
3. Une petite fenêtre s'ouvre. Tu dois y lire :
   - le titre **UniConv** et **version 0.0.1**,
   - la ligne **Arrière-plan : actif — iteration 0 — installation validee**.

Cette dernière ligne est importante : elle prouve que la petite fenêtre et le
script d'arrière-plan **communiquent entre eux**. C'est une brique dont on aura
besoin à l'itération 3 pour aller chercher les taux de change.

---

## Récapitulatif : les 6 points de contrôle

| # | Où | Ce que tu dois voir |
|---|---|---|
| 1 | `about:debugging` | La carte UniConv apparaît sans erreur rouge |
| 2 | Console du navigateur (`Cmd + Shift + J`) | `[UniConv] arriere-plan demarre` |
| 3 | Console d'une page web (`Cmd + Option + K`) | `[UniConv] Hello depuis https://...` |
| 4 | Barre d'outils | L'icône bleue `€\|$` est visible |
| 5 | Clic sur l'icône | La petite fenêtre s'ouvre |
| 6 | Contenu de la fenêtre | `Arrière-plan : actif` |

**Les 6 points validés = itération 0 réussie.**

---

## Si quelque chose ne marche pas

### Firefox refuse le fichier

**Symptôme :** un message rouge apparaît, ou rien ne se passe après avoir
choisi `manifest.json`.

**À me transmettre :** le texte du message, en entier, tel qu'il s'affiche.

### Une fenêtre « Web Extension Fallback Document » s'ouvre

**Symptôme :** après avoir cliqué sur « Inspecter » sur la carte UniConv, une
fenêtre s'ouvre avec le texte *« Your addon does not have any document opened
yet »*.

**Ce n'est pas une erreur.** C'est le comportement normal de Firefox : cette
fenêtre sert à inspecter les pages de l'extension (le popup, la page d'options),
et à cet instant aucune n'est ouverte. Pour les messages de l'arrière-plan, il
faut la Console du navigateur (`Cmd + Shift + J`). Voir l'étape 4.

### Rien dans la Console du navigateur

**Symptôme :** tu ouvres `Cmd + Shift + J` et tu ne trouves aucune ligne
`[UniConv]`.

**À vérifier toi-même :** dans la barre de filtres de cette console, assure-toi
que le niveau **Info** (ou **Tous**) est activé et que la recherche est vide.
Les messages normaux sont masqués quand seuls les niveaux `Erreurs` ou
`Avertissements` sont cochés.

**Solution de repli :** passe directement à l'étape 6 (clic sur l'icône). La
ligne `Arrière-plan : actif` prouve la même chose, et de façon plus fiable.

### Rien dans la console d'une page web

**Symptôme :** tu ouvres `Cmd + Option + K` sur Wikipédia et il n'y a aucune
ligne `[UniConv]`.

**À me transmettre :**
- l'adresse complète de la page où tu as testé,
- une capture d'écran de la console.

**Point à vérifier toi-même avant de m'écrire :** dans la console, une barre de
filtres propose souvent `Erreurs`, `Avertissements`, `Info`. Vérifie que le
niveau **Info** ou **Tous** est activé — sinon les messages normaux sont masqués.

### La ligne apparaît en rouge

**Symptôme :** un message rouge avec un nom de fichier comme `content.js:42`.

**À me transmettre :** la ligne rouge complète, copiée telle quelle. Ne cherche
pas à la comprendre et ne la corrige pas : c'est mon travail.

### L'icône est introuvable

**Symptôme :** pas d'icône bleue dans la barre d'outils.

**À me transmettre :** une capture d'écran de la barre d'outils, et confirme
moi si la carte UniConv est bien présente sur `about:debugging`.

### La petite fenêtre est vide ou blanche

**Symptôme :** un rectangle blanc s'ouvre au clic sur l'icône.

**À me transmettre :** fais un clic droit dans le rectangle blanc → **Inspecter**,
puis copie-moi la console qui s'ouvre.

---

## Ce que cette itération ne fait PAS

Pour éviter de chercher au mauvais endroit :

- Aucun montant n'est détecté ni converti.
- Aucune bulle n'apparaît au survol.
- Aucun appel à internet n'est effectué.
- La page d'options n'existe pas encore.
- Le fichier `styles.css` n'existe pas encore (il arrive à l'itération 1).

**Si tu observes l'un de ces comportements, c'est anormal** — signale-le moi.
