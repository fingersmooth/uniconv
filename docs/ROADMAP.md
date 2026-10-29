# UniConv — Roadmap de développement

**Projet :** extension de navigateur qui détecte les montants en devises et les unités
de mesure affichés sur les pages web, et affiche une info-bulle au survol avec la valeur
convertie.

**Racine du projet :** `<dossier du projet>`

**Navigateur cible principal :** Firefox (développement et tests)
**Navigateur cible secondaire :** Chrome (compatibilité maintenue, publication optionnelle)

---

## Décisions validées

| Sujet | Décision | Raison |
|---|---|---|
| Navigateur de développement | Firefox, puis vérification Chrome | Chrome n'est pas installé ; Firefox accepte les extensions non signées et affiche les erreurs en clair |
| Langue de l'interface | Français pour nos échanges et la documentation ; libellés système en anglais d'origine | Utilisateur à l'aise en anglais |
| Périmètre OCR | Conservé (itérations 9 à 11) | Différenciant face aux extensions existantes ; les itérations 0-8 restent utiles seules |
| Rythme | Une itération par session, validation obligatoire avant la suivante | Corriger les bugs au plus près de leur apparition |

## Choix techniques structurants

1. **Frankfurter** (`frankfurter.dev`) comme source de taux de change : gratuit, sans clé
   d'accès, sans inscription, adossé à la Banque centrale européenne.
   Alternative écartée : `exchangerate.host`, qui exige désormais une clé pour la plupart
   des usages.
2. **Tesseract.js embarqué localement**, jamais chargé depuis un CDN. Charger un script
   depuis un serveur externe obligerait à autoriser ce serveur et enverrait une requête à
   chaque analyse OCR — incompatible avec la promesse « les images ne quittent pas
   l'ordinateur ».
3. **Un seul dépôt compatible Firefox + Chrome**, plutôt que deux versions à maintenir.
   Firefox comprend le vocabulaire d'API de Chrome (`chrome.storage`, `chrome.runtime`).
   Le seul écart réel est la déclaration du script d'arrière-plan dans le manifeste.
4. **Licence MPL 2.0** (standard Firefox, plus permissive que la RSL 1.1 de Chrome).

## Raccourcis clavier de référence (macOS)

| Action | Raccourci |
|---|---|
| Ouvrir la console (journal du navigateur) | `Cmd + Option + K` |
| Ouvrir les outils de développement complets | `Cmd + Option + I` |
| Onglet Réseau (appels internet) | `Cmd + Option + I` puis onglet « Network » |
| Page de gestion des extensions Firefox | `about:debugging#/runtime/this-firefox` |
| Page des extensions Chrome (si installé plus tard) | `chrome://extensions` |

**Règle de travail : tout texte rouge dans la console est copié tel quel et transmis,
sans tentative de correction.**

---

## Tableau récapitulatif

| # | Titre | Valeur visible | Temps estimé |
|---|---|---|---|
| 0 | Setup : extension vide + « Hello » | L'extension existe et parle | 30 min |
| 1 | MVP : détecter « 10€ » → bulle | Premier vrai résultat | 1 h |
| 2 | Tous les formats de devises | Marche sur la vraie vie | 1 h 30 |
| 3 | Vrais taux de change (API + cache) | Chiffres exacts | 1 h 30 |
| 4 | Devises écrites en mots | Bonus confort | 1 h |
| 5 | Unités de mesure | km, kg, °C, ft… | 2 h |
| 6 | Contenu dynamique (MutationObserver) | Marche sur YouTube/Amazon | 1 h 30 |
| 7 | Faux positifs : heuristiques et exclusions | Ne casse plus les pages | 2 h |
| 8 | Page d'options complète | Configuration complète | 2 h |
| 9 | OCR manuel (clic sur une image) | Lit les prix en image | 2 h 30 |
| 10 | OCR automatique intelligent — **arrêtée** | Analyse sans clic | 2 h |
| 11 | Fuseaux horaires (demandé en cours de route) | « 14:30 CET » → l'heure de ma ville | 3 h |
| 12 | Polissage, accessibilité, publication | En ligne sur AMO | 3 h |
| 13 | Optimisation et multi-navigateurs | Plus léger, partout | 4 h |
| 14 | OCR des unités et quarts | Lire aussi les recettes | 1 h 30 |
| 15 | Corrections OCR/unités | Zéro faux positif, majuscules | 45 min |
| 16 | Écritures des unités | Tout lire, tout convertir | 2 h |
| 17 | Ville + fuseau | Savoir quel fuseau est appliqué | 30 min |
| 18 | Décalage GMT | Lire l'heure d'un coup d'œil | 45 min |
| 19 | Fourchettes de prix | Lire les salaires | 1 h 30 |
| 20 | FLE/PHP + navigation | Changer de test facilement | 45 min |
| 21 | Pesos génériques | Lire les salaires mexicains | 30 min |
| 22 | Dollar de Brunéi | Lire les salaires de Brunei | 20 min |
| 23 | Audit mémoire | Consommer moins | 1 h |
| 24 | Toutes les devises | 167 devises + secours | 2 h |
| 25 | Convertisseur popup | Convertir sans quitter l'icône | 2 h |
| 26 | Scan, tutoriel, raccourcis | Lancer sans conflit | 3 h |
| 27 | Langues et Scan visible | Choisir sa langue, couper le Scan | 2 h |
| 28 | Frontières et case Detection | Zéro faux positif, pause claire | 1 h |
| 29 | Six langues, engrenage, audit | Installer dans la langue système | 3 h |
| 30 | Popup 360 et design 2.0 | Aucun chevauchement, engrenage lisible | 1 h |
| 31 | Yuan, k/m/b, clic droit | Convertir les montants abrégés | 2 h |
| 32 | Devise de départ | Lever l'ambiguïté du ¥ | 1 h |
| 33 | Unités de référence | Ne plus souligner l'évident | 2 h |
| 34 | Correctif cadre de référence | Rendre le menu utilisable | 1 h |
| 35 | Menus de devises complets | Toutes les monnaies, pas seulement 10 | 1 h |
| 36 | Signe de devise cliquable | Bulle plus compacte | 1 h |
| 37 | Épinglage et principales | Retrouver ses devises | 1 h |
| 38 | Drapeaux et ordre | Reconnaître les devises | 1 h |
| 39 | Scanner au clic droit | Lancer l'OCR sans popup | 1 h |
| 40 | Clic signe en survol | Figer puis choisir | 1 h |
| 41 | OCR multi-essais | Lire les polices décoratives | 2 h |
| 42 | Édition + rapport | Corriger et signaler | 2 h |
| 43 | Correctif édition | Pas de traces | 1 h |
| 44 | Design 16-bit | Identité visuelle | 3 h |
| 45 | Audit lisibilité | Placement stable | 1 h |
| 46 | État figé | Distinguer le clic | 1 h |
| 47 | Billion/milliard | Lire les grands montants | 1 h |
| 48 | Audit/portabilité | Publier sereinement | 1 h |
| 49 | Rubrique Ko-fi | Soutenir le projet | 30 min |
| 50 | Lien Ko-fi | URL réelle | 5 min |
| 51 | Audit sécurité | Durcir | 3 h |
| 52 | Combobox popup | Rechercher une devise | 1 h |

**Total : environ 19 heures de travail effectif.**

---

## Vocabulaire minimum

