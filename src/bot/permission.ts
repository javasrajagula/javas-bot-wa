import { env } from '../config/env.js';
import prisma from '../db/client.js';
import { WhatsAppAdapter } from './whatsapp.adapter.js';

const ownerList = (env as any).OWNER_IDS 
  ? (env as any).OWNER_IDS.split(',').map((id: string) => id.trim().toLowerCase())
  : [];

/**
 * Checks if a user is an owner of the bot based on phone number list in environment.
 */
export function isOwner(userId: string): boolean {
  const number = userId.split('@')[0];
  return ownerList.includes(number) || ownerList.includes(userId.toLowerCase());
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
  if (!chatId) return false;

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
