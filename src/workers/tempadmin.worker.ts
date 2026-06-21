import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { stateStore } from '../services/state/state-store.js';

export function startTempAdminWorker(adapter: WhatsAppAdapter) {
  // Check every 30 seconds
  const interval = setInterval(async () => {
    try {
      const keys = await stateStore.keys('tempadmin:');
      for (const key of keys) {
        const expiresAt = await stateStore.get<number>(key);
        if (expiresAt && Date.now() > expiresAt) {
          const parts = key.split(':');
          if (parts.length < 3) continue;
          
          let groupId = parts[1];
          let userId = parts[2];

          if (groupId && !groupId.includes('@')) {
            try {
              const decoded = Buffer.from(groupId, 'base64url').toString('utf-8');
              if (decoded.includes('@')) {
                groupId = decoded;
              }
            } catch (err) {}
          }
          if (userId && !userId.includes('@')) {
            try {
              const decoded = Buffer.from(userId, 'base64url').toString('utf-8');
              if (decoded.includes('@')) {
                userId = decoded;
              }
            } catch (err) {}
          }

          const socket = (adapter as any).sock;
          if (socket && typeof socket.groupParticipantsUpdate === 'function') {
            try {
              await socket.groupParticipantsUpdate(groupId, [userId], 'demote');
              await adapter.sendMessage(
                groupId,
                `🚪 Masa jabatan Admin Sementara untuk @${userId.split('@')[0]} telah berakhir dan telah dikembalikan ke Member biasa.`,
                { mentions: [userId] }
              );
            } catch (err: any) {
              console.error(`[TempAdminWorker] Failed to demote user ${userId} in ${groupId}:`, err.message);
            }
          }
          await stateStore.delete(key);
        }
      }
    } catch (err: any) {
      console.error('[TempAdminWorker] Error in worker loop:', err.message);
    }
  }, 30000);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  return interval;
}
