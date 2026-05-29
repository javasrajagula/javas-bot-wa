# PRD — Roadmap Fitur Javas Bot WA Non-Paid-AI

## 1. Ringkasan Produk

**Nama produk:** Javas Bot WA
**Platform:** WhatsApp Bot berbasis Node.js, TypeScript, Baileys, Prisma, dan database lokal/production database.
**Tujuan:** Mengembangkan Javas Bot WA menjadi bot WhatsApp modular untuk grup, komunitas, dan penggunaan pribadi dengan fitur moderasi, utilitas media, downloader, ekonomi, game, reminder, dashboard owner, sistem sewa, backup, dan onboarding grup.

PRD ini mencakup seluruh fitur roadmap yang sudah dibahas, kecuali integrasi AI berbayar. Fitur yang membutuhkan kecerdasan otomatis harus menggunakan pendekatan non-paid-AI, yaitu rule-based, heuristic-based, open-source, self-hosted, atau offline local processing.

---

## 2. Prinsip Produk

1. **Silent by Default**
   Bot tidak mengirim pesan otomatis yang mengganggu kecuali fitur tersebut diaktifkan oleh admin grup.

2. **Modular by Design**
   Semua fitur harus berada dalam plugin/module yang bisa diaktifkan atau dimatikan secara global oleh owner dan secara lokal oleh admin grup.

3. **Role-Based Access Control**
   Setiap command harus punya aturan role minimal: user, premium, admin grup, atau owner.

4. **Production-Safe**
   Semua fitur yang memproses media, link, file, command shell, atau queue harus aman dari abuse, spam, command injection, file berbahaya, dan resource exhaustion.

5. **No Paid AI Dependency**
   Tidak boleh ada dependensi wajib ke AI berbayar seperti OpenAI, Gemini berbayar, Claude, atau API komersial sejenis. Fitur OCR/STT/translate/summarize/moderation boleh memakai:

   * OCR open-source,
   * Whisper local/self-hosted,
   * LibreTranslate self-hosted,
   * rule-based moderation,
   * dictionary/regex/heuristic filtering,
   * model lokal gratis bila user menjalankan sendiri.

---

## 3. Target Pengguna

### 3.1 Owner Bot

Pengguna yang mengelola bot, premium user, plugin, broadcast, dashboard, database, backup, dan sistem sewa.

### 3.2 Admin Grup

Pengguna yang mengatur fitur grup seperti anti-link, warning, welcome, goodbye, reminder grup, dan setup wizard.

### 3.3 User Biasa

Member grup yang memakai fitur stiker, media, downloader terbatas, game, ekonomi, reminder pribadi, rank, profile, dan utilitas dokumen.

### 3.4 Premium User

User yang mendapat limit lebih besar, fitur media lebih berat, downloader lanjutan, rank card kustom, akses queue prioritas, dan fitur eksklusif non-paid-AI.

---

## 4. Scope Utama

Roadmap fitur dibagi menjadi 16 epic:

1. Core Stability & Security Upgrade
2. Audio & Voice Note Support
3. Dynamic Menu System
4. Group Subscription / Sewa Bot
5. Advanced Anti-Spam & Anti-Link
6. Smart Warning & Infraction System
7. Rule-Based / Offline Smart Moderation
8. Group Log & Audit Trail
9. Reminder, Scheduler, Tugas, dan Jadwal
10. Downloader Expansion
11. Rank Card, Profile Card, dan Leaderboard Visual
12. Economy Expansion
13. Achievement, Badge, dan Title System
14. Owner Web Dashboard
15. Backup & Restore System
16. Group Onboarding & Setup Wizard
17. Free/Open-Source Text, OCR, STT, Translate, dan Document Tools

---

# EPIC 1 — Core Stability & Security Upgrade

## 1.1 Problem

Bot sudah punya banyak fitur, tetapi sebelum dipakai banyak grup, fondasi teknis perlu distabilkan. Risiko utama:

* FFmpeg command injection,
* rate limiter masih in-memory,
* queue belum persistent,
* plugin/feature flag belum konsisten,
* command metadata tersebar,
* error detail bisa bocor ke user,
* reconnect Baileys perlu lebih aman.

## 1.2 Goals

* Membuat bot aman untuk penggunaan multi-grup.
* Mengurangi crash dan memory leak.
* Menyatukan metadata command.
* Membuat rate limit, queue, dan cooldown siap production.

## 1.3 Requirements

### Functional Requirements

1. Semua command harus punya metadata:

   * name,
   * aliases,
   * category,
   * plugin,
   * featureFlag,
   * minRole,
   * premiumOnly,
   * rateLimitKey,
   * description,
   * usage,
   * examples.

2. Router command harus membaca metadata sebagai sumber utama.

3. Plugin manager harus memakai metadata command, bukan daftar command manual.

4. Feature flag grup harus membaca metadata command.

5. Error ke user harus generik:

   * “Terjadi kesalahan saat memproses command.”
   * Detail stack trace masuk ke ErrorLog.

