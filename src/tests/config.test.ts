import { describe, expect, it } from 'vitest';
import { parseEnv } from '../config/env.schema.js';

describe('Environment Config Validation', () => {
  it('should parse valid environment options successfully', () => {
    const validEnv = parseEnv({
      DATABASE_URL: 'file:./test.db',
      OWNER_IDS: '6281234567890',
      DASHBOARD_ENABLED: 'false',
    } as any);

    expect(validEnv.DATABASE_URL).toBe('file:./test.db');
    expect(validEnv.DASHBOARD_ENABLED).toBe(false);
  });

  it('should throw error when dashboard is enabled but no dashboard password or owner password is provided', () => {
    expect(() => {
      parseEnv({
        DATABASE_URL: 'file:./test.db',
        DASHBOARD_ENABLED: 'true',
        OWNER_DASHBOARD_PASSWORD: '',
        OWNER_PASSWORD: '',
      } as any);
    }).toThrow(/OWNER_DASHBOARD_PASSWORD wajib diisi saat DASHBOARD_ENABLED bernilai true/);
  });

  it('should accept owner password as dashboard password fallback when dashboard is enabled', () => {
    const env = parseEnv({
      DATABASE_URL: 'file:./test.db',
      DASHBOARD_ENABLED: 'true',
      OWNER_PASSWORD: 'fallback_password',
    } as any);

    expect(env.OWNER_DASHBOARD_PASSWORD).toBe('fallback_password');
    expect(env.DASHBOARD_ENABLED).toBe(true);
  });

  it('should fallback to 127.0.0.1 for DASHBOARD_HOST when not specified', () => {
    const env = parseEnv({
      DATABASE_URL: 'file:./test.db',
    } as any);

    expect(env.DASHBOARD_HOST).toBe('127.0.0.1');
  });
});
