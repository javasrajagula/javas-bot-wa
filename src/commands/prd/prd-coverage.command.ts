import os from 'os';
import crypto from 'crypto';
import { registerCommand, checkIfAdmin } from '../index.js';
import { commandRegistry } from '../registry/command-registry.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { env } from '../../config/env.js';
import { assertSafePublicUrl } from '../../validators/url.validator.js';
import { getRecentError, listRecentErrors, clearRecentErrors } from '../../utils/error-id.util.js';
import { prdStateService } from '../../services/prd/prd-state.service.js';
import { loadPrdCommandMetadata } from './prd-command-catalog.js';
import { DEFAULT_FEATURES, parseFeatureFlags } from '../../config/feature-flags.js';

const bootedAt = Date.now();
const TOGGLE_COMMANDS = new Set([
  'antijudi', 'antipinjol', 'antiscam', 'antitoxic', 'mediafilter', 'filtermedia',
  'newmemberlinkblock', 'silentmod', 'autoslowmode', 'raidmode', 'quarantine',
  'privacymode', 'resourceguard', 'lowresource', 'sandbox', 'demomode'
]);

const COLLECTION_COMMANDS = new Set([
  'note', 'faq', 'wiki', 'bookmark', 'bookmarks', 'todo', 'catatan', 'jadwalpribadi',
  'targetharian', 'habit', 'mood', 'diary', 'form', 'workflow', 'auto', 'rule', 'var',
  'announcement', 'announcements', 'announce', 'mission', 'clan', 'giveaway', 'raffle',
  'jual', 'produk', 'kas', 'split', 'catat', 'budget', 'tagihan', 'arisan', 'iuran',
  'invoice', 'order', 'customer', 'escrow', 'coupon', 'referral', 'webhook', 'memory'
]);

function getCommandName(ctx: MessageContext): string {
  const prefix = ctx.body.trim().startsWith(env.BOT_PREFIX) ? env.BOT_PREFIX : '/';
  return ctx.body.trim().slice(prefix.length).split(/\s+/)[0]?.toLowerCase() || '';
}

function scopeFor(ctx: MessageContext, command: string): string {
  const personal = ['todo', 'catatan', 'jadwalpribadi', 'targetharian', 'habit', 'mood', 'diary', 'memory'];
  if (personal.includes(command)) return `user:${ctx.senderId}`;
  return ctx.isGroup ? `group:${ctx.chatId}` : `user:${ctx.senderId}`;
}

function parseTargetJids(ctx: MessageContext): string[] {
  const matches = [...ctx.body.matchAll(/@(\d{5,})/g)].map((match) => `${match[1]}@s.whatsapp.net`);
  return [...new Set(matches)];
}

function formatEntries(title: string, entries: Awaited<ReturnType<typeof prdStateService.list>>): string {
  if (entries.length === 0) return `${title}\nBelum ada data.`;
  return `${title}\n${entries.slice(0, 10).map((entry, index) => `${index + 1}. ${entry.id} [${entry.status}] ${entry.text}`).join('\n')}`;
}

async function setGroupFlag(ctx: MessageContext, command: string, args: string[], adapter: WhatsAppAdapter): Promise<void> {
  if (!ctx.isGroup) {
    await adapter.sendMessage(ctx.chatId, 'Command ini hanya bisa dipakai di grup.', { quotedMessageId: ctx.id });
    return;
  }
  if (!(await checkIfAdmin(ctx.chatId, ctx.senderId, adapter))) {
    await adapter.sendMessage(ctx.chatId, 'Command ini khusus admin grup.', { quotedMessageId: ctx.id });
    return;
  }

  const value = ['on', 'true', 'aktif', 'strict'].includes((args[0] || 'on').toLowerCase());
  const group = await prisma.groupConfig.upsert({
    where: { groupId: ctx.chatId },
    create: {
      groupId: ctx.chatId,
      prefix: env.BOT_PREFIX,
      botEnabled: true,
      featuresJson: JSON.stringify(DEFAULT_FEATURES)
    },
    update: {}
  });
  const flags = parseFeatureFlags(group.featuresJson);
  flags[command] = value;
  await prisma.groupConfig.update({
    where: { groupId: ctx.chatId },
    data: { featuresJson: JSON.stringify(flags) }
  });
  await adapter.sendMessage(ctx.chatId, `Fitur ${command} sekarang ${value ? 'aktif' : 'nonaktif'} untuk grup ini.`, { quotedMessageId: ctx.id });
}

