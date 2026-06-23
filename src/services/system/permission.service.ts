import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isGroupAdmin, isOwner, isPremium, UserRole } from '../../bot/permission.js';
import prisma from '../../db/client.js';

class PermissionService {
  private adminCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  public async checkIfAdmin(
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

    // Check delegated mod
    const isDelegated = await prisma.customVariable.findUnique({
      where: {
        groupId_userId_key: {
          groupId: chatId,
          userId,
          key: 'role:delegatedmod'
        }
      }
    }).catch(() => null);
    if (isDelegated?.value === 'true') return true;

    const cacheKey = `${chatId}:${userId}`;
    const cached = this.adminCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.isAdmin;
    }

    const isAdmin = await isGroupAdmin(chatId, userId, adapter);
    this.adminCache.set(cacheKey, {
      isAdmin,
      expiresAt: now + this.CACHE_TTL_MS
    });

    return isAdmin;
  }

  public isOwner(userId: string): boolean {
    return isOwner(userId);
  }

  public async isPremium(userId: string): Promise<boolean> {
    return isPremium(userId);
  }

  public async getUserRole(
    chatId: string | null,
    userId: string,
    adapter: WhatsAppAdapter
  ): Promise<UserRole> {
    if (isOwner(userId)) return 'owner';
    if (await this.checkIfAdmin(chatId, userId, adapter)) return 'admin';

    // Check custom role
    if (chatId) {
      const customRole = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: chatId,
            userId,
            key: 'role:custom'
          }
        }
      }).catch(() => null);
      if (customRole?.value) {
        return customRole.value as UserRole;
      }
    }

    if (await isPremium(userId)) return 'premium';
    return 'user';
  }

  public clearCache(): void {
    this.adminCache.clear();
  }
}

export const permissionService = new PermissionService();
