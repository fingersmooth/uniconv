#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================================
 tools/make-icons.py — generateur des icones d'UniConv
============================================================================

ROLE
----
Fabriquer les fichiers PNG de l'icone de l'extension (16, 32, 48 et 128 px)
sans aucune bibliotheque externe. Ce script n'est PAS utilise par l'extension
elle-meme : c'est un outil de fabrication, a relancer seulement si on veut
changer l'icone.

POURQUOI CE SCRIPT EXISTE
-------------------------
Pillow (la bibliotheque Python de dessin) n'est pas installee sur cette
machine, et on ne veut rien installer pour si peu. Python sait en revanche
ecrire un PNG tout seul (modules `zlib` et `struct`) : ce script construit
donc l'image pixel par pixel, puis l'encode a la main.

Les deux caracteres sont dessines a partir de motifs ecrits au clavier dans le
code (voir BITMAP_EURO et BITMAP_DOLLAR plus bas). Aucune police de caracteres
n'est necessaire, donc aucun risque que le resultat change d'un ordinateur a
l'autre.

METHODE
-------
1. On dessine une grande image (512 x 512) : les bords sont alors lisses.
2. On la reduit a 128, 48, 32 puis 16 px en moyennant les pixels.
Cette technique s'appelle le « supersampling ».

UTILISATION
-----------
    cd UniConv
    python3 tools/make-icons.py

