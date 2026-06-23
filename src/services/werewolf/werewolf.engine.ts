import prisma from '../../db/client.js';
import { recordGameStats } from '../games/game-engine.js';

export type Role = 'Werewolf' | 'BlackWolf' | 'Witch' | 'Fool' | 'Seer' | 'Doctor' | 'Hunter' | 'Villager';
export type Phase = 'lobby' | 'night' | 'day_discuss' | 'day_vote';
export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  isAlive: boolean;
  role: Role;
  hasPoison?: boolean;
  hasHeal?: boolean;
  hasInfect?: boolean;
}

export interface Vote {
  voterId: string;
  targetId: string;
}

export interface NightActions {
  killTarget?: string;
  protectTarget?: string;
  checkTarget?: string;
  poisonTarget?: string;
  healUsed?: boolean;
  infectTarget?: string;
  witchPassed?: boolean;
}

interface WerewolfNotificationCallbacks {
  sendGroupMessage: (groupId: string, text: string) => Promise<void>;
  sendPrivateMessage: (userId: string, text: string) => Promise<void>;
}

export interface WerewolfGameData {
  id: string;
  groupId: string;
  gameType: string;
  status: string;
  playersJson: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  phase: string;
  hostUserId: string;
  rolesJson: string;
  votesJson: string;
  nightActionsJson: string;
  activeModifier: string;
}

function parseGameSession(session: any): WerewolfGameData | null {
  if (!session) return null;
  let state = {
    phase: 'lobby',
    hostUserId: '',
    rolesJson: '{}',
    votesJson: '{}',
    nightActionsJson: '{}',
    activeModifier: 'normal_night'
  };
  try {
    state = JSON.parse(session.stateJson || '{}');
  } catch {}
  return {
    id: session.id,
    groupId: session.groupId,
    gameType: session.gameType,
    status: session.status,
    playersJson: session.playersJson,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
    phase: state.phase || 'lobby',
    hostUserId: state.hostUserId || '',
    rolesJson: state.rolesJson || '{}',
    votesJson: state.votesJson || '{}',
    nightActionsJson: state.nightActionsJson || '{}',
    activeModifier: state.activeModifier || 'normal_night'
  };
}

async function saveGameSession(groupId: string, data: Partial<WerewolfGameData & { activeModifier?: string }>) {
  const existing = await prisma.gameSession.findUnique({ where: { groupId } });
  let state = existing ? JSON.parse(existing.stateJson || '{}') : {};
  
  if (data.phase !== undefined) state.phase = data.phase;
  if (data.hostUserId !== undefined) state.hostUserId = data.hostUserId;
  if (data.rolesJson !== undefined) state.rolesJson = data.rolesJson;
  if (data.votesJson !== undefined) state.votesJson = data.votesJson;
  if (data.nightActionsJson !== undefined) state.nightActionsJson = data.nightActionsJson;
  if (data.activeModifier !== undefined) state.activeModifier = data.activeModifier;

  const updateData: any = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.playersJson !== undefined) updateData.playersJson = data.playersJson;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
  updateData.stateJson = JSON.stringify(state);

  return prisma.gameSession.update({
    where: { groupId },
    data: updateData
  });
}

async function createGameSession(groupId: string, hostId: string, hostName: string, expiresAt: Date, gameType = 'werewolf') {
  const players: Player[] = [{ id: hostId, name: hostName, isAlive: true, role: 'Villager' }];
  const state = {
    phase: 'lobby',
    hostUserId: hostId,
    rolesJson: '{}',
    votesJson: '{}',
    nightActionsJson: '{}',
    activeModifier: 'normal_night'
  };
  return prisma.gameSession.upsert({
    where: { groupId },
    create: {
      groupId,
      gameType,
      status: 'lobby',
      playersJson: JSON.stringify(players),
      stateJson: JSON.stringify(state),
      expiresAt
    },
    update: {
      gameType,
      status: 'lobby',
      playersJson: JSON.stringify(players),
      stateJson: JSON.stringify(state),
      expiresAt
    }
  });
}

function getRolesForCount(count: number): Role[] {
  if (count === 5) {
    return ['Werewolf', 'Seer', 'Doctor', 'Fool', 'Villager'];
  }
  if (count === 6) {
    return ['Werewolf', 'Seer', 'Doctor', 'Fool', 'Witch', 'Villager'];
  }
  if (count === 7) {
    return ['Werewolf', 'BlackWolf', 'Seer', 'Doctor', 'Fool', 'Witch', 'Hunter'];
  }
  if (count === 8) {
    return ['Werewolf', 'BlackWolf', 'Seer', 'Doctor', 'Fool', 'Witch', 'Hunter', 'Villager'];
  }
  if (count === 9) {
    return ['Werewolf', 'Werewolf', 'BlackWolf', 'Seer', 'Doctor', 'Fool', 'Witch', 'Hunter', 'Villager'];
  }
  return ['Werewolf', 'Werewolf', 'BlackWolf', 'Seer', 'Doctor', 'Fool', 'Witch', 'Hunter', 'Villager', 'Villager'];
}

class WerewolfEngine {
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private callbacks?: WerewolfNotificationCallbacks;

