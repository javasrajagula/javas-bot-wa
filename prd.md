# PRD Final — Stabilization, Reliability, Premium, Media, Game, Menu UX, and Payment Update

## Javas Bot WA

## 1. Ringkasan

Javas Bot WA membutuhkan stabilisasi menyeluruh karena beberapa fitur inti dan fitur tambahan belum berjalan konsisten. Masalah utama mencakup private chat tidak merespons, status premium kadang hilang setelah bot restart, dependency seperti Poppler/OCR/STT belum terdeteksi dengan jelas, fitur media/stiker rusak atau output kosong, beberapa command game belum tersedia, downloader tidak stabil, dan tampilan menu terlalu padat.

PRD ini menggabungkan seluruh kebutuhan perbaikan menjadi satu rencana final untuk membuat bot lebih stabil, mudah digunakan, aman, dan siap dipakai oleh user umum, admin grup, dan owner.

---

# 2. Tujuan Utama

1. Bot berjalan normal di grup dan chat pribadi.
2. Semua command yang muncul di menu benar-benar tersedia dan bisa digunakan.
3. Status premium tidak hilang setelah bot di-stop atau restart.
4. Fitur media seperti `/stiker`, `/vstiker`, `/hd`, `/togif`, `/wm`, `/removebg`, `/meme`, dan TTS berjalan stabil.
5. Stiker tidak kosong, tidak corrupt, dan memiliki metadata `Javas Bot WA`.
6. Game seperti Werewolf dan Tebak Kata berjalan dengan command/session handler yang benar.
7. Dependency seperti FFmpeg, Poppler, Tesseract, OCR, STT, dan RemoveBG dapat dicek melalui `/checkdeps`.
8. Error teknis tidak ditampilkan mentah ke user.
9. Menu bot dibuat lebih rapi, interaktif, tidak sesak, dan mudah dibaca.
10. Payment premium diperbarui ke GoPay `085338123425`.

---

# 3. Non-Goals

1. Tidak membuat payment gateway otomatis.
2. Tidak mengganti Baileys dengan library lain.
3. Tidak membuat dashboard SaaS penuh.
4. Tidak mengganti database engine utama.
5. Tidak membuat seluruh fitur AI baru dari nol.
6. Tidak rewrite total semua command; fokus pada stabilisasi, UX, dan reliability.

---

# 4. Prioritas Masalah

## P0 — Critical

1. Bot tidak jalan di chat pribadi.
2. Crash `jidDecode(...) is undefined`.
3. Prisma `P2002` pada `GroupConfig` dan stats.
4. Premium kadang hilang setelah bot restart.
5. Command yang ada di menu belum tentu terdaftar.
6. Game Tebak Kata tidak merespons jawaban non-command.
7. Error `internal-server-error` muncul mentah.

## P1 — High

1. `/pdf2img` gagal karena Poppler missing.
2. `/hd` tidak berfungsi.
3. `/stiker` membalas tetapi stiker kosong/corrupt.
4. `/vstiker` memiliki area hitam.
5. `/removebg` tidak berfungsi.
6. `/wm` gagal.
7. `/togif` bermasalah.
8. STT/OCR belum dikonfigurasi dengan jelas.
9. Instagram downloader tidak stabil.
10. TTS tidak stabil.

## P2 — Medium

1. Meme text tidak jelas.
2. Ringkasan `/ringkas` belum rapi.
3. Translate error handling buruk.
4. Menu terlalu padat.
5. Payment premium perlu diperbarui.

## P3 — Documentation

1. README belum lengkap.
2. `.env.example` belum mencakup semua dependency.
3. Belum ada `/checkdeps`.
4. Belum ada `/dbinfo`.
5. Belum ada command diagnostik premium.

---

# 5. Functional Requirements

---

## FR-001 — Refactor Router agar Private Chat Berjalan

### Masalah

Bot tidak merespons command di chat pribadi karena eksekusi command kemungkinan masih berada di dalam blok khusus grup.

### Requirement

Router harus memisahkan:

1. common checks,
2. group-only checks,
3. private-only checks,
4. command execution.

### Flow Baru

```txt
1. Terima pesan.
2. Tentukan apakah pesan dari grup atau private.
3. Jika grup, load/upsert groupConfig.
4. Tentukan prefix.
5. Jika pesan non-command, proses game answer/autoreply/moderation.
6. Resolve command.
7. Jalankan common checks.
8. Jika grup, jalankan group checks.
9. Jika private, jalankan private quota checks.
10. Execute command untuk grup dan private.
11. Log usage.
12. Tangani error dengan pesan user-friendly.
```

