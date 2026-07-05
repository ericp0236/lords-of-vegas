# Lords of Vegas — Complete Visual Audit

**Status:** Read-only audit. No code changes made.

Audit date: July 4, 2026

I've read the full frontend surface area: all components, `globals.css`, sound system, data/color definitions, and asset references. Reference playmat/PDF assets are documented in project rules but **not present in the repo**. The only files under `public/` are default Next.js SVGs (`vercel.svg`, `file.svg`, `window.svg`) — none are used in gameplay UI.

**Higgsfield:** Not available as an MCP tool in this workspace. Rive MCP is available for vector/interactive animation. All prompts below are written for ChatGPT Image Generation, Midjourney, or Higgsfield.

---

## 1. Architecture & Rendering Summary

| Layer | What exists |
|--------|-------------|
| **Stack** | Next.js 16, React 19, Tailwind 4, Motion (Framer) |
| **Game logic** | Pure TS engine — UI never mutates state directly |
| **Board** | CSS grid + procedural gradients (`Board.tsx`) |
| **Dice** | Procedural SVG (`DieFace.tsx`) with roll animation |
| **Cards** | Text chips only — no card art |
| **Casinos** | Flat `linear-gradient` from hex colors in `casinoCards.ts` |
| **Players** | Flat color circles + text |
| **Sound** | 100% procedural Web Audio (`SoundManager.ts`) — zero audio files |
| **Animation** | Motion springs, CSS keyframes (`eligiblePulse`, `neonFlicker`, `floatUp`) |
| **Particles** | CSS rectangle confetti only |
| **Fonts** | Geist Sans, Geist Mono, Limelight (Google) |
| **3D / Rive / Images** | None in production UI |

**Component hierarchy (gameplay):**

```
GameRoom → GamePlay
  ├── Header (marquee title, room code, SoundToggle)
  ├── PlayerChips (money, score, dice/marker counts)
  ├── Board column
  │   ├── Board (felt + lots + Strip + streets)
  │   └── ActionDock (turn chip, 6 text actions, draw card)
  └── Desktop rail: TradeCenter, ScoreTrackPanel, DiscardPiles, TileSupply, LogPanel
  └── Overlays: TurnBanner, GambleResultOverlay, Modals, Sheets, error toast
DirectorView: similar board + rails + EventToasts + WinnerOverlay + Confetti
```

**Layout assessment (gameplay-first):** The current structure already follows the layout constraints well — board is central and largest; player resources sit directly above the board; actions sit directly below. The right rail keeps reference info (log, score, supply) out of the turn loop. The main gap is **visual density**, not layout: large dark margins and flat panels read as "dashboard," not "table."

The reference screenshot shows glossy action buttons with icons; **current code uses text-only buttons** in `ActionDock`. That screenshot represents either a design target or uncommitted work — worth aligning before Phase 1 implementation.

---

## 2. Current Graphical Assets — Complete Inventory

### A. External / Font Assets

| Asset | Source | Used For |
|-------|--------|----------|
| Geist Sans | Google Fonts | Body UI |
| Geist Mono | Google Fonts | Money, codes, log turns |
| Limelight | Google Fonts | `.marquee` titles |

### B. Static Files (unused in game)

| File | Quality |
|------|---------|
| `public/vercel.svg` | Stock Next.js |
| `public/file.svg` | Stock Next.js |
| `public/window.svg` | Stock Next.js |

### C. Inline SVG (procedural, in components)

| Asset | Location | Quality |
|-------|----------|---------|
| Die faces (1–6) | `DieFace.tsx` | Functional — gradient fill, gloss rect, pip circles. Reads as "nice SVG," not physical dice |
| Mini die icon | `MiniIcons.tsx` | Minimal 10×10 outline |
| Mini lot marker icon | `MiniIcons.tsx` | Minimal house-outline |
| Speaker mute/unmute | `SoundToggle.tsx` | Generic UI icon |

### D. CSS-Only "Assets" (no image files)

