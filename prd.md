# PRD: Hardening & Stabilization Javas Bot WA

## 1. Ringkasan

Javas Bot WA saat ini memiliki cakupan fitur yang luas, tetapi beberapa fondasi teknis masih perlu diperkuat sebelum bot layak digunakan secara stabil di banyak grup WhatsApp. PRD ini mendefinisikan pekerjaan untuk memperbaiki bug parsing command, konsistensi feature flag, sistem queue, state management, Docker dependency, privacy enforcement, database configuration, observability, dan testing.

Tujuan utama proyek ini adalah membuat bot lebih stabil, aman, mudah dikelola, dan sesuai dengan klaim fitur yang ada di dokumentasi.

## 2. Latar Belakang Masalah

Bot sudah memiliki banyak modul seperti sticker, media, downloader, moderation, economy, school/community, dashboard, privacy, dan queue. Namun hasil audit menemukan beberapa kelemahan utama:

1. Beberapa command masih menganggap prefix hanya satu karakter.
2. Feature flag tidak konsisten karena beberapa command berat memakai `featureFlag: general`.
3. Queue masih berbasis memory sehingga job tidak recoverable setelah restart.
4. State default disimpan ke file JSON lokal dan Redis URL bisa bocor ke log.
5. Prisma hardcode SQLite, sementara env memberi kesan support PostgreSQL/MySQL.
6. Docker image belum memasang dependency sistem seperti FFmpeg, Tesseract, dan Poppler.
7. Privacy mode dan retention policy belum ditegakkan secara global.
8. Dashboard owner masih menyimpan session di memory dan broadcast belum punya throttle.
9. CI/testing belum cukup kuat untuk menjamin stabilitas production.
10. Dokumentasi terlalu menjanjikan dibanding implementasi nyata.

## 3. Tujuan Produk

### 3.1 Tujuan Utama

Meningkatkan Javas Bot WA dari prototype besar menjadi bot yang lebih production-ready untuk penggunaan nyata di grup WhatsApp.

### 3.2 Tujuan Spesifik

* Semua command harus bekerja dengan prefix custom sepanjang 1–4 karakter.
* Admin grup harus bisa mengaktifkan atau menonaktifkan fitur secara akurat.
* Queue untuk task berat harus tahan restart dan dapat dipantau.
* State sementara seperti captcha, mute, cooldown, dan chat mode harus aman dan scalable.
* Docker deployment harus langsung mendukung fitur media, audio, OCR, dan PDF.
* Privacy mode harus benar-benar mempengaruhi logging, AI, analytics, dan retensi data.
* Dashboard owner harus lebih aman, memiliki audit trail, dan tidak rawan broadcast spam.
* CI harus mendeteksi bug parsing, permission, feature flag, queue, dan build sejak awal.

## 4. Non-Goals

Hal berikut tidak termasuk dalam scope fase awal:

* Menambah fitur baru seperti game baru, downloader baru, atau AI provider baru.
* Mengubah UI dashboard menjadi SPA modern.
* Membuat mobile app.
* Membuat sistem pembayaran otomatis penuh.
* Migrasi penuh ke microservices.
* Menjamin kompatibilitas semua platform downloader pihak ketiga jika upstream berubah.

## 5. Stakeholder

* Owner bot
* Admin grup
* User biasa
* Premium user
* Maintainer/developer bot
* Operator server/deployment

## 6. Persona dan Kebutuhan

### 6.1 Owner Bot

Owner membutuhkan bot yang stabil, tidak mudah crash, aman, mudah dipantau, dan bisa dikelola dari dashboard.

### 6.2 Admin Grup

Admin membutuhkan kontrol fitur yang jelas. Jika fitur dimatikan, command terkait harus benar-benar tidak bisa dipakai.

### 6.3 User Biasa

User membutuhkan command yang konsisten, error message yang jelas, dan bot yang tidak lambat.

### 6.4 Operator Server

Operator membutuhkan deployment Docker yang lengkap, log yang jelas, health check yang benar, dan backup yang aman.

