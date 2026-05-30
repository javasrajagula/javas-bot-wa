import fs from 'fs';
import path from 'path';
import { CommandMetadata } from '../registry/command-types.js';

const OWNER_COMMANDS = new Set([
  'addreseller', 'addsewa', 'allowgroup', 'apikeycreate', 'apikeylist', 'apikeyrevoke',
  'autobackup', 'backup', 'backupgd', 'backupsend', 'blockcmd', 'broadcast',
  'broadcasttemplate', 'clearerrors', 'config', 'denygroup', 'disablecmd', 'enablecmd',
  'extendsewa', 'logoutwa', 'maintenance', 'movegroup', 'ownerlog', 'panicmode',
  'provider', 'repair', 'restart', 'rollback', 'sessionstatus', 'setplan', 'shutdownbot',
  'simulate', 'update', 'updateannounce', 'workerstatus', 'workers'
]);

const ADMIN_COMMANDS = new Set([
  'adminroom', 'antijudi', 'antipinjol', 'antiscam', 'antitoxic', 'approval', 'approve',
  'autoopen', 'autoclose', 'autoslowmode', 'banlist', 'captcha', 'case', 'close',
  'closereport', 'demote', 'evidence', 'filtermedia', 'globalblacklist', 'goodbye',
  'groupmode', 'hidetag', 'kick', 'kickvote', 'linkgc', 'listreport', 'lock',
  'mediafilter', 'newmemberlinkblock', 'open', 'promote', 'quarantine', 'raidmode',
  'reject', 'reportmsg', 'resetlink', 'riskconfig', 'riskmode', 'setadminroom',
  'setdesc', 'setgoodbye', 'setname', 'setppgc', 'setwelcome', 'silentmod', 'tagall',
  'tempadmin', 'tempmute', 'unlock', 'welcome', 'welcomecard', 'whitelistdomain',
  'whitelistword'
]);

const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  ['owner', ['backup', 'broadcast', 'owner', 'provider', 'maintenance', 'session', 'restart', 'update', 'repair', 'worker', 'instance', 'failover']],
  ['moderation', ['anti', 'kick', 'promote', 'demote', 'warn', 'risk', 'raid', 'mute', 'captcha', 'lock', 'report', 'case', 'evidence', 'blacklist', 'banlist']],
  ['analytics', ['stats', 'analytics', 'topchat', 'topcmd', 'topsticker', 'topactive', 'inactive', 'sentiment', 'income', 'activegroups', 'coststats', 'weeklyreport']],
  ['school', ['tugas', 'jadwal', 'ujian', 'soal', 'latihan', 'bahas', 'flashcard', 'rumus', 'glossary', 'kamus', 'grammar', 'vocab', 'surat', 'proposal', 'notulen']],
  ['ai', ['ai', 'caption', 'bio', 'hashtag', 'script', 'subtitle', 'srt', 'ringkas', 'translate', 'provider']],
  ['document', ['pdf', 'docx', 'txt', 'zip', 'file', 'scan', 'ocr', 'export', 'struk', 'table']],
  ['productivity', ['note', 'todo', 'ingat', 'remind', 'countdown', 'habit', 'mood', 'diary', 'form', 'pomodoro', 'memory', 'bookmark', 'wiki', 'faq']],
  ['economy', ['rep', 'score', 'mission', 'season', 'pass', 'reward', 'tier', 'raffle', 'lelang', 'giftitem', 'dailyshop', 'clan', 'role']],
  ['business', ['jual', 'produk', 'kas', 'split', 'catat', 'budget', 'tagihan', 'arisan', 'iuran', 'invoice', 'order', 'customer', 'ongkir', 'resi', 'escrow', 'kontrak']],
  ['premium', ['sewa', 'quota', 'credit', 'coupon', 'referral', 'reseller', 'addon', 'store', 'trial', 'plan']],
  ['automation', ['auto', 'workflow', 'rule', 'var']],
  ['privacy', ['privacy', 'retention', 'mydata', 'deletedata', 'consent', 'rules', 'cleandb']],
  ['developer', ['api', 'webhook', 'diagnose', 'dbstatus', 'health', 'queue', 'job', 'error', 'statusbot', 'securitycheck', 'setupcheck']]
];

export function loadPrdCommandNames(prdPath = path.join(process.cwd(), 'prd.md')): string[] {
  if (!fs.existsSync(prdPath)) return [];
  const prd = fs.readFileSync(prdPath, 'utf-8');
  const names = new Set<string>();
  for (const match of prd.matchAll(/`\/(\S+)/g)) {
    const name = match[1]
      .replace(/[>|,.)`].*$/, '')
      .replace(/[^a-zA-Z0-9_-].*$/, '')
      .toLowerCase()
      .trim();
    if (name) names.add(name);
  }
  return [...names].sort();
}

function categoryFor(command: string): string {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => command.includes(keyword))) return category;
  }
  if (['menu', 'help', 'ping', 'start', 'cmd', 'cari'].includes(command)) return 'help';
  return 'general';
}

function pluginFor(category: string): string {
  if (category === 'developer') return 'general';
  if (category === 'premium') return 'owner';
  return category;
}

function minRoleFor(command: string) {
  if (OWNER_COMMANDS.has(command)) return 'owner' as const;
  if (ADMIN_COMMANDS.has(command)) return 'admin' as const;
  return undefined;
}

export function loadPrdCommandMetadata(): CommandMetadata[] {
  return loadPrdCommandNames().map((name) => {
    const category = categoryFor(name);
    return {
      name,
      aliases: [],
      category,
      plugin: pluginFor(category),
      featureFlag: 'general',
      minRole: minRoleFor(name),
      description: `Command PRD /${name} dengan handler aman dan terdaftar di menu.`,
      usage: `/${name} [opsi]`,
      examples: [`/${name}`]
    };
  });
}