### Acceptance Criteria

1. `/menu` berjalan di private chat.
2. `/help` berjalan di private chat.
3. `/tts halo` berjalan di private chat.
4. `/translate en halo` berjalan di private chat.
5. Group command tetap berjalan.
6. GroupConfig tidak dibuat untuk private chat.
7. Private quota branch reachable.
8. Tidak ada silent failure di private chat.

---

## FR-002 — Atomic GroupConfig Initialization

### Masalah

`GroupConfig.create()` bisa terkena `P2002` saat beberapa pesan dari grup baru masuk bersamaan.

### Requirement

Gunakan `upsert`, bukan `findUnique lalu create`.

```ts
const groupConfig = await prisma.groupConfig.upsert({
  where: { groupId: ctx.chatId },
  update: {},
  create: {
    groupId: ctx.chatId,
    prefix: '/',
    botEnabled: true,
    featuresJson: JSON.stringify(DEFAULT_FEATURES)
  }
});
```

### Acceptance Criteria

1. Tidak ada `P2002` pada `GroupConfig`.
2. Existing config tidak overwrite.
3. Group config hanya dibuat untuk grup.
4. Prefix existing tetap dipakai.

---

## FR-003 — Fix Stats Race Condition

### Masalah

Stats user/grup terkena unique constraint pada `groupId`, `userId`, dan `key`.

### Requirement

Buat model khusus:

```prisma
model GroupUserStats {
  id           String   @id @default(uuid())
  groupId      String
  userId       String
  messageCount Int      @default(0)
  commandCount Int      @default(0)
  lastActiveAt DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([groupId, userId])
  @@index([groupId, messageCount])
  @@index([groupId, lastActiveAt])
}
```

### Acceptance Criteria

1. Tidak ada `P2002` pada stats.
2. Message count tetap naik.
3. Stats update aman saat pesan masuk paralel.
4. Stats tidak mengganggu command utama.

---

## FR-004 — Safe JID Decode

### Masalah

Bot crash dengan error:

```txt
Cannot destructure property 'user' of jidDecode(...) as it is undefined.
```

### Requirement

Tambahkan helper:

```ts
export function safeJidDecode(jid?: string | null) {
  if (!jid || typeof jid !== 'string') return null;

  try {
    const decoded = jidDecode(jid);
    if (!decoded || !decoded.user) return null;
    return decoded;
  } catch {
    return null;
  }
}
```

### Larangan

```ts
const { user } = jidDecode(jid);
```

### Wajib

```ts
const decoded = safeJidDecode(jid);
if (!decoded) {
  return fallback;
}
```

### Acceptance Criteria

1. Invalid JID tidak crash.
2. `/togif` tidak membuat routeMessage fatal.
3. Semua penggunaan `jidDecode` aman.
4. JID mentah tidak bocor ke log publik.

---

## FR-005 — Premium Persistence

### Masalah

Premium kadang hilang saat bot di-stop atau restart.

### Penyebab Potensial

1. Database path berubah.
2. SQLite berada di storage sementara.
3. Import config tidak memulihkan `premiumUsers`.
4. JID premium tersimpan dalam format berbeda.
5. Ada duplicate premium user.
6. Bot memakai database baru setelah restart.

### Requirement

Buat service:

```txt
src/services/premium/premium.service.ts
```

### Interface

```ts
addPremiumUser(inputUserId, days, actorId)
removePremiumUser(inputUserId, actorId)
isPremiumUser(inputUserId)
getPremiumStatus(inputUserId)
normalizePremiumRecords()
```

### Canonical Premium User ID

```ts
export function normalizePremiumUserId(input: string): string {
  const raw = String(input || '').trim().replace(/^@/, '');
  const noDomain = raw.split('@')[0];
  const noDevice = noDomain.split(':')[0];
  const phone = noDevice.replace(/\D/g, '');

  if (!phone) throw new Error('User ID premium tidak valid.');

  return `${phone}@s.whatsapp.net`;
}
```

### New Owner Commands

```txt
/cekpremium @user
/listpremium
/fixpremiumids
/dbinfo
```

### Acceptance Criteria

1. Premium tetap aktif setelah restart.
2. `/cekpremium` menampilkan status benar.
3. `/listpremium` menampilkan user premium aktif.
4. `/dbinfo` menampilkan database path.
5. Import config memulihkan premium.
6. Duplicate premium digabung dengan expiry terpanjang.
7. `/premium add` memperpanjang dari expiry lama jika masih aktif.

