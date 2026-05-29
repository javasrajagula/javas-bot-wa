# PRD Final — Javas Bot WA

## 1. Ringkasan Produk

Javas Bot WA adalah bot WhatsApp berbasis Node.js + TypeScript yang menyediakan fitur stiker, pengolahan gambar/video/audio, downloader media sosial sesuai batasan legal, game grup, ekonomi virtual, moderasi grup, AI tools, file tools, dan owner management.

Bot harus berjalan di chat pribadi dan grup WhatsApp, tetapi wajib **silent by default**. Bot tidak boleh mengirim pesan otomatis saat masuk grup, reconnect, atau menerima pesan biasa tanpa command, kecuali fitur otomatis sudah diaktifkan admin.

## 2. Tujuan Utama

1. Membuat WhatsApp bot multifungsi untuk stiker, media tools, game, dan grup.
2. Menyediakan sistem command yang rapi dan mudah dikembangkan.
3. Memastikan fitur grup tidak mengganggu karena semua fitur moderasi default nonaktif.
4. Memperbaiki bug runtime Baileys agar bot stabil saat mengirim pesan, stiker, gambar, dan video.
5. Menambahkan fitur lanjutan secara bertahap sesuai prioritas.
6. Menjadikan bot siap dipakai untuk grup, chat pribadi, dan pengembangan premium.

## 3. Prinsip Wajib

### 3.1 Silent by Default

Bot tidak boleh langsung mengirim pesan saat:

```text
- Bot baru dimasukkan ke grup
- Bot baru reconnect
- Bot baru dinyalakan
- Ada member baru masuk grup
- Ada member keluar grup
- Ada pesan biasa tanpa command
- Ada link/media masuk, kecuali fitur moderasi terkait aktif
```

Bot hanya boleh membalas jika:

```text
- User mengirim command valid
- Admin mengaktifkan fitur tertentu
- Fitur otomatis sudah aktif
- Bot sedang melanjutkan proses dari command sebelumnya
```

### 3.2 Default Fitur Grup

```text
silentOnJoin: true
respondOnlyToCommand: true

stickerEnabled: true
bratEnabled: true
toImageEnabled: true
hdEnabled: true
werewolfEnabled: true

downloaderEnabled: false
welcomeEnabled: false
goodbyeEnabled: false
antilinkEnabled: false
antispamEnabled: false
antitoxicEnabled: false
badwordEnabled: false
warningEnabled: false
automuteEnabled: false
blacklistEnabled: false
levelingEnabled: false
economyEnabled: false
confessEnabled: false
menfessEnabled: false
autoreplyEnabled: false
pollEnabled: false
attendanceEnabled: false
reminderEnabled: false
```

### 3.3 Permission

Role:

```text
USER
PREMIUM
GROUP_ADMIN
OWNER
```

Aturan:

```text
USER:
- Fitur dasar
- Stiker biasa
- Brat
- To image
- Game basic
- QR basic

PREMIUM:
- AI tools
- HD lanjutan
- Remove background batch
- Video sticker
- Downloader jika diaktifkan
- PDF/file besar
- Transkrip audio panjang

GROUP_ADMIN:
- Setup grup
- Toggle fitur
- Moderasi
- Welcome/goodbye
- Warning
- Anti-link
- Anti-spam
- Auto reply
- Polling
- Absensi

OWNER:
- Broadcast
- Maintenance
- Premium management
- Global stats
- Plugin system
- API key system
- Dashboard
```

## 4. Bug Fix Wajib Sebelum Tambah Fitur

### 4.1 Fix Baileys Import

Masalah:

```text
TypeError: import_baileys.default.default is not a function
```

Perbaikan:

```ts
// Salah
this.sock = makeWASocket.default({ ... });

// Benar
this.sock = makeWASocket({ ... });
```

### 4.2 Fix Crash Saat Kirim Stiker/Pesan

Masalah:

```text
TypeError: Cannot read properties of undefined (reading 'undefined')
at generateWAMessageFromContent
```

Penyebab:
Adapter membuat object `quoted` palsu/minimal dari `quotedMessageId`.

Perbaikan minimal:

