import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';

export function startReminderWorker(adapter: WhatsAppAdapter) {
  // Run check every 30 seconds
  const interval = setInterval(async () => {
    try {
      const now = new Date();
      const pendingReminders = await prisma.reminder.findMany({
        where: {
          status: 'pending',
          runAt: { lte: now }
        }
      });

      for (const reminder of pendingReminders) {
        try {
          let isRecurring = false;
          let intervalType = '';
          let displayMessage = reminder.message;

          try {
            const parsed = JSON.parse(reminder.message);
            if (parsed && typeof parsed === 'object' && parsed.recurring) {
              isRecurring = true;
              intervalType = parsed.interval;
              displayMessage = parsed.originalMessage;
            }
          } catch {
            // Not a JSON payload, treat as normal message
          }

          if (reminder.scope === 'group' && reminder.groupId) {
            const mentionUser = `@${reminder.userId.split('@')[0]}`;
            const text = `🔔 *PENGINGAT GRUP* 🔔\n\nHalo ${mentionUser}, ini pengingat Anda:\n👉 *${displayMessage}*`;
            await adapter.sendMessage(reminder.groupId, text, {
              mentions: [reminder.userId]
            });
          } else {
            const text = `🔔 *PENGINGAT* 🔔\n\nHalo, ini pengingat Anda:\n👉 *${displayMessage}*`;
            await adapter.sendMessage(reminder.userId, text);
          }

          if (isRecurring) {
            // Calculate next run time
            const nextRunAt = new Date(reminder.runAt);
            if (intervalType === 'daily') {
              nextRunAt.setDate(nextRunAt.getDate() + 1);
            } else if (intervalType.startsWith('rrule:weekly:')) {
              nextRunAt.setDate(nextRunAt.getDate() + 7);
            } else {
              // fallback
              nextRunAt.setDate(nextRunAt.getDate() + 7);
            }

            await prisma.reminder.update({
              where: { id: reminder.id },
              data: {
                runAt: nextRunAt,
                status: 'pending'
              }
            });
          } else {
            // Mark as sent
            await prisma.reminder.update({
              where: { id: reminder.id },
              data: { status: 'sent' }
            });
          }
        } catch (err: any) {
          console.error(`[ReminderWorker] Failed to process reminder ${reminder.id}:`, err.message);
          // Mark as failed or sent to avoid infinite loop
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: 'failed' }
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error('[ReminderWorker] Error in reminder loop:', err.message);
    }
  }, 30000);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  return interval;
}
