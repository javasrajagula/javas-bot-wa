# Command Reference

Generated from `src/commands/registry/command-metadata.ts`.

## admin

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `addbadword` | `delbadword`, `listbadword` | admin | `/addbadword <kata> / /delbadword <kata> / /listbadword` | Mengelola daftar kata terlarang (sensor kata) grup. |
| `addreply` | `delreply`, `listreply` | admin | `/addreply <trigger> = <response> / /delreply <trigger>` | Mengelola auto-reply pesan otomatis dalam grup. |
| `antilink` | - | admin | `/antilink [on|off|status|mode]` | Mengatur fitur Anti-Link untuk menghapus tautan otomatis. |
| `antimention` | - | admin | `/antimention [on|off]` | Mengatur pencegahan spam mention massal dalam satu pesan. |
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

## ai

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `ai` | - | user | `/ai [opsi]` | Command PRD /ai dengan handler aman dan terdaftar di menu. |
| `bio` | - | user | `/bio [opsi]` | Command PRD /bio dengan handler aman dan terdaftar di menu. |
| `caption` | - | user | `/caption [opsi]` | Command PRD /caption dengan handler aman dan terdaftar di menu. |
| `claimmission` | - | user | `/claimmission [opsi]` | Command PRD /claimmission dengan handler aman dan terdaftar di menu. |
| `dailyshop` | - | user | `/dailyshop [opsi]` | Command PRD /dailyshop dengan handler aman dan terdaftar di menu. |
| `hashtag` | - | user | `/hashtag [opsi]` | Command PRD /hashtag dengan handler aman dan terdaftar di menu. |
| `koreksiesai` | - | user | `/koreksiesai [opsi]` | Command PRD /koreksiesai dengan handler aman dan terdaftar di menu. |
| `refclaim` | - | user | `/refclaim [opsi]` | Command PRD /refclaim dengan handler aman dan terdaftar di menu. |
| `ringkas` | - | user | `/ringkas [opsi]` | Command PRD /ringkas dengan handler aman dan terdaftar di menu. |
| `ringkasaudio` | - | user | `/ringkasaudio [opsi]` | Command PRD /ringkasaudio dengan handler aman dan terdaftar di menu. |
| `ringkashariini` | - | user | `/ringkashariini [opsi]` | Command PRD /ringkashariini dengan handler aman dan terdaftar di menu. |
| `scriptvideo` | - | user | `/scriptvideo [opsi]` | Command PRD /scriptvideo dengan handler aman dan terdaftar di menu. |
| `srt` | - | user | `/srt [opsi]` | Command PRD /srt dengan handler aman dan terdaftar di menu. |
| `subtitle` | - | user | `/subtitle [opsi]` | Command PRD /subtitle dengan handler aman dan terdaftar di menu. |
| `thumbnail` | - | user | `/thumbnail [opsi]` | Command PRD /thumbnail dengan handler aman dan terdaftar di menu. |
| `translate` | - | user | `/translate [opsi]` | Command PRD /translate dengan handler aman dan terdaftar di menu. |
| `translateaudio` | - | user | `/translateaudio [opsi]` | Command PRD /translateaudio dengan handler aman dan terdaftar di menu. |
| `translatequiz` | - | user | `/translatequiz [opsi]` | Command PRD /translatequiz dengan handler aman dan terdaftar di menu. |
| `whitelistdomain` | - | admin | `/whitelistdomain [opsi]` | Command PRD /whitelistdomain dengan handler aman dan terdaftar di menu. |

## analytics

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `activegroups` | - | user | `/activegroups [opsi]` | Command PRD /activegroups dengan handler aman dan terdaftar di menu. |
| `adminstats` | - | user | `/adminstats [opsi]` | Command PRD /adminstats dengan handler aman dan terdaftar di menu. |
| `analytics` | - | user | `/analytics [opsi]` | Command PRD /analytics dengan handler aman dan terdaftar di menu. |
| `coststats` | - | user | `/coststats [opsi]` | Command PRD /coststats dengan handler aman dan terdaftar di menu. |
| `errorstats` | - | user | `/errorstats [opsi]` | Command PRD /errorstats dengan handler aman dan terdaftar di menu. |
| `groupstats` | - | user | `/groupstats [opsi]` | Command PRD /groupstats dengan handler aman dan terdaftar di menu. |
| `inactive` | - | user | `/inactive [opsi]` | Command PRD /inactive dengan handler aman dan terdaftar di menu. |
| `income` | - | user | `/income [opsi]` | Command PRD /income dengan handler aman dan terdaftar di menu. |
| `sentiment` | - | user | `/sentiment [opsi]` | Command PRD /sentiment dengan handler aman dan terdaftar di menu. |
| `topactive` | - | user | `/topactive [opsi]` | Command PRD /topactive dengan handler aman dan terdaftar di menu. |
| `topchat` | - | user | `/topchat [opsi]` | Command PRD /topchat dengan handler aman dan terdaftar di menu. |
| `topcmd` | - | user | `/topcmd [opsi]` | Command PRD /topcmd dengan handler aman dan terdaftar di menu. |
| `topsticker` | - | user | `/topsticker [opsi]` | Command PRD /topsticker dengan handler aman dan terdaftar di menu. |

## audio

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `cutaudio` | - | user | `/cutaudio [start-end]` | Memotong durasi file audio. |
| `mp3` | `audio` | user | `Reply video dengan command /mp3.` | Mengekstrak suara/audio dari video menjadi format MP3. |
| `slow` | - | user | `/slow [multiplier]` | Memperlambat tempo pemutaran audio. |
| `speed` | - | user | `/speed [multiplier]` | Mempercepat tempo pemutaran audio. |
| `tts` | - | user | `/tts <teks>` | Mengonversi teks menjadi suara (Text-to-Speech). |
| `voice` | - | user | `/voice [robot|chipmunk|deep]` | Mengubah karakter/efek suara audio. |

## automation

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `auto` | - | user | `/auto [opsi]` | Command PRD /auto dengan handler aman dan terdaftar di menu. |
| `autoclose` | - | admin | `/autoclose [opsi]` | Command PRD /autoclose dengan handler aman dan terdaftar di menu. |
| `autoopen` | - | admin | `/autoopen [opsi]` | Command PRD /autoopen dengan handler aman dan terdaftar di menu. |
| `autoslowmode` | - | admin | `/autoslowmode [opsi]` | Command PRD /autoslowmode dengan handler aman dan terdaftar di menu. |
| `generaterules` | - | user | `/generaterules [opsi]` | Command PRD /generaterules dengan handler aman dan terdaftar di menu. |
| `rule` | - | user | `/rule [opsi]` | Command PRD /rule dengan handler aman dan terdaftar di menu. |
| `rules` | - | user | `/rules [opsi]` | Command PRD /rules dengan handler aman dan terdaftar di menu. |
| `ruleslog` | - | user | `/ruleslog [opsi]` | Command PRD /ruleslog dengan handler aman dan terdaftar di menu. |
| `var` | - | user | `/var [opsi]` | Command PRD /var dengan handler aman dan terdaftar di menu. |
| `workflow` | - | user | `/workflow [opsi]` | Command PRD /workflow dengan handler aman dan terdaftar di menu. |

