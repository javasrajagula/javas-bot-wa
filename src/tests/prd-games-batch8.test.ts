import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../db/client.js';
import { GameRoom, rewardPlayer, recordGameStats } from '../services/games/game-engine.js';
import { PrdGamesSuiteCommand, activeRooms, evaluateSafeMath } from '../commands/games/prd-games.command.js';
import { gameSessionService } from '../services/games/game-session.service.js';

describe('PRD Batch 8 — 5 New Games Verification Suite', () => {
  const groupId = 'test-group-batch8@g.us';
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

  const gameCmd = new PrdGamesSuiteCommand();

  describe('G011: Quiz Duel 1v1 (quizduel)', () => {
    it('handles lobby, joins, starts game, processes answers, and evaluates final round', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start lobby
      const ctxStart = getCtx('quizduel', '/quizduel');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('QUIZ DUEL 1v1 LOBBY');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();
      expect(room?.gameType).toBe('G011');
      expect(room?.status).toBe('lobby');

      // Other player joins - should start game automatically
      const ctxJoin = getCtx('quizduel', '/quizduel join', true, otherUserId);
      await gameCmd.execute(ctxJoin, ctxJoin.command.args, mockAdapter);

      expect(room?.status).toBe('playing');
      expect(sentMessages[2].text).toContain('QUIZ DUEL 1v1 — PUTARAN 1/3');

      // Round 1 guesses
      const correctAns = room!.state.currentQuestion.answer.toLowerCase();
      const incorrectAns = correctAns === 'a' ? 'b' : 'a';

      // Player 1 answers correctly
      const ctxAns1 = getCtx('', correctAns, true, userId);
      const handled1 = await gameSessionService.handleMessage(ctxAns1, mockAdapter);
      expect(handled1).toBe(true);

      // Player 2 answers incorrectly
      const ctxAns2 = getCtx('', incorrectAns, true, otherUserId);
      const handled2 = await gameSessionService.handleMessage(ctxAns2, mockAdapter);
      expect(handled2).toBe(true);

      // Since both players answered, evaluateQuizDuelRound should execute and round advances to 2
      expect(room!.state.round).toBe(2);
      expect(room!.state.scores[userId]).toBe(10);
      expect(room!.state.scores[otherUserId]).toBe(0);

      // Play rounds until game over
      room!.state.round = 3;
      const correctAns3 = room!.state.currentQuestion.answer.toLowerCase();
      
      // Let P1 answer to finish game
      room!.state.currentAnswers[userId] = correctAns3;
      room!.state.currentAnswers[otherUserId] = correctAns3;

      // Manually trigger evaluation to verify end state
      await gameCmd.evaluateQuizDuelRound(room!, mockAdapter);
      expect(activeRooms.has(groupId)).toBe(false); // Cleaned up
    });
  });

  describe('G012: Quiz Battle Royale (quizbattleroyale)', () => {
    it('handles lobby, joins, starts, processes BR elimination and co-winners', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start lobby
      const ctxStart = getCtx('quizbattleroyale', '/quizbattleroyale');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('QUIZ BATTLE ROYALE LOBBY');
      const room = activeRooms.get(groupId)!;
      expect(room.status).toBe('lobby');

      // Player 2 joins
      const ctxJoin = getCtx('quizbattleroyale', '/quizbattleroyale join', true, otherUserId);
      await gameCmd.execute(ctxJoin, ctxJoin.command.args, mockAdapter);

      // Start game
      const ctxStartGame = getCtx('quizbattleroyale', '/quizbattleroyale start');
      await gameCmd.execute(ctxStartGame, ctxStartGame.command.args, mockAdapter);

      expect(room.status).toBe('playing');
      expect(room.state.activePlayers.length).toBe(2);

      // Answer correctly for both
      const correctAns = room.state.currentQuestion.answer.toLowerCase();
      const incorrectAns = correctAns === 'a' ? 'b' : 'a';

      room.state.currentAnswers[userId] = correctAns;
      room.state.currentAnswers[otherUserId] = incorrectAns;

      // Evaluate round
      await gameCmd.evaluateQuizBRRound(room, mockAdapter);

      // Player 2 should be eliminated, Player 1 wins the game!
      expect(activeRooms.has(groupId)).toBe(false); // Ended since only 1 survivor
    });
  });

  describe('G004: Detective Case (detective)', () => {
    it('starts detective case, handles guesses, and prevents double guesses', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start case
      const ctxStart = getCtx('detective', '/detective');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('KASUS DETEKTIF BARU DIMULAI');
      const room = activeRooms.get(groupId)!;
      expect(room.gameType).toBe('G004');

      const correctAns = room.state.answer.toLowerCase();
      const incorrectAns = correctAns === 'a' ? 'b' : 'a';

      // Guess incorrectly
      const ctxWrong = getCtx('', incorrectAns);
      const handledWrong = await gameSessionService.handleMessage(ctxWrong, mockAdapter);
      expect(handledWrong).toBe(true);
      expect(sentMessages[1].text).toContain('salah menebak pelaku');

      // Try guessing again (should be ignored due to attempts block)
      const ctxWrong2 = getCtx('', correctAns);
      const handledWrong2 = await gameSessionService.handleMessage(ctxWrong2, mockAdapter);
      expect(handledWrong2).toBe(false); // Ignored since attempts[userId] is true

      // Guess correctly from other player
      const ctxCorrect = getCtx('', correctAns, true, otherUserId);
      const handledCorrect = await gameSessionService.handleMessage(ctxCorrect, mockAdapter);
      expect(handledCorrect).toBe(true);
      expect(sentMessages[2].text).toContain('KASUS TERPECAHKAN');
      expect(activeRooms.has(groupId)).toBe(false);
    });
  });

  describe('G006: Treasure Hunt (treasure)', () => {
    it('starts treasure hunt, handles raw chat guesses', async () => {
      sentMessages = [];
      activeRooms.clear();

      const ctxStart = getCtx('treasure', '/treasure');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('PERBURUAN HARTA KARUN DIMULAI');
      const room = activeRooms.get(groupId)!;

      const correctAns = room.state.answer.toLowerCase();

      // Guess wrong
      const ctxWrong = getCtx('', 'random-wrong-word');
      const handledWrong = await gameSessionService.handleMessage(ctxWrong, mockAdapter);
      expect(handledWrong).toBe(false); // normal chat

      // Guess correct
      const ctxCorrect = getCtx('', correctAns);
      const handledCorrect = await gameSessionService.handleMessage(ctxCorrect, mockAdapter);
      expect(handledCorrect).toBe(true);
      expect(sentMessages[1].text).toContain('HARTA KARUN DITEMUKAN');
      expect(activeRooms.has(groupId)).toBe(false);
    });
  });

  describe('G018: Puzzle Angka 24 (puzzle24)', () => {
    it('evaluates safe math expressions correctly', () => {
      expect(evaluateSafeMath('8 / (3 - (8 / 3))')).toBeCloseTo(24);
      expect(evaluateSafeMath('(10 * 10 - 4) / 4')).toBe(24);
      expect(evaluateSafeMath('5 * (5 - 1 / 5)')).toBeCloseTo(24);
      expect(() => evaluateSafeMath('invalid string')).toThrow();
    });

    it('starts game, validates numbers set, and evaluates solutions', async () => {
      sentMessages = [];
      activeRooms.clear();

      const ctxStart = getCtx('puzzle24', '/puzzle24');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('PUZZLE ANGKA 24');
      const room = activeRooms.get(groupId)!;

      // Guess with wrong numbers
      const ctxWrongNums = getCtx('', '10 + 10 + 4');
      const handledWrongNums = await gameSessionService.handleMessage(ctxWrongNums, mockAdapter);
      expect(handledWrongNums).toBe(true);
      expect(sentMessages[1].text).toContain('angka yang digunakan harus sama persis');

      // Guess with correct numbers but wrong result
      const nums = room.state.numbers;
      const wrongExpr = `${nums[0]} + ${nums[1]} + ${nums[2]} + ${nums[3]}`;
      const ctxWrongResult = getCtx('', wrongExpr);
      const handledWrongResult = await gameSessionService.handleMessage(ctxWrongResult, mockAdapter);
      expect(handledWrongResult).toBe(true);
      expect(sentMessages[2].text).toContain('bukan 24');

      // Solve with correct solution
      const correctExpr = room.state.solution;
      const ctxCorrect = getCtx('', correctExpr);
      const handledCorrect = await gameSessionService.handleMessage(ctxCorrect, mockAdapter);
      expect(handledCorrect).toBe(true);
      expect(sentMessages[3].text).toContain('PUZZLE 24 BERHASIL DIPECAHKAN');
      expect(activeRooms.has(groupId)).toBe(false);
    });
  });
});
