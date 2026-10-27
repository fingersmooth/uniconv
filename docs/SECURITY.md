# UniConv — audit de sécurité

Date : 2026-10-27  
Version auditée : **2.9.8**  
Périmètre : manifeste, arrière-plan, content script, moteur OCR, popup,
réglages, rapport de bug, stockage local et appels réseau.

## 1. Modèle de menace

- **Page web non fiable** : peut contenir du texte, des images, du CSS et des
  scripts hostiles. Le content script est isolé, mais doit traiter du texte
  arbitraire.
- **Autre extension** : peut envoyer des messages à UniConv si elle connaît son
  identifiant. Elle ne doit pas pouvoir déclencher une capture d'écran, un OCR
  ou une écriture de rapport.
- **API de taux compromise ou défaillante** : peut renvoyer des nombres
  absurdes, négatifs, infinis ou un JSON mal formé.
- **Stockage local** : peut contenir des valeurs corrompues ou d'anciennes
  versions.
- **Rapport de bug** : contient une capture d'écran et du texte de page, donc
  potentiellement des données sensibles.

## 2. Failles et faiblesses trouvées

| ID | Sévérité | Constat | Correctif |
|---|---|---|---|
| SEC-01 | **Moyenne** | Les messages `chrome.runtime.onMessage` n'étaient pas authentifiés. Une autre extension pouvait potentiellement déclencher `ocr-capture`, `bug-report`, `set-paused` ou une conversion. | Vérification de `sender.id === chrome.runtime.id` dans l'arrière-plan, le content script et le moteur OCR. |
| SEC-02 | Faible | Les taux reçus ou relus du stockage n'étaient pas tous bornés : valeurs négatives, nulles, infinies ou absurdes possibles. | `isSafeRate` (fini, > 0, ≤ 1e9), `sanitizeRates` pour le réseau et le cache, validation dans `convert`. |
| SEC-03 | Faible | Les paramètres OCR (`rect`, `dpr`, `viewport`) et le rapport de bug pouvaient être arbitrairement grands ou malformés. | `normalizeOcrRect`, `normalizeViewport`, `normalizeDpr`, `sanitizeBugReport` et limites de taille. |
| SEC-04 | Faible | L'image du rapport était acceptée sans contrôle de type ni de taille. | Validation `data:image/png;base64,` et limite de 8 Mo. |
| SEC-05 | Faible | Les permissions d'hôtes étaient plus larges que nécessaire (`https://cdn.jsdelivr.net/*`, etc.). | Permissions réduites aux chemins réellement utilisés. |
| SEC-06 | Faible | La CSP n'interdisait pas `base-uri` et `form-action`. | Ajout de `base-uri 'none'; form-action 'none'`. |
| SEC-07 | Faible | La taille de bulle mémorisée pouvait être une valeur énorme ou négative. | Bornage 240–700 px et hauteur de liste 100 px–fenêtre. |
| SEC-08 | Faible | Le rapport de bug pouvait rester indéfiniment dans le stockage local. | Bouton **Supprimer le rapport** et validation de l'image. |
| SEC-09 | Information | Aucun `innerHTML`, `outerHTML`, `document.write`, `eval` ou `new Function` dans le code runtime. | Conservé : tout le texte dynamique passe par `textContent`. |
| SEC-10 | Information | Aucun script distant : Tesseract est embarqué localement ; les seuls accès réseau sont les API de taux. | À maintenir lors des mises à jour. |

## 3. Ce qui n'est pas une faille mais reste un risque

- **Capture d'écran sensible** : l'OCR et le rapport sont déclenchés par
  l'utilisateur et restent locaux, mais la capture peut contenir des données
  privées. Le bouton de suppression permet de l'effacer.
- **Confiance dans les API de taux** : elles ne sont pas signées. La fusion de
  quatre sources limite une source défaillante, mais ne prouve pas l'exactitude
  économique d'un taux.
- **Content script sur tous les sites** : nécessaire au fonctionnement. Il ne
  modifie pas la page et ne lit que le texte utile au survol.
- **Tesseract.js embarqué** : version vendorisée ; il faut la mettre à jour lors
  des releases de sécurité.

## 4. Tests de non-régression

Les contrôles de sécurité sont dans `tools/compat-tests.mjs` :

- rejet des messages d'autres extensions ;
- validation des taux réseau et stockés ;
- bornage des entrées OCR/rapport ;
- type et taille de l'image du rapport ;
- CSP `base-uri` / `form-action` ;
- permissions d'hôtes minimales.

Ils s'ajoutent aux 16 suites existantes.

## 5. Recommandations avant publication

1. Utiliser un identifiant d'extension Firefox stable et un domaine contrôlé.
2. Signer les paquets dans les tableaux de bord AMO / Chrome / Apple.
3. Vérifier les captures d'écran du rapport avant de les envoyer.
4. Mettre à jour Tesseract.js et les modèles de langue lors des montées de
   version.
5. Ne jamais ajouter de script distant ni de `innerHTML` pour du texte venant
   d'une page.