```ts
public async sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<void> {
  const mentions = options?.mentions || [];
  await this.sock.sendMessage(chatId, { text, mentions });
}

public async sendSticker(chatId: string, stickerBuffer: Buffer, options?: SendMessageOptions): Promise<void> {
  await this.sock.sendMessage(chatId, { sticker: stickerBuffer });
}

public async sendImage(chatId: string, imageBuffer: Buffer, caption?: string, options?: SendMessageOptions): Promise<void> {
  await this.sock.sendMessage(chatId, { image: imageBuffer, caption });
}

public async sendVideo(chatId: string, videoBuffer: Buffer, caption?: string, options?: SendMessageOptions): Promise<void> {
  await this.sock.sendMessage(chatId, { video: videoBuffer, caption });
}
```

Catatan:
Sistem quote/reply asli boleh dibuat nanti dengan menyimpan raw `WAMessage` atau `WAMessageKey` lengkap.

### 4.3 Tambahkan `deleteMessage`

```ts
public async deleteMessage(chatId: string, messageId: string, senderId?: string): Promise<void> {
  await this.sock.sendMessage(chatId, {
    delete: {
      remoteJid: chatId,
      id: messageId,
      participant: senderId,
      fromMe: false
    }
  });
}
```

### 4.4 Gabungkan Command `/feature`

Masalah:
Ada dua handler `/feature`.

Solusi:
Gunakan satu command `/feature` yang mendukung semua flag:

```text
/feature sticker on/off
/feature hd on/off
/feature downloader on/off
/feature werewolf on/off
/feature welcome on/off
/feature goodbye on/off
/feature antilink on/off
/feature antispam on/off
/feature antitoxic on/off
/feature badword on/off
/feature warning on/off
/feature leveling on/off
/feature economy on/off
/feature confess on/off
/feature menfess on/off
/feature autoreply on/off
/feature poll on/off
/feature attendance on/off
/feature reminder on/off
```

### 4.5 Downloader Default Nonaktif

```text
downloaderEnabled: false
```

Downloader hanya aktif jika admin/owner mengaktifkan.

### 4.6 Premium Enforcement

Fitur berikut harus cek premium jika diperlukan:

```text
/hd
/tt
/ig
/avatar
/bg
/removebg batch
/vstiker
/subtitle
/transkrip panjang
/pdf tools besar
```

### 4.7 Validasi URL Downloader

Jangan pakai:

```ts
host.includes('instagram.com')
```

Gunakan exact hostname atau subdomain resmi:

```ts
host === 'instagram.com' || host.endsWith('.instagram.com')
host === 'tiktok.com' || host.endsWith('.tiktok.com')
```

Tolak:

```text
instagram.com.evil.com
evil-tiktok.com
localhost
127.0.0.1
private IP
```

## 5. Fitur Inti yang Harus Ada

### 5.1 Sticker Basic

Command:

```text
/stiker
/s
```

Fungsi:
Mengubah gambar menjadi stiker WebP 512x512.

### 5.2 Sticker + Teks

Command:

```text
/s <teks>
/stikerteks <teks>
```

Support posisi:

```text
/s atas:teks
/s tengah:teks
/s bawah:teks
```

### 5.3 Sticker to Image

Command:

```text
/toimg
```

Fungsi:
Mengubah stiker WebP menjadi PNG.

### 5.4 HD Image

Command:

```text
/hd
/hd 2x
/hd 4x
```

Fungsi:
Upscale, sharpen, dan enhance gambar.

### 5.5 Downloader TikTok/Instagram

Command:

```text
/tt <url>
/tiktok <url>
/ig <url>
/instagram <url>
```

Aturan:
Downloader hanya untuk konten milik sendiri, berizin, atau konten publik yang legal diunduh. Tidak mendukung akun privat, login, bypass DRM, atau pelanggaran hak cipta.

### 5.6 Werewolf

Command:

```text
/ww create
/ww join
/ww leave
/ww start
/ww status
/ww stop
/ww vote @user
/ww kill @user
/ww protect @user
/ww check @user
/ww help
```

Pemain:

```text
minimal: 5
maksimal: 10
```