---

## FR-006 — Payment Premium Update

### Requirement

Semua pesan, invoice, guide, dan menu premium harus menggunakan payment method baru:

```txt
GoPay: 085338123425
```

### Target Commands

```txt
/premium
/premiumguide
/invoice
/menu premium
/help premium
```

### Format Pesan Premium

```txt
💎 Javas Bot WA Premium

Benefit:
• Limit lebih besar
• Akses fitur berat
• Prioritas proses
• Fitur premium tertentu

Pembayaran:
GoPay: 085338123425

Setelah transfer, kirim bukti pembayaran ke owner/admin.
```

### Acceptance Criteria

1. Semua info premium memakai GoPay `085338123425`.
2. Tidak ada nomor/payment lama tersisa.
3. `/premiumguide` menampilkan instruksi jelas.
4. `/invoice` memakai payment method baru.
5. Menu premium mudah dibaca.

---

## FR-007 — Backup/Import Config Lengkap

### Requirement

Import config harus memulihkan:

1. groups,
2. subscriptions,
3. premiumUsers,
4. warningRules,
5. shopItems,
6. achievements.

### Acceptance Criteria

1. Export lalu import memulihkan premium users.
2. Output `/importconfig` menampilkan count semua entity.
3. Duplicate digabung aman.
4. Unsupported backup version ditolak.

---

## FR-008 — Plugin Registry Valid

### Requirement

Tambahkan plugin:

```ts
{
  name: 'general',
  commands: ['menu', 'help', 'start', 'cmd', 'cari', 'ping', 'status'],
  enabled: true,
  permission: 'USER',
  category: 'General'
}
```

Tambahkan plugin `downloader` untuk:

```txt
tt, tiktok, ig, instagram, ytmp3, ytmp4, fb, twitter, x, threads, pinterest, capcut
```

### Unknown Plugin Behavior

```ts
if (!plugin) {
  console.warn(`[Plugins] Unknown plugin requested: ${pluginName}`);
  return env.NODE_ENV === 'production' ? false : true;
}
```

### Acceptance Criteria

1. Tidak ada warning `help`.
2. `/menu` dan `/help` tetap berjalan.
3. Downloader bisa dimatikan lewat plugin.
4. Unknown plugin fail-closed di production.

---

## FR-009 — Poppler Dependency Handling

### Masalah

`/pdf2img` gagal karena Poppler missing.

### Requirement

Cek binary:

```txt
pdftoppm
pdftotext
```

Jika missing, tampilkan:

```txt
⚠️ Poppler belum terinstall, jadi /pdf2img belum bisa dipakai.

Install:
• Windows: choco install poppler
• Ubuntu/Debian: sudo apt install poppler-utils

Setelah install, restart bot dan cek dengan /checkdeps.
```

### Acceptance Criteria

1. `/pdf2img` tidak mengeluarkan stack panjang.
2. `/pdftext` juga menangani Poppler missing.
3. `/checkdeps` menunjukkan status Poppler.
4. Error tidak menjadi fatal routeMessage.

---

## FR-010 — Add `/checkdeps`

### Requirement

Owner command:

```txt
/checkdeps
```

Harus mengecek:

```txt
ffmpeg
ffprobe
pdftoppm
pdftotext
tesseract
OCR_COMMAND
STT_COMMAND
REMOVEBG_COMMAND
FONT_FILE_PATH
TTS_PROVIDER
REMOVEBG_PROVIDER
```

### Output Example

```txt
🧩 Dependency Check

Media:
• ffmpeg: OK
• ffprobe: OK
• font file: Missing

PDF:
• pdftoppm: Missing
• pdftotext: Missing

OCR/STT:
• tesseract: Missing
• OCR_COMMAND: Missing
• STT_COMMAND: Missing

External:
• REMOVEBG_PROVIDER: none
• TTS_PROVIDER: google
```

### Acceptance Criteria

1. `/checkdeps` hanya owner.
2. Missing dependency tidak membuat bot crash.
3. README sesuai hasil checkdeps.

---

## FR-011 — Fix `/hd`

### Requirement

1. Validasi input image/sticker.
2. Validasi ukuran.
3. Tambahkan fallback Sharp jika enhancer utama gagal.
4. Kirim error jelas jika semua gagal.

### Acceptance Criteria

1. `/hd` pada gambar valid mengirim output.
2. `/hd 4x` hanya premium.
3. Fallback Sharp berjalan.
4. Error user-friendly.