| Asset | Location | Quality |
|-------|----------|---------|
| Page background | `globals.css` body | Subtle radial neon washes — good start, no texture |
| Casino felt | `.felt` class | Repeating diagonal lines + gradient — reads flat at board scale |
| Gold rail | `.gold-rail` | Border + glow — no metallic texture |
| Gold buttons | `.btn-gold` | Gradient + inset shadow — decent CTA, not chip-like |
| Strip neon line | `Board.tsx` | Dashed gradient line + vertical text |
| Neon flicker | `.neon-flicker` | Opacity keyframes on text |
| Eligible lot pulse | `.eligible-pulse` | Gold box-shadow pulse |
| Money floater | `.float-up` | Text chip animation |
| Confetti pieces | `Confetti.tsx` | Flat colored rectangles |
| Player color swatches | `playerColors.ts` hex | Flat Tailwind-adjacent colors |
| Casino color swatches | `casinoCards.ts` hex | Flat gradients on lots |
| Panel/surface chrome | Tailwind borders | Generic dark SaaS panels |
| Modal/sheet chrome | `Modal.tsx`, `Sheet.tsx` | Standard blur + border |
| Score track cells | `ScoreTrackPanel.tsx` | Flat grid + color-mix tiers |
| Drawn card chip | `DrawnCardChip` | Colored pill with lot ID text |
| Discard/supply pills | `DiscardPiles.tsx` | Colored labels + counts |
| Turn banner | `TurnBanner` | Gradient wash + marquee text |
| Error toast | Red bordered pill | Functional |

### E. Procedural Audio (not graphical, but part of "feel")

23 named sounds synthesized in `SoundManager.ts`. No music track implemented (`music` category reserved).

---

## 3. Assets That SHOULD Exist

Grouped by priority for premium board-game feel:

**Tier 1 — Board & Game Pieces (highest visual impact)**  
Board felt texture, gold frame, empty lot tiles, street bands, Strip centerpiece, 5 casino tile skins (+ riser layers), 6 player dice sets + house dice, 6 lot markers, property card faces (49) + card back, deck stack visual

**Tier 2 — Player & Economy**  
Player chip/avatar (6 colors), money chip icon, score track board art, score pawns (6), supply tray graphics

**Tier 3 — UI Chrome**  
Logo/wordmark, action icons (6), button skins, panel felt/leather backgrounds, modal frames, favicon/app icon

**Tier 4 — Atmosphere**  
Vegas skyline backdrop, neon bloom overlays, ambient particles, victory effects, loading screen

**Tier 5 — Director-specific**  
Broadcast lower-thirds, payout/scoring toast frames, winner title card

---

## 4. Per-Asset Assessment

Legend: **Effort** — S (<4h eng), M (1–2 days), L (3–5 days), XL (art pipeline + integration)  
**AI?** — Should custom AI art be created  
**SVG?** — Can SVG suffice at target resolution  
**3D?** — Would 3D materially improve feel

---

### BOARD & ENVIRONMENT

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Board felt base** | CSS gradient + 2px stripe pattern | Seamless 2048×2048 dark green casino felt, subtle weave, vignette | M | Yes | No — use PNG/WebP tile | No |
| **Gold table rail** | 1px border + glow | Brushed gold corner frame overlay, beveled inner edge | M | Yes | Partial (corners SVG, edge PNG) | No |
| **Empty lot tile** | Flat gray gradient rect | Asphalt/concrete lot pad with faint grid, price engraved | M | Yes | No — texture at ~80×100px | No |
| **Built casino tile (×5 brands)** | Flat brand gradient | Each brand: unique facade texture, sign typography, lit windows | XL | Yes | No | Optional subtle normal map |
| **Riser/stack layers** | CSS offset shadows | Visible hotel floors stacking — separate layer sprite per level | L | Yes | Layer sprites | Yes — parallax stack |
| **Street bands (×3)** | 8px text on dark gap | Asphalt strip with painted lane lines + embossed street name | M | Yes | Partial | No |
| **The Strip column** | Gradient + dashed neon | Vertical neon "STRIP" sign, palm silhouettes, marquee bulbs | L | Yes | Partial (sign SVG + glow PNG) | No |
| **Page/scene backdrop** | Radial color washes | Soft-focus Vegas night skyline, bokeh neon (behind board, low opacity) | M | Yes | No | No |
| **Eligible lot highlight** | Gold pulse box-shadow | Animated neon lot outline + corner brackets | S | No | Yes (animated SVG) | No |
| **Illegal action feedback** | Error text toast | Red flash on lot + shake + "denied" stamp overlay | S | Yes (stamp) | Yes | No |

