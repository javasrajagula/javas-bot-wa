import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import { isPremium } from '../../bot/permission.js';
import { isSafePublicUrl } from '../../validators/url.validator.js';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { stateStore } from '../../services/state/state-store.js';
import JSZip from 'jszip';
import { safeDelete, getTempPath } from '../../utils/file.util.js';
import {
  buildScanImage,
  compressPdfBuffer,
  extractSafeZipFile,
  imageToPdf,
  inspectZip,
  mergePdfBuffers,
  renderPdfPage,
  extractTextFromPdfWithPoppler
} from '../../services/document/document-tools.service.js';

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
  const font = await doc.embedFont(StandardFonts.Helvetica);
  
  const pageWidth = 595.276; // A4 width
  const pageHeight = 841.890; // A4 height
  const margin = 50;
  const fontSize = 11;
  const lineSpacing = 15;
  const maxLineWidth = pageWidth - 2 * margin;
  
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const wrapText = (lineText: string): string[] => {
    const words = lineText.split(' ');
    const wrapped: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxLineWidth) {
        wrapped.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      wrapped.push(currentLine);
    }
    return wrapped.length > 0 ? wrapped : [''];
  };

  const rawLines = text.split('\n');
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    lines.push(...wrapText(rawLine));
  }
  
  const pageLimit = 100;
  
  for (const line of lines) {
    if (y < margin + fontSize) {
      if (doc.getPageCount() >= pageLimit) {
        break;
      }
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font: font
    });
    y -= lineSpacing;
  }
  
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

    // --- 6. /mergepdf ---
    if (cmd === 'mergepdf') {
      const encGroupId = Buffer.from(ctx.chatId).toString('base64url');
      const encSenderId = Buffer.from(ctx.senderId).toString('base64url');
      const sessionKey = `mergepdf:session:${encGroupId}:${encSenderId}`;
      const session = await stateStore.get<{ files: string[] }>(sessionKey);

      const subCommand = args[0]?.toLowerCase();

      if (subCommand === 'start') {
        if (session) {
          for (const file of session.files) {
            safeDelete(file);
          }
        }
        await stateStore.set(sessionKey, { files: [] }, 900);
        await adapter.sendMessage(ctx.chatId, '🎬 *Sesi Penggabungan PDF Dimulai* 🎬\n\nSilakan kirim/reply dokumen PDF satu per satu dengan mengetik `/mergepdf` untuk menambahkannya.\n\nKetik `/mergepdf done` jika sudah selesai, atau `/mergepdf cancel` untuk membatalkan.', { quotedMessageId: ctx.id });
        return;
      }

      if (subCommand === 'cancel') {
        if (session) {
          for (const file of session.files) {
            safeDelete(file);
          }
          await stateStore.delete(sessionKey);
          await adapter.sendMessage(ctx.chatId, '❌ Sesi penggabungan PDF dibatalkan dan file sementara dihapus.', { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi penggabungan PDF yang sedang aktif.', { quotedMessageId: ctx.id });
        }
        return;
      }

      if (subCommand === 'done') {
        if (!session || session.files.length < 2) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Sesi tidak aktif atau Anda harus menambahkan minimal 2 file PDF sebelum menggabungkannya.', { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, `⏳ Menggabungkan ${session.files.length} file PDF...`, { quotedMessageId: ctx.id });
        try {
          const buffers = [];
          for (const filePath of session.files) {
            if (fs.existsSync(filePath)) {
              buffers.push(await fs.promises.readFile(filePath));
            }
          }
          
          if (buffers.length < 2) {
            throw new Error('Beberapa file sementara hilang.');
          }

          const merged = await mergePdfBuffers(buffers);
          await adapter.sendDocument(ctx.chatId, merged, 'merged.pdf', 'application/pdf', { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal menggabungkan PDF: ${err.message}`, { quotedMessageId: ctx.id });
        } finally {
          for (const file of session.files) {
            safeDelete(file);
          }
          await stateStore.delete(sessionKey);
        }
        return;
      }

      // Default or legacy direct merge behavior
      const media = ctx.media || ctx.quotedMessage?.media;
      if (session) {
        if (!media || !media.mimeType.includes('pdf')) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Reply atau sertakan dokumen PDF yang ingin ditambahkan ke sesi merge.', { quotedMessageId: ctx.id });
          return;
        }
        const buffer = await media.getBuffer();
        const tempPath = getTempPath('pdf');
        await fs.promises.writeFile(tempPath, buffer);
        session.files.push(tempPath);
        await stateStore.set(sessionKey, session, 900);
        await adapter.sendMessage(ctx.chatId, `📥 PDF berhasil ditambahkan ke sesi. Total: *${session.files.length}* file.\n\nKetik:\n• \`/mergepdf\` (pada file lain) untuk menambah lagi\n• \`/mergepdf done\` untuk menyelesaikan\n• \`/mergepdf cancel\` untuk membatalkan`, { quotedMessageId: ctx.id });
        return;
      }

      const quoted = ctx.quotedMessage?.media;
      if (!media || !media.mimeType.includes('pdf') || !quoted || !quoted.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Gunakan `/mergepdf start` untuk memulai sesi penggabungan multi-file,\natau reply satu PDF sambil mengirim PDF lain dengan caption `/mergepdf` untuk cara cepat.', { quotedMessageId: ctx.id });
        return;
      }

      const buffer = await media.getBuffer();
      const merged = await mergePdfBuffers([await quoted.getBuffer(), buffer]);
      await adapter.sendDocument(ctx.chatId, merged, 'merged.pdf', 'application/pdf', { quotedMessageId: ctx.id });
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

      let pageNum = 1;
      if (args[0]) {
        pageNum = parseInt(args[0], 10);
        if (isNaN(pageNum) || pageNum < 1) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Halaman harus berupa angka positif mulai dari 1.', { quotedMessageId: ctx.id });
          return;
        }
      }

      try {
        const png = await renderPdfPage(buffer, pageNum);
        await adapter.sendImage(ctx.chatId, png, `Halaman ${pageNum} hasil konversi PDF.`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengonversi PDF: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 7. /compresspdf ---
    if (cmd === 'compresspdf') {
      if (!media.mimeType.includes('pdf')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ `/compresspdf` membutuhkan file PDF.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Mengoptimalkan file PDF (Optimize PDF)...', { quotedMessageId: ctx.id });
      try {
        const compressed = await compressPdfBuffer(buffer);
        const originalSize = buffer.length;
        const optimizedSize = compressed.length;
        const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(0);

        let msg = `✅ Berhasil mengoptimalkan PDF (Optimize PDF).\n`;
        msg += `• Ukuran Awal: *${Math.ceil(originalSize / 1024)} KB*\n`;
        msg += `• Ukuran Baru: *${Math.ceil(optimizedSize / 1024)} KB*\n`;
        msg += `• Penghematan: *${savings}%*`;

        await adapter.sendDocument(ctx.chatId, compressed, 'optimized.pdf', 'application/pdf', { quotedMessageId: ctx.id });
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengoptimalkan PDF: ${err.message}`, { quotedMessageId: ctx.id });
      }
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

      // Check ZIP Bomb guardrails
      try {
        const zip = await JSZip.loadAsync(buffer);
        const entries = Object.values(zip.files);
        
        if (entries.length > 500) {
          throw new Error('File ZIP ditolak karena berisi terlalu banyak file (maksimal 500 file).');
        }

        let totalUncompressedSize = 0;
        for (const entry of entries) {
          const depth = entry.name.split('/').filter(Boolean).length;
          if (depth > 5) {
            throw new Error('File ZIP ditolak karena struktur direktori terlalu dalam (maksimal 5 tingkat).');
          }
          
          if (!entry.dir) {
            const size = (entry as any)._data?.uncompressedSize || 0;
            totalUncompressedSize += size;
          }
        }

        if (totalUncompressedSize > 100 * 1024 * 1024) {
          throw new Error('File ZIP ditolak karena total ukuran setelah diekstrak melebihi batas 100MB.');
        }

        if (totalUncompressedSize > 5 * 1024 * 1024) {
          const ratio = buffer.length / totalUncompressedSize;
          if (ratio < 0.01) {
            throw new Error('File ZIP ditolak karena rasio kompresi mencurigakan (kemungkinan ZIP Bomb).');
          }
        }

      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ ZIP ditolak: ${err.message}`, { quotedMessageId: ctx.id });
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

      try {
        const text = await extractTextFromPdfWithPoppler(buffer);
        if (!text || text.trim().length === 0) {
          await adapter.sendMessage(ctx.chatId, '📝 *HASIL EKSTRAKSI TEKS PDF*\n\n⚠️ OCR diperlukan (tidak ada teks terbaca pada file PDF ini).', { quotedMessageId: ctx.id });
        } else if (text.length > 500) {
          await adapter.sendDocument(ctx.chatId, Buffer.from(text, 'utf-8'), 'extracted-text.txt', 'text/plain', { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `📝 *HASIL EKSTRAKSI TEKS PDF*\n\n${text}`, { quotedMessageId: ctx.id });
        }
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengekstrak teks PDF: ${err.message}`, { quotedMessageId: ctx.id });
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
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/pdfsplit 1-3` or `/pdfsplit 2`', { quotedMessageId: ctx.id });
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
      if (watermarkText.length > 30) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Teks watermark terlalu panjang (maksimal 30 karakter).', { quotedMessageId: ctx.id });
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