## business

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `arisan` | - | user | `/arisan [opsi]` | Command PRD /arisan dengan handler aman dan terdaftar di menu. |
| `budget` | - | user | `/budget [opsi]` | Command PRD /budget dengan handler aman dan terdaftar di menu. |
| `catat` | - | user | `/catat [opsi]` | Command PRD /catat dengan handler aman dan terdaftar di menu. |
| `catatan` | - | user | `/catatan [opsi]` | Command PRD /catatan dengan handler aman dan terdaftar di menu. |
| `customer` | - | user | `/customer [opsi]` | Command PRD /customer dengan handler aman dan terdaftar di menu. |
| `escrow` | - | user | `/escrow [opsi]` | Command PRD /escrow dengan handler aman dan terdaftar di menu. |
| `hapusjual` | - | user | `/hapusjual [opsi]` | Command PRD /hapusjual dengan handler aman dan terdaftar di menu. |
| `invoice` | - | user | `/invoice [opsi]` | Command PRD /invoice dengan handler aman dan terdaftar di menu. |
| `iuran` | - | user | `/iuran [opsi]` | Command PRD /iuran dengan handler aman dan terdaftar di menu. |
| `jual` | - | user | `/jual [opsi]` | Command PRD /jual dengan handler aman dan terdaftar di menu. |
| `kas` | - | user | `/kas [opsi]` | Command PRD /kas dengan handler aman dan terdaftar di menu. |
| `kontrak` | - | user | `/kontrak [opsi]` | Command PRD /kontrak dengan handler aman dan terdaftar di menu. |
| `listjual` | - | user | `/listjual [opsi]` | Command PRD /listjual dengan handler aman dan terdaftar di menu. |
| `ongkir` | - | user | `/ongkir [opsi]` | Command PRD /ongkir dengan handler aman dan terdaftar di menu. |
| `order` | - | user | `/order [opsi]` | Command PRD /order dengan handler aman dan terdaftar di menu. |
| `produk` | - | user | `/produk [opsi]` | Command PRD /produk dengan handler aman dan terdaftar di menu. |
| `resellerorder` | - | user | `/resellerorder [opsi]` | Command PRD /resellerorder dengan handler aman dan terdaftar di menu. |
| `resi` | - | user | `/resi [opsi]` | Command PRD /resi dengan handler aman dan terdaftar di menu. |
| `split` | - | user | `/split [opsi]` | Command PRD /split dengan handler aman dan terdaftar di menu. |
| `splitadd` | - | user | `/splitadd [opsi]` | Command PRD /splitadd dengan handler aman dan terdaftar di menu. |
| `splitdone` | - | user | `/splitdone [opsi]` | Command PRD /splitdone dengan handler aman dan terdaftar di menu. |
| `splitstatus` | - | user | `/splitstatus [opsi]` | Command PRD /splitstatus dengan handler aman dan terdaftar di menu. |
| `tagihan` | - | user | `/tagihan [opsi]` | Command PRD /tagihan dengan handler aman dan terdaftar di menu. |

## community

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `remindgroup` | - | admin | `/remindgroup 10m minum air atau /remindgroup 20:00 sholat` | Mengatur pengingat waktu (scheduler) grup. |
| `ultah` | - | user | `/ultah atau /ultah add @user 12-08 atau /ultah del @user` | Mengelola tanggal ulang tahun anggota grup. |

## developer

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `canceljob` | - | user | `/canceljob [opsi]` | Command PRD /canceljob dengan handler aman dan terdaftar di menu. |
| `clearerrors` | - | owner | `/clearerrors [opsi]` | Command PRD /clearerrors dengan handler aman dan terdaftar di menu. |
| `dbstatus` | - | user | `/dbstatus [opsi]` | Command PRD /dbstatus dengan handler aman dan terdaftar di menu. |
| `diagnose` | - | user | `/diagnose [opsi]` | Command PRD /diagnose dengan handler aman dan terdaftar di menu. |
| `error` | - | user | `/error [opsi]` | Command PRD /error dengan handler aman dan terdaftar di menu. |
| `grouphealth` | - | user | `/grouphealth [opsi]` | Command PRD /grouphealth dengan handler aman dan terdaftar di menu. |
| `health` | - | user | `/health [opsi]` | Command PRD /health dengan handler aman dan terdaftar di menu. |
| `job` | - | user | `/job [opsi]` | Command PRD /job dengan handler aman dan terdaftar di menu. |
| `queue` | - | user | `/queue [opsi]` | Command PRD /queue dengan handler aman dan terdaftar di menu. |
| `securitycheck` | - | user | `/securitycheck [opsi]` | Command PRD /securitycheck dengan handler aman dan terdaftar di menu. |
| `setupcheck` | - | user | `/setupcheck [opsi]` | Command PRD /setupcheck dengan handler aman dan terdaftar di menu. |
| `statusbot` | - | user | `/statusbot [opsi]` | Command PRD /statusbot dengan handler aman dan terdaftar di menu. |
| `webhook` | - | user | `/webhook [opsi]` | Command PRD /webhook dengan handler aman dan terdaftar di menu. |

