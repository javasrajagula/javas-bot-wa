# PRD Addendum: Fix Media, Sticker, Game, OCR/STT, Translate, and Text Reliability

## 1. Ringkasan

Beberapa fitur bot belum berfungsi stabil:

1. `/hd` tidak berfungsi.
2. Game Werewolf tidak bisa jalan karena command tidak tersedia/terdaftar.
3. `/vstiker` menghasilkan area hitam karena video belum dipotong/crop dengan benar.
4. `/removebg` tidak berfungsi.
5. Stiker belum memiliki metadata nama bot “Javas Bot WA”.
6. Teks meme tidak jelas.
7. `/wm` gagal menambahkan watermark.
8. STT offline belum dikonfigurasi.
9. `/togif` error dengan `jidDecode(...) is undefined`.
10. `/translate` atau fitur text provider kadang menghasilkan `internal-server-error`.
11. `/pdf2img` gagal karena Poppler belum tersedia.
12. Jawaban game tebak kata tidak direspons.
13. OCR otomatis gagal karena Tesseract atau `OCR_COMMAND` belum tersedia.
14. `/ringkas` hasilnya belum jelas dan sering tidak akurat.

PRD ini bertujuan memperbaiki reliability fitur-fitur tersebut dengan pendekatan: preflight dependency check, command registry validation, media pipeline standar, graceful fallback, dan test coverage.

---

## 2. Tujuan

1. Semua command yang ditampilkan di menu benar-benar terdaftar dan bisa dijalankan.
2. Fitur media menghasilkan output yang bersih, playable, dan sesuai format WhatsApp.
3. Fitur eksternal seperti OCR, STT, Poppler, removebg, translate, dan ringkas memiliki preflight check yang jelas.
4. Error teknis tidak bocor ke user sebagai stack trace atau pesan mentah.
5. Game berbasis session, seperti tebak kata dan Werewolf, dapat menerima jawaban non-command.
6. Bot tidak crash karena JID invalid atau `jidDecode()` gagal.
7. Dokumentasi `.env.example` dan README menjelaskan dependency wajib/opsional.

---

## 3. Non-Goals

1. Tidak mengganti seluruh library Baileys.
2. Tidak membuat AI provider baru yang kompleks.
3. Tidak membangun dashboard baru.
4. Tidak membuat semua fitur premium baru.
5. Tidak melakukan rewrite total semua command game.

---

# 4. Functional Requirements

---

## FR-001 — Fix `/hd` Reliability

### Problem

Command `/hd` tersedia, tetapi tidak berfungsi stabil. Kemungkinan penyebab:

1. service HD gagal diam-diam,
2. dependency image processing tidak siap,
3. input media tidak valid,
4. output terlalu besar,
5. error tidak cukup jelas.

### Required Changes

Target file:

```txt
src/commands/media/media.command.ts
src/services/hd/hd.service.ts
```

Tambahkan:

1. Validasi input hanya image/sticker yang bisa diproses.
2. Validasi ukuran file sebelum HD.
3. Preflight untuk dependency HD.
4. Fallback sederhana jika enhancer utama gagal:

   * upscale dengan Sharp,
   * sharpen,
   * normalize,
   * output PNG/JPEG.
5. Error message user-friendly.

### Acceptance Criteria

1. `/hd` pada gambar valid mengirim gambar hasil enhancement.
2. `/hd 2x` bekerja untuk free user sesuai limit.
3. `/hd 4x` hanya untuk premium.
4. Jika enhancer gagal, fallback Sharp tetap mencoba.
5. Jika semua gagal, user mendapat pesan jelas, bukan stack trace.

---

## FR-002 — Register and Implement Werewolf Commands

### Problem

Werewolf tidak bisa jalan karena tidak ada command yang benar-benar terdaftar atau command registry tidak sinkron dengan metadata/menu.

### Required Changes

Target files:

```txt
src/commands/games/werewolf.command.ts
src/commands/games/index.ts
src/commands/registry/command-metadata.ts
src/config/plugins.ts
```

