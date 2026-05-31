import { env } from './config/env.js';
import prisma from './db/client.js';
import { pluginManager } from './config/plugins.js';
import { routeMessage } from './commands/index.js';
import { werewolfEngine } from './services/werewolf/werewolf.engine.js';
import { startCleanupInterval } from './utils/file.util.js';

// Dynamically import all command files to register them in the command router registry
import './commands/menu.command.js';
import './commands/admin.command.js';
import './commands/setup.command.js';
import './commands/feature.command.js';
import './commands/downloader.command.js';
import './commands/economy.command.js';
import './commands/subscription.command.js';

// Modular commands
import './commands/sticker/sticker.command.js';
import './commands/media/media.command.js';
import './commands/audio/audio.command.js';
import './commands/text/text.command.js';
import './commands/text/ai.command.js';
import './commands/document/document.command.js';
import './commands/document/safety.command.js';
import './commands/moderation/moderation.command.js';
import './commands/moderation/antispam.command.js';
import './commands/moderation/warning-rule.command.js';
import './commands/moderation/group-log.command.js';
import './commands/community/community.command.js';
import './commands/community/schedule.command.js';
import './commands/community/alias.command.js';
import './commands/community/locale.command.js';
import './commands/community/welcome.command.js';
import './commands/community/school.command.js';
import './commands/community/attendance.command.js';
import './commands/community/stats.command.js';
import './commands/community/reputation.command.js';
import './commands/community/notes.command.js';
import './commands/community/business.command.js';
import './commands/community/finance.command.js';
import './commands/community/automation.command.js';
import './commands/games/games.command.js';
import './commands/games/mission.command.js';
import { getMaintenanceMode } from './commands/owner/owner.command.js';
import './commands/owner/error.command.js';
import './commands/owner/queue.command.js';
import './commands/owner/status.command.js';
import './commands/owner/quota.command.js';
import './commands/owner/coupon.command.js';
import './commands/owner/reseller.command.js';
import './commands/owner/privacy.command.js';
import './commands/owner/webhook.command.js';
import './commands/prd/prd-coverage.command.js';
import { startReminderWorker } from './workers/reminder.worker.js';
import { startTempAdminWorker } from './workers/tempadmin.worker.js';
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

  // Register werewolf callbacks for adaptive messaging (group and private DMs)
  werewolfEngine.setNotificationCallbacks({
    sendGroupMessage: async (groupId, text) => {
      await adapter.sendMessage(groupId, text);
    },
    sendPrivateMessage: async (userId, text) => {
      await adapter.sendMessage(userId, text);
    }
  });

  // Register group participant updates for welcome/goodbye
  adapter.onGroupUpdate(async (update: any) => {
    const { groupId, participants, action } = update;
    try {
      const config = await prisma.groupConfig.findUnique({
        where: { groupId }
      });
      if (!config) return;

      const features = JSON.parse(config.featuresJson || '{}');

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
  console.log('[System] Bot is now active and ready to process commands.');
}

bootstrap().catch(err => {
  console.error('[System] Critical error during bootstrap:', err);
  process.exit(1);
});
