# Dossier de conception — mode d'emploi

Six fichiers, six usages :

| Fichier | Pour qui | Usage |
|---|---|---|
| [`../DESIGN-SPEC.md`](../DESIGN-SPEC.md) | designer **et** outil de design IA | le brief complet : surfaces, contraintes, composants, états, cotations, accessibilité, livrables |
| [`tokens.json`](tokens.json) | outil de design / développeur | les valeurs (couleurs, typo, espacements, rayons, ombres, mouvement, tailles, **layout 2.0**) sous forme **machine** |
| [`tooltip-anatomy.svg`](tooltip-anatomy.svg) | designer | planche de cotations à l'échelle 1:1 : bulle compacte, bulle figée, menu, couleurs, typographie |
| [`FRAME-PROMPTS.md`](FRAME-PROMPTS.md) | outil de design IA | **11 prompts** (S01 à S11) ; S07/S08 mis à jour 2.0, les autres pour la bulle et les menus |
| [`FRAME-PROMPTS-2000.md`](FRAME-PROMPTS-2000.md) | outil limité à 2000 caractères | la même chose en compact |
| [`EVOLUTIONS-2.0.md`](EVOLUTIONS-2.0.md) | designer / outil IA | **les 3 nouveaux cadres** : S12 popup 360, S13 tutoriel, S14 convertisseur autonome, avec états, RTL et recette |

---

## 1. Par où commencer

1. Lire `DESIGN-SPEC.md` § 1 à § 3 (contexte, direction, fondations).
2. Ouvrir `tooltip-anatomy.svg` dans un navigateur, Figma ou Illustrator :
   les mesures y sont à l'échelle et annotées.
3. Coller les **prompts cadre par cadre** (`FRAME-PROMPTS.md`, ou `FRAME-PROMPTS-2000.md` si vous avez une limite de 2000 caractères), ou celui du § 9 dans l'outil de design choisi, en joignant
   `DESIGN-SPEC.md` (ou son résumé) et `tokens.json`.
4. Produire les **14 cadres** : S01–S11 (bulle/menus) + S12–S14 (popup 2.0, tutoriel, convertisseur).
5. Renseigner `tokens.json` avec les valeurs finales (garder les clés).
6. Vérifier la recette du § 10 avant l'envoi.

---

## 2. Ce qu'il faut renvoyer

```
uniconv-design/
├── UniConv-design.fig        (ou lien Figma)
├── tokens.json               (mêmes clés que le fichier fourni)
├── assets/icon.svg + icon16.png icon32.png icon48.png icon128.png
├── exports/*.png             (facultatif, @2x)
└── NOTES.md                  (écarts, doutes, choix)
```

## 3. Ce qui bloquera l'intégration

- une police ou une image chargée depuis Internet ;
- des contrastes sous 4,5:1 (texte) ou 3:1 (éléments interactifs) ;
- une structure qui casse la **redimensionnabilité** (240–700 px) ou le
  **défilement** de la liste (hauteur max 200 px par défaut) ;
- deux boutons imbriqués dans une ligne de menu (l'épingle est déjà un élément
  cliquable dans le bouton de ligne) ;
- des calques non nommés selon le § 4.0 de la spécification.

## 4. Comment j'intègre

1. Je lis `tokens.json` et je le traduis en variables CSS injectées
   (`--uni-*`).
2. Je reporte les styles dans `src/content.js`, `src/options.html`,
   `src/popup.html` (la structure et le comportement ne changent pas).
3. Je rejoue `accessibility-tests` (contrastes calculés) et `release-tests`.
4. Je reconstruis les archives (`node tools/package.mjs`) et je vous fais
   valider visuellement dans Firefox.

## 5. En cas de doute

Le fichier `DESIGN-SPEC.md` fait foi. Si une valeur de `tokens.json` manque,
la valeur actuelle du produit est conservée (voir § 11 de la spécification).
