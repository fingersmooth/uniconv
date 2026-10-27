'use strict';

const report = {
  image: '',
  pageUrl: '',
  pageTitle: '',
  createdAt: '',
  extensionVersion: '',
  userAgent: '',
  language: '',
  rect: null,
  dpr: 1,
  viewport: null,
  ocr: null,
  pageText: '',
  crop: null
};

function text(id) {
  return document.getElementById(id);
}

function set(id, value) {
  const element = text(id);
  if (element) {
    element.textContent = value === undefined || value === null ? '—' : String(value);
  }
}

function buildTextReport() {
  const rect = report.rect || {};
  const ocr = report.ocr || {};
  return [
    'UniConv — rapport de bug',
    'Date : ' + (report.createdAt || '—'),
    'Version : ' + (report.extensionVersion || '—'),
    'Page : ' + (report.pageUrl || '—'),
    'Titre : ' + (report.pageTitle || '—'),
    'Langue : ' + (report.language || '—'),
    'Navigateur : ' + (report.userAgent || '—'),
    'Zone : ' + [
      Math.round(rect.x || 0),
      Math.round(rect.y || 0),
      Math.round(rect.width || 0) + '×' + Math.round(rect.height || 0)
    ].join(' '),
    'DPR : ' + (report.dpr || '—'),
    'Confiance OCR : ' + (ocr.confidence === null || ocr.confidence === undefined ? '—' : ocr.confidence + ' %'),
    'Erreur OCR : ' + (ocr.error || '—'),
    '',
    'Texte OCR :',
    ocr.text || '(vide)',
    '',
    'Texte HTML sous la zone :',
    report.pageText || '(vide)'
  ].join('\n');
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (copyError) {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

async function copyImage() {
  if (!report.image) {
    return false;
  }
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
    return false;
  }
  try {
    const response = await fetch(report.image);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch (error) {
    return false;
  }
}

function showStatus(message) {
  const status = text('copy-status');
  if (status) {
    status.textContent = message;
  }
}

function render() {
  if (!report.image) {
    document.getElementById('empty').hidden = false;
    return;
  }

  const preview = text('preview');
  preview.src = report.image;

  const download = text('download-image');
  download.href = report.image;
  const stamp = String(report.createdAt || 'rapport').replace(/[:.]/g, '-');
  download.download = 'unicorn-bug-' + stamp + '.png';

  set('page-url', report.pageUrl);
  set('page-title', report.pageTitle);
  set('created', report.createdAt);
  set('version', report.extensionVersion);
  set('ua', report.userAgent);
  set('page-text', report.pageText);

  const rect = report.rect || {};
  set('rect', Math.round(rect.width || 0) + ' × ' + Math.round(rect.height || 0) +
    ' px à (' + Math.round(rect.x || 0) + ', ' + Math.round(rect.y || 0) + ')');
  set('screen', (report.viewport ? report.viewport.width + ' × ' + report.viewport.height : '—') +
    ' · DPR ' + (report.dpr || '—'));
  set('ocr-text', report.ocr && report.ocr.text ? report.ocr.text : '(aucun texte OCR)');

  const ocr = report.ocr || {};
  set('confidence', ocr.confidence === null || ocr.confidence === undefined
    ? '—'
    : ocr.confidence + ' %' + (ocr.error ? ' · ' + ocr.error : ''));
}

text('copy-report').addEventListener('click', async function () {
  const ok = await copyText(buildTextReport());
  showStatus(ok ? 'Rapport copié.' : 'Copie impossible : sélectionnez le texte à la main.');
});

text('copy-image').addEventListener('click', async function () {
  const ok = await copyImage();
  showStatus(ok ? 'Image copiée.' : 'Copie d’image non prise en charge : utilisez « Télécharger l’image ».');
});

text('clear-report').addEventListener('click', function () {
  try {
    chrome.storage.local.remove('uniconv.bugReport', function () {
      if (chrome.runtime.lastError) {
        showStatus('Suppression impossible.');
        return;
      }
      report.image = '';
      document.getElementById('preview').removeAttribute('src');
      document.getElementById('empty').hidden = false;
      showStatus('Rapport supprimé du stockage local.');
    });
  } catch (error) {
    showStatus('Suppression impossible.');
  }
});

try {
  chrome.storage.local.get('uniconv.bugReport', function (result) {
    if (chrome.runtime.lastError) {
      return;
    }
    const stored = result && result['uniconv.bugReport'];
    if (!stored) {
      document.getElementById('empty').hidden = false;
      return;
    }
    Object.assign(report, stored);
    if (typeof report.image !== 'string' ||
        !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(report.image) ||
        report.image.length > 8 * 1024 * 1024) {
      report.image = '';
    }
    render();
  });
} catch (error) {
  document.getElementById('empty').hidden = false;
}
