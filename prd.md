# PRD — Ekspansi 140 Fitur Tambahan, 50 Game Baru, dan Upgrade Game Javas Bot WA

**Produk:** Javas Bot WA  
**Repo:** `javasrajagula/javas-bot-wa`  
**Status:** Draft siap implementasi  
**Target:** Membuat bot lebih berguna untuk grup sekolah, komunitas, bisnis kecil, dan hiburan; sekaligus memperkuat fondasi teknis agar fitur besar tidak membuat bot berat atau rapuh.

---

## 1. Ringkasan Eksekutif

PRD ini mendefinisikan ekspansi besar Javas Bot WA melalui:

1. **140 fitur tambahan** yang diprioritaskan untuk keamanan grup, privasi, sekolah, produktivitas, media, dokumen, AI edukatif, bisnis kecil, automasi, analytics, reliability, dan monetisasi.
2. **50 game tambahan** yang didesain untuk membuat grup lebih aktif, kompetitif, dan seru.
3. **Upgrade game lama** agar lebih asyik melalui leaderboard, season, ranked mode, party system, hint system, streak, achievement, anti-AFK, dan balancing.

Ekspansi ini harus dilakukan bertahap, feature-flagged, terukur, dan tidak boleh langsung menambah beban startup/runtime secara besar-besaran.

---

## 2. Latar Belakang

Javas Bot WA sudah memiliki banyak command, plugin, dashboard, economy, game, moderation, dan media tools. Namun ekspansi fitur harus mengikuti prinsip:

- Tidak semua fitur aktif secara default.
- Fitur berat harus masuk queue.
- Fitur yang menyimpan data harus punya aturan privacy dan retensi.
- Game harus punya loop yang membuat user kembali bermain.
- Fitur premium harus jelas manfaatnya tanpa merusak pengalaman user free.

---

## 3. Tujuan Produk

### 3.1 Tujuan Utama

- Menjadikan Javas Bot WA sebagai bot grup serbaguna untuk **sekolah, komunitas, UMKM, dan hiburan**.
- Menambah **140 fitur berguna** yang bisa dipilih per grup melalui feature flags.
- Menambah **50 game baru** untuk meningkatkan engagement.
- Meng-upgrade game lama agar lebih interaktif, kompetitif, dan replayable.
- Memperkuat fondasi teknis untuk mendukung pertumbuhan command tanpa membuat bot lambat.

### 3.2 Sasaran Kuantitatif

- Minimal 70% fitur baru memiliki metadata command, docs, feature flag, role permission, dan rate limit.
- Minimal 50 game punya state model yang konsisten.
- Minimal 80% game mendukung leaderboard atau reward.
- Command berat diproses melalui queue.
- Logging pesan sensitif direduksi sebelum ekspansi fitur AI/media.

---

## 4. Non-Goals

- Tidak membuat fitur yang melanggar kebijakan platform WhatsApp.
- Tidak mengimplementasikan perjudian uang nyata.
- Tidak menyimpan media sensitif lebih lama dari kebutuhan fitur.
- Tidak mengaktifkan semua fitur otomatis di semua grup.
- Tidak membuat fitur AI cloud wajib untuk fungsi dasar.

---

## 5. Persona Pengguna

| Persona | Kebutuhan |
|---|---|
| Owner Bot | Kontrol fitur global, monetisasi, dashboard, audit, dan stabilitas. |
| Admin Grup | Moderasi, setup cepat, welcome, anti-spam, event, dan laporan. |
| Pelajar | Game, kuis, jadwal, tugas, catatan, dan fitur belajar. |
| Komunitas | Polling, reputasi, agenda, announcement, dan hiburan. |
| UMKM | Katalog, order, invoice, promo, dan kas sederhana. |
| User Biasa | Command mudah, fun, privasi, dan fitur ringan. |

---

## 6. Prinsip Desain

1. **Feature-flagged by default:** fitur baru harus bisa diaktifkan/dinonaktifkan per grup.
2. **Permission-first:** setiap command harus punya minimum role.
3. **Privacy-aware:** fitur yang menyimpan data harus punya label data dan retensi.
4. **Queue for heavy work:** AI, media, dokumen, downloader, dan broadcast harus lewat queue.
5. **Game loop kuat:** game harus punya tujuan, reward, replayability, dan anti-AFK.
6. **Composable:** fitur besar dibuat sebagai modul/plugin, bukan ditumpuk di router utama.
7. **Observable:** command penting harus punya usage log, error fingerprint, dan metric.

