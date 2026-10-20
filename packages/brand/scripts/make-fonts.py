"""Cut CityTurfer's static Archivo fonts from the variable font (brand-system skill, Typography).

The app and the website use the same two files. React Native has no variable-font support, and on
iOS a font is addressed by its PostScript name, so each instance gets a PostScript name equal to
its file name (`ArchivoExpanded-Black.ttf` -> `ArchivoExpanded-Black`).

Usage (fonttools + brotli in a virtualenv):
  curl -sL -o Archivo-VF.ttf "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf"
  python make-fonts.py Archivo-VF.ttf packages/brand/fonts
"""
import os
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

# (file / PostScript name, family, style, axes)
INSTANCES = [
    ('ArchivoExpanded-Black', 'Archivo Expanded', 'Black', {'wdth': 125, 'wght': 900}),
    ('Archivo-ExtraBold', 'Archivo', 'ExtraBold', {'wdth': 100, 'wght': 800}),
]
# Basic Latin, Latin-1, Latin Extended-A (Polish), punctuation, arrows, superscripts (km²), minus.
UNICODES = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x180))
    + list(range(0x2000, 0x206F))
    + [0x2070, 0x2074, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x00B2, 0x00B3]
)


def rename(font, ps_name, family, style):
    names = font['name']
    full = f'{family} {style}'
    for record in list(names.names):
        if record.nameID in (16, 17, 21, 22, 25):
            names.removeNames(nameID=record.nameID)
    for name_id, value in ((1, full), (2, 'Regular'), (3, f'CityTurfer;{ps_name}'), (4, full), (6, ps_name)):
        names.setName(value, name_id, 3, 1, 0x409)
        names.setName(value, name_id, 1, 0, 0)
    font['OS/2'].usWeightClass = 400  # the style lives in the family name, so RN never synthesises bold


def main(src, out_dir):
    for ps_name, family, style, axes in INSTANCES:
        font = instantiateVariableFont(TTFont(src), axes, updateFontNames=False)
        options = Options()
        options.layout_features = ['*']
        options.name_IDs = ['*']
        options.notdef_outline = True
        subsetter = Subsetter(options)
        subsetter.populate(unicodes=UNICODES)
        subsetter.subset(font)
        if 'DSIG' in font:
            del font['DSIG']
        rename(font, ps_name, family, style)
        font.save(os.path.join(out_dir, f'{ps_name}.ttf'))
        font.flavor = 'woff2'
        font.save(os.path.join(out_dir, f'{ps_name}.woff2'))
        print(ps_name, 'ok')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