6. Semua proses FFmpeg harus menggunakan `spawn` atau `execFile`, bukan string shell bebas.

7. Semua input user untuk FFmpeg harus divalidasi:

   * durasi,
   * timestamp,
   * teks watermark,
   * filename,
   * ekstensi file,
   * ukuran media.

8. Tambahkan graceful shutdown:

   * close Prisma,
   * close Redis,
   * clear queue worker,
   * save pending state.

9. Tambahkan health command:

   * `/ping`
   * `/status`
   * `/uptime`

10. Tambahkan CI:

* typecheck,
* test,
* lint,
* build.

### Non-Functional Requirements

* Semua command harus tetap kompatibel dengan mode console.
* Tidak boleh ada secrets di repo.
* Semua file temp harus auto-cleanup.
* Bot harus tetap jalan meskipun satu command gagal.

## 1.4 Acceptance Criteria

* `npm run typecheck` sukses.
* `npm run test` sukses.
* Semua command punya metadata.
* Plugin off benar-benar mematikan seluruh command plugin tersebut.
* Feature flag off benar-benar memblokir command terkait di grup.
* FFmpeg tidak memakai raw shell string dari input user.
* Error stack tidak dikirim ke chat user.

---

# EPIC 2 — Audio & Voice Note Support

## 2.1 Problem

Command audio sudah ada, tetapi parser media belum lengkap untuk voice note/audio WhatsApp. Akibatnya command seperti `/transkrip`, `/voice`, `/cutaudio`, `/speed`, dan `/slow` tidak akan stabil untuk pesan audio asli.

## 2.2 Goals

* Mendukung audioMessage dan voice note WhatsApp.
* Menambahkan method adapter yang bersih untuk mengirim audio.
* Membuat fitur audio bisa dipakai tanpa akses langsung ke socket internal.

## 2.3 Requirements

### Functional Requirements

1. Tambahkan tipe media:

   * image,
   * video,
   * sticker,
   * document,
   * audio.

2. Parser Baileys harus membaca:

   * `audioMessage`,
   * `ptt`,
   * mimetype audio,
   * duration bila tersedia.

3. Tambahkan method adapter:

   * `sendAudio(chatId, audioBuffer, options)`
   * `sendVoiceNote(chatId, audioBuffer, options)`
   * `sendDocument(chatId, buffer, fileName, mimeType, options)`

4. Command audio wajib mendukung:

   * `/mp3`
   * `/audio`
   * `/transkrip`
   * `/vntext`
   * `/voice robot`
   * `/voice chipmunk`
   * `/voice deep`
   * `/cutaudio 00:10-00:30`
   * `/speed 1.5x`
   * `/slow 0.75x`

5. Batasi durasi audio:

   * free: 2 menit,
   * premium: 10 menit,
   * owner: configurable.

6. Batasi ukuran file:

   * free: 10 MB,
   * premium: 50 MB.

7. `/transkrip` harus memakai opsi non-paid:

   * mode pertama: dummy/offline placeholder yang jelas,
   * mode production optional: Whisper local/self-hosted,
   * tidak boleh wajib API berbayar.

## 2.4 Acceptance Criteria

* Bot bisa membaca voice note.
* Bot bisa mengirim hasil audio sebagai audio atau voice note.
* Command `/voice`, `/speed`, `/cutaudio` berjalan untuk audioMessage.
* File audio besar ditolak dengan pesan yang jelas.
* Tidak ada akses langsung `(adapter as any).sock` di command audio.

---

# EPIC 3 — Dynamic Menu System

## 3.1 Problem

Bot punya banyak command. User akan bingung jika semua command ditampilkan sekaligus. Menu harus menyesuaikan role, plugin, fitur aktif, premium, dan prefix grup.

## 3.2 Goals

* Membuat menu rapi, pendek, dan relevan.
* Mengurangi kebingungan user.
* Membantu admin memahami fitur yang aktif/nonaktif.

## 3.3 Requirements

### Commands

* `/menu`
* `/menu all`
* `/menu stiker`
* `/menu media`
* `/menu audio`
* `/menu dokumen`
* `/menu game`
* `/menu ekonomi`
* `/menu admin`
* `/menu owner`
* `/menu premium`
* `/help <command>`

### Functional Requirements

1. `/menu` default menampilkan kategori utama.
2. `/menu <kategori>` menampilkan command dalam kategori tersebut.
3. Menu harus menggunakan prefix grup saat ini.
4. Menu harus menyembunyikan:

   * command owner untuk user biasa,
   * command admin untuk non-admin,
   * command premium untuk user non-premium,
   * command dari plugin OFF,
   * command dari feature flag OFF di grup.
5. `/help <command>` menampilkan:

   * deskripsi,
   * usage,
   * contoh,
   * role minimal,
   * status fitur di grup,
   * status plugin global.

## 3.4 Acceptance Criteria