---

## 7. Scope Fitur Tambahan — 140 Fitur

Total fitur pada bagian ini adalah **140 fitur**: 14 kategori × 10 fitur.


### 7.1. Fitur Grup, Moderasi & Keamanan

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F001 | Anti-flood adaptif | Mendeteksi lonjakan pesan per user/grup dan menyesuaikan limit otomatis berdasarkan ukuran grup. |
| F002 | Anti-link whitelist bertingkat | Whitelist domain global, per grup, dan per kategori; mendukung alasan pengecualian. |
| F003 | Anti-forward spam | Mendeteksi pesan forwarded berulang dan memberi tindakan otomatis sesuai rule admin. |
| F004 | Anti-join bot/akun baru | Memberi skor risiko ke member baru berdasarkan pola nama, foto profil, dan aktivitas awal. |
| F005 | Captcha mode bertingkat | Captcha angka, pilihan ganda, atau kata acak dengan tingkat kesulitan sesuai risiko. |
| F006 | Mute bertahap | Pelanggaran pertama delete, kedua mute, ketiga kick/ban sesuai konfigurasi. |
| F007 | Auto-lockdown schedule | Mengunci grup otomatis pada jam tertentu, ujian, atau event penting. |
| F008 | Anti-tag-all berlebihan | Membatasi mention massal dan memberi pengecualian untuk admin/owner. |
| F009 | Moderation appeal | User bisa mengajukan banding pelanggaran ke admin melalui command. |
| F010 | Safety digest harian | Ringkasan pelanggaran, user berisiko, dan rekomendasi rule untuk admin. |

### 7.2. Privasi, Data & Kepatuhan

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F011 | Mode retensi per fitur | Retensi data berbeda untuk game, usage log, media cache, dan audit. |
| F012 | Export data user | User dapat meminta ringkasan data yang tersimpan tentang dirinya. |
| F013 | Delete my data | User dapat menghapus data personal non-kritis sesuai policy. |
| F014 | Anonim analytics | Dashboard menampilkan statistik tanpa JID asli saat privacy mode aktif. |
| F015 | Sensitive log redaction | Nomor, token, URL privat, dan body pesan sensitif disamarkan dari log. |
| F016 | Consent per fitur AI | Fitur AI yang mengirim konten ke provider eksternal meminta consent per grup/user. |
| F017 | Data classification | Setiap command diberi label data: public, personal, sensitive, media. |
| F018 | Private command guard | Command tertentu hanya boleh dipakai di chat pribadi untuk menghindari bocor data. |
| F019 | Admin privacy notice | Bot mengirim penjelasan singkat ketika fitur sensitif diaktifkan. |
| F020 | Audit access viewer | Owner bisa melihat siapa mengakses data/fitur sensitif dari dashboard. |

### 7.3. Admin, Owner & Operasional

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F021 | Setup wizard v2 | Wizard onboarding grup dengan preset sekolah, komunitas, jualan, dan gaming. |
| F022 | Preset fitur grup | Admin dapat menerapkan bundle fitur: aman, ramai, edukasi, bisnis, ringan. |
| F023 | Role custom | Owner grup dapat membuat role custom dengan izin command tertentu. |
| F024 | Delegated moderator | Admin bisa menunjuk moderator terbatas tanpa memberi full admin WA. |
| F025 | Config diff | Menampilkan perubahan konfigurasi grup sebelum/sesudah update. |
| F026 | Rollback config | Mengembalikan konfigurasi grup ke versi sebelumnya. |
| F027 | Command policy editor | Atur command mana yang aktif untuk role, jam, dan plan tertentu. |
| F028 | Owner task queue | Daftar tugas owner: konfirmasi sewa, error penting, request banding. |
| F029 | Admin announcement builder | Template pengumuman dengan preview, mention policy, dan jadwal kirim. |
| F030 | Group health score | Skor kesehatan grup berdasarkan spam, engagement, rule, dan error fitur. |

