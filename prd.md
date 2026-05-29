# PRD Addendum — Semua Fitur Tambahan WhatsApp Bot

## 1. Ringkasan

Dokumen ini adalah addendum PRD untuk WhatsApp Bot yang sebelumnya sudah memiliki fitur inti:

* Membuat stiker dari gambar
* Membuat stiker plus teks dari gambar
* Konversi stiker ke gambar
* HD image enhancement
* Downloader TikTok/Instagram sesuai batasan legal
* Game Werewolf
* Stiker brat background putih

Addendum ini menambahkan fitur lanjutan untuk membuat bot menjadi lebih lengkap, menarik untuk grup, dan siap dikembangkan menjadi bot premium.

## 2. Prinsip Utama Bot

### 2.1 Silent by Default

Bot **tidak boleh langsung mengirim pesan apa pun** saat:

1. Bot baru dimasukkan ke grup.
2. Bot baru aktif di server.
3. Ada member baru masuk grup.
4. Ada member keluar grup.
5. Ada pesan biasa tanpa command.
6. Ada link/media masuk, kecuali fitur moderasi terkait sudah diaktifkan admin.

Bot hanya boleh membalas jika:

1. User mengirim command valid.
2. Admin mengaktifkan fitur tertentu.
3. Fitur grup yang sudah aktif memang membutuhkan respons otomatis.
4. Bot sedang menjalankan proses lanjutan dari command sebelumnya.

### 2.2 Aturan Join Grup

Saat bot ditambahkan ke grup:

```text
Bot masuk grup:
- Tidak kirim pesan otomatis.
- Tidak kirim menu otomatis.
- Tidak menyapa admin.
- Tidak mengaktifkan welcome otomatis.
- Tidak mengaktifkan anti-link otomatis.
- Tidak scan chat secara agresif.
- Hanya standby menunggu command.
```

Command pertama yang dapat dipakai admin:

```text
/setup
/menu
/help
```

### 2.3 Default Feature State

```text
silentOnJoin: true
respondOnlyToCommand: true

menuEnabled: true
helpEnabled: true

stickerToolsEnabled: true
mediaToolsEnabled: true
aiToolsEnabled: false
groupToolsEnabled: false
moderationToolsEnabled: false
gameToolsEnabled: true
economyToolsEnabled: false
rpgToolsEnabled: false
ownerToolsEnabled: true
premiumToolsEnabled: false

welcomeEnabled: false
goodbyeEnabled: false
antilinkEnabled: false
antispamEnabled: false
antitoxicEnabled: false
badwordFilterEnabled: false
automuteEnabled: false
autoDeleteCommandEnabled: false
levelingEnabled: false
economyEnabled: false
confessEnabled: false
menfessEnabled: false
```

## 3. Tujuan Addendum

1. Menambahkan fitur tambahan secara modular.
2. Menjaga bot tetap aman, tidak spam, dan tidak mengganggu grup.
3. Memberikan admin kontrol penuh terhadap fitur grup.
4. Memisahkan fitur gratis, fitur berat, fitur premium, dan fitur owner.
5. Memastikan semua fitur bisa diaktifkan/nonaktifkan lewat konfigurasi.
6. Menyediakan daftar command yang konsisten dan mudah dikembangkan oleh Antigravity.

## 4. Role Pengguna

### 4.1 User Biasa

Dapat memakai fitur umum seperti stiker, media tools, game, AI ringan, dan file tools sesuai limit.

### 4.2 Admin Grup

Dapat mengaktifkan atau menonaktifkan fitur grup, moderasi, welcome, leveling, warning, economy, dan game.

### 4.3 Owner Bot

Dapat mengatur semua grup, broadcast, maintenance mode, statistik global, plugin, paket premium, dan limit.

### 4.4 Premium User

Dapat memakai fitur berat seperti AI image, HD lanjutan, remove background massal, video sticker, subtitle otomatis, dan file processing besar.

## 5. Command Setup

### 5.1 Setup Grup

```text
/setup
```

Fungsi:

* Menampilkan status fitur grup.
* Menampilkan command aktivasi fitur.
* Hanya membalas setelah admin mengetik `/setup`.

Contoh respons:

```text
Setup Bot Grup

Fitur dasar:
- Menu: aktif
- Sticker tools: aktif
- Media tools: aktif
- Game tools: aktif

Fitur grup:
- Welcome: nonaktif
- Goodbye: nonaktif
- Anti-link: nonaktif
- Anti-spam: nonaktif
- Leveling: nonaktif
- Economy: nonaktif
- Confess: nonaktif
- Warning: nonaktif

Aktifkan dengan:
/feature welcome on
/feature antilink on
/feature leveling on
```

