# UniConv — lire un texte dans une image (OCR)

**Itération 9, interface revue : le rectangle se dessine SUR la page et le
résultat s'affiche dans une bulle.** Version 0.18.0.

---

## 1. Le parcours, en 4 étapes

| Étape | Ce qui se passe |
|---|---|
| 1 | Clic sur l'icône UniConv → bouton **« Dessiner une zone à lire »** |
| 2 | Un **voile sombre** apparaît sur la page |
| 3 | Vous **dessinez un rectangle** autour du texte (Échap pour annuler) |
| 4 | Le **texte reconnu apparaît dans la bulle**, sur la page, avec la conversion |

Plus de nouvel onglet, plus de photo séparée : tout se passe là où vous
regardez.

---

## 2. La bulle OCR est IDENTIQUE à celle d'un clic sur du texte

À partir de 0.22.0, une conversion issue de l'OCR se comporte **exactement**
comme un clic sur un montant de la page :

| Élément | Présent |
|---|---|
| ligne principale = la **conversion** (`679,99 € = 739,21 $`) | ✅ |
| ligne secondaire = le **taux** (`1 EUR = 1,08 USD`) | ✅ |
| **menu de choix de la devise cible** (recherche, drapeaux, épinglage) | ✅ |
| **poignée de redimensionnement** | ✅ |
| bulle **figée** (elle reste jusqu'au clic suivant) | ✅ |

C'est **le même chemin de code** que le clic : le montant reconnu a exactement
la même forme qu'un montant détecté dans la page. Les deux ne peuvent donc pas
diverger — et tout ce qui est ajouté au menu (aujourd'hui ou plus tard) profite
automatiquement à l'OCR.

Le **texte reconnu** n'encombre plus la bulle : il est écrit dans la console
(`[UniConv] OCR : « 679€99 »`) et visible dans l'onglet du moteur.

| Cas | Bulle |
|---|---|
| Aucun montant dans le texte | le texte reconnu + « aucun montant reconnu dans ce texte » (pas de menu, il n'y aurait rien à convertir) |
| Texte vide | « Aucun texte reconnu » |
| Conversion refusée par l'arrière-plan | le montant + **la raison** (`pas de taux disponible…`) |

La bulle est **figée** : elle reste affichée le temps que vous la lisiez, et se
ferme au clic suivant.

---

## 3. Où tourne le moteur (et pourquoi c'est important)

| Élément | Rôle |
|---|---|
| **La page** (`src/content.js`) | dessine le voile et le rectangle, affiche la bulle |
| **L'arrière-plan** (`src/background.js`) | photographie l'onglet, découpe la zone, coordonne |
| **L'onglet moteur** (`src/engine.html`) | fait tourner Tesseract.js |

### Pourquoi le moteur n'est ni dans la page, ni dans l'arrière-plan

**Pas dans la page** : une page web a sa propre politique de sécurité (CSP), qui
bloque WebAssembly (le cœur du moteur).

**Pas dans l'arrière-plan** : le script d'arrière-plan de Firefox est une *page
d'événement*, **déchargée dès qu'elle est inactive**. Une lecture de 1 à 5
secondes pouvait être interrompue en cours de route, sans message — c'est
exactement le défaut corrigé en 0.18.0.

**Dans un onglet dédié** : une page d'extension reste vivante tant qu'elle
existe. L'onglet est ouvert **en arrière-plan** (il ne vole jamais le focus),
réutilisé d'une lecture à l'autre, et refermé après deux minutes d'inactivité.
Vous ne le voyez que dans la barre d'onglets.

---

## 4. Ce que la lecture fait techniquement

1. **Capture** de l'onglet visible (`captureVisibleTab`).
2. **Découpe** de la zone dessinée, en tenant compte de la densité de l'écran
   (sur un écran Retina, 1 pixel CSS = 2 pixels réels).
3. **Agrandissement ×2** (plafonné à 2 400 px de côté).
4. **Niveaux de gris** avec un léger contraste : l'OCR lit mieux du texte net.
5. **Lecture** par Tesseract.js (français + anglais).
6. **Détection** des montants dans le texte reconnu, par les moteurs habituels
   (donc les 13 règles anti-faux-positifs s'appliquent aussi).

---

## 5. Le coût, dit franchement

| Élément | Taille |
|---|---|
| Moteur (bibliothèque + worker) | 190 Ko |
| Cœur WebAssembly | 4,6 Mo |
| Modèles français + anglais | 3,6 Mo |
| **Total ajouté à l'extension** | **≈ 8,2 Mo** |

**Aucun envoi sur Internet** : tout est dans l'extension, et un test automatique
vérifie qu'aucune adresse réseau n'a été ajoutée pour l'OCR.

---

## 6. Les limites, sans enrobage

| Cas | Résultat attendu |
|---|---|
| `Prix : 54,00 €` en texte net | ✅ très fiable |
| `679€99` (centimes en exposant, mis à plat) | ✅ reconnu → 679,99 € (depuis 0.21.0) |
| `54` en gros avec `00` en **exposant** (style Amazon) | ⚠️ souvent mal lu |
| Texte manuscrit, police décorative, photo floue | ❌ ou très approximatif |
| Zone de moins de 12 × 12 px | ❌ refusée (« zone trop petite ») |
| Zone sans texte | ⚠️ « Aucun texte reconnu » |

**Conseil :** sélectionnez la zone la plus **serrée** possible autour du prix,
symbole et centimes inclus.

---

## 7. Protocole de test (5 minutes)

### 7.1 Préparer

1. **Recharger** l'extension (`about:debugging` → Recharger).
2. Ouvrir `http://localhost:8123/test/formats.html`.

### 7.2 Le test principal

| # | Action | Attendu |
|---|---|---|
| 1 | Icône → **« Dessiner une zone à lire »** | La page se couvre d'un voile sombre, avec la consigne en haut |
| 2 | Dessiner un rectangle autour de `10 €` | Le cadre bleu suit la souris, le reste est assombri |
| 3 | Relâcher | Le voile disparaît, puis la bulle s'ouvre sous la zone |
| 4 | Lire la bulle | Ligne 1 : le texte reconnu. Ligne 2 : la conversion |
| 5 | Cliquer ailleurs | La bulle se ferme |

### 7.3 Les cas limites

| # | Action | Attendu |
|---|---|---|
| 6 | Appuyer sur Échap pendant la sélection | Le voile disparaît, aucune lecture |
| 7 | Dessiner un rectangle de 5 × 5 px | « Zone trop petite », le voile reste ouvert |
| 8 | Sélectionner une zone sans texte | « Aucun texte reconnu » |
| 9 | Sélectionner un texte contenant `version 1.2.3` | « aucun montant reconnu » (faux positif filtré) |
| 10 | Cliquer sur l'icône depuis une page **non rechargée** depuis l'installation | « Page non prête : rechargez-la (Cmd+R) » |
| 11 | Mettre l'extension en pause (case « Activer la detection » du popup), puis cliquer sur le bouton Scan | Un message visible : « UniConv est en pause… » |
| 11bis | **Sélectionner une zone minuscule** autour du seul prix | La lecture doit réussir : la bulle n'apparaît qu'**après** la photo |
| 12 | Cliquer sur le bouton **Scan** du popup | Le voile apparaît directement |

### 7.4 Le test du moteur, en un clic

Réglages → **« Tester le moteur OCR »**. Attendu :

> *Moteur opérationnel — lu : « 54,00 EUR » (attendu « 54,00 EUR »),
> confiance 9x %, 0,x s.*

Si ce test échoue, le problème vient du moteur, pas de la capture ni du voile :
le message d'erreur exact s'affiche dans les réglages.

**Si ce test réussit mais qu'une lecture de page échoue**, ouvrez l'onglet
« UniConv — moteur OCR » (il reste ouvert 2 minutes après une lecture) : il
montre **« Dernière zone reçue »**, l'image exactement telle qu'elle a été
analysée. C'est la preuve visuelle que le problème est dans la découpe.

### 7.5 Vérification automatique

```bash
cd ~/Documents/UniConv
node tools/ocr-tests.mjs        # 44 / 44
node tools/dynamic-tests.mjs    # 102 / 102
```

`dynamic-tests.mjs` simule **tout le parcours** : le message du popup, le voile,
le glissement de souris, la demande envoyée à l'arrière-plan (avec le bon
rectangle et la bonne densité d'écran), puis la bulle contenant le texte
reconnu et sa conversion. Il vérifie aussi Échap et le refus des zones trop
petites.

---

## 8. En cas de problème

| Symptôme | À transmettre |
|---|---|
| Le voile n'apparaît pas | Le message affiché dans le popup + l'URL (page rechargée ?) |
| « Page non prête » | Recharger la page : le script n'y était pas encore |
| « OCR impossible (…) » | Le message complet : il indique l'**étape** et la **cause** |
| Le texte est mal reconnu | Une capture de la zone sélectionnée |
| La conversion ne s'affiche pas | Le texte de la bulle (première ligne) |

Les erreurs du moteur sont aussi écrites dans la **console de l'arrière-plan**
(`Cmd` + `Shift` + `J`), avec les chemins et la cause exacte.

### Corrigé en 0.22.0 : l'OCR était « isolé » des autres fonctionnalités

**Symptôme :** la bulle OCR affichait une conversion, mais **sans le menu des
devises** — impossible de choisir une autre monnaie, de redimensionner, bref
d'utiliser l'extension comme d'habitude.

**La cause :** la bulle OCR était dessinée par un chemin **séparé**, qui
n'ajoutait ni le menu ni la poignée de redimensionnement.

**Le correctif :** l'OCR emprunte désormais **le même chemin qu'un clic** sur
un montant de la page (`showTooltip` avec la bulle figée). Le montant reconnu a
la même forme qu'un montant détecté, donc rien n'a été dupliqué — tout ce qui
existe pour le clic vaut maintenant pour l'OCR.

> **La leçon :** deux chemins d'affichage pour la même information finissent
> toujours par diverger. Un seul chemin, deux entrées.

### Corrigé en 0.21.0 : « aucun montant reconnu » sur `679€99`

**Symptôme :** le texte était parfaitement lu (`679€99`), mais la bulle
répondait « aucun montant reconnu dans ce texte ».

**La cause :** ce n'est pas un défaut de l'OCR, mais du **détecteur**. Certains
sites affichent les centimes en exposant : `679 € 99` devient alors, une fois
le texte à plat, **`679€99`**. Or ce format n'était pas reconnu :

| Tentative du détecteur | Pourquoi elle échoue |
|---|---|
| `679 €` (nombre puis symbole) | le symbole est suivi de `99` → refusé |
| `€99` (symbole puis nombre) | le symbole est précédé de `679` → refusé |

Le montant n'existait donc dans aucun des deux sens.

**Le correctif :** un **troisième motif** a été ajouté : nombre + symbole +
centimes. `679€99` vaut 679,99 ; `12€50` vaut 12,50 ; `1 234€56` vaut 1 234,56.
Les cas ambigus sont refusés : `679€9` (un seul chiffre), `679€999` (trois
chiffres), `679,50€99` (déjà décimal).

> **La leçon :** quand « ça lit bien mais ça ne convertit pas », le défaut est
> dans le **détecteur**, pas dans l'OCR. Le texte affiché était le bon — c'était
> la preuve que le problème était ailleurs.

### Corrigé en 0.20.0 : conversion absente, et texte du moteur incohérent

Trois défauts signalés par l'utilisateur, tous réels :

| Symptôme | Cause | Correctif |
|---|---|---|
| La bulle **réaffichait le prix lu**, sans conversion | la conversion était placée en **seconde** ligne (peu visible) et **sa raison d'échec était masquée** : en cas de refus de l'arrière-plan, la bulle semblait juste répéter le prix | la **conversion devient la ligne principale** ; en cas d'échec, la **raison** est affichée ; un **second essai** est fait après 0,4 s |
| L'onglet moteur montrait une image mais un **texte totalement différent** | le champ « Dernier texte reconnu » n'était mis à jour que par le **bouton de test**, jamais lors d'une lecture réelle : il gardait le texte du dernier test | toute lecture met désormais à jour l'aperçu **et** le texte |

> **La leçon (encore une) :** une information affichée à côté d'une autre doit
> être mise à jour **ensemble**. Ici, l'aperçu suivait la réalité et le texte
> restait figé : le diagnostic visuel que j'avais ajouté devenait lui-même
> trompeur.

### Bug corrigé en 0.19.0 : « la bulle se fait photographier » (le vrai défaut)

**Symptôme :** en sélectionnant une petite zone autour du prix, la lecture
échouait. En sélectionnant une **grande** zone, elle fonctionnait.

**La cause — trouvée par l'utilisateur :** la bulle « Lecture de la zone… »
s'affichait **avant** la prise de vue. Sur une petite zone, elle **recouvrait
exactement le prix** : l'OCR photographiait donc la bulle au lieu du prix. Sur
une grande zone, la bulle ne cachait qu'une partie, et le texte restait
lisible — d'où l'impression que « ça marche parfois ».

**Le correctif — l'ordre des opérations est inversé :**

```
1. retirer le voile ET toute bulle
2. attendre le repeint (2 images + 70 ms)
3. photographier la zone              ← écran propre
4. afficher « Lecture de la zone… »   ← seulement maintenant
5. faire lire, puis afficher le résultat
```

Pour cela, la demande a été **coupée en deux messages** : `ocr-capture` (photo
immédiate) puis `ocr-recognize` (lecture). L'image reste dans l'arrière-plan
entre les deux, elle ne repasse pas par la page.

> **La leçon :** ici, c'est l'**interface qui gênait la mesure**. Tout retour
> visuel affiché avant une capture fausse la capture. Le test automatique
> vérifie désormais qu'**aucune bulle n'est visible au moment de la photo** —
> il aurait échoué avant ce correctif.

### Bug corrigé en 0.18.1 : « aucun texte reconnu », même sur du texte net

**Symptôme :** la zone était bien dessinée, mais le moteur ne rendait rien —
ni sur du texte de page, ni sur du texte dans une image.

**Deux causes cumulées, toutes deux dans le passage de l'image au moteur :**

| Cause | Pourquoi ça échouait | Correctif |
|---|---|---|
| **Échelle de découpe supposée** | On multipliait les coordonnées par `devicePixelRatio`. Or la capture ne fait pas toujours cette taille (zoom de page, capture réduite, Retina). La zone découpée tombait **à côté** du texte → image vide → « aucun texte reconnu » | L'échelle est désormais **calculée** : `largeur réelle de la capture ÷ largeur du viewport` |
| **Image passée en chaîne** | Le moteur recevait une chaîne `data:` et devait la décoder lui-même. Ce chemin est fragile | Le moteur **décode l'image en canvas** (chemin maîtrisé) avant de la lire |

**Un diagnostic visuel a été ajouté :** l'onglet du moteur affiche maintenant
**« Dernière zone reçue »** — l'image exacte qu'il a analysée. Si cette image ne
montre pas le texte attendu, le problème est dans la **découpe**, pas dans le
moteur. En cas d'échec, la bulle affiche aussi les dimensions réellement
analysées (`zone 240×120 px dans une capture 2560×1600`).

> **La leçon :** entre deux composants qui marchent séparément (la capture et le
> moteur), c'est **le passage** qui casse. Les deux correctifs portent sur ce
> passage, et le test automatique vérifie maintenant l'échelle et le décodage.

### Bug corrigé en 0.18.0 : « le voile apparaît, mais plus aucune lecture »

**Symptôme :** le voile s'affichait (donc le message passait), mais la lecture
ne rendait rien.

**La cause :** en 0.17, le moteur avait été déplacé dans le script
d'arrière-plan. Or ce script est déchargé dès qu'il est inactif : une lecture de
plusieurs secondes pouvait être interrompue, et le port de message se refermait
sans réponse.

**Le correctif :** le moteur revient dans une **vraie page d'extension**
(`src/engine.html`), ouverte en arrière-plan et réutilisée. L'arrière-plan ne
garde que les opérations courtes (capture, découpe).

> **La leçon :** un contexte déchargeable ne doit jamais héberger un travail
> long. Ce n'était pas une faute de code, mais un **choix d'architecture** — le
> plus coûteux à corriger tard.

### Bug corrigé en 0.17.1 : « rien ne se passe »

**Symptôme :** on cliquait sur « Dessiner une zone à lire » et **rien** ne se
passait — aucun voile, aucun message.

**La cause :** le gestionnaire de messages était branché **trop tard**, à
l'intérieur de la fonction qui démarre la détection. Or cette fonction n'est
**pas appelée** quand l'extension est en pause, ni sur un site de la liste
noire. Le message du popup n'arrivait donc nulle part : la page ne répondait
pas, et le popup concluait « page non prête ».

**Le correctif, en trois volets :**

| Correctif | Effet |
|---|---|
| Écouteur branché **tout de suite**, avant les tests de pause et de liste noire | la page répond toujours, même quand elle refuse |
| **Message visible dans la page** à chaque refus (pause, site exclu, erreur) | plus jamais de silence : on lit la raison |
| **Styles en ligne** sur le voile et le cadre | visibles même si la feuille de style injectée est ignorée |

**Et un raccourci personnel :** affectez « Lancer le Scan » dans le
gestionnaire de raccourcis du navigateur (aucune touche imposée).
lance la sélection directement depuis la page, sans passer par le popup. Si un
jour le message du popup ne passe pas, ce raccourci reste disponible.

> **La leçon :** une action qui échoue **sans rien dire** est le pire des
> défauts. Désormais, chaque refus est affiché, et chaque refus a un **test**.

### Les deux bugs déjà corrigés (pour mémoire)

| Version | Symptôme | Cause |
|---|---|---|
| 0.16.1 | « Moteur OCR absent » | chemins `vendor/` trop courts : les fichiers sont dans `src/vendor/` |
| 0.16.2 | « erreur inconnue » | worker créé en `blob:` (origine différente sous Firefox) → `workerBlobURL: false` |

Les deux sont désormais couverts par des tests : **résolution réelle des
chemins** et **messages d'erreur toujours exploitables**.

---

## 9. Ce que cette itération ne fait pas

- Pas d'OCR **automatique** (itération 10) : c'est vous qui montrez la zone.
- Pas de détection de codes-barres ni de QR codes.
- Pas de traduction du texte reconnu.
- Pas de traitement par lot.

---

## 10. Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/content.js` | voile, cadre de sélection, bulle de résultat |
| `src/background.js` | capture, découpe, moteur Tesseract, message `ocr-region` |
| `src/popup.html` / `src/popup.js` | bouton « Dessiner une zone à lire » |
| `src/vendor/tesseract/` | moteur (bibliothèque, worker, WebAssembly) |
| `src/vendor/tessdata/` | modèles français et anglais |
| `manifest.json` | `activeTab`, CSP `wasm-unsafe-eval` |
| `tools/ocr-tests.mjs` | 35 vérifications (géométrie, fichiers, chemins, architecture) |
| `docs/OCR.md` | ce document |