### 7.4. Komunitas, Sekolah & Kolaborasi

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F031 | Jadwal pelajaran interaktif | Simpan jadwal, reminder pelajaran, dan perubahan jadwal dadakan. |
| F032 | Tugas kelas | Buat, daftar, tandai selesai, dan reminder deadline tugas. |
| F033 | Absensi QR | Absensi dengan QR token yang berubah agar tidak mudah dititipkan. |
| F034 | Piket kelas | Jadwal piket mingguan dengan reminder otomatis. |
| F035 | Bank materi | Simpan link/file materi dengan tag mapel dan pencarian cepat. |
| F036 | Kuis kelas terjadwal | Kuis otomatis harian/mingguan dengan ranking kelas. |
| F037 | Catatan rapat komunitas | Buat notulen singkat, action item, dan owner tiap tugas. |
| F038 | Voting keputusan | Polling dengan quorum, deadline, dan hasil akhir otomatis. |
| F039 | Birthday & anniversary | Ucapan ulang tahun/member anniversary dengan kartu opsional. |
| F040 | Reputasi positif | Sistem poin terima kasih, kontribusi, helper, dan badge komunitas. |

### 7.5. Produktivitas & Reminder

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F041 | Reminder berulang | Reminder harian, mingguan, bulanan, dan custom RRULE sederhana. |
| F042 | Reminder natural language | Parse teks seperti 'ingatkan besok jam 7 malam'. |
| F043 | Checklist grup | Checklist bersama untuk event, tugas, belanja, atau persiapan. |
| F044 | Pomodoro grup | Sesi fokus bersama dengan timer dan break otomatis. |
| F045 | Agenda harian | Bot mengirim agenda grup atau pribadi setiap pagi. |
| F046 | Follow-up otomatis | Mengingatkan pesan yang belum dibalas dalam thread/quote tertentu. |
| F047 | Quick note pribadi | Catatan pribadi via chat bot dengan tag dan pencarian. |
| F048 | Kanban mini | Board To Do, Doing, Done untuk proyek kecil di grup. |
| F049 | Meeting timer | Timer rapat dengan agenda, timebox, dan ringkasan keputusan. |
| F050 | Deadline heatmap | Tampilan deadline mendekat berdasarkan prioritas. |

### 7.6. Media, Stiker & Kreativitas

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F051 | Sticker pack manager | Kelola nama pack, author, koleksi, dan favorit. |
| F052 | Sticker template editor | Template stiker teks: meme, quote, announcement, reaction. |
| F053 | Auto-caption media lokal | Caption gambar/video dengan OCR dan template tanpa wajib AI cloud. |
| F054 | Watermark policy | Watermark otomatis per grup dengan opsi transparansi dan posisi. |
| F055 | Media batch pipeline | Batch resize, compress, watermark, dan convert dalam satu sesi. |
| F056 | Avatar card | Kartu profil user dengan level, badge, rank, dan stats. |
| F057 | Quote card v2 | Quote dari reply pesan menjadi gambar/stiker rapi. |
| F058 | Meme challenge | Mode lomba meme dengan voting dan leaderboard. |
| F059 | Media safety preview | Preview ukuran, durasi, dan risiko sebelum proses berat. |
| F060 | Template poster grup | Poster event sederhana dari form command. |

### 7.7. Dokumen, File & Utility

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F061 | PDF split | Memisahkan PDF berdasarkan halaman/range. |
| F062 | PDF reorder | Mengubah urutan halaman PDF melalui command. |
| F063 | PDF protect | Menambah password PDF bila library mendukung. |
| F064 | PDF unlock notice | Memberi instruksi aman jika PDF terkunci, tanpa membypass ilegal. |
| F065 | Image OCR batch | OCR banyak gambar dan gabungkan hasil ke teks/PDF. |
| F066 | Doc summary | Ringkas dokumen dengan batas ukuran dan mode privacy. |
| F067 | File rename helper | Rename file kiriman dengan pola tanggal, mapel, atau tag. |
| F068 | ZIP safe preview | Preview isi ZIP sebelum ekstrak dengan proteksi zip bomb. |
| F069 | QR attendance generator | QR untuk absensi/event dengan masa berlaku. |
| F070 | Unit converter lengkap | Konversi satuan panjang, berat, suhu, waktu, data, dan mata uang manual-rate. |

### 7.8. AI, Edukasi & Bahasa

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F071 | Tutor pelajaran | Mode tutor matematika, bahasa, IPA, IPS dengan penjelasan bertahap. |
| F072 | Latihan soal adaptif | Soal makin sulit/mudah sesuai jawaban user. |
| F073 | Rubrik penilaian | Bantu membuat rubrik tugas/essay untuk guru/admin. |
| F074 | Flashcard spaced repetition | Kartu belajar dengan jadwal ulang otomatis. |
| F075 | Mode debat sehat | Bot mengatur giliran, waktu bicara, dan ringkasan argumen. |
| F076 | Parafrase multi gaya | Ubah teks menjadi formal, santai, singkat, akademik, promosi. |
| F077 | Koreksi bahasa Indonesia | Koreksi typo, tanda baca, dan ejaan dengan alasan singkat. |
| F078 | Vocabulary builder | Kosakata Inggris/Indonesia harian dengan kuis singkat. |
| F079 | Explain like I am 5/15/expert | Penjelasan topik sesuai level pemahaman. |
| F080 | AI safety budget | Limit token/biaya per grup agar AI tidak boros. |