## document

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `compresspdf` | - | user | `Reply file PDF dengan command /compresspdf.` | Memperkecil ukuran file PDF. |
| `docx2pdf` | - | user | `/docx2pdf [opsi]` | Command PRD /docx2pdf dengan handler aman dan terdaftar di menu. |
| `exportcsv` | - | user | `/exportcsv [opsi]` | Command PRD /exportcsv dengan handler aman dan terdaftar di menu. |
| `exportdata` | - | user | `/exportdata [opsi]` | Command PRD /exportdata dengan handler aman dan terdaftar di menu. |
| `exportexcel` | - | user | `/exportexcel [opsi]` | Command PRD /exportexcel dengan handler aman dan terdaftar di menu. |
| `exportjson` | - | user | `/exportjson [opsi]` | Command PRD /exportjson dengan handler aman dan terdaftar di menu. |
| `exportpdf` | - | user | `/exportpdf [opsi]` | Command PRD /exportpdf dengan handler aman dan terdaftar di menu. |
| `fileinfo` | - | user | `/fileinfo [opsi]` | Command PRD /fileinfo dengan handler aman dan terdaftar di menu. |
| `img2pdf` | - | user | `Reply gambar secara batch atau kirim gambar dengan caption /img2pdf.` | Menggabungkan gambar menjadi satu file PDF. |
| `mergepdf` | - | user | `Kirim file PDF secara batch.` | Menggabungkan beberapa file PDF menjadi satu. |
| `ocr` | - | user | `/ocr [opsi]` | Command PRD /ocr dengan handler aman dan terdaftar di menu. |
| `ocrpdf` | - | user | `/ocrpdf [opsi]` | Command PRD /ocrpdf dengan handler aman dan terdaftar di menu. |
| `pdf2img` | - | user | `Reply dokumen PDF dengan command /pdf2img.` | Mengonversi halaman PDF menjadi gambar JPG. |
| `pdfsplit` | - | user | `/pdfsplit [opsi]` | Command PRD /pdfsplit dengan handler aman dan terdaftar di menu. |
| `pdftext` | - | user | `/pdftext [opsi]` | Command PRD /pdftext dengan handler aman dan terdaftar di menu. |
| `pdfwatermark` | - | user | `/pdfwatermark [opsi]` | Command PRD /pdfwatermark dengan handler aman dan terdaftar di menu. |
| `profile` | - | user | `/profile [opsi]` | Command PRD /profile dengan handler aman dan terdaftar di menu. |
| `profilecard` | - | user | `/profilecard [opsi]` | Command PRD /profilecard dengan handler aman dan terdaftar di menu. |
| `scan` | - | user | `Reply gambar dokumen dengan command /scan.` | Membuat efek scan dokumen pada foto (Contras & Perspektif). |
| `scanfile` | - | user | `/scanfile [opsi]` | Command PRD /scanfile dengan handler aman dan terdaftar di menu. |
| `struk` | - | user | `/struk [opsi]` | Command PRD /struk dengan handler aman dan terdaftar di menu. |
| `tableocr` | - | user | `/tableocr [opsi]` | Command PRD /tableocr dengan handler aman dan terdaftar di menu. |
| `txt2pdf` | - | user | `/txt2pdf [opsi]` | Command PRD /txt2pdf dengan handler aman dan terdaftar di menu. |
| `unzip` | - | user | `Reply file ZIP/RAR dengan command /unzip.` | Mengekstrak file ZIP/RAR secara aman. |
| `ziplist` | - | user | `/ziplist [opsi]` | Command PRD /ziplist dengan handler aman dan terdaftar di menu. |

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
| `-rep` | - | user | `/-rep [opsi]` | Command PRD /-rep dengan handler aman dan terdaftar di menu. |
| `achievement` | `achievements` | user | `/achievement` | Melihat daftar achievement dan progres unlock. |
| `balance` | `bal` | user | `/balance` | Melihat saldo koin, level, dan poin XP Anda. |
| `buy` | - | user | `/buy <nama_barang>` | Membeli barang dari toko virtual. |
| `claim` | `daily` | user | `/claim` | Klaim hadiah koin dan XP harian. |
| `clan` | - | user | `/clan [opsi]` | Command PRD /clan dengan handler aman dan terdaftar di menu. |
| `dungeon` | - | user | `/dungeon` | Memulai pertarungan dungeon RPG. |
| `giftitem` | - | user | `/giftitem [opsi]` | Command PRD /giftitem dengan handler aman dan terdaftar di menu. |
| `inventory` | `inv` | user | `/inventory` | Melihat daftar barang di tas (inventory) Anda. |
| `lelang` | - | user | `/lelang [opsi]` | Command PRD /lelang dengan handler aman dan terdaftar di menu. |
| `mission` | - | user | `/mission [opsi]` | Command PRD /mission dengan handler aman dan terdaftar di menu. |
| `pass` | - | user | `/pass [opsi]` | Command PRD /pass dengan handler aman dan terdaftar di menu. |
| `pet` | - | user | `/pet [adopt|feed|status|battle]` | Mengelola peliharaan (adopt, feed, status, battle). |
| `raffle` | - | user | `/raffle [opsi]` | Command PRD /raffle dengan handler aman dan terdaftar di menu. |
| `rank` | `level` | user | `/rank` | Menampilkan tingkat rank profil level XP. |
| `rep` | - | user | `/rep [opsi]` | Command PRD /rep dengan handler aman dan terdaftar di menu. |
| `reward` | - | user | `/reward [opsi]` | Command PRD /reward dengan handler aman dan terdaftar di menu. |
| `role` | - | user | `/role [opsi]` | Command PRD /role dengan handler aman dan terdaftar di menu. |
| `score` | - | user | `/score [opsi]` | Command PRD /score dengan handler aman dan terdaftar di menu. |
| `season` | - | user | `/season [opsi]` | Command PRD /season dengan handler aman dan terdaftar di menu. |
| `sell` | - | user | `/sell <nama_barang>` | Menjual barang dari inventory ke toko. |
| `setbadge` | - | user | `/setbadge <badge1> [badge2]` | Mengatur badge custom untuk profile card. |
| `shop` | - | user | `/shop` | Melihat barang-barang yang dijual di toko virtual. |
| `tier` | - | user | `/tier [opsi]` | Command PRD /tier dengan handler aman dan terdaftar di menu. |
| `top` | `leaderboard` | user | `/top` | Menampilkan papan peringkat pengguna terkaya. |
| `toprep` | - | user | `/toprep [opsi]` | Command PRD /toprep dengan handler aman dan terdaftar di menu. |
| `toprole` | - | user | `/toprole [opsi]` | Command PRD /toprole dengan handler aman dan terdaftar di menu. |
| `topscore` | - | user | `/topscore [opsi]` | Command PRD /topscore dengan handler aman dan terdaftar di menu. |
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
| `absen` | - | user | `/absen [opsi]` | Command PRD /absen dengan handler aman dan terdaftar di menu. |
| `achievements` | - | user | `/achievements [opsi]` | Command PRD /achievements dengan handler aman dan terdaftar di menu. |
| `actionitems` | - | user | `/actionitems [opsi]` | Command PRD /actionitems dengan handler aman dan terdaftar di menu. |
| `activefeatures` | - | user | `/activefeatures [opsi]` | Command PRD /activefeatures dengan handler aman dan terdaftar di menu. |
| `addcmd` | - | user | `/addcmd [opsi]` | Command PRD /addcmd dengan handler aman dan terdaftar di menu. |
| `adminroom` | - | admin | `/adminroom [opsi]` | Command PRD /adminroom dengan handler aman dan terdaftar di menu. |
| `allowgroup` | - | owner | `/allowgroup [opsi]` | Command PRD /allowgroup dengan handler aman dan terdaftar di menu. |
| `announce` | - | user | `/announce [opsi]` | Command PRD /announce dengan handler aman dan terdaftar di menu. |
| `announcement` | - | user | `/announcement [opsi]` | Command PRD /announcement dengan handler aman dan terdaftar di menu. |
| `announcements` | - | user | `/announcements [opsi]` | Command PRD /announcements dengan handler aman dan terdaftar di menu. |
| `approval` | - | admin | `/approval [opsi]` | Command PRD /approval dengan handler aman dan terdaftar di menu. |
| `approve` | - | admin | `/approve [opsi]` | Command PRD /approve dengan handler aman dan terdaftar di menu. |
| `audit` | - | user | `/audit [opsi]` | Command PRD /audit dengan handler aman dan terdaftar di menu. |
| `badge` | - | user | `/badge [opsi]` | Command PRD /badge dengan handler aman dan terdaftar di menu. |
| `balas` | - | user | `/balas [opsi]` | Command PRD /balas dengan handler aman dan terdaftar di menu. |
| `banner` | - | user | `/banner [opsi]` | Command PRD /banner dengan handler aman dan terdaftar di menu. |
| `belajar` | - | user | `/belajar [opsi]` | Command PRD /belajar dengan handler aman dan terdaftar di menu. |
| `besok` | - | user | `/besok [opsi]` | Command PRD /besok dengan handler aman dan terdaftar di menu. |
| `calendar` | - | user | `/calendar [opsi]` | Command PRD /calendar dengan handler aman dan terdaftar di menu. |
| `cariitem` | - | user | `/cariitem [opsi]` | Command PRD /cariitem dengan handler aman dan terdaftar di menu. |
| `cekpenipuan` | - | user | `/cekpenipuan [opsi]` | Command PRD /cekpenipuan dengan handler aman dan terdaftar di menu. |
| `changelog` | - | user | `/changelog [opsi]` | Command PRD /changelog dengan handler aman dan terdaftar di menu. |
| `chatmode` | - | user | `/chatmode [opsi]` | Command PRD /chatmode dengan handler aman dan terdaftar di menu. |
| `checkimage` | - | user | `/checkimage [opsi]` | Command PRD /checkimage dengan handler aman dan terdaftar di menu. |
| `checklink` | - | user | `/checklink [opsi]` | Command PRD /checklink dengan handler aman dan terdaftar di menu. |
| `close` | - | admin | `/close [opsi]` | Command PRD /close dengan handler aman dan terdaftar di menu. |
| `cmdalias` | - | user | `/cmdalias [opsi]` | Command PRD /cmdalias dengan handler aman dan terdaftar di menu. |
| `commandstatus` | - | user | `/commandstatus [opsi]` | Command PRD /commandstatus dengan handler aman dan terdaftar di menu. |
| `config` | - | owner | `/config [opsi]` | Command PRD /config dengan handler aman dan terdaftar di menu. |
| `cv` | - | user | `/cv [opsi]` | Command PRD /cv dengan handler aman dan terdaftar di menu. |
| `dashboard` | - | user | `/dashboard [opsi]` | Command PRD /dashboard dengan handler aman dan terdaftar di menu. |
| `deadline` | - | user | `/deadline [opsi]` | Command PRD /deadline dengan handler aman dan terdaftar di menu. |
| `delcmd` | - | user | `/delcmd [opsi]` | Command PRD /delcmd dengan handler aman dan terdaftar di menu. |
| `demomode` | - | user | `/demomode [opsi]` | Command PRD /demomode dengan handler aman dan terdaftar di menu. |
| `denygroup` | - | owner | `/denygroup [opsi]` | Command PRD /denygroup dengan handler aman dan terdaftar di menu. |
| `disablecmd` | - | owner | `/disablecmd [opsi]` | Command PRD /disablecmd dengan handler aman dan terdaftar di menu. |
| `enablecmd` | - | owner | `/enablecmd [opsi]` | Command PRD /enablecmd dengan handler aman dan terdaftar di menu. |
| `expiredsoon` | - | user | `/expiredsoon [opsi]` | Command PRD /expiredsoon dengan handler aman dan terdaftar di menu. |
| `filtermedia` | - | admin | `/filtermedia [opsi]` | Command PRD /filtermedia dengan handler aman dan terdaftar di menu. |
| `fitursewa` | - | user | `/fitursewa` | Melihat perbandingan fitur antar plan sewa. |
| `fokus` | - | user | `/fokus [opsi]` | Command PRD /fokus dengan handler aman dan terdaftar di menu. |
| `giveaway` | - | user | `/giveaway [opsi]` | Command PRD /giveaway dengan handler aman dan terdaftar di menu. |
| `goodbye` | - | admin | `/goodbye [opsi]` | Command PRD /goodbye dengan handler aman dan terdaftar di menu. |
| `groupmode` | - | admin | `/groupmode [opsi]` | Command PRD /groupmode dengan handler aman dan terdaftar di menu. |
| `hariini` | - | user | `/hariini [opsi]` | Command PRD /hariini dengan handler aman dan terdaftar di menu. |
| `hidetag` | - | admin | `/hidetag [opsi]` | Command PRD /hidetag dengan handler aman dan terdaftar di menu. |
| `idekonten` | - | user | `/idekonten [opsi]` | Command PRD /idekonten dengan handler aman dan terdaftar di menu. |
| `jelaskan` | - | user | `/jelaskan [opsi]` | Command PRD /jelaskan dengan handler aman dan terdaftar di menu. |
| `linkgc` | - | admin | `/linkgc [opsi]` | Command PRD /linkgc dengan handler aman dan terdaftar di menu. |
| `listcmd` | - | user | `/listcmd [opsi]` | Command PRD /listcmd dengan handler aman dan terdaftar di menu. |
| `listening` | - | user | `/listening [opsi]` | Command PRD /listening dengan handler aman dan terdaftar di menu. |
| `logoutwa` | - | owner | `/logoutwa [opsi]` | Command PRD /logoutwa dengan handler aman dan terdaftar di menu. |
| `lowresource` | - | user | `/lowresource [opsi]` | Command PRD /lowresource dengan handler aman dan terdaftar di menu. |
| `market` | - | user | `/market [opsi]` | Command PRD /market dengan handler aman dan terdaftar di menu. |
| `mediafilter` | - | admin | `/mediafilter [opsi]` | Command PRD /mediafilter dengan handler aman dan terdaftar di menu. |
| `movegroup` | - | owner | `/movegroup [opsi]` | Command PRD /movegroup dengan handler aman dan terdaftar di menu. |
| `open` | - | admin | `/open [opsi]` | Command PRD /open dengan handler aman dan terdaftar di menu. |
| `pack` | - | user | `/pack [opsi]` | Command PRD /pack dengan handler aman dan terdaftar di menu. |
| `panicmode` | - | owner | `/panicmode [opsi]` | Command PRD /panicmode dengan handler aman dan terdaftar di menu. |
| `pengeluaran` | - | user | `/pengeluaran [opsi]` | Command PRD /pengeluaran dengan handler aman dan terdaftar di menu. |
| `pinbot` | - | user | `/pinbot [opsi]` | Command PRD /pinbot dengan handler aman dan terdaftar di menu. |
| `pinlist` | - | user | `/pinlist [opsi]` | Command PRD /pinlist dengan handler aman dan terdaftar di menu. |
| `poster` | - | user | `/poster [opsi]` | Command PRD /poster dengan handler aman dan terdaftar di menu. |
| `preferensi` | - | user | `/preferensi [opsi]` | Command PRD /preferensi dengan handler aman dan terdaftar di menu. |
| `premiumguide` | - | user | `/premiumguide [opsi]` | Command PRD /premiumguide dengan handler aman dan terdaftar di menu. |
| `qr` | - | user | `/qr [opsi]` | Command PRD /qr dengan handler aman dan terdaftar di menu. |
| `quiethours` | - | user | `/quiethours [opsi]` | Command PRD /quiethours dengan handler aman dan terdaftar di menu. |
| `quiz` | - | user | `/quiz [opsi]` | Command PRD /quiz dengan handler aman dan terdaftar di menu. |
| `rangkumchat` | - | user | `/rangkumchat [opsi]` | Command PRD /rangkumchat dengan handler aman dan terdaftar di menu. |
| `readqr` | - | user | `/readqr [opsi]` | Command PRD /readqr dengan handler aman dan terdaftar di menu. |
| `reject` | - | admin | `/reject [opsi]` | Command PRD /reject dengan handler aman dan terdaftar di menu. |
| `rekomendasigroup` | - | user | `/rekomendasigroup [opsi]` | Command PRD /rekomendasigroup dengan handler aman dan terdaftar di menu. |
| `resetlink` | - | admin | `/resetlink [opsi]` | Command PRD /resetlink dengan handler aman dan terdaftar di menu. |
| `resourceguard` | - | user | `/resourceguard [opsi]` | Command PRD /resourceguard dengan handler aman dan terdaftar di menu. |
| `retry` | - | user | `/retry [opsi]` | Command PRD /retry dengan handler aman dan terdaftar di menu. |
| `sandbox` | - | user | `/sandbox [opsi]` | Command PRD /sandbox dengan handler aman dan terdaftar di menu. |
| `sertifikat` | - | user | `/sertifikat [opsi]` | Command PRD /sertifikat dengan handler aman dan terdaftar di menu. |
| `setadminroom` | - | admin | `/setadminroom [opsi]` | Command PRD /setadminroom dengan handler aman dan terdaftar di menu. |
| `setdesc` | - | admin | `/setdesc [opsi]` | Command PRD /setdesc dengan handler aman dan terdaftar di menu. |
| `setgaya` | - | user | `/setgaya [opsi]` | Command PRD /setgaya dengan handler aman dan terdaftar di menu. |
| `setgoodbye` | - | admin | `/setgoodbye [opsi]` | Command PRD /setgoodbye dengan handler aman dan terdaftar di menu. |
| `setlang` | - | user | `/setlang [opsi]` | Command PRD /setlang dengan handler aman dan terdaftar di menu. |
| `setnama` | - | user | `/setnama [opsi]` | Command PRD /setnama dengan handler aman dan terdaftar di menu. |
| `setname` | - | admin | `/setname [opsi]` | Command PRD /setname dengan handler aman dan terdaftar di menu. |
| `setpersona` | - | user | `/setpersona [opsi]` | Command PRD /setpersona dengan handler aman dan terdaftar di menu. |
| `setppgc` | - | admin | `/setppgc [opsi]` | Command PRD /setppgc dengan handler aman dan terdaftar di menu. |
| `setuju` | - | user | `/setuju [opsi]` | Command PRD /setuju dengan handler aman dan terdaftar di menu. |
| `setupwizard` | - | user | `/setupwizard [opsi]` | Command PRD /setupwizard dengan handler aman dan terdaftar di menu. |
| `setwelcome` | - | admin | `/setwelcome [opsi]` | Command PRD /setwelcome dengan handler aman dan terdaftar di menu. |
| `silentmod` | - | admin | `/silentmod [opsi]` | Command PRD /silentmod dengan handler aman dan terdaftar di menu. |
| `simulate` | - | owner | `/simulate [opsi]` | Command PRD /simulate dengan handler aman dan terdaftar di menu. |
| `sold` | - | user | `/sold [opsi]` | Command PRD /sold dengan handler aman dan terdaftar di menu. |
| `speaking` | - | user | `/speaking [opsi]` | Command PRD /speaking dengan handler aman dan terdaftar di menu. |
| `stikre` | - | user | `/stikre [opsi]` | Command PRD /stikre dengan handler aman dan terdaftar di menu. |
| `summarize` | - | user | `/summarize [opsi]` | Command PRD /summarize dengan handler aman dan terdaftar di menu. |
| `tagall` | - | admin | `/tagall [opsi]` | Command PRD /tagall dengan handler aman dan terdaftar di menu. |
| `targetharian` | - | user | `/targetharian [opsi]` | Command PRD /targetharian dengan handler aman dan terdaftar di menu. |
| `tebakangka` | - | user | `/tebakangka [opsi]` | Command PRD /tebakangka dengan handler aman dan terdaftar di menu. |
| `tempadmin` | - | admin | `/tempadmin [opsi]` | Command PRD /tempadmin dengan handler aman dan terdaftar di menu. |
| `title` | - | user | `/title [opsi]` | Command PRD /title dengan handler aman dan terdaftar di menu. |
| `topadmin` | - | user | `/topadmin [opsi]` | Command PRD /topadmin dengan handler aman dan terdaftar di menu. |
| `topgroups` | - | user | `/topgroups [opsi]` | Command PRD /topgroups dengan handler aman dan terdaftar di menu. |
| `tournament` | - | user | `/tournament [opsi]` | Command PRD /tournament dengan handler aman dan terdaftar di menu. |
| `tranlsate` | - | user | `/tranlsate [opsi]` | Command PRD /tranlsate dengan handler aman dan terdaftar di menu. |
| `transkrip` | - | user | `/transkrip [opsi]` | Command PRD /transkrip dengan handler aman dan terdaftar di menu. |
| `trustlevel` | - | user | `/trustlevel [opsi]` | Command PRD /trustlevel dengan handler aman dan terdaftar di menu. |
| `twibbon` | - | user | `/twibbon [opsi]` | Command PRD /twibbon dengan handler aman dan terdaftar di menu. |
| `typo` | - | user | `/typo [opsi]` | Command PRD /typo dengan handler aman dan terdaftar di menu. |
| `ubah` | - | user | `/ubah [opsi]` | Command PRD /ubah dengan handler aman dan terdaftar di menu. |
| `undi` | - | user | `/undi [opsi]` | Command PRD /undi dengan handler aman dan terdaftar di menu. |
| `unpinbot` | - | user | `/unpinbot [opsi]` | Command PRD /unpinbot dengan handler aman dan terdaftar di menu. |
| `uptime` | - | user | `/uptime [opsi]` | Command PRD /uptime dengan handler aman dan terdaftar di menu. |
| `usage` | - | user | `/usage [opsi]` | Command PRD /usage dengan handler aman dan terdaftar di menu. |
| `vntext` | - | user | `/vntext [opsi]` | Command PRD /vntext dengan handler aman dan terdaftar di menu. |
| `welcome` | - | admin | `/welcome [opsi]` | Command PRD /welcome dengan handler aman dan terdaftar di menu. |
| `welcomecard` | - | admin | `/welcomecard [opsi]` | Command PRD /welcomecard dengan handler aman dan terdaftar di menu. |
| `whitelistword` | - | admin | `/whitelistword [opsi]` | Command PRD /whitelistword dengan handler aman dan terdaftar di menu. |
| `wordoftheday` | - | user | `/wordoftheday [opsi]` | Command PRD /wordoftheday dengan handler aman dan terdaftar di menu. |