Role:

```text
Werewolf
Seer
Doctor
Hunter
Villager
```

### 5.7 Menu dan Setup

Command:

```text
/menu
/help
/rules
/setup
/statusfitur
/feature <fitur> on/off
```

## 6. Perbaikan Final Brat Sticker

### 6.1 Masalah

Fitur `/brat` belum sempurna. Hasilnya masih terlalu rapi dan belum mirip style referensi.

### 6.2 Command

```text
/brat <teks>
/brat classic <teks>
```

### 6.3 Style Wajib

```text
background: putih polos
teks: hitam
case: lowercase
font: sans-serif besar
layout: kata tersebar grid/random
word spacing: lebar
blur: ringan
look: low-quality/compressed
output: WebP sticker 512x512
```

### 6.4 Mode Default — Brat Grid

Contoh input:

```text
/brat brat and it's the same but there's three more songs so it's not
```

Contoh layout:

```text
brat     and     it's
the      same    but
there's          three
more             songs
so       it's    not
```

### 6.5 Mode Classic

Command:

```text
/brat classic aku lagi brat
```

Mode classic memakai teks tengah seperti paragraf, tetapi tetap background putih, teks hitam, lowercase, dan blur ringan.

### 6.6 Algoritma

```text
1. Ambil teks dari args.
2. Ubah menjadi lowercase.
3. Hapus spasi berlebih.
4. Split menjadi kata.
5. Tentukan font size otomatis:
   - 1-3 kata: 86-110 px
   - 4-8 kata: 70-86 px
   - 9-16 kata: 56-72 px
   - 17-30 kata: 42-58 px
6. Susun kata dalam grid 2-3 kolom.
7. Tambahkan random offset kecil:
   - x: -8 sampai +8 px
   - y: -5 sampai +5 px
8. Tambahkan blur 0.4-1.2 px.
9. Export WebP 512x512.
10. Kompres jika lebih dari 100 KB.
```

### 6.7 Acceptance Criteria Brat

```text
- /brat halo dunia menghasilkan stiker brat.
- /brat teks panjang menghasilkan layout grid/random.
- Teks otomatis lowercase.
- Background selalu putih.
- Teks selalu hitam.
- Ada blur ringan.
- Output tidak berbentuk paragraf biasa.
- Output tetap terbaca.
- Output WebP 512x512.
- Tidak crash saat teks mengandung apostrophe.
```

## 7. Fitur Sticker Lanjutan

### 7.1 Remove Background

Command:

```text
/removebg
/rbg
```

Output:
PNG transparan.

### 7.2 Nobg Sticker

Command:

```text
/stikerbg
/nobgstick
```

Flow:

```text
gambar -> remove background -> WebP sticker
```

### 7.3 Outline Sticker

Command:

```text
/outline
/outline white
/outline black
```

Flow:

```text
gambar -> remove background -> outline -> sticker
```

### 7.4 Circle Sticker

Command:

```text
/circle
/bulat
```

Fungsi:
Crop gambar menjadi lingkaran dan kirim sebagai stiker.

### 7.5 Meme Generator

Command:

```text
/meme teks atas | teks bawah
```

### 7.6 Quote Sticker

Command:

```text
/quote <teks>
```

### 7.7 Emoji Mix

Command:

```text
/emojimix 😂 + 😭
/mix 😂 😭
```

### 7.8 Video Sticker

Command:

```text
/vstiker
/gifstiker
```

Batas:

```text
free: 5 detik
premium: 10 detik
```

### 7.9 Batch Sticker

Command:

```text
/batchstiker
/pack
```

Batas:

```text
free: 5 gambar
premium: 30 gambar
```

## 8. Media Tools

### 8.1 Compress

```text
/compress
/kompres
/compress low
/compress medium
/compress high
```

### 8.2 Resize

```text
/resize 1080x1080
/resize story
/resize profile
```

Preset:

```text
story: 1080x1920
feed: 1080x1080
profile: 720x720
wallpaper: 1080x2400
```

### 8.3 Crop

```text
/crop square
/crop story
/crop pp
```

### 8.4 Watermark Sendiri