### 7.9. Bisnis, UMKM & Keuangan Simulasi

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F081 | Katalog produk grup | Daftar produk, harga, stok, foto, dan kategori. |
| F082 | Order form WA | Form pemesanan sederhana dengan ID order. |
| F083 | Invoice teks | Buat invoice format WhatsApp dengan total dan status. |
| F084 | Stok reminder | Reminder stok menipis untuk produk katalog. |
| F085 | Customer note | Catatan pelanggan ringan untuk admin grup jualan. |
| F086 | Promo scheduler | Jadwalkan broadcast promo dengan anti-spam. |
| F087 | Kas sederhana | Catat pemasukan/pengeluaran grup atau kelas. |
| F088 | Split bill | Bagi tagihan antar member dan tracking bayar. |
| F089 | Budget challenge | Challenge hemat mingguan dengan leaderboard. |
| F090 | Simulasi investasi edukatif | Game edukasi investasi fiktif tanpa nasihat finansial nyata. |

### 7.10. Downloader, Link & Web Utility

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F091 | Link reputation | Cek reputasi domain berdasarkan rule lokal dan daftar admin. |
| F092 | URL expander | Membuka shortlink secara aman dan tampilkan domain akhir. |
| F093 | Screenshot website | Ambil screenshot halaman publik dengan timeout dan SSRF guard. |
| F094 | Bookmark grup | Simpan link penting dengan tag dan pencarian. |
| F095 | Downloader queue status | User bisa cek posisi antrian download/HD. |
| F096 | Downloader retry user | User bisa retry job gagal dengan batas aman. |
| F097 | Media source attribution | Caption hasil download menyertakan sumber dan metadata ringkas. |
| F098 | Download quota per grup | Kuota downloader harian per grup agar tidak boros resource. |
| F099 | Safe domain request | User bisa request domain whitelist ke admin. |
| F100 | Link reminder | Set reminder untuk membuka link tertentu nanti. |

### 7.11. Automasi, Integrasi & Webhook

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F101 | Webhook event filter | Webhook hanya mengirim event tertentu: join, command, warning, order. |
| F102 | Webhook retry queue | Retry webhook gagal dengan backoff dan dead-letter log. |
| F103 | Google Calendar bridge | Sinkron event grup ke kalender bila integrasi tersedia. |
| F104 | GitHub repo watcher | Notifikasi release/issue/PR repo publik yang dipantau. |
| F105 | RSS watcher | Pantau RSS publik dan kirim ringkasan ke grup. |
| F106 | Form collector | Kumpulkan jawaban member melalui DM atau grup. |
| F107 | Auto-label pesan | Label pesan penting seperti tugas, pengumuman, materi, order. |
| F108 | Command macro | Admin membuat macro yang menjalankan beberapa command berurutan. |
| F109 | Scheduled command | Jadwalkan command tertentu berjalan otomatis dengan izin admin. |
| F110 | Integration health check | Cek status API eksternal dan beri warning jika down. |

### 7.12. Analytics, Dashboard & Insight

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F111 | Dashboard command heatmap | Jam ramai penggunaan command per grup. |
| F112 | Feature adoption report | Fitur aktif, jarang dipakai, dan rekomendasi disable. |
| F113 | Top helper leaderboard | Ranking user paling membantu berdasarkan reputasi dan jawaban. |
| F114 | Moderation trend | Grafik tren spam, badword, link, warning. |
| F115 | Game engagement report | Game terpopuler, retention, win rate, dan session length. |
| F116 | AI usage cost report | Estimasi biaya AI per grup/user/fitur. |
| F117 | Error fingerprinting | Kelompokkan error serupa agar mudah diperbaiki. |
| F118 | Slow command tracing | Catat command lambat dan penyebabnya. |
| F119 | Admin action audit | Log perubahan admin dengan filter dan export. |
| F120 | Weekly owner report | Ringkasan mingguan performa bot ke owner. |

