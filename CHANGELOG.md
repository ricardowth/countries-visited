# Changelog

All notable changes to Countries Visited are documented here. The app shows this
in Settings → What's new.

## [Unreleased]

### Changed

- The Continents tab is now called Map.
- Continent maps fill the whole map area instead of floating in empty space, so each continent appears larger.

### Fixed

- Fixed a bug where signing in on a new device could wipe your cloud-saved countries instead of merging with them, if the new device pushed its own empty state before it had pulled your existing data down.
- Settings now shows a warning if cloud sync fails (for example, a permission or connection problem), instead of silently doing nothing.
- Fixed the globe being hard to tap on phones — a touch that wobbled slightly was often mistaken for a drag and the tap got ignored.
- Fixed the country menu on the globe instantly closing itself right after opening on phones.
- Disabled pinch/double-tap page zoom, which could interfere with taps on phones.

## [0.2.0] - 2026-07-20

### Added

- Optional Google sign-in in Settings: your marked countries are backed up to the cloud and stay in sync across your devices. Changes made offline sync automatically when you're back online. Without signing in, everything keeps working on your device as before.
- Country names on the globe and continent maps, sized to each country — small countries hide their label instead of cluttering the map.

- Setting to show or hide country names on the maps.
- The globe zooms much deeper, and taps near a tiny country snap to it — Vatican City, San Marino and Liechtenstein are now reachable.

### Changed

- The globe is much smoother to rotate and zoom, on phones and desktops, and now glides with momentum when you fling it.
- Desktop now uses the full window: the country list flows into columns and continent progress shows side by side.

## [0.1.0] - 2026-07-19

### Added

- Mark any country as Visited, Home or Going soon.
- Interactive globe: drag to rotate, pinch or scroll to zoom, tap a country to mark it.
- Continent maps for Africa, Asia, Europe, North America, South America and Oceania.
- Country list grouped by continent, with search.
- Stats: countries visited, percentage of the world, and progress per continent.
- Choice of country list: the UN 196 (193 members plus Vatican City, Palestine and Taiwan) or a travel list of 204 that adds Kosovo, Transnistria, Somaliland, Northern Cyprus, Abkhazia, South Ossetia, Western Sahara and Antarctica.
- Antarctica is its own continent with a south-pole map view.
- Tapping a territory marks its country: Greenland counts as Denmark, Puerto Rico as the United States, Hong Kong as China, and so on.
- Light and dark themes, following your device setting or set manually.
- Desktop layout with sidebar navigation; mobile keeps the bottom tab bar.
- Works fully offline and can be installed on your phone as an app.
- Export and import a backup of your marked countries.