```text
/wm <teks>
```

Catatan:
Fitur ini menambahkan watermark milik user, bukan menghapus watermark orang lain.

### 8.5 Video to GIF

```text
/togif
```

### 8.6 Thumbnail Video

```text
/thumb
/thumb 00:00:05
```

### 8.7 Cut Video

```text
/cut 00:05-00:15
```

### 8.8 Subtitle Otomatis

```text
/subtitle
```

Premium only.

### 8.9 Mute Video

```text
/mute
```

### 8.10 Reverse Video

```text
/reverse
```

## 9. Audio Tools

### 9.1 Video to MP3

```text
/mp3
/audio
```

### 9.2 Voice Note to Text

```text
/transkrip
/vntext
```

### 9.3 Text to Speech

```text
/tts <teks>
```

### 9.4 Voice Effect

```text
/voice robot
/voice chipmunk
/voice deep
```

### 9.5 Cut Audio

```text
/cutaudio 00:10-00:30
```

### 9.6 Speed Audio

```text
/speed 1.5x
/slow 0.75x
```

## 10. Text, OCR, Translate, dan Study Tools

### 10.1 OCR

```text
/ocr
```

Fungsi:
Ekstrak teks dari gambar.

### 10.2 Translate

```text
/translate en
/translate id
/tr en
/tr id
```

Input bisa teks, reply teks, atau reply gambar via OCR.

### 10.3 Ringkas Teks

```text
/ringkas
/summarize
```

### 10.4 Ubah Gaya Bahasa

```text
/ubah formal
/ubah santai
/ubah sopan
/ubah lucu
/ubah singkat
```

### 10.5 Koreksi Typo

```text
/typo
/koreksi
```

### 10.6 AI Balas Chat

```text
/balas santai
/balas formal
/balas lucu
```

### 10.7 Study Tools

```text
/jelaskan <topik>
/rangkum <topik>
/quiz matematika
/belajar matematika
/belajar inggris
/belajar ipa
```

Aturan:
Bot membantu belajar, bukan mendorong plagiarisme atau kecurangan ujian.

## 11. File dan Dokumen

### 11.1 Image to PDF

```text
/img2pdf
```

### 11.2 PDF to Image

```text
/pdf2img
```

### 11.3 Merge PDF

```text
/mergepdf
```

### 11.4 Compress PDF

```text
/compresspdf
```

### 11.5 PDF to Word

```text
/pdf2word
```

### 11.6 Word to PDF

```text
/word2pdf
```

### 11.7 Scan Dokumen

```text
/scan
```

Fungsi:

```text
auto crop
perspective correction
contrast enhancement
output JPG/PDF
```

### 11.8 Extract ZIP/RAR

```text
/unzip
```

Aturan:

```text
jangan eksekusi file
tolak file executable
batasi ukuran archive
hanya extract file aman
```

### 11.9 QR

```text
/qr <teks/url>
/readqr
```

## 12. Group Moderation

Semua fitur di bagian ini default nonaktif.

### 12.1 Anti-link

```text
/feature antilink on
/allowlink <domain>
/dellink <domain>
/listlink
```

### 12.2 Warning System

```text
/warn @user <alasan>
/warnings @user
/unwarn @user
/clearwarn @user
```

Default batas warning:

```text
3 warning
```

### 12.3 Badword Filter

```text
/filter on
/filter off
/addbadword <kata>
/delbadword <kata>
/listbadword
```

### 12.4 Anti-toxic

```text
/antitoxic on
/antitoxic off
```

### 12.5 Anti-spam

```text
/antispam on
/antispam off
```

Rule default:

```text
lebih dari 5 pesan dalam 10 detik
```

### 12.6 Auto Mute

```text
/automute on
/automute off
```

Jika mute WhatsApp tidak didukung, bot menggunakan mode ignore sementara.

### 12.7 Blacklist

```text
/blacklist @user
/unblacklist @user
/listblacklist
```

## 13. Community Tools

### 13.1 Auto Reply

```text
/addreply <trigger> = <response>
/delreply <trigger>
/listreply
```

### 13.2 Polling

