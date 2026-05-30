# Command Reference

Generated from `src/commands/registry/command-metadata.ts`.

## admin

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `absen` | - | admin | `/absen [buka/list/tutup]` | Mengelola absensi kehadiran (buka, list, tutup). |
| `addbadword` | `delbadword`, `listbadword` | admin | `/addbadword <kata> / /delbadword <kata> / /listbadword` | Mengelola daftar kata terlarang (sensor kata) grup. |
| `addreply` | `delreply`, `listreply` | admin | `/addreply <trigger> = <response> / /delreply <trigger>` | Mengelola auto-reply pesan otomatis dalam grup. |
| `antilink` | - | admin | `/antilink [on|off|status|mode]` | Mengatur fitur Anti-Link untuk menghapus tautan otomatis. |
| `antimention` | - | admin | `/antimention [on|off]` | Mengatur pencegahan spam mention massal dalam satu pesan. |
| `antispam` | - | admin | `/antispam [on|off|status|mode|limit]` | Mengatur fitur Anti-Spam dan cooldown kecepatan pesan grup. |
| `antisticker` | - | admin | `/antisticker [on|off]` | Mengatur pencegahan spam stiker beruntun. |
| `antivirtex` | - | admin | `/antivirtex [on|off]` | Mengatur pencegahan pesan sangat panjang/virtex. |
| `blacklist` | - | admin | `/blacklist @user <alasan>` | Memasukkan user ke daftar cekal (blacklist) grup. |
| `bot` | - | admin | `/bot [on/off]` | Mengaktifkan atau menonaktifkan respon pesan bot di grup. |
| `event` | - | admin | `/event <nama> <waktu>` | Membuat jadwal kegiatan atau event grup. |
| `feature` | - | admin | `/feature <nama_fitur> <on/off>` | Mengaktifkan/menonaktifkan feature flag di grup. |
| `listblacklist` | - | admin | `/listblacklist` | Melihat seluruh member yang ter-blacklist. |
| `poll` | `pollresult`, `closepoll` | admin | `/poll <pertanyaan> | <opsi1> | <opsi2>` | Mengelola jajak pendapat / polling. |
| `setcooldown` | - | admin | `/setcooldown <fitur> <detik>` | Mengatur cooldown delay per fitur dalam satuan detik. |
| `setprefix` | - | admin | `/setprefix <prefix>` | Mengubah prefix pemanggilan command bot di grup. |
| `setup` | `setupwizard` | admin | `/setup [basic|sekolah|komunitas|strict|game|reset|confirm]` | Melakukan onboarding grup atau melihat konfigurasi. |
| `statusfitur` | `features` | admin | `/statusfitur` | Melihat status feature flags aktif dalam grup. |
| `unblacklist` | - | admin | `/unblacklist @user` | Menghapus user dari daftar hitam/cekal grup. |
| `unwarn` | `clearwarn` | admin | `/unwarn @user` | Menghapus poin warning user. |
| `warn` | - | admin | `/warn @user <alasan>` | Memberikan poin warning (infraction) ke member grup. |
| `warnings` | - | admin | `/warnings @user` | Melihat jumlah warning yang dimiliki oleh user. |
| `whitelistdomain` | - | admin | `/whitelistdomain [add|del|list] [domain]` | Mengelola domain tautan yang diizinkan (whitelist). |

## audio

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `cutaudio` | - | user | `/cutaudio [start-end]` | Memotong durasi file audio. |
| `mp3` | `audio` | user | `Reply video dengan command /mp3.` | Mengekstrak suara/audio dari video menjadi format MP3. |
| `slow` | - | user | `/slow [multiplier]` | Memperlambat tempo pemutaran audio. |
| `speed` | - | user | `/speed [multiplier]` | Mempercepat tempo pemutaran audio. |
| `transkrip` | `vntext` | user | `Reply voice note dengan command /transkrip.` | Mengonversi file suara (Voice Note) menjadi teks tertulis. |
| `tts` | - | user | `/tts <teks>` | Mengonversi teks menjadi suara (Text-to-Speech). |
| `voice` | - | user | `/voice [robot|chipmunk|deep]` | Mengubah karakter/efek suara audio. |

