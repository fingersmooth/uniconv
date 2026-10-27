# Publier UniConv — guide pas à pas

**Version 2.9.7.** Ce document décrit la fabrication des archives, la
soumission à Firefox (AMO) et à Chrome, et le processus de mise à jour.

---

## 1. Avant de publier — liste de contrôle

- [ ] Toutes les suites passent : `node tools/release-tests.mjs` (empaquetage,
      icônes, performance, documents, versions).
- [ ] La version est cohérente dans les **6** fichiers (`manifest.json`,
      `background.js`, `content.js`, `engine.js`, `options.js`, `popup.js`).
- [ ] Une seule extension « UniConv » dans `about:debugging` (pas de fantôme).
- [ ] Test manuel sur un profil neuf : devises, unités, fuseaux, OCR manuel.
- [ ] `docs/CONFIDENTIALITE.md` à jour.
- [ ] Licence choisie (à définir) et ajoutée au `README.md`.
- [ ] Captures d'écran préparées (voir § 5).

---

## 1bis. Comptes et coûts des stores

| Store | Compte à créer | Coût | Lien |
|---|---|---|---|
| Firefox / AMO | Compte Mozilla | **Gratuit** | <https://addons.mozilla.org/developers/> |
| Chrome Web Store | Compte Google + développeur | **5 $ US une fois** | <https://chrome.google.com/webstore/devconsole> |
| Microsoft Edge Add-ons | Compte Microsoft + Partner Center | **Gratuit** | <https://partner.microsoft.com/dashboard/microsoftedge/overview> |
| Opera Add-ons | Compte Opera | **Gratuit** | <https://addons.opera.com/developer/> |
| Safari / App Store | Apple Developer Program | **99 $ US/an** | <https://developer.apple.com/programs/> |
| GitHub | Compte GitHub | **Gratuit** | <https://github.com/> |
| Ko-fi (optionnel) | Compte Ko-fi | **Gratuit** | <https://ko-fi.com/> |

- **Brave et Vivaldi** n'ont pas de store propre : ils passent par le Chrome
  Web Store (donc le compte Chrome à 5 $).
- Les frais Chrome sont **uniques** et liés au compte Google utilisé ; utiliser
  un compte durable, car l'adresse ne se change pas facilement ensuite.
- Apple facture l'adhésion **chaque année** ; les tests locaux dans Xcode
  peuvent se faire avec un compte Apple, mais la distribution App Store exige
  l'adhésion payante.
- Les prix peuvent inclure la TVA/locale ; prévoir une carte bancaire.
- Total indicatif : **5 $ la première année si tu commences par Chrome**, ou
  **104 $ la première année** si tu ajoutes Apple. Renouvellement Apple :
  **99 $/an**.
- Les stores ne facturent pas la soumission ni la review. Une politique de
  confidentialité peut être hébergée gratuitement sur GitHub Pages.

## 2. Fabriquer les archives

```bash
cd ~/Documents/UniConv
node tools/package.mjs
```

Résultat :

- `dist/uniconv-<version>.xpi` → **Firefox** (manifeste avec `background.scripts`
  et bloc `gecko`) ;
- `dist/uniconv-<version>-chromium.zip` → **Chrome, Edge, Brave, Opera,
  Vivaldi** (manifeste avec `background.service_worker`, sans bloc `gecko`) ;
- `dist/uniconv-<version>-safari.zip` et `dist/safari/uniconv-<version>/` →
  **Safari** (même manifeste que Chromium, source à convertir en projet Xcode).

Le script **échoue** si un fichier cité par le manifeste manque, si le
manifeste n'est pas à la racine de l'archive, ou si un fichier de `docs/`,
`test/` ou `tools/` s'y est glissé.

---

## 3. Firefox — addons.mozilla.org (AMO)

1. Créer un compte gratuit sur <https://addons.mozilla.org>.
2. « Developer Hub » → « Submit a New Add-on » → fichier `.xpi`.
3. Choisir « On this site » (recommandé) : AMO **signe** l'extension
   automatiquement et l'installe en un clic.
4. Renseigner la fiche :
   - **Nom** : UniConv ;
   - **Résumé** (≤ 250 caractères) : « Convertit au survol les montants en
     devises, les unités de mesure et les heures avec fuseau. Lecture de prix
     dans les images, hors ligne. Aucune donnée collectée. » ;
   - **Catégorie** : Productivité ;
   - **Langues** : français, anglais ;
   - **Politique de confidentialité** : reprendre `docs/CONFIDENTIALITE.md`.
5. **Justifier chaque permission** (le validateur pose la question) :

   | Permission | Justification à copier |
   |---|---|
   | `storage` | Mémoriser les réglages, le cache des taux (12 h) et les listes épinglées. |
   | `activeTab` | Lire la zone que l'utilisateur dessine pour l'OCR, uniquement sur son geste. |
   | `api.frankfurter.dev` | Récupérer les taux de change (source principale). |
   | `cdn.jsdelivr.net` | Source de taux secondaire (devises absentes de Frankfurter, ex. AED). |
   | `latest.currency-api.pages.dev` | Même source secondaire, miroir. |
   | `open.er-api.com` | Taux élargis (160+ devises). |
   | `api.exchangerate-api.com` | 4e source de secours, indépendante. |
   | `content_scripts` `http/https` | Lire le texte affiché pour détecter et convertir les montants, unités et heures. Aucune donnée n'est transmise. |