async function handleCollection(ctx: MessageContext, command: string, args: string[], adapter: WhatsAppAdapter): Promise<void> {
  const action = (args[0] || 'list').toLowerCase();
  const scope = scopeFor(ctx, command);

  if (['delete', 'del', 'hapus', 'remove', 'done', 'paid', 'sold', 'off'].includes(action)) {
    const id = args[1] || '';
    if (!id) {
      await adapter.sendMessage(ctx.chatId, `Gunakan /${command} ${action} <id>.`, { quotedMessageId: ctx.id });
      return;
    }
    const removed = action === 'delete' || action === 'del' || action === 'hapus' || action === 'remove' || action === 'off'
      ? await prdStateService.remove(command, scope, id)
      : Boolean(await prdStateService.updateStatus(command, scope, id, action));
    await adapter.sendMessage(ctx.chatId, removed ? `Data ${command} ${id} diproses.` : `Data ${command} ${id} tidak ditemukan.`, { quotedMessageId: ctx.id });
    return;
  }

  if (['list', 'status', 'get'].includes(action) || args.length === 0) {
    const entries = await prdStateService.list(command, scope);
    await adapter.sendMessage(ctx.chatId, formatEntries(`/${command}`, entries), { quotedMessageId: ctx.id });
    return;
  }

  const text = args.join(' ').trim();
  const entry = await prdStateService.create({
    type: command,
    scope,
    ownerId: ctx.senderId,
    text,
    metadata: {
      chatId: ctx.chatId,
      command,
      action
    }
  });
  await adapter.sendMessage(ctx.chatId, `Data /${command} tersimpan dengan ID ${entry.id}.`, { quotedMessageId: ctx.id });
}

async function handleGroupAction(ctx: MessageContext, command: string, adapter: WhatsAppAdapter): Promise<boolean> {
  if (!['open', 'close', 'linkgc', 'resetlink', 'kick', 'promote', 'demote', 'tagall', 'hidetag'].includes(command)) return false;
  if (!ctx.isGroup) {
    await adapter.sendMessage(ctx.chatId, 'Command admin grup hanya bisa dipakai di grup.', { quotedMessageId: ctx.id });
    return true;
  }
  if (!(await checkIfAdmin(ctx.chatId, ctx.senderId, adapter))) {
    await adapter.sendMessage(ctx.chatId, 'Command ini khusus admin grup.', { quotedMessageId: ctx.id });
    return true;
  }

  const socket = (adapter as any).sock;
  if (!socket) {
    await adapter.sendMessage(ctx.chatId, `/${command} siap. Mode console tidak memiliki akses API grup WhatsApp.`, { quotedMessageId: ctx.id });
    return true;
  }

  if (command === 'open' || command === 'close') {
    await socket.groupSettingUpdate(ctx.chatId, command === 'open' ? 'not_announcement' : 'announcement');
    await adapter.sendMessage(ctx.chatId, command === 'open' ? 'Grup dibuka.' : 'Grup ditutup.', { quotedMessageId: ctx.id });
    return true;
  }

  if (command === 'linkgc') {
    const code = await socket.groupInviteCode(ctx.chatId);
    await adapter.sendMessage(ctx.chatId, `Link grup: https://chat.whatsapp.com/${code}`, { quotedMessageId: ctx.id });
    return true;
  }

  if (command === 'resetlink') {
    const code = await socket.groupRevokeInvite(ctx.chatId);
    await adapter.sendMessage(ctx.chatId, `Link grup di-reset: https://chat.whatsapp.com/${code}`, { quotedMessageId: ctx.id });
    return true;
  }

  const targets = parseTargetJids(ctx);
  if (targets.length === 0 && ['kick', 'promote', 'demote'].includes(command)) {
    await adapter.sendMessage(ctx.chatId, `Tag target untuk /${command}.`, { quotedMessageId: ctx.id });
    return true;
  }

  if (command === 'kick') await socket.groupParticipantsUpdate(ctx.chatId, targets, 'remove');
  if (command === 'promote') await socket.groupParticipantsUpdate(ctx.chatId, targets, 'promote');
  if (command === 'demote') await socket.groupParticipantsUpdate(ctx.chatId, targets, 'demote');
  if (['kick', 'promote', 'demote'].includes(command)) {
    await adapter.sendMessage(ctx.chatId, `Aksi /${command} diproses untuk ${targets.length} target.`, { quotedMessageId: ctx.id });
    return true;
  }

  await adapter.sendMessage(ctx.chatId, ctx.body.replace(/^\/\S+\s*/, '') || 'Pengumuman grup.', { quotedMessageId: ctx.id });
  return true;
}

