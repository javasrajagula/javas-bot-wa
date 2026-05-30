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

  it('loads PRD commands into metadata coverage', () => {
    const names = loadPrdCommandNames();
    expect(names).toContain('ping');
    expect(names).toContain('statusbot');
    expect(names).toContain('webhook');
    expect(loadPrdCommandMetadata().length).toBeGreaterThan(100);
  });

  it('rejects localhost URL synchronously', () => {
    expect(() => isSafePublicUrl('http://127.0.0.1:3000')).toThrow(/URL tidak aman/);
  });
});