```text
/poll Pertanyaan | opsi1 | opsi2 | opsi3
/vote <opsi>
/pollresult
/closepoll
```

### 13.3 Confess Anonim

```text
/confess <pesan>
```

Default nonaktif.

### 13.4 Menfess

```text
/menfess @user <pesan>
```

Default nonaktif.

### 13.5 Reminder

```text
/remind 20:00 jangan lupa belajar
/remind 10m minum air
/listremind
/delremind <id>
```

### 13.6 Event Grup

```text
/event futsal Jumat 19:00
/listevent
/delevent <id>
```

### 13.7 Absensi

```text
/absen buka
/absen
/absen list
/absen tutup
```

## 14. Game Tambahan

### 14.1 Truth or Dare

```text
/tod
/truth
/dare
```

### 14.2 Tebak Kata

```text
/tebakkata
/jawab <jawaban>
```

### 14.3 Tebak Gambar

```text
/tebakgambar
/jawab <jawaban>
```

### 14.4 Suit PvP

```text
/suit @user
/pilih batu
/pilih gunting
/pilih kertas
```

### 14.5 Tic Tac Toe

```text
/ttt @user
/ttt move <posisi>
```

### 14.6 Slot

```text
/slot
```

Jika economy aktif, slot bisa memakai saldo virtual.

### 14.7 Math Game

```text
/math
/jawab <angka>
```

### 14.8 Quiz

```text
/quiz
/quiz umum
/quiz sekolah
/quiz anime
```

### 14.9 Family 100

```text
/family100
/jawab <jawaban>
```

### 14.10 Couple / Jodoh

```text
/couple
/jodoh
```

### 14.11 Tebak Lagu

```text
/tebaklagu
```

MVP menggunakan clue teks agar aman dari hak cipta.

### 14.12 Werewolf Stats

```text
/wwrank
/wwstats
```

Data:

```text
total game
win
lose
role frequency
MVP optional
```

## 15. Economy dan RPG Lanjutan

### 15.1 Balance dan Daily

```text
/balance
/bal
/claim
/daily
/transfer @user <jumlah>
/top
/rank
```

### 15.2 Shop

```text
/shop
/buy <item>
```

Item awal:

```text
title
badge
lootbox
pet food
cosmetic role
```

### 15.3 Inventory

```text
/inventory
/inv
```

### 15.4 Title dan Badge

```text
/title set <nama>
/badge set <nama>
```

### 15.5 Pet System

```text
/pet adopt
/pet feed
/pet status
/pet rename <nama>
```

### 15.6 Pet Battle

```text
/pet battle @user
```

### 15.7 RPG Dungeon

```text
/dungeon
/attack
/heal
/run
```

## 16. Owner Tools

### 16.1 Broadcast

```text
/broadcast <pesan>
```

Wajib ada konfirmasi sebelum broadcast.

### 16.2 Maintenance

```text
/maintenance on
/maintenance off
```

### 16.3 Premium

```text
/premium add @user <hari>
/premium remove @user
```

### 16.4 Stats

```text
/stats
```

Data:

```text
total user
total grup
command hari ini
fitur paling sering dipakai
error terakhir
queue length
premium user aktif
```

### 16.5 Limit

```text
/limit
```

### 16.6 API Key

```text
/apikey
/revokeapikey
```

API key harus di-hash di database.

### 16.7 Plugin System

```text
/plugin list
/plugin on <name>
/plugin off <name>
```

Plugin metadata:

```text
name
commands
enabled
permission
category
```

### 16.8 Dashboard Admin

Fitur dashboard:

```text
login owner
lihat group list
lihat fitur aktif per grup
toggle fitur
lihat usage stats
lihat premium users
lihat warning log
lihat queue status
lihat error log
```

## 17. Database Final

### 17.1 GroupConfig

```text
id
groupId
prefix
botEnabled
featuresJson
welcomeMessage
goodbyeMessage
createdAt
updatedAt
```

### 17.2 UserProfile

```text
id
userId
language
isPremium
premiumUntil
createdAt
updatedAt
```

### 17.3 UsageLog

```text
id
userId
groupId
feature
command
success
createdAt
```

### 17.4 PremiumUser

