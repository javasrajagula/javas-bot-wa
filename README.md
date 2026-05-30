# 🤖 Javas Bot WA — WhatsApp Bot Lanjutan (TypeScript & Baileys SDK)

Javas Bot WA adalah bot WhatsApp multifungsi berbasis **Node.js, TypeScript, Baileys SDK, Prisma ORM, dan SQLite** sebagai sistem database lokal yang efisien. Bot ini dirancang agar siap pakai untuk grup WhatsApp dengan fitur lengkap: stiker, media/audio, dokumen, game interaktif, ekonomi virtual, komunitas sekolah, bisnis & keuangan, otomasi, privasi data, webhook, dan moderasi cerdas dengan kontrol penuh Owner melalui plugin manager dan CLI Admin Dashboard.

---

## 🌟 Prinsip Desain Utama

1. **Silent by Default (Senyap Secara Default)**
   - Saat bot ditambahkan ke grup, bot **tidak** mengirimkan sapaan otomatis. Bot hanya merespons command valid dari pengguna yang berhak.
2. **Modular & Aman**
   - File sementara yang diunduh disimpan di direktori `temp` dan dibersihkan otomatis dalam ≤15 menit.
3. **Role-Based Permission Matrix**
   - Akses perintah dibatasi ketat berdasarkan hierarki peran: **Owner Bot → Admin Grup → Premium User → Warga Biasa**.
4. **Dynamic Feature Flags**
   - Seluruh fitur grup dinonaktifkan secara default dan dikendalikan real-time oleh admin dengan `/feature`.
5. **Global Plugin System**
   - Owner mengaktifkan/menonaktifkan paket fitur global (game, ekonomi, AI, dll.) lewat sistem plugin dinamis.
6. **Privacy by Design**
   - Mendukung Privacy Mode (strict/balanced/off), kebijakan retensi data, consent per-fitur, dan hak penghapusan data (GDPR-style).

---

## 🛠️ Langkah-Langkah Instalasi & Setup

### 1. Prasyarat (Prerequisites)
Pastikan telah terpasang:
- **Node.js** (Rekomendasi v20.x atau lebih baru)
- **npm** (Package manager default)
- **FFmpeg** (Wajib di system PATH untuk video, stiker bergerak, audio, reverse)

### 2. Kloning & Pemasangan Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin `.env.example` ke `.env` dan sesuaikan:
```env
# Mode bot: "baileys" (koneksi WA asli) atau "console" (simulasi terminal)
ADAPTER_MODE="baileys"

# Database URL untuk SQLite
DATABASE_URL="file:./dev.db"

# Nama folder sesi penyimpanan Baileys
WA_SESSION_NAME="wa-session"

# Nomor Owner bot (pisahkan koma, tanpa + dan tanpa JID suffix)
OWNER_IDS="6285338123425"
```

### 4. Setup Database & Prisma Migrations
```bash
npx prisma db push
```

### 5. Menjalankan Bot
```bash
npm run dev
```

### 6. CLI Admin Dashboard
```bash
npm run dashboard
```

### 7. Owner Web Dashboard (Opsional)
```env
DASHBOARD_ENABLED="true"
DASHBOARD_PORT="8787"
OWNER_DASHBOARD_PASSWORD="ganti-password-kuat"
```
Buka `http://localhost:8787`. Mencakup overview, groups, feature flags, plugins, premium users, subscriptions, queue monitor, usage stats, error logs, broadcast, backup/restore, dan settings.

### 8. Backup, Restore & Utility Offline
```
/backup  /backupdb  /backupconfig  /listbackup  /restorebackup <id>
/exportconfig  /importconfig
```
Backup disimpan di `backups/`, tidak menyertakan `.env` atau session WA.

Utility non-paid AI:
- **OCR** via Tesseract lokal (`OCR_COMMAND`)
- **Transkripsi** via Whisper/Vosk lokal (`STT_COMMAND`)
- **Translate** via self-hosted LibreTranslate (`LIBRETRANSLATE_URL`)
- **PDF/ZIP** diproses lokal dengan limit ukuran dan proteksi path traversal

---

## 🏆 Daftar Lengkap Command Bot

