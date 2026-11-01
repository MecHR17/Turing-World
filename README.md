# Turing World

A sandbox for computability and complexity theory: machines, tapes, reductions and devices on one grid.

## Hosting

`dist/turing-world.html` is the whole site in one file. Upload it to any static host (GitHub Pages, Netlify,
Cloudflare Pages, your own server), rename it to `index.html` if you like, and you are done. There is no server
side. Fonts come from Google Fonts and fall back to system fonts if that is blocked.

## Building

    python3 build.py

writes `dist/turing-world.html` (the web version) and `turing-world.html` (the claude.ai artifact version).

## Editing the built-in worlds

**Texts.** Each world is one entry of `EXAMPLES` in `examples.js`, found by its `key` (e.g. `key: 'inc'`).
`title` is the name in the Worlds menu, `tag` the little badge, `guide` the text in the guide panel (HTML:
`<b>`, `<i>` and so on work). Which group a world is listed under, and in what order, is `WORLD_GROUPS` near
the top of the world-menu code in `appmain.js`.

**Content, by hand.** In the same `EXAMPLES` entry: `tapes` (name, initial contents, alphabet, kind),
`machines` (`src` is the machine's source, `bind` connects its ports to tapes by name), `devices` and
`reductions`. Positions on the grid are in `LAYOUT` further down `examples.js`, by element name.

**Content, in the app (easier for anything visual).**
1. Open the world, change whatever you like: sources, wiring, tapes, positions, devices.
2. Worlds → Save or load a world → Save as file.
3. Put the `.json` file in `worlds/` and run `python3 build.py`.

The saved file starts with the world's `key`, `title`, `tag`, `group` and `guide`, so you can also edit its texts
there. A file in `worlds/` replaces the built-in world with the same key (texts and content); a new key adds a
new world, listed under its `group`. Delete the file to go back to the version in `examples.js`.

## Files

- `core.js` engine, `lang.js` regular expressions and grammars, `examples.js` built-in worlds, `world.js` world setup
- `lib.js`, `labs.js`, `devices.js`, `appmain.js`, `manual.js` the interface; `ui.html` markup and CSS
- `manual-images.js` the manual’s screenshots (WebP data); `theory.js` the Theory chapters of the manual
- `host-web.js` how the web version saves files (a normal download)
- `host-artifact.js` how the claude.ai version saves files; only used by the artifact build
- `worlds/` your saved worlds, bundled by the build

Script machines run the JavaScript written in them, so only import world files from people you trust.