---

## FR-012 — Fix `/stiker` Empty / Invalid Sticker Info

### Masalah

Command stiker berhasil membalas, tetapi stiker kosong. Saat ditekan, WhatsApp menampilkan:

```txt
Tidak dapat melihat informasi stiker
```

### Kemungkinan Penyebab

1. Buffer hasil konversi kosong.
2. Output WebP corrupt.
3. Mimetype salah.
4. Metadata EXIF sticker corrupt.
5. File temp terhapus terlalu cepat.
6. Sticker dikirim bukan sebagai sticker message.
7. Ukuran output melebihi limit WhatsApp.

### Requirement

Tambahkan validasi buffer sebelum send sticker.

```ts
export async function validateStickerBuffer(buffer: Buffer): Promise<void> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Sticker output kosong.');
  }

  if (buffer.length < 100) {
    throw new Error('Sticker output terlalu kecil atau corrupt.');
  }

  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');

  if (riff !== 'RIFF' || webp !== 'WEBP') {
    throw new Error('Output bukan file WebP sticker yang valid.');
  }
}
```

### Pipeline Image Sticker

```txt
Input image
→ resize max 512x512
→ convert to webp
→ inject metadata
→ validate WebP
→ send as sticker
```

### Pipeline Video Sticker

```txt
Input video
→ trim duration
→ scale/crop 512x512
→ convert animated WebP
→ inject metadata jika supported
→ validate WebP
→ send as sticker
```

### Acceptance Criteria

1. Bot tidak lagi mengirim stiker kosong.
2. Stiker bisa dibuka informasinya.
3. Stiker memiliki pack name `Javas Bot WA`.
4. Buffer kosong tidak pernah dikirim.
5. File non-WebP tidak dikirim sebagai stiker.
6. Jika metadata gagal, fallback kirim WebP valid tanpa metadata.
7. Tidak ada pesan “Tidak dapat melihat informasi stiker”.

---

## FR-013 — Fix `/vstiker` Black Area

### Requirement

Gunakan FFmpeg filter:

```txt
fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=yuva420p
```

Durasi:

```txt
Free: 5 detik
Premium: 10 detik
```

### Acceptance Criteria

1. Output 512x512.
2. Tidak ada area hitam.
3. Video terlalu panjang dipotong.
4. Output bisa dikirim sebagai sticker.

---

## FR-014 — Sticker Metadata “Javas Bot WA”

### Requirement

Tambahkan env:

```env
STICKER_PACK_NAME="Javas Bot WA"
STICKER_AUTHOR_NAME="Javas"
```

### Acceptance Criteria

1. Stiker punya pack name `Javas Bot WA`.
2. Author default `Javas`.
3. Berlaku untuk image dan video sticker.
4. Jika metadata gagal, sticker tetap dikirim jika WebP valid.

---

## FR-015 — Fix `/removebg`

### Requirement

Tambahkan provider config:

```env
REMOVEBG_PROVIDER="none"
REMOVEBG_API_KEY=""
REMOVEBG_COMMAND=""
```

Mode:

```txt
none
api
local
```

Jika belum configured:

```txt
⚠️ Remove background belum dikonfigurasi. Set REMOVEBG_PROVIDER dan REMOVEBG_API_KEY atau REMOVEBG_COMMAND.
```

### Acceptance Criteria

1. `/removebg` berhasil jika provider tersedia.
2. Jika provider missing, bot tidak crash.
3. Output PNG transparan valid.

---

## FR-016 — Fix Meme Text Readability

### Requirement

Meme renderer harus menggunakan:

1. font bold,
2. white fill,
3. black stroke,
4. auto-wrap,
5. dynamic font size,
6. safe margin,
7. top/bottom text.

### Acceptance Criteria

1. Teks terbaca pada gambar gelap/terang.
2. Teks panjang tidak keluar frame.
3. Output meme jelas.

---

## FR-017 — Fix `/wm`

### Requirement

Pisahkan:

```ts
watermarkImage(buffer, text)
watermarkVideo(buffer, text)
```

Untuk video:

1. escape karakter FFmpeg,
2. support `FONT_FILE_PATH`,
3. fallback overlay image jika drawtext gagal.

### Acceptance Criteria

1. `/wm teks` berhasil di gambar.
2. `/wm teks` berhasil di video.
3. Teks dengan tanda baca aman.
4. Error font tidak membuat crash.

---

## FR-018 — Fix `/togif`

### Requirement

