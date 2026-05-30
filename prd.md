# PRD — Bug Fix & Hardening Javas Bot WA

## 1. Ringkasan

Produk: **Javas Bot WA**
Repo: `javasrajagula/javas-bot-wa`
Dokumen: PRD perbaikan bug menyeluruh
Tujuan utama: memperbaiki bug fatal, security issue, reliability issue, command behavior mismatch, dan deployment gap yang ditemukan dari audit kode.

Proyek ini bertujuan membuat bot:

1. Lebih stabil saat dijalankan di production.
2. Aman dari abuse umum seperti SSRF, DoS file besar, credential leak, dan bypass limit.
3. Lebih konsisten antara dokumentasi command dan implementasi.
4. Lebih mudah di-deploy dengan Docker.
5. Lebih mudah di-debug oleh owner/admin.
6. Siap untuk model sewa/premium yang lebih reliable.

---

## 2. Problem Statement

Saat ini Javas Bot WA sudah memiliki banyak fitur, tetapi ada beberapa masalah besar:

1. Konfigurasi database dan Docker belum aman untuk production.
2. Dependency native seperti FFmpeg, ffprobe, Poppler, dan OCR/STT tidak tersedia di Docker default.
3. WhatsApp adapter belum mengirim quoted reply/mention secara benar di semua media type.
4. Reconnect Baileys berisiko membuat listener dobel.
5. Downloader dan utility URL masih punya risiko SSRF/DoS.
6. Queue, rate limit, captcha, maintenance mode, dan state penting masih banyak yang in-memory.
7. Banyak command tidak sesuai klaim fitur, misalnya `removebg`, `outline`, `batchstiker`, `subtitle`, `compresspdf`, dan `pdftext`.
8. Quota, subscription, plugin toggle, warning rules, dan feature flags belum konsisten.
9. Dashboard dan backup butuh validasi tambahan agar aman di production.
10. Worker reminder/temp-admin belum aman untuk multi-instance dan parsing JID tertentu.

---

## 3. Goals

### 3.1 Product Goals

1. Bot dapat berjalan stabil minimal 7 hari nonstop dalam mode Baileys.
2. Bot dapat di-deploy via Docker tanpa kehilangan database dan tanpa fitur media gagal karena binary tidak tersedia.
3. Owner dapat mengetahui masalah runtime lewat command `/doctor`.
4. Admin grup mendapatkan behavior command yang konsisten dengan dokumentasi.
5. Sistem subscription, quota, dan feature flag bekerja sesuai data di database.
6. Fitur berisiko tinggi seperti downloader, screenshot web, PDF, ZIP, dan media processing memiliki guardrail keamanan.

### 3.2 Engineering Goals

1. `npm run build` dan `npm run typecheck` wajib pass.
2. Semua P0 dan P1 bugs ditutup sebelum release production.
3. Tambahkan test minimal untuk validator URL, quota, feature flag parsing, dan command behavior kritikal.
4. Kurangi penggunaan in-memory state untuk flow production-critical.
5. Buat deployment Docker reproducible.

---

## 4. Non-Goals

Untuk fase ini, hal berikut tidak termasuk scope utama:

1. Menambah fitur hiburan baru.
2. Mendesain ulang seluruh arsitektur command.
3. Migrasi penuh ke microservices.
4. Mengganti Baileys dengan library WhatsApp lain.
5. Membuat dashboard frontend modern berbasis React.
6. Membuat AI provider baru.
7. Membuat payment gateway production.

---

## 5. Target User

### 5.1 Owner Bot

Kebutuhan:

* Bot tidak crash.
* Bisa melihat health check.
* Bisa backup/restore dengan aman.
* Bisa mengatur plugin, quota, premium, dan subscription.
* Bisa tahu dependency apa yang belum terpasang.

### 5.2 Admin Grup

Kebutuhan:

* Fitur welcome, moderation, warning, anti-link, anti-spam berjalan konsisten.
* Command admin tidak error karena config rusak.
* Bisa melihat fitur aktif/nonaktif.
* Bisa reset config grup jika terjadi masalah.

### 5.3 User Grup / Private Chat

Kebutuhan:

* Command reply benar-benar reply ke pesan yang dikutip.
* Media command tidak menggantung.
* Error message jelas.
* Premium/quota/cooldown konsisten.

### 5.4 Maintainer / Developer

Kebutuhan:

* Ada test.
* Ada logging aman.
* Ada error ID yang bisa dilacak.
* Ada issue breakdown yang jelas.

---

## 6. Prioritas Release

### Phase 0 — Stabilitas Production Dasar

Wajib selesai sebelum fitur baru.

1. Database & Docker persistence.
2. Native dependency Docker.
3. Baileys adapter quoted reply/mention.
4. Baileys reconnect cleanup.
5. URL security hardening.
6. Build/typecheck pass.
7. `/doctor`.

### Phase 1 — Security & Abuse Prevention

1. SSRF protection menyeluruh.
2. Stream size limit yang benar.
3. Error redaction.
4. Dashboard hardening.
5. Rate limit dan quota race condition.
6. Worker safety.

### Phase 2 — Command Correctness

1. Perbaiki command yang misleading.
2. Validasi media/dimensi/durasi.
3. PDF/ZIP guardrail.
4. Audio mimetype.
5. Feature flag consistency.

### Phase 3 — Maintainability

1. Refactor legacy code path.
2. Durable queue/state.
3. Test coverage.
4. Dokumentasi deployment.
5. Cleanup schema dan env.

---

## 7. Bug Coverage Matrix

Semua bug audit sebelumnya dikelompokkan ke dalam epic berikut.

### Epic A — Database, Docker, dan Runtime Dependency

Mencakup:

* Database provider env tidak sinkron dengan Prisma schema.
* SQLite default tidak persistent di Docker.
* Docker tidak menjalankan migration.
* Docker tidak menyertakan FFmpeg, ffprobe, Poppler, Tesseract/STT.
* Backup hanya mendukung SQLite.
* Restore DB dilakukan saat Prisma masih aktif.
* Dashboard production host mengabaikan `DASHBOARD_HOST`.

### Epic B — WhatsApp Adapter & Message Routing

Mencakup:

* Reconnect Baileys membuat potensi socket/listener dobel.
* `quotedMessageId` tidak benar-benar digunakan.
* Mentions tidak konsisten di image/video/document/sticker.
* Parser pesan terlalu sempit.
* Media buffer concat tidak efisien.
* Media besar diunduh penuh sebelum validasi.
* Processing pesan serial per batch.
* Audio mimetype hard-coded salah.
* JID parsing dengan `:` rentan rusak.

### Epic C — Security Hardening

Mencakup:

* Downloader tidak memvalidasi URL hasil ekstraksi.
* `isSafePublicUrl` tidak melakukan DNS lookup.
* Utility download bebas tanpa SSRF guard.
* SVG injection di `/quote`.
* Error message/stack bisa menyimpan data sensitif.
* Dashboard `/api/status` unauthenticated.
* Dashboard rate limit berbasis `x-forwarded-for` mentah.
* API key dikirim lewat WhatsApp chat.
* ZIP memory pressure.
* Stream download tidak dihentikan saat size limit lewat.
* Timeout helper tidak clear timer saat promise reject.

### Epic D — Permission, Quota, Plugin, Feature Flag

Mencakup:

* `OWNER_IDS` kosong hanya warning.
* `/premium add` parsing target user rapuh.
* Plugin toggle bisa bypass command yang tidak mapped.
* Feature flag tidak konsisten.
* `featuresJson` sering di-parse mentah.
* `maxDailyCmd` tidak dipakai.
* Usage log dicatat sebelum command selesai.
* Quota race condition.
* Warning rule duration tidak dipakai.
* Broadcast hanya ke groupConfig.
* Compound unique nullable berisiko duplikasi.
* Legacy `getFeatureKey` dan `commands` object membingungkan.
* `pluginManager.setPluginStatus()` tidak await DB save.

### Epic E — Queue, State, Worker, Rate Limit

Mencakup:

* Redis env ada tapi queue tetap memory.
* `RedisStateStore` belum benar-benar Redis.
* Queue job hilang saat restart.
* Queue `add()` return sebelum job selesai.
* Active queue job tidak bisa dibatalkan.
* Rate limiter hanya mencakup sedikit feature.
* Maintenance, captcha, pending broadcast, queue, limiter masih in-memory.
* FileStateStore blocking sync write.
* Temp cleanup gagal jika ada folder.
* Reminder worker bisa double-send di multi-instance.
* Reminder status `failed` tidak terdokumentasi.

### Epic F — Media, Sticker, Audio Commands

Mencakup:

* `/removebg` tidak benar-benar remove background.
* `/outline` tidak benar-benar membuat outline.
* Sticker metadata pack/author tidak bekerja.
* `/batchstiker` tidak batch.
* `/stiker` klaim mendukung video tetapi implementasi Sharp.
* `/vstiker` memotong video panjang, bukan menolak sesuai pesan.
* `/emojimix` API hard-coded tanpa timeout.
* `/compress` bisa silent no-op.
* `/resize` tidak membatasi dimensi.
* Timestamp validator menerima waktu tidak masuk akal.
* `/subtitle` bukan subtitle otomatis.
* `/reverse` tidak punya durasi guard.
* TTS memakai HTTP.
* Audio command menulis media ke disk sebelum validasi ukuran.
* `getMediaDuration()` fallback 0 bisa bypass durasi.
* FFmpeg tidak punya timeout.

### Epic G — Document, PDF, ZIP

Mencakup:

* PDF text extraction tidak andal.
* `txtToPdf` hanya satu halaman dan tidak wrap.
* `compresspdf` bukan kompresi nyata.
* `pdf2img` hanya halaman pertama.
* `mergepdf` flow sulit dipakai.
* ZIP handling rentan memory pressure.
* `pdfwatermark` tidak membatasi panjang teks.

### Epic H — Dashboard, Backup, Observability

Mencakup:

* Dashboard broadcast tidak throttle.
* Dashboard premium/subscription minim validasi.
* Auto backup failure hanya console.
* Restore DB perlu safe flow.
* Session dashboard in-memory.
* Health/status perlu diperjelas.
* Perlu `/doctor`, `/fiturstatus`, dan `/repair`.

---

## 8. Functional Requirements

## Epic A — Database, Docker, Runtime Dependency

### A1. Database Provider Consistency

Requirement:

* Sistem harus hanya mendukung database provider yang benar-benar aktif.
* Jika tetap SQLite, hapus/matikan opsi PostgreSQL/MySQL dari env.
* Jika ingin support PostgreSQL/MySQL, buat schema Prisma provider yang sesuai dan dokumentasi migration.

Acceptance Criteria:

* `DATABASE_PROVIDER=postgresql` tidak boleh silently memakai schema SQLite.
* Saat startup, bot menampilkan provider aktif.
* Dokumentasi `.env.example` sinkron dengan implementasi.
* `npm run build` pass.

Priority: P0

---

### A2. Docker SQLite Persistence

Requirement:

* Jika `DATABASE_URL=file:./dev.db`, Docker harus mount path DB tersebut.
* Rekomendasi: ubah default menjadi `file:/app/data/dev.db` atau `file:./data/dev.db`.

Acceptance Criteria:

* Recreate container tidak menghapus DB.
* `docker compose up --build` membuat DB di folder mounted.
* README menjelaskan path DB production.

