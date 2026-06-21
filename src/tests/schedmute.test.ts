import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { stateStore } from '../services/state/state-store.js';
import { ModerationSuiteCommand } from '../commands/moderation/moderation.command.js';
import { startSchedMuteWorker } from '../workers/schedmute.worker.js';
import * as indexModule from '../commands/index.js';

describe('Scheduled Mute & Unmute System', () => {
  const cmd = new ModerationSuiteCommand();
  const testGroup = 'test-schedmute-group@g.us';
  const adminUser = 'adminuser@s.whatsapp.net';
  const memberUser = 'memberuser@s.whatsapp.net';

  beforeEach(async () => {
    vi.useFakeTimers();
    await stateStore.delete(`group:closetime:${testGroup}`);
    await stateStore.delete(`group:opentime:${testGroup}`);
    await stateStore.delete(`lock:closetime:${testGroup}:22:00`);
    await stateStore.delete(`lock:opentime:${testGroup}:06:00`);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await stateStore.delete(`group:closetime:${testGroup}`);
    await stateStore.delete(`group:opentime:${testGroup}`);
    await stateStore.delete(`lock:closetime:${testGroup}:22:00`);
    await stateStore.delete(`lock:opentime:${testGroup}:06:00`);
  });

  it('should allow admin to set close and open times', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async (groupId, userId) => {
      return userId === adminUser;
    });

    // 1. Try as member (should fail)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/closetime 22:00',
      senderId: memberUser,
      id: 'msg-close-1'
    } as any, ['22:00'], adapter);
    expect(replies[replies.length - 1]).toContain('Otoritas ditolak');

    // 2. Set close time as admin
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/closetime 22:00',
      senderId: adminUser,
      id: 'msg-close-2'
    } as any, ['22:00'], adapter);
    expect(replies[replies.length - 1]).toContain('Auto Close Ditetapkan');

    const closeVal = await stateStore.get(`group:closetime:${testGroup}`);
    expect(closeVal).toBe('22:00');

    // 3. Set open time as admin
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/opentime 06:00',
      senderId: adminUser,
      id: 'msg-open-2'
    } as any, ['06:00'], adapter);
    expect(replies[replies.length - 1]).toContain('Auto Open Ditetapkan');

    const openVal = await stateStore.get(`group:opentime:${testGroup}`);
    expect(openVal).toBe('06:00');

    // 4. Disable closetime
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/closetime off',
      senderId: adminUser,
      id: 'msg-close-off'
    } as any, ['off'], adapter);
    expect(replies[replies.length - 1]).toContain('menonaktifkan fitur auto close');

    const disabledCloseVal = await stateStore.get(`group:closetime:${testGroup}`);
    expect(disabledCloseVal).toBeFalsy();

    isAdminSpy.mockRestore();
  });

  it('should trigger groupSettingUpdate in worker when time matches', async () => {
    // Set close time
    await stateStore.set(`group:closetime:${testGroup}`, '22:00');
    await stateStore.set(`group:opentime:${testGroup}`, '06:00');

    const replies: string[] = [];
    const updatedSettings: { groupId: string; setting: string; val: boolean }[] = [];
    
    const mockSocket = {
      groupSettingUpdate: async (groupId: string, setting: string, val: boolean) => {
        updatedSettings.push({ groupId, setting, val });
      }
    };

    const adapter = {
      sock: mockSocket,
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    // Start worker
    const interval = startSchedMuteWorker(adapter);

    // Set time to 21:59 (should not trigger)
    const date1 = new Date();
    date1.setHours(21, 59, 0);
    vi.setSystemTime(date1);
    
    // Fast forward fake timers by 30 seconds to run interval
    await vi.advanceTimersByTimeAsync(30000);
    expect(updatedSettings.length).toBe(0);

    // Set time to 22:00
    const date2 = new Date();
    date2.setHours(22, 0, 0);
    vi.setSystemTime(date2);

    await vi.advanceTimersByTimeAsync(30000);
    expect(updatedSettings.length).toBe(1);
    expect(updatedSettings[0]).toEqual({
      groupId: testGroup,
      setting: 'announcement',
      val: true
    });
    expect(replies[replies.length - 1]).toContain('AUTO CLOSE GROUP');

    // Clean up interval
    clearInterval(interval);
  });
});
