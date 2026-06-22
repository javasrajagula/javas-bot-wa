import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../db/client.js';
import { GameRoom, rewardPlayer, recordGameStats, getGameLeaderboard } from '../services/games/game-engine.js';
import { PrdGamesSuiteCommand, activeRooms } from '../commands/games/prd-games.command.js';
import { gameSessionService } from '../services/games/game-session.service.js';

describe('PRD Batch 6 — Game Scaffolding & 5 Simple Games', () => {
  const groupId = 'test-group-batch6@g.us';
  const userId = '628123456789@s.whatsapp.net';
  const otherUserId = '628987654321@s.whatsapp.net';

  let mockAdapter: any;
  let sentMessages: { chatId: string; text: string; options?: any }[] = [];

  beforeAll(async () => {
    // Cleanup databases
    await prisma.userEconomy.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.gameStats.deleteMany({ where: { groupId } });

    mockAdapter = {
      sendMessage: async (chatId: string, text: string, options?: any) => {
        sentMessages.push({ chatId, text, options });
        return { key: { id: 'mock-msg-id-' + Math.random() } };
      }
    };
  });

  afterAll(async () => {
    await prisma.userEconomy.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.gameStats.deleteMany({ where: { groupId } });
    activeRooms.clear();
  });

  const getCtx = (cmdName: string, body: string, isGroup = true, sender = userId): any => ({
    id: `msg-${Math.random()}`,
    chatId: isGroup ? groupId : sender,
    senderId: sender,
    body,
    isGroup,
    command: {
      prefix: '/',
      rawCommandName: cmdName,
      commandName: cmdName,
      args: body.split(/\s+/).slice(1),
      isCommand: cmdName !== ''
    }
  });

  describe('Game Engine Utilities', () => {
    it('manages GameRoom lobby, joins, starts, and cancels', () => {
      const room = new GameRoom({
        id: groupId,
        gameType: 'G999',
        gameName: 'Test Game',
        hostId: userId,
        minPlayers: 2,
        maxPlayers: 4
      });

      expect(room.players).toContain(userId);
      expect(room.status).toBe('lobby');

      // Join
      const joinSuccess = room.join(otherUserId);
      expect(joinSuccess).toBe(true);
      expect(room.players).toContain(otherUserId);

      // Duplicate Join
      const dupJoin = room.join(otherUserId);
      expect(dupJoin).toBe(false);

      // Start
      const startSuccess = room.start();
      expect(startSuccess).toBe(true);
      expect(room.status).toBe('playing');

      // Cancel
      room.cancel();
      expect(room.status).toBe('ended');
    });

    it('manages AFK timers and timeouts', async () => {
      vi.useFakeTimers();
      const room = new GameRoom({
        id: groupId,
        gameType: 'G999',
        gameName: 'Test Game',
        hostId: userId
      });

      let timeoutFired = false;
      room.setAfkTimeout(5000, () => {
        timeoutFired = true;
      });

      // Fast-forward time
      vi.advanceTimersByTime(6000);
      expect(timeoutFired).toBe(true);
      vi.useRealTimers();
    });

    it('records player rewards and leaderboard stats in DB', async () => {
      await rewardPlayer(userId, 100, 50);
      const eco = await prisma.userEconomy.findUnique({ where: { userId } });
      expect(eco?.balance).toBe(100);
      expect(eco?.xp).toBe(50);

      await recordGameStats(userId, groupId, 'G999', true, 10);
      const leaderboard = await getGameLeaderboard('G999');
      expect(leaderboard.length).toBeGreaterThan(0);
      expect(leaderboard[0].userId).toBe(userId);
      expect(leaderboard[0].points).toBe(10);
    });
  });

  describe('5 Implemented Games', () => {
    const gameCmd = new PrdGamesSuiteCommand();

    it('F020 / G020: Wordle Indonesia', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start Game
      const ctxStart = getCtx('wordleindo', '/wordleindo');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('WORDLE INDONESIA');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();
      expect(room?.gameType).toBe('G020');

      // Intercept wrong guess
      sentMessages = [];
      const ctxGuessWrong = getCtx('', 'salah', true, userId);
      const handledWrong = await gameSessionService.handleMessage(ctxGuessWrong, mockAdapter);
      expect(handledWrong).toBe(true);
      expect(sentMessages[0].text).toContain('Sisa kesempatan');

      // Intercept correct guess
      sentMessages = [];
      const target = room?.state.targetWord;
      const ctxGuessCorrect = getCtx('', target, true, userId);
      const handledCorrect = await gameSessionService.handleMessage(ctxGuessCorrect, mockAdapter);
      expect(handledCorrect).toBe(true);
      expect(sentMessages[0].text).toContain('WORDLE SOLVED');
      expect(activeRooms.has(groupId)).toBe(false); // Cleaned up
    });

    it('F021 / G021: Hangman Indonesia', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start Game
      const ctxStart = getCtx('hangmanindo', '/hangmanindo');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('HANGMAN INDONESIA');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();

      // Guess correct letter
      sentMessages = [];
      const target = room?.state.targetWord;
      const correctLetter = target[0];
      const ctxCorrect = getCtx('', correctLetter, true, userId);
      const handledCorrect = await gameSessionService.handleMessage(ctxCorrect, mockAdapter);
      expect(handledCorrect).toBe(true);
      expect(sentMessages[0].text).toContain('benar');

      // Guess wrong letter
      sentMessages = [];
      const ctxWrong = getCtx('', 'z', true, userId); // assume z is not in target
      const handledWrong = await gameSessionService.handleMessage(ctxWrong, mockAdapter);
      expect(handledWrong).toBe(true);
      expect(sentMessages[0].text).toContain('salah');
    });

    it('F022 / G022: Anagram Race', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start Game
      const ctxStart = getCtx('anagramrace', '/anagramrace');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('ANAGRAM RACE');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();

      // Guess correct answer
      sentMessages = [];
      const target = room?.state.targetWord;
      const ctxSolve = getCtx('', target, true, userId);
      const handled = await gameSessionService.handleMessage(ctxSolve, mockAdapter);
      expect(handled).toBe(true);
      expect(sentMessages[0].text).toContain('ANAGRAM RACE TERJAWAB');
    });

    it('F016 / G016: Math Sprint', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start Game
      const ctxStart = getCtx('mathsprint', '/mathsprint');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('MATH SPRINT 60 DETIK');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();

      // Solve question
      sentMessages = [];
      const answer = room?.state.currentAns;
      const ctxSolve = getCtx('', String(answer), true, userId);
      const handled = await gameSessionService.handleMessage(ctxSolve, mockAdapter);
      expect(handled).toBe(true);
      expect(sentMessages[0].text).toContain('Jawaban tepat');
      expect(room?.state.score).toBe(1);
    });

    it('F030 / G030: Suit Tournament', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Create Lobby
      const ctxCreate = getCtx('suittournament', '/suittournament');
      await gameCmd.execute(ctxCreate, ctxCreate.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('SUIT TOURNAMENT LOBBY');

      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();

      // Player join
      sentMessages = [];
      const ctxJoin = getCtx('suittournament', '/suittournament join', true, otherUserId);
      await gameCmd.execute(ctxJoin, ctxJoin.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('bergabung');

      // Start Tournament
      sentMessages = [];
      const ctxStart = getCtx('suittournament', '/suittournament start', true, userId);
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('BABAK 1 SUIT TOURNAMENT');

      // Submit moves via DM/private JID
      sentMessages = [];
      const ctxChoice1 = getCtx('suittournament', '/suittournament pilih batu', false, userId);
      await gameCmd.execute(ctxChoice1, ctxChoice1.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('tersimpan');

      sentMessages = [];
      const ctxChoice2 = getCtx('suittournament', '/suittournament pilih gunting', false, otherUserId);
      await gameCmd.execute(ctxChoice2, ctxChoice2.command.args, mockAdapter);

      // Wait 3200ms for round transition timer
      await new Promise(resolve => setTimeout(resolve, 3200));
      
      // Since batu beats gunting, host (userId) should win the tournament!
      expect(sentMessages.some(m => m.text.includes('🏆 Pemenang Utama:'))).toBe(true);
    });
  });
});
