import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { stateStore } from '../services/state/state-store.js';

export function startSchedMuteWorker(adapter: WhatsAppAdapter): NodeJS.Timeout {
  // Check every 30 seconds
  const interval = setInterval(async () => {
    try {
      const now = new Date();
      // Format to HH:MM in Asia/Jakarta timezone
      const timeStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace('.', ':');

      // 1. Check auto-close groups
      const closeKeys = await stateStore.keys('group:closetime:');
      for (const key of closeKeys) {
        const closeTime = await stateStore.get<string>(key);
        if (closeTime === timeStr) {
          const groupId = key.split(':')[2];
          if (!groupId) continue;

          // Prevent muting multiple times in the same minute by setting a transient lock
          const lockKey = `lock:closetime:${groupId}:${timeStr}`;
          const isLocked = await stateStore.get(lockKey);
          if (isLocked) continue;

          const socket = (adapter as any).sock;
          if (socket && typeof socket.groupSettingUpdate === 'function') {
            await socket.groupSettingUpdate(groupId, 'announcement', true);
            await adapter.sendMessage(groupId, '🔒 *AUTO CLOSE GROUP* 🔒\n\nWaktu bertamu telah habis. Grup otomatis ditutup (Hanya Admin yang dapat mengirimkan pesan) sesuai jadwal.');
            await stateStore.set(lockKey, true, 90); // 90s lock TTL
          }
        }
      }

      // 2. Check auto-open groups
      const openKeys = await stateStore.keys('group:opentime:');
      for (const key of openKeys) {
        const openTime = await stateStore.get<string>(key);
        if (openTime === timeStr) {
          const groupId = key.split(':')[2];
          if (!groupId) continue;

          const lockKey = `lock:opentime:${groupId}:${timeStr}`;
          const isLocked = await stateStore.get(lockKey);
          if (isLocked) continue;

          const socket = (adapter as any).sock;
          if (socket && typeof socket.groupSettingUpdate === 'function') {
            await socket.groupSettingUpdate(groupId, 'announcement', false);
            await adapter.sendMessage(groupId, '🔓 *AUTO OPEN GROUP* 🔓\n\nGrup otomatis dibuka (Semua Anggota dapat mengirimkan pesan) sesuai jadwal. Selamat beraktivitas!');
            await stateStore.set(lockKey, true, 90); // 90s lock TTL
          }
        }
      }
    } catch (err: any) {
      console.error('[SchedMuteWorker] Error in worker loop:', err.message);
    }
  }, 30000);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }
  return interval;
}