### 7.13. Reliability, DevOps & Developer Experience

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F121 | Plugin lazy loading | Command di-load saat dibutuhkan untuk mengurangi startup risk. |
| F122 | Plugin sandbox contract | Setiap plugin wajib punya metadata, tests, feature flag, rate limit. |
| F123 | Migration guard | Validasi schema dan backup otomatis sebelum migrasi. |
| F124 | PostgreSQL production profile | Profil production resmi dengan PostgreSQL + Redis. |
| F125 | Structured logging | Log JSON dengan redaction dan request/command id. |
| F126 | Graceful shutdown | Tutup socket, DB, queue, dan worker dengan aman saat SIGTERM. |
| F127 | Job idempotency | Mencegah job download/media terkirim dobel setelah retry. |
| F128 | Healthcheck detail | Liveness/readiness dengan DB, Redis, disk, WA, queue. |
| F129 | Test fixture bot | Adapter test untuk simulasi pesan grup tanpa WhatsApp asli. |
| F130 | Command docs generator v2 | Generate docs dari metadata command dan contoh penggunaan. |

### 7.14. Monetisasi, Premium & Pengalaman User

| ID | Nama | Deskripsi |
| --- | --- | --- |
| F131 | Plan entitlement matrix | Matriks fitur free/basic/premium per grup dan user. |
| F132 | Trial otomatis | Trial grup/user dengan batas hari, fitur, dan reminder expiry. |
| F133 | Coupon system v2 | Kupon diskon, bonus hari, atau unlock fitur terbatas. |
| F134 | Usage quota wallet | Saldo kuota untuk fitur berat seperti AI, HD, downloader. |
| F135 | Premium onboarding | Pesan panduan setelah user/grup menjadi premium. |
| F136 | Payment proof workflow | Flow upload bukti bayar, verifikasi owner, dan aktivasi. |
| F137 | Renewal reminder | Reminder masa sewa/premium akan habis. |
| F138 | Referral reward | Reward user/grup yang mengajak pelanggan baru. |
| F139 | Feature teaser | Preview singkat fitur premium tanpa membuka akses penuh. |
| F140 | Satisfaction survey | Survey ringan setelah fitur premium digunakan beberapa kali. |

---

## 8. Scope Game Baru — 50 Game Tambahan

Game baru harus dibuat dengan standar:

- Ada `GameSession` atau state session yang jelas.
- Ada durasi/timer agar sesi tidak menggantung.
- Ada anti-AFK untuk game multiplayer.
- Ada reward virtual yang aman dan bukan uang nyata.
- Ada leaderboard minimal per grup atau global.
- Ada dokumentasi command dan contoh.