1. Gunakan safe JID decode.
2. Validasi video input.
3. Gunakan FFmpeg pipeline stabil.
4. Batasi durasi:

   * free: 10 detik
   * premium: 30 detik.
5. Output GIF playable.

### Acceptance Criteria

1. `/togif` tidak crash.
2. Output GIF bisa dikirim.
3. File temp dibersihkan.
4. Error user-friendly.

---

## FR-019 — Fix TTS

### Requirement

Buat service:

```txt
src/services/tts/tts.service.ts
```

Command tidak boleh langsung axios ke provider.

Provider chain:

1. local command,
2. Google Translate TTS fallback,
3. custom API jika tersedia.

Hotfix:

1. gunakan HTTPS,
2. validasi content-type audio,
3. kirim sebagai audio biasa dengan `audio/mpeg`,
4. jangan kirim MP3 sebagai voice note `audio/mp4`.

### Acceptance Criteria

1. `/tts halo` menghasilkan audio playable.
2. Response non-audio ditolak.
3. Error provider tidak bocor ke user.
4. Tidak ada temp file tersisa.

---

## FR-020 — Instagram Downloader Reliability

### Requirement

1. Normalize Instagram URL.
2. Hapus query tracking seperti `?igsh=...`.
3. Tambahkan fallback chain.
4. Support cookies jika `INSTAGRAM_COOKIES` tersedia.
5. Log error provider dengan ringkas.
6. User error jelas.

### Acceptance Criteria

1. URL `/reel/<id>/?igsh=...` dinormalisasi.
2. Fallback berjalan jika extractor pertama gagal.
3. User mendapat pesan jelas jika media privat/terbatas.
4. Bot tidak crash.

---

## FR-021 — STT Offline Handling

### Env

```env
STT_COMMAND=""
STT_TIMEOUT_SECONDS="120"
```

### Contract

```txt
Input: path audio sebagai argumen pertama
Output: teks ke stdout
Exit code 0: sukses
```

### Acceptance Criteria

1. `/transkrip` tidak crash.
2. Jika missing, pesan konfigurasi jelas.
3. Jika configured, STT berjalan.
4. Timeout bekerja.

---

## FR-022 — OCR Handling

### Env

```env
OCR_COMMAND=""
OCR_TIMEOUT_SECONDS="60"
TESSERACT_CMD="tesseract"
```

### Behavior

1. Gunakan `OCR_COMMAND` jika tersedia.
2. Jika tidak, coba Tesseract.
3. Jika missing, pesan setup jelas.

### Acceptance Criteria

1. OCR berjalan jika Tesseract tersedia.
2. OCR missing tidak crash.
3. Auto OCR tidak membuat hasil ngaco jika output kosong.

---

## FR-023 — Translate Internal Server Error

### Requirement

Buat provider abstraction:

```ts
translateText(input, targetLang, sourceLang?)
summarizeText(input)
rewriteText(input, style)
```

Map `internal-server-error` ke:

```txt
❌ Layanan sedang bermasalah. Coba lagi nanti atau gunakan teks yang lebih pendek.
```

### Acceptance Criteria

1. `/tr en halo` berjalan atau error jelas.
2. `/translate id Good morning` berjalan.
3. Raw `internal-server-error` tidak dikirim ke user.
4. Error tercatat dengan error ID.

---

## FR-024 — Improve `/ringkas`

### Requirement

Output wajib terstruktur:

```txt
📝 Ringkasan:
1. ...
2. ...
3. ...

🔑 Poin penting:
• ...
• ...

📌 Kesimpulan:
...
```

Rules:

1. minimal input 80 karakter,
2. jangan menambah fakta di luar teks,
3. fallback extractive summarizer jika AI provider gagal,
4. quoted message bisa diringkas.

### Acceptance Criteria

1. Ringkasan jelas.
2. Teks pendek ditolak.
3. Tidak halusinatif.
4. Provider error punya fallback.

---

## FR-025 — Werewolf Commands

### Requirement

Register command:

```txt
/ww start
/ww join
/ww leave
/ww begin
/ww vote
/ww status
/ww stop
/ww help
```

Alias:

```txt
/ww
/werewolf
```

### Acceptance Criteria

1. `/ww help` berjalan.
2. `/ww start` membuat lobby.
3. `/ww join` menambah pemain.
4. `/ww begin` memulai game.
5. Menu tidak menampilkan command yang belum tersedia.

---

## FR-026 — Game Answer Router for Tebak Kata

### Requirement

