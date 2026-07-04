# Open Questions For User

All previously open questions have been resolved. See `01-project-decisions.md` for confirmed answers.

## Resolved (July 4, 2026)

### Game Data
- [x] Board lot data: use `lords-of-vegas-updated-data/board-lots.*` (confirmed die values)
- [x] Casino card spaces: use `lords-of-vegas-updated-data/casino-cards.*`
- [x] Strip cards: A6, D5, F8, Game Over
- [x] F7 is Vega Alliance

### Rules
- [x] Dice exhaustion: remove die from existing tile when all 12 are placed; vacated tile loses owner
- [x] Lot marker exhaustion: remove marker from existing lot when all 10 are placed; player loses that lot

### Trade Flow
- [x] Every affected player must approve
- [x] Proposer can cancel pending trade
- [x] Proposer clicks Execute after all approvals

### Host/Admin Controls
- [x] No manual fixes in v1

### Director View
- [x] Full game log
- [x] Optional overlays (turn, active player, payout, scoring)
- [x] 16:9 / 1080p optimized

### Visual Style
- [x] Cleaner digital redesign
- [x] Casino colors match physical game
- [x] Fixed player colors (physical game colors)

## Infrastructure (resolved)
- Supabase project: `hnmxkkvlwhofiqqppgdi` (MCP connected, database empty)
- GitHub repo: create new `lords-of-vegas`
- Director overlays: ON by default

## Lobby rules (resolved July 4, 2026)
- [x] Minimum 3 players to start (no 2-player F-block rules in v1)
- [x] Host approves each join request
- [x] One pending trade at a time
- [x] Explicit Reject button on trades
- [x] Turn order: roll for first, then clockwise by join order