#### AI Prompts — Board & Environment

**Board felt texture:**  
Create a seamless tileable dark emerald casino felt texture, fine wool weave visible at close range, subtle wear and light dust, soft center highlight, darker vignette at edges, top-down orthographic view, no objects, 2048×2048, premium digital board game style, photorealistic but clean.

**Empty lot tile:**  
Top-down empty Las Vegas property lot tile for a board game, dark asphalt pad with faint parking lines, small engraved lot ID area, brushed gold corner pins, subtle shadow depth, 256×256, transparent edges for grid tiling, modern luxury casino aesthetic.

**Albion casino tile (repeat for Sphinx, Vega, Tivoli, Pioneer with brand colors):**  
Top-down board game casino building tile, Albion brand purple and gold art deco facade, glowing sign, miniature rooftop details, slight isometric depth, fits square grid cell, 512×512, premium tabletop game illustration, clean readable at small size.

**The Strip centerpiece:**  
Vertical Las Vegas Strip centerpiece panel for board game, neon STRIP sign with warm gold and pink glow, subtle palm tree silhouettes, art deco border, dark night sky gradient, 256×1024, premium board game illustration, symmetrical.

**Street band (Sahara Ave):**  
Horizontal asphalt road strip texture for board game divider, two lane dashed yellow center line, embossed SAHARA AVE text, night wet reflection subtle, 1024×128 seamless horizontal tile.

---

### DICE

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Player dice (×6 colors)** | Procedural SVG gradient cube | Enamel dice matching physical game colors, rounded corners, deep pips | L | Yes | Fallback only | **Yes** — roll physics |
| **House dice (gamble)** | Ivory SVG palette | Cream/casino house dice, red pips or engraved dots | M | Yes | Fallback | **Yes** for gamble moment |
| **Die roll VFX** | Face shuffle + wobble | Tumble arc, motion blur, landing dust spark | M | No | Particle SVG | 3D helps |
| **Die placement** | Spring drop onto lot | Chip-clack landing, bounce settle | S | No | — | Optional |

#### AI Prompts — Dice

**Blue player die (repeat per color: black, green, purple, red, yellow):**  
Single polished 3D casino die, blue enamel body, white pips, slightly rounded edges, soft studio lighting, subtle reflection, front-three-quarter angle, transparent background, 1024×1024, premium board game piece.

**House gamble die:**  
Ivory casino house die with deep black pips, vintage Las Vegas style, gold foil edge inlay, dramatic lighting, transparent background, 1024×1024, hyper-detailed game piece render.

---

### LOT MARKERS & PARKING

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Lot marker (×6 colors)** | 14×20px colored rounded rect | Mini parking-lot sign / flag marker matching physical game | M | Yes | Small sizes OK | No |
| **Printed die value badge** | Text in circle on empty lot | Embossed circular lot price marker on pavement | S | Yes | Yes | No |
| **Parking ownership indicator** | Corner color chip | Marker planted in corner with shadow | S | — | Sprite | No |

#### AI Prompt — Lot Markers

**Green lot marker:**  
Top-down miniature parking lot ownership marker for board game, green enamel flag on gold post, cast shadow, Las Vegas luxury style, 256×256 transparent background, readable at 24px.

---

### CARDS & DECK

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Property card face (×48)** | None — text chip | Illustrated card: lot ID, paying casino logo, art deco frame | XL | Yes | Template + text overlay | No |
| **Game Over card** | None | Dramatic skull/neon "Game Over" strip card | M | Yes | No | No |
| **Card back** | None | Lords of Vegas logo, gold filigree, felt pattern | M | Yes | No | No |
| **Deck stack** | "Deck 49" text pill | Fanned/stacked card pile with back visible | M | Yes | No | Optional 3D fan |
| **Discard piles (×6 decks)** | Colored count pills | Mini discard tray per casino color with stacked card edges | L | Yes | Partial | No |
| **Draw animation** | rotateY on chip | Card slides from deck, flip reveal | M | No | CSS + sprites | No |

#### AI Prompts — Cards