Sortie : icons/icon16.png, icons/icon32.png, icons/icon48.png, icons/icon128.png
"""

import os
import struct
import sys
import zlib

# ---------------------------------------------------------------------------
# Reglages generaux
# ---------------------------------------------------------------------------

#: Dossier de sortie, calcule par rapport a l'emplacement de ce script
#: (donc independant du dossier depuis lequel on lance la commande).
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(PROJECT_ROOT, "icons")

#: Facteur de surechantillonnage. 4 = bon compromis nettete / temps de calcul.
SUPERSAMPLE = 4

#: Tailles finales demandees par les navigateurs.
#: 16  = affichage dans un onglet
#: 32  = barre des taches / fenetres
#: 48  = gestionnaire d'extensions
#: 128 = magasin d'extensions et page d'installation
TARGET_SIZES = (16, 32, 48, 128)

#: Palette de l'icone, en RGB (rouge, vert, bleu), chaque valeur de 0 a 255.
BACKGROUND_TOP = (58, 121, 255)      # bleu clair, en haut
BACKGROUND_BOTTOM = (23, 68, 196)    # bleu profond, en bas (degrade vertical)
GLYPH_INFO = (255, 255, 255)         # le caractere € et le separateur, en blanc
GLYPH_TARGET = (178, 212, 255)       # le caractere $ en bleu tres clair

#: Proportions du dessin, exprimees en fraction de la largeur de l'icone.
#: Tout est proportionnel : la meme formule sert donc pour 16 px comme pour 128 px.
INSET_RATIO = 0.055          # marge entre le bord de l'image et le carre
CORNER_RADIUS_RATIO = 0.22   # arrondi des coins
GLYPH_HEIGHT_RATIO = 0.36    # hauteur des caracteres
BAR_HEIGHT_RATIO = 0.56      # hauteur du trait separateur vertical
BAR_WIDTH_RATIO = 0.028      # epaisseur du trait separateur
GAP_RATIO = 0.040            # espace entre un caractere et le trait separateur


# ===========================================================================
# 1. Encodeur PNG minimal
# ===========================================================================

def _png_chunk(tag: bytes, payload: bytes) -> bytes:
    """Construit un bloc PNG : longueur + nom + donnees + somme de controle."""
    return (
        struct.pack(">I", len(payload))
        + tag
        + payload
        + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
    )


def write_png(path: str, pixels, width: int, height: int) -> None:
    """
    Ecrit un fichier PNG en RGBA (rouge, vert, bleu, transparence).

    :param pixels: liste de `height` lignes, chaque ligne etant une liste de
                   `width` tuples (r, g, b, a) avec des valeurs de 0 a 255.
    """
    # Chaque ligne PNG commence par un octet 0 (« pas de filtre »), suivi des
    # octets RGBA de la ligne.
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))

    # IHDR : dimensions et format de couleur (6 = RGBA sur 8 bits).
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)

    png = (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _png_chunk(b"IEND", b"")
    )

    with open(path, "wb") as handle:
        handle.write(png)


# ===========================================================================
# 2. Les trois motifs dessines a la main
# ===========================================================================
# Un point '.' = transparent, un 'X' = encre. Ce sont de petites images en
# noir et blanc, ecrites directement dans le code.

#: Le caractere €. Volontairement plus etroit que haut (7 colonnes pour
#: 9 lignes) : c'est cette proportion qui rend la lettre reconnaissable. Un
#: motif carre donnerait un € ecrase et informe, comme on l'a constate.
BITMAP_EURO = (
    "..XXX..",
    ".X...X.",
    "X......",
    "XXXX...",
    "X......",
    "XXXX...",
    "X......",
    ".X...X.",
    "..XXX..",
)

#: Le caractere $, dans les memes proportions que le € pour rester coherent.
BITMAP_DOLLAR = (
    "...X...",
    "..XXXX.",
    ".X.X...",
    "..XXX..",
    "...XXX.",
    "...X.X.",
    ".XXXX..",
    "...X...",
    "...X...",
)


def resample_bitmap(bitmap, target_height: int):
    """
    Transforme un petit motif (par exemple 9 x 9 cases) en un masque de la
    hauteur demandee, en conservant EXACTEMENT ses proportions.

    Comment ca marche : pour chaque pixel du resultat, on regarde la zone
    correspondante dans le motif d'origine et on calcule le taux de remplissage
    (0 = vide, 1 = plein). C'est ce qui evite d'ecraser les traits fins : un
    simple agrandissement « au plus proche » ferait disparaitre la barre
    horizontale du caractere €, comme on l'a constate.

    :return: (masque, largeur, hauteur), le masque contenant des entiers 0-255.
    """
    source_height = len(bitmap)
    source_width = len(bitmap[0])

    # Le motif doit rester carre : on deduit la largeur de la hauteur voulue.
    target_width = max(1, int(round(target_height * source_width / source_height)))

    mask = []
    for y in range(target_height):
        # Plage de cases couvertes verticalement par ce pixel de resultat.
        source_y0 = y * source_height / target_height
        source_y1 = (y + 1) * source_height / target_height
        row = []
        for x in range(target_width):
            source_x0 = x * source_width / target_width
            source_x1 = (x + 1) * source_width / target_width

            # On echantillonne 4 x 4 points dans la zone et on compte ceux qui
            # tombent sur de l'encre.
            hits = 0
            total = 0
            for sub_y in range(4):
                sample_y = source_y0 + (source_y1 - source_y0) * (sub_y + 0.5) / 4
                cell_y = min(source_height - 1, int(sample_y))
                for sub_x in range(4):
                    sample_x = source_x0 + (source_x1 - source_x0) * (sub_x + 0.5) / 4
                    cell_x = min(source_width - 1, int(sample_x))
                    total += 1
                    if bitmap[cell_y][cell_x] == "X":
                        hits += 1
            row.append(int(round(255 * hits / total)))
        mask.append(row)
    return mask, target_width, target_height


# ===========================================================================
# 3. Outils de dessin
# ===========================================================================

def rounded_box_distance(x: float, y: float, box_size: float, radius: float) -> float:
    """
    Distance signee d'un point au bord d'un carre arrondi.

    Le carre va de (0, 0) a (box_size, box_size) et ses coins sont arrondis
    avec le rayon donne.

    :return: valeur negative a l'interieur, positive a l'exterieur, 0 sur le bord.

    Formule classique : on plie le plan sur un quadrant (valeur absolue), puis
    on cherche le point le plus proche du « coin rentre » de `radius`. C'est
    exact partout, y compris dans les coins — contrairement a un simple test de
    rectangle qui laisserait les coins carres.
    """
    folded_x = abs(x - box_size / 2.0) - (box_size / 2.0 - radius)
    folded_y = abs(y - box_size / 2.0) - (box_size / 2.0 - radius)

    outside_x = max(folded_x, 0.0)
    outside_y = max(folded_y, 0.0)
    outside_distance = (outside_x * outside_x + outside_y * outside_y) ** 0.5

    inside_distance = min(max(folded_x, folded_y), 0.0)
    return outside_distance + inside_distance - radius


def blend(base, top, alpha: float):
    """Melange deux couleurs RGBA. `alpha` va de 0 (base) a 1 (top)."""
    alpha = max(0.0, min(1.0, alpha))
    return tuple(
        int(round(base[i] * (1.0 - alpha) + top[i] * alpha)) for i in range(4)
    )


def paste_mask(canvas, size: int, mask, mask_width: int, mask_height: int,
               offset_x: int, offset_y: int, color) -> None:
    """Colle un masque sur le fond, en melangeant selon son opacite."""
    for y in range(mask_height):
        canvas_y = offset_y + y
        if not (0 <= canvas_y < size):
            continue
        for x in range(mask_width):
            canvas_x = offset_x + x
            if not (0 <= canvas_x < size):
                continue
            ink = mask[y][x] / 255.0
            if ink <= 0.0:
                continue
            canvas[canvas_y][canvas_x] = blend(
                canvas[canvas_y][canvas_x], color + (255,), ink
            )


# ===========================================================================
# 4. Composition de l'icone
# ===========================================================================

def draw_icon(size: int) -> list:
    """
    Dessine l'icone complete a la taille demandee.

    IMPORTANT : toutes les dimensions sont calculees en fraction de `size`.
    C'est ce qui garantit qu'un rendu a 512 px et un rendu a 16 px donnent
    exactement le meme dessin, simplement plus ou moins fin.
    """
    inset = size * INSET_RATIO
    box_size = size - 2.0 * inset
    radius = box_size * CORNER_RADIUS_RATIO

    canvas = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]

    # --- 1. Fond : carre arrondi avec degrade vertical ------------------------
    for y in range(size):
        # Position verticale de 0 (haut) a 1 (bas) : sert au degrade.
        ratio = y / max(1, size - 1)
        base_color = tuple(
            int(round(BACKGROUND_TOP[i] * (1 - ratio) + BACKGROUND_BOTTOM[i] * ratio))
            for i in range(3)
        ) + (255,)

        for x in range(size):
            # On echantillonne 4 points dans le pixel : les bords sont ainsi
            # partiellement transparents au lieu d'etre en escalier.
            samples = (
                (x + 0.25 - inset, y + 0.25 - inset),
                (x + 0.75 - inset, y + 0.25 - inset),
                (x + 0.25 - inset, y + 0.75 - inset),
                (x + 0.75 - inset, y + 0.75 - inset),
            )
            covered = 0
            for (sample_x, sample_y) in samples:
                if rounded_box_distance(sample_x, sample_y, box_size, radius) <= 0.0:
                    covered += 1
            if covered == 0:
                continue
            canvas[y][x] = blend((0, 0, 0, 0), base_color, covered / len(samples))

    # --- 2. Preparation des deux lettres a la bonne echelle ------------------
    glyph_height = int(size * GLYPH_HEIGHT_RATIO)
    bar_height = int(size * BAR_HEIGHT_RATIO)
    bar_width = max(1, int(round(size * BAR_WIDTH_RATIO)))
    gap = int(size * GAP_RATIO)

    euro_mask, euro_w, euro_h = resample_bitmap(BITMAP_EURO, glyph_height)
    dollar_mask, dollar_w, dollar_h = resample_bitmap(BITMAP_DOLLAR, glyph_height)

    # Le separateur vertical n'a pas besoin d'un motif : c'est un simple
    # rectangle plein, qu'on decrit directement sous forme de masque.
    bar_mask = [[255] * bar_width for _ in range(bar_height)]

    # --- 3. Placement horizontal, centre -------------------------------------
    total_width = euro_w + gap + bar_width + gap + dollar_w
    start_x = (size - total_width) // 2
    middle_y = size // 2

    euro_x = start_x
    bar_x = euro_x + euro_w + gap
    dollar_x = bar_x + bar_width + gap

    # --- 4. Dessin des deux lettres et du separateur -------------------------
    paste_mask(canvas, size, euro_mask, euro_w, euro_h,
               euro_x, middle_y - euro_h // 2, GLYPH_INFO)
    paste_mask(canvas, size, bar_mask, bar_width, bar_height,
               bar_x, middle_y - bar_height // 2, GLYPH_INFO)
    paste_mask(canvas, size, dollar_mask, dollar_w, dollar_h,
               dollar_x, middle_y - dollar_h // 2, GLYPH_TARGET)

    return canvas


# ===========================================================================
# 5. Reduction de l'image (pour obtenir 128, 48, 32 et 16 px)
# ===========================================================================

def downsample(canvas, source_size: int, target_size: int) -> list:
    """
    Reduit l'image en moyennant les pixels.

    On additionne les composantes rouge, vert, bleu et transparence des pixels
    d'origine, puis on divise. C'est ce qui evite l'effet « escalier ».
    """
    output = [[(0, 0, 0, 0) for _ in range(target_size)] for _ in range(target_size)]
    block = source_size / target_size

    for y in range(target_size):
        y_start = int(y * block)
        y_end = max(y_start + 1, int((y + 1) * block))
        for x in range(target_size):
            x_start = int(x * block)
            x_end = max(x_start + 1, int((x + 1) * block))

            sums = [0, 0, 0, 0]
            count = 0
            for source_y in range(y_start, min(y_end, source_size)):
                for source_x in range(x_start, min(x_end, source_size)):
                    pixel = canvas[source_y][source_x]
                    for index in range(4):
                        sums[index] += pixel[index]
                    count += 1

            if count:
                output[y][x] = tuple(int(round(total / count)) for total in sums)
    return output


# ===========================================================================
# 6. Programme principal
# ===========================================================================

def main() -> int:
    print("UniConv — fabrication des icones")
    print(f"  dossier de sortie : {ICONS_DIR}")

    os.makedirs(ICONS_DIR, exist_ok=True)

    # Taille de travail : la plus grande taille demandee, multipliee par le
    # facteur de surechantillonnage pour obtenir des bords nets.
    base_size = max(TARGET_SIZES)
    work_size = base_size * SUPERSAMPLE
    print(f"  rendu interne     : {work_size} x {work_size} px, puis reduction")

    canvas = draw_icon(work_size)

    for size in TARGET_SIZES:
        reduced = downsample(canvas, work_size, size)
        path = os.path.join(ICONS_DIR, f"icon{size}.png")
        write_png(path, reduced, size, size)
        print(f"  ecrit             : {path}")

    print("Termine.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
