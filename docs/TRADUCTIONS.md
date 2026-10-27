# Traductions — proposition pour les langues officielles de l'ONU

**Statut : intégration partielle.** Les **six** langues sont proposées dans
le sélecteur (`fr, en, es, ru, zh, ar`), avec les libellés, titres et messages
principaux traduits, et l'arabe en **RTL** (`dir="rtl"`). Les **textes d'aide
longs** et les paragraphes du tutoriel restent en français : la traduction
complète de ces textes est le travail restant.

---

## 1. Il y a six langues officielles, pas cinq

L'ONU reconnaît **six** langues officielles :

1. **anglais** (`en`)
2. **français** (`fr`)
3. **espagnol** (`es`)
4. **russe** (`ru`)
5. **chinois** (`zh`, mandarin simplifié)
6. **arabe** (`ar`)

La demande parlait de « cinq » : la proposition couvre les **six**, y compris
l'arabe. L'arabe impose une mise en page **RTL** (`dir="rtl"`) dans le popup,
les réglages, le tutoriel et le convertisseur, ainsi que des tests dédiés.

---

## 2. Glossaire de l'interface (proposition)

| Clé | Français | English | Español | Русский | 中文 | العربية |
|---|---|---|---|---|---|---|
| `hover` | Survolez un montant | Hover over an amount | Pase el cursor sobre un importe | Наведите курсор на сумму | 将鼠标悬停在金额上 | مرّر المؤشر فوق مبلغ |
| `click` | Cliquez pour figer | Click to freeze | Haga clic para fijar | Нажмите, чтобы закрепить | 点击以固定 | انقر للتثبيت |
| `currencies` | Devises | Currencies | Monedas | Валюты | 货币 | العملات |
| `units` | Unités | Units | Unidades | Единицы | 单位 | الوحدات |
| `timezones` | Fuseaux horaires | Time zones | Zonas horarias | Часовые пояса | 时区 | المناطق الزمنية |
| `ranges` | Fourchettes | Ranges | Rangos | Диапазоны | 区间 | النطاقات |
| `scan` | Scan (OCR) | Scan (OCR) | Escaneo (OCR) | Сканирование (OCR) | 扫描（OCR） | المسح الضوئي (OCR) |
| `settings` | Réglages | Settings | Ajustes | Настройки | 设置 | الإعدادات |
| `shortcuts` | Raccourcis | Shortcuts | Atajos | Горячие клавиши | 快捷键 | الاختصارات |
| `privacy` | Vie privée | Privacy | Privacidad | Конфиденциальность | 隐私 | الخصوصية |
| `open_converter` | Ouvrir le convertisseur | Open the converter | Abrir el convertidor | Открыть конвертер | 打开转换器 | افتح المحوّل |
| `scan_enable` | Activer le Scan (OCR) | Enable Scan (OCR) | Activar el escaneo (OCR) | Включить сканирование (OCR) | 启用扫描（OCR） | تفعيل المسح الضوئي (OCR) |
| `no_shortcut` | Aucun raccourci n'est imposé | No shortcut is imposed | No se impone ningún atajo | Горячие клавиши не навязаны | 不强制使用快捷键 | لا يتم فرض أي اختصار |

---

## 3. Titres du tutoriel

| Français | English | Español | Русский | 中文 | العربية |
|---|---|---|---|---|---|
| Bienvenue | Welcome | Bienvenido | Добро пожаловать | 欢迎 | مرحبًا |
| Les devises | Currencies | Monedas | Валюты | 货币 | العملات |
| Les unités de mesure | Units | Unidades | Единицы измерения | 计量单位 | وحدات القياس |
| Les fuseaux horaires | Time zones | Zonas horarias | Часовые пояса | 时区 | المناطق الزمنية |
| Le Scan (OCR) | Scan (OCR) | Escaneo (OCR) | Сканирование (OCR) | 扫描（OCR） | المسح الضوئي (OCR) |
| Le convertisseur | The converter | El convertidor | Конвертер | 转换器 | المحوّل |
| Les réglages | Settings | Ajustes | Настройки | 设置 | الإعدادات |
| Vos raccourcis clavier | Your keyboard shortcuts | Tus atajos de teclado | Ваши горячие клавиши | 你的快捷键 | اختصاراتك |
| Vie privée | Privacy | Privacidad | Конфиденциальность | 隐私 | الخصوصية |

---

## 4. Où les chaînes vivent aujourd'hui

| Fichier | Chaînes | Déjà bilingue ? |
|---|---|---|
| `src/popup.html` | libellés, convertisseur, Scan | non (français) |
| `src/options.html` | ~80 libellés et aides | non (français) |
| `src/tutorial.html` | ~60 phrases | non (français) |
| `src/converter.html` | ~10 libellés | non (français) |
| `src/content.js` | `TEXTS` (8 clés) + messages de bulle | **fr/en** |
| `src/options.js` | `uiLanguage`, `fr/en/auto` | **fr/en** |

---

## 5. Plan d'intégration (proposé)

1. **Module unique** `src/i18n.js` :
   - `LANGUAGES` (six codes + libellé natif) ;
   - `TRANSLATIONS` (clé → six chaînes) ;
   - `t(key)`, `applyI18n(root)` ;
   - `dir(lang)` → `ltr` / `rtl`.
2. **HTML** : attributs `data-i18n="clé"` sur les libellés, `data-i18n-attr`
   pour `placeholder`, `title`, `aria-label`. Interdiction d'`innerHTML`
   (règle du projet) : les textes restent en `textContent`.
3. **Réglages** : `uniconv.language` accepte `fr,en,es,ru,zh,ar,auto` ;
   `auto` suit `navigator.language`.
4. **Content script** : `TEXTS` passe de deux à six langues ; `uiLanguage`
   accepte les six codes ; `numberLocale()` mappe `es-ES`, `ru-RU`, `zh-CN`,
   `ar-EG` ; la bulle reçoit `lang` et `dir`.
5. **RTL arabe** : `dir="rtl"` sur les pages et la bulle ; miroir des marges,
   des poignées et du menu ; tests de contraste et de focus.
6. **Tutoriel** : titre et phrases avec `data-i18n` ; le tableau de référence
   des devises reste en français (noms officiels) ou utilise
   `Intl.DisplayNames` dans la langue choisie.
7. **Tests** : `i18n-tests` (toutes les clés ont six langues, aucune chaîne
   vide, aucune clé orpheline), captures RTL, et vérification que chaque page
   appelle `applyI18n`.
8. **Repli** : toute clé manquante retombe sur l'anglais, puis le français ;
   jamais de texte vide.

---

## 6. Ce qui est prêt et ce qui ne l'est pas

**Prêt :** le glossaire ci-dessus, l'architecture, la liste des fichiers, la
prise en compte de l'arabe RTL.

**Pas encore fait :** le module `i18n.js`, les ~150 chaînes des pages, la
bascule de langue et les tests. C'est un chantier dédié (plusieurs heures),
à faire **après validation de la proposition** pour ne pas livrer une interface
à moitié traduite.

---

## 7. Sources

- ONU — langues officielles : <https://www.un.org/fr/our-work/official-languages>
- BIPM/NIST pour les unités (déjà utilisés dans `docs/UNITES-ECRITURES.md`).