Tambahkan command minimal:

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

Aliases:

```txt
/werewolf
/ww
```

Pastikan command didaftarkan:

```ts
registerCommand(['ww', 'werewolf'], new WerewolfCommand());
```

Pastikan plugin `games` mencakup:

```txt
ww, werewolf, wwrank, wwstats
```

### Acceptance Criteria

1. `/ww help` menampilkan bantuan.
2. `/ww start` membuat lobby.
3. `/ww join` menambah pemain.
4. `/ww begin` memulai game jika pemain cukup.
5. `/ww status` menampilkan fase game.
6. Command muncul di menu dan benar-benar bisa dipakai.
7. Jika command belum lengkap, menu harus menandainya sebagai beta, bukan fitur final.

---

## FR-003 — Fix `/vstiker` Black Area

### Problem

Video sticker memiliki area hitam karena pipeline belum melakukan crop/scale/pad dengan benar.

### Required Changes

Target files:

```txt
src/commands/sticker/sticker.command.ts
src/services/sticker/sticker.service.ts
```

Gunakan pipeline FFmpeg yang konsisten untuk video sticker:

```txt
scale=512:512:force_original_aspect_ratio=increase,
crop=512:512,
fps=15,
format=yuva420p
```

Output:

```txt
webp animated sticker
```

Contoh filter:

```bash
-vf "fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=yuva420p"
```

Tambahkan durasi maksimal:

* free: 5 detik
* premium: 10 detik

### Acceptance Criteria

1. `/vstiker` menghasilkan sticker 512x512.
2. Tidak ada area hitam akibat aspect ratio.
3. Video terlalu panjang dipotong otomatis sesuai limit.
4. Output bisa dikirim sebagai sticker WhatsApp.
5. File temp dibersihkan.

---

## FR-004 — Fix `/removebg`

### Problem

`/removebg` tidak berfungsi. Kemungkinan penyebab:

1. API key removebg belum dikonfigurasi,
2. provider tidak tersedia,
3. tidak ada fallback,
4. error tidak jelas,
5. output image tidak valid.

### Required Changes

Target files:

```txt
src/commands/sticker/sticker.command.ts
src/services/removebg/removebg.service.ts
src/config/env.schema.ts
.env.example
README.md
```

Tambahkan env:

```env
REMOVEBG_PROVIDER="none"
REMOVEBG_API_KEY=""
REMOVEBG_COMMAND=""
```

Provider mode:

1. `none` — fitur dinonaktifkan dengan pesan jelas.
2. `api` — pakai remove.bg API atau provider HTTP.
3. `local` — pakai command lokal seperti rembg.

Jika provider tidak dikonfigurasi, user harus menerima:

```txt
⚠️ Remove background belum dikonfigurasi. Set REMOVEBG_PROVIDER dan REMOVEBG_API_KEY atau REMOVEBG_COMMAND.
```

### Acceptance Criteria

1. `/removebg` pada gambar valid berhasil jika provider tersedia.
2. Jika provider belum tersedia, bot tidak crash.
3. Error user jelas.
4. `.env.example` menjelaskan konfigurasi removebg.
5. Output PNG transparan valid.

---

## FR-005 — Add Sticker Metadata: Bot Name and Author

### Problem

Stiker belum memiliki nama pack/author “Javas Bot WA”.

### Required Changes

Target files:

```txt
src/services/sticker/sticker.service.ts
src/commands/sticker/sticker.command.ts
src/config/env.schema.ts
.env.example
```

Tambahkan env:

```env
STICKER_PACK_NAME="Javas Bot WA"
STICKER_AUTHOR_NAME="Javas"
```

Gunakan library atau util untuk embed EXIF WebP sticker metadata.

Jika belum ada util, tambahkan:

```txt
src/services/sticker/sticker-metadata.service.ts
```

### Acceptance Criteria

1. Stiker yang dibuat memiliki pack name `Javas Bot WA`.
2. Author default `Javas`.
3. Owner bisa mengubah lewat env.
4. Metadata berlaku untuk stiker gambar dan video sticker.
5. Jika metadata injection gagal, sticker tetap dikirim dan warning dicatat.

