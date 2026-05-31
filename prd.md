# PRD: Stabilization & Production Hardening Javas Bot WA

## 1. Ringkasan

Javas Bot WA adalah bot WhatsApp berbasis Node.js, TypeScript, Baileys, Prisma, dan SQLite. Audit kode menemukan beberapa masalah yang dapat berdampak pada runtime, keamanan, reliability, dan kesiapan produksi.

PRD ini mendefinisikan kebutuhan produk dan teknis untuk memperbaiki bug prioritas, memperkuat keamanan, memperjelas dokumentasi, dan membuat sistem lebih siap dipakai pada grup WhatsApp aktif.

## 2. Tujuan

### 2.1 Tujuan Utama

1. Memastikan semua command berjalan konsisten di grup dan private chat.
2. Memperbaiki bug konfigurasi dan state runtime yang menyebabkan fitur tidak bekerja sesuai ekspektasi.
3. Meningkatkan keamanan terhadap SSRF, file deletion berbahaya, brute force dashboard, dan kebocoran data log.
4. Meningkatkan reliability queue, state store, backup, dan job processing.
5. Mengurangi penurunan performa ketika data usage/log semakin besar.
6. Menyamakan dokumentasi dengan implementasi aktual.

### 2.2 Non-Goals

1. Tidak menambah fitur baru besar seperti AI provider baru, payment gateway, atau marketplace eksternal.
2. Tidak mengganti total arsitektur bot.
3. Tidak melakukan redesign UI dashboard besar-besaran.
4. Tidak mengganti Baileys dengan library WhatsApp lain.
5. Tidak membuat multi-tenant SaaS penuh.

## 3. Masalah yang Akan Diselesaikan

### P0 — Critical Runtime Bugs

#### P0.1 Private Chat Command Tidak Dieksekusi

Saat ini flow validasi dan eksekusi command berada terlalu dalam di blok khusus grup. Akibatnya command di private chat bisa berhenti sebelum `registeredCmd.execute()` dijalankan.

**Dampak:**

* `/menu`, `/ai`, `/invoice`, `/premiumguide`, dan command owner di private chat bisa tidak merespons.
* Private quota check menjadi unreachable.
* User experience rusak karena bot terlihat diam.

#### P0.2 Maintenance Mode Tidak Persist Setelah Restart

Maintenance mode disimpan di DB/state store, tetapi router hanya membaca variabel runtime default. Setelah restart, maintenance bisa kembali nonaktif sampai ada proses lain yang memuat state.

**Dampak:**

* Owner mengira bot sedang maintenance, padahal setelah restart user biasa bisa memakai bot.

#### P0.3 Plugin Downloader Tidak Bisa Dimatikan Secara Global

Command downloader memakai metadata plugin `downloader`, tetapi plugin `downloader` tidak ada di daftar plugin awal. Unknown plugin juga dianggap aktif.

**Dampak:**

* Owner tidak benar-benar bisa disable downloader global.
* Sistem plugin tidak fail-safe.

---

### P1 — Security & Production Readiness

#### P1.1 Helper Download Umum Belum Aman dari SSRF

Helper download umum menerima URL langsung tanpa validasi private IP, DNS resolution, timeout kuat, atau size limit.

#### P1.2 `safeDelete()` Bisa Menghapus Path Arbitrary

Fungsi delete menerima path apa pun dan dapat menghapus folder secara recursive tanpa memastikan path berada di direktori temp.

#### P1.3 Dashboard Login Rate Limit Bisa Di-bypass

Dashboard memakai `X-Forwarded-For` tanpa menghormati config `TRUST_PROXY`.

#### P1.4 Log Debug Selalu Mencetak Identitas Chat/User

Adapter Baileys mencetak chat ID, sender ID, dan sender name tanpa cek level log.

---

### P2 — Reliability & Data Durability

#### P2.1 Queue Tetap In-Memory Walaupun Ada Redis Config

Env menyediakan `USE_REDIS` dan `REDIS_URL`, tetapi queue fitur tetap memakai memory queue.

#### P2.2 State Store File Menulis Seluruh State Setiap Mutasi

File state store menyimpan seluruh map ke disk setiap `set/delete`, yang akan berat saat state membesar.

#### P2.3 `ffprobe` Tidak Memiliki Timeout

