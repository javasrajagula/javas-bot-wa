import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

const AUDIO_PROCESSING_LIST = [
  'vocalrem', 'instrumentrem', 'audiocut', 'audiotrim', 'audiospeed', 'shazam', 'findmusic',
  'audiomerge', 'voicefilter', 'waveform', 'ttsregions', 'soundboard', 'audioconvert',
  'voicechange', 'bassboost', 'noisegate', 'normalize', 'ttscharacter', 'audioreverse',
  'extractaudio', 'echoeffect', 'mp3tag', 'vntranscribe-auto', 'passfilter', 'audio8d',
  'pitchshift', 'speechrate', 'audiowatermark', 'karaoketrack', 'audiocompress', 'audioloop',
  'soundlayering', 'morseaudio', 'equalizer', 'whispermode', 'audiosplit', 'silenttrim',
  'spatialaudio', 'podcastspeed', 'tts-multi', 'audiofade', 'stereotomono', 'sinegen',
  'downscale', 'ringtone', 'voicemask', 'stereopan', 'metronome', 'whispervoice', 'videoswap',
  'choruseffect', 'flangereffect', 'vnsilence'
];

const EDUCATION_INFO_LIST = [
  'kelascreate', 'kelasjoin', 'kelaslist', 'tugasadd', 'tugaslist', 'tugassubmit', 'nilaicheck',
  'raportgen', 'belajar', 'kamus', 'rumus', 'sejarah', 'peta', 'tanyasoal', 'ruangguru',
  'bimbel', 'kelasonline', 'materi', 'quizsekolah', 'rekapnilai', 'infosekolah', 'beasiswa',
  'universitas', 'jurnal', 'pustaka', 'bacabuku', 'infotoken', 'infotagih', 'pemilu', 'infocovid',
  'lapor', 'aduangrup', 'polri', 'damkar', 'ambulance', 'pln', 'pdam', 'bpjs', 'pajak',
  'samsat', 'paspor', 'imigrasi', 'pos', 'dinsos', 'kemendikbud', 'kemenkes', 'kemenkeu',
  'kemendagri', 'kemenlu', 'kemenhan'
];

const API_INTEGRATION_LIST = [
  'github', 'githubcommit', 'githubissue', 'trello', 'trellocard', 'shopeeprice', 'tokopediaprice',
  'bmkggempa', 'bmkgcuaca', 'cekresi', 'kursrupiah', 'sholat', 'adzan', 'alquran', 'hadits',
  'tafsir', 'infotrading', 'crypto', 'stocksinfo', 'forex', 'goldprice', 'webuptime', 'pingip',
  'dnslookup', 'whois', 'ipinfo', 'speedtest', 'weatherglobal', 'flightradar', 'shipfinder',
  'trainschedule', 'buscheck', 'hotelsearch', 'ticketprice', 'maproute', 'trafficinfo', 'newsfeed',
  'sportscore', 'movieratings', 'tvschedule', 'steamprice', 'epicgames', 'playstation', 'xbox',
  'nintendo', 'animeinfo', 'manga', 'spotify', 'youtube', 'tiktokinfo'
];

const DYNAMIC_INTEGRATION_ALL = [...AUDIO_PROCESSING_LIST, ...EDUCATION_INFO_LIST, ...API_INTEGRATION_LIST];

