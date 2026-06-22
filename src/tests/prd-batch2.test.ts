import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import prisma from '../db/client.js';
import { NotesCommand } from '../commands/community/notes.command.js';
import { ReputationCommand } from '../commands/community/reputation.command.js';
import { ScheduleSuiteCommand } from '../commands/community/schedule.command.js';
import { CommunitySuiteCommand } from '../commands/community/community.command.js';
import { SetupCommand } from '../commands/setup.command.js';
import { WebhookCommand } from '../commands/owner/webhook.command.js';
import { stateStore } from '../services/state/state-store.js';

describe('PRD Batch 2 — Lightweight Features', () => {
  const groupId = 'test-group-batch2@g.us';
  const userId = '628123456789@s.whatsapp.net';
  const otherUserId = '628987654321@s.whatsapp.net';

  let mockAdapter: any;
  let sentMessages: { chatId: string; text: string; options?: any }[] = [];

  beforeAll(async () => {
    // Clear existing test data in target groups
    await prisma.customVariable.deleteMany({ where: { groupId } });
    await prisma.reminder.deleteMany({ where: { groupId } });
    await prisma.task.deleteMany({ where: { groupId } });
    await prisma.poll.deleteMany({ where: { groupId } });
    await prisma.groupConfig.deleteMany({ where: { groupId } });

    // Mock adapter with sock for isGroupAdmin
    mockAdapter = {
      sock: {
        groupMetadata: async () => {
          return {
            id: groupId,
            participants: [
              { id: userId, admin: 'admin' },
              { id: otherUserId, admin: null }
            ]
          };
        }
      },
      sendMessage: async (chatId: string, text: string, options?: any) => {
        sentMessages.push({ chatId, text, options });
        return { key: { id: 'mock-msg-id' } };
      }
    };
  });

  afterAll(async () => {
    // Cleanup
    await prisma.customVariable.deleteMany({ where: { groupId } });
    await prisma.reminder.deleteMany({ where: { groupId } });
    await prisma.task.deleteMany({ where: { groupId } });
    await prisma.poll.deleteMany({ where: { groupId } });
    await prisma.groupConfig.deleteMany({ where: { groupId } });
  });

  const getCtx = (cmdName: string, body: string, isGroup = true, sender = userId): any => ({
    id: `msg-${Math.random()}`,
    chatId: isGroup ? groupId : 'private',
    senderId: sender,
    body,
    isGroup,
    command: {
      prefix: '/',
      rawCommandName: cmdName,
      commandName: cmdName,
      args: body.split(/\s+/).slice(1),
      isCommand: true
    }
  });

  describe('F047: Quick Notes', () => {
    const notesCmd = new NotesCommand();

    it('sets, lists, gets, and deletes a quicknote', async () => {
      sentMessages = [];
      const ctxSet = getCtx('quicknote', '/quicknote set rahasia = isi penting');
      await notesCmd.execute(ctxSet, ctxSet.command.args, mockAdapter);

      expect(sentMessages[0].text).toContain('Catatan pribadi');
      expect(sentMessages[0].text).toContain('rahasia');

      const ctxList = getCtx('quicknote', '/quicknote list');
      await notesCmd.execute(ctxList, ctxList.command.args, mockAdapter);
      expect(sentMessages[1].text).toContain('rahasia');

      const ctxGet = getCtx('quicknote', '/quicknote get rahasia');
      await notesCmd.execute(ctxGet, ctxGet.command.args, mockAdapter);
      expect(sentMessages[2].text).toBe('isi penting');

      const ctxDel = getCtx('quicknote', '/quicknote del rahasia');
      await notesCmd.execute(ctxDel, ctxDel.command.args, mockAdapter);
      expect(sentMessages[3].text).toContain('Catatan pribadi');
      expect(sentMessages[3].text).toContain('rahasia');
    });
  });

  describe('F043: Group Checklist', () => {
    const notesCmd = new NotesCommand();

    it('creates, adds, checks, and shows a group checklist', async () => {
      sentMessages = [];
      const ctxCreate = getCtx('checklistgrup', '/checklistgrup create Belanja Mingguan');
      await notesCmd.execute(ctxCreate, ctxCreate.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('Checklist');
      expect(sentMessages[0].text).toContain('Belanja Mingguan');

      // Extract ID from message
      const idMatch = sentMessages[0].text.match(/\*([A-Z0-9]{4})\*/);
      expect(idMatch).not.toBeNull();
      const listId = idMatch![1];

      const ctxAdd = getCtx('checklistgrup', `/checklistgrup add ${listId} Telur`);
      await notesCmd.execute(ctxAdd, ctxAdd.command.args, mockAdapter);
      expect(sentMessages[1].text).toContain('Telur');

      const ctxShow = getCtx('checklistgrup', `/checklistgrup show ${listId}`);
      await notesCmd.execute(ctxShow, ctxShow.command.args, mockAdapter);
      expect(sentMessages[2].text).toContain('⬜ Telur');

      const ctxCheck = getCtx('checklistgrup', `/checklistgrup check ${listId} 1`);
      await notesCmd.execute(ctxCheck, ctxCheck.command.args, mockAdapter);
      expect(sentMessages[3].text).toContain('Selesai');

      const ctxShowAfter = getCtx('checklistgrup', `/checklistgrup show ${listId}`);
      await notesCmd.execute(ctxShowAfter, ctxShowAfter.command.args, mockAdapter);
      expect(sentMessages[4].text).toContain('✅ Telur');
    });
  });

  describe('F048: Mini Kanban Board', () => {
    const notesCmd = new NotesCommand();

    it('creates, adds, moves, and shows a Kanban board', async () => {
      sentMessages = [];
      const ctxCreate = getCtx('kanbanmini', '/kanbanmini create Kanban Project');
      await notesCmd.execute(ctxCreate, ctxCreate.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('Papan Kanban');
      expect(sentMessages[0].text).toContain('Kanban Project');

      const idMatch = sentMessages[0].text.match(/\*([A-Z0-9]{4})\*/);
      const boardId = idMatch![1];

      const ctxAdd = getCtx('kanbanmini', `/kanbanmini add ${boardId} Desain Database`);
      await notesCmd.execute(ctxAdd, ctxAdd.command.args, mockAdapter);
      expect(sentMessages[1].text).toContain('Tugas');
      expect(sentMessages[1].text).toContain('Desain Database');

      const ctxShow = getCtx('kanbanmini', `/kanbanmini show ${boardId}`);
      await notesCmd.execute(ctxShow, ctxShow.command.args, mockAdapter);
      expect(sentMessages[2].text).toContain('[T1] Desain Database');

      const ctxMove = getCtx('kanbanmini', `/kanbanmini move ${boardId} T1 doing`);
      await notesCmd.execute(ctxMove, ctxMove.command.args, mockAdapter);
      expect(sentMessages[3].text).toContain('DOING');
    });
  });

  describe('F094: Group Bookmarks', () => {
    const notesCmd = new NotesCommand();

    it('adds, gets, and lists group bookmarks', async () => {
      sentMessages = [];
      const ctxAdd = getCtx('bookmarkgrup', '/bookmarkgrup add drive = https://drive.google.com/test');
      await notesCmd.execute(ctxAdd, ctxAdd.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('Bookmark grup');
      expect(sentMessages[0].text).toContain('drive');

      const ctxGet = getCtx('bookmarkgrup', '/bookmarkgrup get drive');
      await notesCmd.execute(ctxGet, ctxGet.command.args, mockAdapter);
      expect(sentMessages[1].text).toBe('https://drive.google.com/test');
    });
  });

  describe('F040: Reputation System & F113: Leaderboard', () => {
    const repCmd = new ReputationCommand();

    it('gives reputation, views it, and shows helper leaderboard', async () => {
      // Clear cooldown for this test
      const cooldownKey = `rep:cooldown:${groupId}:${userId}:${otherUserId}`;
      await stateStore.delete(cooldownKey);

      sentMessages = [];
      const ctxRep = getCtx('rep', `/rep @${otherUserId.split('@')[0]}`, true, userId);
      await repCmd.execute(ctxRep, ctxRep.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('memberikan');
      expect(sentMessages[0].text).toContain('+1 reputasi');

      const ctxView = getCtx('rep', '', true, otherUserId);
      await repCmd.execute(ctxView, ctxView.command.args, mockAdapter);
      expect(sentMessages[1].text).toContain('Reputasi: *1* poin');

      const ctxLeaderboard = getCtx('tophelper', '/tophelper');
      await repCmd.execute(ctxLeaderboard, ctxLeaderboard.command.args, mockAdapter);
      expect(sentMessages[2].text).toContain('PAPAN PERINGKAT TOP HELPER');
    });
  });

  describe('F038: Polls with Quorum and Deadline', () => {
    const commCmd = new CommunitySuiteCommand();

    it('creates a poll with deadline and quorum, registers vote, and respects quorum', async () => {
      sentMessages = [];
      const ctxCreate = getCtx('votingkeputusan', '/votingkeputusan Pilih Menu Bukber | Bakso | Nasi Goreng | 10 | 2');
      await commCmd.execute(ctxCreate, ctxCreate.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('VOTING KEPUTUSAN GRUP');
      expect(sentMessages[0].text).toContain('Pilih Menu Bukber');
      expect(sentMessages[0].text).toContain('10 menit');
      expect(sentMessages[0].text).toContain('minimal 2 suara');

      // Register a vote
      const ctxVote = getCtx('vote', '/vote 1', true, userId);
      await commCmd.execute(ctxVote, ctxVote.command.args, mockAdapter);
      expect(sentMessages[1].text).toContain('Pilihan Anda');
      expect(sentMessages[1].text).toContain('Bakso');

      // Check results (only 1 vote, quorum is 2, so should be invalid/not sah)
      const ctxResult = getCtx('pollresult', '/pollresult');
      await commCmd.execute(ctxResult, ctxResult.command.args, mockAdapter);
      expect(sentMessages[2].text).toContain('TIDAK SAH');

      // Vote again from other user
      const ctxVote2 = getCtx('vote', '/vote 1', true, otherUserId);
      await commCmd.execute(ctxVote2, ctxVote2.command.args, mockAdapter);

      // Check results again (now 2 votes, quorum is 2, so should be valid/sah)
      const ctxResult2 = getCtx('pollresult', '/pollresult');
      await commCmd.execute(ctxResult2, ctxResult2.command.args, mockAdapter);
      expect(sentMessages[4].text).toContain('SAH / VALID');
    });
  });

  describe('F041: Recurring Reminders & F042: Natural Language Reminders', () => {
    const schedCmd = new ScheduleSuiteCommand();

    it('creates weekly and daily recurring reminders', async () => {
      sentMessages = [];
      const ctxDaily = getCtx('reminderulang', '/reminderulang set daily 08:00 Minum vitamin');
      await schedCmd.execute(ctxDaily, ctxDaily.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('Pengingat Berulang Berhasil Dibuat');
      expect(sentMessages[0].text).toContain('Minum vitamin');

      const ctxWeekly = getCtx('reminderulang', '/reminderulang set senin 09:00 Rapat Koordinasi');
      await schedCmd.execute(ctxWeekly, ctxWeekly.command.args, mockAdapter);
      expect(sentMessages[1].text).toContain('Rapat Koordinasi');
    });

    it('parses natural language times correctly', async () => {
      sentMessages = [];
      const ctxNlp = getCtx('remindernlp', '/remindernlp ingatkan saya 15 menit lagi matikan kompor');
      await schedCmd.execute(ctxNlp, ctxNlp.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('Bahasa Alami Dibuat');
      expect(sentMessages[0].text).toContain('matikan kompor');
    });
  });

  describe('F022: Preset Feature Management', () => {
    const setupCmd = new SetupCommand();

    it('applies the sekolah preset features', async () => {
      sentMessages = [];
      const ctxPreset = getCtx('presetfitur', '/presetfitur sekolah');
      await setupCmd.execute(ctxPreset, ctxPreset.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('Pack SEKOLAH Berhasil Diterapkan');
    });
  });

  describe('F029: Announcement Builder', () => {
    const webCmd = new WebhookCommand();

    it('builds an info template announcement', async () => {
      sentMessages = [];
      const ctxAnn = getCtx('announcementbuilder', '/announcementbuilder build info | Update UTS | Ujian Tengah Semester dimulai besok pagi pukul 07:30.');
      await webCmd.execute(ctxAnn, ctxAnn.command.args, mockAdapter);
      expect(sentMessages[0].text).toContain('INFORMASI GRUP');
      expect(sentMessages[0].text).toContain('Update UTS');
      expect(sentMessages[0].text).toContain('Ujian Tengah Semester dimulai besok pagi pukul 07:30');
    });
  });
});