6. Citer la permission `data_collection_permissions: none` (déjà dans le
   manifeste) : aucune collecte.
7. Soumettre. La validation prend de quelques heures à deux semaines.
8. Installer depuis la fiche, puis vérifier l'affichage de la version.

### Signature locale (optionnel)

Pour installer l'`.xpi` signé hors AMO (Firefox Developer Edition / Nightly) :

```bash
npx web-ext sign --api-key <clé> --api-secret <secret>
```

Sur un Firefox standard, les extensions non signées ne s'installent que via
« module temporaire » (disparaît à la fermeture).

---

## 4. Chromium — Chrome Web Store, Edge Add-ons, Opera

Le **même ZIP** sert à Chrome, Edge, Brave, Opera et Vivaldi.

1. Chrome : compte développeur 5 $ une fois, vérification d'identité possible.
   Edge et Opera : comptes gratuits.
2. Envoyer `dist/uniconv-<version>-chromium.zip` (Chrome Web Store :
   « New item » ; Edge : Partner Center ; Opera : Add-ons).
3. Remplir la fiche (mêmes textes), joindre captures et icônes.
4. Justifier les permissions (mêmes arguments qu'AMO ; `host_permissions`
   apparaissent comme « Lire et modifier vos données sur… »).
5. Soumettre ; la validation prend souvent 1 à 3 jours.

> Le manifeste Chromium est produit automatiquement (service worker, sans bloc
> `gecko`) : ne pas réutiliser l'`.xpi` Firefox.
>
> **Brave et Vivaldi** n'ont pas de store propre : ils installent depuis le
> Chrome Web Store, ou en mode développeur avec le dossier dézippé.

## 4bis. Safari — Mac App Store

Safari exige un **projet Xcode** : Apple ne distribue pas d'extension seule.

1. Installer Xcode (Mac App Store) et accepter la licence.
2. Convertir le dossier fourni :
   ```bash
   xcrun safari-web-extension-converter dist/safari/uniconv-<version> \
     --app-name UniConv --bundle-identifier com.exemple.uniconv
   ```
   La commande crée un projet Xcode avec l'extension et l'application hôte.
3. Ouvrir le projet, choisir l'équipe de signature, lancer pour tester.
4. Pour publier : compte Apple Developer (99 $/an), archiver l'application et
   la soumettre au Mac App Store (ou distribuer l'app signée hors store).
5. **Limite** : la capture d'écran (`tabs.captureVisibleTab`) peut être refusée
   par Safari ; l'OCR manuel affiche alors un message clair. Le reste
   (devises, unités, fuseaux) fonctionne.

> Safari 16.4 minimum. Le dossier `dist/safari/uniconv-<version>/` est déjà
> décompressé pour la commande ci-dessus.

---

## 5. Visuels

- **Icônes** : déjà présentes (`icons/icon16|32|48|128.png`).
- **Captures** : 3 à 5, en 1280×800 de préférence :
  1. bulle sur un prix (devises) ;
  2. menu des devises avec recherche et drapeaux ;
  3. fuseaux horaires (`14:30 CET` → heure de la ville choisie) ;
  4. unités de mesure ;
  5. OCR manuel (rectangle sur une image).
- **Bannière** : 1200×630 pour la fiche.

---

## 6. Mettre à jour

1. Modifier le code et les tests.
2. Incrémenter la version dans **les 6** fichiers (patch : 0.24.1, mineure :
   0.25.0).
3. `node tools/package.mjs`, puis relancer `node tools/release-tests.mjs`.
4. AMO : « Upload a New Version » → l'extension se met à jour chez les
   utilisateurs après validation.
5. Chromium (Chrome/Edge/Opera) : « Upload new package » ;
   Safari : régénérer le projet Xcode (section 4bis) et archiver.
6. Vérifier `node tools/compat-tests.mjs` (manifestes + API) avant chaque envoi.
6. Reporter la date et les changements dans `docs/ROADMAP.md`.

> Le **marqueur de code** (`CONTENT_BUILD_TAG` dans `content.js`) doit changer
> à chaque modification du script de page : il permet aux pages de test de
> détecter une extension fantôme. Le marqueur est aussi écrit dans
> `<style data-unic-build>` ; il n'y a plus de page de test dédiée.

---

## 7. Notes de version (modèle)

```
0.24.0 — 24/10/2026
- Ajout : conversion des fuseaux horaires (132 villes, 12/24 h).
- Accessibilité : Échap ferme la bulle, focus clavier visible, contrastes
  conformes, poignée réglable aux flèches.
- Publication : archives Firefox et Chrome reproductibles, README et politique
  de confidentialité.
- Retrait : OCR automatique au survol (expérimental, arrêté).
- Optimisations : caches de formateurs (25× sur le formatage), aucun test de
  position au survol sur une page sans montant, nœuds disparus élagués.
- Compatibilité : paquets Firefox, Chromium (Chrome/Edge/Brave/Opera/Vivaldi)
  et Safari.
```
