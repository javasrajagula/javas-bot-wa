import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { PDFDocument, PageSizes } from 'pdf-lib';
import JSZip from 'jszip';
import sharp from 'sharp';
import { getTempPath, safeDelete } from '../../utils/file.util.js';

const EXECUTABLE_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.ps1', '.vbs', '.js', '.msi', '.jar'
]);

export async function imageToPdf(imageBuffer: Buffer): Promise<Buffer> {
  const normalized = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer();
  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(normalized);
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height
  });
  return Buffer.from(await pdf.save());
}

export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const output = await PDFDocument.create();
  for (const buffer of buffers) {
    const input = await PDFDocument.load(buffer);
    const pages = await output.copyPages(input, input.getPageIndices());
    pages.forEach(page => output.addPage(page));
  }
  return Buffer.from(await output.save());
}

export async function compressPdfBuffer(buffer: Buffer): Promise<Buffer> {
  const input = await PDFDocument.load(buffer);
  const output = await PDFDocument.create();
  const pages = await output.copyPages(input, input.getPageIndices());
  pages.forEach(page => output.addPage(page));
  return Buffer.from(await output.save({ useObjectStreams: true }));
}

export async function renderPdfPage(buffer: Buffer, pageNumber: number): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer);
  const totalPages = doc.getPageCount();
  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new Error(`Halaman ${pageNumber} di luar jangkauan (Total halaman: ${totalPages}).`);
  }

  const input = getTempPath('pdf');
  const outputBase = getTempPath('pdf-page');
  const outputPng = `${outputBase}.png`;
  await fs.promises.writeFile(input, buffer);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('pdftoppm', ['-png', '-f', String(pageNumber), '-l', String(pageNumber), '-singlefile', input, outputBase], {
        windowsHide: true
      });
      let stderr = '';
      proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
      proc.on('error', () => reject(new Error('Poppler belum tersedia. Install Poppler dan pastikan `pdftoppm` ada di PATH untuk memakai /pdf2img.')));
      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `pdftoppm gagal dengan exit code ${code}.`));
          return;
        }
        resolve();
      });
    });
    return await fs.promises.readFile(outputPng);
  } finally {
    safeDelete(input);
    safeDelete(outputPng);
  }
}

export async function renderPdfFirstPage(buffer: Buffer): Promise<Buffer> {
  return renderPdfPage(buffer, 1);
}

export async function extractTextFromPdfWithPoppler(buffer: Buffer): Promise<string> {
  const input = getTempPath('pdf');
  const outputTxt = getTempPath('txt');
  await fs.promises.writeFile(input, buffer);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('pdftotext', [input, outputTxt], {
        windowsHide: true
      });
      let stderr = '';
      proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
      proc.on('error', () => reject(new Error('Poppler belum tersedia. Install Poppler dan pastikan `pdftotext` ada di PATH untuk memakai /pdftext.')));
      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `pdftotext gagal dengan exit code ${code}.`));
          return;
        }
        resolve();
      });
    });
    if (!fs.existsSync(outputTxt)) {
      return '';
    }
    const text = await fs.promises.readFile(outputTxt, 'utf-8');
    return text.trim();
  } finally {
    safeDelete(input);
    safeDelete(outputTxt);
  }
}

export async function buildScanImage(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .greyscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

export interface ZipEntryInfo {
  name: string;
  size: number;
  safe: boolean;
  reason?: string;
}

export async function inspectZip(buffer: Buffer): Promise<ZipEntryInfo[]> {
  const zip = await JSZip.loadAsync(buffer);
  return Object.values(zip.files).map(file => validateZipEntry((file as any).unsafeOriginalName || file.name, file.dir ? 0 : (file as any)._data?.uncompressedSize || 0));
}

export async function extractSafeZipFile(buffer: Buffer, targetName: string): Promise<{ name: string; buffer: Buffer }> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(targetName);
  if (!file) {
    throw new Error('File tidak ditemukan di dalam ZIP.');
  }

  const validation = validateZipEntry((file as any).unsafeOriginalName || file.name, (file as any)._data?.uncompressedSize || 0);
  if (!validation.safe) {
    throw new Error(validation.reason || 'File tidak aman untuk diekstrak.');
  }

  const extracted = await file.async('nodebuffer');
  return { name: path.basename(file.name), buffer: extracted };
}

function validateZipEntry(name: string, size: number): ZipEntryInfo {
  const normalized = name.replace(/\\/g, '/');
  if (normalized.includes('../') || path.isAbsolute(normalized)) {
    return { name, size, safe: false, reason: 'Path traversal ditolak' };
  }

  const ext = path.extname(normalized).toLowerCase();
  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    return { name, size, safe: false, reason: 'Executable ditolak' };
  }

  if (size > 25 * 1024 * 1024) {
    return { name, size, safe: false, reason: 'File terlalu besar' };
  }

  return { name, size, safe: true };
}

export async function writeTempFile(filePath: string, buffer: Buffer) {
  await fs.promises.writeFile(filePath, buffer);
}

export { PageSizes };
