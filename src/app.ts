import { env } from './config/env.js';
import prisma from './db/client.js';
import { pluginManager } from './config/plugins.js';
import { routeMessage } from './commands/index.js';
import { werewolfEngine } from './services/werewolf/werewolf.engine.js';
import { startCleanupInterval } from './utils/file.util.js';

// Dynamically import all command files via CommandRegistry lazy loading
import { getMaintenanceMode } from './commands/owner/owner.command.js';
import './commands/prd/prd-coverage.command.js';
import { startReminderWorker } from './workers/reminder.worker.js';
import { startTempAdminWorker } from './workers/tempadmin.worker.js';
import { startSchedMuteWorker } from './workers/schedmute.worker.js';
import { achievementService } from './services/achievement/achievement.service.js';
import { backupService } from './services/backup/backup.service.js';
import { startDashboardServer } from './services/dashboard/dashboard.server.js';
import { seedSystemDefaults } from './services/system/system-seed.service.js';
import { localizerService } from './services/system/localizer.service.js';

async function bootstrap() {
  console.log('[System] Connecting to database...');
  await prisma.$connect();
  console.log('[System] Database connected successfully.');

  console.log('[System] Loading maintenance mode status...');
  await getMaintenanceMode();

  console.log('[System] Synchronizing plugin states...');
  await pluginManager.syncWithDatabase();

  console.log('[System] Initializing Achievements...');
  await achievementService.initAchievements();
  await seedSystemDefaults();
  console.log('[System] Default shop items and warning rules initialized.');

  console.log('[System] Checking system dependencies...');
  try {
    const { checkAllDependencies } = await import('./services/system/dependency-check.service.js');
    const deps = await checkAllDependencies();
    if (!deps.ffmpeg) console.warn('[WARNING] FFmpeg tidak terdeteksi. Fitur media dan sticker akan gagal.');
    if (!deps.ffprobe) console.warn('[WARNING] FFprobe tidak terdeteksi. Durasi media tidak dapat diperiksa.');
    if (env.STT_COMMAND && !deps.sttCommand) console.warn(`[WARNING] STT_COMMAND "${env.STT_COMMAND}" tidak ditemukan. Fitur transkrip akan dinonaktifkan.`);
    if (env.OCR_COMMAND && !deps.ocrCommand) console.warn(`[WARNING] OCR_COMMAND "${env.OCR_COMMAND}" tidak ditemukan.`);
  } catch (err) {
    console.error('[System] Gagal melakukan startup preflight dependency check:', err);
  }

  console.log('[System] Initializing Werewolf Game Engine...');
  await werewolfEngine.boot();
  console.log('[System] Werewolf Game Engine initialized.');

  // Set up cleanup cron-like interval to sweep old temp files
  startCleanupInterval();
  console.log('[System] Temp files auto-cleanup scheduler started.');

  backupService.startAutoBackup();
  console.log('[System] Backup scheduler initialized.');

  // Pick WhatsApp connection adapter based on config
 // Pick WhatsApp connection adapter based on config
  // Pick WhatsApp connection adapter based on config
  let adapter: any;

  if (env.ADAPTER_MODE === 'baileys') {
    console.log('[System] Starting in WhatsApp Baileys mode...');
    const { BaileysAdapter } = await import('./bot/baileys.adapter.js');
    adapter = new BaileysAdapter();
  } else {
    console.log('[System] Starting in Console simulation mode...');
    const { ConsoleAdapter } = await import('./bot/console.adapter.js');
    adapter = new ConsoleAdapter();
  }

  const { AdapterHolder } = await import('./bot/adapter-holder.js');
  AdapterHolder.setAdapter(adapter);

  // Register werewolf callbacks for adaptive messaging (group and private DMs)
  werewolfEngine.setNotificationCallbacks({
    sendGroupMessage: async (groupId, text) => {
      await adapter.sendMessage(groupId, text);
    },
    sendPrivateMessage: async (userId, text) => {
      await adapter.sendMessage(userId, text);
    }
  });

  const groupJoins = new Map<string, number[]>();

  // Register group participant updates for welcome/goodbye
  adapter.onGroupUpdate(async (update: any) => {
    const { groupId, participants, action } = update;
    try {
      const config = await prisma.groupConfig.findUnique({
        where: { groupId }
      });
      if (!config) return;

      const { parseFeatureFlags } = await import('./config/feature-flags.js');
      const features = parseFeatureFlags(config.featuresJson);

      // --- ANTI-RAID SHIELD CHECK ---
      if (action === 'add' && features.antiraid) {
        const now = Date.now();
        const limit = features.antiraidLimit || 10;
        const duration = (features.antiraidDuration || 60) * 1000;

        if (!groupJoins.has(groupId)) {
          groupJoins.set(groupId, []);
        }

        const timestamps = groupJoins.get(groupId)!;
        for (const p of participants) {
          timestamps.push(now);
        }

        // Clean old timestamps
        const validTimestamps = timestamps.filter(t => now - t <= duration);
        groupJoins.set(groupId, validTimestamps);

        if (validTimestamps.length > limit) {
          try {
            const socket = (adapter as any).sock;
            if (socket && typeof socket.groupSettingUpdate === 'function') {
              await socket.groupSettingUpdate(groupId, 'announcement');
              
              // Update status lockdown di features
              const updatedFeatures = { ...features, lockdown: true };
              await prisma.groupConfig.update({
                where: { groupId },
                data: { featuresJson: JSON.stringify(updatedFeatures) }
              });

              const alertMsg = `⚠️ *ANTI-RAID SHIELD TERPICU* ⚠️\n\nTerdeteksi join massal sebanyak *${validTimestamps.length}* pengguna dalam *${features.antiraidDuration || 60}* detik.\n\n🛡️ *Tindakan Keamanan:* Grup telah dikunci otomatis (hanya Admin yang dapat mengirim pesan) untuk mencegah spam/serangan raid.`;
              await adapter.sendMessage(groupId, alertMsg);
            }
          } catch (err) {
            console.error('[Anti-Raid] Gagal mengunci grup:', err);
          }
        }
      }

      // 1. Welcome Msg
      if (action === 'add') {
        const { interpolateTemplate } = await import('./commands/community/welcome.command.js');
        const { stateStore } = await import('./services/state/state-store.js');
        const locale = await localizerService.getGroupLocale(groupId);

        for (const participant of participants) {
          // Log join event
          await prisma.groupLog.create({
            data: {
              groupId,
              userId: participant,
              type: 'join',
              action: 'user_joined',
              message: 'Pengguna bergabung ke grup'
            }
          }).catch(err => console.error('Failed to log join event:', err));

          const nowHour = new Date().getHours();
          const isQuietHours = nowHour >= 22 || nowHour < 6;

          // Captcha Verification
          if (features.captcha && !isQuietHours) {
            const a = Math.floor(Math.random() * 9) + 1;
            const b = Math.floor(Math.random() * 9) + 1;
            const answer = String(a + b);

            let welcomeText = '';
            if (features.welcome) {
              const rawWelcome = features.welcomeMessage || localizerService.format('welcome_default', locale);
              welcomeText = await interpolateTemplate(rawWelcome, participant, groupId, adapter);
            }

            const captchaKey = `captcha:${groupId}:${participant}`;
            await stateStore.set(captchaKey, {
              answer,
              expiresAt: Date.now() + 120_000,
              welcomeText
            }, 120); // 120s TTL

            await adapter.sendMessage(
              groupId,
              `⚠️ *VERIFIKASI CAPTCHA* ⚠️\n\nHalo @${participant.split('@')[0]}, silakan jawab matematika berikut untuk masuk ke grup:\n*${a} + ${b} = ?*\n\nKetik jawabannya di grup ini dalam waktu 2 menit, atau Anda akan dikeluarkan otomatis!`,
              { mentions: [participant] }
            );

            setTimeout(async () => {
              const activeSession = await stateStore.get<any>(captchaKey);
              if (activeSession) {
                await stateStore.delete(captchaKey);
                try {
                  const socket = (adapter as any).sock;
                  if (socket && typeof socket.groupParticipantsUpdate === 'function') {
                    await socket.groupParticipantsUpdate(groupId, [participant], 'remove');
                    await adapter.sendMessage(groupId, `🚪 @${participant.split('@')[0]} dikeluarkan karena gagal menyelesaikan Captcha tepat waktu.`, { mentions: [participant] });
                  }
                } catch (err) {
                  console.error('[Captcha Timeout Kick Failed]', err);
                }
              }
            }, 120_000);

            continue;
          }

          if (features.welcome) {
            const rawWelcome = features.welcomeMessage || localizerService.format('welcome_default', locale);
            const welcomeMsg = await interpolateTemplate(rawWelcome, participant, groupId, adapter);

            if (features.welcomecard && !isQuietHours) {
              try {
                const avatarUrl = `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(participant.split('@')[0])}`;
                const response = await fetch(avatarUrl);
                const arrayBuf = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuf);

                await adapter.sendImage(groupId, buffer, welcomeMsg, { mentions: [participant] });
              } catch (err) {
                console.error('[WelcomeCard] Failed to send card, sending text fallback:', err);
                await adapter.sendMessage(groupId, welcomeMsg, { mentions: [participant] });
              }
            } else {
              await adapter.sendMessage(groupId, welcomeMsg, { mentions: [participant] });
            }
          }
        }
      }

      // 2. Goodbye Msg
      if (action === 'remove') {
        const { interpolateTemplate } = await import('./commands/community/welcome.command.js');
        const locale = await localizerService.getGroupLocale(groupId);

        for (const participant of participants) {
          // Log leave event
          await prisma.groupLog.create({
            data: {
              groupId,
              userId: participant,
              type: 'leave',
              action: 'user_left',
              message: 'Pengguna meninggalkan grup'
            }
          }).catch(err => console.error('Failed to log leave event:', err));

          const nowHour = new Date().getHours();
          const isQuietHours = nowHour >= 22 || nowHour < 6;

          if (features.goodbye && !isQuietHours) {
            const rawGoodbye = features.goodbyeMessage || localizerService.format('goodbye_default', locale);
            const goodbyeMsg = await interpolateTemplate(rawGoodbye, participant, groupId, adapter);
            await adapter.sendMessage(groupId, goodbyeMsg, { mentions: [participant] });
          }
        }
      }
    } catch (err) {
      console.error('[GroupUpdate] Error processing welcome/goodbye:', err);
    }
  });

  // Bind message event to routing
  adapter.onMessage(async (ctx: any) => {
    await routeMessage(ctx, adapter);
  });

  await adapter.start();
  startDashboardServer(adapter);
  console.log('[System] Starting background reminder worker...');
  startReminderWorker(adapter);
  console.log('[System] Starting background temp admin worker...');
  startTempAdminWorker(adapter);
  console.log('[System] Starting background scheduled mute worker...');
  startSchedMuteWorker(adapter);
  console.log('[System] Starting background retention worker...');
  const { startRetentionWorker } = await import('./workers/retention.worker.js');
  startRetentionWorker();
  console.log('[System] Bot is now active and ready to process commands.');
}

bootstrap().catch(err => {
  console.error('[System] Critical error during bootstrap:', err);
  process.exit(1);
});
