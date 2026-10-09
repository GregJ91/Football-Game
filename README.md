# Pyramid FC

A fast mobile football management game, a mix of Championship Manager 01/02 and Football Chairman Pro 2. You found your own club at the bottom of the English or Scottish pyramid and take it to the top. You can install it to your phone's home screen as a PWA.

See [docs/GAME_PLAN.md](docs/GAME_PLAN.md) for the full design and roadmap.

## Status

Phases 1–2 of the plan (the foundation and the season core) are done, plus the live match day from phase 4:

- **Club creation:** name, colours, kit pattern and ground; start in England (level 7) or Scotland (level 5).
- **Pyramids:**
  - England: 9 divisions over 7 levels.
  - Scotland: 6 divisions over 5 levels.
  - Both have real-style promotion and relegation places, play-offs, and regional North/South splits.
- **Match engine:** minute-by-minute simulation with team strength in defence, midfield and attack, home advantage, cards, injuries, extra time and penalties.
- **Players:** CM-style attributes rolled up into an overall rating and a potential. Players develop, decline and retire, and a youth intake arrives each season.
- **Tactics that matter:** formation, mentality and pressing are each compared against the opponent's setup:
  - a midfield three outnumbers a two;
  - two strikers pin a back two, while a lone striker gets crowded out by a back three;
  - wingers get in behind wing-backs;
  - a high press tires players and risks quick forwards;
  - a low block can counter an attacking side.

  Each area of the team is capped at ±15%, so strength still comes first. A good set-up is worth roughly +10 points of win rate.
- **Assistant manager:** before each match it shows a scout report on the opponent's shape, team ratings and expected goals, explains what each choice does, and offers a one-tap "use my pick". It can optionally set your tactics for simmed matches.
- **Two ways to play a match:**
  - **Play match:** live CM-style text commentary at Normal or Fast speed. You can pause, change tactics, make substitutions (players tire as the game goes on) and give a half-time team talk, or skip to full time.
  - **Sim match:** an instant result that pops up.
- **Pick your starting XI:** the Tactics tab shows your formation on a pitch. Tap a position to choose who plays there; each player's rating is shown for that position, colour-coded by how well it suits them. Your picks stay between matches and carry over when you change formation. If a pick is injured or suspended, the best available player covers and the pre-match screen tells you.
- **Playable UI:** Hub, Squad, Tactics, League tables, Fixtures, Pre-match, Live match and a season-review screen.
- **Saving:** autosave to IndexedDB, with Continue on the start screen.

All club and player names are fictional and generated. Importing real squads is planned for phase 8.

## Commands

```bash
npm install
npm run dev        # dev server
npm test           # engine tests (Vitest)
npm run typecheck
npm run build      # production PWA build into dist/
npm run sim -- 10 eng 2026 [assist]   # headless soak test: seasons, country (eng|sco), seed, optional assistant tactics
```

## Layout

- `src/engine/`: the pure TypeScript game engine (no React).
  - `match/`: team selection, the steppable match engine, tactical match-ups, pre-match preview and commentary.
  - `season/`: fixtures, tables, play-offs, promotion/relegation and season rollover.
  - `players/`: generation, ratings and development.
  - `world.ts`: new-game world generation.
  - `rng.ts`: the seeded, serialisable RNG used everywhere.
- `src/data/`: pyramid definitions and name pools.
- `src/state/`: the Zustand store and IndexedDB saves.
- `src/ui/`: screens and components.
- `tests/`: Vitest suites. `scripts/simulate.ts` is the multi-season soak test.
