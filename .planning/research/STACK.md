# Stack Research

**Domain:** Web-based 2D roguelike auto-battler with card/deck systems and online co-op multiplayer
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH (Phaser 3 ecosystem is mature and well-documented; multiplayer layer relies on Colyseus which is stable but less widely adopted)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Phaser | 3.90.0 | Game engine (rendering, physics, scenes, input, audio) | Mature, stable, last official v3 release. Phaser 4 is NOT production-ready on npm (stuck at 0.2.2 as `@phaserjs/phaser`). v3.90.0 has zero known major bugs and massive community resources. The project already uses it. |
| TypeScript | ~5.7 | Type safety, developer experience | Already in use. Strict mode enabled. Critical for Colyseus schema decorators and complex game state typing. |
| Vite | ~8.0 | Dev server, bundler | Vite 8 (released March 2026) uses Rolldown (Rust-based bundler), 10-30x faster builds than Rollup. Migration from current Vite 5 is straightforward -- rename `rollupOptions` to `rolldownOptions`, add `legacy.inconsistentCjsInterop: true` if CJS imports break. |
| Colyseus | 0.17.x (server) | Real-time multiplayer server | Purpose-built for multiplayer games. Room-based architecture maps directly to co-op sessions. Schema-based state sync with binary delta compression. Built-in matchmaking, reconnection support. Official Phaser integration tutorial exists. |
| colyseus.js | 0.16.x (client) | Multiplayer client SDK | Official JS/TS client for Colyseus. Integrates into Phaser scenes directly. |
| Node.js | 22 LTS | Server runtime for Colyseus | Required by Colyseus. LTS version for stability. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @colyseus/schema | 0.17.x | Shared state schema definitions | Defining room state (player stats, deck state, combat state) shared between server and all clients. Use `@type()` decorators for sync fields. |
| idb-keyval | latest | Persistent save data (IndexedDB wrapper) | Meta-progression storage (unlocked cards, classes, tiles). 295 bytes brotli'd. Use instead of raw localStorage for structured data beyond 5MB. |
| uuid / nanoid | latest | Unique ID generation | Entity IDs for cards, relics, tiles, players. nanoid already in project dependencies. |
| @colyseus/monitor | 0.17.x | Server monitoring dashboard | Development and production monitoring of rooms, connections, state size. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite dev server | HMR, fast refresh during development | Already configured with `host: true` for LAN testing. |
| Colyseus Playground | Test multiplayer rooms without client | Built into Colyseus dev tools. Allows sending mock messages and inspecting state. |
| TypeScript strict mode | Catch bugs at compile time | Already enabled. Keep `noUnusedLocals` and `noUnusedParameters` for clean code. |
| Phaser debug overlay | Physics debugging, FPS counter | Already enabled (`debug: true` in arcade config). Disable in production. |

## Architecture Decisions

### Why Phaser 3, NOT Phaser 4

**Decision: Stay on Phaser 3.90.0.** Confidence: HIGH.

- Phaser 4 is NOT available as a stable npm package. `@phaserjs/phaser` is at version 0.2.2 (4 years old). The RC releases mentioned on the Phaser website are not reflected on npm.
- Phaser 3.90.0 is explicitly the last v3 release. All future development goes to v4. But v3 is feature-complete with no known major bugs.
- The migration path from v3 to v4 is reportedly smooth (same internal API), so starting on v3 now and migrating later is low-risk.
- The existing codebase already has 15+ scenes built on Phaser 3. No reason to rewrite.

### Why Colyseus, NOT Socket.IO / Custom WebSocket

**Decision: Use Colyseus for multiplayer.** Confidence: HIGH.

- Socket.IO is a generic WebSocket library. You'd need to build room management, matchmaking, state sync, reconnection, and serialization from scratch. That's months of work for features Colyseus ships out of the box.
- Colyseus uses uWebSockets.js under the hood (C++ WebSocket implementation), which is 10x faster than Socket.IO.
- Colyseus has an official Phaser integration tutorial with examples for player movement, interpolation, client prediction, and fixed tickrate.
- Room-based architecture maps perfectly to co-op sessions (1 room = 1 game session with up to 4 players).
- Schema-based state sync with `@type()` decorators gives full TypeScript safety between server and client.
- Built-in filtering allows hiding card data from other players (important for any future PvP consideration).

### Why Vite 8, NOT Vite 5

**Decision: Upgrade to Vite 8.** Confidence: MEDIUM.