| ID | Game | Konsep Gameplay |
| --- | --- | --- |
| G001 | Werewolf Chaos Mode | Varian Werewolf dengan role acak tambahan, event malam, dan modifier ronde. |
| G002 | Werewolf Ranked Season | Mode ranked dengan MMR, role mastery, dan leaderboard musiman. |
| G003 | Mafia Sekolah | Social deduction versi ringan bertema kelas dengan guru, ketua kelas, dan pembuat onar. |
| G004 | Detective Case | Pemain membaca clue bertahap dan menebak pelaku kasus. |
| G005 | Escape Room Grup | Puzzle berantai; jawaban satu tahap membuka tahap berikutnya. |
| G006 | Treasure Hunt | Bot memberi clue lokasi/keyword virtual yang harus dipecahkan member. |
| G007 | Kata Berantai Battle | Sambung kata dengan timer, eliminasi, dan power-up. |
| G008 | Tebak Emoji Cerita | Menebak film/lagu/peribahasa dari rangkaian emoji. |
| G009 | Tebak Suara | Menebak suara/audio pendek dari kategori hewan, alat, atau lagu. |
| G010 | Tebak Siluet | Menebak gambar siluet dengan hint bertahap. |
| G011 | Quiz Duel 1v1 | Dua pemain menjawab soal cepat; skor berdasarkan benar dan kecepatan. |
| G012 | Quiz Battle Royale | Banyak pemain, salah eliminasi, terakhir menang. |
| G013 | Ranking Cepat | Urutkan item dari terkecil-terbesar, tahun lama-baru, atau harga rendah-tinggi. |
| G014 | Family 100 League | Family100 dengan liga grup dan bank jawaban statistik. |
| G015 | Survey Says Indonesia | Versi lokal Family100 dengan jawaban berbasis dataset admin. |
| G016 | Math Sprint | Soal matematika cepat 60 detik dengan kombo streak. |
| G017 | Math Boss | Boss HP berkurang jika pemain menjawab benar. |
| G018 | Puzzle Angka 24 | Membuat 24 dari empat angka dengan operasi dasar. |
| G019 | Sudoku Mini | Sudoku 4x4/6x6 berbasis teks. |
| G020 | Wordle Indonesia | Tebak kata 5 huruf dengan petunjuk posisi. |
| G021 | Hangman Bahasa Indonesia | Tebak kata sebelum nyawa habis. |
| G022 | Anagram Race | Susun ulang huruf menjadi kata dengan timer. |
| G023 | Typing Race | Balapan mengetik kalimat secara akurat. |
| G024 | Memory Cards | Mencocokkan kartu tersembunyi lewat koordinat. |
| G025 | Minesweeper Chat | Minesweeper grid kecil via command koordinat. |
| G026 | TicTacToe Ultimate | TicTacToe 3 papan dengan mode turnamen. |
| G027 | Connect Four | Game sambung 4 berbasis kolom. |
| G028 | Battleship Mini | Tebak posisi kapal lawan di grid. |
| G029 | Catur Mini Puzzle | Puzzle mate-in-one atau cari langkah terbaik sederhana. |
| G030 | Suit Tournament | Suit batu-gunting-kertas format bracket. |
| G031 | UNO Lite | Permainan kartu sederhana dengan warna/angka dan kartu aksi. |
| G032 | Blackjack Edu | Blackjack santai dengan saldo virtual, bukan judi uang nyata. |
| G033 | Monopoly Mini Grup | Beli petak virtual, sewa fiktif, dan event kartu. |
| G034 | Market Tycoon | Simulasi jual beli barang fiktif dengan harga berubah. |
| G035 | Farm RPG | Tanam, panen, upgrade alat, dan event musim. |
| G036 | Fishing Tournament | Mancing dengan rarity ikan, cuaca, dan ranking. |
| G037 | Dungeon Party | Party grup melawan monster dengan role tank/healer/dps. |
| G038 | Pet Battle | Pet user bertarung dengan skill dan leveling. |
| G039 | Guild War | Tim/guild mengumpulkan poin lewat quest mingguan. |
| G040 | Daily Quest Board | Quest harian acak untuk XP, coin, dan badge. |
| G041 | Truth or Dare Story Mode | TOD dengan tema, level, vote skip, dan safe mode. |
| G042 | Confession Mystery | Menebak pengirim confession anonim dengan clue terbatas. |
| G043 | Impostor Word | Satu pemain mendapat kata berbeda dan harus menyamar. |
| G044 | Spyfall Chat | Semua tahu lokasi kecuali spy; tanya jawab untuk menemukan spy. |
| G045 | Siapa Aku? | Tebak karakter/objek dari pertanyaan ya/tidak. |
| G046 | Debate Arena | Dua tim mendapat topik lucu/serius dan voting pemenang. |
| G047 | Caption Contest | Pemain membuat caption gambar; grup voting pemenang. |
| G048 | Meme War | Kirim meme sesuai tema; voting dan leaderboard. |
| G049 | Story Chain | Member menyambung cerita; bot memberi twist acak. |
| G050 | Lelang Cepat | Auction item virtual dengan timer dan bid saldo fiktif. |
---

## 9. Upgrade Game Lama agar Lebih Asyik

Game lama tidak hanya dipertahankan, tetapi di-upgrade agar punya progression, kompetisi, dan variasi mode.

| Game Lama | Upgrade yang Dibutuhkan |
| --- | --- |
| Werewolf | Tambah ranked season, role mastery, private night action DM, replay summary, anti-afk, role balancing, dan mode chaos. |
| Truth/Dare/TOD | Tambah tema aman, level keberanian, vote skip, daily challenge, dan filter konten sensitif. |
| Tebak Kata | Tambah difficulty adaptif, hint berbayar coin, combo streak, mode duel, dan bank kata per kategori. |
| Tebak Gambar | Tambah blur/reveal bertahap, kategori, timer, dan leaderboard mingguan. |
| Suit | Tambah best-of-3, bracket tournament, statistik lawan, dan power-up kosmetik. |
| TicTacToe | Tambah matchmaking, rematch cepat, AI opponent, mode ultimate, dan ranking ELO. |
| Slot | Ubah menjadi game virtual-only dengan limit harian, pity reward, achievement, dan tanpa kaitan uang nyata. |
| Math | Tambah math sprint, boss battle, difficulty adaptif, pembahasan jawaban, dan ranking kelas. |
| Family100 | Tambah survey lokal admin, liga mingguan, steal answer, dan reveal sisa jawaban. |
| Couple/Jodoh | Tambah mode fun-only, alasan pairing lucu, batas spam, dan opt-out user. |
| Tebak Lagu | Tambah kategori era/genre, hint lirik terbatas, streak, dan mode duel. |
| RPG/Dungeon | Tambah party role, quest chain, inventory equipment, boss raid, dan guild. |
---