Tambahkan non-command game answer routing:

```txt
Jika pesan bukan command dan ada active game session:
  kirim ke game answer handler.
Jika handled=true:
  stop router.
Jika handled=false:
  lanjut normal.
```

### Interface

```ts
export interface GameAnswerHandler {
  canHandle(ctx: MessageContext): Promise<boolean>;
  handleAnswer(ctx: MessageContext, adapter: WhatsAppAdapter): Promise<boolean>;
}
```

### Acceptance Criteria

1. Jawaban tebak kata tanpa prefix direspons.
2. Jawaban benar mengakhiri/memperbarui session.
3. Jawaban salah diberi feedback atau diabaikan sesuai desain.
4. Chat biasa tidak terganggu saat tidak ada game aktif.

---

# 6. Menu Baru yang Lebih Interaktif dan Enak Dibaca

## FR-027 — Redesign Menu UX

### Masalah

Menu lama terlalu sesak, panjang, dan sulit dibaca. User sulit menemukan command yang dibutuhkan.

### Requirement

Menu harus dibuat modular, ringkas, dan interaktif.

Command utama:

```txt
/menu
/menu all
/menu media
/menu stiker
/menu ai
/menu game
/menu admin
/menu owner
/menu premium
/menu downloader
/menu dokumen
/menu audio
/menu text
```

### Prinsip UI Menu

1. Tidak menampilkan semua command sekaligus di `/menu`.
2. `/menu` hanya menampilkan kategori utama.
3. User memilih kategori dengan command lanjutan.
4. Gunakan emoji secukupnya.
5. Gunakan spacing yang rapi.
6. Tampilkan contoh penggunaan singkat.
7. Tampilkan status user:

   * free/premium,
   * limit harian,
   * prefix,
   * mode chat: private/grup.
8. Tampilkan payment premium di menu premium.

---

## FR-028 — Main Menu Layout

### Output `/menu`

```txt
╭───「 JAVAS BOT WA 」───╮
│ Halo, @user
│ Mode : Grup / Private
│ Status : Free / Premium
│ Prefix : /
╰────────────────────╯

Pilih kategori menu:

1. 🖼️ Media & Editing
   /menu media

2. 🎨 Stiker & Meme
   /menu stiker

3. 📄 Dokumen & PDF
   /menu dokumen

4. 🎵 Audio & Voice
   /menu audio

5. 🤖 AI & Teks
   /menu text

6. 📥 Downloader
   /menu downloader

7. 🎮 Game
   /menu game

8. 🛡️ Admin Grup
   /menu admin

9. 💎 Premium
   /menu premium

10. 👑 Owner
   /menu owner

Ketik /menu all untuk melihat semua command.
```

### Acceptance Criteria

1. `/menu` tidak terlalu panjang.
2. Semua kategori mudah dibaca.
3. User tahu command lanjutan.
4. Tidak menampilkan fitur owner ke non-owner, kecuali sebagai hidden/locked sesuai desain.

---

## FR-029 — Category Menu Layout

### Example `/menu stiker`

```txt
╭──「 🎨 STIKER & MEME 」──╮
│ Prefix: /
│ Tips: reply gambar/video
╰────────────────────╯

🧩 Stiker:
• /stiker — buat stiker dari gambar
• /s — alias stiker
• /vstiker — buat stiker dari video
• /brat <teks> — stiker teks

🖼️ Editing:
• /removebg — hapus background
• /meme atas | bawah — buat meme

ℹ️ Catatan:
Stiker memakai pack:
Javas Bot WA
```

### Example `/menu premium`

```txt
╭──「 💎 PREMIUM 」──╮
│ Upgrade Javas Bot WA
╰────────────────╯

Benefit:
• Limit lebih besar
• Akses fitur berat
• Proses prioritas
• Fitur premium tertentu

Harga:
• 7 hari  : Rp ...
• 30 hari : Rp ...
• Custom  : hubungi owner

Pembayaran:
GoPay: 085338123425

Setelah transfer:
Kirim bukti pembayaran ke owner/admin.
```

### Acceptance Criteria

1. Menu kategori pendek dan fokus.
2. Setiap command punya deskripsi 1 baris.
3. Payment premium tampil jelas.
4. Menu premium memakai GoPay baru.

---

## FR-030 — Dynamic Menu Visibility

### Requirement

Menu harus menyesuaikan konteks:

1. Private chat:

   * tampilkan fitur private-safe,
   * admin grup disembunyikan atau diberi label “khusus grup”.
