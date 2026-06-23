import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import prisma from '../db/client.js';
import { werewolfEngine, Player } from '../services/werewolf/werewolf.engine.js';
import { PrdGamesSuiteCommand } from '../commands/games/prd-games.command.js';
import { commandRegistry } from '../commands/registry/command-registry.js';

describe('Werewolf Chaos Mode (G001) & Ranked Season (G002) Upgrades', () => {
  const groupId = 'test-group-ww-upgrades@g.us';
  const playerIds = [
    'p1@s.whatsapp.net',
    'p2@s.whatsapp.net',
    'p3@s.whatsapp.net',
    'p4@s.whatsapp.net',
    'p5@s.whatsapp.net'
  ];

  let mockAdapter: any;
  let sentMessages: { chatId: string; text: string; options?: any }[] = [];
  let sentPrivateMessages: { userId: string; text: string }[] = [];

  beforeAll(async () => {
    // Reset/Setup database
    await prisma.gameSession.deleteMany({ where: { groupId } });
    await prisma.gameStats.deleteMany({ where: { userId: { in: playerIds } } });
    await prisma.userEconomy.deleteMany({ where: { userId: { in: playerIds } } });

    // Set engine callbacks to mock adapter
    werewolfEngine.setNotificationCallbacks({
      sendGroupMessage: async (gid, text) => {
        sentMessages.push({ chatId: gid, text });
      },
      sendPrivateMessage: async (uid, text) => {
        sentPrivateMessages.push({ userId: uid, text });
      }
    });

    mockAdapter = {
      sendMessage: async (chatId: string, text: string, options?: any) => {
        sentMessages.push({ chatId, text, options });
        return { key: { id: 'mock-msg-' + Math.random() } };
      }
    };
  });

  afterAll(async () => {
    await prisma.gameSession.deleteMany({ where: { groupId } });
    await prisma.gameStats.deleteMany({ where: { userId: { in: playerIds } } });
    await prisma.userEconomy.deleteMany({ where: { userId: { in: playerIds } } });
  });

  const getCtx = (cmdName: string, args: string[], sender = 'p1@s.whatsapp.net'): any => ({
    id: `msg-${Math.random()}`,
    chatId: groupId,
    senderId: sender,
    senderName: 'Player ' + sender.split('@')[0],
    body: `/${cmdName} ${args.join(' ')}`,
    isGroup: true,
    command: {
      prefix: '/',
      rawCommandName: cmdName,
      commandName: cmdName,
      args,
      isCommand: true
    }
  });

  describe('Chaos Mode (G001)', () => {
    it('creates G001 lobby, joins players, and initializes chaos game', async () => {
      sentMessages = [];
      const gameCmd = new PrdGamesSuiteCommand();

      // Create G001 lobby
      const ctxCreate = getCtx('wwchaos', []);
      await gameCmd.execute(ctxCreate, [], mockAdapter);

      expect(sentMessages[0].text).toContain('Lobby Werewolf Chaos Mode berhasil dibuat');

      // Check session
      const session = await werewolfEngine.getGame(groupId);
      expect(session).toBeDefined();
      expect(session?.gameType).toBe('wwchaos');
      expect(session?.status).toBe('lobby');

      // Join remaining players
      for (let i = 1; i < playerIds.length; i++) {
        const res = await werewolfEngine.joinGame(groupId, playerIds[i], 'Player ' + i);
        expect(res).toContain('bergabung');
      }

      // Start game
      await werewolfEngine.startGame(groupId, 'p1@s.whatsapp.net');

      const playingSession = await werewolfEngine.getGame(groupId);
      expect(playingSession?.status).toBe('playing');
      expect(playingSession?.phase).toBe('night');
      expect(playingSession?.activeModifier).toBeDefined();
    });

    it('blocks Doctor/Seer actions during Eclipse modifier', async () => {
      // Force eclipse modifier
      const session = await prisma.gameSession.findUnique({ where: { groupId } });
      const state = JSON.parse(session!.stateJson);
      state.activeModifier = 'eclipse';
      state.phase = 'night';
      
      const players: Player[] = [
        { id: 'p1@s.whatsapp.net', name: 'p1', role: 'Werewolf', isAlive: true },
        { id: 'p2@s.whatsapp.net', name: 'p2', role: 'Seer', isAlive: true },
        { id: 'p3@s.whatsapp.net', name: 'p3', role: 'Doctor', isAlive: true },
        { id: 'p4@s.whatsapp.net', name: 'p4', role: 'Witch', isAlive: true, hasHeal: true, hasPoison: true },
        { id: 'p5@s.whatsapp.net', name: 'p5', role: 'Villager', isAlive: true }
      ];

      await prisma.gameSession.update({
        where: { groupId },
        data: {
          playersJson: JSON.stringify(players),
          stateJson: JSON.stringify(state),
          status: 'playing'
        }
      });

      // Seer check should throw error
      await expect(
        werewolfEngine.setNightAction(groupId, 'check', 'p2@s.whatsapp.net', '@p5')
      ).rejects.toThrow('Gerhana Bulan (Eclipse)');

      // Doctor protect should throw error
      await expect(
        werewolfEngine.setNightAction(groupId, 'protect', 'p3@s.whatsapp.net', '@p5')
      ).rejects.toThrow('Gerhana Bulan (Eclipse)');

      // Werewolf action should still be allowed
      const wwActionRes = await werewolfEngine.setNightAction(groupId, 'kill', 'p1@s.whatsapp.net', '@p5');
      expect(wwActionRes).toBe('Aksi malam berhasil direkam.');
    });

    it('bypasses Doctor shield during Supermoon modifier', async () => {
      // Force supermoon modifier
      const session = await prisma.gameSession.findUnique({ where: { groupId } });
      const state = JSON.parse(session!.stateJson);
      state.activeModifier = 'supermoon';
      state.phase = 'night';

      const players: Player[] = [
        { id: 'p1@s.whatsapp.net', name: 'p1', role: 'Werewolf', isAlive: true },
        { id: 'p2@s.whatsapp.net', name: 'p2', role: 'Seer', isAlive: true },
        { id: 'p3@s.whatsapp.net', name: 'p3', role: 'Doctor', isAlive: true },
        { id: 'p4@s.whatsapp.net', name: 'p4', role: 'Witch', isAlive: true, hasHeal: true, hasPoison: true },
        { id: 'p5@s.whatsapp.net', name: 'p5', role: 'Villager', isAlive: true }
      ];

      state.nightActionsJson = '{}';

      await prisma.gameSession.update({
        where: { groupId },
        data: {
          playersJson: JSON.stringify(players),
          stateJson: JSON.stringify(state),
          status: 'playing'
        }
      });

      // WW kills p5, Doctor protects p5
      await werewolfEngine.setNightAction(groupId, 'kill', 'p1@s.whatsapp.net', '@p5');
      await werewolfEngine.setNightAction(groupId, 'protect', 'p3@s.whatsapp.net', '@p5');
      await werewolfEngine.setNightAction(groupId, 'check', 'p2@s.whatsapp.net', '@p1');
      
      // Witch passes to advance night
      sentMessages = [];
      await werewolfEngine.setNightAction(groupId, 'pass', 'p4@s.whatsapp.net', '');

      // Assert p5 is dead (since Supermoon bypassed protect)
      const updated = await werewolfEngine.getGame(groupId);
      const updatedPlayers: Player[] = JSON.parse(updated!.playersJson);
      const p5 = updatedPlayers.find(p => p.id === 'p5@s.whatsapp.net');
      expect(p5?.isAlive).toBe(false);
      expect(sentMessages.some(m => m.text.includes('@p5') && m.text.includes('tewas'))).toBe(true);
    });

    it('executes all tied candidates during Mob Rule modifier', async () => {
      // Setup day vote phase with Mob Rule active
      const session = await prisma.gameSession.findUnique({ where: { groupId } });
      const state = JSON.parse(session!.stateJson);
      state.activeModifier = 'mob_rule';
      state.phase = 'day_vote';

      // Live players: p1, p2, p3, p4
      const players: Player[] = [
        { id: 'p1@s.whatsapp.net', name: 'p1', role: 'Werewolf', isAlive: true },
        { id: 'p2@s.whatsapp.net', name: 'p2', role: 'Seer', isAlive: true },
        { id: 'p3@s.whatsapp.net', name: 'p3', role: 'Doctor', isAlive: true },
        { id: 'p4@s.whatsapp.net', name: 'p4', role: 'Witch', isAlive: true },
        { id: 'p5@s.whatsapp.net', name: 'p5', role: 'Villager', isAlive: false }
      ];

      state.votesJson = '{}';

      await prisma.gameSession.update({
        where: { groupId },
        data: {
          playersJson: JSON.stringify(players),
          stateJson: JSON.stringify(state),
          status: 'playing'
        }
      });

      // 2 votes for p1, 2 votes for p2 (TIE!)
      await werewolfEngine.castVote(groupId, 'p1@s.whatsapp.net', '@p2');
      await werewolfEngine.castVote(groupId, 'p3@s.whatsapp.net', '@p2');
      await werewolfEngine.castVote(groupId, 'p2@s.whatsapp.net', '@p1');
      
      sentMessages = [];
      await werewolfEngine.castVote(groupId, 'p4@s.whatsapp.net', '@p1'); // completes voting

      // Assert both p1 and p2 are executed
      const updated = await werewolfEngine.getGame(groupId);
      const updatedPlayers: Player[] = JSON.parse(updated!.playersJson);
      const p1 = updatedPlayers.find(p => p.id === 'p1@s.whatsapp.net');
      const p2 = updatedPlayers.find(p => p.id === 'p2@s.whatsapp.net');

      expect(p1?.isAlive).toBe(false);
      expect(p2?.isAlive).toBe(false);
      expect(sentMessages.some(m => m.text.includes('HUKUM RIMBA (Mob Rule) aktif'))).toBe(true);
    });
  });

  describe('Ranked Season (G002)', () => {
    it('creates G002 lobby and records clamped MMR points on endgame', async () => {
      // Cleanup first to avoid active session conflict
      await prisma.gameSession.deleteMany({ where: { groupId } });
      await prisma.gameStats.deleteMany({ where: { userId: { in: playerIds } } });

      // 1. Create ranked lobby
      sentMessages = [];
      const gameCmd = new PrdGamesSuiteCommand();
      const ctxCreate = getCtx('wwranked', []);
      await gameCmd.execute(ctxCreate, [], mockAdapter);
      expect(sentMessages[0].text).toContain('Lobby Werewolf Ranked Season berhasil dibuat');

      // Setup initial MMR ratings in db:
      // p1 starts with 10 MMR
      // p2 starts with 5 MMR
      // p3 starts with 100 MMR
      // p4 starts with 0 MMR
      await prisma.gameStats.create({ data: { userId: 'p1@s.whatsapp.net', gameType: 'wwranked', groupId, points: 10, wins: 1 } });
      await prisma.gameStats.create({ data: { userId: 'p2@s.whatsapp.net', gameType: 'wwranked', groupId, points: 5, wins: 0 } });
      await prisma.gameStats.create({ data: { userId: 'p3@s.whatsapp.net', gameType: 'wwranked', groupId, points: 100, wins: 5 } });
      await prisma.gameStats.create({ data: { userId: 'p4@s.whatsapp.net', gameType: 'wwranked', groupId, points: 0, wins: 0 } });

      // Join remaining players (skipping p1 who is host)
      for (let i = 1; i < playerIds.length; i++) {
        await werewolfEngine.joinGame(groupId, playerIds[i], 'Player ' + playerIds[i].split('@')[0]);
      }

      // Start game
      await werewolfEngine.startGame(groupId, 'p1@s.whatsapp.net');

      // Setup roles for endgame test
      const players: Player[] = [
        { id: 'p1@s.whatsapp.net', name: 'p1', role: 'Werewolf', isAlive: true },
        { id: 'p2@s.whatsapp.net', name: 'p2', role: 'Villager', isAlive: true },
        { id: 'p3@s.whatsapp.net', name: 'p3', role: 'Seer', isAlive: true },
        { id: 'p4@s.whatsapp.net', name: 'p4', role: 'Fool', isAlive: true },
        { id: 'p5@s.whatsapp.net', name: 'p5', role: 'Doctor', isAlive: true }
      ];

      // Save modified session
      const session = await prisma.gameSession.findUnique({ where: { groupId } });
      const state = JSON.parse(session!.stateJson);
      state.phase = 'day_vote';
      await prisma.gameSession.update({
        where: { groupId },
        data: {
          playersJson: JSON.stringify(players),
          stateJson: JSON.stringify(state)
        }
      });

      // 2. Trigger Citizens win
      sentMessages = [];
      await werewolfEngine['endGame'](groupId, players, 'Citizens win!', 'Citizens');

      // Assert MMR modifications:
      // Citizens: p2 (Villager), p3 (Seer), p5 (Doctor) gain +25 MMR
      // Werewolves: p1 (Werewolf) loses -15 MMR (clamped from 10 to 0, so -10 actual)
      // Fool: p4 (Fool) loses -10 MMR (clamped from 0 to 0, so 0 actual)

      const p1MMR = await prisma.gameStats.findFirst({ where: { userId: 'p1@s.whatsapp.net', gameType: 'wwranked', groupId } });
      const p2MMR = await prisma.gameStats.findFirst({ where: { userId: 'p2@s.whatsapp.net', gameType: 'wwranked', groupId } });
      const p3MMR = await prisma.gameStats.findFirst({ where: { userId: 'p3@s.whatsapp.net', gameType: 'wwranked', groupId } });
      const p4MMR = await prisma.gameStats.findFirst({ where: { userId: 'p4@s.whatsapp.net', gameType: 'wwranked', groupId } });
      const p5MMR = await prisma.gameStats.findFirst({ where: { userId: 'p5@s.whatsapp.net', gameType: 'wwranked', groupId } });

      expect(p1MMR?.points).toBe(0); // 10 - 15 = -5 -> clamped to 0
      expect(p2MMR?.points).toBe(30); // 5 + 25 = 30
      expect(p3MMR?.points).toBe(125); // 100 + 25 = 125
      expect(p4MMR?.points).toBe(0); // 0 - 10 = -10 -> clamped to 0
      expect(p5MMR?.points).toBe(25); // 0 + 25 = 25 (initial undefined -> starts at 0 + 25)

      expect(sentMessages[0].text).toContain('RANKED SEASON MMR UPDATES');
      expect(sentMessages[0].text).toContain('-10 MMR'); // p1 clamped reduction
      expect(sentMessages[0].text).toContain('+25 MMR');
    });
  });
});
