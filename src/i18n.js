/**
 * ============================================================================
 *  UniConv — src/i18n.js
 * ============================================================================
 *
 *  Traductions de l'interface (popup, reglages, tutoriel, convertisseur).
 *
 *  PORTEE : les libelles courts, les titres de sections et les boutons.
 *  Les textes d'aide longs restent en francais pour l'instant (voir
 *  docs/TRADUCTIONS.md pour le plan complet).
 *
 *  L'ONU compte six langues officielles. Ce fichier couvre les cinq demandees :
 *  francais, anglais, espagnol, russe, chinois. L'arabe (RTL) est la sixieme.
 */

'use strict';

const UNICONV_LANGUAGES = ['fr', 'en', 'es', 'ru', 'zh', 'ar'];

const UNICONV_TRANSLATIONS = {
  en: {
    'Taux de change': 'Exchange rates',
    'Rafraichir les taux': 'Refresh rates',
    "Systeme d'unites": 'Unit system',
    'Metrique': 'Metric',
    'Imperial': 'Imperial',
    'Detection': 'Detection',
    'Suspendre sur toutes les pages': 'Pause on all pages',
    'Derniere page analysee': 'Last page analyzed',
    'Arriere-plan :': 'Background:',
    'Ouvrir les reglages': 'Open settings',
    'Revoir le tutoriel': 'View tutorial',
    'Devises': 'Currencies',
    'Unites': 'Units',
    'Montant': 'Amount',
    'Categorie': 'Category',
    'Activer le Scan': 'Enable Scan',
    'Activer le Scan (OCR)': 'Enable Scan (OCR)',
    'Taux indisponible': 'Rate unavailable',
    'Scan desactive.': 'Scan disabled.',
    'Devise cible': 'Target currency',
    'Ce que l\u2019extension convertit': 'What the extension converts',
    'Affichage': 'Display',
    'Fuseaux horaires': 'Time zones',
    'Sites exclus': 'Excluded sites',
    'Scan (OCR) \u2014 lire dans les images': 'Scan (OCR) \u2014 read inside images',
    'Raccourcis clavier': 'Keyboard shortcuts',
    'Sauvegarde des r\u00e9glages': 'Settings backup',
    'Remise \u00e0 z\u00e9ro': 'Reset',
    'Langue': 'Language',
    'Th\u00e8me': 'Theme',
    'D\u00e9lai d\u2019apparition': 'Hover delay',
    'Bienvenue': 'Welcome',
    'Les devises': 'Currencies',
    'Les unit\u00e9s de mesure': 'Units',
    'Les fuseaux horaires': 'Time zones',
    'Le Scan (OCR) \u2014 lire dans une image': 'Scan (OCR) \u2014 read inside an image',
    'Le convertisseur du popup (et son raccourci)': 'The popup converter (and its shortcut)',
    'Les r\u00e9glages': 'Settings',
    'Vos raccourcis clavier': 'Your keyboard shortcuts',
    'Vie priv\u00e9e': 'Privacy'
  },
  es: {
    'Taux de change': 'Tipos de cambio',
    'Rafraichir les taux': 'Actualizar tipos',
    "Systeme d'unites": 'Sistema de unidades',
    'Metrique': 'M\u00e9trico',
    'Imperial': 'Imperial',
    'Detection': 'Detecci\u00f3n',
    'Suspendre sur toutes les pages': 'Pausar en todas las p\u00e1ginas',
    'Derniere page analysee': '\u00daltima p\u00e1gina analizada',
    'Arriere-plan :': 'Segundo plano:',
    'Ouvrir les reglages': 'Abrir ajustes',
    'Revoir le tutoriel': 'Ver tutorial',
    'Devises': 'Monedas',
    'Unites': 'Unidades',
    'Montant': 'Importe',
    'Categorie': 'Categor\u00eda',
    'Activer le Scan': 'Activar escaneo',
    'Activer le Scan (OCR)': 'Activar escaneo (OCR)',
    'Taux indisponible': 'Tipo no disponible',
    'Scan desactive.': 'Escaneo desactivado.',
    'Devise cible': 'Moneda de destino',
    'Ce que l\u2019extension convertit': 'Lo que convierte la extensi\u00f3n',
    'Affichage': 'Visualizaci\u00f3n',
    'Fuseaux horaires': 'Zonas horarias',
    'Sites exclus': 'Sitios excluidos',
    'Scan (OCR) \u2014 lire dans les images': 'Escaneo (OCR) \u2014 leer en im\u00e1genes',
    'Raccourcis clavier': 'Atajos de teclado',
    'Sauvegarde des r\u00e9glages': 'Copia de ajustes',
    'Remise \u00e0 z\u00e9ro': 'Restablecer',
    'Langue': 'Idioma',
    'Th\u00e8me': 'Tema',
    'D\u00e9lai d\u2019apparition': 'Retardo de aparici\u00f3n',
    'Bienvenue': 'Bienvenido',
    'Les devises': 'Monedas',
    'Les unit\u00e9s de mesure': 'Unidades',
    'Les fuseaux horaires': 'Zonas horarias',
    'Le Scan (OCR) \u2014 lire dans une image': 'Escaneo (OCR) \u2014 leer en una imagen',
    'Le convertisseur du popup (et son raccourci)': 'El convertidor del popup (y su atajo)',
    'Les r\u00e9glages': 'Ajustes',
    'Vos raccourcis clavier': 'Tus atajos de teclado',
    'Vie priv\u00e9e': 'Privacidad'
  },
  ru: {
    'Taux de change': '\u041a\u0443\u0440\u0441\u044b \u0432\u0430\u043b\u044e\u0442',
    'Rafraichir les taux': '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043a\u0443\u0440\u0441\u044b',
    "Systeme d'unites": '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0435\u0434\u0438\u043d\u0438\u0446',
    'Metrique': '\u041c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f',
    'Imperial': '\u0418\u043c\u043f\u0435\u0440\u0441\u043a\u0430\u044f',
    'Detection': '\u041e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u0438\u0435',
    'Suspendre sur toutes les pages': '\u041f\u0440\u0438\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u043d\u0430 \u0432\u0441\u0435\u0445 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430\u0445',
    'Derniere page analysee': '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430',
    'Arriere-plan :': '\u0424\u043e\u043d:',
    'Ouvrir les reglages': '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',
    'Revoir le tutoriel': '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0440\u0443\u043a\u043e\u0432\u043e\u0434\u0441\u0442\u0432\u043e',
    'Devises': '\u0412\u0430\u043b\u044e\u0442\u044b',
    'Unites': '\u0415\u0434\u0438\u043d\u0438\u0446\u044b',
    'Montant': '\u0421\u0443\u043c\u043c\u0430',
    'Categorie': '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f',
    'Activer le Scan': '\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0441\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435',
    'Activer le Scan (OCR)': '\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0441\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 (OCR)',
    'Taux indisponible': '\u041a\u0443\u0440\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d',
    'Scan desactive.': '\u0421\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u043e.',
    'Devise cible': '\u0426\u0435\u043b\u0435\u0432\u0430\u044f \u0432\u0430\u043b\u044e\u0442\u0430',
    'Ce que l\u2019extension convertit': '\u0427\u0442\u043e \u043f\u0440\u0435\u043e\u0431\u0440\u0430\u0437\u0443\u0435\u0442 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043d\u0438\u0435',
    'Affichage': '\u041e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435',
    'Fuseaux horaires': '\u0427\u0430\u0441\u043e\u0432\u044b\u0435 \u043f\u043e\u044f\u0441\u0430',
    'Sites exclus': '\u0418\u0441\u043a\u043b\u044e\u0447\u0451\u043d\u043d\u044b\u0435 \u0441\u0430\u0439\u0442\u044b',
    'Scan (OCR) \u2014 lire dans les images': '\u0421\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 (OCR) \u2014 \u0447\u0442\u0435\u043d\u0438\u0435 \u043d\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f\u0445',
    'Raccourcis clavier': '\u0413\u043e\u0440\u044f\u0447\u0438\u0435 \u043a\u043b\u0430\u0432\u0438\u0448\u0438',
    'Sauvegarde des r\u00e9glages': '\u0420\u0435\u0437\u0435\u0440\u0432\u043d\u0430\u044f \u043a\u043e\u043f\u0438\u044f \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043a',
    'Remise \u00e0 z\u00e9ro': '\u0421\u0431\u0440\u043e\u0441',
    'Langue': '\u042f\u0437\u044b\u043a',
    'Th\u00e8me': '\u0422\u0435\u043c\u0430',
    'D\u00e9lai d\u2019apparition': '\u0417\u0430\u0434\u0435\u0440\u0436\u043a\u0430 \u043f\u043e\u044f\u0432\u043b\u0435\u043d\u0438\u044f',
    'Bienvenue': '\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c',
    'Les devises': '\u0412\u0430\u043b\u044e\u0442\u044b',
    'Les unit\u00e9s de mesure': '\u0415\u0434\u0438\u043d\u0438\u0446\u044b \u0438\u0437\u043c\u0435\u0440\u0435\u043d\u0438\u044f',
    'Les fuseaux horaires': '\u0427\u0430\u0441\u043e\u0432\u044b\u0435 \u043f\u043e\u044f\u0441\u0430',
    'Le Scan (OCR) \u2014 lire dans une image': '\u0421\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 (OCR) \u2014 \u0447\u0442\u0435\u043d\u0438\u0435 \u043d\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0438',
    'Le convertisseur du popup (et son raccourci)': '\u041a\u043e\u043d\u0432\u0435\u0440\u0442\u0435\u0440 \u0432 popup (\u0438 \u0435\u0433\u043e \u0433\u043e\u0440\u044f\u0447\u0430\u044f \u043a\u043b\u0430\u0432\u0438\u0448\u0430)',
    'Les r\u00e9glages': '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',
    'Vos raccourcis clavier': '\u0412\u0430\u0448\u0438 \u0433\u043e\u0440\u044f\u0447\u0438\u0435 \u043a\u043b\u0430\u0432\u0438\u0448\u0438',
    'Vie priv\u00e9e': '\u041a\u043e\u043d\u0444\u0438\u0434\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u044c'
  },
  zh: {
    'Taux de change': '\u6c47\u7387',
    'Rafraichir les taux': '\u5237\u65b0\u6c47\u7387',
    "Systeme d'unites": '\u5355\u4f4d\u5236',
    'Metrique': '\u516c\u5236',
    'Imperial': '\u82f1\u5236',
    'Detection': '\u68c0\u6d4b',
    'Suspendre sur toutes les pages': '\u5728\u6240\u6709\u9875\u9762\u6682\u505c',
    'Derniere page analysee': '\u4e0a\u6b21\u5206\u6790\u7684\u9875\u9762',
    'Arriere-plan :': '\u540e\u53f0\uff1a',
    'Ouvrir les reglages': '\u6253\u5f00\u8bbe\u7f6e',
    'Revoir le tutoriel': '\u67e5\u770b\u6559\u7a0b',
    'Devises': '\u8d27\u5e01',
    'Unites': '\u5355\u4f4d',
    'Montant': '\u91d1\u989d',
    'Categorie': '\u7c7b\u522b',
    'Activer le Scan': '\u542f\u7528\u626b\u63cf',
    'Activer le Scan (OCR)': '\u542f\u7528\u626b\u63cf\uff08OCR\uff09',
    'Taux indisponible': '\u6c47\u7387\u4e0d\u53ef\u7528',
    'Scan desactive.': '\u626b\u63cf\u5df2\u505c\u7528\u3002',
    'Devise cible': '\u76ee\u6807\u8d27\u5e01',
    'Ce que l\u2019extension convertit': '\u6269\u5c55\u8f6c\u6362\u7684\u5185\u5bb9',
    'Affichage': '\u663e\u793a',
    'Fuseaux horaires': '\u65f6\u533a',
    'Sites exclus': '\u6392\u9664\u7684\u7f51\u7ad9',
    'Scan (OCR) \u2014 lire dans les images': '\u626b\u63cf\uff08OCR\uff09\u2014 \u8bfb\u53d6\u56fe\u7247',
    'Raccourcis clavier': '\u952e\u76d8\u5feb\u6377\u952e',
    'Sauvegarde des r\u00e9glages': '\u8bbe\u7f6e\u5907\u4efd',
    'Remise \u00e0 z\u00e9ro': '\u91cd\u7f6e',
    'Langue': '\u8bed\u8a00',
    'Th\u00e8me': '\u4e3b\u9898',
    'D\u00e9lai d\u2019apparition': '\u60ac\u505c\u5ef6\u8fdf',
    'Bienvenue': '\u6b22\u8fce',
    'Les devises': '\u8d27\u5e01',
    'Les unit\u00e9s de mesure': '\u8ba1\u91cf\u5355\u4f4d',
    'Les fuseaux horaires': '\u65f6\u533a',
    'Le Scan (OCR) \u2014 lire dans une image': '\u626b\u63cf\uff08OCR\uff09\u2014 \u8bfb\u53d6\u56fe\u7247',
    'Le convertisseur du popup (et son raccourci)': '\u5f39\u51fa\u8f6c\u6362\u5668\uff08\u53ca\u5176\u5feb\u6377\u952e\uff09',
    'Les r\u00e9glages': '\u8bbe\u7f6e',
    'Vos raccourcis clavier': '\u4f60\u7684\u5feb\u6377\u952e',
    'Vie priv\u00e9e': '\u9690\u79c1'
  },
  ar: {
    'Taux de change': 'أسعار الصرف',
    'Rafraichir les taux': 'تحديث الأسعار',
    "Systeme d'unites": 'نظام الوحدات',
    'Metrique': 'متري',
    'Imperial': 'إمبراطوري',
    'Detection': 'الكشف',
    'Suspendre sur toutes les pages': 'إيقاف مؤقت في جميع الصفحات',
    'Derniere page analysee': 'آخر صفحة تم تحليلها',
    'Arriere-plan :': 'الخلفية:',
    'Ouvrir les reglages': 'فتح الإعدادات',
    'Revoir le tutoriel': 'عرض الدليل',
    'Devises': 'العملات',
    'Unites': 'الوحدات',
    'Montant': 'المبلغ',
    'Categorie': 'الفئة',
    'Activer le Scan': 'تفعيل المسح',
    'Activer le Scan (OCR)': 'تفعيل المسح (OCR)',
    'Taux indisponible': 'السعر غير متاح',
    'Scan desactive.': 'المسح معطّل.',
    'Devise cible': 'العملة الهدف',
    'Ce que l’extension convertit': 'ما يحوّله الامتداد',
    'Affichage': 'العرض',
    'Fuseaux horaires': 'المناطق الزمنية',
    'Sites exclus': 'المواقع المستثناة',
    'Scan (OCR) — lire dans les images': 'المسح (OCR) — القراءة داخل الصور',
    'Raccourcis clavier': 'اختصارات لوحة المفاتيح',
    'Sauvegarde des réglages': 'نسخ الإعدادات احتياطيًا',
    'Remise à zéro': 'إعادة التعيين',
    'Langue': 'اللغة',
    'Thème': 'السمة',
    'Délai d’apparition': 'تأخير الظهور',
    'Bienvenue': 'مرحبًا',
    'Les devises': 'العملات',
    'Les unités de mesure': 'وحدات القياس',
    'Les fuseaux horaires': 'المناطق الزمنية',
    'Le Scan (OCR) — lire dans une image': 'المسح (OCR) — القراءة داخل صورة',
    'Le convertisseur du popup (et son raccourci)': 'محوّل النافذة المنبثقة (واختصاره)',
    'Les réglages': 'الإعدادات',
    'Vos raccourcis clavier': 'اختصارات لوحة المفاتيح الخاصة بك',
    'Vie privée': 'الخصوصية'
  }
};

