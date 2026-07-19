# Countries Visited

A website & installable PWA for travellers: mark every country of the world as
**Visited**, **Home** or **Going soon**, and see your progress on an interactive
globe, on continent maps, in a searchable list and in stats. Works fully offline.

## Features

- 🌍 **Globe** — drag to rotate, pinch/scroll to zoom, tap a country to mark it (canvas + d3-geo orthographic projection).
- 🗺️ **Continents** — framed maps for all seven continents, including a south-polar view for Antarctica.
- 📋 **List** — grouped by continent, searchable, with status pills.
- 📊 **Stats** — countries visited, % of the world, progress per continent.
- ⚙️ **Two country lists** — the *UN 196* (193 members + Vatican, Palestine, Taiwan) or a *travel list of 204* adding Kosovo, Transnistria, Somaliland, Northern Cyprus, Abkhazia, South Ossetia, Western Sahara and Antarctica.
- 🏝️ **Territories select their sovereign** — tapping Greenland marks Denmark, Puerto Rico marks the USA, Hong Kong marks China, etc.
- 🌗 **Light & dark themes** (auto / manual), desktop sidebar layout, mobile bottom tabs.
- 📱 **Offline-first PWA** — installable, all data on-device (localStorage), backup export/import in Settings.

## Development

```powershell
npm install
npm run dev        # dev server
npm run build      # type-check + production build (dist/)
npm run preview    # serve the production build
```

Regenerate derived assets:

```powershell
npm run generate:data    # src/data/countries.json + territories.json + world-50m.json
npm run generate:icons   # public/ PWA icons from the inline SVG design
```

## How the data works

- `scripts/generate-data.mjs` merges the **world-countries** dataset (names, ISO codes, UN membership, flags, continents) with **Natural Earth 1:50m** geometry from **world-atlas**. Countries and geometry are linked by ISO numeric id, with a name fallback for de facto states that have none (Kosovo, Somaliland, N. Cyprus).
- Entries without geometry (Tuvalu, Transnistria, Abkhazia, South Ossetia) still appear in the list and stats — they just can't be painted on the map.
- `territories.json` maps dependent-territory map features to their sovereign country.

## Project notes

- Statuses and settings persist in `localStorage` under `countries-visited:v1`.
- Map status colors are CVD-validated against each theme's ocean color; if you change them, keep the legend labels (color is never the only cue).
- The changelog is user-facing: it renders in **Settings → What's new**. Maintain it via the project's `changelog` skill (`.claude/skills/changelog/SKILL.md`).
- **Google login & sync plan:** see [docs/GOOGLE_LOGIN.md](docs/GOOGLE_LOGIN.md).

## Roadmap

- Story mode: generate a shareable image of your globe/map for socials.
- Google login + cloud sync of offline changes (documented, not yet implemented).