## 10. Sistem Game Terpadu

### 10.1 Komponen Wajib

| Komponen | Deskripsi |
|---|---|
| Game Lobby | Membuat room, join, leave, start, cancel. |
| Game Timer | Timeout lobby, turn, ronde, dan session. |
| Game Reward | XP, coin, badge, title, item kosmetik. |
| Leaderboard | Harian, mingguan, musiman, grup, dan global. |
| Anti-AFK | Auto-skip atau kick dari game jika diam. |
| Anti-cheat | Cegah user join ganda, spam jawaban, atau exploit reward. |
| Match History | Ringkasan hasil permainan. |
| Game Difficulty | Level mudah, normal, sulit, chaos/ranked. |
| Spectator Mode | Member bisa menonton tanpa ikut bermain. |
| Rematch | Main ulang cepat dengan pemain yang sama. |

### 10.2 Reward Design

Reward tidak boleh mendorong judi uang nyata. Semua reward harus berupa:

- Coin virtual.
- XP.
- Badge.
- Title.
- Item kosmetik.
- Achievement.
- Unlock difficulty/mode.

---

## 11. Requirement Teknis

### 11.1 Command Metadata

Setiap command baru wajib punya metadata:

```ts
{
  name: string;
  aliases: string[];
  category: string;
  plugin: string;
  featureFlag: string;
  minRole: 'user' | 'premium' | 'admin' | 'owner';
  premiumOnly?: boolean;
  rateLimitKey?: string;
  usage: string;
  description: string;
}
```

### 11.2 Feature Flag

Setiap fitur baru harus punya:

- Default value.
- Tipe data.
- Scope: global, group, user, atau private.
- Dokumentasi.
- Migration behavior.
- Fallback saat flag tidak dikenal.

### 11.3 Data Model yang Disarankan

Tambahkan model baru secara bertahap:

| Model | Tujuan |
|---|---|
| `FeatureCatalog` | Daftar fitur, kategori, status, dan dependency. |
| `GameRoom` | Lobby dan room multiplayer. |
| `GameRound` | State tiap ronde permainan. |
| `GameLeaderboard` | Ranking game harian/mingguan/musiman. |
| `GameAchievement` | Achievement khusus game. |
| `UserConsent` | Consent fitur AI/media/privacy. |
| `ConfigSnapshot` | Snapshot konfigurasi untuk rollback. |
| `CommandPolicy` | Izin command per role/plan/jam. |
| `FeatureRequest` | Request whitelist/domain/fitur dari admin/user. |
| `WebhookDelivery` | Tracking pengiriman webhook dan retry. |

### 11.4 Arsitektur

- Command baru tidak boleh memperbesar `src/app.ts` secara terus-menerus.
- Gunakan registry/plugin loader.
- Fitur berat harus masuk queue.
- State sementara harus memakai Redis pada production.
- Database production sebaiknya mendukung PostgreSQL.
- Log harus structured dan melakukan redaction untuk body pesan, JID, token, dan URL privat.

---

## 12. Acceptance Criteria

### 12.1 Acceptance Criteria Fitur Baru

Satu fitur dianggap selesai jika:

- Command bisa dipanggil dengan contoh penggunaan.
- Ada validasi input.
- Ada permission check.
- Ada feature flag.
- Ada rate limit bila rawan spam/berat.
- Ada test minimal untuk happy path dan invalid input.
- Ada dokumentasi singkat.
- Tidak membuat bot crash saat dependency eksternal gagal.

### 12.2 Acceptance Criteria Game

Satu game dianggap selesai jika:

- Bisa start, join, play, finish, dan cancel.
- State tidak menggantung setelah timeout.
- Ada reward dan leaderboard.
- Ada anti-AFK.
- Ada handling user keluar/tidak menjawab.
- Ada command help.
- Ada minimal 3 test: start game, valid action, timeout/end game.

---

## 13. Prioritas Implementasi

### Phase 0 — Fondasi Wajib

