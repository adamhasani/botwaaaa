/* ╔══════════════════════════════════════════╗
   ║  IMAGE OCR                                  ║
   ║  Ekstrak teks dari gambar pakai Tesseract   ║
   ║  (tesseract.js — murni JS/WASM, gak perlu   ║
   ║  install binary Tesseract di VPS)           ║
   ╚══════════════════════════════════════════╝ */
import { createWorker } from 'tesseract.js';

let workerPromise = null;

// Worker di-init sekali aja (lazy singleton) — bikin baru tiap request itu
// mahal (~1-2 detik + download language data di run pertama).
function getWorker() {
    if (!workerPromise) {
        workerPromise = createWorker('ind+eng').catch((e) => {
            workerPromise = null; // biar bisa dicoba lagi kalau gagal (misal gagal download lang data)
            throw e;
        });
    }
    return workerPromise;
}

/**
 * Ekstrak teks dari buffer gambar (jpg/png/webp/dll) pakai OCR.
 * @param {Buffer} buffer - isi file gambar mentah
 * @param {number} maxChars - batas panjang teks yang dikembalikan
 * @returns {Promise<{ text: string, confidence: number, error: string|null }>}
 */
export async function extractImageText(buffer, maxChars = 3000) {
    try {
        const worker = await getWorker();
        const { data } = await worker.recognize(buffer);
        const text = (data.text || '').trim();

        if (!text) {
            return { text: null, confidence: data.confidence || 0, error: 'Gambar terbaca tapi tidak ada teks yang terdeteksi.' };
        }

        return { text: text.slice(0, maxChars), confidence: data.confidence || 0, error: null };
    } catch (e) {
        return { text: null, confidence: 0, error: `Gagal OCR gambar: ${e.message}` };
    }
}

/**
 * Matikan worker OCR (panggil pas graceful shutdown biar proses gak nge-hang).
 */
export async function terminateOcrWorker() {
    if (workerPromise) {
        try {
            const worker = await workerPromise;
            await worker.terminate();
        } catch { /* abaikan, proses mau mati juga */ }
        workerPromise = null;
    }
}
