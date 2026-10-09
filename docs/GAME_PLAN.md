# Pyramid FC — Game Design Plan

## Context
The goal is a new mobile football game that mixes **Championship Manager 01/02** (squad depth, scouting, tactics, match ticker) with **Football Chairman Pro 2** (quick seasons, club finances, stadium growth, one-tap decisions). You create your own club (name, colours, crest), start at the **bottom of the English or Scottish pyramid**, and climb through promotions to win leagues and play in Europe. Every decision must be **fast**: a full season should take about 20–30 minutes.

The repo (`gregj91/football-game`, branch `claude/beautiful-bell-r3hqlx`) is empty, so this is a greenfield build.

**Decisions made:**
- PWA (React + TypeScript), installable on phones; can be wrapped with Capacitor later.
- An editable database: the game ships with realistic fictional names, and an import feature lets a community file load real squads.
- England + Scotland pyramids in v1.
- Match day offers both modes: a quick text-commentary ticker, and an instant result.

---

## 1. Core game loop
```
New Game → Create Club → Pick Country → Start bottom tier
   ↓
Week loop (≈30–60s each):
  Inbox (1–3 decisions) → Squad/Tactics (optional) → Match → Result + Table
   ↓
Transfer windows (summer / January) → Season end:
  Promotion/relegation · Board review · Finances · Stadium upgrades · Retirements/youth intake
   ↓
Climb → Top flight → Europe (CL / EL / Conference) → Legacy/Hall of Fame
```
**Speed rules:** each screen has a big **"Continue"** button. Auto-pick the team, auto-fill tactics, and auto-renew contracts are on by default. You get at most 3 inbox items per week.

## 2. Club creation
- Name, short name (3 letters), primary/secondary colours, kit pattern (plain/stripes/hoops/halves/sash), a crest builder (shape + icon + colours), and a stadium name.
- Choose England (start in a regional step-5/6 league) or Scotland (start in the Lowland/Highland League).
- Your club **replaces** a club in the bottom division. It starts with a generated squad of semi-pro players, a 500-capacity ground and a small budget.
- Difficulty sets starting cash and board patience.

## 3. World structure
**England (v1):** Premier League → Championship → League One → League Two → National League → National League North/South → step-5 regional (simplified to 2 leagues).
**Scotland:** Premiership → Championship → League One → League Two → Highland/Lowland League.
- Cups: FA Cup, League Cup, FA Trophy/Vase (non-league), Scottish Cup and Scottish League Cup.
- Europe: Champions League, Europa League and Conference League with simplified qualification by league position. Foreign clubs are simulated from a strength-rated list (no full foreign leagues in v1).
- Promotion and relegation follow the real places, with play-offs where they exist.
- AI clubs in other divisions get a quick simulation so the whole pyramid stays alive.

## 4. Players & data
- **Attributes (simplified CM-style):** about 12 attributes in groups (Technical / Mental / Physical / GK), rolled up into an **Overall (1–100)** and a **Potential**. Positions: GK, DR/DL/DC, DMC, MR/ML/MC, AMC, ST.
- Each player also has age, wage, contract end, value, morale, fitness, form and personality (ambition, loyalty).
- **Development:** growth curve by age and potential, plus playing-time and training-facility modifiers. Players decline after about 31.
- **Database:** the game ships with JSON for every club and player using fictional realistic names. The **import/export** format (`.json`/`.csv`) lets users load community real-name files. An in-game editor lets you rename players and clubs.
- Youth intake comes each spring, and its quality scales with the youth academy level.

## 5. Chairman side (FC Pro 2 flavour)
- **Finances:** gate receipts (capacity × ticket price × attendance %), TV money by tier, prize money, sponsorship, merchandise, transfers. Costs are wages, upkeep and loan interest.
- **Stadium:** expand stands (capacity), seating, floodlights (required for higher tiers), corporate boxes. Builds take weeks.
- **Facilities:** training ground (development), youth academy (intake quality), medical (injury recovery), scouting network (reach).
- **Board/fans:** board confidence and fan happiness meters. Ticket price affects both. You can be sacked in hard mode.
- **Ground grading:** you can't be promoted into the Football League without minimum capacity and floodlights. This is a chairman decision that matters.