### 5.2 Feature Toggle

```text
/feature <nama_fitur> on
/feature <nama_fitur> off
```

Contoh:

```text
/feature welcome on
/feature antilink on
/feature economy off
```

### 5.3 Cek Status Fitur

```text
/statusfitur
/features
```

## 6. Kategori Fitur Tambahan

Semua fitur tambahan dibagi menjadi:

1. Menu dan UX Bot
2. Sticker Tools Tambahan
3. AI Image Tools
4. Editing Media
5. Teks, Bahasa, dan Belajar
6. File dan Dokumen
7. Grup dan Komunitas
8. Game Tambahan
9. Economy dan RPG
10. Owner, Admin, dan Monetisasi

---

# 7. Fitur Menu dan UX Bot

## 7.1 Menu Interaktif Tombol/List

### Command

```text
/menu
```

### Deskripsi

Bot menampilkan menu kategori fitur. Bot tidak boleh menampilkan menu otomatis saat masuk grup.

### Kategori Menu

```text
1. Sticker Tools
2. AI Tools
3. Media Tools
4. File Tools
5. Group Tools
6. Game Tools
7. Economy Tools
8. Admin Tools
9. Owner Tools
```

### Acceptance Criteria

* Bot hanya mengirim menu saat user mengetik `/menu`.
* Menu tidak dikirim saat bot baru masuk grup.
* Menu menampilkan fitur sesuai permission user.

## 7.2 Form Menu Pakai WhatsApp Flow

### Command

```text
/flowmenu
```

### Deskripsi

Menu interaktif berbasis form untuk memilih fitur.

### Requirement

* Fitur ini opsional.
* Jika WhatsApp Flow tidak tersedia, fallback ke menu teks.
* Tidak boleh muncul otomatis.

## 7.3 Preset Stiker

### Command

```text
/preset
```

### Preset

```text
meme
chibi
bulat
glow
hitamputih
blur
pixel
brat
quote
reaction
```

## 7.4 Mode Bahasa

### Command

```text
/lang id
/lang en
```

### Deskripsi

Mengubah bahasa respons bot per user atau per grup.

## 7.5 Riwayat Hasil Terakhir

### Command

```text
/ulang
/last
```

### Deskripsi

Bot mengirim ulang hasil proses terakhir milik user.

### Requirement

* Hanya menyimpan metadata sementara.
* File maksimal disimpan 15 menit.
* Tidak menyimpan media permanen.

## 7.6 Auto-delete Command

### Command

```text
/feature cleancmd on
/feature cleancmd off
```

### Deskripsi

Menghapus pesan command setelah bot membalas jika bot memiliki izin.

### Default

```text
autoDeleteCommandEnabled: false
```

## 7.7 Menu Kategori Fitur

### Command

```text
/menu sticker
/menu ai
/menu media
/menu group
/menu game
/menu admin
```

---

# 8. Sticker Tools Tambahan

## 8.1 Sticker Pack Metadata

### Command

```text
/stiker pack:<nama_pack> author:<nama_author>
```

### Deskripsi

Menambahkan pack name dan author pada stiker.

### Default

```text
pack: "Bot Sticker"
author: "WhatsApp Bot"
```

## 8.2 Remove Background

### Command

```text
/removebg
/rbg
```

### Deskripsi

Menghapus background gambar dan mengirim hasil PNG transparan.

## 8.3 Remove Background + Jadi Stiker

### Command

```text
/stikerbg
/nobgstick
```

### Flow

Gambar → hapus background → resize → WebP sticker.

## 8.4 Stiker Nobg + Outline

### Command

```text
/outline
/outline white
/outline black
```

### Deskripsi

Menghapus background, menambahkan outline, lalu membuat stiker.

## 8.5 Stiker Wajah Otomatis

### Command

```text
/facesticker
```

### Deskripsi

Bot mendeteksi wajah, crop wajah, hapus background, tambah outline, lalu kirim stiker.

## 8.6 Stiker Bulat

### Command

```text
/circle
```

### Deskripsi

Gambar dipotong menjadi lingkaran lalu dikirim sebagai stiker.

## 8.7 Stiker Border

### Command

```text
/border
/border white
/border black
```

### Deskripsi

Menambahkan border ke stiker.

## 8.8 Stiker Reaction Cepat

### Command

```text
/react <jenis>
```

### Jenis Reaction

```text
ngakak
kaget
sedih
marah
bingung
santai
kecewa
mantap
```

## 8.9 Stiker Quote

### Command

```text
/quote <teks>
```

### Deskripsi

Membuat stiker teks quote aesthetic.