FFmpeg wrapper punya timeout, tetapi ffprobe duration check belum punya timeout.

#### P2.4 Backup Config Export/Import Tidak Simetris

Export config menyertakan beberapa entity, tetapi import hanya memulihkan sebagian.

---

### P3 — Performance, Schema, dan Dokumentasi

#### P3.1 UsageLog dan Tabel Log Tidak Punya Index Penting

Query harian berdasarkan `groupId`, `userId`, dan `createdAt` dapat menjadi lambat saat data membesar.

#### P3.2 Env Mengaku Mendukung PostgreSQL/MySQL, Tetapi Prisma Hard-coded SQLite

Konfigurasi memberi kesan DB provider dapat diganti, tetapi schema Prisma masih statis SQLite.

#### P3.3 README dan `.env.example` Tidak Konsisten

README memakai default Baileys, `.env.example` memakai console.

#### P3.4 Beberapa Fitur Tidak Sesuai Klaim

Contoh: `/subtitle` diklaim otomatis, tetapi implementasi masih simulasi text overlay.

## 4. Target Pengguna

1. **Owner Bot**

   * Ingin bot stabil, aman, dan dapat dikelola dari dashboard/command.
2. **Admin Grup**

   * Ingin fitur grup, moderation, dan command berjalan konsisten.
3. **User Grup**

   * Ingin bot merespons cepat dan tidak error.
4. **Developer/Maintainer**

   * Ingin struktur kode jelas, testable, dan tidak misleading.

## 5. Requirements

## 5.1 Functional Requirements

### FR-001 — Refactor Router Command

Sistem harus memproses command dengan flow yang sama untuk grup dan private chat.

**Detail:**

1. Parse command dan alias dilakukan untuk semua chat.
2. Group-specific checks hanya dijalankan jika `ctx.isGroup === true`.
3. Private-specific quota check dijalankan jika `ctx.isGroup === false`.
4. Usage log dibuat untuk grup dan private chat.
5. `registeredCmd.execute()` harus selalu tercapai jika command valid dan semua check lolos.

**Acceptance Criteria:**

* `/menu` di private chat mengirim respons.
* `/invoice` di private chat mengirim respons.
* `/maintenance` owner di private chat bekerja.
* Private quota check aktif untuk user non-premium.
* Group command tetap mematuhi feature flag dan subscription.

---

### FR-002 — Persist Maintenance Mode Setelah Restart

Maintenance mode harus dimuat dari DB/state store saat bootstrap.

**Detail:**

1. Saat startup, bot memanggil loader maintenance state.
2. Router memakai function getter, bukan boolean runtime statis.
3. Cache boleh digunakan dengan TTL, tetapi DB tetap source of truth.

**Acceptance Criteria:**

* Aktifkan maintenance.
* Restart bot.
* User non-owner tetap ditolak memakai command.
* Owner tetap bisa memakai command.

---

### FR-003 — Tambahkan Plugin Downloader

Plugin manager harus mengenali plugin `downloader`.

**Detail:**

1. Tambahkan entry plugin `downloader`.
2. Semua command downloader harus terdaftar di plugin tersebut.
3. Unknown plugin tidak boleh otomatis dianggap aktif tanpa warning.
4. Owner dapat disable/enable downloader dari command/dashboard.

**Acceptance Criteria:**

* `/plugin downloader off` membuat `/tt`, `/ig`, `/ytmp3`, dan command downloader lain ditolak.
* `/plugin downloader on` mengaktifkan kembali command.
* Unknown plugin menghasilkan log warning.

---

### FR-004 — Hardening Helper Download

Semua helper download URL harus aman terhadap SSRF dan file besar.

**Detail:**

1. Gunakan URL validator terpusat.
2. Resolve DNS dan blok private IP, localhost, link-local, multicast, cloud metadata IP.
3. Tambahkan timeout.
4. Tambahkan max bytes streaming.
5. Tambahkan allowlist content-type jika fitur membutuhkan.

**Acceptance Criteria:**

* URL `http://127.0.0.1` ditolak.
* URL yang redirect ke private IP ditolak.
* File melebihi limit dihentikan dan temp file dihapus.
* Timeout menghasilkan error yang aman dibaca user.

---

