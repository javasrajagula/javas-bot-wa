import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isOwner } from '../../bot/permission.js';

export class CouponCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // --- 1. /coupon ---
    if (cmd === 'coupon') {
      const action = args[0]?.toLowerCase().trim();

      // /coupon list
      if (!action || action === 'list') {
        const coupons = await prisma.redeemCode.findMany({
          orderBy: { createdAt: 'desc' }
        });

        let response = `🎫 *DAFTAR KUPON AKTIF* 🎫\n\n`;
        const activeCoupons = coupons.filter(c => c.usedCount < c.maxUses);

        if (activeCoupons.length === 0) {
          response += `_Tidak ada kupon aktif saat ini._\n`;
        } else {
          activeCoupons.forEach((c, index) => {
            let rewardText = '';
            try {
              const reward = JSON.parse(c.rewardJson);
              if (reward.credits) rewardText = `${reward.credits} Kredit`;
              else if (reward.balance) rewardText = `${reward.balance} Koin RPG`;
              else if (reward.premiumDays) rewardText = `${reward.premiumDays} Hari Premium`;
            } catch {
              rewardText = c.rewardJson;
            }

            response += `${index + 1}. Kode: \`${c.code}\`\n`;
            response += `   • Hadiah: *${rewardText}*\n`;
            response += `   • Kuota: ${c.usedCount}/${c.maxUses} diklaim\n\n`;
          });
        }

        response += `💡 Klaim kupon dengan perintah: \`/coupon use [kode]\``;
        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        return;
      }

      // /coupon create <code> <reward> <max_uses> (Khusus Owner)
      if (action === 'create') {
        if (!isOwner(ctx.senderId)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Owner yang dapat membuat kupon baru.', { quotedMessageId: ctx.id });
          return;
        }

        const code = args[1]?.toUpperCase().trim();
        const rewardRaw = args[2]?.toLowerCase().trim();
        const maxUsesStr = args[3]?.trim() || '10';
        const maxUses = parseInt(maxUsesStr, 10);

        if (!code || !rewardRaw || Number.isNaN(maxUses) || maxUses <= 0) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/coupon create [KODE] [tipe:jumlah] [max_penggunaan]`\nContoh:\n• `/coupon create BONUS100 credits:100 5`\n• `/coupon create VIP30D premium:30 10`\n• `/coupon create DUIT5K balance:5000 50`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        // Parse reward
        const parts = rewardRaw.split(':');
        const type = parts[0];
        const value = parseInt(parts[1], 10);

        if (!['credits', 'balance', 'premium'].includes(type) || Number.isNaN(value) || value <= 0) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format hadiah tidak valid. Gunakan format `credits:100`, `balance:5000`, atau `premium:30`.', { quotedMessageId: ctx.id });
          return;
        }

        // Siapkan rewardJson
        const rewardObj: any = {};
        if (type === 'credits') rewardObj.credits = value;
        else if (type === 'balance') rewardObj.balance = value;
        else if (type === 'premium') rewardObj.premiumDays = value;

        try {
          await prisma.redeemCode.upsert({
            where: { code },
            create: {
              code,
              rewardJson: JSON.stringify(rewardObj),
              maxUses,
              usedCount: 0
            },
            update: {
              rewardJson: JSON.stringify(rewardObj),
              maxUses,
              usedCount: 0
            }
          });

          await adapter.sendMessage(
            ctx.chatId,
            `✅ *KUPON BERHASIL DIBUAT!* 🎫\n\n• *Kode:* \`${code}\`\n• *Hadiah:* ${value} ${type === 'credits' ? 'Kredit' : type === 'balance' ? 'Koin RPG' : 'Hari Premium'}\n• *Kuota:* ${maxUses} klaim`,
            { quotedMessageId: ctx.id }
          );
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat kupon: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // /coupon use <code>
      if (action === 'use') {
        const code = args[1]?.toUpperCase().trim();

        if (!code) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan kode kupon yang ingin diklaim.\nContoh: `/coupon use BONUS100`', { quotedMessageId: ctx.id });
          return;
        }

        // Cari kupon di DB
        const coupon = await prisma.redeemCode.findUnique({
          where: { code }
        });

        if (!coupon) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Kode kupon tidak valid atau tidak terdaftar.', { quotedMessageId: ctx.id });
          return;
        }

        // Cek kuota penukaran
        if (coupon.usedCount >= coupon.maxUses) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Kuota penggunaan kupon ini telah habis.', { quotedMessageId: ctx.id });
          return;
        }

        // Cek apakah user sudah pernah me-redeem kupon ini
        const hasRedeemed = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: 'global',
              userId: ctx.senderId,
              key: `redeem:${code}`
            }
          }
        });

        if (hasRedeemed) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda sudah pernah mengklaim kupon ini sebelumnya.', { quotedMessageId: ctx.id });
          return;
        }

        // Berikan hadiah ke user
        let rewardMsg = '';
        try {
          const reward = JSON.parse(coupon.rewardJson);

          if (reward.credits) {
            // Tambahkan Kredit
            const dbCredit = await prisma.customVariable.findUnique({
              where: {
                groupId_userId_key: {
                  groupId: 'global',
                  userId: ctx.senderId,
                  key: 'credits'
                }
              }
            });
            const currentCredits = dbCredit ? parseInt(dbCredit.value, 10) : 0;
            const newCredits = currentCredits + reward.credits;

            await prisma.customVariable.upsert({
              where: {
                groupId_userId_key: {
                  groupId: 'global',
                  userId: ctx.senderId,
                  key: 'credits'
                }
              },
              create: {
                groupId: 'global',
                userId: ctx.senderId,
                key: 'credits',
                value: String(newCredits)
              },
              update: {
                value: String(newCredits)
              }
            });

            rewardMsg = `🪙 +${reward.credits} Kredit Premium (Total: ${newCredits} Kredit)`;
          } else if (reward.balance) {
            // Tambahkan Balance RPG
            const economy = await prisma.userEconomy.findUnique({
              where: { userId: ctx.senderId }
            });
            const currentBal = economy ? economy.balance : 0;
            const newBal = currentBal + reward.balance;

            await prisma.userEconomy.upsert({
              where: { userId: ctx.senderId },
              create: {
                userId: ctx.senderId,
                balance: newBal
              },
              update: {
                balance: newBal
              }
            });

            rewardMsg = `💰 +${reward.balance.toLocaleString('id-ID')} Koin RPG`;
          } else if (reward.premiumDays) {
            // Tambahkan Premium User status
            const premUser = await prisma.premiumUser.findUnique({
              where: { userId: ctx.senderId }
            });

            let expiresAt = new Date();
            if (premUser && premUser.expiresAt.getTime() > Date.now()) {
              expiresAt = new Date(premUser.expiresAt.getTime());
            }
            expiresAt.setDate(expiresAt.getDate() + reward.premiumDays);

            await prisma.premiumUser.upsert({
              where: { userId: ctx.senderId },
              create: {
                userId: ctx.senderId,
                expiresAt
              },
              update: {
                expiresAt
              }
            });

            rewardMsg = `👑 +${reward.premiumDays} Hari Akses Premium User (Aktif s.d. ${expiresAt.toLocaleDateString('id-ID')})`;
          }

          // Catat penggunaan oleh user agar tidak double-redeem
          await prisma.customVariable.create({
            data: {
              groupId: 'global',
              userId: ctx.senderId,
              key: `redeem:${code}`,
              value: 'true'
            }
          });

          // Update count kupon
          await prisma.redeemCode.update({
            where: { code },
            data: { usedCount: coupon.usedCount + 1 }
          });

          await adapter.sendMessage(
            ctx.chatId,
            `🎉 *KLAIM KUPON BERHASIL!* 🎉\n\n• *Kode:* \`${code}\`\n• *Hadiah:* ${rewardMsg}`,
            { quotedMessageId: ctx.id }
          );
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mengklaim hadiah kupon: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }
    }

    // --- 2. /referral ---
    if (cmd === 'referral') {
      const refCode = `REF-${ctx.senderId.split('@')[0].slice(-6).toUpperCase()}`;

      // Simpan mapping kode referral ke user di CustomVariable agar mudah dicari
      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId: ctx.senderId,
            key: `referral_code:${refCode}`
          }
        },
        create: {
          groupId: 'global',
          userId: ctx.senderId,
          key: `referral_code:${refCode}`,
          value: ctx.senderId
        },
        update: {
          value: ctx.senderId
        }
      });

      // Ambil referral count
      const dbCount = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'referral_count'
          }
        }
      });

      const refCount = dbCount ? parseInt(dbCount.value, 10) : 0;

      const response = `🤝 *PROGRAM REFERRAL JAVAS BOT* 🤝

Bagikan kode referral Anda ke teman baru untuk mendapatkan bonus koin bersama!

• *Kode Referral Anda:* \`${refCode}\`
• *Teman yang Diundang:* ${refCount} Orang

*=================================*
💡 *CARA KERJA:*
1. Teman Anda mengetik perintah:
   \`/refclaim ${refCode}\`
2. Teman Anda akan mendapatkan bonus *200* Koin RPG.
3. Anda akan mendapatkan bonus referral sebesar *500* Koin RPG!

_(Catatan: Hanya bisa mengklaim 1 kode referral orang lain sekali per akun)_`;

      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // --- 3. /refclaim <code> ---
    if (cmd === 'refclaim') {
      const refCode = args[0]?.toUpperCase().trim();

      if (!refCode) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan kode referral yang ingin diklaim.\nContoh: `/refclaim REF-XXXXXX`', { quotedMessageId: ctx.id });
        return;
      }

      // Cek apakah user mengklaim kodenya sendiri
      const userRefCode = `REF-${ctx.senderId.split('@')[0].slice(-6).toUpperCase()}`;
      if (refCode === userRefCode) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak dapat mengklaim kode referral Anda sendiri.', { quotedMessageId: ctx.id });
        return;
      }

      // Cek apakah user sudah pernah klaim referral sebelumnya
      const hasClaimed = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'referral_claimed_by'
          }
        }
      });

      if (hasClaimed) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda hanya dapat mengklaim kode referral sekali saja.', { quotedMessageId: ctx.id });
        return;
      }

      // Cari pemilik kode referral
      const refMapping = await prisma.customVariable.findFirst({
        where: {
          key: `referral_code:${refCode}`
        }
      });

      if (!refMapping || !refMapping.userId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Kode referral tidak valid atau tidak terdaftar di sistem.', { quotedMessageId: ctx.id });
        return;
      }

      const ownerId = refMapping.userId;

      try {
        // 1. Berikan bonus ke pengklaim (200 koin RPG)
        const claimerEco = await prisma.userEconomy.findUnique({
          where: { userId: ctx.senderId }
        });
        const claimerBal = claimerEco ? claimerEco.balance : 0;
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: claimerBal + 200 },
          update: { balance: claimerBal + 200 }
        });

        // 2. Berikan bonus ke pemilik referral (500 koin RPG)
        const ownerEco = await prisma.userEconomy.findUnique({
          where: { userId: ownerId }
        });
        const ownerBal = ownerEco ? ownerEco.balance : 0;
        await prisma.userEconomy.upsert({
          where: { userId: ownerId },
          create: { userId: ownerId, balance: ownerBal + 500 },
          update: { balance: ownerBal + 500 }
        });

        // 3. Tambah count pemilik
        const ownerCountVar = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: 'global',
              userId: ownerId,
              key: 'referral_count'
            }
          }
        });
        const currentCount = ownerCountVar ? parseInt(ownerCountVar.value, 10) : 0;
        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: 'global',
              userId: ownerId,
              key: 'referral_count'
            }
          },
          create: {
            groupId: 'global',
            userId: ownerId,
            key: 'referral_count',
            value: String(currentCount + 1)
          },
          update: {
            value: String(currentCount + 1)
          }
        });

        // 4. Catat bahwa user ini sudah klaim agar tidak bisa klaim lagi
        await prisma.customVariable.create({
          data: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'referral_claimed_by',
            value: ownerId
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `🎉 *KLAIM REFERRAL BERHASIL!* 🎉\n\n• Anda mendapatkan: *+200* Koin RPG\n• Pemilik kode (@${ownerId.split('@')[0]}) mendapatkan: *+500* Koin RPG!`,
          { mentions: [ownerId], quotedMessageId: ctx.id }
        );
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses klaim referral: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const couponCmd = new CouponCommand();
registerCommand(['coupon', 'referral', 'refclaim'], couponCmd);