## 8.10 Emoji Mix Sticker

### Command

```text
/emojimix 😂 + 😭
```

### Deskripsi

Menggabungkan dua emoji menjadi satu stiker.

## 8.11 Meme Generator

### Command

```text
/meme teks atas | teks bawah
```

### Deskripsi

User reply gambar, bot menambahkan teks atas dan bawah.

## 8.12 Video Pendek Jadi Stiker Animasi/GIF

### Command

```text
/gifstiker
/vstiker
```

### Requirement

* Maksimal durasi: 6 detik.
* Input: video pendek atau GIF.
* Output: stiker animasi jika didukung.
* Jika tidak didukung, fallback ke GIF.

## 8.13 Sticker Style Pack

### Command

```text
/packstyle
```

### Output

Dari satu gambar, bot membuat beberapa varian:

```text
original
outline
meme
blur
brat
circle
```

## 8.14 Batch Sticker

### Command

```text
/batchstiker
/pack
```

### Deskripsi

Membuat banyak stiker dari beberapa gambar.

### Requirement

* Maksimal 10 gambar per batch untuk free user.
* Maksimal 30 gambar per batch untuk premium user.

## 8.15 AI Sticker dari Teks

### Command

```text
/aistiker <prompt>
```

### Deskripsi

Bot membuat gambar dari prompt lalu mengubahnya menjadi stiker.

## 8.16 Preset Gaya Stiker

### Command

```text
/preset <nama>
```

### Daftar Preset

```text
meme
chibi
bulat
glow
hitam putih
blur
pixel
brat
quote
reaction
```

---

# 9. AI Image Tools

## 9.1 AI Avatar

### Command

```text
/avatar anime
/avatar kartun
/avatar cyberpunk
/avatar 3d
```

### Deskripsi

User mengirim foto, bot membuat avatar dengan gaya tertentu.

## 9.2 AI Background Changer

### Command

```text
/bg <deskripsi_background>
```

### Contoh

```text
/bg pantai malam hari
/bg studio putih
/bg kantor mewah
```

## 9.3 AI Ubah Ekspresi Wajah

### Command

```text
/ekspresi senyum
/ekspresi marah
/ekspresi kaget
```

### Deskripsi

Mengubah ekspresi wajah pada foto.

## 9.4 AI Ganti Outfit

### Command

```text
/outfit jas
/outfit hoodie hitam
/outfit seragam anime
```

### Deskripsi

Mengganti pakaian pada foto.

## 9.5 AI Remove Object

### Command

```text
/removeobject <objek>
```

### Contoh

```text
/removeobject orang belakang
/removeobject tulisan
```

## 9.6 AI Expand Image

### Command

```text
/expand story
/expand square
/expand wallpaper
```

### Deskripsi

Memperluas area gambar sesuai rasio.

## 9.7 AI Colorize Foto Lama

### Command

```text
/colorize
```

### Deskripsi

Mengubah foto hitam-putih menjadi berwarna.

## 9.8 Ubah Gambar ke Anime/Cartoon/Sketch

### Command

```text
/anime
/cartoon
/sketch
```

## 9.9 AI Caption Gambar

### Command

```text
/caption
/caption lucu
/caption savage
/caption aesthetic
```

## 9.10 Caption Lucu/Savage/Aesthetic Otomatis

### Deskripsi

Varian dari fitur caption dengan tone tertentu.

---

# 10. Editing Media

## 10.1 Kompres Video/Gambar

### Command

```text
/compress
/kompres
/compress low
/compress medium
/compress high
```

## 10.2 Resize Gambar

### Command

```text
/resize 1080x1080
/resize story
/resize profile
```

## 10.3 Crop Otomatis

### Command

```text
/crop square
/crop story
/crop pp
```

## 10.4 Watermark Nama Sendiri

### Command

```text
/wm <teks>
```

### Contoh

```text
/wm @javas
```

### Catatan

Fitur ini menambahkan watermark milik user, bukan menghapus watermark pihak lain.

## 10.5 Video to GIF

### Command

```text
/togif
```

## 10.6 Ambil Thumbnail Video

### Command

```text
/thumb
```

## 10.7 Potong Video

### Command

```text
/cut 00:05-00:15
```

## 10.8 Tambah Subtitle Otomatis

### Command

```text
/subtitle
```

## 10.9 Video Jadi Quote Clip

### Command

```text
/quotevideo <teks>
```

## 10.10 Video Mute

### Command

```text
/mute
```

## 10.11 Video Reverse

### Command

```text
/reverse
```

## 10.12 Audio Extractor / Video ke MP3

### Command

```text
/mp3
/audio
```

## 10.13 Voice Note ke Teks

