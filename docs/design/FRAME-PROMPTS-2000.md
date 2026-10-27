# UniConv — prompts cadre par cadre (version 2000 caractères)

**Version compacte de `FRAME-PROMPTS.md`.** Chaque bloc fait **moins de 2000
caractères** (espaces et retours à la ligne compris) et peut être collé tel quel.
La version longue reste disponible pour un designer humain ou un outil sans
limite.

> **Mise à jour 2.0** : les nouveaux cadres (popup 360, tutoriel, convertisseur)
> sont dans [`EVOLUTIONS-2.0.md`](EVOLUTIONS-2.0.md).

## Mode d'emploi

1. Un bloc = un cadre. Collez-le **entier**, sans rien ajouter.
2. Ordre conseillé : **S02 → S01 → S03 → S04 → S05 → S06 → S07 → S08 → S09 →
   S10 → S11**.
3. Produisez le **sombre** d'abord (thème par défaut), dupliquez en clair, puis
   renommez les calques (`Bubble/…`, `Picker/…`, `Row/…`, `Settings/…`,
   `Popup/…`, `Icon/…`).
4. Les textes entre guillemets sont les vrais libellés du produit.

> Les longueurs sont vérifiées par un script ; si vous modifiez un bloc,
> revérifiez qu'il reste sous 2000 caractères.

---

## S01 — Contexte e-commerce

```text
CADRE S01 «Contexte e-commerce» 1440×1024 fond #0F172A.
STYLE défaut=sombre. D=#0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC · L=#FFFFFF/#F8FAFC/#0F172A/#475569/#2563EB (fond/élevé/texte/secondaire/accent); typo système 13,5/600 valeur, 11,5/400 détail; rayon 8; ombre douce; contraste 4,5:1.
DÉCOR verrouillé, volontairement neutre (#F8FAFC/#E2E8F0/#111827): fausse page produit avec barre logo «SHOP» + recherche + panier, fil d'ariane Accueil/Audio/Casques, visuel 520×520 gris, titre «Casque audio sans fil — Noir», «4,6★ (128 avis)», prix «249,90 €», bouton «Ajouter au panier», encart «Offre reconditionnée» avec «1 234,56 €».
OBJET: bulle survol près du 1er prix «≈ 270,44 USD» / «1 EUR = 1,0824 USD»; bulle figée près du 2e prix «≈ 1 336,82 USD» + menu devises (voir S03). La bulle ne masque jamais le prix qu'elle convertit; elle est l'élément le plus contrasté du cadre.
CALQUES: Page/Mock, Cursor, Bubble/Hover/Dark, Bubble/Frozen/Dark.
MESURES: bulle ≤320px, à 14px du curseur, 8px des bords, bascule au-dessus si la place manque.
CONTRAINTES: pas de police/image distante, pas de dégradé, calques nommés, variantes clair+sombre, focus 2px.
ÉVITER: page colorée, ombre dure, texte qui déborde.
SORTIE: PNG@2x clair+sombre.
```

---

## S02 — Bulle compacte (redlines)

```text
CADRE S02 «Bulle/Redlines» 1440×1200 fond #0F172A.
STYLE défaut=sombre. D=#0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC · L=#FFFFFF/#F8FAFC/#0F172A/#475569/#2563EB; typo système.
OBJET: planche de référence à 2× de la bulle compacte. C'est le cadre qui fait foi.
CONTENU: à 2× «≈ 1 082,45 €» / «taux 1 EUR = 1,0824 USD · 24/10»; la même en clair; variante longue «≈ 1 234 567 890,12» / «Franc suisse · 1 EUR = 0,9345 CHF · taux en cache» (le titre passe sur 2 lignes); zoom ×4 du coin haut-gauche; une variante montrant la bascule au-dessus du curseur.
COTES (px réels): largeur max 320, padding 10/12, écart lignes 3, ligne1 13,5/600, ligne2 11,5/400 sans opacité, rayon 8, bordure 1, ombre 0 8 24 (alpha .45 sombre/.14 clair), 14px du curseur, 8px des bords.
CALQUES: Spec/Dark(2×) [Bubble + cotes + annotations tokens], Spec/Light(2×), Spec/Long label, Spec/Zoom×4, Spec/Flip (au-dessus).
CONTRAINTES: pas de police/image distante, calques nommés, texte ≥11px, contraste 4,5:1.
ÉVITER: coter en px de planche sans le dire; opacité sur la ligne 2.
SORTIE: planche annotée PNG@2x + composants auto-layout (padding 12/10, gap 3).
```

---

> **Popup 2.0 :** utiliser S12 dans [`EVOLUTIONS-2.0.md`](EVOLUTIONS-2.0.md).

## S03 — Menu des devises