Priority: P0

---

### A3. Migration at Deploy

Requirement:

* Tambahkan flow migrasi sebelum start production.

Opsi:

1. Entrypoint shell:

   * `npx prisma migrate deploy`
   * `node dist/app.js`
2. Atau dokumentasikan command wajib:

   * `npm run db:migrate`

Acceptance Criteria:

* Container baru dengan DB kosong bisa start tanpa manual schema push.
* Jika migration gagal, app tidak lanjut start.
* Log migrasi jelas.

Priority: P0

---

### A4. Native Dependency Docker

Requirement:

* Docker image production harus menyertakan minimal:

  * `ffmpeg`
  * `ffprobe`
  * `poppler-utils`
  * optional: `tesseract-ocr`
  * optional: fonts untuk Sharp/SVG/FFmpeg drawtext

Acceptance Criteria:

* `/doctor` menampilkan FFmpeg/ffprobe/Poppler tersedia.
* `/vstiker`, `/mp3`, `/pdf2img`, `/thumb` tidak gagal karena binary missing.
* Dockerfile terdokumentasi.

Priority: P0

---

### A5. Backup Provider Awareness

Requirement:

* Backup service harus mendeteksi provider database.
* Untuk SQLite: copy file.
* Untuk PostgreSQL/MySQL: beri error eksplisit atau implement dump command.

Acceptance Criteria:

* Jika DB bukan SQLite, backup tidak memberi pesan misleading.
* Error menyebut provider belum didukung.
* Tidak ada silent failure.

Priority: P1

---

### A6. Safe Restore Flow

Requirement:

* Restore SQLite harus:

  1. Stop incoming command atau aktifkan maintenance lock.
  2. Disconnect Prisma.
  3. Copy DB backup.
  4. Reconnect atau instruksikan restart wajib.
  5. Simpan audit log.

Acceptance Criteria:

* Tidak ada restore saat command lain sedang menulis DB.
* Owner menerima pesan bahwa restart wajib atau restart otomatis dilakukan.
* Safety backup selalu dibuat.

Priority: P1

---

## Epic B — WhatsApp Adapter & Message Routing

### B1. Proper Quoted Reply Support

Requirement:

* Semua `sendMessage`, `sendImage`, `sendVideo`, `sendAudio`, `sendVoiceNote`, `sendDocument`, dan `sendSticker` harus support quoted reply.

Implementation Note:

* `MessageContext` perlu menyimpan raw `WAMessageKey` atau minimal data key lengkap:

  * `remoteJid`
  * `id`
  * `participant`
  * `fromMe`

Acceptance Criteria:

* Jika command dipanggil dengan reply, response bot muncul sebagai reply WhatsApp native.
* Test manual minimal:

  * text reply
  * image reply
  * sticker reply
  * document reply

Priority: P0

---

### B2. Consistent Mentions

Requirement:

* Semua send method yang menerima `mentions` harus meneruskan mentions ke Baileys payload.

Acceptance Criteria:

* Welcome card image mention user dengan benar.
* Goodbye message mention user dengan benar.
* Moderation warning/kick/mute mention user dengan benar.
* Mentions bekerja untuk text, image caption, video caption, document caption jika tersedia.

Priority: P0

---

### B3. Baileys Reconnect Cleanup

Requirement:

* Saat reconnect:

  * Tutup socket lama.
  * Hindari event listener dobel.
  * Simpan reconnect state.
  * Gunakan exponential backoff dengan max delay.
  * Reset attempts saat open.

Acceptance Criteria:

* Setelah 5 kali reconnect, satu pesan hanya diproses satu kali.
* Tidak ada memory leak listener.
* Log reconnect jelas.

Priority: P0

---

### B4. Message Wrapper Parser

Requirement:

* Parser harus unwrap:

  * ephemeralMessage
  * viewOnceMessage
  * viewOnceMessageV2
  * documentWithCaptionMessage
  * editedMessage jika relevan
  * buttons/list response
  * template response
  * reaction ignored dengan aman

Acceptance Criteria:

* Command dalam ephemeral message tetap terbaca.
* Caption dokumen terbaca.
* Button/list response tidak membuat crash.
* Unsupported message type tidak crash.

Priority: P1

---

### B5. Streaming Media Buffer Improvement

Requirement:

* Ganti `Buffer.concat` berulang menjadi array chunks.
* Tambahkan max byte guard saat download media dari Baileys.

Acceptance Criteria:

* File melebihi limit dihentikan sebelum full download.
* Memory usage lebih stabil pada file besar.
* Error user jelas: file terlalu besar.

Priority: P1

---

### B6. Audio MIME Type Correctness

Requirement:

* `sendAudio()` dan `sendVoiceNote()` menerima mime type optional.
* MP3 dikirim sebagai `audio/mpeg`.
* M4A/MP4 audio dikirim sebagai `audio/mp4`.

Acceptance Criteria:

* `/mp3`, `/tts`, `/speed`, `/voice`, `/cutaudio` terkirim dengan MIME benar.
* WhatsApp client bisa play audio normal.

Priority: P1

---

## Epic C — Security Hardening

### C1. Unified Safe URL Validator

Requirement:

* Buat satu fungsi canonical:

  * normalize URL
  * allow protocol `http/https`
  * block localhost/private/multicast/link-local
  * DNS lookup semua address
  * validate redirect chain
  * enforce max redirects
  * optional domain allowlist
  * optional content-type allowlist
  * optional content-length max

Acceptance Criteria:

* Semua downloader, ssweb, checklink, QR URL, document fetch, dan utility download pakai validator ini.
* Test SSRF untuk:

  * `localhost`
  * `127.0.0.1`
  * `169.254.169.254`
  * `10.0.0.1`
  * `192.168.1.1`
  * IPv6 local
  * redirect ke private IP