## community

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `jadwal` | - | user | `/jadwal atau /jadwal add senin 07:00 Matematika atau /jadwal del <id>` | Mengelola jadwal mata pelajaran atau agenda kegiatan grup. |
| `remind` | `listremind`, `delremind` | user | `/remind 10m minum air atau /remind 20:00 sholat` | Mengatur pengingat waktu (scheduler) pribadi. |
| `remindgroup` | - | admin | `/remindgroup 10m minum air atau /remindgroup 20:00 sholat` | Mengatur pengingat waktu (scheduler) grup. |
| `tugas` | - | user | `/tugas atau /tugas add "besok 23:59" Tugas Matematika atau /tugas done <id>` | Mengelola tugas dan deadline kegiatan grup. |
| `ultah` | - | user | `/ultah atau /ultah add @user 12-08 atau /ultah del @user` | Mengelola tanggal ulang tahun anggota grup. |

## document

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `compresspdf` | - | user | `Reply file PDF dengan command /compresspdf.` | Memperkecil ukuran file PDF. |
| `img2pdf` | - | user | `Reply gambar secara batch atau kirim gambar dengan caption /img2pdf.` | Menggabungkan gambar menjadi satu file PDF. |
| `mergepdf` | - | user | `Kirim file PDF secara batch.` | Menggabungkan beberapa file PDF menjadi satu. |
| `pdf2img` | - | user | `Reply dokumen PDF dengan command /pdf2img.` | Mengonversi halaman PDF menjadi gambar JPG. |
| `qr` | - | user | `/qr <teks/url>` | Membuat QR Code dari teks atau URL. |
| `readqr` | - | user | `Reply gambar QR Code dengan command /readqr.` | Membaca isi teks dari QR Code gambar. |
| `scan` | - | user | `Reply gambar dokumen dengan command /scan.` | Membuat efek scan dokumen pada foto (Contras & Perspektif). |
| `unzip` | - | user | `Reply file ZIP/RAR dengan command /unzip.` | Mengekstrak file ZIP/RAR secara aman. |

## downloader

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `capcut` | `cc` | user | `/capcut <url>` | Mengunduh video dari template CapCut tanpa watermark. |
| `fb` | `facebook`, `fbdown` | user | `/fb <url>` | Mengunduh video dari postingan Facebook. |
| `ig` | `instagram` | user | `/ig <url>` | Mengunduh media (video/foto) dari post Instagram. |
| `pinterest` | `pin`, `pindl` | user | `/pinterest <url>` | Mengunduh media (gambar/video) dari Pinterest. |
| `threads` | `thread` | user | `/threads <url>` | Mengunduh video atau gambar dari postingan Threads. |
| `tt` | `tiktok` | user | `/tt <url>` | Mengunduh video TikTok tanpa watermark. |
| `twitter` | `x`, `twtdl` | user | `/twitter <url>` | Mengunduh video dari postingan Twitter/X. |
| `ytmp3` | `youtube-audio` | user | `/ytmp3 <url>` | Mengunduh audio dari video YouTube dalam format MP3. |
| `ytmp4` | `youtube-video` | user | `/ytmp4 <url>` | Mengunduh video dari YouTube dalam format MP4. |

## economy

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `achievement` | `achievements` | user | `/achievement` | Melihat daftar achievement dan progres unlock. |
| `badge` | - | user | `/badge atau /badge set <nama_badge>` | Melihat dan memasang badge achievement ke profile card. |
| `balance` | `bal` | user | `/balance` | Melihat saldo koin, level, dan poin XP Anda. |
| `buy` | - | user | `/buy <nama_barang>` | Membeli barang dari toko virtual. |
| `claim` | `daily` | user | `/claim` | Klaim hadiah koin dan XP harian. |
| `dungeon` | - | user | `/dungeon` | Memulai pertarungan dungeon RPG. |
| `inventory` | `inv` | user | `/inventory` | Melihat daftar barang di tas (inventory) Anda. |
| `pet` | - | user | `/pet [adopt|feed|status|battle]` | Mengelola peliharaan (adopt, feed, status, battle). |
| `rank` | `level` | user | `/rank` | Menampilkan tingkat rank profil level XP. |
| `sell` | - | user | `/sell <nama_barang>` | Menjual barang dari inventory ke toko. |
| `setbadge` | - | user | `/setbadge <badge1> [badge2]` | Mengatur badge custom untuk profile card. |
| `shop` | - | user | `/shop` | Melihat barang-barang yang dijual di toko virtual. |
| `title` | `settitle` | user | `/title atau /title set <nama_gelar>` | Melihat dan memasang title profil dari achievement atau item toko. |
| `top` | `leaderboard` | user | `/top` | Menampilkan papan peringkat pengguna terkaya. |
| `transfer` | - | user | `/transfer @user <jumlah>` | Mengirim saldo koin ke user lain. |