```text
CADRE S03 «Menu devises» 1440×1200 fond #0F172A.
STYLE défaut=sombre. D=#0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC · L=#FFFFFF/#F8FAFC/#0F172A/#475569/#2563EB; 13,5/600 valeur, 11,5/400 détail, 12 lignes, 11/600 capitales; r6/8/10; contraste 4,5:1.
CONTENU: bulle 320px «≈ 1 336,82 USD» / «1 EUR = 1,0824 USD», recherche «Rechercher une devise…», sections ÉPINGLÉES (🇪🇺 Euro EUR épinglé, 🇺🇸 Dollar américain USD sélectionné+épinglé), PRINCIPALES (🇬🇧 Livre sterling, 🇯🇵 Yen japonais, 🇨🇳 Yuan chinois, 🇨🇭 Franc suisse), AUTRES (🇨🇦 Dollar canadien, 🇦🇺 Dollar australien, 🇮🇳 Roupie indienne, 🇧🇷 Réal brésilien, 🇦🇪 Dirham des Émirats, 🇲🇦 Dirham marocain), poignée dans le pied.
CALQUES: Bubble/Frozen/Dark > Header(Main,Detail), Picker/Currency > Search, List(Section, Row/<code>/<état>), Footer/Resize.
MESURES: picker 260, recherche 30, liste max 200px défilante (barre visible, pas de contenu coupé), ligne 24-28, drapeau boîte 24 emoji 18, épingle 12 (zone 24), focus 2px offset 2, sélection = fond accent 16% + barre 2px à gauche.
ÉTATS: default, hover, selected, focus, pinned — la sélection et l'épingle ne doivent pas se confondre.
CONTRAINTES: pas de police/image distante, calques nommés, un seul bouton par ligne.
ÉVITER: 2 boutons par ligne, sélection par la couleur seule, drapeaux bitmap.
SORTIE: variantes sombre+clair, PNG@2x.
```

---

## S04 — Menu des unités

```text
CADRE S04 «Menu unités» 1440×1200 fond #0F172A.
STYLE défaut=sombre. D=#0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC · L=#FFFFFF/#F8FAFC/#0F172A/#475569/#2563EB; 13,5/600 valeur, 11,5/400 détail, 12 lignes; r6/8; contraste 4,5:1.
CONTENU: «6 ft 2 in = 1,88 m» / «1 in = 2,54 cm»; PAS de recherche (liste courte); section LONGUEUR: m (sélectionné), km, cm, mm, mi, yd, ft, in; poignée.
3 VARIANTES: Longueur (ci-dessus); Masse «180 lb = 81,65 kg» (kg, g, lb, oz, st); Température «20 °C = 68 °F» (°C, °F, K) + la formule «°F = °C × 9/5 + 32».
CALQUES: Bubble/Frozen/Dark/Unit > Header, Picker/Unit > List(Section, Row/<jeton>/<état>), Footer/Resize.
MESURES: picker 260, liste max 200px, ligne 24-28, pas de champ recherche (la liste remonte de 8px), symboles lisibles en 12px, unités composées (km/h, m/s) sur une seule ligne.
ÉTATS: default, hover, selected (fond accent 16% + barre 2px à gauche, même convention que S03), focus (anneau 2px).
CONTRAINTES: pas de police/image distante, calques nommés, texte ≥11px.
ÉVITER: ajouter une recherche; confondre m (mètre) et mi (mile).
SORTIE: 3 variantes × 2 thèmes, PNG@2x.
```

---

## S05 — Menu des villes (fuseaux)

```text
CADRE S05 «Menu villes» 1440×1400 fond #0F172A.
STYLE défaut=sombre. D=#0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC · L=#FFFFFF/#F8FAFC/#0F172A/#475569/#2563EB; 13,5/600 valeur, 11,5/400 détail, 12 ville, 11 IANA; r6/8; contraste 4,5:1.
CONTENU: «15h30 à Paris» / «14:30 CET · +1 h»; recherche «Rechercher une ville ou un pays…»; MA POSITION (toujours en premier): 🇫🇷 Ma ville — Paris (GMT+2) sélectionné; ÉPINGLÉES: 🇯🇵 Tokyo (GMT+9), 🇺🇸 New York (GMT-4) (épinglés); PRINCIPALES: Londres (GMT+1), Paris (GMT+2), New York (GMT-4), Tokyo (GMT+9), Dubaï (GMT+4), Singapour (GMT+8), Sydney (GMT+10); AUTRES VILLES: Buenos Aires (GMT-3), Johannesburg (GMT+2), Mumbai (GMT+5:30), Katmandou (GMT+5:45), São Paulo (GMT-3); poignée.
VARIANTES: liste complète; recherche «tok» → Tokyo; sans résultat → «Aucun résultat» (calme, pas d'alerte); libellé long: nom de ville jamais coupé, partie entre parenthèses en ellipse.
CALQUES: Bubble/Frozen/Dark/Timezone > Header, Picker/Timezone > Search, List(Section, Row/<id>/<état>), Footer/Resize.
MESURES: picker 260, recherche 30, liste max 200px défilante, ligne 24-28, drapeau 24/emoji 18, épingle 12 (zone 24), focus 2px.
CONTRAINTES: pas de police/image distante, calques nommés, un seul bouton par ligne.
ÉVITER: couper le nom de ville; mettre l'IANA en avant; drapeaux bitmap.
SORTIE: 4 variantes × 2 thèmes, PNG@2x.
```

