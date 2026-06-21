import prisma from '../../db/client.js';

/**
 * Normalizes user ID to canonical form (phone@s.whatsapp.net).
 * If @lid cannot be resolved, throws a silent LidUnresolvableError (caught by isPremiumUser).
 */
export class LidUnresolvableError extends Error {
  constructor(jid: string) {
    super(`@lid JID belum ter-resolve: ${jid}`);
    this.name = 'LidUnresolvableError';
  }
}

export function normalizePremiumUserId(input: string, { strict = false } = {}): string {
  const raw = String(input || '').trim().replace(/^@/, '');

  // @lid format — only reject with friendly message in strict mode (e.g., addPremium)
  if (raw.endsWith('@lid')) {
    if (strict) {
      throw new Error(`ID format @lid tidak didukung (${raw}). Gunakan nomor HP langsung, misal: 628xxxxxxxxx`);
    }
    // In non-strict mode (isPremiumUser checks), throw silent error
    throw new LidUnresolvableError(raw);
  }

  const noDomain = raw.split('@')[0];
  const noDevice = noDomain.split(':')[0];

  if (/[a-zA-Z]/.test(noDevice)) {
    return `${noDevice}@s.whatsapp.net`;
  }

  const phone = noDevice.replace(/\D/g, '');

  if (!phone || phone.length < 8) throw new Error(`User ID premium tidak valid: "${input}". Gunakan nomor HP, misal: 628xxxxxxxxx`);

  return `${phone}@s.whatsapp.net`;
}


/**
 * Adds premium status to a user or extends their active duration.
 */
export async function addPremiumUser(
  inputUserId: string,
  days: number,
  actorId?: string
): Promise<{ userId: string; expiresAt: Date; isExtended: boolean }> {
  const targetUserId = normalizePremiumUserId(inputUserId, { strict: true });
  const now = new Date();
  
  console.log(`[Premium] Adding/extending premium for ${targetUserId} (${days} days)`);

  const existing = await prisma.premiumUser.findUnique({
    where: { userId: targetUserId }
  });

  let expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  let isExtended = false;

  if (existing && existing.expiresAt.getTime() > now.getTime()) {
    expiresAt = new Date(existing.expiresAt.getTime() + days * 24 * 60 * 60 * 1000);
    isExtended = true;
  }

  await prisma.premiumUser.upsert({
    where: { userId: targetUserId },
    create: { userId: targetUserId, expiresAt },
    update: { expiresAt }
  });

  await prisma.userProfile.upsert({
    where: { userId: targetUserId },
    create: { userId: targetUserId, isPremium: true, premiumUntil: expiresAt },
    update: { isPremium: true, premiumUntil: expiresAt }
  });

  await prisma.auditLog.create({
    data: {
      actorId: actorId || 'system',
      action: isExtended ? 'extend_premium' : 'add_premium',
      target: targetUserId,
      metadataJson: JSON.stringify({ days, expiresAt })
    }
  });
  
  console.log(`[Premium] Successfully stored: userId=${targetUserId}, expiresAt=${expiresAt.toISOString()}`);

  return { userId: targetUserId, expiresAt, isExtended };
}

/**
 * Removes premium status from a user.
 */
export async function removePremiumUser(inputUserId: string, actorId?: string): Promise<boolean> {
  const targetUserId = normalizePremiumUserId(inputUserId, { strict: true });

  await prisma.premiumUser.deleteMany({
    where: { userId: targetUserId }
  });

  await prisma.userProfile.updateMany({
    where: { userId: targetUserId },
    data: { isPremium: false, premiumUntil: null }
  });

  await prisma.auditLog.create({
    data: {
      actorId: actorId || 'system',
      action: 'remove_premium',
      target: targetUserId,
      metadataJson: JSON.stringify({ removedAt: new Date() })
    }
  });

  return true;
}

/**
 * Checks if a user has active premium status.
 */