## 7. Scope Fitur

## 7.1 P0 — Critical Fixes

### 7.1.1 Command Parsing Refactor

#### Masalah

Beberapa command mengambil command name dari `ctx.body` dengan `slice(1)`, sehingga prefix custom lebih dari satu karakter akan merusak parsing.

#### Requirement

* Router harus menjadi satu-satunya tempat parsing command.
* `MessageContext` atau parameter executor harus membawa:

  * `prefix`
  * `commandName`
  * `rawCommandName`
  * `args`
* Semua command handler tidak boleh parsing ulang command dari `ctx.body`.
* Prefix 1–4 karakter harus didukung konsisten.

#### Acceptance Criteria

* Prefix `/`, `!`, `!!`, `.`, dan `#` berhasil untuk semua command.
* Test unit command parser mencakup prefix custom.
* Tidak ada command handler utama yang memakai pola `slice(1)` untuk menentukan command name.

---

### 7.1.2 Feature Flag Normalization

#### Masalah

Beberapa command berat memakai `featureFlag: general`, sehingga tidak bisa dikontrol secara akurat oleh admin.

#### Requirement

* Setiap command harus memiliki metadata:

  * `category`
  * `plugin`
  * `featureFlag`
  * `rateLimitKey`
  * `minRole`
  * `premiumOnly`
* Command media harus memakai feature flag spesifik seperti:

  * `media`
  * `media_compress`
  * `media_resize`
  * `media_video`
  * `document`
  * `audio`
  * `downloader`
* `general` hanya boleh dipakai untuk command ringan seperti `menu`, `help`, `status`, dan command informasi dasar.
* `/feature` harus menampilkan command apa saja yang terdampak oleh setiap flag.

#### Acceptance Criteria

* Menonaktifkan fitur `media` membuat command media tidak bisa dipakai.
* Menonaktifkan fitur `downloader` membuat semua downloader tidak bisa dipakai.
* Test memastikan setiap command non-general memiliki feature flag valid.
* Dokumentasi command otomatis sesuai metadata terbaru.

---

### 7.1.3 Production Queue dengan Redis/BullMQ

#### Masalah

Queue masih berbasis memory. Job hilang saat restart dan tidak recoverable.

#### Requirement

* Implementasikan adapter queue:

  * `MemoryQueue` untuk development/test.
  * `RedisQueue` berbasis BullMQ untuk production.
* Queue dipilih lewat env:

  * `QUEUE_DRIVER=memory|redis`
* Job harus serializable, tidak boleh menyimpan closure sebagai proses utama.
* Setiap job harus memiliki:

  * `jobId`
  * `type`
  * `payload`
  * `status`
  * `attempts`
  * `createdAt`
  * `updatedAt`
  * `error`
* Worker harus bisa resume job setelah restart.
* Dashboard queue harus menampilkan waiting, active, completed, failed, dan retryable jobs.

#### Acceptance Criteria

* Downloader job tetap tercatat setelah restart.
* Failed job bisa diretry dari command owner/dashboard.
* Queue tidak kehilangan job saat process crash.
* Test integration Redis queue tersedia.

---

### 7.1.4 Docker Runtime Dependencies

#### Masalah

Docker image belum memasang FFmpeg, FFprobe, Tesseract, dan Poppler, padahal fitur media/OCR/PDF membutuhkannya.

#### Requirement

Dockerfile production harus memasang dependency berikut:

* `ffmpeg`
* `ffprobe`
* `tesseract-ocr`
* `poppler-utils`
* `ca-certificates`
* font dasar untuk rendering teks/media

`docker-compose.yml` harus mount:

* `./data:/app/data`
* `./wa-session:/app/wa-session`
* `./temp:/app/temp`
* `./output:/app/output`
* `./backups:/app/backups`

#### Acceptance Criteria

* `/checkdeps` menunjukkan FFmpeg, FFprobe, Tesseract, dan Poppler tersedia di container.
* Fitur sticker video, audio, OCR, dan PDF berjalan di Docker tanpa instalasi manual.
* Backup tidak hilang setelah container recreate.

