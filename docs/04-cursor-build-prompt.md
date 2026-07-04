# Cursor Build Prompt

You are taking ownership of this project and building a production-quality remote multiplayer Lords of Vegas web app.

Read every attached file before writing code.

The goal is not a prototype. The goal is a real hosted web app for 2–6 remote players, with a separate YouTube-friendly Director view for recording the full public game state.

## Stack
Use:
- Next.js
- React
- TypeScript
- Supabase PostgreSQL
- Supabase Realtime
- Tailwind CSS
- Vercel deployment

## Highest Priority
Rules accuracy comes first. Do not fake or approximate rules. If a rule is unclear, stop and document the question before implementing that part.

## Architecture Rules
- Build a pure TypeScript game engine separate from React.
- The UI must never directly mutate game state.
- All moves must be represented as validated commands.
- All commands must run through the game engine.
- Store game state in Supabase with versioning to prevent stale writes.
- Add tests for every rule-heavy function.

## Required Features
- Lobby with room code.
- Join by room code + player name.
- 2–6 players.
- No duplicate player colors.
- Host starts game.
- Supabase-backed reconnect using room code + player name.
- Full base-game setup.
- Full turn sequence.
- Build, Sprawl, Remodel, Reorganize, Raise, Gamble.
- Casino merge logic.
- Boss tie reroll cascade.
- Parking lot payouts.
- Casino payouts.
- Scoring with scoring-track breaks.
- Game Over card and final scoring.
- Trade proposals with approval/acceptance.
- Game log visible to players and Director.
- Director route with large board, player standings, recent log, and no controls.
- Admin/host override tools may exist, but normal gameplay should not depend on them.

## Data Still Needed From User
- Exact casino card spaces for all 5 casino decks.
- Exact Strip card details.
- Confirmation of extracted board lot values.
- Official handling of dice/lot-marker exhaustion.

## Do Not Do
- Do not build AI/bot players.
- Do not add expansions.
- Do not use local-only browser storage as the main multiplayer state.
- Do not make hidden-information views; this game state is public.
- Do not prioritize animation or visual polish before rule correctness.