Priority: P0

---

### C2. Validate Extracted Downloader URLs

Requirement:

* URL hasil ekstraksi dari TikTok/Instagram/YouTube/Facebook/Twitter/etc harus divalidasi sebelum download.

Acceptance Criteria:

* Jika extractor mengembalikan private/local URL, download ditolak.
* Redirect chain tetap dicek.
* Size dan content-type dicek.
* Stream dihentikan jika melewati batas.

Priority: P0

---

### C3. Harden Download Stream

Requirement:

* `downloadUrlToTemp` harus:

  * timeout koneksi dan total download.
  * destroy response stream saat limit lewat.
  * cleanup file partial.
  * reject content-type yang tidak sesuai.
  * reject content-length terlalu besar sebelum download jika tersedia.

Acceptance Criteria:

* File partial terhapus saat gagal.
* Tidak ada stream lanjut setelah reject.
* Error tidak menggantung.

Priority: P0

---

### C4. Escape SVG/XML Input

Requirement:

* Semua user input yang masuk SVG/XML harus di-escape.

Acceptance Criteria:

* `/quote <script>` tidak merusak SVG.
* Karakter `<`, `>`, `&`, `'`, `"` aman.
* Reuse helper `escapeXml`.

Priority: P1

---

### C5. Error Redaction

Requirement:

* Terapkan redaction untuk:

  * error message
  * stack
  * metadata
  * URL query dengan token
  * cookie/session string
  * API key

Acceptance Criteria:

* Error log tidak menyimpan raw token/API key/cookie/password.
* Test redaction untuk key dan value sensitif.
* Dashboard error tidak menampilkan secret.

Priority: P1

---

### C6. Dashboard API Hardening

Requirement:

* `/api/status` harus:

  * tetap public tapi minimal info, atau
  * memerlukan API key jika `DASHBOARD_API_ENABLED=true`.

Acceptance Criteria:

* Tidak membocorkan adapter mode jika konfigurasi secure mode aktif.
* Tambahkan setting `DASHBOARD_PUBLIC_HEALTH`.
* `/health` tetap bisa untuk container health check dengan info minimal.

Priority: P2

---

### C7. Dashboard Rate Limit Trust Proxy

Requirement:

* Jangan percaya `x-forwarded-for` kecuali `TRUST_PROXY=true`.
* Jika false, pakai `remoteAddress`.

Acceptance Criteria:

* Attacker tidak bisa bypass rate limit hanya dengan mengganti header.
* Dokumentasi reverse proxy tersedia.

Priority: P1

---

### C8. Safer API Key Delivery

Requirement:

* `/apikey` tetap bisa membuat key, tetapi:

  * default hanya private chat.
  * jika dipakai di grup, bot menolak dan minta owner ulangi di private chat.
  * optional: kirim warning bahwa WhatsApp bukan secret vault.

Acceptance Criteria:

* API key tidak dikirim ke grup.
* Owner menerima instruksi aman.

Priority: P1

---

## Epic D — Permission, Quota, Plugin, Feature Flag

### D1. Owner Config Validation

Requirement:

* Jika production dan `OWNER_IDS` kosong, bot harus gagal start atau masuk safe mode.
* Di development boleh warning.

Acceptance Criteria:

* `NODE_ENV=production` + `OWNER_IDS=""` membuat startup gagal dengan pesan jelas.
* `NODE_ENV=development` tetap warning.

Priority: P0

---

### D2. Robust JID Normalization

Requirement:

* Buat helper `normalizeJid()` dan `normalizePhone()` canonical.
* Support:

  * `@s.whatsapp.net`
  * `@lid`
  * mention format
  * nomor tanpa suffix
  * device suffix `:xx`

Acceptance Criteria:

* Premium add/remove bekerja untuk JID dan mention.
* Owner check tetap akurat.
* Test berbagai format JID.

Priority: P1

---

### D3. Safe Feature Flag Parsing

Requirement:

* Semua `JSON.parse(featuresJson)` diganti `parseFeatureFlags()`.
* Jika JSON rusak, sistem pakai default dan log warning.

Acceptance Criteria:

* Corrupt `featuresJson` tidak membuat router crash.
* `/repair group` bisa reset config.

Priority: P0

---

### D4. Use `maxDailyCmd`

Requirement:

* Jika `GroupSubscription.maxDailyCmd` terisi, pakai value itu.
* Jika null, fallback:

  * free: 50
  * basic: 200
  * premium: unlimited

Acceptance Criteria:

* Owner bisa set custom quota.
* Quota check membaca DB.

Priority: P1

---

### D5. Transactional Usage & Quota

Requirement:

* Quota check dan usage log harus atomic.
* Usage log dibuat setelah command selesai.
* Simpan:

  * command
  * feature
  * success true/false
  * errorId jika gagal

Acceptance Criteria:

* Concurrent command tidak melewati quota.
* Failed command tercatat sebagai failed.
* Dashboard usage bisa bedakan sukses/gagal.

Priority: P1

---

### D6. Warning Rule Duration

Requirement:

* `WarningRule.duration` harus dipakai untuk mute duration.
* Jika null, fallback 300 detik.

Acceptance Criteria:

* Rule mute 60 detik benar-benar expire 60 detik.
* Pesan bot menyebut durasi sesuai rule.

Priority: P2

---

### D7. Plugin Mapping Completeness

Requirement:

* Semua registered command harus punya metadata plugin valid.
* Jika plugin tidak ditemukan, command dianggap disabled atau build test gagal.

Acceptance Criteria:

* Tidak ada command owner/community/media yang plugin unknown.
* Test registry memastikan semua command punya plugin metadata.
* `isPluginEnabled(unknown)` tidak default true di production.