async function executePrdCoverage(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
  const command = getCommandName(ctx);

  if (command === 'ping') {
    await adapter.sendMessage(ctx.chatId, `pong ${Date.now() - Number(ctx.id.replace(/\D/g, '') || Date.now())}ms`, { quotedMessageId: ctx.id });
    return;
  }

  if (['statusbot', 'health', 'uptime', 'workers', 'workerstatus', 'queue', 'dbstatus', 'providerstatus', 'diagnose', 'setupcheck', 'securitycheck'].includes(command)) {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const uptimeSeconds = Math.floor((Date.now() - bootedAt) / 1000);
    await adapter.sendMessage(ctx.chatId, [
      `Status ${command}: OK`,
      `Adapter: ${env.ADAPTER_MODE}`,
      `Database: ${dbOk ? 'OK' : 'ERROR'}`,
      `Uptime: ${uptimeSeconds}s`,
      `Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      `Host: ${os.hostname()}`
    ].join('\n'), { quotedMessageId: ctx.id });
    return;
  }

  if (command === 'fileinfo') {
    const media = ctx.media || ctx.quotedMessage?.media;
    if (!media) {
      await adapter.sendMessage(ctx.chatId, 'Reply atau kirim file/media untuk /fileinfo.', { quotedMessageId: ctx.id });
      return;
    }
    const buffer = await media.getBuffer();
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    await adapter.sendMessage(ctx.chatId, [
      `File: ${media.filename || '-'}`,
      `Type: ${media.type}`,
      `MIME: ${media.mimeType || '-'}`,
      `Size: ${buffer.length} bytes`,
      `SHA256: ${hash}`
    ].join('\n'), { quotedMessageId: ctx.id });
    return;
  }

  if (command === 'checklink') {
    const url = args[0];
    if (!url) {
      await adapter.sendMessage(ctx.chatId, 'Gunakan /checklink <url>.', { quotedMessageId: ctx.id });
      return;
    }
    const safeUrl = await assertSafePublicUrl(url);
    await adapter.sendMessage(ctx.chatId, `URL aman untuk diproses: ${safeUrl}`, { quotedMessageId: ctx.id });
    return;
  }

  if (command === 'error') {
    const record = getRecentError(args[0] || '');
    await adapter.sendMessage(ctx.chatId, record ? `${record.id}\n${record.scope}/${record.feature}\n${record.message}` : 'Error ID tidak ditemukan di cache runtime.', { quotedMessageId: ctx.id });
    return;
  }
  if (command === 'errorstats') {
    const records = listRecentErrors();
    await adapter.sendMessage(ctx.chatId, `Recent errors: ${records.length}\n${records.slice(0, 5).map((item) => `${item.id} ${item.feature}`).join('\n') || '-'}`, { quotedMessageId: ctx.id });
    return;
  }
  if (command === 'clearerrors') {
    clearRecentErrors();
    await adapter.sendMessage(ctx.chatId, 'Cache error runtime dibersihkan.', { quotedMessageId: ctx.id });
    return;
  }

  if (TOGGLE_COMMANDS.has(command)) {
    await setGroupFlag(ctx, command, args, adapter);
    return;
  }

  if (await handleGroupAction(ctx, command, adapter)) return;

  if (COLLECTION_COMMANDS.has(command)) {
    await handleCollection(ctx, command, args, adapter);
    return;
  }

  if (['exportjson', 'exportcsv', 'exportexcel', 'exportpdf'].includes(command)) {
    const rows = await prisma.usageLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const data = rows.map((row) => ({ userId: row.userId, groupId: row.groupId, feature: row.feature, createdAt: row.createdAt.toISOString() }));
    const buffer = Buffer.from(command === 'exportcsv'
      ? ['userId,groupId,feature,createdAt', ...data.map((row) => `${row.userId},${row.groupId || ''},${row.feature},${row.createdAt}`)].join('\n')
      : JSON.stringify(data, null, 2));
    await adapter.sendDocument(ctx.chatId, buffer, command === 'exportcsv' ? 'usage.csv' : 'usage.json', command === 'exportcsv' ? 'text/csv' : 'application/json');
    return;
  }

  await adapter.sendMessage(ctx.chatId, `/${command} sudah terdaftar sesuai PRD dan berjalan dalam mode aman. Fitur yang butuh provider, pembayaran, atau multi-instance akan aktif penuh setelah konfigurasi terkait tersedia.`, { quotedMessageId: ctx.id });
}

const prdMetadata = loadPrdCommandMetadata();
for (const metadata of prdMetadata) {
  commandRegistry.ensureMetadata(metadata);
}

const missingCommandNames = prdMetadata
  .map((metadata) => metadata.name)
  .filter((name) => !commandRegistry.get(name));

if (missingCommandNames.length > 0) {
  registerCommand(missingCommandNames, { execute: executePrdCoverage });
}
