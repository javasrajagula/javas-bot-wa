import { describe, it, expect } from 'vitest';
import {
  isAllowedYouTubeUrl,
  isAllowedFacebookUrl,
  isAllowedTwitterUrl,
  isAllowedThreadsUrl,
  isAllowedPinterestUrl,
  isAllowedCapCutUrl
} from '../validators/url.validator.js';
import { isValidUrl } from '../services/downloader/downloader.service.js';
import { getMediaDuration } from '../services/ffmpeg/ffmpeg.service.js';

describe('Expanded URL Validators', () => {
  it('should validate YouTube URLs', () => {
    expect(isAllowedYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isAllowedYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isAllowedYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isAllowedYouTubeUrl('https://google.com')).toBe(false);
  });

  it('should validate Facebook URLs', () => {
    expect(isAllowedFacebookUrl('https://www.facebook.com/watch/?v=123456')).toBe(true);
    expect(isAllowedFacebookUrl('https://fb.watch/123456/')).toBe(true);
    expect(isAllowedFacebookUrl('https://fb.com/123456')).toBe(true);
    expect(isAllowedFacebookUrl('https://google.com')).toBe(false);
  });

  it('should validate Twitter/X URLs', () => {
    expect(isAllowedTwitterUrl('https://twitter.com/user/status/123456')).toBe(true);
    expect(isAllowedTwitterUrl('https://x.com/user/status/123456')).toBe(true);
    expect(isAllowedTwitterUrl('https://google.com')).toBe(false);
  });

  it('should validate Threads URLs', () => {
    expect(isAllowedThreadsUrl('https://www.threads.net/@user/post/123456')).toBe(true);
    expect(isAllowedThreadsUrl('https://threads.net/@user/post/123456')).toBe(true);
    expect(isAllowedThreadsUrl('https://google.com')).toBe(false);
  });

  it('should validate Pinterest URLs', () => {
    expect(isAllowedPinterestUrl('https://pin.it/abcde')).toBe(true);
    expect(isAllowedPinterestUrl('https://www.pinterest.com/pin/123456/')).toBe(true);
    expect(isAllowedPinterestUrl('https://google.com')).toBe(false);
  });

  it('should validate CapCut URLs', () => {
    expect(isAllowedCapCutUrl('https://www.capcut.com/template-detail/123456')).toBe(true);
    expect(isAllowedCapCutUrl('https://capcut.net/template-detail/123456')).toBe(true);
    expect(isAllowedCapCutUrl('https://google.com')).toBe(false);
  });

  it('should validate general isValidUrl for all supported domains', () => {
    expect(isValidUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isValidUrl('https://www.facebook.com/watch/?v=123456')).toBe(true);
    expect(isValidUrl('https://twitter.com/user/status/123456')).toBe(true);
    expect(isValidUrl('https://www.threads.net/@user/post/123456')).toBe(true);
    expect(isValidUrl('https://pin.it/abcde')).toBe(true);
    expect(isValidUrl('https://www.capcut.com/template-detail/123456')).toBe(true);
    expect(isValidUrl('https://www.tiktok.com/@user/video/12345')).toBe(true);
    expect(isValidUrl('https://www.instagram.com/p/abcde/')).toBe(true);
    expect(isValidUrl('https://google.com')).toBe(false);
  });
});

describe('Media Duration Inspector', () => {
  it('should reject with an error for a non-existent file path', async () => {
    await expect(getMediaDuration('non_existent_file.mp4')).rejects.toThrow();
  });
});
