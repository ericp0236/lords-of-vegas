# Product Requirements Document: Lords of Vegas — Remote Multiplayer Web App

**Status:** Draft v1
**Owner:** [Your name]
**Last updated:** July 4, 2026

---

## 1. Summary

A web application that lets 2–6 remote players play the full *Lords of Vegas* board game together in real time, plus a dedicated **Director view** that renders the complete, unfiltered game state for screen-recording and later YouTube editing.

The project has two audiences at once: the **players**, who need a fast, accurate, low-friction way to play the actual rules of the game, and **the streamer/editor** (the user), who needs a clean, full-information view they can capture and cut into videos without manual screen-recording juggling or post-hoc editing to hide/reveal information.

## 2. Background & Motivation

- The user wants to play *Lords of Vegas* with a remote group and record sessions for a YouTube channel.
- No existing digital implementation supports this specific need (remote play + separate recording feed).
- A key discovery during scoping: **Lords of Vegas has no hidden information** — money, dice, cards, and holdings are all public per the official rules. This simplifies the product significantly: there is no need to build per-player filtered views. Every player already sees everything; the Director view is functionally the same data, just presented without action controls, for a clean recording surface.

## 3. Goals

1. Faithfully implement the *Lords of Vegas* base game (2–6 players) rules, including all six player actions, scoring, tie-breaking, and win conditions.
2. Support fully remote play — each player on their own device/location.
3. Provide a Director/spectator mode suitable for screen recording and later video editing.
4. Keep hosting/infra trivial — no dedicated backend server to deploy or maintain.

### Non-goals (out of scope for v1)
- Expansions (*Underworld*, *Americana*, *Con Jobs*, etc.) — base game only.
- AI/bot players.
- Automated video recording, editing, or export from within the app.
- Account systems, persistent user profiles, or matchmaking.
- Mobile-native apps (web-responsive only).
- Real-time sub-second sync (turn-based polling is an accepted tradeoff — see §7).

## 4. Users & Use Cases

| User | Need |
|---|---|
| Player | Join a game from any device/browser, see the board and their standing clearly, take legal actions without needing to know the rulebook by heart. |
| Host/Streamer (also a player) | Start a table, share a join code, play normally, and separately open a Director view on a recording machine. |
| Video Editor (same person, later) | Scrub through a fully legible board/game history to cut highlight clips without needing to reconstruct what happened from player-facing recordings. |

### Primary use case flow
1. Host creates a table, gets a room code.
2. Host shares the code with up to 5 other remote players; each opens the link and joins with a name/color.
3. Host opens a **second**, separate browser tab/window in Director mode (on the recording machine) and starts screen-recording that tab.
4. Players play a full game turn-by-turn from their own devices.
5. Host later edits the recorded Director-view footage into a YouTube video.

## 5. Functional Requirements

### 5.1 Lobby & Session Management
- Create a table (generates a short room code).
- Join a table by code, choosing a display name and one of 6 player colors (no duplicate colors).
- Join a table in **Director mode** (no player slot, read-only).
- Host starts the game once 2–6 players have joined.

### 5.2 Core Game Engine
Must implement, per the official rulebook:
- **Setup:** shuffle deck, insert Game Over card ~¾ through, deal 2 property cards/player, place starting parking lots, compute starting money (`$20m − sum of the 2 lots' die values`), determine turn order (2d6, reroll ties).
- **Turn sequence (6 steps):** draw card → claim/refresh lot or die → pay parking lots → pay casinos → score casinos (respecting scoring-track "breaks") → discard card → take any number of actions.
- **Actions:** Build, Sprawl, Remodel, Reorganize, Raise, Gamble — each with correct costs, legality checks, and board effects.
- **Casino mechanics:** contiguous same-color-same-height grouping, auto-merge on adjacency, boss = highest die, automatic reroll cascade on boss ties.
- **Trading:** free-form, multi-party, any combination of money / parking lots / dice-in-casinos, plus the active player's own in-turn actions, executed atomically in a user-defined sequence.
- **End game:** Game Over card drawn, or a player reaches the top of the scoring track (90). Final parking-lot payout, then Strip-adjacent casino payout/scoring, then winner determined (points, money as tiebreaker).
- **Resource-exhaustion edge cases:** running out of a color's 9 tiles, a player's 12 dice, or a player's 10 lot markers (see §9 open items).

