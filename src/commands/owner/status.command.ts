import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import { env } from '../../config/env.js';
import { hdQueue, downloaderQueue, generalQueue } from '../../queues/queue.js';
import { pluginManager } from '../../config/plugins.js';
import prisma from '../../db/client.js';
import os from 'os';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Track bot start time globally
const BOT_START_TIME = Date.now();

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}hari ${h % 24}jam ${m % 60}menit`;
  if (h > 0) return `${h}jam ${m % 60}menit ${s % 60}detik`;
  if (m > 0) return `${m}menit ${s % 60}detik`;
  return `${s}detik`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

async function checkDatabase(): Promise<{ ok: boolean; latency?: number }> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latency: Date.now() - start };
  } catch {
    return { ok: false };
  }
}

function checkFfmpeg(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkTempFolder(): boolean {
  try {
    const tmpDir = path.join(process.cwd(), 'temp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const testFile = path.join(tmpDir, '.write_test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

function checkBackupFolder(): boolean {
  try {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export class StatusHealthCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const commandType = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // /ping — simple latency check
    if (commandType === 'ping') {
      const start = Date.now();
      await adapter.sendMessage(ctx.chatId, '🏓 Pong!', { quotedMessageId: ctx.id });
      const latency = Date.now() - start;
      await adapter.sendMessage(ctx.chatId, `⚡ Latensi: *${latency}ms*`);
      return;
    }

    // /uptime — quick uptime info
    if (commandType === 'uptime') {
      const uptime = Date.now() - BOT_START_TIME;
      await adapter.sendMessage(ctx.chatId,
        `⏱️ *Bot Uptime*\n\n🕐 Berjalan selama: *${formatUptime(uptime)}*\n📅 Mulai: ${new Date(BOT_START_TIME).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // /statusbot — full status
    if (commandType === 'statusbot' || commandType === 'status') {
      const mem = process.memoryUsage();
      const uptime = Date.now() - BOT_START_TIME;
      const db = await checkDatabase();

      const hdActive = hdQueue.getActiveJobs().length;
      const dlActive = downloaderQueue.getActiveJobs().length;
      const genActive = generalQueue.getActiveJobs().length;

      // Get today's stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [cmdToday, errToday, activeGroups] = await Promise.all([
        prisma.usageLog.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.errorLog.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.groupConfig.count({ where: { botEnabled: true } })
      ]);

      const status = [
        `🤖 *Status Bot — Javas Bot WA*`,
        ``,
        `📡 *Koneksi*`,
        `├ Adapter: ${env.ADAPTER_MODE}`,
        `├ Database: ${db.ok ? `✅ Online (${db.latency}ms)` : '❌ Offline'}`,
        `└ Redis: ${env.REDIS_ENABLED ? '✅ Aktif' : '⚠️ Tidak aktif (Memory mode)'}`,
        ``,
        `⏱️ *Performa*`,
        `├ Uptime: ${formatUptime(uptime)}`,
        `├ RAM: ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}`,
        `└ RSS: ${formatBytes(mem.rss)}`,
        ``,
        `📊 *Statistik Hari Ini*`,
        `├ Command diproses: ${cmdToday}`,
        `├ Error: ${errToday}`,
        `└ Grup aktif: ${activeGroups}`,
        ``,
        `⚙️ *Queue*`,
        `├ HD Upscale: ${hdActive} aktif`,
        `├ Downloader: ${dlActive} aktif`,
        `└ General: ${genActive} aktif`,
        ``,
        `🕐 ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
      ].join('\n');

      await adapter.sendMessage(ctx.chatId, status, { quotedMessageId: ctx.id });
      return;
    }

    // /health — quick health check
    if (commandType === 'health') {
      const db = await checkDatabase();
      const mem = process.memoryUsage();
      const memPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

      const healthStatus = db.ok && memPercent < 90;
      const emoji = healthStatus ? '✅' : '⚠️';

      await adapter.sendMessage(ctx.chatId,
        `${emoji} *Health Check*\n\n` +
        `💾 Database: ${db.ok ? `Online (${db.latency}ms)` : '❌ Offline'}\n` +
        `🧠 Memory: ${memPercent}% (${formatBytes(mem.heapUsed)})\n` +
        `⏱️ Uptime: ${formatUptime(Date.now() - BOT_START_TIME)}`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // /workers & /workerstatus — queue worker status
    if (commandType === 'workers' || commandType === 'workerstatus') {
      const hdActive = hdQueue.getActiveJobs().length;
      const hdPending = hdQueue.getLength();
      const dlActive = downloaderQueue.getActiveJobs().length;
      const dlPending = downloaderQueue.getLength();
      const genActive = generalQueue.getActiveJobs().length;
      const genPending = generalQueue.getLength();

      const report = [
        `⚙️ *Status Worker & Queue*`,
        ``,
        `🖼️ *HD Upscale Queue*`,
        `├ Aktif: ${hdActive}`,
        `└ Antrian: ${hdPending}`,
        ``,
        `📥 *Downloader Queue*`,
        `├ Aktif: ${dlActive}`,
        `└ Antrian: ${dlPending}`,
        ``,
        `🔧 *General Queue*`,
        `├ Aktif: ${genActive}`,
        `└ Antrian: ${genPending}`,
        ``,
        `Total job aktif: ${hdActive + dlActive + genActive}`,
        `Total dalam antrian: ${hdPending + dlPending + genPending}`
      ].join('\n');

      await adapter.sendMessage(ctx.chatId, report, { quotedMessageId: ctx.id });
      return;
    }

    // /diagnose — system diagnostics (owner only)
    if (commandType === 'diagnose') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk Owner.', { quotedMessageId: ctx.id });
        return;
      }

      const db = await checkDatabase();
      const ffmpegOk = checkFfmpeg();
      const tempOk = checkTempFolder();
      const backupOk = checkBackupFolder();
      const mem = process.memoryUsage();
      const freeRam = os.freemem();
      const totalRam = os.totalmem();
      const cpuLoad = os.loadavg();

      const plugins = pluginManager.listPlugins();
      const enabledCount = plugins.filter(p => p.enabled).length;

      const report = [
        `🔬 *Diagnosa Sistem*`,
        ``,
        `💻 *Hardware*`,
        `├ CPU Load: ${cpuLoad[0].toFixed(2)} / ${cpuLoad[1].toFixed(2)} / ${cpuLoad[2].toFixed(2)}`,
        `├ RAM Bebas: ${formatBytes(freeRam)} / ${formatBytes(totalRam)}`,
        `└ Heap: ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}`,
        ``,
        `🔧 *Layanan*`,
        `├ Database: ${db.ok ? `✅ (${db.latency}ms)` : '❌ Offline'}`,
        `├ FFmpeg: ${ffmpegOk ? '✅ Tersedia' : '❌ Tidak ditemukan'}`,
        `├ Redis: ${env.REDIS_ENABLED ? '✅ Aktif' : '⚠️ Memory mode'}`,
        `├ Temp Folder: ${tempOk ? '✅ Writable' : '❌ Tidak bisa tulis'}`,
        `└ Backup Folder: ${backupOk ? '✅ Ok' : '❌ Gagal'}`,
        ``,
        `🔌 *Plugin*`,
        `├ Total: ${plugins.length}`,
        `└ Aktif: ${enabledCount}`,
        ``,
        `🌐 *Konfigurasi*`,
        `├ Adapter: ${env.ADAPTER_MODE}`,
        `├ Environment: ${env.NODE_ENV || 'development'}`,
        `└ Dashboard: ${env.DASHBOARD_ENABLED ? '✅ Aktif' : '❌ Nonaktif'}`
      ].join('\n');

      await adapter.sendMessage(ctx.chatId, report, { quotedMessageId: ctx.id });
      return;
    }

    // /securitycheck — security audit (owner only)
    if (commandType === 'securitycheck' || commandType === 'setupcheck') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk Owner.', { quotedMessageId: ctx.id });
        return;
      }

      const checks: { label: string; ok: boolean; note?: string }[] = [];

      // Owner configured
      const ownerIds = env.OWNER_IDS || [];
      checks.push({ label: 'Owner dikonfigurasi', ok: ownerIds.length > 0, note: ownerIds.length === 0 ? 'Tambahkan OWNER_IDS di .env' : undefined });

      // Dashboard password
      const dashPassSet = !!(env.OWNER_DASHBOARD_PASSWORD && env.OWNER_DASHBOARD_PASSWORD.length >= 8);
      checks.push({ label: 'Password dashboard kuat', ok: dashPassSet, note: !dashPassSet ? 'Atur OWNER_DASHBOARD_PASSWORD ≥ 8 karakter' : undefined });

      // Dashboard enabled warning
      if (env.DASHBOARD_ENABLED) {
        const httpsWarning = !(env.PUBLIC_BASE_URL || '').startsWith('https');
        checks.push({ label: 'Dashboard HTTPS', ok: !httpsWarning, note: httpsWarning ? 'Gunakan HTTPS di production (PUBLIC_BASE_URL)' : undefined });
      }

      // Database
      const db = await checkDatabase();
      checks.push({ label: 'Database online', ok: db.ok });

      // FFmpeg
      const ffmpegOk = checkFfmpeg();
      checks.push({ label: 'FFmpeg tersedia', ok: ffmpegOk, note: !ffmpegOk ? 'Install FFmpeg untuk fitur media/audio' : undefined });

      // Session folder
      const sessionDir = path.join(process.cwd(), 'wa-session');
      const sessionOk = fs.existsSync(sessionDir);
      checks.push({ label: 'Session folder ada', ok: sessionOk });

      // Temp folder writable
      const tempOk = checkTempFolder();
      checks.push({ label: 'Temp folder writable', ok: tempOk });

      // Plugin persistence
      const pluginOk = db.ok;
      checks.push({ label: 'Plugin state persistent (DB)', ok: pluginOk });

      const passed = checks.filter(c => c.ok).length;
      const failed = checks.filter(c => !c.ok).length;

      const lines = [
        `🔒 *Security & Setup Check*`,
        ``,
        ...checks.map(c => {
          const icon = c.ok ? '✅' : '❌';
          const note = c.note ? ` → ${c.note}` : '';
          return `${icon} ${c.label}${note}`;
        }),
        ``,
        `📊 Lulus: ${passed}/${checks.length} | Gagal: ${failed}`
      ];

      await adapter.sendMessage(ctx.chatId, lines.join('\n'), { quotedMessageId: ctx.id });
      return;
    }

    // /providerstatus
    if (commandType === 'providerstatus') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk Owner.', { quotedMessageId: ctx.id });
        return;
      }

      const ffmpegOk = checkFfmpeg();
      const ocrCmd = env.OCR_COMMAND || 'tesseract';
      const sttCmd = env.STT_COMMAND || 'whisper';
      let ocrOk = false;
      let sttOk = false;

      try { execSync(`${ocrCmd} --version`, { stdio: 'ignore' }); ocrOk = true; } catch {}
      try { execSync(`${sttCmd} --version`, { stdio: 'ignore' }); sttOk = true; } catch {}

      const lines = [
        `📡 *Status Provider Eksternal*`,
        ``,
        `🎬 FFmpeg: ${ffmpegOk ? '✅' : '❌'} ${ffmpegOk ? 'Tersedia' : 'Tidak ditemukan'}`,
        `📝 OCR (${ocrCmd}): ${ocrOk ? '✅' : '❌'} ${ocrOk ? 'Tersedia' : 'Tidak ditemukan'}`,
        `🎤 STT (${sttCmd}): ${sttOk ? '✅' : '❌'} ${sttOk ? 'Tersedia' : 'Tidak ditemukan'}`,
        `🤖 AI Provider: ${env.AI_PROVIDER || '(tidak dikonfigurasi)'}`,
        ``,
        `💡 Install yang hilang sesuai kebutuhan fitur.`
      ];

      await adapter.sendMessage(ctx.chatId, lines.join('\n'), { quotedMessageId: ctx.id });
      return;
    }

    // /dbstatus
    if (commandType === 'dbstatus') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk Owner.', { quotedMessageId: ctx.id });
        return;
      }

      const db = await checkDatabase();
      const [
        groupCount, userCount, logCount, errorCount,
        premiumCount, reminderCount
      ] = await Promise.all([
        prisma.groupConfig.count(),
        prisma.userProfile.count(),
        prisma.usageLog.count(),
        prisma.errorLog.count(),
        prisma.premiumUser.count(),
        prisma.reminder.count({ where: { status: 'pending' } })
      ]);

      const lines = [
        `🗄️ *Status Database*`,
        ``,
        `Status: ${db.ok ? `✅ Online (${db.latency}ms)` : '❌ Offline'}`,
        `Provider: ${env.DATABASE_URL?.startsWith('postgresql') ? 'PostgreSQL' : 'SQLite'}`,
        ``,
        `📊 *Record Count*`,
        `├ Grup terdaftar: ${groupCount}`,
        `├ User profil: ${userCount}`,
        `├ Premium aktif: ${premiumCount}`,
        `├ Log penggunaan: ${logCount}`,
        `├ Log error: ${errorCount}`,
        `└ Reminder pending: ${reminderCount}`
      ];

      await adapter.sendMessage(ctx.chatId, lines.join('\n'), { quotedMessageId: ctx.id });
      return;
    }
  }
}

// Register all status & health commands
const cmd = new StatusHealthCommand();
registerCommand(['ping'], cmd);
registerCommand(['statusbot', 'status'], cmd);
registerCommand(['health'], cmd);
registerCommand(['uptime'], cmd);
registerCommand(['workers', 'workerstatus'], cmd);
registerCommand(['diagnose'], cmd);
registerCommand(['securitycheck', 'setupcheck'], cmd);
registerCommand(['providerstatus'], cmd);
registerCommand(['dbstatus'], cmd);
