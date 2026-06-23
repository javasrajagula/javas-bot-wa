import { describe, expect, it, beforeAll } from 'vitest';
import { PRD_CATALOG } from '../commands/prd/prd-feature-catalog.js';
import { commandRegistry } from '../commands/registry/command-registry.js';
import { PRDScaffoldCommand } from '../commands/prd/prd-scaffold.js';
import { PrdGamesSuiteCommand } from '../commands/games/prd-games.command.js';

describe('PRD Batch 1A — Catalog and Scaffold Handler Foundation', () => {
  let mockAdapter: any;
  let sentMessages: { chatId: string; text: string; options?: any }[] = [];

  beforeAll(async () => {
    // Import all command modules so they register in Vitest environment
    await import('../commands/menu.command.js');
    await import('../commands/admin.command.js');
    await import('../commands/setup.command.js');
    await import('../commands/feature.command.js');
    await import('../commands/downloader.command.js');
    await import('../commands/economy.command.js');
    await import('../commands/subscription.command.js');
    await import('../commands/sticker/sticker.command.js');
    await import('../commands/media/media.command.js');
    await import('../commands/audio/audio.command.js');
    await import('../commands/text/text.command.js');
    await import('../commands/text/ai.command.js');
    await import('../commands/document/document.command.js');
    await import('../commands/document/safety.command.js');
    await import('../commands/moderation/moderation.command.js');
    await import('../commands/moderation/antispam.command.js');
    await import('../commands/moderation/warning-rule.command.js');
    await import('../commands/moderation/group-log.command.js');
    await import('../commands/moderation/antiraid.command.js');
    await import('../commands/moderation/backup-config.command.js');
    await import('../commands/moderation/dynamic-security.command.js');
    await import('../commands/community/community.command.js');
    await import('../commands/community/schedule.command.js');
    await import('../commands/community/alias.command.js');
    await import('../commands/community/locale.command.js');
    await import('../commands/community/welcome.command.js');
    await import('../commands/community/school.command.js');
    await import('../commands/community/attendance.command.js');
    await import('../commands/community/stats.command.js');
    await import('../commands/community/reputation.command.js');
    await import('../commands/community/notes.command.js');
    await import('../commands/community/business.command.js');
    await import('../commands/community/finance.command.js');
    await import('../commands/community/automation.command.js');
    await import('../commands/games/games.command.js');
    await import('../commands/games/mission.command.js');
    await import('../commands/owner/owner.command.js');
    await import('../commands/owner/error.command.js');
    await import('../commands/owner/queue.command.js');
    await import('../commands/owner/status.command.js');
    await import('../commands/owner/quota.command.js');
    await import('../commands/owner/coupon.command.js');
    await import('../commands/owner/reseller.command.js');
    await import('../commands/owner/privacy.command.js');
    await import('../commands/privacy/privacy-data.command.js');
    await import('../commands/owner/webhook.command.js');
    await import('../commands/admin/admin-ops.command.js');
    await import('../commands/prd/prd-coverage.command.js');
    await import('../commands/prd/prd-scaffold.js');
    await import('../commands/games/prd-games.command.js');

    mockAdapter = {
      sendMessage: async (chatId: string, text: string, options?: any) => {
        sentMessages.push({ chatId, text, options });
        return { key: { id: 'mock-msg-' + Math.random() } };
      }
    };
  });

  const getCtx = (cmdName: string, body: string): any => ({
    id: `msg-${Math.random()}`,
    chatId: 'test-group@g.us',
    senderId: 'test-user@s.whatsapp.net',
    body,
    isGroup: true,
    command: {
      prefix: '/',
      rawCommandName: cmdName,
      commandName: cmdName,
      args: body.split(/\s+/).slice(1),
      isCommand: true
    }
  });

  it('verifies all F001-F140 and G001-G050 PRD IDs are loaded into the catalog', () => {
    // Assert 190 entries total
    expect(PRD_CATALOG.length).toBe(190);

    const fIds = PRD_CATALOG.filter(entry => entry.id.startsWith('F'));
    const gIds = PRD_CATALOG.filter(entry => entry.id.startsWith('G'));

    expect(fIds.length).toBe(140);
    expect(gIds.length).toBe(50);

    // Verify boundaries
    const idSet = new Set(PRD_CATALOG.map(entry => entry.id));
    expect(idSet.has('F001')).toBe(true);
    expect(idSet.has('F140')).toBe(true);
    expect(idSet.has('G001')).toBe(true);
    expect(idSet.has('G050')).toBe(true);
  });

  it('verifies that the generic scaffold handler returns a safe, detailed response for features', async () => {
    const handler = new PRDScaffoldCommand();
    const ctx = getCtx('antiflood', '/antiflood');

    sentMessages = [];
    await handler.execute(ctx, [], mockAdapter);

    expect(sentMessages.length).toBe(1);
    const text = sentMessages[0].text;

    // Must contain PRD ID, command name, description, and awaiting implementation status
    expect(text).toContain('F001');
    expect(text).toContain('antiflood');
    expect(text).toContain('Anti-flood');
    expect(text).toContain('awaiting full implementation');
  });

  it('verifies that the scaffold handler returns a safe, detailed response for unimplemented games', async () => {
    const handler = new PrdGamesSuiteCommand();
    const ctx = getCtx('monopolymini', '/monopolymini');

    sentMessages = [];
    await handler.execute(ctx, [], mockAdapter);

    expect(sentMessages.length).toBe(1);
    const text = sentMessages[0].text;

    // Must contain PRD ID, game name, description, and awaiting implementation status
    expect(text).toContain('G033');
    expect(text).toContain('monopolymini');
    expect(text).toContain('Monopoly');
    expect(text).toContain('awaiting full implementation');
  });

  it('verifies that all PRD metadata is registered in the commandRegistry', async () => {
    for (const entry of PRD_CATALOG) {
      const cmd = await commandRegistry.get(entry.name);
      if (!cmd) {
        console.error(`Failed to resolve command: ${entry.name} (ID: ${entry.id})`);
      }
      expect(cmd).toBeDefined();
      expect(cmd?.metadata.name).toBe(entry.name);
    }
  });
});