---

## 7.2 P1 — Security & Privacy Hardening

### 7.2.1 Privacy Mode Enforcement

#### Masalah

Privacy mode saat ini lebih banyak berupa konfigurasi, belum menjadi policy global.

#### Requirement

Buat `PrivacyPolicyService` yang dipakai oleh:

* Logger
* Usage analytics
* AI commands
* Auto summary
* Dashboard
* Export data
* Retention worker

Mode privacy:

#### Strict

* Tidak menyimpan isi pesan user.
* Metadata user dimasking.
* AI analytics dan auto-summary default off.
* Error log tidak boleh menyimpan argumen mentah.
* Usage log hanya menyimpan command category, bukan full command atau args.

#### Balanced

* Menyimpan metadata minimum.
* Tidak menyimpan isi pesan kecuali dibutuhkan fitur aktif.
* Error log menyimpan error teknis tanpa data sensitif.

#### Off

* Mode normal, tetap dengan masking credential dan token.

#### Acceptance Criteria

* Saat strict mode aktif, error log tidak berisi pesan asli user.
* Saat strict mode aktif, AI chat mode tidak berjalan kecuali user consent aktif.
* `/mydata` dan `/deletemydata` membaca policy yang sama.
* Test privacy mode mencakup strict, balanced, off.

---

### 7.2.2 Retention Worker

#### Masalah

Retention policy bisa disimpan, tetapi perlu worker yang benar-benar membersihkan data.

#### Requirement

Buat worker `retention.worker.ts` yang berjalan periodik dan membersihkan:

* `UsageLog`
* `AuditLog`
* `GroupLog`
* `ErrorLog`
* temporary state
* temp/output files
* data lain sesuai `DataRetentionPolicy`

Worker harus mendukung durasi:

* `1h`
* `6h`
* `24h`
* `7d`
* `30d`
* `90d`
* `off`

#### Acceptance Criteria

* Data lebih lama dari policy terhapus otomatis.
* Worker mencatat audit log ringkas setelah cleanup.
* `/retention` menampilkan waktu cleanup terakhir.
* Test memastikan data lama terhapus dan data baru tetap ada.

---

### 7.2.3 Dashboard Security Improvements

#### Masalah

Dashboard menyimpan session di memory dan login rate limit bergantung pada IP request.

#### Requirement

* Session dashboard bisa disimpan di Redis jika tersedia.
* Tambahkan `TRUST_PROXY` handling yang benar.
* Jangan percaya `x-forwarded-for` kecuali `TRUST_PROXY=true`.
* Tambahkan security headers:

  * `Content-Security-Policy`
  * `X-Frame-Options`
  * `X-Content-Type-Options`
  * `Referrer-Policy`
* Broadcast harus memiliki:

  * preview
  * confirm
  * throttle per pesan
  * batas panjang pesan
  * audit log
  * dry run mode

#### Acceptance Criteria

* Login rate limit tidak bisa dibypass dengan spoof header saat `TRUST_PROXY=false`.
* Broadcast mengirim pesan dengan delay aman.
* Session tetap valid setelah restart jika Redis session enabled.
* Semua POST dashboard wajib CSRF.

---

### 7.2.4 Secret & Credential Safety

#### Masalah

Credential seperti Redis URL berpotensi tercetak ke log.

#### Requirement

* Semua log env/URL harus dimasking.
* Buat helper `maskSecret()` untuk:

  * API key
  * Redis URL
  * dashboard token
  * WA JID
  * phone number
* Preflight check tidak boleh mencetak secret mentah.
* Tambahkan secret scanning di CI.

#### Acceptance Criteria

* Tidak ada log yang menampilkan password Redis/API key.
* CI gagal jika ada `.env`, session WA, token, atau API key ter-commit.
* `.gitignore` mencakup semua direktori sensitif dan output.

---

## 7.3 P1 — Stability & Scalability

### 7.3.1 State Store Improvements

#### Masalah

