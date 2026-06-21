import { jidDecode } from '@whiskeysockets/baileys';

/**
 * Canonical utilities for JID and Phone number normalization.
 */

export function normalizeJid(jid: string): string {
  if (typeof jid !== 'string') return '';
  let clean = jid.trim();
  if (clean.startsWith('@')) {
    clean = clean.slice(1);
  }
  
  let user = clean;
  let server = 's.whatsapp.net';
  
  if (clean.includes('@')) {
    const parts = clean.split('@');
    user = parts[0];
    server = parts[1];
  }
  
  // Strip device suffix (e.g. 628xxx:1 or 628xxx:12)
  if (user.includes(':')) {
    user = user.split(':')[0];
  }
  
  // Remove non-digit characters from user part only for s.whatsapp.net
  if (server === 's.whatsapp.net') {
    if (!/[a-zA-Z]/.test(user)) {
      user = user.replace(/\D/g, '');
    }
  }
  
  return `${user}@${server}`;
}

export function normalizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  let clean = phone.trim();
  if (clean.startsWith('@')) {
    clean = clean.slice(1);
  }
  if (clean.includes('@')) {
    clean = clean.split('@')[0];
  }
  if (clean.includes(':')) {
    clean = clean.split(':')[0];
  }
  if (/[a-zA-Z]/.test(clean)) {
    return clean;
  }
  return clean.replace(/\D/g, '');
}

export function safeJidDecode(jid: string | undefined | null) {
  if (!jid) return null;
  try {
    const decoded = jidDecode(jid);
    if (!decoded || !decoded.user) return null;
    return decoded;
  } catch {
    return null;
  }
}
