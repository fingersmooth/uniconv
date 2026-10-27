# Unités de mesure — inventaire des écritures

**Itération 16.** Ce document recense les **façons d'écrire une unité** que
l'extension doit reconnaître (et convertir), catégorie par catégorie, avec leur
statut. Il sert de référence pour les tests et pour les ajouts futurs.

Légende : **✅ géré** · **➕ ajouté** (itération 16) · **⚠️ ambigu** (règle de
contexte) · **❌ hors périmètre** (raison donnée).

---

## 1. Règles générales d'écriture

| Règle | Exemple | Ce que fait l'extension |
|---|---|---|
| Symbole ou nom | `5 kg` / `5 kilogrammes` | les deux |
| Singulier / pluriel | `1 pound` / `2 pounds` | les deux (les symboles ne prennent pas de « s ») |
| Espace entre nombre et unité | `5kg` / `5 kg` / `5 kg` (insécable) | espace **facultative** |
| Majuscules | `2.1 QT`, `10 IN`, `300 K` | alias majuscules (tokens ≥ 2 caractères) |
| Minuscules / capitales mixtes | `2.1 qt`, `10 In` | `In` n'est **pas** couvert (voir § 6) |
| Point d'abréviation | `5 kg.`, `10 in.` | accepté (le point suit l'unité) |
| Virgule / point décimal | `2,5 kg` / `2.5 kg` | les deux |
| Espaces de milliers | `1 234 kg` | non (rare pour une mesure) |
| Fractions | `1/2 cup`, `2 1/2 cups`, `2½ cups`, `½ tasse` | **➕** |
| Formats composés | `6 ft 2 in`, `5'10"`, `1m80`, `1,80 m` | ✅ |
| Plages | `10-20 kg`, `de 10 à 20 kg` | ❌ une seule conversion par valeur (pas de logique de plage) |
| Degrés | `20 °C`, `20°C`, `20 degrés Celsius`, `20 ° C` | ✅ / **➕** |
| Kelvin | `300 K`, `300 kelvins`, `300 °K` | **➕** avec contexte |
| Unités CJK | `5 ㎏`, `3 ㎝` | ❌ caractères de compatibilité non couverts |
| Exposants | `m²`, `m³`, `m/s²` | ❌ surfaces/volumes dérivés non couverts (voir § 5) |