---

## FR-006 — Improve Meme Text Readability

### Problem

Teks meme tidak jelas.

### Required Changes

Target files:

```txt
src/commands/sticker/sticker.command.ts
src/services/meme/meme.service.ts
```

Tambahkan standar rendering:

1. Font bold.
2. Uppercase optional.
3. White text.
4. Black stroke/outline.
5. Auto-wrap.
6. Dynamic font size.
7. Safe margin.
8. Top and bottom text support.
9. Minimum contrast.

Untuk Sharp/SVG:

```txt
stroke="black"
stroke-width="4"
fill="white"
font-weight="700"
text-anchor="middle"
```

### Acceptance Criteria

1. Teks meme terbaca pada gambar terang dan gelap.
2. Teks panjang otomatis wrap.
3. Teks tidak keluar frame.
4. Top dan bottom text bisa dibaca jelas.

---

## FR-007 — Fix `/wm` Watermark Failure

### Problem

`/wm` gagal menambahkan watermark.

Kemungkinan penyebab:

1. FFmpeg `drawtext` tidak menemukan font.
2. Teks tidak di-escape.
3. Watermark video memakai filter yang tidak kompatibel.
4. Watermark image pakai SVG yang gagal dirender.
5. Media type tidak ditangani dengan jelas.

### Required Changes

Target files:

```txt
src/commands/media/media.command.ts
src/services/watermark/watermark.service.ts
```

Pisahkan logic:

1. `watermarkImage(buffer, text)`
2. `watermarkVideo(buffer, text)`

Untuk video:

