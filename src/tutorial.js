/**
 * UniConv — page tutoriel.
 *
 * Ouverte a l'installation (une seule fois) et accessible depuis le popup ou
 * les reglages. Les boutons ouvrent les pages de l'extension ; aucun script
 * inline (la CSP MV3 l'interdit).
 */

'use strict';

document.addEventListener('DOMContentLoaded', function () {
  if (window.UniConvI18n) {
    UniConvI18n.applyCurrent();
  }

  const optionsButton = document.getElementById('open-options');
  if (optionsButton) {
    optionsButton.addEventListener('click', function () {
      try {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      } catch (error) {
        // Rien a faire.
      }
    });
  }

  const converterButton = document.getElementById('open-converter');
  if (converterButton) {
    converterButton.addEventListener('click', function () {
      try {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/converter.html') });
      } catch (error) {
        // Rien a faire.
      }
    });
  }

  const closeButton = document.getElementById('close-tutorial');
  if (closeButton) {
    closeButton.addEventListener('click', function () {
      try {
        window.close();
      } catch (error) {
        // Rien a faire.
      }
    });
  }
});
