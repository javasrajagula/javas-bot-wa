import { describe, expect, it, beforeEach } from 'vitest';
import { pluginManager } from '../config/plugins.js';
import prisma from '../db/client.js';

describe('Plugin Database State Persistence', () => {
  beforeEach(async () => {
    // Clear database plugin states
    await prisma.pluginState.deleteMany();
    // Reset in-memory plugins to enabled: true for test isolation
    pluginManager.listPlugins().forEach(p => {
      p.enabled = true;
    });
  });

  it('should migrate memory states to database when database is empty', async () => {
    // Sync with database (which is empty)
    await pluginManager.syncWithDatabase();

    // Check if database records were created
    const count = await prisma.pluginState.count();
    expect(count).toBeGreaterThan(0);

    const dbState = await prisma.pluginState.findUnique({
      where: { name: 'games' }
    });
    expect(dbState).not.toBeNull();
    expect(dbState?.enabled).toBe(true);
  });

  it('should load states from database and override memory state when database is populated', async () => {
    // Seed disabled state in database
    await prisma.pluginState.create({
      data: { name: 'games', enabled: false }
    });

    // Sync with database
    await pluginManager.syncWithDatabase();

    // The in-memory plugin should now be disabled
    expect(pluginManager.isPluginEnabled('games')).toBe(false);
  });

  it('should update database state when setPluginStatus is called', async () => {
    // First, sync to populate database
    await pluginManager.syncWithDatabase();

    // Set plugin status to disabled
    pluginManager.setPluginStatus('sticker', false);

    // Wait a brief moment for async upsert to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify it is updated in database
    const dbState = await prisma.pluginState.findUnique({
      where: { name: 'sticker' }
    });
    expect(dbState?.enabled).toBe(false);

    // Re-enable for subsequent tests
    pluginManager.setPluginStatus('sticker', true);
    await new Promise(resolve => setTimeout(resolve, 300));
  });
});
