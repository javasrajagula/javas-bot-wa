import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isOwner } from '../../bot/permission.js';
import { parseFeatureFlags, DEFAULT_FEATURES, saveGroupConfigSnapshot } from '../../config/feature-flags.js';
import { normalizeJid } from '../../utils/jid.util.js';
import { permissionService } from '../../services/system/permission.service.js';

export class AdminOpsCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // ==========================================
    // F023: Custom Role (rolecustom)
    // ==========================================
    if (cmd === 'rolecustom') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat mengelola peran kustom.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase().trim();

      // /rolecustom create <roleName>
      if (sub === 'create') {
        const roleName = args[1]?.trim().toLowerCase();
        if (!roleName || !/^[a-z0-9]+$/.test(roleName)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Nama peran tidak valid. Gunakan huruf kecil dan angka saja. Contoh: `/rolecustom create piket`', { quotedMessageId: ctx.id });
          return;
        }

        const exist = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'role',
              key: `config:${roleName}`
            }
          }
        }).catch(() => null);

        if (exist) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Peran kustom *${roleName}* sudah ada di grup ini.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.create({
          data: {
            groupId: ctx.chatId,
            userId: 'role',
            key: `config:${roleName}`,
            value: JSON.stringify({ name: roleName, allowedCommands: [] })
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Peran kustom *${roleName}* berhasil dibuat. Gunakan \`/rolecustom grant ${roleName} <command>\` untuk memberikan akses perintah.`, { quotedMessageId: ctx.id });
        return;
      }

      // /rolecustom assign <roleName> @user
      if (sub === 'assign') {
        const roleName = args[1]?.trim().toLowerCase();
        let targetJid = args[2]?.trim();

        if (targetJid) {
          targetJid = normalizeJid(targetJid);
        }

        if (!roleName || !targetJid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/rolecustom assign <roleName> @user`', { quotedMessageId: ctx.id });
          return;
        }

        const roleConfig = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'role',
              key: `config:${roleName}`
            }
          }
        }).catch(() => null);

        if (!roleConfig) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Peran kustom *${roleName}* tidak ditemukan. Buat dulu dengan: \`/rolecustom create ${roleName}\``, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: targetJid,
              key: 'role:custom'
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: targetJid,
            key: 'role:custom',
            value: roleName
          },
          update: {
            value: roleName
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Peran kustom *${roleName.toUpperCase()}* berhasil ditugaskan ke @${targetJid.split('@')[0]}.`, { mentions: [targetJid], quotedMessageId: ctx.id });
        return;
      }

      // /rolecustom remove @user
      if (sub === 'remove') {
        let targetJid = args[1]?.trim();
        if (targetJid) {
          targetJid = normalizeJid(targetJid);
        }

        if (!targetJid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/rolecustom remove @user`', { quotedMessageId: ctx.id });
          return;
        }

        const record = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: targetJid,
              key: 'role:custom'
            }
          }
        }).catch(() => null);

        if (!record) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Pengguna tidak memiliki peran kustom di grup ini.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.delete({ where: { id: record.id } });
        await adapter.sendMessage(ctx.chatId, `✅ Peran kustom berhasil dihapus dari @${targetJid.split('@')[0]}.`, { mentions: [targetJid], quotedMessageId: ctx.id });
        return;
      }

      // /rolecustom grant <roleName> <command>
      if (sub === 'grant') {
        const roleName = args[1]?.trim().toLowerCase();
        const command = args[2]?.trim().toLowerCase().replace(/^\//, '');

        if (!roleName || !command) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/rolecustom grant <roleName> <command>`', { quotedMessageId: ctx.id });
          return;
        }

        const roleConfig = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'role',
              key: `config:${roleName}`
            }
          }
        }).catch(() => null);

        if (!roleConfig) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Peran kustom *${roleName}* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        const data = JSON.parse(roleConfig.value);
        const allowedCmds: string[] = data.allowedCommands || [];
        if (!allowedCmds.includes(command)) {
          allowedCmds.push(command);
        }

        data.allowedCommands = allowedCmds;
        await prisma.customVariable.update({
          where: { id: roleConfig.id },
          data: { value: JSON.stringify(data) }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Peran kustom *${roleName.toUpperCase()}* sekarang memiliki izin untuk menjalankan perintah */${command}*.`, { quotedMessageId: ctx.id });
        return;
      }

      // /rolecustom revoke <roleName> <command>
      if (sub === 'revoke') {
        const roleName = args[1]?.trim().toLowerCase();
        const command = args[2]?.trim().toLowerCase().replace(/^\//, '');

        if (!roleName || !command) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/rolecustom revoke <roleName> <command>`', { quotedMessageId: ctx.id });
          return;
        }

        const roleConfig = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'role',
              key: `config:${roleName}`
            }
          }
        }).catch(() => null);

        if (!roleConfig) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Peran kustom *${roleName}* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        const data = JSON.parse(roleConfig.value);
        const allowedCmds: string[] = data.allowedCommands || [];
        const index = allowedCmds.indexOf(command);
        if (index > -1) {
          allowedCmds.splice(index, 1);
        }

        data.allowedCommands = allowedCmds;
        await prisma.customVariable.update({
          where: { id: roleConfig.id },
          data: { value: JSON.stringify(data) }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Izin perintah */${command}* untuk peran kustom *${roleName.toUpperCase()}* telah dicabut.`, { quotedMessageId: ctx.id });
        return;
      }

      // /rolecustom show <roleName>
      if (sub === 'show') {
        const roleName = args[1]?.trim().toLowerCase();
        if (!roleName) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/rolecustom show <roleName>`', { quotedMessageId: ctx.id });
          return;
        }

        const roleConfig = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'role',
              key: `config:${roleName}`
            }
          }
        }).catch(() => null);

        if (!roleConfig) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Peran kustom *${roleName}* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        const data = JSON.parse(roleConfig.value);
        const allowedCmds: string[] = data.allowedCommands || [];

        // Find users assigned to this role
        const users = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.chatId,
            key: 'role:custom',
            value: roleName
          }
        });

        const usersList = users.map(u => `@${u.userId!.split('@')[0]}`).join(', ') || '(Belum ada anggota)';
        const cmdsList = allowedCmds.map(c => `/${c}`).join(', ') || '(Belum ada perintah)';

        await adapter.sendMessage(
          ctx.chatId,
          `👤 *PERAN KUSTOM: ${roleName.toUpperCase()}*\n\n` +
          `• *Izin Perintah:* ${cmdsList}\n` +
          `• *Anggota:* ${usersList}`,
          { mentions: users.map(u => u.userId!), quotedMessageId: ctx.id }
        );
        return;
      }

      // Default: list all custom roles
      const list = await prisma.customVariable.findMany({
        where: {
          groupId: ctx.chatId,
          userId: 'role',
          key: { startsWith: 'config:' }
        }
      });

      if (list.length === 0) {
        await adapter.sendMessage(
          ctx.chatId,
          `ℹ️ Belum ada peran kustom di grup ini.\n\nCara pakai:\n• \`/rolecustom create <nama>\`\n• \`/rolecustom assign <nama> @user\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      let text = `👤 *DAFTAR PERAN KUSTOM GRUP* 👤\n\n`;
      list.forEach(item => {
        const rName = item.key.replace('config:', '');
        const data = JSON.parse(item.value);
        const allowed = data.allowedCommands || [];
        text += `• *${rName.toUpperCase()}* — (${allowed.length} izin perintah)\n`;
      });

      await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // F024: Delegated Moderator (delegatedmod)
    // ==========================================
    if (cmd === 'delegatedmod') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menunjuk delegated moderator.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase().trim();

      // /delegatedmod add @user
      if (sub === 'add') {
        let targetJid = args[1]?.trim();
        if (targetJid) {
          targetJid = normalizeJid(targetJid);
        }

        if (!targetJid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/delegatedmod add @user`', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: targetJid,
              key: 'role:delegatedmod'
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: targetJid,
            key: 'role:delegatedmod',
            value: 'true'
          },
          update: {
            value: 'true'
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ @${targetJid.split('@')[0]} berhasil ditambahkan sebagai *Delegated Moderator*.`, { mentions: [targetJid], quotedMessageId: ctx.id });
        return;
      }

      // /delegatedmod remove @user
      if (sub === 'remove' || sub === 'del') {
        let targetJid = args[1]?.trim();
        if (targetJid) {
          targetJid = normalizeJid(targetJid);
        }

        if (!targetJid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/delegatedmod remove @user`', { quotedMessageId: ctx.id });
          return;
        }

        const record = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: targetJid,
              key: 'role:delegatedmod'
            }
          }
        }).catch(() => null);

        if (!record) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Pengguna bukan merupakan delegated moderator di grup ini.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.delete({ where: { id: record.id } });
        await adapter.sendMessage(ctx.chatId, `✅ @${targetJid.split('@')[0]} berhasil dihapus dari *Delegated Moderator*.`, { mentions: [targetJid], quotedMessageId: ctx.id });
        return;
      }

      // Default: list delegated mods
      const mods = await prisma.customVariable.findMany({
        where: {
          groupId: ctx.chatId,
          key: 'role:delegatedmod',
          value: 'true'
        }
      });

      if (mods.length === 0) {
        await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada *Delegated Moderator* yang ditunjuk di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      const listText = mods.map(m => `• @${m.userId!.split('@')[0]}`).join('\n');
      await adapter.sendMessage(
        ctx.chatId,
        `🛡️ *DELEGATED MODERATOR KELAS/GRUP* 🛡️\n\n${listText}\n\n💡 Mereka dapat menjalankan seluruh command admin meskipun bukan admin asli WhatsApp.`,
        { mentions: mods.map(m => m.userId!), quotedMessageId: ctx.id }
      );
      return;
    }

    // ==========================================
    // F025: Config Diff (configdiff)
    // ==========================================
    if (cmd === 'configdiff') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat melihat perbedaan konfigurasi.', { quotedMessageId: ctx.id });
        return;
      }

      const snapshotVar = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: 'system',
            key: 'config_snapshot'
          }
        }
      }).catch(() => null);

      if (!snapshotVar) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Belum ada snapshot konfigurasi yang tersimpan untuk grup ini. Snapshot akan tersimpan otomatis saat ada perubahan konfigurasi.', { quotedMessageId: ctx.id });
        return;
      }

      const snapshot = JSON.parse(snapshotVar.value);
      const current = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });

      if (!current) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Gagal membaca konfigurasi grup saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      let diffText = `📊 *PERBEDAAN KONFIGURASI GRUP* 📊\n\n`;
      let changed = false;

      // Compare prefix
      if (snapshot.prefix !== current.prefix) {
        diffText += `• *Prefix:* \`${snapshot.prefix}\` ➡️ \`${current.prefix}\`\n`;
        changed = true;
      }

      // Compare botEnabled
      if (snapshot.botEnabled !== current.botEnabled) {
        diffText += `• *Status Bot:* *${snapshot.botEnabled ? 'AKTIF' : 'NONAKTIF'}* ➡️ *${current.botEnabled ? 'AKTIF' : 'NONAKTIF'}*\n`;
        changed = true;
      }

      // Compare feature flags
      const snapFeatures = parseFeatureFlags(snapshot.featuresJson);
      const currFeatures = parseFeatureFlags(current.featuresJson);

      const allKeys = Array.from(new Set([...Object.keys(snapFeatures), ...Object.keys(currFeatures)]));
      const featureDiffs: string[] = [];

      allKeys.forEach(key => {
        // Skip complex objects/arrays for simple display
        if (typeof snapFeatures[key] === 'boolean' || typeof currFeatures[key] === 'boolean') {
          const oldVal = snapFeatures[key] ? 'ON' : 'OFF';
          const newVal = currFeatures[key] ? 'ON' : 'OFF';
          if (oldVal !== newVal) {
            featureDiffs.push(`  - *${key}:* \`${oldVal}\` ➡️ \`${newVal}\``);
          }
        }
      });

      if (featureDiffs.length > 0) {
        diffText += `• *Toggles Fitur Terdampak:*\n${featureDiffs.join('\n')}\n`;
        changed = true;
      }

      if (!changed) {
        diffText += `✅ Konfigurasi grup saat ini identik dengan snapshot terakhir. Tidak ada perubahan.`;
      } else {
        diffText += `\n💡 _Ketik \`/rollbackconfig\` untuk memulihkan konfigurasi grup ke snapshot._`;
      }

      await adapter.sendMessage(ctx.chatId, diffText, { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // F026: Rollback Config (rollbackconfig)
    // ==========================================
    if (cmd === 'rollbackconfig') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat memulihkan konfigurasi grup.', { quotedMessageId: ctx.id });
        return;
      }

      const snapshotVar = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: 'system',
            key: 'config_snapshot'
          }
        }
      }).catch(() => null);

      if (!snapshotVar) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada snapshot konfigurasi yang ditemukan untuk dipulihkan.', { quotedMessageId: ctx.id });
        return;
      }

      const snapshot = JSON.parse(snapshotVar.value);

      // Save current config to snapshot first, so admins can undo if needed
      await saveGroupConfigSnapshot(ctx.chatId);

      await prisma.groupConfig.update({
        where: { groupId: ctx.chatId },
        data: {
          prefix: snapshot.prefix,
          featuresJson: snapshot.featuresJson,
          welcomeMessage: snapshot.welcomeMessage,
          goodbyeMessage: snapshot.goodbyeMessage,
          botEnabled: snapshot.botEnabled
        }
      });

      await adapter.sendMessage(ctx.chatId, '✅ *Konfigurasi grup berhasil dikembalikan (rollback) ke versi snapshot sebelumnya.*', { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // F027: Command Policy Editor (policyeditor)
    // ==========================================
    if (cmd === 'policyeditor') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menggunakan policy editor.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase().trim();

      // /policyeditor set <command> <role> allow|deny
      if (sub === 'set') {
        const targetCmd = args[1]?.toLowerCase().trim().replace(/^\//, '');
        const role = args[2]?.toLowerCase().trim();
        const action = args[3]?.toLowerCase().trim();

        if (!targetCmd || !role || !['allow', 'deny'].includes(action || '')) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/policyeditor set <command> <role> <allow|deny>`', { quotedMessageId: ctx.id });
          return;
        }

        const policyVar = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'policy',
              key: `command:${targetCmd}`
            }
          }
        }).catch(() => null);

        let policyData: any = {};
        if (policyVar?.value) {
          policyData = JSON.parse(policyVar.value);
        }

        const allowed = policyData.allowedRoles || [];
        const denied = policyData.deniedRoles || [];

        if (action === 'allow') {
          // Remove from denied if there
          const deniedIdx = denied.indexOf(role);
          if (deniedIdx > -1) denied.splice(deniedIdx, 1);

          // Add to allowed
          if (!allowed.includes(role)) allowed.push(role);
        } else {
          // Remove from allowed if there
          const allowedIdx = allowed.indexOf(role);
          if (allowedIdx > -1) allowed.splice(allowedIdx, 1);

          // Add to denied
          if (!denied.includes(role)) denied.push(role);
        }

        policyData.allowedRoles = allowed;
        policyData.deniedRoles = denied;

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'policy',
              key: `command:${targetCmd}`
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: 'policy',
            key: `command:${targetCmd}`,
            value: JSON.stringify(policyData)
          },
          update: {
            value: JSON.stringify(policyData)
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Kebijakan peran untuk perintah *[/${targetCmd}]* berhasil diset: Peran *${role.toUpperCase()}* ➡️ *${action.toUpperCase()}*.`, { quotedMessageId: ctx.id });
        return;
      }

      // /policyeditor time <command> <startHH:MM> <endHH:MM> (or "off")
      if (sub === 'time') {
        const targetCmd = args[1]?.toLowerCase().trim().replace(/^\//, '');
        const startTime = args[2]?.trim();
        const endTime = args[3]?.trim();

        if (!targetCmd || !startTime) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/policyeditor time <command> <start_time> <end_time>` atau `/policyeditor time <command> off`', { quotedMessageId: ctx.id });
          return;
        }

        const policyVar = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'policy',
              key: `command:${targetCmd}`
            }
          }
        }).catch(() => null);

        let policyData: any = {};
        if (policyVar?.value) {
          policyData = JSON.parse(policyVar.value);
        }

        if (startTime.toLowerCase() === 'off') {
          policyData.activeHours = null;
        } else {
          if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime || '')) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Format waktu salah. Gunakan format HH:MM (contoh: 08:00 atau 17:30).', { quotedMessageId: ctx.id });
            return;
          }
          policyData.activeHours = { start: startTime, end: endTime };
        }

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'policy',
              key: `command:${targetCmd}`
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: 'policy',
            key: `command:${targetCmd}`,
            value: JSON.stringify(policyData)
          },
          update: {
            value: JSON.stringify(policyData)
          }
        });

        if (startTime.toLowerCase() === 'off') {
          await adapter.sendMessage(ctx.chatId, `✅ Batasan jam aktif untuk perintah *[/${targetCmd}]* berhasil dinonaktifkan.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `✅ Batasan jam aktif untuk perintah *[/${targetCmd}]* berhasil diset ke pukul *${startTime} - ${endTime} WIB*.`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // /policyeditor plan <command> <free|basic|premium> (or "off")
      if (sub === 'plan') {
        const targetCmd = args[1]?.toLowerCase().trim().replace(/^\//, '');
        const plan = args[2]?.toLowerCase().trim();

        if (!targetCmd || !plan || !['free', 'basic', 'premium', 'off'].includes(plan)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/policyeditor plan <command> <free|basic|premium>` atau `/policyeditor plan <command> off`', { quotedMessageId: ctx.id });
          return;
        }

        const policyVar = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'policy',
              key: `command:${targetCmd}`
            }
          }
        }).catch(() => null);

        let policyData: any = {};
        if (policyVar?.value) {
          policyData = JSON.parse(policyVar.value);
        }

        if (plan === 'off') {
          policyData.minPlan = null;
        } else {
          policyData.minPlan = plan;
        }

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'policy',
              key: `command:${targetCmd}`
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: 'policy',
            key: `command:${targetCmd}`,
            value: JSON.stringify(policyData)
          },
          update: {
            value: JSON.stringify(policyData)
          }
        });

        if (plan === 'off') {
          await adapter.sendMessage(ctx.chatId, `✅ Batasan paket sewa untuk perintah *[/${targetCmd}]* berhasil dinonaktifkan.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `✅ Perintah *[/${targetCmd}]* hanya dapat diakses pada paket minimal: *${plan.toUpperCase()}*.`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // /policyeditor reset <command>
      if (sub === 'reset') {
        const targetCmd = args[1]?.toLowerCase().trim().replace(/^\//, '');
        if (!targetCmd) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan nama perintah. Contoh: `/policyeditor reset balance`', { quotedMessageId: ctx.id });
          return;
        }

        const policyVar = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'policy',
              key: `command:${targetCmd}`
            }
          }
        }).catch(() => null);

        if (!policyVar) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Tidak ada kebijakan khusus untuk perintah *[/${targetCmd}]*.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.delete({ where: { id: policyVar.id } });
        await adapter.sendMessage(ctx.chatId, `✅ Seluruh kebijakan khusus untuk perintah *[/${targetCmd}]* telah dihapus.`, { quotedMessageId: ctx.id });
        return;
      }

      // Default: list policies
      const policies = await prisma.customVariable.findMany({
        where: {
          groupId: ctx.chatId,
          userId: 'policy',
          key: { startsWith: 'command:' }
        }
      });

      if (policies.length === 0) {
        await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada kebijakan khusus yang dibuat di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      let policyText = `📜 *KEBIJAKAN EDIT PERINTAH GRUP* 📜\n\n`;
      policies.forEach(item => {
        const cmdName = item.key.replace('command:', '');
        const data = JSON.parse(item.value);
        let rulesList: string[] = [];

        if (data.allowedRoles && data.allowedRoles.length > 0) {
          rulesList.push(`Peran diizinkan: [${data.allowedRoles.join(', ')}]`);
        }
        if (data.deniedRoles && data.deniedRoles.length > 0) {
          rulesList.push(`Peran diblokir: [${data.deniedRoles.join(', ')}]`);
        }
        if (data.minPlan) {
          rulesList.push(`Paket minimal: *${data.minPlan.toUpperCase()}*`);
        }
        if (data.activeHours) {
          rulesList.push(`Aktif jam: *${data.activeHours.start} - ${data.activeHours.end}*`);
        }

        if (rulesList.length > 0) {
          policyText += `• */${cmdName}*:\n  ${rulesList.join(' | ')}\n`;
        }
      });

      await adapter.sendMessage(ctx.chatId, policyText, { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // F028: Owner Task Queue (ownertaskqueue)
    // ==========================================
    if (cmd === 'ownertaskqueue') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini khusus untuk Owner bot.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase().trim();

      // /ownertaskqueue resolve <invoice|appeal|error> <id> [approve|reject|resolve]
      if (sub === 'resolve') {
        const type = args[1]?.toLowerCase().trim();
        const id = args[2]?.trim();
        const action = args[3]?.toLowerCase().trim();

        if (!type || !id || !action) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/ownertaskqueue resolve <invoice|appeal|error> <id> <approve|reject|resolve>`', { quotedMessageId: ctx.id });
          return;
        }

        if (type === 'invoice') {
          // Resolve invoice (triggering /sewaconfirm flow)
          if (action === 'approve') {
            // Retrieve invoice
            const rawInvoices = await prisma.customVariable.findMany({
              where: { key: `invoice:${id}` }
            });

            if (rawInvoices.length === 0) {
              await adapter.sendMessage(ctx.chatId, '⚠️ Invoice tidak ditemukan.', { quotedMessageId: ctx.id });
              return;
            }

            const dbInvoice = rawInvoices[0];
            const data = JSON.parse(dbInvoice.value);
            if (data.status === 'paid') {
              await adapter.sendMessage(ctx.chatId, '⚠️ Invoice ini sudah disetujui sebelumnya.', { quotedMessageId: ctx.id });
              return;
            }

            // Mark paid and activate
            data.status = 'paid';
            data.paidAt = Date.now();
            await prisma.customVariable.update({
              where: { id: dbInvoice.id },
              data: { value: JSON.stringify(data) }
            });

            const targetGroup = data.groupId;
            const targetPlan = data.plan;
            const targetDuration = data.durationMonths;

            if (targetGroup !== 'private') {
              let newExpiresAt = new Date();
              const currentSub = await prisma.groupSubscription.findUnique({
                where: { groupId: targetGroup }
              });
              if (currentSub && currentSub.expiresAt && currentSub.expiresAt.getTime() > Date.now()) {
                newExpiresAt = new Date(currentSub.expiresAt.getTime());
              }
              newExpiresAt.setMonth(newExpiresAt.getMonth() + targetDuration);

              await prisma.groupSubscription.upsert({
                where: { groupId: targetGroup },
                create: { groupId: targetGroup, plan: targetPlan, expiresAt: newExpiresAt },
                update: { plan: targetPlan, expiresAt: newExpiresAt }
              });

              await adapter.sendMessage(ctx.chatId, `✅ *Tugas Invoice ${id} berhasil diselesaikan.* Paket grup \`${targetGroup}\` diset ke *${targetPlan.toUpperCase()}* sampai ${newExpiresAt.toLocaleDateString('id-ID')}.`, { quotedMessageId: ctx.id });
            } else {
              // user premium sewa
              const { addPremiumUser } = await import('../../services/premium/premium.service.js');
              await addPremiumUser(data.userId, targetDuration * 30, ctx.senderId);
              await adapter.sendMessage(ctx.chatId, `✅ *Tugas Invoice ${id} berhasil diselesaikan.* Premium user @${data.userId.split('@')[0]} diaktifkan.`, { mentions: [data.userId], quotedMessageId: ctx.id });
            }
          } else {
            // Reject invoice
            const rawInvoices = await prisma.customVariable.findMany({
              where: { key: `invoice:${id}` }
            });
            if (rawInvoices.length > 0) {
              const dbInvoice = rawInvoices[0];
              const data = JSON.parse(dbInvoice.value);
              data.status = 'rejected';
              await prisma.customVariable.update({
                where: { id: dbInvoice.id },
                data: { value: JSON.stringify(data) }
              });
              await adapter.sendMessage(ctx.chatId, `❌ Invoice *${id}* telah ditolak.`, { quotedMessageId: ctx.id });
            }
          }
          return;
        }

        if (type === 'appeal') {
          // Resolve appeal
          // Look up appeal record by userId
          const appeal = await prisma.customVariable.findFirst({
            where: { userId: id, key: 'appeal' }
          });

          if (!appeal) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Banding pelanggaran tidak ditemukan.', { quotedMessageId: ctx.id });
            return;
          }

          const data = JSON.parse(appeal.value);
          data.status = action === 'approve' ? 'approved' : 'rejected';
          data.resolvedAt = Date.now();
          data.resolvedBy = ctx.senderId;

          await prisma.customVariable.update({
            where: { id: appeal.id },
            data: { value: JSON.stringify(data) }
          });

          // If approved, clean warning points
          if (action === 'approve') {
            await prisma.warning.deleteMany({
              where: { groupId: appeal.groupId!, userId: appeal.userId! }
            });
          }

          await adapter.sendMessage(ctx.chatId, `✅ *Banding dari @${id.split('@')[0]} telah ${action === 'approve' ? 'DISETUJUI' : 'DITOLAK'}*. Poin pelanggaran dibersihkan.`, { mentions: [id], quotedMessageId: ctx.id });
          return;
        }

        if (type === 'error') {
          // Resolve error log
          const errorRecord = await prisma.errorRecord.findUnique({
            where: { errorId: id }
          });

          if (!errorRecord) {
            await adapter.sendMessage(ctx.chatId, `⚠️ Log error dengan ID ${id} tidak ditemukan.`, { quotedMessageId: ctx.id });
            return;
          }

          await prisma.errorRecord.update({
            where: { errorId: id },
            data: {
              status: 'resolved',
              resolvedAt: new Date()
            }
          });

          await adapter.sendMessage(ctx.chatId, `✅ *Error dengan ID ${id} berhasil ditandai selesai/resolved.*`, { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, '⚠️ Jenis tugas tidak dikenal (pilih: invoice, appeal, error).', { quotedMessageId: ctx.id });
        return;
      }

      // Default: list pending tasks
      const [pendingInvoices, pendingAppeals, openErrors] = await Promise.all([
        prisma.customVariable.findMany({
          where: { key: { startsWith: 'invoice:' } }
        }),
        prisma.customVariable.findMany({
          where: { key: 'appeal' }
        }),
        prisma.errorRecord.findMany({
          where: { status: 'open' },
          take: 10
        })
      ]);

      const pendingInvs = pendingInvoices.filter(item => {
        try {
          return JSON.parse(item.value).status === 'pending';
        } catch {
          return false;
        }
      });

      const pendingApps = pendingAppeals.filter(item => {
        try {
          return JSON.parse(item.value).status === 'pending';
        } catch {
          return false;
        }
      });

      let text = `👑 *DAFTAR ANTRIAN TUGAS OWNER* 👑\n\n`;

      text += `🧾 *INVOICE PENDING (${pendingInvs.length}):*\n`;
      if (pendingInvs.length === 0) {
        text += `  - Tidak ada invoice pending.\n`;
      } else {
        pendingInvs.forEach(item => {
          const invId = item.key.replace('invoice:', '');
          const data = JSON.parse(item.value);
          text += `  • *${invId}* — Rp ${data.amount.toLocaleString('id-ID')} | Plan: *${data.plan.toUpperCase()}*\n    💡 _Ketik: /ownertaskqueue resolve invoice ${invId} approve_\n`;
        });
      }

      text += `\n⚖️ *BANDING PELANGGARAN PENDING (${pendingApps.length}):*\n`;
      if (pendingApps.length === 0) {
        text += `  - Tidak ada banding pending.\n`;
      } else {
        pendingApps.forEach(item => {
          const data = JSON.parse(item.value);
          text += `  • *${item.userId}* (Grup: \`${item.groupId}\`)\n    Alasan: "${data.reason}"\n    💡 _Ketik: /ownertaskqueue resolve appeal ${item.userId} approve_\n`;
        });
      }

      text += `\n🚨 *LOG ERROR OPEN (${openErrors.length}):*\n`;
      if (openErrors.length === 0) {
        text += `  - Tidak ada error open.\n`;
      } else {
        openErrors.forEach(err => {
          text += `  • *${err.errorId}* (Fitur: \`${err.feature}\` | Scope: \`${err.scope}\`)\n    💡 _Ketik: /ownertaskqueue resolve error ${err.errorId} resolve_\n`;
        });
      }

      await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // F030: Group Health Score (grouphealth)
    // ==========================================
    if (cmd === 'grouphealth') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      let isAllowed = isAdmin;
      if (!isAllowed) {
        const userRole = await permissionService.getUserRole(ctx.chatId, ctx.senderId, adapter);
        const roleConfig = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'role',
              key: `config:${userRole}`
            }
          }
        }).catch(() => null);
        if (roleConfig) {
          const allowed = JSON.parse(roleConfig.value).allowedCommands || [];
          if (allowed.includes('grouphealth')) {
            isAllowed = true;
          }
        }
      }

      if (!isAllowed) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat melihat skor kesehatan grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch metrics
      const [warningsCount, errorsCount, totalLogs, successLogs, activeUsersCount] = await Promise.all([
        prisma.warning.count({
          where: { groupId: ctx.chatId, createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.errorLog.count({
          where: { scope: ctx.chatId, createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.usageLog.count({
          where: { groupId: ctx.chatId, createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.usageLog.count({
          where: { groupId: ctx.chatId, success: true, createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.groupUserStats.count({
          where: { groupId: ctx.chatId, lastActiveAt: { gte: sevenDaysAgo } }
        })
      ]);

      let score = 100;
      let advice: string[] = [];

      // 1. Warnings penalty (max -30)
      if (warningsCount > 0) {
        const penalty = Math.min(warningsCount * 5, 30);
        score -= penalty;
        advice.push(`⚠️ Terjadi *${warningsCount}* pelanggaran aturan dalam 7 hari terakhir. Pertimbangkan mengaktifkan progressive mute atau lockdown schedule jika spam terus terjadi.`);
      }

      // 2. Errors penalty (max -30)
      if (errorsCount > 0) {
        const penalty = Math.min(errorsCount * 10, 30);
        score -= penalty;
        advice.push(`🚨 Terdeteksi *${errorsCount}* error fungsional. Harap laporkan ke owner atau periksa apakah database mengalami bottleneck.`);
      }

      // 3. Command Success Rate penalty (max -20)
      if (totalLogs > 0) {
        const rate = (successLogs / totalLogs) * 100;
        if (rate < 100) {
          const penalty = Math.min(Math.round((100 - rate) * 0.5), 20);
          score -= penalty;
          advice.push(`⚙️ Tingkat sukses command adalah *${rate.toFixed(1)}%*. Ada beberapa command gagal/invalid yang dijalankan user.`);
        }
      }

      // 4. User engagement penalty
      if (activeUsersCount <= 2) {
        score -= 10;
        advice.push(`💤 Grup sangat sepi (*${activeUsersCount}* anggota aktif). Coba luncurkan game kuis atau Werewolf untuk menarik partisipasi anggota.`);
      }

      // Clamp score
      score = Math.max(0, Math.min(100, score));

      let ratingText = '';
      if (score >= 80) {
        ratingText = '🟢 *SEHAT (Sangat Baik)*';
      } else if (score >= 50) {
        ratingText = '🟡 *KURANG SEHAT (Perlu Perhatian)*';
      } else {
        ratingText = '🔴 *KRITIS (Tindakan Cepat Diperlukan)*';
      }

      let responseText = `📊 *LAPORAN KESEHATAN GRUP (7 HARI TERAKHIR)* 📊\n\n`;
      responseText += `• *Nama Grup:* ${ctx.chatId}\n`;
      responseText += `• *Skor Kesehatan:* *${score}/100*\n`;
      responseText += `• *Status:* ${ratingText}\n\n`;
      responseText += `📈 *METRIK OPERASIONAL:*\n`;
      responseText += `  - Pelanggaran Aturan: *${warningsCount}* kali\n`;
      responseText += `  - Fitur Error: *${errorsCount}* log\n`;
      responseText += `  - Total Command Dijalankan: *${totalLogs}* kali\n`;
      responseText += `  - Anggota Aktif: *${activeUsersCount}* orang\n\n`;

      if (advice.length === 0) {
        responseText += `✅ *Grup berjalan sempurna!* Teruskan menjaga suasana kondusif dan aktif.`;
      } else {
        responseText += `💡 *REKOMENDASI ADMIN:*\n` + advice.join('\n');
      }

      await adapter.sendMessage(ctx.chatId, responseText, { quotedMessageId: ctx.id });
      return;
    }
  }
}

// Register commands
const adminOpsCmd = new AdminOpsCommand();
registerCommand(['rolecustom', 'delegatedmod', 'configdiff', 'rollbackconfig', 'policyeditor', 'ownertaskqueue', 'grouphealth'], adminOpsCmd);