### Command

```text
/transkrip
```

## 10.14 Teks ke Voice Note

### Command

```text
/tts <teks>
```

## 10.15 Ubah Suara

### Command

```text
/voice robot
/voice chipmunk
/voice deep
```

## 10.16 Potong Audio

### Command

```text
/cutaudio 00:10-00:30
```

## 10.17 Speed Audio

### Command

```text
/speed 1.5x
/slow 0.75x
```

---

# 11. Teks, Bahasa, dan Belajar

## 11.1 OCR Gambar ke Teks

### Command

```text
/ocr
```

### Deskripsi

User reply gambar/screenshot, bot mengekstrak teks.

## 11.2 Translate Teks/Gambar

### Command

```text
/translate en
/translate id
/tr en
/tr id
```

### Deskripsi

Menerjemahkan teks biasa atau hasil OCR.

## 11.3 Ringkas Teks Panjang

### Command

```text
/ringkas
```

### Deskripsi

User reply pesan panjang, bot meringkas isi pesan.

## 11.4 Ubah Gaya Bahasa

### Command

```text
/ubah formal
/ubah santai
/ubah sopan
/ubah lucu
/ubah singkat
```

## 11.5 Koreksi Typo

### Command

```text
/typo
```

## 11.6 AI Balas Chat

### Command

```text
/balas santai
/balas formal
/balas lucu
```

### Deskripsi

User reply pesan orang, bot membuat saran balasan.

## 11.7 Bikin Tugas Sekolah

### Command

```text
/tugas <topik>
```

### Deskripsi

Membantu membuat draft tugas, rangkuman, atau penjelasan.

## 11.8 Mode Belajar

### Command

```text
/belajar matematika
/belajar inggris
/belajar ipa
```

### Fitur

* Soal bertahap
* Skor
* Pembahasan
* Level mudah/sedang/sulit

## 11.9 Quiz Matematika

### Command

```text
/quiz matematika
```

## 11.10 Penjelasan Materi Pelajaran

### Command

```text
/jelaskan <topik>
```

## 11.11 Rangkuman Materi

### Command

```text
/rangkum <topik>
```

---

# 12. File dan Dokumen

## 12.1 Screenshot Website

### Command

```text
/ssweb <url>
```

## 12.2 PDF Tools

### Command Utama

```text
/pdf
```

## 12.3 Image to PDF

### Command

```text
/img2pdf
```

## 12.4 PDF to Image

### Command

```text
/pdf2img
```

## 12.5 Merge PDF

### Command

```text
/mergepdf
```

## 12.6 Compress PDF

### Command

```text
/compresspdf
```

## 12.7 PDF to Word

### Command

```text
/pdf2word
```

## 12.8 Word to PDF

### Command

```text
/word2pdf
```

## 12.9 Scan Dokumen

### Command

```text
/scan
```

### Deskripsi

Foto kertas diubah menjadi hasil scan.

### Proses

* Crop dokumen otomatis
* Luruskan perspektif
* Tingkatkan kontras
* Output JPG/PDF

## 12.10 Extract ZIP/RAR Ringan

### Command

```text
/unzip
```

### Requirement

* Maksimal ukuran file harus dibatasi.
* Tidak boleh mengeksekusi file hasil extract.
* Hanya list dan kirim file aman.

## 12.11 QR Generator

### Command

```text
/qr <teks/url>
```

## 12.12 QR Reader

### Command

```text
/readqr
```

---

# 13. Grup dan Komunitas

Semua fitur grup default **nonaktif** dan hanya aktif setelah admin menjalankan command aktivasi.

## 13.1 Anti-link

### Command

```text
/feature antilink on
/feature antilink off
```

### Deskripsi

Mendeteksi link di grup.

### Default

```text
antilinkEnabled: false
```

## 13.2 Welcome Message

### Command

```text
/feature welcome on
/setwelcome <pesan>
```

### Default

```text
welcomeEnabled: false
```

## 13.3 Goodbye Message

### Command

```text
/feature goodbye on
/setgoodbye <pesan>
```

### Default

```text
goodbyeEnabled: false
```

## 13.4 Leveling dan XP

### Command

```text
/feature leveling on
/level
/rank
/top
```

### Deskripsi

User mendapat XP dari aktivitas chat.

### Catatan

Bot hanya mulai menghitung XP setelah fitur diaktifkan admin.

## 13.5 Leaderboard/Rank

### Command

```text
/top
/rank
/leaderboard
```

## 13.6 Polling dan Voting

### Command

```text
/poll Pertanyaan | opsi1 | opsi2 | opsi3
/vote <opsi>
```

## 13.7 Confess Anonim

