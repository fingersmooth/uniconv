# UniConv 2.0 — cadres complémentaires

**Compagnon de `DESIGN-SPEC.md` et des `FRAME-PROMPTS`.** Les cadres S01 à S11
restent la référence pour la **bulle**, les **menus** et la **page de réglages**
de base. Ce fichier ajoute les trois écrans apparus depuis la version 1.0 :
le **popup 2.0**, le **tutoriel** et le **convertisseur autonome**.

Version produit : **2.9.9** — 26 octobre 2026.

---

## 1. Ce qui est nouveau (à ne pas oublier dans les maquettes)

| Sujet | Règle de design |
|---|---|
| Popup | **360 px** de large, gouttière de défilement **réservée** (`scrollbar-gutter: stable`) ; aucune barre horizontale ; les boutons de droite ne passent pas sous la barre verticale |
| Engrenage | icône **⚙ SVG 18 px** dans un bouton **30×30**, aligné au centre avec le titre, le bouton Scan et la version, en haut à droite |
| Scan | bouton pilule **Scan** dans l'en-tête ; case **« Activer le Scan »** sous l'en-tête ; désactivé = bouton grisé |
| Detection | case **« Activer la detection »** (cochée = active, décochée = pause + badge OFF) ; aucun raccourci clavier imposé |
| Convertisseur | onglets **Devises / Unités**, montant, deux listes, bouton d'inversion, résultat 20/700 |
| Tutoriel | page ouverte à l'installation ; sections devises, unités, fuseaux, Scan, convertisseur, réglages, raccourcis, vie privée |
| Convertisseur autonome | fenêtre 400×640 ; champ de montant **déjà sélectionné** ; même composant que le popup |
| Langues | six langues (fr, en, es, ru, zh, ar) + auto ; **RTL arabe** ; repli anglais si la langue système n'est pas couverte |
| OCR automatique | **supprimé** : ne dessiner ni pastille, ni seuil, ni budget, ni statistiques automatiques ; seul le Scan manuel existe |
| Raccourcis | aucune touche imposée ; deux commandes personnalisables (Scan, convertisseur) |

---

## 2. S12 — Popup 2.0 (360 × 640)

**But :** convertir sans quitter l'icône, lancer le Scan, couper la detection.

**Structure verticale :**

1. **En-tête** (30 px) : `UniConv` 14/600 · pilule **Scan** · version 11 muted ·
   engrenage 30×30 aligné à droite.
2. **Case « Activer le Scan »** : 14 px, libellé 11 px, 8 px sous l'en-tête.
3. **Convertisseur** : carte bord 1 px, rayon 8 px, padding 12 px.
   - onglets Devises / Unités (actif : fond `accent-soft`, texte `accent`) ;
   - champ montant 13 px, listes 13 px, bouton d'inversion 28×28 ;
   - résultat 20/700, détail 11 muted.
4. **Statut des taux** : carte `surface-raised`, rayon 6 px, texte 11 px,
   bouton de rafraîchissement.
5. **Detection** : titre + état (`active` vert / `en pause` ambre), case
   **Activer la detection**, aide 11 px.
6. **Dernière page analysée** : deux lignes 11 px muted.
7. **Bouton « Revoir le tutoriel »** pleine largeur, secondaire.

**Contraintes :** padding 12/20/14/16 ; la gouttière de défilement est
réservée ; aucun contrôle ne dépasse à droite ; pas de barre horizontale.
**Variantes :** Scan actif/désactivé, detection active/en pause, taux à
jour/en cache/hors ligne, clair/sombre, **arabe RTL** (miroir de l'en-tête et
des lignes, engrenage à gauche).

**Prompt court :**
```text
CADRE S12 «Popup 2.0», 360×640, fond #FFFFFF (variante sombre #0B1220).
En-tête 30px : «UniConv» 14/600, pilule «Scan» 10,5/700, version 11 muted,
engrenage SVG 18px dans bouton 30×30 aligné au centre à droite.
Sous l'en-tête : case «Activer le Scan» 14px.
Carte convertisseur : onglets «Devises»/«Unités», champ «Montant», listes,
bouton d'inversion, résultat «1 234,56 € = 1 315,20 $» 20/700, détail 11 muted.
Cartes statut des taux, «Detection» + case «Activer la detection», dernière page.
Bouton secondaire «Revoir le tutoriel». Padding 12/20/14/16, rayon 8, bord #D8DDE5.
Aucune barre horizontale ; gouttière verticale réservée ; focus 2px #93C5FD.
```

---

## 3. S13 — Tutoriel (page, largeur max 980)

**But :** expliquer tous les cas d'usage à la première installation.

**Structure :**

- **Héros** sombre (`#0F172A` → `#1E3A8A`), badge « Bienvenue », titre 30/700,
  paragraphe 15, trois étapes (Survolez / Cliquez / Ou utilisez le popup).