### 5.3 Board Representation
- Accurate reproduction of the 6-block (A–F), 48-lot board: per-lot price, printed die value, and Strip adjacency.
- Visual rendering of parking lots (owner marker), built casinos (color, height/risers, dice with owner color and boss highlighting), and the scoring track with player position markers.

### 5.4 Multiplayer Sync
- All players and the Director see a consistent shared game state without a dedicated backend server.
- State updates propagate to all connected clients within a few seconds.

### 5.5 Director / Spectator View
- Displays the identical full game state (board, all players' money/dice/lots/score, log) with no hidden information — consistent with the game's actual rules.
- No action controls, trade builder, or turn-affecting buttons.
- Clean, recording-friendly layout (legible at streaming resolutions).

### 5.6 Trading UI
- Any player can propose a trade at any time (not gated to their own turn), involving any subset of players.
- Trade steps: money transfer, parking lot transfer, die transfer (swap ownership of a die placed in a casino), and — only for the currently active player — one of their own legal actions bundled into the same sequence.
- Trades apply atomically in the order specified.

### 5.7 Game Log
- Chronological, human-readable log of draws, payouts, scoring, actions, trades, and reroll events, visible to all players and the Director — useful both for rules transparency and as an on-screen recap for recording.

## 6. Non-Functional Requirements

- **Accuracy:** game logic must match the official rulebook exactly (pricing, adjacency, scoring breaks, tie resolution, trade restrictions).
- **Clarity:** board state (whose die, whose lot, current prices, casino height) must be legible at a glance, both for players making decisions and for recorded footage.
- **Resilience:** a player's page refresh/reconnect should not corrupt shared game state (best-effort within the constraints of the storage model — see §7).
- **No install/setup for players:** joining is just opening a link.

## 7. Technical Approach & Constraints

- **Delivery mechanism:** single-page web app (Claude artifact), no dedicated backend to deploy or maintain.
- **State sync:** shared key-value persistent storage scoped to the artifact, with all clients polling on a short interval (~2s) and writing full-state updates. This is a deliberate tradeoff:
  - ✅ Zero infrastructure, works for a turn-based game where sub-second latency isn't required.
  - ⚠️ Last-write-wins; near-simultaneous writes from two clients (e.g., two trade proposals at once) can race. Mitigated by re-fetching latest state immediately before every write, but not fully eliminated.
  - ⚠️ No player accounts — identity is held in browser memory for the session only; a hard refresh currently requires rejoining (see open items).
- **No hidden state to manage:** since the real game has no secret information, there's no need for per-player filtered state, which removes an entire category of complexity (and risk of accidental leaks) other digital board game adaptations need to solve.

## 8. Success Criteria

- A full 2–6 player game can be played start-to-finish remotely without a rules dispute caused by the software (i.e., the engine enforces/administers the rules correctly).
- The Director view, once recorded, contains everything needed to edit a watchable video without additional screen capture from player devices.
- Hosting a game requires no setup beyond sharing a link/code.

## 9. Open Items / Risks

| Item | Status |
|---|---|
| Exact per-lot die pip values (1–6) for all 48 board spaces | **Pending** — user is transcribing from the physical board; engine currently uses placeholder values. |
| Card-to-color distribution assumption (48 lots vs. rulebook's stated "45 + 4" card count) | Documented assumption in code; may need revisiting once full deck contents are confirmed against a physical copy. |
| Dice/lot-marker exhaustion rules (forced reuse when a player's 12 dice or 10 markers are all in play) | Not yet implemented — v1 blocks the action instead of forcing a swap. |
| Reconnect/refresh handling | Not yet implemented — player identity is in-memory only for this session. |
| State-write race conditions during rapid simultaneous actions | Partially mitigated (refetch-before-write); not fully solved without a real backend. |
| Playtesting for rules accuracy | Not yet done — needs a full run-through against the physical game. |

## 10. Milestones

1. ~~Core engine + board scaffold + basic UI (build/sprawl/remodel/reorganize/raise/gamble, trading, scoring, win conditions)~~ — **done (v1 draft)**
2. Plug in confirmed die values and finalize board data.
3. Close resource-exhaustion edge cases (dice/lot marker forced reuse).
4. Full playtest against physical game rules; fix discrepancies.
5. Polish Director view for recording (layout, legibility, optional "recap" overlays).
6. Live test with a full remote 4–6 player group.