### Command

```text
/confess <pesan>
```

### Deskripsi

User mengirim pesan anonim ke grup.

### Requirement

* Default nonaktif.
* Admin harus mengaktifkan.
* Ada rate limit ketat.
* Ada filter spam.

## 13.8 Menfess

### Command

```text
/menfess @user <pesan>
```

### Default

```text
menfessEnabled: false
```

## 13.9 Reminder Grup

### Command

```text
/remind 20:00 jangan lupa belajar
```

## 13.10 Event Grup

### Command

```text
/event futsal Jumat 19:00
```

## 13.11 Absensi Grup

### Command

```text
/absen buka
/absen
/absen list
/absen tutup
```

## 13.12 Auto Reply Grup

### Command

```text
/addreply harga = Cek pricelist di sini...
/delreply harga
/listreply
```

### Deskripsi

Bot membalas keyword tertentu.

### Default

```text
autoReplyEnabled: false
```

## 13.13 Warning System

### Command

```text
/warn @user <alasan>
/warnings @user
/unwarn @user
```

## 13.14 Auto Mute

### Command

```text
/feature automute on
```

## 13.15 Badword Filter

### Command

```text
/filter on
/addbadword <kata>
/delbadword <kata>
```

## 13.16 Anti-toxic

### Command

```text
/antitoxic on
/antitoxic off
```

## 13.17 Anti-spam Media

### Command

```text
/antispam on
/antispam off
```

## 13.18 Anti-virtex

### Command

```text
/antivirtex on
/antivirtex off
```

## 13.19 Blacklist User

### Command

```text
/blacklist @user
/unblacklist @user
```

---

# 14. Game Tambahan

## 14.1 Truth or Dare

### Command

```text
/tod
/truth
/dare
```

## 14.2 Tebak Gambar

### Command

```text
/tebakgambar
```

## 14.3 Tebak Kata

### Command

```text
/tebakkata
```

## 14.4 Suit

### Command

```text
/suit
```

## 14.5 Suit PvP

### Command

```text
/suit @user
```

## 14.6 Slot

### Command

```text
/slot
```

## 14.7 Math Game

### Command

```text
/math
```

## 14.8 Quiz

### Command

```text
/quiz
```

## 14.9 Family 100

### Command

```text
/family100
```

## 14.10 Tebak Member

### Command

```text
/tebakmember
```

## 14.11 Couple / Random Pair

### Command

```text
/couple
/jodoh
```

## 14.12 Daily Check-in

### Command

```text
/daily
```

## 14.13 Sistem Ekonomi Grup

### Command

```text
/balance
/claim
/transfer @user 100
/shop
```

## 14.14 Uno Sederhana

### Command

```text
/uno create
/uno join
/uno start
```

## 14.15 Tic Tac Toe

### Command

```text
/ttt @user
```

## 14.16 Tebak Lagu

### Command

```text
/tebaklagu
```

## 14.17 Werewolf Ranking

### Command

```text
/wwrank
```

## 14.18 Werewolf Stats

### Command

```text
/wwstats
```

---

# 15. Economy dan RPG

## 15.1 Balance

### Command

```text
/balance
/bal
```

## 15.2 Claim Harian

### Command

```text
/claim
/daily
```

## 15.3 Transfer Uang Virtual

### Command

```text
/transfer @user <jumlah>
```

## 15.4 Shop

### Command

```text
/shop
/buy <item>
```

## 15.5 Inventory User

### Command

```text
/inventory
/inv
```

## 15.6 Daily Reward

### Command

```text
/daily
```

## 15.7 Shop Title/Badge

### Command

```text
/shop title
/buy title sultan
/buy badge vip
```

## 15.8 Pet System

### Command

```text
/pet adopt
/pet feed
/pet status
```

## 15.9 Pet Battle

### Command

```text
/pet battle @user
```

## 15.10 RPG Dungeon

### Command

```text
/dungeon
/attack
/heal
/run
```

---

# 16. Owner, Admin, dan Monetisasi

## 16.1 Dashboard Admin Sederhana

### Deskripsi

Web dashboard untuk:

* Melihat statistik command
* Mengaktifkan/nonaktifkan fitur
* Mengatur rate limit
* Melihat error log
* Melihat grup aktif
* Melihat status worker

## 16.2 Sistem Premium

### Paket Free

```text
stiker
brat
toimg
basic game
basic group tools
```

### Paket Premium

```text
HD image
remove background
batch sticker
AI image tools
subtitle otomatis
file processing besar
video sticker
```

## 16.3 Broadcast Owner

### Command

```text
/broadcast <pesan>
```

### Requirement

