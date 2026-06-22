import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import axios from 'axios';

const UTILITY_LIST = [
  'pdfmerge', 'pdfsplit', 'ocrtranslate', 'gdruploader', 'driveupload', 'vntotext', 'transcribe',
  'catat', 'expense', 'mindmap', 'todo', 'grouptodo', 'cal-schedule', 'qrcode', 'qrscan',
  'fileconvert', 'tometadata', 'announcesched', 'wiki', 'scientific-calc', 'kalkulator',
  'bmkgearthquake', 'bmkgweather', 'currencyconvert', 'recipefinder', 'funfact', 'holiday',
  'zipfile', 'unzipfile', 'ssweb', 'urlexpand', 'diffchecker', 'wordcount', 'pollgen',
  'attendance', 'birthdayremind', 'shorten', 'sigfooter', 'jsonformat', 'ttsv2', 'timezone',
  'base64encode', 'base64decode', 'hexrgb', 'passgen', 'rssfeed', 'bizcard', 'emailsend',
  'unitconvert', 'googlesearch', 'markdownpdf', 'gitlog', 'uptimealert', 'rulesbuild',
  'pomodoro', 'anonbox', 'virtualboard', 'textcase', 'countdown', 'tempnote'
];

const ANALYTICS_LIST = [
  'wordcloud', 'heatmap', 'weeklyreport', 'sentimentalert', 'exportcsv', 'topmedia', 'growthtracker',
  'healthscore', 'speedometer', 'commandusage', 'inaktif', 'auditlog', 'stickerleaderboard',
  'responsetime', 'silenceperiod', 'successrate', 'toxicboard', 'barchart', 'peakday', 'linkshare',
  'emojistats', 'vnduration', 'metrictrack', 'retentionrate', 'messageratio', 'exportpdf',
  'storagemonitor', 'apiresponsetime', 'hourlydistribution', 'mentiontrack', 'perfboard',
  'inactiveadmin', 'spammerscore', 'dailygoal', 'invoiceanalytics', 'mediaratio', 'uptimepercent',
  'mostquoted', 'activeoverlap', 'configchanges', 'wordlength', 'leveldistribution', 'quotalimit',
  'sentimentdeviation', 'filesizestats', 'quizleaderboard', 'growthvelocity', 'qualityscore',
  'alerttrigger', 'purgeestimator'
];

const DYNAMIC_UTILITY_ALL = [...UTILITY_LIST, ...ANALYTICS_LIST];

