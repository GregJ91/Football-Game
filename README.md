# Pyramid FC

A fast mobile football management game, a mix of Championship Manager 01/02 and Football Chairman Pro 2. You found your own club at the bottom of the English or Scottish pyramid and take it to the top. You can install it to your phone's home screen as a PWA.

See [docs/GAME_PLAN.md](docs/GAME_PLAN.md) for the full design and roadmap.

## Status

Phases 1–2 of the plan (the foundation and the season core) are done:

- **Club creation:** name, colours, kit pattern and ground; start in England (level 7) or Scotland (level 5).
- **Pyramids:**
  - England: 9 divisions over 7 levels.
  - Scotland: 6 divisions over 5 levels.
  - Both have real-style promotion and relegation places, play-offs, and regional North/South splits.
- **Match engine:** minute-by-minute simulation with team strength in defence, midfield and attack, home advantage, cards, injuries, extra time and penalties.
- **Players:** CM-style attributes rolled up into an overall rating and a potential. Players develop, decline and retire, and a youth intake arrives each season.
- **Playable UI:** Hub, Squad (formation and mentality), League tables, Fixtures and a season-review screen.
- **Saving:** autosave to IndexedDB, with Continue on the start screen.

All club and player names are fictional and generated. Importing real squads is planned for phase 8.

## Commands

```bash
npm install
npm run dev        # dev server
npm test           # engine tests (Vitest)
npm run typecheck
npm run build      # production PWA build into dist/
npm run sim -- 10 eng 2026   # headless soak test: seasons, country (eng|sco), seed
```

## Layout

- `src/engine/`: the pure TypeScript game engine (no React).
  - `match/`: team selection and the match simulation.
  - `season/`: fixtures, tables, play-offs, promotion/relegation and season rollover.
  - `players/`: generation, ratings and development.
  - `world.ts`: new-game world generation.
  - `rng.ts`: the seeded, serialisable RNG used everywhere.
- `src/data/`: pyramid definitions and name pools.
- `src/state/`: the Zustand store and IndexedDB saves.
- `src/ui/`: screens and components.
- `tests/`: Vitest suites. `scripts/simulate.ts` is the multi-season soak test.