- **Extension** : petit programme ajouté au navigateur, décrit par un fichier
  `manifest.json` (sa « carte d'identité »).
- **Content script** : fichier JavaScript injecté automatiquement dans les pages web
  visitées, pour les lire et les modifier.
- **DOM** : arbre invisible de tous les éléments d'une page (titres, paragraphes, images).
- **MutationObserver** : « mouchard » posé sur une page, qui prévient à chaque apparition
  de nouveau contenu.
- **Regex** (expression régulière) : motif de recherche de texte, du type « un nombre
  suivi du symbole € ».
- **Tooltip** : bulle d'information affichée au survol.
- **Service worker / script d'arrière-plan** : programme tournant hors des pages web,
  utilisé ici pour appeler l'API de taux de change.
- **API** : service web répondant à une question (« quel est le taux EUR → USD ? »).
- **Cache** : mémorisation d'une réponse pour éviter de la redemander.
- **OCR** : reconnaissance de caractères — lire du texte à l'intérieur d'une image.
- **Faux positif** : détection d'un montant là où il n'y en a pas.

---

# Itération 0 — Setup : l'extension vide dit « Hello »

## 1. Objectif
Créer la structure minimale de l'extension et vérifier que la chaîne « écrire un fichier →
recharger → ça parle » fonctionne, avant toute logique métier.

## 2. Fonctionnalités livrées
- Dossier `UniConv` organisé, prêt pour la suite.
- `manifest.json` valide (Manifest V3, compatible Firefox et Chrome).
- Content script écrivant `[UniConv] Hello depuis <url>` dans la console de chaque page.
- Script d'arrière-plan écrivant `[UniConv] arrière-plan démarré`.
- Icône d'extension visible dans la barre d'outils.
- Popup minimal affichant le nom et la version.

## 3. Prérequis
- Firefox installé (vérifié : version 157.0.1 présente).
- Savoir ouvrir la console : `Cmd + Option + K`.
- Dossier `<dossier du projet>` (vérifié : existe et vide).

## 4. Étapes
1. Créer la structure de dossiers : `src/`, `icons/`, `docs/`.
2. Créer `docs/ROADMAP.md` (ce fichier).
3. Créer `manifest.json`.
4. Créer `src/background.js`.
5. Créer `src/content.js`.
6. Créer `src/popup.html` et `src/popup.js`.
7. Créer `icons/icon128.png` (icône provisoire).
8. Vérifier l'écriture réelle des fichiers (`ls -R`) et la validité du JSON.
9. Côté utilisateur : charger l'extension via `about:debugging#/runtime/this-firefox`,
   ouvrir un site, ouvrir la console.

## 5. Contenu des fichiers
Tous les fichiers livrés **intégraux**, avec chemin et rôle indiqués, à l'exécution.

## 6. Test de validation
- **Où :** `https://fr.wikipedia.org`
- **Attendu :** ligne `[UniConv] Hello depuis https://fr.wikipedia.org/...` dans la console.
- **Aussi :** carte « UniConv » visible dans `about:debugging`, sans erreur rouge ;
  clic sur l'icône → popup affichant le nom et la version.

## 7. Erreurs probables
| Symptôme | Où le trouver | À transmettre |
|---|---|---|
| Firefox refuse le manifeste | `about:debugging` | Message rouge complet |
| Rien dans la console | `Cmd + Option + K` | « rien » + URL de la page |
| Ligne rouge | Console | Ligne complète avec nom de fichier |
| Icône absente | Barre d'outils | Capture d'écran |

## 8. Hors périmètre
Aucune détection, aucune regex, aucune bulle, aucun appel réseau, aucune page d'options,
aucune installation de Tesseract ou de dépendance.

---

# Itération 1 — MVP : détecter « 10€ » et afficher une bulle

## 1. Objectif
Repérer le motif `nombre + €` et afficher au survol une bulle contenant une valeur
**fictive** (facteur 1,10 codé en dur).

## 2. Fonctionnalités livrées
- Détection de `10€` et `10 €`.
- Scan complet de la page au chargement.
- Soulignement pointillé discret des montants détectés.
- Bulle au survol : « 10 € ≈ 11,00 $ (valeur de test) ».
- Disparition de la bulle à la sortie de la souris.

## 3. Prérequis
- Itération 0 validée.
- Comprendre que la page est modifiée visuellement seulement ; un rechargement (F5)
  annule tout.

## 4. Étapes
1. Créer `src/detect.js` (moteur de détection).
2. Créer `src/tooltip.js` (affichage de la bulle).
3. Créer `styles.css` (apparence).
4. Mettre à jour `manifest.json`.
5. Câbler `src/content.js`.
6. Créer `docs/TESTS.md` (pages de test et résultats attendus).
7. Relire chaque fichier pour vérifier les références de fonctions.
8. Transmettre le protocole de test.

## 5. Contenu des fichiers
Six fichiers, intégraux, avec chemins et rôles.

## 6. Test de validation
- **Où :** page Wikipédia francophone contenant des prix.
- **Attendu :** bulle au survol d'un montant, correctement positionnée, ne débordant pas
  de l'écran. Aucune bulle sur une page sans prix.

## 7. Erreurs probables
| Symptôme | Cause probable | À transmettre |
|---|---|---|
| Aucune bulle | Regex trop stricte | Capture du passage + ligne rouge |
| Bulle partout | Détection trop large | URL de la page |
| Mise en page cassée | Modification du HTML | Capture + URL |
| Bulle clignotante | Positionnement instable | Description du comportement |

## 8. Hors périmètre
Pas de vrais taux, pas de `$`, pas de montants en lettres, pas de milliers, pas de contenu
dynamique, pas de page d'options, pas de gestion clavier.

---

# Itération 2 — Tous les formats de devises

## 1. Objectif
Reconnaître l'ensemble des écritures humaines d'un montant en une seule passe de détection.

## 2. Fonctionnalités livrées
- Symboles avant/après, collés ou espacés : `10€`, `€10`, `$1,234.56`, `10£`.
- Codes ISO : `EUR 10`, `10 EUR`, `100 JPY`, `10 CHF`.
- Séparateurs français et anglais : `1 234,56 €`, `1,234.56`, espaces insécables et fines.
- Décimales : `10.00€`, `10,00 €`, `10 €`, `.50 €`.
- Une trentaine de devises reconnues.
- Résultat formaté via `Intl.NumberFormat` selon la langue de l'utilisateur.

## 3. Prérequis
- Itération 1 validée.
- Comprendre la notion d'espace insécable (caractère invisible distinct de l'espace
  normale), cause principale des détections ratées.

## 4. Étapes
1. Créer `src/currencies.js` (table des devises).
2. Réécrire `src/detect.js` avec une regex unifiée et commentée.
3. Créer `docs/FORMATS.md` (40 formats de test et résultat attendu).
4. Ajouter la normalisation des espaces (insécables, fines, tabulations).
5. Ajouter la mise en forme via `Intl.NumberFormat`.
6. Créer `test/formats.html` (page de test officielle, définitive).
7. Transmettre le protocole : survoler chaque ligne, signaler les échecs.

## 5. Contenu des fichiers
Fichiers créés et modifiés, intégraux, plus mise à jour de `manifest.json`.

## 6. Test de validation
- **Où :** `test/formats.html`, puis un site d'actualité ou e-commerce francophone.
- **Attendu :** 40 lignes sur 40 correctement détectées et converties (test binaire).

## 7. Erreurs probables
| Symptôme | À transmettre |
|---|---|
| Une ligne ne réagit pas | Numéro de ligne + contenu exact |
| Montant mal lu (`1 234` lu comme `1`) | Numéro de ligne |
| Faux positif sur la page de test | Texte fautif |

## 8. Hors périmètre
Pas d'API réelle, pas de devises en lettres, pas d'unités, pas d'optimisation de
performance.

---

# Itération 3 — Vrais taux de change (Frankfurter) + cache

## 1. Objectif
Remplacer le facteur fictif par de vrais taux, récupérés une fois par jour et mis en cache.

## 2. Fonctionnalités livrées
- Téléchargement des taux depuis `frankfurter.dev` (gratuit, sans clé, sans inscription).
- Cache local de 12 h : un seul appel réseau par jour.
- Mode hors ligne : utilisation des derniers taux connus.
- Taux croisés : `JPY → MAD` calculé via l'euro.
- Bulle affichant « 1 EUR = 1,0842 USD · taux du 12/03 ».
- Popup affichant la date de mise à jour des taux.

## 3. Prérequis
- Itération 2 validée.
- Comprendre la communication entre scripts : le content script (dans la page) et
  l'arrière-plan (hors page) ne partagent pas la mémoire ; ils échangent des messages.
- Comprendre la permission réseau : le manifeste doit déclarer le droit d'appeler le
  serveur, sinon blocage silencieux.