* User biasa tidak melihat command owner.
* Admin melihat command admin.
* Owner melihat semua command.
* Jika plugin game OFF, command game hilang dari menu.
* Jika fitur economy OFF di grup, command economy tidak ditampilkan di menu grup.

---

# EPIC 4 — Group Subscription / Sewa Bot

## 4.1 Problem

Bot perlu sistem monetisasi atau kontrol akses per grup. Saat ini premium user ada, tetapi belum ada premium/sewa untuk grup.

## 4.2 Goals

* Membuat sistem sewa grup.
* Membatasi fitur per paket.
* Memudahkan owner menjual akses bot.

## 4.3 Paket Awal

### Free Group

* Fitur dasar.
* Limit command rendah.
* Downloader terbatas/nonaktif.
* Media berat nonaktif.

### Basic Group

* Moderasi dasar.
* Stiker.
* Reminder.
* Game ringan.
* Economy dasar.

### Premium Group

* Semua fitur non-paid-AI.
* Downloader tambahan.
* Media processing lebih besar.
* Dashboard stats grup.
* Rank card visual.
* Backup config grup.

## 4.4 Commands

Owner:

* `/addsewa <groupId|current> <hari> <plan>`
* `/delsewa <groupId|current>`
* `/listsewa`
* `/extendsewa <groupId|current> <hari>`
* `/setplan <groupId|current> <free|basic|premium>`

Admin/User:

* `/sewa`
* `/ceksewa`
* `/fitursewa`

## 4.5 Data Model

```prisma
model GroupSubscription {
  id          String   @id @default(uuid())
  groupId     String   @unique
  plan        String   @default("free")
  expiresAt   DateTime?
  maxDailyCmd Int?
  featuresJson String  @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## 4.6 Acceptance Criteria

* Grup tanpa sewa memakai plan free.
* Grup expired otomatis turun ke free.
* Admin bisa cek masa aktif sewa.
* Owner bisa tambah, hapus, extend, dan ubah plan.
* Feature limit mengikuti plan.

---

# EPIC 5 — Advanced Anti-Spam & Anti-Link

## 5.1 Problem

Anti-spam dasar belum cukup untuk grup ramai. Perlu deteksi spam lebih detail.

## 5.2 Goals

* Melindungi grup dari spam teks, link, mention, sticker, virtex, dan promosi.
* Memberikan aksi bertingkat sesuai konfigurasi admin.

## 5.3 Commands

* `/antispam on|off`
* `/antispam status`
* `/antispam mode delete|warn|mute|kick`
* `/antispam limit <jumlah> <durasi>`
* `/antilink on|off`
* `/antilink mode delete|warn|kick`
* `/whitelistdomain add <domain>`
* `/whitelistdomain del <domain>`
* `/whitelistdomain list`
* `/antivirtex on|off`
* `/antimention on|off`
* `/antisticker on|off`

## 5.4 Detection Rules

Bot harus mendeteksi:

1. Pesan terlalu cepat.
2. Pesan teks berulang.
3. Emoji spam.
4. Mention spam.
5. Sticker spam.
6. Link spam.
7. Link grup WhatsApp.
8. Shortlink mencurigakan.
9. Pesan sangat panjang/virtex.
10. Karakter invisible atau unicode abuse.

## 5.5 Actions

* ignore,
* delete,
* warn,
* mute internal,
* kick,
* blacklist group.

## 5.6 Acceptance Criteria

* Admin bisa mengatur mode aksi.
* Bot tidak menghukum admin grup kecuali config mengizinkan.
* Link whitelist tidak dihapus.
* Spam berulang memicu action sesuai konfigurasi.
* Semua pelanggaran masuk log grup.

---

# EPIC 6 — Smart Warning & Infraction System

## 6.1 Problem

Warning manual sudah berguna, tetapi perlu dibuat otomatis dan bertingkat.

## 6.2 Goals

* Mengubah warning menjadi sistem infraction.
* Menghubungkan anti-spam, anti-link, badword, dan moderation ke warning.
* Membuat aksi otomatis berdasarkan jumlah pelanggaran.

## 6.3 Commands

* `/warn @user <alasan>`
* `/warnings @user`
* `/unwarn @user [jumlah]`
* `/clearwarn @user`
* `/setwarnaction <jumlah> <action>`
* `/warnaction`
* `/warnlog @user`
* `/resetwarns`

## 6.4 Rules Default

* 1 warning: pesan peringatan.
* 2 warning: mute 10 menit.
* 3 warning: kick.
* 5 warning: blacklist grup.

## 6.5 Data Model

```prisma
model WarningRule {
  id        String   @id @default(uuid())
  groupId   String
  threshold Int
  action    String
  duration  Int?
  createdAt DateTime @default(now())
}