**Property card template:**  
Vertical property card template for Lords of Vegas board game, art deco gold border, dark felt interior, top banner for casino logo placeholder, center window for lot code, bottom strip for payout text, 750×1050, print-ready board game card, elegant Las Vegas 1940s luxury style, leave clean areas for dynamic text overlay.

**Card back:**  
Playing card back design, Lords of Vegas wordmark center, symmetrical gold filigree, dark green felt texture, subtle neon edge glow, 750×1050, premium board game.

**Game Over card:**  
Dramatic Game Over card for Las Vegas board game, neon sign typography, dark sky, gold and red accents, art deco frame, 750×1050, no readable fine print, cinematic.

---

### CASINO SUPPLY & TILES LEFT

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Tile supply tray** | Text pills | Physical tile stacks per brand in a tray | M | Yes | Sprites | No |
| **Brand icons (×5)** | Text names only | Logo mark per casino for compact UI | M | Yes | **Yes** | No |

#### AI Prompt — Casino Brand Icon

**Sphinx casino logo mark:**  
Minimal casino brand emblem for Sphinx, gold and black, Egyptian art deco fusion, vector-friendly, transparent background, 512×512, readable at 32px.

---

### PLAYER IDENTITY & RESOURCES

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Player chip/avatar (×6)** | Flat circle | 3D poker chip with color enamel + gold edge + LV monogram | M | Yes | Fallback | **Yes** at hero sizes |
| **Player chip (scoreboard)** | Border glow rect | Felt-trimmed chip tray card with chip portrait | M | Yes | Partial | No |
| **Money display icon** | `$` text in green | Stack of $1M chips or gold plaque | S | Yes | Yes | No |
| **Dice remaining icon** | MiniDie SVG | Tiny 3D die silhouette | S | Yes | Yes | No |
| **Marker remaining icon** | MiniMarker SVG | Tiny marker sprite | S | Yes | Yes | No |
| **Color picker chips** | Flat circles | Selectable 3D chips, taken = faded stack | M | Yes | No | Optional |
| **Host badge** | Text "host" | Gold dealer button pin | S | Yes | Yes | No |
| **Active turn indicator** | Ping dot | Rotating gold ring + chip glow | S | No | SVG animation | No |

#### AI Prompts — Player Identity

**Red player poker chip:**  
Polished 3D casino poker chip, red enamel center, brushed gold edge stripes, engraved LV monogram, realistic lighting, transparent background, front-facing, 1024×1024, premium board game style.

**Money chip stack icon:**  
Small stack of green and gold Las Vegas money chips with $ symbol, isometric view, transparent background, 512×512, UI icon for board game HUD.

---

### SCORE TRACK

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Score track board** | Flat grid cells | Curved gold track with engraved point numbers, tier breaks visible | L | Yes | Partial | No |
| **Score pawns (×6)** | 10px flat circles | Mini chip/die markers sliding on track | M | Yes | Sprites | No |
| **Jackpot cell** | Gold ring | Neon JACKPOT marquee cell | S | Yes | Yes | No |
| **Score advance VFX** | layoutId spring | Token slides, tier-up flash, coin burst | M | No | SVG | No |

#### AI Prompts — Score Track

**Score track panel:**  
Vertical score track board game component, brushed gold path with engraved numbers 0–90, dark felt background, tier sections separated by diamond inlays, jackpot at top with neon glow, 512×2048, top-down flat illustration.

**Blue score pawn:**  
Tiny board game scoring pawn, blue enamel dome on gold base, cast shadow, 128×128 transparent, readable at 16px.

---

### ACTION UI (critical for "not a dashboard")

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Build action** | Text button | Gold-purple chip button + crane/building icon | M | Yes | **Yes** | No |
| **Sprawl action** | Text | Arrow sprawl icon, expansion glow | M | Yes | **Yes** | No |
| **Remodel action** | Text | Hammer + neon sign icon | M | Yes | **Yes** | No |
| **Raise action** | Text | Up arrow + stacked floors | M | Yes | **Yes** | No |
| **Reorganize action** | Text | Circular dice arrows | M | Yes | **Yes** | No |
| **Gamble action** | Text | Dice + chip icon | M | Yes | **Yes** | No |
| **Draw card button** | Gold text CTA | Card shoe + "Draw" plaque | M | Yes | Partial | No |
| **End turn button** | Subtle text | Dealer paddle "Pass" | S | Yes | Yes | No |
| **Cancel button** | Ghost text | — | S | No | Yes | No |

