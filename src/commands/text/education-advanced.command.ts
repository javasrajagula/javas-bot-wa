import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import axios from 'axios';

// Local fallbacks
const kbbiDict: Record<string, string> = {
  programmer: 'n orang yang memprogram atau membuat program komputer.',
  bot: 'n program komputer yang dikembangkan untuk melakukan tugas-tugas otomatis.',
  pintar: 'a pandai; cakap; cerdik; banyak tahu.',
  cinta: 'n rasa sangat suka atau sayang (kepada); kasih sayang.',
  kerja: 'n kegiatan melakukan sesuatu yang menghasilkan sesuatu atau mendapatkan upah.',
  belajar: 'v berusaha memperoleh kepandaian atau ilmu.',
  antigravity: 'n suatu gaya atau kondisi hipotesis yang meniadakan gaya gravitasi.'
};

const popularRecipes: Record<string, { bahan: string[]; langkah: string[] }> = {
  'nasi goreng': {
    bahan: ['2 piring nasi putih dingin', '2 siung bawang putih, cincang', '3 butir bawang merah, cincang', '1 butir telur', '2 sdm kecap manis', '1 sdm saus tiram', 'Garam & merica secukupnya', 'Minyak goreng'],
    langkah: [
      'Panaskan minyak, tumis bawang putih dan bawang merah hingga harum.',
      'Masukkan telur, buat orak-arik.',
      'Masukkan nasi putih, aduk rata.',
      'Tambahkan kecap manis, saus tiram, garam, dan merica. Aduk rata dengan api besar.',
      'Angkat dan sajikan selagi hangat.'
    ]
  },
  'rendang': {
    bahan: ['500g daging sapi, potong-potong', '500ml santan kental', '500ml santan encer', '2 lembar daun kunyit', '2 batang serai, memarkan', 'Bumbu halus: bawang merah, bawang putih, cabai merah, jahe, lengkuas, ketumbar, garam'],
    langkah: [
      'Rebus santan encer bersama bumbu halus, daun kunyit, dan serai hingga mendidih.',
      'Masukkan daging sapi, masak dengan api sedang hingga santan menyusut dan daging empuk.',
      'Tambahkan santan kental, kecilkan api.',
      'Masak terus sambil diaduk perlahan hingga bumbu mengering dan berwarna cokelat gelap/hitam.'
    ]
  },
  'indomie': {
    bahan: ['1 bungkus Indomie Goreng/Rebus', 'Air untuk merebus', '1 butir telur (opsional)', 'Cabai rawit potong (opsional)'],
    langkah: [
      'Rebus mi dalam air mendidih selama 3 menit.',
      'Tuangkan bumbu, minyak bumbu, kecap manis, dan saus cabai ke dalam piring/mangkok.',
      'Tiriskan mi, lalu campurkan dengan bumbu di piring/mangkok, aduk rata.',
      'Sajikan dengan telur mata sapi dan irisan cabai rawit.'
    ]
  }
};

const uniqueFacts = [
  'Jantung paus biru berukuran sebesar mobil compact dan bisa didengar dari jarak 3 kilometer.',
  'Madu murni tidak akan pernah basi atau kedaluwarsa jika disimpan dalam wadah tertutup rapat.',
  'Pisang secara botani tergolong sebagai buah beri, sedangkan stroberi bukan.',
  'Wombat menghasilkan kotoran berbentuk kubus agar tidak menggelinding dari wilayah kekuasaan mereka.',
  'Di angkasa luar, astronot tidak bisa menangis secara normal karena tidak ada gravitasi untuk menarik air mata jatuh.',
  'Negara dengan garis pantai terpanjang di dunia adalah Kanada.',
  'Gurita memiliki tiga jantung dan darah berwarna biru.'
];

const indonesianHolidays: Record<string, string> = {
  '01-01': 'Tahun Baru Masehi',
  '05-01': 'Hari Buruh Internasional',
  '06-01': 'Hari Lahir Pancasila',
  '08-17': 'Hari Kemerdekaan Republik Indonesia',
  '10-28': 'Hari Sumpah Pemuda',
  '11-10': 'Hari Pahlawan',
  '12-25': 'Hari Raya Natal'
};

