import { env } from '../config/env.js';
import prisma from '../db/client.js';
import { WhatsAppAdapter } from './whatsapp.adapter.js';
import { maskPhone, redactSensitive } from '../utils/mask.util.js';

function normalizePhone(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');
}

const ownerList = env.OWNER_IDS
  ? env.OWNER_IDS
      .split(',')
      .map((id: string) => normalizePhone(id))
      .filter(Boolean)
  : [];

if (env.LOG_LEVEL === 'debug') {
  console.log('[OWNER CONFIG]', {
    raw: redactSensitive(env.OWNER_IDS),
    ownerList: ownerList.map(maskPhone)
  });
}

/**
 * Checks if a user is an owner of the bot based on phone number list in environment.
 */
export function isOwner(userId: string): boolean {
  const number = normalizePhone(userId);
  const result = ownerList.includes(number);

  if (env.LOG_LEVEL === 'debug') {
    console.log('[OWNER CHECK]', {
      userId: maskPhone(userId),
      number: maskPhone(number),
      ownerList: ownerList.map(maskPhone),
      result
    });
  }

  return result;
}

/**
 * Checks if a user has active premium status in the database.
 */
export async function isPremium(userId: string): Promise<boolean> {
  // Owners are implicitly premium
  if (isOwner(userId)) return true;

  const premium = await prisma.premiumUser.findUnique({
    where: { userId }
  });

  if (!premium) return false;
  return premium.expiresAt.getTime() > Date.now();
}

/**
 * Checks if a user is a group admin.
 */
export async function isGroupAdmin(
  chatId: string | null,
  userId: string,
  adapter: WhatsAppAdapter
): Promise<boolean> {
  if (!chatId || !chatId.endsWith('@g.us')) return false;

  // Owners are implicitly admin everywhere
  if (isOwner(userId)) return true;

  // For ConsoleAdapter simulation
  if (userId.includes('admin') || userId === 'host' || userId === 'user1') {
    return true;
  }

  const socket = (adapter as any).sock;
  if (!socket) return false;

  try {
    const groupMetadata = await socket.groupMetadata(chatId);
    const participant = groupMetadata.participants.find((p: any) => p.id === userId);
    return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  } catch (err) {
    console.error(`[Permission] Failed to check admin status for user ${userId} in chat ${chatId}:`, err);
    return false;
  }
}

export type UserRole = 'owner' | 'admin' | 'premium' | 'user';

/**
 * Resolves the highest permission role for the user in the current context.
 */
export async function getUserRole(
  chatId: string | null,
  userId: string,
  adapter: WhatsAppAdapter
): Promise<UserRole> {
  if (isOwner(userId)) return 'owner';
  if (await isGroupAdmin(chatId, userId, adapter)) return 'admin';
  if (await isPremium(userId)) return 'premium';
  return 'user';
}