## 4. Étapes
1. Créer `src/api.js`.
2. Créer `src/cache.js` (stockage `storage.local`).
3. Ajouter les permissions au manifeste.
4. Modifier `src/background.js` (réponse aux messages « taux X → Y »).
5. Modifier `src/content.js` (demande du taux au lieu du facteur fixe).
6. Gérer tous les échecs : réseau absent, API en panne, devise inconnue, réponse illisible.
7. Ajouter un délai maximum de 5 s avant repli sur le cache.
8. Créer `docs/API.md`.
9. Vérifier la forme de la réponse de l'API avant de lancer les tests utilisateur.

## 5. Contenu des fichiers
Quatre fichiers créés ou modifiés, intégraux.

## 6. Test de validation
- **Où :** `test/formats.html`, puis un site de prix réel.
- **Attendu :** taux plausible (fourchette EUR/USD communiquée le jour du test).
- **Test hors ligne :** Wi-Fi coupé → chiffre affiché malgré tout, avec mention du cache.
- **Test de sobriété :** un seul appel API visible dans l'onglet Network.

## 7. Erreurs probables
| Symptôme | Cause | À transmettre |
|---|---|---|
| « Non connecté » à tort | Permission réseau manquante | Console de l'arrière-plan (`about:debugging` → Inspect) |
| Taux absurde | Erreur de division | Chiffre affiché |
| Rien ne se passe | Message perdu | Console de l'arrière-plan, en entier |

## 8. Hors périmètre
Pas de saisie manuelle de taux, pas de fournisseur alternatif, pas d'historique ni de
graphiques, pas encore de devises en lettres.

---

# Itération 4 — Devises écrites en mots

## 1. Objectif
Reconnaître « dix euros », « ten dollars », « 10 livres sterling » et les convertir comme
les montants numériques.

## 2. Fonctionnalités livrées
- Nombres en lettres français (un → milliard) et anglais (one → billion).
- Variantes et accords : euros/euro, dollars, livres, pounds, francs, yens, couronnes.
- Formats mixtes : « 10 livres sterling », « 5 bucks ».
- Formes composées : « vingt-cinq euros », « three thousand dollars »,
  « one hundred and fifty euros ».

## 3. Prérequis
- Itération 3 validée.
- Comprendre le risque propre à cette itération : un mot peut être un nom propre
  (« Miles Davis ») ou un adjectif numéral banal (« cent fois »).

## 4. Étapes
1. Créer `src/numberwords.js` (conversion mots → nombre, deux langues).
2. Étendre la détection aux noms de devises dans `src/detect.js`.
3. Ajouter le garde-fou : n'accepter un nombre en lettres que s'il est suivi d'un mot de
   devise.
4. Ajouter la liste noire intégrée (Miles, Frank, Mark…).
5. Ajouter une trentaine de lignes à `test/formats.html`.
6. Documenter dans `docs/FORMATS.md` les cas volontairement non convertis.
7. Transmettre le protocole de test.

## 5. Contenu des fichiers
Fichiers créés et modifiés, intégraux.

## 6. Test de validation
- **Où :** `test/formats.html` (nouvelles lignes) + un article de presse francophone.
- **Attendu :** « dix euros » converti ; **« Miles Davis » jamais converti**.
- **Non-régression :** les 40 formats précédents fonctionnent toujours.

## 7. Erreurs probables
| Symptôme | À transmettre |
|---|---|
| Mot français mal décodé | Texte exact |
| Nom propre converti | Texte + URL |
| Page devenue lente | URL |

## 8. Hors périmètre
Pas d'autres langues que français et anglais, pas de saisie clavier, pas d'unités de
mesure.

---

# Itération 5 — Unités de mesure

## 1. Objectif
Convertir longueurs, poids, températures et volumes selon le système choisi (métrique ou
impérial).

## 2. Fonctionnalités livrées
- Longueurs : m, km, cm, mm, miles, ft, inches, yards.
- Poids : kg, g, lbs, oz, stones.
- Températures : °C, °F, K (conversion avec décalage, pas une simple multiplication).
- Volumes : L, mL, gallons US/UK, pintes, tasses.
- Vitesses : km/h, mph.
- Formats français : `1m80`, `2,5 kg`, `5km`.
- Unités composées : `6 ft 2 in`, `5'10"`.
- Bascule métrique ↔ impérial dans le popup.
- Sens de conversion indiqué dans la bulle.

## 3. Prérequis
- Itération 4 validée.
- Comprendre l'ambiguïté unité/mot : « m » peut être un mètre ou une abréviation de
  million. Traitement par règles de priorité explicites.

## 4. Étapes
1. Créer `src/units.js` (facteurs de conversion, chaque formule sourcée en commentaire).
2. Créer `src/units-detect.js` (moteur distinct de celui des devises).
3. Créer `src/temperature.js` (formules décalées).
4. Ajouter le réglage métrique/impérial dans le stockage et le popup.
5. Ajouter 40 lignes de tests d'unités à `test/formats.html`.
6. Créer `docs/UNITS.md` avec valeurs de contrôle.
7. Fournir une table de vérité de 10 valeurs à vérifier manuellement.

## 5. Contenu des fichiers
Tous intégraux.

## 6. Test de validation
- **Où :** `test/formats.html` + une recette de cuisine anglophone.
- **Valeurs de contrôle vérifiées par l'utilisateur :** 0 °C = 32 °F, 100 °C = 212 °F,
  1 mile = 1,609 km, 1 kg = 2,205 lbs.
- **Non-régression :** devises toujours fonctionnelles.

## 7. Erreurs probables
| Symptôme | Cause probable | À transmettre |
|---|---|---|
| Température fausse d'environ 32 | Décalage oublié | Chiffre affiché |
| « m » converti partout | Ambiguïté non gérée | URL + texte |
| `1m80` non détecté | Format spécial | Numéro de ligne |

## 8. Hors périmètre
Pas de cryptomonnaies, pas de métaux précieux, pas d'unités exotiques, pas de contenu
dynamique, pas d'OCR.

---

# Itération 6 — Contenu dynamique (MutationObserver)

## 1. Objectif
Convertir également les montants apparus après le chargement initial (scroll infini,
React, YouTube, Amazon).

## 2. Fonctionnalités livrées
- `MutationObserver` traitant uniquement les nouveaux éléments.
- Regroupement des modifications (debounce de 300 ms) pour éviter de faire ramer le
  navigateur.
- Marqueur « déjà traité » empêchant tout retraitement.
- Exclusion des champs de saisie, éditeurs de texte, `<script>` et `<style>`.
- Compteur d'éléments traités visible dans le popup.

## 3. Prérequis
- Itération 5 validée.
- Comprendre le risque : un observateur mal réglé peut figer le navigateur. Itération la
  plus sensible en performance ; mesure obligatoire.

## 4. Étapes
1. Créer `src/observer.js`.
2. Ajouter la logique de debounce et la file d'attente.
3. Ne traiter que les nœuds ajoutés.
4. Ajouter les exclusions.
5. Ajouter le compteur de performance au popup.
6. Créer `test/dynamique.html` (ajout continu de prix, test hors ligne).
7. Ajouter un test de charge : 500 éléments injectés, mesure du temps de réaction.
8. Fournir deux protocoles : site calme, puis site agressif.

## 5. Contenu des fichiers
`observer.js`, `dynamique.html`, `popup.js` et `manifest.json` modifiés — intégraux.

## 6. Test de validation
- **Où :** `test/dynamique.html` puis un site à scroll infini.
- **Attendu :** nouveaux prix convertis sans rechargement.
- **Critère bloquant :** le scroll reste fluide. Toute saccade invalide l'itération.

## 7. Erreurs probables
| Symptôme | Gravité | À transmettre |
|---|---|---|
| Navigateur ralenti | Bloquant | URL + « ça rame » |
| Processeur emballé | Bloquant | Capture du Moniteur d'activité |
| Prix en double | Moyen | Capture d'écran |
| Effet seulement après scroll | Moyen | Description |

## 8. Hors périmètre
Pas d'OCR, pas d'optimisation des faux positifs (itération suivante), pas de page
d'options, pas de gestion des iframes.

---

# Itération 7 — Faux positifs : heuristiques et exclusions