model InfractionLog {
  id        String   @id @default(uuid())
  groupId   String
  userId    String
  type      String
  reason    String?
  action    String?
  createdBy String?
  createdAt DateTime @default(now())
}
```

## 6.6 Acceptance Criteria

* Warning manual tersimpan.
* Warning otomatis tersimpan.
* Saat threshold tercapai, action otomatis dijalankan.
* Admin bisa melihat history warning user.
* Admin bisa mengubah aturan threshold.

---

# EPIC 7 — Rule-Based / Offline Smart Moderation

## 7.1 Problem

Moderasi hanya berbasis badword sederhana mudah dilewati. Namun PRD ini tidak boleh bergantung pada AI berbayar.

## 7.2 Goals

* Membuat moderation pintar tanpa paid AI.
* Menggunakan rule, regex, scoring, dictionary, dan heuristic.
* Bisa diperluas ke model lokal self-hosted jika owner ingin.

## 7.3 Commands

* `/modsmart on|off`
* `/modsmart level low|medium|strict`
* `/modsmart action delete|warn|mute`
* `/modsmart status`
* `/badword add <kata>`
* `/badword del <kata>`
* `/badword list`
* `/toxicscore @user`

## 7.4 Detection System

Bot menghitung skor berdasarkan:

* kata kasar,
* variasi alay,
* spacing untuk menghindari filter,
* huruf diganti angka,
* repeated toxic phrase,
* promosi,
* scam keyword,
* shortlink mencurigakan,
* virtex pattern.

## 7.5 Non-Paid Optional Engine

Mode optional:

* dictionary Indonesia,
* regex patterns,
* local ONNX classifier,
* self-hosted local moderation model.

Tidak boleh ada API berbayar sebagai dependency wajib.

## 7.6 Acceptance Criteria

* Kata toxic sederhana terdeteksi.
* Variasi seperti huruf disisipkan spasi tetap bisa terdeteksi pada mode strict.
* Admin bisa memilih action.
* False positive bisa dikurangi dengan whitelist word.
* Semua moderation action masuk log.

---

# EPIC 8 — Group Log & Audit Trail

## 8.1 Problem

Admin perlu melihat apa yang dilakukan bot: pesan dihapus, user di-warning, command populer, join/leave, dan error.

## 8.2 Goals

* Membuat audit log per grup.
* Memudahkan admin mengecek aktivitas bot.
* Memudahkan owner debugging.

## 8.3 Commands

* `/log`
* `/log today`
* `/log warn`
* `/log link`
* `/log spam`
* `/log command`
* `/log join`
* `/log leave`
* `/log error`
* `/clearlog`

## 8.4 Data Model

```prisma
model GroupLog {
  id          String   @id @default(uuid())
  groupId     String
  userId      String?
  type        String
  action      String?
  message     String?
  metadataJson String @default("{}")
  createdAt   DateTime @default(now())
}
```

## 8.5 Acceptance Criteria

* Setiap moderation action tercatat.
* Setiap warning tercatat.
* Join/leave tercatat jika fitur aktif.
* Admin bisa filter log berdasarkan tipe.
* Log lama bisa dibersihkan otomatis sesuai retention policy.

---

# EPIC 9 — Reminder, Scheduler, Tugas, dan Jadwal

## 9.1 Problem

Reminder sudah dirancang di database, tetapi perlu worker dan command yang matang.

## 9.2 Goals

* Membuat reminder pribadi dan grup.
* Membuat jadwal pelajaran, tugas, deadline, dan ulang tahun.
* Worker harus tetap jalan dan recover setelah restart.

## 9.3 Commands

Reminder:

* `/remind 10m minum air`
* `/remind 21:00 belajar matematika`
* `/remind besok 07:00 bawa buku`
* `/remindgroup besok 07:00 upacara`
* `/listremind`
* `/delremind <id>`

Jadwal:

* `/jadwal`
* `/jadwal add senin 07:00 Matematika`
* `/jadwal del <id>`
* `/jadwal hariini`
* `/jadwal besok`

Tugas:

* `/tugas`
* `/tugas add <deadline> <deskripsi>`
* `/tugas done <id>`
* `/tugas del <id>`

Ulang tahun:

* `/ultah add @user 12-08`
* `/ultah list`
* `/ultah del @user`

## 9.4 Requirements

1. Worker mengecek reminder pending setiap 30–60 detik.
2. Reminder tidak boleh terkirim dua kali.
3. Timezone default Asia/Jakarta.
4. Admin bisa membuat reminder grup.
5. User biasa bisa membuat reminder pribadi.
6. Reminder harus tetap ada setelah restart.
7. Command harus mendukung format waktu sederhana.

## 9.5 Acceptance Criteria

* Reminder terkirim sesuai waktu.
* Reminder tetap berjalan setelah bot restart.
* `/listremind` menampilkan reminder aktif.
* `/delremind` membatalkan reminder.
* Jadwal dan tugas bisa dikelola per grup.

---

# EPIC 10 — Downloader Expansion

## 10.1 Problem

Downloader terbatas pada TikTok dan Instagram. User biasanya butuh platform lain.

## 10.2 Goals

* Menambah downloader populer.
* Tetap aman dari abuse dan masalah resource.
* Membatasi ukuran dan durasi.

## 10.3 Commands

* `/tt <url>`
* `/ig <url>`
* `/ytmp3 <url>`
* `/ytmp4 <url>`
* `/fb <url>`
* `/twitter <url>`
* `/x <url>`
* `/threads <url>`
* `/pinterest <url>`
* `/capcut <url>`

## 10.4 Rules

1. Downloader berat hanya untuk premium atau grup sewa premium.
2. Free user:

   * durasi max 3 menit,
   * ukuran max 25 MB,
   * cooldown lebih lama.
3. Premium:

   * durasi max 15 menit,
   * ukuran max 100 MB.
4. Semua URL harus divalidasi domain.
5. Tidak boleh download dari private/local IP.
6. Harus ada timeout.
7. Semua file temp dihapus setelah dikirim.
8. Tidak boleh mendownload konten login-only/private.

## 10.5 Acceptance Criteria

* URL tidak valid ditolak.
* File terlalu besar ditolak.
* Queue downloader berjalan.
* Gagal download memberi pesan jelas.
* File temp selalu dibersihkan.

---

# EPIC 11 — Rank Card, Profile Card, dan Leaderboard Visual

## 11.1 Problem

Rank saat ini berbentuk teks. Visual card akan lebih menarik dan membuat ekonomi/leveling terasa hidup.

## 11.2 Goals

* Membuat rank/profile card berbasis gambar.
* Menampilkan level, XP, saldo, title, badge, dan statistik.
* Mendukung tema basic dan premium.

## 11.3 Commands

* `/rank`
* `/profile`
* `/card`
* `/top`
* `/leaderboard`
* `/setbg`
* `/settitle`
* `/setbadge`

## 11.4 Card Content

Card harus memuat:

* nama user,
* nomor/user ID tersamarkan,
* level,
* XP bar,
* saldo,
* rank global,
* rank grup,
* title,
* badge,
* total command,
* tanggal join database,
* status premium.

## 11.5 Requirements

1. Gunakan image rendering lokal, misalnya sharp/SVG.
2. Template default harus tersedia.
3. Premium bisa memakai background custom.
4. Free user hanya template default.
5. Card harus optimal ukuran WhatsApp.
6. Jika avatar tidak tersedia, pakai default avatar.

## 11.6 Acceptance Criteria

* `/rank` mengirim gambar.
* XP bar sesuai data user.
* Leaderboard tetap bisa tampil teks jika image gagal.
* Background custom hanya untuk premium.
* Proses card tidak membuat bot freeze.

---

# EPIC 12 — Economy Expansion

## 12.1 Problem

Ekonomi sudah ada balance, claim, transfer, shop, inventory, pet, dan dungeon. Perlu aktivitas harian agar user terus kembali.

## 12.2 Goals

* Menambah aktivitas economy harian.
* Membuat sink dan source uang virtual.
* Mengurangi inflasi dengan pajak, cooldown, dan item.

## 12.3 Commands

Income:

* `/daily`
* `/work`
* `/mining`
* `/fishing`
* `/crime`
* `/beg`

Bank:

* `/bank`
* `/deposit <jumlah>`
* `/withdraw <jumlah>`

Social:

* `/transfer @user <jumlah>`
* `/giveaway <jumlah> <pemenang>`
* `/redeem <kode>`

Risk:

* `/rob @user`
* `/slot`
* `/coinflip <jumlah>`

Shop:

* `/shop`
* `/buy <item>`
* `/sell <item>`
* `/inventory`

Pet/RPG:

* `/pet adopt`
* `/pet feed`
* `/pet train`
* `/pet battle`
* `/pet evolve`
* `/dungeon`
* `/boss`
* `/craft`
* `/market`

## 12.4 Rules

1. Semua command economy tunduk pada cooldown.
2. Grup bisa mematikan economy.
3. Admin bisa reset economy grup jika diperlukan.
4. Rob/crime harus bisa dimatikan per grup.
5. Harus ada anti-abuse untuk transfer dan giveaway.
6. Balance tidak boleh negatif.
7. Semua transaksi penting dicatat.

## 12.5 Data Model Tambahan

```prisma
model EconomyTransaction {
  id        String   @id @default(uuid())
  userId    String
  groupId   String?
  type      String
  amount    Int
  metadataJson String @default("{}")
  createdAt DateTime @default(now())
}