## help

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `cari` | - | user | `/cari [opsi]` | Command PRD /cari dengan handler aman dan terdaftar di menu. |
| `cmd` | - | user | `/cmd [opsi]` | Command PRD /cmd dengan handler aman dan terdaftar di menu. |
| `help` | - | user | `/help [opsi]` | Command PRD /help dengan handler aman dan terdaftar di menu. |
| `menu` | - | user | `/menu [opsi]` | Command PRD /menu dengan handler aman dan terdaftar di menu. |
| `ping` | - | user | `/ping [opsi]` | Command PRD /ping dengan handler aman dan terdaftar di menu. |
| `start` | - | user | `/start [opsi]` | Command PRD /start dengan handler aman dan terdaftar di menu. |

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
| `antijudi` | - | admin | `/antijudi [opsi]` | Command PRD /antijudi dengan handler aman dan terdaftar di menu. |
| `antipinjol` | - | admin | `/antipinjol [opsi]` | Command PRD /antipinjol dengan handler aman dan terdaftar di menu. |
| `antiscam` | - | admin | `/antiscam [opsi]` | Command PRD /antiscam dengan handler aman dan terdaftar di menu. |
| `antispam` | - | user | `/antispam [opsi]` | Command PRD /antispam dengan handler aman dan terdaftar di menu. |
| `antitoxic` | - | admin | `/antitoxic [opsi]` | Command PRD /antitoxic dengan handler aman dan terdaftar di menu. |
| `banlist` | - | admin | `/banlist [opsi]` | Command PRD /banlist dengan handler aman dan terdaftar di menu. |
| `blockcmd` | - | owner | `/blockcmd [opsi]` | Command PRD /blockcmd dengan handler aman dan terdaftar di menu. |
| `captcha` | - | admin | `/captcha [opsi]` | Command PRD /captcha dengan handler aman dan terdaftar di menu. |
| `case` | - | admin | `/case [opsi]` | Command PRD /case dengan handler aman dan terdaftar di menu. |
| `clearwarn` | - | user | `/clearwarn @user` | Menghapus semua peringatan pengguna. |
| `closereport` | - | admin | `/closereport [opsi]` | Command PRD /closereport dengan handler aman dan terdaftar di menu. |
| `delwarnrule` | - | user | `/delwarnrule <batas>` | Menghapus aturan batas peringatan. |
| `demote` | - | admin | `/demote [opsi]` | Command PRD /demote dengan handler aman dan terdaftar di menu. |
| `evidence` | - | admin | `/evidence [opsi]` | Command PRD /evidence dengan handler aman dan terdaftar di menu. |
| `globalblacklist` | - | admin | `/globalblacklist [opsi]` | Command PRD /globalblacklist dengan handler aman dan terdaftar di menu. |
| `kick` | - | admin | `/kick [opsi]` | Command PRD /kick dengan handler aman dan terdaftar di menu. |
| `kickvote` | - | admin | `/kickvote [opsi]` | Command PRD /kickvote dengan handler aman dan terdaftar di menu. |
| `listreport` | - | admin | `/listreport [opsi]` | Command PRD /listreport dengan handler aman dan terdaftar di menu. |
| `listwarnrule` | - | user | `/listwarnrule` | Melihat daftar aturan batas peringatan grup. |
| `lock` | - | admin | `/lock [opsi]` | Command PRD /lock dengan handler aman dan terdaftar di menu. |
| `newmemberlinkblock` | - | admin | `/newmemberlinkblock [opsi]` | Command PRD /newmemberlinkblock dengan handler aman dan terdaftar di menu. |
| `promote` | - | admin | `/promote [opsi]` | Command PRD /promote dengan handler aman dan terdaftar di menu. |
| `quarantine` | - | admin | `/quarantine [opsi]` | Command PRD /quarantine dengan handler aman dan terdaftar di menu. |
| `raidmode` | - | admin | `/raidmode [opsi]` | Command PRD /raidmode dengan handler aman dan terdaftar di menu. |
| `report` | - | user | `/report [opsi]` | Command PRD /report dengan handler aman dan terdaftar di menu. |
| `reportmsg` | - | admin | `/reportmsg [opsi]` | Command PRD /reportmsg dengan handler aman dan terdaftar di menu. |
| `risk` | - | user | `/risk [opsi]` | Command PRD /risk dengan handler aman dan terdaftar di menu. |
| `riskconfig` | - | admin | `/riskconfig [opsi]` | Command PRD /riskconfig dengan handler aman dan terdaftar di menu. |
| `riskmode` | - | admin | `/riskmode [opsi]` | Command PRD /riskmode dengan handler aman dan terdaftar di menu. |
| `tempmute` | - | admin | `/tempmute [opsi]` | Command PRD /tempmute dengan handler aman dan terdaftar di menu. |
| `unlock` | - | admin | `/unlock [opsi]` | Command PRD /unlock dengan handler aman dan terdaftar di menu. |
| `unwarn` | - | user | `/unwarn @user` | Menghapus satu peringatan terakhir pengguna. |
| `warn` | - | user | `/warn @user <alasan>` | Memberikan peringatan kepada anggota grup. |
| `warnings` | - | user | `/warnings [@user]` | Melihat daftar peringatan seseorang. |
| `weeklyreport` | - | user | `/weeklyreport [opsi]` | Command PRD /weeklyreport dengan handler aman dan terdaftar di menu. |

