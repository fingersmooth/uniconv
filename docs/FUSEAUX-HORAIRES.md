# Fuseaux horaires — ce qui est reconnu, et pourquoi

**Itération 11.** Une heure écrite **avec son fuseau** est convertie dans la
ville de référence choisie par l'utilisateur. Une heure **sans** fuseau n'est
jamais touchée.

Le calcul vit dans `src/content.js`, entre les marqueurs
`>>> DEBUT MODULE FUSEAUX` et `<<< FIN MODULE FUSEAUX`. Ce bloc est **pur** :
aucun accès au DOM, aucune lecture de l'horloge (l'instant est toujours un
paramètre). `tools/timezone-tests.mjs` l'extrait et le rejoue hors navigateur.

---

## 1. Règle de base

| Écrit | Résultat |
|---|---|
| `14:30` | **ignoré** — ambigu (midi et demi où ?) |
| `14:30 CET` | converti |
| `14:30 heure de Paris` | converti |
| `2026-10-24T14:30:00Z` | converti |

Exiger un fuseau est le meilleur filtre à faux positifs : sans lui, chaque
horaire de chaque page déclencherait une bulle.

---

## 2. Formats d'heure

| Forme | Exemple | Remarque |
|---|---|---|
| 24 h, deux-points | `14:30`, `08:05` | le cas courant |
| 24 h, lettre h | `14h30`, `14 h 30` | usage français |
| heure ronde | `14h`, `10 h` | minutes = 0 |
| avec secondes | `14:30:15` | secondes ignorées |
| 12 h + AM/PM | `2:30 PM`, `11 am`, `12:00 a.m.` | 12 AM = 00:00, 12 PM = 12:00 |
| ISO 8601 | `2026-10-24T14:30:00Z`<br>`2026-10-24T14:30+02:00` | date incluse |
| RFC 2822 | `Sat, 24 Oct 2026 14:30:00 +0200` | en-têtes de courriel |

**Ambiguïté assumée :** `2:30 CET` (sans AM/PM) est lu **02:30**. Les pages qui
écrivent en 12 h mettent normalement `AM`/`PM` ; les pages en 24 h écrivent
`14:30`. Ce choix est documenté, pas deviné.

---

## 3. Écriture du fuseau

| Forme | Exemple | Type |
|---|---|---|
| UTC / GMT seuls | `14:30 UTC`, `14:30 GMT` | décalage 0 |
| UTC/GMT + décalage | `14:30 UTC+2`, `14:30 GMT-05:00`, `UTC+0530` | décalage fixe |
| Décalage ISO collé | `14:30+02:00`, `14:30Z` | décalage fixe |
| Nom IANA | `14:30 Europe/Paris`, `14:30 America/New_York` | **heure d'été comprise** |
| Abréviation | `14:30 CET`, `2:30 PM EST` | décalage fixe (voir § 4) |
| Formule française | `14:30 heure de Paris`, `14:30 heure de l'Est`, `14:30 heure du Pacifique`, `14:30 heure des Rocheuses`, `14:30 heure locale de Tokyo` | nom IANA |
| Formule anglaise | `14:30 Paris time`, `14:30 Pacific Time`, `14:30 Eastern Time` | nom IANA |

La casse des abréviations **compte** : `EST` est un fuseau, `est` est le verbe
français. C'est ce qui évite une bulle sur « il est 14:30 ».

---

## 4. Abréviations et leurs choix

Toutes sont converties en **décalage fixe** (elles ne portent pas l'heure
d'été : c'est le rôle des noms IANA).

| Abrév. | Décalage | Abrév. | Décalage |
|---|---|---|---|
| WET / WEST | 0 / +1 h | CET / CEST | +1 h / +2 h |
| EET / EEST | +2 h / +3 h | BST | +1 h |
| IST | **+5 h 30** | MSK | +3 h |
| EST / EDT | −5 h / −4 h | CST / CDT | **−6 h** / −5 h |
| MST / MDT | −7 h / −6 h | PST / PDT | −8 h / −7 h |
| AKST / AKDT | −9 h / −8 h | HST | −10 h |
| AST / ADT | **−4 h** / −3 h | NST / NDT | −3 h 30 / −2 h 30 |
| BRT / ART | −3 h | CLT / COT / PET | −4 h / −5 h / −5 h |
| WAT / CAT | +1 h / +2 h | EAT / SAST | +3 h / +2 h |
| JST / KST | +9 h | HKT / SGT / PHT / MYT | +8 h |
| WIB / ICT | +7 h | AEST / AEDT | +10 h / +11 h |
| ACST / ACDT | +9 h 30 / +10 h 30 | AWST | +8 h |
| NZST / NZDT | +12 h / +13 h | GST | +4 h |
| PKT | +5 h | NPT | **+5 h 45** |
| LKT | +5 h 30 | BDT | +6 h |
| IRST / IRDT | +3 h 30 / +4 h 30 | | |

