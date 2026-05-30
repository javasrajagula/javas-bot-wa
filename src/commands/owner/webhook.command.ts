import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK COMMAND — handles /webhook set/test/off/list
// Also handles /announce and /announcements (Phase 13 — Announcements)
// ─────────────────────────────────────────────────────────────────────────────

/** Emit a webhook event to all registered group/global webhooks */
export async function emitWebhookEvent(
  groupId: string | null,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const where = groupId
      ? { enabled: true, OR: [{ groupId }, { groupId: null }] }
      : { enabled: true, groupId: null };

    const hooks = await prisma.webhook.findMany({ where });
    for (const hook of hooks) {
      const events: string[] = JSON.parse(hook.eventsJson);
      if (events.length > 0 && !events.includes(event)) continue;

      const body = JSON.stringify({ event, groupId, payload, ts: Date.now() });
      try {
        await fetch(hook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(5000)
        });
      } catch {
        // silently fail per-hook — don't crash the bot
      }
    }
  } catch {
    // silently fail
  }
}

export class WebhookCommand implements Command {
  public async execute(
    ctx: MessageContext,
    args: string[],
    adapter: WhatsAppAdapter
  ): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // ─────────────────────────────────────────────────────────────────────────
    // /webhook <set|off|test|list>
    // ─────────────────────────────────────────────────────────────────────────
    if (cmd === 'webhook') {
      if (!isOwner(ctx.senderId)) {
        // Group admins can manage their group webhook
        if (ctx.isGroup) {
          const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
          if (!isAdmin) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup atau Owner yang dapat mengelola webhook.', { quotedMessageId: ctx.id });
            return;
          }
        } else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk Owner bot.', { quotedMessageId: ctx.id });
          return;
        }
      }

      const sub = args[0]?.toLowerCase();

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          `🔗 *WEBHOOK MANAGER*\n\nGunakan:\n` +
          `• \`/webhook set <url>\` — Daftarkan URL webhook\n` +
          `• \`/webhook test\` — Kirim test event ke webhook aktif\n` +
          `• \`/webhook off\` — Nonaktifkan webhook grup ini\n` +
          `• \`/webhook list\` — Lihat webhook terdaftar\n\n` +
          `*Events yang dikirim:*\n` +
          `command_used, group_joined, error_high, subscription_expired, backup_done, raid_detected, payment_update`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const groupId = ctx.isGroup ? ctx.chatId : null;

      // --- /webhook set <url> ---
      if (sub === 'set') {
        const url = args[1]?.trim();
        if (!url || !url.startsWith('http')) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan URL webhook yang valid. Contoh: `/webhook set https://example.com/hook`', { quotedMessageId: ctx.id });
          return;
        }

        // Block SSRF — only allow public URLs
        try {
          const parsed = new URL(url);
          const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '10.', '192.168.', '172.'];
          if (blocked.some(b => parsed.hostname.startsWith(b) || parsed.hostname === b.replace('.', ''))) {
            await adapter.sendMessage(ctx.chatId, '⚠️ URL tersebut diblokir karena alasan keamanan (SSRF protection).', { quotedMessageId: ctx.id });
            return;
          }
        } catch {
          await adapter.sendMessage(ctx.chatId, '⚠️ URL tidak valid.', { quotedMessageId: ctx.id });
          return;
        }

        const existing = await prisma.webhook.findFirst({ where: { groupId: groupId ?? undefined } });
        if (existing) {
          await prisma.webhook.update({ where: { id: existing.id }, data: { url, enabled: true } });
        } else {
          await prisma.webhook.create({
            data: {
              groupId: groupId ?? undefined,
              url,
              eventsJson: '[]', // empty = all events
              enabled: true
            }
          });
        }

        await prisma.auditLog.create({
          data: {
            actorId: ctx.senderId,
            groupId: groupId ?? undefined,
            action: 'webhook_set',
            target: url,
            metadataJson: '{}'
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `✅ *WEBHOOK TERDAFTAR!* 🔗\n\n• *URL:* ${url}\n• *Status:* Aktif\n• *Events:* Semua event\n\nGunakan \`/webhook test\` untuk memverifikasi koneksi.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // --- /webhook off ---
      if (sub === 'off') {
        const existing = await prisma.webhook.findFirst({ where: { groupId: groupId ?? undefined } });
        if (!existing) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada webhook aktif untuk grup ini.', { quotedMessageId: ctx.id });
          return;
        }
        await prisma.webhook.update({ where: { id: existing.id }, data: { enabled: false } });
        await adapter.sendMessage(ctx.chatId, '✅ Webhook dinonaktifkan.', { quotedMessageId: ctx.id });
        return;
      }

      // --- /webhook test ---
      if (sub === 'test') {
        const hook = await prisma.webhook.findFirst({ where: { groupId: groupId ?? undefined, enabled: true } });
        if (!hook) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada webhook aktif. Gunakan `/webhook set <url>` terlebih dahulu.', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const testPayload = {
            event: 'test',
            groupId,
            payload: { message: 'Webhook test dari Javas Bot WA', botVersion: '1.0.0' },
            ts: Date.now()
          };
          const resp = await fetch(hook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(7000)
          });

          if (resp.ok) {
            await adapter.sendMessage(
              ctx.chatId,
              `✅ *WEBHOOK TEST BERHASIL!*\n\n• *URL:* ${hook.url}\n• *Status HTTP:* ${resp.status}\n• *Event:* test`,
              { quotedMessageId: ctx.id }
            );
          } else {
            await adapter.sendMessage(
              ctx.chatId,
              `⚠️ Webhook merespons dengan status *${resp.status}*. Periksa konfigurasi server Anda.`,
              { quotedMessageId: ctx.id }
            );
          }
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Webhook gagal dihubungi: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // --- /webhook list ---
      if (sub === 'list') {
        const hooks = await prisma.webhook.findMany({ where: { groupId: groupId ?? undefined } });
        if (hooks.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada webhook terdaftar.', { quotedMessageId: ctx.id });
          return;
        }
        let text = `🔗 *DAFTAR WEBHOOK*\n\n`;
        hooks.forEach((h, i) => {
          text += `${i + 1}. ${h.enabled ? '✅' : '⛔'} \`${h.url}\`\n`;
          text += `   Scope: ${h.groupId ? 'Grup' : 'Global'}\n\n`;
        });
        await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⚠️ Sub-command tidak dikenal. Gunakan: set, off, test, list', { quotedMessageId: ctx.id });
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // /announce <pesan> — buat pengumuman resmi grup (Phase 13)
    // ─────────────────────────────────────────────────────────────────────────
    if (cmd === 'announce') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk grup.', { quotedMessageId: ctx.id });
        return;
      }
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin yang dapat membuat pengumuman.', { quotedMessageId: ctx.id });
        return;
      }

      const messageText = args.join(' ').trim();
      if (!messageText) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tulis pesan pengumuman. Contoh: `/announce Rapat besok jam 10 pagi di aula utama.`', { quotedMessageId: ctx.id });
        return;
      }

      const now = new Date();
      const dateStr = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });
      const announceId = `ANN-${Date.now()}`;

      const formatted =
        `📢 *PENGUMUMAN RESMI* 📢\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${messageText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${dateStr}\n` +
        `🆔 \`${announceId}\`\n` +
        `👤 Admin: @${ctx.senderId.split('@')[0]}`;

      // Store to PrdStateRecord for history
      await prisma.prdStateRecord.create({
        data: {
          type: 'announcement',
          scope: ctx.chatId,
          ownerId: ctx.senderId,
          status: 'active',
          text: messageText,
          metadataJson: JSON.stringify({ announceId, dateStr })
        }
      });

      await adapter.sendMessage(ctx.chatId, formatted, { quotedMessageId: ctx.id });

      // Emit webhook event
      await emitWebhookEvent(ctx.chatId, 'announcement_posted', { announceId, text: messageText });
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // /announcements — daftar pengumuman terbaru grup
    // ─────────────────────────────────────────────────────────────────────────
    if (cmd === 'announcements') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk grup.', { quotedMessageId: ctx.id });
        return;
      }

      const announcements = await prisma.prdStateRecord.findMany({
        where: { type: 'announcement', scope: ctx.chatId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      if (announcements.length === 0) {
        await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada pengumuman di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      let text = `📢 *RIWAYAT PENGUMUMAN* (${announcements.length} terakhir)\n\n`;
      announcements.forEach((a, i) => {
        const meta = JSON.parse(a.metadataJson);
        const dateStr = new Date(a.createdAt).toLocaleDateString('id-ID');
        text += `${i + 1}. *[${meta.announceId ?? 'ANN'}]* — ${dateStr}\n`;
        text += `   ${a.text.slice(0, 80)}${a.text.length > 80 ? '…' : ''}\n\n`;
      });

      await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // /announcement <id> — lihat detail satu pengumuman
    // ─────────────────────────────────────────────────────────────────────────
    if (cmd === 'announcement') {
      const annId = args[0]?.trim().toUpperCase();
      if (!annId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ID pengumuman. Contoh: `/announcement ANN-1234567890`', { quotedMessageId: ctx.id });
        return;
      }

      const ann = await prisma.prdStateRecord.findFirst({
        where: {
          type: 'announcement',
          metadataJson: { contains: annId }
        }
      });

      if (!ann) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Pengumuman dengan ID \`${annId}\` tidak ditemukan.`, { quotedMessageId: ctx.id });
        return;
      }

      const meta = JSON.parse(ann.metadataJson);
      const dateStr = new Date(ann.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      await adapter.sendMessage(
        ctx.chatId,
        `📢 *PENGUMUMAN* \`${annId}\`\n\n${ann.text}\n\n🕐 ${dateStr}`,
        { quotedMessageId: ctx.id }
      );
      return;
    }
  }
}

const webhookCmd = new WebhookCommand();
registerCommand(['webhook', 'announce', 'announcements', 'announcement'], webhookCmd);