**Sources principales** : [BIPM, brochure SI](https://www.bipm.org/en/publications/si-brochure)
(symboles, espace, casse), [NIST SP 811](https://www.nist.gov/pml/special-publication-811),
[Wikipedia — Manual of Style (nombres et unités)](https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style/Dates_and_numbers),
[Wikipedia — Unités de mesure pour la cuisine](https://fr.wikipedia.org/wiki/Unit%C3%A9s_de_mesure_pour_la_cuisine),
[Wikipedia — Kelvin](https://en.wikipedia.org/wiki/Kelvin),
[Wikipedia — Knot (unit)](https://en.wikipedia.org/wiki/Knot_(unit)),
[Wikipédia — Nœud (unité)](https://fr.wikipedia.org/wiki/N%C5%93ud_(unit%C3%A9)).

---

## 2. Longueurs (base : mètre)

| Écritures | Facteur | Statut |
|---|---|---|
| `km`, `kilomètre(s)`, `kilometre(s)`, `kilometer(s)` | 1 000 m | ✅ |
| `m`, `mètre(s)`, `metre(s)`, `meter(s)` | 1 m | ✅ |
| `cm`, `centimètre(s)`, `centimetre(s)` | 0,01 m | ✅ |
| `mm`, `millimètre(s)`, `millimetre(s)` | 0,001 m | ✅ |
| `µm`, `μm`, `micron(s)`, `micromètre(s)`, `micrometre(s)` | 0,000 001 m | **➕** |
| `mi`, `mile(s)` | 1 609,344 m | ✅ |
| `yd`, `yard(s)` | 0,914 4 m | ✅ |
| `ft`, `foot`, `feet`, `pied(s)` | 0,304 8 m | ✅ |
| `in`, `inch`, `inches`, `pouce(s)` | 0,025 4 m | ✅ |
| `nmi`, `nautical mile(s)`, `mille(s) marin(s)` | 1 852 m | **➕** |
| `″`, `'` (pouces, pieds) | — | ✅ dans les formats composés |

Ambiguïtés : `in` (préposition anglaise) → rejeté si suivi d'un mot ou d'un
nombre (« 10 in the box ») ; `m` peut signifier « million » dans un contexte
monétaire → rejeté par « m€ » ; `M` seul n'est pas un alias (millions).

---

## 3. Masses (base : kilogramme)

| Écritures | Facteur | Statut |
|---|---|---|
| `kg`, `kilogramme(s)`, `kilo(s)`, `kilogram(s)` | 1 kg | ✅ |
| `g`, `gramme(s)`, `gram(s)` | 0,001 kg | ✅ |
| `mg`, `milligramme(s)`, `milligram(s)` | 0,000 001 kg | **➕** |
| `µg`, `μg`, `mcg`, `microgramme(s)`, `microgram(s)` | 0,000 000 001 kg | **➕** |
| `t` (tonne) | — | ❌ trop ambigu (Tesla, tera) ; on écrit « tonne » |
| `tonne(s)`, `metric ton(s)` | 1 000 kg | **➕** (symbole affiché `t`, non détecté seul) |
| `lb`, `lbs`, `pound(s)` | 0,453 592 37 kg | ✅ |
| `oz`, `ounce(s)` | 0,028 349 523 125 kg | ✅ |
| `st`, `stone(s)` | 6,350 293 18 kg | ✅ |
| `livre(s)` (poids) | — | ❌ conflit avec « livre sterling » |
| `carat`, `ct` | — | ❌ joaillerie, hors périmètre |

Ambiguïtés : `st` (stone) exige un espace après le nombre (« 1st » n'est pas
une stone) ; `oz` peut être « once » (poids) ou « fluid ounce » (volume) —
« fl oz » est traité en volume.

---

## 4. Volumes (base : litre)

| Écritures | Facteur | Statut |
|---|---|---|
| `L`, `l`, `litre(s)`, `liter(s)` | 1 L | ✅ |
| `ml`, `mL`, `millilitre(s)`, `milliliter(s)` | 0,001 L | ✅ |
| `cl`, `centilitre(s)`, `centiliter(s)` | 0,01 L | **➕** |
| `dl`, `décilitre(s)`, `deciliter(s)` | 0,1 L | **➕** |
| `hl`, `hectolitre(s)`, `hectoliter(s)` | 100 L | **➕** |
| `cc` (centimètre cube) | 0,001 L | **➕** |
| `gal`, `gallon(s)` | 3,785 411 784 L (US) | ✅ |
| `qt`, `quart(s)` | 0,946 352 946 L (US) | ✅ (itération 14) |
| `pt`, `pint(s)`, `pinte(s)` | 0,473 176 473 L (US) | ✅ |
| `cup(s)`, `tasse(s)` | 0,236 588 236 5 L (US) | ✅ |
| `fl oz`, `fluid ounce(s)` | 0,029 573 529 562 5 L (US) | **➕** |
| `tsp`, `teaspoon(s)`, `cuillère(s) à café` | 0,004 928 921 593 75 L (US) | **➕** |
| `tbsp`, `tablespoon(s)`, `cuillère(s) à soupe` | 0,014 786 764 781 25 L (US) | **➕** |
| `m³`, `dm³`, `cm³` | — | ❌ volume dérivé (voir § 5) |
| `barrel`, `bbl` | — | ❌ pétrole, contexte spécifique |

**Convention** : les volumes impériaux suivent le **gallon US** (comme le
gallon, la pinte et la tasse déjà présents). Le quart impérial anglais
(1,1365 L) n'est pas retenu ; c'est documenté.

Ambiguïtés : `qt`/`quarts` après un nombre suivi de « de/du/des/d' » est une
**fraction française** (« 3 quarts de la surface ») → rejeté ; « 2 quarts of
milk » reste un volume.

---

## 5. Vitesses (base : km/h)

| Écritures | Facteur | Statut |
|---|---|---|
| `km/h`, `kmh`, `kilomètre(s) par heure` | 1 km/h | ✅ |
| `m/s`, `mètre(s) par seconde`, `meter(s) per second` | 3,6 km/h | **➕** |
| `mph`, `mile(s) per hour` | 1,609 344 km/h | ✅ |
| `kn`, `kt`, `knot(s)`, `nœud(s)`, `noeud(s)` | 1,852 km/h | **➕** |
| `km/s`, `mi/s` | — | ❌ rare, hors périmètre |
| `g` (accélération), `m/s²` | — | ❌ accélération, hors périmètre |

---

## 6. Températures (conversion avec décalage)

| Écritures | Statut |
|---|---|
| `°C`, `C`, `celsius`, `centigrade` | ✅ (`C` nu non reconnu, voir ci-dessous) |
| `20 degrés Celsius`, `20 degrés celsius`, `20 deg C`, `20 ° C` | **➕** |
| `°F`, `F`, `fahrenheit` | ✅ (`F` nu non reconnu) |
| `70 degrés Fahrenheit`, `70 °F`, `70 deg F`, `70 ° F` | **➕** |
| `K`, `kelvin(s)`, `300 K`, `300 °K`, `300 degrés Kelvin` | **➕** avec contexte |
| `20 C` / `70 F` (sans degré) | ❌ ambigu (C = coulomb, F = farad) |
| `Celsius` / `Fahrenheit` seuls, sans nombre | — (pas de conversion sans nombre) |

**Règle Kelvin** (ambiguïté « 50 K » = 50 000) :

- `300 K` → **température** (300 K = 26,85 °C) ;
- `50 K` **seul** → traité comme 50 000 (pas de conversion) ;
- `50 K abonnés`, `50 K vues`, `50 K €`, `50K` → **pas une température** ;
- `77 K` avec un contexte (« azote liquide 77 K », « température 77 K ») →
  **température** ;
- plage nue acceptée : **200 à 10 000 K** (couvre 273, 300, 373, 1 000 K).

---

## 7. Formes composées et fractions

| Forme | Exemple | Statut |
|---|---|---|
| Pieds + pouces | `6 ft 2 in`, `6 FT 2 IN`, `5'10"` | ✅ |
| Taille française | `1m80`, `1,80 m`, `180 cm` | ✅ |
| Fraction simple | `1/2 cup`, `3/4 in`, `1/2 kg` | **➕** |
| Fraction mixte | `2 1/2 cups`, `2½ cups`, `2 ½ cups` | **➕** |
| Fractions Unicode | `½`, `¼`, `¾`, `⅓`, `⅔`, `⅕`, `⅖`, `⅗`, `⅘`, `⅙`, `⅚`, `⅛`, `⅜`, `⅝`, `⅞` | **➕** |
| Fraction + unité sans espace | `1/2cup`, `½cup` | **➕** (l'espace reste facultative) |
| Plages | `10-20 kg` | ❌ |

---

## 8. Catégories non couvertes (et pourquoi)

| Catégorie | Exemples | Raison |
|---|---|---|
| Surfaces | `m²`, `cm²`, `ha`, `acre`, `sq ft` | pas de catégorie « surface » ; l'ajout demande une base m², des cibles et des tests dédiés |
| Volumes dérivés | `m³`, `cm³`, `dm³` | idem (et `m³` vaut 1 000 L : conversion possible mais catégorie à part) |
| Pression | `bar`, `psi`, `atm`, `hPa` | pas de catégorie ; cibles usuelles multiples |
| Énergie | `J`, `cal`, `kcal`, `kWh` | idem |
| Puissance | `W`, `kW`, `ch` | idem |
| Données | `ko`, `Mo`, `Go`, `To`, `KiB` | idem (et confusions binaire/décimal) |
| Temps | `h`, `min`, `s`, `ms` | géré séparément par les fuseaux ; durées non converties |
| Consommation | `L/100 km`, `mpg` | unité composée inversée, cas particulier |
| Angle | `°`, `rad`, `tr` | le symbole `°` seul est ambigu (degré ou température) |
| Astronomie | `UA`, `al`, `pc` | usage rare |
| Pixels / impression | `px`, `dpi`, `pt` (point typographique) | `pt` est déjà la pinte : conflit |

Chaque ajout futur doit fournir : les écritures, un facteur exact, une cible
métrique **et** impériale, des règles anti-faux-positifs et des tests.

---

## 9. Ambiguïtés et règles de rejet

| Écriture | Risque | Règle |
|---|---|---|
| `in` | préposition anglaise | rejet si suivi d'un mot/nombre |
| `st` | « 1st » (ordinal) | espace obligatoire |
| `K` | 50 000 | espace + plage + contexte (voir § 6) |
| `m` | million (`m€`) | rejet si suivi d'une devise |
| `M` | millions | pas d'alias majuscule |
| `t` | Tesla / tera | non reconnu |
| `C` / `F` nus | coulomb / farad | non reconnus |
| `quarts` | fraction française | rejet après « de/du/des/d' » |
| `pt` | point typographique | hors périmètre |
| `1/2` | date / ratio | accepté seulement avec une unité derrière |
| `5 000` | milliers | non géré pour les unités (rare) |

---

## 10. Vérification

- `node tools/units-tests.mjs` : table de vérité (conversions, écritures,
  faux positifs, fractions, Kelvin, majuscules).
- `test/formats.html` : cas visuels, dont les nouvelles écritures.
- `test/faux-positifs.html` : pièges (dont « 50 K abonnés », « 10 IN THE BOX »,
  « unreal »).
- `node tools/dynamic-tests.mjs` : OCR des unités (toutes catégories).
