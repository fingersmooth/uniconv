# Bibliothèques tierces — UniConv

## Tesseract.js 5.1.1

- Projet : https://github.com/naptha/tesseract.js
- Version : **5.1.1**
- Licence : **Apache License 2.0**
- Fichiers vendorisés :
  - `src/vendor/tesseract/tesseract.min.js`
  - `src/vendor/tesseract/worker.min.js`
  - `src/vendor/tesseract/tesseract-core-simd.wasm.js`
- Ces fichiers sont utilisés **sans modification**.
- Aucun code n'est chargé depuis un CDN : les chemins sont locaux.

Empreintes SHA-256 :

```text
tesseract-core-simd.wasm.js  63f232c4f7a97b04e52eb940202700b2c6239783a75d0ff0553274fac530cd5c
tesseract.min.js  a8e29918d098b2b06e1012bdaeffb4aec0445c5d5654709023e0bd1f442a80e8
worker.min.js  aca1229639fc9907d86f96e825955a2b7c5716d17f3bc3acd71f9c7ab66181fc
```


## Modèles de langue Tesseract

- `src/vendor/tessdata/eng.traineddata.gz`
- `src/vendor/tessdata/fra.traineddata.gz`

Ces modèles proviennent du projet Tesseract (`tessdata_fast`) et sont
distribués sous licence Apache 2.0. Ils sont embarqués localement.