## owner

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `apikey` | `revokeapikey` | owner | `/apikey atau /revokeapikey` | Mengelola token API admin system. |
| `autobackup` | - | owner | `/autobackup [opsi]` | Command PRD /autobackup dengan handler aman dan terdaftar di menu. |
| `backup` | - | owner | `/backup [opsi]` | Command PRD /backup dengan handler aman dan terdaftar di menu. |
| `backupgd` | - | owner | `/backupgd [opsi]` | Command PRD /backupgd dengan handler aman dan terdaftar di menu. |
| `backupsend` | - | owner | `/backupsend [opsi]` | Command PRD /backupsend dengan handler aman dan terdaftar di menu. |
| `botinstance` | - | user | `/botinstance [opsi]` | Command PRD /botinstance dengan handler aman dan terdaftar di menu. |
| `broadcast` | - | owner | `/broadcast [opsi]` | Command PRD /broadcast dengan handler aman dan terdaftar di menu. |
| `broadcasttemplate` | - | owner | `/broadcasttemplate [opsi]` | Command PRD /broadcasttemplate dengan handler aman dan terdaftar di menu. |
| `exportconfig` | `importconfig` | owner | `/exportconfig atau reply JSON dengan /importconfig` | Export atau import konfigurasi grup dan subscription. |
| `failover` | - | user | `/failover [opsi]` | Command PRD /failover dengan handler aman dan terdaftar di menu. |
| `instance` | - | user | `/instance [opsi]` | Command PRD /instance dengan handler aman dan terdaftar di menu. |
| `limit` | - | owner | `/limit` | Melihat informasi sisa limit bot. |
| `listbackup` | - | owner | `/listbackup` | Melihat daftar backup lokal. |
| `maintenance` | - | owner | `/maintenance [opsi]` | Command PRD /maintenance dengan handler aman dan terdaftar di menu. |
| `ownerlog` | - | owner | `/ownerlog [opsi]` | Command PRD /ownerlog dengan handler aman dan terdaftar di menu. |
| `plugin` | - | owner | `/plugin [list|on|off] [nama]` | Mengaktifkan/menonaktifkan plugin secara global. |
| `premium` | - | owner | `/premium [add/remove] @user <hari>` | Mengelola daftar premium user. |
| `provider` | - | owner | `/provider [opsi]` | Command PRD /provider dengan handler aman dan terdaftar di menu. |
| `providerstatus` | - | user | `/providerstatus [opsi]` | Command PRD /providerstatus dengan handler aman dan terdaftar di menu. |
| `repair` | - | owner | `/repair [opsi]` | Command PRD /repair dengan handler aman dan terdaftar di menu. |
| `restart` | - | owner | `/restart [opsi]` | Command PRD /restart dengan handler aman dan terdaftar di menu. |
| `restorebackup` | - | owner | `/restorebackup <id>` | Restore database dari backup dengan konfirmasi eksplisit. |
| `sessionstatus` | - | owner | `/sessionstatus [opsi]` | Command PRD /sessionstatus dengan handler aman dan terdaftar di menu. |
| `stats` | - | owner | `/stats` | Melihat status performa server dan error log. |
| `update` | - | owner | `/update [opsi]` | Command PRD /update dengan handler aman dan terdaftar di menu. |
| `updateannounce` | - | owner | `/updateannounce [opsi]` | Command PRD /updateannounce dengan handler aman dan terdaftar di menu. |
| `workers` | - | owner | `/workers [opsi]` | Command PRD /workers dengan handler aman dan terdaftar di menu. |
| `workerstatus` | - | owner | `/workerstatus [opsi]` | Command PRD /workerstatus dengan handler aman dan terdaftar di menu. |

