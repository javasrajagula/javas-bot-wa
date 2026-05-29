import prisma from '../../db/client.js';

export type Role = 'Werewolf' | 'Seer' | 'Doctor' | 'Hunter' | 'Villager';
export type Phase = 'lobby' | 'night' | 'day_discuss' | 'day_vote';
export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  isAlive: boolean;
  role: Role;
}

export interface Vote {
  voterId: string;
  targetId: string;
}

export interface NightActions {
  killTarget?: string;
  protectTarget?: string;
  checkTarget?: string;
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
}

function parseGameSession(session: any): WerewolfGameData | null {
  if (!session) return null;
  let state = {
    phase: 'lobby',
    hostUserId: '',
    rolesJson: '{}',
    votesJson: '{}',
    nightActionsJson: '{}'
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
    nightActionsJson: state.nightActionsJson || '{}'
  };
}

async function saveGameSession(groupId: string, data: Partial<WerewolfGameData>) {
  const existing = await prisma.gameSession.findUnique({ where: { groupId } });
  let state = existing ? JSON.parse(existing.stateJson || '{}') : {};
  
  if (data.phase !== undefined) state.phase = data.phase;
  if (data.hostUserId !== undefined) state.hostUserId = data.hostUserId;
  if (data.rolesJson !== undefined) state.rolesJson = data.rolesJson;
  if (data.votesJson !== undefined) state.votesJson = data.votesJson;
  if (data.nightActionsJson !== undefined) state.nightActionsJson = data.nightActionsJson;

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

async function createGameSession(groupId: string, hostId: string, hostName: string, expiresAt: Date) {
  const players = [{ id: hostId, name: hostName, isAlive: true, role: 'Villager' }];
  const state = {
    phase: 'lobby',
    hostUserId: hostId,
    rolesJson: '{}',
    votesJson: '{}',
    nightActionsJson: '{}'
  };
  return prisma.gameSession.upsert({
    where: { groupId },
    create: {
      groupId,
      gameType: 'werewolf',
      status: 'lobby',
      playersJson: JSON.stringify(players),
      stateJson: JSON.stringify(state),
      expiresAt
    },
    update: {
      gameType: 'werewolf',
      status: 'lobby',
      playersJson: JSON.stringify(players),
      stateJson: JSON.stringify(state),
      expiresAt
    }
  });
}

class WerewolfEngine {
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private callbacks?: WerewolfNotificationCallbacks;

  public setNotificationCallbacks(callbacks: WerewolfNotificationCallbacks) {
    this.callbacks = callbacks;
  }

  public async boot(): Promise<void> {
    const activeGames = await prisma.gameSession.findMany({
      where: { gameType: 'werewolf', status: { in: ['lobby', 'playing'] } }
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
      where: { gameType: 'werewolf', status: 'playing' }
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

  public async createLobby(groupId: string, hostId: string, hostName: string): Promise<string> {
    const existing = await prisma.gameSession.findUnique({ where: { groupId } });
    if (existing && existing.status !== 'finished') {
      throw new Error('Sudah ada game Werewolf yang aktif di grup ini.');
    }

    const expiresAt = this.setTimer(groupId, 'lobby', 300); // 5 minutes lobby
    await createGameSession(groupId, hostId, hostName, expiresAt);

    return 'Lobby Werewolf berhasil dibuat! Ketik `/ww join` untuk bergabung. Minimal 5 pemain, maksimal 10.';
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

    const roles: Role[] = [];
    let wwCount = count >= 10 ? 3 : (count >= 7 ? 2 : 1);
    let hasHunter = count >= 8;

    for (let i = 0; i < wwCount; i++) roles.push('Werewolf');
    roles.push('Seer');
    roles.push('Doctor');
    if (hasHunter) roles.push('Hunter');
    while (roles.length < count) {
      roles.push('Villager');
    }

    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    players.forEach((p, idx) => {
      p.role = roles[idx];
    });

    const expiresAt = this.setTimer(groupId, 'night', 90);

    await saveGameSession(groupId, {
      status: 'playing',
      phase: 'night',
      playersJson: JSON.stringify(players),
      expiresAt
    });

    await this.notifyGroup(groupId, '🐺 Game Werewolf dimulai! Hari berganti Malam.\n\nBot telah mengirimkan peran ke Chat Pribadi masing-masing pemain.\nFase malam berlangsung selama 90 detik. Gunakan kemampuan Anda segera!');

    for (const p of players) {
      let roleMsg = `ℹ️ Peran Anda dalam game di grup: *${p.role}*\n`;
      if (p.role === 'Werewolf') {
        const team = players.filter(ot => ot.role === 'Werewolf' && ot.id !== p.id).map(ot => `@${ot.id.split('@')[0]}`).join(', ');
        roleMsg += `Tugas Anda: Habisi warga saat malam hari.`;
        if (team) roleMsg += `\nKawan Werewolf Anda: ${team}`;
        roleMsg += `\n\nUntuk membunuh, balas chat bot ini dengan: \`/ww kill @username\``;
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
    action: 'kill' | 'protect' | 'check',
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

    if (action === 'kill' && actor.role !== 'Werewolf') {
      throw new Error('Hanya Werewolf yang bisa membunuh.');
    }
    if (action === 'protect' && actor.role !== 'Doctor') {
      throw new Error('Hanya Doctor yang bisa menyembuhkan.');
    }
    if (action === 'check' && actor.role !== 'Seer') {
      throw new Error('Hanya Seer yang bisa menerawang.');
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

    const actions: NightActions = JSON.parse(game.nightActionsJson);

    if (action === 'kill') {
      actions.killTarget = target.id;
    } else if (action === 'protect') {
      actions.protectTarget = target.id;
    } else if (action === 'check') {
      actions.checkTarget = target.id;
    }

    await saveGameSession(groupId, {
      nightActionsJson: JSON.stringify(actions)
    });

    await this.checkAllNightActionsDone(groupId, players, actions);

    if (action === 'check') {
      return `🔮 Hasil teropong: @${target.id.split('@')[0]} adalah *${target.role === 'Werewolf' ? 'Werewolf' : 'Warga Baik/Spesial'}*.`;
    }

    return `Aksi malam berhasil direkam.`;
  }

  private async checkAllNightActionsDone(groupId: string, players: Player[], actions: NightActions) {
    const hasWwAlive = players.some(p => p.role === 'Werewolf' && p.isAlive);
    const hasDocAlive = players.some(p => p.role === 'Doctor' && p.isAlive);
    const hasSeerAlive = players.some(p => p.role === 'Seer' && p.isAlive);

    const wwDone = !hasWwAlive || !!actions.killTarget;
    const docDone = !hasDocAlive || !!actions.protectTarget;
    const seerDone = !hasSeerAlive || !!actions.checkTarget;

    if (wwDone && docDone && seerDone) {
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

    let deadPlayerId: string | null = null;
    if (actions.killTarget && actions.killTarget !== actions.protectTarget) {
      deadPlayerId = actions.killTarget;
    }

    let reportMsg = '🌅 Pagi hari telah tiba.\n\n';

    if (deadPlayerId) {
      const deadPlayer = players.find(p => p.id === deadPlayerId)!;
      deadPlayer.isAlive = false;
      reportMsg += `☠️ Berita duka! Semalam @${deadPlayerId.split('@')[0]} (${deadPlayer.role}) telah dicabik-cabik oleh serigala.`;
      
      if (deadPlayer.role === 'Hunter') {
        reportMsg += `\n\n🎯 @${deadPlayerId.split('@')[0]} adalah seorang *Hunter*! Dia memiliki waktu 30 detik untuk membalas menembak mati 1 pemain dengan command: \`/ww kill @username\` di grup ini.`;
      }
    } else {
      reportMsg += '🛡️ Luar biasa! Semalam tidak ada korban jiwa.';
    }

    const isGameOver = this.checkWinCondition(players);
    if (isGameOver) {
      await this.endGame(groupId, players, reportMsg);
      return;
    }

    const discussSeconds = deadPlayerId && players.find(p => p.id === deadPlayerId)?.role === 'Hunter' ? 30 : 180;
    const expiresAt = this.setTimer(groupId, 'day_discuss', discussSeconds);

    await saveGameSession(groupId, {
      phase: 'day_discuss',
      playersJson: JSON.stringify(players),
      votesJson: '{}',
      nightActionsJson: '{}',
      expiresAt
    });

    reportMsg += `\n\nDiskusi dimulai selama ${discussSeconds} detik.`;
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
      const expiresAt = this.setTimer(groupId, 'day_discuss', 180);
      
      await saveGameSession(groupId, {
        playersJson: JSON.stringify(players),
        nightActionsJson: JSON.stringify(actions),
        expiresAt
      });
      
      await this.notifyGroup(groupId, msg + '\n\nDiskusi siang dilanjutkan (180 detik).');
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
    let targetToHangId: string | null = null;
    let isTie = false;

    for (const targetId in voteMap) {
      const count = voteMap[targetId];
      if (count > maxVotes) {
        maxVotes = count;
        targetToHangId = targetId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    }

    let resultMsg = '🗳️ *Hasil Voting:* \n';
    players.filter(p => p.isAlive).forEach(p => {
      const gotVotes = voteMap[p.id] || 0;
      resultMsg += `- @${p.id.split('@')[0]}: ${gotVotes} suara\n`;
    });

    if (targetToHangId && !isTie) {
      const victim = players.find(p => p.id === targetToHangId)!;
      victim.isAlive = false;
      resultMsg += `\n⚖️ Warga sepakat membakar @${targetToHangId.split('@')[0]} hidup-hidup! Dia adalah seorang *${victim.role}*.`;
    } else {
      resultMsg += '\n⚖️ Suara berimbang atau tidak ada voting. Tidak ada warga yang dieksekusi hari ini.';
    }

    const isGameOver = this.checkWinCondition(players);
    if (isGameOver) {
      await this.endGame(groupId, players, resultMsg);
      return;
    }

    const expiresAt = this.setTimer(groupId, 'night', 90);

    await saveGameSession(groupId, {
      phase: 'night',
      playersJson: JSON.stringify(players),
      votesJson: '{}',
      nightActionsJson: '{}',
      expiresAt
    });

    resultMsg += '\n\n🌙 Malam hari telah kembali. Werewolf, Seer, dan Doctor, segera hubungi bot untuk beraksi!';
    await this.notifyGroup(groupId, resultMsg);
  }

  public checkWinCondition(players: Player[]): boolean {
    const wwAlive = players.filter(p => p.role === 'Werewolf' && p.isAlive).length;
    const nonWwAlive = players.filter(p => p.role !== 'Werewolf' && p.isAlive).length;

    if (wwAlive === 0) {
      return true; // Villagers win
    }
    if (wwAlive >= nonWwAlive) {
      return true; // Werewolves win
    }

    return false;
  }

  private async endGame(groupId: string, players: Player[], resultPrefix: string) {
    this.clearTimer(groupId);

    const wwAlive = players.filter(p => p.role === 'Werewolf' && p.isAlive).length;
    const winnerTeam = wwAlive === 0 ? 'Warga' : 'Werewolf';

    let finalMsg = `${resultPrefix}\n\n🎉 *Permainan Berakhir! Kemenangan untuk Tim ${winnerTeam}!* 🎉\n\n`;
    finalMsg += '📋 *Peran Semua Pemain:* \n';
    players.forEach(p => {
      finalMsg += `- @${p.id.split('@')[0]}: ${p.role} (${p.isAlive ? '🏆 Hidup' : '💀 Mati'})\n`;
    });

    await saveGameSession(groupId, {
      status: 'finished',
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
