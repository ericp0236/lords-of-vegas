# Recommended Architecture

## Frontend
Use Next.js with TypeScript.

Recommended routes:
- `/` — landing page / create or join game
- `/game/[roomCode]` — player game view
- `/director/[roomCode]` — YouTube-friendly Director view
- `/admin/[roomCode]` — optional host/admin override panel

## Main Modules
- `game-engine/`
  - Pure TypeScript rules engine.
  - No React code.
  - No Supabase calls.
  - All actions go through validated commands.

- `board-data/`
  - Static board layout.
  - Lot IDs, prices, printed die values, street/block info, adjacency, Strip adjacency.

- `cards/`
  - Casino card decks.
  - Strip cards.
  - Game Over card insertion logic.

- `supabase/`
  - Database client.
  - Realtime subscriptions.
  - Save/load game state.

- `ui/`
  - Player board.
  - Action controls.
  - Trade proposal/approval UI.
  - Director layout.
  - Game log.

- `tests/`
  - Rules tests.
  - Board adjacency tests.
  - Turn sequence tests.
  - Trade approval/execution tests.
  - End-game scoring tests.

## Supabase Tables
Suggested minimum schema:

### games
- id
- room_code
- status: lobby | active | completed
- host_player_id
- active_player_id
- current_turn_number
- game_state_json
- version_number
- created_at
- updated_at

### players
- id
- game_id
- display_name
- color
- reconnect_name_key
- joined_at
- last_seen_at

### trade_proposals
- id
- game_id
- created_by_player_id
- status: pending | accepted | rejected | cancelled | executed
- proposed_steps_json
- required_approvals_json
- approvals_json
- created_at
- updated_at

### game_events
- id
- game_id
- turn_number
- event_type
- message
- event_data_json
- created_at

## Realtime Strategy
- Subscribe to game state changes by room code.
- Every write should include a version number.
- Reject writes if the client is writing against an old version.
- Re-fetch latest state before applying any action.
- The game engine should return the new full game state plus log events.

## Important Rule
Never let the UI directly mutate game state. All state changes must go through the rules engine.