### 🎨 Stiker

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/stiker` / `/s` | Ubah gambar/video menjadi stiker WebP | User |
| `/toimg` | Ubah stiker menjadi gambar PNG | User |
| `/brat <teks>` | Stiker brat estetik berlatar putih | User |
| `/brat classic <teks>` | Stiker brat gaya classic | User |
| `/quote <teks>` | Stiker kutipan bergaya gradient | User |
| `/removebg` / `/rbg` | Hapus background gambar | User |
| `/stikerbg` | Gambar tanpa background → stiker | User |
| `/circle` / `/bulat` | Gambar lingkaran → stiker | User |
| `/outline [white/black]` | Tambah outline pada stiker | User |
| `/meme <atas> \| <bawah>` | Overlay teks meme ke gambar | User |
| `/emojimix` / `/mix` 😂+😭 | Gabungkan dua emoji menjadi stiker | User |
| `/vstiker` / `/gifstiker` | Video/GIF → stiker bergerak | User |
| `/batchstiker` | Proses banyak gambar sekaligus | User |

### 📸 Media Tools

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/hd` / `/hd 2x` / `/hd 4x` | Upscale & sharpen gambar | User / Premium |
| `/compress [low/medium/high]` | Kompres gambar/video | User |
| `/resize [preset/WxH]` | Ubah resolusi gambar | User |
| `/crop [story/pp/square]` | Potong gambar dengan rasio preset | User |
| `/wm <teks>` | Sisipkan watermark teks ke gambar/video | User |
| `/togif` | Konversi video ke GIF | User |
| `/thumb [time]` | Ambil thumbnail video | User |
| `/cut [start-end]` | Potong durasi video | User |
| `/subtitle` | Tambah subtitle otomatis ke video | Premium |
| `/mute` | Hapus audio dari video | User |
| `/reverse` | Putar balik video beserta audio | User |

### 🎵 Audio Tools

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/mp3` / `/audio` | Ekstrak audio dari video → MP3 | User |
| `/transkrip` / `/vntext` | Konversi voice note ke teks | User |
| `/tts <teks>` | Teks → file audio (Google TTS) | User |
| `/voice [robot/chipmunk/deep]` | Efek modulasi suara | User |
| `/cutaudio [start-end]` | Potong durasi audio | User |
| `/speed [rate]` / `/slow [rate]` | Ubah kecepatan audio | User |

### 💬 Text & AI

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/ocr` | Ekstrak teks dari gambar (OCR) | User |
| `/translate [lang]` / `/tr` | Terjemahkan teks ke bahasa tujuan | User |
| `/ringkas` / `/summarize` | Ringkas teks panjang | User |
| `/ubah [formal/santai/lucu/...]` | Tulis ulang gaya bahasa | User |
| `/typo` / `/koreksi` | Koreksi kesalahan penulisan | User |
| `/balas [santai/formal/lucu]` | Balasan otomatis berbasis AI | User |
| `/jelaskan <topik>` | Penjelasan topik pelajaran | User |
| `/quiz [sekolah/umum/anime]` | Kuis interaktif belajar mandiri | User |
| `/ai <pertanyaan>` | Chat langsung dengan AI provider | User |
| `/setai <provider>` | Set AI provider grup (owner/admin) | Admin |

### 📄 Dokumen & PDF

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/img2pdf` | Gabungkan gambar menjadi PDF | User |
| `/pdf2img` | Ekstrak halaman PDF menjadi gambar | User |
| `/mergepdf` | Gabungkan beberapa PDF | User |
| `/compresspdf` | Kompres ukuran PDF | User |
| `/scan` | Simulasi scan dokumen | User |
| `/unzip` | Ekstrak ZIP/RAR dengan aman | User |
| `/qr <teks/url>` | Buat QR Code dari teks/link | User |
| `/readqr` | Baca isi QR Code dari gambar | User |
| `/linkscan <url>` | Scan keamanan URL/link (SSRF-safe) | User |

### 👥 Grup & Moderasi

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/setup` | Cek status fitur grup | Admin |
| `/statusfitur` | Detail status feature flags | Admin |
| `/feature <nama> <on/off>` | Toggle fitur grup | Admin |
| `/bot [on/off]` | Aktifkan/nonaktifkan bot di grup | Admin |
| `/setprefix <prefix>` | Ubah prefix command | Admin |
| `/setcooldown <fitur> <detik>` | Atur rate limit fitur | Admin |
| `/warn @user <alasan>` | Beri warning ke member | Admin |
| `/warnings @user` | Cek warning member | Admin |
| `/unwarn` / `/clearwarn` | Kurangi / bersihkan warning | Admin |
| `/addbadword <kata>` | Tambah kata toxic ke filter | Admin |
| `/delbadword <kata>` | Hapus kata dari filter | Admin |
| `/listbadword` | Tampilkan daftar kata diblokir | Admin |
| `/blacklist @user` | Cekal user dari interaksi bot | Admin |
| `/unblacklist @user` | Hapus dari daftar cekal | Admin |
| `/listblacklist` | Tampilkan daftar hitam | Admin |
| `/kick @user` | Keluarkan member | Admin |
| `/mute @user [durasi]` | Mute member sementara | Admin |
| `/unmute @user` | Buka mute member | Admin |
| `/grouplog` | Lihat log aktivitas grup | Admin |
| `/warningrule set <N> <action>` | Atur aksi otomatis saat N warning | Admin |

