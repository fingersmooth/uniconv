# Checklist de publication Firefox

## Avant de soumettre

- [ ] `node tools/package.mjs` exécuté sans erreur
- [ ] `dist/uniconv-2.9.8.xpi` présent
- [ ] `manifest.json` : `version` = 2.9.8, `id` = `uniconv@fingersmooth.github.io`
- [ ] Les 16 suites passent (979 vérifications)
- [ ] Test manuel dans Firefox : survol, menu, OCR, rapport
- [ ] Politique de confidentialité publiée en ligne

## Soumission AMO

1. Ouvrir <https://addons.mozilla.org/developers/>
2. **Connexion** avec le compte Mozilla gratuit
3. **Submit a New Add-on**
4. Choisir **On this site** (signature automatique)
5. Envoyer `dist/uniconv-2.9.8.xpi`
6. Copier les textes de `FICHE-AMO.md`
7. Renseigner la politique de confidentialité (URL GitHub Pages)
8. Soumettre et attendre la validation

## Après validation

- [ ] L'extension apparaît sur la fiche publique
- [ ] Installation en un clic vérifiée
- [ ] Version affichée dans le popup = 2.9.8
- [ ] Créer une Release GitHub `v2.9.8`

## Pour chaque nouvelle version

1. Incrémenter les 6 fichiers de version
2. `node tools/package.mjs`
3. Les 16 suites
4. AMO → **Upload a New Version**