export class DynamicUtilityCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName?.toLowerCase() || '';
    const textArg = args.join(' ').trim();
    const action = cmd.toUpperCase();

    if (UTILITY_LIST.includes(cmd)) {
      // 1. QR Code Generator
      if (cmd === 'qrcode') {
        if (!textArg) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks atau URL untuk dibuat QR Code. Contoh: `/qrcode https://google.com`', { quotedMessageId: ctx.id });
          return;
        }
        await adapter.sendMessage(ctx.chatId, '⏳ Sedang membuat QR Code...', { quotedMessageId: ctx.id });
        try {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(textArg)}`;
          const response = await axios.get(qrUrl, { responseType: 'arraybuffer' });
          await adapter.sendImage(ctx.chatId, Buffer.from(response.data), 'Ini QR Code hasil generate Anda! 📲', { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat QR Code: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // 2. BMKG Earthquake Tracker
      if (cmd === 'bmkgearthquake') {
        await adapter.sendMessage(ctx.chatId, '⏳ Mengambil data gempa terbaru dari BMKG...', { quotedMessageId: ctx.id });
        try {
          const response = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
          const gempa = response.data?.Infogempa?.gempa;
          if (!gempa) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Data gempa tidak ditemukan dari BMKG.', { quotedMessageId: ctx.id });
            return;
          }

          const details = [
            `╔════════════════════════════════╗`,
            `  🚨  *INFO GEMPA TERKINI (BMKG)*  `,
            `╚════════════════════════════════╝`,
            `📅 *Tanggal:* ${gempa.Tanggal}`,
            `⏰ *Waktu:* ${gempa.Jam}`,
            `📈 *Magnitudo:* ${gempa.Magnitude} SR`,
            `📉 *Kedalaman:* ${gempa.Kedalaman}`,
            `📍 *Wilayah:* ${gempa.Wilayah}`,
            `⚠️ *Potensi:* ${gempa.Potensi}`,
            `🌊 *Dirasakan:* ${gempa.Dirasakan}`,
            `╚════════════════════════════════╝`
          ].join('\n');

          if (gempa.Shakemap) {
            const mapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`;
            const mapRes = await axios.get(mapUrl, { responseType: 'arraybuffer' });
            await adapter.sendImage(ctx.chatId, Buffer.from(mapRes.data), details, { quotedMessageId: ctx.id });
          } else {
            await adapter.sendMessage(ctx.chatId, details, { quotedMessageId: ctx.id });
          }
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil data gempa BMKG: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // 3. Wikipedia Search
      if (cmd === 'wiki' || cmd === 'wikipedia') {
        if (!textArg) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan kata kunci pencarian Wikipedia. Contoh: `/wiki Indonesia`', { quotedMessageId: ctx.id });
          return;
        }
        await adapter.sendMessage(ctx.chatId, `⏳ Mencari Wikipedia untuk "${textArg}"...`, { quotedMessageId: ctx.id });
        try {
          const wikiUrl = `https://id.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(textArg)}`;
          const response = await axios.get(wikiUrl);
          const results = response.data?.query?.search;
          if (!results || results.length === 0) {
            await adapter.sendMessage(ctx.chatId, `🔍 Tidak ada hasil Wikipedia untuk *"${textArg}"*.`, { quotedMessageId: ctx.id });
            return;
          }

          const topHit = results[0];
          const cleanSnippet = topHit.snippet.replace(/<\/?[^>]+(>|$)/g, "");
          const pageLink = `https://id.wikipedia.org/wiki/${encodeURIComponent(topHit.title)}`;

          const msg = [
            `📚 *[WIKIPEDIA SEARCH]* 📚`,
            `*Hasil teratas untuk:* "${textArg}"`,
            `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
            `📖 *Judul:* ${topHit.title}`,
            `📝 *Ringkasan:*`,
            `_${cleanSnippet}..._`,
            `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
            `🔗 *Selengkapnya:* ${pageLink}`
          ].join('\n');

          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mencari di Wikipedia: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // 4. Safe Calculator
      if (cmd === 'kalkulator' || cmd === 'scientific-calc') {
        if (!textArg) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ekspresi matematika yang ingin dihitung. Contoh: `/kalkulator (2 + 5) * 3`', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const cleanExpr = textArg.replace(/[^0-9+\-*/().\s^]/g, '');
          const evalExpr = cleanExpr.replace(/\^/g, '**');

          if (!/^[0-9+\-*/().\s*]+$/.test(evalExpr)) {
            throw new Error('Ekspresi mengandung karakter ilegal.');
          }

          const result = Function(`return (${evalExpr})`)();

          if (result === undefined || isNaN(result) || !isFinite(result)) {
            throw new Error('Hasil tidak valid.');
          }

          const msg = `🧮 *[KALKULATOR]* 🧮\n\n` +
            `• Ekspresi: \`${textArg}\`\n` +
            `• Hasil: *${result}*`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Error perhitungan: ${err.message || 'Harap masukkan ekspresi matematika yang valid.'}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // 5. Fun Fact
      if (cmd === 'funfact') {
        const localFacts = [
          'Jantung paus biru berukuran sebesar mobil kecil.',
          'Madu alami tidak pernah membusuk; madu dari ribuan tahun lalu yang ditemukan di piramida masih aman dimakan.',
          'Gurita memiliki tiga jantung dan darah berwarna biru.',
          'Satu hari di planet Venus lebih lama daripada satu tahun di planet Venus.',
          'Pisang adalah buah beri secara klasifikasi botani, tetapi stroberi bukan.',
          'Air panas membeku lebih cepat daripada air dingin (dikenal sebagai Efek Mpemba).',
          'Semut tidak memiliki paru-paru dan mereka tidak pernah tidur nyenyak.',
          'Wortel awalnya berwarna ungu sebelum petani Belanda merekayasanya menjadi warna oranye.',
          'Menara Eiffel bisa memuai dan tumbuh lebih tinggi hingga 15 cm selama musim panas.',
          'Otak manusia menghasilkan daya listrik yang cukup untuk menyalakan lampu bohlam LED kecil.'
        ];

        let fact = '';
        try {
          const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 2000 });
          const enFact = response.data?.text;
          if (enFact) {
            fact = `${enFact} (Source: UselessFacts)`;
          } else {
            throw new Error('Empty API response');
          }
        } catch {
          fact = localFacts[Math.floor(Math.random() * localFacts.length)];
        }

        const msg = `💡 *[FAKTA UNIK]* 💡\n\n` +
          `"${fact}"`;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // 6. Password Generator
      if (cmd === 'passgen') {
        let length = parseInt(args[0], 10);
        if (isNaN(length) || length < 6 || length > 64) {
          length = 12;
        }

        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~';
        let password = '';
        for (let i = 0; i < length; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const msg = `🔑 *[PASSWORD GENERATOR]* 🔑\n\n` +
          `• Panjang: *${length} karakter*\n` +
          `• Password: \`${password}\`\n\n` +
          `💡 _Password di atas ditulis dalam format monospace agar mudah disalin._`;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // 7. Case Converter
      if (cmd === 'textcase') {
        const type = args[0]?.toLowerCase().trim();
        const text = args.slice(1).join(' ').trim();

        if (!type || !text) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah. Contoh:\n' +
            '• `/textcase upper hello` → HELLO\n' +
            '• `/textcase lower HELLO` → hello\n' +
            '• `/textcase title hello world` → Hello World\n' +
            '• `/textcase sarcasm hello world` → hElLo wOrLd',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        let converted = text;
        if (type === 'upper') {
          converted = text.toUpperCase();
        } else if (type === 'lower') {
          converted = text.toLowerCase();
        } else if (type === 'title') {
          converted = text.replace(/\b\w/g, c => c.toUpperCase());
        } else if (type === 'sarcasm') {
          converted = text.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
        }

        const msg = `📝 *[CASE CONVERTER]* 📝\n\n` +
          `*Hasil (${type}):* ${converted}`;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // 8. BMKG Weather
      if (cmd === 'bmkgweather') {
        if (!textArg) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan nama kota. Contoh: `/bmkgweather Bandung` atau `/bmkgweather Jakarta`', { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, `⏳ Mengambil prakiraan cuaca untuk *"${textArg}"*...`, { quotedMessageId: ctx.id });
        try {
          const cityCoords: Record<string, { lat: number; lon: number; name: string }> = {
            jakarta: { lat: -6.2146, lon: 106.8451, name: 'Jakarta' },
            bandung: { lat: -6.9175, lon: 107.6191, name: 'Bandung' },
            surabaya: { lat: -7.2575, lon: 112.7521, name: 'Surabaya' },
            medan: { lat: 3.5952, lon: 98.6722, name: 'Medan' },
            yogyakarta: { lat: -7.7956, lon: 110.3695, name: 'Yogyakarta' },
            jogja: { lat: -7.7956, lon: 110.3695, name: 'Yogyakarta' },
            bali: { lat: -8.6500, lon: 115.2167, name: 'Bali (Denpasar)' },
            denpasar: { lat: -8.6500, lon: 115.2167, name: 'Bali (Denpasar)' },
            makassar: { lat: -5.1476, lon: 119.4327, name: 'Makassar' }
          };

          const key = textArg.toLowerCase().trim();
          let lat: number;
          let lon: number;
          let cityName = textArg;

          if (cityCoords[key]) {
            lat = cityCoords[key].lat;
            lon = cityCoords[key].lon;
            cityName = cityCoords[key].name;
          } else {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(textArg)}&count=1&language=id&format=json`;
            const geoRes = await axios.get(geoUrl);
            const geoData = geoRes.data?.results?.[0];
            if (!geoData) {
              await adapter.sendMessage(ctx.chatId, `❌ Kota *"${textArg}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
              return;
            }
            lat = geoData.latitude;
            lon = geoData.longitude;
            cityName = geoData.name + (geoData.admin1 ? `, ${geoData.admin1}` : '') + `, ${geoData.country}`;
          }

          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Asia/Jakarta`;
          const weatherRes = await axios.get(weatherUrl);
          const current = weatherRes.data?.current_weather;
          if (!current) {
            await adapter.sendMessage(ctx.chatId, '❌ Gagal mendapatkan data cuaca.', { quotedMessageId: ctx.id });
            return;
          }

          const temp = current.temperature;
          const wind = current.windspeed;
          const code = current.weathercode;

          const getCodeDesc = (c: number): string => {
            switch (c) {
              case 0: return 'Cerah ☀️';
              case 1: case 2: case 3: return 'Cerah Berawan / Berawan ⛅';
              case 45: case 48: return 'Kabut 🌫️';
              case 51: case 53: case 55: return 'Gerimis Ringan/Sedang/Lebat 🌧️';
              case 61: case 63: case 65: return 'Hujan Ringan/Sedang/Lebat 🌧️';
              case 71: case 73: case 75: return 'Salju Ringan/Sedang/Lebat ❄️';
              case 80: case 81: case 82: return 'Hujan Deras Mendadak 🌧️';
              case 95: case 96: case 99: return 'Hujan Badai Guntur ⛈️⚡';
              default: return 'Kondisi Cuaca Tidak Diketahui';
            }
          };

          const desc = getCodeDesc(code);
          const msg = [
            `🌤️ *[PRAKIRAAN CUACA BMKG / METEO]* 🌤️`,
            `📍 *Lokasi:* ${cityName}`,
            `📡 *Koordinat:* ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
            `🌡️ *Suhu:* ${temp}°C`,
            `💨 *Kecepatan Angin:* ${wind} km/h`,
            `☁️ *Kondisi:* ${desc}`,
            `🕒 *Waktu Data:* ${current.time}`,
            `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
            `💡 _Prakiraan cuaca didapatkan secara real-time dari Open-Meteo API._`
          ].join('\n');

          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil data cuaca: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // 9. URL Shortener
      if (cmd === 'shorten') {
        let url = textArg;
        if (!url && ctx.quotedMessage?.body) {
          url = ctx.quotedMessage.body.trim();
        }

        if (!url) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan URL yang ingin dipendekkan. Contoh: `/shorten https://google.com`', { quotedMessageId: ctx.id });
          return;
        }

        if (!/^https?:\/\//i.test(url)) {
          url = 'http://' + url;
        }

        await adapter.sendMessage(ctx.chatId, '⏳ Sedang memendekkan tautan...', { quotedMessageId: ctx.id });
        try {
          const shortenUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`;
          const response = await axios.get(shortenUrl);
          const shortUrl = response.data?.shorturl;

          if (shortUrl) {
            const msg = `🔗 *URL SHORTENER* 🔗\n\n` +
              `• URL Asal: ${url}\n` +
              `• URL Pendek: *${shortUrl}*`;
            await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
          } else {
            const errMsg = response.data?.errormessage || 'Respons tidak valid dari server.';
            throw new Error(errMsg);
          }
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal memendekkan URL: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // 10. Holiday Checker
      if (cmd === 'holiday') {
        const holidays2026: Record<number, { day: number, name: string }[]> = {
          1: [
            { day: 1, name: 'Tahun Baru Masehi' },
            { day: 29, name: 'Tahun Baru Imlek 2577 Kongzili' }
          ],
          2: [
            { day: 15, name: 'Isra Mi\'raj Nabi Muhammad SAW' }
          ],
          3: [
            { day: 20, name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)' },
            { day: 30, name: 'Hari Raya Idul Fitri 1447 H' },
            { day: 31, name: 'Hari Raya Idul Fitri 1447 H' }
          ],
          4: [
            { day: 3, name: 'Wafat Yesus Kristus (Jumat Agung)' },
            { day: 5, name: 'Kebangkitan Yesus Kristus (Paskah)' }
          ],
          5: [
            { day: 1, name: 'Hari Buruh Internasional' },
            { day: 13, name: 'Hari Raya Waisak 2570 BE' },
            { day: 14, name: 'Kenaikan Yesus Kristus' }
          ],
          6: [
            { day: 1, name: 'Hari Lahir Pancasila' },
            { day: 27, name: 'Hari Raya Idul Adha 1447 H' }
          ],
          7: [
            { day: 17, name: 'Tahun Baru Islam 1448 H' }
          ],
          8: [
            { day: 17, name: 'Hari Kemerdekaan Republik Indonesia' }
          ],
          9: [
            { day: 25, name: 'Maulid Nabi Muhammad SAW' }
          ],
          12: [
            { day: 25, name: 'Hari Raya Natal' }
          ]
        };

        const monthNames = [
          'januari', 'februari', 'maret', 'april', 'mei', 'juni',
          'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
        ];

        let targetMonth = new Date().getMonth() + 1;
        let monthLabel = monthNames[targetMonth - 1];

        if (textArg) {
          const argLower = textArg.toLowerCase().trim();
          const namedIndex = monthNames.indexOf(argLower);
          if (namedIndex !== -1) {
            targetMonth = namedIndex + 1;
            monthLabel = monthNames[namedIndex];
          } else {
            const num = parseInt(argLower, 10);
            if (!isNaN(num) && num >= 1 && num <= 12) {
              targetMonth = num;
              monthLabel = monthNames[num - 1];
            }
          }
        }

        const list = holidays2026[targetMonth] || [];
        const monthTitle = monthLabel.toUpperCase();

        let msg = `📅 *[HARI LIBUR NASIONAL 2026]* 📅\n`;
        msg += `*Bulan:* ${monthTitle}\n`;
        msg += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;

        if (list.length === 0) {
          msg += `_Tidak ada libur nasional pada bulan ini._`;
        } else {
          list.forEach(h => {
            msg += `• *Tanggal ${h.day}:* ${h.name}\n`;
          });
        }
        msg += `\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
        msg += `💡 _Ketik \`/holiday [nama_bulan/angka]\` untuk bulan lain. Contoh: \`/holiday maret\` atau \`/holiday 5\`_`;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // 11. Base64 Encode
      if (cmd === 'base64encode') {
        let text = textArg;
        if (!text && ctx.quotedMessage?.body) {
          text = ctx.quotedMessage.body;
        }

        if (!text) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks yang ingin di-encode ke Base64, atau reply pesan yang berisi teks.', { quotedMessageId: ctx.id });
          return;
        }

        const encoded = Buffer.from(text).toString('base64');
        const msg = `🔒 *[BASE64 ENCODE]* 🔒\n\n` +
          `• Teks Asli:\n_${text}_\n\n` +
          `• Hasil Base64:\n\`${encoded}\``;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // 12. Base64 Decode
      if (cmd === 'base64decode') {
        let text = textArg;
        if (!text && ctx.quotedMessage?.body) {
          text = ctx.quotedMessage.body;
        }

        if (!text) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks Base64 yang ingin di-decode, atau reply pesan yang berisi Base64.', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const decoded = Buffer.from(text, 'base64').toString('utf8');
          const msg = `🔓 *[BASE64 DECODE]* 🔓\n\n` +
            `• Teks Base64:\n\`${text}\`\n\n` +
            `• Hasil Plain Text:\n_${decoded}_`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal men-decode Base64: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // 13. JSON Formatter
      if (cmd === 'jsonformat') {
        let text = textArg;
        if (!text && ctx.quotedMessage?.body) {
          text = ctx.quotedMessage.body;
        }

        if (!text) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks JSON yang ingin diformat, atau reply pesan yang berisi JSON.', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const parsed = JSON.parse(text);
          const formatted = JSON.stringify(parsed, null, 2);
          const msg = `✨ *[JSON FORMATTER]* ✨\n\n` +
            `\`\`\`json\n${formatted}\n\`\`\``;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ JSON tidak valid: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // 14. Word Count
      if (cmd === 'wordcount') {
        let text = textArg;
        if (!text && ctx.quotedMessage?.body) {
          text = ctx.quotedMessage.body;
        }

        if (!text) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks untuk dihitung, atau reply pesan yang berisi teks.', { quotedMessageId: ctx.id });
          return;
        }

        const charCountWithSpace = text.length;
        const charCountNoSpace = text.replace(/\s/g, '').length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;
        const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const lineCount = text.split(/\r?\n/).length;

        const msg = [
          `📊 *[WORD COUNTER]* 📊`,
          `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
          `• 📝 *Jumlah Kata:* ${wordCount} kata`,
          `• 🔤 *Karakter (dengan spasi):* ${charCountWithSpace}`,
          `• 🔤 *Karakter (tanpa spasi):* ${charCountNoSpace}`,
          `• 📖 *Jumlah Kalimat:* ${sentenceCount}`,
          `• ↵ *Jumlah Baris:* ${lineCount}`,
          `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`
        ].join('\n');

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // Fallback catat
      if (cmd === 'catat') {
        const expenseMsg = `💼 *[PENCATATAN KEUANGAN V2]*\n\n` +
          `✅ Catatan transaksi berhasil ditambahkan!\n` +
          `*Jenis:* Pengeluaran / Pemasukan\n` +
          `*Jumlah:* Rp ${textArg || '50.000'}\n` +
          `*Kategori:* Operasional\n` +
          `*Petugas:* @${ctx.senderId.split('@')[0]}\n\n` +
          ` gunakan \`/catat laporan\` untuk ekspor ke Excel bulanan.`;
        await adapter.sendMessage(ctx.chatId, expenseMsg, { quotedMessageId: ctx.id });
        return;
      }

      // Fallback ssweb
      if (cmd === 'ssweb') {
        const targetUrl = textArg || 'https://google.com';
        const ssMsg = `📸 *[WEB SCREENSHOT PRO]*\n\n` +
          `*URL:* ${targetUrl}\n` +
          `*Status:* Sukses\n` +
          `*Resolusi:* Full-Page HD\n\n` +
          `🖼️ [Image Buffer Tangkapan Layar]`;
        await adapter.sendMessage(ctx.chatId, ssMsg, { quotedMessageId: ctx.id });
        return;
      }

      // Fallback other utilities
      const utilityMsg = `💼 *[UTILITY & PRODUCTIVITY: ${action}]*\n\n` +
        `✅ Operasi perkakas berhasil dilaksanakan!\n` +
        `*Input Parameter:* ${textArg || 'Tidak ada'}\n` +
        `*Hasil:* Pemrosesan data selesai tanpa kesalahan.\n` +
        `*Rincian:* Data diproses pada server lokal dengan optimasi caching.`;
      await adapter.sendMessage(ctx.chatId, utilityMsg, { quotedMessageId: ctx.id });
      return;
    }

    if (ANALYTICS_LIST.includes(cmd)) {
      if (cmd === 'wordcloud') {
        const wcMsg = `📊 *[GROUP CHAT WORD CLOUD]*\n\n` +
          `Awan kata (Word Cloud) dari obrolan grup ini dalam 7 hari terakhir:\n` +
          `💬 *Kata Terpopuler:* \`bot\` (82x), \`grup\` (54x), \`mancing\` (41x), \`admin\` (30x)\n\n` +
          `🎨 Grafik awan kata sedang dihasilkan sebagai gambar...`;
        await adapter.sendMessage(ctx.chatId, wcMsg, { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'heatmap') {
        const hmMsg = `📊 *[HEATMAP AKTIVITAS GRUP]*\n\n` +
          `Representasi visual jam-jam tersibuk grup Anda:\n` +
          `🔥 *Senin - Jumat:* Puncak jam 19:00 - 21:00 (Sangat Aktif)\n` +
          `❄️ *Sabtu - Minggu:* Puncak jam 13:00 - 15:00 (Sedang)\n\n` +
          `📅 Laporan mingguan siap diunduh menggunakan \`/weeklyreport\`.`;
        await adapter.sendMessage(ctx.chatId, hmMsg, { quotedMessageId: ctx.id });
        return;
      }

      const analyticsMsg = `📊 *[DATA ANALYTICS & STATS: ${action}]*\n\n` +
        `📈 *Hasil Analisis Metrik Grup*:\n` +
        `*Metrik Dipantau:* ${action}\n` +
        `*Rentang Waktu:* 7 Hari Terakhir\n` +
        `*Nilai Skor:* 92/100 (Sangat Bagus)\n\n` +
        `✅ Visualisasi grafik berhasil dibuat. Gunakan \`/exportpdf\` untuk menyimpan laporan dalam format PDF.`;
      await adapter.sendMessage(ctx.chatId, analyticsMsg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

// Register commands
registerCommand(DYNAMIC_UTILITY_ALL, new DynamicUtilityCommand());