### 🏫 Komunitas & Sekolah

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/schoolmode [on/off]` | Aktifkan mode sekolah | Admin |
| `/tugasadd <deskripsi> [deadline]` | Tambah tugas/PR | Admin |
| `/tugaslist` | Daftar tugas aktif | User |
| `/tugasdone <id>` | Tandai tugas selesai | Admin |
| `/absen [buka/list/tutup]` | Kelola absensi kehadiran | Admin |
| `/jadwal [add/lihat/hapus]` | Kelola jadwal pelajaran/kegiatan | Admin |
| `/ulang [add/list]` | Daftar ulang tahun anggota | User |
| `/stats` | Statistik aktivitas grup | Admin |
| `/topaktif` | Peringkat member paling aktif | User |
| `/profil [@user]` | Kartu profil & reputasi member | User |
| `/reputasi [@user]` | Skor reputasi & trust level | User |
| `/note [add/list/get/delete]` | Catatan grup / FAQ | Admin |
| `/wiki [add/get/list]` | Wiki konten grup | Admin |
| `/misi` | Daftar misi harian aktif | User |
| `/claimdaily` | Klaim reward misi harian | User |

### 💼 Bisnis & Jual-Beli

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/jual <harga> <deskripsi>` | Pasang iklan jual produk/jasa | User |
| `/beli <id>` | Ekspresikan minat beli produk | User |
| `/listproduk` | Daftar produk aktif di grup | User |
| `/hapusproduk <id>` | Hapus iklan produk sendiri | User |
| `/order add @user <deskripsi>\|<harga>` | Catat pesanan baru | Admin |
| `/order status` | Lihat status pesanan | User |
| `/customer add @user` | Daftarkan customer di CRM | Admin |
| `/escrow create @seller @buyer <jumlah>` | Buat rekening bersama (simulasi) | User |
| `/escrow paid <id>` | Konfirmasi pembayaran escrow | User |
| `/escrow release <id>` | Lepaskan dana escrow | Admin |
| `/kontrak [jualbeli/jasa/sewa]` | Draf template kontrak | User |