Default `FileStateStore` menulis seluruh state ke JSON file dan tidak cocok untuk banyak state.

#### Requirement

* Tambahkan `STATE_DRIVER=file|redis|memory`.
* Production default harus Redis jika `NODE_ENV=production`.
* File state hanya untuk development.
* Redis state tidak boleh menggunakan `KEYS` untuk operasi umum; gunakan prefix index atau `SCAN`.
* Tambahkan TTL untuk semua state sementara:

  * captcha
  * mute
  * cooldown
  * chatmode temporary
  * wizard session
  * game session temporary

#### Acceptance Criteria

* Tidak ada state sementara tanpa TTL kecuali memang permanen.
* Redis tidak memakai `KEYS` di path production.
* State captcha/mute/chatmode tetap konsisten setelah restart jika Redis aktif.

---

### 7.3.2 Database Provider Clarity

#### Masalah

Env memberi opsi `DATABASE_PROVIDER`, tetapi Prisma schema hardcode SQLite.

#### Requirement

Pilih salah satu pendekatan:

#### Opsi A — SQLite Only

* Hapus `DATABASE_PROVIDER`.
* Dokumentasikan SQLite sebagai database resmi.
* Tambahkan rekomendasi backup dan limitation.

#### Opsi B — Multi Database

* Buat schema/migration untuk PostgreSQL sebagai production default.
* SQLite hanya untuk development.
* Dokumentasikan migrasi dari SQLite ke PostgreSQL.

Rekomendasi: gunakan Opsi B jika targetnya production banyak grup.

#### Acceptance Criteria

* Konfigurasi database tidak misleading.
* CI menjalankan test minimal untuk provider yang didukung.
* Dokumentasi setup database sesuai realita.

---

### 7.3.3 Media Processing Guardrails

#### Masalah

File kecil bisa tetap membuat CPU/RAM berat jika resolusi/durasi/frame terlalu besar.

#### Requirement

Sebelum proses media berat, lakukan preflight:

* Ukuran file
* MIME type
* Resolusi gambar
* Durasi video/audio
* Frame count atau estimasi durasi
* Batas output size
* Timeout per command

Batas awal:

* Image free: max 10MB, max 4096x4096
* Image premium: max 50MB, max 8192x8192
* Video free: max 10MB, max 60 detik
* Video premium: max 50MB, max 10 menit
* FFmpeg timeout default: 120 detik
* Sharp timeout/concurrency dibatasi

#### Acceptance Criteria

* Media oversized ditolak sebelum diproses.
* FFmpeg timeout menghasilkan error user-friendly.
* Bot tidak crash saat diberi media besar/aneh.
* Test fixture mencakup image besar, video panjang, dan file invalid.

---

## 7.4 P2 — Observability & Developer Experience

### 7.4.1 Health Check yang Lebih Akurat

#### Masalah

`/health` hanya mengembalikan `ok: true`, belum mengecek dependency.

#### Requirement

Tambahkan endpoint:

* `/health/live`
* `/health/ready`
* `/api/status`

Readiness harus mengecek:

* Database connection
* Redis connection jika dipakai
* WhatsApp socket status
* Queue worker status
* Disk free space
* Dependency system status cache

#### Acceptance Criteria

* `/health/live` tetap ok selama process hidup.
* `/health/ready` gagal jika DB/Redis/WA belum siap.
* Docker healthcheck memakai `/health/ready`.

---

### 7.4.2 Structured Logging

#### Requirement

* Gunakan logger terpusat berbasis Pino.
* Semua log harus memiliki:

  * level
  * scope
  * requestId atau messageId
  * groupId masked
  * userId masked
  * command
  * errorId jika ada
* Console log langsung dikurangi.

#### Acceptance Criteria

* Error command punya `errorId`.
* Log tidak berisi credential.
* Dashboard error page bisa membuka detail error berdasarkan `errorId`.

---

### 7.4.3 Testing & CI Upgrade

#### Requirement

Tambahkan test untuk:

