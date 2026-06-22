# Game System & Shared Engine — Javas Bot WA

This document outlines the architecture, state models, rewards, and anti-AFK systems governing the bot's interactive game suite.

## Game Engine Shared Module

All games leverage a centralized, thread-safe, and asynchronous state manager inside `src/services/games/game-session.service.ts`.

### State Lifecycle

The life cycle of a game session follows this progression:

```
[Lobby State] ──> [Playing State] ──> [Finished State]
      │                 │
      ├─(Timeout/AFK)   ├─(Timeout/AFK)
      ▼                 ▼
[Cancelled/Cleaned] [Cancelled/Cleaned]
```

### Components

1. **GameLobby**: Handles room initialization, join/leave requests, and start trigger.
2. **GameTimer**: Prevents sessions from locking group chats.
   - Lobby Timeout: 3 minutes.
   - Turn Timeout: 60 seconds.
3. **Reward Engine**: Dispenses XP, virtual coins, and achievements upon completion.
4. **Anti-AFK Guard**: Automatically skips or penalizes players who fail to take an action within the turn timer limit.
5. **Anti-Cheat Validation**: Blocks dual-join attempts and verifies command inputs against active players.

---

## Rewards Structure

* **XP Progress**: Earned on wins and participation.
* **Virtual Coins**: Used inside `/shop` and `/buy` commands.
* **Achievements**: Triggers special title unlocks.
