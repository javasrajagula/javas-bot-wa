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
    examples: ['/hd', '/hd 2x']
  },
  {
    name: 'compress',
    aliases: ['kompres'],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media_compress',
    description: 'Memperkecil ukuran file video/gambar.',
    usage: '/compress [low|medium|high]',
    examples: ['/compress medium', '/kompres high']
  },
  {
    name: 'resize',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media_resize',
    description: 'Mengubah resolusi/dimensi gambar.',
    usage: '/resize <dimensi/preset>',
    examples: ['/resize 1080x1080', '/resize story']
  },
  {
    name: 'crop',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media',
    description: 'Memotong gambar dengan rasio tertentu.',
    usage: '/crop [square|story|pp]',
    examples: ['/crop square']
  },
  {
    name: 'wm',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media',
    description: 'Menambahkan watermark teks kustom pada gambar.',
    usage: '/wm <teks>',
    examples: ['/wm Javas Bot']
  },
  {
    name: 'togif',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media',
    description: 'Mengonversi video menjadi animasi format GIF.',
    usage: 'Reply video dengan command /togif.',
    examples: ['/togif']
  },
  {
    name: 'thumb',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media',
    description: 'Mengambil gambar thumbnail dari video pada detik tertentu.',
    usage: '/thumb [timestamp]',
    examples: ['/thumb 00:00:05']
  },
  {
    name: 'cut',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media_video',
    description: 'Memotong durasi file video.',
    usage: '/cut [start-end]',
    examples: ['/cut 00:05-00:15']
  },
  {
    name: 'mute',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media',
    description: 'Menghilangkan suara dari file video.',
    usage: 'Reply video dengan command /mute.',
    examples: ['/mute']
  },
  {
    name: 'reverse',
    aliases: [],
    category: 'media',
    plugin: 'media',
    featureFlag: 'media',
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
    featureFlag: 'audio',
    description: 'Mengonversi teks menjadi suara (Text-to-Speech).',
    usage: '/tts <teks>',
    examples: ['/tts Halo, selamat pagi']
  },
  {
    name: 'mp3',
    aliases: ['audio'],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'audio',
    description: 'Mengekstrak suara/audio dari video menjadi format MP3.',
    usage: 'Reply video dengan command /mp3.',
    examples: ['/mp3', '/audio']
  },
  {
    name: 'transkrip',
    aliases: ['vntext'],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'audio',
    description: 'Mengonversi file suara (Voice Note) menjadi teks tertulis.',
    usage: 'Reply voice note dengan command /transkrip.',
    examples: ['/transkrip', '/vntext']
  },
  {
    name: 'voice',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'audio',
    description: 'Mengubah karakter/efek suara audio.',
    usage: '/voice [robot|chipmunk|deep]',
    examples: ['/voice robot']
  },
  {
    name: 'cutaudio',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'audio',
    description: 'Memotong durasi file audio.',
    usage: '/cutaudio [start-end]',
    examples: ['/cutaudio 00:10-00:30']
  },
  {
    name: 'speed',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'audio',
    description: 'Mempercepat tempo pemutaran audio.',
    usage: '/speed [multiplier]',
    examples: ['/speed 1.5x']
  },
  {
    name: 'slow',
    aliases: [],
    category: 'audio',
    plugin: 'audio',
    featureFlag: 'audio',
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
  {
    name: 'ytmp3',
    aliases: ['youtube-audio'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh audio dari video YouTube dalam format MP3.',
    usage: '/ytmp3 <url>',
    examples: ['/ytmp3 https://www.youtube.com/watch?v=dQw4w9WgXcQ']
  },
  {
    name: 'ytmp4',
    aliases: ['youtube-video'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh video dari YouTube dalam format MP4.',
    usage: '/ytmp4 <url>',
    examples: ['/ytmp4 https://www.youtube.com/watch?v=dQw4w9WgXcQ']
  },
  {
    name: 'fb',
    aliases: ['facebook', 'fbdown'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh video dari postingan Facebook.',
    usage: '/fb <url>',
    examples: ['/fb https://www.facebook.com/watch/?v=123456']
  },
  {
    name: 'twitter',
    aliases: ['x', 'twtdl'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh video dari postingan Twitter/X.',
    usage: '/twitter <url>',
    examples: ['/twitter https://twitter.com/user/status/123456']
  },
  {
    name: 'threads',
    aliases: ['thread'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh video atau gambar dari postingan Threads.',
    usage: '/threads <url>',
    examples: ['/threads https://www.threads.net/@user/post/123456']
  },
  {
    name: 'pinterest',
    aliases: ['pin', 'pindl'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh media (gambar/video) dari Pinterest.',
    usage: '/pinterest <url>',
    examples: ['/pinterest https://pin.it/abcde']
  },
  {
    name: 'capcut',
    aliases: ['cc'],
    category: 'downloader',
    plugin: 'downloader',
    featureFlag: 'downloader',
    description: 'Mengunduh video dari template CapCut tanpa watermark.',
    usage: '/capcut <url>',
    examples: ['/capcut https://www.capcut.com/template-detail/123456']
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
    description: 'Membaca isi teks dari QR Code dan memvalidasi keamanannya.',
    usage: 'Reply gambar QR Code dengan command /readqr [safe].',
    examples: ['/readqr', '/readqr safe']
  },
  {
    name: 'checklink',
    aliases: [],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Memeriksa keamanan URL terhadap ancaman SSRF/loop-redirect.',
    usage: '/checklink <url>',
    examples: ['/checklink https://google.com']
  },
  {
    name: 'cekpenipuan',
    aliases: ['scamcheck'],
    category: 'document',
    plugin: 'document',
    featureFlag: 'general',
    description: 'Menganalisis potensi penipuan (scam) dari teks percakapan atau gambar screenshot.',
    usage: '/cekpenipuan [teks] atau reply gambar/teks screenshot.',
    examples: ['/cekpenipuan info promo shopee gratis saldo', '/cekpenipuan']
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
    aliases: ['settitle'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Melihat dan memasang title profil dari achievement atau item toko.',
    usage: '/title atau /title set <nama_gelar>',
    examples: ['/title', '/title set Petualang']
  },
  {
    name: 'achievement',
    aliases: ['achievements'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Melihat daftar achievement dan progres unlock.',
    usage: '/achievement',
    examples: ['/achievement', '/achievements all']
  },
  {
    name: 'badge',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Melihat dan memasang badge achievement ke profile card.',
    usage: '/badge atau /badge set <nama_badge>',
    examples: ['/badge', '/badge set FIRST']
  },
  {
    name: 'setbadge',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'economy',
    description: 'Mengatur badge custom untuk profile card.',
    usage: '/setbadge <badge1> [badge2]',
    examples: ['/setbadge FIRST STICKER']
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
    category: 'community',
    plugin: 'community',
    featureFlag: 'reminder',
    description: 'Mengatur pengingat waktu (scheduler) pribadi.',
    usage: '/remind 10m minum air atau /remind 20:00 sholat',
    examples: ['/remind 10m belajar']
  },
  {
    name: 'remindgroup',
    aliases: [],
    category: 'community',
    plugin: 'community',
    featureFlag: 'reminder',
    minRole: 'admin',
    description: 'Mengatur pengingat waktu (scheduler) grup.',
    usage: '/remindgroup 10m minum air atau /remindgroup 20:00 sholat',
    examples: ['/remindgroup 10m rapat']
  },
  {
    name: 'jadwal',
    aliases: [],
    category: 'community',
    plugin: 'community',
    featureFlag: 'general',
    description: 'Mengelola jadwal mata pelajaran atau agenda kegiatan grup.',
    usage: '/jadwal atau /jadwal add senin 07:00 Matematika atau /jadwal del <id>',
    examples: ['/jadwal', '/jadwal add senin 07:00 Matematika']
  },
  {
    name: 'tugas',
    aliases: [],
    category: 'community',
    plugin: 'community',
    featureFlag: 'general',
    description: 'Mengelola tugas dan deadline kegiatan grup.',
    usage: '/tugas atau /tugas add "besok 23:59" Tugas Matematika atau /tugas done <id>',
    examples: ['/tugas', '/tugas add "besok 23:59" Tugas Matematika']
  },
  {
    name: 'ultah',
    aliases: [],
    category: 'community',
    plugin: 'community',
    featureFlag: 'general',
    description: 'Mengelola tanggal ulang tahun anggota grup.',
    usage: '/ultah atau /ultah add @user 12-08 atau /ultah del @user',
    examples: ['/ultah', '/ultah add @user 12-08']
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
    aliases: ['setupwizard'],
    category: 'admin',
    plugin: 'moderation',
    featureFlag: 'general',
    minRole: 'admin',
    description: 'Melakukan onboarding grup atau melihat konfigurasi.',
    usage: '/setup [basic|sekolah|komunitas|strict|game|reset|confirm]',
    examples: ['/setupwizard', '/setup komunitas', '/setup confirm']
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
  {
    name: 'backup',
    aliases: ['backupdb', 'backupconfig'],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Membuat backup database atau konfigurasi secara manual.',
    usage: '/backup atau /backupdb atau /backupconfig',
    examples: ['/backup', '/backupdb']
  },
  {
    name: 'listbackup',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Melihat daftar backup lokal.',
    usage: '/listbackup',
    examples: ['/listbackup']
  },
  {
    name: 'restorebackup',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Restore database dari backup dengan konfirmasi eksplisit.',
    usage: '/restorebackup <id>',
    examples: ['/restorebackup db-2026-05-30T10-00-00-000Z']
  },
  {
    name: 'exportconfig',
    aliases: ['importconfig'],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    minRole: 'owner',
    description: 'Export atau import konfigurasi grup dan subscription.',
    usage: '/exportconfig atau reply JSON dengan /importconfig',
    examples: ['/exportconfig']
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
  },

  // --- MODERATION ---
  {
    name: 'warn',
    aliases: [],
    category: 'moderation',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Memberikan peringatan kepada anggota grup.',
    usage: '/warn @user <alasan>',
    examples: ['/warn @user spamming']
  },
  {
    name: 'warnings',
    aliases: [],
    category: 'moderation',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Melihat daftar peringatan seseorang.',
    usage: '/warnings [@user]',
    examples: ['/warnings', '/warnings @user']
  },
  {
    name: 'unwarn',
    aliases: [],
    category: 'moderation',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Menghapus satu peringatan terakhir pengguna.',
    usage: '/unwarn @user',
    examples: ['/unwarn @user']
  },
  {
    name: 'clearwarn',
    aliases: [],
    category: 'moderation',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Menghapus semua peringatan pengguna.',
    usage: '/clearwarn @user',
    examples: ['/clearwarn @user']
  },
  {
    name: 'addwarnrule',
    aliases: [],
    category: 'moderation',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Menambahkan aturan tindakan untuk batas peringatan tertentu.',
    usage: '/addwarnrule <batas> <kick/mute>',
    examples: ['/addwarnrule 3 kick']
  },
  {
    name: 'delwarnrule',
    aliases: [],
    category: 'moderation',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Menghapus aturan batas peringatan.',
    usage: '/delwarnrule <batas>',
    examples: ['/delwarnrule 3']
  },
  {
    name: 'listwarnrule',
    aliases: [],
    category: 'moderation',
    plugin: 'moderation',
    featureFlag: 'general',
    description: 'Melihat daftar aturan batas peringatan grup.',
    usage: '/listwarnrule',
    examples: ['/listwarnrule']
  },
  {
    name: 'sewa',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    description: 'Menampilkan informasi paket harga sewa bot.',
    usage: '/sewa',
    examples: ['/sewa']
  },
  {
    name: 'ceksewa',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    description: 'Mengecek sisa masa aktif sewa grup saat ini.',
    usage: '/ceksewa',
    examples: ['/ceksewa']
  },
  {
    name: 'invoice',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    description: 'Membuat invoice tagihan pembayaran sewa bot / premium user.',
    usage: '/invoice <basic/premium> <jumlah_bulan>',
    examples: ['/invoice premium 3']
  },
  {
    name: 'trial',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    description: 'Mengklaim masa uji coba (trial) gratis Paket Basic selama 3 hari untuk grup.',
    usage: '/trial',
    examples: ['/trial']
  },
  {
    name: 'quota',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Melihat kuota penggunaan perintah harian untuk grup atau chat pribadi.',
    usage: '/quota',
    examples: ['/quota']
  },
  {
    name: 'credit',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Melihat saldo koin kredit premium Anda.',
    usage: '/credit',
    examples: ['/credit']
  },
  {
    name: 'buycredit',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Membeli koin kredit menggunakan saldo balance RPG Anda.',
    usage: '/buycredit <jumlah>',
    examples: ['/buycredit 10']
  },
  {
    name: 'usage',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Melihat statistik detail pemanggilan fitur bot Anda.',
    usage: '/usage',
    examples: ['/usage']
  },
  {
    name: 'addreseller',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    description: 'Mengaktifkan status partner reseller untuk pengguna target.',
    usage: '/addreseller <@user> [saldo_awal]',
    examples: ['/addreseller @user 100000']
  },
  {
    name: 'reseller',
    aliases: [],
    category: 'owner',
    plugin: 'owner',
    featureFlag: 'general',
    description: 'Panel menu kemitraan reseller bot (balance, order, panel).',
    usage: '/reseller <balance/order/panel>',
    examples: ['/reseller balance', '/reseller order premium 123@g.us 3', '/reseller panel']
  },
  // --- BUSINESS / JUAL-BELI SUITE ---
  {
    name: 'jual',
    aliases: ['produk'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mendaftarkan barang jualan baru di dalam grup (Business Catalog).',
    usage: '/jual [nama_barang] | [harga] | [deskripsi]',
    examples: ['/jual Laptop Asus | 15000000 | Bekas mulus']
  },
  {
    name: 'listjual',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Melihat seluruh katalog barang jualan aktif di grup ini.',
    usage: '/listjual',
    examples: ['/listjual']
  },
  {
    name: 'cariitem',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mencari barang jualan aktif di grup menggunakan kata kunci.',
    usage: '/cariitem [keyword]',
    examples: ['/cariitem asus']
  },
  {
    name: 'sold',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Menandai barang jualan milik Anda telah sukses terjual.',
    usage: '/sold [ID_Barang]',
    examples: ['/sold A3F4E2']
  },
  {
    name: 'hapusjual',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Menghapus barang jualan dari katalog grup (hanya penjual/admin).',
    usage: '/hapusjual [ID_Barang]',
    examples: ['/hapusjual A3F4E2']
  },
  {
    name: 'formatjual',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mendapatkan template teks format promosi jualan yang siap disalin.',
    usage: '/formatjual [nama] | [harga] | [kondisi]',
    examples: ['/formatjual HP Xiaomi | 2000000 | Mulus']
  },
  // --- FINANCE SUITE (KAS, SPLIT BILL, PERSONAL FINANCE) ---
  {
    name: 'kas',
    aliases: ['iuran'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mengelola uang kas / iuran kelompok di grup (masuk, keluar, saldo, laporan, export).',
    usage: '/kas <masuk/keluar/saldo/laporan/export> [opsi]',
    examples: ['/kas saldo', '/kas masuk 50000 @user', '/kas keluar 100000 Konsumsi']
  },
  {
    name: 'split',
    aliases: ['splitadd', 'splitdone', 'splitstatus'],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Membuat dan memantau pembagian tagihan rata (Split Bill) di grup.',
    usage: '/split [nominal] @user1 @user2 @user3',
    examples: ['/split 90000 @user1 @user2', '/splitstatus', '/splitdone @user1']
  },
  {
    name: 'catat',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mencatat riwayat pengeluaran keuangan pribadi Anda.',
    usage: '/catat [nominal] [kategori]',
    examples: ['/catat 15000 Makan Siang']
  },
  {
    name: 'pengeluaran',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Melihat ringkasan total pengeluaran pribadi Anda (hariini/bulanini).',
    usage: '/pengeluaran <hariini/bulanini>',
    examples: ['/pengeluaran hariini', '/pengeluaran bulanini']
  },
  {
    name: 'budget',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Menetapkan dan memantau limit budget pengeluaran bulanan per kategori.',
    usage: '/budget <add/status> [kategori] [nominal]',
    examples: ['/budget status', '/budget add Makan 500000']
  },
  {
    name: 'tagihan',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mengelola tagihan iuran personal kepada anggota grup (add, list, done, remind).',
    usage: '/tagihan <add/list/done/remind> [opsi]',
    examples: ['/tagihan list', '/tagihan add @user Iuran Kas | 20000']
  },
  {
    name: 'arisan',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Fitur arisan kelompok di dalam grup (join, list, undi).',
    usage: '/arisan <join/list/undi> [opsi]',
    examples: ['/arisan list', '/arisan join 50000', '/arisan undi']
  },
  {
    name: 'escrow',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Rekening Bersama (simulasi Escrow) untuk transaksi aman di grup.',
    usage: '/escrow <create/paid/release/dispute> [opsi]',
    examples: ['/escrow create @seller @buyer 200000', '/escrow paid ESC-ABC']
  },
  {
    name: 'kontrak',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mendapatkan draf template kontrak kesepakatan (jualbeli, jasa, sewa).',
    usage: '/kontrak <jualbeli/jasa/sewa>',
    examples: ['/kontrak jualbeli']
  },
  {
    name: 'customer',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mendaftarkan data customer baru di CRM Anda.',
    usage: '/customer add @user',
    examples: ['/customer add @user']
  },
  {
    name: 'order',
    aliases: [],
    category: 'economy',
    plugin: 'economy',
    featureFlag: 'general',
    description: 'Mengelola pesanan/order CRM pelanggan Anda.',
    usage: '/order <add/status> [opsi]',
    examples: ['/order status', '/order add @user Jasa Web | 1000000']
  },
  // --- PRIVACY & DATA RETENTION SUITE ---
  {
    name: 'privacymode',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Mengatur mode privasi grup (strict/balanced/off) untuk mengontrol penyimpanan data.',
    usage: '/privacymode <strict|balanced|off>',
    examples: ['/privacymode strict', '/privacymode balanced', '/privacymode off']
  },
  {
    name: 'retention',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Mengatur kebijakan retensi (penyimpanan) data grup (logs/messages/media).',
    usage: '/retention <logs|messages|media> <1h|7d|30d|90d|off>',
    examples: ['/retention logs 30d', '/retention messages 7d', '/retention media off']
  },
  {
    name: 'cleandb',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Membersihkan data lama dari database (logs/temp/usage). Hanya Owner.',
    usage: '/cleandb <logs|temp|usage> [durasi]',
    examples: ['/cleandb logs 30d', '/cleandb temp', '/cleandb usage 90d']
  },
  {
    name: 'mydata',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Melihat semua data personal Anda yang tersimpan di bot.',
    usage: '/mydata',
    examples: ['/mydata']
  },
  {
    name: 'deletemydata',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Menghapus data personal Anda dari bot (profil, ekonomi, log).',
    usage: '/deletemydata [konfirmasi]',
    examples: ['/deletemydata', '/deletemydata konfirmasi']
  },
  {
    name: 'consent',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Mengatur persetujuan (consent) Anda untuk fitur AI, auto-summary, dan analitik.',
    usage: '/consent <autosummary|ai|analytics> <on|off>',
    examples: ['/consent ai off', '/consent autosummary on', '/consent analytics off']
  },
  {
    name: 'generaterules',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Membuat peraturan grup otomatis dari template (sekolah/jualbeli/komunitas).',
    usage: '/generaterules <sekolah|jualbeli|komunitas>',
    examples: ['/generaterules sekolah', '/generaterules jualbeli', '/generaterules komunitas']
  },
  {
    name: 'rules',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Melihat, menambah, dan mengelola versi peraturan grup aktif.',
    usage: '/rules [edit|version|rollback] [teks]',
    examples: ['/rules', '/rules edit 6. Dilarang spam.', '/rules version', '/rules rollback']
  },
  {
    name: 'ruleslog',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Melihat log persetujuan anggota terhadap peraturan grup.',
    usage: '/ruleslog',
    examples: ['/ruleslog']
  },
  {
    name: 'setuju',
    aliases: [],
    category: 'privacy',
    plugin: 'privacy',
    featureFlag: 'general',
    description: 'Menyetujui peraturan grup yang aktif.',
    usage: '/setuju',
    examples: ['/setuju']
  },
  // --- WEBHOOK & ANNOUNCEMENTS SUITE ---
  {
    name: 'webhook',
    aliases: [],
    category: 'developer',
    plugin: 'webhook',
    featureFlag: 'general',
    description: 'Mengelola URL webhook untuk notifikasi event bot ke server eksternal.',
    usage: '/webhook <set|test|off|list> [url]',
    examples: ['/webhook set https://example.com/hook', '/webhook test', '/webhook off', '/webhook list']
  },
  {
    name: 'announce',
    aliases: [],
    category: 'community',
    plugin: 'announce',
    featureFlag: 'general',
    description: 'Membuat pengumuman resmi bergaya format otomatis di grup.',
    usage: '/announce <pesan>',
    examples: ['/announce Rapat besok jam 10 pagi di aula utama.']
  },
  {
    name: 'announcements',
    aliases: [],
    category: 'community',
    plugin: 'announce',
    featureFlag: 'general',
    description: 'Menampilkan riwayat 10 pengumuman terakhir di grup.',
    usage: '/announcements',
    examples: ['/announcements']
  },
  {
    name: 'announcement',
    aliases: [],
    category: 'community',
    plugin: 'announce',
    featureFlag: 'general',
    description: 'Melihat detail satu pengumuman berdasarkan ID-nya.',
    usage: '/announcement <id>',
    examples: ['/announcement ANN-1234567890']
  }
];