```text
id
userId
expiresAt
createdAt
```

### 17.5 Warning

```text
id
groupId
userId
reason
warnedBy
createdAt
```

### 17.6 Badword

```text
id
groupId
word
createdBy
createdAt
```

### 17.7 Blacklist

```text
id
scope
groupId
userId
reason
createdBy
createdAt
```

### 17.8 AutoReply

```text
id
groupId
trigger
response
matchType
createdBy
createdAt
```

### 17.9 Poll

```text
id
groupId
question
optionsJson
votesJson
status
createdBy
createdAt
expiresAt
```

### 17.10 Reminder

```text
id
scope
groupId
userId
message
runAt
timezone
status
createdAt
```

### 17.11 AttendanceSession

```text
id
groupId
title
status
participantsJson
createdBy
createdAt
closedAt
```

### 17.12 GameSession

```text
id
groupId
gameType
status
playersJson
stateJson
createdAt
updatedAt
expiresAt
```

### 17.13 GameStats

```text
id
userId
groupId
gameType
wins
losses
points
metadataJson
updatedAt
```

### 17.14 UserEconomy

```text
id
userId
balance
xp
level
lastClaim
createdAt
updatedAt
```

### 17.15 ShopItem

```text
id
name
type
price
metadataJson
enabled
createdAt
```

### 17.16 UserInventory

```text
id
userId
itemId
quantity
metadataJson
createdAt
```

### 17.17 Pet

```text
id
userId
name
type
level
xp
hunger
metadataJson
updatedAt
```

### 17.18 ApiKey

```text
id
userId
keyHash
createdAt
revokedAt
```

### 17.19 ErrorLog

```text
id
scope
feature
message
stack
metadataJson
createdAt
```

## 18. Struktur Folder Final

```text
src/
  app.ts

  config/
    env.ts
    feature-flags.ts
    limits.ts

  bot/
    whatsapp.adapter.ts
    baileys.adapter.ts
    console.adapter.ts
    message.types.ts
    permission.ts

  commands/
    index.ts
    menu.command.ts
    setup.command.ts
    feature.command.ts
    admin.command.ts

    sticker/
      sticker.command.ts
      brat.command.ts
      removebg.command.ts
      outline.command.ts
      circle.command.ts
      meme.command.ts
      quote.command.ts
      emojimix.command.ts
      video-sticker.command.ts
      batch-sticker.command.ts

    media/
      hd.command.ts
      compress.command.ts
      resize.command.ts
      crop.command.ts
      watermark.command.ts
      gif.command.ts
      thumbnail.command.ts
      cut-video.command.ts
      subtitle.command.ts
      mute.command.ts
      reverse.command.ts

    audio/
      audio-extract.command.ts
      transcript.command.ts
      tts.command.ts
      voice-effect.command.ts
      cut-audio.command.ts
      speed-audio.command.ts

    text/
      ocr.command.ts
      translate.command.ts
      summarize.command.ts
      rewrite.command.ts
      typo.command.ts
      ai-reply.command.ts
      study.command.ts

    document/
      ssweb.command.ts
      qr.command.ts
      img2pdf.command.ts
      pdf2img.command.ts
      mergepdf.command.ts
      compresspdf.command.ts
      pdf2word.command.ts
      word2pdf.command.ts
      scan.command.ts
      unzip.command.ts

    moderation/
      warning.command.ts
      badword.command.ts
      antilink.command.ts
      antitoxic.command.ts
      antispam.command.ts
      automute.command.ts
      blacklist.command.ts

    community/
      autoreply.command.ts
      poll.command.ts
      confess.command.ts
      menfess.command.ts
      reminder.command.ts
      event.command.ts
      attendance.command.ts

    games/
      werewolf.command.ts
      werewolf-stats.command.ts
      tod.command.ts
      tebak-kata.command.ts
      tebak-gambar.command.ts
      suit.command.ts
      tictactoe.command.ts
      slot.command.ts
      math-game.command.ts
      quiz-game.command.ts
      family100.command.ts
      couple.command.ts
      tebak-lagu.command.ts

    economy/
      economy.command.ts
      shop.command.ts
      inventory.command.ts
      title.command.ts
      pet.command.ts
      dungeon.command.ts

    owner/
      owner.command.ts
      stats.command.ts
      limit.command.ts
      api-key.command.ts
      plugin.command.ts

  services/
    sticker/
    media/
    audio/
    text/
    document/
    downloader/
    moderation/
    community/
    games/
    economy/
    owner/

  queues/
    queue.ts
    workers/
      media.worker.ts
      audio.worker.ts
      document.worker.ts
      ai.worker.ts
      downloader.worker.ts
      game.worker.ts

  validators/
    media.validator.ts
    url.validator.ts
    permission.validator.ts

  scheduler/
    reminder.scheduler.ts
    cleanup.scheduler.ts

  db/
    client.ts
    schema.prisma

  utils/
    file.util.ts
    rate-limit.util.ts
    logger.ts
    security.util.ts

  tests/
```