1. Rapikan command/plugin loader.
2. Tambahkan feature catalog.
3. Tambahkan structured logging dan redaction.
4. Tambahkan Redis production profile.
5. Tambahkan test fixture bot.
6. Tambahkan game engine shared module.
7. Tambahkan docs generator v2.

### Phase 1 — 40 Fitur High Impact

Prioritas awal:

- Security & moderation.
- Setup wizard v2.
- Reminder berulang.
- Jadwal/tugas kelas.
- Sticker pack manager.
- PDF split/reorder.
- Dashboard command heatmap.
- Feature adoption report.
- Game leaderboard framework.

### Phase 2 — 25 Game Baru

Mulai dari game yang mudah dan engaging:

- Wordle Indonesia.
- Hangman.
- Anagram Race.
- Quiz Duel.
- Quiz Battle Royale.
- Math Sprint.
- Suit Tournament.
- Caption Contest.
- Meme War.
- Spyfall Chat.
- Impostor Word.
- Dungeon Party.

### Phase 3 — Upgrade Game Lama

Fokus ke:

- Werewolf ranked/chaos.
- TOD story mode.
- Tebak Kata difficulty adaptif.
- TicTacToe ranking.
- Family100 league.
- RPG/dungeon party.

### Phase 4 — 100 Fitur Lanjutan + 25 Game Lanjutan

Implementasi fitur bisnis, automasi, analytics lanjutan, dan game RPG/strategi yang lebih kompleks.

---

## 14. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Bot makin berat saat startup | Startup lambat atau crash | Lazy loading plugin dan command. |
| SQLite bottleneck | DB locked di grup ramai | Production profile PostgreSQL. |
| State hilang saat restart | Game/queue/cooldown hilang | Redis untuk state dan queue. |
| Fitur AI boros biaya | Owner rugi | AI budget dan quota wallet. |
| Game disalahgunakan spam | Grup terganggu | Rate limit, anti-AFK, cooldown, schedule. |
| Data sensitif bocor di log | Risiko privasi | Redaction dan privacy mode default. |
| Dashboard/API disalahgunakan | Broadcast/setting berbahaya | API key rotation, IP allowlist, audit, rate limit. |
| Terlalu banyak fitur tidak selesai | Technical debt | Phase-based delivery dan definition of done. |

---

## 15. Metrics Sukses

| Metric | Target |
|---|---|
| Command success rate | > 95% untuk command ringan. |
| Error rate fitur baru | < 3% setelah stabilisasi. |
| Game completion rate | > 70% session selesai normal. |
| Median response command ringan | < 2 detik. |
| Queue success rate | > 90% untuk media/downloader. |
| Retention game mingguan | Naik 25% setelah game expansion. |
| Admin setup completion | > 60% grup menyelesaikan setup wizard. |
| Feature adoption | Minimal 20 fitur baru aktif di 30% grup aktif. |

---

## 16. Dokumentasi yang Harus Dibuat

- `docs/FEATURE_CATALOG.md`
- `docs/GAME_SYSTEM.md`
- `docs/COMMAND_METADATA.md`
- `docs/PRIVACY_AND_RETENTION.md`
- `docs/PRODUCTION_DEPLOYMENT.md`
- `docs/ROADMAP.md`

---

## 17. Catatan Implementasi untuk Developer

1. Jangan langsung menambah 190 command ke import statis di `src/app.ts`.
2. Buat modul loader yang membaca metadata command.
3. Setiap fitur harus bisa disabled tanpa menghapus kode.
4. Untuk game, gunakan reusable game engine agar tidak ada 50 implementasi state yang berbeda-beda.
5. Tambahkan migration dan seed untuk feature catalog.
6. Tambahkan dashboard untuk mengaktifkan fitur batch/preset.
7. Jangan menyimpan buffer media kecuali fitur memang aktif dan TTL jelas.
8. Hindari command yang melakukan network call tanpa timeout.
9. Semua fitur premium harus tetap memberi pesan upgrade yang sopan dan jelas.
10. Gunakan staged rollout: owner → grup test → premium beta → public.

---

## 18. Output yang Diharapkan

Setelah PRD ini diimplementasikan, Javas Bot WA memiliki:

- 140 fitur tambahan yang bermanfaat.
- 50 game tambahan.
- Game lama yang lebih kompetitif dan replayable.
- Dashboard yang lebih informatif.
- Sistem fitur yang lebih rapi.
- Fondasi production yang lebih kuat.
- Pengalaman grup yang lebih aman, seru, dan berguna.