* escape `:`, `'`, `\`, `%`
* gunakan fontfile jika tersedia
* tambahkan env:

```env
FONT_FILE_PATH=""
```

Jika `FONT_FILE_PATH` tidak ada, fallback ke image overlay watermark, bukan drawtext.

### Acceptance Criteria

1. `/wm teks` berhasil pada gambar.
2. `/wm teks` berhasil pada video.
3. Teks dengan tanda baca tidak merusak FFmpeg filter.
4. Error font tidak membuat command crash.
5. User mendapat pesan jelas jika watermark gagal.

---

## FR-008 — STT Offline Dependency Handling

### Problem

STT gagal dengan pesan:

```txt
⚠️ STT offline belum dikonfigurasi. Set STT_COMMAND ke wrapper Whisper/Vosk lokal yang menerima path file audio dan mencetak teks ke stdout.
```

### Required Changes

Target files:

```txt
src/services/stt/stt.service.ts
src/config/env.schema.ts
.env.example
README.md
```

Tambahkan preflight:

1. Saat bot start, cek apakah `STT_COMMAND` tersedia jika fitur transkrip aktif.
2. Jika tidak tersedia, tandai fitur STT disabled.
3. Command `/transkrip` harus memberi pesan konfigurasi yang jelas.
4. Tambahkan contoh wrapper Whisper/Vosk di dokumentasi.

Env:

```env
STT_COMMAND=""
STT_TIMEOUT_SECONDS="120"
```

Contoh dokumentasi:

```bash
STT_COMMAND="python scripts/whisper_stt.py"
```

Wrapper contract:

```txt
Input: path file audio sebagai argumen pertama
Output: teks transkripsi ke stdout
Exit code 0: sukses
Exit code non-zero: gagal
```

### Acceptance Criteria

1. `/transkrip` tidak crash saat STT belum dikonfigurasi.
2. User menerima pesan setup yang jelas.
3. Jika `STT_COMMAND` valid, transkripsi berjalan.
4. Timeout STT bekerja.
5. README memberi contoh konfigurasi.

---

## FR-009 — Fix `/togif` JID Decode Crash

### Problem

`/togif` memicu error:

```txt
Cannot destructure property 'user' of jidDecode(...) as it is undefined.
```

Ini menunjukkan ada kode yang memanggil `jidDecode(jid)` lalu langsung destructuring tanpa cek hasil. Jika JID invalid, undefined, atau format non-WhatsApp, bot crash.

### Required Changes

Target files:

```txt
src/utils/jid.util.ts
src/bot/permission.ts
src/commands/index.ts
src/services/achievement/*
src/commands/media/media.command.ts
```

Tambahkan helper aman:

```ts
export function safeJidDecode(jid: string | undefined | null) {
  if (!jid) return null;

  try {
    const decoded = jidDecode(jid);
    if (!decoded || !decoded.user) return null;
    return decoded;
  } catch {
    return null;
  }
}
```

Larangan:

```ts
const { user } = jidDecode(jid);
```

Harus diganti:

```ts
const decoded = safeJidDecode(jid);
if (!decoded) {
  // fallback
}
```

### Acceptance Criteria

1. `/togif` tidak menyebabkan routeMessage crash.
2. JID invalid tidak membuat bot mati.
3. Semua penggunaan `jidDecode` dicek.
4. Error log menyebut JID invalid secara masked, bukan raw.
5. Command media tetap mengirim hasil atau error user-friendly.

---

## FR-010 — Poppler Dependency Handling for `/pdf2img`

### Problem

PDF conversion gagal:

```txt
Poppler belum tersedia. Install Poppler dan pastikan pdftoppm ada di PATH untuk memakai /pdf2img.
```

### Required Changes

Target files:

```txt
src/services/document/document-tools.service.ts
src/services/system/dependency-check.service.ts
README.md
.env.example
```

Tambahkan startup dependency check untuk:

```txt
pdftoppm
pdftotext
```

Tambahkan command owner:

```txt
/checkdeps
```

Output:

```txt
FFmpeg: OK
FFprobe: OK
Poppler pdftoppm: Missing
Poppler pdftotext: Missing
Tesseract: Missing
STT_COMMAND: Missing
OCR_COMMAND: Missing
```

### Acceptance Criteria

1. `/pdf2img` gagal dengan pesan singkat dan jelas jika Poppler missing.
2. `/checkdeps` menunjukkan status Poppler.
3. README memberi instruksi install Poppler di Windows/Linux.
4. Error tidak masuk routeMessage sebagai internal-server-error.

---

## FR-011 — Fix `/translate` and Text Provider Internal Server Error

### Problem

`/translate` mengalami:

```txt
internal-server-error
```

Kemungkinan penyebab:

1. provider translate eksternal gagal,
2. AI/text service tidak punya fallback,
3. error tidak dipetakan ke pesan user,
4. input kosong atau format tidak valid.

### Required Changes

Target files:

```txt
src/commands/text/text.command.ts
src/services/text/text.service.ts
src/services/translate/translate.service.ts
```

Tambahkan provider abstraction:

```ts
translateText(input, targetLang, sourceLang?)
summarizeText(input)
rewriteText(input, style)
```

Untuk translate:

1. Validasi target language.
2. Deteksi teks dari args atau quoted message.
3. Provider fallback:

   * local/simple dictionary no-op fallback untuk error,
   * HTTP provider jika dikonfigurasi,
   * AI provider jika tersedia.
4. Tangkap `internal-server-error` dan ubah ke user-friendly message.

### Acceptance Criteria

1. `/tr en halo` mengembalikan translate atau error jelas.
2. `/translate id Good morning` bekerja.
3. Provider error tidak menghasilkan raw `internal-server-error`.
4. Input kosong menampilkan usage.
5. Semua error tercatat dengan error ID.

---

## FR-012 — Game Answer Router for Tebak Kata

### Problem

Saat menjawab tebak kata, tidak ada respon.

Kemungkinan penyebab:

1. Router hanya memproses command berprefix.
2. Jawaban game non-command tidak diarahkan ke active game session.
3. Session game tidak disimpan atau expired terlalu cepat.
4. Handler jawaban tidak didaftarkan.

### Required Changes

Target files:

```txt
src/commands/index.ts
src/commands/games/*
src/services/games/game-session.service.ts
```

Tambahkan tahap routing sebelum command parsing selesai:

```txt
1. Jika pesan non-command dan ada active game session di chat:
   - kirim ke game answer handler.
2. Jika handler mengembalikan handled=true:
   - stop router.
3. Jika handled=false:
   - lanjut normal.
```

Interface:

```ts
export interface GameAnswerHandler {
  canHandle(ctx: MessageContext): Promise<boolean>;
  handleAnswer(ctx: MessageContext, adapter: WhatsAppAdapter): Promise<boolean>;
}
```

### Acceptance Criteria

1. Bot merespons jawaban tebak kata tanpa prefix.
2. Jawaban benar menutup/memperbarui sesi.
3. Jawaban salah mendapat feedback atau diabaikan sesuai desain.
4. Session expired memberi pesan jelas.
5. Tidak mengganggu chat biasa saat tidak ada game aktif.

---

## FR-013 — OCR Dependency Handling

### Problem

OCR gagal:

```txt
OCR engine belum tersedia. Install Tesseract OCR atau set OCR_COMMAND.
```

### Required Changes

Target files:

```txt
src/services/ocr/ocr.service.ts
src/config/env.schema.ts
README.md
.env.example
```

Tambahkan env:

```env
OCR_COMMAND=""
OCR_TIMEOUT_SECONDS="60"
TESSERACT_CMD="tesseract"
```

Behavior:

1. Jika `OCR_COMMAND` tersedia, gunakan command tersebut.
2. Jika tidak, coba `tesseract`.
3. Jika tidak tersedia, tampilkan pesan setup.
4. `/checkdeps` harus mendeteksi OCR.

### Acceptance Criteria

1. OCR berjalan jika Tesseract tersedia.
2. OCR berjalan jika `OCR_COMMAND` tersedia.
3. Jika tidak tersedia, pesan jelas.
4. OCR failure tidak mematikan fitur lain.
5. Auto OCR tidak membuat output “ngaco” jika OCR kosong.

---

## FR-014 — Improve `/ringkas` Quality

### Problem

`/ringkas` hasilnya belum jelas dan sering “ngaco”.

### Required Changes

Target files:

```txt
src/commands/text/text.command.ts
src/services/text/summarizer.service.ts
```

Tambahkan struktur ringkasan deterministic:

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

1. Minimal input 80 karakter untuk ringkasan.
2. Jika teks terlalu pendek, beri pesan bahwa teks belum cukup untuk diringkas.
3. Jika AI provider tidak tersedia, gunakan extractive summarizer sederhana:

   * pilih kalimat penting,
   * buang duplikasi,
   * maksimal 5 poin.
4. Jangan halusinasi.
5. Jangan menambahkan fakta di luar teks.

### Acceptance Criteria

1. `/ringkas <teks panjang>` menghasilkan ringkasan terstruktur.
2. Teks pendek ditolak dengan pesan jelas.
3. Jika provider AI error, fallback extractive berjalan.
4. Output tidak menambahkan fakta baru.
5. Quoted message bisa diringkas.

---

# 5. Cross-Cutting Requirement: Dependency Check System

## FR-015 — Add `/checkdeps` Owner Command

### Required Checks

```txt
ffmpeg
ffprobe
pdftoppm
pdftotext
tesseract
OCR_COMMAND
STT_COMMAND
FONT_FILE_PATH
REMOVEBG_PROVIDER
TTS_PROVIDER
```

### Output Example

```txt
🧩 Dependency Check

Media:
• ffmpeg: OK
• ffprobe: OK
• font file: Missing

Document:
• pdftoppm: Missing
• pdftotext: Missing

Text:
• tesseract: Missing
• OCR_COMMAND: Missing
• STT_COMMAND: Missing

External:
• REMOVEBG_PROVIDER: none
• TTS_PROVIDER: google
```

### Acceptance Criteria

1. Owner bisa menjalankan `/checkdeps`.
2. Missing dependency tidak baru diketahui saat user memakai command.
3. README sesuai dengan hasil checkdeps.

---

# 6. Implementation Plan

## Phase 1 — Stop Crashes and Missing Commands

1. Add safe JID decode helper.
2. Replace all unsafe `jidDecode` destructuring.
3. Register Werewolf command.
4. Add game answer router for tebak kata.
5. Add `/checkdeps`.
6. Add clear dependency failure messages.

## Phase 2 — Fix Media Output Quality

1. Fix `/vstiker` crop/scale pipeline.
2. Fix `/togif` pipeline and JID crash.
3. Fix `/wm` image/video watermark service.
4. Improve meme text rendering.
5. Add sticker metadata.
6. Fix `/hd` fallback.
7. Fix `/removebg` provider handling.

## Phase 3 — Fix Text/OCR/STT/Translate

1. Add OCR preflight and fallback.
2. Add STT preflight and wrapper docs.
3. Fix translate provider error mapping.
4. Improve `/ringkas` prompt and fallback.
5. Add provider abstraction for text commands.

## Phase 4 — Tests and Documentation

1. Add unit tests.
2. Add command smoke tests.
3. Update README.
4. Update `.env.example`.
5. Add Windows install notes for Poppler, Tesseract, FFmpeg.

---

# 7. Test Plan

## Media Tests

1. `/hd` with valid image.
2. `/vstiker` with portrait video.
3. `/vstiker` with landscape video.
4. `/togif` with short video.
5. `/wm watermark` on image.
6. `/wm watermark` on video.
7. `/meme atas | bawah` on bright image.
8. `/meme atas | bawah` on dark image.
9. `/removebg` when provider missing.
10. `/removebg` when provider available.

## Game Tests

1. `/ww help`.
2. `/ww start`.
3. `/ww join`.
4. `/ww begin`.
5. Start tebak kata.
6. Answer tebak kata without prefix.
7. Expired game answer.

## Dependency Tests

1. `/checkdeps` when Poppler missing.
2. `/checkdeps` when Tesseract missing.
3. `/checkdeps` when STT_COMMAND missing.
4. `/pdf2img` when Poppler missing.
5. `/ocr` when OCR missing.
6. `/transkrip` when STT missing.

## Text Tests

1. `/tr en halo`.
2. `/translate id Good morning`.
3. `/ringkas <teks panjang>`.
4. `/ringkas teks pendek`.
5. Provider internal-server-error mapping.
6. Quoted text summarization.

## Crash Regression Tests

1. Invalid JID does not crash routeMessage.
2. `jidDecode()` returning undefined is handled.
3. `/togif` does not produce routeMessage fatal error.
4. All media errors return user-friendly message.

---

# 8. Verification Commands

```bash
npm run typecheck
npm run build
npm test
npx prisma validate
npx prisma generate
```

Manual smoke test:

```txt
/checkdeps
/hd
/vstiker
/togif
/removebg
/meme atas | bawah
/wm Javas Bot
/ww help
/tebakkata
/tr en halo
/ringkas <teks panjang>
/ocr
/transkrip
/pdf2img
```

---

# 9. Definition of Done

PRD ini selesai jika:

1. `/hd` menghasilkan output atau error yang jelas.
2. `/ww help` dan command Werewolf tersedia.
3. Tebak kata merespons jawaban non-command.
4. `/vstiker` tidak menghasilkan area hitam.
5. `/removebg` berhasil atau memberi pesan konfigurasi jelas.
6. Stiker memiliki metadata `Javas Bot WA`.
7. Meme text terbaca jelas.
8. `/wm` berhasil untuk image/video.
9. `/transkrip` menjelaskan STT missing atau menjalankan STT jika tersedia.
10. `/togif` tidak crash karena `jidDecode`.
11. `/translate` tidak menampilkan raw `internal-server-error`.
12. `/pdf2img` memberi pesan Poppler missing yang jelas.
13. OCR memberi pesan setup yang jelas jika Tesseract/OCR_COMMAND missing.
14. `/ringkas` menghasilkan ringkasan terstruktur dan tidak halusinatif.
15. `/checkdeps` tersedia untuk owner.
16. README dan `.env.example` menjelaskan semua dependency.
