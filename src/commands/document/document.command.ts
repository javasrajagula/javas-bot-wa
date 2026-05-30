import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import axios from 'axios';
import crypto from 'crypto';
import { isPremium } from '../../bot/permission.js';
import { isSafePublicUrl } from '../../validators/url.validator.js';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import {
  buildScanImage,
  compressPdfBuffer,
  extractSafeZipFile,
  imageToPdf,
  inspectZip,
  mergePdfBuffers,
  renderPdfFirstPage
} from '../../services/document/document-tools.service.js';

// Pure JS PDF Text Extractor
function extractTextFromPdfBuffer(pdfBuffer: Buffer): string {
  try {
    const pdfString = pdfBuffer.toString('binary');
    const textMatches = pdfString.match(/\(([^)]+)\)\s*Tj/g) || [];
    const tjMatches = pdfString.match(/\[([^\]]+)\]\s*TJ/g) || [];
    
    let text = '';
    textMatches.forEach(m => {
      const match = m.match(/\(([^)]+)\)/);
      if (match && match[1]) text += match[1] + ' ';
    });
    
    tjMatches.forEach(m => {
      const strings = m.match(/\(([^)]+)\)/g) || [];
      strings.forEach(s => {
        const match = s.match(/\(([^)]+)\)/);
        if (match && match[1]) text += match[1];
      });
      text += ' ';
    });

    // Replace octal escapes
    return text.replace(/\\([\d]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8))).trim();
  } catch (err) {
    return 'Gagal mengekstrak teks: ' + (err as Error).message;
  }
}

async function splitPdfBuffer(pdfBuffer: Buffer, range: string): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const destDoc = await PDFDocument.create();
  
  const pageCount = srcDoc.getPageCount();
  const pagesToKeep: number[] = [];
  
  if (range.includes('-')) {
    const [start, end] = range.split('-').map(p => parseInt(p, 10));
    for (let i = start; i <= end; i++) {
      if (i >= 1 && i <= pageCount) {
        pagesToKeep.push(i - 1);
      }
    }
  } else {
    const pageNum = parseInt(range, 10);
    if (pageNum >= 1 && pageNum <= pageCount) {
      pagesToKeep.push(pageNum - 1);
    }
  }

  if (pagesToKeep.length === 0) {
    throw new Error(`Range halaman tidak valid (Total halaman: ${pageCount}).`);
  }

  const copiedPages = await destDoc.copyPages(srcDoc, pagesToKeep);
  copiedPages.forEach(page => destDoc.addPage(page));
  
  const bytes = await destDoc.save();
  return Buffer.from(bytes);
}

