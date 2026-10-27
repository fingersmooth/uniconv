/**
 * UniConv — page autonome du convertisseur.
 *
 * Ouverte par le raccourci clavier « Ouvrir le convertisseur » (commande
 * `open-converter`). Le champ de montant est deja selectionne : l'utilisateur
 * n'a plus qu'a taper sa somme.
 */

'use strict';

document.addEventListener('DOMContentLoaded', function () {
  if (window.UniConvI18n) {
    UniConvI18n.applyCurrent();
  }

  if (window.UniConvConverter) {
    window.UniConvConverter.initConverter();
  }

  const amount = document.getElementById('conv-amount');
  if (amount) {
    amount.focus();
    amount.select();
  }
});