## premium

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `addonlist` | - | user | `/addonlist [opsi]` | Command PRD /addonlist dengan handler aman dan terdaftar di menu. |
| `addreseller` | - | owner | `/addreseller [opsi]` | Command PRD /addreseller dengan handler aman dan terdaftar di menu. |
| `addsewa` | - | owner | `/addsewa [opsi]` | Command PRD /addsewa dengan handler aman dan terdaftar di menu. |
| `buyaddon` | - | user | `/buyaddon [opsi]` | Command PRD /buyaddon dengan handler aman dan terdaftar di menu. |
| `buycredit` | - | user | `/buycredit [opsi]` | Command PRD /buycredit dengan handler aman dan terdaftar di menu. |
| `buyquota` | - | user | `/buyquota [opsi]` | Command PRD /buyquota dengan handler aman dan terdaftar di menu. |
| `ceksewa` | - | user | `/ceksewa [opsi]` | Command PRD /ceksewa dengan handler aman dan terdaftar di menu. |
| `coupon` | - | user | `/coupon [opsi]` | Command PRD /coupon dengan handler aman dan terdaftar di menu. |
| `credit` | - | user | `/credit [opsi]` | Command PRD /credit dengan handler aman dan terdaftar di menu. |
| `delsewa` | - | user | `/delsewa [opsi]` | Command PRD /delsewa dengan handler aman dan terdaftar di menu. |
| `extendsewa` | - | owner | `/extendsewa [opsi]` | Command PRD /extendsewa dengan handler aman dan terdaftar di menu. |
| `giftcredit` | - | user | `/giftcredit [opsi]` | Command PRD /giftcredit dengan handler aman dan terdaftar di menu. |
| `listsewa` | - | user | `/listsewa [opsi]` | Command PRD /listsewa dengan handler aman dan terdaftar di menu. |
| `quota` | - | user | `/quota [opsi]` | Command PRD /quota dengan handler aman dan terdaftar di menu. |
| `referral` | - | user | `/referral [opsi]` | Command PRD /referral dengan handler aman dan terdaftar di menu. |
| `reseller` | - | user | `/reseller [opsi]` | Command PRD /reseller dengan handler aman dan terdaftar di menu. |
| `resellerextend` | - | user | `/resellerextend [opsi]` | Command PRD /resellerextend dengan handler aman dan terdaftar di menu. |
| `resellerpanel` | - | user | `/resellerpanel [opsi]` | Command PRD /resellerpanel dengan handler aman dan terdaftar di menu. |
| `setplan` | - | owner | `/setplan [opsi]` | Command PRD /setplan dengan handler aman dan terdaftar di menu. |
| `sewa` | - | user | `/sewa [opsi]` | Command PRD /sewa dengan handler aman dan terdaftar di menu. |
| `store` | - | user | `/store [opsi]` | Command PRD /store dengan handler aman dan terdaftar di menu. |
| `trial` | - | user | `/trial [opsi]` | Command PRD /trial dengan handler aman dan terdaftar di menu. |