2. Group chat:

   * tampilkan fitur grup,
   * fitur owner hanya untuk owner.
3. User free:

   * fitur premium diberi label `Premium`.
4. User premium:

   * tampilkan status premium dan expired date.
5. Owner:

   * tampilkan menu owner.

### Acceptance Criteria

1. Non-owner tidak melihat menu owner penuh.
2. Private chat tidak dipenuhi command admin grup.
3. Premium status tampil benar.
4. Expired premium tampil jika tersedia.

---

## FR-031 — Menu Registry-Driven

### Requirement

Menu tidak boleh hard-coded penuh. Menu harus mengambil data dari command metadata/registry.

Command metadata wajib punya:

```ts
{
  name: string;
  aliases: string[];
  category: string;
  plugin: string;
  permission: 'USER' | 'ADMIN' | 'OWNER' | 'PREMIUM';
  description: string;
  usage: string;
  examples: string[];
  enabled: boolean;
}
```

### Acceptance Criteria

1. Command yang belum terdaftar tidak muncul di menu.
2. Command disabled tidak muncul atau diberi label off.
3. Command owner hanya muncul ke owner.
4. Menu otomatis update saat metadata berubah.

---

# 7. Database Index Requirements

Tambahkan index:

```prisma
model UsageLog {
  @@index([groupId, createdAt])
  @@index([userId, groupId, createdAt])
  @@index([feature, createdAt])
}

model GroupLog {
  @@index([groupId, createdAt])
  @@index([type, createdAt])
}

model Warning {
  @@index([groupId, userId])
}

model InfractionLog {
  @@index([groupId, userId, createdAt])
}

model Blacklist {
  @@index([scope, groupId, userId])
}

model AutoReply {
  @@index([groupId, trigger])
}
```

---

# 8. Documentation Requirements

Update:

```txt
README.md
.env.example
```

## README Must Include

1. Install FFmpeg.
2. Install Poppler.
3. Install Tesseract.
4. STT_COMMAND wrapper.
5. OCR_COMMAND wrapper.
6. RemoveBG config.
7. TTS provider.
8. Private chat behavior.
9. Premium persistence.
10. `/checkdeps`.
11. `/dbinfo`.
12. Payment premium GoPay `085338123425`.
13. Menu category usage.

## `.env.example` Must Include

```env
PRIVATE_DAILY_CMD_LIMIT="20"
PREMIUM_PRIVATE_DAILY_CMD_LIMIT="200"

STT_COMMAND=""
STT_TIMEOUT_SECONDS="120"

OCR_COMMAND=""
OCR_TIMEOUT_SECONDS="60"
TESSERACT_CMD="tesseract"

REMOVEBG_PROVIDER="none"
REMOVEBG_API_KEY=""
REMOVEBG_COMMAND=""

TTS_PROVIDER="google"
TTS_COMMAND=""
TTS_API_BASE_URL=""
TTS_API_KEY=""

STICKER_PACK_NAME="Javas Bot WA"
STICKER_AUTHOR_NAME="Javas"

FONT_FILE_PATH=""

PREMIUM_PAYMENT_METHOD="GoPay"
PREMIUM_PAYMENT_NUMBER="085338123425"

DATABASE_URL="file:./dev.db"
```

---

# 9. Implementation Plan

## Phase 1 — P0 Crash & Routing

1. Refactor private chat router.
2. Add `safeJidDecode`.
3. Patch all unsafe `jidDecode`.
4. Replace GroupConfig create with upsert.
5. Fix CustomVariable stats race or add GroupUserStats.
6. Register general/help plugin.
7. Register downloader plugin.
8. Add error mapper for `internal-server-error`.

## Phase 2 — Premium Persistence & Payment

1. Add premium service.
2. Normalize premium IDs.
3. Add `/cekpremium`.
4. Add `/listpremium`.
5. Add `/dbinfo`.
6. Fix import config for premiumUsers.
7. Add `/fixpremiumids`.
8. Add premium audit log.
9. Update premium payment to GoPay `085338123425`.
10. Update `/premiumguide`, `/invoice`, and `/menu premium`.

## Phase 3 — Dependency System

1. Add dependency-check service.
2. Add `/checkdeps`.
3. Precheck Poppler before `/pdf2img` and `/pdftext`.
4. Precheck OCR/STT.
5. Update README and `.env.example`.

## Phase 4 — Media & Sticker