Priority: P1

---

### D8. Await Plugin DB Save

Requirement:

* `setPluginStatus()` menjadi async dan await DB save.
* UI/command hanya bilang sukses jika file dan DB save berhasil.

Acceptance Criteria:

* Jika DB save gagal, owner mendapat error.
* State memory tidak berbeda dari DB tanpa warning.

Priority: P2

---

## Epic E — Queue, State, Worker, Rate Limit

### E1. Real Redis Support or Remove Redis Claim

Requirement:

* Jika `USE_REDIS=true`, queue dan state harus memakai Redis sungguhan.
* Jika belum implement, hapus opsi Redis dari env/documentation untuk sementara.

Acceptance Criteria:

* `USE_REDIS=true` membuat Redis client connect.
* Jika Redis gagal, startup gagal atau fallback eksplisit.
* Queue job tidak hilang saat restart jika Redis enabled.

Priority: P1

---

### E2. Durable Queue

Requirement:

* Heavy jobs downloader/HD/media harus masuk durable queue di production.
* Simpan job status ke DB/Redis:

  * waiting
  * active
  * completed
  * failed
  * cancelled

Acceptance Criteria:

* Restart bot tidak menghapus waiting jobs.
* `/queue` menampilkan job status benar.
* Active job punya cancellation strategy jika memungkinkan.

Priority: P2

---

### E3. Better Rate Limiter

Requirement:

* Rate limit harus mendukung semua command category:

  * general
  * sticker
  * media
  * document
  * audio
  * downloader
  * games
  * economy
  * AI
* Config bisa diubah lewat owner command.

Acceptance Criteria:

* Command non-sticker tetap bisa dilimit.
* Private bypass dan owner bypass tetap configurable.
* Rate limit dapat memakai Redis jika production.

Priority: P1

---

### E4. Persist Critical State

Requirement:

State berikut tidak boleh purely memory di production:

* maintenance mode
* pending broadcast confirmation
* captcha sessions
* mute/temp mute
* queue job
* rate limiter jika Redis enabled

Acceptance Criteria:

* Restart tidak menghapus maintenance mode.
* Captcha bisa expire dengan benar.
* Pending broadcast bisa expire aman.

Priority: P2

---

### E5. Reminder Atomic Claim

Requirement:

* Worker reminder harus claim reminder sebelum kirim.
* Tambahkan status:

  * pending
  * processing
  * sent
  * failed

Acceptance Criteria:

* Multi-instance tidak double-send reminder.
* Failed reminder punya retry policy atau final failed reason.
* Schema/comment status diperbarui.

Priority: P1

---

### E6. Temp Admin Key Encoding

Requirement:

* Jangan simpan key dengan delimiter raw `:`.
* Gunakan JSON value atau encode base64url untuk groupId/userId.

Acceptance Criteria:

* JID dengan colon/device suffix tidak merusak parsing.
* Temp admin demote target benar.

Priority: P2

---

### E7. Safe FileStateStore

Requirement:

* Ganti sync write dengan async queued write.
* Cleanup expired keys saat load dan berkala.
* Prevent overlapping writes.

Acceptance Criteria:

* High-frequency state update tidak blocking parah.
* File state tidak corrupt saat concurrent set/delete.

Priority: P2

---

## Epic F — Media, Sticker, Audio Commands

### F1. Real Remove Background

Requirement:

* Pilih strategi:

  1. Integrasi API remove.bg/Replicate jika token tersedia.
  2. Local model optional.
  3. Jika tidak tersedia, command harus bilang “fitur belum dikonfigurasi”, bukan pura-pura sukses.

Acceptance Criteria:

* `/removebg` benar-benar menghapus background jika provider aktif.
* Jika provider tidak aktif, user mendapat pesan jelas.
* Tidak lagi menyebut berhasil jika hanya ensure alpha.

Priority: P1

---

### F2. Real Outline Effect

Requirement:

* Implement outline sticker nyata.
* Gunakan alpha mask/dilate/blur/composite.
* Gunakan warna argumen white/black.

Acceptance Criteria:

* `/outline white` menghasilkan outline putih.
* `/outline black` menghasilkan outline hitam.
* Visual berbeda dari input.

Priority: P2

---

### F3. Sticker Metadata

Requirement:

* Implement WebP EXIF metadata untuk pack dan author.
* Atau hapus argumen `pack:` dan `author:` dari UX jika belum bisa.

Acceptance Criteria:

* WhatsApp sticker info menampilkan pack/author.
* Unit test buffer metadata jika memungkinkan.

Priority: P2

---

### F4. Batch Sticker Real Flow

Requirement:

* Implement session batch:

  * `/batchstiker start`
  * user kirim beberapa gambar
  * `/batchstiker done`
* Atau ubah deskripsi command menjadi single sticker.

Acceptance Criteria:

* Batch benar-benar memproses lebih dari satu gambar.
* Ada limit jumlah gambar.
* Ada timeout session.

Priority: P2

---

### F5. Split `/stiker` Image vs Video

Requirement:

* `/stiker` hanya untuk image/sticker.
* `/vstiker` untuk video/gif.
* Jika `/stiker` menerima video, arahkan ke `/vstiker`.

Acceptance Criteria:

* Video di `/stiker` tidak error Sharp.
* Pesan user jelas.

Priority: P1

---

### F6. Video Duration Guard

Requirement:

* Gunakan ffprobe sebelum processing video.
* Jika durasi melebihi batas, tolak atau minta user pilih mode trim.
* Jangan fallback 0 saat ffprobe gagal.

Acceptance Criteria:

* Video panjang ditolak jika command menyebut max duration.
* Jika ffprobe missing, command gagal jelas.
* `/vstiker`, `/togif`, `/reverse`, `/compress`, `/cut`, `/thumb` punya guard.

Priority: P1

---

### F7. FFmpeg Timeout

Requirement:

* Tambahkan timeout dan kill process.
* Config:

  * `FFMPEG_TIMEOUT_SECONDS`
  * default 120 detik

Acceptance Criteria:

* FFmpeg yang menggantung dibunuh.
* Temp file tetap dibersihkan.
* User mendapat error timeout.

Priority: P1

---

### F8. Safer Resize

Requirement:

* Batasi dimensi maksimal:

  * free: 3000x3000
  * premium: 6000x6000
* Batasi total pixel.

Acceptance Criteria:

* `/resize 99999x99999` ditolak.
* Error jelas.

Priority: P1

---

### F9. Timestamp Validation

Requirement:

* Validasi range:

  * seconds/minutes 0-59 untuk MM:SS dan HH:MM:SS.
  * angka raw seconds maksimal sesuai plan.
  * tidak boleh negative.

Acceptance Criteria:

* `99:99:99` ditolak.
* `00:01:30` diterima.
* `90` diterima sesuai konteks.

Priority: P2

---

### F10. Subtitle Command Honesty

Requirement:

Pilih salah satu:

1. Implement subtitle otomatis sungguhan via STT.
2. Rename menjadi `/captiondemo`.
3. Jika STT belum aktif, tolak dengan pesan konfigurasi.

Acceptance Criteria:

* `/subtitle` tidak mengklaim otomatis jika hanya teks statis.
* Jika STT aktif, transkripsi dipakai untuk subtitle.

Priority: P2

---

### F11. TTS HTTPS

Requirement:

* Ubah Google TTS endpoint ke HTTPS atau provider TTS lain.
* Tambahkan timeout.

Acceptance Criteria:

* `/tts` tidak memakai HTTP.
* Request gagal tidak menggantung.

Priority: P2

---

### F12. Audio File Validation

Requirement:

* Validasi ukuran sebelum write temp.
* Validasi media type untuk command audio.
* MIME output sesuai file.

Acceptance Criteria:

* Audio/video terlalu besar ditolak sebelum proses berat.
* `/mp3` hanya menerima video.
* `/voice`, `/speed`, `/slow`, `/cutaudio` hanya menerima audio/video.

Priority: P1

---

## Epic G — Document, PDF, ZIP

### G1. Reliable PDF Text Extraction

Requirement:

* Ganti regex PDF manual dengan library ekstraksi teks yang lebih benar atau external tool.
* Jika tidak bisa ekstrak, beri pesan jujur.

Acceptance Criteria:

* PDF text normal terbaca.
* PDF scanned image memberi pesan “OCR diperlukan”.
* Tidak mengembalikan teks rusak seolah sukses.

Priority: P2

---

### G2. Multi-Page TXT to PDF

Requirement:

* `txtToPdf` harus:

  * wrap long lines
  * create new page
  * support basic font fallback
  * limit total pages

Acceptance Criteria:

* Teks panjang tidak terpotong diam-diam.
* File > batas diberi error.

Priority: P2

---

### G3. Honest PDF Compression

Requirement:

* Jika hanya object stream optimize, ubah pesan menjadi “optimize PDF”.
* Jika ingin compress nyata, implement image downsampling.

Acceptance Criteria:

* `/compresspdf` tidak misleading.
* Output size comparison ditampilkan.
* Jika size tidak turun, beri info.

Priority: P2

---

### G4. PDF to Image Page Selection

Requirement:

* `/pdf2img [page]`
* Default page 1.
* Optional range premium.

Acceptance Criteria:

* `/pdf2img 3` render halaman 3.
* Page out of range ditolak.

Priority: P2

---

### G5. Merge PDF UX

Requirement:

* Buat session merge:

  * `/mergepdf start`
  * kirim beberapa PDF
  * `/mergepdf done`
* Atau dokumentasi flow dua PDF dibuat jelas.

Acceptance Criteria:

* User bisa merge lebih dari 2 PDF.
* Ada limit file dan halaman.
* Session timeout.

Priority: P3

---

### G6. ZIP Guardrail

Requirement:

* Batasi:

  * total ZIP size
  * total uncompressed size
  * number of entries
  * nested directory depth
* Detect suspicious compression ratio.

Acceptance Criteria:

* ZIP bomb sederhana ditolak.
* ZIP dengan ribuan entry ditolak.
* Extract tetap hanya file aman.

Priority: P1

---

### G7. PDF Watermark Validation

Requirement:

* Batasi panjang watermark.
* Escape/control font compatibility.
* Optional opacity/position preset.

Acceptance Criteria:

* Teks terlalu panjang ditolak.
* Watermark tidak membuat PDF gagal.

Priority: P3

---

## Epic H — Dashboard, Backup, Observability

### H1. `/doctor`

Requirement:

Tambahkan command owner:

```text
/doctor
```

Cek:

* Node version.
* DB connection.
* Prisma provider.
* DATABASE_URL persistence risk.
* Baileys adapter mode.
* WhatsApp socket status.
* FFmpeg availability.
* ffprobe availability.
* pdftoppm availability.
* Tesseract availability.
* Temp folder writable.
* Backup folder writable.
* OWNER_IDS configured.
* Dashboard config.
* Redis config jika enabled.
* Queue status.

Acceptance Criteria:

* Output ringkas dengan ✅/⚠️/❌.
* Tidak membocorkan secret.
* Bisa dipakai di private chat owner.

Priority: P0

---

### H2. Startup Health Check

Requirement:

* Saat bootstrap, jalankan health check ringan.
* Jika fatal, stop startup.
* Jika nonfatal, log warning.