#### AI Prompt — Action Icons

**Build action icon:**  
UI icon for Build action in Las Vegas board game, miniature casino tower with crane, gold and purple, glossy button-ready, 256×256 transparent, thick readable silhouette, premium game UI.

*(Repeat pattern for Sprawl, Remodel, Raise, Reorganize, Gamble with appropriate metaphors.)*

---

### PANELS, MODALS & CHROME

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Panel background** | Flat `--surface` | Dark leather or felt inset tray | M | Yes | Tile PNG | No |
| **Modal frame** | Border + blur | Gold-corner dialog, felt interior | M | Yes | 9-slice PNG | No |
| **Sheet drag handle** | Gray pill | Gold bar with grip texture | S | No | Yes | No |
| **Log panel** | Plain scroll | Paper roll / casino receipt style optional | S | Optional | CSS | No |
| **Trade panel** | Standard panel | Contract parchment + chip seal | M | Yes | Partial | No |
| **Scrollbar** | Thin gray thumb | Gold thumb on felt track | S | No | CSS | No |
| **Input fields** | Dark bordered | Inset gold-trim field | S | No | CSS | No |
| **Landing hero** | Marquee text only | Strip skyline + stacked chips hero | L | Yes | No | No |
| **Favicon / app icon** | Default | Chip + LV monogram | S | Yes | **Yes** | No |
| **Loading state** | Marquee text | Chip spin or neon sign flicker | S | Yes | SVG anim | No |

#### AI Prompt — Modal Frame

**Modal frame 9-slice:**  
UI dialog frame for luxury casino board game, art deco gold corners, dark felt center, beveled metallic border, empty middle for content, 512×512 corner anchor design, game UI asset.

---

### EFFECTS & CELEBRATION

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Confetti** | CSS rectangles | Gold foil + chip-shaped particles | M | No | Canvas/SVG | No |
| **Victory overlay** | Text + confetti | Spotlight, trophy, fireworks, winner chip stack | L | Yes | Partial | Optional |
| **Turn banner** | Gradient + text | Marquee bulb animation across screen | M | Yes | SVG bulbs | No |
| **Payout toast** | Colored border pill | Cash register slide + coin trail | M | Yes | Partial | No |
| **Scoring toast** | Gold border pill | Score track highlight pulse | S | — | CSS | No |
| **Gamble overlay** | Felt panel + dice | Craps table close-up frame, dramatic lighting | M | Yes | Partial | No |
| **Build VFX** | Scale spring on lot | Construction spark + tile slam | M | No | Particles | No |
| **Neon ambient particles** | None | Rare floating bokeh in margins | M | Yes | Canvas | No |

#### AI Prompt — Victory

**Victory trophy badge:**  
Las Vegas board game victory emblem, gold trophy with dice and poker chips, neon halo, art deco ribbon, transparent background, 1024×1024, celebratory premium style.

---

### DIRECTOR VIEW EXTRAS

| Asset | Current | Recommended | Effort | AI? | SVG? | 3D? |
|-------|---------|-------------|--------|-----|------|-----|
| **Broadcast lower-third** | Plain header bar | Transparent gold lower-third template | M | Yes | **Yes** | No |
| **Event toast frames** | CSS borders | Broadcast-style payout/score banners | M | Yes | SVG | No |
| **Winner full-screen** | Blur + text | Cinematic title card with player color wash | M | Yes | Partial | No |

---

## 5. Animation Design (beyond fades)