## privacy

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `cleandb` | - | user | `/cleandb [opsi]` | Command PRD /cleandb dengan handler aman dan terdaftar di menu. |
| `consent` | - | user | `/consent [opsi]` | Command PRD /consent dengan handler aman dan terdaftar di menu. |
| `deletemydata` | - | user | `/deletemydata [opsi]` | Command PRD /deletemydata dengan handler aman dan terdaftar di menu. |
| `mydata` | - | user | `/mydata [opsi]` | Command PRD /mydata dengan handler aman dan terdaftar di menu. |
| `privacymode` | - | user | `/privacymode [opsi]` | Command PRD /privacymode dengan handler aman dan terdaftar di menu. |
| `retention` | - | user | `/retention [opsi]` | Command PRD /retention dengan handler aman dan terdaftar di menu. |

## productivity

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `autoremind` | - | user | `/autoremind [opsi]` | Command PRD /autoremind dengan handler aman dan terdaftar di menu. |
| `bookmark` | - | user | `/bookmark [opsi]` | Command PRD /bookmark dengan handler aman dan terdaftar di menu. |
| `bookmarks` | - | user | `/bookmarks [opsi]` | Command PRD /bookmarks dengan handler aman dan terdaftar di menu. |
| `countdown` | - | user | `/countdown [opsi]` | Command PRD /countdown dengan handler aman dan terdaftar di menu. |
| `countdownlist` | - | user | `/countdownlist [opsi]` | Command PRD /countdownlist dengan handler aman dan terdaftar di menu. |
| `deletememory` | - | user | `/deletememory [opsi]` | Command PRD /deletememory dengan handler aman dan terdaftar di menu. |
| `diary` | - | user | `/diary [opsi]` | Command PRD /diary dengan handler aman dan terdaftar di menu. |
| `faq` | - | user | `/faq [opsi]` | Command PRD /faq dengan handler aman dan terdaftar di menu. |
| `form` | - | user | `/form [opsi]` | Command PRD /form dengan handler aman dan terdaftar di menu. |
| `formatjual` | - | user | `/formatjual [opsi]` | Command PRD /formatjual dengan handler aman dan terdaftar di menu. |
| `habit` | - | user | `/habit [opsi]` | Command PRD /habit dengan handler aman dan terdaftar di menu. |
| `ingat` | - | user | `/ingat [opsi]` | Command PRD /ingat dengan handler aman dan terdaftar di menu. |
| `memory` | - | user | `/memory [opsi]` | Command PRD /memory dengan handler aman dan terdaftar di menu. |
| `mood` | - | user | `/mood [opsi]` | Command PRD /mood dengan handler aman dan terdaftar di menu. |
| `moodstat` | - | user | `/moodstat [opsi]` | Command PRD /moodstat dengan handler aman dan terdaftar di menu. |
| `note` | - | user | `/note [opsi]` | Command PRD /note dengan handler aman dan terdaftar di menu. |
| `pomodoro` | - | user | `/pomodoro [opsi]` | Command PRD /pomodoro dengan handler aman dan terdaftar di menu. |
| `remind` | - | user | `/remind [opsi]` | Command PRD /remind dengan handler aman dan terdaftar di menu. |
| `remindersewa` | - | user | `/remindersewa [opsi]` | Command PRD /remindersewa dengan handler aman dan terdaftar di menu. |
| `todo` | - | user | `/todo [opsi]` | Command PRD /todo dengan handler aman dan terdaftar di menu. |
| `wiki` | - | user | `/wiki [opsi]` | Command PRD /wiki dengan handler aman dan terdaftar di menu. |