export async function isPremiumUser(inputUserId: string): Promise<boolean> {
  try {
    let resolvedUserId = inputUserId;
    try {
      const { AdapterHolder } = await import('../../bot/adapter-holder.js');
      const adapter = AdapterHolder.getAdapter();
      if (adapter && typeof (adapter as any).resolveToPhoneJid === 'function') {
        resolvedUserId = (adapter as any).resolveToPhoneJid(inputUserId);
      }
    } catch {}

    const targetUserId = normalizePremiumUserId(resolvedUserId);

    const { isOwner } = await import('../../bot/permission.js');
    if (isOwner(targetUserId)) return true;

    const premium = await prisma.premiumUser.findUnique({
      where: { userId: targetUserId }
    });

    if (!premium) return false;
    return premium.expiresAt.getTime() > Date.now();
  } catch (err: any) {
    // @lid JID yang belum ter-resolve — silent fail, anggap non-premium
    if (err?.name === 'LidUnresolvableError') return false;
    return false;
  }
}

/**
 * Gets detailed premium status for a user.
 */
export async function getPremiumStatus(inputUserId: string): Promise<{ isPremium: boolean; expiresAt: Date | null; daysLeft: number }> {
  let resolvedUserId = inputUserId;
  try {
    const { AdapterHolder } = await import('../../bot/adapter-holder.js');
    const adapter = AdapterHolder.getAdapter();
    if (adapter && typeof (adapter as any).resolveToPhoneJid === 'function') {
      resolvedUserId = (adapter as any).resolveToPhoneJid(inputUserId);
    }
  } catch {}

  let targetUserId: string;
  try {
    targetUserId = normalizePremiumUserId(resolvedUserId);
  } catch (err: any) {
    // @lid yang belum ter-resolve — kembalikan status non-premium
    if (err?.name === 'LidUnresolvableError') {
      return { isPremium: false, expiresAt: null, daysLeft: 0 };
    }
    throw err;
  }

  const { isOwner } = await import('../../bot/permission.js');
  const isBotOwner = isOwner(targetUserId);

  if (isBotOwner) {
    return {
      isPremium: true,
      expiresAt: null,
      daysLeft: 99999
    };
  }

  const premium = await prisma.premiumUser.findUnique({
    where: { userId: targetUserId }
  });

  if (!premium || premium.expiresAt.getTime() <= Date.now()) {
    return {
      isPremium: false,
      expiresAt: null,
      daysLeft: 0
    };
  }

  const daysLeft = Math.ceil((premium.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return {
    isPremium: true,
    expiresAt: premium.expiresAt,
    daysLeft
  };
}

/**
 * Normalizes all JIDs in premiumUser table to canonical JIDs, merging duplicates with longest expiry.
 */
export async function normalizePremiumRecords(): Promise<{ updatedCount: number }> {
  const allRecords = await prisma.premiumUser.findMany();
  const mergedExpiryMap = new Map<string, Date>();

  for (const record of allRecords) {
    try {
      const canonicalId = normalizePremiumUserId(record.userId);
      const existingExp = mergedExpiryMap.get(canonicalId);

      if (!existingExp || record.expiresAt.getTime() > existingExp.getTime()) {
        mergedExpiryMap.set(canonicalId, record.expiresAt);
      }
    } catch (err) {
      console.warn(`[Premium Normalization] Skipping invalid JID: ${record.userId}`);
    }
  }

  // Delete all existing records
  await prisma.premiumUser.deleteMany({});

  // Re-insert canonical records
  let updatedCount = 0;
  for (const [userId, expiresAt] of mergedExpiryMap.entries()) {
    await prisma.premiumUser.create({
      data: { userId, expiresAt }
    });

    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, isPremium: true, premiumUntil: expiresAt },
      update: { isPremium: true, premiumUntil: expiresAt }
    });
    updatedCount++;
  }

  return { updatedCount };
}
