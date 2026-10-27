/**
 * ============================================================================
 *  UniConv — tools/generate-currency-page.mjs
 * ============================================================================
 *
 *  ROLE
 *  ----
 *  Regenerer `test/monnaies.html` : le grand tableau des 167 devises.
 *
 *  POURQUOI UN GENERATEUR
 *  ----------------------
 *  Le tableau doit rester aligne sur CURRENCIES / CURRENCY_META. Le test
 *  `currency-meta-tests` verifie que chaque code des metadonnees est present
 *  dans la page ; si une devise est ajoutee, relancer :
 *
 *      node tools/generate-currency-page.mjs
 *
 *  Aucune dependance : le script lit content.js, extrait les deux tables et
 *  ecrit le HTML.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'src', 'content.js');
const OUTPUT = join(ROOT, 'test', 'monnaies.html');

const source = readFileSync(CONTENT, 'utf8');

/** Extrait un tableau/objet equilibre depuis content.js. */
function extractBalanced(name, open, close) {
  const marker = `const ${name} = ${open}`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`table ${name} introuvable`);
  }

  let depth = 0;
  let started = false;
  let end = start;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) {
      depth += 1;
      started = true;
    } else if (source[index] === close) {
      depth -= 1;
      if (started && depth === 0) {
        end = source.indexOf(';', index) + 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

const dataSource = [
  extractBalanced('CURRENCIES', '[', ']'),
  extractBalanced('CURRENCY_META', '{', '}')
].join('\n');

const { CURRENCIES, CURRENCY_META } = new Function(
  `${dataSource}\nreturn { CURRENCIES, CURRENCY_META };`
)();

/** Drapeau emoji a partir du code pays (FR -> 🇫🇷). */
function flag(country) {
  if (!country || !/^[A-Z]{2}$/.test(country)) {
    return '🌐';
  }
  return String.fromCodePoint(
    0x1F1E6 + country.charCodeAt(0) - 65,
    0x1F1E6 + country.charCodeAt(1) - 65
  );
}

/** Echappe le HTML. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const byCode = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

const rows = Object.entries(CURRENCY_META)
  .map(([code, meta]) => {
    const currency = byCode.get(code) || {};
    const symbol = currency.symbol && currency.symbol.trim() !== ''
      ? currency.symbol
      : '—';
    return {
      code,
      name: meta.name || code,
      country: meta.country || '',
      symbol,
      flag: flag(meta.country),
      example: `100 ${code}`
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

const tableRows = rows.map((row) => `      <tr data-code="${row.code}" data-search="${escapeHtml(
  `${row.code} ${row.name} ${row.country}`.toLowerCase()
)}">
        <td class="flag">${row.flag}</td>
        <td class="code">${row.code}</td>
        <td>${escapeHtml(row.name)}</td>
        <td class="symbol">${escapeHtml(row.symbol)}</td>
        <td class="example">${row.example}</td>
      </tr>`).join('\n');

const html = `<!DOCTYPE html>
<!--
  ============================================================================
   UniConv — test/monnaies.html
  ============================================================================

   ROLE : tableau de reference des 167 devises detectees.

   COMMENT S'EN SERVIR
   -------------------
   Survolez la colonne « Exemple » : chaque cellule est un vrai montant que
   l'extension doit convertir. Le champ de recherche filtre par code, nom ou
   pays.

   Le tableau est GENERE par tools/generate-currency-page.mjs ; ne pas le
   modifier a la main. Le test currency-meta-tests verifie que chaque devise
   des metadonnees figure ici.
-->
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <title>UniConv — toutes les monnaies</title>
  <link rel="stylesheet" href="test-nav.css">
  <style>
    body {
      max-width: 1000px;
      margin: 0 auto;
      padding: 24px 20px 80px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.55;
      color: #111827;
      background: #ffffff;
    }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 17px; margin: 30px 0 8px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    .intro { color: #4b5563; font-size: 14px; margin: 0 0 10px; }
    .note { padding: 10px 12px; border-left: 3px solid #2f6bff; background: #f4f7ff; font-size: 13px; margin: 8px 0 14px; }
    .toolbar { display: flex; align-items: center; gap: 10px; margin: 10px 0; flex-wrap: wrap; }
    .toolbar input {
      flex: 1;
      min-width: 220px;
      padding: 7px 9px;
      border: 1px solid #d8dde5;
      border-radius: 6px;
      font: inherit;
      font-size: 14px;
    }
    .count { font-size: 13px; color: #6b7280; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 14px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #6b7280; position: sticky; top: 0; background: #ffffff; }
    td.flag { width: 34px; font-size: 18px; }
    td.code, td.symbol { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
    td.example { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #1f4fd8; }
    tr:hover { background: #f8fafc; }
    .empty { padding: 12px; color: #6b7280; }
  </style>
</head>
<body>
<nav class="test-nav" aria-label="Pages de test">
  <span class="test-nav-title">UniConv · tests</span>
  <a href="formats.html">Formats</a>
  <a href="monnaies.html" aria-current="page">Monnaies</a>
  <a href="faux-positifs.html">Faux positifs</a>
  <a href="dynamique.html">Dynamique</a>
  <a href="fuseaux.html">Fuseaux</a>
</nav>

<h1>Toutes les monnaies (${rows.length})</h1>
<p class="intro">
  Les ${rows.length} devises détectées par UniConv, avec leur code ISO, leur
  symbole quand il existe et un exemple à survoler. Les noms viennent des
  métadonnées ; une seule devise (SLE) est détectée par son code seul.
</p>

<div class="note">
  <strong>Astuce :</strong> survolez la colonne « Exemple » (par exemple
  <code>100 KWD</code>) : la bulle doit afficher la conversion. Utilisez le
  champ de recherche pour filtrer par code, nom ou pays.
</div>

<div class="toolbar">
  <input type="search" id="filter" placeholder="Filtrer : code, nom ou pays…" aria-label="Filtrer les devises">
  <span class="count" id="count">${rows.length} devises</span>
</div>

<table>
  <thead>
    <tr><th></th><th>Code</th><th>Nom</th><th>Symbole</th><th>Exemple</th></tr>
  </thead>
  <tbody id="rows">
${tableRows}
  </tbody>
</table>

<p class="empty" id="empty" hidden>Aucune devise ne correspond à ce filtre.</p>

<script>
  (function () {
    var input = document.getElementById('filter');
    var rows = Array.prototype.slice.call(document.querySelectorAll('#rows tr'));
    var count = document.getElementById('count');
    var empty = document.getElementById('empty');

    input.addEventListener('input', function () {
      var needle = input.value.trim().toLowerCase();
      var visible = 0;
      for (var index = 0; index < rows.length; index += 1) {
        var row = rows[index];
        var match = needle === '' || row.getAttribute('data-search').indexOf(needle) !== -1;
        row.hidden = !match;
        if (match) {
          visible += 1;
        }
      }
      count.textContent = visible + ' devise' + (visible === 1 ? '' : 's');
      empty.hidden = visible !== 0;
    });
  })();
</script>

</body>
</html>
`;

writeFileSync(OUTPUT, html, 'utf8');
console.log(`test/monnaies.html ecrit : ${rows.length} devises`);