Fatal examples:

* Production `OWNER_IDS` kosong.
* DB tidak connect.
* Migration/schema missing.
* Dashboard enabled tanpa password.

Nonfatal examples:

* FFmpeg missing saat media plugin enabled.
* Poppler missing saat document plugin enabled.
* STT command missing saat STT command dipakai.

Acceptance Criteria:

* Log startup jelas.
* Tidak ada silent feature failure.

Priority: P0

---

### H3. `/fiturstatus`

Requirement:

Command admin grup:

```text
/fiturstatus
```

Output fitur aktif/nonaktif dan plan grup.

Acceptance Criteria:

* Admin bisa lihat status fitur.
* Menampilkan prefix, botEnabled, plan, quota.
* Tidak perlu membuka dashboard.

Priority: P2

---

### H4. `/repair group`

Requirement:

Command admin/owner:

```text
/repair group
```

Fungsi:

* Validasi `featuresJson`.
* Reset config rusak.
* Optional reset prefix.
* Optional restore default features.

Acceptance Criteria:

* Config rusak bisa diperbaiki tanpa akses DB manual.
* Ada konfirmasi sebelum destructive reset.

Priority: P1

---

### H5. Dashboard Input Validation

Requirement:

* Validate userId/JID.
* Validate plan enum.
* Validate days finite number.
* Validate broadcast length.
* Throttle dashboard broadcast.

Acceptance Criteria:

* `NaN`, negative days, invalid plan ditolak.
* Broadcast dashboard punya delay per group.
* Error tampil di UI.

Priority: P1

---

### H6. Backup Observability

Requirement:

* Simpan backup result ke DB audit log.
* Jika auto backup gagal, simpan error log.
* `/doctor` menampilkan backup terakhir.

Acceptance Criteria:

* Owner bisa tahu backup terakhir sukses/gagal.
* Auto backup tidak hanya console.

Priority: P2

---

## 9. Non-Functional Requirements

### 9.1 Security

* Semua URL eksternal harus melalui safe URL validator.
* Tidak ada secret raw di logs.
* API key tidak dikirim ke grup.
* Dashboard POST wajib CSRF.
* Dashboard auth harus rate-limited dengan trust proxy config.
* Command heavy harus punya rate limit.

### 9.2 Reliability

* Bot harus recover dari reconnect tanpa duplicate handlers.
* Temp files harus selalu dibersihkan.
* Worker harus aman multi-instance untuk reminder.
* Queue production harus durable atau documented memory-only.

### 9.3 Performance

* Tidak boleh memuat file besar tanpa limit.
* Sharp/FFmpeg/PDF processing harus punya timeout/size/page/duration limit.
* DB query dalam route pesan harus diminimalkan atau di-cache aman.

### 9.4 Observability

* Semua error command punya error ID.
* Usage log mencatat command, success, feature, duration jika memungkinkan.
* `/doctor` dan dashboard memberi status runtime.

---

## 10. Acceptance Test Plan

### 10.1 Build & Startup

* `npm ci`
* `npm run typecheck`
* `npm run build`
* `npx prisma migrate deploy`
* `docker compose up --build`

Expected:

* Semua pass.
* Tidak ada missing binary untuk fitur aktif.
* DB persistent setelah container recreate.

---

### 10.2 WhatsApp Adapter Manual Test

Test cases:

1. Reply `/menu` ke pesan user.
2. Kirim image dengan caption `/stiker`.
3. Reply image dengan `/stiker`.
4. Reply sticker dengan `/toimg`.
5. Welcome message mention user.
6. Kick/warn mention user.
7. Simulasi reconnect 3 kali.

Expected:

* Response native reply benar.
* Mentions benar.
* Tidak ada duplicate response setelah reconnect.

---

### 10.3 Security Test

Test URLs:

* `http://localhost`
* `http://127.0.0.1`
* `http://169.254.169.254`
* `http://10.0.0.1`
* `http://192.168.1.1`
* IPv6 local
* URL public redirect ke private IP
* URL public dengan content-length terlalu besar

Expected:

* Semua unsafe ditolak.
* Safe public media tetap bisa diproses.

---

### 10.4 Quota & Rate Limit Test

Scenario:

* Free group kirim 60 command bersamaan.
* Private free user kirim 25 command.
* Premium user kirim command heavy.
* Owner bypass on/off.

Expected:

* Quota tidak terlewati.
* Usage log success/failure benar.
* Rate limit berlaku sesuai config.

---

### 10.5 Command Correctness Test

Commands:

* `/removebg`
* `/outline`
* `/batchstiker`
* `/subtitle`
* `/compresspdf`
* `/pdftext`
* `/resize 99999x99999`
* `/vstiker` dengan video panjang
* `/reverse` dengan video panjang
* `/tts`

Expected:

* Tidak ada command misleading.
* Jika dependency/provider tidak aktif, pesan user jelas.
* Semua command punya guardrail.

---

## 11. Data Model Changes

### 11.1 UsageLog

Tambahkan/aktifkan pemakaian field:

* `command`
* `success`
* optional future:

  * `durationMs`
  * `errorId`

### 11.2 Reminder

Status resmi:

* `pending`
* `processing`
* `sent`
* `failed`

Tambahan optional:

* `lastError`
* `retryCount`
* `processedAt`

### 11.3 BotSetting

Gunakan untuk state durable:

* `maintenance_mode`
* `rate_limit_config`
* `dashboard_public_health`
* `trust_proxy`

### 11.4 QueueJobRecord

Gunakan untuk durable queue jika Redis belum dipakai penuh:

* `jobId`
* `queue`
* `status`
* `command`
* `groupId`
* `userId`
* `metadataJson`
* `createdAt`
* `updatedAt`
* `expiresAt`