- Vite 8 (March 12, 2026) ships Rolldown, a Rust-based bundler that replaces both esbuild (dev) and Rollup (build) with a single bundler. 10-30x faster production builds.
- Migration from Vite 5 requires going through v6 and v7 breaking changes. Key changes: `rollupOptions` renamed to `rolldownOptions`, stricter CJS interop, module type handling.
- The project's Vite config is minimal (just `base` and `server.host`), so migration risk is low.
- However, if Phaser 3 has any CJS interop issues with Rolldown, the fallback is `legacy.inconsistentCjsInterop: true`.
- **Alternative:** Stay on Vite 6 (stable, well-tested) if Vite 8 causes any bundling issues with Phaser. Vite 6 is safe and performant enough.

### Why NOT an ECS Framework

**Decision: Use Phaser's built-in scene/object system, not a separate ECS.** Confidence: MEDIUM.

- ECS (Entity-Component-System) shines for games with thousands of similar entities needing uniform processing (bullet hells, RTS, simulations).
- This game has a small number of distinct entity types (hero, enemies, cards, tiles, relics) with rich, unique behaviors. OOP with Phaser GameObjects is more natural and the codebase already follows this pattern.
- The auto-combat system processes a deck sequentially (not thousands of entities in parallel), so ECS composition offers no architectural benefit.
- If combat complexity grows significantly (50+ simultaneous entities with shared behaviors), revisit this decision.

### Persistence Strategy

**Decision: idb-keyval for client-side persistence, Colyseus rooms for session state.** Confidence: HIGH.

- Meta-progression (unlocked cards, tiles, classes, XP) persists in IndexedDB via idb-keyval. Simple key-value API, async, no 5MB limit.
- Run state (current deck, HP, gold, loop count) lives in Colyseus room state during multiplayer, or in-memory during solo play.
- Solo play does NOT require the Colyseus server. The game logic module should be isomorphic -- runnable on client (solo) or server (multiplayer).
- Future: If accounts/cloud saves are needed, add a REST API alongside Colyseus. But for MVP, local persistence is sufficient.

## Installation

```bash
# Core game engine (already installed)
npm install phaser@3.90.0

# Multiplayer server (new package, for server directory)
npm install colyseus@0.17 @colyseus/schema@0.17 @colyseus/monitor@0.17

# Multiplayer client (add to game client)
npm install colyseus.js@0.16

# Persistence
npm install idb-keyval

# Bundler upgrade (when ready)
npm install -D vite@8 typescript@~5.7
```

## Project Structure (Recommended)