* Command parser
* Prefix custom
* Feature flag enforcement
* Permission owner/admin/premium/user
* Privacy mode
* Retention worker
* Queue retry/recovery
* URL validator
* Media validator
* Dashboard auth/CSRF
* Docker build

CI harus menjalankan:

* `npm ci`
* `prisma generate`
* `npm run typecheck`
* `npm run lint`
* `npm run test`
* `npm run build`
* Docker build
* Dependency audit
* Secret scan

#### Acceptance Criteria

* Coverage minimal 70% untuk core modules.
* Pull request gagal jika parser/feature flag/permission test gagal.
* Docker image berhasil build di CI.

---

## 8. UX dan Behavior Requirements

### 8.1 Error Message

Bot harus memberi error message yang:

* Singkat
* Tidak membocorkan stack trace
* Memberi solusi jika user bisa memperbaiki input
* Menyertakan Error ID untuk masalah sistem

Contoh:

```text
❌ Media terlalu besar untuk paket FREE.
Batas: 10MB. Coba kompres file atau gunakan paket Premium.
```

### 8.2 Admin Feedback

Saat admin menonaktifkan fitur:

```text
✅ Fitur media dinonaktifkan.
Command terdampak: /compress, /resize, /crop, /wm, /togif, /thumb, /cut, /mute, /reverse
```

### 8.3 Dashboard Feedback

Broadcast harus menampilkan:

* Jumlah grup target
* Estimasi durasi pengiriman
* Preview isi pesan
* Tombol confirm
* Log hasil pengiriman

---

## 9. Technical Design Overview

### 9.1 Command Routing Baru

Buat tipe baru:

```ts
interface ParsedCommand {
  prefix: string;
  rawCommandName: string;
  commandName: string;
  args: string[];
  isCommand: boolean;
}
```

Router menghasilkan `ParsedCommand`, lalu menyimpannya di context:

```ts
ctx.command = parsedCommand;
```

Command handler menggunakan:

```ts
ctx.command.commandName
ctx.command.args
ctx.command.prefix
```

Bukan parsing ulang `ctx.body`.

---

### 9.2 Queue Driver

Interface:

```ts
interface QueueDriver {
  add(type: string, payload: unknown, options?: QueueOptions): Promise<string>;
  retry(jobId: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
  getStatus(jobId: string): Promise<JobStatus>;
  list(filter?: QueueFilter): Promise<QueueJobInfo[]>;
}
```

Driver:

* `MemoryQueueDriver`
* `RedisQueueDriver`

Worker memproses berdasarkan `type`, bukan closure:

```ts
switch (job.type) {
  case 'downloader':
    return processDownloaderJob(job.payload);
  case 'media:hd':
    return processHdJob(job.payload);
}
```

---

### 9.3 Privacy Policy Service

Interface:

```ts
interface PrivacyPolicy {
  mode: 'strict' | 'balanced' | 'off';
  canStoreMessageContent: boolean;
  canStoreMetadata: boolean;
  canUseAi: boolean;
  shouldMaskUserId: boolean;
}
```

Semua logger dan command sensitif wajib memanggil:

```ts
const policy = await privacyPolicyService.getPolicy(groupId, userId);
```

---

### 9.4 Retention Worker

Worker berjalan setiap 1 jam:

```ts
startRetentionWorker({
  intervalMs: 60 * 60 * 1000
});
```

Worker membaca `DataRetentionPolicy`, menghitung cutoff, lalu membersihkan data sesuai scope.

---

## 10. Metrics Keberhasilan

### Stability

* Crash rate turun minimal 80%.
* Tidak ada lost job setelah restart.
* Command error rate turun minimal 50%.

### Security

* Tidak ada secret di log.
* Semua POST dashboard lolos CSRF check.
* Privacy strict mode tidak menyimpan isi pesan.

### Product

* 100% command memakai metadata valid.
* 100% command berjalan dengan prefix custom.
* Admin bisa melihat daftar command terdampak per feature flag.

### Deployment

* Docker image bisa menjalankan `/checkdeps` sukses.
* Backup dan data tetap ada setelah container recreate.