export class EducationAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /kbbi
    if (cmd === 'kbbi') {
      const word = args[0]?.toLowerCase().trim();
      if (!word) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan kata yang ingin dicari. Contoh: `/kbbi pintar`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🔍 Mencari arti kata "${word}" di KBBI...`, { quotedMessageId: ctx.id });
      try {
        const response = await axios.get(`https://kbbi.vercel.app/api/kbbi?keyword=${encodeURIComponent(word)}`, { timeout: 5000 });
        if (response.data && response.data.lema) {
          const arti = response.data.arti.join('\n- ');
          await adapter.sendMessage(ctx.chatId, `📖 *KBBI: ${word.toUpperCase()}*\n\n- ${arti}`, { quotedMessageId: ctx.id });
          return;
        }
      } catch {
        // Fallback
      }

      const fallbackVal = kbbiDict[word];
      if (fallbackVal) {
        await adapter.sendMessage(ctx.chatId, `📖 *KBBI: ${word.toUpperCase()}* (Kamus Lokal)\n\n${fallbackVal}`, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `⚠️ Definisi untuk kata "${word}" tidak ditemukan di KBBI maupun kamus lokal.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /wikipedia
    if (cmd === 'wikipedia' || cmd === 'wiki') {
      const query = args.join(' ').trim();
      if (!query) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan topik Wikipedia yang dicari. Contoh: `/wikipedia Indonesia`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🔍 Mencari "${query}" di Wikipedia...`, { quotedMessageId: ctx.id });
      try {
        const response = await axios.get(`https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { timeout: 5000 });
        if (response.data && response.data.extract) {
          const title = response.data.title;
          const desc = response.data.extract;
          const link = response.data.content_urls?.desktop?.page || '';
          await adapter.sendMessage(ctx.chatId, `📚 *WIKIPEDIA: ${title}*\n\n${desc}\n\n🔗 Baca selengkapnya: ${link}`, { quotedMessageId: ctx.id });
          return;
        }
      } catch {
        // Fallback
      }

      await adapter.sendMessage(ctx.chatId, `📚 *WIKIPEDIA: ${query}* (Simulasi)\n\n"${query}" adalah sebuah topik informasi umum. Silakan kunjungi id.wikipedia.org untuk membaca artikel lengkap.`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /kalkulator
    if (cmd === 'kalkulator') {
      const expr = args.join(' ').trim();
      if (!expr) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ekspresi matematika. Contoh: `/kalkulator sin(3.14159 / 2) * 10`', { quotedMessageId: ctx.id });
        return;
      }

      // Safe evaluation
      const sanitized = expr
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/log/g, 'Math.log10')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/pi/g, 'Math.PI')
        .replace(/e/g, 'Math.E')
        .replace(/\^/g, '**');

      if (/[^0-9+\-*/%().\sMath.sincostanlog10sqrpPIE**]/i.test(sanitized)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Ekspresi mengandung karakter tidak aman!', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const result = new Function(`return (${sanitized});`)();
        await adapter.sendMessage(ctx.chatId, `🧮 *HASIL KALKULATOR* 🧮\n\n*Ekspresi:* ${expr}\n*Hasil:* *${result}*`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Kesalahan evaluasi: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 4. /konversi
    if (cmd === 'konversi') {
      // Format: /konversi 100 kg ke lbs
      const valStr = args[0];
      const fromUnit = args[1]?.toLowerCase();
      const toUnit = args[3]?.toLowerCase(); // args[2] is 'ke' or 'to'

      if (!valStr || !fromUnit || !toUnit || isNaN(Number(valStr))) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/konversi 100 kg ke lbs` atau `/konversi 5 km ke m`', { quotedMessageId: ctx.id });
        return;
      }

      const val = Number(valStr);
      let result: number | null = null;

      // Weight conversions
      if (fromUnit === 'kg' && toUnit === 'lbs') result = val * 2.20462;
      else if (fromUnit === 'lbs' && toUnit === 'kg') result = val / 2.20462;
      else if (fromUnit === 'g' && toUnit === 'kg') result = val / 1000;
      else if (fromUnit === 'kg' && toUnit === 'g') result = val * 1000;
      // Length conversions
      else if (fromUnit === 'km' && toUnit === 'm') result = val * 1000;
      else if (fromUnit === 'm' && toUnit === 'km') result = val / 1000;
      else if (fromUnit === 'm' && toUnit === 'cm') result = val * 10000;
      else if (fromUnit === 'cm' && toUnit === 'm') result = val / 100;
      // Temperature
      else if (fromUnit === 'c' && toUnit === 'f') result = (val * 9) / 5 + 32;
      else if (fromUnit === 'f' && toUnit === 'c') result = ((val - 32) * 5) / 9;

      if (result === null) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Konversi dari "${fromUnit}" ke "${toUnit}" belum didukung.`, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `🔄 *KONVERSI SATUAN* 🔄\n\n*Input:* ${val} ${fromUnit.toUpperCase()}\n*Hasil:* *${result.toFixed(2)} ${toUnit.toUpperCase()}*`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /sholat
    if (cmd === 'sholat') {
      const city = args.join(' ').trim() || 'Jakarta';
      await adapter.sendMessage(ctx.chatId, `🕌 Mengambil jadwal sholat untuk ${city}...`, { quotedMessageId: ctx.id });
      try {
        const response = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Indonesia`, { timeout: 5000 });
        if (response.data && response.data.data) {
          const timings = response.data.data.timings;
          let msg = `🕌 *JADWAL SHOLAT: ${city.toUpperCase()}* 🕌\n\n`;
          msg += `• Subuh: ${timings.Fajr}\n`;
          msg += `• Dzuhur: ${timings.Dhuhr}\n`;
          msg += `• Ashar: ${timings.Asr}\n`;
          msg += `• Maghrib: ${timings.Maghrib}\n`;
          msg += `• Isya: ${timings.Isha}\n`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
          return;
        }
      } catch {
        // Fallback
      }

      // Hardcoded fallback for major cities
      let msg = `🕌 *JADWAL SHOLAT: ${city.toUpperCase()}* (Estimasi WIB) 🕌\n\n`;
      msg += `• Subuh: 04:45\n`;
      msg += `• Dzuhur: 12:00\n`;
      msg += `• Ashar: 15:20\n`;
      msg += `• Maghrib: 18:00\n`;
      msg += `• Isya: 19:15\n`;
      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /kurs
    if (cmd === 'kurs') {
      const target = args[0]?.toUpperCase() || 'USD';
      await adapter.sendMessage(ctx.chatId, `📈 Mengambil kurs mata uang ${target}...`, { quotedMessageId: ctx.id });
      try {
        const response = await axios.get(`https://open.er-api.com/v6/latest/USD`, { timeout: 5000 });
        if (response.data && response.data.rates) {
          const rates = response.data.rates;
          const idrRate = rates.IDR;
          const targetRate = rates[target];
          if (targetRate) {
            const finalRate = idrRate / targetRate;
            await adapter.sendMessage(ctx.chatId, `💰 *KURS MATA UANG* 💰\n\n*1 ${target}* = *${finalRate.toLocaleString('id-ID', { maximumFractionDigits: 2 })} IDR*`, { quotedMessageId: ctx.id });
            return;
          }
        }
      } catch {
        // Fallback
      }

      const fallbacks: Record<string, number> = { USD: 16350, EUR: 17500, SGD: 12050, JPY: 105 };
      const val = fallbacks[target] || 16000;
      await adapter.sendMessage(ctx.chatId, `💰 *KURS MATA UANG* (Estimasi Lokal) 💰\n\n*1 ${target}* = *${val.toLocaleString('id-ID')} IDR*`, { quotedMessageId: ctx.id });
      return;
    }

    // 7. /cuaca
    if (cmd === 'cuaca') {
      const city = args.join(' ').trim() || 'Jakarta';
      await adapter.sendMessage(ctx.chatId, `⛅ Mengambil kondisi cuaca untuk ${city}...`, { quotedMessageId: ctx.id });
      try {
        const response = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=3`, { timeout: 5000 });
        if (response.data && typeof response.data === 'string') {
          await adapter.sendMessage(ctx.chatId, `⛅ *INFO CUACA: ${city.toUpperCase()}* ⛅\n\n${response.data.trim()}`, { quotedMessageId: ctx.id });
          return;
        }
      } catch {
        // Fallback
      }

      await adapter.sendMessage(ctx.chatId, `⛅ *INFO CUACA: ${city.toUpperCase()}* (Simulasi) ⛅\n\nSuhu: 30°C\nKelembaban: 80%\nKondisi: Berawan sebagian`, { quotedMessageId: ctx.id });
      return;
    }

    // 8. /resep
    if (cmd === 'resep') {
      const menu = args.join(' ').toLowerCase().trim();
      if (!menu) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan menu masakan yang dicari. Contoh: `/resep nasi goreng`', { quotedMessageId: ctx.id });
        return;
      }

      const recipe = popularRecipes[menu];
      if (recipe) {
        let msg = `🍳 *RESEP MASAKAN: ${menu.toUpperCase()}* 🍳\n\n*Bahan-bahan:*\n`;
        recipe.bahan.forEach(b => { msg += `- ${b}\n`; });
        msg += `\n*Langkah pembuatan:*\n`;
        recipe.langkah.forEach((l, i) => { msg += `${i + 1}. ${l}\n`; });
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `⚠️ Resep untuk "${menu}" tidak ditemukan di database. Coba menu populer lain seperti \`nasi goreng\` atau \`rendang\`.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 9. /fakta
    if (cmd === 'fakta') {
      const fact = uniqueFacts[Math.floor(Math.random() * uniqueFacts.length)];
      await adapter.sendMessage(ctx.chatId, `💡 *FAKTA UNIK HARI INI* 💡\n\n${fact}`, { quotedMessageId: ctx.id });
      return;
    }

    // 10. /hari
    if (cmd === 'hari') {
      let dateKey = args[0]; // Format: DD-MM
      if (!dateKey) {
        const today = new Date();
        const d = String(today.getDate()).padStart(2, '0');
        const m = String(today.getMonth() + 1).padStart(2, '0');
        dateKey = `${d}-${m}`;
      }

      const holiday = indonesianHolidays[dateKey];
      if (holiday) {
        await adapter.sendMessage(ctx.chatId, `🗓️ *KALENDER INDONESIA (${dateKey})* 🗓️\n\nAda peringatan: *${holiday}*`, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `🗓️ *KALENDER INDONESIA (${dateKey})* 🗓️\n\nTidak ada peringatan besar nasional terdaftar untuk tanggal ini.`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const eduAdvancedCmd = new EducationAdvancedCommand();
registerCommand(
  ['kbbi', 'wikipedia', 'wiki', 'kalkulator', 'konversi', 'sholat', 'kurs', 'cuaca', 'resep', 'fakta', 'hari'],
  eduAdvancedCmd
);