## school

| Command | Aliases | Role | Usage | Description |
| --- | --- | --- | --- | --- |
| `bahas` | - | user | `/bahas [opsi]` | Command PRD /bahas dengan handler aman dan terdaftar di menu. |
| `buatsoal` | - | user | `/buatsoal [opsi]` | Command PRD /buatsoal dengan handler aman dan terdaftar di menu. |
| `flashcard` | - | user | `/flashcard [opsi]` | Command PRD /flashcard dengan handler aman dan terdaftar di menu. |
| `glossary` | - | user | `/glossary [opsi]` | Command PRD /glossary dengan handler aman dan terdaftar di menu. |
| `grammar` | - | user | `/grammar [opsi]` | Command PRD /grammar dengan handler aman dan terdaftar di menu. |
| `jadwal` | - | user | `/jadwal [opsi]` | Command PRD /jadwal dengan handler aman dan terdaftar di menu. |
| `jadwalpelajaran` | - | user | `/jadwalpelajaran [opsi]` | Command PRD /jadwalpelajaran dengan handler aman dan terdaftar di menu. |
| `jadwalpribadi` | - | user | `/jadwalpribadi [opsi]` | Command PRD /jadwalpribadi dengan handler aman dan terdaftar di menu. |
| `jawabsoal` | - | user | `/jawabsoal [opsi]` | Command PRD /jawabsoal dengan handler aman dan terdaftar di menu. |
| `kamus` | - | user | `/kamus [opsi]` | Command PRD /kamus dengan handler aman dan terdaftar di menu. |
| `latihan` | - | user | `/latihan [opsi]` | Command PRD /latihan dengan handler aman dan terdaftar di menu. |
| `notulen` | - | user | `/notulen [opsi]` | Command PRD /notulen dengan handler aman dan terdaftar di menu. |
| `proposal` | - | user | `/proposal [opsi]` | Command PRD /proposal dengan handler aman dan terdaftar di menu. |
| `rekaptugas` | - | user | `/rekaptugas [opsi]` | Command PRD /rekaptugas dengan handler aman dan terdaftar di menu. |
| `rumus` | - | user | `/rumus [opsi]` | Command PRD /rumus dengan handler aman dan terdaftar di menu. |
| `surat` | - | user | `/surat [opsi]` | Command PRD /surat dengan handler aman dan terdaftar di menu. |
| `tugas` | - | user | `/tugas [opsi]` | Command PRD /tugas dengan handler aman dan terdaftar di menu. |
| `ujian` | - | user | `/ujian [opsi]` | Command PRD /ujian dengan handler aman dan terdaftar di menu. |
| `vocab` | - | user | `/vocab [opsi]` | Command PRD /vocab dengan handler aman dan terdaftar di menu. |

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

