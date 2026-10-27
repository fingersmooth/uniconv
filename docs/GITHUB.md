# Mettre UniConv sur GitHub

## 1. Préparer le dépôt local

Le fichier `.gitignore` exclut déjà `dist/`, les paquets `.xpi/.zip`, les
`.DS_Store`, les clés et les fichiers d'environnement.

```bash
cd UniConv
git init -b main
git add .
git commit -m "UniConv — version initiale"
```

Vérifier que les paquets ne sont pas ajoutés :

```bash
git status --short
```

`dist/` ne doit pas apparaître.

## 2. Créer le dépôt distant

Sur GitHub : **New repository**, nom `uniconv`, visibilité au choix, sans
README ni `.gitignore` (ils existent déjà localement).

Puis, avec SSH :

```bash
git remote add origin git@github.com:UTILISATEUR/uniconv.git
git branch -M main
git push -u origin main
```

Ou avec HTTPS :

```bash
git remote add origin https://github.com/UTILISATEUR/uniconv.git
git branch -M main
git push -u origin main
```

## 7. Autoriser un agent à agir sur ce Mac

Ne jamais coller dans une conversation :

- le mot de passe GitHub ;
- un code 2FA ou un code de récupération ;
- un token `ghp_…` / `github_pat_…`.

L'agent peut utiliser les identifiants déjà présents sur la machine, sans les
voir. La méthode recommandée est GitHub CLI :

```bash
brew install gh
gh auth login
# GitHub.com → HTTPS → Login with a web browser
gh auth setup-git
gh auth status
```

À exécuter dans le **Terminal**, pas dans le chat : `gh auth login` ouvre une
page GitHub et attend une confirmation. Le token OAuth est stocké dans le
trousseau macOS, pas dans le dépôt.

Une fois `gh auth status` affiché comme connecté, l'agent peut :

- initialiser le dépôt ;
- créer le dépôt distant ;
- pousser `main` ;
- créer une Release et y joindre les paquets.

### Variante à privilèges réduits

Créer d'abord le dépôt vide sur GitHub, puis un **fine-grained PAT** limité à
ce dépôt :

- `Contents: Read and write`
- `Metadata: Read`
- expiration courte (7 jours)

L'enregistrer dans `gh` sans le montrer dans le chat :

```bash
gh auth login --with-token < /chemin/vers/le-token
gh auth setup-git
```

Supprimer le fichier contenant le token après l'opération, puis révoquer le
token sur GitHub.

### Après l'opération

```bash
gh auth logout
```

Vérifier aussi l'historique de sécurité du compte GitHub.

### Ce qu'un agent ne doit jamais avoir

- le contrôle total du compte ;
- les codes de récupération ;
- les clés de signature des extensions ;
- un token sans expiration et sans périmètre.

Un accès limité à **un dépôt**, pour une **courte durée**, est suffisant.

## 3. Publier les paquets

Créer une **Release** GitHub (tag `v2.9.7` par exemple) et y joindre :

- `dist/uniconv-2.9.7.xpi`
- `dist/uniconv-2.9.7-chromium.zip`
- `dist/uniconv-2.9.7-safari.zip`

Les binaires restent ainsi hors du dépôt Git, mais téléchargeables.

## 4. Licence

Ajouter un fichier `LICENSE` (MIT, GPL-3.0, MPL-2.0…). Sans licence, les
autres personnes n'ont pas le droit de réutiliser le code. Le choix de la
licence t'appartient ; ne pas en ajouter une sans décision explicite.

## 5. Secrets et signature

Ne jamais versionner :

- les clés de signature AMO/Chrome/Safari ;
- un fichier `.env` ;
- des jetons GitHub.

La signature des extensions se fait dans les tableaux de bord des stores, pas
dans le dépôt public.

## 6. Mises à jour

```bash
git add .
git commit -m "Description du changement"
git push
```

Pour une nouvelle version : modifier le numéro dans le manifeste et les
scripts, relancer `node tools/package.mjs`, puis créer une nouvelle Release.

## 7. Intégration continue (optionnel)

Un workflow GitHub Actions peut lancer les 16 suites :

```yaml
name: tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node tools/run-tests.mjs
      - run: node tools/dynamic-tests.mjs
      - run: node tools/ocr-tests.mjs
```

Le packaging peut être ajouté ensuite comme artefact de Release.