### FR-005 — Hardening Safe Delete

`safeDelete()` harus hanya menghapus file/folder di direktori yang diizinkan.

**Detail:**

1. Tambahkan `safeDeleteTemp(path)` untuk temp-only deletion.
2. Validasi path hasil `path.resolve`.
3. Tolak deletion di luar temp/output/backup directory yang eksplisit diizinkan.
4. Audit semua pemanggil `safeDelete`.

**Acceptance Criteria:**

* Path `../../important` ditolak.
* Path absolut di luar temp ditolak.
* Temp file tetap bisa dihapus.
* Tidak ada recursive delete tanpa allowlist directory.

---

### FR-006 — Redis Queue Implementation

Jika `USE_REDIS=true`, queue harus durable memakai Redis-backed queue.

**Detail:**

1. Buat interface queue tetap sama.
2. Implement Redis/BullMQ queue untuk downloader, HD, dan general.
3. Job status harus konsisten dengan DB.
4. MemoryQueue tetap tersedia untuk development.
5. Dashboard queue menampilkan status dari queue aktif.

**Acceptance Criteria:**

* Dengan `USE_REDIS=false`, MemoryQueue tetap berjalan.
* Dengan `USE_REDIS=true`, job tetap ada setelah restart worker.
* Job failed dapat diretry.
* Queue dashboard menampilkan waiting/active/failed/completed.

---

### FR-007 — Perbaiki Backup Config Import

Import config harus mendukung semua entity yang diekspor.

**Detail:**

1. Import `groups`.
2. Import `subscriptions`.
3. Import `premiumUsers`.
4. Import `warningRules`.
5. Import `shopItems`.
6. Import `achievements`.
7. Validasi versi schema backup.

**Acceptance Criteria:**

* Export lalu import menghasilkan jumlah entity yang sama.
* Import menolak file JSON yang bukan backup config.
* Import tidak menghapus data existing kecuali ada mode explicit overwrite.

---

### FR-008 — Tambahkan Index Database

Tambahkan index untuk query high-frequency.

**Minimal index:**

```prisma
model UsageLog {
  // existing fields
  @@index([groupId, createdAt])
  @@index([userId, groupId, createdAt])
  @@index([feature, createdAt])
}

model GroupLog {
  // existing fields
  @@index([groupId, createdAt])
  @@index([type, createdAt])
}

model Warning {
  // existing fields
  @@index([groupId, userId])
}

model InfractionLog {
  // existing fields
  @@index([groupId, userId, createdAt])
}

model Blacklist {
  // existing fields
  @@index([scope, groupId, userId])
}

model AutoReply {
  // existing fields
  @@index([groupId, trigger])
}
```

**Acceptance Criteria:**

* Migration berhasil.
* Query quota harian tetap benar.
* Command latency tidak memburuk saat UsageLog besar.

---

### FR-009 — Konsistensi JID/User ID

Sistem harus memakai normalisasi JID/user ID yang konsisten.

**Detail:**

1. Buat util `normalizeUserId`, `normalizePhone`, `normalizeGroupId`.
2. Owner check, premium check, admin check, blacklist, warning, usage, dan economy memakai util yang sama.
3. Simpan canonical ID di database untuk user baru.
4. Support Baileys JID dengan suffix device/LID sejauh memungkinkan.

**Acceptance Criteria:**

* Owner tetap terdeteksi walau JID punya suffix.
* Premium user tetap terdeteksi di private dan grup.
* Admin check tidak gagal karena format JID berbeda.

---

### FR-010 — Dashboard Security Patch

Dashboard harus lebih aman untuk production.

**Detail:**

1. Gunakan `TRUST_PROXY` sebelum menerima `X-Forwarded-For`.
2. Kurangi informasi pada endpoint unauthenticated.
3. Tambahkan security headers:

   * `X-Frame-Options: DENY`
   * `X-Content-Type-Options: nosniff`
   * `Referrer-Policy: no-referrer`
   * basic CSP
4. Audit log untuk login sukses/gagal.
5. API broadcast harus rate-limited dan queued.

**Acceptance Criteria:**

* Spoof `X-Forwarded-For` tidak bypass rate limit ketika `TRUST_PROXY=false`.
* `/health` hanya mengembalikan minimal status.
* POST dashboard tanpa CSRF tetap ditolak.
* API broadcast masuk queue dan tercatat audit.

