# Lords of Vegas Online

A production web app for playing the **Lords of Vegas** base board game with 3–6 remote players, plus a YouTube-friendly **Director view** for recording games.

## Features

- **Full base-game rules**: build, sprawl, remodel, reorganize, raise, gamble; casino merging; boss-tie reroll cascades; scoring-track breaks; dice (12) and lot-marker (10) exhaustion; Game Over strip payout.
- **Lobby with host approval**: 4-letter room codes, host approves every join request, duplicate names/colors blocked, first player rolled with 2d6 (ties break with an extra die).
- **Trading**: money, lots, dice, and bundled active-player actions. Every affected player must approve; the proposer executes; steps run in order and a failed step stops the rest (per the rulebook).
- **Director view** (`/director/CODE`): read-only 16:9 layout with the full game log, standings, and optional overlays (turn banner, payout and scoring toasts) — on by default, toggleable on hover.
- **Reconnect**: room code + player name (or automatically via browser storage).

## Stack

- [Next.js](https://nextjs.org) + React + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) PostgreSQL + Realtime for state sync
- Vercel for hosting

## Architecture

- `src/engine/` — pure TypeScript game engine. No React, no Supabase. Every state change goes through `applyCommand(state, actorId, command)`, which validates and returns a new state plus log events.
- `src/data/` — board lots, property cards, score track, player colors. Source of truth: `lords-of-vegas-updated-data/`.
- `src/lib/` — Supabase client, optimistic-locking sync (`apply_game_update` CAS RPC on a `version` column), realtime subscription hook, identity storage.
- `src/components/`, `src/app/` — UI. The UI never mutates game state directly.
- `tests/` — Vitest suite covering setup, casino grouping/bosses, all six actions, draw resolution, payouts/scoring breaks, trades, exhaustion, and game end.

## Development

```bash
npm install
npm run dev    # local dev server
npm test       # engine test suite
npm run lint
npm run build
```

Environment (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Database

Two tables plus one RPC (see the applied migration `create_games_schema`):

- `games` — room code, `state` jsonb, `version` for optimistic locking
- `game_events` — append-only full game log (powers the Director view)
- `apply_game_update(...)` — atomic compare-and-swap state write + event insert

## Reference material

- `docs/` — project decisions, architecture notes, PRD, and the original prototype
- `lords-of-vegas-updated-data/` — confirmed board lot and card data (source of truth)
- Rulebook PDF and stitched playmat image in the repository root
