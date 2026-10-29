# UniConv — la page de réglages

**Tout se règle maintenant sans toucher au code.** Version 2.9.10.

---

## 1. Comment l'ouvrir

Trois chemins :

1. Clic sur l'icône UniConv → **icône engrenage** en haut à droite.
2. `about:debugging#/runtime/this-firefox` → **UniConv** → bouton **Options**.
3. `about:addons` → UniConv → onglet **Préférences**.

La page s'ouvre dans un **onglet** (plus confortable qu'un petit panneau).

> **Unités de référence (popup).** Le cadre en haut du popup règle la
> **monnaie**, le **fuseau** et le **système d'unités** par défaut. Les valeurs
> déjà dans ces unités ne sont ni soulignées ni survolées. Un changement de
> cible dans une bulle est temporaire : la bulle suivante revient à ces
> références. La page de réglages conserve les mêmes valeurs pour les réglages
> détaillés.

---

## 2. Le principe : tout s'applique tout de suite

Il n'y a **pas de bouton « Enregistrer »**. Chaque changement est écrit
immédiatement dans le stockage du navigateur, et une barre noire
« Enregistré » le confirme en bas de l'écran.

**Effet immédiat** : tous les onglets ouverts en tiennent compte **sans
rechargement** (sauf pour la liste noire, qui demande de recharger la page —
c'est précisé dans la page).

> **À retenir :** les réglages vivent dans le **stockage du navigateur**, pas
> dans les fichiers du dossier. Modifier un fichier ne change donc pas un
> réglage déjà enregistré, et supprimer l'extension efface les réglages.

---

## 3. Les réglages, un par un

### 3.1 Devise cible

La monnaie vers laquelle les prix sont convertis.

- Champ de **recherche** : tapez `JPY`, `yen` ou `japon`.
- La liste est celle des devises réellement disponibles (toutes celles fournies par les taux (≈166)), avec
  le **nom officiel** fourni par le navigateur (`Intl.DisplayNames`).
- Équivalent dans la bulle : le menu déroulant qui s'ouvre au **clic** sur un
  montant.

### 3.2 Ce que l'extension convertit

| Réglage | Effet |
|---|---|
| **Devises** (interrupteur) | Désactivé : plus aucun prix souligné ni converti. Les unités continuent. |
| **Unités de mesure** (interrupteur) | Désactivé : plus aucune distance, poids, température. Les devises continuent. |
| **Système d'unités cible** | Vers quel système convertir (métrique / impérial). Même réglage que le bouton du popup. |

Ces interrupteurs sont utiles pour un usage spécialisé : par exemple, un
traducteur qui ne veut que les devises, ou un cuisinier qui ne veut que les
unités.

### 3.3 Affichage

| Réglage | Valeurs | Détail |
|---|---|---|
| **Délai d'apparition** | 0 à 1 000 ms | Évite qu'une bulle surgisse pendant un simple déplacement de souris. À 150–250 ms, le survol reste vif sans être envahissant. |
| **Thème de la bulle** | Clair / Sombre / Auto | « Auto » suit le réglage clair/sombre du système. |
| **Taille de la bulle** | Bouton de réinitialisation | La taille choisie à la souris (poignée en bas de la bulle) est mémorisée. Ce bouton revient à l'origine. |
| **Langue** | Français / English / Auto | Langue des **textes de l'extension** et **format des nombres** (`1 234,56` contre `1,234.56`). « Auto » suit la langue du navigateur. |

> La langue ne change **jamais** le contenu des pages : seul ce que l'extension
> affiche est traduit.

### 3.4 Sites exclus (liste noire)

Sur un site exclu, l'extension ne fait **rien** : aucun scan, aucun
soulignement, aucune bulle, aucun écouteur de souris.

- Une **liste par défaut** est active (Gmail, Outlook, Google Docs, Notion,
  GitHub, Stack Overflow, CodePen, Figma, Trello…). Elle n'est pas affichée
  dans la page : c'est un filet de sécurité permanent, non modifiable.
- **Votre liste** s'ajoute à celle-ci. Saisissez un domaine puis **Ajouter**.
- Les sous-domaines sont couverts automatiquement : exclure `exemple.com`
  exclut `www.exemple.com` et `mail.exemple.com`.

**Ce qui est accepté** (la saisie est nettoyée automatiquement) :

| Vous tapez | Enregistré |
|---|---|
| `https://www.Exemple.com/page?x=1` | `www.exemple.com` |
| `exemple.com:8080` | `exemple.com` |
| `.exemple.com` | `exemple.com` |
| `exemple` | **refusé** (pas de point) |
| `exa mple.com` | **refusé** (espace) |
| `192.168.1.1` | **refusé** (une IP n'a pas de sens ici) |

Un message explique chaque refus, et les doublons sont détectés.

> **Rappel** : après avoir ajouté un site, **rechargez la page** concernée.
> L'extension ne peut pas « se retirer » d'une page déjà chargée.

### 3.5 Lecture dans les images (OCR)

| Réglage | Effet |
|---|---|
| **Tester le moteur** | dessine un texte connu et le fait lire : diagnostic en un clic |
| **Seuil de pertinence** (1–8) | plus il est haut, moins d'images sont analysées ; 3 par défaut |
| **Budget par page** (1–20) | nombre maximal d'images analysées sur une page : 5 par défaut |

**Pourquoi désactivé par défaut :** chaque lecture coûte 1 à 5 secondes de
calcul. L'OCR **manuel** (bouton **Scan**, ou un
bouton du popup) reste toujours disponible, lui, et ne coûte rien tant qu'on ne
l'utilise pas.

### 3.6 Sauvegarde : export et import

- **Copier** / **Télécharger** : produit un fichier JSON lisible.
- **Importer** : collez un JSON puis cliquez sur **Importer**.

L'import **vérifie chaque valeur** : une valeur invalide est ignorée et
signalée, jamais appliquée telle quelle. Exemple : `"uniconv.hoverDelay":
99999` sera refusé (maximum 1 500).

Format attendu :

```json
{
  "uniconv.targetCurrency": "JPY",
  "uniconv.unitSystem": "metric",
  "uniconv.language": "auto",
  "uniconv.detectCurrencies": true,
  "uniconv.detectUnits": true,
  "uniconv.hoverDelay": 150,
  "uniconv.theme": "auto",
  "uniconv.ocrEnabled": false,
  "uniconv.blacklist": ["leboncoin.fr"]
}
```

### 3.7 Remise à zéro

**Tout réinitialiser** demande une confirmation, puis restaure tous les
réglages d'origine (y compris la liste noire personnelle). Les taux de change
en cache ne sont pas concernés.

---

## 4. Protocole de test (10 minutes)

### 4.1 Préparer

1. Recharger l'extension (`about:debugging` → **Recharger**).
2. Ouvrir le serveur de test :
   `cd ~/Documents/UniConv && python3 -m http.server 8123`
3. Ouvrir **deux onglets** :
   - l'onglet A : `http://localhost:8123/test/formats.html`
   - l'onglet B : les réglages (via le popup)

### 4.2 Les six vérifications

| # | Action | Attendu |
|---|---|---|
| 1 | Onglet A : survoler `10 €` | Une bulle s'ouvre (référence de départ) |
| 2 | Onglet B : changer la **devise cible** en JPY | **Sans recharger A**, survoler `10 €` donne des yens |
| 3 | Onglet B : **désactiver les devises** | Dans A, plus aucun prix souligné ; les unités (section 4 de `formats.html`) restent soulignées |
| 4 | Onglet B : **thème Clair** | La bulle devient blanche à texte foncé |
| 5 | Onglet B : **délai 250 ms** | La bulle met un quart de seconde à apparaître au survol |
| 6 | Onglet B : ajouter `localhost` aux sites exclus, **recharger A** | Aucune bulle, aucune erreur dans la console |

### 4.3 Persistance

| # | Action | Attendu |
|---|---|---|
| 7 | Quitter **complètement** Firefox (`Cmd` + `Q`), relancer, recharger l'extension | Tous les réglages sont conservés |
| 8 | Exporter, tout réinitialiser, importer | Les réglages reviennent à l'identique |

### 4.4 Vérification automatique

```bash
cd ~/Documents/UniConv
node tools/options-tests.mjs      # 35 / 35
node tools/dynamic-tests.mjs      # 71 / 71
```

`options-tests.mjs` vérifie notamment que **chaque identifiant utilisé par le
script existe vraiment dans la page** : une faute de frappe dans `options.js`
donnerait sinon une page qui « ne fait rien », sans aucune erreur visible.

### 4.5 Ce qu'il faut transmettre en cas de problème

| Symptôme | À transmettre |
|---|---|
| Un réglage n'a aucun effet | Le nom du réglage + l'onglet où vous regardez |
| Un réglage est perdu au redémarrage | Le nom du réglage |
| Page blanche | La console de la page de réglages (`Cmd` + `Option` + `K`), en entier |
| Un site exclu est quand même analysé | L'URL exacte (vérifiez que la page a été rechargée) |

---

## 5. Ce que cette itération ne fait pas

- Pas de compte utilisateur, pas de synchronisation cloud.
- Pas d'OCR actif (itération 9).
- Pas de réglage de la devise **source** (elle est détectée automatiquement ;
  le forcer serait trompeur).
- Pas de `src/help.html` séparé : l'aide est **intégrée** à chaque réglage,
  sous forme d'une phrase explicative. Un fichier d'aide séparé aurait
  dupliqué les informations et vieilli à chaque évolution.
- Pas de `src/settings.js` séparé : le schéma des réglages est petit et vit
  dans `src/options.js` (section `DEFAULTS`), avec les mêmes valeurs par défaut
  que celles lues par `src/content.js`. Un fichier de plus n'aurait rien
  apporté à ce stade.

---

## 6. Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/options.html` | La page de réglages (structure, style, aide intégrée) |
| `src/options.js` | La logique : lecture, écriture, validation, export/import |
| `src/content.js` | Applique les réglages : langue, thème, délai, couverture |
| `src/popup.html` / `src/popup.js` | Bouton « Ouvrir les réglages » |
| `manifest.json` | Déclare `options_ui` |
| `tools/options-tests.mjs` | 35 vérifications automatiques |
| `test/options-checklist.md` | La liste des points à cocher, version imprimable |
| `docs/OPTIONS.md` | Ce document |