---

### FR-011 — Timeout ffprobe

`getMediaDuration()` harus punya timeout.

**Detail:**

1. Tambahkan env `FFPROBE_TIMEOUT_SECONDS`, default 30.
2. Kill process jika timeout.
3. Return error user-friendly.

**Acceptance Criteria:**

* File corrupt tidak menggantung.
* Timeout tercatat di error log.
* Job queue lanjut ke job berikutnya.

---

### FR-012 — Rapikan Dokumentasi

README dan `.env.example` harus sesuai implementasi.

**Detail:**

1. Jelaskan default mode development: console atau Baileys, pilih satu.
2. Jelaskan requirement FFmpeg dan Poppler.
3. Jelaskan database yang benar-benar didukung.
4. Tandai fitur simulasi seperti `/subtitle` jika belum otomatis sungguhan.
5. Jelaskan Redis queue jika sudah diimplementasikan; jika belum, hapus klaim.

**Acceptance Criteria:**

* User baru dapat setup bot dari README tanpa kebingungan.
* `.env.example` tidak memberi opsi yang belum didukung.
* Semua dependency sistem eksternal tercantum.

## 6. Non-Functional Requirements

### 6.1 Security

1. Semua URL eksternal harus divalidasi sebelum request.
2. Semua file temp harus dibatasi ukuran dan lifetime.
3. Tidak boleh ada log sensitif di production.
4. Dashboard harus aman dari CSRF basic, brute force sederhana, dan information leak.
5. Deletion file harus dibatasi pada allowlisted directories.

### 6.2 Reliability

1. Command valid harus selalu memberi respons atau error aman.
2. Queue production harus durable.
3. Restart bot tidak boleh menghilangkan maintenance mode.
4. Worker error tidak boleh crash seluruh bot.
5. Semua child process harus punya timeout.

### 6.3 Performance

1. Query high-frequency harus memakai index.
2. In-memory map harus punya TTL atau migrasi ke Redis.
3. Fitur heavy media harus punya concurrency limit.
4. Usage log count harian harus tetap cepat pada data besar.

### 6.4 Observability

1. Error harus punya error ID.
2. Queue status harus bisa dilihat dari dashboard/command.
3. Audit log untuk aksi owner penting:

   * maintenance on/off
   * plugin on/off
   * broadcast
   * restore backup
   * dashboard login
   * import config

## 7. Implementation Plan

## Phase 1 — P0 Runtime Fixes

### Tasks

1. Refactor `routeMessage`.
2. Tambah unit test untuk command private chat.
3. Load maintenance mode saat bootstrap.
4. Tambahkan plugin `downloader`.
5. Ubah unknown plugin behavior.

### Deliverable

* Bot dapat menjalankan command private dan group secara konsisten.
* Maintenance persist setelah restart.
* Downloader bisa disable global.

---

## Phase 2 — Security Hardening

### Tasks

1. Hardening helper download.
2. Buat safe temp deletion.
3. Patch dashboard client IP handling.
4. Tambahkan log masking.
5. Tambahkan timeout ffprobe.
6. Audit `/ssweb`, `/qr`, dan layanan pihak ketiga.

### Deliverable

* SSRF protection berlaku konsisten.
* File deletion aman.
* Dashboard lebih aman untuk production.
* Tidak ada log user ID mentah di production.

---

## Phase 3 — Data & Queue Reliability

### Tasks

1. Implement Redis queue saat `USE_REDIS=true`.
2. Tambahkan queue recovery.
3. Tambahkan index Prisma.
4. Improve backup config import.
5. Evaluasi state store file vs Redis.

### Deliverable

* Queue production durable.
* Query usage/log lebih cepat.
* Backup export/import konsisten.

---

## Phase 4 — Documentation & Cleanup

### Tasks

1. Update README.
2. Update `.env.example`.
3. Update command docs.
4. Tambahkan troubleshooting setup.
5. Tandai fitur simulasi atau selesaikan implementasinya.

### Deliverable

* Dokumentasi sesuai kode.
* Setup local dan production lebih jelas.

## 8. Test Plan

### 8.1 Unit Tests