---

## S06 — Sélection OCR

```text
CADRE S06 «OCR» 1440×1024 fond #0F172A.
STYLE défaut=sombre. D=#0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC · L=#FFFFFF/#F8FAFC/#0F172A/#475569/#2563EB; accent #7DD3FC sombre / #2563EB clair.
DÉCOR: page produit neutre avec une image contenant «149,99 €» dessiné.
ÉTAT PRÊT: voile plein écran rgba(15,23,42,.22); cadre 2px accent, fond accent 12%, rayon 2; pastille en haut au centre (top 14): «Dessinez un rectangle autour du texte à lire · Échap pour annuler» (fond #0B1220, texte blanc 12,5/600, padding 8/14, rayon 8, ombre).
ÉTAT ERREUR: même pastille + bordure 1px danger, texte «Zone trop petite : dessinez un rectangle plus grand (Échap pour annuler)».
ÉTAT RÉSULTAT: bulle «149,99 €» → «≈ 162,35 USD» (même chemin que S03).
CALQUES: Page/Mock, OCR/Veil, OCR/Frame, OCR/Hint/Ready, OCR/Hint/Error, Bubble/Frozen/Dark/OCR.
MESURES: voile plein écran, cadre 2px, pastille top 14 padding 8/14, 12,5/600; la pastille ne masque jamais le cadre ni le prix sélectionné.
CONTRAINTES: pas de police/image distante, calques nommés, contraste 4,5:1.
ÉVITER: voile trop sombre (on doit lire la page); pastille qui chevauche la sélection; rouge criard.
SORTIE: 3 états × 2 thèmes, PNG@2x.
```

---

> **Réglages 2.0 :** OCR automatique supprimé ; voir [`EVOLUTIONS-2.0.md`](EVOLUTIONS-2.0.md).

## S07 — Page de réglages (2.0)

```text
CADRE S07 «Réglages 2.0» 1440×2600 fond #F6F8FC / #0B1220.
STYLE app clair/sombre ; 22/700 titre, 15/600 carte, 13/400 ; r10 carte, r6 champ.
CONTENU (9 cartes) : en-tête «Réglages d'UniConv» + «version 2.0.1» + «Revoir le tutoriel»; 1 Devise cible (recherche+liste); 2 Ce que convertit (Devises/Unités, Métrique|Impérial); 3 Affichage (Délai, Thème, Réinitialiser, Langue Français|English|Español|Русский|中文|العربية|Auto); 4 Fuseaux (switch, ville, format); 5 Sites exclus; 6 Scan (case «Activer le Scan (OCR)», aide bouton/raccourci, Tester le moteur); 7 Raccourcis (aucune touche imposée, about:addons / chrome://extensions/shortcuts, Scan + convertisseur); 8 Sauvegarde JSON; 9 Remise à zéro.
CALQUES: Page/Header, Card×9, Field, Message.
MESURES: 760 centré, carte r10 padding16/18, switch 44×24, segmenté langue sur 2 lignes.
CONTRAINTES: pas d'OCR automatique (ni seuil, ni budget, ni stats), pas de raccourcis Alt+Maj+U/O, contraste 4,5:1, RTL arabe.
SORTIE: clair+sombre PNG@2x.
```

---

## S08 — Popup (2.0)

```text
CADRE S08 «Popup 2.0» 360×640 fond #FFFFFF / #0B1220.
STYLE app clair #FFFFFF/#F8FAFC/#111827/#6B7280/#2563EB, sombre #0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC; 14/600 titre, 13/400, 11 muted; r8 carte, r6 champ.
CONTENU: en-tête «UniConv» + pilule «Scan» + version 2.0.1 + engrenage SVG 18px dans bouton 30×30 aligné à droite; case «Activer le Scan»; convertisseur (onglets Devises|Unités, Montant, listes, inversion, résultat 20/700, détail 11 muted); statut des taux; «Detection» + case «Activer la detection»; dernière page analysée; bouton «Revoir le tutoriel».
MESURES: 360 large, padding 12/20/14/16, scrollbar-gutter stable, aucune barre horizontale, engrenage centré avec titre/Scan/version, cible 30px.
ÉTATS: Scan actif/désactivé, Detection active/en pause, taux à jour/cache/hors ligne, clair/sombre, arabe RTL.
CONTRAINTES: pas d'OCR automatique (ni seuil, ni budget, ni stats), aucun raccourci imposé, contraste 4,5:1.
SORTIE: 4 états × 2 thèmes PNG@2x.
```

