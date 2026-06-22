import prisma from '../../db/client.js';

export interface GamePlayer {
  userId: string;
  score?: number;
  streak?: number;
  choice?: string;
  isAfk?: boolean;
}

export interface GameRoomOptions {
  id: string; // chatId
  gameType: string;
  gameName: string;
  hostId: string;
  minPlayers?: number;
  maxPlayers?: number;
}

export class GameRoom {
  public id: string;
  public gameType: string;
  public gameName: string;
  public hostId: string;
  public players: string[] = [];
  public status: 'lobby' | 'playing' | 'ended' = 'lobby';
  public minPlayers: number;
  public maxPlayers: number;
  public state: any = {};
  public lastActivity: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: GameRoomOptions) {
    this.id = options.id;
    this.gameType = options.gameType;
    this.gameName = options.gameName;
    this.hostId = options.hostId;
    this.minPlayers = options.minPlayers || 1;
    this.maxPlayers = options.maxPlayers || 99;
    this.lastActivity = Date.now();
    this.players.push(options.hostId);
  }

  public join(userId: string): boolean {
    if (this.status !== 'lobby') return false;
    if (this.players.includes(userId)) return false;
    if (this.players.length >= this.maxPlayers) return false;
    this.players.push(userId);
    this.updateActivity();
    return true;
  }

  public leave(userId: string): boolean {
    if (this.status !== 'lobby') return false;
    if (!this.players.includes(userId)) return false;
    this.players = this.players.filter(p => p !== userId);
    this.updateActivity();
    return true;
  }

  public start(): boolean {
    if (this.status !== 'lobby') return false;
    if (this.players.length < this.minPlayers) return false;
    this.status = 'playing';
    this.updateActivity();
    return true;
  }

  public cancel() {
    this.status = 'ended';
    this.clearAfkTimeout();
  }

  public updateActivity() {
    this.lastActivity = Date.now();
  }

  public setAfkTimeout(ms: number, onTimeout: () => void) {
    this.clearAfkTimeout();
    this.timer = setTimeout(() => {
      onTimeout();
    }, ms);
  }

  public clearAfkTimeout() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export class GameTimer {
  private timeoutId: NodeJS.Timeout | null = null;
  private durationMs: number;
  private callback: () => void;

  constructor(durationMs: number, callback: () => void) {
    this.durationMs = durationMs;
    this.callback = callback;
  }

  public start() {
    this.stop();
    this.timeoutId = setTimeout(this.callback, this.durationMs);
  }

  public stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public reset() {
    this.start();
  }
}

// Reward Player Interface
export async function rewardPlayer(userId: string, coins: number, xp: number): Promise<void> {
  const currentEconomy = await prisma.userEconomy.findUnique({ where: { userId } });
  if (currentEconomy) {
    await prisma.userEconomy.update({
      where: { userId },
      data: {
        balance: { increment: coins },
        xp: { increment: xp }
      }
    });
  } else {
    await prisma.userEconomy.create({
      data: {
        userId,
        balance: coins,
        xp,
        level: 1
      }
    });
  }
}

// Leaderboard / Stats recording
export async function recordGameStats(userId: string, groupId: string | null, gameType: string, isWin: boolean, pointsEarned: number): Promise<void> {
  const existing = await prisma.gameStats.findFirst({
    where: { userId, gameType, groupId }
  });

  if (existing) {
    await prisma.gameStats.update({
      where: { id: existing.id },
      data: {
        wins: { increment: isWin ? 1 : 0 },
        losses: { increment: isWin ? 0 : 1 },
        points: { increment: pointsEarned }
      }
    });
  } else {
    await prisma.gameStats.create({
      data: {
        userId,
        groupId,
        gameType,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        points: pointsEarned
      }
    });
  }
}

export async function getGameLeaderboard(gameType: string, limit: number = 10) {
  return prisma.gameStats.findMany({
    where: { gameType },
    orderBy: { points: 'desc' },
    take: limit
  });
}
