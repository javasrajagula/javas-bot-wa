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
  ['productivity', ['note', 'todo', 'ingat', 'remind', 'countdown', 'habit', 'mood', 'diary', 'memory']],
  ['economy', ['rep', 'score', 'mission', 'season', 'pass', 'reward', 'tier', 'raffle', 'lelang', 'giftitem', 'dailyshop', 'clan', 'role']],
  ['business', ['jual', 'produk', 'kas', 'split', 'catat', 'budget', 'tagihan', 'arisan', 'iuran', 'invoice', 'order', 'customer', 'ongkir', 'resi', 'escrow', 'kontrak']],
  ['premium', ['sewa', 'quota', 'credit', 'coupon', 'referral', 'reseller', 'addon', 'store', 'trial', 'plan']],
  ['automation', ['auto', 'workflow', 'rule', 'var']],
  ['privacy', ['privacy', 'retention', 'mydata', 'deletedata', 'consent', 'rules', 'cleandb']],
  ['developer', ['api', 'webhook', 'diagnose', 'dbstatus', 'health', 'queue', 'job', 'error', 'statusbot', 'securitycheck', 'setupcheck']]
];

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  // Developer & Status
  ping: 'Mengukur kecepatan respon (latensi) sistem bot.',
  statusbot: 'Menampilkan rincian status penggunaan memori dan uptime server.',
  health: 'Mengecek indikator kesehatan koneksi database dan runtime.',
  webhook: 'Mengatur pendaftaran dan pengujian integrasi webhook eksternal.',
  diagnose: 'Menjalankan self-diagnostic lengkap komponen bot.',
  dbstatus: 'Mengecek status dan kapasitas database aktif.',
  setupcheck: 'Memastikan semua feature flags terpasang dengan benar.',
  securitycheck: 'Mengecek konfigurasi SSL, proxy, dan sanitasi keamanan.',
  api: 'Mengatur dan menguji integrasi REST API eksternal bot.',
  apikey: 'Mengelola token API key untuk akses eksternal.',
  batchstiker: 'Mengonversi banyak media gambar/video sekaligus menjadi paket stiker.',
  captiondemo: 'Menampilkan demo pembuatan teks caption otomatis menggunakan AI.',
  compress: 'Memperkecil ukuran file gambar atau video.',
  compresspdf: 'Memperkecil ukuran file dokumen PDF.',
  cut: 'Memotong durasi video pada detik tertentu.',
  cutaudio: 'Memotong durasi file audio/MP3.',
  doctor: 'Memeriksa status kesehatan sistem dan ketergantungan library.',
  emojimix: 'Menggabungkan dua emoji menjadi stiker emoji kustom.',
  fiturstatus: 'Menampilkan status feature flags dan sisa kuota grup.',
  menu: 'Menampilkan menu bantuan dan daftar seluruh perintah bot.',
  mergepdf: 'Menggabungkan beberapa dokumen PDF menjadi satu file.',
  mp3: 'Mengonversi dan mengekstrak audio dari video menjadi file MP3.',
  outline: 'Menambahkan garis tepi (outline) hitam/putih pada stiker.',
  pdf2img: 'Mengonversi setiap halaman dokumen PDF menjadi gambar JPG.',
  pdftext: 'Mengekstrak seluruh teks tulisan dari dokumen PDF.',
  premium: 'Mengelola status pengguna premium dan masa aktifnya.',
  queue: 'Melihat antrean proses media dan pekerjaan di latar belakang.',
  quote: 'Membuat stiker kutipan teks dengan latar belakang gradasi.',
  removebg: 'Menghapus latar belakang gambar secara otomatis.',
  repair: 'Mereset konfigurasi grup kembali ke setelan default.',
  resize: 'Mengubah resolusi atau dimensi gambar/foto.',
  reverse: 'Memutar balik alur video (mundur).',
  slow: 'Memperlambat tempo kecepatan pemutaran audio/suara.',
  speed: 'Mempercepat tempo kecepatan pemutaran audio/suara.',
  stiker: 'Mengonversi gambar, video, atau GIF menjadi stiker WhatsApp.',
  subtitle: 'Membuat atau mengekstrak subtitle SRT dari video.',
  thumb: 'Mengambil cuplikan gambar (thumbnail) dari file video.',
  togif: 'Mengonversi video pendek menjadi format GIF animasi.',
  toimg: 'Mengonversi stiker kembali menjadi file gambar biasa.',
  tts: 'Mengonversi teks tulisan menjadi berkas suara (Text-to-Speech).',
  voice: 'Mengubah efek suara audio (robot, chipmunk, deep, dll).',
  vstiker: 'Mengonversi video menjadi stiker bergerak.',

  // Owner Commands
  addreseller: 'Mendaftarkan akun reseller premium baru.',
  addsewa: 'Menambahkan masa sewa berbayar untuk suatu grup WhatsApp.',
  allowgroup: 'Mengizinkan grup tertentu untuk menggunakan perintah bot.',
  apikeycreate: 'Membuat token API key baru untuk akses eksternal.',
  apikeylist: 'Menampilkan daftar API key aktif milik Anda.',
  apikeyrevoke: 'Menonaktifkan token API key aktif milik Anda.',
  autobackup: 'Mengaktifkan pencadangan otomatis berkala ke cloud.',
  backup: 'Membuat file cadangan lengkap database secara lokal.',
  denygroup: 'Memblokir grup tertentu agar tidak bisa memakai bot.',
  disablecmd: 'Menonaktifkan perintah tertentu secara global.',
  enablecmd: 'Mengaktifkan kembali perintah yang dinonaktifkan.',
  extendsewa: 'Memperpanjang masa sewa aktif grup WhatsApp.',
  maintenance: 'Mengaktifkan mode pemeliharaan global (khusus Owner).',
  setplan: 'Mengubah paket langganan grup (Free/Basic/Premium).',
  workers: 'Melihat status antrian background workers.',

  // Admin Commands
  antijudi: 'Mengaktifkan deteksi dan penghapusan link judi/taruhan.',
  antipinjol: 'Memblokir promosi pinjaman online ilegal di grup.',
  antispam: 'Membatasi pengiriman pesan beruntun (spamming) otomatis.',
  antispamMode: 'Mengatur jenis hukuman untuk pelanggar spam.',
  antilink: 'Memblokir link grup/website luar secara otomatis.',
  antilinkMode: 'Mengatur jenis hukuman untuk pengirim link luar.',
  antitoxic: 'Menghapus pesan toxic kasar menggunakan sensor kata.',
  approval: 'Mengaktifkan persetujuan admin untuk broadcast/kick.',
  approve: 'Menyetujui permintaan tindakan administratif tertunda.',
  reject: 'Menolak permintaan tindakan administratif tertunda.',
  kick: 'Mengeluarkan anggota terpilih secara paksa dari grup.',
  mute: 'Membatasi hak kirim pesan (mute) sementara bagi anggota.',
  unmute: 'Mengembalikan hak kirim pesan bagi anggota yang dimute.',
  promote: 'Mempromosikan anggota menjadi admin grup.',
  demote: 'Menurunkan admin grup kembali menjadi anggota biasa.',
  tempadmin: 'Mengangkat admin sementara dengan durasi kedaluwarsa.',
  welcome: 'Mengaktifkan sapaan selamat datang otomatis.',
  goodbye: 'Mengaktifkan salam perpisahan otomatis.',
  setwelcome: 'Memperbarui template teks selamat datang.',
  setgoodbye: 'Memperbarui template teks perpisahan.',
  welcomecard: 'Mengaktifkan pembuatan gambar welcome card otomatis.',
  captcha: 'Mengaktifkan captcha verifikasi matematika bagi member baru.',
  blacklist: 'Memasukkan pengguna ke daftar hitam grup/global.',
  unblacklist: 'Menghapus pengguna dari daftar hitam.',
  listblacklist: 'Menampilkan semua pengguna yang dicekal.',
  tagall: 'Tag seluruh anggota grup dalam satu pesan.',
  hidetag: 'Mengirimkan pengumuman senyap tanpa tag terlihat.',
  grouplog: 'Menampilkan audit log aktivitas administratif grup.',

  // Privacy & GDPR
  privacymode: 'Mengatur ketat/longgarnya privasi pengumpulan data.',
  retention: 'Menentukan masa penyimpanan log di database grup.',
  mydata: 'Melihat rincian data personal yang terekam sistem.',
  deletedata: 'Menghapus seluruh riwayat data personal (GDPR compliance).',
  consent: 'Mengatur persetujuan perekaman data kustom per pengguna.',
  setuju: 'Menyatakan persetujuan terhadap peraturan tertulis grup.',

  // School Mode
  schoolmode: 'Mengaktifkan modul tugas, absen, dan jadwal kelas.',
  tugas: 'Menampilkan daftar tugas/PR aktif milik kelas.',
  tugasadd: 'Menambahkan tugas baru dengan batas waktu pengumpulan.',
  tugasdone: 'Menandai tugas kelas tertentu telah selesai dikerjakan.',
  absen: 'Mengelola pembukaan dan rekap daftar kehadiran absen.',
  jadwal: 'Menampilkan jadwal pelajaran atau agenda mingguan grup.',

  // Productivity
  todo: 'Mengelola daftar kegiatan personal harian Anda.',
  catatan: 'Menyimpan teks catatan penting personal di server.',
  habit: 'Melacak pembiasaan rutinitas harian Anda.',
  mood: 'Mencatat grafik emosi (mood tracker) harian Anda.',
  diary: 'Menulis jurnal harian personal secara aman.',

  // Virtual Economy
  balance: 'Cek saldo koin virtual, tabungan bank, dan level Anda.',
  claim: 'Mengeklaim hadiah koin harian gratis.',
  transfer: 'Mengirimkan koin virtual ke pengguna lain.',
  rank: 'Menampilkan kartu profil rank XP dan Level Anda.',
  leaderboard: 'Menampilkan 10 besar peringkat kekayaan virtual.',
  shop: 'Membuka menu toko item/role virtual.',
  inventory: 'Melihat daftar item virtual di dalam tas Anda.',
  pet: 'Mengadopsi, memberi makan, dan bertarung bersama hewan peliharaan virtual.',
  dungeon: 'Mulai petualangan RPG mengalahkan monster untuk koin.',
  misi: 'Melihat dan mengeklaim misi harian pencapaian.',

  // Business & Finance
  jual: 'Memasang iklan produk/jasa di grup dagang.',
  beli: 'Menyatakan minat beli untuk produk yang diiklankan.',
  listproduk: 'Menampilkan galeri produk aktif yang dijual di grup.',
  hapusproduk: 'Menghapus iklan produk yang Anda pasang.',
  kas: 'Mengelola pencatatan dana kas kelompok grup.',
  split: 'Membuat perhitungan bagi rata tagihan (split bill).',
  splitstatus: 'Menampilkan status pelunasan bagi rata tagihan.',
  splitdone: 'Menandai anggota telah melunasi split bill.',
  tagihan: 'Mengirim tagihan iuran individual ke anggota.',
  arisan: 'Mengelola sistem arisan kelompok otomatis.',
  catat: 'Mencatat pengeluaran penganggaran keuangan pribadi.',

  // Automation & Rules
  workflow: 'Membuat rangkaian perintah terstruktur otomatis.',
  auto: 'Menyusun aturan otomatis berbasis trigger pesan.',
  rule: 'Mengelola daftar peraturan grup WhatsApp.',
  var: 'Menyimpan variabel kustom kelompok untuk otomasi.',
  announcements: 'Menampilkan arsip pengumuman resmi grup.'
};

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
  if (['menu', 'help', 'ping', 'start', 'cmd', 'cari'].includes(command)) return 'general';
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
    const description = COMMAND_DESCRIPTIONS[name] || `Menjalankan fungsi perintah /${name} secara aman.`;
    return {
      name,
      aliases: [],
      category,
      plugin: pluginFor(category),
      featureFlag: 'general',
      minRole: minRoleFor(name),
      description,
      usage: `/${name} [opsi]`,
      examples: [`/${name}`]
    };
  });
}
