# UniConv — liste de contrôle de l'itération 8

Version 0.15.0. À cocher après chaque installation ou mise à jour.
Durée : environ 10 minutes.

Guide détaillé : `docs/OPTIONS.md`.

---

## Avant de commencer

- [ ] L'extension est **rechargée** (`about:debugging` → Recharger)
- [ ] Le serveur de test tourne : `cd ~/Documents/UniConv && python3 -m http.server 8123`
- [ ] L'onglet A est ouvert sur `http://localhost:8123/test/formats.html`
- [ ] L'onglet B est ouvert sur les **réglages** (popup → « Ouvrir les réglages »)

---

## 1. La page s'ouvre et affiche la bonne version

- [ ] La page s'ouvre dans un onglet
- [ ] En haut à droite : `version 0.15.0`
- [ ] Six blocs visibles : Devise cible, Ce que l'extension convertit,
      Affichage, Sites exclus, OCR, Sauvegarde, Remise à zéro
- [ ] La console (`Cmd` + `Option` + `K`) est **vide** d'erreur

---

## 2. Devise cible

- [ ] Le champ de recherche filtre la liste (`yen` ne garde que les yens)
- [ ] Le nom du pays fonctionne (`chine` propose le yuan)
- [ ] Choisir **JPY** → dans l'onglet A, `10 €` donne des **yens**, sans recharger A
- [ ] Revenir à **USD** → l'onglet A affiche de nouveau des dollars

---

## 3. Couverture

- [ ] **Devises OFF** → dans A, plus aucun prix souligné ; les unités
      (section 4 de la page de test) restent soulignées
- [ ] **Unités OFF** → l'inverse : les prix restent, les unités disparaissent
- [ ] **Devises ON + Unités ON** → tout revient

---

## 4. Affichage

- [ ] **Thème Clair** → la bulle devient blanche, texte foncé, lisible
- [ ] **Thème Sombre** → la bulle redevient bleu foncé
- [ ] **Thème Auto** → suit le réglage clair/sombre de macOS
- [ ] **Délai 250 ms** → la bulle met un quart de seconde à apparaître
- [ ] **Délai 0** → la bulle est immédiate
- [ ] **Langue English** → le format des nombres devient `1,234.56`
- [ ] **Langue Français** → retour à `1 234,56`
- [ ] Redimensionner la bulle, fermer, rouvrir → la taille est conservée
- [ ] **Réinitialiser la taille** → la bulle revient à sa largeur d'origine

---

## 5. Sites exclus

- [ ] Ajouter `https://Exemple.com/page` → la liste affiche `exemple.com`
- [ ] Ajouter `exemple.com` une deuxième fois → message « déjà dans la liste »
- [ ] Ajouter `exemple` → message d'erreur explicite
- [ ] Ajouter `exa mple.com` → message d'erreur explicite
- [ ] Ajouter `192.168.1.1` → message d'erreur explicite
- [ ] Ajouter `localhost`, **recharger l'onglet A** → aucune bulle, aucune erreur
- [ ] Retirer `localhost`, recharger A → les bulles reviennent
- [ ] Ouvrir `github.com` → **aucune** bulle nulle part (liste par défaut)

---

## 6. OCR (préparation)

- [ ] L'interrupteur est présent et **désactivé** par défaut
- [ ] L'activer → « Enregistré (sans effet pour l'instant) »
- [ ] Aucun comportement ne change (aucune analyse d'image)

---

## 7. Sauvegarde et remise à zéro

- [ ] **Copier** → un JSON apparaît dans la zone de texte
- [ ] **Télécharger** → un fichier `uniconv-reglages.json` arrive dans Téléchargements
- [ ] Modifier un réglage, puis **Importer** l'ancien JSON → le réglage revient
- [ ] Coller `{ pas du json` puis **Importer** → message « JSON invalide »
- [ ] Coller `{"uniconv.hoverDelay": 99999}` puis **Importer** → refusé, expliqué
- [ ] **Tout réinitialiser** → demande confirmation, puis tout revient par défaut

---

## 8. Persistance

- [ ] Quitter **complètement** Firefox (`Cmd` + `Q`)
- [ ] Relancer Firefox, recharger l'extension
- [ ] Les réglages sont **conservés** (devise cible, thème, délai, sites exclus)

---

## 9. Non-régression (l'essentiel)

- [ ] `test/formats.html` : les prix et les unités se survolent normalement
- [ ] `test/faux-positifs.html` : les 61 pièges restent muets
- [ ] `test/dynamique.html` : les prix injectés sont détectés
- [ ] Amazon : prix principal et **cases de variantes** fonctionnent
- [ ] La case **« Activer la detection »** du popup suspend l'extension (icône **OFF**) quand elle est décochée.

---

## 10. Vérification automatique

```bash
cd ~/Documents/UniConv
node tools/options-tests.mjs
#   Resultat : 35 reussi(s), 0 echec(s)
```

Toute la batterie :

```bash
cd ~/Documents/UniConv
for f in run-tests smoke-test background-test audit-tests units-tests \
         currency-meta-tests currency-search-tests dynamic-tests \
         false-positive-tests options-tests; do
  node tools/$f.mjs | tail -2
done
```

Attendu : **475 vérifications réussies, 0 échec.**

---

## En cas de problème

| Symptôme | À transmettre |
|---|---|
| Un réglage sans effet | Son nom + l'onglet observé |
| Réglage perdu au redémarrage | Son nom |
| Page blanche | Console de la page de réglages, en entier |
| Site exclu quand même analysé | L'URL + « page rechargée ? oui/non » |


## Popup — convertisseur et OCR (itération 25)

- [ ] Le popup affiche **deux onglets** : « Devises » et « Unites ».
- [ ] « Devises » : montant + deux listes + bouton d'inversion ; « 100 USD »
      vers EUR affiche un résultat et la ligne « 1 USD = … EUR ».
- [ ] « Unites » : catégorie, montant, deux listes ; « 10 kg » vers lb donne
      environ 22,05 lb ; « 0 °C » vers °F donne 32 °F.
- [ ] Le bouton **Scan** est juste à côté du titre « UniConv » ; un clic
      déclenche le voile de sélection (ou un message clair si la page n'est
      pas prête).
- [ ] Le popup reste lisible et défilable (largeur 360 px, hauteur max 640, gouttière de défilement réservée,
      sans barre horizontale).

## Pages de test — bandeau et Monnaies (itération 25)

- [ ] Après un **rechargement forcé** (`Cmd+Shift+R`), le bandeau sombre
      « UniConv · tests » est visible en haut des **cinq** pages : Formats,
      Monnaies, Faux positifs, Dynamique, Fuseaux.
- [ ] `test/monnaies.html` affiche **167 lignes** ; la recherche « koweit »
      ne laisse que KWD ; survoler « 100 KWD » ouvre la bulle de conversion.
- [ ] Le lien « Monnaies » du bandeau mène bien au tableau.

## Fuseaux horaires (itération 11)

- [ ] La section « Fuseaux horaires » existe, avec la case « Convertir les
      heures avec fuseau » (cochée par défaut).
- [ ] La « Ville de référence » propose « Ma ville (fuseau du système) » et
      les principales villes ; le choix est conservé après rechargement.
- [ ] Le « Format des heures » (Automatique / 24 h / 12 h) change bien
      l'affichage de la bulle.
- [ ] Décocher « Convertir les heures avec fuseau » fait disparaître les
      pointillés sous « 14:30 CET ».
- [ ] Export : les trois réglages apparaissent dans le JSON ; un import avec
      `"uniconv.targetTimezone": "Pays/Inconnu"` est refusé avec un message.
