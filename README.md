# Cartas de Shards

A browser card game built with Phaser 3 and TypeScript. The player moves through a scrolling run of encounters, plays cards in turn based combat, fights enemies and bosses, collects loot and relics, upgrades a deck, and spends progress on persistent buildings and unlocks between runs.

## Tech stack

- TypeScript
- Phaser 3 for rendering, scenes, and input
- Vite for the dev server and production build
- Vitest for unit tests
- idb-keyval for saving progress to IndexedDB
- mqtt for broadcasting and syncing daily run results
- nanoid for id generation
- Node tooling (canvas, sharp, opentype.js) used by the local asset and data scripts

## What it does

- Turn based card combat against enemies with their own attack card decks
- Boss encounters with dedicated systems and exit transitions
- Deck building: choose a starting deck, customize cards, remove cards, and forge upgrades
- Shop and forge scenes for spending in run resources
- Loot, treasure, and relics that change how a run plays
- Meta progression that persists between runs: unlocks, a city hub, and upgradable buildings
- Card collection and a card library for browsing owned cards
- Seeded daily runs with results broadcast over MQTT
- Difficulty scaling and a data driven definition of enemies, tiles, terrain, and decks
- Internationalization layer for localized strings
- Responsive canvas scaling authored in an 800x600 game space and fit to the viewport

## Running locally

Requires Node.js and npm.

```bash
git clone https://github.com/nicolasfvp/autoscroller.git
cd autoscroller
npm install
npm run dev
```

Vite prints a local URL to open in the browser.

Other scripts:

```bash
npm run build       # type check with tsc, then build with vite
npm run preview     # serve the production build locally
npm test            # run the vitest suite
npm run validate-data  # validate the game data files
```

## Project structure

```
src/
  scenes/       Phaser scenes (menu, combat, shop, forge, city hub, collection, ...)
  systems/      Game systems (bosses, loot, forge, meta progression, RNG, MQTT, ...)
  data/         Enemy, tile, terrain, deck, and difficulty definitions
  core/         Core game logic
  effects/      Visual effects
  ui/           UI components
  i18n/         Localization strings and helpers
  integrations/ External integrations
docs/           Documentation, including design notes under docs/design
public/         Static assets served by Vite
scripts/        Data and asset helper scripts
tests/          Vitest tests
```

## Status

Personal project and work in progress. The internal package name is `rogue-scroll`.

## License

Released under the MIT License. See the LICENSE file.
