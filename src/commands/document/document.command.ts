import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import axios from 'axios';
import { isPremium } from '../../bot/permission.js';
import { isSafePublicUrl } from '../../validators/url.validator.js';
import {
  buildScanImage,
  compressPdfBuffer,
  extractSafeZipFile,
  imageToPdf,
  inspectZip,
  mergePdfBuffers,
  renderPdfFirstPage
} from '../../services/document/document-tools.service.js';

export class DocumentSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    if (cmd === 'ssweb') {
      let url = args[0]?.trim();
      if (!url) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/ssweb https://example.com`', { quotedMessageId: ctx.id });
        return;
      }

      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (!isSafePublicUrl(url)) {
        await adapter.sendMessage(ctx.chatId, '❌ URL tidak aman atau tidak diizinkan.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Mengambil screenshot website *${url}*...`, { quotedMessageId: ctx.id });
      try {
        const targetUrl = `https://image.thum.io/get/width/1280/crop/800/${url}`;
        const response = await axios.get(targetUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        await adapter.sendImage(ctx.chatId, Buffer.from(response.data), `📸 Screenshot: ${url}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil screenshot: ${err.message || 'Terjadi kesalahan.'}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'qr') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/qr Halo Dunia`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
        const response = await axios.get(qrApiUrl, { responseType: 'arraybuffer', timeout: 10000 });
        await adapter.sendImage(ctx.chatId, Buffer.from(response.data), `📱 QR Code: "${text}"`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat QR Code: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'readqr') {
      const media = ctx.media || ctx.quotedMessage?.media;
      if (!media || media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply gambar QR Code terlebih dahulu.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Membaca QR Code...', { quotedMessageId: ctx.id });
      try {
        const imageBuffer = await media.getBuffer();
        const boundary = '----JavasBoundary' + Math.random().toString(36).slice(2);
        const payload = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qr.png"\r\nContent-Type: image/png\r\n\r\n`),
          imageBuffer,
          Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);
        const response = await axios.post('https://api.qrserver.com/v1/read-qr-code/', payload, {
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          timeout: 15000
        });

        const result = response.data?.[0]?.symbol?.[0];
        await adapter.sendMessage(
          ctx.chatId,
          result?.data ? `✅ *QR Code Berhasil Dibaca!*\n\n📝 *Hasil:* ${result.data}` : '⚠️ QR Code tidak terdeteksi.',
          { quotedMessageId: ctx.id }
        );
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membaca QR Code: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    const media = ctx.media || ctx.quotedMessage?.media;
    if (!media) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kirim atau reply gambar/dokumen terlebih dahulu.', { quotedMessageId: ctx.id });
      return;
    }

    const buffer = await media.getBuffer();
    const isPrem = await isPremium(ctx.senderId);
    const limit = isPrem ? 30 * 1024 * 1024 : 8 * 1024 * 1024;
    if (buffer.length > limit) {
      await adapter.sendMessage(ctx.chatId, `⚠️ File melebihi batas ${Math.round(limit / 1024 / 1024)} MB.`, { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'img2pdf') {
      if (media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/img2pdf` membutuhkan gambar.', { quotedMessageId: ctx.id });
        return;
      }

      const pdfBuffer = await imageToPdf(buffer);
      await adapter.sendDocument(ctx.chatId, pdfBuffer, 'image.pdf', 'application/pdf', { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'pdf2img') {
      if (!media.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/pdf2img` membutuhkan file PDF.', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const png = await renderPdfFirstPage(buffer);
        await adapter.sendImage(ctx.chatId, png, 'Halaman 1 hasil konversi PDF.', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengonversi PDF: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'mergepdf') {
      const quoted = ctx.quotedMessage?.media;
      if (!media.mimeType.includes('pdf') || !quoted || !quoted.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply satu PDF sambil mengirim PDF lain dengan caption `/mergepdf` agar dua PDF bisa digabung.', { quotedMessageId: ctx.id });
        return;
      }

      const merged = await mergePdfBuffers([await quoted.getBuffer(), buffer]);
      await adapter.sendDocument(ctx.chatId, merged, 'merged.pdf', 'application/pdf', { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'compresspdf') {
      if (!media.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/compresspdf` membutuhkan file PDF.', { quotedMessageId: ctx.id });
        return;
      }

      const compressed = await compressPdfBuffer(buffer);
      await adapter.sendDocument(ctx.chatId, compressed, 'compressed.pdf', 'application/pdf', { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'scan') {
      if (media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/scan` membutuhkan gambar dokumen.', { quotedMessageId: ctx.id });
        return;
      }

      const scanned = await buildScanImage(buffer);
      await adapter.sendImage(ctx.chatId, scanned, 'Dokumen berhasil dipindai.', { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'unzip') {
      if (!media.mimeType.includes('zip') && !media.mimeType.includes('compressed')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/unzip` saat ini mendukung file ZIP.', { quotedMessageId: ctx.id });
        return;
      }

      const subCommand = args[0]?.toLowerCase();
      if (subCommand === 'extract') {
        const fileToExtract = args.slice(1).join(' ').trim();
        if (!fileToExtract) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan `/unzip extract <nama_file>`.', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const extracted = await extractSafeZipFile(buffer, fileToExtract);
          await adapter.sendDocument(ctx.chatId, extracted.buffer, extracted.name, 'application/octet-stream', { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal extract ZIP: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      const entries = await inspectZip(buffer);
      const list = entries.slice(0, 30).map((entry, index) => {
        const status = entry.safe ? 'AMAN' : `DITOLAK: ${entry.reason}`;
        return `${index + 1}. ${entry.name} (${Math.ceil(entry.size / 1024)} KB) - ${status}`;
      }).join('\n');
      await adapter.sendMessage(ctx.chatId, `📦 *DAFTAR FILE ZIP*\n\n${list || 'ZIP kosong.'}\n\nExtract file aman dengan: \`/unzip extract <nama_file>\``, { quotedMessageId: ctx.id });
    }
  }
}

const docSuite = new DocumentSuiteCommand();
registerCommand(
  ['ssweb', 'qr', 'readqr', 'img2pdf', 'pdf2img', 'mergepdf', 'compresspdf', 'scan', 'unzip'],
  docSuite
);
