import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../config/env.schema.js';
import { maskPhone, redactSensitive } from '../utils/mask.util.js';
import { FileStateStore } from '../services/state/state-store.js';
import { loadPrdCommandNames, loadPrdCommandMetadata } from '../commands/prd/prd-command-catalog.js';
import { isSafePublicUrl } from '../validators/url.validator.js';

describe('PRD stabilization foundation', () => {
  it('validates env with defaults and aliases', () => {
    const env = parseEnv({
      DATABASE_URL: 'file:./test.db',
      ADAPTER_MODE: 'baileys',
      OWNER_PASSWORD: 'secret'
    } as NodeJS.ProcessEnv);

    expect(env.ADAPTER_MODE).toBe('baileys');
    expect(env.OWNER_DASHBOARD_PASSWORD).toBe('secret');
    expect(env.DASHBOARD_PORT).toBe(8787);
  });

  it('masks phone numbers and sensitive keys', () => {
    expect(maskPhone('6281234567890')).toMatch(/\*7890$/);
    expect(redactSensitive({ token: 'abc', user: '6281234567890' })).toEqual({
      token: '[REDACTED]',
      user: '*********7890'
    });
  });

  it('persists file state safely', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'javas-state-')), 'state.json');
    const store = new FileStateStore(file);
    await store.set('group:one', { ok: true });

    const reloaded = new FileStateStore(file);
    expect(await reloaded.get('group:one')).toEqual({ ok: true });
  });

  it('loads PRD commands into metadata coverage', async () => {
    // Import all command modules to register them in commandRegistry
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
    await import('../commands/owner/webhook.command.js');
    await import('../commands/prd/prd-coverage.command.js');

    const { commandRegistry } = await import('../commands/registry/command-registry.js');
    expect(commandRegistry.get('ping')).toBeDefined();
    expect(commandRegistry.get('statusbot')).toBeDefined();
    expect(commandRegistry.get('webhook')).toBeDefined();
    expect(commandRegistry.getAll().length).toBeGreaterThan(100);
  });

  it('rejects localhost URL synchronously', () => {
    expect(() => isSafePublicUrl('http://127.0.0.1:3000')).toThrow(/URL tidak aman/);
  });

  it('normalizes various JID and phone formats correctly', async () => {
    const { normalizeJid, normalizePhone } = await import('../utils/jid.util.js');
    expect(normalizeJid('6281234567890')).toBe('6281234567890@s.whatsapp.net');
    expect(normalizeJid('@6281234567890')).toBe('6281234567890@s.whatsapp.net');
    expect(normalizeJid('6281234567890:1@s.whatsapp.net')).toBe('6281234567890@s.whatsapp.net');
    expect(normalizeJid('6281234567890:12')).toBe('6281234567890@s.whatsapp.net');
    expect(normalizeJid('123456@lid')).toBe('123456@lid');
    expect(normalizeJid('123456:1@lid')).toBe('123456@lid');
    expect(normalizeJid('1203632xxx@g.us')).toBe('1203632xxx@g.us');

    expect(normalizePhone('6281234567890')).toBe('6281234567890');
    expect(normalizePhone('@6281234567890')).toBe('6281234567890');
    expect(normalizePhone('6281234567890:1@s.whatsapp.net')).toBe('6281234567890');
  });
});