| Moment | Current | Target "game feel" |
|--------|---------|-------------------|
| **Dice roll** | Random face shuffle + rotate wobble | 3D tumble OR multi-frame sprite arc; `diceRoll` sound sync; landing squash on `diceLand` |
| **Dice placed on build/sprawl** | Spring drop from above | Arc from player's chip tray → lot; exhaust rule = die **lifts** off old lot with trail |
| **Money change** | Spring number + float-up chip | Coin burst on gain; chips slide away on spend; cascade on multi-payout |
| **Property purchase (draw)** | Card chip flip | Deck top card slides out → flip → lot marker **plants** on board with thud |
| **Casino construction** | Scale spring on built tile | Tile drops from supply stack; brand sign **flickers on**; one-shot dust particles |
| **Sprawl** | Same as build | Tile **slides** from source casino; connecting neon pulse along adjacency |
| **Raise** | Riser count badge | Floor layer animates up with hydraulic **clunk**; height badge increments |
| **Remodel** | Color swap spring | Sign swap flash (old color out, new in); brief scaffold overlay |
| **Reorganize** | Sound only | All player dice in casino **lift**, spin, re-seat sequentially |
| **Cards** | rotateY on DrawnCardChip | Proper flip with back → face; discard slides to correct pile |
| **Player turn** | Full-screen "Your Turn" banner | Shorter (1s) + board-edge gold pulse; avoid blocking board |
| **Score increase** | layoutId on track dot | Pawn **slides** along track path; tier boundary = gold flash + `score` stinger |
| **Victory** | Confetti + spring text | Staged: dim board → spotlight → winner name → chip rain → standings reveal |
| **Buttons** | whileTap scale 0.96 | Depress like physical chip; hover = subtle glow; disabled = desaturate + lock icon shake |
| **Tile selection hover** | scale 1.06 + pulse | Lift toward camera (translateY), gold corner brackets animate in |
| **Illegal action** | Error toast | Lot shake + red flash; button bounce-back; no modal unless needed |
| **Dialogs** | Spring pop | Deal-card-from-dealer motion for modals; sheet slides like tray drawer |
| **Trade execute** | Sound only | Handshake seal stamp; chips exchange along bezier paths |
| **Turn handoff (others)** | Text only | Active player's chip tray pulses in scoreboard |

All animations should respect `MotionConfig reducedMotion="user"` (already in `Providers.tsx`).

---

## 6. Complete Sound Library Design

