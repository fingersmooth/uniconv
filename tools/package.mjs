/**
 * ============================================================================
 *  UniConv — tools/package.mjs
 * ============================================================================
 *
 *  ROLE DE CE FICHIER
 *  ------------------
 *  Construire les archives de publication, de facon REPRODUCTIBLE :
 *
 *    dist/uniconv-<version>.xpi            Firefox (AMO)
 *    dist/uniconv-<version>-chromium.zip   Chrome, Edge, Brave, Opera, Vivaldi
 *    dist/uniconv-<version>-safari.zip     Safari (source a convertir)
 *    dist/safari/uniconv-<version>/        dossier pret pour
 *                                          « safari-web-extension-converter »
 *
 *  POURQUOI PLUSIEURS MANIFESTES
 *  -----------------------------
 *  Firefox accepte « background.scripts » (page d'evenement) et le bloc
 *  « browser_specific_settings ». Chromium MV3 exige un service worker et
 *  refuse le bloc Firefox. Safari suit MV3 mais ne veut pas non plus du bloc
 *  Firefox, et se convertit en projet Xcode (d'ou le dossier non compresse).
 *
 *  CE QUI EST EMBARQUE
 *  -------------------
 *  Uniquement l'execution : manifest.json, src/ (moteur OCR compris), icons/.
 *  Ni docs/, ni test/, ni tools/, ni dist/.
 *
 *  UTILISATION
 *  -----------
 *      cd UniConv
 *      node tools/package.mjs
 *
 *  Le script echoue si un fichier cite par le manifeste manque sur le disque,
 *  ou si l'archive ne contient pas le manifeste a sa racine.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DIST = join(ROOT, 'dist');

/** Tout ce qui part dans les archives. */
export const RUNTIME_ENTRIES = ['manifest.json', 'src', 'icons'];

/** Chemins cites par le manifeste (a verifier et a embarquer). */
export function referencedPaths(manifest) {
  const paths = new Set(['manifest.json']);

  if (manifest.background) {
    for (const script of manifest.background.scripts || []) {
      paths.add(script);
    }
    if (manifest.background.service_worker) {
      paths.add(manifest.background.service_worker);
    }
  }
  if (manifest.options_ui && manifest.options_ui.page) {
    paths.add(manifest.options_ui.page);
  }
  if (manifest.action) {
    if (manifest.action.default_popup) {
      paths.add(manifest.action.default_popup);
    }
    for (const icon of Object.values(manifest.action.default_icon || {})) {
      paths.add(icon);
    }
  }
  for (const icon of Object.values(manifest.icons || {})) {
    paths.add(icon);
  }
  for (const script of manifest.content_scripts || []) {
    for (const file of script.js || []) {
      paths.add(file);
    }
    for (const css of script.css || []) {
      paths.add(css);
    }
  }

  return Array.from(paths);
}

/**
 * Manifeste pour Chromium (Chrome, Edge, Brave, Opera, Vivaldi).
 * Service worker obligatoire en MV3, bloc Firefox interdit.
 */
export function chromiumManifest(manifest) {
  const copy = JSON.parse(JSON.stringify(manifest));
  delete copy.browser_specific_settings;
  copy.background = { service_worker: 'src/background.js' };
  return copy;
}

/**
 * Manifeste pour Safari (16.4+).
 * Meme base que Chromium : pas de bloc Firefox, service worker.
 */
export function safariManifest(manifest) {
  const copy = chromiumManifest(manifest);
  // Safari ignore « open_in_tab » : la page s'ouvre dans son propre onglet.
  if (copy.options_ui) {
    delete copy.options_ui.open_in_tab;
  }
  return copy;
}

function assertZipAvailable() {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
  } catch (error) {
    throw new Error('commande « zip » introuvable : installez zip ou utilisez une archive manuelle');
  }
}

/** Liste les entrees d'une archive. */
export function listArchive(archive) {
  const output = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** Lit un fichier de l'archive sans l'extraire. */
export function readFromArchive(archive, entry) {
  return execFileSync('unzip', ['-p', archive, entry], { encoding: 'utf8' });
}

/**
 * Construit une variante : dossier prepare + archive.
 *
 * @param {object} manifest
 * @param {string} archivePath
 * @param {string} preparedPath
 * @param {boolean} keepPrepared
 */
function buildVariant(manifest, archivePath, preparedPath, keepPrepared) {
  mkdirSync(preparedPath, { recursive: true });

  for (const entry of RUNTIME_ENTRIES) {
    cpSync(join(ROOT, entry), join(preparedPath, entry), { recursive: true });
  }

  writeFileSync(
    join(preparedPath, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );

  execFileSync('zip', ['-r', '-q', archivePath, '.'], { cwd: preparedPath });

  if (!keepPrepared) {
    rmSync(preparedPath, { recursive: true, force: true });
  }
}

/**
 * Construit les trois archives.
 *
 * @returns {{version:string, firefox:string, chromium:string, safari:string,
 *            safariDir:string, entries:string[]}}
 */
export function buildPackages() {
  assertZipAvailable();

  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  const version = manifest.version;

  // 1. Verification : tout ce que cite le manifeste existe sur le disque.
  const missing = referencedPaths(manifest).filter((path) => !existsSync(join(ROOT, path)));
  if (missing.length > 0) {
    throw new Error('fichiers cites par le manifeste introuvables : ' + missing.join(', '));
  }

  // 2. Dossier de sortie propre.
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  // 3. Firefox : le dossier tel quel (background.scripts + bloc gecko).
  const firefox = join(DIST, `uniconv-${version}.xpi`);
  execFileSync('zip', ['-r', '-q', firefox, ...RUNTIME_ENTRIES], { cwd: ROOT });

  // 4. Chromium et Safari : copies avec manifeste adapte.
  const chromium = join(DIST, `uniconv-${version}-chromium.zip`);
  buildVariant(
    chromiumManifest(manifest),
    chromium,
    join(DIST, 'chromium'),
    false
  );

  const safari = join(DIST, `uniconv-${version}-safari.zip`);
  const safariDir = join(DIST, 'safari', `uniconv-${version}`);
  buildVariant(safariManifest(manifest), safari, safariDir, true);

  // 5. Verification : manifeste a la racine, fichiers cites presents.
  for (const [archive, variant] of [
    [firefox, manifest],
    [chromium, chromiumManifest(manifest)],
    [safari, safariManifest(manifest)]
  ]) {
    const entries = listArchive(archive);
    if (!entries.includes('manifest.json')) {
      throw new Error('manifest.json n\'est pas a la racine de ' + archive);
    }
    for (const path of referencedPaths(variant)) {
      if (!entries.includes(path)) {
        throw new Error(`${path} manque dans ${archive}`);
      }
    }
  }

  return {
    version,
    firefox,
    chromium,
    safari,
    safariDir,
    entries: referencedPaths(manifest)
  };
}

// Execution directe (node tools/package.mjs) : on affiche le resultat.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = buildPackages();
    console.log(`Archives construites (version ${result.version}) :`);
    console.log(`  Firefox   : ${result.firefox}`);
    console.log(`  Chromium  : ${result.chromium}`);
    console.log(`  Safari    : ${result.safari}`);
    console.log(`  Safari    : ${result.safariDir} (dossier pour Xcode)`);
    console.log(`  ${result.entries.length} fichiers cites par le manifeste, tous presents.`);
  } catch (error) {
    console.error('Empaquetage impossible : ' + error.message);
    process.exit(1);
  }
}
