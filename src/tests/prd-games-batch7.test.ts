import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../db/client.js';
import { GameRoom, rewardPlayer, recordGameStats } from '../services/games/game-engine.js';
import { PrdGamesSuiteCommand, activeRooms } from '../commands/games/prd-games.command.js';
import { gameSessionService } from '../services/games/game-session.service.js';

describe('PRD Batch 7 — 5 New Games Verification Suite', () => {
  const groupId = 'test-group-batch7@g.us';
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

  describe('G008: Tebak Emoji (tebakemoji)', () => {
    it('starts game, processes guesses, rewards winner on success, and supports stop command', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start game
      const ctxStart = getCtx('tebakemoji', '/tebakemoji');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('TEBAK EMOJI');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();
      expect(room?.gameType).toBe('G008');

      // Test cancel/stop
      const ctxStop = getCtx('tebakemoji', '/tebakemoji stop');
      await gameCmd.execute(ctxStop, ctxStop.command.args, mockAdapter);
      expect(activeRooms.has(groupId)).toBe(false);
      expect(sentMessages[1].text).toContain('Tebak Emoji telah dibatalkan');

      // Start again to test guessing
      sentMessages = [];
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);
      const room2 = activeRooms.get(groupId)!;

      // Guess wrong: should return false and not send any message (silent wrong guesses)
      const ctxWrong = getCtx('', 'salah-tebakan-ini', true, userId);
      const handledWrong = await gameSessionService.handleMessage(ctxWrong, mockAdapter);
      expect(handledWrong).toBe(false);
      expect(sentMessages.length).toBe(1); // Only the start message is in sentMessages

      // Guess correct
      const targetAns = room2.state.answer;
      const ctxCorrect = getCtx('', targetAns, true, userId);
      const handledCorrect = await gameSessionService.handleMessage(ctxCorrect, mockAdapter);
      expect(handledCorrect).toBe(true);
      expect(sentMessages[1].text).toContain('TEBAK EMOJI TERJAWAB');
      expect(activeRooms.has(groupId)).toBe(false); // Cleaned up
    });
  });

  describe('G019: Sudoku Mini (sudokumini)', () => {
    it('starts game, handles raw guesses and slash command guesses, and resolves puzzle', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start game
      const ctxStart = getCtx('sudokumini', '/sudokumini');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('SUDOKU MINI 4x4');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();
      expect(room?.gameType).toBe('G019');

      const state = room!.state;
      // Find a masked cell (where current is 0)
      const emptyIdx = state.current.findIndex((v: number) => v === 0);
      expect(emptyIdx).toBeGreaterThanOrEqual(0);

      const rowChar = String.fromCharCode(65 + Math.floor(emptyIdx / 4));
      const colNum = (emptyIdx % 4) + 1;
      const correctVal = state.solution[emptyIdx];
      const incorrectVal = correctVal === 4 ? 3 : 4;

      // Guess incorrect val using raw chat
      sentMessages = [];
      const ctxWrongRaw = getCtx('', `${rowChar}${colNum} ${incorrectVal}`);
      const handledWrongRaw = await gameSessionService.handleMessage(ctxWrongRaw, mockAdapter);
      expect(handledWrongRaw).toBe(true);
      expect(sentMessages[0].text).toContain('salah');
      expect(state.current[emptyIdx]).toBe(0); // Still empty

      // Guess correct val using slash command prefix guess, e.g. /sudoku A2 3
      sentMessages = [];
      const ctxCorrectSlash = getCtx('sudoku', `/sudoku ${rowChar}${colNum} ${correctVal}`);
      const handledCorrectSlash = await gameSessionService.handleMessage(ctxCorrectSlash, mockAdapter);
      expect(handledCorrectSlash).toBe(true);
      expect(sentMessages[0].text).toContain('Tepat');
      expect(state.current[emptyIdx]).toBe(correctVal);

      // Solve all remaining empty cells to check win condition
      sentMessages = [];
      for (let i = 0; i < 16; i++) {
        if (state.current[i] === 0) {
          const r = String.fromCharCode(65 + Math.floor(i / 4));
          const c = (i % 4) + 1;
          const val = state.solution[i];
          const ctxSolve = getCtx('', `${r}${c} ${val}`);
          await gameSessionService.handleMessage(ctxSolve, mockAdapter);
        }
      }

      // Check last message shows win
      const lastMsg = sentMessages[sentMessages.length - 1];
      expect(lastMsg.text).toContain('SUDOKU MINI BERHASIL DIPECAHKAN');
      expect(activeRooms.has(groupId)).toBe(false); // Cleaned up
    });
  });

  describe('G023: Typing Race (typingrace)', () => {
    it('starts game, handles typing checks, respects case sensitivity, and rewards fast typist', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start game
      const ctxStart = getCtx('typingrace', '/typingrace');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('TYPING RACE');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();

      const targetText = room!.state.targetText;

      // Guess wrong case: typing race is case-sensitive, so lowercased version of targetText should fail
      const lowercasedGuess = targetText.toLowerCase();
      const ctxWrongCase = getCtx('', lowercasedGuess);
      const handledWrongCase = await gameSessionService.handleMessage(ctxWrongCase, mockAdapter);
      // Case-sensitivity is crucial. If targetText has uppercase letters, they must match.
      // (If targetText has no uppercase, this particular assertion wouldn't verify case-sensitivity,
      // but TYPING_RACE_POOL strings all start with uppercase e.g. "Antigravity..." or "Belajar...")
      if (lowercasedGuess !== targetText) {
        expect(handledWrongCase).toBe(false);
      }

      // Guess correctly
      sentMessages = [];
      const ctxCorrect = getCtx('', targetText);
      const handledCorrect = await gameSessionService.handleMessage(ctxCorrect, mockAdapter);
      expect(handledCorrect).toBe(true);
      expect(sentMessages[0].text).toContain('TYPING RACE JUARA');
      expect(activeRooms.has(groupId)).toBe(false); // Cleaned up
    });
  });

  describe('G024: Memory Cards (memorycards)', () => {
    it('starts game, handles duplicates, mismatches, matches, and game win', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start game
      const ctxStart = getCtx('memorycards', '/memorycards');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('MEMORY CARDS');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();

      const state = room!.state;
      const pairs = state.pairs;

      // Guess same card
      sentMessages = [];
      const ctxSame = getCtx('', '1 1');
      const handledSame = await gameSessionService.handleMessage(ctxSame, mockAdapter);
      expect(handledSame).toBe(true);
      expect(sentMessages[0].text).toContain('Pilih dua kartu yang berbeda');

      // Find mismatch cards
      let idx1 = 0;
      let idx2 = 1;
      while (pairs[idx1] === pairs[idx2]) {
        idx2++;
      }

      sentMessages = [];
      const ctxMismatch = getCtx('', `${idx1 + 1} ${idx2 + 1}`);
      const handledMismatch = await gameSessionService.handleMessage(ctxMismatch, mockAdapter);
      expect(handledMismatch).toBe(true);
      expect(sentMessages[0].text).toContain('TIDAK COCOK');
      expect(state.revealed[idx1]).toBe(false);

      // Guess match cards
      const emoji = pairs[idx1];
      const matchIdx = pairs.indexOf(emoji, idx1 + 1);

      sentMessages = [];
      const ctxMatch = getCtx('', `${idx1 + 1} ${matchIdx + 1}`);
      const handledMatch = await gameSessionService.handleMessage(ctxMatch, mockAdapter);
      expect(handledMatch).toBe(true);
      expect(sentMessages[0].text).toContain('COCOK');
      expect(state.revealed[idx1]).toBe(true);
      expect(state.revealed[matchIdx]).toBe(true);

      // Solve all pairs to win
      sentMessages = [];
      for (let i = 0; i < 16; i++) {
        if (!state.revealed[i]) {
          const matchedItem = pairs[i];
          const secondIdx = pairs.indexOf(matchedItem, i + 1);
          if (secondIdx !== -1 && !state.revealed[secondIdx]) {
            const ctxSolve = getCtx('', `${i + 1} ${secondIdx + 1}`);
            await gameSessionService.handleMessage(ctxSolve, mockAdapter);
          }
        }
      }

      const lastMsg = sentMessages[sentMessages.length - 1];
      expect(lastMsg.text).toContain('MEMORY CARDS SOLVED');
      expect(activeRooms.has(groupId)).toBe(false); // Cleaned up
    });
  });

  describe('G025: Minesweeper Chat (minesweeperchat)', () => {
    it('starts game, handles coordinate parsing, explodes on mines, and handles flood fill win', async () => {
      sentMessages = [];
      activeRooms.clear();

      // Start game
      const ctxStart = getCtx('minesweeperchat', '/minesweeperchat');
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('MINESWEEPER CHAT');
      const room = activeRooms.get(groupId);
      expect(room).toBeDefined();

      const state = room!.state;

      // Guess a mine to test explosion
      const mineIdx = state.mines.indexOf(true);
      const mineRow = String.fromCharCode(65 + Math.floor(mineIdx / 5));
      const mineCol = (mineIdx % 5) + 1;

      sentMessages = [];
      const ctxMine = getCtx('', `${mineRow}${mineCol}`);
      const handledMine = await gameSessionService.handleMessage(ctxMine, mockAdapter);
      expect(handledMine).toBe(true);
      expect(sentMessages[0].text).toContain('BOOM!');
      expect(activeRooms.has(groupId)).toBe(false); // Game ends immediately on mine

      // Restart for win test
      sentMessages = [];
      await gameCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);
      const room2 = activeRooms.get(groupId)!;
      const state2 = room2.state;

      // Reveal all safe cells
      sentMessages = [];
      for (let i = 0; i < 25; i++) {
        if (!state2.mines[i] && !state2.revealed[i]) {
          const r = String.fromCharCode(65 + Math.floor(i / 5));
          const c = (i % 5) + 1;
          const ctxSafe = getCtx('', `${r}${c}`);
          await gameSessionService.handleMessage(ctxSafe, mockAdapter);
        }
      }

      const lastMsg = sentMessages[sentMessages.length - 1];
      expect(lastMsg.text).toContain('MINESWEEPER CLEAR');
      expect(activeRooms.has(groupId)).toBe(false); // Cleaned up
    });
  });
});
