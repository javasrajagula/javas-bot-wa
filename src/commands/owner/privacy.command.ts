import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Helper: upsert a CustomVariable with groupId / userId / key
// ---------------------------------------------------------------------------
async function upsertVar(groupId: string, userId: string, key: string, value: string): Promise<void> {
  await prisma.customVariable.upsert({
    where: { groupId_userId_key: { groupId, userId, key } },
    create: { groupId, userId, key, value },
    update: { value }
  });
}

async function getVar(groupId: string, userId: string, key: string): Promise<string | null> {
  const rec = await prisma.customVariable.findFirst({ where: { groupId, userId, key } });
  return rec?.value ?? null;
}

// ---------------------------------------------------------------------------
// PRIVACY COMMAND CLASS
// Handles: /privacymode, /retention, /cleandb, /mydata, /deletemydata,
//          /consent, /generaterules, /rules, /ruleslog
// ---------------------------------------------------------------------------
export class PrivacyCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // -----------------------------------------------------------------------
    // 1. /privacymode <strict|balanced|off>
    // -----------------------------------------------------------------------
    if (cmd === 'privacymode') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk grup.', { quotedMessageId: ctx.id });
        return;
      }
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin yang dapat mengubah privacy mode.', { quotedMessageId: ctx.id });
        return;
      }

      const mode = args[0]?.toLowerCase();
      const validModes: Record<string, string> = {
        strict: 'strict',
        balanced: 'balanced',
        off: 'off'
      };

      if (!mode || !validModes[mode]) {
        const current = (await getVar(ctx.chatId, 'system', 'privacy:mode')) ?? 'off';
        await adapter.sendMessage(
          ctx.chatId,
          `🔒 *PRIVACY MODE*\n\n` +
          `Mode saat ini: *${current.toUpperCase()}*\n\n` +
          `Pilihan:\n` +
          `• \`/privacymode strict\` — Tidak simpan konten pesan, masking log, nonaktifkan auto-summary\n` +
          `• \`/privacymode balanced\` — Simpan metadata saja, log sebagian\n` +
          `• \`/privacymode off\` — Mode normal (simpan semua)\n\n` +
          `⚠️ Perubahan berlaku pada fitur AI/analitik grup ini.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const previousMode = await getVar(ctx.chatId, 'system', 'privacy:mode') ?? 'off';
      await upsertVar(ctx.chatId, 'system', 'privacy:mode', mode);

      const modeEmoji: Record<string, string> = { strict: '🔴', balanced: '🟡', off: '🟢' };
      const modeDesc: Record<string, string> = {
        strict: 'Konten pesan tidak disimpan. Log di-masking. Auto-summary dinonaktifkan.',
        balanced: 'Hanya metadata yang disimpan. Log sebagian.',
        off: 'Mode normal — semua fitur aktif.'
      };

      await adapter.sendMessage(
        ctx.chatId,
        `✅ *PRIVACY MODE DIUBAH!* 🔒\n\n` +
        `${modeEmoji[mode]} Mode: *${mode.toUpperCase()}*\n` +
        `📋 ${modeDesc[mode]}`,
        { quotedMessageId: ctx.id }
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          actorId: ctx.senderId,
          groupId: ctx.chatId,
          action: 'privacy_mode_changed',
          target: mode,
          metadataJson: JSON.stringify({ previousMode })
        }
      });
      return;
    }

    // -----------------------------------------------------------------------
    // 2. /retention <scope> <duration|off>
    // scope: logs, messages, media
    // duration: 1h, 24h, 7d, 30d, 90d, off
    // -----------------------------------------------------------------------
    if (cmd === 'retention') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk grup.', { quotedMessageId: ctx.id });
        return;
      }
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin yang dapat mengatur retensi data.', { quotedMessageId: ctx.id });
        return;
      }

      const scope = args[0]?.toLowerCase();
      const duration = args[1]?.toLowerCase();

      const validScopes = ['logs', 'messages', 'media'];
      const validDurations = ['1h', '6h', '24h', '7d', '30d', '90d', 'off'];

      if (!scope) {
        // Show current retention policies for this group
        const policies = await prisma.dataRetentionPolicy.findMany({
          where: { groupId: ctx.chatId }
        });

        const { stateStore } = await import('../../services/state/state-store.js');
        const lastCleanup = await stateStore.get<number>('retention:last_cleanup');
        const cleanupStr = lastCleanup
          ? new Date(lastCleanup).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
          : 'Belum pernah';

        let text = `📂 *DATA RETENTION POLICY*\n\n`;
        text += `⏱️ *Cleanup Terakhir:* ${cleanupStr}\n\n`;

        if (policies.length === 0) {
          text += `Belum ada kebijakan retensi diatur.\n\nGunakan:\n• \`/retention logs 30d\`\n• \`/retention messages 7d\`\n• \`/retention media 1h\``;
        } else {
          for (const p of policies) {
            const status = p.enabled ? '✅' : '⛔';
            text += `${status} *${p.scope.toUpperCase()}*: ${p.duration}\n`;
          }
        }
        await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
        return;
      }

      if (!validScopes.includes(scope)) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Scope tidak valid. Pilih: ${validScopes.join(', ')}`, { quotedMessageId: ctx.id });
        return;
      }

      if (!duration || !validDurations.includes(duration)) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Durasi tidak valid. Pilih: ${validDurations.join(', ')}`, { quotedMessageId: ctx.id });
        return;
      }

      const existing = await prisma.dataRetentionPolicy.findFirst({
        where: { groupId: ctx.chatId, scope }
      });

      if (existing) {
        await prisma.dataRetentionPolicy.update({
          where: { id: existing.id },
          data: { duration, enabled: duration !== 'off' }
        });
      } else {
        await prisma.dataRetentionPolicy.create({
          data: {
            groupId: ctx.chatId,
            scope,
            duration,
            enabled: duration !== 'off'
          }
        });
      }

      const msg = duration === 'off'
        ? `✅ Retensi data *${scope}* dinonaktifkan.`
        : `✅ Retensi data *${scope}* diset ke *${duration}*. Data lebih lama akan dibersihkan otomatis.`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // -----------------------------------------------------------------------
    // 3. /cleandb <logs|temp|usage> [duration]
    // -----------------------------------------------------------------------
    if (cmd === 'cleandb') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk Owner bot.', { quotedMessageId: ctx.id });
        return;
      }

      const scope = args[0]?.toLowerCase();
      const durationArg = args[1]?.toLowerCase() ?? '30d';

      if (!scope) {
        await adapter.sendMessage(
          ctx.chatId,
          `🗑️ *CLEAN DATABASE*\n\nGunakan:\n• \`/cleandb logs 30d\` — Hapus log lebih dari 30 hari\n• \`/cleandb temp\` — Hapus semua data sementara\n• \`/cleandb usage 90d\` — Hapus log penggunaan lebih dari 90 hari`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // Parse duration string -> milliseconds
      const parseDuration = (d: string): number | null => {
        const match = d.match(/^(\d+)(h|d)$/);
        if (!match) return null;
        const num = parseInt(match[1]);
        const unit = match[2];
        return unit === 'h' ? num * 3600 * 1000 : num * 86400 * 1000;
      };

      const durationMs = parseDuration(durationArg);
      const cutoff = durationMs ? new Date(Date.now() - durationMs) : new Date(0);

      try {
        let deletedCount = 0;

        if (scope === 'logs') {
          const result = await prisma.auditLog.deleteMany({
            where: { createdAt: { lt: cutoff } }
          });
          deletedCount = result.count;
          await adapter.sendMessage(
            ctx.chatId,
            `✅ *CLEANDB LOGS*\n\n🗑️ Dihapus: *${deletedCount}* audit log lebih dari *${durationArg}* lalu.`,
            { quotedMessageId: ctx.id }
          );
        } else if (scope === 'temp') {
          const result = await prisma.queueJobRecord.deleteMany({
            where: { status: { in: ['done', 'failed'] } }
          });
          deletedCount = result.count;
          await adapter.sendMessage(
            ctx.chatId,
            `✅ *CLEANDB TEMP*\n\n🗑️ Dihapus: *${deletedCount}* queue job record selesai/gagal.`,
            { quotedMessageId: ctx.id }
          );
        } else if (scope === 'usage') {
          const result = await prisma.usageLog.deleteMany({
            where: { createdAt: { lt: cutoff } }
          });
          deletedCount = result.count;
          await adapter.sendMessage(
            ctx.chatId,
            `✅ *CLEANDB USAGE*\n\n🗑️ Dihapus: *${deletedCount}* usage log lebih dari *${durationArg}* lalu.`,
            { quotedMessageId: ctx.id }
          );
        } else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Scope tidak dikenal. Pilih: logs, temp, usage', { quotedMessageId: ctx.id });
        }
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membersihkan database: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // 4. /mydata — lihat data tersimpan
    // -----------------------------------------------------------------------
    if (cmd === 'mydata') {
      const userId = ctx.senderId;

      try {
        const profile = await prisma.userProfile.findUnique({ where: { userId } });
        const economy = await prisma.userEconomy.findUnique({ where: { userId } });
        const warnings = await prisma.warning.findMany({ where: { userId } });
        const usageLogs = await prisma.usageLog.count({ where: { userId } });
        const achievements = await prisma.userAchievement.count({ where: { userId } });

        let text = `👤 *DATA ANDA DI BOT*\n\n`;
        text += `🪪 *Profil*\n`;
        text += `• ID: \`${userId}\`\n`;
        text += `• Premium: ${profile?.isPremium ? '✅' : '❌'}\n`;
        text += `• Bahasa: ${profile?.language ?? 'id'}\n`;
        text += `• Gelar: ${profile?.title ?? '-'}\n\n`;

        if (economy) {
          text += `💰 *Ekonomi*\n`;
          text += `• Saldo: Rp ${economy.balance.toLocaleString('id-ID')}\n`;
          text += `• Bank: Rp ${economy.bank.toLocaleString('id-ID')}\n`;
          text += `• Level: ${economy.level} (XP: ${economy.xp})\n\n`;
        }

        text += `⚠️ *Warning*: ${warnings.length} peringatan\n`;
        text += `📊 *Log Penggunaan*: ${usageLogs} perintah tercatat\n`;
        text += `🏆 *Pencapaian*: ${achievements} achievement\n\n`;
        text += `_Gunakan /deletemydata untuk menghapus data personal Anda._`;

        await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil data: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // 5. /deletemydata — hapus data personal
    // -----------------------------------------------------------------------
    if (cmd === 'deletemydata') {
      const userId = ctx.senderId;
      const confirm = args[0]?.toLowerCase();

      if (confirm !== 'konfirmasi') {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ *HAPUS DATA PERSONAL*\n\n` +
          `Tindakan ini akan menghapus:\n` +
          `• Profil pengguna\n` +
          `• Data ekonomi (saldo, bank, XP)\n` +
          `• Log penggunaan\n` +
          `• Variabel personal\n\n` +
          `🔴 *Data moderasi grup (warning, blacklist) TIDAK akan dihapus karena keperluan operasional.*\n\n` +
          `Untuk melanjutkan, ketik:\n\`/deletemydata konfirmasi\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      try {
        await prisma.userProfile.deleteMany({ where: { userId } });
        await prisma.userEconomy.deleteMany({ where: { userId } });
        await prisma.usageLog.deleteMany({ where: { userId } });
        await prisma.customVariable.deleteMany({ where: { userId, groupId: 'private' } });

        await adapter.sendMessage(
          ctx.chatId,
          `✅ *DATA PERSONAL DIHAPUS*\n\n` +
          `Data profil, ekonomi, dan log penggunaan Anda telah dihapus.\n` +
          `Data moderasi (warning) dipertahankan sesuai kebijakan operasional.`,
          { quotedMessageId: ctx.id }
        );
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menghapus data: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // 6. /consent <autosummary|ai|analytics> <on|off>
    // -----------------------------------------------------------------------
    if (cmd === 'consent') {
      const feature = args[0]?.toLowerCase();
      const state = args[1]?.toLowerCase();

      const validFeatures = ['autosummary', 'ai', 'analytics'];
      const validStates = ['on', 'off'];

      if (!feature) {
        const groupId = ctx.isGroup ? ctx.chatId : 'private';
        const userId = ctx.senderId;

        let text = `✅ *CONSENT ANDA*\n\n`;
        for (const f of validFeatures) {
          const val = await getVar(groupId, userId, `consent:${f}`) ?? 'on';
          const icon = val === 'on' ? '✅' : '⛔';
          text += `${icon} *${f}*: ${val.toUpperCase()}\n`;
        }
        text += `\nGunakan: \`/consent [fitur] [on|off]\``;
        await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
        return;
      }

      if (!validFeatures.includes(feature)) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Fitur tidak valid. Pilih: ${validFeatures.join(', ')}`, { quotedMessageId: ctx.id });
        return;
      }

      if (!state || !validStates.includes(state)) {
        await adapter.sendMessage(ctx.chatId, `⚠️ State tidak valid. Gunakan: on atau off`, { quotedMessageId: ctx.id });
        return;
      }

      const groupId = ctx.isGroup ? ctx.chatId : 'private';
      await upsertVar(groupId, ctx.senderId, `consent:${feature}`, state);

      const icon = state === 'on' ? '✅' : '⛔';
      await adapter.sendMessage(
        ctx.chatId,
        `${icon} *CONSENT DIPERBARUI*\n\nFitur *${feature}* sekarang: *${state.toUpperCase()}* untuk Anda.`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // -----------------------------------------------------------------------
    // 7. /generaterules <sekolah|jualbeli|komunitas>
    // -----------------------------------------------------------------------
    if (cmd === 'generaterules') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk grup.', { quotedMessageId: ctx.id });
        return;
      }
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin yang dapat membuat peraturan grup.', { quotedMessageId: ctx.id });
        return;
      }

      const template = args[0]?.toLowerCase();
      const templates: Record<string, string[]> = {
        sekolah: [
          '1. Hormati sesama anggota dan pengajar.',
          '2. Dilarang menyebarkan materi yang tidak berkaitan dengan pelajaran.',
          '3. Gunakan bahasa yang sopan dan santun.',
          '4. Tidak diperbolehkan berbagi jawaban ujian.',
          '5. Admin berhak menegur atau mengeluarkan anggota yang melanggar.'
        ],
        jualbeli: [
          '1. Hanya posting barang/jasa yang legal dan sesuai topik grup.',
          '2. Cantumkan harga, deskripsi, dan kontak yang jelas.',
          '3. Dilarang spam iklan berulang dalam waktu singkat.',
          '4. Transaksi adalah tanggung jawab pribadi penjual dan pembeli.',
          '5. Lapor penipuan ke admin dengan bukti yang lengkap.'
        ],
        komunitas: [
          '1. Saling menghormati sesama anggota komunitas.',
          '2. Dilarang SARA, hoaks, dan konten negatif.',
          '3. Diskusi tetap pada topik yang relevan dengan komunitas.',
          '4. Promosi hanya di hari yang ditetapkan admin.',
          '5. Admin berhak memberi sanksi sesuai tingkat pelanggaran.'
        ]
      };

      if (!template || !templates[template]) {
        await adapter.sendMessage(
          ctx.chatId,
          `📋 *GENERATE PERATURAN*\n\nPilih template:\n• \`/generaterules sekolah\`\n• \`/generaterules jualbeli\`\n• \`/generaterules komunitas\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const version = `v${Date.now()}`;
      const rulesData = {
        version,
        template,
        rules: templates[template],
        createdAt: Date.now(),
        createdBy: ctx.senderId
      };

      await upsertVar(ctx.chatId, 'system', 'group:rules:current', JSON.stringify(rulesData));

      // Append to rules history
      const historyKey = 'group:rules:history';
      const existingHistory = await getVar(ctx.chatId, 'system', historyKey);
      const history: any[] = existingHistory ? JSON.parse(existingHistory) : [];
      history.push({ version, template, createdAt: rulesData.createdAt });
      await upsertVar(ctx.chatId, 'system', historyKey, JSON.stringify(history));

      let text = `📋 *PERATURAN GRUP DIBUAT!* ✅\n\n`;
      text += `*Template:* ${template} | *Versi:* \`${version}\`\n\n`;
      rulesData.rules.forEach(r => { text += `${r}\n`; });
      text += `\n_Anggota baru akan diminta menyetujui peraturan ini. Gunakan /rules untuk melihat peraturan aktif._`;

      await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
      return;
    }

    // -----------------------------------------------------------------------
    // 8. /rules <edit|version|rollback> — manage versioned group rules
    // -----------------------------------------------------------------------
    if (cmd === 'rules') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();

      // Show current rules
      if (!sub || sub === 'lihat') {
        const rawRules = await getVar(ctx.chatId, 'system', 'group:rules:current');
        if (!rawRules) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada peraturan grup. Gunakan `/generaterules` untuk membuat.', { quotedMessageId: ctx.id });
          return;
        }
        const rules = JSON.parse(rawRules);
        let text = `📋 *PERATURAN GRUP* (${rules.version})\n\n`;
        rules.rules.forEach((r: string) => { text += `${r}\n`; });
        text += `\n_Terakhir diperbarui: ${new Date(rules.createdAt).toLocaleString('id-ID')}_`;
        await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'version') {
        const historyRaw = await getVar(ctx.chatId, 'system', 'group:rules:history');
        if (!historyRaw) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada riwayat versi peraturan.', { quotedMessageId: ctx.id });
          return;
        }
        const history: any[] = JSON.parse(historyRaw);
        let text = `🗂️ *RIWAYAT VERSI PERATURAN*\n\n`;
        history.slice(-10).reverse().forEach((h, i) => {
          text += `${i + 1}. Versi \`${h.version}\` — ${h.template} — ${new Date(h.createdAt).toLocaleDateString('id-ID')}\n`;
        });
        await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'edit') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin yang dapat mengubah peraturan.', { quotedMessageId: ctx.id });
          return;
        }
        const newRuleText = args.slice(1).join(' ').trim();
        if (!newRuleText) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tulis peraturan baru. Contoh: `/rules edit 1. Hormati sesama anggota.`', { quotedMessageId: ctx.id });
          return;
        }

        const rawRules = await getVar(ctx.chatId, 'system', 'group:rules:current');
        const existingRules = rawRules ? JSON.parse(rawRules) : { rules: [], template: 'custom', createdAt: Date.now() };
        existingRules.rules.push(newRuleText);
        existingRules.version = `v${Date.now()}`;
        existingRules.createdAt = Date.now();

        await upsertVar(ctx.chatId, 'system', 'group:rules:current', JSON.stringify(existingRules));
        await adapter.sendMessage(ctx.chatId, `✅ Peraturan ditambahkan: _${newRuleText}_\nVersi baru: \`${existingRules.version}\``, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'rollback') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin yang dapat melakukan rollback.', { quotedMessageId: ctx.id });
          return;
        }
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Rollback manual: Buat versi baru dengan `/generaterules [template]` atau `/rules edit [teks]` untuk menggantikan peraturan saat ini.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    // -----------------------------------------------------------------------
    // 9. /ruleslog — tampilkan log persetujuan anggota
    // -----------------------------------------------------------------------
    if (cmd === 'ruleslog') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk grup.', { quotedMessageId: ctx.id });
        return;
      }
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin yang dapat melihat log persetujuan.', { quotedMessageId: ctx.id });
        return;
      }

      const acceptanceRaw = await getVar(ctx.chatId, 'system', 'group:rules:acceptances');
      if (!acceptanceRaw) {
        await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada log persetujuan peraturan.', { quotedMessageId: ctx.id });
        return;
      }

      const acceptances: any[] = JSON.parse(acceptanceRaw);
      let text = `📋 *LOG PERSETUJUAN PERATURAN*\n\n`;
      acceptances.slice(-20).reverse().forEach((a, i) => {
        text += `${i + 1}. \`${a.userId}\` — Versi ${a.version} — ${new Date(a.timestamp).toLocaleString('id-ID')}\n`;
      });
      await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
      return;
    }

    // -----------------------------------------------------------------------
    // 10. /setuju — member menyetujui peraturan grup
    // -----------------------------------------------------------------------
    if (cmd === 'setuju') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya untuk grup.', { quotedMessageId: ctx.id });
        return;
      }

      const rawRules = await getVar(ctx.chatId, 'system', 'group:rules:current');
      if (!rawRules) {
        await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada peraturan grup yang aktif.', { quotedMessageId: ctx.id });
        return;
      }

      const rules = JSON.parse(rawRules);

      const acceptanceRaw = await getVar(ctx.chatId, 'system', 'group:rules:acceptances');
      const acceptances: any[] = acceptanceRaw ? JSON.parse(acceptanceRaw) : [];
      acceptances.push({
        userId: ctx.senderId,
        version: rules.version,
        timestamp: Date.now()
      });
      // Cap at last 500 entries to prevent DB bloat
      const capped = acceptances.slice(-500);
      await upsertVar(ctx.chatId, 'system', 'group:rules:acceptances', JSON.stringify(capped));

      await adapter.sendMessage(
        ctx.chatId,
        `✅ Terima kasih! Anda telah menyetujui peraturan grup (Versi ${rules.version}).`,
        { quotedMessageId: ctx.id }
      );
      return;
    }
  }
}

const privacyCmd = new PrivacyCommand();
registerCommand([
  'privacymode',
  'retention',
  'cleandb',
  'mydata',
  'deletemydata',
  'consent',
  'generaterules',
  'rules',
  'ruleslog',
  'setuju'
], privacyCmd);