1. `routeMessage`:

   * private valid command executes
   * group valid command executes
   * bot off blocks group except `/bot on`
   * maintenance blocks non-owner
   * maintenance allows owner

2. Permission:

   * owner normalization
   * premium normalization
   * admin detection mock

3. Plugin:

   * known plugin enabled
   * downloader disable blocks command
   * unknown plugin logs warning

4. URL validator:

   * localhost rejected
   * private IP rejected
   * redirect to private IP rejected
   * allowed public platform accepted

5. File utility:

   * delete temp allowed
   * delete outside temp rejected

6. Backup:

   * export/import roundtrip
   * invalid config rejected

### 8.2 Integration Tests

1. Console adapter private chat:

   * `[user1 in user1] /menu`
2. Console adapter group chat:

   * `[user1 in group1] /menu`
3. Maintenance restart simulation.
4. Queue add/process/retry.
5. Dashboard login rate limit.
6. Media timeout behavior.

### 8.3 Manual QA

1. Scan QR and connect Baileys.
2. Test command:

   * `/menu`
   * `/feature`
   * `/plugin downloader off`
   * `/tt <url>`
   * `/maintenance on`
   * `/backup`
   * `/restorebackup`
3. Test dashboard:

   * login
   * toggle plugin
   * view queue
   * broadcast with confirmation

## 9. Success Metrics

1. 100% P0 bugs fixed.
2. Private chat command response success rate > 99%.
3. No known SSRF path through helper download.
4. Queue job loss after restart = 0 when Redis enabled.
5. Daily quota query remains under 100ms on 100k UsageLog rows.
6. Dashboard login brute-force protection cannot be bypassed by spoofed header when `TRUST_PROXY=false`.
7. README setup succeeds on clean machine following documented steps.

## 10. Rollout Plan

### Step 1 — Development Branch

Create branch:

```bash
git checkout -b fix/stabilization-hardening
```

### Step 2 — Implement P0 Fixes

Merge only after tests pass.

### Step 3 — Implement Security Fixes

Prioritize safe URL/file handling before adding any new external-request feature.

### Step 4 — Implement Queue/DB Changes

Run Prisma migration and verify with seeded data.

### Step 5 — Documentation Update

Update README, `.env.example`, and command docs.

### Step 6 — Release

Tag release:

```bash
git tag v1.1.0-stabilization
```

## 11. Risks

### Risk 1 — Refactor Router Bisa Merusak Command Grup

**Mitigation:** tambahkan test sebelum refactor dan snapshot behavior untuk command utama.

### Risk 2 — Redis Queue Menambah Kompleksitas Deployment

**Mitigation:** MemoryQueue tetap default untuk development; Redis hanya aktif bila `USE_REDIS=true`.

### Risk 3 — Normalisasi JID Bisa Mengubah Data Existing

**Mitigation:** buat migration/backfill opsional dan support backward compatibility lookup.

### Risk 4 — Index Migration pada DB Besar Butuh Waktu

**Mitigation:** jalankan migration saat low traffic dan backup database dulu.

## 12. Open Questions

1. Apakah production target tetap SQLite atau ingin resmi support PostgreSQL?
2. Apakah Redis wajib untuk production deployment?
3. Apakah `/subtitle` akan dibuat benar-benar otomatis memakai STT lokal, atau dokumentasinya diubah menjadi simulasi?
4. Apakah layanan pihak ketiga seperti QR API dan screenshot API masih boleh dipakai?
5. Apakah owner dashboard akan tetap bind localhost saja atau akan diekspos publik melalui reverse proxy?

## 13. Definition of Done

PRD ini dianggap selesai diimplementasikan jika:

1. Semua P0 selesai dan lolos test.
2. Security hardening URL/file/dashboard selesai.
3. Queue Redis aktif saat dikonfigurasi.
4. Backup export/import konsisten.
5. Index Prisma ditambahkan.
6. Dokumentasi sudah sesuai implementasi.
7. Tidak ada regression pada command utama:

   * `/menu`
   * `/feature`
   * `/plugin`
   * `/maintenance`
   * `/stiker`
   * `/hd`
   * `/tt`
   * `/backup`
   * `/invoice`
8. Build, typecheck, dan test berjalan sukses:

```bash
npm run typecheck
npm run build
npm test
```