**Abréviations ambiguës** — choix retenu, à connaître :

- `IST` = **Inde** (+5 h 30), et non Israël ou Irlande ;
- `CST` = **centre des États-Unis** (−6 h), et non la Chine ;
- `AST` = **Atlantique** (−4 h), et non l'Arabie ;
- `BST` = **Royaume-Uni** (+1 h), et non le Bangladesh.

Qui veut la Chine écrit `Asia/Shanghai` ; qui veut Israël écrit
`Asia/Jerusalem`.

---

## 5. Dates

- **ISO 8601** et **RFC 2822** portent leur propre date : la conversion est
  exacte, même pour une autre année.
- Les autres formes utilisent **la date du jour** dans le fuseau source (c'est
  ce qui permet de tenir compte de l'heure d'été). Une heure seule ne dit pas
  quel jour : on répond à la question « il est 14:30 à Paris, quelle heure
  est-il à Tokyo **aujourd'hui** ? ».
- Une date écrite séparément (`25/12/2026 14:30 CET`) n'est **pas** associée à
  l'heure : c'est une limite connue (voir § 9).

---

## 6. Conversion

1. On transforme l'heure locale du fuseau source en **instant absolu**.
   Pour un nom IANA, le navigateur fournit le décalage réel à cette date
   (heure d'été comprise), avec une seconde vérification au voisinage des
   changements d'heure.
2. On formate cet instant dans le fuseau cible (`Intl.DateTimeFormat`).
3. On affiche :
   - **ligne principale** : l'heure convertie (`22:30`, ou `10:30 PM` en 12 h) ;
   - **ligne secondaire** : `14:30 CET -> Tokyo · +8 h · le lendemain`.

Le décalage affiché est `cible − source` : `UTC` face à `CET` donne bien
`−1 h` (UTC est une heure derrière).

---

## 7. Le menu des villes

Au **clic** sur une heure avec fuseau, la bulle se fige et un menu s'ouvre —
mêmes principes que les devises :

- recherche par **ville, pays, région ou nom IANA** (« chine » ne trouve pas
  Pékin : le menu propose Shanghai) ;
- **drapeaux** et épinglage 📌 ;
- sections « Ma position », « Épinglées », « Principales », « Autres villes » ;
- le choix est mémorisé (`uniconv.targetTimezone`).

`Ma position` suit le fuseau du système (`Intl.DateTimeFormat().resolvedOptions().timeZone`).

---

## 8. Réglages

| Clé | Valeur | Défaut |
|---|---|---|
| `uniconv.detectTimezones` | vrai / faux | `true` |
| `uniconv.targetTimezone` | fuseau IANA, ou `''` = local | `''` |
| `uniconv.timeFormat` | `auto` / `24` / `12` | `auto` |
| `uniconv.pinnedTimezones` | liste de fuseaux épinglés | `[]` |

La page de réglages propose les **principales villes** ; le menu de la bulle
donne accès aux **132 villes** de `TZ_CITIES`.

---

## 9. Limites connues

1. **Heure sans fuseau** : jamais convertie (choix de conception).
2. **Date séparée de l'heure** : ignorée ; on répond pour aujourd'hui.
3. **Abréviations ambiguës** : un choix est documenté (§ 4), il ne peut pas
   plaire à tout le monde.
4. **Ranges** (`10:00–12:00 CET`) : seule l'heure suivie du fuseau est
   convertie.
5. **Fuseaux à changement d'heure** : une heure inexistante le jour du
   changement (ex. 02:30 le jour du passage) est rapprochée de l'instant le
   plus proche.
6. **Secondes** : ignorées.
7. **`2:30` sans AM/PM** : lu en 24 h (02:30).

---

## 10. Sources

- [Wikipedia — Time zone table](https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Time/Time_zone_table) (abréviations et décalages) ;
- ISO 8601 (date/heure avec décalage) et RFC 2822 (date des courriels) ;
- base **IANA tzdata**, fournie par le navigateur via `Intl` (aucun réseau).

---

## 11. Vérification

- Page : `http://localhost:8123/test/fuseaux.html` (33 cas valides + 15 pièges).
- Suite : `node tools/timezone-tests.mjs` (80 vérifications).

La page et la suite lisent **les mêmes données** (le bloc JSON `tz-cases`) :
une seule source de vérité.
