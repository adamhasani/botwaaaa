/* ╔══════════════════════════════════════════════════════╗
   ║  DOCUMENT HANDLER                                        ║
   ║  Logika bersama buat proses dokumen (PDF/DOCX/XLSX/gambar) ║
   ║  yang masuk dari WA maupun Telegram: ekstrak isi -> ringkas ║
   ║  via Groq -> balas -> (opsional) simpan ke database.       ║
   ╚══════════════════════════════════════════════════════╝ */
import * as db from './simpananDb.js';
import { askGroqSimple } from './groqAI.js';
import { extractFromBuffer } from './fileReaders/index.js';

const KIND_LABEL = {
    pdf: 'PDF',
    docx: 'Dokumen Word',
    spreadsheet: 'Spreadsheet',
    image: 'Gambar (OCR)',
};

/**
 * Proses buffer dokumen: ekstrak teks, ringkas via AI, balas ke chat,
 * dan simpan ke database kalau `save` true.
 *
 * @param {object} conn - objek conn (WA atau Telegram adapter), harus punya sendMessage()
 * @param {object} msg - objek msg (dipakai buat `quoted`)
 * @param {object} opts
 * @param {string} opts.chatId
 * @param {Buffer} opts.buffer
 * @param {string} opts.filename
 * @param {boolean} [opts.save=false] - simpan hasil ekstraksi ke items db
 * @param {boolean} [opts.summarize=true] - ringkas via Groq (kalau false, kirim potongan teks mentah)
 */
export async function processDocumentBuffer(conn, msg, { chatId, buffer, filename, save = false, summarize = true }) {
    await conn.sendMessage(chatId, { text: `📥 Membaca *${filename}*...` }, { quoted: msg });

    const result = await extractFromBuffer(buffer, filename);

    if (result.error && !result.text) {
        await conn.sendMessage(chatId, { text: `⚠️ ${result.error}` }, { quoted: msg });
        return result;
    }

    const label = KIND_LABEL[result.kind] || 'File';
    let body;

    if (summarize) {
        try {
            body = await askGroqSimple(
                `Ringkas isi ${label.toLowerCase()} berikut jadi poin-poin penting, bahasa santai Indonesia:\n\n${result.text}`,
                500
            );
        } catch (e) {
            body = result.text.slice(0, 1500); // fallback: kirim potongan teks mentah kalau AI gagal
        }
    } else {
        body = result.text.slice(0, 1500);
    }

    let metaLine = '';
    if (result.kind === 'pdf') metaLine = `📄 ${result.meta.pageCount || '?'} halaman`;
    else if (result.kind === 'spreadsheet') metaLine = `📊 ${result.meta.sheets?.length || 0} sheet`;
    else if (result.kind === 'image') metaLine = `🔎 Keyakinan OCR: ${Math.round(result.meta.confidence || 0)}%`;

    let out = `📎 *${label} — ${filename}*\n${metaLine ? metaLine + '\n' : ''}\n${body}`;

    if (save) {
        db.saveItem(`[${label.toUpperCase()}] ${filename} | ${result.text.slice(0, 500)}`, 'document', result.kind);
        out += '\n\n✅ _Disimpan ke database._';
    }

    await conn.sendMessage(chatId, { text: out }, { quoted: msg });
    return result;
}