* Hanya owner.
* Ada konfirmasi sebelum kirim.
* Ada rate limit.
* Tidak boleh spam.

## 16.4 Statistik Bot

### Command

```text
/stats
```

### Data

```text
total user
total grup
command hari ini
fitur paling sering dipakai
error terakhir
jumlah job queue
jumlah premium user
```

## 16.5 Maintenance Mode

### Command

```text
/maintenance on
/maintenance off
```

### Behavior

Jika aktif, hanya owner yang bisa memakai bot.

## 16.6 Plugin System

### Struktur

```text
plugins/
  sticker.plugin.ts
  media.plugin.ts
  ai.plugin.ts
  group.plugin.ts
  game.plugin.ts
  economy.plugin.ts
  owner.plugin.ts
```

### Requirement

* Plugin bisa di-enable/disable.
* Plugin punya metadata command.
* Plugin punya permission level.

## 16.7 API Key per User

### Command

```text
/apikey
```

### Deskripsi

Memberikan API key untuk user premium/developer.

## 16.8 Limit/Paket Penggunaan per User

### Command

```text
/limit
```

### Deskripsi

Menampilkan sisa limit user.

## 16.9 Admin Control Fitur per Grup

### Command

```text
/feature <fitur> on
/feature <fitur> off
```

## 16.10 Setting Cooldown Fitur

### Command

```text
/setcooldown <fitur> <detik>
```

---

# 17. Permission Matrix

| Fitur             |          User |  Admin Grup | Owner | Premium |
| ----------------- | ------------: | ----------: | ----: | ------: |
| Menu              |            Ya |          Ya |    Ya |      Ya |
| Sticker tools     |            Ya |          Ya |    Ya |      Ya |
| RemoveBG basic    |      Terbatas |          Ya |    Ya |      Ya |
| AI image tools    |         Tidak |       Tidak |    Ya |      Ya |
| Media tools basic |            Ya |          Ya |    Ya |      Ya |
| Media tools berat |         Tidak |       Tidak |    Ya |      Ya |
| File tools basic  |            Ya |          Ya |    Ya |      Ya |
| File tools berat  |         Tidak |       Tidak |    Ya |      Ya |
| Welcome/goodbye   |         Tidak |          Ya |    Ya |   Tidak |
| Moderasi grup     |         Tidak |          Ya |    Ya |   Tidak |
| Economy           | Ya jika aktif |          Ya |    Ya |      Ya |
| RPG               | Ya jika aktif |          Ya |    Ya |      Ya |
| Broadcast         |         Tidak |       Tidak |    Ya |   Tidak |
| Maintenance       |         Tidak |       Tidak |    Ya |   Tidak |
| Dashboard         |         Tidak | Ya terbatas |    Ya |   Tidak |

---

# 18. Rate Limit Default

```text
menu: 20/user/menit
sticker: 10/user/menit
removebg: 5/user/10 menit
ai_image: 3/user/hari untuk free, 50/user/hari untuk premium
media_edit: 5/user/10 menit
file_tools: 5/user/10 menit
voice_transcript: 5/user/10 menit
tts: 5/user/10 menit
group_command: 30/grup/menit
game_command: 40/grup/menit
economy_command: 20/user/menit
confess: 3/user/jam
menfess: 3/user/jam
broadcast: 1/owner/10 menit
```

---

# 19. Storage dan Retensi

## 19.1 File Sementara

```text
gambar input: hapus maksimal 15 menit
video input: hapus maksimal 15 menit
audio input: hapus maksimal 15 menit
file dokumen: hapus maksimal 15 menit
hasil proses: hapus maksimal 15 menit
```

## 19.2 Data yang Boleh Disimpan

```text
userId
groupId
feature setting
game state
economy balance
level XP
warning count
premium status
usage counter
error log teknis
```

## 19.3 Data yang Tidak Boleh Disimpan Permanen

```text
foto pribadi
video pribadi
voice note
dokumen user
isi chat pribadi
konten media sosial hasil download
```

---

# 20. Security Requirement

1. Bot wajib validasi MIME type file.
2. Bot wajib membatasi ukuran file.
3. Bot wajib menghapus file sementara.
4. Bot tidak boleh memproses file mencurigakan.
5. Bot tidak boleh mengeksekusi file hasil unzip.
6. Bot tidak boleh meminta password akun sosial media.
7. Bot tidak boleh memproses akun privat tanpa izin.
8. Bot tidak boleh melakukan spam otomatis.
9. Semua fitur grup default nonaktif.
10. Semua fitur yang memantau chat hanya aktif setelah admin mengaktifkan.
11. Bot tidak boleh mengirim pesan saat join grup.
12. Bot hanya boleh membalas command valid.
13. Bot harus memiliki rate limit.
14. Bot harus memiliki blacklist untuk abuse.
15. Bot harus memiliki maintenance mode.

