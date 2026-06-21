import prisma from '../../db/client.js';

export interface PrivacyPolicy {
  mode: 'strict' | 'balanced' | 'off';
  canStoreMessageContent: boolean;
  canStoreMetadata: boolean;
  canUseAi: boolean;
  shouldMaskUserId: boolean;
}

export class PrivacyPolicyService {
  private static instance: PrivacyPolicyService | null = null;

  public static getInstance(): PrivacyPolicyService {
    if (!this.instance) {
      this.instance = new PrivacyPolicyService();
    }
    return this.instance;
  }

  public async getPolicy(groupId?: string | null, userId?: string | null): Promise<PrivacyPolicy> {
    let mode: 'strict' | 'balanced' | 'off' = 'off';

    // If in group, check group privacy mode
    if (groupId) {
      const rec = await prisma.customVariable.findFirst({
        where: { groupId, userId: 'system', key: 'privacy:mode' }
      });
      if (rec?.value === 'strict' || rec?.value === 'balanced' || rec?.value === 'off') {
        mode = rec.value;
      }
    }

    const policy: PrivacyPolicy = {
      mode,
      canStoreMessageContent: mode !== 'strict',
      canStoreMetadata: true,
      canUseAi: true,
      shouldMaskUserId: mode === 'strict',
    };

    if (mode === 'strict') {
      policy.canStoreMessageContent = false;
      policy.shouldMaskUserId = true;
      
      // AI and auto summary are default off in strict mode unless consent is ON
      if (userId) {
        const consentAi = await prisma.customVariable.findFirst({
          where: { groupId: groupId || 'private', userId, key: 'consent:ai' }
        });
        policy.canUseAi = consentAi?.value === 'on';
      } else {
        policy.canUseAi = false;
      }
    } else if (mode === 'balanced') {
      policy.canStoreMessageContent = false;
      policy.shouldMaskUserId = false;
      policy.canUseAi = true;
    }

    return policy;
  }

  public maskUserId(userId: string): string {
    if (!userId) return '';
    const parts = userId.split('@');
    if (parts.length < 2) return 'masked-user';
    const phone = parts[0];
    if (phone.length <= 4) return '***@' + parts[1];
    return phone.slice(0, 2) + '****' + phone.slice(-2) + '@' + parts[1];
  }

  public maskSecret(secret: string): string {
    if (!secret) return '';
    if (secret.includes('://')) {
      try {
        const url = new URL(secret);
        if (url.password) {
          url.password = '******';
        }
        return url.toString();
      } catch {
        return secret.slice(0, 10) + '...masked...';
      }
    }
    if (secret.length <= 8) return '********';
    return secret.slice(0, 3) + '...' + secret.slice(-3);
  }
}

export const privacyPolicyService = PrivacyPolicyService.getInstance();