1. Fix `/hd`.
2. Fix `/stiker` empty/corrupt.
3. Fix `/vstiker`.
4. Fix `/togif`.
5. Fix `/wm`.
6. Fix `/removebg`.
7. Add sticker metadata.
8. Improve meme text.

## Phase 5 — Text, TTS, Downloader

1. Add TTS service.
2. Fix Instagram downloader normalization/fallback.
3. Fix translate error mapping.
4. Improve `/ringkas`.
5. Improve OCR fallback.

## Phase 6 — Games

1. Register Werewolf.
2. Add Werewolf session flow.
3. Add Tebak Kata answer router.
4. Add game session tests.

## Phase 7 — Menu UX Redesign

1. Build registry-driven menu service.
2. Add `/menu <category>`.
3. Add `/menu all`.
4. Add dynamic visibility by role/context.
5. Add premium/payment section.
6. Remove overcrowded old menu.

## Phase 8 — Tests & Release

1. Unit tests.
2. Integration tests.
3. Manual smoke tests.
4. Documentation review.
5. Release tag.

---

# 10. Test Plan

## Core Router

```txt
/private /menu
/private /help
/private /tts halo
/group /menu
/group /help
```

Expected:

1. private responds,
2. group responds,
3. groupConfig not created for private,
4. usage logged correctly.

## Premium

```txt
/premium add @user 30
/cekpremium @user
/listpremium
/dbinfo
/menu premium
/invoice premium 30
```

Restart bot.

Expected:

1. premium remains active,
2. DB path unchanged,
3. expiry unchanged,
4. payment shows GoPay `085338123425`.

## Dependency

```txt
/checkdeps
/pdf2img
/pdftext
/ocr
/transkrip
```

Expected:

1. missing dependency produces setup message,
2. no routeMessage fatal error.

## Media

```txt
/hd
/stiker
/s
/vstiker
/togif
/wm Javas Bot
/removebg
/meme atas | bawah
/tts halo
```

Expected:

1. output playable/valid,
2. sticker tidak kosong,
3. sticker info bisa dibuka,
4. temp files cleaned,
5. no crash,
6. error user-friendly.

## Game

```txt
/ww help
/ww start
/ww join
/ww begin
/tebakkata
jawaban tanpa prefix
```

Expected:

1. Werewolf command exists,
2. tebak kata answer handled.

## Text

```txt
/tr en halo
/translate id Good morning
/ringkas <teks panjang>
```

Expected:

1. no raw internal-server-error,
2. ringkas structured,
3. no hallucination.

## Menu

```txt
/menu
/menu stiker
/menu media
/menu dokumen
/menu game
/menu premium
/menu owner
/menu all
```

Expected:

1. menu tidak sesak,
2. kategori jelas,
3. command sesuai role,
4. premium payment benar,
5. owner menu hanya terlihat untuk owner.

---

# 11. Verification Commands

```bash
npm run typecheck
npm run build
npm test
npx prisma validate
npx prisma generate
```

If migration added:

```bash
npx prisma migrate dev --name stabilization-hardening
```

Manual smoke test:

```txt
/menu
/menu stiker
/menu premium
/help
/checkdeps
/dbinfo
/cekpremium @user
/hd
/stiker
/vstiker
/togif
/tts halo
/tr en halo
/ringkas <teks panjang>
/ww help
```

---

# 12. Definition of Done

PRD selesai jika:

1. Private chat command berjalan.
2. Group command tetap berjalan.
3. Tidak ada crash `jidDecode undefined`.
4. Tidak ada `P2002` pada GroupConfig/stats.
5. Premium tetap ada setelah restart.
6. `/dbinfo` menunjukkan DB yang benar.
7. `/cekpremium` dan `/listpremium` berjalan.
8. Payment premium memakai GoPay `085338123425`.
9. `/checkdeps` tersedia.
10. `/pdf2img` dan `/pdftext` punya Poppler handling.
11. `/hd` stabil.
12. `/stiker` tidak kosong/corrupt.
13. Sticker info bisa dibuka.
14. Sticker metadata `Javas Bot WA` muncul.
15. `/vstiker`, `/togif`, `/wm`, `/removebg`, meme, dan TTS stabil.
16. OCR/STT missing ditangani jelas.
17. `/translate` tidak menampilkan raw `internal-server-error`.
18. `/ringkas` menghasilkan output terstruktur.
19. Werewolf command tersedia.
20. Tebak kata merespons jawaban non-command.
21. Menu baru lebih interaktif, tidak sesak, dan enak dibaca.
22. README dan `.env.example` lengkap.
23. Semua verification command lulus.