model RedeemCode {
  id        String   @id @default(uuid())
  code      String   @unique
  rewardJson String
  maxUses   Int
  usedCount Int      @default(0)
  expiresAt DateTime?
  createdAt DateTime @default(now())
}
```

## 12.6 Acceptance Criteria

* Economy command tidak bisa dipakai jika fitur economy OFF.
* Cooldown bekerja.
* Transaksi tercatat.
* Rob/crime bisa dimatikan admin.
* Giveaway memilih pemenang dengan transparan.

---

# EPIC 13 — Achievement, Badge, dan Title System

## 13.1 Problem

User butuh progres dan identitas. Badge/title membuat bot lebih engaging.

## 13.2 Goals

* Memberi penghargaan otomatis.
* Menghubungkan achievement dengan rank card.
* Membuat item kosmetik untuk economy.

## 13.3 Commands

* `/achievement`
* `/achievements`
* `/badge`
* `/badge set <nama>`
* `/title`
* `/title set <nama>`

## 13.4 Achievement Awal

* First Command
* 7 Days Active
* 30 Days Active
* 100 Messages
* 1000 Messages
* Sticker Maker
* Game Master
* Rich User
* Top 1 Leaderboard
* Admin Helper
* Anti-Spam Defender
* Daily Streak 7
* Daily Streak 30

## 13.5 Requirements

1. Achievement bisa auto-unlock.
2. Badge bisa dipasang di profile card.
3. Title bisa dibeli atau didapat dari achievement.
4. Achievement harus punya rarity:

   * common,
   * rare,
   * epic,
   * legendary.

## 13.6 Data Model

```prisma
model Achievement {
  id          String   @id @default(uuid())
  key         String   @unique
  name        String
  description String
  rarity      String
  rewardJson  String   @default("{}")
}

