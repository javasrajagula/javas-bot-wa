import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import crypto from 'crypto';

export class AutomationCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // Helper untuk mengambil/mengupdate CustomVariable
    const getGroupVariable = async (groupId: string, key: string): Promise<any | null> => {
      const record = await prisma.customVariable.findFirst({
        where: { groupId, key }
      });
      if (!record) return null;
      try {
        return JSON.parse(record.value);
      } catch {
        return record.value;
      }
    };

    const setGroupVariable = async (groupId: string, key: string, value: any): Promise<void> => {
      const existing = await prisma.customVariable.findFirst({
        where: { groupId, key }
      });

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (existing) {
        await prisma.customVariable.update({
          where: { id: existing.id },
          data: { value: stringValue }
        });
      } else {
        await prisma.customVariable.create({
          data: {
            groupId,
            userId: 'system',
            key,
            value: stringValue
          }
        });
      }
    };

    const deleteGroupVariable = async (groupId: string, key: string): Promise<boolean> => {
      const existing = await prisma.customVariable.findFirst({
        where: { groupId, key }
      });
      if (existing) {
        await prisma.customVariable.delete({
          where: { id: existing.id }
        });
        return true;
      }
      return false;
    };

    // --- 1. /var set/get/list/delete ---
    if (cmd === 'var') {
      const sub = args[0]?.toLowerCase().trim();

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Masukkan sub-command var.\nGunakan:\n' +
          '• `/var set [nama] [nilai]` — Mengeset variabel kustom grup/personal\n' +
          '• `/var get [nama]` — Mengambil nilai variabel kustom\n' +
          '• `/var list` — Menampilkan seluruh variabel kustom\n' +
          '• `/var delete [nama]` — Menghapus variabel kustom',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const isGroup = ctx.isGroup;
      const groupId = isGroup ? ctx.chatId : 'private';
      const userId = isGroup ? 'system' : ctx.senderId;

      if (sub === 'set') {
        if (isGroup) {
          const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
          if (!isAdmin) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat mengelola variabel kustom grup.', { quotedMessageId: ctx.id });
            return;
          }
        }

        const key = args[1]?.trim();
        const val = args.slice(2).join(' ').trim();

        if (!key || !val) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/var set [nama] [nilai]`', { quotedMessageId: ctx.id });
          return;
        }

        const dbKey = `var:${key}`;
        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId,
              userId,
              key: dbKey
            }
          },
          create: {
            groupId,
            userId,
            key: dbKey,
            value: val
          },
          update: {
            value: val
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Variabel kustom *{${key}}* berhasil diset ke: *${val}*`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'get') {
        const key = args[1]?.trim();
        if (!key) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/var get [nama]`', { quotedMessageId: ctx.id });
          return;
        }

        const dbVar = await prisma.customVariable.findFirst({
          where: {
            groupId,
            userId,
            key: `var:${key}`
          }
        });

        if (!dbVar) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Variabel kustom *{${key}}* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, `ℹ️ Nilai variabel *{${key}}* adalah: *${dbVar.value}*`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'list') {
        const dbVars = await prisma.customVariable.findMany({
          where: {
            groupId,
            userId,
            key: { startsWith: 'var:' }
          }
        });

        if (dbVars.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada variabel kustom yang didaftarkan.', { quotedMessageId: ctx.id });
          return;
        }

        let response = `📋 *DAFTAR VARIABEL KUSTOM* 📋\n\n`;
        dbVars.forEach((v, index) => {
          const varName = v.key.replace('var:', '');
          response += `${index + 1}. *{${varName}}* = ${v.value}\n`;
        });

        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'delete' || sub === 'del') {
        if (isGroup) {
          const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
          if (!isAdmin) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat menghapus variabel kustom grup.', { quotedMessageId: ctx.id });
            return;
          }
        }

        const key = args[1]?.trim();
        if (!key) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/var delete [nama]`', { quotedMessageId: ctx.id });
          return;
        }

        const dbVar = await prisma.customVariable.findFirst({
          where: {
            groupId,
            userId,
            key: `var:${key}`
          }
        });

        if (!dbVar) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Variabel kustom *{${key}}* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.delete({
          where: { id: dbVar.id }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Variabel kustom *{${key}}* berhasil dihapus.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    // --- 2. /auto when <join/badword/3warn> <send/warn/kick> ---
    if (cmd === 'auto') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur Otomasi Builder hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat mengonfigurasi otomatisasi.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase().trim();

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Masukkan sub-command auto.\nGunakan:\n' +
          '• `/auto when join send [pesan]` — Otomasi kirim pesan saat member gabung\n' +
          '• `/auto when badword warn` — Otomasi beri peringatan saat member toxic\n' +
          '• `/auto when 3warn kick` — Otomasi kick saat member mendapat 3 warning\n' +
          '• `/auto list` — Menampilkan seluruh otomasi grup\n' +
          '• `/auto delete [ID]` — Menghapus otomatisasi kustom',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (sub === 'when') {
        const trigger = args[1]?.toLowerCase().trim();
        const action = args[2]?.toLowerCase().trim();
        const details = args.slice(3).join(' ').trim();

        if (!trigger || !action) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/auto when join send Selamat datang!`', { quotedMessageId: ctx.id });
          return;
        }

        // Cek validitas
        const isValidTrigger = ['join', 'badword', '3warn'].includes(trigger);
        const isValidAction = ['send', 'warn', 'kick'].includes(action);

        if (!isValidTrigger || !isValidAction) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Trigger atau Action tidak valid. Trigger: [join|badword|3warn], Action: [send|warn|kick]', { quotedMessageId: ctx.id });
          return;
        }

        const autoId = `AUTO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const autoData = {
          id: autoId,
          trigger,
          action,
          details: details || '',
          createdAt: Date.now()
        };

        await setGroupVariable(ctx.chatId, `auto:${autoId}`, autoData);

        await adapter.sendMessage(
          ctx.chatId,
          `✅ *OTOMASI BERHASIL DIBUAT!* 🤖\n\n• *ID:* \`${autoId}\`\n• *Jika:* ketika \`${trigger}\` terjadi\n• *Maka:* lakukan \`${action}\` ${details ? `(${details})` : ''}`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (sub === 'list') {
        try {
          const dbAutos = await prisma.customVariable.findMany({
            where: {
              groupId: ctx.chatId,
              key: { startsWith: 'auto:' }
            }
          });

          if (dbAutos.length === 0) {
            await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada aturan otomasi otomatis di grup ini.', { quotedMessageId: ctx.id });
            return;
          }

          let response = `🤖 *DAFTAR OTOMASI GRUP* 🤖\n\n`;
          dbAutos.forEach((v, index) => {
            try {
              const parsed = JSON.parse(v.value);
              response += `${index + 1}. *[ID: ${parsed.id}]*\n`;
              response += `   • *Trigger:* ketika \`${parsed.trigger}\` terjadi\n`;
              response += `   • *Action:* \`${parsed.action}\` ${parsed.details ? `(${parsed.details})` : ''}\n\n`;
            } catch {}
          });

          await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal memuat otomasi: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      if (sub === 'delete' || sub === 'del') {
        const id = args[1]?.trim().toUpperCase();
        if (!id) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/auto delete AUTO-XYZ`', { quotedMessageId: ctx.id });
          return;
        }

        const success = await deleteGroupVariable(ctx.chatId, `auto:${id}`);
        if (success) {
          await adapter.sendMessage(ctx.chatId, `✅ Otomasi dengan ID \`${id}\` berhasil dihapus.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `⚠️ Otomasi dengan ID \`${id}\` tidak ditemukan.`, { quotedMessageId: ctx.id });
        }
        return;
      }
    }

    // --- 3. /workflow create/list/delete ---
    if (cmd === 'workflow') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur Custom Workflow hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat mengelola custom workflows.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase().trim();

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Masukkan sub-command workflow.\nGunakan:\n' +
          '• `/workflow create [nama]` — Membuat workflow kustom baru\n' +
          '• `/workflow list` — Daftar workflow grup\n' +
          '• `/workflow delete [nama]` — Menghapus workflow',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (sub === 'create') {
        const name = args[1]?.trim().toLowerCase();
        if (!name) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan nama workflow. Contoh: `/workflow create sambutan`', { quotedMessageId: ctx.id });
          return;
        }

        const workflowId = `WF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const wfData = {
          id: workflowId,
          name,
          status: 'active',
          steps: [
            { step: 1, action: 'send_rules' },
            { step: 2, action: 'wait_5m' },
            { step: 3, action: 'check_verification' }
          ],
          createdAt: Date.now()
        };

        await setGroupVariable(ctx.chatId, `workflow:${name}`, wfData);

        await adapter.sendMessage(
          ctx.chatId,
          `✅ *WORKFLOW DIBUAT!* 🔄\n\n• *ID:* \`${workflowId}\`\n• *Nama:* ${name}\n• *Langkah:* \n1. send_rules\n2. wait_5m\n3. check_verification`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (sub === 'list') {
        const dbWfs = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.chatId,
            key: { startsWith: 'workflow:' }
          }
        });

        if (dbWfs.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada custom workflow terdaftar di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let response = `🔄 *DAFTAR WORKFLOW GRUP* 🔄\n\n`;
        dbWfs.forEach((v, index) => {
          try {
            const parsed = JSON.parse(v.value);
            response += `${index + 1}. *[${parsed.name.toUpperCase()}]* (ID: \`${parsed.id}\`)\n`;
            parsed.steps.forEach((s: any) => {
              response += `   ➔ Langkah ${s.step}: ${s.action}\n`;
            });
            response += `\n`;
          } catch {}
        });

        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'delete' || sub === 'del') {
        const name = args[1]?.trim().toLowerCase();
        if (!name) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan nama workflow yang ingin dihapus. Contoh: `/workflow delete sambutan`', { quotedMessageId: ctx.id });
          return;
        }

        const success = await deleteGroupVariable(ctx.chatId, `workflow:${name}`);
        if (success) {
          await adapter.sendMessage(ctx.chatId, `✅ Workflow *${name}* berhasil dihapus.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `⚠️ Workflow *${name}* tidak ditemukan.`, { quotedMessageId: ctx.id });
        }
        return;
      }
    }

    // --- 4. /rule tambah/list/delete ---
    if (cmd === 'rule') {
      const sub = args[0]?.toLowerCase().trim();

      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur Smart Rules hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Masukkan sub-command rule.\nGunakan:\n' +
          '• `/rule tambah [peraturan]` — Menambahkan aturan pintar berbasis NLP/teks biasa\n' +
          '• `/rule list` — Daftar peraturan grup\n' +
          '• `/rule delete [ID]` — Menghapus peraturan',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const ruleStore = (await getGroupVariable(ctx.chatId, 'smart:rules')) || { rules: [] };

      if (sub === 'tambah') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat menambahkan peraturan baru.', { quotedMessageId: ctx.id });
          return;
        }

        const ruleText = args.slice(1).join(' ').trim();
        if (!ruleText) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tulis teks peraturan. Contoh: `/rule tambah dilarang spam stiker`', { quotedMessageId: ctx.id });
          return;
        }

        const ruleId = `RULE-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        ruleStore.rules.push({ id: ruleId, content: ruleText, createdAt: Date.now() });
        await setGroupVariable(ctx.chatId, 'smart:rules', ruleStore);

        await adapter.sendMessage(ctx.chatId, `✅ *PERATURAN PINTAR DITAMBAHKAN!* 📝\n\n• *ID:* \`${ruleId}\`\n• *Aturan:* ${ruleText}`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'list') {
        if (ruleStore.rules.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada peraturan pintar yang terdaftar di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let response = `📝 *PERATURAN PINTAR GRUP* 📝\n\n`;
        ruleStore.rules.forEach((r: any, idx: number) => {
          response += `${idx + 1}. *[ID: ${r.id}]*\n   ${r.content}\n\n`;
        });

        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'delete' || sub === 'del') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat menghapus peraturan.', { quotedMessageId: ctx.id });
          return;
        }

        const ruleId = args[1]?.trim().toUpperCase();
        if (!ruleId) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan ID peraturan yang ingin dihapus. Contoh: `/rule delete RULE-XYZ`', { quotedMessageId: ctx.id });
          return;
        }

        const origLen = ruleStore.rules.length;
        ruleStore.rules = ruleStore.rules.filter((r: any) => r.id !== ruleId);

        if (ruleStore.rules.length < origLen) {
          await setGroupVariable(ctx.chatId, 'smart:rules', ruleStore);
          await adapter.sendMessage(ctx.chatId, `✅ Peraturan dengan ID \`${ruleId}\` berhasil dihapus.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `⚠️ Peraturan dengan ID \`${ruleId}\` tidak ditemukan.`, { quotedMessageId: ctx.id });
        }
        return;
      }
    }
  }
}

const automationCmd = new AutomationCommand();
registerCommand(['var', 'auto', 'workflow', 'rule'], automationCmd);