const UNICONV_TEXT_ORIGINALS = new WeakMap();

/** Applique une langue au document courant. */
function uniconvApplyLanguage(lang) {
  const dictionary = UNICONV_TRANSLATIONS[lang];
  if (!dictionary) {
    return;
  }

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (const node of nodes) {
    let original = UNICONV_TEXT_ORIGINALS.get(node);
    if (original === undefined) {
      original = node.nodeValue;
      UNICONV_TEXT_ORIGINALS.set(node, original);
    }

    const trimmed = original.trim();
    const translated = dictionary[trimmed];
    if (!translated) {
      continue;
    }

    const start = original.indexOf(trimmed);
    node.nodeValue = original.slice(0, start) + translated +
      original.slice(start + trimmed.length);
  }

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

/** Lit la langue choisie et l'applique (auto = langue du navigateur). */
function uniconvApplyCurrentLanguage() {
  const fallback = function () {
    const nav = (typeof navigator !== 'undefined' && navigator.language)
      ? navigator.language.slice(0, 2).toLowerCase()
      : 'en';
    // Langue systeme couverte -> elle ; sinon ANGLAIS par defaut.
    uniconvApplyLanguage(UNICONV_LANGUAGES.indexOf(nav) !== -1 ? nav : 'en');
  };

  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      fallback();
      return;
    }

    chrome.storage.local.get('uniconv.language', function (result) {
      let lang = result && result['uniconv.language'];
      if (!lang || lang === 'auto') {
        fallback();
        return;
      }
      if (UNICONV_LANGUAGES.indexOf(lang) === -1) {
        lang = 'en';
      }
      uniconvApplyLanguage(lang);
    });
  } catch (error) {
    fallback();
  }
}

window.UniConvI18n = {
  languages: UNICONV_LANGUAGES,
  apply: uniconvApplyLanguage,
  applyCurrent: uniconvApplyCurrentLanguage
};
