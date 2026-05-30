import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { AutomationCommand } from '../commands/community/automation.command.js';
import * as indexModule from '../commands/index.js';

describe('Automation, Workflow & Variable Commands', () => {
  const cmd = new AutomationCommand();
  const testGroup = 'test-auto-group@g.us';
  const creatorUser = 'creatoruser@s.whatsapp.net';
  const otherUser = 'otheruser@s.whatsapp.net';

  beforeEach(async () => {
    await prisma.customVariable.deleteMany({});
  });

  afterEach(async () => {
    await prisma.customVariable.deleteMany({});
  });

  it('should handle custom variables (set, get, list, delete)', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

    // 1. Set Var
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/var set sekolah SMA Negeri 1',
      senderId: creatorUser,
      id: 'msg-var-set'
    } as any, ['set', 'sekolah', 'SMA', 'Negeri', '1'], adapter);

    expect(replies[replies.length - 1]).toContain('Variabel kustom *{sekolah}* berhasil diset');

    // 2. Get Var
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/var get sekolah',
      senderId: otherUser,
      id: 'msg-var-get'
    } as any, ['get', 'sekolah'], adapter);

    expect(replies[replies.length - 1]).toContain('SMA Negeri 1');

    // 3. List Vars
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/var list',
      senderId: otherUser,
      id: 'msg-var-list'
    } as any, ['list'], adapter);

    expect(replies[replies.length - 1]).toContain('DAFTAR VARIABEL KUSTOM');
    expect(replies[replies.length - 1]).toContain('sekolah');

    // 4. Delete Var
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/var delete sekolah',
      senderId: creatorUser,
      id: 'msg-var-del'
    } as any, ['delete', 'sekolah'], adapter);

    expect(replies[replies.length - 1]).toContain('berhasil dihapus');

    isAdminSpy.mockRestore();
  });

  it('should handle automation builder (join, badword, warn)', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

    // 1. Create Auto join
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/auto when join send Selamat datang di grup kami!',
      senderId: creatorUser,
      id: 'msg-auto-join'
    } as any, ['when', 'join', 'send', 'Selamat', 'datang', 'di', 'grup', 'kami!'], adapter);

    const autoMsg = replies[replies.length - 1];
    expect(autoMsg).toContain('OTOMASI BERHASIL DIBUAT');
    expect(autoMsg).toContain('join');
    expect(autoMsg).toContain('send');

    const autoId = autoMsg.match(/ID:\*?\s*`([A-Z0-9-]+)`/)![1];

    // 2. List Autos
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/auto list',
      senderId: otherUser,
      id: 'msg-auto-list'
    } as any, ['list'], adapter);

    expect(replies[replies.length - 1]).toContain('DAFTAR OTOMASI GRUP');
    expect(replies[replies.length - 1]).toContain(autoId);

    // 3. Delete Auto
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/auto delete ${autoId}`,
      senderId: creatorUser,
      id: 'msg-auto-del'
    } as any, ['delete', autoId], adapter);

    expect(replies[replies.length - 1]).toContain('berhasil dihapus');

    isAdminSpy.mockRestore();
  });

  it('should handle custom workflows', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

    // 1. Create Workflow
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/workflow create sambutan',
      senderId: creatorUser,
      id: 'msg-wf-create'
    } as any, ['create', 'sambutan'], adapter);

    expect(replies[replies.length - 1]).toContain('WORKFLOW DIBUAT');
    expect(replies[replies.length - 1]).toContain('sambutan');

    // 2. List Workflows
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/workflow list',
      senderId: otherUser,
      id: 'msg-wf-list'
    } as any, ['list'], adapter);

    expect(replies[replies.length - 1]).toContain('DAFTAR WORKFLOW GRUP');
    expect(replies[replies.length - 1]).toContain('SAMBUTAN');

    // 3. Delete Workflow
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/workflow delete sambutan',
      senderId: creatorUser,
      id: 'msg-wf-del'
    } as any, ['delete', 'sambutan'], adapter);

    expect(replies[replies.length - 1]).toContain('berhasil dihapus');

    isAdminSpy.mockRestore();
  });

  it('should handle smart rules', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

    // 1. Add Rule
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/rule tambah jangan kirim link selain YouTube',
      senderId: creatorUser,
      id: 'msg-rule-add'
    } as any, ['tambah', 'jangan', 'kirim', 'link', 'selain', 'YouTube'], adapter);

    const ruleMsg = replies[replies.length - 1];
    expect(ruleMsg).toContain('PERATURAN PINTAR DITAMBAHKAN');
    expect(ruleMsg).toContain('jangan kirim link selain YouTube');

    const ruleId = ruleMsg.match(/ID:\*?\s*`([A-Z0-9-]+)`/)![1];

    // 2. List Rules
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/rule list',
      senderId: otherUser,
      id: 'msg-rule-list'
    } as any, ['list'], adapter);

    expect(replies[replies.length - 1]).toContain('PERATURAN PINTAR GRUP');
    expect(replies[replies.length - 1]).toContain(ruleId);

    // 3. Delete Rule
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/rule delete ${ruleId}`,
      senderId: creatorUser,
      id: 'msg-rule-del'
    } as any, ['delete', ruleId], adapter);

    expect(replies[replies.length - 1]).toContain('berhasil dihapus');

    isAdminSpy.mockRestore();
  });
});