### 💰 Keuangan Grup

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/kas saldo` | Cek saldo kas grup | User |
| `/kas masuk <jumlah> [@user]` | Catat pemasukan kas | Admin |
| `/kas keluar <jumlah> <keterangan>` | Catat pengeluaran kas | Admin |
| `/kas laporan` | Laporan kas periode terakhir | User |
| `/kas export` | Export laporan kas ke file | Admin |
| `/split <nominal> @user1 @user2` | Buat split bill rata | User |
| `/splitstatus` | Status pembayaran split bill | User |
| `/splitdone @user` | Tandai bagian lunas | Admin |
| `/tagihan add @user <ket>\|<nominal>` | Buat tagihan iuran ke member | Admin |
| `/tagihan list` | Daftar tagihan aktif | User |
| `/tagihan done <id>` | Tandai tagihan lunas | Admin |
| `/tagihan remind` | Kirim pengingat tagihan belum lunas | Admin |
| `/arisan [join/list/undi]` | Kelola arisan kelompok | User |
| `/catat <nominal> [kategori]` | Catat pengeluaran pribadi | User |
| `/pengeluaran [hariini/bulanini]` | Ringkasan pengeluaran pribadi | User |
| `/budget [add/status]` | Atur & pantau budget bulanan | User |

### 🤖 Otomasi & Workflow

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/var set <nama> <nilai>` | Set variabel kustom grup | Admin |
| `/var get <nama>` | Ambil nilai variabel | User |
| `/var list` | Daftar variabel tersimpan | User |
| `/var delete <nama>` | Hapus variabel | Admin |
| `/auto when <trigger> <action>` | Buat aturan otomasi | Admin |
| `/auto list` | Daftar otomasi aktif | Admin |
| `/auto delete <id>` | Hapus otomasi | Admin |
| `/workflow create <nama>` | Buat workflow multi-langkah | Admin |
| `/workflow list` | Daftar workflow terdaftar | Admin |
| `/workflow delete <nama>` | Hapus workflow | Admin |
| `/rule tambah <aturan>` | Tambah smart rule | Admin |
| `/rule list` | Daftar smart rules | User |
| `/rule delete <id>` | Hapus smart rule | Admin |

### 🔒 Privasi & Data

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/privacymode [strict/balanced/off]` | Atur mode privasi grup | Admin |
| `/retention <scope> <durasi>` | Kebijakan retensi data | Admin |
| `/cleandb [logs/temp/usage] [durasi]` | Bersihkan data lama dari DB | Owner |
| `/mydata` | Lihat data personal tersimpan | User |
| `/deletemydata [konfirmasi]` | Hapus data personal (GDPR) | User |
| `/consent [ai/autosummary/analytics] [on/off]` | Atur consent fitur | User |
| `/generaterules [sekolah/jualbeli/komunitas]` | Generate peraturan dari template | Admin |
| `/rules [edit/version/rollback]` | Kelola versi peraturan grup | Admin |
| `/ruleslog` | Log persetujuan anggota | Admin |
| `/setuju` | Setujui peraturan grup | User |

### 📢 Pengumuman

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/announce <pesan>` | Buat pengumuman resmi bergaya format | Admin |
| `/announcements` | Daftar 10 pengumuman terakhir | User |
| `/announcement <id>` | Detail satu pengumuman | User |

### 🔗 Webhook

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/webhook set <url>` | Daftarkan URL webhook (SSRF-protected) | Owner/Admin |
| `/webhook test` | Kirim test event ke webhook | Owner/Admin |
| `/webhook off` | Nonaktifkan webhook | Owner/Admin |
| `/webhook list` | Lihat webhook terdaftar | Owner/Admin |

### 🎮 Games & Economy

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/tod` / `/truth` / `/dare` | Truth or Dare | User |
| `/tebakkata` | Tebak kata berhadiah XP | User |
| `/suit @user` | Batu Gunting Kertas PvP | User |
| `/ttt @user` | Tic-Tac-Toe multiplayer | User |
| `/slot` | Slot machine virtual | User |
| `/math` | Game matematika cepat | User |
| `/family100` | Kuis survey Family 100 | User |
| `/couple` / `/jodoh` | Cek kecocokan antar member | User |
| `/ww [create/join/start/stop]` | Werewolf game | User |
| `/balance` / `/bal` | Cek saldo & level | User |
| `/claim` / `/daily` | Klaim bonus harian | User |
| `/transfer @user <jumlah>` | Transfer saldo virtual | User |
| `/rank` | Level Card & XP | User |
| `/top` / `/leaderboard` | Top 10 kekayaan | User |
| `/shop` / `/buy <item>` | Toko item virtual | User |
| `/inventory` / `/inv` | Isi tas item | User |
| `/pet [adopt/feed/status/battle]` | Adopsi & rawat hewan peliharaan | User |
| `/dungeon` | Petualangan RPG turn-based | User |
| `/misi` | Misi harian | User |