## games

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `couple` | `jodoh` | user | `/couple` | Mencocokkan profil jodoh acak dalam grup. |
| `family100` | - | user | `/family100` | Memulai game Family 100. |
| `math` | - | user | `/math` | Memulai kuis matematika. |
| `slot` | - | user | `/slot` | Taruhan koin pada mesin slot virtual. |
| `suit` | `pilih` | user | `/suit @user untuk menantang, /pilih [batu/gunting/kertas] untuk memilih.` | Tantang pemain lain untuk bermain suit (PvP). |
| `tebakgambar` | - | user | `/tebakgambar untuk mulai.` | Game kuis tebak gambar interaktif. |
| `tebakkata` | `jawab` | user | `/tebakkata untuk mulai, /jawab <jawaban> untuk menjawab.` | Game tebak kata / menjawab kuis aktif. |
| `tod` | `truth`, `dare` | user | `/tod, /truth, atau /dare` | Memulai sesi permainan Truth or Dare. |
| `ttt` | - | user | `/ttt @user untuk menantang, /ttt <angka 1-9> untuk giliran.` | Memulai permainan Tic Tac Toe dengan pemain lain. |
| `ww` | - | user | `/ww [create|join|start|stop|vote|kill|protect|check]` | Mengelola dan memainkan game Werewolf. |
| `wwrank` | `wwstats` | user | `/wwrank` | Melihat peringkat/peringkat kemenangan Werewolf. |

## general

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `ceksewa` | - | user | `/ceksewa` | Memeriksa sisa masa aktif sewa grup ini. |
| `fitursewa` | - | user | `/fitursewa` | Melihat perbandingan fitur antar plan sewa. |
| `rules` | - | user | `/rules` | Melihat ketentuan penggunaan bot. |
| `sewa` | - | user | `/sewa` | Melihat informasi harga sewa bot. |

## media

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `compress` | `kompres` | user | `/compress [low|medium|high]` | Memperkecil ukuran file video/gambar. |
| `crop` | - | user | `/crop [square|story|pp]` | Memotong gambar dengan rasio tertentu. |
| `cut` | - | user | `/cut [start-end]` | Memotong durasi file video. |
| `hd` | - | user | `Kirim gambar dengan caption /hd atau reply gambar.` | Meningkatkan resolusi dan ketajaman gambar (HD). |
| `mute` | - | user | `Reply video dengan command /mute.` | Menghilangkan suara dari file video. |
| `resize` | - | user | `/resize <dimensi/preset>` | Mengubah resolusi/dimensi gambar. |
| `reverse` | - | user | `Reply video dengan command /reverse.` | Memutar balik alur video (reverse). |
| `thumb` | - | user | `/thumb [timestamp]` | Mengambil gambar thumbnail dari video pada detik tertentu. |
| `togif` | - | user | `Reply video dengan command /togif.` | Mengonversi video menjadi animasi format GIF. |
| `wm` | - | user | `/wm <teks>` | Menambahkan watermark teks kustom pada gambar. |

## moderation

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `addwarnrule` | - | user | `/addwarnrule <batas> <kick/mute>` | Menambahkan aturan tindakan untuk batas peringatan tertentu. |
| `clearwarn` | - | user | `/clearwarn @user` | Menghapus semua peringatan pengguna. |
| `delwarnrule` | - | user | `/delwarnrule <batas>` | Menghapus aturan batas peringatan. |
| `listwarnrule` | - | user | `/listwarnrule` | Melihat daftar aturan batas peringatan grup. |
| `unwarn` | - | user | `/unwarn @user` | Menghapus satu peringatan terakhir pengguna. |
| `warn` | - | user | `/warn @user <alasan>` | Memberikan peringatan kepada anggota grup. |
| `warnings` | - | user | `/warnings [@user]` | Melihat daftar peringatan seseorang. |

