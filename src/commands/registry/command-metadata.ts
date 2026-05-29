import { CommandMetadata } from './command-types.js';

export const COMMAND_METADATA_LIST: CommandMetadata[] = [
  // --- STICKER SUITE ---
  {
    name: 'stiker',
    aliases: ['s'],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Mengonversi gambar atau video pendek menjadi stiker WhatsApp.',
    usage: 'Kirim gambar/video dengan caption /stiker atau reply gambar/video.',
    examples: ['/stiker', '/s']
  },
  {
    name: 'toimg',
    aliases: [],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Mengonversi stiker menjadi gambar PNG kembali.',
    usage: 'Reply stiker yang ingin diubah menjadi gambar.',
    examples: ['/toimg']
  },
  {
    name: 'brat',
    aliases: [],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'brat',
    description: 'Membuat stiker bergaya brat (putih polos dengan teks hitam & blur ringan).',
    usage: '/brat <teks> atau /brat classic <teks>',
    examples: ['/brat hello world', '/brat classic so simple']
  },
  {
    name: 'quote',
    aliases: [],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Membuat stiker kutipan dengan latar belakang gradasi warna.',
    usage: '/quote <kutipan>',
    examples: ['/quote Hidup ini indah']
  },
  {
    name: 'removebg',
    aliases: ['rbg'],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Menghapus latar belakang gambar (batas 5MB untuk free, 15MB untuk premium).',
    usage: 'Kirim gambar dengan caption /removebg atau reply gambar.',
    examples: ['/removebg', '/rbg']
  },
  {
    name: 'stikerbg',
    aliases: ['nobgstick'],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Menghapus latar belakang gambar dan menjadikannya stiker.',
    usage: 'Kirim gambar dengan caption /stikerbg atau reply gambar.',
    examples: ['/stikerbg', '/nobgstick']
  },
  {
    name: 'circle',
    aliases: ['bulat'],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Memotong gambar berbentuk lingkaran dan menjadikannya stiker.',
    usage: 'Reply gambar dengan command /circle.',
    examples: ['/circle', '/bulat']
  },
  {
    name: 'outline',
    aliases: [],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Menambahkan garis tepi (outline) berwarna putih/hitam pada stiker.',
    usage: '/outline [white/black] pada reply gambar/stiker.',
    examples: ['/outline white', '/outline black']
  },
  {
    name: 'meme',
    aliases: [],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Membuat meme dari gambar dengan teks atas dan teks bawah.',
    usage: '/meme <teks atas> | <teks bawah> pada caption/reply gambar.',
    examples: ['/meme ketika tugas menumpuk | tetapi bot lancar']
  },
  {
    name: 'emojimix',
    aliases: ['mix'],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Menggabungkan dua emoji menjadi stiker mix.',
    usage: '/mix <emoji1> <emoji2>',
    examples: ['/mix 😂 😭', '/emojimix 😂 + 😭']
  },
  {
    name: 'vstiker',
    aliases: ['gifstiker'],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Mengonversi video menjadi stiker bergerak (max 5s free, 10s premium).',
    usage: 'Reply video dengan command /vstiker.',
    examples: ['/vstiker', '/gifstiker']
  },
  {
    name: 'batchstiker',
    aliases: ['pack'],
    category: 'sticker',
    plugin: 'sticker',
    featureFlag: 'sticker',
    description: 'Mengonversi beberapa gambar sekaligus menjadi stiker pack.',
    usage: 'Reply gambar secara batch dengan command /batchstiker.',
    examples: ['/batchstiker']
  },

  // --- MEDIA TOOLS ---
  {
    name: 'hd',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'hd',
    description: 'Meningkatkan resolusi dan ketajaman gambar (HD).',
    usage: 'Kirim gambar dengan caption /hd atau reply gambar.',
    examples: ['/hd', '/hd 2x', '/hd 4x']
  },
  {
    name: 'compress',
    aliases: ['kompres'],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Memperkecil ukuran file video/gambar.',
    usage: '/compress [low|medium|high]',
    examples: ['/compress medium', '/kompres high']
  },
  {
    name: 'resize',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Mengubah resolusi/dimensi gambar.',
    usage: '/resize <dimensi/preset>',
    examples: ['/resize 1080x1080', '/resize story']
  },
  {
    name: 'crop',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Memotong gambar dengan rasio tertentu.',
    usage: '/crop [square|story|pp]',
    examples: ['/crop square']
  },
  {
    name: 'wm',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Menambahkan watermark teks kustom pada gambar.',
    usage: '/wm <teks>',
    examples: ['/wm Javas Bot']
  },
  {
    name: 'togif',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Mengonversi video menjadi animasi format GIF.',
    usage: 'Reply video dengan command /togif.',
    examples: ['/togif']
  },
  {
    name: 'thumb',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Mengambil gambar thumbnail dari video pada detik tertentu.',
    usage: '/thumb [timestamp]',
    examples: ['/thumb 00:00:05']
  },
  {
    name: 'cut',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Memotong durasi file video.',
    usage: '/cut [start-end]',
    examples: ['/cut 00:05-00:15']
  },
  {
    name: 'mute',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Menghilangkan suara dari file video.',
    usage: 'Reply video dengan command /mute.',
    examples: ['/mute']
  },
  {
    name: 'reverse',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'general',
    description: 'Memutar balik alur video (reverse).',
    usage: 'Reply video dengan command /reverse.',
    examples: ['/reverse']
  },

  // --- AUDIO TOOLS ---
  {
    name: 'tts',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'general',
    description: 'Mengonversi teks menjadi suara (Text-to-Speech).',
    usage: '/tts <teks>',
    examples: ['/tts Halo, selamat pagi']
  },
  {
    name: 'mp3',
    aliases: ['audio'],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'general',
    description: 'Mengekstrak suara/audio dari video menjadi format MP3.',
    usage: 'Reply video dengan command /mp3.',
    examples: ['/mp3', '/audio']
  },
  {
    name: 'transkrip',
    aliases: ['vntext'],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'general',
    description: 'Mengonversi file suara (Voice Note) menjadi teks tertulis.',
    usage: 'Reply voice note dengan command /transkrip.',
    examples: ['/transkrip', '/vntext']
  },
  {
    name: 'voice',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'general',
    description: 'Mengubah karakter/efek suara audio.',
    usage: '/voice [robot|chipmunk|deep]',
    examples: ['/voice robot']
  },
  {
    name: 'cutaudio',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'general',
    description: 'Memotong durasi file audio.',
    usage: '/cutaudio [start-end]',
    examples: ['/cutaudio 00:10-00:30']
  },
  {
    name: 'speed',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'general',
    description: 'Mempercepat tempo pemutaran audio.',
    usage: '/speed [multiplier]',
    examples: ['/speed 1.5x']
  },
  {
    name: 'slow',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'general',
    description: 'Memperlambat tempo pemutaran audio.',
    usage: '/slow [multiplier]',
    examples: ['/slow 0.75x']
  },

  // --- DOWNLOADER ---
  {
    name: 'tt',
    aliases: ['tiktok'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh video TikTok tanpa watermark.',
    usage: '/tt <url>',
    examples: ['/tt https://www.tiktok.com/@user/video/123456']
  },
  {
    name: 'ig',
    aliases: ['instagram'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh media (video/foto) dari post Instagram.',
    usage: '/ig <url>',
    examples: ['/ig https://www.instagram.com/p/abcde/']
  },

  // --- TEXT, OCR, TRANSLATE & STUDY TOOLS ---
  {
    name: 'ocr',
    aliases: [],
    category: 'text',
    plugin: 'text',
    featureFlag: 'general',
    description: 'Mengekstrak teks tulisan dari suatu gambar.',
    usage: 'Reply gambar dengan command /ocr.',
    examples: ['/ocr']
  },
  {
    name: 'translate',
    aliases: ['tr'],
    category: 'text',
    plugin: 'text',
    featureFlag: 'general',
    description: 'Menerjemahkan teks ke bahasa tujuan.',
    usage: '/tr <lang> <teks> atau reply teks.',
    examples: ['/tr en selamat pagi', '/translate id Good morning']
  },
  {
    name: 'ringkas',
    aliases: ['summarize'],
    category: 'text',
    plugin: 'text',
    featureFlag: 'general',
    description: 'Meringkas tulisan panjang.',
    usage: '/ringkas <teks> atau reply teks.',
    examples: ['/ringkas <teks panjang>']
  },
  {
    name: 'ubah',
    aliases: [],
    category: 'text',
    plugin: 'text',
    featureFlag: 'general',
    description: 'Mengubah gaya penulisan bahasa (formal/santai/sopan/lucu/singkat).',
    usage: '/ubah [gaya] <teks> atau reply teks.',
    examples: ['/ubah formal aku mau makan', '/ubah santai Selamat pagi Bapak']
  },
  {
    name: 'typo',
    aliases: ['koreksi'],
    category: 'text',
    plugin: 'text',
    featureFlag: 'general',
    description: 'Mengoreksi kesalahan penulisan (typo) secara otomatis.',
    usage: '/typo <teks> atau reply teks.',
    examples: ['/typo sy mw mkn nsi']
  },
  {
    name: 'balas',
    aliases: [],
    category: 'text',
    plugin: 'text',
    featureFlag: 'general',
    description: 'Membuat balasan chat sesuai gaya tertentu.',
    usage: '/balas [formal|santai|lucu] <teks> atau reply teks.',
    examples: ['/balas formal halo bro']
  },
  {
    name: 'jelaskan',
    aliases: ['rangkum'],
    category: 'text',
    plugin: 'text',
    featureFlag: 'general',
    description: 'Menjelaskan suatu konsep atau topik pelajaran.',
    usage: '/jelaskan <topik>',
    examples: ['/jelaskan fotosintesis']
  },

  // --- FILE & DOKUMEN ---
  {
    name: 'img2pdf',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Menggabungkan gambar menjadi satu file PDF.',
    usage: 'Reply gambar secara batch atau kirim gambar dengan caption /img2pdf.',
    examples: ['/img2pdf']
  },
  {
    name: 'pdf2img',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Mengonversi halaman PDF menjadi gambar JPG.',
    usage: 'Reply dokumen PDF dengan command /pdf2img.',
    examples: ['/pdf2img']
  },
  {
    name: 'mergepdf',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Menggabungkan beberapa file PDF menjadi satu.',
    usage: 'Kirim file PDF secara batch.',
    examples: ['/mergepdf']
  },
  {
    name: 'compresspdf',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Memperkecil ukuran file PDF.',
    usage: 'Reply file PDF dengan command /compresspdf.',
    examples: ['/compresspdf']
  },
  {
    name: 'scan',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Membuat efek scan dokumen pada foto (Contras & Perspektif).',
    usage: 'Reply gambar dokumen dengan command /scan.',
    examples: ['/scan']
  },
  {
    name: 'unzip',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Mengekstrak file ZIP/RAR secara aman.',
    usage: 'Reply file ZIP/RAR dengan command /unzip.',
    examples: ['/unzip']
  },
  {
    name: 'qr',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Membuat QR Code dari teks atau URL.',
    usage: '/qr <teks/url>',
    examples: ['/qr https://google.com']
  },
  {
    name: 'readqr',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Membaca isi teks dari QR Code gambar.',
    usage: 'Reply gambar QR Code dengan command /readqr.',
    examples: ['/readqr']
  },

  // --- INTERACTIVE GAMES ---
  {
    name: 'tod',
    aliases: ['truth', 'dare'],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Memulai sesi permainan Truth or Dare.',
    usage: '/tod, /truth, atau /dare',
    examples: ['/tod', '/truth', '/dare']
  },
  {
    name: 'tebakkata',
    aliases: ['jawab'],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Game tebak kata / menjawab kuis aktif.',
    usage: '/tebakkata untuk mulai, /jawab <jawaban> untuk menjawab.',
    examples: ['/tebakkata', '/jawab koding']
  },
  {
    name: 'tebakgambar',
    aliases: [],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Game kuis tebak gambar interaktif.',
    usage: '/tebakgambar untuk mulai.',
    examples: ['/tebakgambar']
  },
  {
    name: 'suit',
    aliases: ['pilih'],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Tantang pemain lain untuk bermain suit (PvP).',
    usage: '/suit @user untuk menantang, /pilih [batu/gunting/kertas] untuk memilih.',
    examples: ['/suit @user', '/pilih batu']
  },
  {
    name: 'ttt',
    aliases: [],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Memulai permainan Tic Tac Toe dengan pemain lain.',
    usage: '/ttt @user untuk menantang, /ttt <angka 1-9> untuk giliran.',
    examples: ['/ttt @user', '/ttt 5']
  },
  {
    name: 'slot',
    aliases: [],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Taruhan koin pada mesin slot virtual.',
    usage: '/slot',
    examples: ['/slot']
  },
  {
    name: 'math',
    aliases: [],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Memulai kuis matematika.',
    usage: '/math',
    examples: ['/math']
  },
  {
    name: 'family100',
    aliases: [],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Memulai game Family 100.',
    usage: '/family100',
    examples: ['/family100']
  },
  {
    name: 'couple',
    aliases: ['jodoh'],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Mencocokkan profil jodoh acak dalam grup.',
    usage: '/couple',
    examples: ['/couple']
  },
  {
    name: 'ww',
    aliases: [],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Mengelola dan memainkan game Werewolf.',
    usage: '/ww [create|join|start|stop|vote|kill|protect|check]',
    examples: ['/ww create', '/ww join', '/ww start']
  },
  {
    name: 'wwrank',
    aliases: ['wwstats'],
    category: 'games',
    plugin: 'games',
    featureFlag: 'werewolf',
    description: 'Melihat peringkat/peringkat kemenangan Werewolf.',
    usage: '/wwrank',
    examples: ['/wwrank']
  },

  // --- ECONOMY & RPG SYSTEM ---
  {
    name: 'balance',
    aliases: ['bal'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Melihat saldo koin, level, dan poin XP Anda.',
    usage: '/balance',
    examples: ['/balance', '/bal']
  },
  {
    name: 'claim',
    aliases: ['daily'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Klaim hadiah koin dan XP harian.',
    usage: '/claim',
    examples: ['/claim', '/daily']
  },
  {
    name: 'transfer',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Mengirim saldo koin ke user lain.',
    usage: '/transfer @user <jumlah>',
    examples: ['/transfer @user 500']
  },
  {
    name: 'rank',
    aliases: ['level'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Menampilkan tingkat rank profil level XP.',
    usage: '/rank',
    examples: ['/rank', '/level']
  },
  {
    name: 'top',
    aliases: ['leaderboard'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Menampilkan papan peringkat pengguna terkaya.',
    usage: '/top',
    examples: ['/top', '/leaderboard']
  },
  {
    name: 'shop',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Melihat barang-barang yang dijual di toko virtual.',
    usage: '/shop',
    examples: ['/shop']
  },
  {
    name: 'buy',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Membeli barang dari toko virtual.',
    usage: '/buy <nama_barang>',
    examples: ['/buy pet_food']
  },
  {
    name: 'sell',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Menjual barang dari inventory ke toko.',
    usage: '/sell <nama_barang>',
    examples: ['/sell pet_food']
  },
  {
    name: 'inventory',
    aliases: ['inv'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Melihat daftar barang di tas (inventory) Anda.',
    usage: '/inventory',
    examples: ['/inventory', '/inv']
  },
  {
    name: 'title',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Mengatur custom title profil.',
    usage: '/title set <nama_gelar>',
    examples: ['/title set Petualang']
  },
  {
    name: 'pet',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Mengelola peliharaan (adopt, feed, status, battle).',
    usage: '/pet [adopt|feed|status|battle]',
    examples: ['/pet status', '/pet feed']
  },
  {
    name: 'dungeon',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Memulai pertarungan dungeon RPG.',
    usage: '/dungeon',
    examples: ['/dungeon']
  },

  // --- MODERATION ---
  {
    name: 'warn',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'warning',
    minRole: 'admin',
    description: 'Memberikan poin warning (infraction) ke member grup.',
    usage: '/warn @user <alasan>',
    examples: ['/warn @user melanggar aturan']
  },
  {
    name: 'warnings',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'warning',
    minRole: 'admin',
    description: 'Melihat jumlah warning yang dimiliki oleh user.',
    usage: '/warnings @user',
    examples: ['/warnings @user']
  },
  {
    name: 'unwarn',
    aliases: ['clearwarn'],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'warning',
    minRole: 'admin',
    description: 'Menghapus poin warning user.',
    usage: '/unwarn @user',
    examples: ['/unwarn @user', '/clearwarn @user']
  },
  {
    name: 'blacklist',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'blacklist',
    minRole: 'admin',
    description: 'Memasukkan user ke daftar cekal (blacklist) grup.',
    usage: '/blacklist @user <alasan>',
    examples: ['/blacklist @user toxic']
  },
  {
    name: 'unblacklist',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'blacklist',
    minRole: 'admin',
    description: 'Menghapus user dari daftar hitam/cekal grup.',
    usage: '/unblacklist @user',
    examples: ['/unblacklist @user']
  },
  {
    name: 'listblacklist',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'blacklist',
    minRole: 'admin',
    description: 'Melihat seluruh member yang ter-blacklist.',
    usage: '/listblacklist',
    examples: ['/listblacklist']
  },
  {
    name: 'addbadword',
    aliases: ['delbadword', 'listbadword'],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'badword',
    minRole: 'admin',
    description: 'Mengelola daftar kata terlarang (sensor kata) grup.',
    usage: '/addbadword <kata> / /delbadword <kata> / /listbadword',
    examples: ['/addbadword toxicword']
  },
  {
    name: 'antispam',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengatur fitur Anti-Spam dan cooldown kecepatan pesan grup.',
    usage: '/antispam [on|off|status|mode|limit]',
    examples: ['/antispam on', '/antispam mode warn', '/antispam limit 5 10']
  },
  {
    name: 'antilink',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengatur fitur Anti-Link untuk menghapus tautan otomatis.',
    usage: '/antilink [on|off|status|mode]',
    examples: ['/antilink on', '/antilink mode delete']
  },
  {
    name: 'whitelistdomain',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengelola domain tautan yang diizinkan (whitelist).',
    usage: '/whitelistdomain [add|del|list] [domain]',
    examples: ['/whitelistdomain add google.com', '/whitelistdomain list']
  },
  {
    name: 'antivirtex',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengatur pencegahan pesan sangat panjang/virtex.',
    usage: '/antivirtex [on|off]',
    examples: ['/antivirtex on']
  },
  {
    name: 'antimention',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengatur pencegahan spam mention massal dalam satu pesan.',
    usage: '/antimention [on|off]',
    examples: ['/antimention on']
  },
  {
    name: 'antisticker',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengatur pencegahan spam stiker beruntun.',
    usage: '/antisticker [on|off]',
    examples: ['/antisticker on']
  },

  // --- COMMUNITY ---
  {
    name: 'addreply',
    aliases: ['delreply', 'listreply'],
    category: 'admin',
    plugin: 'community',
    featureFlag: 'autoreply',
    minRole: 'admin',
    description: 'Mengelola auto-reply pesan otomatis dalam grup.',
    usage: '/addreply <trigger> = <response> / /delreply <trigger>',
    examples: ['/addreply info = hubungi admin']
  },
  {
    name: 'poll',
    aliases: ['pollresult', 'closepoll'],
    category: 'admin',
    plugin: 'community',
    featureFlag: 'poll',
    minRole: 'admin',
    description: 'Mengelola jajak pendapat / polling.',
    usage: '/poll <pertanyaan> | <opsi1> | <opsi2>',
    examples: ['/poll Siapa rajin? | Budi | Ani']
  },
  {
    name: 'remind',
    aliases: ['listremind', 'delremind'],
    category: 'admin',
    plugin: 'community',
    featureFlag: 'reminder',
    minRole: 'admin',
    description: 'Mengatur pengingat waktu (scheduler) grup/privat.',
    usage: '/remind 10m minum air atau /remind 20:00 sholat',
    examples: ['/remind 10m belajar']
  },
  {
    name: 'event',
    aliases: [],
    category: 'admin',
    plugin: 'community',
    featureFlag: 'attendance',
    minRole: 'admin',
    description: 'Membuat jadwal kegiatan atau event grup.',
    usage: '/event <nama> <waktu>',
    examples: ['/event Rapat 19:00']
  },
  {
    name: 'absen',
    aliases: [],
    category: 'admin',
    plugin: 'community',
    featureFlag: 'attendance',
    minRole: 'admin',
    description: 'Mengelola absensi kehadiran (buka, list, tutup).',
    usage: '/absen [buka/list/tutup]',
    examples: ['/absen buka']
  },

  // --- ADMIN COMMANDS ---
  {
    name: 'bot',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengaktifkan atau menonaktifkan respon pesan bot di grup.',
    usage: '/bot [on/off]',
    examples: ['/bot on', '/bot off']
  },
  {
    name: 'setprefix',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengubah prefix pemanggilan command bot di grup.',
    usage: '/setprefix <prefix>',
    examples: ['/setprefix !']
  },
  {
    name: 'setcooldown',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengatur cooldown delay per fitur dalam satuan detik.',
    usage: '/setcooldown <fitur> <detik>',
    examples: ['/setcooldown werewolf 30']
  },

  // --- SETUP & FEATURES ---
  {
    name: 'setup',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Melakukan onboarding grup atau melihat konfigurasi.',
    usage: '/setup',
    examples: ['/setup']
  },
  {
    name: 'statusfitur',
    aliases: ['features'],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Melihat status feature flags aktif dalam grup.',
    usage: '/statusfitur',
    examples: ['/statusfitur']
  },
  {
    name: 'feature',
    aliases: [],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Mengaktifkan/menonaktifkan feature flag di grup.',
    usage: '/feature <nama_fitur> <on/off>',
    examples: ['/feature werewolf on']
  },

  // --- OWNER TOOLS ---
  {
    name: 'maintenance',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Mengaktifkan/menonaktifkan mode pemeliharaan bot.',
    usage: '/maintenance [on/off]',
    examples: ['/maintenance on']
  },
  {
    name: 'premium',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Mengelola daftar premium user.',
    usage: '/premium [add/remove] @user <hari>',
    examples: ['/premium add @user 30']
  },
  {
    name: 'broadcast',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Mengirimkan pesan siaran ke seluruh chat.',
    usage: '/broadcast <pesan>',
    examples: ['/broadcast Halo semua']
  },
  {
    name: 'stats',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Melihat status performa server dan error log.',
    usage: '/stats',
    examples: ['/stats']
  },
  {
    name: 'limit',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Melihat informasi sisa limit bot.',
    usage: '/limit',
    examples: ['/limit']
  },
  {
    name: 'apikey',
    aliases: ['revokeapikey'],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Mengelola token API admin system.',
    usage: '/apikey atau /revokeapikey',
    examples: ['/apikey']
  },
  {
    name: 'plugin',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Mengaktifkan/menonaktifkan plugin secara global.',
    usage: '/plugin [list|on|off] [nama]',
    examples: ['/plugin list', '/plugin off games']
  },

  // --- SEWA/SUBSCRIPTION TOOLS ---
  {
    name: 'addsewa',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Menambahkan sewa grup baru.',
    usage: '/addsewa <groupId|current> [hari] [plan]',
    examples: ['/addsewa current 30 premium']
  },
  {
    name: 'delsewa',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Menghapus sewa grup.',
    usage: '/delsewa <groupId|current>',
    examples: ['/delsewa current']
  },
  {
    name: 'listsewa',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Melihat seluruh sewa grup aktif.',
    usage: '/listsewa',
    examples: ['/listsewa']
  },
  {
    name: 'extendsewa',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Memperpanjang masa aktif sewa grup.',
    usage: '/extendsewa <groupId|current> <hari>',
    examples: ['/extendsewa current 30']
  },
  {
    name: 'setplan',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Mengatur paket sewa grup.',
    usage: '/setplan <groupId|current> <free|basic|premium>',
    examples: ['/setplan current premium']
  },
  {
    name: 'sewa',
    aliases: [],
    category: 'general',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Melihat informasi harga sewa bot.',
    usage: '/sewa',
    examples: ['/sewa']
  },
  {
    name: 'ceksewa',
    aliases: [],
    category: 'general',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Memeriksa sisa masa aktif sewa grup ini.',
    usage: '/ceksewa',
    examples: ['/ceksewa']
  },
  {
    name: 'fitursewa',
    aliases: [],
    category: 'general',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Melihat perbandingan fitur antar plan sewa.',
    usage: '/fitursewa',
    examples: ['/fitursewa']
  },

  // --- GENERAL/MISC ---
  {
    name: 'rules',
    aliases: [],
    category: 'general',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Melihat ketentuan penggunaan bot.',
    usage: '/rules',
    examples: ['/rules']
  }
];
