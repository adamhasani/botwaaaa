/* ╔══════════════════════════════════════════════════════╗
   ║  FILE READER DISPATCHER                                  ║
   ║  Satu pintu masuk: kasih buffer + nama file, dia yang     ║
   ║  nentuin dibaca pakai reader mana (PDF/DOCX/XLSX/gambar). ║
   ╚══════════════════════════════════════════════════════╝ */
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { extractPdfText } from './pdfReader.js';
import { extractDocxText } from './docxReader.js';
import { extractSpreadsheetData } from './spreadsheetReader.js';
import { extractImageText } from './imageOcr.js';

const EXT_MAP = {
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.xlsx': 'spreadsheet',
    '.xls': 'spreadsheet',
    '.csv': 'spreadsheet',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.webp': 'image',
    '.bmp': 'image',
};

const MIME_MAP = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
    'application/vnd.ms-excel': 'spreadsheet',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
    'image/bmp': 'image',
};

/**
 * Deteksi kategori file dari nama file + magic bytes (fallback kalau ekstensi
 * ambigu/hilang). Return null kalau format tidak didukung.
 */
async function detectFileKind(buffer, filename = '') {
    const ext = path.extname(filename || '').toLowerCase();
    if (EXT_MAP[ext]) return EXT_MAP[ext];

    try {
        const detected = await fileTypeFromBuffer(buffer);
        if (detected?.mime && MIME_MAP[detected.mime]) return MIME_MAP[detected.mime];
    } catch { /* fall through */ }

    return null;
}

/**
 * Pintu masuk utama: baca file apapun yang didukung dari buffer mentah.
 * @param {Buffer} buffer
 * @param {string} filename - nama file asli (dipakai buat deteksi ekstensi + ditampilkan di metadata)
 * @returns {Promise<{
 *   kind: string|null,
 *   text: string|null,
 *   meta: object,
 *   error: string|null
 * }>}
 */
export async function extractFromBuffer(buffer, filename = 'file') {
    const meta = {
        filename,
        sizeBytes: buffer?.length || 0,
        sizeKB: buffer ? +(buffer.length / 1024).toFixed(1) : 0,
    };

    if (!buffer || !buffer.length) {
        return { kind: null, text: null, meta, error: 'File kosong / gagal diunduh.' };
    }

    const kind = await detectFileKind(buffer, filename);
    if (!kind) {
        return {
            kind: null,
            text: null,
            meta,
            error: 'Format file tidak didukung. Yang bisa dibaca: PDF, DOCX, XLSX/XLS/CSV, JPG/PNG/WEBP/BMP.',
        };
    }

    switch (kind) {
        case 'pdf': {
            const res = await extractPdfText(buffer);
            return { kind, text: res.text, meta: { ...meta, pageCount: res.pageCount, info: res.info }, error: res.error };
        }
        case 'docx': {
            const res = await extractDocxText(buffer);
            return { kind, text: res.text, meta: { ...meta, warnings: res.warnings }, error: res.error };
        }
        case 'spreadsheet': {
            const res = extractSpreadsheetData(buffer);
            return { kind, text: res.text, meta: { ...meta, sheets: res.sheets?.map(s => ({ name: s.name, rowCount: s.rowCount })) }, error: res.error };
        }
        case 'image': {
            const res = await extractImageText(buffer);
            return { kind, text: res.text, meta: { ...meta, confidence: res.confidence }, error: res.error };
        }
        default:
            return { kind: null, text: null, meta, error: 'Format file tidak didukung.' };
    }
}
