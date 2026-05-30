import { URL } from 'url';
import { lookup } from 'dns/promises';
import net from 'net';

export function normalizeUrl(url: string): string {
  let cleanUrl = url.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'https://' + cleanUrl;
  }
  return cleanUrl;
}

export function blockLocalhost(hostname: string): void {
  const host = hostname.toLowerCase().trim();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]'
  ) {
    throw new Error('Akses ke localhost tidak diperbolehkan.');
  }
}

export function blockPrivateIp(hostname: string): void {
  const host = hostname.toLowerCase().trim();

  // AWS/GCP/Azure Cloud Metadata IPs
  if (host === '169.254.169.254' || host.startsWith('169.254.')) {
    throw new Error('Akses ke IP metadata cloud tidak diperbolehkan.');
  }

  // Regex matching IPv4 Private Networks:
  // - 10.0.0.0/8
  // - 172.16.0.0/12
  // - 192.168.0.0/16
  // - 127.0.0.0/8
  const privateIpPattern = /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|127\.\d+\.\d+\.\d+)$/;
  if (privateIpPattern.test(host)) {
    throw new Error('Akses ke IP privat tidak diperbolehkan.');
  }
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:172.')
  );
}

export function blockUnsafeIp(hostname: string): void {
  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');
  const family = net.isIP(host);
  if (family === 4 && isPrivateIpv4(host)) {
    throw new Error('Akses ke IP privat tidak diperbolehkan.');
  }
  if (family === 6 && isPrivateIpv6(host)) {
    throw new Error('Akses ke IPv6 privat/link-local tidak diperbolehkan.');
  }
}

export function isAllowedTikTokUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.toLowerCase();
    
    // Strict exact domains or official subdomains
    return host === 'tiktok.com' || host.endsWith('.tiktok.com');
  } catch {
    return false;
  }
}

export function isAllowedInstagramUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.toLowerCase();
    
    // Strict exact domains or official subdomains
    return (
      host === 'instagram.com' || host.endsWith('.instagram.com') ||
      host === 'instagr.am' || host.endsWith('.instagr.am')
    );
  } catch {
    return false;
  }
}

export function isSafePublicUrl(url: string): boolean {
  try {
    const normalized = normalizeUrl(url);
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();

    blockLocalhost(host);
    blockPrivateIp(host);
    blockUnsafeIp(host);

    // Reject evil subdomains (e.g. instagram.com.evil.com)
    // parsed.hostname would end with '.evil.com', which won't match direct check unless allowed
    return true;
  } catch (err: any) {
    throw new Error(`URL tidak aman: ${err.message}`);
  }
}

export async function assertSafePublicUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  const parsed = new URL(normalized);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Hanya URL HTTP/HTTPS yang diperbolehkan.');
  }

  blockLocalhost(parsed.hostname);
  blockPrivateIp(parsed.hostname);
  blockUnsafeIp(parsed.hostname);

  const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  for (const address of addresses) {
    blockUnsafeIp(address.address);
    blockPrivateIp(address.address);
  }

  return parsed.toString();
}

export function isAllowedYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.toLowerCase();
    return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be');
  } catch {
    return false;
  }
}

export function isAllowedFacebookUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'facebook.com' || host.endsWith('.facebook.com') ||
      host === 'fb.watch' || host.endsWith('.fb.watch') ||
      host === 'fb.com' || host.endsWith('.fb.com')
    );
  } catch {
    return false;
  }
}

export function isAllowedTwitterUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.toLowerCase();
    return host === 'twitter.com' || host.endsWith('.twitter.com') || host === 'x.com' || host.endsWith('.x.com');
  } catch {
    return false;
  }
}

export function isAllowedThreadsUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.toLowerCase();
    return host === 'threads.net' || host.endsWith('.threads.net');
  } catch {
    return false;
  }
}

export function isAllowedPinterestUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.toLowerCase();
    return host === 'pinterest.com' || host.endsWith('.pinterest.com') || host === 'pin.it' || host.endsWith('.pin.it');
  } catch {
    return false;
  }
}

export function isAllowedCapCutUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.toLowerCase();
    return host === 'capcut.com' || host.endsWith('.capcut.com') || host === 'capcut.net' || host.endsWith('.capcut.net');
  } catch {
    return false;
  }
}