async function watermarkPdfBuffer(pdfBuffer: Buffer, watermarkText: string): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  
  pages.forEach(page => {
    const { width, height } = page.getSize();
    page.drawText(watermarkText, {
      x: width / 5,
      y: height / 2,
      size: 32,
      font: font,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.35,
      rotate: degrees(45)
    });
  });
  
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function txtToPdf(text: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.276, 841.890]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  
  const { height } = page.getSize();
  const margin = 50;
  let y = height - margin;
  const lines = text.split('\n');
  
  lines.forEach(line => {
    if (y < margin) {
      // Just cutoff for simple rendering
      return;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: 11,
      font: font
    });
    y -= 15;
  });
  
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export class DocumentSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // --- 1. /ssweb ---
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

    // --- 2. /qr ---
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



    // Load media buffer for rest of commands
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

    // --- 4. /img2pdf ---
    if (cmd === 'img2pdf') {
      if (media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/img2pdf` membutuhkan gambar.', { quotedMessageId: ctx.id });
        return;
      }

      const pdfBuffer = await imageToPdf(buffer);
      await adapter.sendDocument(ctx.chatId, pdfBuffer, 'image.pdf', 'application/pdf', { quotedMessageId: ctx.id });
      return;
    }

    // --- 5. /pdf2img ---
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

    // --- 6. /mergepdf ---
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

    // --- 7. /compresspdf ---
    if (cmd === 'compresspdf') {
      if (!media.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/compresspdf` membutuhkan file PDF.', { quotedMessageId: ctx.id });
        return;
      }

      const compressed = await compressPdfBuffer(buffer);
      await adapter.sendDocument(ctx.chatId, compressed, 'compressed.pdf', 'application/pdf', { quotedMessageId: ctx.id });
      return;
    }

    // --- 8. /scan & /scanfile ---
    if (cmd === 'scan' || cmd === 'scanfile') {
      if (media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/scan` membutuhkan gambar dokumen.', { quotedMessageId: ctx.id });
        return;
      }

      const scanned = await buildScanImage(buffer);
      await adapter.sendImage(ctx.chatId, scanned, 'Dokumen berhasil dipindai.', { quotedMessageId: ctx.id });
      return;
    }

    // --- 9. /unzip & /ziplist ---
    if (cmd === 'unzip' || cmd === 'ziplist') {
      if (!media.mimeType.includes('zip') && !media.mimeType.includes('compressed')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini mendukung file ZIP.', { quotedMessageId: ctx.id });
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
      return;
    }

    // --- 10. /pdftext ---
    if (cmd === 'pdftext') {
      if (!media.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/pdftext` membutuhkan file PDF.', { quotedMessageId: ctx.id });
        return;
      }

      const text = extractTextFromPdfBuffer(buffer);
      if (text.length > 500) {
        await adapter.sendDocument(ctx.chatId, Buffer.from(text, 'utf-8'), 'extracted-text.txt', 'text/plain', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `📝 *HASIL EKSTRAKSI TEKS PDF*\n\n${text || 'Tidak ada teks terdeteksi.'}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 11. /pdfsplit <range> ---
    if (cmd === 'pdfsplit') {
      if (!media.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/pdfsplit` membutuhkan file PDF.', { quotedMessageId: ctx.id });
        return;
      }

      const range = args[0]?.trim();
      if (!range) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/pdfsplit 1-3` atau `/pdfsplit 2`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const split = await splitPdfBuffer(buffer, range);
        await adapter.sendDocument(ctx.chatId, split, `split-${range}.pdf`, 'application/pdf', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memotong PDF: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 12. /pdfwatermark <text> ---
    if (cmd === 'pdfwatermark') {
      if (!media.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/pdfwatermark` membutuhkan file PDF.', { quotedMessageId: ctx.id });
        return;
      }

      const watermarkText = args.join(' ').trim();
      if (!watermarkText) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks watermark. Contoh: `/pdfwatermark CONFIDENTIAL`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const watermarked = await watermarkPdfBuffer(buffer, watermarkText);
        await adapter.sendDocument(ctx.chatId, watermarked, 'watermarked.pdf', 'application/pdf', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memberi watermark: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 13. /txt2pdf ---
    if (cmd === 'txt2pdf') {
      if (!media.mimeType.includes('text') && !media.mimeType.includes('plain')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/txt2pdf` membutuhkan file teks (.txt).', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const textStr = buffer.toString('utf-8');
        const pdf = await txtToPdf(textStr);
        await adapter.sendDocument(ctx.chatId, pdf, 'converted.pdf', 'application/pdf', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal konversi ke PDF: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 14. /fileinfo ---
    if (cmd === 'fileinfo') {
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const sizeKb = Math.ceil(buffer.length / 1024);
      
      let msg = `📄 *INFORMASI FILE* 📄\n\n`;
      msg += `• Mime Type: *${media.mimeType}*\n`;
      msg += `• Ukuran: *${sizeKb} KB* (${(buffer.length / 1024 / 1024).toFixed(2)} MB)\n`;
      msg += `• SHA-256 Hash: \`${hash}\``;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const docSuite = new DocumentSuiteCommand();
registerCommand(
  ['ssweb', 'qr', 'img2pdf', 'pdf2img', 'mergepdf', 'compresspdf', 'scan', 'unzip', 'pdftext', 'pdfsplit', 'pdfwatermark', 'txt2pdf', 'ziplist', 'fileinfo', 'scanfile'],
  docSuite
);