  public setNotificationCallbacks(callbacks: WerewolfNotificationCallbacks) {
    this.callbacks = callbacks;
  }

  public async boot(): Promise<void> {
    const activeGames = await prisma.gameSession.findMany({
      where: { gameType: { in: ['werewolf', 'wwchaos', 'wwranked'] }, status: { in: ['lobby', 'playing'] } }
    });

    for (const session of activeGames) {
      const game = parseGameSession(session);
      if (game) {
        this.setupResumeTimer(game.groupId, game.phase, game.expiresAt);
      }
    }
  }

  private setupResumeTimer(groupId: string, phase: string, expiresAt: Date | null) {
    if (!expiresAt) return;
    
    this.clearTimer(groupId);

    const msRemaining = expiresAt.getTime() - Date.now();
    if (msRemaining <= 0) {
      this.handlePhaseTimeout(groupId);
    } else {
      const timer = setTimeout(() => {
        this.handlePhaseTimeout(groupId);
      }, msRemaining);
      this.activeTimers.set(groupId, timer);
    }
  }

  private setTimer(groupId: string, phase: Phase, seconds: number) {
    this.clearTimer(groupId);
    const expiresAt = new Date(Date.now() + seconds * 1000);

    const timer = setTimeout(() => {
      this.handlePhaseTimeout(groupId);
    }, seconds * 1000);

    this.activeTimers.set(groupId, timer);
    return expiresAt;
  }

