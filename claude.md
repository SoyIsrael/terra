# terra.io

A real-time multiplayer territory game played on a 3D globe. Inspired by territorial.io, but with resource-driven strategy, a day/night cycle, and peace as a real victory condition.

## Core concept

Players spawn on a spherical world, choose a capital location, gather resources, expand territory, and either dominate or broker world peace. The globe is the central differentiator — no edges, no corners, climate zones determine strategy, and ocean crossings enable surprise plays.

## Win conditions

Two ways to win, both first-class:

1. **Domination** — be the last empire standing.
2. **Peace** — all remaining players unanimously sign a peace treaty. Each must contribute resources/territory to a shared "world commons." Once signed, the game ends and the commons is split proportionally to contribution. Players can betray the treaty at the last second for a solo domination bid, so trust is real.

## Game flow

1. **Draft phase** — players take turns picking their capital location on the globe, seeing where others have placed. This sets the strategic tone.
2. **Expansion phase** — claim territory outward from capital. Expansion costs scale with distance from capital, so compact empires are efficient.
3. **Resource & diplomacy phase** — gather, trade, build, ally, betray.
4. **Endgame** — pursue domination or push for a peace treaty.

Target game length: 20–30 minutes.

## The globe

- Spherical map, fully rotatable. No edges.
- **Climate zones** determine resource distribution:
  - Equator: grain, gold
  - Mid-latitudes: wood, water
  - Poles: iron, stone
- **Oceans** separate continents. Crossing requires boats. Boats can also be used for surprise attacks and naval blockades.
- **Day/night cycle** rotates continuously across the globe (full cycle ≈ 4 minutes of real time). Territory on the night side has reduced visibility for opponents — troop movements and resource transfers are partially hidden. Players plan around the cycle.

## Resources

Five resources, each with a distinct role. No resource is pure currency except gold.

| Resource | Role |
|---|---|
| **Water** | Required to sustain population. Territory far from water slowly decays. |
| **Grain** | Fuels expansion speed and army growth. |
| **Wood** | Builds palisades (cheap walls) and basic boats. |
| **Iron** | Upgrades to stone walls, armored ships, offensive units. |
| **Gold** | Universal trade currency. Used for bribes, treaties, and diplomacy. |

This forces specialization. A gold-rich player has weak military and survives through diplomacy. An iron-rich player expands slowly but is hard to kill.

## Capital mechanic

- Each player has one capital, chosen during the draft phase.
- Expansion cost scales with distance from capital (encourages compact empires).
- Capital can be moved, but it's expensive and leaves the player vulnerable during the transition.
- Capital is the highest-value target — destroying it cripples but does not eliminate a player.

## Walls and defenses

- **Wood palisade** — cheap, slows enemy expansion.
- **Stone wall** — expensive (wood + iron), blocks expansion until broken.
- **Iron fortress** — built only on the capital, requires sustained assault to crack.
- **Naval blockade** — boats stationed in sea tiles act as moving walls.

## Boats

- **Wooden boat** — basic transport, slow, vulnerable.
- **Armored ship** — iron + wood, used for blockades and amphibious assaults.
- Boats enable cross-ocean attacks, supply lines between split territories, and trade routes.

## Trade and diplomacy

- **Trade routes** — formal agreements between two players. Both sides get a resource bonus, but the route appears as a visible line on the map. Enemies can sever it.
- **Alliances** — shared vision with allies. Allies see each other's full map state.
- **Backstab penalty** — when a player breaks an alliance, the betrayed party gets a temporary "vengeance" buff (faster expansion, stronger walls). This makes betrayal a real choice rather than a default.
- **Merger** — two players can fully merge empires into one. They share the win. High-trust play, irreversible.

## Day/night cycle (key mechanic)

- The globe rotates continuously. A full day/night cycle takes about 4 minutes of real-time play.
- Territory currently on the **night side** has reduced visibility for all opponents:
  - Troop movements partially hidden
  - Resource transfers hidden
  - Walls and structures still visible (you can see what exists, not what's happening)
- Players time invasions and trades around the cycle. Sneaking an army across the dark side becomes a real tactic.
- Allies retain full vision regardless of cycle (perk of alliance).

## Peace mechanic (key mechanic)

The peace victory is the soul of terra.io. Treat it as a first-class system, not a side mode.

- Any player can propose peace at any time.
- All remaining players must sign for peace to take effect.
- Each signer must contribute to a **world commons**: a resource pool, a piece of territory, or both. Contribution is private until peace is finalized.
- Once peace is declared, the game ends. The commons is split among signers proportionally to their contribution.
- **Last-second betrayal** — between the moment peace is proposed and the moment all signatures lock in, any player can declare war instead, voiding peace and triggering a final domination phase. This creates the central tension: do you trust the room or strike first?

## Tech stack

Recommended:

- **Frontend** — Three.js for the 3D globe; React for UI layers (HUD, menus, trade dialogs).
- **Multiplayer** — WebSockets via Socket.io. Authoritative server for game state.
- **Backend** — Node.js + TypeScript. State is server-authoritative; clients send intents, server validates and broadcasts state diffs.
- **Map representation** — hex grid projected onto a sphere (icosphere with hex tiles). Roughly 2,000–4,000 tiles for a playable globe.
- **State sync** — tick-based updates (10–20 ticks/sec for territory, 1 tick/sec for resources). Delta compression to keep bandwidth low.
- **Persistence** — Redis for active game state, Postgres for player accounts and match history.

## Architecture sketch

```
[Client: Three.js + React]
        │
        │  WebSocket (intents in, state diffs out)
        ▼
[Game Server: Node.js + TypeScript]
        │
        ├── Game loop (tick-based simulation)
        ├── Authoritative state (Redis)
        └── Match results → Postgres
```

## Scope: MVP vs. full game

**MVP (prove the loop):**
- Globe with hex tiles
- Capital draft phase
- Territory expansion mechanic
- Three resources (water, grain, gold)
- Day/night cycle (visibility only, no mechanical impact yet)
- Domination win condition only
- 2–4 player matches

**v1 (full vision):**
- All five resources with distinct roles
- Walls and boats
- Trade and alliances
- Peace victory with betrayal mechanic
- Day/night mechanics on visibility and stealth
- 8+ player matches

## Open questions

- Exact tile count for a globe that's strategic but not slow.
- How long the draft phase should take — fixed timer or first-come-first-served?
- Should resources regenerate, deplete, or stay constant?
- Spectator mode and replays.
- Anti-cheat strategy for the authoritative server.

## Design principles

1. **Snappy controls.** The territorial.io appeal is one-click commands. Don't drown players in menus.
2. **Readable globe.** Player colors must be distinguishable on a 3D surface. Test with colorblind palettes early.
3. **Peace must be tempting.** If domination is always faster, no one will sign. Tune the commons split generously.
4. **Day/night must matter.** If the cycle is only visual, cut it. It needs real strategic weight.
5. **Trust the player.** Allow betrayal, allow risky plays. Don't over-design out of fear.