---

## 12. Migration Plan

### Step 1 — Stabilize Config

1. Fix `.env.example`.
2. Fix Docker DB path.
3. Add startup validation.
4. Add `/doctor`.

### Step 2 — Adapter Fix

1. Extend `MessageContext`.
2. Store raw message key.
3. Implement quoted reply for all send methods.
4. Implement reconnect cleanup.

### Step 3 — URL & Download Security

1. Build unified safe URL module.
2. Replace all direct axios URL fetch.
3. Add tests.
4. Harden downloader stream.

### Step 4 — Quota & Logging

1. Move usage log after command execution.
2. Add success/failure.
3. Add transaction/atomic quota handling.
4. Use `maxDailyCmd`.

### Step 5 — Command Fixes

1. Fix high-impact misleading commands.
2. Add file/duration/dimension guard.
3. Fix audio MIME and TTS HTTPS.
4. Improve PDF/ZIP behavior.

### Step 6 — Queue/State

1. Decide Redis implementation or remove claim.
2. Persist maintenance mode.
3. Atomic reminder worker.
4. Safer FileStateStore.

### Step 7 — Dashboard/Backup

1. Validate dashboard forms.
2. Throttle broadcast.
3. Add backup status.
4. Safe restore flow.

---

## 13. Release Criteria

Release boleh dilakukan jika:

1. Semua P0 selesai.
2. Minimal 80% P1 selesai.
3. Tidak ada known security bug P0/P1.
4. Docker deployment berhasil dari fresh clone.
5. `/doctor` tidak menampilkan error fatal.
6. Manual WhatsApp smoke test pass.
7. Build dan typecheck pass.
8. README deployment diperbarui.

---

## 14. Success Metrics

### Stability

* Bot uptime 7 hari tanpa crash.
* Tidak ada duplicate handler setelah reconnect.
* Error command turun minimal 50%.

### Security

* Semua SSRF test ditolak.
* Tidak ada secret raw di error log.
* File besar ditolak sebelum memory spike.

### Product

* Admin bisa self-service `/fiturstatus` dan `/repair`.
* Owner bisa debug lewat `/doctor`.
* Premium/quota lebih konsisten.

### Engineering

* Build/typecheck selalu pass.
* Ada test untuk URL validator, quota, feature parser, JID normalization.
* Docker image bisa dipakai production baseline.

---

## 15. Backlog Issue Breakdown

### P0 Issues

1. Fix Docker SQLite persistence.
2. Add migration entrypoint.
3. Install native dependencies in Docker.
4. Add `/doctor`.
5. Add startup health check.
6. Fix quoted reply support.
7. Fix mention support.
8. Fix Baileys reconnect cleanup.
9. Replace unsafe URL download flow.
10. Validate extracted downloader URLs.
11. Fail startup if production owner missing.
12. Replace raw `JSON.parse(featuresJson)` with safe parser.

### P1 Issues

1. Implement robust JID normalization.
2. Add transactional quota/usage logging.
3. Use `maxDailyCmd`.
4. Add real stream size limit.
5. Add FFmpeg timeout.
6. Fix ffprobe duration failure behavior.
7. Add dashboard input validation.
8. Add dashboard trust proxy config.
9. Prevent API key delivery in group.
10. Harden error redaction.
11. Add reminder atomic claim.
12. Add ZIP bomb guardrail.
13. Fix `/stiker` video handling.
14. Add media dimension limits.
15. Fix audio MIME.
16. Validate audio before temp write.
17. Implement or honestly disable `/removebg`.

### P2 Issues

1. Implement real Redis or remove Redis claim.
2. Persist maintenance mode.
3. Persist captcha/session critical state.
4. Improve rate limiter coverage.
5. Fix `/outline`.
6. Implement sticker metadata.
7. Implement or rename `/batchstiker`.
8. Make `/subtitle` honest or real.
9. Use HTTPS TTS.
10. Improve PDF text extraction.
11. Improve `txtToPdf`.
12. Improve `pdf2img` page selection.
13. Improve backup observability.
14. Await plugin DB save.
15. Use warning rule duration.

### P3 Issues

1. Refactor legacy command registry remnants.
2. Improve merge PDF UX.
3. Add PDF watermark options.
4. Make dashboard session durable if multi-instance needed.
5. Add richer queue dashboard.
6. Add command duration metrics.
7. Improve plugin metadata test coverage.

---

## 16. Risks

1. Fixing Baileys quoted reply may require changing `MessageContext` shape and many call sites.
2. Real Redis queue may be larger than expected.
3. Real remove background requires paid/external provider or local ML dependency.
4. PDF text extraction can be hard for scanned PDFs.
5. Docker native dependency image size will increase.
6. Atomic quota on SQLite can be tricky under concurrency.

---

## 17. Open Questions

1. Apakah production target tetap SQLite atau mau PostgreSQL?
2. Apakah Redis wajib untuk production?
3. Apakah fitur remove background boleh memakai API berbayar?
4. Apakah dashboard akan diekspos publik lewat reverse proxy?
5. Apakah bot akan dijalankan single-instance atau multi-instance?
6. Apakah premium/sewa butuh payment integration nanti?

---

## 18. Recommendation

Urutan kerja yang disarankan:

1. Selesaikan P0 dulu, jangan tambah fitur baru.
2. Setelah itu rilis versi `v1.1.0-hardening`.
3. Lanjut P1 security dan quota.
4. Baru setelah stabil, lanjut fitur baru seperti AI, payment, atau mini-app dashboard.

Prioritas terbesar adalah:

1. Docker + DB persistence.
2. Baileys adapter.
3. URL/downloader security.
4. Runtime dependency health check.
5. Quota/usage correctness.
6. Command misleading fixes.