## 1. Objectif
Rendre l'extension discrète là où elle n'a rien à faire, sans jamais casser une page.

## 2. Fonctionnalités livrées
- Zones jamais scannées : champs de saisie, formulaires, blocs de code, terminaux,
  éditeurs en ligne, commentaires en cours de rédaction.
- Motifs négatifs : versions (`10.0`, `v1.2.3`), chapitres, normes (`ISO 9001`),
  identifiants (`COVID-19`), numéros de page, téléphones, codes postaux, dimensions
  (`1920x1080`), pourcentages.
- Heuristique de densité numérique (paragraphes truffés de chiffres ignorés).
- Liste noire de domaines par défaut + ajouts personnels.
- Seuils de plausibilité des montants.
- Raccourci clavier pause/reprise et indicateur d'état sur l'icône.
- Compteur « scans ignorés » dans le popup.

## 3. Prérequis
- Itérations 5 et 6 validées.
- Accepter l'objectif réaliste : passer de « gênant » à « rare et discret », sans viser
  zéro.

## 4. Étapes
1. Créer `src/context.js` (règles d'exclusion).
2. Créer `src/blacklist.js` (domaines par défaut).
3. Ajouter les motifs négatifs à `src/detect.js`.
4. Ajouter les seuils de plausibilité.
5. Ajouter le raccourci pause/reprise.
6. Créer `test/faux-positifs.html` (60 pièges, résultat attendu : zéro détection).
7. Créer `docs/FAUX-POSITIFS.md`.
8. Ajouter le compteur au popup.
9. Fournir une liste de 8 sites réels à tester 2 minutes chacun.

## 5. Contenu des fichiers
Fichiers créés et modifiés, intégraux.

## 6. Test de validation
- **Où :** `test/faux-positifs.html` puis les 8 sites réels.
- **Attendu :** 0 conversion sur 60 pièges ; aucun site cassé visuellement.
- **Livrable utilisateur :** liste des cas gênants restants, pour arbitrage.

## 7. Erreurs probables
| Symptôme | À transmettre |
|---|---|
| Piège converti | Numéro du piège |
| Vrai prix non converti (régression) | Texte + URL |
| Site mal affiché | Capture + URL |

## 8. Hors périmètre
Pas d'apprentissage automatique, pas de synchronisation entre appareils, pas d'OCR, pas
encore la page d'options complète.

---

# Itération 8 — Page d'options complète

## 1. Objectif
Offrir une interface de configuration complète et explicite, et supprimer les réglages
codés en dur.

## 2. Fonctionnalités livrées
- Devise cible : liste de 30 devises avec recherche.
- Devise source : automatique ou forcée.
- Système d'unités : métrique / impérial / automatique.
- Langue : français / anglais / automatique.
- Activation séparée des devises et des unités.
- Interrupteur OCR (préparation des itérations 9-10).
- Liste noire personnelle avec validation de format.
- Affichage : délai d'apparition, thème clair/sombre/auto, taille de la bulle.
- Export et import des réglages.
- Réinitialisation avec confirmation.
- Aide intégrée, une phrase d'explication par réglage.
- Propagation immédiate des changements à tous les onglets ouverts.

## 3. Prérequis
- Itération 7 validée.
- Comprendre que les réglages vivent dans le stockage du navigateur, pas dans les
  fichiers : modifier un fichier ne change pas un réglage déjà enregistré.

## 4. Étapes
1. Créer `src/options.html`.
2. Créer `src/options.css`.
3. Créer `src/options.js`.
4. Créer `src/settings.js` (schéma central, valeurs par défaut, versionnage, validation).
5. Refondre `src/popup.html` et `src/popup.js`.
6. Créer `src/help.html`.
7. Brancher la propagation immédiate vers les onglets.
8. Créer `test/options-checklist.md`.
9. Protocole : modifier un réglage, vérifier l'effet immédiat sans recharger l'extension.

## 5. Contenu des fichiers
Six fichiers, intégraux.

## 6. Test de validation
- **Où :** page d'options + page de test dans un autre onglet.
- **Attendu :** effet immédiat du changement de devise cible, persistance après
  redémarrage du navigateur, export/import fonctionnel.

## 7. Erreurs probables
| Symptôme | À transmettre |
|---|---|
| Réglage sans effet | Nom du réglage + capture |
| Réglage perdu au redémarrage | Nom du réglage |
| Page blanche | Console de la page d'options, en entier |

## 8. Hors périmètre
Pas de compte utilisateur, pas de cloud, pas de thème avancé, pas d'OCR actif, pas de
langues supplémentaires.

---

# Itération 9 — OCR manuel (clic sur une image)

> **Déjà fait à l'itération 7bis :** les prix écrits dans les attributs `alt`,
> `aria-label` et `title` des images sont convertis, sans OCR. L'OCR ne
> concerne donc **que** les prix dessinés dans les pixels. Voir
> `docs/IMAGES-ET-OCR.md`.

> **Décision de conception (proposée par l'utilisateur, retenue) :**
> l'OCR manuel ne portera pas sur une image entière, mais sur un **rectangle
> sélectionné à la souris** sur la page — comme l'outil de capture d'écran de
> macOS ou Firefox. L'utilisateur dessine un cadre autour du prix qui
> l'intéresse, et seule cette zone est analysée.
>
> Avantages : coût minimal (une zone de 200 × 60 px au lieu d'une page
> entière), temps de réponse réduit, précision améliorée (on peut viser un
> badge de prix précis), et aucune ambiguïté sur ce qu'il faut lire.
> Implémentation prévue : une surcouche (`overlay`) temporaire pour dessiner
> le cadre, puis `captureVisibleTab` ou un rendu canvas de la zone ; aucun
> envoi réseau.

## 1. Objectif
Permettre l'analyse d'une image par clic, via Tesseract.js embarqué, sans aucun envoi de
données.

## 2. Fonctionnalités livrées
- Analyse déclenchée par clic (ou `Alt + clic`) sur une image.
- Indicateur de progression avec pourcentage.
- Filtrage du texte reconnu par les moteurs de détection existants (aucune duplication).
- Bulle de résultat : prix détectés + valeurs converties.
- Tesseract.js et les modèles de langue stockés localement dans l'extension.
- Message clair si l'image est illisible (protection anti-copie).
- Bouton d'annulation.
- Limite de taille d'image pour éviter le gel de l'onglet.

## 3. Prérequis
- Itération 8 validée.
- Comprendre le coût : ~5 Mo de fichiers, 1 à 5 secondes par image, ~30 Mo au total.
- Comprendre que le clic simple sur un lien doit continuer de fonctionner normalement.

## 4. Étapes
1. Télécharger Tesseract.js et les modèles français/anglais dans `src/vendor/tesseract/`.
2. Créer `src/ocr.js` (progression et annulation).
3. Créer `test/ocr.html` (6 images pièges).
4. Ajouter la détection du clic sur image dans `src/content.js`.
5. Ajouter la bulle de progression.
6. Ajouter les limites de taille et le délai maximum.
7. Gérer les erreurs : fichier manquant, mémoire insuffisante, image corrompue.
8. Créer `docs/OCR.md`.
9. Vérifier que le manifeste n'autorise aucun domaine externe pour l'OCR.

## 5. Contenu des fichiers
Fichiers créés et modifiés, intégraux. Les fichiers tiers sont téléchargés, avec
provenance et empreinte de contrôle indiquées.

## 6. Test de validation
- **Où :** `test/ocr.html` puis une fiche produit réelle.
- **Attendu :** prix détecté en 1 à 5 secondes après clic.
- **Test de confidentialité :** onglet Network ouvert → aucune requête externe pendant
  l'OCR.
- **Non-régression :** navigation par clic intacte.

## 7. Erreurs probables
| Symptôme | Cause probable | À transmettre |
|---|---|---|
| « Tesseract introuvable » | Fichier mal placé | Message exact |
| Onglet figé | Image trop lourde | Taille de l'image |
| Rien au clic | Conflit avec le site | URL |
| Requête réseau détectée | Configuration incorrecte | Ligne Network complète (priorité absolue) |

## 8. Hors périmètre
Pas d'OCR automatique, pas de codes-barres ni QR codes, pas de traduction, pas de
traitement par lot.

---

# Itération 10 — OCR automatique intelligent

> **Supprimée en 2.0.0.** Le code, les réglages, la page `test/ocr-auto.html`
> et la suite `page-tests` ont été supprimés. Cette spécification est conservée
> comme historique ; **ne pas la recréer**.

## 1. Objectif
Repérer automatiquement les images susceptibles de contenir un prix et les analyser sans
clic, sans dégrader les performances.

## 2. Fonctionnalités livrées
- Score de pertinence par image : taille d'affichage, position, attributs `alt`/`title`,
  nom de fichier (price, prix, promo, soldes, -50%), proximité d'un bouton d'achat.
- File d'attente à une seule analyse simultanée.
- Budget maximal d'images par page (5 par défaut, réglable) et arrêt si l'onglet est en
  arrière-plan.
- Analyse au survol prolongé (800 ms).
- Cache par image (URL + taille), aucune analyse en double.
- Interrupteur maître et seuil de pertinence dans les options.
- Indicateur discret sur les images en cours d'analyse.
- Statistiques dans le popup : analysées, temps moyen, ignorées.

## 3. Prérequis
- Itération 9 validée, avec constat personnel de la lenteur de l'OCR.
- Comprendre la notion de budget de performance : 200 images analysées prendraient
  plusieurs minutes.

## 4. Étapes
1. Créer `src/ocr-queue.js` (file à un seul couloir).
2. Créer `src/image-score.js` (score de pertinence).
3. Ajouter seuils et budget aux options.
4. Ajouter le cache d'images analysées.
5. Ajouter l'analyse au survol prolongé.
6. Ajouter les statistiques au popup.
7. Créer `test/ocr-auto.html` (50 images, 6 pertinentes : vérifier que 6 sont analysées).
8. Fournir un protocole de mesure de performance avant/après.
9. Protocole sur marketplace réelle, avec critère d'abandon : si ça rame, l'automatique
   repasse désactivé par défaut.

## 5. Contenu des fichiers
Fichiers créés et modifiés, intégraux.

## 6. Test de validation
- **Où :** `test/ocr-auto.html` puis une marketplace.
- **Attendu :** exactement 6 analyses sur 50 images ; page restant fluide ; extension
  absente du top 5 des consommateurs d'énergie après 10 minutes d'usage.

## 7. Erreurs probables
| Symptôme | Gravité | À transmettre |
|---|---|---|
| Page ralentie | Bloquant | URL + « rame » |
| Plus de N analyses | Moyen | Compteur du popup |
| OCR relancé en boucle | Bloquant | Compteur + URL |
| Aucune analyse | Moyen | Score affiché en mode debug |

## 8. Hors périmètre
Pas de vidéo, pas de canvas, pas d'apprentissage automatique. OCR désactivé par défaut.

---

# Itération 11 — Polissage, accessibilité, performance, publication

## 1. Objectif
Transformer le prototype fonctionnel en extension publiable et la mettre en ligne.

## 2. Fonctionnalités livrées
- Accessibilité : bulle utilisable au clavier, compatible lecteur d'écran (`aria-live`),
  contrastes vérifiés, respect de « réduire les animations ».
- Performance : mesures avant/après, OCR chargé uniquement à la demande, taille
  optimisée.
- Robustesse : aucun message d'erreur face aux sites mal comportés, mode dégradé partout.
- Internationalisation : fichiers de traduction séparés (français, anglais).
- Confidentialité : `docs/CONFIDENTIALITE.md` et page publique de politique de
  confidentialité.
- Visuel : icônes 16/32/48/128 définitives, bannière et captures d'écran.
- Documentation : `README.md` complet, `docs/` finalisé, notes de version.
- Empaquetage : archive finale, version 1.0.0.
- Publication : dépôt sur addons.mozilla.org (AMO), gratuit.

## 3. Prérequis
- Itération 10 validée (ou décision assumée de livrer sans OCR automatique).
- Compte Mozilla (gratuit) pour AMO. Optionnel : compte développeur Chrome Web Store
  (5 $, unique) avec vérification d'identité pouvant prendre 1 à 3 jours.
- Comprendre la validation par le store : de quelques heures à deux semaines.

## 4. Étapes
1. Audit du code : fichiers inutilisés, code mort, tailles.
2. Optimiser le chargement (OCR à la demande).
3. Audit d'accessibilité et corrections.
4. Créer les fichiers de traduction et basculer les textes visibles.
5. Rédiger la politique de confidentialité.
6. Créer les icônes définitives et les visuels.
7. Rédiger la fiche de présentation : titre, description courte et longue, mots-clés,
   captures.
8. Rédiger la justification de chaque permission demandée.
9. Créer l'archive finale et vérifier que le manifeste est à sa racine.
10. Accompagner le dépôt sur AMO pas à pas.
11. Définir le processus de mise à jour (incrément de version, nouvelle soumission).

## 5. Contenu des fichiers
Tous les fichiers finaux et les documents de publication. L'archive est générée par une
commande reproductible.

## 6. Test de validation
- **Où :** profil de navigateur neuf, puis une semaine d'usage quotidien.
- **Attendu :** installation en un clic, sans avertissement d'erreur.
- **Accessibilité :** navigation complète au clavier, souris débranchée.
- **Non-régression finale :** devises, mots, unités et OCR fonctionnels sur 10 sites
  variés.
- **Après publication :** lien de la fiche transmis.

## 7. Erreurs probables
| Symptôme | Cause probable | À transmettre |
|---|---|---|
| Refus du store | Permission mal justifiée | Message de refus complet |
| « Manifest invalide » | Structure de l'archive | Message |
| Validation retardée | Normal | Aucune action |
| Note basse | Faux positifs | Commentaires reçus |

## 8. Hors périmètre
Pas de version Safari, mobile ou Edge, pas de monétisation, pas de télémétrie, aucune
nouvelle fonctionnalité.

---

## Journal des itérations

| Itération | Statut | Date | Notes |
|---|---|---|---|
| 0 | Validée | 14/10 | 6/6 points de contrôle OK. Communication popup ↔ arrière-plan confirmée. Pièges rencontrés : bouton « Inspecter » inadapté au script d'arrière-plan ; champ de recherche de la console qui filtre les messages. |
| 1 | Validée | 14/10 | Bulle et soulignement fonctionnels. 5 bugs corrigés (manifeste, extension fantôme, WeakMap.forEach, offsetNode, zone de survol off-by-one). Vérifié par l'utilisateur : montants détectés, pointillés visibles, bulle au survol, zone limitée au prix exact. |
| 2 | Validée | 15/10 | 45 devises, 5 familles de formats, 54 tests automatiques. Validée par l'utilisateur. |
| 3 | Validée + audit | 15/10 | Vrais taux via Frankfurter, cache 12 h, hors ligne, taux croisés. Bug de cache corrigé (stocke le taux, pas la valeur). Audit complet : 26 conversions vérifiées, 0 erreur. |
| 4 | Validée | 15/10 | Devises en lettres français/anglais. 63 tests. Validée par l'utilisateur. |
| 5 | Validée | 15/10 | Unités de mesure : longueur, poids, température, volume, vitesse, formats composés (1m80, 6 ft 2 in). Bascule métrique/impérial dans le popup. 30 cas sur la page de test, 41 tests dédiés. Menu de choix de l'unité cible, bulle redimensionnable et stable. Validée par l'utilisateur. |
| 6 | Livrée, en attente du test visuel | 16/10 | Contenu dynamique : MutationObserver (ajouts + modifications de texte), regroupement 300 ms, exclusions (saisie, zone modifiable, script, style, interface interne), compteur dans le popup, page `test/dynamique.html`, 26 tests dédiés. |
| 7 | Livrée, en attente du test visuel | 16/10 | Faux positifs : 13 règles de contexte (versions, heures, dates, plages, ratios, téléphones, IP, références, numérotations, dimensions, millions, pavés de chiffres), 16 balises ignorées, pause globale + raccourci Alt+Maj+U + badge « OFF », liste noire de 24 domaines, compteur des nombres écartés dans le popup, page `test/faux-positifs.html` (60 pièges + 12 vrais prix), 90 tests dédiés. Bonus : lecture correcte du format allemand `1.234.567,89 €` et drapeaux agrandis dans le menu. |
| 7bis | Livrée avec l'itération 7 | 16/10 | Montants écrits dans les attributs des images (`alt`, `aria-label`, `title`), y compris quand l'attribut arrive après coup (chargement paresseux). Aucun OCR : c'est du texte HTML. Vérification faite que le texte SVG était déjà analysé (l'exclusion « SVG » de l'itération 7 était sans effet). 13 tests dédiés. |
| 7ter | Livrée | 16/10 | **Correction majeure** : les prix coupés en plusieurs balises (structure Amazon `€` + `54` + `,` + `00`, vignettes `13,50` + `€`) sont désormais détectés. Le texte est reconstitué par « suites » de morceaux voisins, puis réparti sur chaque morceau. 9 tests dédiés, dont la structure Amazon exacte et le refus de fusionner à travers un bloc. Voir `docs/PRIX-DECOUPES.md`. |
| 7quater | Livrée | 16/10 | Cases de variantes Amazon : le prix est recouvert d'un lien transparent (`a.page-load-link`), donc le curseur ne trouve aucun texte. Ajout d'un **recours spatial** (pile `elementsFromPoint` + rectangles `getClientRects`, limité aux petites zones) et d'un **diagnostic** `Alt+Maj+D`. 8 tests dédiés (dont le diagnostic). |
| 8 | Livrée, en attente du test visuel | 16/10 | Page de réglages complète : devise cible (recherche, 167 devises, noms officiels via `Intl.DisplayNames`), couverture devises/unités séparée, système d'unités, langue (fr/en/auto, format des nombres inclus), thème clair/sombre/auto, délai d'apparition (0–1000 ms), réinitialisation de la taille, liste noire personnelle validée, export/import JSON vérifié valeur par valeur, remise à zéro. Application **immédiate** à tous les onglets. 35 tests dédiés + 8 tests de comportement dans `dynamic-tests`. |
| 9 | Livrée (0.23.0), en attente du test visuel | 16/10 | OCR manuel par **rectangle de sélection** (la conception proposée par l'utilisateur) : capture de l'onglet depuis le popup, page dédiée `src/ocr.html`, découpe + agrandissement + niveaux de gris, moteur **Tesseract.js embarqué** (français + anglais, 8,2 Mo, aucun envoi réseau), texte renvoyé à la page d'origine qui le convertit avec les moteurs existants (aucune duplication). Permission `activeTab`, CSP `wasm-unsafe-eval`. 41 tests dédiés + 8 tests de plomberie. **Bug corrigé en 0.16.1** : chemins `vendor/` trop courts (les fichiers sont dans `src/vendor/`), d'où « Moteur OCR absent ». Un test vérifie désormais que chaque chemin référencé existe sur le disque. **Bug corrigé en 0.23.0** : Tesseract créait son worker depuis une URL `blob:`, dont l'origine différait de celle de l'extension sous Firefox → `importScripts` refusé, et un `ErrorEvent` sans message affichait « erreur inconnue ». Correctif : `workerBlobURL: false`. |
| 9bis | Livrée | 16/10 | **Interface OCR revue à la demande de l'utilisateur** : plus de page séparée ni de photo plein écran. Le rectangle se dessine **sur la page** (voile sombre + cadre bleu, Échap pour annuler) et le **texte reconnu s'affiche dans la bulle** avec sa conversion. Le moteur a déménagé dans le script d'arrière-plan (un contexte d'extension, seul endroit où WebAssembly est autorisé) : capture de l'onglet, découpe selon la densité de l'écran, agrandissement ×2, niveaux de gris. 16 tests de parcours simulé + 35 tests de structure. 
| 9ter | Livrée | 16/10 | **Correctif « rien ne se passe »** : l'écouteur de messages était branché trop tard (jamais en pause ni sur un site exclu), donc la demande d'OCR du popup n'arrivait nulle part. Il est maintenant branché dès le démarrage, chaque refus affiche un message **visible dans la page**, le voile porte des **styles en ligne** (indépendants de la feuille injectée), et un raccourci de secours <kbd>Alt</kbd>+<kbd>Maj</kbd>+<kbd>O</kbd> lance la sélection. 8 nouveaux tests de robustesse. || 11 | À faire | — | — |
| 9quater | Livrée | 16/10 | **Correctif d'architecture** : le moteur OCR était hébergé dans le script d'arrière-plan, or Firefox décharge cette « page d'événement » dès qu'elle est inactive → une lecture de plusieurs secondes mourait en silence (le voile s'affichait, puis rien). Le moteur revient dans une vraie page d'extension (`src/engine.html`), ouverte en arrière-plan, réutilisée et refermée après 2 min d'inactivité. L'arrière-plan ne garde que capture et découpe. **Nouveau bouton « Tester le moteur OCR »** dans les réglages : diagnostic en un clic, indépendant de la capture. 5 tests ajoutés. |
| 9quinquies | Livrée | 16/10 | **Correctif du passage image → moteur** : l'échelle de découpe était supposée égale à `devicePixelRatio` ; elle est désormais calculée (`largeur réelle de la capture ÷ largeur du viewport`), ce qui corrige les découpes à côté du texte (zoom de page, Retina, capture réduite) — cause du « aucun texte reconnu ». Le moteur décode en outre l'image en canvas avant lecture (chemin fiable). **Diagnostic visuel** : l'onglet moteur affiche « Dernière zone reçue », et la bulle affiche les dimensions analysées. 3 tests ajoutés. |---
| 9sexies | Livrée | 16/10 | **Le vrai défaut de l'OCR, trouvé par l'utilisateur** : la bulle « lecture en cours » s'affichait AVANT la photographie. Sur une petite zone, elle recouvrait le prix — l'OCR lisait donc la bulle. Sur une grande zone, le texte restait lisible, d'où l'impression que « ça marchait parfois ». L'ordre est inversé : retirer le voile et toute bulle → attendre le repeint (2 images + 70 ms) → photographier → seulement ensuite afficher l'indicateur. La demande est coupée en deux messages (`ocr-capture` puis `ocr-recognize`). Un test vérifie qu'aucune bulle n'est visible au moment de la photo. |
| 9septies | Livrée | 16/10 | Trois défauts signalés : (1) la bulle réaffichait le prix lu au lieu de le convertir — la conversion devient la **ligne principale**, la raison d'un échec est affichée et un second essai est tenté ; (2) l'onglet moteur montrait une image et un texte sans rapport (le texte n'était mis à jour que par le bouton de test) — toute lecture synchronise désormais l'aperçu et le texte ; (3) le faux DOM des tests ne savait pas faire `querySelector`, ce qui masquait la mise à jour de la bulle. 3 tests ajoutés (conversion en ligne principale, échec expliqué). |# Reprise de la session — où on en est
| 9octies | Livrée | 16/10 | **Format `679€99` pris en charge** (centimes en exposant, mis à plat). Ce n'était pas un défaut d'OCR : le texte était parfaitement lu, mais le détecteur refusait le montant — « 679 € » était rejeté car suivi de `99`, et « €99 » car précédé de `679`. Un troisième motif (nombre + symbole + centimes) comble le trou, et bénéficie aussi au texte des pages, pas seulement à l'OCR. 4 cas ajoutés aux données de test + 3 lignes visibles dans `formats.html`. |
| 9nonies | Livrée | 16/10 | **L'OCR n'est plus isolé** : la bulle d'un résultat OCR emprunte désormais le MÊME chemin qu'un clic sur un montant — conversion en ligne principale, ligne du taux, **menu de devises** (recherche, drapeaux, épinglage) et poignée de redimensionnement. Le texte reconnu part dans la console (et dans l'onglet moteur) pour ne pas encombrer la bulle. Le montant reconnu ayant la même forme qu'un montant détecté, aucun code n'a été dupliqué : tout ajout futur au menu profite à l'OCR. 2 tests ajoutés (menu présent, devises listées). 
| **Version actuelle de l'extension : 2.9.10**
| 10 | **Arrêtée le 24/10** (non retenue) | 16/10 | **OCR automatique** : score de pertinence (mots de prix, symbole monétaire, taille, prix en texte à proximité, bouton d'achat), analyse au **survol prolongé de 800 ms**, **budget de 5 images par page** (réglable 1–20), **cache** par image, une seule analyse à la fois, arrêt si l'onglet est en arrière-plan, **désactivé par défaut**. Pastille « OCR… » sur l'image pendant la lecture, statistiques dans le popup (analysées / ignorées / budget / temps moyen), seuil et budget dans les réglages. `test/ocr-auto.html` : 50 images dont 6 candidates, **auto-diagnostique** (tableau de bord, repli mémoire des images illisibles, rapport copiable). 21 tests dédiés dans `dynamic-tests` + 37 dans `page-tests`. **Corrections 0.23.0** (itération finalement arrêtée) : plus de pastille photographiée, verrou d'analyse couvrant toute la lecture (+ garde-fou 30 s), reprise de l'image survolée pendant une lecture, compteur d'ignorées non gonflé, texte lu affiché en console, marqueur de code `data-unic-build` contre l'extension fantôme, **cache par vignette** (et non par fichier image), **bulle de l'OCR automatique non bloquante** (survoler une autre image relance la lecture sans clic). |
| 11 | **Validée le 24/10** | 24/10 | **Fuseaux horaires** : 33 cas de formats d'heure (24 h, `14h30`, 12 h AM/PM, ISO 8601, RFC 2822), ~50 abréviations (choix des ambiguïtés documenté), noms IANA (heure d'été comprise), formules « heure de Paris » / « Pacific Time », décalages à 5 h 45, **132 villes** avec menu au clic (recherche, drapeaux, épinglage, « ma position »), décalage et changement de jour affichés. Module **pur** extrait et testé hors navigateur (`timezone-tests`, 80 vérifications), page `test/fuseaux.html` (33 cas + 15 pièges), réglages (activation, ville, format 12/24 h). |
| 12 | Livrée, en attente du test visuel | 24/10 | **Polissage et publication** : nettoyage (`styles.css` supprimé), accessibilité (Échap ferme la bulle, focus clavier visible, `aria-label`/`aria-pressed`/`lang`, contrastes recalculés et corrigés, poignée réglable aux flèches), mesures de performance (3,8 µs par ligne, 400 Ko en 253 ms), **archives reproductibles** `dist/uniconv-1.0.0.xpi` et `-chrome.zip` (manifeste Chrome adapté, service worker), `README.md`, politique de confidentialité, guide de publication AMO/Chrome, 2 nouvelles suites (`accessibility-tests`, `release-tests`). |
| 13 | Livrée, en attente de validation | 25/10 | **Optimisation et navigateurs** : caches `Intl` (×25 sur le formatage), court-circuit du survol sans montant, mémoïsation des zones interdites, élagage mémoire, `Range` réutilisé, code mort supprimé ; paquets Firefox, Chromium et Safari ; mesures de performance (rafale 3 500 nœuds : 366 ms) ; `compat-tests`. |
| 14 | Livrée, en attente de validation | 25/10 | **OCR des unités et quarts** : l'OCR convertit les montants, **toutes les unités** et les heures (même chemin qu'un clic) ; ajout du quart US (0,946352946 L) et règle anti-fraction ; 17 vérifications ajoutées. |
| 15 | Livrée, en attente de validation | 25/10 | **Corrections OCR/unités** : « unreal » n'est plus un real brésilien (espace obligatoire) ; alias majuscules des unités (`2.1 QT`, `10 IN`) ; règles insensibles à la casse ; piège n° 61. |
| 16 | Livrée, en attente de validation | 25/10 | **Écritures des unités** : inventaire complet (`docs/UNITES-ECRITURES.md`) ; mots pleins, températures en toutes lettres, Kelvin contextuel, tonne/mg/cl/fl oz/tsp/nœud/m/s/nmi/µm, fractions (1/2, 2½, ½) ; 37 tests unités + 2 OCR. |
| 17 | Livrée, en attente de validation | 26/10 | **Ville + fuseau** : la ligne cible affiche « Paris (Europe/Paris) », « Ma ville » aussi, et les libellés du menu ne tronquent plus le fuseau. |
| 18 | Livrée, en attente de validation | 26/10 | **Décalage GMT** à côté de chaque ville (`Paris (GMT+2)`, `Mumbai (GMT+5:30)`), calculé à la date de l'heure ; première ligne « 14h30 à Paris ». |
| 19 | Livrée, en attente de validation | 26/10 | **Fourchettes de prix** : « 2000 - 3000 CNY » détectée et convertie comme une seule fourchette ; tous les séparateurs et places de devise ; garde-fous notes/téléphones/dates. |
| 20 | Livrée, en attente de validation | 26/10 | **FLE/PHP + navigation** : milliers à points (`70.000`) et PHP ; barre de navigation sur les 5 pages de test. |
| 21 | Livrée, en attente de validation | 26/10 | **Pesos génériques** : « 135 pesos » → MXN par défaut ; formes précises (PHP, ARS) inchangées ; fourchette « Entre 135 et 150 pesos ». |
| 22 | Livrée, en attente de validation | 26/10 | **Dollar de Brunéi** : BND ajouté ; « 500BND » détecté ; recherche « brunei » ; 168 devises. |
| 23 | Livrée, en attente de validation | 26/10 | **Audit mémoire** : fourchettes sautées sans chiffre, unités sans lettre, cache de fuseaux borné ; 46 devises détectées / 168 cibles ; outil `memory-report.mjs`. |
| 24 | Livrée, en attente de validation | 26/10 | **167 devises** détectées (codes + noms, casse ignorée) ; **4e source de taux** indépendante et test de repli ; 5 hôtes. |
| 25 | Livrée, en attente de validation | 26/10 | **Convertisseur popup** (devises + unités), bouton OCR dans l'en-tête, page **Monnaies** (167 lignes) et bandeau de navigation complété. |
| 26 | Livrée, en attente de validation | 26/10 | **Scan**, case OCR, tutoriel à l'installation, raccourcis personnalisables et page convertisseur au champ sélectionné ; proposition de traduction ONU. |
| 27 | Livrée, en attente de validation | 26/10 | **5 langues** (fr/en/es/ru/zh) avec libellés traduits et messages de bulle ; **case Scan dans le popup**. |
| 28 | Livrée, en attente de validation | 26/10 | **Frontières de devises** (KES dans « takes ») et **case Detection** dans le popup ; raccourci pause retiré. |
| 29 | Livrée, en attente de validation | 26/10 | **Six langues** (dont arabe RTL), repli anglais, **engrenage** en haut à droite, popup sans barre horizontale, **OCR automatique supprimé** (code, réglages, page et suite de test). |
| 30 | Livrée, en attente de validation | 26/10 | **Popup 360 px** avec gouttière réservée, **engrenage 30 px SVG 18 px aligné**, design 2.0.1 (six surfaces, cadres S12–S14, RTL). |
| 31 | Livrée, en attente de validation | 26/10 | **Yuan** (RMB/renminbi/元), **ordres de grandeur** k/m/b, correctif KES « takes 6 », **menu contextuel Convertir**. |
| 32 | Livrée, en attente de validation | 26/10 | **Devise de départ modifiable** dans la bulle figée (¥ ambigu → CNY/USD), liste des 167 devises, reconversion immédiate. |
| 33 | Livrée, en attente de validation | 26/10 | **Unités de référence** (monnaie/fuseau/unités), plus de pointillés sur les valeurs de référence, cible temporaire, devise de départ avec recherche et 10 résultats. |
| 34 | Livrée, en attente de validation | 27/10 | **Correctif cadre de référence** : initialisation au démarrage, champ monnaie cliquable + menu recherche, fuseau peuplé, recherche de la devise de départ réparée. |
| 35 | Livrée, en attente de validation | 27/10 | **Menus de devises complets** : toutes les monnaies, ~10 lignes visibles, défilement, combobox de départ dans la bulle. |
| 36 | Livrée, en attente de validation | 27/10 | **Signes de devise source et cible cliquables** dans la bulle, menus flottants avec recherche, toutes les monnaies, 10 lignes visibles. |
| 37 | Livrée, en attente de validation | 27/10 | **Épinglage et devises principales** dans les menus source, destination et monnaie de référence. |
| 38 | Livrée, en attente de validation | 27/10 | **Drapeaux emoji** et **ordre d'importance** des devises principales dans les menus. |
| 39 | Livrée, en attente de validation | 27/10 | **Scanner au clic droit** avec logo, **5 principales**, séparateurs contrastés. |
| 40 | Livrée, en attente de validation | 27/10 | **Clic sur un signe en survol** : fige la bulle et ouvre le menu. |
| 41 | Livrée, en attente de validation | 27/10 | **OCR multi-essais** (3×, binaire, inversé, PSM 6/7/11) + secours texte HTML. |
| 42 | Livrée, en attente de validation | 27/10 | **Somme éditable**, fermeture au scroll, **rapport de bug OCR** local. |
| 43 | Livrée, en attente de validation | 27/10 | **Correctif traces d'édition** + **survol** du champ de somme. |
| 44 | Livrée, en attente de validation | 27/10 | **Design 16-bit / GBA** sur toutes les surfaces + **bulle de devise compacte**. |
| 45 | Livrée, en attente de validation | 27/10 | **Audit lisibilité** : cadres retirés, bulle sur une ligne, bouton après le montant. |
| 46 | Livrée, en attente de validation | 27/10 | **État figé** : nuance plus sombre + effet enfoncé, sans déplacement. |
| 47 | Livrée, en attente de validation | 27/10 | **Multiplicateurs en mots** (billion, milliard…) + rapport de bug sans bulle. |
| 48 | Livrée | 27/10 | **Audit/optimisation**, portabilité, guide GitHub. |
| 49 | Livrée, en attente de validation | 27/10 | **Rubrique Ko-fi** en bas du popup. |
| 50 | Livrée, en attente de validation | 27/10 | **Lien Ko-fi personnalisé** `fingersmooth`. |
| 51 | Livrée, en attente de validation | 27/10 | **Audit sécurité** : sender.id, taux, OCR/rapport, permissions, CSP. |
| 52 | Livrée, en attente de validation | 29/10 | **Combobox de devise** avec recherche dans le convertisseur du popup. |
**Dernière session : 24/10.**

## État du dossier

82 fichiers (hors archives), environ 9,2 Mo (dont **8,2 Mo de moteur OCR**). Tout est écrit,
validé et testé :

| Vérification | Résultat |
|---|---|
| Syntaxe de `content.js`, `background.js`, `popup.js`, `options.js` | OK |
| Manifeste JSON, fichiers référencés, page d'options, page OCR | Valides, aucun manquant |
| Numéros de version | Cohérents en 2.9.10 partout |
| Empaquetage | `.xpi` (Firefox) + `-chromium.zip` (Chrome/Edge/Brave/Opera/Vivaldi) + `-safari.zip` + dossier Safari, contenu vérifié |
| Refonte visuelle | **En cours** — brief livré (`docs/DESIGN-SPEC.md`, `docs/design/`), maquettes externes attendues |
| `node tools/run-tests.mjs` — moteur de détection et fourchettes | 134 / 134 |
| `node tools/smoke-test.mjs` — exécution, souris, images | 57 / 57 |
| `node tools/background-test.mjs` — arrière-plan, cache, 4 sources | 30 / 30 |
| `node tools/audit-tests.mjs` — conversions vérifiées à la main | 26 / 26 |
| `node tools/units-tests.mjs` — unités (toutes écritures, Kelvin, fractions) | 104 / 104 |
| `node tools/currency-meta-tests.mjs` — nom + drapeau par devise | 13 / 13 |
| `node tools/currency-search-tests.mjs` — recherche par pays | 33 / 33 |
| `node tools/dynamic-tests.mjs` — dynamique, garde-fous, réglages, OCR, fuseaux | 155 / 155 |
| `node tools/false-positive-tests.mjs` — faux positifs | 90 / 90 |
| `node tools/options-tests.mjs` — page de réglages | 35 / 35 |
| `node tools/ocr-tests.mjs` — OCR (géométrie, chemins, découpe) | 50 / 50 |
| `node tools/timezone-tests.mjs` — fuseaux horaires (GMT, formats, conversion) | 91 / 91 |
| `node tools/accessibility-tests.mjs` — ARIA, clavier, contrastes | 28 / 28 |
| `node tools/release-tests.mjs` — empaquetage, icônes, performance, documents | 46 / 46 |
| `node tools/compat-tests.mjs` — manifestes et API des trois navigateurs | 42 / 42 |
| `node tools/popup-tests.mjs` — popup, convertisseur, tutoriel, langues | 49 / 49 |

**Total : 983 vérifications, 0 échec (16 suites).**

## Ce qui fonctionne déjà (constaté dans Firefox)

- Conversion des heures avec fuseau (132 villes, heure d'été comprise,
  décalage et changement de jour affichés).
- Détection de tous les formats de devises et des unités, y compris les prix
  **coupés en plusieurs balises** (Amazon) et **recouverts d'un lien
  transparent**.
- Bulle au survol avec les **vrais taux** (cache 12 h, secours hors ligne),
  menu de choix au clic, contenu dynamique, faux positifs filtrés.
- Pause globale et badge **OFF**, liste noire, prix dans les attributs
  d'image, **page de réglages** complète.
- **Nouveau (itération 9)** : lecture d'un prix **dessiné dans une image**, par
  sélection d'un rectangle — moteur OCR embarqué, aucun envoi réseau.

## À faire à la prochaine session

1. Rouvrir le **Terminal** et relancer le serveur de test :
   `cd ~/Documents/UniConv && python3 -m http.server 8123`
2. **Recharger** l'extension (obligatoire : nouvelle permission et nouveau
   moteur).
3. Suivre `docs/OCR.md`, section 7 (5 minutes) : le rectangle se dessine
   directement sur la page, et le résultat s'affiche dans une bulle.

## Ensuite : itération 10

L'**OCR automatique** a été essayé puis **supprimé en 2.0.0** : trop coûteux
(1 à 5 s par image) et moins précis que le Scan manuel. Ne pas le relancer ;
le Scan (bouton ou raccourci personnel) reste la seule lecture d'images.

---

# Leçons de la session du 14/10

Cette première itération a été longue. Les cinq bugs rencontrés, et comment ils
ont été trouvés :

| # | Bug | Trouvé par | Désormais couvert par |
|---|---|---|---|
| 1 | `data_collection_permissions` absent du manifeste (obligatoire depuis Firefox 140) | Documentation Mozilla | — |
| 2 | Extension fantôme : une ancienne copie restait active et injectait son script à la place de la nouvelle | **Console de l'utilisateur** | Procédure de nettoyage dans `INSTALL.md` |
| 3 | `WeakMap.forEach` : méthode inexistante (une WeakMap n'a que get, set, has, delete) | **Console de l'utilisateur** | `smoke-test.mjs` |
| 4 | `position.node` au lieu de `position.offsetNode` (API CaretPosition) | **Console de l'utilisateur** + MDN | `smoke-test.mjs` |
| 5 | Zone de survol trop large d'un caractère (erreur « off-by-one ») | **Observation visuelle de l'utilisateur** | `smoke-test.mjs` |

**Trois leçons à retenir pour la suite :**

1. **Changer une seule chose à la fois.** Entre l'itération 0 (qui marchait) et
   l'itération 1, trois fichiers et une feuille de style ont été ajoutés d'un
   coup. Le diagnostic en a été considérablement rallongé.
2. **Vérifier qu'on teste bien le bon code** avant de corriger quoi que ce soit.
   Pendant trois échanges, le vrai problème était qu'une ancienne version
   s'exécutait — toutes les corrections portaient donc sur du code mort.
3. **Un test qui simule le navigateur doit imiter la réalité, pas arranger le
   code.** Le simulateur utilisait le même mauvais nom de propriété que le code
   testé (`node` au lieu de `offsetNode`) : il validait donc l'erreur au lieu de
   la détecter.