### 💎 Premium & Sewa

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/sewa [info/status]` | Info & status sewa bot | User |
| `/premium [info/cek]` | Cek status premium | User |
| `/quota` | Cek sisa kuota harian | User |
| `/coupon <kode>` | Redeem kode kupon | User |
| `/referral [kode/stats]` | Kelola kode referral | User |
| `/reseller [daftar/dashboard/saldo]` | Dashboard reseller | Reseller |

### 🛡️ Owner Tools

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/maintenance [on/off]` | Mode pemeliharaan global | Owner |
| `/premium add/remove @user` | Kelola status premium user | Owner |
| `/broadcast <pesan>` | Siarkan pesan ke seluruh grup | Owner |
| `/stats` | Statistik server, queue, error | Owner |
| `/errorlog` | Log error terbaru | Owner |
| `/plugin [list/on/off]` | Manajemen plugin global | Owner |
| `/setquota <grup> <limit>` | Set kuota command harian grup | Owner |
| `/setplan <grup> <plan>` | Ubah plan langganan grup | Owner |
| `/addcoupon <kode> <durasi>` | Buat kode kupon premium | Owner |
| `/addreseller @user` | Tambah akun reseller | Owner |
| `/queue` / `/canceljob` | Monitor & batalkan antrian | Owner |
| `/backup` / `/listbackup` | Backup & restore data | Owner |
| `/cleandb [logs/temp/usage]` | Bersihkan data lama dari DB | Owner |
| `/apikey` / `/revokeapikey` | Kelola API key | Owner |
| `/alias set <alias> <command>` | Buat alias command di grup | Admin |

---

## ⚙️ Feature Flags Grup

Gunakan `/feature <nama> <on/off>` untuk mengaktifkan/menonaktifkan:

| Flag | Deskripsi |
|:-----|:----------|
| `welcome` | Pesan sambutan saat member baru masuk |
| `goodbye` | Pesan perpisahan saat member keluar |
| `antilink` | Blokir tautan luar (kecuali whitelist) |
| `leveling` | XP & naik level dari chat grup |
| `economy` | Sistem uang virtual grup |
| `cleancmd` | Hapus pesan command otomatis setelah dibalas |
| `antispam` | Anti-spam dan anti-flood otomatis |
| `badword` | Filter kata toxic otomatis |
| `schoolmode` | Mode sekolah (jadwal, tugas, absen) |
| `business` | Fitur jual-beli di grup |
| `finance` | Fitur kas dan keuangan grup |

---

## 🧪 Pengujian Sistem (Testing)

```bash
npm run test
```

Test suite (Vitest) mencakup:
- Role-Based Permissions & isOwner
- Rate limiter & antrian
- Level-up, claim ekonomi, XP
- Regex validasi URL downloader
- Dynamic feature flags di SQLite
- Plugin state toggle & API key hashing
- Privacy Mode, Data Retention, Consent
- Webhook SSRF protection
- Automation Builder, Workflow, Smart Rules
- Bisnis, Keuangan, Reseller
- Coupon, Quota, Subscription

**Total: 134+ tests passing**

---

## 🗂️ Arsitektur Database (Prisma)

Model utama yang digunakan:
- `GroupConfig` — Konfigurasi prefix & feature flags per grup
- `UserProfile` — Profil, premium, bahasa, gelar
- `UserEconomy` — Saldo, bank, XP, level
- `GroupSubscription` — Plan sewa & kuota command
- `CustomVariable` — Key-value store fleksibel untuk otomasi, workflow, kas, variabel
- `DataRetentionPolicy` — Kebijakan retensi data per scope
- `Webhook` — URL webhook terdaftar per grup
- `AuditLog` — Log aksi admin & owner
- `PrdStateRecord` — Pengumuman, form, dan state fitur produktivitas
- `WarningRule` — Aturan threshold warning otomatis
- Dan 30+ model lainnya...

---

## PRD Stabilization Layer

Lapisan command coverage aman dari `prd.md`:
- Command belum punya handler khusus otomatis terdaftar dengan fallback aman
- State fitur disimpan di database, bukan source code
- Error user-facing memakai Error ID terenkripsi
- Metadata log di-masking untuk data sensitif

```bash
npm run typecheck   # Validasi TypeScript
npm run test        # Jalankan test suite
npm run build       # Build production
npm run db:push     # Sinkronkan schema database
npm run db:studio   # Buka Prisma Studio
```

Dashboard web: login rate limit, session TTL, cookie `HttpOnly`, CSRF token, host binding via `DASHBOARD_HOST`, health endpoint, API internal opsional dengan `DASHBOARD_API_ENABLED=true`.
