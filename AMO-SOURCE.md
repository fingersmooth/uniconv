# UniConv 2.9.10 — source de publication AMO

## Résumé

UniConv est une extension Firefox MV3 **sans étape de compilation**. Les fichiers
`src/*.js` sont chargés directement par `manifest.json`. Le script
`tools/package.mjs` ne fait que créer les archives `.xpi/.zip` ; il ne transpile,
ne concatène et ne minifie aucun fichier UniConv.

Les seuls fichiers minifiés sont des **bibliothèques tierces open source** :
Tesseract.js 5.1.1, utilisé sans modification. Voir `THIRD-PARTY.md`.

## Environnement utilisé

- macOS (Apple Silicon)
- Node.js **v25.8.2**
- Info-ZIP **3.0**
- Aucune dépendance npm, aucun `npm install`
- Aucun compilateur, aucun bundler

## Reproduire le paquet

Depuis la racine de l'archive source :

```bash
node --version          # doit afficher v25.8.2 (ou une version compatible)
node tools/package.mjs
```

Résultat attendu :

```text
dist/uniconv-2.9.10.xpi
dist/uniconv-2.9.10-chromium.zip
dist/uniconv-2.9.10-safari.zip
```

Le fichier à comparer à la soumission AMO est :

```text
dist/uniconv-2.9.10.xpi
```

Aucune autre étape technique n'est nécessaire.

## Script d'installation / vérification

Un script est fourni :

```bash
sh tools/amo-source-check.sh
```

Il vérifie Node et `zip`, puis reconstruit les archives.

## Tests

Optionnel, mais reproductible :

```bash
for f in run-tests smoke-test background-test audit-tests units-tests \
  currency-meta-tests currency-search-tests dynamic-tests \
  false-positive-tests options-tests ocr-tests timezone-tests \
  accessibility-tests release-tests compat-tests popup-tests; do
  node tools/$f.mjs
done
```

## Bibliothèque tierce

- Tesseract.js **5.1.1**
- Source amont : https://github.com/naptha/tesseract.js
- Licence : Apache 2.0
- Fichiers : `src/vendor/tesseract/tesseract.min.js`,
  `worker.min.js`, `tesseract-core-simd.wasm.js`
- Non modifiés ; empreintes dans `THIRD-PARTY.md`.

Les avertissements AMO `Function constructor is eval` et `no-unsanitized`
proviennent de cette bibliothèque tierce, pas du code UniConv.

## Licence du projet

MIT — voir `LICENSE`.
