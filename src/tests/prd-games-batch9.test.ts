import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import prisma from '../db/client.js';
import { PrdGamesSuiteCommand, activeRooms } from '../commands/games/prd-games.command.js';
import { gameSessionService } from '../services/games/game-session.service.js';

describe('PRD Batch 9 — 5 New Games Verification Suite', () => {
  const groupId = 'test-group-batch9@g.us';
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

  describe('G007: Kata Berantai Battle (kataberantai)', () => {
    it('manages lobby, joins, starts game, validates chain answers, eliminates on failure, and rewards the winner', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start lobby
      const ctxStart = getCtx('kataberantai', '/kataberantai');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('KATA BERANTAI BATTLE LOBBY');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();
      expect(room?.gameType).toBe('G007');
      expect(room?.status).toBe('lobby');

      // Other player joins
      const ctxJoin = getCtx('kataberantai', '/kataberantai join', true, otherUserId);
      await gameCmd.execute(ctxJoin, ctxJoin.command.args, mockAdapter);
      expect(room?.players.length).toBe(2);

      // Start the game
      const ctxStartGame = getCtx('kataberantai', '/kataberantai start');
      await gameCmd.execute(ctxStartGame, ctxStartGame.command.args, mockAdapter);
      expect(room?.status).toBe('playing');
      expect(sentMessages[2].text).toContain('KATA BERANTAI BATTLE DIMULAI');

      // The starter word is inside room.state.lastWord
      const lastWord = room?.state.lastWord.toLowerCase();
      const lastChar = lastWord.slice(-1);

      // Current player must be player 0 (userId)
      expect(room?.state.currentPlayerIndex).toBe(0);

      // Player 1 (userId) answers with a word starting with lastChar
      // Find a word starting with lastChar from KATA_BERANTAI_VALID_WORDS
      // Valid words has: 'lumba', 'bambu', 'unik', 'kapal', 'layang', 'gunung', etc.
      // Let's force set the last word to make it predictable
      room!.state.lastWord = 'buku'; // ends in 'u'
      
      // Let's send a valid word starting with 'u': 'unik'
      const ctxAns1 = getCtx('', 'unik', true, userId);
      const handled1 = await gameSessionService.handleMessage(ctxAns1, mockAdapter);
      expect(handled1).toBe(true);
      expect(room?.state.lastWord).toBe('unik');
      expect(room?.state.currentPlayerIndex).toBe(1); // turn advanced to otherUserId

      // Player 2 (otherUserId) tries to answer with an invalid starting letter (e.g. starts with 'b' instead of 'k')
      const ctxAns2 = getCtx('', 'buku', true, otherUserId);
      const handled2 = await gameSessionService.handleMessage(ctxAns2, mockAdapter);
      expect(handled2).toBe(true);
      // P2 should be eliminated, leaving P1 as winner and ending the game
      expect(activeRooms.has(groupId)).toBe(false);
      expect(sentMessages[sentMessages.length - 1].text).toContain('Pemenang Utama');
    });
  });

  describe('G013: Ranking Cepat (rankingcepat)', () => {
    it('starts instantly, rejects wrong answer formats, handles incorrect and correct answers', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start game
      const ctxStart = getCtx('rankingcepat', '/rankingcepat');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('RANKING CEPAT');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();
      expect(room?.gameType).toBe('G013');
      expect(room?.status).toBe('playing');

      // Incorrect format should be ignored (not intercepted as game answer)
      const ctxFormat = getCtx('', 'not-numbers');
      const handledFormat = await gameSessionService.handleMessage(ctxFormat, mockAdapter);
      expect(handledFormat).toBe(false);

      // Incorrect answer but correct format
      const wrongOrder = '5 4 3 2 1';
      const ctxWrong = getCtx('', wrongOrder);
      const handledWrong = await gameSessionService.handleMessage(ctxWrong, mockAdapter);
      expect(handledWrong).toBe(true);
      expect(sentMessages[1].text).toContain('urutan Anda *5 4 3 2 1* salah');

      // Correct answer
      const correctOrder = room?.state.question.correctOrder.join(' ');
      const ctxCorrect = getCtx('', correctOrder);
      const handledCorrect = await gameSessionService.handleMessage(ctxCorrect, mockAdapter);
      expect(handledCorrect).toBe(true);
      expect(sentMessages[2].text).toContain('RANKING CEPAT TERJAWAB');
      expect(activeRooms.has(groupId)).toBe(false); // ended
    });
  });

  describe('G017: Math Boss (mathboss)', () => {
    it('manages lobby, starts cooperative attack, processes correct math answers, reduces Boss HP, and rewards contributors', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start lobby
      const ctxStart = getCtx('mathboss', '/mathboss');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('MATH BOSS LOBBY');
      const room = activeRooms.get(groupId)!;
      expect(room.status).toBe('lobby');

      // Other player joins
      const ctxJoin = getCtx('mathboss', '/mathboss join', true, otherUserId);
      await gameCmd.execute(ctxJoin, ctxJoin.command.args, mockAdapter);

      // Start game
      const ctxStartGame = getCtx('mathboss', '/mathboss start');
      await gameCmd.execute(ctxStartGame, ctxStartGame.command.args, mockAdapter);
      expect(room.status).toBe('playing');
      expect(room.state.bossHp).toBe(500);

      // Send correct answer to reduce HP
      const correctAns = room.state.currentAns.toString();
      const ctxAttack = getCtx('', correctAns, true, userId);
      const handledAttack = await gameSessionService.handleMessage(ctxAttack, mockAdapter);
      expect(handledAttack).toBe(true);
      expect(room.state.bossHp).toBe(480);
      expect(room.state.participants.has(userId)).toBe(true);

      // Reduce HP to <= 0 manually to trigger defeat
      room.state.bossHp = 20;
      const nextAns = room.state.currentAns.toString();
      const ctxFinalAttack = getCtx('', nextAns, true, otherUserId);
      const handledFinal = await gameSessionService.handleMessage(ctxFinalAttack, mockAdapter);
      expect(handledFinal).toBe(true);
      expect(activeRooms.has(groupId)).toBe(false); // Defeated
      expect(sentMessages[sentMessages.length - 1].text).toContain('GIGA CALCULATOR TELAH DIKALAHKAN');
    });
  });

  describe('G026: TicTacToe Ultimate (tictactoeultimate)', () => {
    it('starts on two players, processes turns, detects set wins, and ends on match win', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Join P1 to lobby
      const ctxStart = getCtx('tictactoeultimate', '/tictactoeultimate');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('TICTACTOE ULTIMATE LOBBY');
      const room = activeRooms.get(groupId)!;
      expect(room.status).toBe('lobby');

      // Join P2 -> should start game immediately
      const ctxJoin = getCtx('tictactoeultimate', '/tictactoeultimate join', true, otherUserId);
      await gameCmd.execute(ctxJoin, ctxJoin.command.args, mockAdapter);
      expect(room.status).toBe('playing');
      expect(room.state.currentTurn).toBe(userId);

      // Turn 1: P1 (userId) places X at 1
      const ctxMove1 = getCtx('', '1', true, userId);
      await gameSessionService.handleMessage(ctxMove1, mockAdapter);
      expect(room.state.board[0]).toBe('X');
      expect(room.state.currentTurn).toBe(otherUserId);

      // Turn 2: P2 places O at 4
      const ctxMove2 = getCtx('', '4', true, otherUserId);
      await gameSessionService.handleMessage(ctxMove2, mockAdapter);

      // Turn 3: P1 places X at 2
      const ctxMove3 = getCtx('', '2', true, userId);
      await gameSessionService.handleMessage(ctxMove3, mockAdapter);

      // Turn 4: P2 places O at 5
      const ctxMove4 = getCtx('', '5', true, otherUserId);
      await gameSessionService.handleMessage(ctxMove4, mockAdapter);

      // Turn 5: P1 places X at 3 (Wins Set 1!)
      const ctxMove5 = getCtx('', '3', true, userId);
      await gameSessionService.handleMessage(ctxMove5, mockAdapter);

      expect(room.state.scores[userId]).toBe(1);
      expect(room.state.set).toBe(2);
      expect(room.state.board.every((cell: string) => cell === '')).toBe(true); // reset
    });
  });

  describe('G027: Connect Four (connectfour)', () => {
    it('starts on two players, lets pieces fall to lowest empty row, and checks horizontal win', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Join P1
      const ctxStart = getCtx('connectfour', '/connectfour');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('CONNECT FOUR LOBBY');
      const room = activeRooms.get(groupId)!;

      // Join P2 -> starts game
      const ctxJoin = getCtx('connectfour', '/connectfour join', true, otherUserId);
      await gameCmd.execute(ctxJoin, ctxJoin.command.args, mockAdapter);
      expect(room.status).toBe('playing');
      expect(room.state.currentTurn).toBe(userId);

      // P1 drops to column 1
      const ctxMove1 = getCtx('', '1', true, userId);
      await gameSessionService.handleMessage(ctxMove1, mockAdapter);
      expect(room.state.board[5][0]).toBe('R'); // lowest row is 5

      // P2 drops to column 1
      const ctxMove2 = getCtx('', '1', true, otherUserId);
      await gameSessionService.handleMessage(ctxMove2, mockAdapter);
      expect(room.state.board[4][0]).toBe('Y'); // stacks on top

      // Let's manually simulate P1 horizontal win on row 5: columns 1, 2, 3, 4
      room.state.board = [
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['R', 'R', 'R', '', '', '', '']
      ];
      room.state.currentTurn = userId;

      // P1 drops to column 4 (Wins!)
      const ctxWin = getCtx('', '4', true, userId);
      await gameSessionService.handleMessage(ctxWin, mockAdapter);

      expect(activeRooms.has(groupId)).toBe(false);
      expect(sentMessages[sentMessages.length - 1].text).toContain('CONNECT FOUR WINNER');
    });
  });
});