- **Sections** : Devises, Unités, Fuseaux, Scan, Convertisseur, Réglages,
  Raccourcis, Vie privée.
- Chaque section : titre 20/600, carte blanche bord 1 px rayon 12, exemple
  encadré en pointillés, bulle factice sombre avec valeur et taux.
- **Actions** en bas : bouton primaire « Ouvrir les réglages », secondaire
  « Ouvrir le convertisseur », secondaire « Fermer ».
- Mention honnête : les textes longs peuvent rester en français ; les libellés
  principaux suivent la langue choisie.

**Prompt court :**
```text
CADRE S13 «Tutoriel UniConv», page 980px max, fond #F6F8FC.
Héros dégradé sombre #0F172A→#1E3A8A, badge «Bienvenue», titre 30/700,
3 étapes. Sections 20/600 : Devises, Unités, Fuseaux, Scan, Convertisseur,
Réglages, Raccourcis, Vie privée. Cartes blanches rayon 12, exemples pointillés,
bulles factices sombres. Actions : «Ouvrir les réglages» (primaire),
«Ouvrir le convertisseur», «Fermer». Texte 15/1,6 ; muted #5B6475.
```

---

## 4. S14 — Convertisseur autonome (fenêtre 400 × 640)

**But :** ouvrir le convertisseur par un raccourci personnel, avec le champ de
montant **déjà sélectionné**.

- Fenêtre 400×640, corps 360 px, fond `#F8FAFC`.
- En-tête `UniConv` 16/700 + sous-titre « Convertisseur » 12 muted.
- Carte convertisseur identique à S12 (onglets, montant, listes, inversion,
  résultat, détail).
- Aide 11,5 muted : « Le montant est déjà sélectionné : tapez votre somme
  directement. »
- Aucun bouton de fermeture interne : la fenêtre système suffit.
- **État focus** : le champ montant a le focus et le texte est sélectionné.

**Prompt court :**
```text
CADRE S14 «Convertisseur autonome», fenêtre 400×640, corps 360, fond #F8FAFC.
En-tête «UniConv» 16/700 + «Convertisseur» 12 muted. Carte convertisseur :
onglets Devises/Unités, champ montant FOCUS + texte sélectionné, listes,
inversion, résultat 20/700. Aide «Le montant est déjà sélectionné…» 11,5 muted.
Bord #D8DDE5, rayon 8, focus 2px #93C5FD.
```

---

## 5. États transverses à livrer

| État | Où |
|---|---|
| Scan désactivé (bouton grisé) | S12 |
| Detection en pause (badge OFF, état ambre) | S12 |
| Taux en cache / hors ligne | S12 |
| Six langues, dont arabe RTL | S12, S13, S14 |
| Champ montant focus/sélectionné | S12, S14 |
| Erreur de conversion | S12, S14 |
| Fenêtre étroite (360) et zoom 200 % | S12, S14 |

---

## 6. Unités de référence et devise de départ (2.3)

**Carte « Unités de référence »** en haut du popup, avant le convertisseur :
- **Monnaie** : recherche + liste de **toutes les monnaies**, 10 lignes visibles, défilement ;
- **Fuseau** : liste compacte (ville du système, Paris, Londres, New York… ) ;
- **Unités** : Métrique / Impérial.
Les valeurs déjà dans ces unités ne sont **pas soulignées** (pas de bulle EUR,
métrique ou Paris). Une cible choisie dans une bulle est **temporaire** : la
bulle suivante revient aux références.

**Devises source et destination** : les **signes** de la devise de départ et
du résultat sont des **boutons colorés avec relief** (bleu pour la source,
vert pour la destination) et un chevron. Chacun ouvre un menu flottant avec
recherche, 10 lignes visibles et toutes les monnaies par défilement. La bulle
ne contient plus de barre de recherche fixe.

Chaque ligne des menus porte une icône **📌** : elle épingle la devise dans la
section **Épinglées**, suivie de **Principales** puis **Autres**. L'épinglage
est partagé entre la bulle (source et destination) et le popup (monnaie de
référence).

Chaque ligne affiche aussi le **drapeau emoji** du pays quand il est connu, et
les **5 Principales** suivent l'ordre d'importance (USD, EUR, JPY, GBP, CNY),
pas l'ordre alphabétique. Les séparateurs de catégories sont contrastés. Le choix ne change que le montant
affiché, pas la détection ni la devise par défaut.

Un clic sur un **signe de devise** dans une bulle de **survol** fige la bulle
et ouvre le menu, sans devoir cliquer d'abord sur le prix.

L'OCR essaie plusieurs variantes (normal, binaire, inversé) et modes de page
(6, 7, 11). Si rien n'est reconnu sur du texte HTML, il lit le texte réel sous
la zone — les images restent lues par le moteur.

