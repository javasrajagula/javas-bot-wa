import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage } from '../commands/index.js';
import { AdminOpsCommand } from '../commands/admin/admin-ops.command.js';
import { parseFeatureFlags } from '../config/feature-flags.js';
import { env } from '../config/env.js';

describe('PRD Batch 1E — Admin, Owner & Operasional Features (F023-F028, F030)', () => {
  const groupId = 'test-group-admin-ops@g.us';
  const ownerId = '628129999999@s.whatsapp.net';
  const adminId = '628121111111@s.whatsapp.net';
  const userId = '628122222222@s.whatsapp.net';
  const customRoleId = '628123333333@s.whatsapp.net';

  let mockAdapter: any;
  let sentMessages: { chatId: string; text: string; options?: any }[] = [];

  const getSentMessage = (pattern: string) => {
    const msg = sentMessages.find(m => m.text.includes(pattern));
    if (!msg) {
      console.log(`[Test Error] Failed to find message containing "${pattern}". List:`, sentMessages.map(m => m.text));
    }
    expect(msg).toBeDefined();
    return msg!;
  };

  beforeAll(async () => {
    // Dynamic import to ensure the handler is registered
    await import('../commands/admin/admin-ops.command.js');

    // Mutate environment config dynamically so owner permissions are resolved properly
    env.OWNER_IDS = '628129999999';

    // Clean up DB before running tests
    await prisma.groupConfig.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId } });
    await prisma.groupSubscription.deleteMany({ where: { groupId } });
    await prisma.warning.deleteMany({ where: { groupId } });
    await prisma.errorLog.deleteMany({ where: { scope: groupId } });
    await prisma.usageLog.deleteMany({ where: { groupId } });
    await prisma.groupUserStats.deleteMany({ where: { groupId } });
    await prisma.errorRecord.deleteMany({});
    await prisma.premiumUser.deleteMany({});

    mockAdapter = {
      sock: {
        groupMetadata: async (jid: string) => {
          return {
            id: jid,
            participants: [
              { id: adminId, admin: 'admin' },
              { id: userId, admin: null },
              { id: customRoleId, admin: null }
            ]
          };
        }
      },
      sendMessage: async (chatId: string, text: string, options?: any) => {
        sentMessages.push({ chatId, text, options });
        return { key: { id: 'mock-msg-' + Math.random() } };
      }
    };
  });

  beforeEach(async () => {
    sentMessages = [];

    // Seed default group configuration
    await prisma.groupConfig.upsert({
      where: { groupId },
      create: {
        groupId,
        prefix: '/',
        botEnabled: true,
        featuresJson: JSON.stringify({
          prd_admin_ops: true
        })
      },
      update: {
        prefix: '/',
        botEnabled: true,
        featuresJson: JSON.stringify({
          prd_admin_ops: true
        })
      }
    });

    await prisma.customVariable.deleteMany({ where: { groupId } });
    await prisma.groupSubscription.deleteMany({ where: { groupId } });
    await prisma.groupSubscription.create({
      data: {
        groupId,
        plan: 'premium',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    await prisma.warning.deleteMany({ where: { groupId } });
    await prisma.errorLog.deleteMany({ where: { scope: groupId } });
    await prisma.usageLog.deleteMany({ where: { groupId } });
    await prisma.groupUserStats.deleteMany({ where: { groupId } });
    await prisma.errorRecord.deleteMany({});
  });

  afterAll(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId } });
    await prisma.groupSubscription.deleteMany({ where: { groupId } });
    await prisma.warning.deleteMany({ where: { groupId } });
    await prisma.errorLog.deleteMany({ where: { scope: groupId } });
    await prisma.usageLog.deleteMany({ where: { groupId } });
    await prisma.groupUserStats.deleteMany({ where: { groupId } });
    await prisma.errorRecord.deleteMany({});
    await prisma.premiumUser.deleteMany({});
  });

  const getCtx = (cmdName: string, args: string[], sender: string, body: string, isGroup: boolean = true): any => ({
    id: `msg-${Math.random()}`,
    chatId: isGroup ? groupId : sender,
    senderId: sender,
    body,
    isGroup,
    mentions: body.match(/@\d+/g)?.map(m => m.replace('@', '') + '@s.whatsapp.net') || [],
    command: {
      prefix: '/',
      rawCommandName: cmdName,
      commandName: cmdName,
      args,
      isCommand: true
    }
  });

  describe('F023: Custom Role (rolecustom)', () => {
    it('rejects custom role configuration if not in a group', async () => {
      const handler = new AdminOpsCommand();
      const ctx = getCtx('rolecustom', ['create', 'piket'], userId, '/rolecustom create piket', false);

      await handler.execute(ctx, ctx.command.args, mockAdapter);

      const msg = getSentMessage('hanya bisa digunakan di dalam grup');
      expect(msg).toBeDefined();
    });

    it('rejects custom role configuration if sender is not an admin', async () => {
      const handler = new AdminOpsCommand();
      const ctx = getCtx('rolecustom', ['create', 'piket'], userId, '/rolecustom create piket');

      await handler.execute(ctx, ctx.command.args, mockAdapter);

      const msg = getSentMessage('Hanya admin grup yang dapat');
      expect(msg).toBeDefined();
    });

    it('creates, assigns, grants, shows, and revokes custom roles successfully', async () => {
      const handler = new AdminOpsCommand();

      // 1. Create a custom role 'piket'
      const ctxCreate = getCtx('rolecustom', ['create', 'piket'], adminId, '/rolecustom create piket');
      await handler.execute(ctxCreate, ctxCreate.command.args, mockAdapter);
      getSentMessage('Peran kustom *piket* berhasil dibuat');

      // 2. Try to create duplicate role
      sentMessages = [];
      await handler.execute(ctxCreate, ctxCreate.command.args, mockAdapter);
      getSentMessage('sudah ada di grup ini');

      // 3. Assign role 'piket' to user
      sentMessages = [];
      const ctxAssign = getCtx('rolecustom', ['assign', 'piket', `@${customRoleId.split('@')[0]}`], adminId, `/rolecustom assign piket @${customRoleId.split('@')[0]}`);
      await handler.execute(ctxAssign, ctxAssign.command.args, mockAdapter);
      getSentMessage('Peran kustom *PIKET* berhasil ditugaskan');

      // Check JID custom role in DB
      const cvRole = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId,
            userId: customRoleId,
            key: 'role:custom'
          }
        }
      });
      expect(cvRole?.value).toBe('piket');

      // 4. Grant permission for 'grouphealth' command to custom role 'piket'
      sentMessages = [];
      const ctxGrant = getCtx('rolecustom', ['grant', 'piket', 'grouphealth'], adminId, '/rolecustom grant piket grouphealth');
      await handler.execute(ctxGrant, ctxGrant.command.args, mockAdapter);
      getSentMessage('sekarang memiliki izin untuk menjalankan perintah */grouphealth*');

      // 5. Show Custom Role Piket Details
      sentMessages = [];
      const ctxShow = getCtx('rolecustom', ['show', 'piket'], adminId, '/rolecustom show piket');
      await handler.execute(ctxShow, ctxShow.command.args, mockAdapter);
      const showMsg = getSentMessage('PERAN KUSTOM: PIKET');
      expect(showMsg.text).toContain('/grouphealth');

      // 6. Test routing integration: user with role 'piket' executes 'grouphealth'
      // normally grouphealth is minRole: admin, but piket is granted explicit access
      sentMessages = [];
      const ctxHealth = getCtx('grouphealth', [], customRoleId, '/grouphealth');
      await routeMessage(ctxHealth, mockAdapter);
      
      const healthMsg = getSentMessage('LAPORAN KESEHATAN GRUP');
      expect(healthMsg).toBeDefined();

      // 7. Revoke permission
      sentMessages = [];
      const ctxRevoke = getCtx('rolecustom', ['revoke', 'piket', 'grouphealth'], adminId, '/rolecustom revoke piket grouphealth');
      await handler.execute(ctxRevoke, ctxRevoke.command.args, mockAdapter);
      getSentMessage('Izin perintah */grouphealth* untuk peran kustom *PIKET* telah dicabut');

      // 8. Remove custom role from user
      sentMessages = [];
      const ctxRemove = getCtx('rolecustom', ['remove', `@${customRoleId.split('@')[0]}`], adminId, `/rolecustom remove @${customRoleId.split('@')[0]}`);
      await handler.execute(ctxRemove, ctxRemove.command.args, mockAdapter);
      getSentMessage('Peran kustom berhasil dihapus');

      // 9. List custom roles
      sentMessages = [];
      const ctxList = getCtx('rolecustom', [], adminId, '/rolecustom');
      await handler.execute(ctxList, ctxList.command.args, mockAdapter);
      getSentMessage('DAFTAR PERAN KUSTOM GRUP');
    });
  });

  describe('F024: Delegated Moderator (delegatedmod)', () => {
    it('manages delegated moderators successfully', async () => {
      const handler = new AdminOpsCommand();

      // 1. Add delegated mod
      const ctxAdd = getCtx('delegatedmod', ['add', `@${customRoleId.split('@')[0]}`], adminId, `/delegatedmod add @${customRoleId.split('@')[0]}`);
      await handler.execute(ctxAdd, ctxAdd.command.args, mockAdapter);
      getSentMessage('berhasil ditambahkan sebagai *Delegated Moderator*');

      // Verify db
      const cvMod = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId,
            userId: customRoleId,
            key: 'role:delegatedmod'
          }
        }
      });
      expect(cvMod?.value).toBe('true');

      // 2. List delegated mods
      sentMessages = [];
      const ctxList = getCtx('delegatedmod', [], adminId, '/delegatedmod');
      await handler.execute(ctxList, ctxList.command.args, mockAdapter);
      getSentMessage('DELEGATED MODERATOR KELAS/GRUP');

      // 3. Test permission system: delegated mod runs admin commands (e.g. rolecustom)
      sentMessages = [];
      const ctxModCreate = getCtx('rolecustom', ['create', 'siswa'], customRoleId, '/rolecustom create siswa');
      await handler.execute(ctxModCreate, ctxModCreate.command.args, mockAdapter);
      getSentMessage('Peran kustom *siswa* berhasil dibuat');

      // 4. Remove delegated mod
      sentMessages = [];
      const ctxRemove = getCtx('delegatedmod', ['remove', `@${customRoleId.split('@')[0]}`], adminId, `/delegatedmod remove @${customRoleId.split('@')[0]}`);
      await handler.execute(ctxRemove, ctxRemove.command.args, mockAdapter);
      getSentMessage('berhasil dihapus dari *Delegated Moderator*');
    });
  });

  describe('F025-F026: Config Snapshots, Config Diff (configdiff) and Rollback Config (rollbackconfig)', () => {
    it('creates snapshots, compares changes, and rolls back configuration', async () => {
      const handler = new AdminOpsCommand();

      // Seed snapshot first by toggling a feature or doing it directly
      const { saveGroupConfigSnapshot } = await import('../config/feature-flags.js');
      await saveGroupConfigSnapshot(groupId);

      // Verify snapshot exists in DB
      const snap = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId,
            userId: 'system',
            key: 'config_snapshot'
          }
        }
      });
      expect(snap).toBeDefined();

      // Change current prefix and feature config
      await prisma.groupConfig.update({
        where: { groupId },
        data: {
          prefix: '!',
          featuresJson: JSON.stringify({
            prd_admin_ops: false,
            werewolf: false
          })
        }
      });

      // 1. Run configdiff
      const ctxDiff = getCtx('configdiff', [], adminId, '/configdiff');
      await handler.execute(ctxDiff, ctxDiff.command.args, mockAdapter);
      const diffMsg = getSentMessage('PERBEDAAN KONFIGURASI GRUP');
      expect(diffMsg.text).toContain('Prefix');
      expect(diffMsg.text).toContain('prd_admin_ops');
      expect(diffMsg.text).toContain('werewolf');

      // 2. Run rollbackconfig
      sentMessages = [];
      const ctxRollback = getCtx('rollbackconfig', [], adminId, '/rollbackconfig');
      await handler.execute(ctxRollback, ctxRollback.command.args, mockAdapter);
      getSentMessage('Konfigurasi grup berhasil dikembalikan (rollback)');

      // Verify config rolled back in DB
      const current = await prisma.groupConfig.findUnique({ where: { groupId } });
      expect(current?.prefix).toBe('/');
      const features = parseFeatureFlags(current?.featuresJson || '{}');
      expect(features.prd_admin_ops).toBe(true);
      expect(features.werewolf).toBe(true);
    });
  });

  describe('F027: Command Policy Editor (policyeditor)', () => {
    it('manages command policies and affects command routing correctly', async () => {
      const handler = new AdminOpsCommand();

      // 1. Role policies (deny user role for /grouphealth)
      const ctxSetDeny = getCtx('policyeditor', ['set', 'grouphealth', 'user', 'deny'], adminId, '/policyeditor set grouphealth user deny');
      await handler.execute(ctxSetDeny, ctxSetDeny.command.args, mockAdapter);
      getSentMessage('Kebijakan peran untuk perintah *[/grouphealth]* berhasil diset');

      // Route grouphealth as a normal user (let's bypass normal minRole admin check by giving user temporary admin or testing routing)
      // Let's deny 'admin' role for 'grouphealth' command.
      sentMessages = [];
      const ctxSetDenyAdmin = getCtx('policyeditor', ['set', 'grouphealth', 'admin', 'deny'], adminId, '/policyeditor set grouphealth admin deny');
      await handler.execute(ctxSetDenyAdmin, ctxSetDenyAdmin.command.args, mockAdapter);

      // Now route message as admin
      sentMessages = [];
      const ctxRunHealth = getCtx('grouphealth', [], adminId, '/grouphealth');
      await routeMessage(ctxRunHealth, mockAdapter);
      getSentMessage('dinonaktifkan untuk peran Anda (ADMIN) oleh Admin');

      // Allow again
      sentMessages = [];
      const ctxSetAllowAdmin = getCtx('policyeditor', ['set', 'grouphealth', 'admin', 'allow'], adminId, '/policyeditor set grouphealth admin allow');
      await handler.execute(ctxSetAllowAdmin, ctxSetAllowAdmin.command.args, mockAdapter);

      // 2. Active Hours Policy: outside active hours
      sentMessages = [];
      // Calculate current Jakarta time
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const [hStr, mStr] = formatter.format(date).replace('.', ':').split(':');
      const h = Number(hStr);
      const m = Number(mStr);

      const formatTime = (hours: number, minutes: number) => {
        const normH = (hours + 24) % 24;
        return `${String(normH).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      };

      // Set outside range (e.g. starting in 2 hours, ending in 3 hours)
      const startOutside = formatTime(h + 2, m);
      const endOutside = formatTime(h + 3, m);

      const ctxSetTime = getCtx('policyeditor', ['time', 'grouphealth', startOutside, endOutside], adminId, `/policyeditor time grouphealth ${startOutside} ${endOutside}`);
      await handler.execute(ctxSetTime, ctxSetTime.command.args, mockAdapter);
      getSentMessage('Batasan jam aktif untuk perintah *[/grouphealth]* berhasil diset');

      // Now route grouphealth as admin. Should be blocked.
      sentMessages = [];
      await routeMessage(ctxRunHealth, mockAdapter);
      getSentMessage('tidak aktif saat ini. Perintah ini hanya dapat digunakan antara pukul');

      // Set inside range (e.g. starting 1 hour ago, ending in 1 hour)
      sentMessages = [];
      const startInside = formatTime(h - 1, m);
      const endInside = formatTime(h + 1, m);
      const ctxSetTimeInside = getCtx('policyeditor', ['time', 'grouphealth', startInside, endInside], adminId, `/policyeditor time grouphealth ${startInside} ${endInside}`);
      await handler.execute(ctxSetTimeInside, ctxSetTimeInside.command.args, mockAdapter);

      // Now route grouphealth as admin. Should succeed.
      sentMessages = [];
      await routeMessage(ctxRunHealth, mockAdapter);
      const healthMsg = getSentMessage('LAPORAN KESEHATAN GRUP');
      expect(healthMsg).toBeDefined();

      // 3. Plan level policy: requires premium subscription
      sentMessages = [];
      const ctxSetPlan = getCtx('policyeditor', ['plan', 'grouphealth', 'premium'], adminId, '/policyeditor plan grouphealth premium');
      await handler.execute(ctxSetPlan, ctxSetPlan.command.args, mockAdapter);
      getSentMessage('hanya dapat diakses pada paket minimal: *PREMIUM*');

      // Make group plan basic
      await prisma.groupSubscription.update({
        where: { groupId },
        data: { plan: 'basic' }
      });

      // Route grouphealth as admin. Should be blocked.
      sentMessages = [];
      await routeMessage(ctxRunHealth, mockAdapter);
      getSentMessage('memerlukan paket sewa minimal: *PREMIUM*');

      // Reset policy
      sentMessages = [];
      const ctxReset = getCtx('policyeditor', ['reset', 'grouphealth'], adminId, '/policyeditor reset grouphealth');
      await handler.execute(ctxReset, ctxReset.command.args, mockAdapter);
      getSentMessage('telah dihapus');
    });
  });

  describe('F028: Owner Task Queue (ownertaskqueue)', () => {
    it('rejects task queue operations for non-owner', async () => {
      const handler = new AdminOpsCommand();
      const ctx = getCtx('ownertaskqueue', [], adminId, '/ownertaskqueue');

      await handler.execute(ctx, ctx.command.args, mockAdapter);
      getSentMessage('khusus untuk Owner bot');
    });

    it('lists and resolves tasks in the owner queue successfully', async () => {
      const handler = new AdminOpsCommand();

      // Seed pending invoice
      const invoiceId = 'INV-TEST-001';
      await prisma.customVariable.create({
        data: {
          groupId: groupId,
          userId: userId,
          key: `invoice:${invoiceId}`,
          value: JSON.stringify({
            status: 'pending',
            amount: 50000,
            plan: 'premium',
            durationMonths: 3,
            userId: userId,
            groupId: groupId
          })
        }
      });

      // Seed pending appeal
      await prisma.customVariable.create({
        data: {
          groupId,
          userId,
          key: 'appeal',
          value: JSON.stringify({
            status: 'pending',
            reason: 'Salah pencet / spam stiker',
            groupId,
            userId
          })
        }
      });

      // Seed warning points (5 warning rows)
      await prisma.warning.createMany({
        data: Array.from({ length: 5 }, () => ({
          groupId,
          userId,
          reason: 'Spam'
        }))
      });

      // Seed open error
      const errorRecord = await prisma.errorRecord.create({
        data: {
          errorId: 'ERR-TEST-001',
          feature: 'grouphealth',
          scope: groupId,
          status: 'open'
        }
      });

      // 1. List pending tasks as owner
      const ctxList = getCtx('ownertaskqueue', [], ownerId, '/ownertaskqueue');
      await handler.execute(ctxList, ctxList.command.args, mockAdapter);
      const listMsg = getSentMessage('DAFTAR ANTRIAN TUGAS OWNER');
      expect(listMsg.text).toContain(invoiceId);
      expect(listMsg.text).toContain('spam');
      expect(listMsg.text).toContain(errorRecord.errorId);

      // 2. Resolve invoice (approve sewa premium for 3 months)
      sentMessages = [];
      const ctxResolveInv = getCtx('ownertaskqueue', ['resolve', 'invoice', invoiceId, 'approve'], ownerId, `/ownertaskqueue resolve invoice ${invoiceId} approve`);
      await handler.execute(ctxResolveInv, ctxResolveInv.command.args, mockAdapter);
      getSentMessage('Tugas Invoice INV-TEST-001 berhasil diselesaikan');

      // Verify DB invoice status is paid
      const dbInv = await prisma.customVariable.findFirst({
        where: { key: `invoice:${invoiceId}` }
      });
      expect(JSON.parse(dbInv!.value).status).toBe('paid');

      // Verify groupSubscription in DB is updated to premium
      const sub = await prisma.groupSubscription.findUnique({ where: { groupId } });
      expect(sub?.plan).toBe('premium');
      expect(sub?.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);

      // 3. Resolve appeal (approve appeal, cleans warnings)
      sentMessages = [];
      const ctxResolveAppeal = getCtx('ownertaskqueue', ['resolve', 'appeal', userId, 'approve'], ownerId, `/ownertaskqueue resolve appeal ${userId} approve`);
      await handler.execute(ctxResolveAppeal, ctxResolveAppeal.command.args, mockAdapter);
      getSentMessage('telah DISETUJUI');

      // Verify warnings deleted from DB
      const warningsCount = await prisma.warning.count({ where: { groupId, userId } });
      expect(warningsCount).toBe(0);

      // 4. Resolve error log
      sentMessages = [];
      const ctxResolveErr = getCtx('ownertaskqueue', ['resolve', 'error', errorRecord.errorId, 'resolve'], ownerId, `/ownertaskqueue resolve error ${errorRecord.errorId} resolve`);
      await handler.execute(ctxResolveErr, ctxResolveErr.command.args, mockAdapter);
      getSentMessage('berhasil ditandai selesai/resolved');

      // Verify error record status resolved in DB
      const updatedErr = await prisma.errorRecord.findUnique({ where: { errorId: errorRecord.errorId } });
      expect(updatedErr?.status).toBe('resolved');
    });
  });

  describe('F030: Group Health Score (grouphealth)', () => {
    it('calculates group health score based on active metrics', async () => {
      const handler = new AdminOpsCommand();

      // Seed 2 warnings
      await prisma.warning.createMany({
        data: [
          { groupId, userId, reason: 'Toxic' },
          { groupId, userId, reason: 'Spam link' }
        ]
      });

      // Seed 1 usageLog success and 1 failed (Command Success Rate check)
      await prisma.usageLog.createMany({
        data: [
          { groupId, userId, feature: 'sticker', command: 'stiker', success: true, status: 'success' },
          { groupId, userId, feature: 'downloader', command: 'tiktok', success: false, status: 'failed' }
        ]
      });

      // Seed 1 active user stats
      await prisma.groupUserStats.create({
        data: {
          groupId,
          userId,
          messageCount: 5,
          lastActiveAt: new Date()
        }
      });

      // Run grouphealth command
      const ctxHealth = getCtx('grouphealth', [], adminId, '/grouphealth');
      await handler.execute(ctxHealth, ctxHealth.command.args, mockAdapter);

      const healthMsg = getSentMessage('LAPORAN KESEHATAN GRUP');
      expect(healthMsg.text).toContain('Skor Kesehatan');
      expect(healthMsg.text).toContain('Pelanggaran Aturan: *2* kali');
    });
  });
});