## 19. Rate Limit Final

```text
sticker: 10/user/menit
brat: 10/user/menit
removebg: 5/user/10 menit
hd: 3/user/10 menit
downloader: 5/user/10 menit
media tools: 5/user/10 menit
audio tools: 5/user/10 menit
document tools: 5/user/10 menit
ai tools: 3/user/hari free, 50/user/hari premium
group command: 30/grup/menit
game command: 40/grup/menit
economy command: 20/user/menit
confess: 3/user/jam
menfess: 3/user/jam
broadcast: 1/owner/10 menit
```

Opsional:
Chat pribadi owner tidak terkena limit untuk testing.

## 20. Queue Requirement

Fitur berat wajib masuk queue:

```text
removebg
batch sticker
video sticker
compress video
cut video
subtitle
transkrip audio
tts
pdf tools
scan document
unzip
AI tools
downloader
```

MVP boleh pakai memory queue, tetapi production harus mendukung BullMQ + Redis.

## 21. File Retention

```text
media input: hapus maksimal 15 menit
hasil proses: hapus maksimal 15 menit
temp downloader: hapus setelah dikirim
temp PDF/audio/video: hapus setelah dikirim
log teknis: maksimal 30 hari
```

Tidak boleh menyimpan permanen:

```text
foto pribadi
video pribadi
voice note
dokumen user
isi chat pribadi
hasil download media sosial
```

## 22. Security Requirement

1. Validasi MIME type.
2. Validasi ukuran file.
3. Validasi durasi audio/video.
4. Validasi URL exact hostname.
5. Blokir localhost dan private IP untuk screenshot.
6. Jangan eksekusi file hasil unzip.
7. Jangan meminta login TikTok/Instagram.
8. Jangan bypass akun privat.
9. Jangan hardcode secret.
10. Jangan log token/cookies.
11. Jangan kirim pesan saat join grup.
12. Jangan aktifkan moderasi otomatis tanpa admin.
13. Downloader hanya untuk konten milik sendiri, berizin, atau legal diunduh.
14. Bot harus tetap berjalan walaupun satu fitur gagal.

## 23. Testing Requirement

Wajib test:

```text
command parser
silent on join
feature toggle
permission owner/admin/premium/user
rate limiter
Baileys adapter sendMessage/sendSticker
brat output 512x512
sticker conversion
media validator
URL validator
downloader invalid URL
warning system
badword filter
polling
economy transfer
Werewolf win condition
queue retry
file cleanup
```

## 24. Phase Implementasi

### Phase 0 — Stabilization

```text
1. Fix makeWASocket import
2. Fix sendMessage/sendSticker crash
3. Tambah deleteMessage
4. Gabungkan /feature
5. Downloader default off
6. Premium enforcement
7. URL validation
8. Rate limit private/owner policy
9. Test compile
```

### Phase 1 — Brat dan Sticker Lanjutan

```text
1. Brat grid style final
2. Remove background
3. Stikerbg
4. Outline
5. Circle
6. Meme
7. Quote
8. Emoji mix
9. Batch sticker
10. Video sticker
```

### Phase 2 — Media, Audio, Text, File