## 6. Manager side (CM 01/02 flavour)
- **Squad:** list with Overall, position, fitness, morale and form. Tap a player for a details card.
- **Tactics:** pick a formation (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2), mentality (Defensive/Balanced/Attacking), and tempo/pressing sliders. Auto-pick the best XI.
- **Transfers:** a scout search with filters (position, age, max fee, max wage). Players are hidden until scouted, showing star ranges. Make an offer → club response → wage negotiation (simple 3-option accept/counter). Loans and free agents too.
- **Contracts:** renewals with simple demands. Players can ask away when unhappy.
- **Staff:** assistant, coach, scout and physio, each with a single rating (keeps it light).

## 7. Match engine
- Both teams get a **team strength** for each zone (defence/midfield/attack) from player ratings × fitness × morale × tactic fit. Home advantage and form also count.
- A minute-by-minute **event simulation**: each tick rolls for possession → chance → shot → goal using the zone strengths. It also produces cards, injuries and subs.
- **Mode A, Instant:** run the sim and show the score and scorers.
- **Mode B, Ticker:** play the same events as CM-style text commentary with selectable speed. At half time you get a talk (praise/calm/rally) and up to 3 subs and a tactic change. The engine continues from the current state.
- The engine is deterministic for a given seed, so you can test it and replay matches.

## 8. Screens (mobile-first)
1. Home / Continue
2. Club creator
3. Hub (next fixture, inbox, table snippet, finances snapshot)
4. Squad
5. Tactics
6. Transfers / scouting
7. Match (pre-match, ticker, result)
8. League tables & fixtures
9. Finances
10. Stadium & facilities
11. Season review / promotion screen
12. Trophy cabinet / history
13. Settings / database import-export

Bottom tab bar: **Hub · Squad · Club · League · Transfers**.

## 9. Technical architecture
- **Stack:** Vite + React + TypeScript, Zustand for state, Tailwind for UI, `vite-plugin-pwa` for offline/install, Vitest for tests.
- **Persistence:** IndexedDB (via `idb`) for save slots; the world is serialised per season with autosave after each match.
- **Engine is pure TS** with no React (`src/engine/`), so it is testable and could move to a Web Worker for whole-pyramid simulation.
- **Planned layout:**
  - `src/engine/match/`: sim, commentary
  - `src/engine/season/`: fixtures, tables, promotion, cups, Europe
  - `src/engine/economy/`: finances, stadium, board
  - `src/engine/players/`: development, generation, transfers AI
  - `src/data/`: country pyramids, club seeds, name pools, import/export schema
  - `src/state/`: Zustand stores, save/load
  - `src/ui/screens/`, `src/ui/components/`
- Seeded RNG (`src/engine/rng.ts`) is used everywhere so results are reproducible.

## 10. Build phases
1. **Foundation:** scaffold the PWA, data models, seeded RNG, England pyramid data, name generator, save/load.
2. **Season core:** fixtures, instant match sim, league tables, promotion/relegation, season rollover.
3. **Club creation + Hub UI:** creator, hub, squad, tactics, league screens. At this point the game is playable end to end.
4. **Ticker match mode:** commentary, half-time talks, subs.
5. **Transfers & contracts:** scouting, offers, AI transfer market, youth intake, development.
6. **Chairman layer:** finances, stadium, facilities, ground grading, board/fans.
7. **Cups + Scotland + Europe.**
8. **Database editor + import/export, polish, PWA install, balancing.**

Alongside the code, I'll create a **Design artifact** (the Design template you chose) with mobile mockups of the key screens: club creator, hub, match ticker, transfers and stadium. That gives you something visual to react to before the UI build in phase 3.

## Verification
- Vitest unit tests for the engine:
  - Fixture generation (every team plays everyone home and away).
  - Table sorting (points, then goal difference, then goals scored).
  - Promotion/relegation counts.
  - Match-sim score distributions (average goals about 2.6 per game; stronger teams win about 60–70%).
  - Finances balance.
- A headless "simulate 10 seasons" script checks for no crashes, a sensible climb rate and a stable economy.
- `npm run dev` in Playwright (Chromium is preinstalled): screenshot each screen at phone size (390×844) and play a season.
- Lighthouse PWA check for installability and offline use.
