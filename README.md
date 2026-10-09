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
- **Players, CM 01/02 style:**
  - **Attributes:** the CM set on a 1–20 scale (technical, mental, physical, and goalkeeping for keepers), shown in three colour-coded columns. They roll up into a rating for each position.
  - **Positions:** players can play several (e.g. DC/DMC, AMC/ST).
  - **Careers:** players develop, decline and retire, and a youth intake arrives each season.
- **Best XI and the position picker** use players who can play each position. Tapping a position lists them best to worst, with out-of-position players listed separately.
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
- **Transfers and contracts, Football Manager style:**
  - **Board budgets:** each season the board sets a transfer budget and a weekly wage budget. A slider moves money between them (£1 p/w of wages = £30 of transfer budget), and 75% of sale fees come back to spend.
  - **Windows:** a summer window (first 6 weeks) and a January window (4 weeks). Free agents can be signed at any time.
  - **Scouting:** players outside your league show a rating range until scouted, with 5 reports a week.
  - **Signing:** bid, and the club accepts, counters or rejects. Then agree personal terms (agree, offer 15% less, or walk away) and pick a contract length. Players weigh up your level, and good players expect good wages.
  - **Selling:** transfer-list players to attract bids. AI clubs also bid for your standout players, and you answer from the Hub inbox (accept, ask for more, or reject).
  - **Contracts:** renew them, or players leave when they run out. Releasing a player pays off half his remaining wages.
  - **AI market:** AI clubs buy, sell and release players each window and keep their wage bills affordable.
  - **Money:** weekly gate receipts, TV/sponsorship by level, and wages, for every club.
- **Chairman side (Club tab):**
  - **Stadium:** four stands built separately (extend, seat, roof) plus floodlights. Builds take weeks, and a stand being worked on holds half its fans.
  - **Ground grading:** minimum capacity, seats and floodlights for each level. Win promotion with a ground that fails and the next club goes up instead, with a warning mid-season.
  - **Tickets:** a price per season against the going rate. Crowds respond to price, fan mood and roofs, and seats earn more.
  - **Facilities:** training ground (faster development), youth academy (a bigger and better intake each summer) and medical centre (shorter injuries). Five levels each, with build costs and weekly upkeep.
  - **Board and fans:** confidence and mood meters, plus a season target. Results, prices, new stands and loans move them, and a confident board sets bigger budgets.
  - **Shirt sponsor:** pick one of three offers each summer (steady, cash up front, or promotion bonus).
  - **Bank loans:** repaid weekly over two seasons.
  - **Season money:** prize money for every club, parachute payments after relegation, and a season ledger.
- **Day by day, CM 01/02 style:** Continue moves on half a day (AM, then PM, then the next morning), with the date top right. Matches are on Saturdays; Continue on matchday morning takes you to the match. Play match and Sim match on the Hub skip straight to the next game.
- **Inbox** (top left, with an unread count), filtered by Transfers, Training, Medical, Scouting and Club. It includes Friday training reports, training knocks, match injuries, bids you can answer in place, and scout reports that arrive a few days after you send a scout, with a verdict on the player.
- **Cups:**
  - **England:**
    - **FA Cup**, with real round names and entry points:
      - Step 5 clubs start in the First Qualifying Round, and National League North/South clubs join in the Second.
      - National League clubs join in the Fourth Qualifying Round.
      - League One and League Two join in the First Round Proper.
      - Premier League and Championship clubs join in the Third Round.
    - **League Cup** (top four levels).
    - **FA Trophy** (levels 5–6).
    - **FA Vase** (level 7).
  - **Scotland:**
    - **Scottish Cup:** Lowland and Highland League clubs start in the First Round, Leagues One and Two join in the Second, the Championship in the Third, and the Premiership in the Fourth.
    - **Scottish League Cup.**
  - **How ties work:** midweek, single-match knockouts with extra time and penalties, and neutral semi-finals and finals where real. The next round is drawn as soon as one is played.
  - **Rewards:** prize money doubles each round, and fans get a boost for wins (more for giant-killings).
  - **Honours:** a trophy cabinet and club history under Club → Honours.
- **Europe:** the Champions League, Europa League and Conference League, in the current 36-club format.
  - **Qualifying:**
    - **England:** the Premier League top four go into the Champions League. 5th and the FA Cup winners go into the Europa League, and the League Cup winners into the Conference League play-off round. A cup winner who has already qualified passes the place down the league.
    - **Scotland:** the champions go straight in. The rest (2nd to 5th and the Scottish Cup winners) start in a two-legged play-off round, and losers drop into the next competition down.
  - **Format:** a league phase of 8 games (6 in the Conference League). The top 8 go to the round of 16, and 9th to 24th play a knockout play-off. Knockout ties are two legs on aggregate, with extra time and penalties in the second leg, and a single-match final at a neutral ground.
  - **Calendar:** Champions League nights are Wednesdays, the other two Thursdays. Domestic cup rounds move to another midweek day if they would clash.
  - **Foreign clubs:** about 120 fictional clubs from 35 nations, rated by strength. Their ratings move with the domestic game so Europe stays competitive. Your matches use the full engine against a generated squad with local names; other games use a quick model calibrated against the engine.
  - **Money:** entry, results and each knockout round pay prize money, and home gates sell at a premium. Winning adds the trophy to the cabinet.
- **Playable UI:** Hub (board and fan meters, things needing attention), Squad, Tactics, Transfers, Club, League (table and your fixtures, from the Hub), Pre-match, Live match and a season-review screen.
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
