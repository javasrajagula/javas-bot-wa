import { describe, expect, it } from 'vitest';
import {
  isSafePublicUrl,
  assertSafePublicUrl,
  blockUnsafeIp,
  isAllowedTikTokUrl,
  isAllowedYouTubeUrl,
  validateUrlMetadata
} from '../validators/url.validator.js';

describe('SSRF / URL safety validations', () => {
  it('should block localhost and private IPs', () => {
    expect(() => isSafePublicUrl('http://localhost:8080')).toThrow(/URL tidak aman/);
    expect(() => isSafePublicUrl('http://127.0.0.1:3000')).toThrow(/URL tidak aman/);
    expect(() => isSafePublicUrl('http://192.168.1.1/info')).toThrow(/URL tidak aman/);
    expect(() => isSafePublicUrl('http://10.0.0.1')).toThrow(/URL tidak aman/);
  });

  it('should block multicast IPs', () => {
    // Multicast range is 224.0.0.0 to 239.255.255.255
    expect(() => blockUnsafeIp('224.0.0.1')).toThrow(/IP multicast tidak diperbolehkan/);
    expect(() => blockUnsafeIp('239.255.255.255')).toThrow(/IP multicast tidak diperbolehkan/);
    
    // IPv6 multicast starts with ff
    expect(() => blockUnsafeIp('ff02::1')).toThrow(/IPv6 multicast tidak diperbolehkan/);
  });

  it('should allow valid public URLs', () => {
    expect(isSafePublicUrl('https://www.google.com')).toBe(true);
    expect(isSafePublicUrl('https://github.com/trending')).toBe(true);
  });

  it('should validate platform allowed domains', () => {
    expect(isAllowedTikTokUrl('https://www.tiktok.com/@user/video/123')).toBe(true);
    expect(isAllowedTikTokUrl('https://evil.com/tiktok.com')).toBe(false);

    expect(isAllowedYouTubeUrl('https://youtu.be/abc')).toBe(true);
    expect(isAllowedYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isAllowedYouTubeUrl('https://evil.com/youtube.com')).toBe(false);
  });
});
