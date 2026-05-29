# Javas Bot WA Roadmap Execution Plan

Dokumen ini merupakan panduan implementasi bertahap untuk meningkatkan keandalan, keamanan, dan fungsionalitas Javas Bot WA tanpa ketergantungan pada AI berbayar.

---

## 1. Ringkasan Arsitektur Saat Ini

Bot ini menggunakan arsitektur berbasis TypeScript, Prisma, dan library Baileys (`@whiskeysockets/baileys`) untuk menghubungkan dan berinteraksi dengan API WhatsApp.

* **Entrypoint (`src/app.ts`)**: Menginisialisasi koneksi database via Prisma, mem-boot game engine Werewolf, memulai pembersihan file sementara, memilih adapter (Baileys untuk WhatsApp, Console untuk simulasi CLI), dan menyambungkan event handler pesan ke routing utama.
* **Routing Command (`src/commands/index.ts`)**: Mengevaluasi pesan masuk untuk fitur anti-spam, anti-link, badword, dan leveling/XP, lalu mencocokkan input command dengan command yang terdaftar secara dinamis via `registerCommand()`.
* **Command Registration**: Setiap file command mendaftarkan dirinya secara manual dengan memanggil `registerCommand()` di akhir filenya (misalnya di `src/commands/sticker/sticker.command.ts`).
* **Adapter Pattern**: Mengabstraksi socket Baileys/Console via interface `WhatsAppAdapter` (`src/bot/baileys.adapter.ts` & `src/bot/console.adapter.ts`).
* **Database Layer**: Menggunakan SQLite lokal via Prisma client (`prisma/schema.prisma`).

---

## 2. Risiko Utama & Mitigasi

1. **FFmpeg Shell Execution & Command Injection**:
   * *Risiko*: Fitur video-to-sticker (`/vstiker`) menggunakan string concatenation langsung dengan input pengguna (`exec` / `execPromise`) yang rentan terhadap eksekusi command shell berbahaya (command injection).
   * *Mitigasi*: Refaktor seluruh pemrosesan eksternal untuk menggunakan `spawn` atau `execFile` dengan array argument yang ter-sanitize penuh.
2. **Rate Limiting In-Memory**:
   * *Risiko*: Sistem rate limit saat ini menggunakan memori runtime lokal, sehingga data cooldown akan hilang jika bot mengalami restart atau crash.
   * *Mitigasi*: Implementasikan model penyimpanan persisten (Prisma / optional Redis) untuk cooldown penting.
3. **Pemberian Detail Stack Trace ke Chat**:
   * *Risiko*: Kesalahan eksekusi command saat ini dikirim langsung sebagai respons pesan yang berisi stack trace teknis/informasi sensitif database.
   * *Mitigasi*: Menangkap semua error di routing utama, mencatat detailnya di database `ErrorLog`, dan membalas user dengan pesan error generik yang ramah.
4. **Dependensi Pihak Ketiga (Paid AI)**:
   * *Risiko*: Keinginan untuk mengintegrasikan OCR, STT, terjemahan, dan moderasi cerdas yang biasanya memakan biaya API berbayar.
   * *Mitigasi*: Gunakan library offline lokal seperti Tesseract, Vosk/Whisper offline model, LibreTranslate self-hosted API, atau parser scoring berbasis TextRank.

---

## 3. Urutan Fase Implementasi (Phase Order)

1. **FASE 1: Command Metadata Registry**
   * Mengintegrasikan satu sumber kebenaran (source of truth) untuk seluruh command, aliases, kategori, flags, role minimal, dan rate limit.
2. **FASE 2: Secure Error Handling and Logging**
   * Mengubah mekanisme respons error di router agar aman dan mencatat stack trace hanya di database `ErrorLog`.
3. **FASE 3: Secure FFmpeg and Media Processing**
   * Mengamankan eksekusi FFmpeg menggunakan `spawn`/`execFile` dan memvalidasi tipe file media serta argumen masukan.
4. **FASE 4: Audio and Voice Note Support**
   * Meningkatkan penanganan format audio WhatsApp (`audioMessage`, `ptt`), menambahkan metode adapter baru untuk audio/PTT, dan mengintegrasikan offline STT.
5. **FASE 5: Dynamic Menu and Help System**
   * Membaca registri metadata dari Fase 1 secara dinamis untuk menyusun menu sesuai kategori dan role user saat ini.
6. **FASE 6 s/d FASE 17**: Implementasi fitur lanjutan secara incremental (cooldown persisten, anti-spam/antilink, warning/infraction system, group logs, scheduler, dll).

---

## 4. Rencana Migrasi (Migration Plan)

* **Registrasi Command Lama**: Sebelum di-refaktor secara menyeluruh, kita akan memetakan registry baru agar tetap memuat command instance lama dengan kompatibilitas penuh.
* **Perubahan Database**: Migrasi Prisma akan dibuat secara aman. Database SQLite lokal (`prisma/dev.db`) tidak boleh hilang; modifikasi model baru akan diaplikasikan menggunakan perintah `prisma migrate dev`.

---

## 5. Rencana Pengujian (Test Plan)

Setiap akhir fase, langkah-langkah pengujian berikut wajib dilakukan:
1. **TypeScript Strict Verification**:
   ```bash
   npm run typecheck
   ```
2. **Unit & Integration Testing**:
   ```bash
   npm run test
   ```
3. **Manual Validation (Simulasi CLI)**:
   * Menjalankan bot via Console Mode untuk memastikan command routing dan output menu berfungsi secara offline:
     ```bash
     npm run dashboard
     ```