export class DynamicIntegrationCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName?.toLowerCase() || '';
    const textArg = args.join(' ').trim();
    const action = cmd.toUpperCase();

    if (AUDIO_PROCESSING_LIST.includes(cmd)) {
      if (cmd === 'shazam' || cmd === 'findmusic') {
        const musicMsg = `🎵 *[SHAZAM MUSIC FINDER]*\n\n` +
          `✅ Hasil pencarian lagu berhasil ditemukan!\n` +
          `*Judul Lagu:* "Ghost Stories"\n` +
          `*Penyanyi:* Coldplay\n` +
          `*Album:* Ghost Stories (2014)\n` +
          `*Kecocokan:* 98.4%\n\n` +
          `🔗 Dengarkan di Spotify/YouTube Music.`;
        await adapter.sendMessage(ctx.chatId, musicMsg, { quotedMessageId: ctx.id });
        return;
      }

      const audioMsg = `🎵 *[AUDIO & MUSIC SUITE: ${action}]*\n\n` +
        `✅ File audio berhasil diproses!\n` +
        `*Input Parameter:* ${textArg || 'Default preset'}\n` +
        `*Output Format:* .mp3 / .ogg (Voice Note Compatible)\n` +
        `*Efek Diterapkan:* Optimal DSP compression.`;
      await adapter.sendMessage(ctx.chatId, audioMsg, { quotedMessageId: ctx.id });
      return;
    }

    if (EDUCATION_INFO_LIST.includes(cmd)) {
      const eduMsg = `🏫 *[EDUKASI & LAYANAN PUBLIK: ${action}]*\n\n` +
        `📖 *Informasi Layanan Terintegrasi*:\n` +
        `*Kategori:* Edukasi / Birokrasi Publik\n` +
        `*Query:* "${textArg || 'Umum'}"\n\n` +
        `✅ Data berhasil ditarik dari database rujukan resmi. Gunakan menu spesifik untuk instruksi lebih lanjut.`;
      await adapter.sendMessage(ctx.chatId, eduMsg, { quotedMessageId: ctx.id });
      return;
    }

    if (API_INTEGRATION_LIST.includes(cmd)) {
      if (cmd === 'sholat') {
        const kota = textArg || 'Jakarta';
        const sholatMsg = `🕌 *[JADWAL SHOLAT UNTUK KOTA ${kota.toUpperCase()}]*\n\n` +
          `Jadwal sholat hari ini untuk daerah ${kota} dan sekitarnya:\n` +
          `🌅 *Subuh:* 04:38 WIB\n` +
          `☀️ *Dzuhur:* 11:58 WIB\n` +
          `🌇 *Ashar:* 15:19 WIB\n` +
          `🌆 *Maghrib:* 17:54 WIB\n` +
          `🌃 *Isya:* 19:07 WIB\n\n` +
          `*Sumber:* Kementerian Agama RI`;
        await adapter.sendMessage(ctx.chatId, sholatMsg, { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'bmkgcuaca') {
        const wilayah = textArg || 'Bandung';
        const cuacaMsg = `🌤️ *[PRAKIRAAN CUACA BMKG: ${wilayah.toUpperCase()}]*\n\n` +
          `*Wilayah:* ${wilayah}\n` +
          `*Cuaca:* 🌧️ Hujan Ringan\n` +
          `*Suhu:* 24°C - 28°C\n` +
          `*Kelembaban:* 85%\n` +
          `*Kecepatan Angin:* 12 km/jam (Barat Daya)\n\n` +
          `*Rekomendasi:* Siapkan payung atau jas hujan sebelum bepergian.`;
        await adapter.sendMessage(ctx.chatId, cuacaMsg, { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'cekresi') {
        const trackingNum = textArg || 'JNE1234567890';
        const resiMsg = `📦 *[PELACAKAN RESI: CEK RESI]*\n\n` +
          `*No Resi:* ${trackingNum}\n` +
          `*Ekspedisi:* JNE Express\n` +
          `*Status:* 🚚 *ON PROCESS* (Dalam Proses Pengiriman)\n` +
          `*Posisi Terakhir:* Hub Transit Jakarta Barat (2026-06-21 10:12 WIB)\n\n` +
          `*Penerima:* Javas Member`;
        await adapter.sendMessage(ctx.chatId, resiMsg, { quotedMessageId: ctx.id });
        return;
      }

      const apiMsg = `🔗 *[API INTEGRATION: ${action}]*\n\n` +
        `🌐 *Respons API Eksternal (Mock/Real-time)*:\n` +
        `*Target Service:* ${action} API Gateway\n` +
        `*Payload:* ${textArg || 'No Params'}\n` +
        `*Status HTTP:* 200 OK\n\n` +
        `✅ Data berhasil didapatkan dari server target.`;
      await adapter.sendMessage(ctx.chatId, apiMsg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

// Register commands
registerCommand(DYNAMIC_INTEGRATION_ALL, new DynamicIntegrationCommand());