---

## S09 — Icônes

```text
CADRE S09 «Icônes» 800×400 fond #0F172A.
STYLE accent #7DD3FC sombre / #2563EB clair; une seule couleur dominante; fond transparent.
CONTENU: les 4 tailles 128, 48, 32, 16px sur fond clair et sur fond sombre; le 16px agrandi ×8 avec une grille de pixels; le badge navigateur «OFF» (pastille danger, texte blanc 9px); une version monochrome.
PISTE: deux flèches croisées ou un «U» en deux traits; aucun détail sous 2px à 16px; le symbole doit rester reconnaissable à 16px et sur les deux fonds; éviter une lettre isolée si elle devient illisible.
CALQUES: Icon/128|48|32|16 × Light/Dark, Grid/16×8, Badge/OFF.
MESURES: carrés stricts 16/32/48/128; marge interne 1/8 de la taille; traits ≥1,5px à 16px.
CONTRAINTES: aucun texte dans l'icône, aucun dégradé, aucune image bitmap.
ÉVITER: symbole qui devient une tache à 16px; détail fin; contraste faible sur fond clair.
SORTIE: SVG source + PNG 16/32/48/128 fond transparent.
```

---

## S10 — Planche de tokens

```text
CADRE S10 «Redlines/Tokens» 1440×1600 fond #0F172A.
STYLE D=#0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC · L=#FFFFFF/#F8FAFC/#0F172A/#475569/#2563EB; états succès #16A34A, attention #D97706, danger #DC2626.
CONTENU: couleurs (2 colonnes + états, nom + code sur chaque pastille); rampe typo 22/700, 15/600, 13,5/600, 13/400, 12/400, 11,5/400, 11/600 avec un exemple de texte par rôle; barres d'espacement 2,4,6,8,10,12,16,20,24,32; rayons 4/6/8/10/999; 3 ombres: bulle sombre 0 8 24 rgba(2,6,23,.45), bulle clair 0 8 24 rgba(15,23,42,.14), carte 0 1 2 rgba(15,23,42,.06); focus 2px offset 2 sur un bouton et une ligne; mouvement 120ms, 160ms, courbe cubic-bezier(.2,.8,.2,1) + «coupé si mouvement réduit»; tableau des contrastes calculés (texte/fond, ratio).
CALQUES: Section/Couleurs, Typographie, Espacements, Rayons, Ombres, Focus, Mouvement, Contrastes.
CONTRAINTES: uniquement les valeurs listées; noms de calques exacts.
ÉVITER: valeurs hors tokens; contrastes annoncés sans calcul; noms inventés.
SORTIE: planche PNG@2x + tokens.json avec exactement ces valeurs.
```

---

## S11 — Cas extrêmes

```text
CADRE S11 «Cas extrêmes» 1440×1200 fond #0F172A.
STYLE D=#0B1220/#111A2C/#F8FAFC/#CBD5E1/#7DD3FC · L=#FFFFFF/#F8FAFC/#0F172A/#475569/#2563EB; 13,5/600 valeur, 11,5/400 détail; r6/8.
6 MINI-FRAMES (320px sauf mention), avec la largeur réelle indiquée au-dessus:
1 «Libellé long»: «Dollar des Caraïbes orientales (XCD)» dans une ligne à 240px — nom non coupé, partie technique en ellipse.
2 «Montant énorme»: «≈ 1 234 567 890,12 ¥» / «1 EUR = 161,2345 JPY» — le titre passe à la ligne.
3 «Bulle 240px»: largeur minimale, texte passé à la ligne, aucun débordement.
4 «Bulle 700px»: largeur maximale, liste élargie, poignée à droite, largeur de lecture maîtrisée; à comparer côte à côte avec la 240px.
5 «Zoom 200%»: composant agrandi ×2, aucun chevauchement, focus visible.
6 «Erreurs»: «aucun taux disponible», «devise non disponible», «Aucun résultat», «OCR impossible».
CALQUES: Case/Long label, Case/Huge amount, Case/Bubble240, Case/Bubble700, Case/Zoom200, Case/Errors.
CONTRAINTES: pas de police/image distante, calques nommés, contraste 4,5:1.
SORTIE: PNG@2x + composants correspondants.
```
