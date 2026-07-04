# Lords of Vegas Project Decisions

## Product Direction
Build this as a full production-quality web project that can be hosted publicly, not as a single Claude artifact or throwaway prototype.

## Recommended Stack
- Frontend: Next.js + React + TypeScript
- Styling: Tailwind CSS + shadcn/ui or similar component system
- Backend/database: Supabase
- Realtime sync: Supabase Realtime
- Auth model for v1: room code + player name, no full account system required
- Hosting: Vercel for frontend, Supabase for backend
- Deployment: GitHub + Vercel CI/CD

## Project Priorities
1. Rules accuracy first.
2. Production-quality architecture from the start.
3. Multiplayer stability and reconnect behavior.
4. Clean YouTube-friendly Director view.
5. Polish after the rules engine is reliable.

## Confirmed Product Choices
- 3–6 remote players in v1 (2-player variant deferred).
- Dedicated Director / Spectator view.
- Director view is a special recording-friendly layout, not just the normal board with controls removed.
- No hidden information. All players can see all money, cards, dice, lots, scores, and game log.
- Reconnect should work using room code + player name.
- Supabase should be used instead of local artifact storage.
- Accuracy is more important than speed of delivery.
- No host/admin manual state fixes in v1.

## Lobby & Session (confirmed July 4, 2026)
- Minimum **3 players** to start in v1 (skip 2-player F-block variant rules).
- Host must **approve each join request** before a player enters the lobby.
- Duplicate display names blocked in the same room.
- Turn order: roll 2d6 for first player; ties roll 1 extra die; then proceed clockwise by **join order** (host = seat 1).
- Only **one pending trade** at a time per game.
- Trades: explicit **Reject** button for affected players; proposer can cancel; proposer clicks Execute after all approvals.
- Trade action bundling included in v1.

## Resource Exhaustion Rules (confirmed)
- **Dice:** Each player has exactly 12 dice. If all 12 are on the board and a new die is needed (build/sprawl), remove one die from an existing tile and place it on the new tile. The vacated tile remains built but has no die and no owner.
- **Lot markers:** Each player has exactly 10 lot markers. If all 10 are on the board and a new lot is acquired, remove a marker from an existing lot (or trade to free one). The player no longer owns the vacated lot.

## Director View (confirmed)
- Show the **full game log**.
- Optional overlays: current turn, active player, recent payout, scoring update.
- Optimized for **16:9 / 1080p** YouTube recording.

## Visual Style (confirmed)
- Cleaner digital redesign (not a literal physical board clone).
- Casino colors match the physical game as closely as possible.
- Player colors fixed to physical game colors: black, blue, green, purple, red, yellow.

## Required Game Content
- Base game only for v1.
- No expansions in v1.
- Board data: `lords-of-vegas-updated-data/board-lots.*` (48 lots, confirmed die values).
- Card data: `lords-of-vegas-updated-data/casino-cards.*` (49 cards total).
  - Strip deck: A6, D5, F8, Game Over
  - F7 is Vega Alliance (not Strip).
- Reference assets: `Lords_of_Vegas_Stitched_Playmat.png`, `Lords-of-Vegas-6-Player-Base-Game-Rulebook-V1-For-Web.pdf`

## Infrastructure
- GitHub and Vercel accounts available.
- Supabase project: `hnmxkkvlwhofiqqppgdi` (`https://hnmxkkvlwhofiqqppgdi.supabase.co`)
- Project-level MCP config at `.cursor/mcp.json` scopes Supabase tools to this project.
