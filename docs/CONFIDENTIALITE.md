# Politique de confidentialité — UniConv

**Dernière mise à jour : 24 octobre 2026. Version 2.9.7.**

## En résumé

UniConv **ne collecte aucune donnée**. Pas de compte, pas de télémétrie, pas
d'analyse d'usage, pas de publicité, pas de revente. Vos réglages et l'historique
technique restent dans le stockage local de votre navigateur.

## Ce qui reste sur votre appareil

Dans `chrome.storage.local` (stockage local de l'extension) :

- vos réglages (devise cible, unités, langue, thème, délai, liste noire, ville
  de référence, format d'heure, villes et devises épinglées) ;
- le cache des taux de change (12 heures) et la date du dernier essai ;
- des compteurs techniques anonymes (nombre de blocs analysés, vitesse du
  détecteur) affichés dans le popup.

Ces données **ne quittent jamais l'appareil** et disparaissent avec l'extension.

## Ce qui sort de l'appareil (et rien d'autre)

Pour afficher des taux de change réels, l'arrière-plan interroge **quatre
services publics de taux**, sans clé d'accès :

- `https://api.frankfurter.dev/v1/latest?base=EUR`
- `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json`
- `https://latest.currency-api.pages.dev/v1/currencies/eur.json`
- `https://open.er-api.com/v6/latest/EUR`
- `https://api.exchangerate-api.com/v4/latest/EUR`

Ces requêtes ne contiennent **que la devise de base**. Aucun texte de page,
aucune adresse visitée, aucun identifiant ne leur est transmis. Comme pour
n'importe quelle requête web, ces services voient l'adresse IP de l'appareil et
peuvent la journaliser selon **leurs propres** politiques.

**Aucune autre requête réseau n'est faite.** En particulier :

- le **moteur OCR** (Tesseract, 8,2 Mo) est embarqué : les images analysées
  **ne sont jamais envoyées** ;
- aucune police, icône ou script n'est chargé depuis un CDN.

## Ce qui n'est pas collecté

- aucune donnée personnelle (nom, e-mail, compte) ;
- aucune adresse de page visitée ;
- aucun contenu de page, texte, image ou capture d'écran ;
- aucune donnée de frappe, aucun cookie, aucun identifiant publicitaire ;
- aucune mesure d'audience, aucun rapport de plantage automatique.

## Vos droits

Comme aucune donnée n'est collectée ni transmise à un tiers par l'extension,
il n'y a rien à consulter, corriger ou supprimer côté serveur. Vous pouvez
effacer toutes les données locales en désinstallant l'extension, ou via
« Réinitialiser les réglages » dans la page d'options.

## Modifications

Toute évolution de cette politique sera publiée avec la nouvelle version de
l'extension et datée en tête de ce document.

## Contact

Pour toute question : ouvrir un ticket sur le dépôt du projet (lien à venir) ou
écrire à l'adresse indiquée sur la fiche addons.mozilla.org.
