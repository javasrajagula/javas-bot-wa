import { env } from './config/env.js';
import prisma from './db/client.js';
import { ConsoleAdapter } from './bot/console.adapter.js';
import { BaileysAdapter } from './bot/baileys.adapter.js';
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
import './commands/document/document.command.js';
import './commands/moderation/moderation.command.js';
import './commands/moderation/antispam.command.js';
import './commands/moderation/warning-rule.command.js';
import './commands/moderation/group-log.command.js';
import './commands/community/community.command.js';
import './commands/community/schedule.command.js';
import './commands/games/games.command.js';
import './commands/owner/owner.command.js';
import { startReminderWorker } from './workers/reminder.worker.js';
import { achievementService } from './services/achievement/achievement.service.js';

async function bootstrap() {
  console.log('[System] Connecting to database...');
  await prisma.$connect();
  console.log('[System] Database connected successfully.');

  console.log('[System] Initializing Achievements...');
  await achievementService.initAchievements();

  console.log('[System] Initializing Werewolf Game Engine...');
  await werewolfEngine.boot();
  console.log('[System] Werewolf Game Engine initialized.');

  // Set up cleanup cron-like interval to sweep old temp files
  startCleanupInterval();
  console.log('[System] Temp files auto-cleanup scheduler started.');

  // Pick WhatsApp connection adapter based on config
  let adapter;
  if (env.ADAPTER_MODE === 'baileys') {
    console.log('[System] Starting in WhatsApp Baileys mode...');
    adapter = new BaileysAdapter();
  } else {
    console.log('[System] Starting in Console simulation mode...');
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
  adapter.onGroupUpdate(async (update) => {
    const { groupId, participants, action } = update;
    try {
      const config = await prisma.groupConfig.findUnique({
        where: { groupId }
      });
      if (!config) return;

      const features = JSON.parse(config.featuresJson || '{}');

      // 1. Welcome Msg
      if (action === 'add') {
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
        }

        if (features.welcome) {
          let welcomeMsg = features.welcomeMessage || 'Selamat datang @user di grup @group!';
          let groupName = 'grup';
          const socket = (adapter as any).sock;
          if (socket) {
            try {
              const metadata = await socket.groupMetadata(groupId);
              groupName = metadata.subject || 'grup';
            } catch (err) {
              console.error('Failed to fetch group metadata for welcome:', err);
            }
          }

          for (const participant of participants) {
            const mention = `@${participant.split('@')[0]}`;
            const text = welcomeMsg
              .replace(/@user/g, mention)
              .replace(/@group/g, groupName);

            await adapter.sendMessage(groupId, text, {
              mentions: [participant]
            });
          }
        }
      }

      // 2. Goodbye Msg
      if (action === 'remove') {
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
        }

        if (features.goodbye) {
          let goodbyeMsg = features.goodbyeMessage || '@user telah meninggalkan grup.';
          for (const participant of participants) {
            const mention = `@${participant.split('@')[0]}`;
            const text = goodbyeMsg.replace(/@user/g, mention);
            await adapter.sendMessage(groupId, text, {
              mentions: [participant]
            });
          }
        }
      }
    } catch (err) {
      console.error('[GroupUpdate] Error processing welcome/goodbye:', err);
    }
  });

  // Bind message event to routing
  adapter.onMessage(async (ctx) => {
    await routeMessage(ctx, adapter);
  });

  await adapter.start();
  console.log('[System] Starting background reminder worker...');
  startReminderWorker(adapter);
  console.log('[System] Bot is now active and ready to process commands.');
}

bootstrap().catch(err => {
  console.error('[System] Critical error during bootstrap:', err);
  process.exit(1);
});