**Current:** 23 procedural recipes. Several game events have no dedicated call (`spend` exists but isn't wired to all spends).

### Recommended library (sampled + procedural hybrid)

| Sound | Purpose | Duration | Style | Source suggestion |
|-------|---------|----------|-------|-------------------|
| `ui_click` | Button press | 40ms | Chip tap | Procedural (keep) or Foley chip |
| `ui_open` | Modal/sheet open | 150ms | Tray slide + chime | Mixed |
| `ui_close` | Dismiss | 120ms | Soft close | Procedural |
| `card_shuffle` | Deck idle emphasis | 300ms | Paper riffle | Foley sample |
| `card_draw` | Draw property | 200ms | Swish + snap | Procedural (keep) + sample layer |
| `card_flip` | Reveal lot | 180ms | Paper flip | Sample |
| `card_discard` | To discard pile | 120ms | Soft slap | Sample |
| `marker_place` | Lot acquired | 100ms | Plastic clack | Foley |
| `marker_remove` | Vacate lot | 100ms | Pick-up | Foley |
| `dice_pickup` | Select die to move | 80ms | Hand on dice | Foley |
| `dice_roll` | Gamble/reorg roll | 600ms | Tumble on felt | Multi-sample layer |
| `dice_land` | Settle | 120ms | Felt thud | Sample (keep recipe) |
| `dice_slide` | Reorg placement | 100ms | Slide on felt | Foley |
| `coin_single` | Small payout | 150ms | Coin on felt | Sample (keep `coin`) |
| `cash_register` | Casino payout | 400ms | Ka-ching + coins | Sample layer on `cash` |
| `chip_stack` | Trade/money transfer | 200ms | Stack slide | Foley |
| `spend` | Pay build cost | 180ms | Chips pushed away | Wire to all spends |
| `build_place` | Tile placed | 250ms | Wood/plastic slam | Sample (keep `build`) |
| `sprawl_extend` | Adjacent build | 220ms | Slide + thud | Keep `sprawl` |
| `raise_floor` | Add riser | 200ms | Hydraulic clunk ×2 | Keep `raise` |
| `remodel_sign` | Color change | 300ms | Power tool + ding | Keep `remodel` |
| `reorganize_rattle` | Multi-dice reroll | 350ms | Cascade ticks | Keep |
| `gamble_win` | Player wins bet | 500ms | Slot win lite | New |
| `gamble_lose` | House wins | 300ms | Low buzz | New |
| `gamble_push` | Push/nothing | 200ms | Neutral tick | New |
| `score_tick` | Move on track | 100ms | Wooden peg | Keep `score` variant |
| `score_tier_up` | Cross gap tier | 400ms | Rising chime | New |
| `turn_start` | Your turn | 600ms | Marquee ding | Keep `turn` |
| `turn_pass` | End turn | 200ms | Soft whoosh | New |
| `trade_propose` | Trade opened | 300ms | Paper unfold | Keep `trade` |
| `trade_approve` | Checkmark | 150ms | Stamp | New |
| `trade_execute` | All approved | 500ms | Handshake + chips | New |
| `trade_reject` | Declined | 250ms | Buzz + rip | New |
| `notify_choice` | Pending choice | 250ms | Bell | Keep `notify` |
| `error` | Illegal action | 200ms | Low buzz | Keep |
| `success` | Join/start OK | 400ms | Major triad | Keep |
| `win_fanfare` | Game over win | 2s | Big band sting | Sample (replace synth `win`) |
| `game_over` | End card drawn | 1.5s | Somber chord | Keep |
| `ambient_table` | Loop during play | 60s+ | Soft casino room tone | Royalty-free loop |
| `ambient_tension` | Late game high scores | 60s+ | Low pulse | Optional |
| `music_menu` | Landing/lobby | 2–3min loop | Cool jazz lounge | Epidemic Sound / Artlist |
| `music_gameplay` | In-game optional | 3min loop | Subtle lounge, very low | Same |

**Implementation note:** Keep procedural fallback for zero-asset deploy; layer MP3/OGG samples when available. Category toggles already exist in `SoundManager`.

---

## 7. Layout — Gameplay Notes (no redesign proposed)

The three-zone layout is correct. Minor **density** improvements (not structural redesign):

| Observation | Gameplay rationale |
|-------------|-------------------|
| Right rail has unused vertical space on wide screens | Could tighten rail panels so board gains ~5–8% width without moving actions |
| Player chips row is functional but visually light | Richer chip art increases scan speed for "who has money" without reading numbers |
| Action dock text-only | Icons + color coding reduce mis-clicks during timed turns |
| Board felt reads flat at distance | Texture increases lot boundary readability |
| Turn banner covers center | Shorten duration (already ~1.9s) — consider edge-only pulse to keep board visible |

**Do not:** Move actions to top, shrink board, or split board across scroll regions.

---

## 8. Recommended Implementation Phases (after approval)

| Phase | Scope | Gameplay benefit |
|-------|-------|------------------|
| **0** | Asset pipeline folder + image optimization + 9-slice utils | Foundation |
| **1** | Board felt, rail, lot tiles, Strip, streets | Board readability & focus |
| **2** | Dice + markers sprites; improved roll/placement | Core piece recognition |
| **3** | Action dock icons + button skins | Faster turn decisions |
| **4** | Player chips + score track art | Resource scanning |
| **5** | Property cards + deck/discard visuals | Draw phase clarity |
| **6** | Casino brand tiles + build/sprawl VFX | Strategic board reading |
| **7** | Sample audio layer + music | Immersion |
| **8** | Victory, Director broadcast chrome | Spectacle / YouTube |

Each phase is independently shippable.

---

## 9. Gap Summary

| Category | Have | Need |
|----------|------|------|
| Raster/vector art files | 0 game assets | ~80+ distinct art pieces |
| 3D | None | Dice strongly benefit |
| Rive | MCP available, no files | Optional for dice roll, turn banner |
| Music | Reserved, not implemented | 2 loops minimum |
| Physical game reference | Documented, not in repo | Import playmat for color/composition fidelity |

---

## 10. Next Step

This audit is the pre-implementation deliverable. When ready:

1. **Approve phases** (or reprioritize — e.g. action icons before card art).
2. **Confirm art direction** against physical playmat (if you can add `Lords_of_Vegas_Stitched_Playmat.png` to the repo, colors/composition can be matched precisely).
3. **Pick generation toolchain** — assets can be produced batch-by-batch via AI prompts; Rive MCP for interactive dice is an option.

Which phase should be implemented first once approved?
