import sharp from 'sharp';
import { getTempPath, safeDelete } from '../../utils/file.util.js';
import fs from 'fs';

export interface DownloadResult {
  type: 'video' | 'image' | 'images';
  title: string;
  files: { path: string; mimeType: string }[];
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getDefaultAvatarSvg(initial: string, size = 120): string {
  const bgColors = [
    '#f43f5e', '#ec4899', '#d946ef', '#a855f7',
    '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9',
    '#06b6d4', '#14b8a6', '#10b981', '#22c55e'
  ];
  const charCode = initial.charCodeAt(0) || 0;
  const bgColor = bgColors[charCode % bgColors.length];

  return `
    <svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${bgColor}"/>
      <text x="${size / 2}" y="${size / 2 + size / 6}" fill="#ffffff" font-size="${size / 2.2}px" font-family="Arial, Segoe UI, sans-serif" font-weight="bold" text-anchor="middle">${initial.toUpperCase()}</text>
    </svg>
  `;
}

async function getRoundedAvatar(avatarBuffer: Buffer, size = 120): Promise<Buffer> {
  const circleShape = Buffer.from(
    `<svg width="${size}" height="${size}">
       <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
     </svg>`
  );
  return sharp(avatarBuffer)
    .resize(size, size)
    .composite([{
      input: circleShape,
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();
}

async function getBgBuffer(bgBuffer?: Buffer, width = 800, height = 220, blurSigma = 0): Promise<Buffer> {
  if (bgBuffer) {
    let img = sharp(bgBuffer).resize(width, height, { fit: 'cover' });
    if (blurSigma > 0) {
      img = img.blur(blurSigma);
    }
    return img.png().toBuffer();
  }
  const gradientSvg = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#1e1b4b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3b0764;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
    </svg>
  `;
  return sharp(Buffer.from(gradientSvg)).png().toBuffer();
}

export async function renderRankCard(options: {
  username: string;
  userId: string;
  level: number;
  xp: number;
  xpNeeded: number;
  balance: number;
  rankGlobal: number;
  rankGrup: number | string;
  title?: string;
  badges?: string[];
  isPremium: boolean;
  avatarBuffer?: Buffer;
  bgBuffer?: Buffer;
}): Promise<Buffer> {
  const width = 800;
  const height = 220;

  const finalBg = await getBgBuffer(options.bgBuffer, width, height, options.bgBuffer ? 5 : 0);

  const avatarSize = 120;
  let finalAvatar: Buffer;
  if (options.avatarBuffer) {
    try {
      finalAvatar = await getRoundedAvatar(options.avatarBuffer, avatarSize);
    } catch {
      const initial = options.username[0] || '?';
      finalAvatar = await sharp(Buffer.from(getDefaultAvatarSvg(initial, avatarSize))).png().toBuffer();
    }
  } else {
    const initial = options.username[0] || '?';
    finalAvatar = await sharp(Buffer.from(getDefaultAvatarSvg(initial, avatarSize))).png().toBuffer();
  }

  const nameEscaped = escapeXml(options.username);
  const titleEscaped = escapeXml(options.title || 'Warga Biasa');
  const xpPct = Math.min(options.xp / options.xpNeeded, 1);
  const barWidth = 520;
  const fillWidth = Math.floor(barWidth * xpPct);

  const xpText = `${options.xp} / ${options.xpNeeded} XP`;
  const balText = `Rp ${options.balance.toLocaleString('id-ID')}`;
  const rankText = `#${options.rankGlobal} Global | #${options.rankGrup} Grup`;
  const badgesStr = (options.badges || []).slice(0, 4).join(' ');
  const premiumText = options.isPremium ? '👑 PREMIUM' : '';

  const svgContent = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#06b6d4;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Glassmorphic panel -->
      <rect x="15" y="15" width="${width - 30}" height="${height - 30}" rx="20" fill="#111827" fill-opacity="0.65" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5" />

      <!-- Avatar Ring/Border -->
      <circle cx="100" cy="110" r="63" fill="none" stroke="${options.isPremium ? '#facc15' : '#38bdf8'}" stroke-width="3" />

      <style>
        .text-bold { font-family: 'Segoe UI', Arial, sans-serif; font-weight: bold; }
        .text-normal { font-family: 'Segoe UI', Arial, sans-serif; }
      </style>

      <!-- Username & Badges -->
      <text x="180" y="70" fill="#ffffff" font-size="28px" class="text-bold">${nameEscaped}</text>
      <text x="180" y="102" fill="#a78bfa" font-size="16px" font-style="italic" class="text-normal">${titleEscaped}</text>
      
      <!-- Badges -->
      <text x="180" y="132" fill="#ffffff" font-size="20px" class="text-normal">${escapeXml(badgesStr)}</text>

      <!-- Level -->
      <text x="${width - 45}" y="70" fill="${options.isPremium ? '#facc15' : '#38bdf8'}" font-size="26px" text-anchor="end" class="text-bold">Lvl ${options.level}</text>
      
      <!-- Premium Badge -->
      <text x="${width - 45}" y="100" fill="#facc15" font-size="14px" text-anchor="end" class="text-bold">${premiumText}</text>

      <!-- XP Bar -->
      <rect x="180" y="145" width="${barWidth}" height="16" rx="8" fill="#374151" />
      <rect x="180" y="145" width="${fillWidth}" height="16" rx="8" fill="url(#barGrad)" />

      <!-- XP Text -->
      <text x="${width - 45}" y="138" fill="#d1d5db" font-size="14px" text-anchor="end" class="text-normal">${xpText}</text>

      <!-- Saldo/Balance -->
      <text x="180" y="190" fill="#facc15" font-size="16px" class="text-bold">💰 ${balText}</text>

      <!-- Rank Global/Grup -->
      <text x="${width - 45}" y="190" fill="#9ca3af" font-size="15px" text-anchor="end" class="text-bold">🏆 ${rankText}</text>
    </svg>
  `;

  return sharp(finalBg)
    .composite([
      { input: finalAvatar, top: 50, left: 40 },
      { input: Buffer.from(svgContent), top: 0, left: 0 }
    ])
    .png()
    .toBuffer();
}

export async function renderProfileCard(options: {
  username: string;
  userId: string;
  level: number;
  xp: number;
  xpNeeded: number;
  balance: number;
  rankGlobal: number;
  rankGrup: number | string;
  title?: string;
  badges?: string[];
  totalCommands: number;
  joinDate: string;
  isPremium: boolean;
  avatarBuffer?: Buffer;
  bgBuffer?: Buffer;
}): Promise<Buffer> {
  const width = 500;
  const height = 600;

  const finalBg = await getBgBuffer(options.bgBuffer, width, height, options.bgBuffer ? 5 : 0);

  const avatarSize = 140;
  let finalAvatar: Buffer;
  if (options.avatarBuffer) {
    try {
      finalAvatar = await getRoundedAvatar(options.avatarBuffer, avatarSize);
    } catch {
      const initial = options.username[0] || '?';
      finalAvatar = await sharp(Buffer.from(getDefaultAvatarSvg(initial, avatarSize))).png().toBuffer();
    }
  } else {
    const initial = options.username[0] || '?';
    finalAvatar = await sharp(Buffer.from(getDefaultAvatarSvg(initial, avatarSize))).png().toBuffer();
  }

  const nameEscaped = escapeXml(options.username);
  const titleEscaped = escapeXml(options.title || 'Warga Biasa');
  const xpPct = Math.min(options.xp / options.xpNeeded, 1);
  const barWidth = 400;
  const fillWidth = Math.floor(barWidth * xpPct);

  const xpText = `${options.xp} / ${options.xpNeeded} XP`;
  const balText = `Rp ${options.balance.toLocaleString('id-ID')}`;
  const rankGlobalText = `#${options.rankGlobal}`;
  const rankGrupText = `#${options.rankGrup}`;
  const badgesStr = (options.badges || []).slice(0, 6).join(' ');
  const statusText = options.isPremium ? 'Premium User' : 'Warga Biasa';

  const svgContent = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#06b6d4;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Glassmorphic panel -->
      <rect x="15" y="15" width="${width - 30}" height="${height - 30}" rx="25" fill="#111827" fill-opacity="0.75" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5" />

      <!-- Avatar Ring/Border -->
      <circle cx="250" cy="120" r="73" fill="none" stroke="${options.isPremium ? '#facc15' : '#38bdf8'}" stroke-width="4" />

      <style>
        .text-bold { font-family: 'Segoe UI', Arial, sans-serif; font-weight: bold; }
        .text-normal { font-family: 'Segoe UI', Arial, sans-serif; }
      </style>

      <!-- Profile Header -->
      <text x="250" y="220" fill="#ffffff" font-size="28px" text-anchor="middle" class="text-bold">${nameEscaped}</text>
      <text x="250" y="250" fill="#a78bfa" font-size="16px" font-style="italic" text-anchor="middle" class="text-normal">${titleEscaped}</text>
      <text x="250" y="280" fill="#ffffff" font-size="20px" text-anchor="middle" class="text-normal">${escapeXml(badgesStr)}</text>

      <!-- Level & XP Text -->
      <text x="50" y="315" fill="${options.isPremium ? '#facc15' : '#38bdf8'}" font-size="20px" class="text-bold">Lvl ${options.level}</text>
      <text x="450" y="312" fill="#d1d5db" font-size="13px" text-anchor="end" class="text-normal">${xpText}</text>

      <!-- XP Bar -->
      <rect x="50" y="325" width="${barWidth}" height="14" rx="7" fill="#374151" />
      <rect x="50" y="325" width="${fillWidth}" height="14" rx="7" fill="url(#barGrad)" />

      <!-- Divider line -->
      <line x1="50" y1="360" x2="450" y2="360" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1" />

      <!-- Column 1 Stats -->
      <text x="50" y="395" fill="#9ca3af" font-size="13px" class="text-normal">SALDO</text>
      <text x="50" y="420" fill="#facc15" font-size="18px" class="text-bold">${balText}</text>

      <text x="50" y="460" fill="#9ca3af" font-size="13px" class="text-normal">RANK GLOBAL</text>
      <text x="50" y="485" fill="#ffffff" font-size="18px" class="text-bold">${rankGlobalText}</text>

      <text x="50" y="525" fill="#9ca3af" font-size="13px" class="text-normal">RANK GRUP</text>
      <text x="50" y="550" fill="#ffffff" font-size="18px" class="text-bold">${rankGrupText}</text>

      <!-- Column 2 Stats -->
      <text x="260" y="395" fill="#9ca3af" font-size="13px" class="text-normal">TOTAL COMMAND</text>
      <text x="260" y="420" fill="#ffffff" font-size="18px" class="text-bold">${options.totalCommands}</text>

      <text x="260" y="460" fill="#9ca3af" font-size="13px" class="text-normal">GABUNG BOT</text>
      <text x="260" y="485" fill="#ffffff" font-size="16px" class="text-bold">${options.joinDate}</text>

      <text x="260" y="525" fill="#9ca3af" font-size="13px" class="text-normal">STATUS</text>
      <text x="260" y="550" fill="${options.isPremium ? '#facc15' : '#38bdf8'}" font-size="18px" class="text-bold">${statusText}</text>
    </svg>
  `;

  return sharp(finalBg)
    .composite([
      { input: finalAvatar, top: 50, left: 180 },
      { input: Buffer.from(svgContent), top: 0, left: 0 }
    ])
    .png()
    .toBuffer();
}

export async function renderLeaderboardCard(
  topUsers: { name: string; level: number; balance: number; userId: string; isPremium: boolean }[],
  groupName = 'Papan Peringkat Warga'
): Promise<Buffer> {
  const width = 600;
  const height = 800;

  const bgColors = [
    '#f43f5e', '#ec4899', '#d946ef', '#a855f7',
    '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9',
    '#06b6d4', '#14b8a6', '#10b981', '#22c55e'
  ];

  const finalBg = await getBgBuffer(undefined, width, height, 0);

  const titleEscaped = escapeXml(groupName);

  let rowsContent = '';
  topUsers.forEach((user, index) => {
    const y = 120 + index * 63;
    const nameEscaped = escapeXml(user.name);
    const balText = `Rp ${user.balance.toLocaleString('id-ID')}`;
    const statsText = `Lvl ${user.level}  |  ${balText}`;

    const initial = user.name[0] || '?';
    const charCode = initial.charCodeAt(0) || 0;
    const avBgColor = bgColors[charCode % bgColors.length];

    let rowBg = '#1f2937';
    let bgOpacity = 0.3;
    let rankColor = '#ffffff';

    if (index === 0) {
      rowBg = '#eab308';
      bgOpacity = 0.15;
      rankColor = '#eab308';
    } else if (index === 1) {
      rowBg = '#cbd5e1';
      bgOpacity = 0.12;
      rankColor = '#cbd5e1';
    } else if (index === 2) {
      rowBg = '#ca8a04';
      bgOpacity = 0.1;
      rankColor = '#ca8a04';
    }

    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

    rowsContent += `
      <!-- Row ${index + 1} -->
      <rect x="25" y="${y}" width="${width - 50}" height="54" rx="10" fill="${rowBg}" fill-opacity="${bgOpacity}" stroke="#ffffff" stroke-opacity="0.05" />
      
      <!-- Rank number/medal -->
      <text x="50" y="${y + 34}" fill="${rankColor}" font-size="20px" font-family="Segoe UI, Arial, sans-serif" font-weight="bold" text-anchor="middle">${medal}</text>

      <!-- Avatar circle -->
      <circle cx="105" cy="${y + 27}" r="18" fill="${avBgColor}" />
      <text x="105" y="${y + 33}" fill="#ffffff" font-size="15px" font-family="Arial, Segoe UI, sans-serif" font-weight="bold" text-anchor="middle">${initial.toUpperCase()}</text>

      <!-- Name & stats -->
      <text x="140" y="${y + 24}" fill="#ffffff" font-size="16px" font-family="Segoe UI, Arial, sans-serif" font-weight="bold">${nameEscaped}</text>
      <text x="140" y="${y + 43}" fill="#9ca3af" font-size="12px" font-family="Segoe UI, Arial, sans-serif">${statsText}</text>

      <!-- Premium tag/decor if premium -->
      ${user.isPremium ? `<text x="${width - 45}" y="${y + 33}" fill="#facc15" font-size="12px" font-family="Segoe UI, Arial, sans-serif" font-weight="bold" text-anchor="end">👑 PREM</text>` : ''}
    `;
  });

  const svgContent = `
    <svg width="${width}" height="${height}">
      <!-- Outer glassmorphic frame -->
      <rect x="15" y="15" width="${width - 30}" height="${height - 30}" rx="20" fill="#111827" fill-opacity="0.7" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5" />

      <style>
        .title-text { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 900; letter-spacing: 1px; }
      </style>

      <!-- Title Header -->
      <text x="300" y="65" fill="#facc15" font-size="24px" text-anchor="middle" class="title-text">🏆 PAPAN PERINGKAT WARGA 🏆</text>
      <text x="300" y="92" fill="#9ca3af" font-size="14px" font-family="Segoe UI, Arial, sans-serif" text-anchor="middle">${titleEscaped}</text>

      <!-- Top list rows -->
      ${rowsContent}
    </svg>
  `;

  return sharp(finalBg)
    .composite([{ input: Buffer.from(svgContent), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