  private clearTimer(groupId: string) {
    const timer = this.activeTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(groupId);
    }
  }

  private async handlePhaseTimeout(groupId: string) {
    console.log(`[Werewolf Engine] Phase timeout for group ${groupId}`);
    const session = await prisma.gameSession.findUnique({
      where: { groupId }
    });
    const game = parseGameSession(session);

    if (!game || game.status === 'finished') return;

    if (game.phase === 'lobby') {
      await prisma.gameSession.delete({ where: { groupId } });
      this.notifyGroup(groupId, '⏰ Lobby game Werewolf telah berakhir karena batas waktu 5 menit tercapai.');
    } else if (game.phase === 'night') {
      await this.transitToDay(groupId);
    } else if (game.phase === 'day_discuss') {
      await this.transitToVoting(groupId);
    } else if (game.phase === 'day_vote') {
      await this.resolveVoting(groupId);
    }
  }

  public async getGame(groupId: string) {
    const session = await prisma.gameSession.findUnique({
      where: { groupId }
    });
    return parseGameSession(session);
  }

  public async findActiveGameForPlayer(playerId: string) {
    const activeGames = await prisma.gameSession.findMany({
      where: { gameType: { in: ['werewolf', 'wwchaos', 'wwranked'] }, status: 'playing' }
    });
    for (const session of activeGames) {
      const game = parseGameSession(session);
      if (game) {
        const players: Player[] = JSON.parse(game.playersJson);
        if (players.some(p => p.id === playerId && p.isAlive)) {
          return game;
        }
      }
    }
    return null;
  }

  public async createLobby(groupId: string, hostId: string, hostName: string, gameType = 'werewolf'): Promise<string> {
    const existing = await prisma.gameSession.findUnique({ where: { groupId } });
    if (existing && existing.status !== 'finished') {
      throw new Error('Sudah ada game Werewolf yang aktif di grup ini.');
    }

    const expiresAt = this.setTimer(groupId, 'lobby', 300); // 5 minutes lobby
    await createGameSession(groupId, hostId, hostName, expiresAt, gameType);

    const typeLabel = gameType === 'wwchaos' ? ' Chaos Mode' : gameType === 'wwranked' ? ' Ranked Season' : '';
    return `Lobby Werewolf${typeLabel} berhasil dibuat! Ketik \`/ww join\` untuk bergabung. Minimal 5 pemain, maksimal 10.`;
  }

  public async joinGame(groupId: string, playerId: string, playerName: string): Promise<string> {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game || game.status !== 'lobby') {
      throw new Error('Tidak ada lobby game Werewolf yang aktif di grup ini.');
    }

    const players: Player[] = JSON.parse(game.playersJson);
    if (players.find(p => p.id === playerId)) {
      throw new Error('Anda sudah bergabung di game ini.');
    }

    if (players.length >= 10) {
      throw new Error('Jumlah maksimal pemain (10) telah terpenuhi.');
    }

    players.push({ id: playerId, name: playerName, isAlive: true, role: 'Villager' });

    await prisma.gameSession.update({
      where: { groupId },
      data: { playersJson: JSON.stringify(players) }
    });

    return `@${playerId.split('@')[0]} bergabung dalam permainan! (Pemain: ${players.length}/10)`;
  }

  public async leaveGame(groupId: string, playerId: string): Promise<string> {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game || game.status !== 'lobby') {
      throw new Error('Game belum dimulai. Anda hanya bisa keluar saat lobby.');
    }

    let players: Player[] = JSON.parse(game.playersJson);
    const index = players.findIndex(p => p.id === playerId);
    if (index === -1) {
      throw new Error('Anda belum bergabung dalam game.');
    }

    players.splice(index, 1);

    if (players.length === 0) {
      this.clearTimer(groupId);
      await prisma.gameSession.delete({ where: { groupId } });
      return 'Lobby ditutup karena tidak ada pemain tersisa.';
    }

    const newHost = game.hostUserId === playerId ? players[0].id : game.hostUserId;

    await saveGameSession(groupId, {
      playersJson: JSON.stringify(players),
      hostUserId: newHost
    });

    return `Pemain meninggalkan lobby. Host baru: @${newHost.split('@')[0]} (Pemain: ${players.length})`;
  }

  public async startGame(groupId: string, requesterId: string): Promise<void> {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game || game.status !== 'lobby') {
      throw new Error('Tidak ada game dalam lobby yang bisa dimulai.');
    }

    if (game.hostUserId !== requesterId) {
      throw new Error('Hanya Host pembuat game yang bisa memulai permainan.');
    }

    const players: Player[] = JSON.parse(game.playersJson);
    const count = players.length;
    if (count < 5) {
      throw new Error('Pemain kurang! Minimal 5 pemain diperlukan untuk memulai.');
    }

    const roles = getRolesForCount(count);

    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    players.forEach((p, idx) => {
      p.role = roles[idx];
      if (p.role === 'Witch') {
        p.hasPoison = true;
        p.hasHeal = true;
      } else if (p.role === 'BlackWolf') {
        p.hasInfect = true;
      }
    });

    let activeModifier = 'normal_night';
    let chaosAnnounce = '';
    if (game.gameType === 'wwchaos') {
      const modifiers = ['eclipse', 'supermoon', 'normal_night'];
      activeModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      if (activeModifier === 'eclipse') {
        chaosAnnounce = '\n\n🌌 *CHAOS MODIFIER: Gerhana (Eclipse)*\nKabut tebal menutupi desa! Seer dan Doctor tidak bisa menggunakan kemampuan mereka malam ini.';
      } else if (activeModifier === 'supermoon') {
        chaosAnnounce = '\n\n🌕 *CHAOS MODIFIER: Purnama Raya (Supermoon)*\nWerewolf sangat kuat! Serangan mereka menembus perlindungan Doctor.';
      } else {
        chaosAnnounce = '\n\n✨ *CHAOS MODIFIER: Malam Tenang (Normal)*\nMalam ini berlangsung damai tanpa ada modifier.';
      }
    }

    const expiresAt = this.setTimer(groupId, 'night', 90);

    await saveGameSession(groupId, {
      status: 'playing',
      phase: 'night',
      playersJson: JSON.stringify(players),
      activeModifier,
      expiresAt
    });

    await this.notifyGroup(groupId, `🐺 Game Werewolf dimulai! Hari berganti Malam.\n\nBot telah mengirimkan peran ke Chat Pribadi masing-masing pemain.\nFase malam berlangsung selama 90 detik. Gunakan kemampuan Anda segera!${chaosAnnounce}`);

    for (const p of players) {
      let roleMsg = `ℹ️ Peran Anda dalam game di grup: *${p.role}*\n`;
      if (p.role === 'Werewolf') {
        const team = players.filter(ot => (ot.role === 'Werewolf' || ot.role === 'BlackWolf') && ot.id !== p.id).map(ot => `@${ot.id.split('@')[0]}`).join(', ');
        roleMsg += `Tugas Anda: Habisi warga saat malam hari.`;
        if (team) roleMsg += `\nKawan Serigala Anda: ${team}`;
        roleMsg += `\n\nUntuk membunuh, balas chat bot ini dengan: \`/ww kill @username\``;
      } else if (p.role === 'BlackWolf') {
        const team = players.filter(ot => (ot.role === 'Werewolf' || ot.role === 'BlackWolf') && ot.id !== p.id).map(ot => `@${ot.id.split('@')[0]}`).join(', ');
        roleMsg += `Tugas Anda: Habisi warga saat malam hari. Sebagai Serigala Hitam (Black Wolf), Anda memiliki 1x kesempatan untuk menginfeksi warga agar menjadi Werewolf.\n\n`;
        if (team) roleMsg += `Kawan Serigala Anda: ${team}\n\n`;
        roleMsg += `Untuk membunuh: \`/ww kill @username\`\nUntuk menginfeksi: \`/ww infect @username\``;
      } else if (p.role === 'Witch') {
        roleMsg += `Tugas Anda: Anda memiliki 1 ramuan racun untuk membunuh seseorang dan 1 ramuan penyembuh untuk menyelamatkan korban.\n\nUntuk membunuh: \`/ww poison @username\`\nUntuk menyembuhkan korban malam ini: \`/ww heal\`\nUntuk melewati giliran: \`/ww pass\``;
      } else if (p.role === 'Fool') {
        roleMsg += `Tugas Anda: Buat warga menuduh dan membakar Anda (vote out) di siang hari! Jika Anda dibakar warga, Anda menang seketika.`;
      } else if (p.role === 'Doctor') {
        roleMsg += `Tugas Anda: Lindungi satu pemain setiap malam dari serangan Werewolf.\n\nUntuk melindungi, balas chat bot ini dengan: \`/ww protect @username\``;
      } else if (p.role === 'Seer') {
        roleMsg += `Tugas Anda: Terawang peran satu pemain setiap malam.\n\nUntuk menerawang, balas chat bot ini dengan: \`/ww check @username\``;
      } else if (p.role === 'Hunter') {
        roleMsg += `Tugas Anda: Jika Anda terbunuh, Anda bisa menembak mati 1 target.\n\nTunggu instruksi di grup jika Anda mati.`;
      } else {
        roleMsg += `Tugas Anda: Berdiskusi dan temukan Werewolf di siang hari!`;
      }

      await this.notifyPrivate(p.id, roleMsg);
    }
  }

  public async setNightAction(
    groupId: string,
    action: 'kill' | 'protect' | 'check' | 'poison' | 'heal' | 'infect' | 'pass',
    actorId: string,
    targetUsername: string
  ): Promise<string> {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game || game.status !== 'playing' || game.phase !== 'night') {
      throw new Error('Aksi malam hanya bisa dilakukan pada fase malam hari.');
    }

    const players: Player[] = JSON.parse(game.playersJson);
    const actor = players.find(p => p.id === actorId);

    if (!actor || !actor.isAlive) {
      throw new Error('Anda tidak berpartisipasi atau sudah mati.');
    }

    if (game.gameType === 'wwchaos' && game.activeModifier === 'eclipse') {
      if (action === 'protect') {
        throw new Error('Aksi dibatalkan karena Gerhana Bulan (Eclipse)! Doctor kehilangan kekuatannya malam ini.');
      }
      if (action === 'check') {
        throw new Error('Aksi dibatalkan karena Gerhana Bulan (Eclipse)! Seer kehilangan penglihatannya malam ini.');
      }
    }

    if (action === 'kill' && actor.role !== 'Werewolf' && actor.role !== 'BlackWolf') {
      throw new Error('Hanya Werewolf yang bisa membunuh.');
    }
    if (action === 'infect' && actor.role !== 'BlackWolf') {
      throw new Error('Hanya Serigala Hitam yang bisa menginfeksi.');
    }
    if (action === 'protect' && actor.role !== 'Doctor') {
      throw new Error('Hanya Doctor yang bisa menyembuhkan.');
    }
    if (action === 'check' && actor.role !== 'Seer') {
      throw new Error('Hanya Seer yang bisa menerawang.');
    }
    if ((action === 'poison' || action === 'heal' || action === 'pass') && actor.role !== 'Witch') {
      throw new Error('Hanya Witch yang bisa melakukan tindakan ini.');
    }

    let target: Player | undefined;
    if (action !== 'heal' && action !== 'pass') {
      const cleanUsername = targetUsername.replace('@', '').trim().toLowerCase();
      target = players.find(p => {
        const parts = p.id.split('@');
        return parts[0].toLowerCase() === cleanUsername || p.name.toLowerCase() === cleanUsername;
      });

      if (!target) {
        throw new Error(`Pemain "${targetUsername}" tidak ditemukan.`);
      }

      if (!target.isAlive) {
        throw new Error('Target sudah mati.');
      }
    }

    const actions: NightActions = JSON.parse(game.nightActionsJson);

    if (action === 'kill') {
      actions.killTarget = target!.id;
      // Notify Witch if she has a heal potion
      const witch = players.find(p => p.role === 'Witch' && p.isAlive);
      if (witch && witch.hasHeal) {
        await this.notifyPrivate(
          witch.id,
          `⚠️ Serigala memilih untuk membunuh @${target!.id.split('@')[0]} malam ini.\n\nKetik \`/ww heal\` jika ingin menyelamatkannya.`
        );
      }
    } else if (action === 'infect') {
      if (!actor.hasInfect) {
        throw new Error('Anda sudah menggunakan skill infeksi Anda.');
      }
      actions.infectTarget = target!.id;
      actions.killTarget = undefined; // Infect replaces kill target
      actor.hasInfect = false;
    } else if (action === 'protect') {
      actions.protectTarget = target!.id;
    } else if (action === 'check') {
      actions.checkTarget = target!.id;
    } else if (action === 'poison') {
      if (!actor.hasPoison) {
        throw new Error('Anda sudah menggunakan ramuan racun Anda.');
      }
      actions.poisonTarget = target!.id;
      actor.hasPoison = false;
    } else if (action === 'heal') {
      if (!actor.hasHeal) {
        throw new Error('Anda sudah menggunakan ramuan penyembuh Anda.');
      }
      if (!actions.killTarget) {
        throw new Error('Belum ada korban dari Serigala malam ini yang bisa disembuhkan.');
      }
      actions.healUsed = true;
      actor.hasHeal = false;
    } else if (action === 'pass') {
      actions.witchPassed = true;
    }

    await saveGameSession(groupId, {
      playersJson: JSON.stringify(players),
      nightActionsJson: JSON.stringify(actions)
    });

    await this.checkAllNightActionsDone(groupId, players, actions);

    if (action === 'check') {
      return `🔮 Hasil teropong: @${target!.id.split('@')[0]} adalah *${(target!.role === 'Werewolf' || target!.role === 'BlackWolf') ? 'Werewolf' : 'Warga Baik/Spesial'}*.`;
    }

    return `Aksi malam berhasil direkam.`;
  }

  private async checkAllNightActionsDone(groupId: string, players: Player[], actions: NightActions) {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game) return;

    const hasWwAlive = players.some(p => (p.role === 'Werewolf' || p.role === 'BlackWolf') && p.isAlive);
    const hasDocAlive = players.some(p => p.role === 'Doctor' && p.isAlive);
    const hasSeerAlive = players.some(p => p.role === 'Seer' && p.isAlive);
    const hasWitchAlive = players.some(p => p.role === 'Witch' && p.isAlive);

    const isEclipse = game.gameType === 'wwchaos' && game.activeModifier === 'eclipse';
    const wwDone = !hasWwAlive || !!actions.killTarget || !!actions.infectTarget;
    const docDone = !hasDocAlive || !!actions.protectTarget || isEclipse;
    const seerDone = !hasSeerAlive || !!actions.checkTarget || isEclipse;

    let witchDone = true;
    if (hasWitchAlive) {
      const witch = players.find(p => p.role === 'Witch' && p.isAlive)!;
      const canHeal = witch.hasHeal && !!actions.killTarget;
      const canPoison = witch.hasPoison;

      if (actions.witchPassed) {
        witchDone = true;
      } else {
        const healDone = !canHeal || !!actions.healUsed;
        const poisonDone = !canPoison || !!actions.poisonTarget;
        witchDone = healDone && poisonDone;
      }
    }

    if (wwDone && docDone && seerDone && witchDone) {
      console.log(`[Werewolf Engine] All actions complete. Advancing to day...`);
      this.clearTimer(groupId);
      await this.transitToDay(groupId);
    }
  }

  private async transitToDay(groupId: string) {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game) return;

    let players: Player[] = JSON.parse(game.playersJson);
    const actions: NightActions = JSON.parse(game.nightActionsJson);

    const deadPlayersThisNight: string[] = [];
    let infectAnnounced = false;

    // 1. Resolve Werewolf Kill
    if (actions.killTarget) {
      if (actions.healUsed) {
        // Saved by Witch!
      } else if (actions.killTarget === actions.protectTarget && !(game.gameType === 'wwchaos' && game.activeModifier === 'supermoon')) {
        // Saved by Doctor!
      } else {
        deadPlayersThisNight.push(actions.killTarget);
      }
    }

    // 2. Resolve Black Wolf Infect
    if (actions.infectTarget) {
      const target = players.find(p => p.id === actions.infectTarget);
      if (target && target.isAlive) {
        target.role = 'Werewolf';
        infectAnnounced = true;
        await this.notifyPrivate(
          target.id,
          `💥 *ANDA TELAH TERINFEKSI!* 💥\n\nSerigala Hitam menginfeksi Anda tadi malam. Peran Anda sekarang berubah menjadi *Werewolf*.\nBekerjasamalah dengan kawanan serigala Anda untuk menghabisi warga!`
        );
      }
    }

    // 3. Resolve Witch Poison
    if (actions.poisonTarget) {
      deadPlayersThisNight.push(actions.poisonTarget);
    }

    let reportMsg = '🌅 Pagi hari telah tiba.\n\n';

    if (deadPlayersThisNight.length > 0) {
      for (const deadId of deadPlayersThisNight) {
        const deadPlayer = players.find(p => p.id === deadId)!;
        deadPlayer.isAlive = false;
        reportMsg += `☠️ Berita duka! Semalam @${deadId.split('@')[0]} (${deadPlayer.role}) ditemukan tewas mengenaskan.\n`;
        
        if (deadPlayer.role === 'Hunter') {
          reportMsg += `🎯 @${deadId.split('@')[0]} adalah seorang *Hunter*! Dia memiliki waktu 30 detik untuk membalas menembak mati 1 pemain dengan command: \`/ww kill @username\` di grup ini.\n`;
        }
      }
    } else {
      reportMsg += '🛡️ Luar biasa! Semalam tidak ada korban jiwa.\n';
    }

    if (infectAnnounced) {
      reportMsg += `🌌 Semalam aura kegelapan yang pekat menyelimuti desa... Seseorang tampaknya telah dikutuk/terinfeksi!\n`;
    }

    const isGameOver = this.checkWinCondition(players);
    if (isGameOver) {
      await this.endGame(groupId, players, reportMsg);
      return;
    }

    let activeModifier = 'peaceful_day';
    let chaosAnnounce = '';
    let discussSeconds = deadPlayersThisNight.some(id => players.find(p => p.id === id)?.role === 'Hunter') ? 30 : 180;

    if (game.gameType === 'wwchaos') {
      const dayModifiers = ['solar_eclipse', 'mob_rule', 'peaceful_day'];
      activeModifier = dayModifiers[Math.floor(Math.random() * dayModifiers.length)];
      if (activeModifier === 'solar_eclipse') {
        if (discussSeconds === 180) {
          discussSeconds = 45;
        }
        chaosAnnounce = '\n\n🌞 *CHAOS MODIFIER: Gerhana Matahari (Solar Eclipse)*\nSiang hari menjadi gelap gulita! Waktu diskusi dikurangi menjadi 45 detik.';
      } else if (activeModifier === 'mob_rule') {
        chaosAnnounce = '\n\n⚖️ *CHAOS MODIFIER: Hukum Rimba (Mob Rule)*\nKemarahan warga memuncak! Jika hasil voting berimbang (tie), semua kandidat dengan suara terbanyak akan dieksekusi.';
      } else {
        chaosAnnounce = '\n\n✨ *CHAOS MODIFIER: Siang Damai (Normal)*\nSiang hari ini berlangsung damai tanpa ada modifier.';
      }
    }

    const expiresAt = this.setTimer(groupId, 'day_discuss', discussSeconds);

    await saveGameSession(groupId, {
      phase: 'day_discuss',
      playersJson: JSON.stringify(players),
      votesJson: '{}',
      nightActionsJson: '{}',
      activeModifier,
      expiresAt
    });

    reportMsg += `${chaosAnnounce}\n\nDiskusi dimulai selama ${discussSeconds} detik.`;
    await this.notifyGroup(groupId, reportMsg);
  }

  public async hunterKill(groupId: string, hunterId: string, targetUsername: string): Promise<string> {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game || game.status !== 'playing' || game.phase !== 'day_discuss') {
      throw new Error('Hunter tidak bisa membalas saat ini.');
    }

    let players: Player[] = JSON.parse(game.playersJson);
    const hunter = players.find(p => p.id === hunterId);
    
    if (!hunter || hunter.role !== 'Hunter' || hunter.isAlive) {
      throw new Error('Hanya Hunter yang baru saja mati yang bisa menggunakan skill ini.');
    }

    const actions: NightActions = JSON.parse(game.nightActionsJson);
    if (actions.killTarget) {
      throw new Error('Anda sudah menggunakan tembakan pembalasan.');
    }

    const cleanUsername = targetUsername.replace('@', '').trim().toLowerCase();
    const target = players.find(p => {
      const parts = p.id.split('@');
      return parts[0].toLowerCase() === cleanUsername || p.name.toLowerCase() === cleanUsername;
    });

    if (!target || !target.isAlive) {
      throw new Error('Target tidak ditemukan atau sudah mati.');
    }

    target.isAlive = false;
    actions.killTarget = target.id;

    const isGameOver = this.checkWinCondition(players);
    let msg = `🎯 *Tembakan Terakhir Hunter!* @${hunterId.split('@')[0]} menarik pelatuk dan menembak mati @${target.id.split('@')[0]} (${target.role}).`;

    if (isGameOver) {
      await this.endGame(groupId, players, msg);
    } else {
      this.clearTimer(groupId);
      let resumeSeconds = 180;
      if (game.gameType === 'wwchaos' && game.activeModifier === 'solar_eclipse') {
        resumeSeconds = 45;
      }
      const expiresAt = this.setTimer(groupId, 'day_discuss', resumeSeconds);
      
      await saveGameSession(groupId, {
        playersJson: JSON.stringify(players),
        nightActionsJson: JSON.stringify(actions),
        expiresAt
      });
      
      await this.notifyGroup(groupId, msg + `\n\nDiskusi siang dilanjutkan (${resumeSeconds} detik).`);
    }

    return 'Tembakan pembalasan berhasil dilakukan!';
  }

  private async transitToVoting(groupId: string) {
    const expiresAt = this.setTimer(groupId, 'day_vote', 60);

    await saveGameSession(groupId, {
      phase: 'day_vote',
      expiresAt
    });

    await this.notifyGroup(
      groupId,
      '🗳️ Waktu diskusi habis! Sekarang masuk ke Fase Voting (60 detik).\n\nKetik `/ww vote @username` di grup untuk menunjuk pemain yang mencurigakan.'
    );
  }

  public async castVote(groupId: string, voterId: string, targetUsername: string): Promise<string> {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game || game.status !== 'playing' || game.phase !== 'day_vote') {
      throw new Error('Voting hanya bisa dilakukan pada fase voting.');
    }

    const players: Player[] = JSON.parse(game.playersJson);
    const voter = players.find(p => p.id === voterId);

    if (!voter || !voter.isAlive) {
      throw new Error('Hanya pemain hidup yang bisa memilih.');
    }

    const cleanUsername = targetUsername.replace('@', '').trim().toLowerCase();
    const target = players.find(p => {
      const parts = p.id.split('@');
      return parts[0].toLowerCase() === cleanUsername || p.name.toLowerCase() === cleanUsername;
    });

    if (!target) {
      throw new Error(`Pemain "${targetUsername}" tidak ditemukan.`);
    }

    if (!target.isAlive) {
      throw new Error('Target sudah mati.');
    }

    const votes: Record<string, string> = JSON.parse(game.votesJson);
    votes[voterId] = target.id;

    await saveGameSession(groupId, {
      votesJson: JSON.stringify(votes)
    });

    const aliveCount = players.filter(p => p.isAlive).length;
    const votesCount = Object.keys(votes).length;

    if (votesCount >= aliveCount) {
      console.log(`[Werewolf Engine] All votes cast. Resolving...`);
      this.clearTimer(groupId);
      await this.resolveVoting(groupId);
    }

    return `@${voterId.split('@')[0]} memilih @${target.id.split('@')[0]}. (${votesCount}/${aliveCount} suara)`;
  }

  private async resolveVoting(groupId: string) {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game) return;

    let players: Player[] = JSON.parse(game.playersJson);
    const votes: Record<string, string> = JSON.parse(game.votesJson);

    const voteMap: Record<string, number> = {};
    for (const voterId in votes) {
      const targetId = votes[voterId];
      voteMap[targetId] = (voteMap[targetId] || 0) + 1;
    }

    let maxVotes = 0;
    const candidates: string[] = [];

    for (const targetId in voteMap) {
      const count = voteMap[targetId];
      if (count > maxVotes) {
        maxVotes = count;
        candidates.length = 0;
        candidates.push(targetId);
      } else if (count === maxVotes) {
        candidates.push(targetId);
      }
    }

    const isTie = candidates.length > 1;

    let resultMsg = '🗳️ *Hasil Voting:* \n';
    players.filter(p => p.isAlive).forEach(p => {
      const gotVotes = voteMap[p.id] || 0;
      resultMsg += `- @${p.id.split('@')[0]}: ${gotVotes} suara\n`;
    });

    const executedPlayers: Player[] = [];

    if (maxVotes > 0) {
      if (game.gameType === 'wwchaos' && game.activeModifier === 'mob_rule') {
        for (const targetId of candidates) {
          const victim = players.find(p => p.id === targetId);
          if (victim) {
            victim.isAlive = false;
            executedPlayers.push(victim);
          }
        }
        const executedMentions = executedPlayers.map(p => `@${p.id.split('@')[0]} (${p.role})`).join(', ');
        resultMsg += `\n⚖️ *HUKUM RIMBA (Mob Rule) aktif!* Warga sangat marah dan membakar semua kandidat dengan suara terbanyak: ${executedMentions} hidup-hidup!`;
      } else if (!isTie) {
        const targetToHangId = candidates[0];
        const victim = players.find(p => p.id === targetToHangId);
        if (victim) {
          victim.isAlive = false;
          executedPlayers.push(victim);
          resultMsg += `\n⚖️ Warga sepakat membakar @${targetToHangId.split('@')[0]} hidup-hidup! Dia adalah seorang *${victim.role}*.`;
        }
      } else {
        resultMsg += '\n⚖️ Suara berimbang. Tidak ada warga yang dieksekusi hari ini.';
      }
    } else {
      resultMsg += '\n⚖️ Tidak ada voting. Tidak ada warga yang dieksekusi hari ini.';
    }

    if (executedPlayers.length > 0) {
      const foolVictim = executedPlayers.find(p => p.role === 'Fool');
      if (foolVictim) {
        await this.endGame(groupId, players, resultMsg, 'Fool', foolVictim.id);
        return;
      }
    }

    const isGameOver = this.checkWinCondition(players);
    if (isGameOver) {
      await this.endGame(groupId, players, resultMsg);
      return;
    }

    let activeModifier = 'normal_night';
    let chaosAnnounce = '';
    if (game.gameType === 'wwchaos') {
      const modifiers = ['eclipse', 'supermoon', 'normal_night'];
      activeModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      if (activeModifier === 'eclipse') {
        chaosAnnounce = '\n\n🌌 *CHAOS MODIFIER: Gerhana (Eclipse)*\nKabut tebal menutupi desa! Seer dan Doctor tidak bisa menggunakan kemampuan mereka malam ini.';
      } else if (activeModifier === 'supermoon') {
        chaosAnnounce = '\n\n🌕 *CHAOS MODIFIER: Purnama Raya (Supermoon)*\nWerewolf sangat kuat! Serangan mereka menembus perlindungan Doctor.';
      } else {
        chaosAnnounce = '\n\n✨ *CHAOS MODIFIER: Malam Tenang (Normal)*\nMalam ini berlangsung damai tanpa ada modifier.';
      }
    }

    const expiresAt = this.setTimer(groupId, 'night', 90);

    await saveGameSession(groupId, {
      phase: 'night',
      playersJson: JSON.stringify(players),
      votesJson: '{}',
      nightActionsJson: '{}',
      activeModifier,
      expiresAt
    });

    resultMsg += `${chaosAnnounce}\n\n🌙 Malam hari telah kembali. Werewolf, Seer, dan Doctor, segera hubungi bot untuk beraksi!`;
    await this.notifyGroup(groupId, resultMsg);
  }

  public checkWinCondition(players: Player[]): boolean {
    const wwAlive = players.filter(p => (p.role === 'Werewolf' || p.role === 'BlackWolf') && p.isAlive).length;
    const nonWwAlive = players.filter(p => p.role !== 'Werewolf' && p.role !== 'BlackWolf' && p.role !== 'Fool' && p.isAlive).length;

    if (wwAlive === 0) {
      return true; // Citizens win
    }
    if (wwAlive >= nonWwAlive) {
      return true; // Werewolves win
    }

    return false;
  }

  private async endGame(groupId: string, players: Player[], resultPrefix: string, forceWinner?: 'Citizens' | 'Werewolves' | 'Fool', foolId?: string) {
    this.clearTimer(groupId);

    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const gameType = session?.gameType || 'werewolf';

    let winnerTeam: 'Citizens' | 'Werewolves' | 'Fool' = 'Citizens';
    if (forceWinner) {
      winnerTeam = forceWinner;
    } else {
      const wwAlive = players.filter(p => (p.role === 'Werewolf' || p.role === 'BlackWolf') && p.isAlive).length;
      winnerTeam = wwAlive === 0 ? 'Citizens' : 'Werewolves';
    }

    let finalMsg = `${resultPrefix}\n\n🎉 *Permainan Berakhir! Kemenangan untuk Tim ${winnerTeam === 'Citizens' ? 'Warga (Citizens)' : winnerTeam === 'Werewolves' ? 'Serigala (Werewolf)' : 'Fool (Jester)'}!* 🎉\n\n`;
    finalMsg += '📋 *Peran Semua Pemain:* \n';
    players.forEach(p => {
      finalMsg += `- @${p.id.split('@')[0]}: ${p.role} (${p.isAlive ? '🏆 Hidup' : '💀 Mati'})\n`;
    });

    const rankedStatsPromises: Promise<any>[] = [];
    if (gameType === 'wwranked') {
      finalMsg += '\n📈 *RANKED SEASON MMR UPDATES:* \n';
      for (const p of players) {
        let isWin = false;
        let mmrChange = 0;
        if (winnerTeam === 'Citizens') {
          isWin = (p.role !== 'Werewolf' && p.role !== 'BlackWolf' && p.role !== 'Fool');
          mmrChange = isWin ? 25 : (p.role === 'Fool' ? -10 : -15);
        } else if (winnerTeam === 'Werewolves') {
          isWin = (p.role === 'Werewolf' || p.role === 'BlackWolf');
          mmrChange = isWin ? 30 : (p.role === 'Fool' ? -10 : -15);
        } else if (winnerTeam === 'Fool') {
          isWin = (p.role === 'Fool');
          mmrChange = isWin ? 40 : -10;
        }

        const existing = await prisma.gameStats.findFirst({
          where: { userId: p.id, gameType: 'wwranked', groupId }
        });
        const currentPoints = existing ? existing.points : 0;
        const newPoints = Math.max(0, currentPoints + mmrChange);
        const actualChange = newPoints - currentPoints;

        rankedStatsPromises.push(
          recordGameStats(p.id, groupId, 'wwranked', isWin, actualChange)
            .then(() => {
              const sign = actualChange >= 0 ? '+' : '';
              finalMsg += `- @${p.id.split('@')[0]}: ${sign}${actualChange} MMR (Total: ${newPoints})\n`;
            })
            .catch(err => console.error(`[WW Ranked Stats Fail] for user ${p.id}:`, err))
        );
      }
    }

    if (rankedStatsPromises.length > 0) {
      await Promise.all(rankedStatsPromises);
    }

    const rewardPromises: Promise<any>[] = [];
    players.forEach(p => {
      let coins = 0;
      let xp = 0;
      let isWinner = false;

      if (winnerTeam === 'Citizens') {
        if (p.role !== 'Werewolf' && p.role !== 'BlackWolf' && p.role !== 'Fool') {
          coins = 50;
          xp = 25;
          isWinner = true;
        }
      } else if (winnerTeam === 'Werewolves') {
        if (p.role === 'Werewolf' || p.role === 'BlackWolf') {
          coins = 100;
          xp = 50;
          isWinner = true;
        }
      } else if (winnerTeam === 'Fool') {
        if (p.id === foolId) {
          coins = 150;
          xp = 75;
          isWinner = true;
        }
      }

      if (isWinner) {
        rewardPromises.push(
          prisma.userEconomy.upsert({
            where: { userId: p.id },
            create: { userId: p.id, balance: coins, xp },
            update: { balance: { increment: coins }, xp: { increment: xp } }
          }).catch(err => console.error(`[WW Economy Reward Fail] for user ${p.id}:`, err))
        );
      }
    });

    if (rewardPromises.length > 0) {
      try {
        await Promise.all(rewardPromises);
        finalMsg += `\n💰 *Hadiah koin & XP telah dikreditkan ke profil pemenang!*`;
      } catch (err) {
        console.error('[Werewolf Reward Error]', err);
      }
    }

    await saveGameSession(groupId, {
      status: 'finished',
      playersJson: JSON.stringify(players),
      expiresAt: null
    });

    await this.notifyGroup(groupId, finalMsg);
  }

  public async stopGame(groupId: string, hostId: string, isAdmin = false): Promise<string> {
    const session = await prisma.gameSession.findUnique({ where: { groupId } });
    const game = parseGameSession(session);
    if (!game || game.status === 'finished') {
      throw new Error('Tidak ada game Werewolf aktif yang bisa dihentikan.');
    }

    if (game.hostUserId !== hostId && !isAdmin) {
      throw new Error('Hanya Host pembuat game atau admin grup yang bisa mematikan game.');
    }

    this.clearTimer(groupId);
    await prisma.gameSession.delete({ where: { groupId } });

    return 'Permainan Werewolf berhasil dihentikan paksa.';
  }

  private async notifyGroup(groupId: string, text: string) {
    if (this.callbacks) {
      await this.callbacks.sendGroupMessage(groupId, text);
    }
  }

  private async notifyPrivate(userId: string, text: string) {
    if (this.callbacks) {
      await this.callbacks.sendPrivateMessage(userId, text);
    }
  }
}

export const werewolfEngine = new WerewolfEngine();
export default werewolfEngine;
