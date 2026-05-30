import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import prisma from '../db/client.js';
import { PrivacyCommand } from '../commands/owner/privacy.command.js';
import { WebhookCommand } from '../commands/owner/webhook.command.js';
import * as indexModule from '../commands/index.js';
import * as permModule from '../bot/permission.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const GROUP_ID = 'test-privacy-group@g.us';
const ADMIN_ID = 'admin@s.whatsapp.net';
const USER_ID = 'member@s.whatsapp.net';
const OWNER_ID = process.env.OWNER_NUMBER ? `${process.env.OWNER_NUMBER}@s.whatsapp.net` : 'owner@s.whatsapp.net';

function makeCtx(body: string, senderId = ADMIN_ID, isGroup = true, chatId = GROUP_ID) {
  return { id: 'msg1', body, chatId, senderId, isGroup } as any;
}

function makeAdapter() {
  const replies: string[] = [];
  const adapter = {
    sendMessage: vi.fn(async (_: string, text: string) => { replies.push(text); }),
    replies
  } as any;
  return adapter;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('PrivacyCommand — /privacymode', () => {
  const cmd = new PrivacyCommand();
  let isAdminSpy: any;
  let isOwnerSpy: any;

  beforeEach(async () => {
    await prisma.customVariable.deleteMany({ where: { groupId: GROUP_ID } });
    isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);
    isOwnerSpy = vi.spyOn(permModule, 'isOwner').mockReturnValue(true);
  });

  afterEach(async () => {
    await prisma.customVariable.deleteMany({ where: { groupId: GROUP_ID } });
    isAdminSpy?.mockRestore();
    isOwnerSpy?.mockRestore();
  });

  it('shows current mode when no args', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/privacymode'), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('PRIVACY MODE'), expect.any(Object));
  });

  it('sets strict mode successfully', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/privacymode strict'), ['strict'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('STRICT'), expect.any(Object));
    const saved = await prisma.customVariable.findFirst({ where: { groupId: GROUP_ID, key: 'privacy:mode' } });
    expect(saved?.value).toBe('strict');
  });

  it('sets balanced mode', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/privacymode balanced'), ['balanced'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('BALANCED'), expect.any(Object));
  });

  it('sets off mode', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/privacymode off'), ['off'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('OFF'), expect.any(Object));
  });

  it('rejects invalid mode', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/privacymode superstrict'), ['superstrict'], adapter);
    // Should fall through to show help (shows PRIVACY MODE)
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('PRIVACY MODE'), expect.any(Object));
  });

  it('rejects non-group context', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/privacymode strict', ADMIN_ID, false), ['strict'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('hanya untuk grup'), expect.any(Object));
  });

  it('rejects non-admin', async () => {
    isAdminSpy.mockResolvedValue(false);
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/privacymode strict', USER_ID), ['strict'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Hanya Admin'), expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PrivacyCommand — /retention', () => {
  const cmd = new PrivacyCommand();
  let isAdminSpy: any;

  beforeEach(async () => {
    await prisma.dataRetentionPolicy.deleteMany({ where: { groupId: GROUP_ID } });
    isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);
  });

  afterEach(async () => {
    await prisma.dataRetentionPolicy.deleteMany({ where: { groupId: GROUP_ID } });
    isAdminSpy?.mockRestore();
  });

  it('shows help when no args', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/retention'), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('DATA RETENTION POLICY'), expect.any(Object));
  });

  it('creates a logs retention policy', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/retention logs 30d'), ['logs', '30d'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('30d'), expect.any(Object));
    const policy = await prisma.dataRetentionPolicy.findFirst({ where: { groupId: GROUP_ID, scope: 'logs' } });
    expect(policy?.duration).toBe('30d');
    expect(policy?.enabled).toBe(true);
  });

  it('creates a media retention policy set to off', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/retention media off'), ['media', 'off'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('dinonaktifkan'), expect.any(Object));
    const policy = await prisma.dataRetentionPolicy.findFirst({ where: { groupId: GROUP_ID, scope: 'media' } });
    expect(policy?.enabled).toBe(false);
  });

  it('updates existing policy', async () => {
    await cmd.execute(makeCtx('/retention logs 7d'), ['logs', '7d'], makeAdapter());
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/retention logs 90d'), ['logs', '90d'], adapter);
    const policy = await prisma.dataRetentionPolicy.findFirst({ where: { groupId: GROUP_ID, scope: 'logs' } });
    expect(policy?.duration).toBe('90d');
  });

  it('rejects invalid scope', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/retention fakedata 7d'), ['fakedata', '7d'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Scope tidak valid'), expect.any(Object));
  });

  it('rejects invalid duration', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/retention logs 999y'), ['logs', '999y'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Durasi tidak valid'), expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PrivacyCommand — /cleandb', () => {
  const cmd = new PrivacyCommand();
  let isOwnerSpy: any;

  beforeEach(() => {
    isOwnerSpy = vi.spyOn(permModule, 'isOwner').mockReturnValue(true);
  });

  afterEach(() => {
    isOwnerSpy?.mockRestore();
  });

  it('shows help when no scope', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/cleandb', OWNER_ID), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('CLEAN DATABASE'), expect.any(Object));
  });

  it('cleans temp queue records', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/cleandb temp', OWNER_ID), ['temp'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('CLEANDB TEMP'), expect.any(Object));
  });

  it('cleans logs', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/cleandb logs 1d', OWNER_ID), ['logs', '1d'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('CLEANDB LOGS'), expect.any(Object));
  });

  it('cleans usage logs', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/cleandb usage 90d', OWNER_ID), ['usage', '90d'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('CLEANDB USAGE'), expect.any(Object));
  });

  it('rejects non-owner', async () => {
    isOwnerSpy.mockReturnValue(false);
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/cleandb logs 30d', USER_ID), ['logs', '30d'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('hanya untuk Owner'), expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PrivacyCommand — /mydata & /deletemydata', () => {
  const cmd = new PrivacyCommand();

  it('/mydata shows data summary', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/mydata', USER_ID), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('DATA ANDA DI BOT'), expect.any(Object));
  });

  it('/deletemydata shows confirmation prompt without confirm arg', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/deletemydata', USER_ID), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('konfirmasi'), expect.any(Object));
  });

  it('/deletemydata deletes data when confirmed', async () => {
    // Create some data for the user first
    await prisma.userProfile.upsert({
      where: { userId: USER_ID },
      create: { userId: USER_ID },
      update: {}
    });
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/deletemydata konfirmasi', USER_ID), ['konfirmasi'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('DATA PERSONAL DIHAPUS'), expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PrivacyCommand — /consent', () => {
  const cmd = new PrivacyCommand();

  beforeEach(async () => {
    await prisma.customVariable.deleteMany({ where: { userId: USER_ID } });
  });

  afterEach(async () => {
    await prisma.customVariable.deleteMany({ where: { userId: USER_ID } });
  });

  it('shows current consent status', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/consent', USER_ID), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('CONSENT ANDA'), expect.any(Object));
  });

  it('saves ai consent off', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/consent ai off', USER_ID), ['ai', 'off'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('CONSENT DIPERBARUI'), expect.any(Object));
  });

  it('saves analytics consent on', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/consent analytics on', USER_ID), ['analytics', 'on'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('CONSENT DIPERBARUI'), expect.any(Object));
  });

  it('rejects invalid feature name', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/consent spyware on', USER_ID), ['spyware', 'on'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('tidak valid'), expect.any(Object));
  });

  it('rejects invalid state', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/consent ai maybe', USER_ID), ['ai', 'maybe'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('tidak valid'), expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PrivacyCommand — /generaterules & /rules & /setuju', () => {
  const cmd = new PrivacyCommand();
  let isAdminSpy: any;

  beforeEach(async () => {
    await prisma.customVariable.deleteMany({ where: { groupId: GROUP_ID } });
    isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);
  });

  afterEach(async () => {
    await prisma.customVariable.deleteMany({ where: { groupId: GROUP_ID } });
    isAdminSpy?.mockRestore();
  });

  it('/generaterules sekolah creates template rules', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/generaterules sekolah'), ['sekolah'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('PERATURAN GRUP DIBUAT'), expect.any(Object));
    const saved = await prisma.customVariable.findFirst({ where: { groupId: GROUP_ID, key: 'group:rules:current' } });
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!.value);
    expect(parsed.template).toBe('sekolah');
  });

  it('/generaterules shows template options when no arg', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/generaterules'), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('GENERATE PERATURAN'), expect.any(Object));
  });

  it('/rules shows no rules when not set', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/rules'), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Belum ada peraturan'), expect.any(Object));
  });

  it('/rules shows current rules after generaterules', async () => {
    await cmd.execute(makeCtx('/generaterules komunitas'), ['komunitas'], makeAdapter());
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/rules'), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('PERATURAN GRUP'), expect.any(Object));
  });

  it('/rules version shows history', async () => {
    await cmd.execute(makeCtx('/generaterules jualbeli'), ['jualbeli'], makeAdapter());
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/rules version'), ['version'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('RIWAYAT VERSI'), expect.any(Object));
  });

  it('/rules edit appends a new rule', async () => {
    await cmd.execute(makeCtx('/generaterules sekolah'), ['sekolah'], makeAdapter());
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/rules edit 6. Tidak boleh bullying.'), ['edit', '6.', 'Tidak', 'boleh', 'bullying.'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('ditambahkan'), expect.any(Object));
  });

  it('/setuju records member acceptance', async () => {
    await cmd.execute(makeCtx('/generaterules sekolah'), ['sekolah'], makeAdapter());
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/setuju', USER_ID), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('menyetujui peraturan'), expect.any(Object));
    const saved = await prisma.customVariable.findFirst({ where: { groupId: GROUP_ID, key: 'group:rules:acceptances' } });
    expect(saved).not.toBeNull();
    const acceptances = JSON.parse(saved!.value);
    expect(acceptances.some((a: any) => a.userId === USER_ID)).toBe(true);
  });

  it('/setuju fails gracefully when no rules set', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/setuju', USER_ID), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Belum ada peraturan'), expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WebhookCommand — /webhook', () => {
  const cmd = new WebhookCommand();
  let isOwnerSpy: any;
  let isAdminSpy: any;

  beforeEach(async () => {
    await prisma.webhook.deleteMany({ where: { groupId: GROUP_ID } });
    await prisma.auditLog.deleteMany({ where: { groupId: GROUP_ID } });
    isOwnerSpy = vi.spyOn(permModule, 'isOwner').mockReturnValue(true);
    isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);
  });

  afterEach(async () => {
    await prisma.webhook.deleteMany({ where: { groupId: GROUP_ID } });
    await prisma.auditLog.deleteMany({ where: { groupId: GROUP_ID } });
    isOwnerSpy?.mockRestore();
    isAdminSpy?.mockRestore();
  });

  it('shows help menu with no args', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook', OWNER_ID), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('WEBHOOK MANAGER'), expect.any(Object));
  });

  it('registers a valid https webhook URL', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook set https://example.com/hook', OWNER_ID), ['set', 'https://example.com/hook'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('WEBHOOK TERDAFTAR'), expect.any(Object));
    const wh = await prisma.webhook.findFirst({ where: { groupId: GROUP_ID } });
    expect(wh?.url).toBe('https://example.com/hook');
    expect(wh?.enabled).toBe(true);
  });

  it('rejects SSRF localhost URL', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook set http://localhost:3000/hook', OWNER_ID), ['set', 'http://localhost:3000/hook'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('SSRF'), expect.any(Object));
  });

  it('rejects 127.0.0.1 SSRF', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook set http://127.0.0.1/hook', OWNER_ID), ['set', 'http://127.0.0.1/hook'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('SSRF'), expect.any(Object));
  });

  it('rejects non-http URL', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook set ftp://evil.com/hook', OWNER_ID), ['set', 'ftp://evil.com/hook'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('valid'), expect.any(Object));
  });

  it('shows no-webhook when /webhook off and nothing registered', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook off', OWNER_ID), ['off'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Tidak ada webhook'), expect.any(Object));
  });

  it('disables webhook with /webhook off', async () => {
    await cmd.execute(makeCtx('/webhook set https://example.com/hook', OWNER_ID), ['set', 'https://example.com/hook'], makeAdapter());
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook off', OWNER_ID), ['off'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('dinonaktifkan'), expect.any(Object));
    const wh = await prisma.webhook.findFirst({ where: { groupId: GROUP_ID } });
    expect(wh?.enabled).toBe(false);
  });

  it('lists registered webhooks', async () => {
    await cmd.execute(makeCtx('/webhook set https://example.com/hook', OWNER_ID), ['set', 'https://example.com/hook'], makeAdapter());
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook list', OWNER_ID), ['list'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('DAFTAR WEBHOOK'), expect.any(Object));
  });

  it('shows no webhook for test when none registered', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/webhook test', OWNER_ID), ['test'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Tidak ada webhook aktif'), expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WebhookCommand — /announce & /announcements', () => {
  const cmd = new WebhookCommand();
  let isAdminSpy: any;

  beforeEach(async () => {
    await prisma.prdStateRecord.deleteMany({ where: { type: 'announcement', scope: GROUP_ID } });
    isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);
  });

  afterEach(async () => {
    await prisma.prdStateRecord.deleteMany({ where: { type: 'announcement', scope: GROUP_ID } });
    isAdminSpy?.mockRestore();
  });

  it('/announce creates formatted announcement', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/announce Rapat besok jam 10 pagi'), ['Rapat', 'besok', 'jam', '10', 'pagi'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('PENGUMUMAN RESMI'), expect.any(Object));
    const ann = await prisma.prdStateRecord.findFirst({ where: { type: 'announcement', scope: GROUP_ID } });
    expect(ann).not.toBeNull();
    expect(ann?.text).toContain('Rapat besok');
  });

  it('/announce shows error without message text', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/announce'), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Tulis pesan'), expect.any(Object));
  });

  it('/announce rejected by non-admin', async () => {
    isAdminSpy.mockResolvedValue(false);
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/announce test', USER_ID), ['test'], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Hanya Admin'), expect.any(Object));
  });

  it('/announcements shows empty state', async () => {
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/announcements'), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('Belum ada pengumuman'), expect.any(Object));
  });

  it('/announcements lists existing announcements', async () => {
    await cmd.execute(makeCtx('/announce Pengumuman pertama'), ['Pengumuman', 'pertama'], makeAdapter());
    const adapter = makeAdapter();
    await cmd.execute(makeCtx('/announcements'), [], adapter);
    expect(adapter.sendMessage).toHaveBeenCalledWith(GROUP_ID, expect.stringContaining('RIWAYAT PENGUMUMAN'), expect.any(Object));
  });
});