model UserAchievement {
  id            String   @id @default(uuid())
  userId        String
  achievementKey String
  unlockedAt    DateTime @default(now())
}
```

## 13.7 Acceptance Criteria

* Achievement unlock otomatis.
* User bisa melihat daftar achievement.
* Badge terpasang di profile card.
* Achievement tidak bisa double unlock.

---

# EPIC 14 — Owner Web Dashboard

## 14.1 Problem

CLI dashboard berguna, tetapi owner lebih mudah mengelola bot lewat dashboard web.

## 14.2 Goals

* Memberi UI untuk owner.
* Mengelola grup, user, premium, plugin, logs, queue, backup, dan subscription.
* Mempercepat debugging.

## 14.3 Pages

1. Login Owner
2. Overview
3. Groups
4. Group Detail
5. Feature Flags
6. Plugins
7. Premium Users
8. Group Subscriptions
9. Queue Monitor
10. Usage Stats
11. Error Logs
12. Group Logs
13. Broadcast Panel
14. Backup & Restore
15. Settings

## 14.4 Requirements

1. Dashboard wajib protected by login.
2. Auth bisa memakai:

   * password owner dari env,
   * API key owner,
   * session token.
3. Dashboard tidak boleh menampilkan credential WhatsApp.
4. Owner bisa toggle plugin.
5. Owner bisa mengubah fitur grup.
6. Owner bisa melihat error log.
7. Owner bisa membuat broadcast dengan preview dan konfirmasi.
8. Owner bisa download backup.

## 14.5 Suggested Stack

* Next.js + Prisma + Tailwind
  atau
* Express + EJS + Prisma untuk versi ringan.

## 14.6 Acceptance Criteria

* Owner bisa login.
* Owner bisa melihat statistik bot.
* Owner bisa toggle plugin.
* Owner bisa melihat error terbaru.
* Owner bisa mengelola premium dan sewa grup.
* Broadcast butuh konfirmasi sebelum dikirim.

---

# EPIC 15 — Backup & Restore System

## 15.1 Problem

Bot menyimpan banyak data penting: premium, economy, warning, subscription, group config, reminder, dan logs. Kehilangan database akan merusak kepercayaan user.

## 15.2 Goals

* Membuat backup manual dan otomatis.
* Memudahkan restore config.
* Mencegah kehilangan data.

## 15.3 Commands

Owner:

* `/backup`
* `/backupdb`
* `/backupconfig`
* `/listbackup`
* `/restorebackup <id>`
* `/exportconfig`
* `/importconfig`

## 15.4 Requirements

1. Backup database manual.
2. Backup config grup manual.
3. Auto backup harian.
4. Backup diberi timestamp.
5. Backup bisa dikirim ke owner via private chat.
6. Backup bisa disimpan lokal.
7. Session WhatsApp tidak boleh dibagikan sembarangan.
8. Restore butuh konfirmasi.
9. Backup lama dibersihkan sesuai retention.

## 15.5 Acceptance Criteria

* Owner bisa membuat backup.
* Backup bisa diunduh/dikirim ke owner.
* Restore tidak bisa dijalankan tanpa konfirmasi.
* Auto backup berjalan sesuai jadwal.
* Backup tidak menyertakan `.env`.

---

# EPIC 16 — Group Onboarding & Setup Wizard

## 16.1 Problem

Bot punya banyak fitur. Admin baru butuh setup cepat.

## 16.2 Goals

* Membantu admin mengaktifkan fitur dengan preset.
* Mempertahankan prinsip silent by default.
* Mengurangi command setup manual.

## 16.3 Commands

* `/setup`
* `/setupwizard`
* `/setup basic`
* `/setup sekolah`
* `/setup komunitas`
* `/setup strict`
* `/setup game`
* `/setup reset`
* `/statusfitur`

## 16.4 Preset

### Basic

* welcome off
* goodbye off
* antilink off
* antispam on
* badword off
* leveling off
* economy off

### Sekolah

* welcome on
* goodbye on
* antilink on
* antispam on
* badword on
* reminder on
* attendance on
* economy off
* miniGames off

### Komunitas

* welcome on
* goodbye on
* antilink on
* antispam on
* autoreply on
* poll on
* leveling on
* economy on
* miniGames on

### Strict

* welcome on
* goodbye on
* antilink on
* antispam on
* badword on
* modsmart on
* warning on
* automute on
* economy off

### Game

* leveling on
* economy on
* miniGames on
* rpg on
* poll on

## 16.5 Acceptance Criteria

* Admin bisa menjalankan setup preset.
* Bot menampilkan ringkasan fitur yang akan diubah.
* Setup butuh konfirmasi.
* `/statusfitur` menampilkan semua fitur aktif/nonaktif.
* `/setup reset` mengembalikan default.

---

# EPIC 17 — Free/Open-Source Text, OCR, STT, Translate, dan Document Tools

## 17.1 Problem

Beberapa command text/document masih simulasi. Fitur ini harus dibuat nyata tanpa AI berbayar.

## 17.2 Goals

* Membuat fitur utilitas nyata.
* Memakai library lokal, gratis, atau self-hosted.
* Tidak bergantung pada API AI berbayar.

## 17.3 Commands

Text:

* `/ocr`
* `/translate <lang>`
* `/tr <lang>`
* `/ringkas`
* `/summarize`
* `/ubah formal|santai|sopan|singkat`
* `/typo`
* `/koreksi`

Audio/Text:

* `/transkrip`
* `/vntext`

Document:

* `/img2pdf`
* `/pdf2img`
* `/mergepdf`
* `/compresspdf`
* `/scan`
* `/unzip`
* `/qr`
* `/readqr`
* `/ssweb`

## 17.4 Suggested Non-Paid Implementations

### OCR

Options:

* Tesseract OCR local.
* node-tesseract-ocr.
* OCR engine container self-hosted.

### Translate

Options:

* LibreTranslate self-hosted.
* Dictionary/rule-based basic translation for limited use.
* External free endpoint only if optional and configurable.

### Summarize

Options:

* Extractive summarization:

  * sentence scoring,
  * keyword frequency,
  * TextRank implementation.
* No paid LLM.

### Typo Correction

Options:

* dictionary-based Indonesian correction,
* common typo map,
* Levenshtein distance,
* optional Hunspell dictionary.

### STT / Voice Transcription

Options:

* Whisper local/self-hosted.
* Vosk offline.
* Optional mode disabled if binary/model unavailable.

### PDF

Options:

* pdf-lib for merge/split.
* poppler or sharp-compatible pipeline for render PDF to image.
* Ghostscript for compression if installed.
* zip library for safe unzip.

## 17.5 Requirements

1. Jika dependency lokal tidak tersedia, bot harus memberi pesan setup yang jelas.
2. Semua file diproses di temp folder.
3. File temp harus dihapus.
4. File executable dari archive harus diblokir.
5. Archive path traversal harus dicegah.
6. PDF besar harus dibatasi.
7. OCR dan STT harus punya limit free/premium.

## 17.6 Acceptance Criteria

* `/ocr` menghasilkan teks dari gambar nyata.
* `/ringkas` menghasilkan ringkasan dari teks input tanpa paid AI.
* `/translate` bisa memakai provider self-hosted jika dikonfigurasi.
* `/img2pdf` menghasilkan PDF valid.
* `/mergepdf` benar-benar menggabungkan PDF.
* `/unzip` membaca archive secara aman.
* `/transkrip` bekerja jika engine offline tersedia, atau menampilkan instruksi setup jika belum tersedia.

---

# 18. Global Non-Functional Requirements

## 18.1 Security

1. Tidak boleh ada raw shell execution dari input user.
2. Semua URL harus divalidasi.
3. Private IP, localhost, metadata IP, dan file URL harus diblokir.
4. Semua upload file harus punya size limit.
5. Semua archive harus dicegah dari zip slip/path traversal.
6. Semua command owner harus diverifikasi owner.
7. Dashboard harus punya auth.
8. Error detail tidak dikirim ke user biasa.

## 18.2 Performance

1. Media processing berat harus lewat queue.
2. Queue harus punya max concurrency.
3. Tiap fitur berat punya timeout.
4. Bot tidak boleh blocking event loop terlalu lama.
5. Image/card rendering harus optimized.

## 18.3 Reliability

1. Worker reminder harus recover setelah restart.
2. Queue persistent disarankan untuk production.
3. Database migration harus aman.
4. Backup otomatis harus tersedia.
5. Baileys reconnect harus memakai backoff.

## 18.4 Maintainability

1. Command metadata menjadi single source of truth.
2. Semua fitur punya test minimal.
3. Semua plugin punya folder/module sendiri.
4. Dokumentasi command harus auto-generated dari metadata.
5. README harus sinkron dengan fitur aktual.

---

# 19. Prioritas Implementasi

## Phase 0 — Stabilitas Wajib

1. Secure FFmpeg execution.
2. Audio/voice note support.
3. Command metadata registry.
4. Plugin + feature flag consistency.
5. Error handling aman.
6. Health check.
7. Typecheck/test CI.

## Phase 1 — Admin & Grup

1. Dynamic menu.
2. Setup wizard.
3. Advanced anti-spam.
4. Warning/infraction.
5. Group logs.
6. Reminder worker.

## Phase 2 — Engagement User

1. Rank card.
2. Economy expansion.
3. Achievement/badge/title.
4. Game/economy balancing.
5. Profile card.

## Phase 3 — Monetisasi & Owner Tools

1. Group subscription/sewa.
2. Premium package rules.
3. Owner dashboard.
4. Backup/restore.
5. Broadcast panel.

## Phase 4 — Utility Non-Paid-AI

1. OCR local.
2. STT local/self-hosted.
3. Translate self-hosted.
4. Extractive summarizer.
5. Real PDF tools.
6. Safe unzip.

## Phase 5 — Downloader Expansion

1. YouTube MP3/MP4.
2. Facebook.
3. Twitter/X.
4. Threads.
5. Pinterest.
6. CapCut.

---

# 20. Success Metrics

## Product Metrics

1. Jumlah grup aktif.
2. Jumlah user aktif harian.
3. Jumlah command per hari.
4. Retention user 7 hari.
5. Jumlah grup sewa aktif.
6. Jumlah premium user aktif.

## Reliability Metrics

1. Error rate per command.
2. Queue failure rate.
3. Average command latency.
4. Reconnect count per hari.
5. Media processing timeout count.

## Moderation Metrics

1. Link spam blocked.
2. Toxic message blocked.
3. Warning issued.
4. Auto-mute triggered.
5. False positive report.

## Economy/Game Metrics

1. Daily claim count.
2. Economy inflation rate.
3. Top command game.
4. Achievement unlock count.
5. Rank card usage.

---

# 21. Out of Scope

Fitur berikut tidak masuk scope PRD ini:

1. Integrasi AI berbayar.
2. Chatbot AI berbasis OpenAI/Gemini/Claude API berbayar.
3. Image generation berbayar.
4. Moderasi AI cloud berbayar.
5. Fitur yang melanggar aturan platform atau hukum.
6. Download konten private/login-only.
7. Penyimpanan credential WhatsApp di dashboard.
8. Pengiriman spam massal tanpa konfirmasi owner.

---

# 22. Rekomendasi Struktur Folder

```txt
src/
  bot/
    adapters/
    message.types.ts
    permission.ts

  commands/
    registry/
      command-metadata.ts
      command-router.ts
    menu/
    admin/
    owner/
    moderation/
    economy/
    games/
    media/
    audio/
    document/
    downloader/
    scheduler/

  services/
    ffmpeg/
    media/
    audio/
    downloader/
    moderation/
    economy/
    scheduler/
    backup/
    subscription/
    dashboard/
    ocr/
    stt/
    translate/
    summarize/

  workers/
    reminder.worker.ts
    queue.worker.ts
    cleanup.worker.ts

  db/
    client.ts

  utils/
    logger.ts
    file.util.ts
    url.validator.ts
    time.util.ts