```text
1. Compress
2. Resize
3. Crop
4. Watermark
5. Video to GIF
6. MP3
7. Transkrip
8. TTS
9. OCR
10. Translate
11. Ringkas
12. Img2PDF
13. PDF2Img
14. Scan
```

### Phase 3 — Moderasi dan Community

```text
1. Warning
2. Badword
3. Anti-spam
4. Anti-toxic
5. Blacklist
6. Auto reply
7. Poll
8. Confess
9. Menfess
10. Reminder
11. Event
12. Absensi
```

### Phase 4 — Games dan Economy Lanjutan

```text
1. TOD
2. Tebak kata
3. Tebak gambar
4. Suit PvP
5. Tic Tac Toe
6. Slot
7. Quiz
8. Family 100
9. Werewolf stats
10. Shop
11. Inventory
12. Pet
13. Dungeon
```

### Phase 5 — Owner dan Production

```text
1. Stats
2. Limit
3. API key
4. Plugin system
5. Dashboard
6. BullMQ Redis
7. Error logging
8. CI testing
9. README final
```

## 25. Acceptance Criteria Global

Produk dianggap selesai jika:

```text
1. Bot tidak mengirim pesan saat masuk grup.
2. Bot hanya membalas command valid.
3. Semua fitur grup default nonaktif.
4. Admin bisa mengaktifkan fitur via /feature.
5. /feature tidak bentrok.
6. Baileys mode tidak crash saat startup.
7. Bot bisa mengirim teks, stiker, gambar, dan video.
8. /brat menghasilkan style mirip referensi.
9. Stiker dasar, stiker teks, toimg, HD, downloader, dan Werewolf berjalan.
10. Semua fitur berat masuk queue.
11. Semua file sementara dihapus.
12. Semua media divalidasi.
13. Downloader aman dan default nonaktif.
14. Permission owner/admin/premium/user berjalan.
15. Semua error ditangani tanpa crash.
16. README hanya mencantumkan fitur yang benar-benar ada.
17. Test utama lolos.
```

## 26. Definition of Done

MVP final dianggap selesai jika:

```text
- npm install berhasil
- npx prisma db push berhasil
- npm run dev berhasil
- ADAPTER_MODE=console bisa test command
- ADAPTER_MODE=baileys bisa QR/connect
- /menu berjalan
- /setup berjalan
- /feature berjalan
- /s berjalan
- /brat berjalan sesuai style final
- /toimg berjalan
- /hd berjalan
- /ww basic berjalan
- /tt dan /ig hanya berjalan jika downloader aktif
- bot tidak spam saat masuk grup
- tidak ada crash saat command gagal
```

## 27. Prompt Final untuk Codex

Implementasikan dan perbaiki Javas Bot WA berdasarkan PRD final ini.

Prioritas wajib:

1. Fix Baileys startup error: gunakan `makeWASocket(...)`, bukan `makeWASocket.default(...)`.
2. Fix crash `generateWAMessageFromContent` dengan menghapus quoted object palsu dari `sendMessage`, `sendSticker`, `sendImage`, dan `sendVideo`.
3. Tambahkan `deleteMessage` di `BaileysAdapter`.
4. Gabungkan semua logic `/feature` ke satu command agar tidak bentrok.
5. Ubah downloader default menjadi nonaktif.
6. Tambahkan premium enforcement untuk fitur berat.
7. Perketat URL validator downloader.
8. Pastikan bot silent saat join grup.
9. Jangan kirim pesan otomatis tanpa command.
10. Perbaiki `/brat` agar style-nya mirip referensi: background putih, teks hitam lowercase, layout grid/random, jarak kata lebar, blur ringan, WebP 512x512.
11. Implementasikan fitur baru secara bertahap sesuai phase.
12. Tambahkan test untuk bug fix, brat, feature toggle, permission, dan media validator.
13. Update README hanya untuk fitur yang sudah benar-benar tersedia.

Jangan:

* Jangan mengaktifkan fitur grup secara otomatis.
* Jangan bypass login atau akun privat.
* Jangan hardcode token.
* Jangan simpan media user permanen.
* Jangan mengklaim fitur AI jika hanya filter Sharp biasa.
* Jangan membuat command duplicate.
