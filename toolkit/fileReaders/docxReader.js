/* ╔══════════════════════════════════════════╗
   ║  DOCX READER                                ║
   ║  Ekstrak teks dari buffer .docx pakai       ║
   ║  mammoth (gak baca .doc lama, cuma .docx)   ║
   ╚══════════════════════════════════════════╝ */
import mammoth from 'mammoth';

/**
 * Ekstrak teks dari buffer .docx.
 * @param {Buffer} buffer - isi file .docx mentah
 * @param {number} maxChars - batas panjang teks yang dikembalikan
 * @returns {Promise<{ text: string, warnings: string[], error: string|null }>}
 */
export async function extractDocxText(buffer, maxChars = 6000) {
    try {
        const result = await mammoth.extractRawText({ buffer });
        const text = (result.value || '').trim();

        if (!text) {
            return { text: null, warnings: result.messages?.map(m => m.message) || [], error: 'Dokumen terbaca tapi tidak ada teks di dalamnya.' };
        }

        return {
            text: text.slice(0, maxChars),
            warnings: result.messages?.map(m => m.message) || [],
            error: null,
        };
    } catch (e) {
        return { text: null, warnings: [], error: `Gagal baca DOCX: ${e.message}. Catatan: format .doc lama (bukan .docx) tidak didukung.` };
    }
}