## 11. Milestone

### Milestone 1 — Core Routing & Feature Flags

Estimasi scope:

* Refactor command parsing.
* Tambahkan `ctx.command`.
* Update semua command handler.
* Normalisasi metadata command.
* Tambahkan test parser dan feature flag.

Deliverable:

* Prefix custom stabil.
* Feature flag akurat.

### Milestone 2 — Queue & State Production

Estimasi scope:

* Tambahkan queue driver.
* Implementasi Redis/BullMQ queue.
* Refactor downloader/media jobs.
* Tambahkan state driver.
* Hilangkan Redis `KEYS` dari path production.

Deliverable:

* Job recoverable.
* State scalable.

### Milestone 3 — Docker & Dependency Hardening

Estimasi scope:

* Update Dockerfile.
* Update docker-compose volumes.
* Tambahkan Docker healthcheck.
* Perbaiki `.gitignore`.
* Tambahkan check dependency di CI.

Deliverable:

* Docker siap menjalankan fitur media/OCR/PDF.

### Milestone 4 — Privacy, Retention, Dashboard Security

Estimasi scope:

* Implementasi `PrivacyPolicyService`.
* Implementasi retention worker.
* Dashboard Redis session.
* Broadcast throttle.
* Security headers.
* Audit log tambahan.

Deliverable:

* Privacy mode enforceable.
* Dashboard lebih aman.

### Milestone 5 — Observability & Testing

Estimasi scope:

* Structured logging.
* Health readiness.
* Test coverage core.
* Secret scan.
* Docker build CI.
* Documentation cleanup.

Deliverable:

* Bot lebih mudah dipantau dan lebih aman untuk kontribusi jangka panjang.

## 12. Risiko

### Risiko 1: Refactor command parser merusak banyak command

Mitigasi:

* Tambahkan compatibility layer sementara.
* Update command per kategori.
* Jalankan test parser sebelum merge.

### Risiko 2: Redis/BullMQ menambah kompleksitas deployment

Mitigasi:

* Tetap dukung memory driver untuk development.
* Dokumentasi docker-compose Redis.
* Default production memakai Redis.

### Risiko 3: Privacy enforcement mempengaruhi fitur analytics

Mitigasi:

* Definisikan policy per mode secara jelas.
* Tambahkan fallback jika data tidak tersedia.
* Tampilkan status privacy di `/statusfitur`.

### Risiko 4: Docker image membesar

Mitigasi:

* Gunakan slim image.
* Bersihkan apt cache.
* Dokumentasikan optional image variant jika perlu.

## 13. Dokumentasi yang Harus Diupdate

* `README.md`
* `.env.example`
* `docs/commands.md`
* `docs/deployment-docker.md`
* `docs/privacy.md`
* `docs/feature-flags.md`
* `docs/queue.md`
* `docs/troubleshooting.md`

## 14. Definition of Done

PRD ini dianggap selesai jika:

* Semua P0 selesai dan lolos CI.
* Semua command berjalan dengan prefix custom.
* Feature flag sesuai metadata command.
* Queue production memakai Redis/BullMQ dan bisa recovery.
* Docker image memiliki dependency media/OCR/PDF.
* Privacy strict mode tidak menyimpan isi pesan user.
* Retention worker berjalan otomatis.
* Dashboard memiliki CSRF, security headers, throttle broadcast, dan session yang bisa persistent.
* Test core minimal mencakup parser, permission, feature flag, privacy, queue, URL validator, dan media validator.
* README diperbarui agar klaim fitur sesuai implementasi nyata.

## 15. Prioritas Implementasi Teknis

Urutan kerja yang disarankan:

1. Command parser refactor.
2. Metadata dan feature flag normalization.
3. Rate limit normalization.
4. Redis/BullMQ queue.
5. State driver dan Redis hardening.
6. Docker dependency update.
7. Privacy policy service.
8. Retention worker.
9. Dashboard security dan broadcast throttle.
10. Observability dan CI hardening.
11. Dokumentasi ulang.
