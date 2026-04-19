# Icons

Replace these with your own PNG icons.

- `icon-192.png` — 192×192 PNG
- `icon-512.png` — 512×512 PNG (maskable)

Quick way to generate free PNG icons from an SVG:
```bash
# requires librsvg (brew install librsvg  /  apt-get install librsvg2-bin)
rsvg-convert -w 192 -h 192 icon.svg > icon-192.png
rsvg-convert -w 512 -h 512 icon.svg > icon-512.png
```

Or use any free online maskable-icon generator.

A starter SVG (`icon.svg`) is included in this folder.