## owner

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `addsewa` | - | owner | `/addsewa <groupId|current> [hari] [plan]` | Menambahkan sewa grup baru. |
| `apikey` | `revokeapikey` | owner | `/apikey atau /revokeapikey` | Mengelola token API admin system. |
| `backup` | `backupdb`, `backupconfig` | owner | `/backup atau /backupdb atau /backupconfig` | Membuat backup database atau konfigurasi secara manual. |
| `broadcast` | - | owner | `/broadcast <pesan>` | Mengirimkan pesan siaran ke seluruh chat. |
| `delsewa` | - | owner | `/delsewa <groupId|current>` | Menghapus sewa grup. |
| `exportconfig` | `importconfig` | owner | `/exportconfig atau reply JSON dengan /importconfig` | Export atau import konfigurasi grup dan subscription. |
| `extendsewa` | - | owner | `/extendsewa <groupId|current> <hari>` | Memperpanjang masa aktif sewa grup. |
| `limit` | - | owner | `/limit` | Melihat informasi sisa limit bot. |
| `listbackup` | - | owner | `/listbackup` | Melihat daftar backup lokal. |
| `listsewa` | - | owner | `/listsewa` | Melihat seluruh sewa grup aktif. |
| `maintenance` | - | owner | `/maintenance [on/off]` | Mengaktifkan/menonaktifkan mode pemeliharaan bot. |
| `plugin` | - | owner | `/plugin [list|on|off] [nama]` | Mengaktifkan/menonaktifkan plugin secara global. |
| `premium` | - | owner | `/premium [add/remove] @user <hari>` | Mengelola daftar premium user. |
| `restorebackup` | - | owner | `/restorebackup <id>` | Restore database dari backup dengan konfirmasi eksplisit. |
| `setplan` | - | owner | `/setplan <groupId|current> <free|basic|premium>` | Mengatur paket sewa grup. |
| `stats` | - | owner | `/stats` | Melihat status performa server dan error log. |

## sticker

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `batchstiker` | `pack` | user | `Reply gambar secara batch dengan command /batchstiker.` | Mengonversi beberapa gambar sekaligus menjadi stiker pack. |
| `brat` | - | user | `/brat <teks> atau /brat classic <teks>` | Membuat stiker bergaya brat (putih polos dengan teks hitam & blur ringan). |
| `circle` | `bulat` | user | `Reply gambar dengan command /circle.` | Memotong gambar berbentuk lingkaran dan menjadikannya stiker. |
| `emojimix` | `mix` | user | `/mix <emoji1> <emoji2>` | Menggabungkan dua emoji menjadi stiker mix. |
| `meme` | - | user | `/meme <teks atas> | <teks bawah> pada caption/reply gambar.` | Membuat meme dari gambar dengan teks atas dan teks bawah. |
| `outline` | - | user | `/outline [white/black] pada reply gambar/stiker.` | Menambahkan garis tepi (outline) berwarna putih/hitam pada stiker. |
| `quote` | - | user | `/quote <kutipan>` | Membuat stiker kutipan dengan latar belakang gradasi warna. |
| `removebg` | `rbg` | user | `Kirim gambar dengan caption /removebg atau reply gambar.` | Menghapus latar belakang gambar (batas 5MB untuk free, 15MB untuk premium). |
| `stiker` | `s` | user | `Kirim gambar/video dengan caption /stiker atau reply gambar/video.` | Mengonversi gambar atau video pendek menjadi stiker WhatsApp. |
| `stikerbg` | `nobgstick` | user | `Kirim gambar dengan caption /stikerbg atau reply gambar.` | Menghapus latar belakang gambar dan menjadikannya stiker. |
| `toimg` | - | user | `Reply stiker yang ingin diubah menjadi gambar.` | Mengonversi stiker menjadi gambar PNG kembali. |
| `vstiker` | `gifstiker` | user | `Reply video dengan command /vstiker.` | Mengonversi video menjadi stiker bergerak (max 5s free, 10s premium). |

## text

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `balas` | - | user | `/balas [formal|santai|lucu] <teks> atau reply teks.` | Membuat balasan chat sesuai gaya tertentu. |
| `jelaskan` | `rangkum` | user | `/jelaskan <topik>` | Menjelaskan suatu konsep atau topik pelajaran. |
| `ocr` | - | user | `Reply gambar dengan command /ocr.` | Mengekstrak teks tulisan dari suatu gambar. |
| `ringkas` | `summarize` | user | `/ringkas <teks> atau reply teks.` | Meringkas tulisan panjang. |
| `translate` | `tr` | user | `/tr <lang> <teks> atau reply teks.` | Menerjemahkan teks ke bahasa tujuan. |
| `typo` | `koreksi` | user | `/typo <teks> atau reply teks.` | Mengoreksi kesalahan penulisan (typo) secara otomatis. |
| `ubah` | - | user | `/ubah [gaya] <teks> atau reply teks.` | Mengubah gaya penulisan bahasa (formal/santai/sopan/lucu/singkat). |

