/* ╔══════════════════════════════════════════╗
   ║  PDF READER                                 ║
   ║  Ekstrak teks dari buffer PDF pakai         ║
   ║  pdf-parse (murni JS, gak perlu binary luar) ║
   ╚══════════════════════════════════════════╝ */
import pdfParse from 'pdf-parse';

/**
 * Ekstrak teks dari buffer PDF.
 * @param {Buffer} buffer - isi file PDF mentah
 * @param {number} maxChars - batas panjang teks yang dikembalikan
 * @returns {Promise<{ text: string, pageCount: number, info: object, error: string|null }>}
 */
export async function extractPdfText(buffer, maxChars = 6000) {
    try {
        const data = await pdfParse(buffer);
        const text = (data.text || '').trim();

        if (!text) {
            return {
                text: null,
                pageCount: data.numpages || 0,
                info: data.info || {},
                error: 'PDF terbaca tapi tidak ada teks yang bisa diekstrak (kemungkinan hasil scan gambar — coba OCR).',
            };
        }

        return {
            text: text.slice(0, maxChars),
            pageCount: data.numpages || 0,
            info: data.info || {},
            error: null,
        };
    } catch (e) {
        return { text: null, pageCount: 0, info: {}, error: `Gagal baca PDF: ${e.message}` };
    }
}