---

# 21. Error Handling

Contoh pesan error:

```text
Command tidak dikenali. Ketik /menu untuk melihat fitur.
```

```text
Kirim atau reply media dulu untuk memakai fitur ini.
```

```text
File terlalu besar untuk diproses.
```

```text
Fitur ini belum aktif di grup. Admin bisa mengaktifkan dengan /feature <fitur> on.
```

```text
Kamu sudah mencapai limit. Coba lagi nanti.
```

```text
Fitur ini hanya untuk admin grup.
```

```text
Fitur ini hanya untuk premium user.
```

```text
Bot sedang maintenance. Coba lagi nanti.
```

---

# 22. Struktur Folder Rekomendasi

```text
src/
  app.ts

  config/
    env.ts
    feature-flags.ts
    limits.ts

  bot/
    whatsapp.adapter.ts
    message-router.ts
    command-parser.ts
    permission.ts

  commands/
    menu.command.ts
    setup.command.ts
    feature.command.ts

    sticker/
      sticker.command.ts
      removebg.command.ts
      outline.command.ts
      meme.command.ts
      quote.command.ts
      emojimix.command.ts
      batch-sticker.command.ts
      ai-sticker.command.ts

    ai/
      avatar.command.ts
      bg.command.ts
      expression.command.ts
      outfit.command.ts
      remove-object.command.ts
      expand.command.ts
      colorize.command.ts
      caption.command.ts

    media/
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
      audio.command.ts
      transcript.command.ts
      tts.command.ts
      voice-effect.command.ts

    text/
      ocr.command.ts
      translate.command.ts
      summarize.command.ts
      rewrite.command.ts
      typo.command.ts
      reply.command.ts
      study.command.ts
      quiz.command.ts

    file/
      screenshot-web.command.ts
      img2pdf.command.ts
      pdf2img.command.ts
      mergepdf.command.ts
      compresspdf.command.ts
      pdf2word.command.ts
      word2pdf.command.ts
      scan.command.ts
      unzip.command.ts
      qr.command.ts
      readqr.command.ts

    group/
      welcome.command.ts
      goodbye.command.ts
      antilink.command.ts
      leveling.command.ts
      poll.command.ts
      confess.command.ts
      menfess.command.ts
      reminder.command.ts
      event.command.ts
      attendance.command.ts
      autoreply.command.ts
      warning.command.ts
      automute.command.ts
      badword.command.ts
      antitoxic.command.ts
      antispam.command.ts
      antivirtex.command.ts
      blacklist.command.ts

    games/
      tod.command.ts
      tebak-gambar.command.ts
      tebak-kata.command.ts
      suit.command.ts
      slot.command.ts
      math.command.ts
      quiz-game.command.ts
      family100.command.ts
      tebak-member.command.ts
      couple.command.ts
      uno.command.ts
      tictactoe.command.ts
      tebak-lagu.command.ts
      werewolf-rank.command.ts

    economy/
      balance.command.ts
      claim.command.ts
      transfer.command.ts
      shop.command.ts
      inventory.command.ts
      pet.command.ts
      dungeon.command.ts

    owner/
      broadcast.command.ts
      stats.command.ts
      maintenance.command.ts
      plugin.command.ts
      premium.command.ts
      api-key.command.ts
      limit.command.ts

  services/
    media/
    sticker/
    ai/
    file/
    group/
    games/
    economy/
    moderation/
    owner/

  queues/
    queue.ts
    workers/
      media.worker.ts
      ai.worker.ts
      file.worker.ts
      game.worker.ts

  db/
    client.ts
    schema.prisma

  utils/
    file.util.ts
    validation.util.ts
    rate-limit.util.ts
    cleanup.util.ts
    logger.ts

  tests/
```

---

# 23. Database Model Minimum

## 23.1 GroupConfig

```text
id
groupId
prefix
silentOnJoin
respondOnlyToCommand
menuEnabled
stickerToolsEnabled
mediaToolsEnabled
aiToolsEnabled
groupToolsEnabled
moderationToolsEnabled
gameToolsEnabled
economyToolsEnabled
welcomeEnabled
goodbyeEnabled
antilinkEnabled
antispamEnabled
antitoxicEnabled
badwordFilterEnabled
levelingEnabled
economyEnabled
confessEnabled
menfessEnabled
createdAt
updatedAt
```

## 23.2 UserProfile

```text
id
userId
language
isPremium
premiumUntil
xp
level
balance
dailyClaimAt
createdAt
updatedAt
```

