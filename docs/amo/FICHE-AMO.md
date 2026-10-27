# Fiche AMO — textes prêts à copier

## Nom

UniConv

## Résumé (≤ 250 caractères)

Convertit au survol les montants en devises, les unités de mesure et les heures avec fuseau, directement dans la page. Lit aussi les prix dans les images (OCR local). 167 devises, aucune donnée collectée.

## Catégorie

Productivité

## Langues

Français, anglais

## Description longue

**UniConv** affiche la conversion au survol, sans quitter la page.

- **Devises** : survolez `1 234,56 €`, `$480 billion` ou `13K RMB` : la valeur
  dans votre monnaie de référence apparaît aussitôt. 167 monnaies, taux réels
  (BCE + trois sources de secours), fourchettes de prix.
- **Unités** : `6 ft 2 in`, `180 lb`, `60 mph`, `25 °C`… convertis vers votre
  système (métrique ou impérial).
- **Fuseaux horaires** : `14:30 CET` devient l'heure de votre ville ou de la
  ville choisie.
- **Scan (OCR)** : dessinez un rectangle sur une image ; le texte reconnu est
  converti. Le moteur est embarqué : l'image ne quitte pas votre ordinateur.
- **Menus** : toutes les monnaies dans une recherche, drapeaux, épinglage,
  cinq devises principales.
- **Réglages** : monnaie de référence, unités, fuseau, langue, thème,
  suspension par site.

**Confidentialité** : aucune collecte, aucune télémétrie, aucun compte. Seules
les API publiques de taux sont interrogées, sans texte de page ni adresse
visitée.

## Justifications des permissions

| Permission | Justification |
|---|---|
| `storage` | Mémoriser les réglages, le cache des taux (12 h) et les épinglages. |
| `activeTab` | Lire la zone dessinée par l'utilisateur pour l'OCR, uniquement sur son geste. |
| `contextMenus` | Ajouter **Convertir**, **Scanner** et **Signaler un bug** au clic droit. |
| `https://api.frankfurter.dev/v1/*` | Taux de référence (BCE). |
| `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api/*` | Source de taux secondaire. |
| `https://latest.currency-api.pages.dev/v1/currencies/*` | Miroir de la source secondaire. |
| `https://open.er-api.com/v6/latest/*` | Taux élargis (160+ devises). |
| `https://api.exchangerate-api.com/v4/latest/*` | Quatrième source de secours. |
| `content_scripts http/https` | Lire le texte affiché pour repérer montants, unités et heures. Rien n'est transmis. |

## Notes pour le validateur

- Le moteur OCR (Tesseract.js) est embarqué ; aucun code distant n'est chargé.
- Aucune donnée d'utilisation n'est envoyée.
- Le rapport de bug reste local (`src/report.html`) et peut être supprimé.

## Fichiers à joindre

- `dist/uniconv-2.9.8.xpi`
- Captures 1280×800 (voir `docs/PUBLICATION.md`, section Visuels)