```

---

# 23. MVP Definition

MVP dianggap selesai jika:

1. Bot stabil di minimal 3 grup aktif.
2. Dynamic menu berjalan.
3. Audio/voice note support berjalan.
4. Anti-spam dan warning otomatis berjalan.
5. Reminder worker berjalan.
6. Rank card bisa dibuat.
7. Economy command dasar dan tambahan utama berjalan.
8. Owner bisa backup database.
9. Owner bisa mengatur sewa grup.
10. Tidak ada fitur yang mengandalkan AI berbayar.
11. Semua command penting punya metadata dan test minimal.
12. Semua command media berat punya limit, timeout, dan cleanup.

---

# 24. Catatan Implementasi Teknis

1. Mulai dari command metadata registry sebelum menambah command baru.
2. Jangan tambah fitur downloader sebelum queue dan rate limit kuat.
3. Jangan tambah PDF/ZIP besar sebelum file size limit dan safe extraction siap.
4. Jangan tambah dashboard sebelum auth owner aman.
5. Jangan tambah auto-moderation ketat tanpa whitelist dan log.
6. Jangan expose stack trace ke user.
7. Gunakan Prisma migration untuk perubahan schema.
8. Buat seed data untuk shop item, achievement, dan default warning rules.
9. Pisahkan config development dan production.
10. Update README otomatis atau semi-otomatis dari command metadata.