## 23.3 UsageLog

```text
id
userId
groupId
feature
command
success
createdAt
```

## 23.4 Warning

```text
id
groupId
userId
reason
warnedBy
createdAt
```

## 23.5 AutoReply

```text
id
groupId
trigger
response
createdBy
createdAt
```

## 23.6 EconomyTransaction

```text
id
fromUserId
toUserId
amount
type
createdAt
```

## 23.7 GameSession

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

## 23.8 PluginConfig

```text
id
pluginName
enabled
configJson
createdAt
updatedAt
```

---

# 24. Prioritas Implementasi

## Phase 1 — Silent Core dan Admin Setup

1. Silent on join
2. Respond only to command
3. `/menu`
4. `/setup`
5. `/feature on/off`
6. Permission admin/owner
7. Feature flag per grup

## Phase 2 — Sticker Tambahan

1. Sticker metadata
2. RemoveBG
3. Nobg + outline
4. Meme generator
5. Quote sticker
6. Circle sticker
7. Batch sticker
8. Video sticker

## Phase 3 — Media dan File Tools

1. Compress media
2. Resize/crop
3. Watermark sendiri
4. Video to GIF
5. MP3/audio extractor
6. QR generator/reader
7. OCR
8. Scan dokumen
9. PDF tools

## Phase 4 — Grup dan Moderasi

1. Welcome/goodbye
2. Anti-link
3. Warning system
4. Badword filter
5. Anti-spam
6. Auto reply
7. Polling
8. Reminder
9. Absensi

## Phase 5 — Game dan Economy

1. Truth or Dare
2. Tebak kata/gambar
3. Suit PvP
4. Tic Tac Toe
5. Family 100
6. Werewolf ranking
7. Balance
8. Shop
9. Inventory
10. Pet system

## Phase 6 — AI Premium

1. AI sticker
2. AI avatar
3. AI background changer
4. AI caption
5. AI remove object
6. AI expand image
7. AI colorize
8. Voice note transcription
9. Text to speech

## Phase 7 — Owner dan Monetisasi

1. Dashboard admin
2. Premium system
3. Limit user
4. API key
5. Broadcast owner
6. Maintenance mode
7. Plugin system
8. Statistik bot

---

# 25. Acceptance Criteria Utama

1. Bot tidak mengirim pesan apa pun saat masuk grup.
2. Bot hanya membalas setelah command valid.
3. Fitur welcome default nonaktif.
4. Fitur moderasi default nonaktif.
5. Admin dapat mengaktifkan fitur lewat `/feature`.
6. Semua fitur grup punya feature flag.
7. Semua fitur berat masuk queue.
8. Semua file sementara dihapus otomatis.
9. Semua command punya rate limit.
10. Semua command punya error handling.
11. User biasa tidak bisa memakai command admin.
12. Admin grup tidak bisa memakai command owner.
13. Fitur premium memeriksa status premium.
14. Bot tidak crash jika file rusak.
15. Bot tidak memproses file terlalu besar.
16. Bot tidak menyimpan media pribadi secara permanen.
17. Game bisa berjalan tanpa mengganggu fitur lain.
18. Economy tidak aktif sebelum admin mengaktifkan.
19. Confess/menfess tidak aktif sebelum admin mengaktifkan.
20. Dashboard dan owner tools hanya bisa diakses owner.

---

# 26. Prompt Eksekusi untuk Antigravity

Bangun addendum fitur untuk WhatsApp Bot berdasarkan PRD ini.

Prioritas paling penting:

1. Implementasikan `silentOnJoin: true`.
2. Pastikan bot tidak mengirim pesan saat baru masuk grup.
3. Bot hanya boleh membalas setelah menerima command valid.
4. Semua fitur grup dan moderasi harus default nonaktif.
5. Buat sistem feature flag per grup.
6. Buat command `/setup`, `/menu`, `/feature`, dan `/statusfitur`.
7. Tambahkan fitur secara modular sesuai kategori.
8. Semua command harus punya permission check, rate limit, error handling, dan logging.
9. Semua proses media/file/AI berat harus masuk queue worker.
10. Semua file sementara wajib dihapus otomatis.

Gunakan Node.js + TypeScript dengan struktur modular. Pisahkan command, service, queue, database, permission, dan feature flag. Buat unit test untuk command parser, feature flag, permission, rate limiter, dan beberapa fitur utama. Buat README berisi cara setup, env, command list, dan cara deployment.

Jangan hardcode token, jangan simpan media pribadi permanen, jangan kirim pesan otomatis saat join grup, dan jangan aktifkan fitur moderasi tanpa perintah admin.