```
autoscroller/
  client/                  # Phaser game (current src/ moves here)
    src/
      scenes/
      objects/
      ui/
      data/
      audio/
      effects/
      network/             # Colyseus client integration
        GameRoom.ts        # Room connection management
        StateSync.ts       # State change listeners
      main.ts
    vite.config.ts
    package.json
  server/                  # Colyseus server (new)
    src/
      rooms/
        GameRoom.ts        # Room logic, game loop
        schema/
          GameState.ts     # Shared state schema
          PlayerState.ts
          CombatState.ts
          DeckState.ts
      index.ts             # Server entry
    package.json
  shared/                  # Shared types/constants
    types/
      cards.ts
      tiles.ts
      combat.ts
    constants.ts
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Phaser 3.90.0 | Phaser 4 (when stable on npm) | When Phaser 4 reaches stable npm release AND you need v4-specific features (new renderer, IBL). Not before. |
| Colyseus 0.17 | Socket.IO + custom rooms | If you need integration with an existing Socket.IO infrastructure or need features Colyseus doesn't support. Not recommended for greenfield. |
| Colyseus 0.17 | Nakama (open-source game server) | If you need built-in leaderboards, tournaments, in-app purchases, or social features. Heavier setup but more batteries-included for live service games. |
| Vite 8 | Vite 6 | If Phaser 3 CJS interop breaks with Rolldown. Vite 6 is stable and fast enough. |
| idb-keyval | localStorage | If save data is trivially small (< 100KB) and you don't need async access. But idb-keyval is 295 bytes, so there's no reason not to use it. |
| In-memory + Colyseus state | Redis | If you need persistent server-side state across crashes/restarts or horizontal scaling. For MVP solo/co-op, not needed. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Phaser 4 / `@phaserjs/phaser` | npm package is at 0.2.2 (stale). Not production-ready. No stable release on npm despite RC announcements on website. | Phaser 3.90.0 (`phaser` package) |
| Socket.IO for game networking | Generic WebSocket lib. No room management, no state sync, no matchmaking. You'd spend months reimplementing what Colyseus gives you. 10x slower than uWebSockets.js. | Colyseus 0.17 |
| Howler.js for audio | Phaser 3 has a capable built-in Sound Manager with Web Audio API support, positional audio, and sprite sheets. Adding Howler.js duplicates functionality and adds a dependency. | Phaser's built-in audio system |
| Firebase Realtime DB for multiplayer | Not designed for game state sync. No rooms, no schema, no delta compression. High latency for real-time game updates. Vendor lock-in. | Colyseus (self-hosted) |
| PixiJS alongside Phaser | Phaser uses its own renderer (based on WebGL/Canvas). Mixing in PixiJS creates rendering conflicts and doubled memory usage. | Phaser's built-in rendering |
| Redux/Zustand for game state | Designed for UI state management, not game loops. Adds unnecessary abstraction over what should be direct state mutation in game ticks. | Plain TypeScript classes with Phaser's event system |
| Lance.gg | Appears abandoned/unmaintained. Last significant activity years ago. | Colyseus |

## Stack Patterns by Variant

**If building MVP (solo only, no multiplayer):**
- Skip Colyseus entirely. Keep game logic in Phaser scenes.
- Use idb-keyval for meta-progression persistence.
- Structure game logic as pure TypeScript classes (not coupled to Phaser) so it can later run on a Colyseus server.
- This is the current state of the project.

**If adding co-op multiplayer:**
- Add Colyseus server as a separate package in monorepo.
- Extract game logic (combat resolution, deck processing, enemy AI) into `shared/` module.
- Client becomes a "dumb renderer" -- receives state from server, renders it, sends player inputs.
- Server runs authoritative game loop at fixed tickrate (e.g., 20 ticks/sec for auto-combat).

**If scaling beyond 100 concurrent users:**
- Add Redis for Colyseus room persistence and horizontal scaling.
- Deploy Colyseus behind a load balancer with sticky sessions.
- Consider Colyseus Cloud (managed hosting) to avoid DevOps overhead.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| phaser@3.90.0 | vite@8.x | May need `legacy.inconsistentCjsInterop: true` if CJS import issues arise. Test first. |
| phaser@3.90.0 | typescript@5.7 | Works. Phaser ships its own type definitions. |
| colyseus@0.17 | @colyseus/schema@0.17 | Must match major version. 0.17 server requires 0.17 schema. |
| colyseus@0.17 | colyseus.js@0.16 | Client 0.16.x is compatible with server 0.17.x per Colyseus docs. Check release notes for breaking changes. |
| colyseus@0.17 | node@22 | Requires Node 18+. Use 22 LTS for long-term support. |
| vite@8 | typescript@5.7 | Vite 8 supports TS 5.x natively. |

## Sources

- [Phaser 3.90.0 Release](https://phaser.io/download/stable) -- Confirmed latest stable Phaser 3 version. HIGH confidence.
- [Phaser Mega Update (May 2025)](https://phaser.io/news/2025/05/phaser-mega-update) -- Confirmed v3.90.0 is last v3, all future dev on v4. HIGH confidence.
- [@phaserjs/phaser on npm](https://www.npmjs.com/package/@phaserjs/phaser) -- Confirmed Phaser 4 npm package at 0.2.2, 4 years stale. HIGH confidence.
- [Colyseus Official Docs](https://docs.colyseus.io/) -- Schema-based state sync, room architecture, TypeScript support. HIGH confidence.
- [Colyseus 0.17 Release](https://colyseus.io/blog/colyseus-017-is-here/) -- defineServer() API, auto-reconnection, full-stack TS safety. HIGH confidence.
- [Colyseus Phaser Tutorial](https://docs.colyseus.io/tutorial/phaser) -- Official integration guide with player movement, interpolation, fixed tickrate. HIGH confidence.
- [Colyseus vs Socket.IO npm trends](https://npmtrends.com/colyseus-vs-socket.io) -- Download and star comparison. MEDIUM confidence (popularity != quality).
- [Vite 8 Rolldown Migration](https://vite.dev/guide/migration) -- Breaking changes, migration path from v5+. HIGH confidence.
- [Vite 8 on npm](https://www.npmjs.com/package/vite) -- Confirmed 8.0.2 latest. HIGH confidence.
- [idb-keyval on npm](https://www.npmjs.com/package/idb-keyval) -- 295 bytes, promise-based IndexedDB wrapper. HIGH confidence.
- [Phaser Audio Docs](https://docs.phaser.io/phaser/concepts/audio) -- Built-in Sound Manager with Web Audio API. HIGH confidence.

---
*Stack research for: Autoscroller (Loop Hero + Card Auto-Battler)*
*Researched: 2026-03-25*
