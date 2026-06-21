import { isOwner, isPremium, isGroupAdmin } from '../bot/permission.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getGroupFeatures } from '../config/feature-flags.js';
import prisma from '../db/client.js';

export function requireOwner(senderId: string): void {
  if (!isOwner(senderId)) {
    throw new Error('Command ini hanya dapat diakses oleh Owner bot.');
  }
}

export async function requireAdmin(
  chatId: string | null,
  senderId: string,
  adapter: WhatsAppAdapter
): Promise<void> {
  if (!chatId) {
    throw new Error('Command ini hanya bisa digunakan di dalam grup.');
  }
  const isAdmin = await isGroupAdmin(chatId, senderId, adapter);
  if (!isAdmin) {
    throw new Error('Hanya admin grup yang memiliki otoritas untuk command ini.');
  }
}

export async function requirePremium(senderId: string): Promise<void> {
  const premium = await isPremium(senderId);
  if (!premium) {
    throw new Error('Fitur ini hanya untuk premium user.');
  }
}

export async function requireFeatureEnabled(
  chatId: string | null,
  featureName: string
): Promise<void> {
  if (!chatId) return; // private chat doesn't enforce group feature flags
  
  const flags = await getGroupFeatures(chatId);
  if (!flags[featureName]) {
    throw new Error(`Fitur "${featureName}" sedang nonaktif di grup ini. Admin dapat mengaktifkannya menggunakan \`/feature ${featureName} on\`.`);
  }
}

import { normalizeJid } from '../utils/jid.util.js';

export async function requireNotBlacklisted(
  chatId: string | null,
  senderId: string
): Promise<void> {
  const senderCanonical = normalizeJid(senderId);
  const chatCanonical = chatId ? normalizeJid(chatId) : null;

  const blacklisted = await prisma.blacklist.findFirst({
    where: {
      AND: [
        {
          OR: [
            { userId: senderCanonical },
            { userId: senderId }
          ]
        },
        {
          OR: [
            { scope: 'global' },
            {
              scope: 'group',
              groupId: {
                in: [chatId, chatCanonical].filter(Boolean) as string[]
              }
            }
          ]
        }
      ]
    }
  });

  if (blacklisted) {
    if (blacklisted.reason?.startsWith('Temp ban until:')) {
      const parts = blacklisted.reason.split(':');
      const expiresAt = parseInt(parts[1] || '0', 10);
      if (Date.now() > expiresAt) {
        await prisma.blacklist.delete({ where: { id: blacklisted.id } });
        return;
      }
    }
    throw new Error(`Akses ditolak. Anda berada dalam daftar hitam (blacklist) bot.${blacklisted.reason ? ' Alasan: ' + blacklisted.reason : ''}`);
  }
}