La somme détectée est éditable dans la bulle (champ discret, Entrée/blur).
Au survol, le champ passe sur fond blanc avec texte sombre. Le contenu de la
ligne est reconstruit à chaque changement, sans empiler les anciennes valeurs.
Les bulles figées se ferment au scroll. Le menu contextuel propose
**Signaler un bug** : sélection OCR, puis rapport local (image + diagnostics)
à copier ou télécharger ; aucun envoi réseau automatique.

## 7. Devise de départ modifiable (2.2)

Dans la bulle figée, au-dessus de « Convertir vers », ajouter une ligne
Le **signe de la devise** du montant est un bouton ; il ouvre un menu
flottant avec recherche, 10 lignes visibles et toutes les monnaies par
défilement. Il montre la devise détectée (ex. JPY pour `¥8,000`) et permet de
choisir CNY, USD, etc. Le **signe du résultat** fait de même pour la devise
cible. La conversion est relancée ; la détection automatique n'est pas
modifiée.
État à livrer : source JPY par défaut, source CNY sélectionnée, résultat mis à
jour, liste cible inchangée.

## 8. Menu contextuel et montants abrégés (2.1)

**Menu contextuel natif** — pas de cadre : le navigateur dessine le menu. Entrée
**Convertir** avec l'icône de l'extension, uniquement sur une sélection. Le clic
ouvre la bulle de conversion sur la sélection (devises, unités, fuseaux).
Prévoir l'icône 16/32 px ; aucun style de menu à créer.

**Montants abrégés** — `13K RMB`, `1.2M USD`, `3B EUR`, `$480 billion`,
`480 milliards`, `RMB 5-9k` : la bulle
affiche la valeur complète (`13 000 CNY`) et la fourchette complète. Les
suffixes k/m/b sont acceptés avec ou sans espace avant la lettre. Les mots
« 1,2 M de vues » ou « 50 K abonnés » sans devise restent muets.

## 9. Recette avant livraison

- [ ] Aucun contrôle ne touche la gouttière de défilement à droite.
- [ ] L'engrenage est centré verticalement avec le titre, Scan et la version.
- [ ] L'icône de l'engrenage mesure 18 px dans un bouton de 30 px.
- [ ] Le popup ne produit **aucune** barre horizontale.
- [ ] La variante arabe est en RTL sans chevauchement.
- [ ] Aucun élément d'OCR automatique (pastille, seuil, budget, statistiques).
- [ ] Les six langues peuvent allonger les libellés sans casser les lignes.


## 10. Direction 16-bit / Game Boy Advance (2.9)

La direction « discret, presque natif » est remplacée par une interface de jeu
portable : contours encre de 2 px, ombres dures 2–4 px, rayons 2–4 px, palette
limitée (bleu, cyan, vert, ambre) et boutons qui s'enfoncent de 2 px.

La surcouche `src/pixel-theme.css` est chargée par le popup, les réglages, le
tutoriel, le convertisseur et le rapport de bug. La bulle porte ses propres
règles 16-bit.

La ligne principale de la bulle ne revient plus à la ligne (largeur max 700 px)
et le bouton de devise est toujours **après** le montant.

La bulle figée prend un état visuel distinct : fond légèrement plus sombre,
ombre réduite à 2 px et enfoncement interne. Aucun déplacement (les menus en
position fixed restent correctement positionnés).

Les multiplicateurs en mots (`billion`, `million`, `trillion`, `milliard`) et
les abréviations `bn`/`mn`/`tn` sont reconnus. Le texte HTML du rapport de bug
ignore la bulle de l'extension. Les conteneurs de
réglages (`.field-control`, `.segmented`) n'ont plus de cadre noir : seuls les
vrais contrôles en portent un. La bulle de devise garde la même largeur automatique au survol
et au clic ; les menus unités/fuseaux gardent leur poignée.


## 11. Audit et portabilité (2.9.4)

- suppression du dernier ensemble mort `availableCurrencies` ;
- `MAX_AMOUNT` porté à `1e15` pour que `trillion` soit réellement accepté ;
- chemins personnels retirés des scripts/docs ;
- `.gitignore` ajouté, `.DS_Store` supprimés ;
- guide `docs/GITHUB.md` pour la publication du code ;
- 973 vérifications, 0 échec.


## 12. Rubrique de soutien (2.9.5)

Un pied de popup discret propose **Offrir un café sur Ko-fi**. Il pointe vers `https://ko-fi.com/fingersmooth` et ouvre
un nouvel onglet avec `rel="noopener noreferrer"`. Le bouton reprend l'esthétique
16-bit (fond ambre, contour encre, ombre dure).


## 13. Durcissement sécurité (2.9.7)

Audit complet : authentification `sender.id` des messages, validation des taux
réseau/stockés, bornage des entrées OCR et rapport, validation de l'image,
permissions d'hôtes réduites, CSP `base-uri`/`form-action`, taille de bulle
bornée, suppression du rapport local. Détails : `docs/SECURITY.md`.
